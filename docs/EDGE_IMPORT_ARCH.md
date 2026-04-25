# URO-OMEGA V3 — Absolute Edge Import Pipeline
## Architecture Handoff Document

**Version:** 3.0.0
**Status:** Infrastructure complete — UI layer TBD
**Owner:** Platform / Import Pipeline team

---

## 1. Executive Summary

The V3 import pipeline eliminates the main-thread JS parser and replaces it with a zero-latency, local-first stack:

| Layer | V2 (retired) | V3 (this document) |
|---|---|---|
| Parser | Main-thread JSON.parse | Rust/WASM in Web Worker |
| Storage | Server API → Neon cloud | OPFS (local, instant) + Neon (sync) |
| Concurrency | Blocking the UI | Off-main-thread, zero jank |
| Conflict resolution | Last HTTP write wins | LWW-CRDT (deterministic) |
| Offline support | None | Full (sync when online) |

---

## 2. Component Map

```
src/
├── db/
│   ├── schema.ts                 ← CRDT fields added to 3 tables
│   ├── pglite-opfs.worker.ts     ← PGlite OPFS owner (Web Worker)
│   └── pglite-browser.ts         ← Browser Drizzle singleton + CRDT helpers
│
├── workers/
│   └── edge-import.worker.ts     ← Import pipeline orchestrator (Web Worker)
│
└── (future)
    └── sync/
        └── neon-sync.worker.ts   ← Cloud sync engine (not yet implemented)

crates/
└── edge-parser/
    ├── Cargo.toml                ← Rust WASM crate manifest
    └── src/
        └── lib.rs                ← Streaming parser (Rust)

public/
└── wasm/
    └── edge-parser/              ← wasm-pack output (gitignored, built in CI)
        ├── edge_parser.wasm
        ├── edge_parser.js
        └── edge_parser_bg.wasm
```

---

## 3. Data Flow

```
Browser File API (ReadableStream)
    │
    │  64 KiB chunks
    ▼
React Component (main thread)
    │
    │  postMessage({ type: "CHUNK", data: ArrayBuffer }, [data])
    │  ← Transferable: zero-copy, buffer moves to worker
    ▼
edge-import.worker.ts (Web Worker)
    │
    │  wasm.parse_chunk(state_ptr, Uint8Array)
    │  ← WASM linear memory: no JS heap allocation for parsing
    ▼
edge-parser WASM (Rust, same worker thread)
    │
    │  returns JSON string of ParsedRecord[]
    ▼
edge-import.worker.ts
    │
    │  getBrowserDb() → Drizzle INSERT with LWW conflict clause
    ▼
PGliteWorker  (pglite-opfs.worker.ts, separate Web Worker)
    │
    │  OPFS exclusive write lock
    ▼
OPFS File System  ← persistent, origin-scoped, fast
    │
    │  (background, when online)
    ▼
Neon Cloud DB  ← eventual consistency via CRDT sync
```

---

## 4. postMessage Interface (Strict Specification)

### 4.1 Message Direction Conventions

- All messages are plain JSON-serializable objects.
- `ArrayBuffer` payloads MUST be sent as Transferable objects (third argument to `postMessage`) to achieve zero-copy transfer.
- After transfer, the sender's `ArrayBuffer` is detached (`.byteLength === 0`).

### 4.2 Main Thread → Worker

#### `INIT`
Must be the first message. Sent exactly once per import session.

```typescript
{
  type: "INIT",
  payload: {
    importId: string;       // ULID, app-generated, stored in imports table
    fileType: "jsonl";      // Only "jsonl" supported in V3
    fileName?: string;      // Display name for UI
    fileSizeBytes: number;  // Used to compute progress percentage
    batchSize?: number;     // Records per PGlite transaction (default: 250)
  }
}
```

**Invariants:**
- `importId` must not already exist in the `imports` table (or the UI must handle the conflict).
- `fileSizeBytes` must be > 0. If unknown (e.g., streaming from network), pass `Infinity`.

#### `CHUNK`
Sent once per ReadableStream chunk. Chunks MUST arrive in order.

