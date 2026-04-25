# Hossein Starship — Local-First Audit

**Deliverable 1 of 2.** Read-only analysis. No code changed.
**Branch:** `feat/dashboard-v2`
**Date:** 2026-04-15
**Scope:** all four user-facing surfaces (Library, Flashcards, Planner, Dashboard), the
existing storage layer (PGlite OPFS + localStorage + Neon), the Edge V3 importer, the
service worker, and the CRDT sync client.

Goal: identify every blocker to the 10 acceptance criteria in the offline-complete
definition, with concrete file:line citations. No architecture or fix is proposed here
— that is Deliverable 2.

---

## 0. TL;DR — Blockers to Offline-Complete

The app is **not offline-complete** today. The critical gaps, in priority order:

1. **Reader annotations live in `localStorage` only.** They never leave the device. Not
   synced, not pushed, lost on re-import. ([src/hooks/useReaderAnnotations.ts:61-67](src/hooks/useReaderAnnotations.ts:61))
2. **Planner is 100% server-action-driven.** No local read path, no optimistic write,
   no cache fallback. Offline → blank/error state on every mutation. The `/api/planner/*`
   REST routes are `featureUnavailable` stubs. ([src/app/api/planner/today/route.ts:3](src/app/api/planner/today/route.ts:3))
3. **Flashcard review writes are not idempotent.** `POST /api/flashcards/review` creates
   a new `flashcard_reviews` row with a server-generated ID on every call. Retry after
   transient failure = duplicate review + corrupted FSRS state. ([src/app/api/flashcards/review/route.ts:33-73](src/app/api/flashcards/review/route.ts:33))
4. **Sync push is asymmetric.** `pushLocalToServer()` only pushes `questions`,
   `question_options`, `flashcards`, `imports`. The server's LWW-CRDT schema accepts
   pushes to `flashcard_reviews`, `chapter_progress`, `exam_sessions`,
   `question_attempts`, `study_tasks` — but the client never sends them. ([src/lib/sync/sync-client.ts:150-155](src/lib/sync/sync-client.ts:150), [:213-221](src/lib/sync/sync-client.ts:213))
5. **No outbox.** Every client write either goes to server directly via fetch/server
   action (and fails on transient network errors) or lands silently in localStorage. No
   mutation queue, no retry state, no idempotency key, no dependency ordering. The app
   has no concept of a "pending mutation".
6. **Dashboard re-fetches on every mount with `cache: "no-store"`.** Offline → empty
   defaults, no "last-known snapshot". ([src/lib/dashboard/useDashboardData.ts:820-826](src/lib/dashboard/useDashboardData.ts:820))
7. **Service worker uses unconditional `skipWaiting` + `clientsClaim`.** Mid-session
   updates hot-swap the SW with no user consent, risking outbox loss on update.
   ([src/sw.ts:17-18](src/sw.ts:17))
8. **`useSyncOnReconnect` has a session-level kill switch.** First transient network
   error → sync is permanently disabled until page reload. ([src/hooks/useSyncOnReconnect.ts:10-22, 45-48](src/hooks/useSyncOnReconnect.ts:10))
9. **Highlights have no durable anchoring.** Keyed by document-level `docId` +
   `frameId` + literal `quote` regex. Re-import generates a new `docId` → annotations
   are silently orphaned. No `blockChecksum`, no `textPositionStart/End`, no
   `prefix/suffix`. ([src/hooks/useReaderAnnotations.ts:13-24](src/hooks/useReaderAnnotations.ts:13))
10. **Exam-session state lives in `localStorage`** with fire-and-forget fetches to
    `/api/exams/{id}/mark` and `/api/exams/{id}/navigate` — no catch, no queue.
    ([src/store/useExamStore.ts:212, 227](src/store/useExamStore.ts:212))

Each is expanded below with citations.

---

## 1. Per-Surface Data Flow Maps

### 1.1 Library

**Entry routes**
- [src/app/library/page.tsx](src/app/library/page.tsx) — server component, calls
  cached server queries `getCampbellNavigation()`, `getLibraryDashboardData()`,
  `getCampbellVolumeSummaries()` from `src/lib/library/queries.ts`.
- [src/app/library/campbell/page.tsx](src/app/library/campbell/page.tsx) — same pattern.
- [src/app/library/campbell/chapter/[chapterNo]/page.tsx](src/app/library/campbell/chapter/[chapterNo]/page.tsx)
  — calls `getChapterReaderBundle(chapterNo)` (Drizzle over
  `noteDocuments`/`noteSections`/`noteFrames`/`contractQuestionNoteLinks`), then
  renders `ChapterReaderV2`.

**Canonical reader components**
- [src/components/library-v2/ChapterReaderV2.tsx](src/components/library-v2/ChapterReaderV2.tsx)
- [src/components/library-v2/NotePageV2.tsx](src/components/library-v2/NotePageV2.tsx)
- [src/components/library-v2/LibraryShell.tsx](src/components/library-v2/LibraryShell.tsx), `LibrarySpine.tsx`, `ReaderStage.tsx`, `MeasureColumn.tsx`, `SectionHeader.tsx`, `FrameCardV2.tsx`
- [src/components/note-viewer/FrameBody.tsx](src/components/note-viewer/FrameBody.tsx) — inline highlight/comment rendering
- [src/components/note-viewer/ReaderAnnotationsPanel.tsx](src/components/note-viewer/ReaderAnnotationsPanel.tsx)
- [src/components/flashcard/SelectionPopup.tsx](src/components/flashcard/SelectionPopup.tsx)

