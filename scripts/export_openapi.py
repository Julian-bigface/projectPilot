"""将 FastAPI 应用的 OpenAPI 模式导出为 contracts/openapi.json（无需启动 HTTP 服务）。"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    backend = root / "backend"
    sys.path.insert(0, str(backend))

    from app.main import app  # noqa: PLC0415  # import after sys.path

    out = root / "contracts" / "openapi.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    schema = app.openapi()
    out.write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out.relative_to(root)}")


if __name__ == "__main__":
    main()
