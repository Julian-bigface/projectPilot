from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./project_pilot.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    openai_api_key: str | None = None
    #: 可选环境变量 PAT（CI 等）；与数据库并存时以数据库为准（见 settings_github）
    github_token: str | None = Field(default=None, validation_alias="GITHUB_TOKEN")


settings = Settings()
