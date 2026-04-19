import logging
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.database import get_db
from server.auth import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    generate_token_id,
    hash_password,
    verify_password,
    verify_refresh_token,
    verify_reset_token,
)
from server.models.refresh_token import RefreshToken
from server.models.user import User
from server.services.novu_service import trigger_password_reset, sync_subscriber_profile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="")


class RegisterBody(BaseModel):
    name: str | None = None
    firstName: str
    lastName: str
    email: EmailStr
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    token: str
    password: str


def _cookie_secure() -> bool:
    return settings.FORCE_HTTPS or settings.is_production


def _set_refresh_cookie(response: Response, token: str) -> None:
    cookie_kwargs = {
        "key": settings.REFRESH_COOKIE_NAME,
        "value": token,
        "httponly": True,
        "secure": _cookie_secure(),
        "samesite": settings.REFRESH_COOKIE_SAMESITE,
        "max_age": settings.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
        "path": "/api/auth",
    }
    if settings.REFRESH_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.REFRESH_COOKIE_DOMAIN
    response.set_cookie(**cookie_kwargs)


def _clear_refresh_cookie(response: Response) -> None:
    delete_kwargs = {
        "key": settings.REFRESH_COOKIE_NAME,
        "path": "/api/auth",
    }
    if settings.REFRESH_COOKIE_DOMAIN:
        delete_kwargs["domain"] = settings.REFRESH_COOKIE_DOMAIN
    response.delete_cookie(**delete_kwargs)


def _extract_client_metadata(request: Request) -> tuple[str | None, str | None]:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else None
    if not client_ip and request.client:
        client_ip = request.client.host
    user_agent = request.headers.get("user-agent")
    return client_ip, user_agent


async def _issue_session_tokens(
    *,
    user: User,
    db: AsyncSession,
    request: Request,
    response: Response,
    token_family: str | None = None,
    previous_jti: str | None = None,
) -> dict:
    access_token = create_access_token(user.id)
    jti = generate_token_id()
    family = token_family or generate_token_id()
    refresh_token = create_refresh_token(user.id, jti=jti, token_family=family)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS)
    ip_address, user_agent = _extract_client_metadata(request)

    db.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            token_family=family,
            expires_at=expires_at,
            replaced_by_jti=None,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
        )
    )

    if previous_jti:
        result = await db.execute(select(RefreshToken).where(RefreshToken.jti == previous_jti))
        existing = result.scalar_one_or_none()
        if existing and existing.revoked_at is None:
            existing.revoked_at = datetime.now(timezone.utc)
            existing.replaced_by_jti = jti

    _set_refresh_cookie(response, refresh_token)
    return {"token": access_token, "user": user.to_dict()}


@router.post("/register")
async def register(body: RegisterBody, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    if not settings.ALLOW_NEW_REGISTRATIONS:
        raise HTTPException(
            status_code=403,
            detail="New account registration is temporarily disabled.",
        )

    email = str(body.email).strip().lower()
    first_name = body.firstName.strip()
    last_name = body.lastName.strip()

    if not first_name:
        raise HTTPException(status_code=400, detail="First name is required.")
    if not last_name:
        raise HTTPException(status_code=400, detail="Last name is required.")
    # Check if email is already taken
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    try:
        await sync_subscriber_profile(
            subscriber_id=user.email,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            in_app_enabled=True,
            email_enabled=True,
        )
    except Exception:
        logger.exception("Failed to sync Novu subscriber profile during registration for user %s", user.id)

    return await _issue_session_tokens(user=user, db=db, request=request, response=response)


@router.post("/login")
async def login(body: LoginBody, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    email = str(body.email).strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return await _issue_session_tokens(user=user, db=db, request=request, response=response)


@router.post("/refresh")
async def refresh_session(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_cookie = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not refresh_cookie:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    claims = verify_refresh_token(refresh_cookie)
    if not claims:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(RefreshToken).where(RefreshToken.jti == claims["jti"]))
    token_row = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if not token_row:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh token not recognized")
    if token_row.revoked_at is not None:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh token already used")
    if token_row.expires_at <= now:
        token_row.revoked_at = now
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user_result = await db.execute(select(User).where(User.id == claims["user_id"]))
    user = user_result.scalar_one_or_none()
    if not user:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="User no longer exists")

    return await _issue_session_tokens(
        user=user,
        db=db,
        request=request,
        response=response,
        token_family=claims["family"],
        previous_jti=claims["jti"],
    )


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_cookie = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if refresh_cookie:
        claims = verify_refresh_token(refresh_cookie)
        if claims:
            result = await db.execute(select(RefreshToken).where(RefreshToken.jti == claims["jti"]))
            token_row = result.scalar_one_or_none()
            if token_row and token_row.revoked_at is None:
                token_row.revoked_at = datetime.now(timezone.utc)

    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody, db: AsyncSession = Depends(get_db)):
    email = str(body.email).strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user:
        token = create_reset_token(user.id, user.password_hash)
        reset_link = f"{settings.FRONTEND_URL}/reset-password/{token}"
        logger.info("Password reset link for %s: %s", user.email, reset_link)
        try:
            await trigger_password_reset(user.email, user.display_name, reset_link)
        except Exception:
            logger.exception("Failed to send password reset email via Novu")

    return {"message": "If an account exists with that email, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordBody, db: AsyncSession = Depends(get_db)):
    claims = verify_reset_token(body.token)
    if not claims:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    result = await db.execute(select(User).where(User.id == claims["user_id"]))
    user = result.scalar_one_or_none()
    if not user or user.password_hash[:10] != claims["fingerprint"]:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    if verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Please choose a different password.")

    user.password_hash = hash_password(body.password)

    # Revoke all active refresh tokens for this user so existing sessions are
    # invalidated immediately after a password reset.
    now = datetime.now(timezone.utc)
    token_rows = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    for row in token_rows.scalars():
        row.revoked_at = now

    await db.flush()
    return {"message": "Password reset successfully."}
