"""Colab + ComfyUI client for MiniMax H3 digital human video generation."""

from __future__ import annotations

import ipaddress
import json
import logging
from pathlib import Path
import random
import re
from typing import Any
import urllib.parse
import uuid

import httpx

logger = logging.getLogger(__name__)

WORKFLOW_TEMPLATE_PATH = Path(__file__).resolve().parent / "assets" / "h3_digital_human_workflow.json"
WAN2_FMLF_WORKFLOW_PATH = Path(__file__).resolve().parent / "assets" / "wan2_2_fmlf_workflow.json"
WAN2_TI2V_WORKFLOW_PATH = Path(__file__).resolve().parent / "assets" / "wan2_2_ti2v_workflow.json"
WAN2_WORKFLOW_TEMPLATE_PATH = WAN2_FMLF_WORKFLOW_PATH if WAN2_FMLF_WORKFLOW_PATH.exists() else WAN2_TI2V_WORKFLOW_PATH


def normalize_comfyui_url(raw_url: str) -> str:
    """Strip whitespace and trailing slashes."""
    url = (raw_url or "").strip().rstrip("/")
    if url and not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    return url


def validate_comfyui_url(raw_url: str) -> str:
    """Validate a user-supplied ComfyUI endpoint without blocking loopback dev use."""
    url = normalize_comfyui_url(raw_url)
    parts = urllib.parse.urlsplit(url)
    if parts.scheme not in {"http", "https"} or not parts.hostname:
        raise ValueError("ComfyUI URL ต้องเป็น http:// หรือ https:// และต้องมี host")
    try:
        address = ipaddress.ip_address(parts.hostname)
    except ValueError:
        address = None
    if address is not None and (address.is_private or address.is_link_local or address.is_reserved) and not address.is_loopback:
        raise ValueError("ไม่อนุญาตให้เชื่อมต่อ ComfyUI ไปยังเครือข่ายภายใน")
    return url


async def check_comfyui_health(base_url: str) -> dict[str, Any]:
    """Check connectivity to ComfyUI and return GPU / system stats."""
    url = normalize_comfyui_url(base_url)
    if not url:
        return {"ok": False, "error": "ไม่ได้ระบุ URL ของ ComfyUI"}

    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False) as client:
            resp = await client.get(f"{url}/system_stats")
            if resp.status_code != 200:
                return {
                    "ok": False,
                    "error": f"เชื่อมต่อไม่ได้ (HTTP {resp.status_code}) กรุณาตรวจสอบว่าเซลล์ใน Colab กำลังทำงานอยู่",
                }
            data = resp.json()
            devices = data.get("devices") or []
            if not devices:
                return {"ok": True, "device": "GPU", "vram_total_gb": 0, "vram_free_gb": 0}
            dev = devices[0]
            name = dev.get("name", "Unknown GPU")
            total_gb = round(float(dev.get("vram_total") or 0) / (1024**3), 1)
            free_gb = round(float(dev.get("vram_free") or 0) / (1024**3), 1)
            return {
                "ok": True,
                "device": name,
                "vram_total_gb": total_gb,
                "vram_free_gb": free_gb,
            }
    except Exception as exc:
        logger.warning("ComfyUI health check failed for %s: %s", url, exc)
        return {
            "ok": False,
            "error": f"เชื่อมต่อไปยัง {url} ไม่สำเร็จ: {exc}",
        }


async def upload_image_to_comfyui(base_url: str, image_bytes: bytes, filename: str) -> str:
    """Upload image bytes to ComfyUI /upload/image and return uploaded name."""
    url = normalize_comfyui_url(base_url)
    clean_name = re.sub(r"[^\w\.\-]", "_", filename or "input.jpg")
    if not clean_name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        clean_name = f"{clean_name}.jpg"

    files = {"image": (clean_name, image_bytes, "application/octet-stream")}
    data = {"overwrite": "true"}

    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        resp = await client.post(f"{url}/upload/image", files=files, data=data)
        if resp.status_code != 200:
            raise RuntimeError(f"ComfyUI upload image failed (HTTP {resp.status_code}): {resp.text[:300]}")
        up = resp.json()
        sub = up.get("subfolder") or ""
        name = up.get("name") or clean_name
        return f"{sub}/{name}" if sub else name


def parse_fragment_story(raw_content: str, assets_map: dict[int, str] | None = None) -> tuple[str, str, bool]:
    """Parse raw fragment script into (visual_action, dialogue, is_silent)."""
    import re
    assets = assets_map or {}
    lines = (raw_content or "").strip().split("\n")
    action_parts: list[str] = []
    dialogue_parts: list[str] = []
    is_silent = False

    for line in lines:
        l = line.strip()
        if not l or l.startswith("@duration:"):
            continue
        # Drop standalone subtitle metadata and character intro lines (not 【บทพูด·...·ซิงค์คำบรรยาย】)
        if l.startswith(("【คำบรรยาย", "【แนะนำตัวละคร", "【字幕", "【角色名片", "[Subtitles", "[CharacterIntro")):
            continue
        # Silence cues
        if any(tag in l for tag in ["无配音", "仅环境音", "ไม่มีเสียงพูด", "เฉพาะเสียงบรรยากาศ", "空镜"]):
            is_silent = True

        # Replace @asset:ID with real names without duplicating adjacent names
        for aid, aname in assets.items():
            if not aname:
                continue
            l = re.sub(rf"@(?:asset|character):{aid}\s*{re.escape(aname)}", f" {aname} ", l)
            l = l.replace(f"@asset:{aid}", f" {aname} ")
            l = l.replace(f"@character:{aid}", f" {aname} ")
        l = re.sub(r"@(asset|character):\d+", "", l)
        l = re.sub(r"\s+", " ", l).strip()

        # Strip square bracket cues like 【画面·...】 or 【ภาพ·...】
        cleaned = re.sub(r"^[【\[].*?[】\]]\s*", "", l).strip()
        if not cleaned:
            continue

        # Check dialogue vs action
        if any(k in l for k in ["【บทพูด", "【对白", "【เสียงพูด"]) or (":" in cleaned and not cleaned.startswith("http")):
            dialogue_parts.append(cleaned.lstrip(": ").strip())
        else:
            action_parts.append(cleaned.lstrip("△ ").strip())

    action_text = " ".join(action_parts).strip()
    dialogue_text = " ".join(dialogue_parts).strip()
    if not dialogue_text:
        is_silent = True
    return action_text, dialogue_text, is_silent


