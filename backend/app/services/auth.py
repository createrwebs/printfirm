from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()
ALGORITHM = "HS256"
OAUTH_STATE_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": subject, "exp": expire}, settings.secret_key, algorithm=ALGORITHM)


def create_oauth_state(provider: str, next_path: str = "/") -> str:
    """Create a short-lived CSRF-protected OAuth state token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    return jwt.encode(
        {"typ": "oauth_state", "provider": provider, "next": next_path, "exp": expire},
        settings.secret_key,
        algorithm=OAUTH_STATE_ALGORITHM,
    )


def decode_oauth_state(token: str, provider: str) -> dict[str, Any] | None:
    """Validate OAuth state and return its safe redirect payload."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[OAUTH_STATE_ALGORITHM])
    except JWTError:
        return None
    if payload.get("typ") != "oauth_state" or payload.get("provider") != provider:
        return None
    next_path = str(payload.get("next") or "/")
    if not next_path.startswith("/") or next_path.startswith("//") or "://" in next_path:
        next_path = "/"
    return {"next": next_path}


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        return str(sub) if sub else None
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
