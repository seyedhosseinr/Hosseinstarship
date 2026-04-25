# Offline-Complete Acceptance Report

**Branch:** `feat/dashboard-v2`
**Date:** 2026-04-16
**Build:** Next.js 15.5.15, production mode (`next build` + `next start -p 4100`)
**Feature flag:** `STARSHIP_LOCAL_FIRST=1` via `localStorage['starship-local-first-override']`

**Build verification (2026-04-16 13:25 UTC):**
```
tsc --noEmit     → exit 0
vitest run       → 12/12 passed, exit 0
next build       → 0 errors, 50 static pages, exit 0
```

**Status policy:**
- **PASS** = proven through direct real UI flow with network offline, screenshot evidence, console log verbatim, network tab failures documented
- **OPEN** = not fully proven — offline UI-flow evidence not captured
- **FAIL** = disproven through direct observation

Store-level probes, endpoint pokes, mechanism checks, and "should work" reasoning are NOT evidence. They are disqualifying.

---

## HARD STOP — Offline Simulation Not Available

**Triggered at:** 2026-04-16 13:26 UTC, before AC1 Step B.

**Environment:** Claude Code preview browser (headless Chromium via CDP) connected to `next start -p 4100` on `localhost`.

**What was attempted:**
1. `Object.defineProperty(navigator, 'onLine', { value: false })` — succeeds in page context, but does not affect actual network layer. SW `NetworkFirst` strategy still reaches server.
2. `window.fetch = () => Promise.reject(new TypeError('Failed to fetch'))` — blocks page-level fetch, but override is lost on page reload. The browser's own navigation/HTML fetch is unaffected.
3. `window.dispatchEvent(new Event('offline'))` — fires event, but `navigator.onLine` resets to `true` after page reload.

**Proof that override does not survive reload:**
```
Before reload: navigator.onLine = false (overridden), fetch = patched
After  reload: navigator.onLine = true (native),     fetch = native
```

**Why this blocks every criterion:**
- Every AC requires Step C: "Full page reload while offline → Wait for render → Screenshot"
- On reload, all JS overrides are cleared. The browser makes a real HTTP request to `localhost:4100`. Since the server is running on the same machine, the request succeeds. The page loads fresh from server, not from SW cache.
- The preview browser tools (preview_start, preview_eval, preview_screenshot, etc.) do not expose CDP `Network.emulateNetworkConditions`. There is no way to block network at the protocol level.

**Conclusion:** All 10 criteria require offline page reload, which cannot be simulated from this environment. All remain OPEN. This is not a code deficiency — it is an environment limitation.

---

## AC 1 — Cold-launch ≤3s offline

### Status: OPEN

### Step A evidence:
- Production server running: `next start -p 4100`
- Dashboard-v2 loads online: HTTP 200
- SW registered and activated: `{ scope: 'http://localhost:4100/', active: 'activated' }`
- Local-first flag set: `localStorage['starship-local-first-override'] = '1'`

### Step B evidence:
- **BLOCKED.** Cannot toggle offline in preview browser. `navigator.onLine` override does not survive reload. Actual network to localhost remains up. See HARD STOP section above.

### Step C evidence:
- Screenshot: not captured (Step B blocked)
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none (Step B blocked)
- Screenshot: none
- Console output: none

### Step E evidence:
- Outbox drain time: n/a
- Server confirmation: n/a

### Verdict justification:
Cannot be evaluated. The criterion requires closing the tab, reopening the URL while offline, and measuring `performance.timing.loadEventEnd - navigationStart < 3000ms`. The preview browser cannot simulate offline at the network layer. A page reload while the server is running will always load fresh from server, not from SW cache. Status remains OPEN.

### Remaining risk:
SW precache completeness for all route chunks unverified. Actual cold-launch timing under airplane mode unmeasured.

---

## AC 2 — Previously-opened notes/reader render offline

### Status: OPEN

### Step A evidence:
- Reader route `/library/campbell/chapter/[chapterNo]` is a server component with `dynamic = "force-dynamic"`. No chapter was loaded during this session.
- SW uses `NetworkFirst` with 5s timeout — a previously visited chapter would be cached.

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none
- Screenshot: none
- Console output: none

### Step E evidence:
- n/a

### Verdict justification:
Cannot be evaluated. The criterion requires loading a chapter online, going offline, reloading the same URL, and confirming content renders from SW cache. The preview browser cannot go offline. Additionally, the reader is a server component — offline rendering depends entirely on SW cache of the RSC payload, not on client-side Dexie data. Status remains OPEN.

### Remaining risk:
SW cache eviction could clear content. A never-visited chapter will not render offline.

---

## AC 3 — Flashcard decks load, FSRS persists, reviews sync on reconnect

### Status: OPEN

### Step A evidence:
- `FlashcardReviewScreen.tsx:486-503` calls `submitReviewLocal()` regardless of server success when flag is on.
- `refreshQueue()` catch block handles offline gracefully.
- No flashcard review session was started in the preview browser (requires DB-seeded queue data).

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none — cannot click "Good" on a card while offline
- Screenshot: none
- Console output: none

### Step E evidence:
- Outbox drain time: n/a
- Server confirmation: n/a

### Verdict justification:
Cannot be evaluated. The criterion requires loading the review queue, going offline, rating a card, verifying Dexie persistence, reloading, and confirming the queue still renders. None of these steps could be executed with the network actually severed. Automated tests (S2, S3, S5, S7, S8) pass at the unit level. Status remains OPEN.

### Remaining risk:
No offline UI test confirms end-to-end flow. Queue loading depends on server API.

---

## AC 4 — Highlights land on correct text span after re-import

### Status: OPEN

### Step A evidence:
- Annotation creation is local-first: `useReaderAnnotations.ts:148-224` writes to Dexie immediately.
- SyncDot appears on each annotation in ReaderAnnotationsPanel.
- Re-anchor: `anchoring.ts:199-260` runs 3-step cascade (checksum → unique-quote → fuzzy Levenshtein ≤10%).
- No chapter was loaded in this session, so no annotation was created.

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none — cannot select text and create highlight while offline
- Screenshot: none
- Console output: none

### Step E evidence:
- Outbox drain time: n/a
- Server confirmation: n/a

### Verdict justification:
Cannot be evaluated. The criterion requires creating a highlight online, going offline, reloading, confirming the highlight renders on the correct span, creating a second highlight offline, reloading, and confirming both are correct. No part of this flow was executed. Automated test S9 (orphan + unique-quote recovery) passes at the unit level. Status remains OPEN.

### Remaining risk:
FrameBody renders highlights via regex — multiple identical quotes could highlight wrong instance.

---

## AC 5 — Planner full state + edits work offline

### Status: OPEN

### Step A evidence:
- Planner page loaded in production preview at `http://localhost:4100/planner`.
- Page rendered with Persian UI, showing "پرش به داشبورد آرام" link.
- Zero console errors observed during online load.
- No task data was present (no active plan seeded from server — DB dependency).
- All 5 planner UI components are wired with local-first gate (code evidence only).

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none — cannot click "تکمیل" on a task while offline (no tasks visible without DB data, and cannot go offline regardless)
- Screenshot: none
- Console output: none

### Step E evidence:
- Outbox drain time: n/a
- Server confirmation: n/a

### Verdict justification:
Cannot be evaluated. The criterion requires loading the planner with seeded tasks, going offline, reloading, confirming tasks are visible, completing a task, confirming status update persists across reload, and verifying server receipt on reconnect. The planner page loaded online but showed no tasks (no active plan in the database). Offline reload was not possible. Status remains OPEN.

### Remaining risk:
No active plan data seeded. Upcoming tasks not seeded to Dexie.

---

## AC 6 — Dashboard shows last-known stats offline

### Status: OPEN

### Step A evidence:
- Dashboard-v2 loaded at `http://localhost:4100/dashboard-v2` in production mode.
- `useDashboardData.ts` calls `loadDashboardSnapshot()` on mount when flag is on, before server fetch.
- `captureDashboardSnapshot()` saves server response to Dexie on every successful fetch.
- SW confirmed active with scope `http://localhost:4100/`.

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none
- Screenshot: none
- Console output: none

### Step E evidence:
- n/a

### Verdict justification:
Cannot be evaluated. The criterion requires loading the dashboard online (letting stats populate and snapshot save to Dexie), going offline, reloading, and confirming stats are visible from the snapshot. Cannot isolate the snapshot path from the server path without actual network disconnection. Status remains OPEN.

### Remaining risk:
Cannot distinguish snapshot-rendered stats from server-rendered stats without network disconnection.

---

## AC 7 — Import new file offline

### Status: OPEN

### Step A evidence:
- `ImportUploadPanel.tsx` `handleSubmit()` gates on `isLocalFirstEnabled()`. When true, calls `importFileOffline()` for each selected file.
- `importFileOffline()` computes SHA-256, dedupes, writes to OPFS, creates Dexie manifest, enqueues outbox mutation.
- Import page loading attempted but server component timed out (database dependency). Upload panel not directly exercised.

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none — import page requires server component to render (DB dependency), and cannot go offline regardless
- Screenshot: none
- Console output: none

### Step E evidence:
- Outbox drain time: n/a
- Server confirmation: n/a

### Verdict justification:
Cannot be evaluated. The criterion requires going offline, opening /import, selecting a file, submitting, confirming it appears in the library, and verifying server receipt on reconnect. The import page itself is a server component with DB dependency — it may not render offline at all (the upload panel is a client component inside a server-rendered page). No file selection was performed. Automated test S10 (SHA-256 dedupe) passes at the unit level. Status remains OPEN.

### Remaining risk:
Import page server component may not render offline. Offline import stores raw bytes + manifest only — content not parsed locally.

---

## AC 8 — Offline CRUD (annotations/reviews/planner/imports)

### Status: OPEN

### Step A evidence:
- Code wiring confirmed for all entity types:

  | Entity | UI Wired? | Code Path |
  |---|---|---|
  | Annotations | Yes | `useReaderAnnotations.ts` → `annotations.ts` → Dexie + outbox |
  | Flashcard reviews | Yes | `FlashcardReviewScreen.tsx:486-503` → `submitReviewLocal` |
  | Planner items | Yes | All 5 TaskCard handlers + RescheduleDialog gate on flag |
  | Imports | Yes | `ImportUploadPanel.tsx` → `importFileOffline()` |
  | Notes (create/edit) | **OUT OF SCOPE** | No UI exists for note creation/editing |

- No offline CRUD was performed through the UI.

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none — cannot create annotation, complete task, submit review, or delete annotation while offline
- Screenshot: none
- Console output: none

### Step E evidence:
- Outbox drain time: n/a
- Server confirmation: n/a

### Verdict justification:
Cannot be evaluated. The criterion requires going offline, performing CRUD operations through actual UI clicks across multiple entity types, verifying Dexie persistence, and confirming server receipt on reconnect. No offline CRUD was performed. Code wiring is confirmed but not exercised. Status remains OPEN.

### Remaining risk:
Notes UI does not exist (OUT OF SCOPE). All other entities wired but unverified through UI flow.

---

## AC 9 — Full offline walkthrough, zero errors

### Status: OPEN

### Step A evidence:
- Online evidence only:
  - Debug panel at `/debug/local-first` loaded with zero console errors in production mode.
  - `preview_console_logs(level='error')` → "No console logs."
  - `preview_logs(level='error')` → no server errors.

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured for offline walkthrough
- Network failures: not captured

### Step D evidence:
- Action performed: none — cannot visit dashboard → library → chapter → flashcards → planner → import while offline
- Screenshot: none
- Console output: none

### Step E evidence:
- n/a

### Verdict justification:
Cannot be evaluated. The criterion requires an offline cold start, then visiting 6 surfaces in sequence, capturing screenshots and console errors at each. Online-only evidence (zero errors on debug panel) does not qualify. Multiple surfaces are server components (`/library`, `/import`, `/flashcards`) that may not render offline without SW cache. Status remains OPEN.

### Remaining risk:
Server components may produce loading states or errors offline. `/import` server component known to time out without DB.

---

## AC 10 — Offline changes appear on server ≤60s after reconnect

### Status: OPEN

### Step A evidence:
- Sync engine triggers: T0 cold-start, T1 `online` event, T2 `visibilitychange`, T3 manual, T4 30s timer.
- Push endpoint idempotency: same mutationId replayed → `{ idempotent: true }`.
- Debug panel confirms sync engine ran: last tick timestamp visible.
- Automated tests S5, S6, S7 pass at unit level.

### Step B evidence:
- **BLOCKED.** See HARD STOP section.