def build_h3_prompt(
    raw_prompt: Any,
    character_name: str = "",
    character_appearance: str = "",
    dialogue: str = "",
    duration: int = 10,
    is_silent: bool | None = None,
    assets_map: dict[int, str] | None = None,
    characters: list[dict[str, Any]] | None = None,
    scene_ref: dict[str, Any] | None = None,
    prop_refs: list[dict[str, Any]] | None = None,
    has_first_frame: bool = False,
    has_last_frame: bool = False,
    first_frame_tag: str = "",
    last_frame_tag: str = "",
) -> str:
    """Format official 6-section MiniMax H3 Ref2VA drama prompt (subject_definitions, summary,
    retention_analysis, detailed_description, overall_soundscape, non_diegetic_music).
    Supports 1..9 multi-reference images (<Subject 1> .. <Subject N>, <Picture 1> .. <Picture 9>)
    and optional keyframe completion (first_frame / last_frame).
    """
    if hasattr(raw_prompt, "content"):
        content_str = (raw_prompt.content or "").strip()
    elif isinstance(raw_prompt, str):
        content_str = raw_prompt.strip()
    else:
        content_str = str(raw_prompt or "").strip()

    if "integrated_multimodal_description" in content_str or "<Subject 1>" in content_str or "<Picture 1>" in content_str:
        return content_str

    action_text, parsed_dialogue, parsed_silent = parse_fragment_story(content_str, assets_map)
    final_action = action_text if action_text else content_str
    final_dialogue = (dialogue or parsed_dialogue).strip()
    if is_silent is not None:
        final_silent = is_silent
    else:
        final_silent = parsed_silent and not bool(final_dialogue)

    subj_defs_lines: list[str] = []
    retention_lines: list[str] = []
    name_to_subj: dict[str, str] = {}
    if characters and len(characters) > 0:
        for idx, char in enumerate(characters):
            tag = char.get("tag") or f"<Picture {idx + 1}>"
            subj_tag = f"<Subject {idx + 1}>"
            raw_cname = (char.get("name") or "").strip()
            name = _clean_ref_description(raw_cname or f"character {idx + 1}")
            desc = _clean_ref_description(char.get("desc") or "")
            if desc == name:
                desc = ""
            if not desc:
                if raw_cname.startswith(("ยาย", "ย่า")):
                    desc = "elderly grandmother"
                elif raw_cname.startswith(("ตา", "ปู่")):
                    desc = "elderly grandfather"
            full_desc = f"{name}, {desc}" if desc else name
            subj_defs_lines.append(f"{subj_tag} is the character in {tag}, {full_desc}.")
            retention_lines.append(f"{subj_tag} (appears in [Shot 1]): fully_preserved - the character's facial features, hair, and clothing match {tag}.")
            if raw_cname:
                name_to_subj[raw_cname] = subj_tag
    else:
        clean_name = _clean_ref_description(character_name)
        clean_app = _clean_ref_description(character_appearance)
        char_desc = f"{clean_name}, {clean_app}" if clean_app else (clean_name or "main character")
        subj_defs_lines.append(f"<Subject 1> is the character in <Picture 1>, {char_desc}.")
        retention_lines.append("<Subject 1> (appears in [Shot 1]): fully_preserved - the character's facial features, hair, and clothing match <Picture 1>.")

    next_subj_idx = (len(characters) if characters else 1) + 1
    scene_prefix = ""
    if scene_ref and scene_ref.get("tag"):
        s_tag = scene_ref.get("tag")
        s_subj = f"<Subject {next_subj_idx}>"
        next_subj_idx += 1
        raw_sname = (scene_ref.get("name") or "").strip()
        s_name = _clean_ref_description(raw_sname or "the scene environment")
        s_desc = _clean_ref_description(scene_ref.get("desc") or "")
        s_full = f"{s_name}, {s_desc}" if s_desc and s_desc != s_name else s_name
        subj_defs_lines.append(f"{s_subj} is the scene environment in {s_tag} ({s_full}).")
        retention_lines.append(f"{s_subj} (appears in [Shot 1]): fully_preserved - background architecture, lighting, and atmosphere match {s_tag}.")
        scene_prefix = f"The scene takes place in {s_subj} ({s_name}). "
        if raw_sname:
            name_to_subj[raw_sname] = s_subj

    if prop_refs:
        for prop in prop_refs:
            p_tag = prop.get("tag")
            if not p_tag:
                continue
            p_subj = f"<Subject {next_subj_idx}>"
            next_subj_idx += 1
            raw_pname = (prop.get("name") or "").strip()
            p_name = _clean_ref_description(raw_pname or "key prop")
            p_desc = _clean_ref_description(prop.get("desc") or "")
            p_full = f"{p_name}, {p_desc}" if p_desc and p_desc != p_name else p_name
            subj_defs_lines.append(f"{p_subj} is the key prop/object in {p_tag} ({p_full}).")
            retention_lines.append(f"{p_subj} (appears in [Shot 1]): fully_preserved - object shape, material, and details match {p_tag}.")
            if raw_pname:
                name_to_subj[raw_pname] = p_subj

    if name_to_subj and final_action:
        sorted_names = sorted(name_to_subj.keys(), key=len, reverse=True)
        pattern = re.compile("|".join(re.escape(n) for n in sorted_names))
        final_action = pattern.sub(lambda m: f"{m.group(0)} ({name_to_subj[m.group(0)]})", final_action)

    if first_frame_tag:
        subj_defs_lines.append(f"{first_frame_tag} is the first frame of [Shot 1].")
        retention_lines.append(f"{first_frame_tag} ([Shot 1] first frame): fully_preserved - the opening composition and pose start directly from {first_frame_tag}.")
    if last_frame_tag:
        subj_defs_lines.append(f"{last_frame_tag} is the last frame of [Shot 1].")
        retention_lines.append(f"{last_frame_tag} ([Shot 1] last frame): fully_preserved - the ending composition and pose transition smoothly into {last_frame_tag}.")

    subj_defs_block = "\n".join(subj_defs_lines)
    retention_block = "\n".join(retention_lines)

    mode_tag = "[keyframe completion + reference generation]" if (has_first_frame or has_last_frame or first_frame_tag or last_frame_tag) else "[reference generation]"
    all_subj_tags = ", ".join(f"<Subject {i + 1}>" for i in range(len(characters) if characters else 1))
    kf_clause = ""
    if first_frame_tag and last_frame_tag:
        kf_clause = f" begins from {first_frame_tag}, transitions smoothly to {last_frame_tag}, and"
    elif first_frame_tag:
        kf_clause = f" begins from {first_frame_tag} and"
    elif last_frame_tag:
        kf_clause = f" ends at {last_frame_tag} and"

    summary_block = f"{mode_tag} The target dramatic film video{kf_clause} depicts {all_subj_tags} in a single continuous cinematic shot: {final_action}."
    shot_opening = f"The shot begins from {first_frame_tag}. " if first_frame_tag else ""
    shot_ending = f" The motion concludes matching {last_frame_tag}." if last_frame_tag else ""

    if final_silent or not final_dialogue:
        return (
            "subject_definitions:\n"
            f"{subj_defs_block}\n\n"
            "summary:\n"
            f"{summary_block}\n\n"
            "retention_analysis:\n"
            f"{retention_block}\n\n"
            "detailed_description:\n"
            f"[Shot 1] {shot_opening}{scene_prefix}{all_subj_tags} perform in the scene: {final_action}.{shot_ending} "
            "Single continuous camera shot, natural nuanced dramatic acting, authentic facial expressions and realistic body movements.\n\n"
            "overall_soundscape:\n"
            "Natural ambient environmental room acoustics and subtle foley matching the physical action, no spoken dialogue.\n\n"
            "non_diegetic_music:\n"
            "N/A"
        )
    else:
        return (
            "subject_definitions:\n"
            f"{subj_defs_block}\n\n"
            "summary:\n"
            f"{summary_block}\n\n"
            "retention_analysis:\n"
            f"{retention_block}\n\n"
            "detailed_description:\n"
            f"[Shot 1] {shot_opening}{scene_prefix}{all_subj_tags} perform in the scene: {final_action}. "
            f"Speaking naturally with expressive acting and accurate lip synchronization, saying: <d>[Thai] {final_dialogue} </d>.{shot_ending}\n\n"
            "overall_soundscape:\n"
            f"Clear vocal dialogue delivery of '{final_dialogue}', with natural ambient environmental acoustics.\n\n"
            "non_diegetic_music:\n"
            "N/A"
        )


