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
