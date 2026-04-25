param(
  [string]$PackageName   = "hossein-starship",
  [string]$PgliteDirName = "starship",
  [string]$OpfsNamespace = "starship-v1",
  [string]$ImportFormat  = "starship.import"
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Save-File {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $resolved = Resolve-Path -LiteralPath $Path
  [System.IO.File]::WriteAllText($resolved.Path, $Content, $Utf8NoBom)
}

function Replace-InFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Old,
    [Parameter(Mandatory = $true)][string]$New
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "skip    $Path (not found)" -ForegroundColor DarkYellow
    return
  }

  $content = Get-Content -LiteralPath $Path -Raw
  $updated = $content.Replace($Old, $New)

  if ($updated -ne $content) {
    Save-File -Path $Path -Content $updated
    Write-Host "updated $Path" -ForegroundColor Green
  } else {
    Write-Host "same    $Path" -ForegroundColor DarkGray
  }
}

function Replace-RegexInFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Pattern,
    [Parameter(Mandatory = $true)][string]$Replacement
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "skip    $Path (not found)" -ForegroundColor DarkYellow
    return
  }

  $content = Get-Content -LiteralPath $Path -Raw
  $updated = [System.Text.RegularExpressions.Regex]::Replace(
    $content,
    $Pattern,
    $Replacement,
    [System.Text.RegularExpressions.RegexOptions]::Multiline
  )

  if ($updated -ne $content) {
    Save-File -Path $Path -Content $updated
    Write-Host "updated $Path" -ForegroundColor Green
  } else {
    Write-Host "same    $Path" -ForegroundColor DarkGray
  }
}

Write-Host ""
Write-Host "== Renaming legacy brand/runtime identifiers ==" -ForegroundColor Cyan
Write-Host "PackageName   = $PackageName"
Write-Host "PgliteDirName = $PgliteDirName"
Write-Host "OpfsNamespace = $OpfsNamespace"
Write-Host "ImportFormat  = $ImportFormat"
Write-Host ""

# 1) package.json
if (Test-Path -LiteralPath "package.json") {
  Replace-RegexInFile `
    -Path "package.json" `
    -Pattern '"name"\s*:\s*"[^"]*"' `
    -Replacement ('"name": "' + $PackageName + '"')
} else {
  Write-Host "skip    package.json (not found)" -ForegroundColor DarkYellow
}

# 2) PGlite / OPFS namespaces
Replace-InFile "src/db/pglite-opfs.worker.ts" 'opfs-ahp://uro-omega-v3' ("opfs-ahp://{0}" -f $OpfsNamespace)
Replace-InFile "src/db/config.ts" ".pglite/uro-omega" (".pglite/{0}" -f $PgliteDirName)
Replace-InFile "src/lib/settings/data-queries.ts" ".pglite/uro-omega" (".pglite/{0}" -f $PgliteDirName)
Replace-InFile "src/db/seed-abu-2026.ts" '"uro-omega"' ('"{0}"' -f $PgliteDirName)
Replace-InFile "src/lib/local-first/idb.ts" "opfs-ahp://uro-omega-v3" ("opfs-ahp://{0}" -f $OpfsNamespace)

# 3) Type/export format
Replace-InFile "src/types/index.ts" "format: 'uro-omega.import';" ("format: '{0}';" -f $ImportFormat)

# 4) file-parser:
#    - old imports still accepted
#    - new exports use starship.import
Replace-RegexInFile `
  -Path "src/lib/import/file-parser.ts" `
  -Pattern "data\.format === 'uro-omega\.import'\s*&&\s*data\.version === 1" `
  -Replacement "(($($null = $null) data.format === 'uro-omega.import' || data.format === '$ImportFormat') && data.version === 1)"

# fix accidental injected artifact if any, then set final intended line safely
Replace-RegexInFile `
  -Path "src/lib/import/file-parser.ts" `
  -Pattern "\(\(\s*data\.format === 'uro-omega\.import' \|\| data\.format === '$([regex]::Escape($ImportFormat))'\s*\) && data\.version === 1\)" `
  -Replacement "((data.format === 'uro-omega.import' || data.format === '$ImportFormat') && data.version === 1)"

Replace-RegexInFile `
  -Path "src/lib/import/file-parser.ts" `
  -Pattern "format:\s*'uro-omega\.import'" `
  -Replacement ("format: '{0}'" -f $ImportFormat)

Write-Host ""
Write-Host "== Remaining legacy hits ==" -ForegroundColor Cyan

$legacyHits = Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $_.FullName -notmatch '\\node_modules\\' -and
    $_.FullName -notmatch '\\\.next\\' -and
    $_.FullName -notmatch '\\\.git\\'
  } |
  Select-String -Pattern 'uro-web|uro-omega|uroweb|uroomega' -SimpleMatch:$false

if ($legacyHits) {
  $legacyHits | ForEach-Object {
    "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()
  }
} else {
  Write-Host "No remaining legacy hits found." -ForegroundColor Green
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan