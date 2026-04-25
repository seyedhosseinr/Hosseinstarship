# 🏆 URO-KILLER v2.0

> پلتفرم هوشمند آمادگی بورد تخصصی اورولوژی با هوش مصنوعی

## ✨ Features

- **AI-Powered**: Grok AI integration for question analysis and explanations
- **FSRS Flashcards**: Spaced repetition with Free Spaced Repetition Scheduler v5
- **Gamification**: XP, levels, achievements, daily challenges, streaks
- **PWA**: Installable, offline-capable, push notifications
- **Analytics**: Comprehensive performance tracking and progress visualization
- **RTL**: Full Persian/Farsi right-to-left support
- **Dark Mode**: System-aware theme with manual toggle

## 🚀 Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

## 📁 Architecture


src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Dashboard
│   ├── create/            # Exam creation
│   ├── flashcards/        # FSRS flashcard review
│   ├── analytics/         # Performance analytics
│   ├── profile/           # Gamification profile
│   ├── history/           # Exam history
│   ├── import/            # Data import
│   ├── settings/          # App settings
│   └── api/grok/          # AI API route
├── components/
│   ├── ui/                # Base UI components (shadcn)
│   ├── layout/            # Sidebar, TopBar, AppShell
│   ├── gamification/      # XP, Streak, Achievements
│   ├── ai/                # Chat sidebar, AI components
│   └── pwa/               # Install banner, offline
├── lib/
│   ├── gamification/      # XP engine, achievements, challenges
│   ├── flashcard/         # FSRS algorithm
│   ├── notifications/     # Push notification service
│   └── api/               # API client
├── store/
│   ├── stores.ts          # App state (Zustand)
│   └── gamification-store.ts # Gamification state
├── hooks/                 # Custom React hooks
├── providers/             # Theme, Query providers
└── styles/                # Animation CSS

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand (persisted) |
| Data Fetching | TanStack Query |
| AI | Grok (xAI) via Vercel AI SDK |
| Flashcards | FSRS v5 Algorithm |
| Charts | Recharts |
| Animations | Framer Motion + CSS |
| PWA | Custom Service Worker |

## 📄 License

MIT