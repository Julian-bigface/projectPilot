"""在系统文件管理器中定位本地文件。"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


class RevealInFolderError(Exception):
    """无法在文件管理器中打开路径。"""


def reveal_file_in_folder(path: Path) -> None:
    absolute = path.resolve()
    if not absolute.is_file():
        raise RevealInFolderError(f"文件不存在：{absolute}")

    try:
        if sys.platform == "win32":
            subprocess.run(
                ["explorer", "/select,", str(absolute)],
                check=False,
            )
        elif sys.platform == "darwin":
            subprocess.run(["open", "-R", str(absolute)], check=False)
        else:
            subprocess.run(["xdg-open", str(absolute.parent)], check=False)
    except OSError as err:
        raise RevealInFolderError(f"无法打开文件所在位置：{err}") from err
