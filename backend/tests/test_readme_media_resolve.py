"""README 图片路径解析测试。"""

from app.services.readme_media_resolve import (
    readme_directory_from_base_path,
    readme_raw_base_url,
    resolve_readme_image_src,
)

GITHUB = "https://github.com/octocat/Hello-World"


def test_readme_directory_from_base_path() -> None:
    assert readme_directory_from_base_path("README.md") == ""
    assert readme_directory_from_base_path("docs/README.md") == "docs"


def test_readme_raw_base_url() -> None:
    assert readme_raw_base_url("octocat/Hello-World", GITHUB, "README.md") == (
        "https://github.com/octocat/Hello-World/raw/HEAD/"
    )
    assert readme_raw_base_url("octocat/Hello-World", GITHUB, "docs/README.md") == (
        "https://github.com/octocat/Hello-World/raw/HEAD/docs/"
    )


def test_resolve_readme_image_src() -> None:
    url = "https://img.shields.io/badge/test-blue"
    assert resolve_readme_image_src(url, full_name="octocat/Hello-World", github_url=GITHUB, readme_base_path="README.md") == url
    assert (
        resolve_readme_image_src(
            "./images/logo.png",
            full_name="octocat/Hello-World",
            github_url=GITHUB,
            readme_base_path="README.md",
        )
        == "https://github.com/octocat/Hello-World/raw/HEAD/images/logo.png"
    )
