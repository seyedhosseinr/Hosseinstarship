param(
  [string]$RepoRoot = "."
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path $RepoRoot).Path
$drawingPath = Join-Path $root "src\components\library-v2\DrawingLayer.tsx"
$chapterPath = Join-Path $root "src\components\library-v2\ChapterReaderV2.tsx"
$globalsPath = Join-Path $root "src\app\globals.css"
$sourceDrawing = Join-Path $PSScriptRoot "DrawingLayer.reader-ink-v3.tsx"

if (!(Test-Path $sourceDrawing)) {
  throw "Missing source file next to this script: $sourceDrawing"
}
if (!(Test-Path $drawingPath)) {
  throw "DrawingLayer.tsx not found: $drawingPath"
}
if (!(Test-Path $chapterPath)) {
  throw "ChapterReaderV2.tsx not found: $chapterPath"
}

Copy-Item -Path $drawingPath -Destination "$drawingPath.bak-v3" -Force
Copy-Item -Path $sourceDrawing -Destination $drawingPath -Force
Write-Host "[ok] Replaced DrawingLayer.tsx and created backup: $drawingPath.bak-v3"

$chapter = [System.IO.File]::ReadAllText($chapterPath, [System.Text.Encoding]::UTF8)

$colors = @'
/* Ink palette */
const DRAW_COLORS = [
  { value: "#2B2B2B", label: "Graphite / پیش‌فرض" },
  { value: "#2563EB", label: "Blue / نکته علمی" },
  { value: "#15803D", label: "Green / تایید" },
  { value: "#C2410C", label: "Amber-red / critical" },
  { value: "#7C3AED", label: "Purple / فلش‌کارت" },
  { value: "#0F766E", label: "Teal / clinical pearl" },
] as const;
'@

$widths = @'
const DRAW_WIDTHS = [
  { value: 1.2, dot: 5, label: "Fine" },
  { value: 2.05, dot: 8, label: "Book" },
  { value: 2.7, dot: 11, label: "Margin" },
] as const;
'@

$chapterNew = [regex]::Replace(
  $chapter,
  'const\s+DRAW_COLORS\s*=\s*\[[\s\S]*?\]\s*as\s*const\s*;',
  [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $colors },
  1
)

$chapterNew = [regex]::Replace(
  $chapterNew,
  'const\s+DRAW_WIDTHS\s*=\s*\[[\s\S]*?\]\s*as\s*const\s*;',
  [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $widths },
  1
)

$chapterNew = [regex]::Replace(
  $chapterNew,
  'const\s*\[\s*penColor\s*,\s*setPenColor\s*\]\s*=\s*useState(?:<[^>]+>)?\([^\)]*\)',
  'const [penColor, setPenColor] = useState<string>(DRAW_COLORS[0].value)',
  1
)

$chapterNew = [regex]::Replace(
  $chapterNew,
  'const\s*\[\s*penWidth\s*,\s*setPenWidth\s*\]\s*=\s*useState(?:<[^>]+>)?\([^\)]*\)',
  'const [penWidth, setPenWidth] = useState<number>(DRAW_WIDTHS[1].value)',
  1
)

# Ensure DrawingLayer receives content anchoring props when the old block exists.
$chapterNew = [regex]::Replace(
  $chapterNew,
  '(<DrawingLayer[\s\S]*?storageKey=\{`?\{?[^\n]+\}?`?\}[\s\S]*?)(\s*/>)',
  {
    param($m)
    $block = $m.Groups[1].Value
    if ($block -notmatch 'scrollRef=') { $block += "`r`n  scrollRef={scrollRef}" }
    if ($block -notmatch 'contentSelector=') { $block += "`r`n  contentSelector={READER_CONTENT_SELECTOR}" }
    return $block + $m.Groups[2].Value
  },
  1
)

if ($chapterNew -ne $chapter) {
  Copy-Item -Path $chapterPath -Destination "$chapterPath.bak-draw-v3" -Force
  [System.IO.File]::WriteAllText($chapterPath, $chapterNew, [System.Text.Encoding]::UTF8)
  Write-Host "[ok] Patched ChapterReaderV2.tsx and created backup: $chapterPath.bak-draw-v3"
} else {
  Write-Warning "ChapterReaderV2.tsx was not changed. Patch anchors may differ; update DRAW_COLORS, defaults, and DrawingLayer props manually."
}

if (Test-Path $globalsPath) {
  $globals = [System.IO.File]::ReadAllText($globalsPath, [System.Text.Encoding]::UTF8)
  if ($globals -notmatch '--ink-graphite') {
    $tokens = @'

    /* Ink palette */
    --ink-graphite: #2B2B2B;   /* پیش‌فرض اصلی */
    --ink-blue:     #2563EB;   /* نکته علمی */
    --ink-red:      #C2410C;   /* اشتباه/critical */
    --ink-green:    #15803D;   /* فهمیدم/تایید */
    --ink-purple:   #7C3AED;   /* فلش‌کارت/حافظه */
    --ink-teal:     #0F766E;   /* clinical pearl */
'@
    $globalsNew = [regex]::Replace($globals, ':root\s*\{', { param($m) $m.Value + $tokens }, 1)
    if ($globalsNew -ne $globals) {
      Copy-Item -Path $globalsPath -Destination "$globalsPath.bak-ink-v3" -Force
      [System.IO.File]::WriteAllText($globalsPath, $globalsNew, [System.Text.Encoding]::UTF8)
      Write-Host "[ok] Added ink CSS tokens to globals.css"
    }
  } else {
    Write-Host "[ok] globals.css already has ink tokens"
  }
}

Write-Host "[done] Reader Ink V3 applied. Run: npx tsc --noEmit; npm run build"
