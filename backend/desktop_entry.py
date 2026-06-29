"""PyInstaller / desktop sidecar entry — reads HOST/PORT from environment."""

from __future__ import annotations

import os
import sys

import uvicorn


class _NullIO:
    """Fallback stream when PyInstaller windowed build has no console."""

    def write(self, data: object) -> int:
        return len(data) if isinstance(data, str) else 0

    def flush(self) -> None:
        pass

    def isatty(self) -> bool:
        return False


def _ensure_stdio_for_windowed_sidecar() -> None:
    """console=False (runw.exe) leaves sys.stdout/stderr as None; uvicorn logging needs them."""
    if sys.stdout is not None and sys.stderr is not None:
        return

    log_dir = os.environ.get("LOG_DIR", "").strip()
    if log_dir:
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "sidecar.log")
        log_file = open(log_path, "a", encoding="utf-8", buffering=1)
        if sys.stdout is None:
            sys.stdout = log_file
        if sys.stderr is None:
            sys.stderr = log_file
        return

    fallback: _NullIO = _NullIO()
    if sys.stdout is None:
        sys.stdout = fallback  # type: ignore[assignment]
    if sys.stderr is None:
        sys.stderr = fallback  # type: ignore[assignment]


def _configure_ssl_certifi_bundle() -> None:
    """PyInstaller 打包后 httpx 需能找到 certifi CA 证书，否则 readme-image-proxy 拉取 HTTPS 失败。"""
    if not getattr(sys, "frozen", False):
        return
    try:
        import certifi
    except ImportError:
        return
    bundle = certifi.where()
    os.environ.setdefault("SSL_CERT_FILE", bundle)
    os.environ.setdefault("REQUESTS_CA_BUNDLE", bundle)


def main() -> None:
    _ensure_stdio_for_windowed_sidecar()
    _configure_ssl_certifi_bundle()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level=os.environ.get("LOG_LEVEL", "info"),
    )


if __name__ == "__main__":
    main()