### Step C evidence:
- Screenshot: not captured
- Console errors: not captured
- Network failures: not captured

### Step D evidence:
- Action performed: none — cannot perform 5 distinct offline mutations across 3 entity types, then reconnect
- Screenshot: none
- Console output: none

### Step E evidence:
- Outbox drain time: not measured
- Server confirmation: not obtained

### Verdict justification:
Cannot be evaluated. The criterion requires performing 5 offline mutations, noting their mutationIds, going online, timing the outbox drain to under 60s, and confirming exactly 5 rows on the server. No offline mutations were performed. No reconnect cycle was observed. Status remains OPEN.

### Remaining risk:
No actual offline → reconnect → sync cycle observed. Wall-clock drain timing unmeasured.

---

## Failure Scenario Test Results

**Command:** `npx vitest run` (2026-04-16 13:25 UTC)
**Result:** Test Files 1 passed (1) — Tests 12 passed (12)

| # | Required Scenario | Test Name | Result |
|---|---|---|---|
| S1 | Partial write / tab crash rollback | transactional enqueue leaves no orphan annotation row | PASS |
| S2 | Cross-tab concurrency / idempotency | idempotency ledger prevents double application | PASS |
| S3 | Transient 5xx → backoff | row stays pending with increasing nextAttemptAt | PASS |
| S4 | 409 conflict → no retry | row transitions to 'conflict', stays out of claim pool | PASS |
| S5 | Offline drain ordering | claims pending rows in localCreatedAt order after reconnect | PASS |
| S6 | Delete depends on create | delete mutation depends on the create mutation | PASS |
| S7 | Duplicate mutationId replay | markApplied twice is a no-op on second call | PASS |
| S8 | MAX_ATTEMPTS → failed | after MAX_ATTEMPTS transient failures, row → 'failed' | PASS |
| S9 | Re-anchor on block edit | orphans annotation when block text changed beyond tolerance + unique-quote recovery | PASS (2 sub-tests) |
| S10 | Import SHA-256 dedupe | second import of identical bytes returns existing manifest | PASS |
| Bonus | markFatal exits queue | markFatal leaves row in 'failed' with no nextAttemptAt | PASS |

---

## Production Build Evidence

```
tsc --noEmit     → exit 0
vitest run       → 12/12 passed, exit 0
next build       → 0 errors, 50 static pages, exit 0
```

---

## Notion-Adjacent Features

### Per-entity sync status — OPEN (wired, not offline-verified)

- **Implementation:** `useEntitySyncStatus` hook + `SyncDot` component wired into `TaskCard.tsx` and `ReaderAnnotationsPanel.tsx`. Persian tooltips.
- **Evidence:** Code compiles, builds. Cannot verify amber→green dot transition without offline→online cycle.

### Offline search — OPEN (wired, not offline-verified)

- **Implementation:** FlexSearch 0.7.43 `search-index.ts` injected into `CommandPalette.tsx`. Ctrl+K opens palette in production preview.
- **Evidence:** Palette opens online with zero errors. Cannot verify offline search results without offline mode and populated Dexie data.

### Offline attachments — OPEN (module built, not wired to UI)

- **Blocker:** Reader (`FrameBody.tsx`) renders plain text, no `<img>` tags. Module complete but unwired.

### Local undo/redo — OPEN (wired, not offline-verified)

- **Implementation:** `undo-stack.ts` + `useUndo` hook + Ctrl+Z/Ctrl+Shift+Z in `LocalFirstBoot.tsx`.
- **Evidence:** Code compiles, builds. Cannot verify without performing a task mutation and pressing Ctrl+Z.

### Performance panel — OPEN (wired, UI partially verified online)

- **Implementation:** Dexie store counts + Performance API measures in `DebugPanel.tsx`.
- **Evidence:** Debug panel renders in production mode with store counts visible. No `lf-` performance marks emitted yet.

### Conflict UI — OPEN (wired, not verified)

- **Implementation:** `ConflictBanner.tsx` mounted in `LocalFirstBoot.tsx`.
- **Evidence:** Code compiles, builds. Banner hidden when no conflicts exist (correct). Cannot verify banner appearance without artificially creating conflict rows.

---

## Explicitly Out of Scope

