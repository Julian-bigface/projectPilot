"""PyInstaller / desktop sidecar entry — reads HOST/PORT from environment."""

from __future__ import annotations

import os

import uvicorn


def main() -> None:
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
