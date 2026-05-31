"""调用 GitHub REST API（测试连接、仓库元数据等）。"""

from __future__ import annotations

import base64
from dataclasses import dataclass
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


def contents_api_url(owner: str, repo: str, path: str) -> str:
    from urllib.parse import quote

    encoded = quote(path, safe="/")
    return f"https://api.github.com/repos/{owner}/{repo}/contents/{encoded}"


def releases_api_url(owner: str, repo: str) -> str:
    return f"https://api.github.com/repos/{owner}/{repo}/releases"


@dataclass(frozen=True)
class ReadmeGithubResult:
    content: str
    sha: str
    path: str


def _decode_github_base64_content(content_b64: str) -> str | None:
    try:
        raw = base64.b64decode(content_b64, validate=False)
        return raw.decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        return None


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


async def fetch_repo_file_raw(
    owner: str,
    repo: str,
    token: str,
    path: str,
    *,
    ref: str | None = None,
) -> str | None:
    """GET /contents/{path} 原始文本；失败返回 None。"""
    headers = {
        **github_auth_headers(token),
        "Accept": "application/vnd.github.raw",
    }
    params = {"ref": ref} if ref else None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                contents_api_url(owner, repo, path),
                headers=headers,
                params=params,
            )
    except httpx.HTTPError:
        return None
    if r.status_code == 404:
        return None
    if r.status_code != 200:
        return None
    text = r.text
    return text if isinstance(text, str) and text.strip() else None


async def fetch_readme_from_github(
    owner: str, repo: str, token: str
) -> ReadmeGithubResult | None:
    """GET /readme JSON，返回 Markdown 正文与 blob sha。"""
    headers = github_auth_headers(token)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(readme_api_url(owner, repo), headers=headers)
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
    encoding = data.get("encoding")
    raw_content = data.get("content")
    sha = data.get("sha")
    path = data.get("path")
    if not isinstance(sha, str) or not sha.strip():
        return None
    if not isinstance(path, str) or not path.strip():
        return None
    text: str | None = None
    if encoding == "base64" and isinstance(raw_content, str):
        text = _decode_github_base64_content(raw_content)
    elif isinstance(raw_content, str) and raw_content.strip():
        text = raw_content
    if text is None or not text.strip():
        return None
    return ReadmeGithubResult(content=text, sha=sha.strip(), path=path.strip())


async def fetch_readme_raw(owner: str, repo: str, token: str) -> str | None:
    """GET /readme 原始 Markdown；失败返回 None。"""
    result = await fetch_readme_from_github(owner, repo, token)
    return result.content if result else None


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


async def search_repositories(
    q: str,
    token: str,
    *,
    sort: str = "stars",
    order: str = "desc",
    page: int = 1,
    per_page: int = 20,
) -> dict[str, Any] | None:
    """GET /search/repositories；失败返回 None。"""
    headers = github_auth_headers(token)
    params = {
        "q": q,
        "sort": sort,
        "order": order,
        "page": page,
        "per_page": per_page,
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(
                "https://api.github.com/search/repositories",
                headers=headers,
                params=params,
            )
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        return None
    return data if isinstance(data, dict) else None


async def fetch_github_user(token: str) -> dict[str, str] | None:
    """GET /user，返回 login、name、avatar_url、html_url；失败时返回 None。"""
    headers = github_auth_headers(token)
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.get(GITHUB_API_USER, headers=headers)
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(data, dict):
        return None
    login = data.get("login")
    if not isinstance(login, str) or not login.strip():
        return None
    profile: dict[str, str] = {
        "login": login.strip(),
        "avatar_url": str(data.get("avatar_url") or ""),
        "html_url": str(data.get("html_url") or f"https://github.com/{login.strip()}"),
    }
    name = data.get("name")
    if isinstance(name, str) and name.strip():
        profile["name"] = name.strip()
    return profile


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
