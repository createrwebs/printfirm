import secrets
from urllib.parse import quote, urlencode

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.deps import get_current_user, security
from app.models import User, WalletLedger
from app.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    ToraApiLoginRequest,
    UserOut,
)
from app.services import storage
from app.services.auth import (
    create_access_token,
    create_oauth_state,
    decode_oauth_state,
    get_user_by_email,
    hash_password,
    verify_password,
)
from app.services.password_reset import (
    InvalidTokenError,
    RedisUnavailableError,
    apply_password_reset,
    request_password_reset,
)
from app.services.profile import ProfileError, prepare_profile_update

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _is_local_request(request: Request) -> bool:
    """Return true only for loopback hosts; never expose local debug data publicly."""
    return request.url.hostname in {"127.0.0.1", "localhost", "::1"}


def _safe_next_path(raw: str | None) -> str:
    value = (raw or "/").strip()
    if not value.startswith("/") or value.startswith("//") or "://" in value:
        return "/"
    return value


def _frontend_url(path: str = "/auth", *, query: dict[str, str] | None = None, token: str = "") -> str:
    base = settings.auth_frontend_url.rstrip("/") or "http://127.0.0.1:5173"
    url = f"{base}{path}"
    if query:
        url += "?" + urlencode(query)
    if token:
        # Fragment is not sent in HTTP requests or server logs; the frontend removes it after use.
        url += f"#access_token={quote(token, safe='')}"
    return url


def _google_redirect_uri(request: Request) -> str:
    return (
        settings.google_oauth_redirect_uri.strip()
        or f"{str(request.base_url).rstrip('/')}/api/auth/google/callback"
    )


@router.get(
    "/providers",
    summary="查询可用登录方式",
    description="返回当前部署启用的 OAuth 登录方式；不会返回客户端密钥。",
)
async def auth_providers(request: Request) -> dict[str, object]:
    local = _is_local_request(request)
    return {
        "google": {
            "enabled": bool(settings.google_oauth_client_id and settings.google_oauth_client_secret),
            "label": "Google",
        },
        "chatgpt": {
            "enabled": False,
            "label": "ChatGPT",
            "reason": "Sign in with ChatGPT 目前仅对参与 partner 开放，且不会向应用提供 ChatGPT/API token",
        },
        "local_token_debug": bool(local and settings.debug and settings.auth_local_token_debug),
    }


