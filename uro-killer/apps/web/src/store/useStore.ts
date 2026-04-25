import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  cmdOpen: boolean;
  toggleSidebar: () => void;
  setCmdOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  cmdOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCmdOpen: (open) => set({ cmdOpen: open }),
}));