"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SUPPORTED_RUNTIME_CAPABILITIES, type RuntimeCapabilities } from "@/lib/runtime/capabilities";

type Density = "compact" | "comfortable" | "spacious";

export type Stats = {
  flashcards: number;
  questions: number;
  notebooks: number;
  exams: number;
  avgScore: number;
  dueFlashcards?: number;
};

export type AppCapabilities = RuntimeCapabilities;

export type AppStoreState = {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  cmdOpen: boolean;
  density: Density;
  stats: Stats;
  statsHydrated: boolean;
  capabilities: AppCapabilities;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCmdOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDensity: (density: Density) => void;
  setStats: (stats: Stats) => void;
  hydrateFromDB: () => Promise<void>;
  resetAll: () => Promise<void>;
};

const initialStats: Stats = {
  flashcards: 0,
  questions: 0,
  notebooks: 0,
  exams: 0,
  avgScore: 0,
  dueFlashcards: 0,
};

const initialCapabilities: AppCapabilities = SUPPORTED_RUNTIME_CAPABILITIES;

const emptyStorage: Storage = {
  get length() {
    return 0;
  },
  clear() {},
  getItem() {
    return null;
  },
  key() {
    return null;
  },
  removeItem() {},
  setItem() {},
};

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      sidebarCollapsed: true,
      cmdOpen: false,
      density: "comfortable" as Density,
      stats: initialStats,
      statsHydrated: false,
      capabilities: initialCapabilities,
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open, sidebarCollapsed: !open }),
      toggleSidebar: () =>
        set((s) => ({
          sidebarOpen: !s.sidebarOpen,
          sidebarCollapsed: s.sidebarOpen,
        })),
      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed, sidebarOpen: !collapsed }),
      setCmdOpen: (open) => set({ cmdOpen: open }),
      setCommandPaletteOpen: (open) => set({ cmdOpen: open }),
      setDensity: (density) => set({ density }),
      setStats: (stats) => set({ stats }),
      hydrateFromDB: async () => {
        if (typeof window === "undefined") return;
        try {
          const contextResponse = await fetch("/api/app-shell/context", { cache: "no-store" }).catch(() => null);
          if (contextResponse?.ok) {
            const context = await contextResponse.json().catch(() => null);
            if (context?.stats && context?.capabilities) {
              set({
                stats: {
                  flashcards: Number(context.stats.flashcards) || 0,
                  questions: Number(context.stats.questions) || 0,
                  notebooks: Number(context.stats.notebooks) || 0,
                  exams: Number(context.stats.exams) || 0,
                  avgScore: Number(context.stats.avgScore) || 0,
                  dueFlashcards: Number(context.stats.dueFlashcards) || 0,
                },
                capabilities: {
                  ...initialCapabilities,
                  ...context.capabilities,
                },
                statsHydrated: true,
              });
              return;
            }
          }

        } catch {
          // Keep a stable shell if the server context is temporarily unavailable.
        }

        set({
          stats: initialStats,
          capabilities: initialCapabilities,
          statsHydrated: true,
        });
      },
      resetAll: async () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("uro-app-store");
          localStorage.removeItem("uro-gamification-store");
      sessionStorage.removeItem("legacy-notebooks-cleared");
        }
        set({
          stats: initialStats,
          statsHydrated: false,
          sidebarOpen: true,
          sidebarCollapsed: false,
          cmdOpen: false,
          density: "comfortable" as Density,
          capabilities: initialCapabilities,
        });
      },
    }),
    {
      name: "uro-app-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : emptyStorage
      ),
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        density: state.density,
      }),
    }
  )
);

// --- Gamification Store ---

type GamificationState = {
  xp: number;
  level: number;
  streak: number;
  _hydrated: boolean;
  hydrate: () => Promise<void>;
};

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set) => ({
      xp: 0,
      level: 1,
      streak: 0,
      _hydrated: false,
      hydrate: async () => {
        set({ xp: 0, level: 1, streak: 0, _hydrated: true });
      },
    }),
    {
      name: "uro-gamification-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : emptyStorage
      ),
      partialize: (state) => ({
        xp: state.xp,
        level: state.level,
        streak: state.streak,
      }),
    }
  )
);
