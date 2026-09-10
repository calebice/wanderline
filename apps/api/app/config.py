from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "wanderline"
    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://drawcoach:drawcoach@postgres:5432/drawcoach"
    cors_origins: str = "http://localhost:3000"
    s3_endpoint_url: str = "http://minio:9000"
    s3_bucket: str = "drawcoach"
    s3_access_key_id: str = "drawcoach"
    s3_secret_access_key: str = "drawcoach-development-only"
    max_upload_bytes: int = 15_728_640
    max_image_pixels: int = 24_000_000
    max_lesson_images: int = 6
    lesson_display_max_edge: int = 2400
    redis_url: str = "redis://redis:6379/0"
    lesson_generation_provider: str = "auto"
    openai_api_key: str | None = None
    openai_lesson_model: str = "gpt-5.6-terra"
    openai_image_model: str = "gpt-image-2"

    openai_timeout_seconds: int = 600
    openai_text_max_output_tokens: int = 16000
    openai_section_max_output_tokens: int = 4000
    openai_validation_max_output_tokens: int = 2000


settings = Settings()
