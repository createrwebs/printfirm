"""Role-specific Agent Skill routing for drama generation."""

import pytest


@pytest.mark.asyncio
async def test_prop_extraction_routes_through_extractor_skill(monkeypatch):
    from app.services.drama import extract_props_materials as module

    captured = {}

    async def fake_run_task_json(db, user_id, **kwargs):
        captured.update(kwargs)
        return {"props": [{"name": "ตราประทับ", "visualPrompt": "ตราประทับทองแดงเก่า"}]}

    monkeypatch.setattr(module, "run_task_json", fake_run_task_json)
    result = await module.extract_props_materials(
        summary={"synopsis": "เรื่องภาษาไทย"},
        episode_bodies=["เนื้อเรื่องภาษาไทย"],
        source="เรื่องภาษาไทยที่ยาวพอสำหรับตรวจภาษา",
        db=object(),
        user_id=9,
    )
    assert result["props"][0]["name"] == "ตราประทับ"
    assert captured["task"] == "extract_assets"
    assert captured["user"].startswith("ข้อกำหนดภาษา")