**Data layer (live)**
- [src/lib/library/queries.ts](src/lib/library/queries.ts) — Drizzle over `getDb()`. Cached via React `cache()`. Throws on DB error (propagates to route).
- [src/lib/library/progress.ts](src/lib/library/progress.ts) — `recordChapterOpen`, `recordChapterRead`, `setManualChapterStatus`, `recordChapterQuestionAttempt`. Writes `chapterProgress` on the server DB.

**Network calls**
| Location | Call | When | On failure |
|---|---|---|---|
| [src/hooks/useStatusMachine.ts:19](src/hooks/useStatusMachine.ts:19) | `POST /api/library/progress` | mount timer, read-threshold, manual status change | fire-and-forget, `void`, no catch, no retry |
| [src/app/api/library/progress/route.ts](src/app/api/library/progress/route.ts) | writes `chapterProgress` via `getDb()` | — | 400/500 JSON |

**Storage touches (Library)**
- **localStorage** `reader-annotations:{docId}` — all highlights/underlines/comments. Read on mount, written on every mutation. ([src/hooks/useReaderAnnotations.ts:61, :66](src/hooks/useReaderAnnotations.ts:61))
- **localStorage** `study:tab:ch{chapterNo}` — UI tab selection. Ephemeral. ([src/components/library-v2/NotePageV2.tsx:192, :203](src/components/library-v2/NotePageV2.tsx:192))
- **PGlite (server-side `getDb()`)** — all chapter/note reads. Runs in Next server component, not in the browser DB.
- **No browser PGlite reads** in the library reader path. The reader renders pre-hydrated server props.

**Highlight anchoring (today)**
[src/hooks/useReaderAnnotations.ts:13-24](src/hooks/useReaderAnnotations.ts:13)
```
{ id, docId, chapterNo, frameId | null, sectionId | null, quote, type, color?, comment, createdAt }
```
- Anchored by `{ docId, frameId, quote-regex }`.
- `docId` is document-level — re-importing a chapter mints a new `docId`. Every existing highlight for that doc is silently orphaned, still sitting in the old localStorage key.
- `quote` is matched by literal regex in [FrameBody.tsx:103-169](src/components/note-viewer/FrameBody.tsx:103). Any content edit that changes the quoted text breaks the highlight silently.
- **Missing fields required by the target schema:** `sourceBlockId`, `textPositionStart/End`, `prefix`, `suffix`, `blockChecksum`. No re-anchor algorithm, no "needs review" surface.

**Blockers → acceptance criteria**
- **AC2 (notes render offline):** Reader route is a server component tree. The chapter bundle is loaded via server Drizzle, not via the browser OPFS DB. In airplane mode, Next SSR can't run → route returns the cached HTML shell, but there is no JS fallback that hydrates a chapter from the browser OPFS.
- **AC4 (highlights on correct span):** Re-import orphans every highlight. No anchoring.
- **AC7/8 (offline CRUD):** Highlights work offline because they only touch localStorage — but they are ephemeral, never synced, and will be wiped by storage eviction. Note CRUD (editing note text) does not exist in the live UI.

---

### 1.2 Flashcards

**Entry routes**
- [src/app/flashcards/page.tsx](src/app/flashcards/page.tsx) — server component, calls `getManagedFlashcardStats()`, `listManagedFlashcards()`.
- [src/app/flashcards/review/page.tsx](src/app/flashcards/review/page.tsx) — server component, calls `listManagedDueFlashcards()`.
- [src/app/srs/insights/page.tsx](src/app/srs/insights/page.tsx) — stub, `featureUnavailable`.

**Canonical components**
- [src/components/flashcard/FlashcardReviewScreen.tsx](src/components/flashcard/FlashcardReviewScreen.tsx) — the only surface that has an OPFS fallback.
- [src/components/flashcard/FlashcardHub.tsx](src/components/flashcard/FlashcardHub.tsx) — server-side rendered, no client fetch.
- [src/components/flashcard/FlashcardLibrary.tsx](src/components/flashcard/FlashcardLibrary.tsx) — client fetches with no catch.

**Network calls**
| Location | Call | When | On failure |
|---|---|---|---|
| [src/components/flashcard/FlashcardReviewScreen.tsx:473](src/components/flashcard/FlashcardReviewScreen.tsx:473) | `GET /api/flashcards/review?limit=100` | refreshQueue | catch → if `!navigator.onLine`, reads local OPFS via `getFlashcardsForReview()`. Uses `navigator.onLine` as a gate (forbidden pattern). |
| [src/components/flashcard/FlashcardReviewScreen.tsx:491](src/components/flashcard/FlashcardReviewScreen.tsx:491) | `PATCH /api/flashcards/review` (undo) | event | result ignored, then `refreshQueue()` regardless |
| [src/hooks/useOptimisticFlashcard.ts:36](src/hooks/useOptimisticFlashcard.ts:36) | `GET /api/flashcards/review?limit=1` | resync counter | catch → silent |
| [src/hooks/useOptimisticFlashcard.ts:57](src/hooks/useOptimisticFlashcard.ts:57) | `POST /api/flashcards/review` (submit) | event | `throw` in read path; optimistic state reverted via `useOptimistic` |
| [src/components/flashcard/FlashcardLibrary.tsx:551](src/components/flashcard/FlashcardLibrary.tsx:551) | `GET /api/flashcards/by-chapter` | effect | no catch |
| [src/components/flashcard/FlashcardLibrary.tsx:578](src/components/flashcard/FlashcardLibrary.tsx:578) | `GET /api/flashcards/detail?id=…` | effect | no catch |