@router.get(
    "/google/start",
    summary="开始 Google 登录",
    description="使用 Google OpenID Connect 登录；未配置 OAuth 客户端时仅返回 503。",
)
async def google_login_start(request: Request, next: str = "/") -> RedirectResponse:
    if not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        raise HTTPException(status_code=503, detail="Google 登录尚未配置 OAuth 客户端")
    redirect_uri = _google_redirect_uri(request)
    params = {
        "client_id": settings.google_oauth_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": create_oauth_state("google", _safe_next_path(next)),
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(
        "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params),
        status_code=status.HTTP_302_FOUND,
    )


@router.get(
    "/google/callback",
    summary="完成 Google 登录",
    description="交换 Google authorization code，按验证后的邮箱创建或复用 PRINTFILM 账号。",
)
async def google_login_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    if error:
        return RedirectResponse(_frontend_url(query={"oauth_error": "Google 登录已取消"}))
    payload = decode_oauth_state(state or "", "google")
    if payload is None:
        return RedirectResponse(_frontend_url(query={"oauth_error": "Google 登录状态无效或已过期"}))
    next_path = str(payload["next"])
    if not code or not settings.google_oauth_client_id or not settings.google_oauth_client_secret:
        return RedirectResponse(_frontend_url(query={"oauth_error": "Google 登录尚未配置"}))

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.google_oauth_client_id,
                    "client_secret": settings.google_oauth_client_secret,
                    "redirect_uri": _google_redirect_uri(request),
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
            google_access_token = str(token_payload.get("access_token") or "")
            if not google_access_token:
                raise ValueError("Google 未返回 access token")
            user_response = await client.get(
                "https://openidconnect.googleapis.com/v1/userinfo",
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
            user_response.raise_for_status()
            profile = user_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        return RedirectResponse(_frontend_url(query={"oauth_error": f"Google 登录失败：{str(exc)[:120]}"}))

    email = str(profile.get("email") or "").strip().lower()
    if not email or profile.get("email_verified") is not True:
        return RedirectResponse(_frontend_url(query={"oauth_error": "Google 邮箱未验证，无法登录"}))

    async with AsyncSessionLocal() as db:
        user = await get_user_by_email(db, email)
        if user is None:
            grant = int(settings.billing_signup_grant_fen or 0)
            user = User(
                email=email,
                nickname=str(profile.get("name") or email.split("@", 1)[0])[:64],
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                quota_left=settings.new_user_quota,
                balance_fen=grant,
                plan="free",
                avatar_url=str(profile.get("picture") or "")[:512],
            )
            db.add(user)
            await db.flush()
            if grant > 0:
                db.add(
                    WalletLedger(
                        user_id=user.id,
                        delta_fen=grant,
                        balance_after=grant,
                        kind="grant",
                        ref_type="signup",
                        ref_id=str(user.id),
                        note="signup_grant",
                    )
                )
            await db.commit()
            await db.refresh(user)
        app_token = create_access_token(str(user.id))
    return RedirectResponse(_frontend_url(query={"next": next_path}, token=app_token))


@router.get(
    "/dev-token",
    summary="读取本地测试令牌",
    description="仅 loopback + DEBUG + AUTH_LOCAL_TOKEN_DEBUG=true 时返回当前 PRINTFILM JWT。",
)
async def dev_token(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    user: User = Depends(get_current_user),
) -> dict[str, object]:
    _ = user
    if not (_is_local_request(request) and settings.debug and settings.auth_local_token_debug):
        raise HTTPException(status_code=404, detail="Not found")
    if creds is None:
        raise HTTPException(status_code=401, detail="未登录")
    return {
        "access_token": creds.credentials,
        "token_type": "bearer",
        "expires_in": int(settings.access_token_expire_minutes) * 60,
        "local_only": True,
    }


@router.post(
    "/register",
    response_model=TokenResponse,
    summary="注册账号",
    description="使用邮箱、密码和昵称注册账号，按系统配置初始化额度及注册赠送余额，成功后返回访问令牌。已注册邮箱返回 400。",
    response_description="注册成功的访问令牌",
)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await get_user_by_email(db, body.email)
    if existing:
        raise HTTPException(status_code=400, detail="邮箱已注册")
    grant = int(settings.billing_signup_grant_fen or 0)
    user = User(
        email=body.email.lower(),
        nickname=body.nickname,
        hashed_password=hash_password(body.password),
        quota_left=settings.new_user_quota,
        balance_fen=grant,
        plan="free",
    )
    db.add(user)
    await db.flush()
    if grant > 0:
        db.add(
            WalletLedger(
                user_id=user.id,
                delta_fen=grant,
                balance_after=grant,
                kind="grant",
                ref_type="signup",
                ref_id=str(user.id),
                note="signup_grant",
            )
        )
    await db.commit()
    await db.refresh(user)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="邮箱密码登录",
    description="验证邮箱和密码并签发访问令牌；邮箱或密码错误返回 401。",
    response_description="登录成功的访问令牌",
)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await get_user_by_email(db, body.email.lower())
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post(
    "/toraapi",
    response_model=TokenResponse,
    summary="เข้าสู่ระบบด้วย ToraAPI Token หรือบัญชี ToraAPI",
    description="ตรวจสอบ ToraAPI API Key / Access Token / JSON หรือ Username/Password ดึงเครดิตคงเหลือจาก ToraAPI และออก access_token สำหรับใช้งานระบบ",
    response_description="โทเค็นสำหรับเข้าใช้งานระบบพร้อมข้อมูลผู้ใช้",
)
async def login_with_toraapi(
    body: ToraApiLoginRequest | None = None,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    from app.services.auth import decode_token
    from app.services.tokenfree_usage import (
        clean_toraapi_token,
        login_or_sync_toraapi_user,
        login_with_toraapi_credentials,
    )

    raw_token = ""
    nickname = ""
    username = ""
    password = ""
    turnstile = ""
    if body is not None:
        raw_token = (body.token or "").strip()
        nickname = (body.nickname or "").strip()
        username = (body.username or "").strip()
        password = body.password or ""
        turnstile = (body.turnstile or "").strip()

    # Only fall back to Authorization header if body has neither token nor username/password,
    # AND the Authorization header is not our own local Printfilm JWT.
    if not raw_token and not (username and password) and creds is not None and (creds.credentials or "").strip():
        cand = creds.credentials.strip()
        if decode_token(cand) is None:
            raw_token = cand

    try:
        if not raw_token and username and password:
            user, _account = await login_with_toraapi_credentials(
                db,
                username,
                password,
                turnstile=turnstile,
                nickname=nickname,
            )
        else:
            if not clean_toraapi_token(raw_token):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="กรุณากรอก ToraAPI API Key (เช่น sk-...) หรือวางข้อมูลเข้าสู่ระบบจาก toraapi.com",
                )
            user, _account = await login_or_sync_toraapi_user(db, raw_token, nickname=nickname)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        user=UserOut.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserOut,
    summary="获取当前用户资料",
    description="需要登录，返回当前用户的账号资料、套餐、额度及余额信息。",
    response_description="当前用户资料",
)
async def me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if (getattr(user, "toraapi_token", "") or "").strip():
        from app.services.tokenfree_usage import sync_user_toraapi_balance

        await sync_user_toraapi_balance(db, user)
        await db.commit()
        await db.refresh(user)
    return user


