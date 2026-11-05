"""Drama script agents: summary + episode outline + episode scripts."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.agent.runner import run_task_json
from app.services.drama.llm import DramaLlmJsonError, drama_chat_json
from app.services.drama.language import detect_content_language, has_language_violation, language_instruction
from app.services.drama.script_summary_prompt import (
    SCRIPT_SUMMARY_SYSTEM_PROMPT,
    build_script_summary_user_message,
)

# 正文过短阈值（汉字量近似用去空白后长度）
MIN_EPISODE_CONTENT_CHARS = 450
# 短剧单集目标篇幅（约 1–1.5 分钟成片，对应 6–10 镜）
TARGET_EPISODE_CONTENT_CHARS = 550
EPISODE_SCENE_COUNT_HINT = "2-3 场"
# 手动加集标记；自动流水线不会填这些空集
MANUAL_EPISODE_ORIGIN = "manual"
# 与创建项目上限对齐
MAX_DRAMA_EPISODES = 120


async def _chat_json(
    system: str,
    user: str,
    *,
    task: str = "script_rewrite",
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
    **kwargs: Any,
) -> Any:
    """Call a drama agent with its role skill when request context is available."""
    if db is not None and user_id is not None:
        return await run_task_json(
            db,
            user_id,
            task=task,
            system=system,
            user=user,
            skill_ids=skill_ids,
            **kwargs,
        )
    return await drama_chat_json(system, user, **kwargs)

# 与 manju episodeScript 对齐：先规划全集集名
EPISODE_OUTLINE_SYSTEM = """你是专业的短剧/网剧编剧策划，负责根据原始创意与剧本摘要，规划全部分集的「集数 + 集名」大纲。

输出要求：
1. 必须严格按照用户给定的总集数生成，episodes 数组长度必须与总集数完全一致
2. episodeNumber 从 1 开始连续递增，不得跳号、不得重复
3. 每集 title 为 4-12 个字符的集名，必须使用原始创意语言，概括本集核心事件或冲突钩子
4. 全剧分集须覆盖剧本摘要中的起承转合：前期立人设与世界观、中期升级矛盾与反转、后期高潮与结局，节奏适合短剧连载
5. 相邻集名之间要有因果衔接与追剧钩子，避免重复套路
6. 语言使用与用户输入或摘要相同的语言（如泰语/英语/中文）

必须输出严格 JSON：
{"episodes":[{"episodeNumber":1,"title":"集名"}, ...]}"""

# 与 manju episodeScript 对齐：逐集撰写拍摄正文
EPISODE_BATCH_CONTENT_SYSTEM = """你是专业的短剧/网剧编剧，负责根据原始创意、剧本摘要、分集规划与已有剧集正文，撰写指定集数的拍摄剧本正文。

输出要求：
1. 每次任务只输出用户指定批次范围内的集数，episodes 数组长度必须与批次集数完全一致
2. episodeNumber 须与用户指定的集数一一对应，不得遗漏、不得额外生成
3. 须携带并参考「已有剧集正文」保持剧情、人设与世界观连贯；首批次无已有正文时从第 1 集开篇写起
4. 批次内各集之间须有因果衔接，末集结尾留追剧钩子
5. 必须输出对象格式：{"episodes":[{"episodeNumber":数字,"title":"集名","summary":"本集梗概","content":"..."}]}，不要直接输出数组
6. summary 为本集 120-300 个字符的事件梗概，必须使用原始创意语言；content 为正文主字段；creative 为可选创作备注，没有额外要求就省略，禁止再生成一份同义梗概

格式要求（每集 content 须严格遵守）：
1. 按场次组织；泰语使用 ### ฉาก{集数}-{场次}，如 ### ฉาก1-2；仅为兼容中文旧稿才使用 ### 场1-2
2. 场头下一行写时间内外景，如：日 内 灵山大雄宝殿 / 夜 外 妖寨大门外 / 晨外 羽山刑场
3. 下一行写：泰语使用 ตัวละครที่ออกฉาก：角色A、角色B；不要在新稿使用 出场人物（只写可出镜人物名；不要写「某某（声音）」「某某音色」等音色标注）
4. 动作用 △ 开头，独占一行；动作须具体可拍（景别、调度、道具、表情），禁止一句带过
5. 台词格式：角色名（情绪/vo/os/动作）：台词内容；旁白用 vo，内心独白用 os；台词要有潜台词与冲突；括号内写情绪/vo/os，不要写「声音」「音色」
6. 关键镜头可用【空镜：描述】收尾一场或一段
7. content 内不要输出「第X集」或「X.集名：」标题行，只输出场戏正文
8. 每集 2-3 场；每场 2-3 段 △ 动作与 2-3 句台词（或对白+vo）；整集 content 约 450-600 个字符，必须使用原始创意语言，节奏紧凑、不注水
9. 语言使用与剧本摘要相同的语言（如泰语/英语/中文），偏影视剧本风格，动作与台词可拍摄、有张力"""

# 把用户草稿改写成可拍摄分集正文
EPISODE_OPTIMIZE_SYSTEM = """你是专业的短剧/网剧编剧，负责把用户提供的分集剧本草稿，改写成可拍摄的分集正文。

工作原则：
1. 以用户草稿为剧情与台词的主要依据，保留人物、冲突、场次意图和关键对白，不要另起一套故事
2. 草稿已经接近拍摄格式时，做结构整理、补全场头/动作/台词，不要大幅改情节
3. 草稿只是梗概或提纲时，按草稿情节扩写成完整场戏，不得跑题
4. 须参考原始创意、剧本摘要与前后集，保持人设与世界观连贯
5. 只输出用户指定的那一集，episodes 数组必须恰好 1 项

格式要求（content 须严格遵守）：
1. 按场次组织；泰语使用 ### ฉาก{集数}-{场次}，如 ### ฉาก2-1；仅为兼容中文旧稿才使用 ### 场2-1
2. 场头下一行写时间内外景，如：日 内 教室 / 夜 外 天台
3. 下一行写：泰语使用 ตัวละครที่ออกฉาก：角色A、角色B；不要在新稿使用 出场人物（只写可出镜人物名；不要写音色标注）
4. 动作用 △ 开头，独占一行；动作须具体可拍
5. 台词格式：角色名（情绪/vo/os/动作）：台词内容；旁白用 vo，内心独白用 os
6. 关键镜头可用【空镜：描述】
7. content 内不要输出「第X集」或「X.集名：」标题行，只输出场戏正文
8. 每集 2-3 场；整集 content 约 450-600 个字符，必须使用原始创意语言，节奏紧凑
9. 语言使用与剧本摘要相同的语言（如泰语/英语/中文）

必须输出严格 JSON：
{"episodes":[{"episodeNumber":数字,"title":"集名","content":"..."}]}"""


# 本集创意 → 集级摘要
EPISODE_SUMMARY_FROM_CREATIVE_SYSTEM = """你是专业的短剧/网剧编剧策划，根据整剧设定与本集原始创意，撰写本集「剧情摘要」。

输出要求：
1. 只输出用户指定的那一集，episodes 数组必须恰好 1 项
2. summary 为本集 120-300 个字符的剧情摘要：人物、冲突、转折、结尾钩子；使用原始创意语言，不要写成场戏正文
3. 可顺带优化 title（4-12 个字符的集名）；必须使用原始创意语言，不要输出 content/body
4. 须参考整剧创意、全剧摘要、全集集名、邻集正文与邻集摘要，保持人设与世界观连贯
5. 若提供「已有定妆角色名」，摘要中人物称呼须优先使用这些定妆名；新角色须写清全名
6. 语言使用与用户输入或摘要相同的语言（如泰语/英语/中文）