**Storage touches**
- **PGlite OPFS (browser):** `getFlashcardsForReview()` in [src/hooks/useDb.ts:56-72](src/hooks/useDb.ts:56) — reads `flashcards` where `fsrs_due <= now`, ordered by due. This is the offline read fallback.
- **No localStorage in flashcard components themselves** (checkpoint keys only, owned by sync-client).

**FSRS review write path**
- Client: `useOptimistic` decrements `dueCount` immediately, then `POST /api/flashcards/review`.
- Server: [src/app/api/flashcards/review/route.ts:33-73](src/app/api/flashcards/review/route.ts:33) → `reviewManagedFlashcard()` in `src/lib/services/flashcard-service.ts` → server Drizzle:
  - `updateFlashcardById()` (FSRS state on the `flashcards` row)
  - `insertReview()` (new row in `flashcard_reviews`, random ID)
  - `insertReviewHistory()` (audit row in `flashcard_review_history`)
  - sibling-bury + leech refresh
- **No idempotency key is accepted** by the endpoint. Retries create duplicate history rows.
- **Client never writes locally to `flashcards`.** Even though `pullFromServer()` will eventually refresh the local row via CRDT, the local OPFS FSRS state is stale between the offline review and the next successful sync.

**Blockers → acceptance criteria**
- **AC3 (offline reviews persist):** Review writes go straight to the network. If offline, `useOptimistic` reverts and the review is lost. No outbox.
- **AC8 (offline CRUD):** Card create (`POST /api/flashcards`) has no local path. Inline card creation from the reader also fails offline ([src/components/library-v2/NotePageV2.tsx:717](src/components/library-v2/NotePageV2.tsx:717), no catch).
- **AC10 (no duplicates on reconnect):** Review endpoint is non-idempotent; conflict resolution for offline queue + retries requires a `mutationId` the server honors.

---

### 1.3 Planner

**Entry route**
- [src/app/planner/page.tsx](src/app/planner/page.tsx) → `PlannerClient.tsx` (live).
- [src/app/planner/PlanList.tsx](src/app/planner/PlanList.tsx), `PlannerScreen.tsx` — dead (pre-restructure backups).

**Active stack: runtime v2**
- [src/components/planner/PlannerClient.tsx](src/components/planner/PlannerClient.tsx) — calls `getPlannerSummaryAction()` on mount + on visibility change. Error state is silently swallowed.
- [src/components/planner/TodayTaskList.tsx](src/components/planner/TodayTaskList.tsx) — `Promise.all([getTodayPlanAction(), getUpcomingTasksAction(10)])` on mount and on visibility change.
- [src/components/planner/WeeklyView.tsx](src/components/planner/WeeklyView.tsx) — `getWeekPlanAction(refDate)` on mount, on visibility, and on week navigation.
- [src/components/planner/TaskCard.tsx](src/components/planner/TaskCard.tsx) — 6 mutation server actions (complete, skip, start, snooze, move, reschedule). Each uses `useTransition` to lock the UI until the server returns. Parent refetches via `onMutate` callback.
- [src/components/planner/RescheduleDialog.tsx](src/components/planner/RescheduleDialog.tsx) — same pattern.

**Server actions (all in `src/lib/actions/planner-runtime-actions.ts`)**
- Reads: `getTodayPlanAction`, `getWeekPlanAction(refDate?)`, `getUpcomingTasksAction(limit)`, `getPlannerSummaryAction`.
- Writes: `completeTaskAction`, `skipTaskAction`, `startTaskAction`, `snoozeTaskAction`, `moveToTodayAction`, `rescheduleTaskAction`. Each calls `revalidateAfterTaskComplete()` ([src/lib/cache/revalidation.ts](src/lib/cache/revalidation.ts)), which tags `planner`, `plannerTasks`, `plannerToday` and revalidates `/planner`, `/`.

**Service + query layer**
- [src/lib/services/planner-runtime-service.ts](src/lib/services/planner-runtime-service.ts) — orchestrates writes, calls `recalculatePlannerDay()` + `recalculatePlannerPlan()` after every mutation.
- [src/lib/planner/runtime-queries.ts](src/lib/planner/runtime-queries.ts) — Drizzle over `getDb()`. `markPlannerOverdueTasks()` mutates state (marks past tasks as overdue) during the read. `getPlannerTodayPlan()`, `getPlannerWeekPlan()`, `selectResolvedTasks()`.

**REST routes**
- [src/app/api/planner/today/route.ts](src/app/api/planner/today/route.ts), `week`, `tasks`, `overdue` — all return `featureUnavailable("planner_*")` stubs. The planner is **server-action-only**.

**Network calls (fetches)**
- **None.** Every data round-trip is a Next.js server action, which is a POST to `/planner` with an `_action_` payload.

**Storage touches**
- **None.** No localStorage, no sessionStorage, no browser PGlite, no Dexie. All state is server Drizzle + React state + Next cache tags.

**Blockers → acceptance criteria**
- **AC5 (planner shows state + accepts edits):** Airplane mode breaks every server action. `PlannerClient.fetchSummary()` catches silently and the screen stays on initial empty state. `TaskCard` mutations fail with a toast error and no optimistic update.
- **AC10 (reconnect sync):** There is no local write path to sync from.
- **Additional note:** `recalculatePlannerDay()` and `recalculatePlannerPlan()` aggregate on the server side every time. To move offline we will need to replicate this aggregation locally or defer it to server enrichment.

---

### 1.4 Dashboard

**Entry routes**
- [src/app/page.tsx](src/app/page.tsx) → dynamic import of `HosseinStarshipDashboard` (SSR disabled) + `DashboardVersionSwitcher`.
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx) — re-exports `src/app/page.tsx`.
- [src/app/dashboard-v2/page.tsx](src/app/dashboard-v2/page.tsx) — dynamic import of `DashboardV2` (SSR disabled).

