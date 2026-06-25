from __future__ import annotations

import ipaddress
from urllib.parse import urlparse

import httpx

_MAX_IMAGE_BYTES = 8 * 1024 * 1024
_FETCH_TIMEOUT = httpx.Timeout(20.0, connect=10.0)


def is_safe_readme_image_url(url: str) -> bool:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return True
    return not (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved)


async def fetch_readme_image(url: str) -> tuple[bytes, str]:
    if not is_safe_readme_image_url(url):
        raise ValueError("不允许的图片地址")

    async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()

    content_type = (response.headers.get("content-type") or "application/octet-stream").split(";")[0].strip()
    if not content_type.startswith("image/"):
        raise ValueError("远程资源不是图片")

    body = response.content
    if len(body) > _MAX_IMAGE_BYTES:
        raise ValueError("图片体积过大")

    return body, content_type