def load_h3_workflow_template() -> dict[str, Any]:
    if not WORKFLOW_TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Workflow template missing at {WORKFLOW_TEMPLATE_PATH}")
    with open(WORKFLOW_TEMPLATE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_wan2_workflow_template() -> dict[str, Any]:
    if not WAN2_WORKFLOW_TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Wan2 workflow template missing at {WAN2_WORKFLOW_TEMPLATE_PATH}")
    with open(WAN2_WORKFLOW_TEMPLATE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def wan2_size_for_ratio(aspect_ratio: str | None, resolution: str = "480p") -> tuple[int, int]:
    """Return (width, height) multiples of 16 matching the project aspect ratio."""
    ratio = (aspect_ratio or "9:16").strip()
    if resolution == "720p":
        return {
            "16:9": (1280, 704),
            "9:16": (704, 1280),
            "1:1": (960, 960),
            "4:3": (1088, 816),
            "3:4": (816, 1088),
        }.get(ratio, (704, 1280))
    return {
        "16:9": (832, 480),
        "9:16": (480, 832),
        "1:1": (640, 640),
        "4:3": (720, 544),
        "3:4": (544, 720),
    }.get(ratio, (480, 832))


_SHEET_POISON_PATTERNS = (
    "แผ่นออกแบบ",
    "ห้ามให้ตัวละครเป็นจุดสนใจ",
    "มุมมองด้านบน",
    "สามวิว",
    "turnaround",
    "character sheet",
    "reference sheet",
)


def _clean_ref_description(desc: str) -> str:
    """Strip turnaround-sheet directives that poison I2V prompts into multi-panel grids."""
    t = re.sub(r"【[^】]*】", "", desc or "").strip()
    t = re.sub(r"^.*?โปรดสร้างตามคำอธิบาย[^:：]*[:：]\s*", "", t, flags=re.S).strip()
    t = re.sub(r"^.*?请严格依据[^：:\n]*[：:]\s*", "", t, flags=re.S).strip()
    for sep in ("。ตัวตน：", "。บทบาท：", "。บุคลิก：", "。身份：", "。定位：", "。性格：", "รูปแบบภาพและวัสดุ:", "สไตล์ของภาพ:", "。外观材质与画风参考：", "。画面风格要求："):
        if sep in t:
            t = t.split(sep, 1)[0].strip()
    for junk in (
        "ตัวละครแนวแฟนตาซีโรแมนติกดราม่า ใบหน้าและเครื่องแต่งกายมีเอกลักษณ์ชัดเจน บุคลิกและท่าทางสอดคล้องกับบทบาท",
        "ภาพตั้งตัวละครสมจริงพื้นหลังสีขาว",
        "พื้นหลังสีขาวล้วน",
        "พื้นหลังสีขาว",
        "สถานที่สมจริง รายละเอียดชัดเจน เหมาะกับการถ่ายทำละครสั้น",
        "ฉาก:",
    ):
        t = t.replace(junk, "").strip()
    # Strip portrait-only expressions, poses, and studio/sunlight background mood so they don't contradict shot action
    for pose_sep in (" สายตา", " ยิ้ม", " สีหน้า", " ท่ามกลาง", " บรรยากาศ", " ฉากหลัง"):
        if pose_sep in t:
            t = t.split(pose_sep, 1)[0].strip()
    if any(p in t.lower() for p in _SHEET_POISON_PATTERNS):
        # Keep only the prefix before the colon (e.g. "บ้านยายคยองซุก (scene)")
        return t.split(":", 1)[0].strip()
    return t


def build_wan2_motion_prompt(
    raw_prompt: str,
    *,
    assets_map: dict[int, str] | None = None,
    ref_descriptions: list[str] | None = None,
) -> str:
    """Format motion instruction and visual reference context for Wan 2.2 generation."""
    action_text, dialogue_text, _ = parse_fragment_story(raw_prompt or "", assets_map)
    action_text = re.sub(r"【[^】]*】", "", action_text).strip()
    if not action_text:
        if dialogue_text:
            speakers = [
                part.split(":", 1)[0].strip()
                for part in dialogue_text.split(" ")
                if ":" in part and len(part.split(":", 1)[0].strip()) <= 30
            ]
            who = ", ".join(dict.fromkeys(s for s in speakers if s)) or "The character in the reference image"
            action_text = (
                f"{who} speaking with natural emotional facial expressions, "
                "authentic lip movement, and subtle realistic body language in a single continuous shot"
            )
        else:
            action_text = "Cinematic dramatic scene, natural character movements, single continuous camera shot"

    ref_context = ""
    if ref_descriptions:
        valid_descs = [_clean_ref_description(d) for d in ref_descriptions if d and d.strip()]
        valid_descs = [d for d in valid_descs if d]
        if valid_descs:
            ref_context = " Subjects in scene: " + "; ".join(valid_descs) + "."

    return (
        f"{action_text}.{ref_context} "
        "Single continuous camera shot, consistent character appearance and clothing matching reference image, "
        "natural realistic human acting and smooth motion, 4k cinematic film."
    )


async def translate_wan2_prompt_to_english(prompt_text: str) -> str:
    """Translate Thai/mixed prompt into concise English visual motion description for Wan 2.2 umt5_xxl."""
    if not re.search(r"[\u0e00-\u0e7f]", prompt_text or ""):
        return prompt_text
    try:
        from app.config import get_settings
        from app.services.llm_client import chat_completions

        settings = get_settings()
        if settings.ark_mock:
            return prompt_text
        en = await chat_completions(
            system=(
                "You convert screenplay shot descriptions into concise English Image-to-Video (I2V) motion prompts "
                "for Wan 2.2 (1-2 sentences, max 60 words). Describe ONLY visible physical action, facial expression, "
                "lighting, and camera motion in a single continuous shot. Do NOT include spoken dialogue quotes, "
                "character names in Thai, split-screen, or turnaround sheet instructions. Output English text only."
            ),
            user=prompt_text,
            temperature=0.2,
            max_tokens=160,
            timeout=10.0,
        )
        cleaned_en = (en or "").strip().strip('"').replace("\n", " ")
        if cleaned_en and len(cleaned_en) >= 12:
            return (
                f"{cleaned_en} Single continuous shot, consistent character appearance matching the reference image, "
                "natural realistic motion, 4k cinematic film."
            )
    except Exception as exc:
        logger.warning("Wan2 English prompt translation skipped (%s), using fallback", exc)
    return prompt_text


async def rewrite_h3_drama_prompt_with_llm(structured_prompt: str) -> str:
    """Rewrite a Thai/Chinese 6-section MiniMax H3 Ref2VA drama prompt into clear English choreography
    while preserving <Subject N>, <Picture N>, [Shot 1], and <d>[Thai] ... </d> tags.
    """
    if not re.search(r"[\u0e00-\u0e7f\u4e00-\u9fff]", structured_prompt or ""):
        return structured_prompt
    try:
        from app.config import get_settings
        from app.services.llm_client import chat_completions

        settings = get_settings()
        if settings.ark_mock:
            return structured_prompt
        rewritten = await asyncio.wait_for(
            chat_completions(
                system=(
                    "You are an expert MiniMax H3 Ref2VA cinematic video prompt rewriter. "
                    "Convert the provided 6-section MiniMax H3 prompt from Thai/Chinese into fluent, vivid English while strictly obeying these rules:\n"
                    "1. Output ONLY the 6 sections with exact lowercase headers: "
                    "subject_definitions:, summary:, retention_analysis:, detailed_description:, overall_soundscape:, non_diegetic_music:.\n"
                    "2. Preserve EVERY <Subject N> and <Picture N> tag exactly as given. In subject_definitions:, describe each character's visual appearance "
                    "(age/gender/clothing/features) in concise English without personality traits or turnaround-sheet terms.\n"
                    "3. In summary:, keep the exact leading mode tag ([reference generation] or [keyframe completion + reference generation]).\n"
                    "4. In detailed_description:, start with [Shot 1] and write concrete, visible physical choreography in English specifying WHICH <Subject N> "
                    "performs WHICH action, posture, hand gesture, facial expression, lighting, and camera movement. Never leave raw Thai/Chinese in action descriptions.\n"
                    "5. If the input contains spoken dialogue inside <d>[Thai] ... </d>, keep the exact <d>[Thai] ... </d> tag and its Thai spoken text unchanged."
                ),
                user=structured_prompt,
                temperature=0.2,
                max_tokens=900,
                timeout=8.0,
            ),
            timeout=9.0,
        )
        cleaned = re.sub(r"^```\w*\n|\n```$", "", (rewritten or "").strip()).strip()
        if (
            cleaned
            and "subject_definitions:" in cleaned
            and "detailed_description:" in cleaned
            and "<Picture 1>" in cleaned
        ):
            return cleaned
    except Exception as exc:
        logger.warning("H3 English drama prompt rewrite skipped (%s), using fallback", exc)
    return structured_prompt


def build_wan2_official_dual_workflow(
    *,
    motion_prompt: str,
    image_filename: str,
    last_frame_filename: str | None = None,
    width: int = 480,
    height: int = 832,
    frames: int = 81,
    seed: int = 42,
    enable_4steps_lora: bool = True,
) -> dict[str, Any]:
    """Official Wan 2.2 14B Image-to-Video Workflow from ComfyUI Hub:
    https://comfy.org/hub/workflows/wan-2-2-14b-image-to-video-8c7511104c80/

    Flattened into standard ComfyUI API Prompt format (no UI subgraphs).
    Two-stage denoising:
      Stage 1 (steps 0 to 2): High-noise expert creates layout and movement
      Stage 2 (steps 2 to 4): Low-noise expert refines details and textures
    Supports optional end frame via ComfyUI core WanFirstLastFrameToVideo.
    """
    neg = "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走，分屏，九宫格，多格画面"
    steps = 4 if enable_4steps_lora else 20
    split_step = 2 if enable_4steps_lora else 10
    cfg = 1.0 if enable_4steps_lora else 3.5

    wf: dict[str, Any] = {
        "84": {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "90": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},
        "95": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "96": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "93": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["84", 0], "text": motion_prompt}},
        "89": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["84", 0], "text": neg}},
        "97": {"class_type": "LoadImage", "inputs": {"image": image_filename}},
        "99": {"class_type": "ImageScale", "inputs": {"image": ["97", 0], "upscale_method": "lanczos", "width": width, "height": height, "crop": "center"}},
    }

    end_img = (last_frame_filename or "").strip()
    if end_img:
        wf["110"] = {"class_type": "LoadImage", "inputs": {"image": end_img}}
        wf["111"] = {"class_type": "ImageScale", "inputs": {"image": ["110", 0], "upscale_method": "lanczos", "width": width, "height": height, "crop": "center"}}
        wf["98"] = {"class_type": "WanFirstLastFrameToVideo", "inputs": {
            "positive": ["93", 0],
            "negative": ["89", 0],
            "vae": ["90", 0],
            "start_image": ["99", 0],
            "end_image": ["111", 0],
            "width": width,
            "height": height,
            "length": frames,
            "batch_size": 1,
        }}
    else:
        wf["98"] = {"class_type": "WanImageToVideo", "inputs": {
            "positive": ["93", 0],
            "negative": ["89", 0],
            "vae": ["90", 0],
            "start_image": ["99", 0],
            "width": width,
            "height": height,
            "length": frames,
            "batch_size": 1,
        }}

    if enable_4steps_lora:
        wf["101"] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["95", 0], "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors", "strength_model": 1.0}}
        wf["102"] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["96", 0], "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "strength_model": 1.0}}
        wf["104"] = {"class_type": "ModelSamplingSD3", "inputs": {"model": ["101", 0], "shift": 5.0}}
        wf["103"] = {"class_type": "ModelSamplingSD3", "inputs": {"model": ["102", 0], "shift": 5.0}}
        high_model = ["104", 0]
        low_model = ["103", 0]
    else:
        high_model = ["95", 0]
        low_model = ["96", 0]

    wf["86"] = {"class_type": "KSamplerAdvanced", "inputs": {
        "model": high_model,
        "add_noise": "enable",
        "noise_seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "euler",
        "scheduler": "simple",
        "positive": ["98", 0],
        "negative": ["98", 1],
        "latent_image": ["98", 2],
        "start_at_step": 0,
        "end_at_step": split_step,
        "return_with_leftover_noise": "enable",
    }}

    wf["85"] = {"class_type": "KSamplerAdvanced", "inputs": {
        "model": low_model,
        "add_noise": "disable",
        "noise_seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": "euler",
        "scheduler": "simple",
        "positive": ["98", 0],
        "negative": ["98", 1],
        "latent_image": ["86", 0],
        "start_at_step": split_step,
        "end_at_step": steps,
        "return_with_leftover_noise": "disable",
    }}

    wf["87"] = {"class_type": "VAEDecode", "inputs": {"samples": ["85", 0], "vae": ["90", 0]}}
    wf["94"] = {"class_type": "CreateVideo", "inputs": {"images": ["87", 0], "fps": 16.0}}
    wf["108"] = {"class_type": "SaveVideo", "inputs": {"video": ["94", 0], "filename_prefix": "video/Wan2.2_i2v", "format": "auto", "codec": "auto"}}

    return wf