```typescript
{
  type: "CHUNK",
  payload: {
    data: ArrayBuffer;      // Transferable — zero-copy to worker
    chunkIndex: number;     // 0-based, monotonically increasing
    isLast: boolean;        // true only for the final chunk
  }
}
// Transfer syntax:
worker.postMessage({ type: "CHUNK", payload }, [payload.data]);
```

**Invariants:**
- `chunkIndex` must equal the previous `chunkIndex + 1`. The worker will post `ERROR { code: "PROTOCOL_VIOLATION" }` if ordering is violated.
- `data.byteLength` must be > 0 for all chunks except optionally the last.
- Exactly one chunk must have `isLast: true`. It must be the last chunk sent.

#### `ABORT`
Cancels the in-progress session. Safe to send at any time after `INIT`.

```typescript
{
  type: "ABORT",
  payload: {
    reason: string;   // Human-readable reason for logging
  }
}
```

### 4.3 Worker → Main Thread

#### `WORKER_READY`
Posted once after `INIT` succeeds (WASM loaded, PGlite connected).

```typescript
{ type: "WORKER_READY" }
```

The main thread MUST NOT send `CHUNK` before receiving `WORKER_READY`.

#### `PARSE_PROGRESS`
Posted after every chunk is fed to the WASM parser.

```typescript
{
  type: "PARSE_PROGRESS",
  payload: {
    bytesProcessed: number;   // Cumulative bytes consumed by WASM parser
    fileSizeBytes: number;    // Echo of InitPayload.fileSizeBytes
    recordsBuffered: number;  // Running total records emitted by parser
  }
}
```

Progress percentage formula: `Math.round((bytesProcessed / fileSizeBytes) * 100)`

#### `DB_PROGRESS`
Posted after every micro-batch is committed to PGlite/OPFS.

```typescript
{
  type: "DB_PROGRESS",
  payload: {
    recordsWritten: number;  // Records in this batch
    recordsTotal: number;    // Cumulative records written across all batches
  }
}
```

#### `BATCH_COMMITTED`
Posted immediately after `DB_PROGRESS` for each committed micro-batch.

```typescript
{
  type: "BATCH_COMMITTED",
  payload: {
    batchSeq: number;    // 1-based sequence number within this import session
    count: number;       // Records in this batch
    importId: string;    // Echo of InitPayload.importId
  }
}
```

Use `batchSeq` + `importId` to implement retry-idempotent checkpointing: if the worker crashes and restarts, the main thread can resume from the last committed `batchSeq`.

#### `COMPLETE`
Final message. Posted only after the last chunk is processed and all records committed.

```typescript
{
  type: "COMPLETE",
  payload: {
    importId: string;
    questionsInserted: number;
    questionsUpdated: number;
    flashcardsInserted: number;
    flashcardsUpdated: number;
    parseErrors: number;      // Lines that failed JSON parsing
    durationMs: number;
  }
}
```

#### `ERROR`
Unrecoverable error. The worker self-terminates after posting this.

```typescript
{
  type: "ERROR",
  payload: {
    code: "WASM_LOAD_FAILED"
         | "DB_INIT_FAILED"
         | "PARSE_FATAL"
         | "DB_WRITE_FAILED"
         | "PROTOCOL_VIOLATION"
         | "UNKNOWN";
    message: string;
    details?: unknown;   // Raw error object / stack trace
  }
}
```

#### `ABORTED`
Posted in response to an `ABORT` message. Worker terminates immediately after.

```typescript
{ type: "ABORTED" }
```

---

## 5. CRDT Sync Protocol

### 5.1 LWW Register Definition

Each CRDT-capable row carries a **composite logical timestamp** `(updatedAt, logicalClock, originId)`.

**Resolution rule:** Given two versions of the same row (identified by `external_key`), the winner is determined by:

1. Higher `logicalClock` wins.
2. If equal: higher `updatedAt` (ms epoch) wins.
3. If equal: lexicographically greater `originId` wins.

This is a total order — two concurrent writes from different origins will always converge to the same winner.

### 5.2 CRDT-Capable Tables

| Table | CRDT fields added | High-frequency? |
|---|---|---|
| `questions` | `is_deleted`, `logical_clock`, `origin_id` | No (content rarely changes) |
| `flashcards` | `is_deleted`, `logical_clock`, `origin_id` | **Yes** (FSRS state on every review) |
| `ingest_batches` | `updated_at`, `is_deleted`, `logical_clock`, `origin_id` | No |

