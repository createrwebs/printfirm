"""漫剧内置图片风格 ID 与生图提示词片段。"""

from __future__ import annotations

import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# 画风板只借鉴气质，禁止抄参考图里的人物与构图
STYLE_BOARD_PROMPT_HINT = (
    "另附画风参考图：只借鉴其色调、笔触、光影与整体气质，"
    "禁止复制该图的人物、场景主体与构图。"
)

_STYLE_BOARD_EXTS = (".png", ".jpg", ".jpeg", ".webp")
_board_url_cache: dict[tuple[str, int, int], str] = {}
_board_fail_cache: dict[tuple[str, int, int], float] = {}
_BOARD_FAIL_TTL_SEC = 60.0

# IMAGE_STYLE_IDS 内置风格 ID（与前端 dramaImageStyles 对齐）
IMAGE_STYLE_IDS = (
    "retro-sci-fi-atompunk",
    "palace-intrigue-cold",
    "domestic-suspense-cold",
    "ancient-romance-soft",
    "ancient-chinese-mythology",
    "japanese-youth-film",
    "japanese-daily-natural",
    "korean-urban-soft",
    "chinese-urban-realistic",
    "wuxia-realistic-photo",
    "90s-realistic-film",
    "retro-narrative-film",
    "american-retro-hollywood",
    "neon-cyberpunk-film",
    "90s-rural-china-film",
    "cgi-3d-animation",
    "ghibli-handdrawn-anime",
    "tezuka-era-cartoon",
    "shanghai-animation",
    "pixel-art",
    "shadow-puppet-illustration",
)

# IMAGE_STYLE_PROMPTS 风格 → 提示词片段
IMAGE_STYLE_PROMPTS: dict[str, str] = {
    "retro-sci-fi-atompunk": (
        "复古科幻原子朋克风格，1950年代未来主义美学，流线型金属与原子能符号，"
        "霓虹高光，金属质感，高对比色彩，轻微胶片颗粒"
    ),
    "palace-intrigue-cold": (
        "中国宫廷权谋题材冷峻风格，低饱和暗调，克制光影，庄重构图，"
        "华贵但压抑的宫廷氛围，硬朗轮廓，戏剧化侧光"
    ),
    "domestic-suspense-cold": (
        "国产悬疑影视冷调风格，偏青灰色调，低调光，阴影浓重，写实摄影质感，紧张压抑氛围，细节丰富"
    ),
    "ancient-romance-soft": (
        "中国古代偶像剧唯美柔光风格，梦幻柔焦，暖色薄纱光晕，精致古装妆造，背景虚化，浪漫飘逸氛围"
    ),
    "ancient-chinese-mythology": (
        "中国古代神话史诗风格，上古洪荒气质，苍茫山河与云雾神光，青铜礼器与粗纻麻衣质感，"
        "水墨青绿与矿物颜料色调，庄严神圣，史诗大场面，电影级光影，忌现代偶像剧柔光与甜宠滤镜"
    ),
    "japanese-youth-film": (
        "日式青春题材胶片摄影风格，柯达胶片色调，自然阳光，浅景深，细腻颗粒，青涩真挚的日常氛围"
    ),
    "japanese-daily-natural": (
        "日式生活纪录片自然光影风格，柔和自然光，低对比，真实日常场景，安静治愈，轻微胶片质感"
    ),
    "korean-urban-soft": "韩剧都市题材柔光风格，暖色滤镜，通透肤质，都市背景虚化，浪漫温柔灯光氛围",
    "chinese-urban-realistic": (
        "国产都市现实题材写实摄影风格，自然光，真实生活场景，中性色调，细节锐利，无过度美化"
    ),
    "wuxia-realistic-photo": (
        "中国武侠江湖题材写实摄影风格，自然光影，真实地形与服饰质感，动态构图，江湖氛围，电影级景深"
    ),
    "90s-realistic-film": (
        "1990年代写实电影风格，胶片质感，自然肤色，时代感服装与环境，柔和对比，怀旧色调"
    ),
    "retro-narrative-film": (
        "复古叙事电影风格，经典电影构图，胶片色彩分级，富有故事感的场景调度，电影级布光"
    ),
    "american-retro-hollywood": (
        "美式复古好莱坞黄金年代风格，高对比布光，暖调彩色或经典黑白，明星质感，华丽景深"
    ),
    "neon-cyberpunk-film": (
        "霓虹赛博朋克电影风格，蓝紫霓虹灯光，雨夜反射，高对比，未来都市，烟雾与全息感光效"
    ),
    "90s-rural-china-film": (
        "1990年代中国农村题材电影风格，自然光，土黄与绿色调，粗糙真实质感，乡土生活氛围"
    ),
    "cgi-3d-animation": (
        "电影级三维 CGI 动画风格，皮克斯/梦工厂气质，圆润造型与清晰轮廓，"
        "柔和体积光与次表面散射，干净材质与饱和配色，浅景深，"
        "非写实摄影、非日系赛璐璐平面、非剪纸扁平"
    ),
    "ghibli-handdrawn-anime": (
        "手绘二维动画电影气质，水彩与水粉背景，柔和自然光与金色黄昏，"
        "写实人体比例与朴素五官（非大眼睛赛璐璐美少女），生活化服饰，"
        "茂盛草木、风吹草地与流动云层，温暖土黄与青绿，空气透视与电影构图，"
        "非写实摄影、非3D CGI、非像素风、非剪纸扁平"
    ),
    "tezuka-era-cartoon": "手冢治虫时代经典日式卡通画风，简洁线条，复古动画平涂着色，怀旧动画质感",
    "shanghai-animation": (
        "上海美术电影制片厂经典动画画风，中国民族绘画韵味，水彩与工笔结合，诗意唯美，传统色彩"
    ),
    "pixel-art": "像素艺术风格，清晰像素块，复古游戏美学，有限色板，8-bit 或 16-bit 质感",
    "shadow-puppet-illustration": (
        "中国皮影戏插画画风，剪影轮廓，镂空纹理，暖色背光，民间艺术装饰性，层叠投影效果"
    ),
}

