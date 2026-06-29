# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Project Pilot FastAPI sidecar (Windows)."""

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None
backend_dir = Path(SPECPATH)
_prompts_src = backend_dir / "app" / "prompts"
# Runtime resolves app/prompts via Path(__file__).parent.parent / "prompts" (see content_factory_copy.py).
_datas = [(str(_prompts_src), "app/prompts")] + collect_data_files("certifi")

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
    datas=_datas,
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
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
