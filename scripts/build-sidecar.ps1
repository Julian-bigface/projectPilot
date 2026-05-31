# Build FastAPI sidecar for Tauri externalBin (Windows x64).
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Building frontend..."
Push-Location (Join-Path $Root "frontend")
npm run build
Pop-Location

$ResourcesDist = Join-Path $Root "src-tauri\resources\dist"
Write-Host "==> Copying frontend/dist -> src-tauri/resources/dist"
if (Test-Path $ResourcesDist) {
    Remove-Item -Recurse -Force $ResourcesDist
}
New-Item -ItemType Directory -Force -Path (Split-Path $ResourcesDist) | Out-Null
Copy-Item -Recurse (Join-Path $Root "frontend\dist") $ResourcesDist

Write-Host "==> Building Python sidecar (PyInstaller)..."
Push-Location (Join-Path $Root "backend")
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