def build_wan2_simple_workflow(
    *,
    motion_prompt: str,
    image_filename: str,
    last_frame_filename: str | None = None,
    width: int = 480,
    height: int = 832,
    frames: int = 81,
    seed: int = 42,
) -> dict[str, Any]:
    """Wan 2.2 14B I2V fallback when only low_noise UNet is installed on Colab.

    shortcut: skips the high-noise expert; uses shift=3.0 to reduce high-sigma tiling artifacts when high_noise is absent.
    """
    neg = "bright tones, overexposed, static, blurry details, bad anatomy, deformed, distorted, low quality, split screen, grid, multiple panels, collage"
    wf: dict[str, Any] = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors", "strength_model": 1.0}},
        "3": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["2", 0], "shift": 3.0}},
        "4": {"class_type": "CLIPLoader", "inputs": {"clip_name": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "type": "wan", "device": "default"}},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": "wan_2.1_vae.safetensors"}},  # 14B uses the 2.1 VAE; wan2.2_vae is for the 5B model
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 0], "text": motion_prompt}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 0], "text": neg}},
        "8": {"class_type": "LoadImage", "inputs": {"image": image_filename}},
        "9": {"class_type": "ImageScale", "inputs": {"image": ["8", 0], "upscale_method": "lanczos", "width": width, "height": height, "crop": "center"}},
    }
    end_img = (last_frame_filename or "").strip()
    if end_img:
        wf["15"] = {"class_type": "LoadImage", "inputs": {"image": end_img}}
        wf["16"] = {"class_type": "ImageScale", "inputs": {"image": ["15", 0], "upscale_method": "lanczos", "width": width, "height": height, "crop": "center"}}
        wf["10"] = {"class_type": "WanFirstLastFrameToVideo", "inputs": {
            "positive": ["6", 0], "negative": ["7", 0], "vae": ["5", 0], "start_image": ["9", 0], "end_image": ["16", 0],
            "width": width, "height": height, "length": frames, "batch_size": 1}}
    else:
        wf["10"] = {"class_type": "WanImageToVideo", "inputs": {
            "positive": ["6", 0], "negative": ["7", 0], "vae": ["5", 0], "start_image": ["9", 0],
            "width": width, "height": height, "length": frames, "batch_size": 1}}
    wf["11"] = {"class_type": "KSampler", "inputs": {
        "model": ["3", 0], "seed": seed, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple",
        "positive": ["10", 0], "negative": ["10", 1], "latent_image": ["10", 2], "denoise": 1.0}}
    wf["12"] = {"class_type": "VAEDecode", "inputs": {"samples": ["11", 0], "vae": ["5", 0]}}
    wf["13"] = {"class_type": "CreateVideo", "inputs": {"images": ["12", 0], "fps": 16.0}}
    wf["14"] = {"class_type": "SaveVideo", "inputs": {"video": ["13", 0], "filename_prefix": "video/PrintFilm_Wan", "format": "auto", "codec": "auto"}}
    return wf


