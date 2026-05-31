"""GitHub 设置 API 测试。"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_github_test_without_token_returns_400(client: AsyncClient) -> None:
    res = await client.post("/settings/github/test")
    assert res.status_code == 400
    assert "未配置 Token" in res.json()["detail"]


@pytest.mark.asyncio
async def test_github_test_with_body_token_success(client: AsyncClient) -> None:
    with patch(
        "app.api.settings.test_github_token",
        new=AsyncMock(return_value=(True, "连接成功")),
    ) as mock_test:
        res = await client.post(
            "/settings/github/test",
            json={"token": "ghp_testtoken1234567890"},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is True
    assert data["message"] == "连接成功"
    mock_test.assert_awaited_once_with("ghp_testtoken1234567890")


@pytest.mark.asyncio
async def test_github_test_with_body_token_failure(client: AsyncClient) -> None:
    with patch(
        "app.api.settings.test_github_token",
        new=AsyncMock(return_value=(False, "GitHub token expired or invalid")),
    ):
        res = await client.post(
            "/settings/github/test",
            json={"token": "ghp_invalid"},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["ok"] is False
    assert "invalid" in (data["message"] or "")


@pytest.mark.asyncio
async def test_github_test_saved_token_after_put(client: AsyncClient) -> None:
    await client.put("/settings/github", json={"token": "ghp_savedtoken1234567890"})

    with patch(
        "app.api.settings.test_github_token",
        new=AsyncMock(return_value=(True, "连接成功")),
    ) as mock_test:
        res = await client.post("/settings/github/test")

    assert res.status_code == 200
    assert res.json()["ok"] is True
    mock_test.assert_awaited_once_with("ghp_savedtoken1234567890")


@pytest.mark.asyncio
async def test_github_settings_has_token_after_put(client: AsyncClient) -> None:
    res = await client.put("/settings/github", json={"token": "ghp_abcdefghijklmnop"})
    assert res.status_code == 200
    data = res.json()
    assert data["has_token"] is True
    assert data["token_preview"] == "mnop"
    assert data["token_length"] == len("ghp_abcdefghijklmnop")

    get_res = await client.get("/settings/github")
    assert get_res.json()["has_token"] is True


@pytest.mark.asyncio
async def test_github_profile_without_token_returns_424(client: AsyncClient) -> None:
    res = await client.get("/settings/github/profile")
    assert res.status_code == 424


@pytest.mark.asyncio
async def test_github_profile_returns_user(client: AsyncClient) -> None:
    await client.put("/settings/github", json={"token": "ghp_abcdefghijklmnop"})

    with patch(
        "app.api.settings.fetch_github_user",
        new=AsyncMock(
            return_value={
                "login": "octocat",
                "name": "The Octocat",
                "avatar_url": "https://github.com/images/error/octocat_happy.gif",
                "html_url": "https://github.com/octocat",
            }
        ),
    ):
        res = await client.get("/settings/github/profile")

    assert res.status_code == 200
    data = res.json()
    assert data["login"] == "octocat"
    assert data["name"] == "The Octocat"
    assert data["avatar_url"].startswith("https://")
    assert data["html_url"] == "https://github.com/octocat"
