# Build frontend and sync dist into Tauri bundle resources (sidecar STATIC_DIR source).
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$TauriConfPath = Join-Path $Root "src-tauri\tauri.conf.json"
$TauriConfText = Get-Content $TauriConfPath -Raw -Encoding UTF8
if ($TauriConfText -notmatch '"version"\s*:\s*"([^"]+)"') {
    throw "Could not read version from $TauriConfPath"
}
$AppVersion = $Matches[1]

$FrontendDist = Join-Path $Root "frontend\dist"
$ResourcesDist = Join-Path $Root "src-tauri\resources\dist"

if (-not $SkipBuild) {
    Write-Host "==> Building frontend (VITE_APP_VERSION=$AppVersion)..."
    $env:VITE_APP_VERSION = $AppVersion
    $env:VITE_APP_BUILD_TIME = (Get-Date -Format "yyyy-MM-dd HH:mm")
    Push-Location (Join-Path $Root "frontend")
    npm run build
    Pop-Location
    if (-not (Test-Path (Join-Path $FrontendDist "index.html"))) {
        throw "Frontend build failed: missing $FrontendDist\index.html"
    }
}

Write-Host "==> Syncing frontend/dist -> src-tauri/resources/dist"
if (Test-Path $ResourcesDist) {
    Remove-Item -Recurse -Force $ResourcesDist
}
New-Item -ItemType Directory -Force -Path (Split-Path $ResourcesDist) | Out-Null
Copy-Item -Recurse $FrontendDist $ResourcesDist

# Tauri copies resources/dist into bundle output incrementally; stale assets break WebView.
$ReleaseDist = Join-Path $Root "src-tauri\target\release\dist"
if (Test-Path $ReleaseDist) {
    Write-Host "==> Removing stale src-tauri/target/release/dist (avoid mixed JS bundles)"
    Remove-Item -Recurse -Force $ReleaseDist
}

$IndexHtml = Join-Path $ResourcesDist "index.html"
$MainJs = Get-ChildItem (Join-Path $ResourcesDist "assets\*.js") -ErrorAction SilentlyContinue |
    Sort-Object Length -Descending |
    Select-Object -First 1

Write-Host "==> Synced:"
Write-Host "    version: $AppVersion"
Write-Host "    index.html: $IndexHtml ($((Get-Item $IndexHtml).LastWriteTime))"
if ($MainJs) {
    Write-Host "    main js: $($MainJs.Name) ($($MainJs.Length) bytes, $($MainJs.LastWriteTime))"
}
