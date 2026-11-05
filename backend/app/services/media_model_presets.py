"""站点预设模型清单 + 按模型生成参数白名单。"""

from __future__ import annotations

from typing import Any

from app.schemas_routing import LogicalModelCapability
from app.services.model_routing_config import normalize_model_name

# 管理端四下拉 + 渠道 models 硬编码白名单（含前台展示文案）
# id 与 TokenFree 目录展示名对齐（点分：seedance-2.0 / seedream-5.0-pro）
PRESET_MODELS: dict[LogicalModelCapability, tuple[dict[str, str], ...]] = {
    "text": (
        {
            "id": "claude-haiku-4-5",
            "label": "Claude Haiku 4.5",
            "note": "Anthropic Claude Haiku 4.5 - ความเร็วสูงพิเศษ เหมาะสำหรับการสกัดบทและสรุปเรื่องย่อ",
            "pricing_hint": "ToraAPI รวดเร็วมาก (15-20s)",
        },
        {
            "id": "claude-haiku-5-5",
            "label": "Claude Haiku 5.5",
            "note": "Anthropic Claude Haiku 5.5 - รุ่นใหม่ความเร็วสูง ตอบสนองไว",
            "pricing_hint": "ToraAPI รองรับ",
        },
        {
            "id": "claude-sonnet-5-5",
            "label": "Claude Sonnet 5.5",
            "note": "Anthropic Claude Sonnet 5.5 - โมเดลหลักความเร็วและความแม่นยำสูง",
            "pricing_hint": "ToraAPI เสถียรและเร็ว",
        },
        {
            "id": "claude-sonnet-5",
            "label": "Claude Sonnet 5",
            "note": "Anthropic Claude Sonnet 5 - คุณภาพสูงสุดสำหรับการเขียนบท",
            "pricing_hint": "ToraAPI รองรับ",
        },
        {
            "id": "claude-opus-5-5",
            "label": "Claude Opus 5.5",
            "note": "Anthropic Claude Opus 5.5 - โมเดลเรือธงสำหรับการคิดวิเคราะห์เชิงลึก",
            "pricing_hint": "ToraAPI รองรับ",
        },
        {
            "id": "deepseek-chat",
            "label": "DeepSeek Chat (V3)",
            "note": "DeepSeek Chat - รองรับ DEEPSEEK_API_KEY ใน .env หรือผ่าน ToraAPI",
            "pricing_hint": "ประหยัดคุ้มค่า",
        },
        {
            "id": "deepseek-reasoner",
            "label": "DeepSeek Reasoner (R1)",
            "note": "DeepSeek Reasoner - โมเดลสายวิเคราะห์เชิงลึก รองรับ DEEPSEEK_API_KEY ใน .env",
            "pricing_hint": "เหมาะกับงานวิเคราะห์ซับซ้อน",
        },
        {
            "id": "deepseek-v4-pro",
            "label": "DeepSeek V4 Pro",
            "note": "การให้เหตุผลแข็งแกร่ง คุ้มค่าราคา เหมาะสำหรับการขยายความและเกลาบท",
            "pricing_hint": "ประหยัดคุ้มค่า",
        },
        {
            "id": "gpt-6.1-sol",
            "label": "GPT 6.1",
            "note": "ความสามารถรอบด้านสูง แม่นยำกับคำสั่งซับซ้อนและหลายภาษา",
            "pricing_hint": "ToraAPI รองรับ",
        },
        {
            "id": "gpt-5.5",
            "label": "GPT 5.5",
            "note": "OpenAI GPT 5.5 - สมดุลความเร็วและคุณภาพสำหรับงานเขียนบท",
            "pricing_hint": "ToraAPI รองรับ",
        },
        {
            "id": "gpt-5.4",
            "label": "GPT 5.4",
            "note": "OpenAI GPT 5.4 - รวดเร็วและเสถียรสำหรับสกัดข้อมูลโครงสร้าง",
            "pricing_hint": "ToraAPI รองรับ",
        },
        {
            "id": "kimi-k2.6",
            "label": "Kimi K2.6",
            "note": "โมเดลบทและสตอรี่บอร์ด รองรับบริบทยาวได้ดี",
            "pricing_hint": "เหมาะสำหรับบทยาว",
        },
    ),
    "image": (
        {
            "id": "seedream-5.0-pro",
            "label": "Seedream 5.0 Pro",
            "note": "แนะนำสำหรับออกแบบตัวละคร ความสม่ำเสมอของตัวละครสูง",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 20–60 วินาที/ภาพ",
        },
        {
            "id": "seedream-5.0",
            "label": "Seedream 5.0",
            "note": "ภาพนิ่งมาตรฐาน สมดุลระหว่างคุณภาพและต้นทุน",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 15–40 วินาที/ภาพ",
        },
        {
            "id": "seedream-5.0-flash",
            "label": "Seedream 5.0 Flash",
            "note": "เร็วและประหยัดกว่า เหมาะสำหรับภาพร่างและทดลองจำนวนมาก",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 10–25 วินาที/ภาพ",
        },
        {
            "id": "nano-banana-2",
            "label": "Nano Banana 2",
            "note": "โมเดลสร้างและแก้ไขภาพความละเอียดสูง รองรับภาพอ้างอิงหลายภาพ",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 15–45 วินาที/ภาพ",
        },
        {
            "id": "qwen-image-3.0-pro",
            "label": "Qwen Image 3.0 Pro",
            "note": "Alibaba Qwen Image 3.0 Pro - องค์ประกอบภาพและแสงเงาสมจริง",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 15–45 วินาที/ภาพ",
        },
        {
            "id": "flux-3",
            "label": "Flux 3 Klein",
            "note": "Flux 3 - รายละเอียดพื้นผิวและสไตล์ภาพยนตร์โดดเด่น",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 15–45 วินาที/ภาพ",
        },
        {
            "id": "grok-image-2.0",
            "label": "Grok Imagine 2.0",
            "note": "xAI Grok Imagine 2.0 - สร้างภาพสร้างสรรค์และแก้ไขตามคำสั่งแม่นยำ",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 15–45 วินาที/ภาพ",
        },
        {
            "id": "gpt-image-2",
            "label": "GPT Image 2",
            "note": "OpenAI สร้างภาพ แสงเงาและตัวอักษรคมชัด เหมาะสำหรับโปสเตอร์และภาพนิ่งละเอียด",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 30–90 วินาที/ภาพ",
        },
        {
            "id": "gpt-image-2.5",
            "label": "GPT Image 2.5",
            "note": "OpenAI รุ่นใหม่ รายละเอียดและตัวอักษรแม่นยำยิ่งขึ้น เหมาะสำหรับออกแบบตัวละคร",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 30–120 วินาที/ภาพ",
        },
    ),
    "video": (
        {
            "id": "seedance-2.5",
            "label": "Seedance 2.5",
            "note": "แนะนำสำหรับงานจริง คุณภาพสูง; 4–30 วินาที รองรับถึง 1080p",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 3–8 นาที/ช็อต",
        },
        {
            "id": "seedance-2.0",
            "label": "Seedance 2.0",
            "note": "วิดีโอมาตรฐาน มุมกล้องนิ่ง; 4–15 วินาที สูงสุด 720p",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 2–5 นาที/ช็อต",
        },
        {
            "id": "seedance-2.0-fast",
            "label": "Seedance 2.0 Fast",
            "note": "รุ่นความเร็วสูง 2.0 เหมาะสำหรับเร่งงาน; 4–15 วินาที สูงสุด 720p",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 1–4 นาที/ช็อต",
        },
        {
            "id": "wan-2.7",
            "label": "Wan 2.7",
            "note": "Alibaba Wan 2.7 (T2V / I2V) - เคลื่อนไหวเป็นธรรมชาติ รองรับ 720p / 1080p",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 2–5 นาที/ช็อต",
        },
        {
            "id": "wan-3.0",
            "label": "Wan 3.0",
            "note": "Alibaba Wan 3.0 รุ่นล่าสุด - คุณภาพภาพยนตร์และฟิสิกส์สมจริง",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 2–6 นาที/ช็อต",
        },
        {
            "id": "kling-3.0",
            "label": "Kling 3.0",
            "note": "Kuaishou Kling 3.0 - มุมกล้องภาพยนตร์และเสียงประกอบในตัว; 4–15 วินาที",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 2–6 นาที/ช็อต",
        },
        {
            "id": "vidu-q4",
            "label": "Vidu Q4",
            "note": "Shengshu Vidu Q4 - รองรับภาพอ้างอิงหลายภาพ (Reference-to-Video) ความต่อเนื่องสูง",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 2–5 นาที/ช็อต",
        },
        {
            "id": "hailuo-2.3",
            "label": "Hailuo 2.3 Pro",
            "note": "MiniMax Hailuo 2.3 Pro - การแสดงสีหน้าและจังหวะการเคลื่อนไหวโดดเด่น",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 2–6 นาที/ช็อต",
        },
        {
            "id": "MiniMax-H3",
            "label": "MiniMax H3",
            "note": "จังหวะเด่น ตัวละครมีชีวิตชีวา; 4–15 วินาที, 480p / 768p",
            "pricing_hint": "คิดตามรุ่นและความละเอียด",
            "eta_hint": "ประมาณ 5–15 นาที/ช็อต",
        },
    ),
    "audio": (
        {
            "id": "qwen-tts-2025-05-22",
            "label": "Qwen TTS",
            "note": "Alibaba Bailian Qwen TTS ระบบพากย์เสียงมาตรฐาน",
            "pricing_hint": "คิดตาม Token",
            "eta_hint": "ประมาณไม่กี่วินาที",
        },
    ),
}

