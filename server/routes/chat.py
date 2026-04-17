import json
import uuid

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from server.database import get_db
from server.auth import get_current_user
from server.models.chat_message import ChatMessage
from server.services.ollama_service import get_ollama_response, stream_ollama_response
from server.services.context_builder import build_context
from server.services.chat_guardrails import enforce_chat_limits

router = APIRouter(prefix="")


class ChatBody(BaseModel):
    message: str
    sessionId: str | None = None


class StreamBody(BaseModel):
    message: str
    sessionId: str | None = None


@router.post("/chat")
async def chat(
    body: ChatBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await enforce_chat_limits(db=db, user_id=user.id, message=body.message)
    session_id = body.sessionId or str(uuid.uuid4())

    # Save user message
    user_msg = ChatMessage(
        user_id=user.id,
        role="user",
        content=body.message,
        mode="ollama",
        session_id=session_id,
    )
    db.add(user_msg)
    await db.flush()

    # Get conversation history
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    history = list(result.scalars().all())
    history.reverse()

    messages = [{"role": m.role, "content": m.content} for m in history]
    context = await build_context(db, user.id)
    response = await get_ollama_response(messages, context)

    # Save assistant message
    assistant_msg = ChatMessage(
        user_id=user.id,
        role="assistant",
        content=response,
        mode="ollama",
        session_id=session_id,
    )
    db.add(assistant_msg)
    await db.flush()

    return {
        "answer": response,
        "sessionId": session_id,
    }


@router.post("/chat/stream")
async def chat_stream(
    body: StreamBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await enforce_chat_limits(db=db, user_id=user.id, message=body.message)
    session_id = body.sessionId or str(uuid.uuid4())

    # Save user message
    user_msg = ChatMessage(
        user_id=user.id,
        role="user",
        content=body.message,
        mode="ollama",
        session_id=session_id,
    )
    db.add(user_msg)
    await db.flush()

    # Get conversation history
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    history = list(result.scalars().all())
    history.reverse()

    messages = [{"role": m.role, "content": m.content} for m in history]
    context = await build_context(db, user.id)

    async def generate():
        full_response = []
        yield f"data: {json.dumps({'sessionId': session_id})}\n\n"

        try:
            async for token in stream_ollama_response(messages, context):
                full_response.append(token)
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'token': f'Error: {str(e)}'})}\n\n"

        # Save the complete assistant message
        complete_text = "".join(full_response)
        if complete_text:
            from server.database import AsyncSessionLocal

            async with AsyncSessionLocal() as save_db:
                try:
                    assistant_msg = ChatMessage(
                        user_id=user.id,
                        role="assistant",
                        content=complete_text,
                        mode="ollama",
                        session_id=session_id,
                    )
                    save_db.add(assistant_msg)
                    await save_db.commit()
                except Exception:
                    await save_db.rollback()

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/chat/history")
async def get_history(
    sessionId: str | None = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    if not sessionId:
        return []

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user.id, ChatMessage.session_id == sessionId)
        .order_by(ChatMessage.created_at)
    )
    return [m.to_dict() for m in result.scalars().all()]


@router.get("/chat/sessions")
async def get_sessions(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(
            ChatMessage.session_id,
            func.min(ChatMessage.created_at).label("started"),
            func.max(ChatMessage.created_at).label("last_message"),
            func.count(ChatMessage.id).label("message_count"),
        )
        .where(ChatMessage.user_id == user.id)
        .group_by(ChatMessage.session_id)
        .order_by(func.max(ChatMessage.created_at).desc())
    )
    return [
        {
            "sessionId": row.session_id,
            "started": row.started.isoformat(),
            "lastMessage": row.last_message.isoformat(),
            "messageCount": row.message_count,
        }
        for row in result.all()
    ]


@router.post("/chat/sessions")
async def create_session(
    user=Depends(get_current_user),
):
    return {"sessionId": str(uuid.uuid4())}
