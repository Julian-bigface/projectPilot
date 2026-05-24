"""GitHub 集成设置 API 契约。"""

from pydantic import BaseModel, Field


class GithubSettingsRead(BaseModel):
    """GET 响应：不返回完整 Token。"""

    has_token: bool = Field(description="是否存在可用 Token（数据库或环境变量）")
    token_preview: str | None = Field(
        default=None,
        description="仅当 Token 保存在数据库时返回末 4 位；仅从环境变量读取时不返回末位",
    )


class GithubSettingsUpdate(BaseModel):
    token: str | None = Field(
        default=None,
        description="写入数据库；传 null 或空字符串表示清除数据库中的 Token",
    )


class GithubTestResponse(BaseModel):
    ok: bool
    message: str | None = None
