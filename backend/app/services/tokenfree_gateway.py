"""AI Gateway 集成支持 (ToraAPI / TokenFree / New API)."""

from __future__ import annotations

from typing import Any

from app.schemas_routing import SystemModelChannel

TOKENFREE_CHANNEL_ID = "tokenfree"
TOKENFREE_CHANNEL_NAME = "AI Gateway (ToraAPI / TokenFree)"
# New API OpenAI 兼容根路径 (默认指向 ToraAPI)
TOKENFREE_BASE_URL = "https://www.toraapi.com/v1"
TOKENFREE_CONSOLE_URL = "https://www.toraapi.com"
# New API 内部额度：500000 quota = 1 USD
TOKENFREE_QUOTA_PER_USD = 500_000


def get_configured_gateway_url() -> str:
    """获取当前配置的 Gateway Base URL（支持 toraapi.com 或 tokenfree.com）。"""
    from app.config import get_settings

    s = get_settings()
    configured = (s.openai_base_url or s.ark_base_url or "").strip().rstrip("/")
    return configured if configured else TOKENFREE_BASE_URL


def tokenfree_site_origin(base_url: str | None = None) -> str:
    """把 /v1 兼容根路径收成站点 origin，供 /api/* 与 dashboard 计费用。"""
    raw = (base_url or get_configured_gateway_url()).strip().rstrip("/")
    if raw.endswith("/v1"):
        return raw[: -len("/v1")].rstrip("/")
    return raw


def resolve_tokenfree_api_key() -> str:
    """优先渠道 Key，其次运行时 overlay / 环境变量。"""
    try:
        from app.services.model_settings import get_routing_snapshot

        channels = get_routing_snapshot().channels
    except Exception:  # noqa: BLE001
        channels = []
    for channel in channels:
        if channel.id == TOKENFREE_CHANNEL_ID and (channel.api_key or "").strip():
            return (channel.api_key or "").strip()
    from app.config import get_settings

    s = get_settings()
    return (s.openai_api_key or s.ark_api_key or "").strip()


def locked_tokenfree_channel(
    *,
    api_key: str = "",
    has_api_key: bool | None = None,
    models: list[str] | None = None,
    enabled: bool = True,
) -> SystemModelChannel:
    """构造唯一网关渠道（自动跟随当前配置的 Base URL）。"""
    key = (api_key or "").strip()
    current_base = get_configured_gateway_url()
    return SystemModelChannel(
        id=TOKENFREE_CHANNEL_ID,
        name=TOKENFREE_CHANNEL_NAME,
        base_url=current_base,
        api_key=key,
        has_api_key=bool(key) if has_api_key is None else bool(has_api_key),
        api_format="openai",
        protocol="auto",
        models=list(dict.fromkeys(m.strip() for m in (models or []) if m and m.strip())),
        enabled=enabled,
        sort_order=0,
    )


def pick_migratable_api_key(channels: list[SystemModelChannel]) -> str:
    """只迁 TokenFree/ToraAPI 渠道 Key。"""
    for channel in channels:
        if channel.id == TOKENFREE_CHANNEL_ID and (channel.api_key or "").strip():
            return (channel.api_key or "").strip()
    for channel in channels:
        key = (channel.api_key or "").strip()
        base = (channel.base_url or "").strip().lower()
        if key and ("tokenfree.com" in base or "toraapi.com" in base):
            return key
    return ""


def apply_tokenfree_flat_overlay(flat: dict[str, Any], channels: list[SystemModelChannel]) -> dict[str, Any]:
    """运行时把 Gateway Key / Base 同步到 LLM 与方舟客户端共用字段。"""
    channel = next((item for item in channels if item.id == TOKENFREE_CHANNEL_ID), None)
    if channel is None:
        return flat
    out = dict(flat)
    active_base = get_configured_gateway_url()
    out["openai_base_url"] = active_base
    out["ark_base_url"] = active_base
    key = (channel.api_key or "").strip()
    if key:
        out["openai_api_key"] = key
        out["ark_api_key"] = key
    return out
