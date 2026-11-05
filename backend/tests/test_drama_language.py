"""Drama output language and summary contract regression tests."""

import re
import unittest

from app.services.drama.agents import normalize_summary_dict, validate_summary_output
from app.services.drama.build_fragments import build_fragments_from_episode_body
from app.services.drama.build_seedance_generate_body import build_seedance_prompt_text
from app.services.drama.fragment_dialogue import dialogue_coverage_insufficient
from app.services.drama.language import has_language_violation, language_instruction
from app.services.drama.seed import _extract_scene_names_from_bodies


class TestDramaLanguage(unittest.TestCase):
    def test_thai_instruction_preserves_screenplay_markers(self):
        instruction = language_instruction("เรื่องราวของคลินิกสัตว์และตัวละครหลัก")
        self.assertIn("泰语", instruction)

    def test_thai_screenplay_markers_are_not_treated_as_language_switch(self):
        body = "### 场1-1\n出场人物：อีมินแจ\n△ อีมินแจเปิดประตู\nอีมินแจ：สวัสดี"
        self.assertFalse(has_language_violation("เรื่องราวภาษาไทย", body))

    def test_thai_body_with_chinese_dialogue_is_rejected(self):
        body = "### 场1-1\n出场人物：อีมินแจ\n△ อีมินแจเปิดประตู\nอีมินแจ：这是中文对白，不能保存。"
        self.assertTrue(has_language_violation("เรื่องราวภาษาไทย", body))

    def test_summary_normalizes_protagonists_alias(self):
        summary = normalize_summary_dict(
            {
                "title": "คลินิกสัตว์",
                "genre": "แฟนตาซี",
                "protagonists": [{"name": "อีมินแจ", "role": "พระเอก", "appearance": "ชายหนุ่ม"}],
                "synopsis": "เรื่องราวภาษาไทย",
            },
            default_episode_count=24,
        )
        self.assertEqual(summary["seriesTitle"], "คลินิกสัตว์")
        self.assertEqual(summary["storyType"], "แฟนตาซี")
        self.assertEqual(summary["characters"][0]["name"], "อีมินแจ")

    def test_summary_validation_rejects_incomplete_characters(self):
        summary = normalize_summary_dict(
            {"seriesTitle": "คลินิก", "storyType": "แฟนตาซี", "oneLineStory": "เรื่อง", "synopsis": "เรื่องยาว", "characters": [{"name": "อีมินแจ"}]}
        )
        with self.assertRaises(ValueError):
            validate_summary_output(summary, "เรื่องราวภาษาไทย")

    def test_thai_scene_extraction_and_fragment_pipeline_has_no_chinese(self):
        ep_body = (
            "### ฉาก1-1 บ้านยายคยองซุก/กลางคืน/ภายใน\n"
            "ตัวละครที่ออกฉาก：อีมินแจ、ยายคยองซุก\n"
            "△ ห้องนอนเล็กๆ มีแสงตะเกียงสลัว ยายคยองซุกนอนอยู่บนเตียง\n"
            "อีมินแจ (น้ำเสียงสั่นเครือ)：ยายครับ ผมจะรักษาทุกคนเอง\n"
        )
        scenes = _extract_scene_names_from_bodies([ep_body])
        self.assertEqual(scenes, ["บ้านยายคยองซุก"])
        self.assertFalse(
            dialogue_coverage_insufficient(
                ep_body,
                [{"content": "@duration:5\n【บทพูด·พูดชัดจังหวะพอดี】อีมินแจ：ยายครับ ผมจะรักษาทุกคนเอง"}],
            )
        )
        frags = build_fragments_from_episode_body(ep_body, [])
        self.assertTrue(len(frags) >= 1)
        frag_text = frags[0]["content"]
        self.assertIsNone(re.search(r"[\u4e00-\u9fff]", frag_text))
        seedance_prompt = build_seedance_prompt_text(
            frag_text,
            [],
            video_style_id="ancient-romance-soft",
        )
        self.assertIsNone(re.search(r"[\u4e00-\u9fff]", seedance_prompt))


if __name__ == "__main__":
    unittest.main()
