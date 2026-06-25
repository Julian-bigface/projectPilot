# Build FastAPI sidecar for Tauri externalBin (Windows x64).
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

& (Join-Path $Root "scripts\sync-frontend-to-tauri-resources.ps1")

Write-Host "==> Building Python sidecar (PyInstaller)..."
Push-Location (Join-Path $Root "backend")
# 「原生 README」封面由前端 WebView 截图上传，sidecar 无需 Playwright/Chromium。
python -m pip install -e ".[desktop]" -q
python -m PyInstaller project-pilot-api.spec --clean --noconfirm
Pop-Location

$BinDir = Join-Path $Root "src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$SidecarSrc = Join-Path $Root "backend\dist\project-pilot-api.exe"
$SidecarDst = Join-Path $BinDir "project-pilot-api-x86_64-pc-windows-msvc.exe"
if (-not (Test-Path $SidecarSrc)) {
    throw "Sidecar build failed: missing $SidecarSrc"
}
Copy-Item -Force $SidecarSrc $SidecarDst
Write-Host "==> Sidecar ready: $SidecarDst"
