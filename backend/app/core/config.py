from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8000
    #: 非空时挂载前端 dist（桌面生产）；开发 Web 留空
    static_dir: str | None = None

    database_url: str = "sqlite+aiosqlite:///./project_pilot.db"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:38472",
    ]
    openai_api_key: str | None = None
    #: 可选环境变量 PAT（CI 等）；与数据库并存时以数据库为准（见 settings_github）
    github_token: str | None = Field(default=None, validation_alias="GITHUB_TOKEN")

    @field_validator("static_dir", mode="before")
    @classmethod
    def empty_static_dir(cls, v: object) -> str | None:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return str(v).strip()

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: object) -> list[str]:
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v  # type: ignore[return-value]


settings = Settings()