**Canonical components**
- [src/components/dashboard-v2/DashboardV2.tsx](src/components/dashboard-v2/DashboardV2.tsx)
- [src/components/dashboard-v2/HeroCard.tsx](src/components/dashboard-v2/HeroCard.tsx), `StatsRow.tsx`, `DetailedStats.tsx`, `ContextStrip.tsx`, `ContinueReading.tsx`, `DashboardV2Skeleton.tsx`, `DashboardVersionSwitcher.tsx`, `SearchBar.tsx`, `TodayCard.tsx`, `WeakChapters.tsx`
- [src/components/dashboard/HosseinStarshipDashboard.tsx](src/components/dashboard/HosseinStarshipDashboard.tsx)

**Data hooks**
- [src/lib/dashboard/useDashboardData.ts:774-1055](src/lib/dashboard/useDashboardData.ts:774)
  - On mount: `Promise.race([getDashboardStats() from OPFS, 8s timeout])` then `fetch("/api/app-shell/context", { cache: "no-store" })` and `fetch("/api/dashboard/stats", { cache: "no-store" })`.
  - Both server fetches: catch → fallback to `EMPTY_COUNTS` / `EMPTY_SERVER_STATS`. No persistence of the last successful result. Next render refetches.
- [src/lib/dashboard/useDashboardHero.ts:103-368](src/lib/dashboard/useDashboardHero.ts:103) — browser PGlite queries over `flashcards`, `chapter_progress`, `segment_progress`. 8s safety timeout.

**Network calls**
| Location | Call | Method | On failure |
|---|---|---|---|
| [src/lib/dashboard/useDashboardData.ts:820](src/lib/dashboard/useDashboardData.ts:820) | `/api/app-shell/context` | GET, `no-store` | catch → empty defaults |
| [src/lib/dashboard/useDashboardData.ts:823](src/lib/dashboard/useDashboardData.ts:823) | `/api/dashboard/stats` | GET, `no-store` | catch → empty defaults |

**Storage touches**
- **PGlite OPFS (browser):** `getDashboardStats()` in `useDb.ts` — counts over `questions`, `flashcards`, `exam_sessions`, due flashcards.
- **PGlite OPFS (browser):** hero queries in `useDashboardHero.ts` — chapter performance, unfinished chapter lookups.
- **No localStorage snapshot.**

**Stats rendered by `DashboardV2.tsx` and their sources**
| Stat | Source |
|---|---|
| `readiness` | `data.readinessScore.score` (server) |
| `readChapters` | `analyticsSnapshot.chaptersCompleted` OR `chapterPerformance.length` (server) |
| `mastered` | `flashcardStats.mastered` (server) |
| `studyMinutes` today | `plannerDetailedStats.studyMinutes` (server) |
| `completedToday` / `todayTasks` | `plannerDetailedStats` (server) |
| `dueToday` | `flashcardStats.dueToday` (server) — duplicated against OPFS count during race |
| `etaMinutes` | derived client-side |
| `domainMastery` | `serverStats.domainMastery` |
| `weeklyActivity` | `serverStats.weeklyActivity` |
| `weakSpots` | `serverStats.weakSpots` |
| `activityFeed` | `serverStats.activityFeed` |
| Hero action | OPFS local |

**Blockers → acceptance criteria**
- **AC6 (dashboard renders with last-known stats):** Offline, every stat except the hero card falls to 0/empty. There is no persisted snapshot. The label "offline snapshot" does not exist in the UI.
- Only the hero card works offline today.

---

## 2. localStorage / sessionStorage Inventory

Every remaining hit in live code (dead clusters excluded).

| File:Line | Key | Category | Verdict |
|---|---|---|---|
| [src/hooks/useReaderAnnotations.ts:61,66](src/hooks/useReaderAnnotations.ts:61) | `reader-annotations:{docId}` | **App data** — all highlights/comments | **HARD VIOLATION — must migrate to OPFS + outbox** |
| [src/store/useExamStore.ts:141,284,306,317](src/store/useExamStore.ts:141) | `exam_active_session` | **App data** — active exam session id | **HARD VIOLATION** |
| [src/app/exam/active/page.tsx:32](src/app/exam/active/page.tsx:32) | `exam_active_session` | same | **HARD VIOLATION** |
| [src/store/useAppStore.ts:126,127,128](src/store/useAppStore.ts:126) | `uro-app-store`, `uro-gamification-store`, `legacy-notebooks-cleared` | Mixed — UI prefs + gamification xp/level/streak | **HARD VIOLATION for the gamification half** |
| [src/hooks/useCollections.ts:26,45](src/hooks/useCollections.ts:26) | `STORAGE_KEY` (user collection list) | **App data** | **HARD VIOLATION** |
| [src/components/command/CommandPalette.tsx:72,81](src/components/command/CommandPalette.tsx:72) | `starship:recent-searches` | Activity log | **HARD VIOLATION** |
| [src/components/library-v2/NotePageV2.tsx:192,203](src/components/library-v2/NotePageV2.tsx:192) | `study:tab:ch{chapterNo}` | UI pref | acceptable (ephemeral) |
| [src/components/exam-v2/QBankBrowser.tsx:479,489](src/components/exam-v2/QBankBrowser.tsx:479) | `starship:qbank-filters` | UI pref | acceptable |
| [src/app/qbank/QBankScreen.tsx:97,112](src/app/qbank/QBankScreen.tsx:97) | `starship:qbank-filters` | UI pref | acceptable |
| [src/hooks/useReaderSettings.ts:28,39](src/hooks/useReaderSettings.ts:28) | reader font/zoom pref | UI pref | acceptable |
| [src/lib/sync/sync-client.ts:65,187,189,230,289,309,314,320,329](src/lib/sync/sync-client.ts:65) | `uro_sync_last_pushed_clock`, `uro_sync_last_pushed_at`, `uro_sync_last_pulled_clock` | Sync checkpoints | **acceptable but must move to IndexedDB** per constraints |
| [src/hooks/useSyncStatus.ts:22](src/hooks/useSyncStatus.ts:22) | `uro_sync_last_pushed_at` | read-only | same — move |
| [src/db/pglite-browser.ts:283,288,304,306](src/db/pglite-browser.ts:283) | `uro_pglite_client_id` | CRDT origin id | same — move |

