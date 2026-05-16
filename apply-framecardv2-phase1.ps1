param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path $RepoRoot

Write-Host "[info] Applying FrameCardV2 Phase 1 files to: $repo"

$paths = @(
  "src\lib\reader\frame-normalization.ts",
  "src\components\library-v2\frame-card\frameTypes.ts",
  "src\components\library-v2\frame-card\frameStyles.ts",
  "src\components\library-v2\frame-card\FrameHeader.tsx",
  "src\components\library-v2\frame-card\FrameRichContent.tsx",
  "src\components\library-v2\frame-card\FrameTable.tsx",
  "src\components\library-v2\frame-card\FrameCallouts.tsx",
  "src\components\library-v2\frame-card\FrameTails.tsx",
  "src\components\library-v2\frame-card\FrameFlagBadges.tsx",
  "src\components\library-v2\frame-card\LinkedQuestionsFooter.tsx",
  "src\components\library-v2\frame-card\ReferenceRailMarker.tsx",
  "src\components\library-v2\frame-card\MediaFallbackDialog.tsx",
  "src\components\library-v2\frame-card\FrameCardV2.tsx",
  "src\components\library-v2\FrameCardV2.tsx"
)

foreach ($relative in $paths) {
  $src = Join-Path $sourceRoot $relative
  $dst = Join-Path $repo $relative
  $dstDir = Split-Path -Parent $dst

  if (!(Test-Path $src)) {
    throw "Missing source file in zip extraction: $src"
  }

  New-Item -ItemType Directory -Path $dstDir -Force | Out-Null

  if (Test-Path $dst) {
    $backup = "$dst.bak-before-framecardv2-phase1"
    Copy-Item $dst $backup -Force
  }

  Copy-Item $src $dst -Force
  Write-Host "[ok] $relative"
}

Write-Host "[done] FrameCardV2 Phase 1 files copied."
Write-Host "Next:"
Write-Host "  git diff --check"
Write-Host "  npx tsc --noEmit"
Write-Host "  npm run build"