async def submit_wan2_video_job(
    base_url: str,
    *,
    prompt: str,
    image_bytes: bytes | None = None,
    image_filename: str | None = None,
    image_filenames: list[str] | None = None,
    first_frame_filename: str | None = None,
    last_frame_filename: str | None = None,
    duration_sec: int | None = 5,
    seed: int | None = None,
    resolution: str = "480p",
    aspect_ratio: str | None = "9:16",
    assets_map: dict[int, str] | None = None,
    ref_descriptions: list[str] | None = None,
) -> str:
    """Submit Wan 2.2 Multi-Frame Reference + First/Last Frame job to ComfyUI."""
    url = normalize_comfyui_url(base_url)

    refs: list[str] = []
    if image_filenames and len(image_filenames) > 0:
        refs = [r for r in image_filenames if r]
    elif image_bytes is not None:
        up = await upload_image_to_comfyui(url, image_bytes, image_filename or "cover.jpg")
        refs = [up]
    elif image_filename:
        refs = [image_filename]
    else:
        refs = ["input_cover.jpg"]

    motion_prompt = build_wan2_motion_prompt(
        prompt,
        assets_map=assets_map,
        ref_descriptions=ref_descriptions,
    )
    motion_prompt = await translate_wan2_prompt_to_english(motion_prompt)
    calc_seed = seed if (seed is not None and seed >= 0) else random.randint(0, 2**31 - 1)

    # shortcut: cap at 8s (129 frames) on 24GB L4 to prevent VRAM OOM during 14B multi-frame conditioning.
    dur = max(3, min(int(duration_sec or 5), 8))
    frames = dur * 16 + 1
    width, height = wan2_size_for_ratio(aspect_ratio, resolution=resolution)

    # shortcut: simple mode sends ONE start image (first frame if given, else first ref) + optional end frame.
    start_img = (first_frame_filename or "").strip() or (refs[0] if refs else "input_cover.jpg")
    end_img = (last_frame_filename or "").strip() or None

    has_high_noise = False
    try:
        async with httpx.AsyncClient(timeout=4.0, verify=False) as probe:
            p_resp = await probe.get(f"{url}/object_info/UNETLoader")
            if p_resp.status_code == 200:
                unets = p_resp.json().get("UNETLoader", {}).get("input", {}).get("required", {}).get("unet_name", [[]])[0]
                has_high_noise = "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors" in unets
    except Exception:
        has_high_noise = False

    if has_high_noise:
        wf = build_wan2_official_dual_workflow(
            motion_prompt=motion_prompt,
            image_filename=start_img,
            last_frame_filename=end_img,
            width=width,
            height=height,
            frames=frames,
            seed=calc_seed,
        )
    else:
        wf = build_wan2_simple_workflow(
            motion_prompt=motion_prompt,
            image_filename=start_img,
            last_frame_filename=end_img,
            width=width,
            height=height,
            frames=frames,
            seed=calc_seed,
        )

    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        resp = await client.post(f"{url}/prompt", json={"prompt": wf})
        if resp.status_code != 200:
            raise RuntimeError(f"ComfyUI Wan2 prompt submission failed (HTTP {resp.status_code}): {resp.text[:400]}")
        data = resp.json()
        pid = data.get("prompt_id")
        if not pid:
            raise RuntimeError(f"ComfyUI did not return prompt_id: {data}")
        return str(pid)


