import pytest
from app.services.drama.build_fragments import (
    CAST_LINE_RE,
    parse_cast_names,
    extract_scene_meta,
    split_episode_content_into_scenes,
)

def test_markdown_cast_line_matching():
    lines = [
        "**ตัวละครที่ออกฉาก:** โตบี้, แม่",
        "**ตัวละครที่ออกฉาก**: โตบี้, บาร์นาบี้",
        "*ตัวละครที่ออกฉาก:* โตบี้",
        "**Characters:** Alice, Bob",
        "出场人物：张三、李四",
    ]
    for l in lines:
        m = CAST_LINE_RE.match(l)
        assert m is not None, f"Failed to match cast line: {l}"
        names = parse_cast_names(m.group(1))
        assert len(names) >= 1
        assert not any(n.startswith("*") or n.endswith("*") for n in names)

def test_summary_line_stopping():
    content = """### ฉาก 1-1: ห้องครัวสาขาฉาก ⛅ เช้า

**ตัวละครที่ออกฉาก:** โตบี้, แม่

ห้องครัวอบอุ่นแสงสีทอง โตบี้ ยกเตาอบ

**สรุปเนื้อหา:** โตบี้ตกลงไปในโลกจักรกลเวทมนตร์เอเวอร์โกรฟ..."""
    scenes = split_episode_content_into_scenes(content)
    assert len(scenes) == 1
    assert "สรุปเนื้อหา" not in scenes[0]["body"]