# 生图常用比例（与 Seedream 尺寸表交集）
IMAGE_ASPECT_RATIOS: tuple[str, ...] = (
    "auto",
    "1:1",
    "16:9",
    "9:16",
    "4:3",
    "3:4",
    "3:2",
    "2:3",
    "21:9",
)
# Seedream / GPT Image 2：前端只给 1K/2K，避免选更高档被静默降档
IMAGE_RESOLUTIONS_STANDARD: tuple[str, ...] = ("1K", "2K")
# GPT Image 2.5 支持到 4K
IMAGE_RESOLUTIONS_GPT_IMAGE_25: tuple[str, ...] = ("1K", "2K", "4K")

VIDEO_ASPECT_RATIOS: tuple[str, ...] = ("9:16", "16:9", "1:1")
VIDEO_RESOLUTIONS_FULL: tuple[str, ...] = ("480p", "720p", "1080p")
VIDEO_RESOLUTIONS_SAFE: tuple[str, ...] = ("480p", "720p")
# MiniMax-H3：内部统一小写；不同上游插件的大小写由提交适配层兼容。
VIDEO_RESOLUTIONS_MINIMAX_H3: tuple[str, ...] = ("480p", "768p")


# 历史友好别名 / 旧连字符 id → TokenFree 点分规范 id
PRESET_MODEL_ALIASES: dict[str, str] = {
    "seedance-2-5": "seedance-2.5",
    "seedance2.5": "seedance-2.5",
    "seedance-2": "seedance-2.0",
    "seedance2": "seedance-2.0",
    "seedance-2-0": "seedance-2.0",
    "seedance2.0": "seedance-2.0",
    # Mini 上游未开通：历史选择一律落到 2.0，避免 ModelNotOpen
    "seedance-2-0-mini": "seedance-2.0",
    "seedance-2.0-mini": "seedance-2.0",
    "doubao-seedance-2-0-mini-260615": "seedance-2.0",
    "seedance-2-0-fast": "seedance-2.0-fast",
    "seedance-2.0-fast": "seedance-2.0-fast",
    "wan-2-7": "wan-2.7",
    "wan2.7": "wan-2.7",
    "wan/2-7-image-to-video": "wan-2.7",
    "wan/2-7-text-to-video": "wan-2.7",
    "wan-3-0": "wan-3.0",
    "wan3.0": "wan-3.0",
    "wan/3-0-video": "wan-3.0",
    "kling-3-0": "kling-3.0",
    "kling3.0": "kling-3.0",
    "kling-3.0/video": "kling-3.0",
    "vidu-q4/image-to-video": "vidu-q4",
    "vidu-q4/reference-to-video": "vidu-q4",
    "hailuo-2-3": "hailuo-2.3",
    "hailuo2.3": "hailuo-2.3",
    "hailuo/2-3-image-to-video-pro": "hailuo-2.3",
    "seedream-5-0-pro": "seedream-5.0-pro",
    "seedream-5.0-pro": "seedream-5.0-pro",
    "seedream-5-0": "seedream-5.0",
    "seedream-5": "seedream-5.0",
    "seedream5.0": "seedream-5.0",
    "seedream5": "seedream-5.0",
    "seedream-5-0-flash": "seedream-5.0-flash",
    "seedream-5.0-flash": "seedream-5.0-flash",
    "nano-banana-2-1": "nano-banana-2",
    "qwen-image-3-0-pro": "qwen-image-3.0-pro",
    "flux-3-klein": "flux-3",
    "grok-image-2-0": "grok-image-2.0",
    "gpt-image-2-5": "gpt-image-2.5",
    "gpt-image-2.5": "gpt-image-2.5",
    "gpt-image-2.5-sunburst": "gpt-image-2.5",
    "gpt-image-2-5-sunburst": "gpt-image-2.5",
    "gpt-image-2.5-flare": "gpt-image-2.5",
    "gpt-image-2-5-flare": "gpt-image-2.5",
    "gemini-3.1-flash-tts": "qwen-tts-2025-05-22",
    "gemini-3.1-flash": "qwen-tts-2025-05-22",
}


