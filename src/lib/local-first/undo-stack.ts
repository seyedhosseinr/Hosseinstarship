/**
 * Local undo/redo stack for entity-level mutations.
 *
 * Every local-first write pushes an inverse entry here so the user can
 * Ctrl+Z to revert. This is NOT rich-text undo — it only covers
 * entity-level actions (complete task, create annotation, reschedule, etc.).
 *
 * Cap: 100 entries per entityType (FIFO eviction).
 */

import type { EntityType, OutboxOperation, UndoEntry } from "./idb";
import { getLocalDb } from "./idb";
import { enqueueMutation } from "./outbox";
import { uuidV4 } from "./uuid";

const MAX_PER_TYPE = 100;

/** Redo stack lives in memory only — cleared on navigation. */
let redoStack: UndoEntry[] = [];

export function clearRedoStack() {
  redoStack = [];
}

export async function pushUndo(entry: Omit<UndoEntry, "id" | "createdAt">): Promise<void> {
  const db = getLocalDb();
  const row: UndoEntry = {
    ...entry,
    id: uuidV4(),
    createdAt: new Date().toISOString(),
  };
  await db.undoStack.put(row);
  // Clear redo on new action
  redoStack = [];

  // FIFO eviction
  const all = await db.undoStack
    .where("entityType")
    .equals(entry.entityType)
    .sortBy("createdAt");
  if (all.length > MAX_PER_TYPE) {
    const toDelete = all.slice(0, all.length - MAX_PER_TYPE).map((r) => r.id);
    await db.undoStack.bulkDelete(toDelete);
  }
}

export async function popUndo(): Promise<UndoEntry | null> {
  const db = getLocalDb();
  const all = await db.undoStack.orderBy("createdAt").reverse().first();
  if (!all) return null;
  await db.undoStack.delete(all.id);
  redoStack.push(all);
  return all;
}

export function popRedo(): UndoEntry | null {
  return redoStack.pop() ?? null;
}

export async function getUndoCount(): Promise<number> {
  return getLocalDb().undoStack.count();
}

export function getRedoCount(): number {
  return redoStack.length;
}

/**
 * Apply an inverse operation — writes the mutation to the entity store
 * and enqueues it in the outbox.
 */
export async function applyInverse(entry: UndoEntry): Promise<void> {
  const db = getLocalDb();

  if (entry.entityType === "planner_item") {
    const task = await db.plannerTasks.get(entry.entityLocalId);
    if (!task) return;
    const payload = entry.inversePayload as Record<string, unknown>;
    const status = (payload.status as string) ?? task.status;
    await db.plannerTasks.put({
      ...task,
      status: status as "pending" | "in_progress" | "completed" | "skipped",
      payload: { ...((task.payload ?? {}) as Record<string, unknown>), status },
      localUpdatedAt: new Date().toISOString(),
    });
    await enqueueMutation({
      entityType: "planner_item",
      entityLocalId: entry.entityLocalId,
      operation: entry.inverseOperation,
      payload: entry.inversePayload,
    });
  } else if (entry.entityType === "annotation") {
    if (entry.inverseOperation === "create") {
      // Re-create deleted annotation
      const payload = entry.inversePayload as Record<string, unknown>;
      await db.annotations.put(payload as never);
      await enqueueMutation({
        entityType: "annotation",
        entityLocalId: entry.entityLocalId,
        operation: "create",
        payload: entry.inversePayload,
      });
    } else if (entry.inverseOperation === "delete") {
      await db.annotations.delete(entry.entityLocalId);
      await enqueueMutation({
        entityType: "annotation",
        entityLocalId: entry.entityLocalId,
        operation: "delete",
        payload: entry.inversePayload,
      });
    }
  }
}
