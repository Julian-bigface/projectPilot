"""封面风格参考图上传与校验测试。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services.readme_cover_storage import (
    ReadmeCoverError,
    load_reference_bytes,
    save_reference_upload,
    validate_reference_image,
)
from tests.conftest import make_test_cover_png


def test_validate_reference_png() -> None:
    mime = validate_reference_image(make_test_cover_png())
    assert mime == "image/png"


def test_validate_reference_rejects_empty() -> None:
    with pytest.raises(ReadmeCoverError, match="为空"):
        validate_reference_image(b"")


def test_validate_reference_rejects_oversize() -> None:
    huge = make_test_cover_png() + b"x" * (4 * 1024 * 1024)
    with pytest.raises(ReadmeCoverError, match="4MB"):
        validate_reference_image(huge)


def test_validate_reference_rejects_invalid_bytes() -> None:
    with pytest.raises(ReadmeCoverError, match="PNG、JPEG 或 WebP"):
        validate_reference_image(b"not-an-image")


def test_save_and_load_reference_upload(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    ref_id, _relative = save_reference_upload(make_test_cover_png())
    assert ref_id.startswith("ref-")
    data, mime = load_reference_bytes(ref_id)
    assert len(data) > 0
    assert mime == "image/png"


@pytest.mark.asyncio
async def test_reference_upload_api(client: AsyncClient, tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(
        "app.services.readme_cover_storage.settings.content_factory_assets_dir",
        str(tmp_path),
    )
    lib_res = await client.post("/project-libraries", json={"name": "RefLib"})
    assert lib_res.status_code == 201
    lib_id = lib_res.json()["id"]
    base = f"/project-libraries/{lib_id}/content-factory"

    upload_res = await client.post(
        f"{base}/cover-styles/reference-upload",
        files={"file": ("ref.png", make_test_cover_png(), "image/png")},
    )
    assert upload_res.status_code == 200
    payload = upload_res.json()
    assert payload["reference_id"].startswith("ref-")
    assert payload["preview_url"].endswith(payload["reference_id"])

    preview_res = await client.get(payload["preview_url"].removeprefix("/api"))
    assert preview_res.status_code == 200
    assert preview_res.headers["content-type"].startswith("image/")
