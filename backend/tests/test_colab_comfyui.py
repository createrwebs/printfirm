from __future__ import annotations

import pytest

from app.services.colab_comfyui import build_h3_prompt, poll_comfyui_job, validate_comfyui_url


class _Response:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = ""

    def json(self):
        return self._payload


class _Client:
    def __init__(self, response: _Response):
        self.response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def get(self, url: str):
        return self.response

    async def post(self, url: str, **kwargs):
        self.posted = kwargs
        return self.response


@pytest.mark.asyncio
async def test_poll_comfyui_accepts_savevideo_images_output(monkeypatch):
    from app.services import colab_comfyui

    response = _Response(
        200,
        {
            "prompt-1": {
                "status": {"status_str": "success", "completed": True},
                "outputs": {
                    "16": {
                        "images": [
                            {"filename": "x.mp4", "subfolder": "h3_colab", "type": "output"}
                        ]
                    }
                },
            }
        },
    )
    monkeypatch.setattr(colab_comfyui.httpx, "AsyncClient", lambda **_: _Client(response))
    result = await poll_comfyui_job("https://colab.example", "prompt-1")
    assert result["status"] == "succeeded"
    assert result["filename"] == "x.mp4"


@pytest.mark.asyncio
async def test_poll_comfyui_marks_missing_history_for_bounded_retry(monkeypatch):
    from app.services import colab_comfyui

    monkeypatch.setattr(
        colab_comfyui.httpx,
        "AsyncClient",
        lambda **_: _Client(_Response(404, {})),
    )
    result = await poll_comfyui_job("https://colab.example", "missing")
    assert result == {"status": "running", "history_missing": True}


@pytest.mark.asyncio
async def test_poll_comfyui_keeps_queued_prompt_pending(monkeypatch):
    from app.services import colab_comfyui

    monkeypatch.setattr(
        colab_comfyui.httpx,
        "AsyncClient",
        lambda **_: _Client(_Response(200, {})),
    )
    result = await poll_comfyui_job("https://colab.example", "queued")
    assert result == {"status": "running", "history_pending": True}


def test_build_h3_prompt_keeps_dialogue_argument():
    text = build_h3_prompt("เด็กชายยิ้ม", dialogue="สวัสดี", duration=8)
    assert "saying:" in text
    assert "สวัสดี" in text


def test_validate_comfyui_url_allows_tunnel_and_loopback_but_blocks_private_network():
    assert validate_comfyui_url("https://example.trycloudflare.com/") == "https://example.trycloudflare.com"
    assert validate_comfyui_url("http://127.0.0.1:8188/") == "http://127.0.0.1:8188"
    with pytest.raises(ValueError):
        validate_comfyui_url("http://192.168.1.10:8188")


@pytest.mark.asyncio
async def test_submit_h3_wires_reference_and_prompt_into_workflow(monkeypatch):
    from app.services import colab_comfyui

    client = _Client(_Response(200, {"prompt_id": "p-1"}))
    template = {
        "5": {"inputs": {"image": "old.png"}},
        "7": {"inputs": {"prompt": "old", "ref_images.ref_image_0": ["5", 0]}},
        "54": {"inputs": {"seed": 1}},
        "56": {"inputs": {"value": 10}},
        "61": {"inputs": {"megapixels": 0.4}},
    }
    monkeypatch.setattr(colab_comfyui, "load_h3_workflow_template", lambda: template)
    monkeypatch.setattr(colab_comfyui.httpx, "AsyncClient", lambda **_: client)

    prompt_id = await colab_comfyui.submit_h3_video_job(
        "https://colab.example",
        prompt="subject_definitions: <Subject 1>",
        image_filenames=["ref_1.png"],
        duration_sec=8,
        seed=7,
    )

    payload = client.posted["json"]["prompt"]
    assert prompt_id == "p-1"
    assert payload["5"]["inputs"]["image"] == "ref_1.png"
    assert payload["7"]["inputs"]["prompt"] == "subject_definitions: <Subject 1>"
    assert payload["7"]["inputs"]["ref_images.ref_image_0"] == ["5", 0]


@pytest.mark.asyncio
async def test_submit_wan2_simple_sends_single_image_with_core_nodes(monkeypatch):
    from app.services import colab_comfyui

    client = _Client(_Response(200, {"prompt_id": "wan-p-1"}))
    monkeypatch.setattr(colab_comfyui.httpx, "AsyncClient", lambda **_: client)

    pid = await colab_comfyui.submit_wan2_video_job(
        "https://colab.example",
        prompt="เดินเข้ามาในห้อง",
        image_filenames=["char1.png", "scene1.png"],
        duration_sec=5,
        seed=456,
        aspect_ratio="9:16",
    )
    assert pid == "wan-p-1"
    wf = client.posted["json"]["prompt"]
    assert wf["8"]["inputs"]["image"] == "char1.png"  # first ref is the start image
    assert wf["10"]["class_type"] == "WanImageToVideo"
    assert (wf["10"]["inputs"]["width"], wf["10"]["inputs"]["height"]) == (480, 832)
    assert wf["10"]["inputs"]["length"] == 81
    assert wf["5"]["inputs"]["vae_name"] == "wan_2.1_vae.safetensors"
    assert wf["14"]["class_type"] == "SaveVideo"
    assert sum(n["class_type"] == "UNETLoader" for n in wf.values()) == 1  # single model
    # every referenced node id exists
    for node in wf.values():
        for v in node["inputs"].values():
            if isinstance(v, list):
                assert v[0] in wf

    # explicit first frame wins over refs
    await colab_comfyui.submit_wan2_video_job(
        "https://colab.example", prompt="x", image_filenames=["char1.png"], first_frame_filename="first.png", seed=1
    )
    assert client.posted["json"]["prompt"]["8"]["inputs"]["image"] == "first.png"