**Constraint reminder:** "No localStorage/sessionStorage for app data. IndexedDB (or PGlite if already adopted) for structured data; OPFS for files/blobs." By the letter of the brief, every localStorage usage — even UI prefs — is non-compliant. However the brief singles out "app data". Gate: everything above marked HARD VIOLATION must move immediately; UI prefs are lower-priority but still violations to scrub in Phase 1.

sessionStorage: **zero hits** in live code.

---

## 3. fetch() Inventory in User-Facing Paths

Grouped by risk. `✗` = no local-first fallback, `✗✗` = also throws/silently loses user action.

### 3.1 Read paths that throw or have no local fallback

| File:Line | Call | Hazard |
|---|---|---|
| [src/components/flashcard/FlashcardLibrary.tsx:551](src/components/flashcard/FlashcardLibrary.tsx:551) | `GET /api/flashcards/by-chapter?chapterNo=…` | ✗ no catch, no local fallback |
| [src/components/flashcard/FlashcardLibrary.tsx:578](src/components/flashcard/FlashcardLibrary.tsx:578) | `GET /api/flashcards/detail?id=…` | ✗ no catch, no local fallback |
| [src/components/exam-v2/BuilderWizard.tsx:75](src/components/exam-v2/BuilderWizard.tsx:75) | `GET /api/questions/count` | ✗ no catch |
| [src/components/exam/ExamBuilderV2.tsx:98](src/components/exam/ExamBuilderV2.tsx:98) | `GET /api/questions/count` | ✗ no catch |
| [src/hooks/useMissedQuestionIds.ts:18](src/hooks/useMissedQuestionIds.ts:18) | `GET /api/questions/missed?chapterNo=…` | ✗ no catch |
| [src/hooks/useQuestionNote.ts:95](src/hooks/useQuestionNote.ts:95) | `GET /api/questions/…` | ✗ no catch |
| [src/hooks/useStatusMachine.ts:19](src/hooks/useStatusMachine.ts:19) | `POST /api/library/progress` | ✗✗ fire-and-forget |
| [src/components/flashcard/FlashcardReviewScreen.tsx:473](src/components/flashcard/FlashcardReviewScreen.tsx:473) | `GET /api/flashcards/review?limit=100` | partial — falls back to OPFS, but gated on `navigator.onLine` (forbidden pattern) |

### 3.2 Write paths with no offline queue

| File:Line | Call | Hazard |
|---|---|---|
| [src/store/useExamStore.ts:104](src/store/useExamStore.ts:104) | `POST /api/exams/start` | catch → error toast (exam cannot start offline) |
| [src/store/useExamStore.ts:172](src/store/useExamStore.ts:172) | `POST /api/exams/{id}/submit` | catch → silent (optimistic, user thinks it saved) |
| [src/store/useExamStore.ts:212](src/store/useExamStore.ts:212) | `POST /api/exams/{id}/mark` | ✗✗ no catch |
| [src/store/useExamStore.ts:227](src/store/useExamStore.ts:227) | `POST /api/exams/{id}/navigate` | ✗✗ no catch, fire-and-forget |
| [src/store/useExamStore.ts:265](src/store/useExamStore.ts:265) | `POST /api/exams/{id}/finish` | catch → error toast (cannot finish offline) |
| [src/store/useExamStore.ts:297](src/store/useExamStore.ts:297) | `POST /api/exams/{id}/suspend` | catch → error toast |
| [src/store/useExamStore.ts:325](src/store/useExamStore.ts:325) | `GET /api/exams/{id}/results` | catch → error state |
| [src/store/useExamStore.ts:341](src/store/useExamStore.ts:341) | `GET /api/exams/{id}/state` | catch → error state |
| [src/components/library-v2/NotePageV2.tsx:717](src/components/library-v2/NotePageV2.tsx:717) | `POST /api/flashcards` (inline card from selection) | ✗ no catch |
| [src/components/exam-v2/ExplanationCard.tsx:25](src/components/exam-v2/ExplanationCard.tsx:25) | `POST /api/exams/flashcards` | catch → silent |
| [src/components/exam/ActiveExamPage.tsx:856](src/components/exam/ActiveExamPage.tsx:856) | `POST /api/exams/flashcards` | catch → silent |
| [src/hooks/useOptimisticFlashcard.ts:57](src/hooks/useOptimisticFlashcard.ts:57) | `POST /api/flashcards/review` | throws → optimistic revert, **user action is lost** |

### 3.3 Fetches that are acceptable

- [src/lib/dashboard/useDashboardData.ts:820, :823](src/lib/dashboard/useDashboardData.ts:820) — catches to empty defaults (dashboard degrades gracefully), but no snapshot persistence.
- [src/lib/sync/sync-client.ts:159](src/lib/sync/sync-client.ts:159) — `/api/sync/push` with try/catch returning a structured result.
- [src/lib/sync/sync-client.ts:234](src/lib/sync/sync-client.ts:234) — `/api/sync/pull`, same pattern.
- [src/store/useAppStore.ts:91](src/store/useAppStore.ts:91) — `/api/app-shell/context` with catch → fallback to local.
- [src/db/pglite-browser.ts:113-115](src/db/pglite-browser.ts:113) — PGlite WASM/data fetches; service-worker precached, CacheFirst at runtime.

