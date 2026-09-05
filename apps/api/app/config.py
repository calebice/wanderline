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


settings = Settings()
