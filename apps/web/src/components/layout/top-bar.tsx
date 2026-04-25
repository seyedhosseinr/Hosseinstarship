"use client";

import { useAppStore } from "@/store/useStore";
import { Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-black/40 px-6 backdrop-blur-xl">
      <div className="text-sm font-medium text-zinc-400">
        URO-OMEGA
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <Bell className="h-4 w-4" />
        </Button>
        <Link href="/profile">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <User className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}

export default TopBar;