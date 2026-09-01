$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $root "scripts\pocketbase.mjs") serve
