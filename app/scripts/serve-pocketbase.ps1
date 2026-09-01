$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$exePath = Join-Path $root "tools\pocketbase\pocketbase.exe"

if (-not (Test-Path $exePath)) {
  Write-Host "PocketBase is missing. Running npm run pb:download first..."
  & npm.cmd run pb:download
}

& $exePath serve --http "127.0.0.1:8090" --dir (Join-Path $root "pb_data") --migrationsDir (Join-Path $root "pb_migrations")
