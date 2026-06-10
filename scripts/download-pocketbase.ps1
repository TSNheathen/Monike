$ErrorActionPreference = "Stop"

$version = "0.39.3"
$root = Split-Path -Parent $PSScriptRoot
$targetDir = Join-Path $root "tools\pocketbase"
$zipPath = Join-Path $targetDir "pocketbase.zip"
$exePath = Join-Path $targetDir "pocketbase.exe"
$url = "https://github.com/pocketbase/pocketbase/releases/download/v$version/pocketbase_$version`_windows_amd64.zip"

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if (Test-Path $exePath) {
  Write-Host "PocketBase already exists: $exePath"
  & $exePath --version
  exit 0
}

Write-Host "Downloading PocketBase v$version..."
Invoke-WebRequest -Uri $url -OutFile $zipPath
Expand-Archive -LiteralPath $zipPath -DestinationPath $targetDir -Force
Remove-Item -LiteralPath $zipPath -Force

Write-Host "PocketBase installed: $exePath"
& $exePath --version
