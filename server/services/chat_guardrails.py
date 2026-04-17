from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.config import settings
from server.middleware.guardrails import InMemoryRateLimiter
from server.models.chat_usage_daily import ChatUsageDaily

_chat_rate_limiter = InMemoryRateLimiter()


async def enforce_chat_limits(db: AsyncSession, user_id: int, message: str) -> None:
    if not settings.CHAT_ENABLED:
        raise HTTPException(status_code=503, detail="Chat is temporarily disabled.")

    message_length = len(message.strip())
    if message_length == 0:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if message_length > settings.CHAT_MAX_INPUT_CHARS:
        raise HTTPException(
            status_code=413,
            detail=f"Message too long. Maximum {settings.CHAT_MAX_INPUT_CHARS} characters.",
        )

    allowed, retry_after = _chat_rate_limiter.check(
        key=f"chat-user:{user_id}",
        max_requests=settings.CHAT_RATE_LIMIT_PER_MINUTE,
        window_seconds=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Chat rate limit exceeded. Retry in about {retry_after} seconds.",
        )

    usage_date = datetime.now(timezone.utc).date()
    result = await db.execute(
        select(ChatUsageDaily).where(
            ChatUsageDaily.user_id == user_id,
            ChatUsageDaily.usage_date == usage_date,
        )
    )
    usage_row = result.scalar_one_or_none()

    if usage_row is None:
        usage_row = ChatUsageDaily(
            user_id=user_id,
            usage_date=usage_date,
            request_count=1,
            updated_at=datetime.now(timezone.utc),
        )
        db.add(usage_row)
        await db.flush()
        return

    if usage_row.request_count >= settings.CHAT_DAILY_REQUEST_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily chat quota reached ({settings.CHAT_DAILY_REQUEST_LIMIT} requests).",
        )

    usage_row.request_count += 1
    usage_row.updated_at = datetime.now(timezone.utc)
    await db.flush()