async def submit_h3_video_job(
    base_url: str,
    *,
    prompt: str,
    image_bytes: bytes | None = None,
    image_filename: str | None = None,
    image_filenames: list[str] | None = None,
    first_frame_filename: str | None = None,
    last_frame_filename: str | None = None,
    aspect_ratio: str | None = None,
    dialogue: str = "",
    duration: int = 10,
    duration_sec: int | None = None,
    megapixels: float = 0.4,
    seed: int | None = None,
    characters: list[dict[str, Any]] | None = None,
    scene_ref: dict[str, Any] | None = None,
    prop_refs: list[dict[str, Any]] | None = None,
    assets_map: dict[int, str] | None = None,
) -> str:
    """Submit MiniMax H3 Multi-Ref Drama + First/Last Frame video job to ComfyUI (1..9 refs)."""
    url = normalize_comfyui_url(base_url)

    all_images: list[str] = []
    if image_filenames and len(image_filenames) > 0:
        all_images = list(image_filenames)
    elif image_bytes is not None:
        img_name = await upload_image_to_comfyui(url, image_bytes, image_filename or "input.png")
        all_images = [img_name]
    elif image_filename:
        all_images = [image_filename]
    else:
        all_images = ["input.png"]

    # Attach first_frame and last_frame into the 9-slot Ref2VA pool if provided
    first_tag = ""
    last_tag = ""
    ff = (first_frame_filename or "").strip()
    lf = (last_frame_filename or "").strip()
    if ff:
        if ff in all_images[:9]:
            first_tag = f"<Picture {all_images.index(ff) + 1}>"
        elif len(all_images) < 9:
            all_images.append(ff)
            first_tag = f"<Picture {len(all_images)}>"
    if lf:
        if lf in all_images[:9]:
            last_tag = f"<Picture {all_images.index(lf) + 1}>"
        elif len(all_images) < 9:
            all_images.append(lf)
            last_tag = f"<Picture {len(all_images)}>"

    wf = load_h3_workflow_template()
    dur = duration_sec if duration_sec is not None else duration
    final_prompt = build_h3_prompt(
        prompt,
        dialogue=dialogue,
        duration=dur,
        assets_map=assets_map,
        characters=characters,
        scene_ref=scene_ref,
        prop_refs=prop_refs,
        has_first_frame=bool(ff),
        has_last_frame=bool(lf),
        first_frame_tag=first_tag,
        last_frame_tag=last_tag,
    )
    if first_tag and first_tag not in final_prompt:
        final_prompt += f"\n{first_tag} is the first frame of [Shot 1]; the video starts directly from {first_tag}."
    if last_tag and last_tag not in final_prompt:
        final_prompt += f"\n{last_tag} is the last frame of [Shot 1]; the video concludes matching {last_tag}."
    final_prompt = await rewrite_h3_drama_prompt_with_llm(final_prompt)

    clamped_sec = max(5, min(int(dur or 10), 15))
    calc_seed = seed if (seed is not None and seed >= 0) else random.randint(0, 2**31 - 1)

    wf["7"]["inputs"]["prompt"] = final_prompt
    wf["56"]["inputs"]["value"] = clamped_sec
    if "61" in wf:
        wf["61"]["inputs"]["megapixels"] = float(megapixels or 0.4)
    wf["54"]["inputs"]["seed"] = calc_seed

    # When project aspect_ratio is specified, set explicit width/height so turnaround sheets don't distort frame dimensions
    if aspect_ratio:
        w, h = wan2_size_for_ratio(aspect_ratio, resolution="480p")
        wf["7"]["inputs"]["width"] = w
        wf["7"]["inputs"]["height"] = h
        wf.pop("60", None)
        wf.pop("61", None)

    # Clean existing ref_images links from Node 7
    for k in list(wf["7"]["inputs"].keys()):
        if k.startswith("ref_images.ref_image_"):
            wf["7"]["inputs"].pop(k, None)

    # Wire all images into Node 7 (up to 9 images supported by ComfyUI Autogrow V3)
    for idx, fname in enumerate(all_images[:9]):
        if idx == 0:
            wf["5"]["inputs"]["image"] = fname
            wf["7"]["inputs"]["ref_images.ref_image_0"] = ["5", 0]
        else:
            node_id = str(500 + idx)
            wf[node_id] = {
                "class_type": "LoadImage",
                "inputs": {"image": fname},
                "_meta": {"title": f"LoadImage (Ref {idx + 1})"},
            }
            wf["7"]["inputs"][f"ref_images.ref_image_{idx}"] = [node_id, 0]

    # Auto-detect available Drama LoRAs, Semantic Bridge, SigmaShift, UNET & VAE via lightweight per-node object_info
    def _combo_opts(node_dict: dict[str, Any], field: str) -> list[str]:
        spec = node_dict.get("input", {}).get("required", {}).get(field, [])
        if not spec:
            return []
        if isinstance(spec[0], list):
            return spec[0]
        if len(spec) > 1 and isinstance(spec[1], dict) and isinstance(spec[1].get("options"), list):
            return spec[1]["options"]
        return []

    try:
        import asyncio
        probe_nodes = (
            "UNETLoader",
            "VAELoader",
            "LoraLoaderModelOnly",
            "MiniMaxH3TurboLoRA",
            "MiniMaxH3TurboSampler",
            "ModelAttentionBackend",
            "BlockSparseAttention",
            "MiniMaxH3SigmaShift",
            "MiniMaxH3SemanticBridgeConfigT8",
        )
        async with httpx.AsyncClient(timeout=5.0, verify=False) as probe:
            resps = await asyncio.gather(
                *(probe.get(f"{url}/object_info/{n}") for n in probe_nodes),
                return_exceptions=True,
            )
        info: dict[str, Any] = {}
        for r in resps:
            if not isinstance(r, Exception) and getattr(r, "status_code", 0) == 200:
                data = r.json()
                if isinstance(data, dict):
                    info.update(data)

        if info:
            unet_input = _combo_opts(info.get("UNETLoader", {}), "unet_name")
            preferred_unets = [
                "minimax_h3_ref2va_int8_convrot.safetensors",
                "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
                "minimax_h3_ref2va_pruned_fp8_scaled.safetensors",
                "Minimax-h3_Singularity_x_10Eros-Max_PRISM_int8.safetensors",
                "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
                "minimax_h3_fl2va_pruned_fp8_scaled.safetensors",
            ]
            for candidate in preferred_unets:
                if candidate in unet_input and "1" in wf:
                    wf["1"]["inputs"]["unet_name"] = candidate
                    break

            vae_input = _combo_opts(info.get("VAELoader", {}), "vae_name")
            preferred_vaes = [
                "minimax_h3_video_vae_int8_convrot.safetensors",
                "minimax_h3_video_vae_fp16.safetensors",
                "minimax_h3_video_vae_bf16.safetensors",
            ]
            for v_cand in preferred_vaes:
                if v_cand in vae_input and "3" in wf:
                    wf["3"]["inputs"]["vae_name"] = v_cand
                    break

            lora_list = _combo_opts(info.get("LoraLoaderModelOnly", {}), "lora_name")
            turbo_loras = _combo_opts(info.get("MiniMaxH3TurboLoRA", {}), "lora_name")
            has_official_turbo = (
                "MiniMaxH3TurboSampler" in info
                and "MiniMaxH3TurboLoRA" in info
                and any("minimax_h3_turbo" in x for x in turbo_loras)
            )
            model_tail: list[Any] = ["1", 0]

            if has_official_turbo:
                chosen_tlora = next(
                    (x for x in ("minimax_h3_turbo_v4_step600_ema.safetensors",) if x in turbo_loras),
                    next(x for x in turbo_loras if "minimax_h3_turbo" in x),
                )
                wf["601"] = {
                    "class_type": "MiniMaxH3TurboLoRA",
                    "inputs": {"model": model_tail, "lora_name": chosen_tlora, "strength": 1.0, "low_vram": False},
                }
                model_tail = ["601", 0]
            else:
                drama_loras = [
                    ("601", "pika_h3_flex_ref2va_v1_bf16.safetensors", 1.0),
                    ("603", "minimax_h3_turbo_v4_step600_ema_DasiwaREF2VAHybridV1_0_curveproj1025_compat_v001.safetensors", 1.0),
                    ("608", "Motion_Repair.safetensors", 0.35),
                ]
                for lid, lname, lstr in drama_loras:
                    if lname in lora_list:
                        wf[lid] = {
                            "class_type": "LoraLoaderModelOnly",
                            "inputs": {"model": model_tail, "lora_name": lname, "strength_model": lstr},
                        }
                        model_tail = [lid, 0]

            if "ModelAttentionBackend" in info:
                wf["604"] = {
                    "class_type": "ModelAttentionBackend",
                    "inputs": {"attention": "comfy kitchen attention", "model": model_tail},
                }
                model_tail = ["604", 0]

            if "BlockSparseAttention" in info and "59" in wf:
                wf["59"]["inputs"]["model"] = model_tail
                model_tail = ["59", 0]
            else:
                wf.pop("59", None)

            if not has_official_turbo and "MiniMaxH3SigmaShift" in info:
                wf["605"] = {
                    "class_type": "MiniMaxH3SigmaShift",
                    "inputs": {"shift_video": 12, "shift_audio": 3.0, "model": model_tail},
                }
                model_tail = ["605", 0]
                wf["54"]["inputs"]["sampler_name"] = "euler"
                wf["54"]["inputs"]["scheduler"] = "simple"
                wf["54"]["inputs"]["steps"] = 8

            cond_tail: list[Any] = ["7", 0]
            if "MiniMaxH3SemanticBridgeConfigT8" in info:
                bridge_models = _combo_opts(info["MiniMaxH3SemanticBridgeConfigT8"], "model_name")
                b_name = "t8_compat/BUNNY_H3_ActionLogic_Bridge_V1_T8_Compat.safetensors"
                if b_name in bridge_models:
                    wf["606"] = {
                        "class_type": "MiniMaxH3SemanticBridgeConfigT8",
                        "inputs": {
                            "model_name": b_name,
                            "enabled": True,
                            "alpha": 0.1,
                            "magnitude_match": "per_token",
                            "token_scope": "all_tokens",
                            "device": "auto",
                            "chunk_tokens": 256,
                        },
                    }
                    wf["607"] = {
                        "class_type": "MiniMaxH3SemanticBridgeApplyT8",
                        "inputs": {"conditioning": ["7", 0], "semantic_bridge": ["606", 0]},
                    }
                    cond_tail = ["607", 0]

            if has_official_turbo:
                # Official MiniMax-H3-Codex-Drama r2v-turbo sampler graph (SamplerCustomAdvanced + BasicGuider + MiniMaxH3TurboSampler)
                wf.pop("54", None)
                wf.pop("55", None)
                wf["610"] = {"class_type": "RandomNoise", "inputs": {"noise_seed": calc_seed}}
                wf["611"] = {"class_type": "BasicGuider", "inputs": {"model": model_tail, "conditioning": cond_tail}}
                wf["612"] = {"class_type": "MiniMaxH3TurboSampler", "inputs": {}}
                wf["613"] = {"class_type": "BasicScheduler", "inputs": {"model": model_tail, "scheduler": "simple", "steps": 6, "denoise": 1.0}}
                wf["54"] = {
                    "class_type": "SamplerCustomAdvanced",
                    "inputs": {
                        "noise": ["610", 0],
                        "guider": ["611", 0],
                        "sampler": ["612", 0],
                        "sigmas": ["613", 0],
                        "latent_image": ["7", 1],
                    },
                }
            elif "1" in wf:
                wf["54"]["inputs"]["model"] = model_tail
                wf["54"]["inputs"]["positive"] = cond_tail
    except Exception:
        pass

    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        resp = await client.post(f"{url}/prompt", json={"prompt": wf})
        if resp.status_code != 200:
            raise RuntimeError(f"ComfyUI prompt submission failed (HTTP {resp.status_code}): {resp.text[:400]}")
        data = resp.json()
        pid = data.get("prompt_id")
        if not pid:
            raise RuntimeError(f"ComfyUI did not return prompt_id: {data}")
        return str(pid)