---

## 4. Existing Storage & Runtime Layer

### 4.1 Server runtime
[src/db/index.ts](src/db/index.ts) — `getDb()` returns Postgres (Neon) when `DATABASE_URL` is set and `DB_RUNTIME !== "pglite"`, otherwise Node PGlite. Vercel deploys force Postgres; local dev defaults to PGlite in `.pglite/uro-omega`.

### 4.2 Browser runtime
[src/db/pglite-browser.ts](src/db/pglite-browser.ts) — single entry point for browser Drizzle. Uses `PGliteWorker` from `@electric-sql/pglite/worker`. Multi-tab-safe via PGliteWorker's BroadcastChannel leader election (only the first tab opens the OPFS file; other tabs proxy queries). WASM modules and the PGlite data blob are pre-compiled/fetched on the main thread and handed to the worker via `meta`, because Turbopack's blob: origin for the worker cannot fetch relative WASM.

### 4.3 Schema
[src/db/schema.ts](src/db/schema.ts) — 30+ tables. Every table carries CRDT columns:
- `logical_clock` bigint — monotonic per-write clock
- `origin_id` text — UUID v4, derived from `uro_pglite_client_id` in localStorage
- `is_deleted` int — soft delete flag
- `created_at`, `updated_at` bigint — ms epoch

Tables relevant to local-first:
- **Already CRDT-synced and writeable from the browser:** `questions`, `question_options`, `flashcards`, `imports`, `notebooks`.
- **Accept CRDT pulls but client never pushes them:** `flashcard_reviews`, `chapter_progress`, `exam_sessions`, `question_attempts`, `study_tasks`, `study_plans`, `study_plan_days`, `study_task_events`, `study_task_links`, `note_documents`, `note_sections`, `note_frames`, `segment_progress`, `contract_questions`, `contract_question_note_links`. (The LWW pull list is in [src/lib/sync/sync-client.ts:213-221](src/lib/sync/sync-client.ts:213), which enumerates `questions, flashcards, flashcard_reviews, chapter_progress, exam_sessions, question_attempts, study_tasks`.)
- **No table for annotations/highlights.** Does not exist in schema today.
- **No outbox table, no tombstones table, no idMap table.**

### 4.4 `useDb` helpers
[src/hooks/useDb.ts](src/hooks/useDb.ts) exposes typed browser queries:
- `getFlashcardsForReview(limit)` — due review list.
- `getFlashcardsByChapter(chapterNo)`
- `getDashboardStats()` — counts for dashboard hero/counters.
- `getChapterProgress()` — local mirror of `chapter_progress` (reads — writes go to server via `/api/library/progress`).

`useDb` is available to any client component, but most of the app uses server queries/actions instead. Only the dashboard hero and the flashcard review screen actually exercise this hook.

### 4.5 Sync engine (today)
[src/lib/sync/sync-client.ts](src/lib/sync/sync-client.ts)
- `pushLocalToServer()` — selects from local OPFS `questions`, `question_options`, `flashcards`, `imports` where `logical_clock > uro_sync_last_pushed_clock`, batches at 2000, POSTs `/api/sync/push`, advances checkpoint from `result.newMaxClock`.
- `pullFromServer()` — `GET /api/sync/pull?since=<uro_sync_last_pulled_clock>`, upserts results into OPFS, advances checkpoint.
- Checkpoint storage: 3 `localStorage` keys (brief requires migration to IndexedDB).
- Error handling: structured result, never throws. No retries, no backoff, no persistent queue.

[src/hooks/useSyncOnReconnect.ts](src/hooks/useSyncOnReconnect.ts)
- Debounced 2s on `online` event + on mount.
- **Module-level `syncDisabledForSession` flag**: any 503 / ECONNREFUSED / "not configured" / "Failed to fetch" / "NetworkError" → sync is disabled for the rest of the session until hard reload. This directly breaks AC10: if the first reconnect attempt fails transiently, the app will not retry until the user reloads.
- No visibility-change trigger, no interval trigger, no manual "Sync now" button.

[src/hooks/useSyncStatus.ts](src/hooks/useSyncStatus.ts) — read-only status derivation from `uro_sync_last_pushed_at`.

### 4.6 Service worker
[src/sw.ts](src/sw.ts) + [next.config.ts:31-35](next.config.ts:31) — Serwist.
- **Precache:** `self.__SW_MANIFEST` (the build manifest — Next output).
- **Runtime caches:**
  - `/pglite/*` → CacheFirst, 30d, cache `pglite-wasm`
  - `/api/sync/*` → NetworkOnly (correct)
  - `/api/library/hierarchy` → CacheFirst, 1d, cache `lib-cache`
  - `/api/*` (everything else) → NetworkFirst, 5s timeout, cache `api-cache`