- **Real-time collaboration** — requires block-level CRDT (Yjs/Automerge) and WebSocket presence.
- **Block-level CRDT merge** — current outbox uses entity-level mutations.
- **Presence/cursors** — no WebSocket layer exists.
- **Cross-device live sync** — current sync is pull-based (30s timer + online event).
- **Notes UI (AC8 partial)** — no user-facing note creation/editing UI exists.

---

## Remaining Implementation Gaps

1. **Upcoming tasks not seeded locally (AC5 partial):** `TodayTaskList.tsx` calls `getUpcomingTasksAction(10)` — server result not seeded into Dexie.
2. **Offline attachment wiring:** `attachments.ts` module complete but reader has no images to wire to.
3. **Performance marks not instrumented:** Panel reads `lf-` prefixed marks but no code emits them.

---

## iPad Airplane Mode Gate

**Status: OPEN (unchanged)**

This acceptance run executed in a headless Chromium preview browser connected to `localhost:4100`. The preview tools do not expose CDP `Network.emulateNetworkConditions`. There is no physical iPad, no iPadOS Safari, no hardware Airplane Mode toggle. Every offline criterion requires a full page reload with the network actually severed — impossible in this environment.

### Human verification checklist

| AC | What to verify | How | Expected result |
|---|---|---|---|
| 1 | Cold launch ≤3s offline | Stopwatch: tap PWA icon → first paint | ≤3s |
| 2 | Previously-opened chapter renders | Open chapter visited online, go offline, reload | Full text visible |
| 3 | Flashcard reviews persist offline | Rate cards offline, close/reopen | All reviews in Dexie |
| 4 | Highlights on correct span | Create highlight, go offline, reload | Highlight on correct text |
| 5 | Planner shows state + accepts edits | Open planner offline, complete task | Task status updates |
| 6 | Dashboard shows last-known stats | Go offline, reload dashboard | Non-zero stats from snapshot |
| 7 | Import works offline | Select file offline, submit | "Queued for sync" shown |
| 8 | All offline CRUD persists | Offline: annotate, review, complete, import | All persist in Dexie |
| 9 | No errors across full tour | Offline cold start, visit 6 surfaces | Zero console errors |
| 10 | Sync ≤60s after reconnect | Go online, time outbox drain | All mutations synced ≤60s |

---

## Final Acceptance Tally

- **PASS: 0 / 10**
- **OPEN: 10 / 10**
- **FAIL: 0 / 10**
- **iPad Airplane Mode gate: OPEN (unchanged)**

### Why zero PASS

Every criterion requires offline page reload evidence. The preview browser cannot simulate offline at the network layer (no CDP `Network.emulateNetworkConditions`, no DevTools offline toggle). JS-level overrides (`navigator.onLine`, `fetch`) do not survive page reload. The actual TCP connection to `localhost:4100` remains live. This is an environment limitation, not a code deficiency.

### What was proven

- `tsc --noEmit` → exit 0 (type safety)
- `vitest run` → 12/12 passed (outbox state machine, idempotency, conflict handling, anchoring, dedup)
- `next build` → 0 errors, 50 static pages (production build)
- Production server renders pages with zero console errors (online only)
- SW registered and activated
- All local-first code paths wired and type-checked

### What was NOT proven

- Any page rendering from SW cache after offline reload
- Any Dexie-cached data rendering without server
- Any user action performed while offline
- Any outbox drain timing after reconnect
- Any offline→online state transition observed through UI

---

## Engineering Honest Self-Assessment

- **Foundation: 7/10** — Dexie schema, outbox, sync engine, push/pull endpoints, idMap, tombstones, Web Lock — all tested at unit level. Missing: performance instrumentation.
- **Product completeness: 6/10** — All primary CRUD surfaces wired. Notes UI doesn't exist. Attachments built but unwired. Search built and injected.
- **Sync reliability: 7/10** — 12/12 failure scenario tests pass. Missing: wall-clock drain timing, actual offline→online observation.
- **Offline UX quality: UNVERIFIED** — All UI components built (sync dots, conflict banner, undo/redo, search). Zero offline testing performed. Cannot rate what was not observed.
- **Gap to Notion-grade:** Block-level CRDT, real-time collab, presence, WebSocket live sync, conflict-free merge.
- **Recommended next step:** Test on a real device with actual Airplane Mode toggle, or use a browser with DevTools offline toggle access (not a headless preview).
