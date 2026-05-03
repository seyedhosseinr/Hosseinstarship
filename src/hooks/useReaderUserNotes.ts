"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserNoteRow } from "@/lib/local-first/idb";
import {
  createUserNote,
  updateUserNote,
  deleteUserNote,
  listUserNotesForDoc,
} from "@/lib/local-first/user-notes";

/**
 * React hook that manages user notes for the current reader context.
 *
 * Backed by the local Dexie `userNotes` store with outbox mutation
 * enqueuing — works fully offline, syncs to the server in the background.
 *
 * All writes immediately refresh the local list so the UI stays reactive.
 */
export function useReaderUserNotes(
  docId: string,
  segmentId: string,
  chapterNo: number | null,
) {
  const [notes, setNotes] = useState<UserNoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await listUserNotesForDoc(docId);
      setNotes(rows);
    } catch (err) {
      console.error("[useReaderUserNotes] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const create = useCallback(
    async (title: string | null, body: string): Promise<UserNoteRow> => {
      const row = await createUserNote({ docId, segmentId, chapterNo, title, body });
      await reload();
      return row;
    },
    [docId, segmentId, chapterNo, reload],
  );

  const update = useCallback(
    async (
      id: string,
      patch: { title?: string | null; body?: string },
    ): Promise<void> => {
      await updateUserNote(id, patch);
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteUserNote(id);
      await reload();
    },
    [reload],
  );

  return {
    notes,
    loading,
    create,
    update,
    remove,
  };
}