@router.post(
    "/change-password",
    summary="修改登录密码",
    description="需要登录并校验当前密码；新密码不能与当前密码相同，成功后返回 ok。",
    response_description="密码修改结果",
)
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, bool]:
    """需要登录并校验当前密码；新密码不能与当前密码相同，成功后返回 ok。"""
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="新密码不能与当前密码相同")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


@router.post(
    "/forgot-password",
    summary="申请重置密码",
    description="向指定邮箱发送密码重置邮件。接口统一返回提示以避免泄露账号是否存在；重置服务不可用时返回 503。",
    response_description="密码重置申请结果",
)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """向指定邮箱发送密码重置邮件。接口统一返回提示以避免泄露账号是否存在；重置服务不可用时返回 503。"""
    try:
        return await request_password_reset(db, str(body.email))
    except RedisUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post(
    "/reset-password",
    summary="通过令牌重置密码",
    description="使用邮件中的一次性令牌设置新密码；令牌无效返回 400，重置服务不可用返回 503。",
    response_description="密码重置结果",
)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """使用邮件中的一次性令牌设置新密码；令牌无效返回 400，重置服务不可用返回 503。"""
    try:
        await apply_password_reset(db, token=body.token, new_password=body.new_password)
    except RedisUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InvalidTokenError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.patch(
    "/me",
    response_model=UserOut,
    summary="更新当前用户资料",
    description="需要登录，更新昵称、登录邮箱和联系手机号。手机号仅保存，不发送验证码；邮箱被占用或资料无效时返回 400。",
    response_description="更新后的用户资料",
)
async def update_me(
    body: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """需要登录，更新昵称、登录邮箱和联系手机号。手机号仅保存，不发送验证码；邮箱被占用或资料无效时返回 400。"""
    try:
        fields = prepare_profile_update(
            nickname=body.nickname,
            email=body.email,
            phone=body.phone,
        )
    except ProfileError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if fields["email"] != user.email:
        taken = await get_user_by_email(db, fields["email"])
        if taken and taken.id != user.id:
            raise HTTPException(status_code=400, detail="该邮箱已被使用")

    user.nickname = fields["nickname"]
    user.email = fields["email"]
    user.phone = fields["phone"]
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/avatar",
    response_model=UserOut,
    summary="上传用户头像",
    description=(
        "需要登录，通过 multipart/form-data 上传或替换头像。"
        "支持 JPG、PNG、WebP、GIF，文件不能为空且最大 5 MB。"
    ),
    response_description="包含新头像地址的用户资料",
)
async def upload_avatar(
    file: UploadFile = File(..., description="头像文件，支持 JPG、PNG、WebP、GIF，最大 5 MB"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    """需要登录，通过 multipart/form-data 上传或替换头像。支持 JPG、PNG、WebP、GIF，文件不能为空且最大 5 MB。"""
    content_type = (file.content_type or "").lower()
    allowed = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    ext = allowed.get(content_type)
    if not ext:
        suffix = Path(file.filename or "").suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            ext = ".jpg" if suffix == ".jpeg" else suffix
        else:
            raise HTTPException(status_code=400, detail="仅支持 JPG / PNG / WebP / GIF")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="空文件")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="头像不能超过 5MB")

    dest = storage.user_dir(user.id) / f"avatar{ext}"
    dest.write_bytes(raw)
    user.avatar_url = storage.publish_local(dest)
    await db.commit()
    await db.refresh(user)
    return user