@pytest.mark.asyncio
async def test_submit_wan2_auto_selects_dual_expert_when_high_noise_present(monkeypatch):
    from app.services import colab_comfyui

    class _ProbeClient:
        def __init__(self):
            self.posted = None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, url: str):
            if "object_info/UNETLoader" in url:
                return _Response(200, {
                    "UNETLoader": {
                        "input": {
                            "required": {
                                "unet_name": [[
                                    "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
                                    "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
                                ]]
                            }
                        }
                    }
                })
            return _Response(404, {})

        async def post(self, url: str, **kwargs):
            self.posted = kwargs
            return _Response(200, {"prompt_id": "dual-p-1"})

    probe_client = _ProbeClient()
    monkeypatch.setattr(colab_comfyui.httpx, "AsyncClient", lambda **_: probe_client)

    pid = await colab_comfyui.submit_wan2_video_job(
        "https://colab.example",
        prompt="dragon warrior stands still",
        image_filenames=["dragon.png"],
        duration_sec=5,
        seed=100,
        aspect_ratio="1:1",
    )
    assert pid == "dual-p-1"
    wf = probe_client.posted["json"]["prompt"]
    # Verify exact match with ComfyUI Hub official nodes
    assert sum(n["class_type"] == "UNETLoader" for n in wf.values()) == 2
    assert sum(n["class_type"] == "KSamplerAdvanced" for n in wf.values()) == 2
    assert wf["95"]["inputs"]["unet_name"] == "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors"
    assert wf["96"]["inputs"]["unet_name"] == "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"
    assert wf["108"]["class_type"] == "SaveVideo"
    assert wf["94"]["class_type"] == "CreateVideo"
    assert wf["86"]["inputs"]["end_at_step"] == 2
    assert wf["85"]["inputs"]["start_at_step"] == 2
    assert wf["85"]["inputs"]["latent_image"] == ["86", 0]
    # Check all node link integrity
    for node in wf.values():
        for v in node["inputs"].values():
            if isinstance(v, list):
                assert v[0] in wf


def test_build_wan2_motion_prompt_strips_turnaround_sheet_poison_and_dialogue_tags():
    from app.services.colab_comfyui import build_wan2_motion_prompt

    raw = "【บทพูด·พูดชัดจังหวะพอดี·ซิงค์คำบรรยาย】: (เสียงแผ่ว) มินแจ...ลูกกุญแจนี้..."
    refs = [
        "ยายคยองซุก (character): หญิงชรา",
        "บ้านยายคยองซุก (scene): 【คำสั่งบังคับ: แผ่นออกแบบฉาก】ให้พื้นที่และโครงสร้างอาคารเป็นตัวหลักในภาพเดียว แสดงมุมมองด้านบน ห้ามให้ตัวละครเป็นจุดสนใจ",
    ]
    out = build_wan2_motion_prompt(raw, ref_descriptions=refs)
    assert "แผ่นออกแบบฉาก" not in out
    assert "ห้ามให้ตัวละครเป็นจุดสนใจ" not in out
    assert "【บทพูด" not in out
    assert "speaking with natural emotional facial expressions" in out
    assert "บ้านยายคยองซุก (scene)" in out


def test_build_wan2_official_dual_workflow_uses_first_last_frame_node_when_end_image_given():
    from app.services.colab_comfyui import build_wan2_official_dual_workflow

    wf = build_wan2_official_dual_workflow(
        motion_prompt="smooth camera pan",
        image_filename="start.png",
        last_frame_filename="end.png",
        width=480,
        height=832,
        frames=81,
        seed=42,
    )
    assert wf["98"]["class_type"] == "WanFirstLastFrameToVideo"
    assert wf["98"]["inputs"]["start_image"] == ["99", 0]
    assert wf["98"]["inputs"]["end_image"] == ["111", 0]
    assert wf["110"]["inputs"]["image"] == "end.png"
    for node in wf.values():
        for v in node["inputs"].values():
            if isinstance(v, list):
                assert v[0] in wf


def test_build_h3_prompt_produces_six_drama_sections_and_strips_sheet_poison():
    out = build_h3_prompt(
        "มินแจเดินเข้าไปหายายคยองซุกแล้วถามด้วยความกังวล",
        characters=[
            {"name": "มินแจ", "desc": "ชายหนุ่ม 【แผ่นออกแบบสามวิว】", "tag": "<Picture 1>"},
            {"name": "ยายคยองซุก", "desc": "หญิงชรา", "tag": "<Picture 2>"},
        ],
        scene_ref={"name": "บ้านยายคยองซุก: ห้ามให้ตัวละครเป็นจุดสนใจ", "tag": "<Picture 3>"},
        has_first_frame=True,
        first_frame_tag="<Picture 4>",
        has_last_frame=True,
        last_frame_tag="<Picture 5>",
    )
    for section in (
        "subject_definitions:",
        "summary:",
        "retention_analysis:",
        "detailed_description:",
        "overall_soundscape:",
        "non_diegetic_music:",
    ):
        assert section in out
    assert "[keyframe completion + reference generation]" in out
    assert "<Picture 4> is the first frame of [Shot 1]." in out
    assert "<Picture 5> is the last frame of [Shot 1]." in out
    assert "แผ่นออกแบบสามวิว" not in out
    assert "ห้ามให้ตัวละครเป็นจุดสนใจ" not in out


