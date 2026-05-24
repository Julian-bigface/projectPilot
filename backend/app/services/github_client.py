"""调用 GitHub REST API（测试连接、仓库元数据等）。"""

from __future__ import annotations

from typing import Any

import httpx

GITHUB_API_USER = "https://api.github.com/user"
USER_AGENT = "ProjectPilot/0.1 (GitHub integration)"

GITHUB_HEADERS_BASE = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": USER_AGENT,
}


def github_auth_headers(token: str) -> dict[str, str]:
    return {
        **GITHUB_HEADERS_BASE,
        "Authorization": f"Bearer {token}",
    }


def repo_api_url(owner: str, repo: str) -> str:
    return f"https://api.github.com/repos/{owner}/{repo}"


def latest_release_api_url(owner: str, repo: str) -> str:
    return f"https://api.github.com/repos/{owner}/{repo}/releases/latest"


def readme_api_url(owner: str, repo: str) -> str:
    return f"https://api.github.com/repos/{owner}/{repo}/readme"


def releases_api_url(owner: str, repo: str) -> str:
    return f"https://api.github.com/repos/{owner}/{repo}/releases"


async def fetch_repository_json(owner: str, repo: str, token: str) -> dict[str, Any] | None:
    """GET /repos/{owner}/{repo}；失败返回 None。"""
    headers = github_auth_headers(token)
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.get(repo_api_url(owner, repo), headers=headers)
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        return None
    return data if isinstance(data, dict) else None


async def fetch_latest_release_tag(owner: str, repo: str, token: str) -> str | None:
    """GET /releases/latest 的 tag_name；无 release 或失败时为 None。"""
    headers = github_auth_headers(token)
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(latest_release_api_url(owner, repo), headers=headers)
    except httpx.HTTPError:
        return None
    if r.status_code == 404:
        return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(data, dict):
        return None
    tag = data.get("tag_name")
    return tag if isinstance(tag, str) and tag.strip() else None


async def fetch_readme_raw(owner: str, repo: str, token: str) -> str | None:
    """GET /readme 原始 Markdown；失败返回 None。"""
    headers = {
        **github_auth_headers(token),
        "Accept": "application/vnd.github.raw",
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(readme_api_url(owner, repo), headers=headers)
    except httpx.HTTPError:
        return None
    if r.status_code == 404:
        return None
    if r.status_code != 200:
        return None
    text = r.text
    return text if isinstance(text, str) and text.strip() else None


async def fetch_releases(
    owner: str, repo: str, token: str, *, per_page: int = 30
) -> list[dict[str, Any]]:
    """GET /releases 列表；失败返回空列表。"""
    headers = github_auth_headers(token)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                releases_api_url(owner, repo),
                headers=headers,
                params={"per_page": per_page},
            )
    except httpx.HTTPError:
        return []
    if r.status_code != 200:
        return []
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        return []
    if not isinstance(data, list):
        return []
    return [item for item in data if isinstance(item, dict)]


async def test_github_token(token: str) -> tuple[bool, str | None]:
    """使用 Token 请求 GET /user，返回 (是否成功, 说明信息)。"""
    headers = github_auth_headers(token)
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(GITHUB_API_USER, headers=headers)
    except httpx.HTTPError as e:
        return False, str(e)
    if r.status_code == 200:
        try:
            login = r.json().get("login")
        except Exception:  # noqa: BLE001
            login = None
        msg = f"已连接为 @{login}" if login else "连接成功"
        return True, msg
    detail = r.text[:500] if r.text else r.reason_phrase
    return False, f"HTTP {r.status_code}: {detail}"