async def poll_comfyui_job(base_url: str, prompt_id: str) -> dict[str, Any]:
    """Query task status from ComfyUI /history/{prompt_id}."""
    url = normalize_comfyui_url(base_url)
    async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
        try:
            resp = await client.get(f"{url}/history/{prompt_id}")
        except httpx.HTTPError:
            return {"status": "running", "history_missing": True}
        if resp.status_code in {404, 502, 503, 504, 520, 521, 522, 524, 530}:
            # A restarted Colab or busy Cloudflare tunnel can temporarily return 404/5xx.
            # The caller counts this marker and fails after a bounded retry window.
            return {"status": "running", "history_missing": True}
        if resp.status_code != 200:
            return {
                "status": "failed",
                "error": f"ComfyUI history request failed (HTTP {resp.status_code})",
            }
        history = resp.json()
        if prompt_id not in history:
            return {"status": "running", "history_pending": True}

        entry = history[prompt_id]
        status_info = entry.get("status") or {}
        status_str = str(status_info.get("status_str") or "").lower()
        if status_str in {"error", "failed", "cancelled"}:
            msgs = status_info.get("messages") or []
            # Include node_errors for precise debugging (shows which class_type failed + exception)
            node_errors = entry.get("node_errors") or {}
            node_err_text = ""
            for nid, nerr in node_errors.items():
                exc = nerr.get("exception_message") or nerr.get("exception_type") or ""
                cls = nerr.get("class_type") or nid
                node_err_text += f" [{cls}: {exc}]"
            err_text = str(msgs if msgs else status_info)
            full_err = f"ComfyUI render error: {err_text[:400]}{node_err_text[:400]}"
            return {"status": "failed", "error": full_err}

        outputs = entry.get("outputs") or {}
        # SaveVideo versions use `images`, `videos`, or `gifs`; the H3
        # workflow currently returns an mp4 inside `images`.
        images_or_videos: list[dict[str, Any]] = []
        for node_out in outputs.values():
            if not isinstance(node_out, dict):
                continue
            for key in ("videos", "gifs", "images"):
                candidates = node_out.get(key)
                if isinstance(candidates, list):
                    images_or_videos.extend(
                        item
                        for item in candidates
                        if isinstance(item, dict)
                        and (
                            str((item.get("metadata") or {}).get("kind") or "").lower() == "video"
                            or str(item.get("filename") or "").lower().endswith(
                                (".mp4", ".webm", ".mov", ".mkv", ".avi", ".gif")
                            )
                        )
                    )
            if images_or_videos:
                break

        if images_or_videos:
            item = images_or_videos[0]
            if not str(item.get("filename") or "").strip():
                return {"status": "failed", "error": "ComfyUI returned an output without a filename"}
            return {
                "status": "succeeded",
                "filename": item.get("filename"),
                "subfolder": item.get("subfolder", ""),
                "type": item.get("type", "output"),
            }

        if status_info.get("completed") or status_str in {"success", "completed"}:
            return {"status": "failed", "error": "ComfyUI completed without a video output"}
        return {"status": "running"}


async def download_comfyui_video(base_url: str, video_info: dict[str, Any], dest: Path) -> Path:
    """Download output video from ComfyUI /view."""
    url = normalize_comfyui_url(base_url)
    params = {
        "filename": video_info.get("filename"),
        "subfolder": video_info.get("subfolder", ""),
        "type": video_info.get("type", "output"),
    }
    query_str = urllib.parse.urlencode({k: v for k, v in params.items() if v})
    dest.parent.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=300.0, verify=False) as client:
        resp = await client.get(f"{url}/view?{query_str}")
        if resp.status_code != 200:
            raise RuntimeError(f"ComfyUI download video failed (HTTP {resp.status_code})")
        with open(dest, "wb") as f:
            f.write(resp.content)
    return dest
