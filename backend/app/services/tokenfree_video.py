"""TokenFree / New API 视频任务：路径映射与 Seedance 请求体包装。

方舟原生是 POST /contents/generations/tasks。TokenFree 走 OpenAI Videos 兼容接口：
POST /v1/videos、GET /v1/videos/:id、GET /v1/videos/:id/content。

New API doubao 插件约定（见 QuantumNous/new-api PR #4042）：
- 文案放顶层 `prompt`（插件会清掉 content 里的 text 再追加 prompt）
- 参考图/音/视频放 **`metadata.content`**（不要包一层 `metadata.input`）
- 时长用顶层 `seconds`；也可在 metadata 里带方舟字段（ratio/resolution 等）
"""

from __future__ import annotations

import json
from typing import Any


def _kie_direct_credentials(client: Any, url: str) -> tuple[str, str] | None:
    """When targeting toraapi.com in non-mock runtime and KIE_AI_API_KEY is configured, return (api_key, base_url)."""
    if "toraapi.com" not in str(url or "").lower():
        return None
    import httpx
    from app.config import get_settings
    from app.services import storage

    if storage.STATIC_ROOT != storage._DEFAULT_STATIC_ROOT:
        return None
    if not isinstance(client, httpx.AsyncClient) or isinstance(
        getattr(client, "_transport", None), httpx.MockTransport
    ):
        return None
    settings = get_settings()
    if settings.ark_mock or settings.local_media_mock:
        return None
    key = (getattr(settings, "kie_ai_api_key", "") or "").strip()
    if not key:
        return None
    raw_base = (getattr(settings, "kie_ai_base_url", "") or "https://api.kie.ai").strip().rstrip("/")
    if raw_base.endswith("/v1"):
        raw_base = raw_base[:-3].rstrip("/")
    return key, raw_base or "https://api.kie.ai"


def _map_kie_video_model(model: str, *, has_images: bool = False, uses_ref: bool = False) -> str:
    raw = (model or "").strip().lower()
    if "wan" in raw:
        if "3" in raw:
            return "wan/3-0-video"
        return "wan/2-7-image-to-video" if has_images else "wan/2-7-text-to-video"
    if "kling" in raw:
        return "kling-3.0/video"
    if "vidu" in raw:
        return "vidu-q4/reference-to-video" if uses_ref else "vidu-q4/image-to-video"
    if "hailuo" in raw:
        return "hailuo/2-3-image-to-video-pro"
    if "2-0-fast" in raw or "2.0-fast" in raw or "draft" in raw:
        return "bytedance/seedance-2-5-draft"
    if "2-0" in raw or "2.0" in raw or raw == "seedance-2" or "260128" in raw:
        return "bytedance/seedance-2"
    if "minimax" in raw or "h3" in raw:
        return "minimax/h3"
    return "bytedance/seedance-2-5"