### 5.3 Soft Deletes

**Never `DELETE` a CRDT row.** Always `UPDATE SET is_deleted = 1, logical_clock = nextClock()`.

Read queries against CRDT tables MUST include a `WHERE is_deleted = 0` filter or use the live view (TBD in sync layer).

### 5.4 Sync Delta Query

The cloud sync endpoint asks: *"give me everything changed since I last synced."*

```sql
-- Pull delta for sync (questions example)
SELECT * FROM questions
WHERE logical_clock > :last_synced_clock
ORDER BY logical_clock ASC
LIMIT 1000;
```

The `clockIdx` index on `logical_clock` makes this O(log n) regardless of table size.

### 5.5 Merge Algorithm (pseudocode)

```typescript
function mergeRow(local: CrdtRow, remote: CrdtRow): CrdtRow {
  const localTs  = [local.logicalClock,  local.updatedAt,  local.originId ?? ""];
  const remoteTs = [remote.logicalClock, remote.updatedAt, remote.originId ?? ""];
  return compareTs(remoteTs, localTs) > 0 ? remote : local;
}

function compareTs(a: [number, number, string], b: [number, number, string]): number {
  if (a[0] !== b[0]) return a[0] - b[0];  // logicalClock
  if (a[1] !== b[1]) return a[1] - b[1];  // updatedAt
  return a[2].localeCompare(b[2]);          // originId
}
```

---

## 6. Build Pipeline

### 6.1 Rust WASM Build

```bash
# Prerequisites (run once)
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --version 0.13.0

# Build (run in CI and before `next build`)
cd crates/edge-parser
wasm-pack build \
  --target bundler \
  --release \
  --out-dir ../../public/wasm/edge-parser

# Verify binary size (target: < 100 KiB)
ls -lh ../../public/wasm/edge-parser/*.wasm
```

Expected output files:
- `edge_parser_bg.wasm` — the actual WASM binary (target: < 100 KiB)
- `edge_parser.js` — JS glue module (ESM, imported by the worker)
- `edge_parser.d.ts` — TypeScript declarations (the `EdgeParserWasm` interface)

### 6.2 Next.js Configuration

Add to `next.config.ts`:

```typescript
const nextConfig = {
  experimental: {
    // Required for `new Worker(new URL(…, import.meta.url))` pattern
    workerThreads: true,
  },
  webpack(config) {
    // Tell webpack to treat .wasm files as asset/resource
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });
    return config;
  },
};
```

### 6.3 tsconfig.json Path Alias

Add to `tsconfig.json` `paths`:

```json
"@/wasm/*": ["./public/wasm/*"]
```

---

## 7. Failure Modes & Recovery

| Failure | Symptom | Recovery |
|---|---|---|
| OPFS quota exceeded | `DOMException: QuotaExceededError` | Show UI prompt to clear OPFS, retry |
| WASM load failure | `ERROR { code: "WASM_LOAD_FAILED" }` | Check `public/wasm/edge-parser/` exists |
| Worker crash (tab close) | No `COMPLETE` | Retry from last `BATCH_COMMITTED.batchSeq` |
| Multi-tab OPFS race | Second tab's queries proxy via leader; <1ms latency overhead | Transparent — handled by PGliteWorker leader election |
| Neon sync conflict | Two clients edited same question | LWW CRDT resolves deterministically; last logical clock wins |

---

## 8. Open TODOs for the UI Layer Author

- [ ] Implement the `ReadableStream` pump that feeds `CHUNK` messages from a `File` object.
- [ ] Create the `neon-sync.worker.ts` that runs the delta sync described in §5.4.
- [ ] Add a `live view` in Drizzle that auto-filters `WHERE is_deleted = 0` for all CRDT tables.
- [ ] Add `flashcardCreatedFrom` = `"import"` to the `flashcardCreatedFrom` enum in schema.ts.
- [ ] Wire `runBrowserMigrations()` (from `pglite-browser.ts`) into the app root layout.
- [ ] Add the `@/wasm/*` tsconfig path alias and `next.config.ts` changes from §6.3.
- [ ] Unit-test the `mergeRow` function from §5.5 with property-based tests (fast-check).