def preset_ids(capability: LogicalModelCapability) -> list[str]:
    """某能力下的预设上游 id。"""
    return [str(row["id"]) for row in PRESET_MODELS.get(capability, ())]


def resolve_preset_alias(model_id: str | None) -> str:
    """将历史别名映射到预设规范 id；无映射则原样返回。"""
    raw = (model_id or "").strip()
    if not raw:
        return ""
    key = normalize_model_name(raw)
    for alias, canonical in PRESET_MODEL_ALIASES.items():
        if normalize_model_name(alias) == key:
            return canonical
    return raw


def lookup_preset_row(model_id: str | None) -> dict[str, str] | None:
    """按 id（含别名）查找预设行。"""
    mid = normalize_model_name(resolve_preset_alias(model_id))
    if not mid:
        return None
    for rows in PRESET_MODELS.values():
        for row in rows:
            if normalize_model_name(row["id"]) == mid:
                return dict(row)
    return None


def preset_display_meta(model_id: str | None) -> dict[str, str]:
    """前台目录展示：友好名、介绍、资费与大致出片时长。"""
    row = lookup_preset_row(model_id)
    if not row:
        return {"label": "", "note": "", "pricing_hint": "", "eta_hint": ""}
    return {
        "label": str(row.get("label") or ""),
        "note": str(row.get("note") or ""),
        "pricing_hint": str(row.get("pricing_hint") or ""),
        "eta_hint": str(row.get("eta_hint") or ""),
    }


