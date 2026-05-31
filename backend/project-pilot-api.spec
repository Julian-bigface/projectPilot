# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Project Pilot FastAPI sidecar (Windows)."""

from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

block_cipher = None
backend_dir = Path(SPECPATH)

hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("sqlalchemy")
    + collect_submodules("pydantic")
    + [
        "aiosqlite",
        "pydantic_settings",
        "httpx",
        "deep_translator",
        "app.main",
        "app.core.config",
        "app.core.database",
    ]
)

a = Analysis(
    [str(backend_dir / "desktop_entry.py")],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="project-pilot-api",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
