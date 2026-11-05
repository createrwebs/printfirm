"""OpenAI 兼容文字模型客户端（任意兼容上游：Kimi / DeepSeek / OpenAI 等）。"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx

from app.config import get_settings
from app.services.logical_model_router import (
    resolve_logical_model,
    resolve_logical_model_id,
    resolve_upstream_model,
)
from app.services.tasks.upstream import observed_request

logger = logging.getLogger(__name__)

# DEFAULT_MAX_TOKENS 分集正文等结构化输出需要足够 completion 空间
DEFAULT_MAX_TOKENS = 32768


class LlmUnavailableError(RuntimeError):
    """文字 LLM 未配置或不可用。"""


# 解析 LLM API Key（对齐 manju resolveOpenaiApiKey）
def resolve_llm_api_key() -> str:
    key = (get_settings().openai_api_key or "").strip()
    if not key:
        raise LlmUnavailableError(
            "未配置 OPENAI_API_KEY，无法调用文字模型。"
            "请在管理后台「系统设置 → 模型」填写 TokenFree API Key 并选择文本模型。"
        )
    return key


# 解析 OpenAI 兼容 Base URL
def resolve_llm_base_url() -> str:
    base = (get_settings().openai_base_url or "").strip().rstrip("/")
    if base:
        return base
    return "https://api.openai.com/v1"


# kimi / deepseek-v4 默认 thinking 会占满 token、content 常为空；结构化产出统一关闭
def _llm_extra_body(model: str) -> dict[str, Any]:
    mid = (model or "").strip().lower()
    if mid.startswith("kimi") or mid.startswith("deepseek-v4"):
        return {"thinking": {"type": "disabled"}}
    return {}


# 从 chat/completions 响应提取正文
def _message_content(data: dict[str, Any]) -> str:
    choices = data.get("choices") or []
    if not choices:
        return ""
    message = choices[0].get("message") or {}
    content = message.get("content")
    if content:
        return str(content)
    # 部分兼容网关把结果放在 reasoning_content
    reasoning = message.get("reasoning_content")
    return str(reasoning or "")


def _format_upstream_error(status_code: int, body: str) -> str:
    """将常见网关错误转换成可执行的配置/重试提示。"""
    if status_code == 401:
        return (
            "LLM 鉴权失败：当前模型渠道 API Key 无效或已过期，请在管理后台「系统设置 → 模型」"
            "重新保存 TokenFree/ToraAPI API Key。"
            + (f" 上游信息：{body[:400]}" if body else "")
        )
    if status_code == 524:
        return (
            "LLM 上游超时：网关等待模型响应超过限制，请切换到 Kimi K2.6 或 DeepSeek V4 Pro，"
            "或缩短输入后重试。"
            + (f" 上游信息：{body[:300]}" if body else "")
        )
    return body[:800]


# 调用 OpenAI 兼容 chat/completions
async def chat_completions(
    system: str,
    user: str,
    *,
    temperature: float = 0.6,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    timeout: float = 300.0,
    response_format: dict[str, Any] | None = None,
) -> str:
    settings = get_settings()
    # Apply managed model switches before falling back to environment credentials.
    try:
        resolve_upstream_model("text", None)
    except ValueError as exc:
        raise LlmUnavailableError(str(exc)) from exc
    logical_id = resolve_logical_model_id("text", None)
    route = resolve_logical_model("text", logical_id)
    if route:
        api_key = route.api_key
        model = (route.upstream_model or "").strip()
        base = route.base_url.rstrip("/") or resolve_llm_base_url()
    else:
        api_key = resolve_llm_api_key()
        model = (settings.model_llm or "").strip()
        base = resolve_llm_base_url()
    if not model:
        raise LlmUnavailableError(
            "未解析到可用文字模型。请在管理后台填写 TokenFree API Key，拉取并选择文本模型。"
        )
    if model.lower().startswith("deepseek") and (getattr(settings, "deepseek_api_key", "") or "").strip():
        api_key = settings.deepseek_api_key.strip()
        base = (getattr(settings, "deepseek_base_url", "") or "https://api.deepseek.com/v1").strip().rstrip("/")
        if not base.endswith("/v1") and "api.deepseek.com" in base.lower():
            base = f"{base}/v1"
        if "api.deepseek.com" in base.lower() and model.lower() not in {"deepseek-chat", "deepseek-reasoner"}:
            model = "deepseek-chat"
        # DeepSeek official endpoint max_tokens limit is 8192 for deepseek-chat
        if "api.deepseek.com" in base.lower() and max_tokens > 8192:
            max_tokens = 8192
    # kimi 系列仅允许 temperature=0.6，其它值会 400
    effective_temperature = 0.6 if model.lower().startswith("kimi") else temperature

    payload: dict[str, Any] = {
        "model": model,
        "temperature": effective_temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    extra = _llm_extra_body(model)
    if extra:
        payload.update(extra)
    if response_format:
        payload["response_format"] = response_format

    models_to_try = [model]
    if "claude" in model.lower():
        for fallback in ["claude-haiku-4-5", "claude-haiku-5-5", "claude-sonnet-5-5", "claude-sonnet-5", "claude-opus-5-5"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)
    elif model.lower().startswith("deepseek") and "toraapi.com" in base.lower():
        for fallback in ["deepseek-chat", "deepseek-v4-pro", "claude-haiku-4-5"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

    last_error: Exception | None = None
    for cur_model in models_to_try:
        payload["model"] = cur_model
        for attempt in range(2):
            logger.info(
                "调用文字 LLM model=%s (attempt=%s) base=%s key_head=%s user_len=%s max_tokens=%s",
                cur_model,
                attempt + 1,
                base,
                (api_key or "")[:10] + "..." + (api_key or "")[-4:],
                len(user or ""),
                max_tokens,
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                try:
                    res = await observed_request(
                        client,
                        "POST",
                        f"{base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                except httpx.RequestError as exc:
                    logger.warning("LLM 请求网络异常 model=%s err=%s, 重试中...", cur_model, exc)
                    await asyncio.sleep(1.5)
                    last_error = exc
                    continue

                if res.status_code >= 400:
                    text_err = res.text or ""
                    is_transient = (
                        (res.status_code in (429, 500, 502, 503, 504, 524) or (res.status_code == 401 and attempt == 0))
                        or "temporarily_unavailable" in text_err
                        or "retry later" in text_err.lower()
                    )
                    if is_transient:
                        logger.warning(
                            "LLM 暂时不可用 (status=%s, body=%s)，等待重试或切换备用模型...",
                            res.status_code,
                            text_err[:150],
                        )
                        await asyncio.sleep(2.0 * (attempt + 1))
                        detail = _format_upstream_error(res.status_code, text_err)
                        last_error = RuntimeError(f"LLM error {res.status_code}: {detail}")
                        break
                    detail = _format_upstream_error(res.status_code, text_err)
                    raise RuntimeError(f"LLM error {res.status_code}: {detail}")

                body = (res.text or "").strip()
                if not body:
                    last_error = RuntimeError(f"LLM 返回空响应体 (HTTP {res.status_code})")
                    continue
                lowered = body[:256].lower()
                if lowered.startswith("<!doctype") or lowered.startswith("<html"):
                    raise RuntimeError(
                        f"LLM 渠道 Base URL 配置错误（返回了网页 HTML 而非 API JSON）。"
                        f"当前 base={base}，请检查管理后台「模型渠道」的 Base URL 是否为 OpenAI 兼容 API 地址"
                        f"（如 https://api.deepseek.com 或 https://api.moonshot.cn/v1），而非网站首页。"
                    )
                try:
                    data = res.json()
                except json.JSONDecodeError as exc:
                    raise RuntimeError(f"LLM 响应不是合法 JSON: {body[:200]}") from exc

            content = _message_content(data)
            logger.info("文字 LLM 返回 content_len=%s", len(content))
            return content

    if last_error:
        raise last_error
    raise RuntimeError("所有文字 LLM 模型尝试失败")
