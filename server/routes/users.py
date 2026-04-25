import logging
from typing import Optional

from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.auth import get_current_user, verify_password, hash_password
from server.models.notification_preference import NotificationPreference
from server.models.user import User
from server.services.novu_service import sync_subscriber_profile

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: Optional[EmailStr] = None
    timezone: Optional[str] = None
    phoneNumber: Optional[str] = None


class ChangePassword(BaseModel):
    currentPassword: str
    newPassword: str


@router.get("/users/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    return user.to_dict()


@router.put("/users/profile")
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    should_sync_novu_subscriber = False

    def split_name_parts(full_name: str) -> tuple[str, str]:
        parts = [part for part in full_name.strip().split() if part]
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], " ".join(parts[1:])

    first_name = user.first_name
    last_name = user.last_name

    if body.firstName is not None:
        if not body.firstName.strip():
            raise HTTPException(status_code=400, detail="First name cannot be empty")
        first_name = body.firstName.strip()
        if first_name != user.first_name:
            should_sync_novu_subscriber = True

    if body.lastName is not None:
        if not body.lastName.strip():
            raise HTTPException(status_code=400, detail="Last name cannot be empty")
        last_name = body.lastName.strip()
        if last_name != user.last_name:
            should_sync_novu_subscriber = True

    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        parsed_first, parsed_last = split_name_parts(body.name)
        if not parsed_first:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        if body.lastName is None and not parsed_last:
            raise HTTPException(status_code=400, detail="Last name cannot be empty")
        first_name = parsed_first
        if body.lastName is None:
            last_name = parsed_last
        if first_name != user.first_name or last_name != user.last_name:
            should_sync_novu_subscriber = True

    if body.email is not None:
        new_email = body.email.strip().lower()
        if new_email != user.email:
            existing = await db.execute(
                select(User).where(User.email == new_email, User.id != user.id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Email already in use")
            user.email = new_email
            should_sync_novu_subscriber = True

    if body.timezone is not None:
        user.timezone = body.timezone or None

    user.first_name = first_name
    user.last_name = last_name

    await db.flush()

    if should_sync_novu_subscriber:
        prefs_result = await db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == user.id)
        )
        prefs = prefs_result.scalar_one_or_none()
        try:
            await sync_subscriber_profile(
                subscriber_id=user.email,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone_number=prefs.phone_number if prefs else None,
                in_app_enabled=prefs.in_app_notifications_enabled if prefs else None,
                email_enabled=prefs.email_notifications_enabled if prefs else None,
            )
        except Exception:
            logger.exception("Failed to sync Novu subscriber profile for user %s", user.id)

    await db.refresh(user)
    return user.to_dict()


@router.post("/users/change-password")
async def change_password(
    body: ChangePassword,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    if not verify_password(body.currentPassword, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.newPassword) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.password_hash = hash_password(body.newPassword)
    await db.flush()
    return {"message": "Password updated successfully"}