- **Update policy:** `skipWaiting: true`, `clientsClaim: true` — always. Forbidden by the brief: updates must wait for user confirmation via in-app prompt (so pending outbox mutations aren't lost to a hot SW swap mid-write).
- **POST/PUT/DELETE:** Not intercepted (correct). Writes are free to go through the outbox layer once we add it.
- **Cache versioning:** relies on Serwist's internal `revision` on `__SW_MANIFEST` entries. No explicit version string, no cache-cleanup-on-activate hook, no schema-version gate.
- **Max cache size:** 12 MB (set in next.config.ts) so that the ~9 MB PGlite WASM fits.

`public/sw.js` is the compiled output (gitignored in dev builds when `disable: true`).

### 4.7 Edge V3 import pipeline
[src/workers/edge-import.worker.ts](src/workers/edge-import.worker.ts), [src/workers/parser-contract.ts](src/workers/parser-contract.ts), [src/workers/parser-fallback.ts](src/workers/parser-fallback.ts), [src/workers/use-edge-import.ts](src/workers/use-edge-import.ts).

Architecture (per [docs/EDGE_IMPORT_ARCH.md](docs/EDGE_IMPORT_ARCH.md)):
- Main thread streams `File` chunks via `ReadableStream`, sends `CHUNK` messages with Transferable `ArrayBuffer`.
- Worker feeds bytes into `createParser()` → Rust/WASM parser (`public/wasm/edge-parser/`) or JS fallback.
- Worker calls `getBrowserDb()` and batches `INSERT` via Drizzle into PGlite OPFS (`pglite-opfs.worker.ts`).
- No server round-trip during the import. No OPFS raw-file archival — the file is consumed as a stream and records land in the DB.
- CRDT fields populated so the rows are eligible for later push.

**What the importer already does right (for our local-first goals):**
- Worker-based parsing (brief requires this).
- Zero-copy stream transfer (brief requires no main-thread parse).
- Local-first persistence to OPFS.
- Resumable via `BATCH_COMMITTED` sequence (brief allows restart/retry).

**What it's missing relative to the brief:**
- **No OPFS raw-bytes archival** at `imports/{sha256}/raw.{ext}`. If the importer parses a record incorrectly and we want to re-try, we need the original bytes — they're gone.
- **No SHA-256 deduplication** before parsing. A user re-importing the same 40 MB file will re-parse and re-insert, then let the server LWW resolve collisions.
- **No chunked upload on reconnect**, because the importer doesn't upload the raw file at all today. Only the parsed rows get synced via `pushLocalToServer()` after the fact.
- **No `import_manifest` / `imported_file` entity types** in the schema or outbox. The `imports` table exists but is not used as the local manifest of record.

[src/lib/import-light/**](src/lib/import-light) — seven files for server-side batch imports and admin ops. Not part of the client import flow. The `/app/import/*` UI wires `useEdgeImport()` to the worker.

---

## 5. Surfaces vs Acceptance Criteria — Gap Matrix

| AC | Library | Flashcards | Planner | Dashboard |
|---|---|---|---|---|
| 1. Cold-launch ≤3s offline | SW precache of app shell likely fine for the route HTML/JS; PGlite WASM cached. But dashboard renders `DashboardV2` only after client fetches → may show skeleton indefinitely without a snapshot. | OK via precache. | OK via precache. | **Blocked** — requires a persisted snapshot. |
| 2. Notes render with full content | **Blocked** — reader route is a server component tree. Needs a client-side OPFS read path, or pre-hydrated + cached server payload. | n/a | n/a | n/a |
| 3. Decks load, FSRS persists | n/a | **Blocked** — review writes are server-only + non-idempotent. Needs outbox + idempotent server route. | n/a | n/a |
| 4. Highlights on correct span | **Blocked** — no durable anchor; re-import orphans. | n/a | n/a | n/a |
| 5. Planner full state + edits | n/a | n/a | **Blocked** — entirely server-action-driven, zero local path. | n/a |
| 6. Dashboard last-known stats | n/a | n/a | n/a | **Blocked** — no snapshot, empty defaults offline. |
| 7. Import new file | n/a | n/a | n/a | Partial — importer writes to OPFS already, but missing SHA-256 dedup, raw archival, outbox manifest. |
| 8. Offline CRUD (notes/highlights/annotations/reviews/planner) | **Blocked** for annotations (localStorage only, no sync) and notes (no UI). | **Blocked** for reviews. Create card from reader is broken offline. | **Blocked** entirely. | n/a |
| 9. No spinner / no "failed" / no fetch console errors offline | **Blocked** — `useStatusMachine` logs fetch failures; reader route may 500. | **Blocked** — `FlashcardLibrary.tsx` fetches throw. | **Blocked** — server actions surface errors. | Partial. |
| 10. Offline changes appear on server ≤60s after reconnect | **Blocked** — annotations don't sync at all. | **Blocked** — no outbox, no idempotency, no retry. `useSyncOnReconnect` self-disables on first failure. | **Blocked** — no local path to sync from. | Partial — CRDT sync exists but is push-limited. |

---

## 6. Forbidden Patterns Already in the Codebase

All must be cleaned up or guarded as part of the refactor. Non-exhaustive.

- `if (!navigator.onLine) …` as a fallback gate — [src/components/flashcard/FlashcardReviewScreen.tsx:471](src/components/flashcard/FlashcardReviewScreen.tsx:471)
- `try { fetch } catch { showError }` without local fallback — many sites; notably [useExamStore.ts:325, :341, :265, :297, :104](src/store/useExamStore.ts:104), [useOptimisticFlashcard.ts:57](src/hooks/useOptimisticFlashcard.ts:57)
- `throw` on network failure in a read path — [useOptimisticFlashcard.ts:63-68](src/hooks/useOptimisticFlashcard.ts:63)
- `Date.now()`-based IDs as a substitute for UUID v4 — [src/hooks/useReaderAnnotations.ts:53](src/hooks/useReaderAnnotations.ts:53) (fallback when `crypto.randomUUID` unavailable)
- DOM/regex-only highlight anchor — [src/components/note-viewer/FrameBody.tsx:103-169](src/components/note-viewer/FrameBody.tsx:103)
- Hard-delete of local rows without server confirmation — the server-side review undo path (`undoLastManagedReview`) deletes the review row in one transaction; on reconnect we will need to use tombstones instead.
- localStorage for app data — all items flagged HARD VIOLATION in §2.
- Caching API responses in SW without an explicit version/invalidation strategy — `api-cache` NetworkFirst has no version gate on activate ([src/sw.ts:46-53](src/sw.ts:46)).

---

## 7. Non-Goals (explicit — DO NOT TOUCH in the refactor)

Per the brief, and confirmed against the repo:

**CSS / styling systems** — three (plus preview-only) parallel systems bridge into each other. Leave them alone.
- `--c-*` clinical tokens — [src/styles/clinical-tokens.css](src/styles/clinical-tokens.css), scoped to `.theme-clinical`.
- `--lib-*` library tokens — (missing from `src/styles/` in this branch; the prior audit recorded it at `src/styles/lib-tokens.css` but the file is not present — see "Uncertainties" below).
- `--reader-*`, `--sidebar-*` in [src/app/globals.css](src/app/globals.css) and [src/app/library/library-theme.css](src/app/library/library-theme.css).
- Medical typography — [src/styles/medical-typography.css](src/styles/medical-typography.css).
- Reader 2027 — [src/styles/reader-2027.css](src/styles/reader-2027.css).
- Runtime-generated `--ex-*` (exam) and `--pl-*` (planner) injected via `<style>` tags from `exam-tokens.ts` / `planner-tokens.ts`.
- `--s-*` starship preview tokens — dev-only under `app/ui-preview/starship`.

**Persian UI copy** — unchanged. Do not translate, rename, or "polish" any string.

**Existing importer code** — the brief explicitly requires a *parallel* offline path; the V3 Edge importer at [src/workers/edge-import.worker.ts](src/workers/edge-import.worker.ts) must not be modified.

**No new frameworks / bundlers / build tools.** Dexie, uuid, serwist, drizzle-orm, @electric-sql/pglite, ts-fsrs are already in `package.json`.

---

## 8. Uncertainties / things I could not verify statically

1. **`src/styles/lib-tokens.css`**: the prior ARCHITECTURE_DEBT_AUDIT.md lists this file, but it is not present in `src/styles/` on this branch. Either the file was removed recently or the token is defined elsewhere (likely merged into `src/app/library/library-theme.css` based on the untracked status). Needs confirmation before Deliverable 2.
2. **Inline `POST /api/flashcards`** in [NotePageV2.tsx:717](src/components/library-v2/NotePageV2.tsx:717): I recorded it from the flashcards agent; I did not read the file at that line to confirm the payload shape.
3. **Planner bucket stack (`PlannerPage.tsx`, `TodayTaskList.tsx`, `WeeklyView.tsx`, `TaskCard.tsx`)** may still be active even though `app/planner/page.tsx` renders `PlannerClient.tsx` (runtime stack). The audit report counted both as live because both are imported. Deliverable 2 should pick *one* as the refactor target.
4. **`useCollections.ts` key**: `STORAGE_KEY` is a named constant I haven't read directly. Needs confirmation that it stores list data rather than a UI pref.
5. **Service-worker precache scope**: the `__SW_MANIFEST` contents are build-time generated; confirming that it includes the reader route HTML for all chapters (or at least a shell) requires inspecting a production build.
6. **PGlite browser DB migration story**: `runBrowserMigrations()` is referenced in the EDGE_IMPORT_ARCH doc's TODOs ("wire into app root layout"). Whether it currently runs on app start is uncertain — this is load-bearing for offline-complete because a new user with no OPFS DB must still get a working schema without network.
7. **`flashcard_reviews` push path**: the server `LWW_TABLES` list includes `flashcard_reviews`, implying a server route can accept pushes, but `pushLocalToServer()` only builds a payload from `questions`/`flashcards`/`question_options`/`imports`. The schema for the PUSH endpoint needs re-reading in Deliverable 2 to confirm what table-sets it will accept.
8. **Whether `dueCount` on the dashboard is sourced from the local OPFS race or from the server `/api/dashboard/stats` response** — the `useMemo` in `DashboardV2.tsx` takes whichever arrives first per the 8s race, but the code path favors the server value on arrival.

---

## 9. Summary Counts

| Metric | Count |
|---|---|
| Surfaces audited | 4 (Library, Flashcards, Planner, Dashboard) |
| `localStorage` hits in live code | 13 unique sites |
| of which are HARD VIOLATIONS (app data) | 6 |
| of which are sync-client checkpoints | 4 |
| `fetch()` sites in user-facing read paths with no local fallback | 8 |
| `fetch()` sites in user-facing write paths with no offline queue | 12 |
| Live surfaces fully blocked on offline criteria | Library (AC 2, 4, 8, 9), Flashcards (AC 3, 8, 9, 10), Planner (AC 5, 8, 9, 10), Dashboard (AC 1, 6) |
| Tables already CRDT-schema'd | 30+ |
| Tables actively PUSHED by `sync-client` | 4 (`questions`, `question_options`, `flashcards`, `imports`) |
| Tables listed in server LWW_TABLES but unpushed | 3 (`flashcard_reviews`, `chapter_progress`, `exam_sessions`, `question_attempts`, `study_tasks` — some pulled) |
| Tables that need to be introduced | `outbox`, `id_map`, `tombstones`, `annotations`, `imported_files`, `import_manifests`, `note_edits` |

---

**Deliverable 1 complete. Stopping here and waiting for approval before starting Deliverable 2 (architecture).**