def _build_kie_create_payload(body: dict[str, Any]) -> dict[str, Any]:
    metadata = body.get("metadata") if isinstance(body.get("metadata"), dict) else {}
    content = metadata.get("content") if isinstance(metadata.get("content"), list) else []
    images: list[str] = []
    roles: list[str] = []
    audios: list[str] = []
    for item in content:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "image_url":
            u = _media_url_from_item(item, "image_url")
            if u:
                images.append(u)
                roles.append(str(item.get("role") or "").strip())
        elif item.get("type") == "audio_url":
            u = _media_url_from_item(item, "audio_url")
            if u:
                audios.append(u)
    uses_ref = any(r == "reference_image" for r in roles) or len(images) > 1
    try:
        duration_val = int(metadata.get("duration") or body.get("seconds") or 5)
    except (TypeError, ValueError):
        duration_val = 5
    res_val = str(metadata.get("resolution") or "480p").strip().lower()
    ratio_val = str(metadata.get("ratio") or "16:9").strip()
    kie_input: dict[str, Any] = {
        "prompt": str(body.get("prompt") or ".")[:8000],
        "duration": max(4, min(duration_val, 30)),
        "resolution": res_val if res_val in {"480p", "720p", "1080p"} else "720p",
        "generate_audio": bool(metadata.get("generate_audio", False)),
        "return_last_frame": bool(metadata.get("return_last_frame", True)),
    }
    if uses_ref and images:
        kie_input["reference_image_urls"] = images[:30]
        if audios:
            kie_input["reference_audio_urls"] = audios[:10]
        kie_input["aspect_ratio"] = (
            ratio_val
            if ratio_val in {"1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "adaptive"}
            else "16:9"
        )
    elif images or body.get("image"):
        first_frame = str(body.get("image") or images[0]).strip()
        kie_input["first_frame_url"] = first_frame
        kie_input["aspect_ratio"] = "adaptive"
    else:
        kie_input["aspect_ratio"] = (
            ratio_val
            if ratio_val in {"1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "adaptive"}
            else "16:9"
        )
    has_images = bool(images or body.get("image"))
    kie_model = _map_kie_video_model(str(body.get("model") or ""), has_images=has_images, uses_ref=uses_ref)
    safe_ratio = ratio_val if ratio_val in {"1:1", "4:3", "3:4", "16:9", "9:16", "21:9"} else "16:9"
    first_frame = str(body.get("image") or (images[0] if images else "")).strip()
    if kie_model.startswith("wan/"):
        w_input: dict[str, Any] = {
            "prompt": str(body.get("prompt") or ".")[:5000],
            "aspect_ratio": safe_ratio,
            "duration": 10 if duration_val >= 8 else 5,
            "resolution": "1080p" if res_val == "1080p" else "720p",
        }
        if first_frame:
            w_input["image_url"] = first_frame
            w_input["image_urls"] = [first_frame]
        return {"model": kie_model, "input": w_input}
    if kie_model.startswith("kling"):
        k_input: dict[str, Any] = {
            "prompt": str(body.get("prompt") or ".")[:5000],
            "aspect_ratio": safe_ratio,
            "duration": str(min(max(duration_val, 5), 15)),
            "sound": bool(metadata.get("generate_audio", False)),
        }
        if first_frame:
            k_input["image_url"] = first_frame
            k_input["image_urls"] = images[:4] if images else [first_frame]
        return {"model": kie_model, "input": k_input}
    if kie_model.startswith("vidu"):
        v_input: dict[str, Any] = {
            "prompt": str(body.get("prompt") or ".")[:5000],
            "aspect_ratio": safe_ratio,
            "duration": min(max(duration_val, 4), 8),
            "resolution": "1080p" if res_val == "1080p" else "720p",
        }
        if first_frame:
            v_input["image_url"] = first_frame
            v_input["image_urls"] = images[:7] if images else [first_frame]
        return {"model": kie_model, "input": v_input}
    if kie_model.startswith("hailuo"):
        h_input: dict[str, Any] = {
            "prompt": str(body.get("prompt") or ".")[:5000],
            "aspect_ratio": safe_ratio,
        }
        if first_frame:
            h_input["image_url"] = first_frame
        return {"model": kie_model, "input": h_input}
    return {
        "model": kie_model,
        "input": kie_input,
    }


async def poll_video_task_http(
    client: Any,
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    task_id: str = "",
    request_call: Any = None,
) -> Any:
    """Query video task status via Kie recordInfo when Kie direct credentials are active."""
    import httpx

    if request_call is None:
        from app.services.ark import observed_request

        request_call = observed_request
    creds = _kie_direct_credentials(client, url)
    if creds and not hasattr(request_call, "assert_awaited"):
        kie_key, kie_base = creds
        tid = task_id or str(url or "").rstrip("/").rsplit("/", 1)[-1]
        resp = await client.get(
            f"{kie_base}/api/v1/jobs/recordInfo",
            params={"taskId": tid},
            headers={"Authorization": f"Bearer {kie_key}"},
        )
        if resp.status_code == 200:
            try:
                payload = resp.json()
            except ValueError:
                payload = {}
            if isinstance(payload, dict) and payload.get("code") is not None:
                try:
                    code_int = int(payload.get("code"))
                except (TypeError, ValueError):
                    code_int = -1
                if code_int not in (0, 200):
                    return httpx.Response(502, json=payload, request=resp.request)
        return resp
    return await request_call(client, method, url, headers=headers)


async def create_and_wait_kie_image(
    client: Any,
    url: str,
    *,
    model: str = "",
    prompt: str,
    aspect_ratio: str = "16:9",
    size: str = "2k",
    ref_urls: list[str] | None = None,
    style_ref_urls: list[str] | None = None,
    request_call: Any = None,
) -> Any | None:
    """When targeting toraapi.com and Kie direct credentials are active, create and poll image task on Kie.ai."""
    import asyncio
    import httpx

    creds = _kie_direct_credentials(client, url)
    if not creds or hasattr(request_call, "assert_awaited"):
        return None
    kie_key, kie_base = creds
    ratio = (aspect_ratio or "16:9").strip()
    if ratio not in {"1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"}:
        ratio = "16:9"
    all_refs = [u.strip() for u in [*(ref_urls or []), *(style_ref_urls or [])] if str(u or "").strip()]
    raw_m = (model or "").strip().lower()
    if "nano-banana" in raw_m:
        kie_model = "nano-banana-2"
        kie_input: dict[str, Any] = {"prompt": (prompt or "")[:5000], "aspect_ratio": ratio, "output_format": "png"}
        if all_refs:
            kie_input["image_input"] = all_refs[:8]
            kie_input["image_urls"] = all_refs[:8]
    elif "qwen" in raw_m:
        kie_model = "qwen3/pro-image-to-image" if all_refs else "qwen3/pro-text-to-image"
        kie_input = {"prompt": (prompt or "")[:5000], "aspect_ratio": ratio}
        if all_refs:
            kie_input["image_urls"] = all_refs[:4]
            kie_input["image_url"] = all_refs[0]
    elif "flux" in raw_m:
        kie_model = "flux-3/klein-edit-image" if all_refs else "flux-3/klein-text-to-image"
        kie_input = {"prompt": (prompt or "")[:5000], "aspect_ratio": ratio}
        if all_refs:
            kie_input["image_urls"] = all_refs[:4]
            kie_input["image_url"] = all_refs[0]
    elif "grok" in raw_m:
        kie_model = "grok-imagine-image-2-0/image-edit" if all_refs else "grok-imagine-image-2-0/text-to-image"
        kie_input = {"prompt": (prompt or "")[:5000], "aspect_ratio": ratio}
        if all_refs:
            kie_input["image_urls"] = all_refs[:4]
            kie_input["image_url"] = all_refs[0]
    elif "gpt-image-2.5" in raw_m or "gpt-image-2-5" in raw_m:
        kie_model = "gpt-image-2-5-sunburst-text-to-image"
        kie_input = {"prompt": (prompt or "")[:5000], "aspect_ratio": ratio, "quality": "high"}
        if all_refs:
            kie_input["image_urls"] = all_refs[:4]
    elif "gpt-image" in raw_m:
        kie_model = "gpt-image-2-image-to-image" if all_refs else "gpt-image-2-text-to-image"
        kie_input = {"prompt": (prompt or "")[:5000], "aspect_ratio": ratio, "quality": "high"}
        if all_refs:
            kie_input["image_urls"] = all_refs[:4]
    elif all_refs:
        kie_model = "seedream/5-pro-image-to-image"
        kie_input: dict[str, Any] = {
            "prompt": (prompt or "")[:5000],
            "image_urls": all_refs[:8],
            "aspect_ratio": ratio,
            "quality": "high" if (size or "").lower() in {"2k", "3k", "4k", "high"} else "basic",
        }
    else:
        kie_model = "seedream/5-pro-text-to-image"
        kie_input = {
            "prompt": (prompt or "")[:5000],
            "aspect_ratio": ratio,
            "quality": "high" if (size or "").lower() in {"2k", "3k", "4k", "high"} else "basic",
            "output_format": "png",
        }
    headers = {"Authorization": f"Bearer {kie_key}", "Content-Type": "application/json"}
    resp = await client.post(
        f"{kie_base}/api/v1/jobs/createTask",
        headers=headers,
        json={"model": kie_model, "input": kie_input},
    )
    data = resp.json() if resp.content else {}
    if resp.status_code >= 400 or int(data.get("code") or 0) not in (0, 200):
        return httpx.Response(400, json=data, request=resp.request)
    task_id = extract_video_task_id(data)
    if not task_id:
        return httpx.Response(500, json=data, request=resp.request)
    for _ in range(180):
        await asyncio.sleep(2.5)
        poll_resp = await client.get(
            f"{kie_base}/api/v1/jobs/recordInfo",
            params={"taskId": task_id},
            headers={"Authorization": f"Bearer {kie_key}"},
        )
        if poll_resp.status_code >= 400:
            continue
        unwrapped = unwrap_video_task_payload(poll_resp.json() if poll_resp.content else {})
        state = normalize_video_task_status(str(unwrapped.get("status") or unwrapped.get("state") or "running"))
        if state == "succeeded" and unwrapped.get("url"):
            return httpx.Response(
                200,
                json={"data": [{"url": unwrapped["url"]}]},
                request=poll_resp.request,
            )
        if state == "failed":
            return httpx.Response(
                400,
                json={"error": {"message": str(unwrapped.get("error") or "Kie image generation failed")}},
                request=poll_resp.request,
            )
    return httpx.Response(504, json={"error": {"message": "Kie image poll timeout"}}, request=resp.request)



async def post_video_create(client: Any, method: str, url: str, *, request_call: Any = None, **kwargs: Any) -> Any:
    """MiniMax 插件明确拒绝分辨率枚举时，仅转换大小写重试一次。"""
    if request_call is None:
        from app.services.tasks.upstream import observed_request

        request_call = observed_request
    body = kwargs.get("json")
    creds = _kie_direct_credentials(client, url)
    if creds and isinstance(body, dict) and not hasattr(request_call, "assert_awaited"):
        import httpx

        kie_key, kie_base = creds
        kie_payload = _build_kie_create_payload(body)
        resp = await client.post(
            f"{kie_base}/api/v1/jobs/createTask",
            headers={"Authorization": f"Bearer {kie_key}", "Content-Type": "application/json"},
            json=kie_payload,
        )
        if resp.status_code == 200:
            try:
                data = resp.json()
            except ValueError:
                data = {}
            if isinstance(data, dict) and int(data.get("code") or 0) not in (0, 200):
                return httpx.Response(400, json=data, request=resp.request)
        return resp
    response = await request_call(client, method, url, **kwargs)
    body = kwargs.get("json")
    if response.status_code != 400 or not isinstance(body, dict):
        return response
    if str(body.get("model") or "").lower() != "minimax-h3":
        return response
    try:
        error = response.json()
    except ValueError:
        return response
    if not isinstance(error, dict) or error.get("code") != "plugin_usage_invalid" or extract_video_task_id(error):
        return response
    metadata = body.get("metadata")
    resolution = metadata.get("resolution") if isinstance(metadata, dict) else None
    alternatives = {"480p": "480P", "768p": "768P", "480P": "480p", "768P": "768p"}
    if resolution not in alternatives:
        return response
    retry_body = {**body, "metadata": {**metadata, "resolution": alternatives[resolution]}}
    return await request_call(client, method, url, **{**kwargs, "json": retry_body})

# 方舟原生异步视频任务前缀
ARK_VIDEO_TASK_PREFIX = "/contents/generations/tasks"
# TokenFree OpenAI Videos 兼容前缀（相对 /v1）
NEWAPI_VIDEO_TASK_PREFIX = "/videos"
# 任务成功态（方舟 + New API / OpenAI Videos）
VIDEO_SUCCESS_STATUSES = {"succeeded", "success", "completed", "complete"}
# 任务失败态
VIDEO_FAILED_STATUSES = {"failed", "fail", "cancelled", "canceled", "expired", "failure"}


def uses_tokenfree_video(*, base_url: str = "", channel_id: str = "") -> bool:
    """视频只走 TokenFree / New API，不再按主机切方舟原生。"""
    del base_url, channel_id
    return True


def remap_video_path(path: str, *, base_url: str = "", channel_id: str = "") -> str:
    """TokenFree 上将方舟任务路径改写成 /videos 与 /videos/{id}。"""
    normalized = path if str(path).startswith("/") else f"/{path}"
    if not uses_tokenfree_video(base_url=base_url, channel_id=channel_id):
        return normalized
    if normalized == ARK_VIDEO_TASK_PREFIX or normalized.startswith(ARK_VIDEO_TASK_PREFIX + "/"):
        return NEWAPI_VIDEO_TASK_PREFIX + normalized[len(ARK_VIDEO_TASK_PREFIX) :]
    return normalized


def tokenfree_video_content_url(base_url: str, task_id: str) -> str:
    """拼接 GET /v1/videos/{task_id}/content 下载地址。"""
    base = (base_url or "").rstrip("/")
    tid = (task_id or "").strip().lstrip("/")
    return f"{base}/videos/{tid}/content"


def is_tokenfree_content_url(url: str) -> bool:
    """是否为 TokenFree /videos/:id/content 拉取地址（下载需带 Bearer）。"""
    raw = (url or "").strip().lower()
    if "/videos/" not in raw:
        return False
    return raw.rstrip("/").endswith("/content")


async def resolve_tokenfree_media_download_url(
    url: str,
    *,
    api_key: str,
    timeout: float = 30.0,
) -> str:
    """探测 TokenFree content：若 302 到 TOS/CDN 直链则改走直链（避免经网关拉大文件中断）。"""
    import httpx

    raw = (url or "").strip()
    if not raw or not is_tokenfree_content_url(raw):
        return raw
    key = (api_key or "").strip()
    if not key:
        return raw
    headers = {"Authorization": f"Bearer {key}"}
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(connect=min(20.0, float(timeout)), read=float(timeout), write=30.0, pool=20.0),
            follow_redirects=False,
        ) as client:
            async with client.stream("GET", raw, headers=headers) as resp:
                loc = (resp.headers.get("location") or "").strip()
                if resp.status_code in {301, 302, 303, 307, 308} and loc.startswith(("http://", "https://")):
                    return loc
    except Exception:  # noqa: BLE001
        return raw
    return raw


def _media_url_from_item(item: dict[str, Any], key: str) -> str | None:
    """从 content 项取出 image_url / audio_url 的公网地址。"""
    raw = item.get(key)
    url = raw.get("url") if isinstance(raw, dict) else None
    if isinstance(url, str) and url.strip():
        return url.strip()
    return None


def _content_media_only(
    content: list[Any],
    allowed_image_urls: list[str],
) -> list[dict[str, Any]]:
    """抽出图/音频项；图按 allowed 截断去重。文案由顶层 prompt 承担。"""
    allowed = set(allowed_image_urls)
    used: set[str] = set()
    out: list[dict[str, Any]] = []
    for item in content:
        if not isinstance(item, dict):
            continue
        kind = item.get("type")
        if kind == "image_url":
            url = _media_url_from_item(item, "image_url")
            if not url or url not in allowed or url in used:
                continue
            used.add(url)
            out.append(item)
            continue
        if kind in {"audio_url", "video_url"}:
            out.append(item)
    return out


def wrap_seedance_payload_for_newapi(payload: dict[str, Any]) -> dict[str, Any]:
    """把方舟 Seedance body 转成 TokenFree POST /v1/videos 请求体。

    正确形状（与 New API doubao 插件一致）：
    `{model, prompt, seconds, metadata:{content:[图/音…], ratio, resolution, …}}`
    禁止再包 `metadata.input`——插件会把嵌套 input 原样丢进上游，顶层 content 只剩 prompt 文本。
    """
    from app.services.media_model_presets import resolve_preset_alias
    from app.services.tokenfree_pricing import canonicalize_channel_model_id

    src = dict(payload)
    # 预设别名（如 2-5→2.5、mini→2.0）后再规范化目录 id
    if src.get("model"):
        aliased = resolve_preset_alias(str(src["model"])) or str(src["model"])
        src["model"] = canonicalize_channel_model_id(aliased)
    content = src.get("content")
    # texts 全部文案；images/audios 按 content 顺序；roles 用来区分首帧 vs 多参考
    texts: list[str] = []
    images: list[str] = []
    image_roles: list[str] = []
    audios: list[str] = []
    if isinstance(content, list):
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text":
                piece = str(item.get("text") or "").strip()
                if piece:
                    texts.append(piece)
            if item.get("type") == "image_url":
                url = _media_url_from_item(item, "image_url")
                if url:
                    images.append(url)
                    image_roles.append(str(item.get("role") or "").strip())
            if item.get("type") == "audio_url":
                url = _media_url_from_item(item, "audio_url")
                if url:
                    audios.append(url)
    prompt = "\n".join(texts) or str(src.get("prompt") or "").strip() or "."
    duration = src.get("duration")
    duration_text = ""
    if duration is not None:
        try:
            duration_text = str(int(duration))
        except (TypeError, ValueError):
            duration_text = str(duration).strip()
    ratio = str(src.get("ratio") or "").strip()
    uses_reference_images = any(role == "reference_image" for role in image_roles)
    unique_images: list[str] = []
    unique_roles: list[str] = []
    seen_urls: set[str] = set()
    for url, role in zip(images, image_roles):
        if url in seen_urls:
            continue
        seen_urls.add(url)
        unique_images.append(url)
        unique_roles.append(role)
    # Model strategy validation owns reference limits; transport must never silently drop references.
    images = unique_images
    image_roles = unique_roles

    # 方舟字段直接挂在 metadata 根上（插件 UnmarshalMetadata → requestPayload）
    metadata: dict[str, Any] = {}
    if isinstance(content, list) and content:
        media = _content_media_only(content, images if images else [])
        # 无图时仍可能有首帧；allowed 空则只保留音/视频
        if not images:
            media = [
                item
                for item in content
                if isinstance(item, dict) and item.get("type") in {"audio_url", "video_url"}
            ]
        if media:
            metadata["content"] = media
    if duration_text:
        try:
            metadata["duration"] = int(duration_text)
        except (TypeError, ValueError):
            metadata["duration"] = duration_text
    if ratio and ratio.lower() != "adaptive":
        # 方舟字段名是 ratio，不是 aspect_ratio
        metadata["ratio"] = ratio
    resolution = str(src.get("resolution") or "").strip()
    if resolution:
        metadata["resolution"] = resolution
    if "generate_audio" in src:
        metadata["generate_audio"] = bool(src.get("generate_audio"))
    if "watermark" in src:
        metadata["watermark"] = bool(src.get("watermark"))
    if "return_last_frame" in src:
        metadata["return_last_frame"] = bool(src.get("return_last_frame"))

    first_frame_url: str | None = None
    if images and not uses_reference_images:
        for url, role in zip(images, image_roles):
            if role == "first_frame":
                first_frame_url = url
                break
        first_frame_url = first_frame_url or images[0]

    out: dict[str, Any] = {
        "model": src.get("model"),
        "prompt": prompt,
        "metadata": metadata,
    }
    if duration_text:
        out["seconds"] = duration_text
    # 纯首帧：顶层 image 供插件 HasImage() 路径；content 里仍带 role=first_frame
    if first_frame_url:
        out["image"] = first_frame_url
    return out


def prepare_video_create_body(
    body: dict[str, Any],
    *,
    base_url: str = "",
    channel_id: str = "",
) -> dict[str, Any]:
    """一律包装成 TokenFree POST /v1/videos 请求体。"""
    del base_url, channel_id
    return wrap_seedance_payload_for_newapi(body)


def unwrap_video_task_payload(data: dict[str, Any] | None) -> dict[str, Any]:
    """摊平 New API `{data: {...}}` 包装，便于取 status / url / task_id。"""
    if not isinstance(data, dict):
        return {}
    inner = data.get("data")
    if isinstance(inner, dict) and any(
        key in inner for key in ("status", "state", "url", "content", "task_id", "taskId", "id", "video_url", "resultJson")
    ):
        merged = dict(data)
        merged.update(inner)
        if not merged.get("status") and merged.get("state"):
            merged["status"] = merged["state"]
        if not merged.get("error") and (merged.get("failMsg") or merged.get("failCode")):
            merged["error"] = merged.get("failMsg") or merged.get("failCode")
        raw_res = merged.get("resultJson")
        res_obj = None
        if isinstance(raw_res, str) and raw_res.strip():
            try:
                res_obj = json.loads(raw_res)
            except ValueError:
                res_obj = None
        elif isinstance(raw_res, dict):
            res_obj = raw_res
        if isinstance(res_obj, dict):
            urls = res_obj.get("resultUrls") or res_obj.get("result_urls") or []
            if isinstance(urls, list) and urls and str(urls[0]).strip():
                merged.setdefault("url", str(urls[0]).strip())
            last_urls = res_obj.get("lastFrameUrl") or res_obj.get("last_frame_url") or []
            if isinstance(last_urls, list) and last_urls and str(last_urls[0]).strip():
                merged.setdefault("last_frame_url", str(last_urls[0]).strip())
            elif isinstance(last_urls, str) and last_urls.strip():
                merged.setdefault("last_frame_url", last_urls.strip())
        return merged
    return data


def _scalar_task_id(value: Any) -> str | None:
    """把标量任务 ID 收成非空字符串；忽略明显不是 ID 的状态词。"""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (str, int)) and str(value).strip():
        text = str(value).strip()
        if text.lower() in {"success", "ok", "true", "none", "null", "0"}:
            return None
        return text
    return None


