param(
    [string]$Root = ".",
    [int]$ContextLines = 8
)

$ErrorActionPreference = "Stop"

function Add-Section {
    param(
        [System.Text.StringBuilder]$Sb,
        [string]$Title
    )
    [void]$Sb.AppendLine("")
    [void]$Sb.AppendLine(("=" * 100))
    [void]$Sb.AppendLine($Title)
    [void]$Sb.AppendLine(("=" * 100))
}

function Get-RelPath {
    param(
        [string]$Base,
        [string]$Path
    )
    return $Path.Replace($Base, ".").Replace("\", "/")
}

function Get-FileText {
    param([string]$Path)
    try {
        return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    } catch {
        try {
            return Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
        } catch {
            return ""
        }
    }
}

function Get-LineContext {
    param(
        [string]$Path,
        [string]$Pattern,
        [int]$Context = 8
    )

    $results = @()

    try {
        $matches = Select-String -LiteralPath $Path -Pattern $Pattern -AllMatches -CaseSensitive:$false -ErrorAction Stop
        if (-not $matches) { return $results }

        $lines = Get-Content -LiteralPath $Path -ErrorAction Stop

        foreach ($m in $matches) {
            $lineNum = $m.LineNumber
            $start = [Math]::Max(1, $lineNum - $Context)
            $end = [Math]::Min($lines.Count, $lineNum + $Context)

            $block = New-Object System.Text.StringBuilder
            [void]$block.AppendLine(("[{0}:{1}] pattern: {2}" -f $Path, $lineNum, $Pattern))

            for ($i = $start; $i -le $end; $i++) {
                $prefix = if ($i -eq $lineNum) { ">>" } else { "  " }
                [void]$block.AppendLine(("{0} {1,5}: {2}" -f $prefix, $i, $lines[$i - 1]))
            }

            $results += $block.ToString()
        }
    } catch {
    }

    return $results
}

$rootPath = (Resolve-Path $Root).Path
$sb = New-Object System.Text.StringBuilder

Add-Section $sb "JSON VALIDATION INSPECTION REPORT"
[void]$sb.AppendLine("Root: $rootPath")
[void]$sb.AppendLine("Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("Goal: find how the app validates imported JSON for notes / flashcards / questions.")
[void]$sb.AppendLine("")

$allowedExt = @(".ts",".tsx",".js",".jsx",".mjs",".cjs",".json",".py")
$excludeDirRegex = '(\\|/)(node_modules|\.next|dist|build|coverage|out|\.git|\.turbo|venv|\.venv)(\\|/)'

$files = Get-ChildItem -Path $rootPath -Recurse -File | Where-Object {
    ($allowedExt -contains $_.Extension.ToLower()) -and
    ($_.FullName -notmatch $excludeDirRegex)
}

Add-Section $sb "1) CANDIDATE FILES BY NAME"
$nameRegex = '(import|preview|validator|validate|validation|schema|zod|flashcard|question|mcq|note|parser|normalize|transform|json)'
$candidateFiles = $files | Where-Object { $_.Name -match $nameRegex } | Sort-Object FullName

if (($candidateFiles | Measure-Object).Count -eq 0) {
    [void]$sb.AppendLine("No candidate files found by filename.")
} else {
    foreach ($f in $candidateFiles) {
        [void]$sb.AppendLine((Get-RelPath -Base $rootPath -Path $f.FullName))
    }
}

Add-Section $sb "2) HIGH-SIGNAL SEARCH PATTERNS"
$patterns = @(
    'safeParse',
    '\.parse\(',
    'z\.object\(',
    'z\.array\(',
    'z\.union\(',
    'z\.discriminatedUnion\(',
    'schema',
    'validator',
    'validate',
    'invalid',
    'required',
    'text/stem/question',
    'flashcard',
    'question',
    'mcq',
    'note',
    'import',
    'preview',
    'normalize',
    'transform',
    'mapImport',
    'parseJson',
    'JSON\.parse',
    'Ajv',
    'yup',
    'superstruct',
    'valibot'
)

foreach ($pattern in $patterns) {
    $hits = @()

    foreach ($file in $files) {
        try {
            $m = Select-String -LiteralPath $file.FullName -Pattern $pattern -CaseSensitive:$false -ErrorAction Stop
            foreach ($x in $m) {
                $hits += [PSCustomObject]@{
                    File = Get-RelPath -Base $rootPath -Path $file.FullName
                    Line = $x.LineNumber
                    Text = $x.Line.Trim()
                }
            }
        } catch {
        }
    }

    if (($hits | Measure-Object).Count -gt 0) {
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("Pattern: $pattern")

        $hits |
            Sort-Object File, Line |
            Select-Object -First 40 |
            ForEach-Object {
                [void]$sb.AppendLine(("  {0}:{1}  {2}" -f $_.File, $_.Line, $_.Text))
            }

        if (($hits | Measure-Object).Count -gt 40) {
            [void]$sb.AppendLine(("  ... and {0} more hit(s)" -f ((($hits | Measure-Object).Count) - 40)))
        }
    }
}

Add-Section $sb "3) FOCUSED CODE CONTEXT"
$focusPatterns = @(
    'safeParse',
    'z\.object\(',
    'text/stem/question',
    'required',
    'flashcard',
    'question',
    'import',
    'preview',
    'normalize',
    'transform'
)

$contextBlocks = New-Object System.Collections.Generic.List[string]

foreach ($file in $files) {
    foreach ($fp in $focusPatterns) {
        $blocks = Get-LineContext -Path $file.FullName -Pattern $fp -Context $ContextLines
        foreach ($b in $blocks) {
            [void]$contextBlocks.Add($b)
        }
    }
}

if ($contextBlocks.Count -eq 0) {
    [void]$sb.AppendLine("No focused code context found.")
} else {
    $seen = New-Object System.Collections.Generic.HashSet[string]
    $count = 0

    foreach ($b in $contextBlocks) {
        if ($seen.Add($b)) {
            [void]$sb.AppendLine($b)
            [void]$sb.AppendLine(("-" * 100))
            $count++
            if ($count -ge 80) {
                [void]$sb.AppendLine("Context output truncated after 80 blocks.")
                break
            }
        }
    }
}

Add-Section $sb "4) LIKELY IMPORT FIELD NAMES"
$fieldNames = @(
    'text','stem','question','prompt','body',
    'answer','answers','options','choices',
    'correctAnswer','correct_option','correctIndex',
    'explanation','hint','topic','tags','difficulty',
    'type','id','source','relatedQuestionIds',
    'cloze','front','back','title','content'
)

$fieldStats = @()

foreach ($field in $fieldNames) {
    $count = 0

    foreach ($file in $files) {
        $txt = Get-FileText $file.FullName
        if ([string]::IsNullOrWhiteSpace($txt)) { continue }

        $matches = [regex]::Matches($txt, ('\b' + [regex]::Escape($field) + '\b'), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $count += $matches.Count
    }

    if ($count -gt 0) {
        $fieldStats += [PSCustomObject]@{
            Name = $field
            Count = $count
        }
    }
}

if (($fieldStats | Measure-Object).Count -eq 0) {
    [void]$sb.AppendLine("No likely fields extracted automatically.")
} else {
    $fieldStats |
        Sort-Object @{Expression='Count';Descending=$true}, @{Expression='Name';Descending=$false} |
        ForEach-Object {
            [void]$sb.AppendLine(("{0}   (count={1})" -f $_.Name, $_.Count))
        }
}

Add-Section $sb "5) POSSIBLE ROUTES / API ENDPOINTS RELATED TO IMPORT"
$routePatterns = @(
    'src/app/.+/import/.+',
    'src/app/import/.+',
    'src/app/api/.+import.+',
    'src/app/api/.+flashcard.+',
    'src/app/api/.+question.+',
    'src/app/api/.+note.+',
    'src/lib/.+(import|validator|schema|flashcard|question|note).+',
    'src/components/.+(import|preview|flashcard|question|note).+'
)

$reported = @()

foreach ($file in $files) {
    $rel = Get-RelPath -Base $rootPath -Path $file.FullName
    foreach ($rp in $routePatterns) {
        if ($rel -match $rp) {
            $reported += $rel
            break
        }
    }
}

$reported = $reported | Sort-Object -Unique

if (($reported | Measure-Object).Count -eq 0) {
    [void]$sb.AppendLine("No obvious import-related route files found.")
} else {
    foreach ($r in $reported) {
        [void]$sb.AppendLine($r)
    }
}

Add-Section $sb "6) HOW TO USE THIS REPORT"
[void]$sb.AppendLine(@"
Read in this order:
1. Find the first real schema or validator:
   - z.object(...)
   - safeParse(...)
   - validate(...)
   - explicit required field checks
2. Trace where that validator is called:
   - import page
   - preview page
   - API route
   - normalization / transform helper
3. Copy the exact accepted keys into your generator prompts.
4. Also note aliases the code accepts, e.g.:
   text OR stem OR question
5. Use real error messages from the codebase to refine your prompts.

What you want to extract:
- root type: array or object
- item type: question / flashcard / note
- required fields
- optional fields
- accepted aliases
- enum values
- nested object / array shape
- normalization rules
- rejection rules
"@)

$report = $sb.ToString()
$reportPath = Join-Path $rootPath "json-validation-report.txt"

Set-Content -LiteralPath $reportPath -Value $report -Encoding UTF8
Set-Clipboard -Value $report

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "Report saved to: $reportPath" -ForegroundColor Cyan
Write-Host "Report copied to clipboard." -ForegroundColor Cyan
