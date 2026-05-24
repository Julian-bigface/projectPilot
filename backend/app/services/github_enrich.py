"""根据 GitHub REST API 写入 Project 的卡片字段。"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.project import Project
from app.services.github_client import fetch_latest_release_tag, fetch_repository_json
from app.services.github_parse import parse_owner_repo
from app.services.project_tags_from_topics import sync_project_tags_from_github_topics
from app.services.settings_github import effective_github_token, get_github_token_row


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _parse_github_datetime(iso: str | None) -> datetime | None:
    if not iso or not isinstance(iso, str):
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return None


def _apply_license_from_repo_data(project: Project, data: dict) -> None:
    lic = data.get("license")
    if isinstance(lic, dict):
        spdx = lic.get("spdx_id")
        name = lic.get("name")
        if isinstance(spdx, str) and spdx.strip() and spdx.strip() != "NOASSERTION":
            project.license = spdx.strip()
        elif isinstance(name, str) and name.strip():
            project.license = name.strip()


async def try_enrich_project_from_github(
    db: AsyncSession, project: Project, *, stats_only: bool = False
) -> bool:
    """若存在 Token 且能拉取仓库，则更新项目并 commit；成功返回 True。

    stats_only=True 时仅更新 Stars / Forks / 推送时间 / 许可证 / latest release 标签，
    不改动仓库简介、topics、领域标签关联。
    """
    token = effective_github_token(await get_github_token_row(db), settings.github_token)
    if not token:
        return False
    parsed = parse_owner_repo(project.full_name, project.github_url)
    if not parsed:
        return False
    owner, repo = parsed
    data = await fetch_repository_json(owner, repo, token)
    if not data:
        return False

    project.stars = int(data.get("stargazers_count") or 0)
    project.forks = int(data.get("forks") or 0)
    pushed = data.get("pushed_at")
    project.github_pushed_at = (
        _parse_github_datetime(pushed) if isinstance(pushed, str) else None
    )
    _apply_license_from_repo_data(project, data)
    project.github_release_tag = await fetch_latest_release_tag(owner, repo, token)

    if stats_only:
        project.updated_at = _utcnow()
        await db.commit()
        await db.refresh(project)
        return True

    fn = data.get("full_name")
    if isinstance(fn, str) and fn.strip():
        project.full_name = fn.strip()
    desc = data.get("description")
    project.description = desc if isinstance(desc, str) else None
    lang = data.get("language")
    project.language = lang if isinstance(lang, str) else None
    owner_obj = data.get("owner")
    if isinstance(owner_obj, dict):
        login = owner_obj.get("login")
        if isinstance(login, str) and login.strip():
            project.author = login.strip()
    topics_raw = data.get("topics")
    if isinstance(topics_raw, list):
        project.topics = [t for t in topics_raw if isinstance(t, str)]
    else:
        project.topics = []
    project.updated_at = _utcnow()
    await sync_project_tags_from_github_topics(db, project.id, project.topics)
    await db.commit()
    await db.refresh(project)
    return True