必须输出严格 JSON：
{"episodes":[{"episodeNumber":数字,"title":"集名","summary":"..."}]}"""


# 本集创意+摘要 → 拍摄正文（约束与批量 EPISODE_BATCH_CONTENT_SYSTEM 对齐）
EPISODE_BODY_FROM_BRIEF_SYSTEM = """你是专业的短剧/网剧编剧，根据本集原始创意与剧情摘要，撰写可拍摄的分集正文。

输出要求：
1. 只输出用户指定的那一集，episodes 数组必须恰好 1 项
2. 以本集创意与摘要为情节依据，不要另起故事
3. 须参考整剧设定、全集集名与邻集正文，保持剧情、人设与世界观连贯
4. content 为正文主字段；不要把正文写得过短
5. 若提供「已有定妆角色名」，出场人物与台词角色名须优先使用这些定妆名；新角色须在出场人物行写清全名

格式要求（content 须严格遵守）：
1. 按场次组织；泰语使用 ### ฉาก{集数}-{场次}，如 ### ฉาก2-1；仅为兼容中文旧稿才使用 ### 场2-1
2. 场头下一行写时间内外景，如：日 内 教室 / 夜 外 天台 / 晨外 操场
3. 下一行写：泰语使用 ตัวละครที่ออกฉาก：角色A、角色B；不要在新稿使用 出场人物（只写可出镜人物名；不要写「某某（声音）」「某某音色」等音色标注）
4. 动作用 △ 开头，独占一行；动作须具体可拍（景别、调度、道具、表情），禁止一句带过
5. 台词格式：角色名（情绪/vo/os/动作）：台词内容；旁白用 vo，内心独白用 os；台词要有潜台词与冲突；括号内写情绪/vo/os，不要写「声音」「音色」
6. 关键镜头可用【空镜：描述】收尾一场或一段
7. content 内不要输出「第X集」或「X.集名：」标题行，只输出场戏正文
8. 每集 2-3 场；每场 2-3 段 △ 动作与 2-3 句台词（或对白+vo）；整集 content 约 450-600 个字符，必须使用原始创意语言
9. 语言使用与剧本摘要相同的语言（如泰语/英语/中文），偏影视剧本风格，动作与台词可拍摄、有张力

必须输出严格 JSON：
{"episodes":[{"episodeNumber":数字,"title":"集名","content":"..."}]}"""


# 已有正文 → 提取本集梗概，保留用户原有创作备注
EPISODE_BRIEF_FROM_BODY_SYSTEM = """你是专业的短剧/网剧编剧策划。根据已有拍摄正文，提取本集剧情梗概。

输出要求：
1. 只输出用户指定的那一集，episodes 数组必须恰好 1 项
2. 只提取本集正文已有事件，不反推或补写 creative 创作备注
3. summary 为本集 120-300 个字符的剧情摘要：人物、冲突、转折、结尾钩子；使用原始创意语言，不要写成场戏正文
4. 可顺带优化 title（4-12 个字符的集名）；必须使用原始创意语言，不要输出 content/body
5. 须忠实于正文已有情节，不要另起故事
6. 语言使用与用户输入或摘要相同的语言（如泰语/英语/中文）

必须输出严格 JSON：
{"episodes":[{"episodeNumber":数字,"title":"集名","summary":"..."}]}"""


# 所有正文入口共用：原始故事是事实依据，摘要与画面风格不得改变事件因果。
_SCRIPT_ADAPTATION_RULES = """

改编忠实度与可拍摄性（优先于通用戏剧化建议）：
1. 用户提供完整故事或剧本时，保留原文事件顺序、人物关系、关键行为、动机与结局；摘要若与原文事实矛盾，以原文为准，用户明确提出的改编要求除外。只补充实现已有情节必需的可见动作，不擅自增加危机、冲突、旁白或象征性支线。
2. 单集故事须完整覆盖原文的开端、过程、结果，不能为尾钩省略结局。多集按规划分配情节。儿童/治愈/童话保持自然易懂、温暖的语气，不把好奇提问强改为质疑，不把正常储粮改为饥荒求生。
3. 每段动作只写人物此刻做什么及可见结果；外观设定由角色资产承载，不反复描写虹膜、毛发比例、五官或材质。服装佩戴位置不得与设定冲突。不得使用“身份跃迁”“时间折叠”等无法直接拍摄的抽象句作动作。
4. 景别、运镜适量；3D/CGI 是画面风格，不是往剧情里增加发光网络、地下特效的理由。时间/季节变化写明转场，前后动作与道具状态衔接。
5. creative 是可选创作备注，不要再复述 summary；summary 是本集事件梗概，正文是唯一拍摄依据。二者冲突时以本集梗概的事件安排为准，同时遵守原文事实。
"""
EPISODE_BATCH_CONTENT_SYSTEM += _SCRIPT_ADAPTATION_RULES
EPISODE_BODY_FROM_BRIEF_SYSTEM += _SCRIPT_ADAPTATION_RULES
EPISODE_OPTIMIZE_SYSTEM += _SCRIPT_ADAPTATION_RULES

THAI_EPISODE_BATCH_CONTENT_SYSTEM = """คุณเป็นนักเขียนบทละครซีรีส์สั้นมืออาชีพ มีหน้าที่เขียนบทการถ่ายทำ (shooting script) สำหรับตอนที่กำหนด โดยอ้างอิงจากแก่นเรื่องย่อ ข้อมูลตัวละคร และโครงเรื่อง

ข้อกำหนดผลลัพธ์:
1. ต้องส่งออกในรูปแบบ JSON ที่ถูกต้องเท่านั้น:
{"episodes":[{"episodeNumber":ตัวเลข,"title":"ชื่อตอนภาษาไทย","summary":"เรื่องย่อของตอนนี้ภาษาไทย (100-250 ตัวอักษร)","content":"บทการถ่ายทำภาษาไทย"}]}
2. ภาษาทั้งหมด (ทั้งบทบรรยาย, การกระทำ △, บทสนทนา, ชื่อฉาก) ต้องเป็นภาษาไทย 100% ห้ามมีภาษาจีนปนแม้แต่ตัวอักษรเดียว!
3. โครงสร้างของ content ในแต่ละตอน (ต้องปฏิบัติตามอย่างเคร่งครัด):
   - แบ่งเป็น 2-3 ฉาก โดยขึ้นต้นหัวฉากด้วยรูปแบบ: ### ฉาก{เลขตอน}-{เลขฉาก} (เช่น ### ฉาก1-1)
   - บรรทัดถัดมาให้ระบุ เวลา สถานที่ ใน/นอก เป็นภาษาไทย เช่น: กลางวัน ใน ห้องตรวจคลินิกสัตว์ / กลางคืน นอก ถนนสายเก่า
   - บรรทัดถัดมาให้ระบุตัวละครที่ปรากฏ: ตัวละครที่ออกฉาก: [ชื่อตัวละคร คั่นด้วยจุลภาค]
   - การกระทำของตัวละครและภาพ ขึ้นต้นด้วยเครื่องหมาย △ อยู่เดี่ยวๆ หนึ่งบรรทัด บรรยายให้เห็นภาพชัดเจน ถ่ายทำได้จริง
   - บทสนทนาใช้รูปแบบ: ชื่อตัวละคร (อารมณ์/ท่าทาง): บทพูดภาษาไทย
   - เสียงบรรยายใช้: ผู้บรรยาย (vo): ข้อความ หรือ ชื่อตัวละคร (os): ข้อความคิดในใจ
   - ช็อตว่างหรือทิวทัศน์ใช้: 【ภาพว่าง: คำอธิบาย】
