# fix-chunks.ps1
# Fix Next.js chunk loading errors (Turbopack cache issues)

Write-Host "Stopping any running Next.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*node*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Removing .next folder..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next"
    Write-Host "  .next removed" -ForegroundColor Green
}

Write-Host "Removing Turbopack cache..." -ForegroundColor Yellow
if (Test-Path ".turbo") {
    Remove-Item -Recurse -Force ".turbo"
    Write-Host "  .turbo removed" -ForegroundColor Green
}

Write-Host "Removing node_modules/.cache..." -ForegroundColor Yellow
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache"
    Write-Host "  node_modules\.cache removed" -ForegroundColor Green
}

Write-Host "Removing TypeScript build info..." -ForegroundColor Yellow
Get-ChildItem -Path . -Filter "*.tsbuildinfo" -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force
if (Test-Path "next-env.d.ts") {
    Remove-Item -Force "next-env.d.ts"
}

Write-Host "Clearing npm cache..." -ForegroundColor Yellow
npm cache clean --force 2>$null

Write-Host ""
Write-Host "Done! Now run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "If error persists, try without Turbopack:" -ForegroundColor Cyan
Write-Host "  npx next dev" -ForegroundColor White