/**
 * Web Locks API wrappers.
 *
 * Used to:
 *  - Coordinate the sync engine across multiple tabs (one tab syncs at a time).
 *  - Serialize entityType batches inside the sync engine.
 *
 * Semantics:
 *  - `withWebLock(name, fn)` waits for the named lock, runs `fn`, releases.
 *  - `tryWebLock(name, fn)` attempts to take the lock without blocking. If
 *     it's unavailable, `fn` is NOT called and the returned promise resolves
 *     to `{ ran: false }`.
 *  - When the Web Locks API is not available (old browsers, JSDOM), both
 *     helpers fall back to an in-memory per-name mutex that provides the
 *     same single-tab ordering guarantees (multi-tab coordination is lost
 *     but local state remains consistent).
 */

type LockManager = {
  request: (
    name: string,
    options: { mode?: "exclusive"; ifAvailable?: boolean },
    callback: (lock: unknown) => Promise<unknown>,
  ) => Promise<unknown>;
};

function getLockManager(): LockManager | null {
  const nav = (typeof navigator !== "undefined" ? navigator : null) as
    | (Navigator & { locks?: LockManager })
    | null;
  return nav?.locks ?? null;
}

// In-memory fallback — one queue per name, guarantees FIFO.
const inMemoryQueues = new Map<string, Promise<unknown>>();

async function withInMemoryLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const prev = inMemoryQueues.get(name) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  inMemoryQueues.set(
    name,
    prev.then(() => gate),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
    // Clean up the map if this was the tail of the queue.
    if (inMemoryQueues.get(name) === prev.then(() => gate)) {
      inMemoryQueues.delete(name);
    }
  }
}

const inMemoryHeld = new Set<string>();

async function tryInMemoryLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false }> {
  if (inMemoryHeld.has(name)) return { ran: false };
  inMemoryHeld.add(name);
  try {
    const value = await fn();
    return { ran: true, value };
  } finally {
    inMemoryHeld.delete(name);
  }
}

/** Waits for the lock, runs `fn`, releases. */
export async function withWebLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const lm = getLockManager();
  if (!lm) return withInMemoryLock(name, fn);
  return (await lm.request(name, { mode: "exclusive" }, async () => fn())) as T;
}

/** Takes the lock only if immediately available. Skips otherwise. */
export async function tryWebLock<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<{ ran: true; value: T } | { ran: false }> {
  const lm = getLockManager();
  if (!lm) return tryInMemoryLock(name, fn);
  let ran = false;
  let value: T | undefined;
  await lm.request(name, { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (lock === null) return;
    ran = true;
    value = await fn();
  });
  return ran ? { ran: true, value: value as T } : { ran: false };
}
