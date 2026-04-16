import os
import time
import logging
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import text

from server.database import engine
from server.models.base import Base
import server.models  # noqa: F401 — register all models
from server.services.scheduler import start_scheduler, stop_scheduler
from server.config import settings
from server.middleware.guardrails import InMemoryRateLimiter, get_client_ip
from server.observability import configure_logging, init_sentry

from server.routes.auth import router as auth_router
from server.routes.calendar import router as calendar_router
from server.routes.notes import router as notes_router
from server.routes.goals import router as goals_router
from server.routes.milestones import router as milestones_router
from server.routes.journal import router as journal_router
from server.routes.habits import router as habits_router
from server.routes.chat import router as chat_router
from server.routes.focus import router as focus_router
from server.routes.canvas import router as canvas_router
from server.routes.todos import router as todos_router
from server.routes.thoughts import router as thoughts_router
from server.routes.activity import router as activity_router
from server.routes.tags import router as tags_router
from server.routes.notifications import router as notifications_router
from server.routes.users import router as users_router

configure_logging()
init_sentry()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables only in environments where this is explicitly enabled.
    if settings.AUTO_CREATE_TABLES:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    start_scheduler()
    yield
    stop_scheduler()


docs_url = "/docs" if settings.ENABLE_API_DOCS else None
redoc_url = "/redoc" if settings.ENABLE_API_DOCS else None
openapi_url = "/openapi.json" if settings.ENABLE_API_DOCS else None

app = FastAPI(
    title="Quorex",
    lifespan=lifespan,
    docs_url=docs_url,
    redoc_url=redoc_url,
    openapi_url=openapi_url,
)
rate_limiter = InMemoryRateLimiter()

# CORS is strict by default and only allows configured frontend origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)

if settings.FORCE_HTTPS:
    app.add_middleware(HTTPSRedirectMiddleware)

if settings.allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    start = time.perf_counter()
    path = request.url.path
    client_ip = get_client_ip(request)
    user_id = None

    def apply_response_headers(response):
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{time.perf_counter() - start:.5f}"

        if settings.ENABLE_SECURITY_HEADERS:
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
            response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
            response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
            response.headers["Content-Security-Policy"] = settings.CONTENT_SECURITY_POLICY
            if settings.FORCE_HTTPS:
                response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    if settings.MAX_REQUEST_BODY_BYTES > 0 and request.method in {"POST", "PUT", "PATCH"}:
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit():
            if int(content_length) > settings.MAX_REQUEST_BODY_BYTES:
                response = JSONResponse(
                    status_code=413,
                    content={"detail": "Request body is too large."},
                )
                response.headers["Retry-After"] = "5"
                return apply_response_headers(response)

    if settings.RATE_LIMIT_ENABLED and path.startswith("/api"):
        is_auth = path.startswith("/api/auth/login") or path.startswith("/api/auth/register") or path.startswith("/api/auth/refresh")
        if is_auth:
            max_requests = settings.AUTH_RATE_LIMIT_MAX_REQUESTS
            window_seconds = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS
            scope = "auth"
        else:
            max_requests = settings.RATE_LIMIT_MAX_REQUESTS
            window_seconds = settings.RATE_LIMIT_WINDOW_SECONDS
            scope = "api"

        key = f"{scope}:{client_ip}"
        allowed, retry_after = rate_limiter.check(
            key=key,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )
        if not allowed:
            response = JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again shortly."},
            )
            response.headers["Retry-After"] = str(retry_after)
            return apply_response_headers(response)

    response = await call_next(request)
    should_log_request = (
        path.startswith("/api")
        or path.startswith("/health/")
        or path in {"/healthz", "/readyz"}
    )
    if should_log_request:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            user_id = "token"
        logger.info(
            "request.completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": path,
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                "client_ip": client_ip,
                "user_id": user_id,
            },
        )
    return apply_response_headers(response)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    logger.exception(
        "request.unhandled_exception",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": 500,
            "client_ip": get_client_ip(request),
        },
    )
    response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
    response.headers["X-Request-ID"] = request_id
    return response

# --- API routers (all prefixed under /api) ---
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(calendar_router, prefix="/api", tags=["calendar"])
app.include_router(notes_router, prefix="/api", tags=["notes"])
app.include_router(goals_router, prefix="/api", tags=["goals"])
app.include_router(milestones_router, prefix="/api", tags=["milestones"])
app.include_router(journal_router, prefix="/api", tags=["journal"])
app.include_router(habits_router, prefix="/api", tags=["habits"])
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(focus_router, prefix="/api", tags=["focus"])
app.include_router(canvas_router, prefix="/api", tags=["canvas"])
app.include_router(todos_router, prefix="/api", tags=["todos"])
app.include_router(thoughts_router, prefix="/api", tags=["thoughts"])
app.include_router(activity_router, prefix="/api", tags=["activity"])
app.include_router(tags_router, prefix="/api", tags=["tags"])
app.include_router(notifications_router, prefix="/api", tags=["notifications"])
app.include_router(users_router, prefix="/api", tags=["users"])


@app.get("/health/live")
async def live_health():
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness_health():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return JSONResponse(status_code=503, content={"status": "not_ready"})


@app.get("/healthz")
async def healthz():
    """Common path used by cloud load balancers and uptime probes."""
    return await live_health()


@app.get("/readyz")
async def readyz():
    """Common readiness probe alias for orchestrators."""
    return await readiness_health()


# --- SPA serving (production: Vite build output) ---
DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "client", "dist")

if os.path.isdir(DIST_DIR):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """Serve index.html for client-side routing."""
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app", host="0.0.0.0", port=5000, reload=True)
