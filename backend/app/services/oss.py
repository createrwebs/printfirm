"""Aliyun OSS / Backblaze B2 upload helpers.

Local files stay on disk for FFmpeg; DB / frontend use public OSS / B2 URLs.
Object key layout: {folder}/generated/p{id}/... and {folder}/ for SPA.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import mimetypes
import threading
import time
import urllib.parse
from functools import lru_cache
from io import BufferedIOBase
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_b2_lock = threading.Lock()
_b2_state_cache: dict[str, Any] = {}


def b2_enabled() -> bool:
    s = get_settings()
    if (getattr(s, "storage_driver", "") or "").strip().lower() == "b2":
        return bool(
            (getattr(s, "b2_key_id", "") or "").strip()
            and (getattr(s, "b2_application_key", "") or "").strip()
            and (getattr(s, "b2_bucket_name", "") or "").strip()
        )
    return False


def _b2_get_state(*, force_refresh: bool = False) -> dict[str, Any]:
    """Authorize with Backblaze B2 and cache download / upload metadata."""
    now = time.time()
    with _b2_lock:
        if (
            not force_refresh
            and _b2_state_cache.get("api_url")
            and float(_b2_state_cache.get("expires_at") or 0) > now
        ):
            return dict(_b2_state_cache)

        s = get_settings()
        key_id = (s.b2_key_id or "").strip()
        app_key = (s.b2_application_key or "").strip()
        bucket_name = (s.b2_bucket_name or "").strip()
        if not (key_id and app_key and bucket_name):
            raise RuntimeError("Backblaze B2 credentials incomplete")

        basic = base64.b64encode(f"{key_id}:{app_key}".encode("utf-8")).decode("ascii")
        with httpx.Client(timeout=30.0) as client:
            r = client.get(
                "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
                headers={"Authorization": f"Basic {basic}"},
            )
            r.raise_for_status()
            auth_data = r.json()

            api_url = str(auth_data["apiUrl"]).rstrip("/")
            auth_token = str(auth_data["authorizationToken"])
            download_url = str(auth_data["downloadUrl"]).rstrip("/")
            account_id = str(auth_data["accountId"])

            allowed = auth_data.get("allowed") or {}
            bucket_id = str(allowed.get("bucketId") or "").strip()
            if not bucket_id or (allowed.get("bucketName") and allowed.get("bucketName") != bucket_name):
                r_b = client.post(
                    f"{api_url}/b2api/v2/b2_list_buckets",
                    headers={"Authorization": auth_token},
                    json={"accountId": account_id, "bucketName": bucket_name},
                )
                r_b.raise_for_status()
                buckets = r_b.json().get("buckets") or []
                for b in buckets:
                    if b.get("bucketName") == bucket_name:
                        bucket_id = str(b.get("bucketId") or "")
                        break
            if not bucket_id:
                raise RuntimeError(f"Backblaze B2 bucket not found: {bucket_name}")

            dl_auth_token = ""
            if not (s.b2_public_domain or "").strip():
                try:
                    prefix = f"{folder_prefix()}/"
                    r_dl = client.post(
                        f"{api_url}/b2api/v2/b2_get_download_authorization",
                        headers={"Authorization": auth_token},
                        json={
                            "bucketId": bucket_id,
                            "fileNamePrefix": prefix,
                            "validDurationInSeconds": 604800,
                        },
                    )
                    if r_dl.status_code == 200:
                        dl_auth_token = str(r_dl.json().get("authorizationToken") or "")
                except Exception:  # noqa: BLE001
                    logger.warning("B2 download authorization fetch failed", exc_info=True)

        state = {
            "api_url": api_url,
            "auth_token": auth_token,
            "download_url": download_url,
            "bucket_id": bucket_id,
            "bucket_name": bucket_name,
            "dl_auth_token": dl_auth_token,
            "expires_at": now + 43200,  # refresh every 12h (valid 7 days)
        }
        _b2_state_cache.clear()
        _b2_state_cache.update(state)
        return dict(_b2_state_cache)


def _b2_upload_bytes(
    data: bytes,
    object_key: str,
    *,
    content_type: str = "application/octet-stream",
) -> str:
    key = object_key.lstrip("/")
    sha1 = hashlib.sha1(data).hexdigest()
    encoded_key = urllib.parse.quote(key, safe="/")
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            if attempt > 0:
                time.sleep(0.5 * attempt)
            state = _b2_get_state(force_refresh=attempt > 0)
            with httpx.Client(timeout=httpx.Timeout(connect=30.0, read=180.0, write=300.0, pool=30.0)) as client:
                r_up = client.post(
                    f"{state['api_url']}/b2api/v2/b2_get_upload_url",
                    headers={"Authorization": state["auth_token"]},
                    json={"bucketId": state["bucket_id"]},
                )
                r_up.raise_for_status()
                up_info = r_up.json()
                up_url = str(up_info["uploadUrl"])
                up_token = str(up_info["authorizationToken"])

                r_put = client.post(
                    up_url,
                    headers={
                        "Authorization": up_token,
                        "X-Bz-File-Name": encoded_key,
                        "Content-Type": content_type or "b2/x-auto",
                        "X-Bz-Content-Sha1": sha1,
                    },
                    content=data,
                )
                r_put.raise_for_status()
            url = public_url(key)
            logger.info("b2 uploaded %s (%d bytes) → %s", key, len(data), url.split("?", 1)[0])
            return url
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            logger.warning("B2 upload attempt %d failed for %s: %s", attempt + 1, key, exc)
            continue
    assert last_exc is not None
    raise last_exc


@lru_cache
def _bucket():
    import oss2

    s = get_settings()
    if not s.oss_enabled:
        raise RuntimeError("OSS disabled")
    if not (s.oss_bucket and s.oss_access_key_id and s.oss_access_key_secret):
        raise RuntimeError("OSS credentials incomplete")
    auth = oss2.Auth(s.oss_access_key_id, s.oss_access_key_secret)
    endpoint = s.oss_endpoint.strip()
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"
    return oss2.Bucket(auth, endpoint, s.oss_bucket)


def reset_oss_client() -> None:
    """后台改 OSS 密钥后丢掉缓存的 Bucket，避免继续用已禁用的旧 Key。"""
    _bucket.cache_clear()
    with _b2_lock:
        _b2_state_cache.clear()


def oss_enabled() -> bool:
    if b2_enabled():
        return True
    s = get_settings()
    return bool(
        s.oss_enabled
        and s.oss_bucket
        and s.oss_access_key_id
        and s.oss_access_key_secret
    )


def folder_prefix() -> str:
    return get_settings().oss_folder.strip().strip("/") or "kepu"


def public_base() -> str:
    """浏览器可访问的公网基址；内网上传 endpoint 不能出现在返回 URL 里。"""
    s = get_settings()
    if b2_enabled():
        if (s.b2_public_domain or "").strip():
            return s.b2_public_domain.strip().rstrip("/")
        try:
            state = _b2_get_state()
            return f"{state['download_url']}/file/{state['bucket_name']}"
        except Exception:  # noqa: BLE001
            return f"https://f005.backblazeb2.com/file/{(s.b2_bucket_name or '').strip()}"
    if s.oss_public_base.strip():
        return s.oss_public_base.rstrip("/")
    ep = s.oss_endpoint.strip().removeprefix("https://").removeprefix("http://")
    ep = ep.replace("-internal.aliyuncs.com", ".aliyuncs.com")
    ep = ep.replace("-internal-accelerate.aliyuncs.com", ".aliyuncs.com")
    return f"https://{s.oss_bucket}.{ep}"


def public_url(object_key: str) -> str:
    key = object_key.lstrip("/")
    if b2_enabled():
        s = get_settings()
        if (s.b2_public_domain or "").strip():
            return f"{s.b2_public_domain.strip().rstrip('/')}/{key}"
        try:
            state = _b2_get_state()
            base = f"{state['download_url']}/file/{state['bucket_name']}/{key}"
            dl_token = state.get("dl_auth_token") or ""
            if dl_token:
                return f"{base}?Authorization={urllib.parse.quote(dl_token, safe='')}"
            return base
        except Exception:  # noqa: BLE001
            return f"{public_base()}/{key}"
    return f"{public_base()}/{key}"


def ensure_browser_cors() -> None:
    """Allow SPA origins to fetch OSS media (needed for client-side zip)."""
    if not oss_enabled():
        return
    if b2_enabled():
        return
    s = get_settings()
    origins = [
        o.strip()
        for o in (s.cors_origins or "").split(",")
        if o.strip()
    ]
    # Production site + common local/dev（主站 www 优先）
    for extra in (
        "https://www.printfilm.com",
        "http://www.printfilm.com",
        "https://printfilm.com",
        "http://printfilm.com",
        "https://admin.printfilm.com",
        "http://admin.printfilm.com",
        "https://kepu.printfilm.com",
        "http://kepu.printfilm.com",
        "https://admin.kepu.printfilm.com",
        "https://kepu.printtfilm.com",
        "http://kepu.printtfilm.com",
        "https://admin.kepu.printtfilm.com",
        "http://admin.kepu.printtfilm.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ):
        if extra not in origins:
            origins.append(extra)
    pub = (s.public_base_url or "").rstrip("/")
    if pub and pub not in origins:
        origins.append(pub)
    try:
        from oss2.models import BucketCors, CorsRule

        rule = CorsRule(
            allowed_origins=origins,
            allowed_methods=["GET", "HEAD"],
            allowed_headers=["*"],
            expose_headers=["ETag", "Content-Length", "Content-Type"],
            max_age_seconds=3600,
        )
        _bucket().put_bucket_cors(BucketCors([rule]))
        logger.info("oss CORS updated for %s origin(s)", len(origins))
    except Exception:  # noqa: BLE001
        logger.exception("oss CORS update failed")


def key_for_local(path: Path, *, static_root: Path) -> str:
    """Map backend/static/... → {folder}/..."""
    rel = path.resolve().relative_to(static_root.resolve()).as_posix()
    return f"{folder_prefix()}/{rel}"


def upload_file(local_path: Path, object_key: str | None = None) -> str:
    """Upload local file; return public URL. Raises on failure."""
    from app.services import storage

    path = Path(local_path)
    if not path.is_file():
        raise FileNotFoundError(str(path))
    key = object_key or key_for_local(path, static_root=storage.STATIC_ROOT)
    key = key.lstrip("/")
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if b2_enabled():
        return _b2_upload_bytes(path.read_bytes(), key, content_type=mime)
    headers = {
        "Content-Type": mime,
        "x-oss-object-acl": "public-read",
    }
    bucket = _bucket()
    bucket.put_object_from_file(key, str(path), headers=headers)
    url = public_url(key)
    logger.info("oss uploaded %s → %s", path.name, url)
    return url


def upload_bytes(data: bytes, object_key: str, *, content_type: str = "application/octet-stream") -> str:
    key = object_key.lstrip("/")
    if b2_enabled():
        return _b2_upload_bytes(data, key, content_type=content_type)
    headers = {"Content-Type": content_type, "x-oss-object-acl": "public-read"}
    _bucket().put_object(key, data, headers=headers)
    return public_url(key)


# 直接将文件对象流式上传到 OSS，避免先整文件读入内存。
def upload_fileobj(fileobj: BufferedIOBase, object_key: str, *, content_type: str = "application/octet-stream") -> str:
    key = object_key.lstrip("/")
    if b2_enabled():
        try:
            fileobj.seek(0)
        except Exception:  # noqa: BLE001
            pass
        return _b2_upload_bytes(fileobj.read(), key, content_type=content_type)
    headers = {"Content-Type": content_type, "x-oss-object-acl": "public-read"}
    _bucket().put_object(key, fileobj, headers=headers)
    return public_url(key)


def upload_dir(local_dir: Path, oss_prefix: str) -> int:
    """Upload directory recursively under oss_prefix. Returns file count."""
    root = Path(local_dir)
    if not root.is_dir():
        raise NotADirectoryError(str(root))
    prefix = oss_prefix.strip().strip("/")
    count = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        key = f"{prefix}/{rel}"
        upload_file(path, key)
        count += 1
    return count