# IMAGE_STYLE_LABELS 风格展示名
IMAGE_STYLE_LABELS: dict[str, str] = {
    "retro-sci-fi-atompunk": "复古科幻原子朋克",
    "palace-intrigue-cold": "宫斗权谋冷峻",
    "domestic-suspense-cold": "国产悬疑冷调",
    "ancient-romance-soft": "古偶唯美柔光",
    "ancient-chinese-mythology": "中国古代神话史诗",
    "japanese-youth-film": "日式青春胶片",
    "japanese-daily-natural": "日式生活自然",
    "korean-urban-soft": "韩剧都市柔光",
    "chinese-urban-realistic": "国产都市写实",
    "wuxia-realistic-photo": "武侠江湖写实摄影",
    "90s-realistic-film": "90年代写实电影",
    "retro-narrative-film": "复古叙事电影",
    "american-retro-hollywood": "美式复古好莱坞",
    "neon-cyberpunk-film": "霓虹赛博电影",
    "90s-rural-china-film": "90年代中国农村电影",
    "cgi-3d-animation": "3D 动画",
    "ghibli-handdrawn-anime": "宫崎骏气质手绘",
    "tezuka-era-cartoon": "手冢治虫时代卡通画风",
    "shanghai-animation": "上美画风",
    "pixel-art": "像素风",
    "shadow-puppet-illustration": "皮影戏插画",
}