def all_preset_channel_models() -> list[str]:
    """写入 TokenFree 渠道的全部预设 id（文/图/视/音）。"""
    out: list[str] = []
    seen: set[str] = set()
    for cap in ("text", "image", "video", "audio"):
        for mid in preset_ids(cap):  # type: ignore[arg-type]
            key = normalize_model_name(mid)
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(mid)
    return out


def is_preset_model(capability: LogicalModelCapability, model_id: str | None) -> bool:
    """默认模型是否落在对应预设内（含历史别名）。"""
    mid = normalize_model_name(resolve_preset_alias(model_id))
    if not mid:
        return False
    return mid in {normalize_model_name(x) for x in preset_ids(capability)}


def clamp_default_to_preset(capability: LogicalModelCapability, model_id: str | None) -> str:
    """非法或不空缺省时落到该能力第一项预设。"""
    raw = resolve_preset_alias(model_id)
    if is_preset_model(capability, raw):
        # 返回预设表里的规范写法
        for mid in preset_ids(capability):
            if normalize_model_name(mid) == normalize_model_name(raw):
                return mid
    ids = preset_ids(capability)
    return ids[0] if ids else ""


def model_generation_options(model_id: str | None) -> dict[str, Any]:
    """Compatibility facade; model capabilities are owned by registered strategies."""
    from app.services.media_models import get_strategy
    try:
        return get_strategy(model_id or "").describe()
    except ValueError:
        return {}
