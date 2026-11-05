"""剧本摘要 Agent 提示词与用户消息（对齐 manju scriptSummary）。"""

from __future__ import annotations

from app.services.drama.image_styles import (
    IMAGE_STYLE_IDS,
    get_image_style_label,
    resolve_image_style_prompt,
)
from app.services.drama.language import detect_content_language, language_instruction

# SCRIPT_SUMMARY_SYSTEM_PROMPT 指导 LLM 将原始创意转为结构化剧本摘要
SCRIPT_SUMMARY_SYSTEM_PROMPT = """你是专业的短剧/网剧剧本策划，负责把用户提供的原始创意、故事大纲或灵感，整理成可直接用于立项与编剧开工的结构化「剧本摘要」。

【核心准则 / CRITICAL INSTRUCTIONS】
1. 必须输出严格合法的 JSON 对象，直接以 "{" 开头，以 "}" 结尾。绝不要输出 markdown 围栏（如 ```json），绝不要输出任何前言、开场白、反驳、辩论、剧情讨论或结尾闲聊！
2. 语言统一性：所有字段的值必须使用与用户创意相同的语言（若用户提供泰语创意，全篇所有字段内容必须全部输出自然流畅的泰语，不得混杂中文）。
3. 画面风格（visual style）：仅作为人物 visualImage 与视觉摄影美学基调的光影/质感滤镜，绝对不得以此为由质疑、拒绝或与故事设定产生冲突争辩。直接服从并完成 JSON 生成。
4. 篇幅精炼与响应速度控制（至关重要）：
    - characters: 必须提取故事中所有具名出场角色（主角、配角、反派、关键动物/神奇生物/拟人角色），不要只取 4-6 人，不要漏掉原始创意中明确出现的角色；群演或道具才可合并或排除。
    - visualImage: 每人 120-260 个字符，使用原始创意语言，必须包含完整的【外貌特征】（年龄、性别/物种、五官特征、体型、体态与神态）与【造型特征】（发型发色、服装款式、材质、颜色、标志性配饰），纯静态视觉描述，可直接用于角色三视图生图。
   - identityBackground, growthExperience, personality, relationships, growthArc: 每项 1-2 句精炼描述。其中 growthArc 必须用「阶段A -> 阶段B -> 阶段C」格式。
    - synopsis: 200-400 个字符，使用原始创意语言，精炼叙述核心世界观、主线冲突、高潮与结局。
    - seriesTitle: 使用原始创意语言的简洁短剧名（4-16 个字符），禁止占位词。
   - oneLineStory: 1 句话核心看点与反转。
   - 若用户提供了目标集数，episodeCount 必须与该值完全一致；未提供时估算 12-24 集。

必须输出严格 JSON 对象，字段格式：
{
  "episodeCount": number,
  "seriesTitle": string,
  "storyType": string,
  "targetAudience": string,
  "coreHook": string,
  "oneLineStory": string,
  "characters": [
    {
      "name": string,
      "title": string,
      "roleType": string,
      "visualImage": string,
      "coreTags": string,
      "identityBackground": string,
      "growthExperience": string,
      "personality": string,
      "relationships": string,
      "growthArc": string
    }
  ],
  "synopsis": string
}"""


# 解析合法的画面风格 ID
def _resolve_image_style_id(style_id: str | None) -> str | None:
    if not style_id:
        return None
    sid = style_id.strip()
    return sid if sid in IMAGE_STYLE_IDS else None


# 将入参格式化为 LLM 用户消息（对齐 manju buildScriptSummaryUserMessage）
def build_script_summary_user_message(
    creative: str,
    *,
    episode_count: int | None = None,
    image_style_id: str | None = None,
) -> str:
    trimmed = (creative or "").strip()
    sections = [f"原始创意：\n{trimmed}", language_instruction(trimmed)]
    production_params: list[str] = []

    if episode_count is not None:
        production_params.append(
            f"- 目标集数：{episode_count} 集（输出中的 episodeCount 必须与该值完全一致，不得自行修改）"
        )

    resolved_style = _resolve_image_style_id(image_style_id)
    if resolved_style:
        lang = detect_content_language(trimmed)
        label = get_image_style_label(resolved_style)
        style_prompt = resolve_image_style_prompt(resolved_style, lang=lang)
        production_params.append(f"- 画面风格：{resolved_style if lang == 'th' else f'{label}（{resolved_style}）'}")
        if style_prompt:
            production_params.append(f"  风格说明：{style_prompt}")
        production_params.append("  人物 visualImage、故事类型标签与整体美学须符合该画面风格")

    if production_params:
        sections.append("\n".join(["制作参数：", *production_params]))

    sections.append(
        "【输出强制要求】：必须完整提取原始创意中所有具名出场角色（包括主角、重要配角、反派、关键动物/神奇生物/拟人角色，严禁只取4-6人或遗漏角色），每个角色的 visualImage 必须详尽描述外貌与服装造型特征；直接输出合法的 JSON 对象（以 { 开头，以 } 结尾），严禁输出任何 markdown 围栏或解释。全篇所有字段的值必须使用与原始创意相同的语言撰写。"
    )

    return "\n\n".join(sections)