IMAGE_STYLE_PROMPTS_TH: dict[str, str] = {
    "retro-sci-fi-atompunk": "สไตล์ไซไฟเรโทรอะตอมพังก์ ยุค 1950 โลหะโค้งมน แสงนีออน คอนทราสต์สูง เกรนฟิล์มบางๆ",
    "palace-intrigue-cold": "สไตล์ดราม่าชิงไหวชิงพริบในวัง โทนสีหม่นเย็น แสงเงาขรึม องค์ประกอบภาพสง่างามและกดดัน",
    "domestic-suspense-cold": "สไตล์ภาพยนตร์สืบสวนระทึกขวัญ โทนสีเทาอมฟ้า แสงน้อย เงาเข้ม ภาพถ่ายสมจริง บรรยากาศตึงเครียด",
    "ancient-romance-soft": "สไตล์ซีรีส์ย้อนยุคโรแมนติก แสงซอฟต์ละมุน โทนสีอุ่นชวนฝัน เครื่องแต่งกายประณีต ฉากหลังเบลอนุ่มนวล",
    "ancient-chinese-mythology": "สไตล์ตำนานเทพปกรณัมโบราณ ภูผาและสายหมอกศักดิ์สิทธิ์ โทนสีเขียวครามและแร่ธรรมชาติ แสงเงาภาพยนตร์มหากาพย์",
    "japanese-youth-film": "สไตล์ภาพยนตร์วัยรุ่นญี่ปุ่น ฟิล์มโกดัก แสงแดดธรรมชาติ ระยะชัดตื้น เกรนฟิล์มละเอียด บรรยากาศสดใสจริงใจ",
    "japanese-daily-natural": "สไตล์สารคดีชีวิตประจำวันญี่ปุ่น แสงธรรมชาติซอฟต์ คอนทราสต์ต่ำ บรรยากาศสงบอบอุ่นเยียวยาใจ",
    "korean-urban-soft": "สไตล์ซีรีส์เกาหลีโรแมนติกในเมือง แสงซอฟต์ฟิลเตอร์โทนอุ่น ผิวพรรณใส ฉากหลังเมืองเบลอ แสงไฟอบอุ่น",
    "chinese-urban-realistic": "สไตล์ภาพถ่ายสมจริงในเมืองยุคปัจจุบัน แสงธรรมชาติ โทนสีกลาง รายละเอียดคมชัดสมจริง",
    "wuxia-realistic-photo": "สไตล์ภาพถ่ายจอมยุทธ์สมจริง แสงเงาธรรมชาติ พื้นผิวเสื้อผ้าและฉากสมจริง องค์ประกอบภาพมีพลัง",
    "90s-realistic-film": "สไตล์ภาพยนตร์สมจริงยุค 1990 เนื้อฟิล์มคลาสสิก สีผิวธรรมชาติ เครื่องแต่งกายและฉากย้อนยุค โทนสีอบอุ่นโหยหาอดีต",
    "retro-narrative-film": "สไตล์ภาพยนตร์เล่าเรื่องเรโทร องค์ประกอบภาพคลาสสิก เกรดสีฟิล์ม การจัดแสงระดับภาพยนตร์",
    "american-retro-hollywood": "สไตล์ฮอลลีวูดยุคทองเรโทร การจัดแสงคอนทราสต์สูง โทนสีอุ่นหรูหรา ระยะชัดลึกแบบภาพยนตร์คลาสสิก",
    "neon-cyberpunk-film": "สไตล์ภาพยนตร์ไซเบอร์พังก์นีออน แสงไฟนีออนฟ้าม่วง เงาสะท้อนคืนฝนตก เมืองอนาคต หมอกและโฮโลแกรม",
    "90s-rural-china-film": "สไตล์ภาพยนตร์ชนบทยุค 1990 แสงธรรมชาติ โทนสีดินและเขียวใบไม้ พื้นผิวสมจริง บรรยากาศวิถีชีวิตชนบท",
    "cgi-3d-animation": "สไตล์แอนิเมชัน 3D CGI ระดับภาพยนตร์ รูปทรงโค้งมน แสงซอฟต์มีมิติ พื้นผิวสะอาด สีสันสดใส ระยะชัดตื้น",
    "ghibli-handdrawn-anime": "สไตล์ภาพยนตร์แอนิเมชัน 2D วาดมือ สีน้ำและสีโปสเตอร์ แสงธรรมชาติอบอุ่น สัดส่วนสมจริง บรรยากาศธรรมชาติมีชีวิตชีวา",
    "tezuka-era-cartoon": "สไตล์การ์ตูนญี่ปุ่นคลาสสิกยุคโอซามุ เทสึกะ ลายเส้นเรียบง่าย ลงสีแบนแบบอนิเมะเรโทร",
    "shanghai-animation": "สไตล์แอนิเมชันภาพวาดพู่กันและสีน้ำแบบตะวันออกดั้งเดิม งดงามราวบทกวี โทนสีคลาสสิก",
    "pixel-art": "สไตล์พิกเซลอาร์ต บล็อกพิกเซลคมชัด ความงามเกมเรโทร 8-bit หรือ 16-bit",
    "shadow-puppet-illustration": "สไตล์ภาพประกอบหนังตะลุง/หุ่นเงา โครงร่างซิลูเอต ลวดลายฉลุ แสงไฟโทนอุ่นจากด้านหลัง",
}


