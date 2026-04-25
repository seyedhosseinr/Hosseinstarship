$base = "C:\Users\Hossein\Desktop\board\tests\app\urologynet2\opus 4.6\src\components\layout"
$utf8 = New-Object System.Text.UTF8Encoding($false)

$topbar = @'
"use client";

import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Bell, PlusCircle, Layers, Command
} from "lucide-react";
import Link from "next/link";

const PAGE_TITLES: Record<string, string> = {
  "/": "\u062F\u0627\u0634\u0628\u0648\u0631\u062F",
  "/create": "\u0633\u0627\u062E\u062A \u0622\u0632\u0645\u0648\u0646",
  "/import": "\u0648\u0631\u0648\u062F \u0633\u0648\u0627\u0644",
  "/flashcards": "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A\u200C\u0647\u0627",
  "/notebooks": "\u062C\u0632\u0648\u0647\u200C\u0647\u0627",
  "/history": "\u062A\u0627\u0631\u06CC\u062E\u0686\u0647",
  "/analytics": "\u0622\u0646\u0627\u0644\u06CC\u062A\u06CC\u06A9\u0633",
  "/settings": "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A",
};

export default function TopBar() {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || "";

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center justify-between border-b border-border/10 bg-background/80 backdrop-blur-xl px-6">
      {/* Right: Page title */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={"\u062C\u0633\u062A\u062C\u0648..."}
            className="w-full h-9 pr-10 pl-10 rounded-xl bg-secondary/50 border border-border/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
          <kbd className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" /> K
          </kbd>
        </div>
      </div>

      {/* Left: Actions */}
      <div className="flex items-center gap-2">
        <Link href="/create">
          <Button size="sm" variant="glow" className="gap-1.5 text-xs">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{"\u0622\u0632\u0645\u0648\u0646 \u062C\u062F\u06CC\u062F"}</span>
          </Button>
        </Link>

        <Link href="/flashcards">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{"\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A"}</span>
          </Button>
        </Link>

        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-bold">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}
'@

[System.IO.File]::WriteAllText("$base\top-bar.tsx", $topbar, $utf8)
Write-Host "top-bar.tsx fixed!" -ForegroundColor Green

# Also check if Topbar.tsx exists (capital T)
if (Test-Path "$base\Topbar.tsx") {
    [System.IO.File]::WriteAllText("$base\Topbar.tsx", $topbar, $utf8)
    Write-Host "Topbar.tsx also fixed!" -ForegroundColor Green
}

# Verify
$content = Get-Content "$base\top-bar.tsx" -Raw -Encoding UTF8
if ($content -match "TopBar" -and $content -match "PAGE_TITLES") {
    Write-Host "Verification: OK" -ForegroundColor Green
} else {
    Write-Host "Verification: FAILED" -ForegroundColor Red
}
