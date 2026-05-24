"""添加项目对话框：按 GitHub URL 预览仓库简介。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.project_github import GithubRepoPreviewRead
from app.services.github_client import repo_api_url
from app.services.github_parse import parse_owner_repo
from app.services.settings_github import effective_github_token, get_github_token_row


@dataclass
class _FetchOutcome:
    data: dict[str, Any] | None
    error: str | None


async def _fetch_repository_or_error(owner: str, repo: str, token: str | None) -> _FetchOutcome:
    if not token:
        return _FetchOutcome(
            None,
            "未配置 GitHub Token，无法自动获取仓库简介。可在设置中配置 Token 后重试。",
        )
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ProjectPilot/0.1 (GitHub integration)",
        "Authorization": f"Bearer {token}",
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(repo_api_url(owner, repo), headers=headers)
    except httpx.TimeoutException:
        return _FetchOutcome(None, "连接 GitHub 超时，请检查网络后重试。")
    except httpx.HTTPError as exc:
        return _FetchOutcome(None, f"网络错误：无法连接 GitHub（{exc.__class__.__name__}）。")

    if response.status_code == 404:
        return _FetchOutcome(None, "仓库不存在或当前 Token 无权访问该仓库。")
    if response.status_code == 403:
        return _FetchOutcome(None, "GitHub 访问受限（可能触发频率限制），请稍后重试。")
    if response.status_code != 200:
        detail = (response.text or response.reason_phrase or "")[:200]
        return _FetchOutcome(None, f"GitHub 返回 HTTP {response.status_code}：{detail}".strip())

    try:
        data = response.json()
    except Exception:  # noqa: BLE001
        return _FetchOutcome(None, "GitHub 响应解析失败。")
    if not isinstance(data, dict):
        return _FetchOutcome(None, "GitHub 响应格式异常。")
    return _FetchOutcome(data, None)


async def preview_github_repository(db: AsyncSession, github_url: str) -> GithubRepoPreviewRead:
    parsed = parse_owner_repo("", github_url)
    if not parsed:
        return GithubRepoPreviewRead(error="无法从 URL 解析 owner/repo。")

    owner, repo = parsed
    token = effective_github_token(await get_github_token_row(db), settings.github_token)
    outcome = await _fetch_repository_or_error(owner, repo, token)
    if outcome.error:
        return GithubRepoPreviewRead(
            full_name=f"{owner}/{repo}",
            fetched=False,
            error=outcome.error,
        )

    data = outcome.data or {}
    fn = data.get("full_name")
    full_name = fn.strip() if isinstance(fn, str) and fn.strip() else f"{owner}/{repo}"
    desc = data.get("description")
    description = desc.strip() if isinstance(desc, str) and desc.strip() else None
    return GithubRepoPreviewRead(
        full_name=full_name,
        description=description,
        fetched=True,
        error=None if description else "该仓库在 GitHub 上未填写 Description。",
    )
