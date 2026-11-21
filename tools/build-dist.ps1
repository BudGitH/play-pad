# build-dist.ps1 — assemble the uploadable dist/ for Cloudflare Pages.
# Copies ONLY the hostable site (not docs/, features/, "Old prototype/", .claude/).
# Re-run after any change to the site source, then upload dist/ to Cloudflare Pages.
#
#   powershell -ExecutionPolicy Bypass -File tools\build-dist.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot   # project root (this script lives in tools/)
$dist = Join-Path $root 'dist'

# Clean slate
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory -Path $dist | Out-Null

# The hostable subset — files and folders shipped to the CDN
$items = @(
  'index.html',
  'games.js',
  'manifest.webmanifest',
  '_headers',
  '404.html',
  'styles',
  'icons',
  'games'
)

foreach ($it in $items) {
  $src = Join-Path $root $it
  if (-not (Test-Path $src)) { Write-Warning "skipped (missing): $it"; continue }
  Copy-Item -Path $src -Destination $dist -Recurse -Force
}

# Safety: the reference prototype must never ship
$leak = Join-Path $dist 'Old prototype'
if (Test-Path $leak) { Remove-Item $leak -Recurse -Force }

# Prune per-game dev docs (e.g. games/neon-rush/CLAUDE.md) — source-only, not for the CDN
Get-ChildItem $dist -Recurse -Filter 'CLAUDE.md' | Remove-Item -Force

Write-Host "`ndist built at: $dist`n"
Get-ChildItem $dist -Recurse -File |
  ForEach-Object { '  ' + $_.FullName.Substring($dist.Length + 1) }
