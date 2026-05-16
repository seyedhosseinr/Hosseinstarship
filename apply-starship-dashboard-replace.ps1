param(
  [string]$RepoRoot = ".",
  [switch]$NoPlainDashboardRoutes
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path $RepoRoot).Path
$kitRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$filesRoot = Join-Path $kitRoot "files"

function Copy-TreeFile([string]$relative) {
  $src = Join-Path $filesRoot $relative
  $dst = Join-Path $repo $relative
  $parent = Split-Path -Parent $dst
  if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  Copy-Item -Path $src -Destination $dst -Force
  Write-Host "[ok] $relative"
}

if (!(Test-Path (Join-Path $repo "src\app"))) {
  throw "RepoRoot اشتباه است؛ پوشه src\app پیدا نشد: $repo"
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $repo "_backup_dashboard_replace_$stamp"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Write-Host "[info] Backup: $backupRoot"

$backupItems = @(
  "src\app\page.tsx",
  "src\app\dashboard\page.tsx",
  "src\components\ShellGate.tsx",
  "src\app\globals.css",
  "src\components\ui\command.tsx"
)
foreach ($item in $backupItems) {
  $p = Join-Path $repo $item
  if (Test-Path $p) {
    $bp = Join-Path $backupRoot $item
    $bparent = Split-Path -Parent $bp
    if (!(Test-Path $bparent)) { New-Item -ItemType Directory -Path $bparent -Force | Out-Null }
    Copy-Item $p $bp -Force
  }
}
if (Test-Path (Join-Path $repo "src\components\dashboard")) {
  Copy-Item (Join-Path $repo "src\components\dashboard") (Join-Path $backupRoot "src\components\dashboard") -Recurse -Force
}

# Copy dashboard replacement files.
Get-ChildItem -Path $filesRoot -Recurse -File | ForEach-Object {
  $rel = $_.FullName.Substring($filesRoot.Length + 1)
  Copy-TreeFile $rel
}

# Keep the new full-width dashboard out of the old global AppShell, otherwise two sidebars/topbars appear.
if (-not $NoPlainDashboardRoutes) {
  $shellGate = Join-Path $repo "src\components\ShellGate.tsx"
  if (Test-Path $shellGate) {
    $s = [System.IO.File]::ReadAllText($shellGate, [System.Text.Encoding]::UTF8)
    if ($s -notmatch 'PLAIN_LAYOUT_ROUTES\s*=\s*\[[^\]]*"/dashboard"') {
      $s = $s -replace 'const PLAIN_LAYOUT_ROUTES\s*=\s*\[', 'const PLAIN_LAYOUT_ROUTES = ["/", "/dashboard", '
      [System.IO.File]::WriteAllText($shellGate, $s, [System.Text.Encoding]::UTF8)
      Write-Host "[ok] src\components\ShellGate.tsx -> / و /dashboard از AppShell قدیمی مستثنا شدند"
    } else {
      Write-Host "[skip] ShellGate already includes /dashboard"
    }
  } else {
    Write-Host "[warn] ShellGate.tsx پیدا نشد؛ اگر دو سایدبار دیدی باید route داشبورد را plain کنی."
  }
}

# Append dashboard CSS compatibility once.
$globals = Join-Path $repo "src\app\globals.css"
$addendum = [System.IO.File]::ReadAllText((Join-Path $kitRoot "dashboard-globals-addendum.css"), [System.Text.Encoding]::UTF8)
$g = [System.IO.File]::ReadAllText($globals, [System.Text.Encoding]::UTF8)
if ($g -notmatch 'Dashboard replacement compatibility tokens') {
  [System.IO.File]::WriteAllText($globals, ($g.TrimEnd() + "`r`n" + $addendum), [System.Text.Encoding]::UTF8)
  Write-Host "[ok] src\app\globals.css -> dashboard compatibility tokens appended"
} else {
  Write-Host "[skip] globals.css already has dashboard compatibility tokens"
}

Write-Host ""
Write-Host "[done] Dashboard files replaced safely. Now run:" 
Write-Host "  npm run typecheck"
Write-Host "  npm run build"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "If npm run typecheck does not exist, run: npx tsc --noEmit"
