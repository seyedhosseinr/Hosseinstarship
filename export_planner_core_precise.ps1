param(
    [string]$RootPath = "."
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path $RootPath).Path

$targetFiles = @(
    "src\app\planner\page.tsx",
    "src\app\planner\PlannerClient.tsx",
    "src\app\planner\PlannerScreen.tsx",
    "src\app\planner\PlanList.tsx",

    "src\components\planner\index.ts",
    "src\components\planner\PlannerPage.tsx",
    "src\components\planner\PlannerSummary.tsx",
    "src\components\planner\TodayTaskList.tsx",
    "src\components\planner\WeeklyView.tsx",
    "src\components\planner\PlannerBucket.tsx",
    "src\components\planner\PlannerTaskCard.tsx",
    "src\components\planner\TaskCard.tsx",
    "src\components\planner\RecommendationPanel.tsx",
    "src\components\planner\PlannerRecommendationCard.tsx",
    "src\components\planner\PlannerDashboardCard.tsx",
    "src\components\planner\OverdueModal.tsx",
    "src\components\planner\RescheduleDialog.tsx",
    "src\components\planner\task-helpers.ts",
    "src\components\planner\dnd\PlannerDndContext.tsx",
    "src\components\planner\ui\ProgressRing.tsx",

    "src\components\planner\calendar\PlannerCalendar.tsx",
    "src\components\planner\calendar\PlannerCalendarGrid.tsx",
    "src\components\planner\calendar\CalendarDayCell.tsx",
    "src\components\planner\calendar\CalendarDayModal.tsx",

    "src\app\api\planner\_shared.ts",
    "src\app\api\planner\today\route.ts",
    "src\app\api\planner\week\route.ts",
    "src\app\api\planner\overdue\route.ts",
    "src\app\api\planner\tasks\[id]\complete\route.ts",
    "src\app\api\planner\tasks\[id]\move\route.ts",
    "src\app\api\planner\tasks\[id]\reschedule\route.ts",
    "src\app\api\planner\tasks\[id]\skip\route.ts",

    "src\lib\actions\planner-actions.ts",
    "src\lib\actions\planner-recommendation-actions.ts",
    "src\lib\db\queries\planner.ts",

    "src\lib\planner\constants.ts",
    "src\lib\planner\types.ts",
    "src\lib\planner\utils.ts",
    "src\lib\planner\queries.ts",
    "src\lib\planner\recommendation-engine.ts",
    "src\lib\planner\weak-area-engine.ts",
    "src\lib\planner\fsrs-integration.ts",
    "src\lib\planner\concept-links.ts",

    "src\lib\services\planner-service.ts",
    "src\lib\services\planner-recommendation-service.ts",
    "src\lib\services\study-orchestrator-service.ts"
)

$sb = New-Object System.Text.StringBuilder
$found = 0
$missing = New-Object System.Collections.Generic.List[string]

[void]$sb.AppendLine("PLANNER CORE EXPORT")
[void]$sb.AppendLine("ROOT: $root")
[void]$sb.AppendLine("GENERATED: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("")

foreach ($relPath in $targetFiles) {
    $fullPath = Join-Path $root $relPath

    if (Test-Path -LiteralPath $fullPath) {
        $found++

        [void]$sb.AppendLine(("=" * 100))
        [void]$sb.AppendLine("FILE: $relPath")
        [void]$sb.AppendLine(("=" * 100))
        [void]$sb.AppendLine("")

        try {
            $content = Get-Content -LiteralPath $fullPath -Raw -Encoding UTF8
        } catch {
            $content = Get-Content -LiteralPath $fullPath -Raw
        }

        [void]$sb.AppendLine($content)
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("")
    }
    else {
        $missing.Add($relPath) | Out-Null
    }
}

[void]$sb.AppendLine("")
[void]$sb.AppendLine(("=" * 100))
[void]$sb.AppendLine("MISSING FILES")
[void]$sb.AppendLine(("=" * 100))

if ($missing.Count -eq 0) {
    [void]$sb.AppendLine("[NONE]")
} else {
    foreach ($m in $missing) {
        [void]$sb.AppendLine($m)
    }
}

$output = $sb.ToString()
$outFile = Join-Path $root "planner_core_export.txt"
Set-Content -LiteralPath $outFile -Value $output -Encoding UTF8
$output | Set-Clipboard

Write-Host ""
Write-Host "Done."
Write-Host "Found files: $found"
Write-Host "Missing files: $($missing.Count)"
Write-Host "Saved: $outFile"
Write-Host "Copied to clipboard."