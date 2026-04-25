"use client";

import { useEffect } from "react";
import { Sidebar } from "./sidebar";
import { useAppStore } from "@/store/useStore";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen } = useAppStore();

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (main) {
      main.style.paddingRight = sidebarOpen ? "14rem" : "4rem";
      main.style.transition = "padding 300ms ease";
    }
  }, [sidebarOpen]);

  return (
    <div className="relative min-h-screen bg-black text-white">
      <Sidebar />
      <main
        id="main-content"
        className="min-h-screen transition-all duration-300"
        style={{ paddingRight: sidebarOpen ? "14rem" : "4rem" }}
      >
        {children}
      </main>
    </div>
  );
}