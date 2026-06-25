"""reveal_in_folder 服务测试。"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from app.services.reveal_in_folder import RevealInFolderError, reveal_file_in_folder


def test_reveal_file_in_folder_missing(tmp_path: Path) -> None:
    missing = tmp_path / "missing.png"
    with pytest.raises(RevealInFolderError, match="文件不存在"):
        reveal_file_in_folder(missing)


def test_reveal_file_in_folder_windows(tmp_path: Path) -> None:
    png = tmp_path / "cover.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n")
    with patch("app.services.reveal_in_folder.sys.platform", "win32"):
        with patch("app.services.reveal_in_folder.subprocess.run") as mock_run:
            reveal_file_in_folder(png)
    mock_run.assert_called_once_with(
        ["explorer", "/select,", str(png.resolve())],
        check=False,
    )
