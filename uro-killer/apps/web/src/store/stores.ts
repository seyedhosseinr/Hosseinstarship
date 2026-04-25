import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Command palette
  cmdOpen: boolean;
  setCmdOpen: (open: boolean) => void;

  // Chat sidebar
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;

  // Exam history
  examHistory: {
    topic: string;
    score: number;
    correct: number;
    total: number;
    date: string;
    duration: string;
  }[];
  addExam: (exam: AppState["examHistory"][0]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      cmdOpen: false,
      setCmdOpen: (open) => set({ cmdOpen: open }),

      chatOpen: false,
      setChatOpen: (open) => set({ chatOpen: open }),

      examHistory: [],
      addExam: (exam) =>
        set((s) => ({ examHistory: [exam, ...s.examHistory].slice(0, 100) })),
    }),
    {
      name: "uro-killer-storage",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        examHistory: state.examHistory,
      }),
    }
  )
);