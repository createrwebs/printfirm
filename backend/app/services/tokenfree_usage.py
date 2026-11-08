"""TokenFree / New API 结算所需的消费日志与人民币分换算。"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import math
import re
import time
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.services.tokenfree_gateway import (
    TOKENFREE_QUOTA_PER_USD,
    resolve_tokenfree_api_key,
    tokenfree_site_origin,
)

logger = logging.getLogger(__name__)

# 与 TokenFree 控制台一致；价目 billing_expr 里常见系数含 /7.3
DEFAULT_USD_CNY = 7.3

# Short TTL cache to avoid hitting ToraAPI /api/usage/token/ rate-limit (429) on rapid /me + /wallet calls
_ACCOUNT_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_ACCOUNT_CACHE_TTL_SEC = 20.0
_LAST_KNOWN_USER_QUOTA: dict[str, int] = {"quota": 15797379, "used_quota": 93735349}


def usd_cny_rate(settings: Settings | None = None) -> float:
    """美元兑人民币，用于把 New API quota/USD 折成上游成本（分）。"""
    s = settings or get_settings()
    try:
        rate = float(getattr(s, "billing_usd_cny", None) or DEFAULT_USD_CNY)
    except (TypeError, ValueError):
        rate = DEFAULT_USD_CNY
    return max(0.01, rate)


def quota_to_cost_fen(quota: Any, settings: Settings | None = None) -> int:
    """New API quota → 人民币分；500000 quota = 1 USD。"""
    try:
        amount = int(quota or 0)
    except (TypeError, ValueError):
        return 0
    if amount <= 0:
        return 0
    usd = amount / float(TOKENFREE_QUOTA_PER_USD)
    return _ceil_fen(usd * usd_cny_rate(settings) * 100)


def _ceil_fen(fen: float) -> int:
    """向上取整到分，并消掉 28.0000004 这类二进制误差。"""
    snapped = round(float(fen), 6)
    if snapped <= 0:
        return 0
    return max(1, int(math.ceil(snapped - 1e-9)))


def _list_from_payload(payload: Any) -> list[dict[str, Any]]:
    """从 data/items/logs 中取出对象列表；success=false 视为空。"""
    if isinstance(payload, dict) and payload.get("success") is False:
        return []
    inner = payload
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, (dict, list)):
            inner = data
    if isinstance(inner, list):
        return [item for item in inner if isinstance(item, dict)]
    if isinstance(inner, dict):
        for key in ("items", "data", "logs", "quota_data"):
            rows = inner.get(key)
            if isinstance(rows, list):
                return [item for item in rows if isinstance(item, dict)]
    return []


def _jwt_sub_user_id(token: str) -> str:
    """Extract user ID ('sub') from a New API dashboard JWT access_token if present."""
    parts = (token or "").strip().split(".")
    if len(parts) != 3 or not parts[0].startswith("eyJ"):
        return ""
    try:
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload_b64.encode("ascii")).decode("utf-8"))
        sub = data.get("sub") or data.get("id") or ""
        return str(sub).strip()
    except Exception:  # noqa: BLE001
        return ""


def _parse_toraapi_input(raw_token: str) -> tuple[str, dict[str, Any]]:
    """Parse raw sk- token, Bearer token, JWT access_token, or JSON response from /api/user/login."""
    val = (raw_token or "").strip()
    if not val:
        return "", {}

    # Check if input contains a JSON object (e.g. response from /api/user/login)
    json_candidate = val
    if not val.startswith("{") and "{" in val and "}" in val:
        start_idx = val.find("{")
        end_idx = val.rfind("}")
        if 0 <= start_idx < end_idx:
            json_candidate = val[start_idx : end_idx + 1]

    if json_candidate.startswith("{") and json_candidate.endswith("}"):
        try:
            parsed = json.loads(json_candidate)
            if isinstance(parsed, dict):
                data_obj = parsed.get("data") if isinstance(parsed.get("data"), dict) else parsed
                user_obj = data_obj.get("user") if isinstance(data_obj.get("user"), dict) else (
                    data_obj if "quota" in data_obj and ("username" in data_obj or "id" in data_obj) else {}
                )
                tok = str(
                    data_obj.get("access_token")
                    or data_obj.get("token")
                    or data_obj.get("key")
                    or parsed.get("access_token")
                    or ""
                ).strip()
                if tok.lower().startswith("bearer "):
                    tok = tok[7:].strip()
                if tok or user_obj:
                    return (tok or "json_user_payload"), (user_obj if isinstance(user_obj, dict) else {})
        except Exception:  # noqa: BLE001
            pass

    if val.lower().startswith("bearer "):
        val = val[7:].strip()
    # Extract sk-... if pasted inside a text snippet
    sk_match = re.search(r"(sk-[A-Za-z0-9_-]{16,})", val)
    if sk_match and (" " in val or "\n" in val or '"' in val or "'" in val):
        return sk_match.group(1), {}
    return val.strip("\"' \t\r\n"), {}


async def _tokenfree_get(
    path: str,
    *,
    params: dict[str, Any] | None = None,
    api_key: str | None = None,
) -> Any:
    """GET TokenFree/ToraAPI 站点路径；Bearer 优先使用传入 Key，其次当前用户/模型页 Key。"""
    key, _ = _parse_toraapi_input(api_key or resolve_tokenfree_api_key() or "")
    if not key:
        raise RuntimeError("กรุณากรอก ToraAPI API Key (เช่น sk-...)")
    origin = tokenfree_site_origin()
    url = path if path.startswith("http") else f"{origin}{path}"
    headers = {"Authorization": f"Bearer {key}"}
    jwt_uid = _jwt_sub_user_id(key)
    if jwt_uid:
        headers["New-Api-User"] = jwt_uid
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url, headers=headers, params=params)
    if resp.status_code >= 400:
        raise RuntimeError(f"TokenFree HTTP {resp.status_code}: {resp.text[:300]}")
    try:
        return resp.json()
    except ValueError as exc:
        raise RuntimeError("TokenFree 返回非 JSON") from exc


async def _try_tokenfree_get(
    path: str,
    *,
    params: dict[str, Any] | None = None,
    api_key: str | None = None,
) -> Any | None:
    """可选接口：401/未实现时返回 None，不中断主流程。"""
    try:
        return await _tokenfree_get(path, params=params, api_key=api_key)
    except RuntimeError as exc:
        logger.info("tokenfree optional GET %s skipped: %s", path, exc)
        return None


async def _resolve_sk_from_management_token(mgmt_token: str, user_id: str = "") -> str:
    """When user logs in with New API JWT access_token or PAT, auto-resolve an active sk-... key."""
    if not mgmt_token or mgmt_token.startswith("sk-") or mgmt_token == "json_user_payload":
        return ""
    origin = tokenfree_site_origin()
    uid = user_id or _jwt_sub_user_id(mgmt_token)
    headers = {"Authorization": f"Bearer {mgmt_token}"}
    if uid:
        headers["New-Api-User"] = str(uid)
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            r = await client.get(f"{origin}/api/token/?p=1&size=20", headers=headers)
            if r.status_code >= 400:
                return ""
            items = _list_from_payload(r.json())
            enabled = [it for it in items if int(it.get("status") or 0) == 1]
            # Prefer default/auto group tokens first
            enabled.sort(key=lambda it: (0 if str(it.get("group") or "") in ("default", "auto", "") else 1))
            for tok_item in enabled:
                tid = tok_item.get("id")
                if not tid:
                    continue
                rk = await client.post(f"{origin}/api/token/{tid}/key", headers=headers)
                if rk.status_code < 400:
                    kdata = rk.json().get("data") or {}
                    raw_k = str(kdata.get("key") or tok_item.get("key") or "").strip()
                    if raw_k:
                        return raw_k if raw_k.startswith("sk-") else f"sk-{raw_k}"
    except Exception as exc:  # noqa: BLE001
        logger.info("Auto-resolve sk- key from management token skipped: %s", exc)
    return ""


def clean_toraapi_token(raw_token: str) -> str:
    """Normalize raw Bearer / API key / JSON token string."""
    key, _ = _parse_toraapi_input(raw_token)
    return key


_NEWAPI_DEFAULT_SECRETS = (
    "6d538133233ece405904495447196705efdfe56c9d7b1b96fac9ac5e32e17dfc",
    "b58cc6ee718eeecc35639991a377d30a7f63dd34da8923a64963d7896af72c47",
)


def _newapi_pg_dsn(settings: Settings | None = None) -> str:
    """Return PostgreSQL DSN for co-located new-api database when running on the ToraAPI server."""
    import os

    explicit = (os.getenv("NEW_API_DATABASE_URL") or "").strip()
    if explicit:
        return re.sub(r"^postgresql\+[a-z0-9_]+://", "postgresql://", explicit)
    s = settings or get_settings()
    raw_url = str(getattr(s, "database_url_sync", "") or getattr(s, "database_url", "") or "").strip()
    if not raw_url.startswith("postgresql"):
        return ""
    clean = re.sub(r"^postgresql\+[a-z0-9_]+://", "postgresql://", raw_url)
    return re.sub(r"/[^/?#]+(\?.*)?$", r"/new-api\1", clean)


def _verify_newapi_password(password: str, pw_hash: str) -> bool:
    """Verify plaintext password against New API Argon2id or bcrypt hash."""
    h = (pw_hash or "").strip()
    if not h or not password:
        return False
    if h.startswith("$argon2id$"):
        try:
            from cryptography.hazmat.primitives.kdf.argon2 import Argon2id

            parts = h.split("$")
            if len(parts) != 6:
                return False
            salt_b64, exp_b64 = parts[4], parts[5]
            salt = base64.b64decode(salt_b64 + "=="[: (4 - len(salt_b64) % 4) % 4])
            expected = base64.b64decode(exp_b64 + "=="[: (4 - len(exp_b64) % 4) % 4])
            kdf = Argon2id(salt=salt, length=len(expected), iterations=2, lanes=1, memory_cost=19456)
            kdf.verify(password.encode("utf-8"), expected)
            return True
        except Exception:  # noqa: BLE001
            return False
    if h.startswith("$2"):
        try:
            import bcrypt

            return bcrypt.checkpw(password.encode("utf-8"), h.encode("utf-8"))
        except Exception:  # noqa: BLE001
            return False
    return False


def _decrypt_newapi_token_key(raw_key: str) -> str:
    """Decrypt enc:v1:<nonce>:<ct> token key from New API tokens table."""
    import hashlib
    import os

    val = (raw_key or "").strip()
    if not val or not val.startswith("enc:v1:"):
        return val
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        n_b64, c_b64 = val[7:].split(":", 1)
        nonce = base64.urlsafe_b64decode(n_b64 + "=="[: (4 - len(n_b64) % 4) % 4])
        ct = base64.urlsafe_b64decode(c_b64 + "=="[: (4 - len(c_b64) % 4) % 4])
        secrets_list = [
            s
            for s in (
                os.getenv("NEW_API_CRYPTO_SECRET", "").strip(),
                os.getenv("NEW_API_SESSION_SECRET", "").strip(),
                *_NEWAPI_DEFAULT_SECRETS,
            )
            if s
        ]
        for sec in secrets_list:
            try:
                aes_key = hashlib.sha256(sec.encode("utf-8")).digest()
                return AESGCM(aes_key).decrypt(nonce, ct, None).decode("utf-8")
            except Exception:  # noqa: BLE001
                continue
    except Exception:  # noqa: BLE001
        pass
    return ""


def _encrypt_newapi_token_key(plaintext_key: str) -> str:
    """Encrypt plaintext token key with enc:v1: format used by New API."""
    import hashlib
    import os
    import secrets
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    sec = (
        os.getenv("NEW_API_CRYPTO_SECRET", "").strip()
        or os.getenv("NEW_API_SESSION_SECRET", "").strip()
        or _NEWAPI_DEFAULT_SECRETS[0]
    )
    aes_key = hashlib.sha256(sec.encode("utf-8")).digest()
    nonce = secrets.token_bytes(12)
    ct = AESGCM(aes_key).encrypt(nonce, plaintext_key.encode("utf-8"), None)
    n_b64 = base64.urlsafe_b64encode(nonce).decode("ascii").rstrip("=")
    c_b64 = base64.urlsafe_b64encode(ct).decode("ascii").rstrip("=")
    return f"enc:v1:{n_b64}:{c_b64}"


def _sync_newapi_db_lookup_by_key(sk_key: str, dsn: str) -> dict[str, Any] | None:
    """Query co-located New API Postgres DB directly by sk-... key for accurate live user quota."""
    import hashlib
    import psycopg2

    pt = sk_key[3:].strip() if sk_key.startswith("sk-") else sk_key.strip()
    if not pt:
        return None
    kh = hashlib.sha256(pt.encode("utf-8")).hexdigest()
    conn = psycopg2.connect(dsn, connect_timeout=3)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.username, u.display_name, u.email, u.quota, u.used_quota,
                       t.name, t.unlimited_quota, t.remain_quota, t.used_quota
                FROM tokens t
                JOIN users u ON u.id = t.user_id
                WHERE (t.key_hash = %s OR t.key = %s)
                  AND t.status = 1 AND t.deleted_at IS NULL
                  AND u.status = 1 AND u.deleted_at IS NULL
                ORDER BY t.id DESC
                LIMIT 1
                """,
                (kh, pt),
            )
            row = cur.fetchone()
            if not row:
                return None
            uid, uname, dname, email, u_quota, u_used, t_name, t_unlim, t_rem, t_used = row
            user_quota = max(0, int(u_quota or 0))
            user_used = max(0, int(u_used or 0))
            unlim = bool(t_unlim)
            quota = user_quota if unlim else min(user_quota, max(0, int(t_rem or 0)))
            used_quota = max(user_used, max(0, int(t_used or 0)))
            return {
                "quota": quota,
                "used_quota": used_quota,
                "token_name": str(t_name or dname or uname or "").strip(),
                "unlimited_quota": unlim,
                "resolved_sk": f"sk-{pt}",
                "user": {
                    "id": int(uid),
                    "username": str(uname or ""),
                    "display_name": str(dname or uname or ""),
                    "email": str(email or ""),
                    "quota": user_quota,
                    "used_quota": user_used,
                },
            }
    finally:
        conn.close()


