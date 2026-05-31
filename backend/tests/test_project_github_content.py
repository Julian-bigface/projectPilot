"""project_github_content 映射逻辑单元测试。"""

from app.services.project_github_content import _map_release_item


def test_map_release_item_minimal() -> None:
    item = _map_release_item({"tag_name": "v1.0.0"})
    assert item is not None
    assert item.tag_name == "v1.0.0"
    assert item.prerelease is False


def test_map_release_item_skips_missing_tag() -> None:
    assert _map_release_item({}) is None
    assert _map_release_item({"tag_name": ""}) is None


def test_map_release_item_full() -> None:
    item = _map_release_item(
        {
            "tag_name": "v2.0.0",
            "name": "Release 2",
            "body": "## Changes",
            "published_at": "2026-01-15T12:00:00Z",
            "html_url": "https://github.com/o/r/releases/tag/v2.0.0",
            "prerelease": True,
            "draft": False,
        }
    )
    assert item is not None
    assert item.name == "Release 2"
    assert item.body == "## Changes"
    assert item.prerelease is True
    assert item.html_url is not None
    assert item.assets == []


def test_map_release_item_assets() -> None:
    item = _map_release_item(
        {
            "tag_name": "v3.0.0",
            "assets": [
                {
                    "name": "app-linux.zip",
                    "size": 143_000_000,
                    "download_count": 86,
                    "browser_download_url": "https://github.com/o/r/releases/download/v3.0.0/app-linux.zip",
                    "updated_at": "2026-05-19T12:45:00Z",
                },
                {
                    "name": "app-win.zip",
                    "size": 120_000_000,
                    "download_count": 42,
                    "browser_download_url": "https://github.com/o/r/releases/download/v3.0.0/app-win.zip",
                    "updated_at": "2026-05-19T12:45:00Z",
                },
            ],
        }
    )
    assert item is not None
    assert len(item.assets) == 2
    assert item.assets[0].name == "app-linux.zip"
    assert item.assets[0].size == 143_000_000
    assert item.assets[0].download_count == 86
    assert item.assets[1].browser_download_url.endswith("app-win.zip")


def test_map_release_item_skips_invalid_assets() -> None:
    item = _map_release_item(
        {
            "tag_name": "v1.0.0",
            "assets": [
                {"name": "", "browser_download_url": "https://example.com/a.zip"},
                {"name": "ok.zip", "browser_download_url": ""},
                {"name": "valid.zip", "browser_download_url": "https://example.com/valid.zip"},
                "not-a-dict",
            ],
        }
    )
    assert item is not None
    assert len(item.assets) == 1
    assert item.assets[0].name == "valid.zip"
