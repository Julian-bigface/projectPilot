import pytest
from httpx import AsyncClient

from app.services.readme_image_proxy import is_safe_readme_image_url


@pytest.mark.parametrize(
    "url",
    [
        "https://raw.githubusercontent.com/o/r/main/a.png",
        "https://img.shields.io/badge/MIT-blue",
    ],
)
def test_safe_readme_image_url_allows_public_https(url: str) -> None:
    assert is_safe_readme_image_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/secret.png",
        "file:///etc/passwd",
        "ftp://example.com/a.png",
    ],
)
def test_safe_readme_image_url_blocks_unsafe(url: str) -> None:
    assert not is_safe_readme_image_url(url)


@pytest.mark.asyncio
async def test_readme_image_proxy_rejects_invalid_url(client: AsyncClient) -> None:
    res = await client.get("/projects/readme-image-proxy", params={"url": "http://127.0.0.1/x.png"})
    assert res.status_code == 400