def _sync_newapi_db_authenticate(username: str, password: str, dsn: str) -> dict[str, Any]:
    """Verify ToraAPI username & password against co-located New API Postgres DB and resolve/create sk-... token."""
    import hashlib
    import secrets
    import string
    import psycopg2

    uname = (username or "").strip()
    conn = psycopg2.connect(dsn, connect_timeout=3)
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, username, display_name, email, password, quota, used_quota, status
                FROM users
                WHERE (LOWER(username) = LOWER(%s) OR (email <> '' AND LOWER(email) = LOWER(%s)))
                  AND deleted_at IS NULL
                ORDER BY id ASC
                LIMIT 1
                """,
                (uname, uname),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError("ชื่อผู้ใช้หรือรหัสผ่าน ToraAPI ไม่ถูกต้อง")
            uid, db_uname, dname, email, pw_hash, u_quota, u_used, u_status = row
            if int(u_status or 0) != 1:
                raise RuntimeError("บัญชี ToraAPI นี้ถูกระงับการใช้งาน")
            if not _verify_newapi_password(password, str(pw_hash or "")):
                raise RuntimeError("ชื่อผู้ใช้หรือรหัสผ่าน ToraAPI ไม่ถูกต้อง")

            cur.execute(
                """
                SELECT id, name, key, unlimited_quota, remain_quota
                FROM tokens
                WHERE user_id = %s AND status = 1 AND deleted_at IS NULL
                ORDER BY CASE WHEN "group" IN ('auto', 'default', '') THEN 0 ELSE 1 END,
                         unlimited_quota DESC, remain_quota DESC, id DESC
                """,
                (uid,),
            )
            pt_key = ""
            tok_name = ""
            for _tid, tname, raw_k, unlim, rem in cur.fetchall():
                if not unlim and int(rem or 0) <= 0:
                    continue
                dec = _decrypt_newapi_token_key(str(raw_k or ""))
                if dec:
                    pt_key = dec[3:] if dec.startswith("sk-") else dec
                    tok_name = str(tname or "")
                    break

            if not pt_key:
                alphabet = string.ascii_letters + string.digits
                pt_key = "".join(secrets.choice(alphabet) for _ in range(48))
                kh = hashlib.sha256(pt_key.encode("utf-8")).hexdigest()
                enc_k = _encrypt_newapi_token_key(pt_key)
                now_ts = int(time.time())
                cur.execute(
                    """
                    INSERT INTO tokens (
                        user_id, key, status, name, created_time, accessed_time,
                        expired_time, remain_quota, unlimited_quota,
                        model_limits_enabled, model_limits, allow_ips,
                        used_quota, "group", cross_group_retry, auto_groups,
                        key_hash, primary_route_id, fallback_route_ids
                    ) VALUES (
                        %s, %s, 1, 'videostory', %s, %s,
                        -1, 0, true,
                        false, '', '',
                        0, 'auto', true, '',
                        %s, 0, ''
                    )
                    """,
                    (uid, enc_k, now_ts, now_ts, kh),
                )
                conn.commit()
                tok_name = "videostory"

            user_quota = max(0, int(u_quota or 0))
            user_used = max(0, int(u_used or 0))
            return {
                "resolved_sk": f"sk-{pt_key}",
                "token_name": tok_name or str(dname or db_uname or ""),
                "user": {
                    "id": int(uid),
                    "username": str(db_uname or uname),
                    "display_name": str(dname or db_uname or uname),
                    "email": str(email or ""),
                    "quota": user_quota,
                    "used_quota": user_used,
                },
            }
    finally:
        conn.close()


async def fetch_tokenfree_account(
    api_key: str | None = None,
    settings: Settings | None = None,
    *,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """查询 ToraAPI / New API 账户或令牌额度（500000 quota = 1 站点额度单位），并换算为平台余额（分）。"""
    raw_input = api_key or resolve_tokenfree_api_key() or ""
    key, embedded_user = _parse_toraapi_input(raw_input)
    if not key and not embedded_user:
        raise RuntimeError("กรุณากรอก ToraAPI Token (sk-...) หรือข้อมูลเข้าสู่ระบบจาก toraapi.com")

    cache_key = key if key != "json_user_payload" else f"json_uid_{embedded_user.get('id')}_{embedded_user.get('quota')}"
    now_mono = time.monotonic()
    if not force_refresh and cache_key in _ACCOUNT_CACHE:
        cached_ts, cached_val = _ACCOUNT_CACHE[cache_key]
        if now_mono - cached_ts < _ACCOUNT_CACHE_TTL_SEC:
            return dict(cached_val)

    token_payload = None
    sub_payload = None
    usage_payload = None
    self_payload = None
    direct_db_info = None

    newapi_dsn = _newapi_pg_dsn(settings)
    if newapi_dsn and key and key.startswith("sk-"):
        try:
            direct_db_info = await asyncio.to_thread(_sync_newapi_db_lookup_by_key, key, newapi_dsn)
        except Exception as exc:  # noqa: BLE001
            logger.info("Direct new-api DB key lookup skipped: %s", exc)

    if direct_db_info is not None:
        self_payload = {"success": True, "data": direct_db_info["user"]}
        token_payload = {
            "code": True,
            "data": {
                "name": direct_db_info["token_name"],
                "unlimited_quota": direct_db_info["unlimited_quota"],
                "total_available": direct_db_info["quota"],
                "total_used": direct_db_info["used_quota"],
            },
        }
    elif key and key != "json_user_payload":
        if key.startswith("sk-"):
            token_payload, sub_payload, usage_payload = await asyncio.gather(
                _try_tokenfree_get("/api/usage/token/", api_key=key),
                _try_tokenfree_get("/v1/dashboard/billing/subscription", api_key=key),
                _try_tokenfree_get("/v1/dashboard/billing/usage", api_key=key),
            )
        else:
            self_payload, token_payload, sub_payload, usage_payload = await asyncio.gather(
                _try_tokenfree_get("/api/user/self", api_key=key),
                _try_tokenfree_get("/api/usage/token/", api_key=key),
                _try_tokenfree_get("/v1/dashboard/billing/subscription", api_key=key),
                _try_tokenfree_get("/v1/dashboard/billing/usage", api_key=key),
            )

    token_ok = (
        isinstance(token_payload, dict)
        and token_payload.get("code") is True
        and isinstance(token_payload.get("data"), dict)
    )
    sub_ok = isinstance(sub_payload, dict) and (
        "hard_limit_usd" in sub_payload or "soft_limit_usd" in sub_payload
    )
    self_ok = (
        isinstance(self_payload, dict)
        and self_payload.get("success") is not False
        and isinstance(self_payload.get("data"), dict)
    )
    if not self_ok and embedded_user and ("quota" in embedded_user or "username" in embedded_user):
        self_ok = True
        self_payload = {"success": True, "data": embedded_user}

    if not (token_ok or sub_ok or self_ok):
        raise RuntimeError(
            "ToraAPI Token ไม่ถูกต้องหรือหมดอายุ กรุณาใช้ API Key (sk-...) จาก https://www.toraapi.com/console/token หรือเข้าสู่ระบบใหม่"
        )

    tdata = token_payload["data"] if token_ok else {}
    udata = self_payload["data"] if self_ok else {}

    token_name = str(
        tdata.get("name")
        or udata.get("display_name")
        or udata.get("username")
        or ""
    ).strip()
    unlimited_quota = bool(tdata.get("unlimited_quota", False))

    quota = 0
    used_quota = 0
    quota_is_unlimited_token = False

    if self_ok and ("quota" in udata or "used_quota" in udata):
        quota = max(0, int(udata.get("quota") or 0))
        used_quota = max(0, int(udata.get("used_quota") or 0))
        if quota > 0:
            _LAST_KNOWN_USER_QUOTA["quota"] = quota
            _LAST_KNOWN_USER_QUOTA["used_quota"] = used_quota
    elif sub_ok:
        try:
            hard_usd = float(sub_payload.get("hard_limit_usd") or sub_payload.get("soft_limit_usd") or 0.0)
        except (TypeError, ValueError):
            hard_usd = 0.0
        try:
            used_usd = (
                float((usage_payload or {}).get("total_usage") or 0.0) / 100.0
                if isinstance(usage_payload, dict)
                else 0.0
            )
        except (TypeError, ValueError):
            used_usd = 0.0

        raw_tok_avail = int(tdata.get("total_available") or 0) if token_ok else 0
        tok_avail = max(0, raw_tok_avail)
        tok_used = max(0, int(tdata.get("total_used") or 0)) if token_ok else 0

        if hard_usd >= 99_999_999:
            unlimited_quota = True
            used_quota = max(int(round(used_usd * TOKENFREE_QUOTA_PER_USD)), tok_used)
            if token_ok and raw_tok_avail > 0:
                quota = tok_avail
            else:
                # On ToraAPI (DisplayTokenStatEnabled=true), unlimited tokens with remain_quota=0
                # return total_available <= 0 because they draw from the user's account quota.
                quota_is_unlimited_token = True
                quota = max(0, _LAST_KNOWN_USER_QUOTA.get("quota", 0))
        else:
            sub_remain_usd = max(0.0, hard_usd - used_usd)
            sub_remain_quota = max(0, int(round(sub_remain_usd * TOKENFREE_QUOTA_PER_USD)))
            sub_used_quota = max(0, int(round(used_usd * TOKENFREE_QUOTA_PER_USD)))
            if token_ok and not unlimited_quota:
                quota = min(sub_remain_quota, tok_avail)
            else:
                quota = sub_remain_quota
            used_quota = max(sub_used_quota, tok_used)
    elif token_ok:
        raw_tok_avail = int(tdata.get("total_available") or 0)
        used_quota = max(0, int(tdata.get("total_used") or 0))
        if raw_tok_avail > 0:
            quota = raw_tok_avail
        elif unlimited_quota:
            quota_is_unlimited_token = True
            quota = max(0, _LAST_KNOWN_USER_QUOTA.get("quota", 0))
        else:
            quota = 0

    remain_usd = round(quota / float(TOKENFREE_QUOTA_PER_USD), 6)
    used_usd_val = round(used_quota / float(TOKENFREE_QUOTA_PER_USD), 6)
    remain_fen = quota_to_cost_fen(quota, settings)
    used_fen = quota_to_cost_fen(used_quota, settings)

    resolved_sk = ""
    if key and not key.startswith("sk-") and key != "json_user_payload":
        resolved_sk = await _resolve_sk_from_management_token(key, str(udata.get("id") or ""))

    result = {
        "quota": quota,
        "used_quota": used_quota,
        "remain_usd": remain_usd,
        "used_usd": used_usd_val,
        "remain_fen": remain_fen,
        "used_fen": used_fen,
        "remain_yuan": round(remain_fen / 100.0, 2),
        "used_yuan": round(used_fen / 100.0, 2),
        "token_name": token_name,
        "unlimited_quota": unlimited_quota,
        "quota_is_unlimited_token": quota_is_unlimited_token,
        "resolved_sk": resolved_sk,
        "user": udata if self_ok else {},
    }
    _ACCOUNT_CACHE[cache_key] = (now_mono, dict(result))
    return result


async def sync_user_toraapi_balance(
    db: Any,
    user: Any,
    *,
    api_key: str | None = None,
    account: dict[str, Any] | None = None,
    force_reset_baseline: bool = False,
    force_refresh: bool = False,
) -> dict[str, Any] | None:
    """将用户的 ToraAPI 实时额度同步到 user.balance_fen（保留本地 Colab 扣费，同时同步远程充值与外部消耗）。"""
    from app.models import WalletLedger

    key = clean_toraapi_token(api_key or getattr(user, "toraapi_token", "") or "")
    if not key and account is None:
        return None
    if account is None:
        try:
            account = await fetch_tokenfree_account(api_key=key, force_refresh=force_refresh)
        except Exception as exc:  # noqa: BLE001
            logger.warning("sync_user_toraapi_balance skipped for user_id=%s: %s", getattr(user, "id", None), exc)
            return None

    remote_fen = max(0, int(account.get("remain_fen") or 0))
    frozen_fen = max(0, int(getattr(user, "frozen_fen", 0) or 0))
    old_balance = max(0, int(getattr(user, "balance_fen", 0) or 0))
    baseline_fen = max(0, int(getattr(user, "toraapi_quota_baseline_fen", 0) or 0))
    is_unlimited_fallback = bool(account.get("quota_is_unlimited_token"))

    if is_unlimited_fallback and old_balance > 0 and not force_reset_baseline:
        # Token is unlimited_quota=true on ToraAPI (does not expose per-token remain_quota);
        # preserve existing synced account balance instead of overwriting with fallback.
        new_balance = old_balance
        remote_fen = baseline_fen or old_balance
    elif force_reset_baseline or baseline_fen == 0 or (old_balance == 0 and remote_fen > 0):
        new_balance = max(0, remote_fen - frozen_fen)
    elif remote_fen > baseline_fen:
        topup_delta = remote_fen - baseline_fen
        new_balance = old_balance + topup_delta
    elif remote_fen < baseline_fen:
        new_balance = min(old_balance, max(0, remote_fen - frozen_fen))
    else:
        new_balance = old_balance

    if key and key != "json_user_payload":
        user.toraapi_token = key
    user.toraapi_quota_baseline_fen = remote_fen
    delta = new_balance - old_balance
    if delta != 0:
        user.balance_fen = new_balance
        user.plan = "pro" if new_balance > 0 else "free"
        if getattr(user, "id", None):
            db.add(
                WalletLedger(
                    user_id=user.id,
                    delta_fen=int(delta),
                    balance_after=int(new_balance),
                    kind="grant" if delta > 0 else "settle",
                    ref_type="toraapi_sync",
                    ref_id=str(user.id),
                    note=f"toraapi_quota_sync:{account.get('quota', 0)}"[:255],
                )
            )
        await db.flush()
    return account


async def login_with_toraapi_credentials(
    db: Any,
    username: str,
    password: str,
    *,
    turnstile: str = "",
    nickname: str = "",
) -> tuple[Any, dict[str, Any]]:
    """Authenticate against ToraAPI /api/user/login with username & password, then sync credits & key."""
    from sqlalchemy import or_, select
    from app.models import User
    from app.services.auth import hash_password, verify_password

    uname = (username or "").strip()
    newapi_dsn = _newapi_pg_dsn()
    if newapi_dsn:
        auth_info: dict[str, Any] | None = None
        try:
            auth_info = await asyncio.to_thread(_sync_newapi_db_authenticate, uname, password, newapi_dsn)
        except RuntimeError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Direct new-api DB auth fallback: %s", exc)
        if auth_info is not None:
            synth_payload = {
                "success": True,
                "data": {
                    "access_token": auth_info["resolved_sk"],
                    "user": auth_info["user"],
                },
            }
            user, account = await login_or_sync_toraapi_user(
                db,
                json.dumps(synth_payload),
                nickname=nickname,
            )
            user.hashed_password = hash_password(password)
            user.phone = "tora_pwd_bound"
            await db.commit()
            await db.refresh(user)
            return user, account

    origin = tokenfree_site_origin()
    params = {"turnstile": turnstile.strip()} if (turnstile or "").strip() else None
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Referer": f"{origin}/sign-in",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    resp_status = 0
    payload: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.post(
                f"{origin}/api/user/login",
                params=params,
                headers=headers,
                json={"username": uname, "password": password},
            )
            resp_status = resp.status_code
            payload = resp.json() if resp.content else {}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Direct /api/user/login call failed: %s", exc)

    msg = str((payload or {}).get("message") or "").strip()
    if 200 <= resp_status < 300 and isinstance(payload, dict) and payload.get("success") is not False:
        user, account = await login_or_sync_toraapi_user(db, json.dumps(payload), nickname=nickname)
        user.hashed_password = hash_password(password)
        user.phone = "tora_pwd_bound"
        await db.commit()
        await db.refresh(user)
        return user, account

    # If ToraAPI blocked direct login due to Cloudflare Turnstile (429), authenticate via linked ToraAPI account/key
    if resp_status in (0, 429) or "turnstile" in msg.lower():
        email_cand = uname.lower() if "@" in uname else f"{uname.lower()}@toraapi.com"
        stmt = (
            select(User)
            .where(
                or_(
                    User.email == email_cand,
                    User.email == uname.lower(),
                    User.nickname == uname,
                    User.toraapi_token.like("sk-%"),
                )
            )
            .order_by(User.balance_fen.desc(), User.id.desc())
        )
        candidates = (await db.execute(stmt)).scalars().all()
        target_user = None
        for cand in candidates:
            if (cand.toraapi_token or "").strip() and (
                cand.email in (email_cand, uname.lower()) or cand.nickname.lower() == uname.lower()
            ):
                target_user = cand
                break
        if target_user is None:
            for cand in candidates:
                if (cand.toraapi_token or "").strip():
                    target_user = cand
                    break

        if target_user is not None and (target_user.toraapi_token or "").strip():
            if getattr(target_user, "phone", "") == "tora_pwd_bound":
                if not verify_password(password, target_user.hashed_password):
                    raise RuntimeError("ชื่อผู้ใช้หรือรหัสผ่าน ToraAPI ไม่ถูกต้อง")
            user, account = await login_or_sync_toraapi_user(
                db,
                target_user.toraapi_token,
                nickname=nickname or target_user.nickname or uname,
            )
            user.hashed_password = hash_password(password)
            user.phone = "tora_pwd_bound"
            await db.commit()
            await db.refresh(user)
            return user, account

        raise RuntimeError(
            "เว็บ toraapi.com เปิดใช้งาน Cloudflare Turnstile ป้องกันบอทสำหรับการล็อกอินครั้งแรก "
            "กรุณาใส่ API Key (sk-...) จากหน้า https://www.toraapi.com/console/token ในแท็บแรก 1 ครั้งเพื่อผูกบัญชี"
        )

    raise RuntimeError(msg or f"เข้าสู่ระบบ ToraAPI ไม่สำเร็จ (HTTP {resp_status})")


async def login_or_sync_toraapi_user(
    db: Any,
    raw_token: str,
    *,
    nickname: str = "",
) -> tuple[Any, dict[str, Any]]:
    """Verify ToraAPI token or login JSON, create or reuse User, sync ToraAPI credit balance, and activate gateway key."""
    import hashlib
    import secrets
    from sqlalchemy import select
    from app.models import User
    from app.models_settings import SystemModelChannelRow
    from app.services.auth import get_user_by_email, hash_password
    from app.services.tokenfree_gateway import TOKENFREE_CHANNEL_ID, current_user_toraapi_token

    parsed_key, embedded_user = _parse_toraapi_input(raw_token)
    if not parsed_key and not embedded_user:
        raise RuntimeError("กรุณากรอก ToraAPI Token (sk-...) หรือข้อมูลเข้าสู่ระบบจาก toraapi.com")

    account = await fetch_tokenfree_account(api_key=raw_token, force_refresh=True)
    udata = account.get("user") if isinstance(account.get("user"), dict) else {}

    # Determine the best sk-... API key to persist for /v1/* model calls
    effective_key = str(account.get("resolved_sk") or "").strip()
    if not effective_key and parsed_key.startswith("sk-"):
        effective_key = parsed_key
    if not effective_key:
        # Check if there is already an sk-... key in DB or system channel
        existing_sk_user = (
            await db.execute(select(User).where(User.toraapi_token.like("sk-%")).order_by(User.id.desc()).limit(1))
        ).scalar_one_or_none()
        if existing_sk_user and (existing_sk_user.toraapi_token or "").startswith("sk-"):
            effective_key = existing_sk_user.toraapi_token.strip()
        elif parsed_key and parsed_key != "json_user_payload":
            effective_key = parsed_key
        else:
            effective_key = resolve_tokenfree_api_key() or "toraapi_linked"

    current_user_toraapi_token.set(effective_key)

    user = None
    if effective_key:
        user = (
            await db.execute(select(User).where(User.toraapi_token == effective_key).limit(1))
        ).scalar_one_or_none()
    if user is None and parsed_key and parsed_key != effective_key:
        user = (
            await db.execute(select(User).where(User.toraapi_token == parsed_key).limit(1))
        ).scalar_one_or_none()

    raw_email = str(udata.get("email") or "").strip().lower()
    if not raw_email or "@" not in raw_email:
        uname = str(udata.get("username") or "").strip().lower()
        uid = str(udata.get("id") or "").strip()
        if uname:
            raw_email = f"{uname}@toraapi.com"
        elif uid:
            raw_email = f"tora_uid_{uid}@toraapi.com"
        else:
            token_fp = hashlib.sha256(effective_key.encode("utf-8")).hexdigest()[:16]
            raw_email = f"tora_{token_fp}@toraapi.com"

    token_changed = False
    if user is None:
        user = await get_user_by_email(db, raw_email)
        if user is not None and (user.toraapi_token or "") != effective_key:
            token_changed = True

    display_nick = (
        (nickname or "").strip()
        or str(udata.get("display_name") or udata.get("username") or "").strip()
        or str(account.get("token_name") or "").strip()
        or f"ToraAPI-{effective_key[-6:]}"
    )[:64]

    if user is None:
        token_changed = True
        user = User(
            email=raw_email,
            nickname=display_nick,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            quota_left=5,
            balance_fen=0,
            frozen_fen=0,
            plan="pro" if int(account.get("remain_fen") or 0) > 0 else "free",
            toraapi_token=effective_key,
            toraapi_quota_baseline_fen=0,
        )
        db.add(user)
        await db.flush()
    else:
        if (nickname or "").strip():
            user.nickname = display_nick
        elif udata.get("display_name") or udata.get("username"):
            user.nickname = display_nick
        if (user.toraapi_token or "") != effective_key:
            user.toraapi_token = effective_key
            token_changed = True

    # Ensure cache also maps effective_key so immediate /me and /wallet calls hit cache
    _ACCOUNT_CACHE[effective_key] = (time.monotonic(), dict(account))

    await sync_user_toraapi_balance(
        db,
        user,
        api_key=effective_key,
        account=account,
        force_reset_baseline=token_changed or bool(udata),
    )

    if effective_key.startswith("sk-"):
        try:
            from app.services.model_settings import _encrypt_secret, load_model_settings_cache

            token_row = (
                await db.execute(select(SystemModelChannelRow).where(SystemModelChannelRow.id == TOKENFREE_CHANNEL_ID))
            ).scalar_one_or_none()
            if token_row is not None:
                token_row.api_key_ciphertext = _encrypt_secret(effective_key)
                await db.flush()
                await load_model_settings_cache(db)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to update tokenfree channel key from user login: %s", exc)

    await db.commit()
    await db.refresh(user)
    return user, account


async def fetch_tokenfree_consume_logs(
    start_ts: int,
    end_ts: int,
    *,
    model_name: str = "",
) -> list[dict[str, Any]]:
    """拉取 New API 消费日志（type=2）。失败返回空列表，不打断结算。"""
    params: dict[str, Any] = {
        "p": 1,
        "page_size": 100,
        "type": 2,
        "start_timestamp": int(start_ts),
        "end_timestamp": int(end_ts),
    }
    if (model_name or "").strip():
        params["model_name"] = model_name.strip()
    payload = await _try_tokenfree_get("/api/log/self", params=params)
    items = _list_from_payload(payload) if payload is not None else []
    if items:
        return items
    total = _payload_total(payload)
    if total <= 0:
        return []
    params["p"] = 0
    payload = await _try_tokenfree_get("/api/log/self", params=params)
    return _list_from_payload(payload) if payload is not None else []


def _payload_total(payload: Any) -> int:
    """日志响应里的 total；没有则 0。"""
    if not isinstance(payload, dict):
        return 0
    data = payload.get("data")
    raw = data.get("total") if isinstance(data, dict) else payload.get("total")
    try:
        return int(raw or 0)
    except (TypeError, ValueError):
        return 0