# 根据风格 ID 返回展示名称
def get_image_style_label(style_id: str) -> str:
    return IMAGE_STYLE_LABELS.get(style_id, style_id)


# 根据风格 ID 返回生图提示词片段，无效 ID 返回空字符串
def resolve_image_style_prompt(style_id: str | None = None, *, lang: str = "zh") -> str:
    if not style_id:
        return ""
    if lang == "th":
        return IMAGE_STYLE_PROMPTS_TH.get(style_id) or IMAGE_STYLE_PROMPTS.get(style_id, "")
    return IMAGE_STYLE_PROMPTS.get(style_id, "")


def _first_raster(directory: Path, style_id: str) -> Path | None:
    """目录下按常见栅格后缀找风格板，跳过 svg 占位。"""
    if not directory.is_dir():
        return None
    for ext in _STYLE_BOARD_EXTS:
        path = directory / f"{style_id}{ext}"
        if path.is_file() and path.stat().st_size > 1024:
            return path
    return None


# 延迟导入，避免与 storage 循环依赖
def _static_root() -> Path:
    from app.services.storage import STATIC_ROOT

    return STATIC_ROOT


def _safe_image_style_id(style_id: str | None) -> str | None:
    """只接受内置风格 ID，拒绝路径穿越。"""
    sid = (style_id or "").strip()
    if not sid or sid not in IMAGE_STYLE_IDS:
        return None
    if any(part in sid for part in ("/", "\\", "..")):
        return None
    return sid


def style_board_local_path(style_id: str | None) -> Path | None:
    """风格板本地文件：优先 backend/static，其次前端 public 封面。"""
    sid = _safe_image_style_id(style_id)
    if not sid:
        return None
    backend_dir = _static_root() / "drama" / "image-styles"
    found = _first_raster(backend_dir, sid)
    if found:
        return found
    repo_root = Path(__file__).resolve().parents[4]
    return _first_raster(repo_root / "frontend" / "public" / "image-styles", sid)


def resolve_image_style_board_url(style_id: str | None = None) -> str:
    """把风格板发到公网 https，供 Seedream / Seedance 拉图；失败则空串（仍走提示词）。"""
    path = style_board_local_path(style_id)
    if path is None:
        return ""
    cache_key = (str(path.resolve()), int(path.stat().st_mtime_ns), int(path.stat().st_size))
    cached = _board_url_cache.get(cache_key)
    if cached:
        return cached
    failed_at = _board_fail_cache.get(cache_key)
    if failed_at is not None and (time.monotonic() - failed_at) < _BOARD_FAIL_TTL_SEC:
        return ""
    from app.services import storage
    from app.services.style_lock import seedream_ref_urls

    dest = path
    static_root = _static_root()
    try:
        resolved = path.resolve()
        if static_root not in resolved.parents and static_root != resolved.parent:
            dest_dir = static_root / "drama" / "image-styles"
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / path.name
            if not dest.exists() or dest.stat().st_mtime < path.stat().st_mtime:
                dest.write_bytes(path.read_bytes())
        published = storage.publish_local(dest, sync=True)
    except Exception as exc:  # noqa: BLE001
        logger.warning("风格板未能发布为公网 URL style=%s: %s", style_id, exc)
        _board_fail_cache[cache_key] = time.monotonic()
        return ""
    urls = seedream_ref_urls(published, limit=1)
    url = urls[0] if urls else ""
    if not url:
        logger.warning("风格板 URL 不是上游可拉取的 https style=%s published=%s", style_id, published)
        _board_fail_cache[cache_key] = time.monotonic()
        return ""
    _board_fail_cache.pop(cache_key, None)
    _board_url_cache[cache_key] = url
    return url


def append_style_board_url(
    urls: list[str],
    board_url: str | None,
    *,
    max_total: int = 9,
) -> list[str]:
    """画风板接到角色/场景图之后，去重，并为板子预留最后一个名额。"""
    board = (board_url or "").strip()
    out = [u.strip() for u in urls if (u or "").strip()]
    cap = max(1, int(max_total))
    if board:
        out = [u for u in out if u != board][: cap - 1]
        out.append(board)
        return out
    return out[:cap]
