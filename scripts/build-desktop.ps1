# Full desktop build: frontend + sidecar + Tauri installer (Windows).
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

& (Join-Path $Root "scripts\build-sidecar.ps1")

Write-Host "==> Building Tauri bundle (from repo root)..."
npx --prefix frontend tauri build --config src-tauri/tauri.conf.json

$BundleDir = Join-Path $Root "src-tauri\target\release\bundle"
Write-Host "==> Done. Installers under: $BundleDir"
