from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    AUTO_CREATE_TABLES: bool = True
    ENABLE_API_DOCS: bool = True

    DATABASE_URL: str = "postgresql://localhost/productivity_hub"
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 72
    ACCESS_TOKEN_TTL_MINUTES: int = 15
    REFRESH_TOKEN_SECRET_KEY: str = ""
    REFRESH_TOKEN_TTL_DAYS: int = 14
    REFRESH_COOKIE_NAME: str = "quorex_refresh_token"
    REFRESH_COOKIE_DOMAIN: str = ""
    REFRESH_COOKIE_SAMESITE: str = "lax"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_API_KEY: str = ""
    OLLAMA_AUTH_HEADER: str = "Authorization"
    OLLAMA_AUTH_SCHEME: str = "Bearer"
    CHAT_ENABLED: bool = True
    CHAT_MAX_INPUT_CHARS: int = 2000
    CHAT_MAX_OUTPUT_TOKENS: int = 400
    CHAT_RATE_LIMIT_PER_MINUTE: int = 10
    CHAT_DAILY_REQUEST_LIMIT: int = 100
    ALLOW_NEW_REGISTRATIONS: bool = True
    NOVU_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5173"

    CORS_ORIGINS: str = "http://localhost:5173"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"
    FORCE_HTTPS: bool = False
    ENABLE_SECURITY_HEADERS: bool = True
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = True
    MAX_REQUEST_BODY_BYTES: int = 1_048_576
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    RATE_LIMIT_MAX_REQUESTS: int = 180
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 60
    AUTH_RATE_LIMIT_MAX_REQUESTS: int = 10
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.05
    CONTENT_SECURITY_POLICY: str = (
        "default-src 'self'; "
        "img-src 'self' data: https:; "
        "style-src 'self' 'unsafe-inline'; "
        "script-src 'self' 'unsafe-inline'; "
        "connect-src 'self' https: ws: wss:; "
        "font-src 'self' data:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    @property
    def async_database_url(self) -> str:
        return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        return [host.strip() for host in self.ALLOWED_HOSTS.split(",") if host.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def refresh_secret_key(self) -> str:
        # Falls back to JWT secret for easier local setup. In production,
        # set REFRESH_TOKEN_SECRET_KEY explicitly so access and refresh secrets differ.
        return self.REFRESH_TOKEN_SECRET_KEY or self.JWT_SECRET_KEY

    class Config:
        env_file = ".env"


settings = Settings()
