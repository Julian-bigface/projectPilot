"""GitHub 集成设置 API 契约。"""

from pydantic import BaseModel, Field


class GithubSettingsRead(BaseModel):
    """GET 响应：不返回完整 Token。"""

    has_token: bool = Field(description="是否存在可用 Token（数据库或环境变量）")
    token_preview: str | None = Field(
        default=None,
        description="仅当 Token 保存在数据库时返回末 4 位；仅从环境变量读取时不返回末位",
    )
    token_length: int | None = Field(
        default=None,
        description="仅当 Token 保存在数据库时返回字符长度；仅从环境变量读取时不返回",
    )


class GithubSettingsUpdate(BaseModel):
    token: str | None = Field(
        default=None,
        description="写入数据库；传 null 或空字符串表示清除数据库中的 Token",
    )


class GithubTestRequest(BaseModel):
    token: str | None = Field(
        default=None,
        description="可选：测试指定 Token；省略则测试当前生效 Token（数据库或环境变量）",
    )


class GithubProfileRead(BaseModel):
    login: str = Field(description="GitHub 用户名")
    name: str | None = Field(default=None, description="显示名称")
    avatar_url: str = Field(description="头像 URL")
    html_url: str = Field(description="GitHub 主页")


class GithubTestResponse(BaseModel):
    ok: bool
    message: str | None = None
