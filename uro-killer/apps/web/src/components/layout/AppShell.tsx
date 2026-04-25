"use client";

import { useAppStore } from "@/store/main-store";
import { useIsMobile } from "@/hooks";
import Sidebar from "./sidebar";
import TopBar from "./Topbar";
import CommandPalette from "./CommandPalette";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { sidebarCollapsed } = useAppStore();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div
        className={cn(
          "transition-all duration-300",
          isMobile ? "mr-0" : sidebarCollapsed ? "mr-16" : "mr-64"
        )}
      >
        <TopBar />
        <main className="p-4 md:p-6">{children}</main>
      </div>

      <CommandPalette />
    </div>
  );
}