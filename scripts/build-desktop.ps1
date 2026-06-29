# Full desktop build: frontend + sidecar + Tauri installer (Windows).
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Stop-ProjectPilotProcesses {
    $procs = Get-Process -Name "project-pilot*" -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host "==> Stopping running Project Pilot processes..."
        $procs | Stop-Process -Force
        Start-Sleep -Seconds 2
    }
}

function Get-BundledMainJsName {
    param([string]$ResourcesDist)

    $indexHtml = Join-Path $ResourcesDist "index.html"
    $content = Get-Content $indexHtml -Raw -Encoding UTF8
    if ($content -match 'src="/assets/(index-[^"]+\.js)"') {
        return $Matches[1]
    }
    throw "Could not parse main JS from $indexHtml"
}

function Test-BuiltFrontendResources {
    param([string]$ResourcesDist, [string]$ExpectedVersion)

    $indexHtml = Join-Path $ResourcesDist "index.html"
    if (-not (Test-Path $indexHtml)) {
        throw "Missing bundled frontend: $indexHtml"
    }

    $mainJsName = Get-BundledMainJsName -ResourcesDist $ResourcesDist
    $mainJs = Join-Path $ResourcesDist "assets\$mainJsName"
    if (-not (Test-Path $mainJs)) {
        throw "index.html references missing bundle: assets/$mainJsName"
    }

    $jsText = Get-Content $mainJs -Raw -Encoding UTF8
    if ($jsText -notmatch "project-libraries") {
        throw "Bundled frontend looks stale (no project-libraries in $mainJsName). Re-run sync script."
    }
    if ($jsText -match '"/api/library') {
        throw "Bundled frontend still references legacy /api/library paths."
    }
    if ($ExpectedVersion -and $jsText -notmatch [regex]::Escape($ExpectedVersion)) {
        Write-Warning "Bundled JS may not contain version $ExpectedVersion (check VITE_APP_VERSION injection)."
    }

    $staleJs = Get-ChildItem (Join-Path $ResourcesDist "assets\index-*.js") -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne $mainJsName -and $_.Length -gt 10000 }
    if ($staleJs) {
        throw "Stale JS bundles remain in $ResourcesDist/assets: $($staleJs.Name -join ', '). Clean dist before packaging."
    }

    Write-Host "==> Frontend bundle OK: $mainJsName ($((Get-Item $mainJs).Length) bytes, index.html linked)"
}

Stop-ProjectPilotProcesses

function Invoke-RegenerateAppIcons {
    param([string]$RootPath)

    $iconSource = Join-Path $RootPath "assets\branding\project-pilot-app-icon.png"
    if (-not (Test-Path $iconSource)) {
        throw "Missing branding icon source: $iconSource"
    }
    Write-Host "==> Regenerating Tauri icons from $iconSource ..."
    npx --prefix (Join-Path $RootPath "frontend") tauri icon $iconSource -o (Join-Path $RootPath "src-tauri\icons")
    foreach ($required in @("icon.ico", "icon.png", "32x32.png", "128x128.png")) {
        $path = Join-Path $RootPath "src-tauri\icons\$required"
        if (-not (Test-Path $path)) {
            throw "Icon generation failed: missing $path"
        }
    }
    Write-Host "==> App icons OK (icon.ico + platform PNGs)"
}

$TauriConfPath = Join-Path $Root "src-tauri\tauri.conf.json"
$TauriConfText = Get-Content $TauriConfPath -Raw -Encoding UTF8
if ($TauriConfText -notmatch '"version"\s*:\s*"([^"]+)"') {
    throw "Could not read version from $TauriConfPath"
}
$AppVersion = $Matches[1]

Invoke-RegenerateAppIcons -RootPath $Root

& (Join-Path $Root "scripts\build-sidecar.ps1")

$ResourcesDist = Join-Path $Root "src-tauri\resources\dist"
Test-BuiltFrontendResources -ResourcesDist $ResourcesDist -ExpectedVersion $AppVersion

Write-Host "==> Building Tauri bundle (from repo root)..."
$env:CARGO_TARGET_DIR = Join-Path $Root "src-tauri\target"
npx --prefix frontend tauri build --config src-tauri/tauri.conf.json
if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed (exit code $LASTEXITCODE). Fix tauri.conf.json / compile errors above."
}

Test-BuiltFrontendResources -ResourcesDist $ResourcesDist -ExpectedVersion $AppVersion

$ReleaseDist = Join-Path $Root "src-tauri\target\release\dist"
if (Test-Path $ReleaseDist) {
    Test-BuiltFrontendResources -ResourcesDist $ReleaseDist -ExpectedVersion $AppVersion
}

$SidecarExe = Join-Path $Root "src-tauri\target\release\project-pilot-api.exe"
if (-not (Test-Path $SidecarExe)) {
    throw "Missing sidecar exe: $SidecarExe"
}

$BundleDir = Join-Path $Root "src-tauri\target\release\bundle\nsis"
$LatestInstaller = Get-ChildItem (Join-Path $BundleDir "*_${AppVersion}_x64-setup.exe") -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

Write-Host ""
Write-Host "==> Build complete."
Write-Host "    Version: $AppVersion"
Write-Host "    Release exe: $(Join-Path $Root 'src-tauri\target\release\project-pilot.exe')"
if ($LatestInstaller) {
    Write-Host "    Installer:   $($LatestInstaller.FullName)"
    $ArtifactsDir = Join-Path $Root "release-artifacts"
    New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
    $ArtifactPath = Join-Path $ArtifactsDir $LatestInstaller.Name
    Copy-Item -Force $LatestInstaller.FullName $ArtifactPath
    Write-Host "    Copied to:   $ArtifactPath"
    Write-Host ""
    Write-Host "    Install this file (not older 0.1.0 / 0.1.1 setups in the same folder)."
    Write-Host "    If desktop/taskbar icons look stale: delete old desktop shortcut, reinstall, unpin/repin taskbar."
} else {
    Write-Host "    Installers under: $(Join-Path $Root 'src-tauri\target\release\bundle\nsis')"
}
Write-Host ""
Write-Host "    Quick test: .\src-tauri\target\release\project-pilot.exe"
Write-Host "    Verify UI footer shows: Project Pilot v$AppVersion (build time)"
Write-Host "    Verify API: http://127.0.0.1:38472/health -> version $AppVersion"