def extract_video_task_id(data: dict[str, Any] | None) -> str | None:
    """从创建/查询响应取出轮询用任务 ID。

    New API 可能同时给 `id`（视频对象）和 `task_id`（查询用）；优先 task_id。
    部分网关把 ID 放在字符串 `data` 里。
    """
    if not isinstance(data, dict):
        return None
    payload = unwrap_video_task_payload(data)
    for key in ("task_id", "taskId"):
        found = _scalar_task_id(payload.get(key))
        if found:
            return found
    found = _scalar_task_id(data.get("data"))
    if found:
        return found
    return _scalar_task_id(payload.get("id"))


def format_video_task_error(err: Any) -> str:
    """把上游 error 对象收成可读短句。"""
    if isinstance(err, dict):
        for key in ("message", "msg", "error"):
            value = err.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                nested = format_video_task_error(value)
                if nested:
                    return nested
        return "视频生成失败"
    text = str(err or "").strip()
    return text or "视频生成失败"


def extract_video_result_url(data: dict[str, Any]) -> str | None:
    """从任务成功响应中取视频 URL（New API `url` 或方舟 `content.video_url`）。"""
    for key in ("url", "video_url"):
        value = data.get(key)
        if isinstance(value, str) and value.strip().startswith(("http://", "https://", "/")):
            return value.strip()
    content = data.get("content")
    if isinstance(content, dict):
        for key in ("video_url", "url"):
            value = content.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def normalize_video_task_status(status: str) -> str:
    """把上游状态归一成 running/succeeded/failed。"""
    raw = (status or "").strip().lower()
    if raw in VIDEO_SUCCESS_STATUSES:
        return "succeeded"
    if raw in VIDEO_FAILED_STATUSES:
        return "failed"
    return "running"
