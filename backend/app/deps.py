from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services.auth import decode_token, get_user_by_id
from app.services.tokenfree_gateway import current_user_toraapi_token
from app.services.tokenfree_usage import clean_toraapi_token, login_or_sync_toraapi_user

security = HTTPBearer(
    auto_error=False,
    bearerFormat="JWT",
    description="站内登录令牌或 ToraAPI Key：支持 POST /api/auth/toraapi 获取 access_token，或直接发送 Authorization: Bearer <YOUR_TORA_API_KEY>。",
)


async def _user_from_bearer(db: AsyncSession, token: str) -> User | None:
    """支持站内 JWT 或直接使用 ToraAPI Bearer Token (sk-...) 鉴权。"""
    raw = (token or "").strip()
    if not raw:
        return None
    sub = decode_token(raw)
    if sub:
        try:
            user_id = int(sub)
        except (TypeError, ValueError):
            return None
        user = await get_user_by_id(db, user_id)
        if user and (user.toraapi_token or "").strip():
            current_user_toraapi_token.set(user.toraapi_token.strip())
        return user

    clean_key = clean_toraapi_token(raw)
    if clean_key.startswith("sk-"):
        existing = (
            await db.execute(select(User).where(User.toraapi_token == clean_key).limit(1))
        ).scalar_one_or_none()
        if existing is not None:
            current_user_toraapi_token.set(clean_key)
            return existing
        try:
            user, _ = await login_or_sync_toraapi_user(db, clean_key)
            return user
        except Exception:  # noqa: BLE001
            return None
    return None


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    user = await _user_from_bearer(db, creds.credentials)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效")
    return user


async def get_current_admin(user: User = Depends(get_current_user)) -> User:
    # Require role=admin for /api/admin routes
    if (user.role or "user") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return user
