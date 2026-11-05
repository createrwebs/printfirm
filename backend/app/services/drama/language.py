"""Language detection and output constraints for drama generation."""

from __future__ import annotations

import re

_THAI_RE = re.compile(r"[\u0e00-\u0e7f]")
_CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
_LATIN_RE = re.compile(r"[A-Za-z]")
_SCENE_MARKER_RE = re.compile(
    r"(?m)^\s*###\s*(?:场(?:景)?|ฉาก(?:ที่)?|Scene)\s*\d+\s*[-－—]\s*\d+\s*$",
    re.IGNORECASE,
)
_CAST_MARKER_RE = re.compile(
    r"(?m)^\s*(?:出场人物|ตัวละครที่ออกฉาก|ตัวละคร(?:ในฉาก)?|รายชื่อตัวละคร|Characters|Cast)[：:].*$",
    re.IGNORECASE,
)
_LOCATION_MARKER_RE = re.compile(r"(?m)^\s*(?:日|夜|晨|黄昏|傍晚|凌晨|清晨|午|晚)?\s*(?:内|外|内外)\s+")
_PRODUCTION_MARKER_RE = re.compile(r"@(?:duration|asset):\S+")


def detect_content_language(text: str) -> str:
    """Return the dominant supported language: ``th``, ``zh``, or ``en``."""
    raw = str(text or "")
    counts = {
        "th": len(_THAI_RE.findall(raw)),
        "zh": len(_CJK_RE.findall(raw)),
        "en": len(_LATIN_RE.findall(raw)),
    }
    # Thai needs a small lead because names/technical tokens may contain Latin.
    if counts["th"] >= 3 and counts["th"] >= counts["zh"]:
        return "th"
    if counts["zh"] >= 3 and counts["zh"] >= counts["en"]:
        return "zh"
    return "en"


def language_instruction(source: str) -> str:
    """Build a hard language constraint that can be appended to any prompt."""
    language = detect_content_language(source)
    if language == "th":
        return (
            "【强制语言】原始创意是泰语。所有内容值必须使用泰语：剧名、人物名、人物描述、场景名、动作、旁白、对白、summary、content 和 visualImage 都必须是泰语。"
            "ห้ามแปลเนื้อหาเป็นภาษาจีนหรือภาษาอังกฤษ; ใช้ป้ายโครงสร้างภาษาไทย ### ฉากX-Y, ตัวละครที่ออกฉาก, เช้า/กลางวัน/กลางคืน/ใน/นอก, △, @duration/@asset. ข้อมูลเก่าที่เป็นภาษาจีนยังอ่านได้ แต่ห้ามสร้างป้าย 出场人物 ในบทใหม่"
        )
    if language == "zh":
        return (
            "【强制语言】原始创意是中文。所有内容值必须使用简体中文；不要改成泰语或英文。固定拍摄标记必须原样保留。"
        )
    return (
        "【强制语言】原始创意是英语。所有内容值必须使用英语；不要改成中文或泰语。固定拍摄标记必须原样保留。"
    )


def has_language_violation(source: str, output: str, *, strict: bool = False) -> bool:
    """Detect a material language switch in generated visible text."""
    source_raw = str(source or "")
    if max(
        len(_THAI_RE.findall(source_raw)),
        len(_CJK_RE.findall(source_raw)),
        len(_LATIN_RE.findall(source_raw)),
    ) < 3:
        return False
    target = detect_content_language(source)
    raw = str(output or "")
    raw = _SCENE_MARKER_RE.sub("", raw)
    raw = _CAST_MARKER_RE.sub("", raw)
    raw = _LOCATION_MARKER_RE.sub("", raw)
    raw = _PRODUCTION_MARKER_RE.sub("", raw)
    counts = {
        "th": len(_THAI_RE.findall(raw)),
        "zh": len(_CJK_RE.findall(raw)),
        "en": len(_LATIN_RE.findall(raw)),
    }
    if target == "th":
        return counts["zh"] >= (2 if strict else 8)
    if target == "zh":
        return counts["th"] >= (2 if strict else 8)
    return counts["zh"] >= (2 if strict else 8) or counts["th"] >= (2 if strict else 8)
