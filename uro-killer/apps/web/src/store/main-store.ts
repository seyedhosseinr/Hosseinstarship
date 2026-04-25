import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================
// App Store - UI State
// ============================================================
interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  
  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  
  // Command Palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarOpen: true,
      sidebarCollapsed: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      // Theme
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      
      // Command Palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
    }),
    {
      name: "app-storage",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

// ============================================================
// Gamification Store
// ============================================================
interface GamificationState {
  streak: number;
  xp: number;
  level: number;
  badges: string[];
  addXp: (amount: number) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
  addBadge: (badge: string) => void;
}

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      streak: 0,
      xp: 0,
      level: 1,
      badges: [],
      addXp: (amount) => {
        const newXp = get().xp + amount;
        const newLevel = Math.floor(newXp / 1000) + 1;
        set({ xp: newXp, level: newLevel });
      },
      incrementStreak: () => set((state) => ({ streak: state.streak + 1 })),
      resetStreak: () => set({ streak: 0 }),
      addBadge: (badge) => set((state) => ({ 
        badges: state.badges.includes(badge) ? state.badges : [...state.badges, badge] 
      })),
    }),
    { name: "gamification-storage" }
  )
);

// ============================================================
// Exam Store
// ============================================================
interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
}

interface ExamState {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, number>;
  isComplete: boolean;
  startTime: number | null;
  
  setQuestions: (questions: Question[]) => void;
  answerQuestion: (questionId: string, answerIndex: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  goToQuestion: (index: number) => void;
  completeExam: () => void;
  resetExam: () => void;
  startExam: () => void;
}

export const useExamStore = create<ExamState>()((set, get) => ({
  questions: [],
  currentIndex: 0,
  answers: {},
  isComplete: false,
  startTime: null,
  
  setQuestions: (questions) => set({ questions, currentIndex: 0, answers: {}, isComplete: false }),
  answerQuestion: (questionId, answerIndex) => 
    set((state) => ({ answers: { ...state.answers, [questionId]: answerIndex } })),
  nextQuestion: () => 
    set((state) => ({ 
      currentIndex: Math.min(state.currentIndex + 1, state.questions.length - 1) 
    })),
  prevQuestion: () => 
    set((state) => ({ currentIndex: Math.max(state.currentIndex - 1, 0) })),
  goToQuestion: (index) => set({ currentIndex: index }),
  completeExam: () => set({ isComplete: true }),
  resetExam: () => set({ questions: [], currentIndex: 0, answers: {}, isComplete: false, startTime: null }),
  startExam: () => set({ startTime: Date.now(), isComplete: false }),
}));