4. ห้ามใส่เครื่องหมายคำพูดภาษาอังกฤษคู่ (") ในเนื้อหา content หรือ summary ให้ใช้เครื่องหมายคำพูดเดี่ยว (') แทน เพื่อความถูกต้องของ JSON
5. ความยาว content แต่ละตอนประมาณ 500-1000 ตัวอักษรภาษาไทย เนื้อเรื่องกระชับ ตื่นเต้น น่าติดตาม มีปมหรือจุดหักมุมท้ายตอน"""

THAI_EPISODE_BODY_FROM_BRIEF_SYSTEM = """คุณเป็นนักเขียนบทละครซีรีส์สั้นมืออาชีพ เขียนบทการถ่ายทำที่สมบูรณ์สำหรับตอนที่กำหนด โดยอ้างอิงจากเรื่องย่อและแก่นเรื่องของตอน

ข้อกำหนดผลลัพธ์:
1. ส่งออกในรูปแบบ JSON:
{"episodes":[{"episodeNumber":ตัวเลข,"title":"ชื่อตอนภาษาไทย","content":"บทการถ่ายทำภาษาไทย"}]}
2. ภาษาทั้งหมดต้องเป็นภาษาไทย 100% ห้ามมีภาษาจีนเด็ดขาด!
3. รูปแบบ content แต่ละตอน:
   - หัวฉาก: ### ฉาก{เลขตอน}-{เลขฉาก} (เช่น ### ฉาก1-1)
   - เวลา สถานที่: กลางวัน ใน [สถานที่] / กลางคืน นอก [สถานที่]
   - ตัวละคร: ตัวละครที่ออกฉาก: [ชื่อตัวละคร]
   - การกระทำ: △ [การกระทำที่เป็นภาพชัดเจน ถ่ายทำได้จริง]
   - บทสนทนา: [ชื่อตัวละคร] ([อารมณ์/ท่าทาง]): [บทพูดภาษาไทย]
   - เสียงบรรยาย: ผู้บรรยาย (vo): [ข้อความ] หรือ [ชื่อตัวละคร] (os): [ข้อความคิดในใจ]
4. ห้ามใส่เครื่องหมายคำพูดคู่ (") ใน content ให้ใช้ (') แทน
5. ความยาว content ประมาณ 500-1000 ตัวอักษรภาษาไทย"""

THAI_EPISODE_SUMMARY_FROM_CREATIVE_SYSTEM = """คุณเป็นนักเขียนบทและนักวางแผนซีรีส์สั้น เขียนสรุปเนื้อเรื่องย่อสำหรับตอนที่กำหนด

ข้อกำหนดผลลัพธ์:
1. ส่งออกในรูปแบบ JSON:
{"episodes":[{"episodeNumber":ตัวเลข,"title":"ชื่อตอนภาษาไทย","summary":"เรื่องย่อภาษาไทย 120-300 ตัวอักษร"}]}
2. ภาษาไทย 100% ห้ามมีภาษาจีน
3. ห้ามใส่เครื่องหมายคำพูดคู่ (") ใน JSON"""

THAI_EPISODE_BRIEF_FROM_BODY_SYSTEM = """คุณเป็นนักเขียนบทและบรรณาธิการซีรีส์สั้น สรุปเรื่องย่อจากบทการถ่ายทำที่มีอยู่

ข้อกำหนดผลลัพธ์:
1. ส่งออกในรูปแบบ JSON:
{"episodes":[{"episodeNumber":ตัวเลข,"title":"ชื่อตอนภาษาไทย","summary":"เรื่องย่อภาษาไทย 120-300 ตัวอักษร"}]}
2. ภาษาไทย 100% ห้ามมีภาษาจีน
3. ห้ามใส่เครื่องหมายคำพูดคู่ (") ใน JSON"""

THAI_EPISODE_OPTIMIZE_SYSTEM = """คุณเป็นนักเขียนบทมืออาชีพ ปรับปรุงร่างบทละครของผู้ใช้ให้เป็นบทการถ่ายทำที่สมบูรณ์

ข้อกำหนดผลลัพธ์:
1. ส่งออกในรูปแบบ JSON:
{"episodes":[{"episodeNumber":ตัวเลข,"title":"ชื่อตอนภาษาไทย","content":"บทการถ่ายทำภาษาไทย"}]}
2. ภาษาไทย 100% ห้ามมีภาษาจีน
3. หัวฉากใช้ ### ฉาก{ตอน}-{ฉาก}, กลางวัน/กลางคืน ใน/นอก [สถานที่], ตัวละครที่ออกฉาก: [ชื่อตัวละคร], △ การกระทำ, และ [ตัวละคร] ([อารมณ์]): [บทพูด]"""


def get_episode_batch_system_prompt(source: str) -> str:
    lang = detect_content_language(source)
    if lang == "th":
        return THAI_EPISODE_BATCH_CONTENT_SYSTEM
    return EPISODE_BATCH_CONTENT_SYSTEM


def get_episode_body_system_prompt(source: str) -> str:
    lang = detect_content_language(source)
    if lang == "th":
        return THAI_EPISODE_BODY_FROM_BRIEF_SYSTEM
    return EPISODE_BODY_FROM_BRIEF_SYSTEM


def get_episode_summary_system_prompt(source: str) -> str:
    lang = detect_content_language(source)
    if lang == "th":
        return THAI_EPISODE_SUMMARY_FROM_CREATIVE_SYSTEM
    return EPISODE_SUMMARY_FROM_CREATIVE_SYSTEM


def get_episode_brief_from_body_system_prompt(source: str) -> str:
    lang = detect_content_language(source)
    if lang == "th":
        return THAI_EPISODE_BRIEF_FROM_BODY_SYSTEM
    return EPISODE_BRIEF_FROM_BODY_SYSTEM


def get_episode_optimize_system_prompt(source: str) -> str:
    lang = detect_content_language(source)
    if lang == "th":
        return THAI_EPISODE_OPTIMIZE_SYSTEM
    return EPISODE_OPTIMIZE_SYSTEM



def _require_generated_episode_bodies(rows: list[dict[str, Any]]) -> None:
    """拒绝重试后仍不合格的短正文，避免继续自动分镜并显示成功。"""
    for row in rows:
        if _content_char_len(str(row.get("body") or "")) < MIN_EPISODE_CONTENT_CHARS:
            raise ValueError(f"第 {row.get('episodeNumber')} 集正文仍过短，请重试或手动完善剧本")


def _require_generated_language(rows: list[dict[str, Any]], source: str) -> None:
    """Prevent a Chinese/English body from being saved for a Thai source."""
    visible = "\n".join(
        f"{row.get('title', '')}\n{row.get('creative', '')}\n{row.get('body', '')}\n{row.get('summary', '')}"
        for row in rows
        if isinstance(row, dict)
    )
    if has_language_violation(source, visible):
        raise ValueError("模型输出语言与原始创意不一致，已阻止保存；请重试")


def _format_neighbor_episode_briefs(episodes: list[dict[str, Any]], number: int, limit: int = 3) -> str:
    """邻集标题/创意/摘要，作正文节选的补充。"""
    others = [
        item
        for item in episodes
        if isinstance(item, dict) and int(item.get("episodeNumber") or 0) != number
    ]
    others.sort(key=lambda x: abs(int(x.get("episodeNumber") or 0) - number))
    picked = others[:limit]
    if not picked:
        return "（暂无邻集）"
    blocks: list[str] = []
    for item in sorted(picked, key=lambda x: int(x.get("episodeNumber") or 0)):
        num = item.get("episodeNumber")
        title = item.get("title") or f"第 {num} 集"
        creative = str(item.get("creative") or "").strip()
        summary = str(item.get("summary") or "").strip()
        parts = [f"第 {num} 集《{title}》"]
        if creative:
            parts.append(f"创意：{creative[:400]}")
        if summary:
            parts.append(f"摘要：{summary[:500]}")
        blocks.append("\n".join(parts))
    return "\n\n".join(blocks)


def _format_neighbor_episode_bodies(
    episodes: list[dict[str, Any]],
    number: int,
    limit: int = 3,
) -> str:
    """与 batch 同级：取距当前集最近、且已有正文的若干集节选。"""
    others = [
        item
        for item in episodes
        if isinstance(item, dict)
        and int(item.get("episodeNumber") or 0) != number
        and str(item.get("body") or item.get("content") or "").strip()
    ]
    others.sort(key=lambda x: abs(int(x.get("episodeNumber") or 0) - number))
    picked = others[:limit]
    if not picked:
        return "（暂无邻集正文）"
    blocks: list[str] = []
    for item in sorted(picked, key=lambda x: int(x.get("episodeNumber") or 0)):
        num = item.get("episodeNumber")
        title = item.get("title") or f"第 {num} 集"
        body = str(item.get("body") or item.get("content") or "").strip()
        if len(body) > 1800:
            body = body[:1800] + "\n…（上文已截断）"
        blocks.append(f"{num}.{title}：\n{body}")
    return "\n\n".join(blocks)


def format_character_asset_names_line(names: list[str] | None) -> str:
    """定妆角色名一行，供单集 prompt 约束称呼。"""
    cleaned: list[str] = []
    for raw in names or []:
        name = str(raw or "").strip()
        if name and name not in cleaned:
            cleaned.append(name)
    if not cleaned:
        return "（暂无定妆角色资产；新角色须在出场人物行写清全名）"
    joined = "、".join(cleaned[:80])
    return f"须优先使用这些定妆名：{joined}；新角色须在出场人物行写清全名"


def build_single_episode_context(
    project_summary: dict[str, Any],
    existing: list[dict[str, Any]],
    number: int,
    *,
    project_source: str = "",
    character_asset_names: list[str] | None = None,
) -> list[str]:
    """单集 summary/body/full/brief/optimize 共用的厚上下文块。"""
    source = (project_source or "").strip()
    return [
        language_instruction(source or format_summary_text(project_summary)),
        f"整剧原始创意：\n{source or '（无）'}",
        f"全剧剧本摘要：\n{format_summary_text(project_summary)}",
        f"全剧分集规划：\n{_format_episode_title_list(existing)}",
        f"邻集正文（近 {3} 集节选）：\n{_format_neighbor_episode_bodies(existing, number)}",
        f"邻集创意/摘要补充：\n{_format_neighbor_episode_briefs(existing, number)}",
        f"已有定妆角色名：\n{format_character_asset_names_line(character_asset_names)}",
    ]


async def run_episode_summary_from_creative(
    project_summary: dict[str, Any],
    existing: list[dict[str, Any]],
    number: int,
    creative: str,
    *,
    project_source: str = "",
    title: str | None = None,
    character_asset_names: list[str] | None = None,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """本集创意 → 集级 summary（可更新 title）。"""
    brief = (creative or "").strip()
    if len(brief) < 20:
        raise ValueError("本集原始创意至少 20 字")
    title_text = (title or "").strip() or f"第 {number} 集"
    user_parts = [
        *build_single_episode_context(
            project_summary,
            existing,
            number,
            project_source=project_source,
            character_asset_names=character_asset_names,
        ),
        f"当前集号：{number}",
        f"当前集名：{title_text}",
        f"本集原始创意：\n{brief}",
        "请只输出本集 title 与 summary。",
    ]
    sys_prompt = get_episode_summary_system_prompt(project_source or brief)
    data = await _chat_json(
        sys_prompt,
        "\n\n".join(user_parts),
        max_tokens=4096,
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    episodes = data.get("episodes") if isinstance(data, dict) else None
    if not isinstance(episodes, list) or not episodes:
        raise ValueError("模型未返回本集摘要")
    item = episodes[0] if isinstance(episodes[0], dict) else {}
    out_summary = str(item.get("summary") or item.get("synopsis") or "").strip()
    if len(out_summary) < 40:
        raise ValueError("本集摘要过短，请重试")
    out_title = str(item.get("title") or "").strip() or title_text
    return [
        {
            "episodeNumber": number,
            "title": out_title,
            "creative": brief,
            "summary": out_summary,
            "body": "",
        }
    ]


async def run_episode_body_from_brief(
    project_summary: dict[str, Any],
    existing: list[dict[str, Any]],
    number: int,
    *,
    creative: str,
    summary: str,
    project_source: str = "",
    title: str | None = None,
    character_asset_names: list[str] | None = None,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """本集创意+摘要 → 拍摄正文 body。"""
    brief = (creative or "").strip()
    syn = (summary or "").strip()
    if len(brief) < 10 and len(syn) < 40:
        raise ValueError("请先填写本集创意或摘要")
    title_text = (title or "").strip() or f"第 {number} 集"
    user_parts = [
        *build_single_episode_context(
            project_summary,
            existing,
            number,
            project_source=project_source,
            character_asset_names=character_asset_names,
        ),
        f"当前集号：{number}",
        f"当前集名：{title_text}",
        f"本集原始创意：\n{brief or '（无，以摘要为准）'}",
        f"本集剧情摘要：\n{syn or '（无，以创意为准）'}",
        "请撰写本集拍摄正文 content。",
    ]
    sys_prompt = get_episode_body_system_prompt(project_source or brief or syn)
    data = await _chat_json(
        sys_prompt,
        "\n\n".join(user_parts),
        max_tokens=8192,
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    episodes = data.get("episodes") if isinstance(data, dict) else None
    if not isinstance(episodes, list):
        raise ValueError("模型未返回本集正文")
    title_by_num = {number: title_text}
    normalized = _normalize_batch_episodes(episodes, number, number, title_by_num)
    if not normalized:
        raise ValueError(f"模型未返回第 {number} 集正文")
    row = normalized[0]
    row["creative"] = brief or str(row.get("creative") or "")
    row["summary"] = syn or str(row.get("summary") or "")
    source_language = project_source or format_summary_text(project_summary)
    needs_retry = (
        _content_char_len(str(row.get("body") or "")) < MIN_EPISODE_CONTENT_CHARS
        or has_language_violation(source_language, str(row.get("body") or ""))
    )
    if needs_retry:
        # 过短或语言错时再试一次，明确要求原始语言
        retry = await _chat_json(
            sys_prompt,
            "\n\n".join(
                user_parts
                + [
                    f"上一稿过短（不足 {MIN_EPISODE_CONTENT_CHARS} 字），请扩写至约 {TARGET_EPISODE_CONTENT_CHARS} 个字符，"
                    f"含 {EPISODE_SCENE_COUNT_HINT}、每场 2-3 段 △ 与 2-3 句台词，仍只输出第 {number} 集。"
                    + "\n"
                    + language_instruction(source_language),
                ]
            ),
            max_tokens=8192,
            db=db,
            user_id=user_id,
            skill_ids=skill_ids,
        )
        retry_eps = retry.get("episodes") if isinstance(retry, dict) else None
        if isinstance(retry_eps, list):
            normalized = _normalize_batch_episodes(retry_eps, number, number, title_by_num) or normalized
            row = normalized[0]
            row["creative"] = brief or str(row.get("creative") or "")
            row["summary"] = syn or str(row.get("summary") or "")
    _require_generated_language([row], source_language)
    _require_generated_episode_bodies([row])
    return [row]


async def run_episode_full_from_creative(
    project_summary: dict[str, Any],
    existing: list[dict[str, Any]],
    number: int,
    creative: str,
    *,
    project_source: str = "",
    title: str | None = None,
    character_asset_names: list[str] | None = None,
    summary: str = "",
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """优先按已确认梗概生成整集；无梗概时兼容旧创意→梗概→正文。"""
    synopsis = (summary or "").strip()
    if len(synopsis) >= 40:
        summary_rows = [{"creative": creative, "summary": synopsis, "title": title}]
    else:
        summary_rows = await run_episode_summary_from_creative(
            project_summary,
            existing,
            number,
            creative,
            project_source=project_source,
            title=title,
            character_asset_names=character_asset_names,
            db=db,
            user_id=user_id,
            skill_ids=skill_ids,
        )
    syn_row = summary_rows[0]
    body_rows = await run_episode_body_from_brief(
        project_summary,
        existing,
        number,
        creative=str(syn_row.get("creative") or creative),
        summary=str(syn_row.get("summary") or ""),
        project_source=project_source,
        title=str(syn_row.get("title") or title or ""),
        character_asset_names=character_asset_names,
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    out = body_rows[0]
    out["creative"] = str(syn_row.get("creative") or creative).strip()
    out["summary"] = str(syn_row.get("summary") or "").strip()
    out["title"] = str(out.get("title") or syn_row.get("title") or title or f"第 {number} 集")
    return [out]


async def run_episode_brief_from_body(
    project_summary: dict[str, Any],
    existing: list[dict[str, Any]],
    number: int,
    body: str,
    *,
    project_source: str = "",
    title: str | None = None,
    character_asset_names: list[str] | None = None,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """已有拍摄正文 → 提取 summary，保留原有 creative 和 body。"""
    script_body = (body or "").strip()
    if len(script_body) < 80:
        raise ValueError("本集剧本内容过短，无法提取梗概")
    title_text = (title or "").strip() or f"第 {number} 集"
    user_parts = [
        *build_single_episode_context(
            project_summary,
            existing,
            number,
            project_source=project_source,
            character_asset_names=character_asset_names,
        ),
        f"当前集号：{number}",
        f"当前集名：{title_text}",
        f"本集拍摄正文：\n{script_body[:12000]}",
        "请只输出本集 title、summary；不要改写正文或补写创作备注。",
    ]
    sys_prompt = get_episode_brief_from_body_system_prompt(project_source or script_body)
    data = await _chat_json(
        sys_prompt,
        "\n\n".join(user_parts),
        max_tokens=4096,
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    episodes = data.get("episodes") if isinstance(data, dict) else None
    if not isinstance(episodes, list) or not episodes:
        raise ValueError("模型未返回本集梗概")
    item = episodes[0] if isinstance(episodes[0], dict) else {}
    current = next(
        (row for row in existing if isinstance(row, dict) and int(row.get("episodeNumber") or 0) == number),
        {},
    )
    out_creative = str(current.get("creative") or "").strip()
    out_summary = str(item.get("summary") or item.get("synopsis") or "").strip()
    if len(out_summary) < 40:
        raise ValueError("反推的本集摘要过短，请重试")
    out_title = str(item.get("title") or "").strip() or title_text
    return [
        {
            "episodeNumber": number,
            "title": out_title,
            "creative": out_creative,
            "summary": out_summary,
            "body": script_body,
        }
    ]


def normalize_summary_dict(data: Any, default_episode_count: int = 12) -> dict[str, Any]:
    if not isinstance(data, dict):
        return {"episodeCount": default_episode_count, "characters": []}

    ep_count = data.get("episodeCount") or data.get("episode_count") or data.get("total_episodes") or default_episode_count
    try:
        ep_count = int(ep_count)
    except (TypeError, ValueError):
        ep_count = default_episode_count

    title = data.get("seriesTitle") or data.get("series_title") or data.get("projectTitle") or data.get("project_title") or data.get("title") or ""
    synopsis = data.get("synopsis") or data.get("core_concept") or data.get("projectDescription") or data.get("summary") or data.get("description") or data.get("plotSummary") or ""
    one_line = data.get("oneLineStory") or data.get("one_line_story") or (synopsis[:100] if synopsis else "")
    story_type = data.get("storyType") or data.get("story_type") or data.get("genre") or data.get("visualStyle") or "drama"
    target_aud = data.get("targetAudience") or data.get("target_audience") or "general"
    hook = data.get("coreHook") or data.get("core_hook") or data.get("hook") or ""

    raw_chars = (
        data.get("characters")
        or data.get("protagonists")
        or data.get("main_characters")
        or data.get("coreCharacters")
        or data.get("core_characters")
        or []
    )
    norm_chars = []
    if isinstance(raw_chars, list):
        for c in raw_chars:
            if not isinstance(c, dict):
                continue
            c_name = (c.get("name") or c.get("character_name") or c.get("characterName") or "").strip()
            if not c_name:
                continue
            c_title = c.get("title") or c.get("role") or c.get("roleType") or c.get("role_type") or ""
            c_role_type = c.get("roleType") or c.get("role_type") or c.get("role") or "supporting"
            c_visual = c.get("visualImage") or c.get("visual_image") or c.get("appearance") or c.get("visual") or ""
            c_tags = c.get("coreTags") or c.get("core_tags") or c.get("tags") or ""
            c_bg = c.get("identityBackground") or c.get("identity_background") or c.get("background") or ""
            c_exp = c.get("growthExperience") or c.get("growth_experience") or c.get("experience") or ""
            c_pers = c.get("personality") or ""
            c_rel = c.get("relationships") or c.get("relationship") or ""
            c_arc = c.get("growthArc") or c.get("growth_arc") or c.get("storyArc") or c.get("story_arc") or c.get("arc") or ""

            norm_chars.append({
                "name": c_name,
                "title": str(c_title),
                "roleType": str(c_role_type),
                "visualImage": str(c_visual),
                "coreTags": str(c_tags),
                "identityBackground": str(c_bg),
                "growthExperience": str(c_exp),
                "personality": str(c_pers),
                "relationships": str(c_rel),
                "growthArc": str(c_arc),
            })

    return {
        "episodeCount": ep_count,
        "seriesTitle": str(title),
        "storyType": str(story_type),
        "targetAudience": str(target_aud),
        "coreHook": str(hook),
        "oneLineStory": str(one_line),
        "characters": norm_chars,
        "synopsis": str(synopsis),
    }


def validate_summary_output(summary: dict[str, Any], source: str) -> None:
    """Reject incomplete or language-switched summaries before downstream seeding."""
    required = ("seriesTitle", "storyType", "oneLineStory", "synopsis")
    if any(not str(summary.get(key) or "").strip() for key in required):
        raise ValueError("模型返回的剧本摘要字段不完整")
    characters = summary.get("characters")
    if not isinstance(characters, list) or not characters:
        raise ValueError("模型未返回完整角色列表")
    visible = [str(summary.get(key) or "") for key in required]
    for character in characters:
        if not isinstance(character, dict):
            raise ValueError("模型返回了无效角色项")
        if any(not str(character.get(key) or "").strip() for key in ("name", "roleType", "visualImage")):
            raise ValueError("模型返回的角色字段不完整")
        visible.extend(str(character.get(key) or "") for key in character)
    if has_language_violation(source, "\n".join(visible), strict=True):
        raise ValueError("模型输出语言与原始创意不一致")

async def run_script_summary(
    creative: str,
    episode_count: int | None = None,
    image_style_id: str | None = None,
    *,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> dict[str, Any]:
    # Build structured outline from creative brief
    trimmed = (creative or "").strip()
    if len(trimmed) < 10:
        raise ValueError("原始创意至少需要 10 个字")

    user_message = build_script_summary_user_message(
        trimmed,
        episode_count=episode_count,
        image_style_id=image_style_id,
    )
    data = await _chat_json(
        SCRIPT_SUMMARY_SYSTEM_PROMPT,
        user_message,
        max_tokens=2500,
        task="script_rewrite",
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    normalized = normalize_summary_dict(data, default_episode_count=episode_count or 24)
    try:
        validate_summary_output(normalized, trimmed)
    except ValueError as first_error:
        repair = await _chat_json(
            SCRIPT_SUMMARY_SYSTEM_PROMPT,
            user_message
            + "\n\n上一次返回不符合要求："
            + str(first_error)
            + "。请重新输出完整 JSON；必须包含 seriesTitle、storyType、oneLineStory、synopsis、characters，"
            + "每个角色必须有 name、roleType、visualImage、growthArc，并严格遵守原始创意语言。\n"
            + language_instruction(trimmed),
            max_tokens=2500,
            task="script_rewrite",
            db=db,
            user_id=user_id,
            skill_ids=skill_ids,
        )
        normalized = normalize_summary_dict(repair, default_episode_count=episode_count or 24)
        validate_summary_output(normalized, trimmed)
    if episode_count:
        normalized["episodeCount"] = episode_count
    return normalized


def resolve_episode_target(
    summary: dict[str, Any] | None,
    project_params: dict[str, Any] | None = None,
    script_params: dict[str, Any] | None = None,
) -> int:
    # 解析目标总集数：优先项目创建时的集数，其次摘要 / 剧本参数
    candidates = [
        (project_params or {}).get("episode_count"),
        (summary or {}).get("episodeCount"),
        (script_params or {}).get("episode_count"),
    ]
    for raw in candidates:
        try:
            value = int(raw)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if value >= 1:
            return value
    return 12


def merge_episode_bodies(
    existing: list[dict[str, Any]],
    batch: list[dict[str, Any]],
    prefer_incoming: bool = False,
) -> list[dict[str, Any]]:
    # 按集号合并；默认更长文本优先，prefer_incoming 时以后写入为准（空值回退保留旧值）
    by_number: dict[int, dict[str, Any]] = {}
    for item in existing + batch:
        if not isinstance(item, dict):
            continue
        try:
            number = int(item.get("episodeNumber") or item.get("episode_number") or 0)
        except (TypeError, ValueError):
            continue
        if number < 1:
            continue
        body = str(item.get("body") or item.get("content") or "")
        creative = str(item.get("creative") or "").strip()
        summary = str(item.get("summary") or item.get("synopsis") or "").strip()
        title = str(item.get("title") or "").strip() or f"第 {number} 集"
        prev = by_number.get(number)
        if prev:
            prev_body = str(prev.get("body") or "")
            prev_creative = str(prev.get("creative") or "").strip()
            prev_summary = str(prev.get("summary") or "").strip()
            if prefer_incoming:
                body = body if body.strip() else prev_body
                creative = creative or prev_creative
                summary = summary or prev_summary
            else:
                if len(prev_body.strip()) > len(body.strip()):
                    body = prev_body
                if len(prev_creative) > len(creative):
                    creative = prev_creative
                if len(prev_summary) > len(summary):
                    summary = prev_summary
                if not creative:
                    creative = prev_creative
                if not summary:
                    summary = prev_summary
            if title.startswith("第 ") and prev.get("title"):
                title = str(prev.get("title"))
            elif not title or title == f"第 {number} 集":
                title = str(prev.get("title") or title)
        new_origin = str(item.get("origin") or "").strip()
        prev_origin = str(prev.get("origin") or "").strip() if prev else ""
        origin = new_origin or prev_origin
        merged: dict[str, Any] = {
            "episodeNumber": number,
            "title": title,
            "body": body,
        }
        if creative:
            merged["creative"] = creative
        if summary:
            merged["summary"] = summary
        if origin == MANUAL_EPISODE_ORIGIN:
            merged["origin"] = MANUAL_EPISODE_ORIGIN
        by_number[number] = merged
    return [by_number[n] for n in sorted(by_number)]


def auto_missing_episode_numbers(existing: list[dict[str, Any]], total: int) -> list[int]:
    """自动流水线待填集号：跳过手动加集且正文未达标的空集。"""
    by_num: dict[int, dict[str, Any]] = {}
    for item in existing:
        if not isinstance(item, dict):
            continue
        try:
            number = int(item.get("episodeNumber") or 0)
        except (TypeError, ValueError):
            continue
        if number >= 1:
            by_num[number] = item
    missing: list[int] = []
    target = max(int(total or 0), 0)
    for number in range(1, target + 1):
        item = by_num.get(number)
        if item is None:
            missing.append(number)
            continue
        body = str(item.get("body") or item.get("content") or "")
        if _content_char_len(body) >= MIN_EPISODE_CONTENT_CHARS:
            continue
        if str(item.get("origin") or "") == MANUAL_EPISODE_ORIGIN:
            continue
        missing.append(number)
    return missing


def append_manual_episode(
    existing: list[dict[str, Any]],
    title: str | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """在已有分集后追加一集空的手动集，返回 (新列表, 新集号)。"""
    max_number = 0
    for item in existing:
        if not isinstance(item, dict):
            continue
        try:
            number = int(item.get("episodeNumber") or 0)
        except (TypeError, ValueError):
            continue
        if number > max_number:
            max_number = number
    next_number = max_number + 1
    if next_number < 1:
        next_number = 1
    if next_number > MAX_DRAMA_EPISODES:
        raise ValueError(f"最多 {MAX_DRAMA_EPISODES} 集")
    title_text = (title or "").strip() or f"第 {next_number} 集"
    added = {
        "episodeNumber": next_number,
        "title": title_text,
        "creative": "",
        "summary": "",
        "body": "",
        "origin": MANUAL_EPISODE_ORIGIN,
    }
    merged = merge_episode_bodies(existing, [added])
    return merged, next_number


def count_completed_episodes(episodes: list[dict[str, Any]], total: int) -> int:
    # 统计 1..total 中正文达到质量阈值的集数
    done = 0
    for item in episodes:
        try:
            number = int(item.get("episodeNumber") or 0)
        except (TypeError, ValueError):
            continue
        body = str(item.get("body") or "").strip()
        if 1 <= number <= total and _content_char_len(body) >= MIN_EPISODE_CONTENT_CHARS:
            done += 1
    return done


def _content_char_len(text: str) -> int:
    return len("".join((text or "").split()))


def normalize_series_title(raw: str | None) -> str:
    """清洗 AI 输出的剧名，去掉书名号/引号与过长尾巴。"""
    title = str(raw or "").strip()
    if not title:
        return ""
    title = title.strip("「」『』《》\"'“”‘’").strip()
    title = title.splitlines()[0].strip()
    # 截到合理项目名长度（中文短剧名）
    if len(title) > 24:
        title = title[:24].rstrip("，。；、…·-— ")
    return title


def pick_auto_project_title(
    summary: dict[str, Any],
    *,
    creative: str,
    current_title: str,
) -> str | None:
    """摘要完成后：优先用 AI 剧名覆盖「创意截断/过长」默认标题；用户已改名则不覆盖。"""
    series = normalize_series_title(
        summary.get("seriesTitle") or summary.get("title") or summary.get("projectTitle")
    )
    if not series:
        return None
    current = (current_title or "").strip()
    creative_prefix = (creative or "").strip()[:20]
    looks_default = (
        not current
        or current in {"未命名漫剧", "自由画布项目"}
        or len(current) > 36
        or (creative_prefix and current.startswith(creative_prefix))
        or current.endswith("…")
    )
    if not looks_default:
        return None
    return series


def format_summary_text(summary: dict[str, Any] | str) -> str:
    if isinstance(summary, str):
        return summary
    probe = f"{summary.get('seriesTitle', '')} {summary.get('oneLineStory', '')} {summary.get('synopsis', '')}"
    if detect_content_language(probe) == "th":
        lines = [
            f"ชื่อเรื่อง: {summary.get('seriesTitle', '')}",
            f"จำนวนตอน: {summary.get('episodeCount', '')}",
            f"แนวเรื่อง: {summary.get('storyType', '')}",
            f"กลุ่มเป้าหมาย: {summary.get('targetAudience', '')}",
            f"จุดขายหลัก: {summary.get('coreHook', '')}",
            f"เรื่องย่อหนึ่งบรรทัด: {summary.get('oneLineStory', '')}",
            "",
            "ตัวละคร:",
        ]
        for c in summary.get("characters") or []:
            if isinstance(c, dict):
                lines.append(
                    f"- {c.get('name', '')} ({c.get('roleType', '')}/{c.get('title', '')}): "
                    f"{c.get('visualImage', '')}; แท็ก: {c.get('coreTags', '')}; "
                    f"พัฒนาการ: {c.get('growthArc', '')}"
                )
        lines.extend(["", "เรื่องย่อ:", str(summary.get("synopsis") or "")])
        return "\n".join(lines)
    # Human-readable outline for UI / LLM context
    lines = [
        f"剧名：{summary.get('seriesTitle', '')}",
        f"集数：{summary.get('episodeCount', '')}",
        f"类型：{summary.get('storyType', '')}",
        f"受众：{summary.get('targetAudience', '')}",
        f"钩子：{summary.get('coreHook', '')}",
        f"一句话：{summary.get('oneLineStory', '')}",
        "",
        "人物：",
    ]
    for c in summary.get("characters") or []:
        if isinstance(c, dict):
            lines.append(
                f"- {c.get('name', '')}（{c.get('roleType', '')}/{c.get('title', '')}）："
                f"{c.get('visualImage', '')}；标签：{c.get('coreTags', '')}；"
                f"弧光：{c.get('growthArc', '')}"
            )
    lines.extend(["", "梗概：", str(summary.get("synopsis") or "")])
    return "\n".join(lines)


def _format_episode_title_list(episodes: list[dict[str, Any]]) -> str:
    rows: list[str] = []
    for item in sorted(episodes, key=lambda x: int(x.get("episodeNumber") or 0)):
        num = item.get("episodeNumber")
        title = item.get("title") or f"第 {num} 集"
        rows.append(f"第 {num} 集：{title}")
    return "\n".join(rows) if rows else "（暂无分集规划）"


def _format_existing_episode_content(episodes: list[dict[str, Any]], limit: int = 3, target_language_source: str = "") -> str:
    # 仅附最近若干集正文，控制上下文长度；过滤语言不一致的旧稿，防止污染后续生成
    target_lang = detect_content_language(target_language_source) if target_language_source else ""
    completed = []
    for item in episodes:
        if not isinstance(item, dict):
            continue
        body = str(item.get("body") or item.get("content") or "").strip()
        if not body:
            continue
        if target_lang == "th" and has_language_violation("เรื่องราวภาษาไทย", body):
            continue
        completed.append(item)
    completed.sort(key=lambda x: int(x.get("episodeNumber") or 0))
    if not completed:
        return "（暂无，本批次从开篇写起）"
    tail = completed[-limit:]
    blocks: list[str] = []
    for item in tail:
        num = item.get("episodeNumber")
        title = item.get("title") or f"第 {num} 集"
        body = str(item.get("body") or item.get("content") or "").strip()
        # 过长时截断尾部摘要，避免挤占当前集生成空间
        if len(body) > 1800:
            body = body[:1800] + "\n…（上文已截断）"
        blocks.append(f"{num}.{title}：\n{body}")
    return "\n\n".join(blocks)


def _titles_ready(existing: list[dict[str, Any]], total: int) -> bool:
    titled = {
        int(item.get("episodeNumber") or 0)
        for item in existing
        if isinstance(item, dict)
        and str(item.get("title") or "").strip()
        and not str(item.get("title") or "").startswith("第 ")
    }
    # 也接受「第 N 集」以外、或至少有 total 条带 title 的记录
    with_title = [
        item
        for item in existing
        if isinstance(item, dict)
        and 1 <= int(item.get("episodeNumber") or 0) <= total
        and str(item.get("title") or "").strip()
    ]
    if len(with_title) >= total:
        # 若全是占位「第 N 集」则仍需重跑大纲
        placeholder_only = all(
            str(item.get("title") or "").strip() in {f"第 {item.get('episodeNumber')} 集", f"第{item.get('episodeNumber')}集"}
            for item in with_title
        )
        return not placeholder_only
    return len(titled) >= total


async def run_episode_outline(
    creative: str,
    summary: dict[str, Any],
    episode_count: int,
    *,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    # 生成全集集名大纲
    summary_text = format_summary_text(summary)
    user = "\n".join(
        [
            language_instruction(creative or format_summary_text(summary)),
            f"总集数：{episode_count} 集（episodes 数组必须恰好 {episode_count} 项）",
            "",
            f"原始创意：\n{(creative or '').strip()}",
            "",
            f"剧本摘要：\n{summary_text}",
            "",
            "请输出全部分集的 episodeNumber 与 title。",
        ]
    )
    data = await _chat_json(
        EPISODE_OUTLINE_SYSTEM,
        user,
        max_tokens=4096,
        task="script_rewrite",
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    episodes = data.get("episodes") if isinstance(data, dict) else data
    if not isinstance(episodes, list) or not episodes:
        raise ValueError("分集大纲返回格式无效")
    result: list[dict[str, Any]] = []
    for i, item in enumerate(episodes):
        if not isinstance(item, dict):
            continue
        try:
            number = int(item.get("episodeNumber") or (i + 1))
        except (TypeError, ValueError):
            number = i + 1
        title = str(item.get("title") or "").strip() or f"第 {number} 集"
        result.append({"episodeNumber": number, "title": title, "body": ""})
    if len(result) < episode_count:
        # 补齐缺失集号
        have = {int(x["episodeNumber"]) for x in result}
        for n in range(1, episode_count + 1):
            if n not in have:
                result.append({"episodeNumber": n, "title": f"第 {n} 集", "body": ""})
    result.sort(key=lambda x: int(x["episodeNumber"]))
    return result[:episode_count]


async def ensure_episode_outline(
    creative: str,
    summary: dict[str, Any],
    existing: list[dict[str, Any]],
    total: int,
    *,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> tuple[list[dict[str, Any]], bool]:
    """返回 (合并后分集列表, 是否实际调用 LLM 生成大纲)。"""
    if _titles_ready(existing, total):
        return existing, False
    outline = await run_episode_outline(
        creative,
        summary,
        total,
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    return merge_episode_bodies(outline, existing), True


async def run_episode_script_batch(
    summary: dict[str, Any],
    existing: list[dict[str, Any]],
    batch_size: int = 1,
    total: int | None = None,
    creative: str = "",
    *,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    # 按缺失集号生成下一批正文（默认逐集）；手动空集不参与自动补写
    target = int(total or summary.get("episodeCount") or 12)
    missing = auto_missing_episode_numbers(existing, target)
    if not missing:
        return []
    start = missing[0]
    end = start
    for i in range(1, min(batch_size, len(missing))):
        if missing[i] != end + 1:
            break
        end = missing[i]

    title_by_num = {
        int(item.get("episodeNumber") or 0): str(item.get("title") or "")
        for item in existing
        if isinstance(item, dict)
    }
    batch_titles = "\n".join(
        f"第 {n} 集：{title_by_num.get(n) or f'第 {n} 集'}" for n in range(start, end + 1)
    )
    batch_size_n = end - start + 1
    summary_text = format_summary_text(summary)
    user = "\n".join(
        [
            language_instruction(creative or format_summary_text(summary)),
            f"当前任务：撰写第 {start} 集至第 {end} 集（共 {batch_size_n} 集）的完整剧本正文",
            f"全剧共 {target} 集",
            f"episodes 输出数组必须恰好 {batch_size_n} 项，episodeNumber 从 {start} 到 {end}",
            f"每集 content 约 {TARGET_EPISODE_CONTENT_CHARS} 个字符（不少于 {MIN_EPISODE_CONTENT_CHARS}），含 {EPISODE_SCENE_COUNT_HINT}、精简 △ 与台词",
            "",
            f"原始创意：\n{(creative or '').strip() or '（无额外创意，以摘要为准）'}",
            "",
            f"剧本摘要：\n{summary_text}",
            "",
            f"全剧分集规划：\n{_format_episode_title_list(existing)}",
            "",
            f"本批次待撰写：\n{batch_titles}",
            "",
            f"已有剧集正文：\n{_format_existing_episode_content(existing, target_language_source=creative or summary_text)}",
            "",
            f"请输出第 {start}–{end} 集各集的 content 字段（可附带 title）。",
        ]
    )

    try:
        sys_prompt = get_episode_batch_system_prompt(creative or summary_text)
        data = await _chat_json(
            sys_prompt,
            user,
            temperature=0.6,
            max_tokens=16384,
            task="script_rewrite",
            db=db,
            user_id=user_id,
            skill_ids=skill_ids,
        )
    except DramaLlmJsonError as exc:
        raw_resp = getattr(exc, "raw_content", "") or ""
        if "场" in raw_resp or "△" in raw_resp or "第" in raw_resp or "Scene" in raw_resp or "scene" in raw_resp:
            data = {"episodes": [{"episodeNumber": start, "title": title_by_num.get(start) or f"第 {start} 集", "content": raw_resp}]}
        else:
            raise

    episodes = data.get("episodes") if isinstance(data, dict) else data
    if not isinstance(episodes, list):
        raise ValueError("分集剧本返回格式无效")

    normalized = _normalize_batch_episodes(episodes, start, end, title_by_num)
    # 正文过短则带强调提示重试一次
    too_short = [
        item
        for item in normalized
        if _content_char_len(str(item.get("body") or "")) < MIN_EPISODE_CONTENT_CHARS
    ]
    language_bad = has_language_violation(creative or summary_text, "\n".join(str(item.get("body") or "") for item in normalized))
    if too_short or language_bad:
        retry_user = (
            user
            + "\n\n上次输出不符合要求。请重写本批次，每集 content 约 "
            + str(TARGET_EPISODE_CONTENT_CHARS)
            + f" 个字符（不少于 {MIN_EPISODE_CONTENT_CHARS}），含 {EPISODE_SCENE_COUNT_HINT}、精简 △ 与台词，不得压缩成梗概。\n"
            + language_instruction(creative or summary_text)
        )
        retry = await _chat_json(
            sys_prompt,
            retry_user,
            temperature=0.6,
            max_tokens=16384,
            task="script_rewrite",
            db=db,
            user_id=user_id,
            skill_ids=skill_ids,
        )
        retry_eps = retry.get("episodes") if isinstance(retry, dict) else retry
        if isinstance(retry_eps, list):
            normalized = _normalize_batch_episodes(retry_eps, start, end, title_by_num)

    if not normalized:
        raise ValueError(f"模型未返回第 {start}–{end} 集正文")
    _require_generated_language(normalized, creative or summary_text)
    _require_generated_episode_bodies(normalized)
    return normalized


async def run_episode_script_from_draft(
    summary: dict[str, Any],
    existing: list[dict[str, Any]],
    episode_number: int,
    draft: str,
    creative: str = "",
    character_asset_names: list[str] | None = None,
    *,
    db: AsyncSession | None = None,
    user_id: int | None = None,
    skill_ids: list[int] | None = None,
) -> list[dict[str, Any]]:
    """把用户草稿优化成指定集的拍摄正文。"""
    number = int(episode_number)
    draft_text = (draft or "").strip()
    if number < 1:
        raise ValueError("集号无效")
    if len(draft_text) < 20:
        raise ValueError("请先输入至少 20 字的分集剧本草稿")

    title_by_num = {
        int(item.get("episodeNumber") or 0): str(item.get("title") or "")
        for item in existing
        if isinstance(item, dict)
    }
    current_title = title_by_num.get(number) or f"第 {number} 集"
    ctx = build_single_episode_context(
        summary,
        existing,
        number,
        project_source=creative,
        character_asset_names=character_asset_names,
    )
    user = "\n\n".join(
        [
            f"当前任务：把用户草稿优化为第 {number} 集完整拍摄剧本",
            f"episodeNumber 必须为 {number}，episodes 数组必须恰好 1 项",
            f"当前集名：{current_title}（可按草稿核心事件微调 title）",
            f"每集 content 约 {TARGET_EPISODE_CONTENT_CHARS} 个字符（不少于 {MIN_EPISODE_CONTENT_CHARS}），含 {EPISODE_SCENE_COUNT_HINT}、精简 △ 与台词",
            *ctx,
            f"用户提供的第 {number} 集草稿：\n{draft_text}",
            f"请输出第 {number} 集的 title 与 content。",
        ]
    )
    sys_prompt = get_episode_optimize_system_prompt(creative or draft_text)
    data = await _chat_json(
        sys_prompt,
        user,
        temperature=0.55,
        max_tokens=16384,
        task="script_rewrite",
        db=db,
        user_id=user_id,
        skill_ids=skill_ids,
    )
    episodes = data.get("episodes") if isinstance(data, dict) else data
    if not isinstance(episodes, list):
        raise ValueError("分集剧本返回格式无效")
    normalized = _normalize_batch_episodes(episodes, number, number, title_by_num)
    too_short = [
        item
        for item in normalized
        if _content_char_len(str(item.get("body") or "")) < MIN_EPISODE_CONTENT_CHARS
    ]
    if too_short:
        retry_user = (
            user
            + "\n\n上次输出过短。请按用户草稿重写第 "
            + str(number)
            + " 集，content 约 "
            + str(TARGET_EPISODE_CONTENT_CHARS)
            + f" 个字符（不少于 {MIN_EPISODE_CONTENT_CHARS}），含 {EPISODE_SCENE_COUNT_HINT}、精简 △ 与台词。"
        )
        retry = await _chat_json(
            sys_prompt,
            retry_user,
            temperature=0.55,
            max_tokens=16384,
            task="script_rewrite",
            db=db,
            user_id=user_id,
            skill_ids=skill_ids,
        )
        retry_eps = retry.get("episodes") if isinstance(retry, dict) else retry
        if isinstance(retry_eps, list):
            normalized = _normalize_batch_episodes(retry_eps, number, number, title_by_num)
    if not normalized:
        raise ValueError(f"模型未返回第 {number} 集正文")
    _require_generated_episode_bodies(normalized)
    origin_item = next(
        (
            item
            for item in existing
            if isinstance(item, dict) and int(item.get("episodeNumber") or 0) == number
        ),
        None,
    )
    origin = str((origin_item or {}).get("origin") or "")
    if origin == MANUAL_EPISODE_ORIGIN:
        for item in normalized:
            item["origin"] = MANUAL_EPISODE_ORIGIN
    return normalized


def _normalize_batch_episodes(
    episodes: list[Any],
    start: int,
    end: int,
    title_by_num: dict[int, str],
) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for offset, item in enumerate(episodes):
        if not isinstance(item, dict):
            continue
        number = item.get("episodeNumber") or item.get("episode_number") or (start + offset)
        try:
            number_i = int(number)
        except (TypeError, ValueError):
            number_i = start + offset
        if number_i < start or number_i > end:
            continue
        body = str(item.get("content") or item.get("body") or "").strip()
        if not body:
            continue
        title = (
            str(item.get("title") or "").strip()
            or title_by_num.get(number_i)
            or f"第 {number_i} 集"
        )
        row: dict[str, Any] = {
            "episodeNumber": number_i,
            "title": title,
            "body": body,
        }
        creative = str(item.get("creative") or "").strip()
        summary = str(item.get("summary") or item.get("synopsis") or "").strip()
        if creative:
            row["creative"] = creative
        if summary:
            row["summary"] = summary
        normalized.append(row)
    return normalized
