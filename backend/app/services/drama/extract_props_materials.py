"""从剧本摘要与分集正文抽取道具（对齐 manju extractPropsMaterials，已停用素材）。"""

from __future__ import annotations

import json
from typing import Any

from app.services.drama.llm import drama_chat_json
from app.services.drama.language import has_language_violation, language_instruction
from app.services.agent.runner import run_task_json

SUMMARY_TEXT_MAX = 4000
EPISODE_SAMPLE_MAX = 2500

SYSTEM_PROMPT = """You are a drama art director responsible for identifying key props from the script summary and episode text for subsequent AI image generation.

Props:
- Objects held, passed, or given close-ups by characters (tools, tokens, weapons, magical items, documents, medical instruments).
- Only identify key props with high story significance (4–8 items max).
- Do not include characters, locations, or atmosphere scenery as props.

Output Requirements:
1. Short recognizable name; concise visual prompt (30–60 words) describing appearance (material, color, scale, wear/details). Use the same language as the input script (e.g. Thai if Thai, Chinese if Chinese, English if English).
2. Do not include camera instructions or meta tags like "concept art", "white background".
3. Must return strictly valid JSON: {"props":[{"name":"...","visualPrompt":"..."}]}
4. Do not output materials field.
"""


# 按名称去重（保留首次）
def _dedupe_by_name(items: list[dict[str, Any]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    result: list[dict[str, str]] = []
    for item in items:
        name = str(item.get("name") or "").strip()
        if not name or name in seen:
            continue
        prompt = str(item.get("visualPrompt") or item.get("visualImage") or "").strip()
        if len(prompt) < 8:
            continue
        seen.add(name)
        result.append({"name": name, "visualPrompt": prompt})
    return result


# 规范化 LLM 返回
def _normalize_payload(raw: Any) -> dict[str, list[dict[str, Any]]]:
    if not isinstance(raw, dict):
        return {"props": [], "materials": []}

    def read_list(key: str) -> list[dict[str, Any]]:
        value = raw.get(key)
        if not isinstance(value, list):
            return []
        out: list[dict[str, Any]] = []
        for item in value:
            if isinstance(item, dict):
                out.append(item)
        return out

    return {"props": read_list("props"), "materials": []}


async def extract_props_materials(
    *,
    summary: dict[str, Any] | None,
    episode_bodies: list[str],
    source: str = "",
    db: Any | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> dict[str, list[dict[str, str]]]:
    """调用 LLM 抽取道具（materials 恒为空，兼容旧调用方）。

    Returns:
        {"props": [{"name","visualPrompt"}], "materials": []}
    """
    summary_text = json.dumps(summary or {}, ensure_ascii=False)
    samples = [b.strip() for b in episode_bodies if (b or "").strip()][:6]
    if samples:
        episode_block = "\n\n".join(
            f"【分集样例 {i + 1}】\n{text[:EPISODE_SAMPLE_MAX]}" for i, text in enumerate(samples)
        )
    else:
        episode_block = "（暂无分集正文）"

    language_source = source or summary_text
    user = "\n".join(
        [
            language_instruction(language_source),
            "【剧本摘要】",
            summary_text[:SUMMARY_TEXT_MAX],
            "",
            episode_block,
            "",
            "CRITICAL: Output ONLY valid JSON: {\"props\": [{\"name\": \"...\", \"visualPrompt\": \"...\"}]}. No markdown.",
        ]
    )
    if db is not None and user_id is not None:
        raw = await run_task_json(
            db,
            user_id,
            task="extract_assets",
            system=SYSTEM_PROMPT,
            user=user,
            max_tokens=2048,
            skill_ids=skill_ids,
        )
    else:
        raw = await drama_chat_json(SYSTEM_PROMPT, user, max_tokens=2048)
    normalized = _normalize_payload(raw)
    visible = "\n".join(
        f"{item.get('name', '')} {item.get('visualPrompt', '')}"
        for item in normalized["props"]
        if isinstance(item, dict)
    )
    if has_language_violation(language_source, visible, strict=True):
        raise ValueError("道具提取结果语言与原始剧本不一致")
    return {
        "props": _dedupe_by_name(normalized["props"]),
        "materials": [],
    }
