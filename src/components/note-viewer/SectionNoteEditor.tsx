"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserNoteRow } from "@/lib/local-first/idb";
import {
  createUserNote,
  deleteUserNote,
  listUserNotesForDoc,
  updateUserNote,
} from "@/lib/local-first/user-notes";

/* ── Props ──────────────────────────────────────────────── */

interface SectionNoteEditorProps {
  /** Same docId that the overview panel uses — notes are shared. */
  docId: string;
  /** The section's own id; stored as `segmentId` on each row. */
  sectionId: string;
  chapterNo: number | null;
}

/* ════════════════════════════════════════════════════════
   SectionNoteEditor — inline "یادداشت مطالعاتی…" affordance.

   Rendered below each section in SegmentRenderer when a
   noteContext is supplied. Notes are scoped by:
     docId  → shared with the side-panel overview
     sectionId (= segmentId) → filters to just this section

   Writing through the same user-notes CRUD layer ensures
   zero storage duplication. The overview panel's
   listUserNotesForDoc(docId) query returns them all.
════════════════════════════════════════════════════════ */

export function SectionNoteEditor({
  docId,
  sectionId,
  chapterNo,
}: SectionNoteEditorProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<UserNoteRow[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const reload = useCallback(async () => {
    const all = await listUserNotesForDoc(docId);
    setNotes(all.filter((n) => n.segmentId === sectionId));
  }, [docId, sectionId]);

  // Load on mount so the badge count is accurate even when collapsed.
  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = useCallback(async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await createUserNote({
        docId,
        segmentId: sectionId,
        chapterNo,
        title: null,
        body: body.trim(),
      });
      setBody("");
      setComposerOpen(false);
      await reload();
    } finally {
      setSaving(false);
    }
  }, [docId, sectionId, chapterNo, body, reload]);

  const handleUpdate = useCallback(
    async (id: string) => {
      if (!editBody.trim()) return;
      await updateUserNote(id, { body: editBody.trim() });
      setEditingId(null);
      await reload();
    },
    [editBody, reload],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteUserNote(id);
      await reload();
    },
    [reload],
  );

  /* ── Collapsed trigger ─ */

  if (!open) {
    return (
      <div dir="rtl" className="mt-3 border-t border-lib-border/40 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-lib-sm border border-dashed border-lib-border/40 px-3 py-1.5",
            "text-sm text-lib-text-muted/60 transition-colors",
            "hover:border-lib-accent/40 hover:bg-lib-hover hover:text-lib-accent",
          )}
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span>یادداشت مطالعاتی…</span>
          {notes.length > 0 && (
            <span className="rounded-full bg-lib-accent/15 px-1.5 py-0 text-[10px] font-bold tabular-nums text-lib-accent">
              {notes.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  /* ── Expanded view ─ */

  return (
    <div dir="rtl" className="mt-3 flex flex-col gap-2 border-t border-lib-border/40 pt-3">
      {/* Mini-header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-semibold text-lib-text-secondary"
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          یادداشت‌های این بخش
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setComposerOpen(false);
            setEditingId(null);
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-lib-text-muted transition-colors hover:bg-lib-hover"
          aria-label="بستن"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Existing notes */}
      {notes.map((n) =>
        editingId === n.id ? (
          <div key={n.id} className="flex flex-col gap-1.5">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={3}
              className={cn(
                "w-full resize-none rounded-lib-sm border border-lib-border bg-transparent",
                "px-2 py-1.5 text-sm text-lib-text",
                "focus:outline-none focus:ring-1 focus:ring-lib-accent",
              )}
              style={{ fontFamily: "var(--lib-font-persian)" }}
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void handleUpdate(n.id)}
                disabled={!editBody.trim()}
                className={cn(
                  "rounded-lib-sm bg-lib-accent px-2.5 py-1 text-xs font-medium text-lib-accent-fg",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                style={{ fontFamily: "var(--lib-font-persian)" }}
              >
                ذخیره
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lib-sm px-2.5 py-1 text-xs text-lib-text-muted transition-colors hover:bg-lib-hover"
                style={{ fontFamily: "var(--lib-font-persian)" }}
              >
                لغو
              </button>
            </div>
          </div>
        ) : (
          <div
            key={n.id}
            className="rounded-lib-sm border border-lib-border bg-lib-surface/60 p-2 text-sm"
          >
            <p
              className="whitespace-pre-wrap text-lib-text-secondary"
              style={{ fontFamily: "var(--lib-font-persian)" }}
            >
              {n.body}
            </p>
            <div className="mt-1.5 flex justify-end gap-1">
              <button
                type="button"
                aria-label="ویرایش"
                onClick={() => {
                  setEditingId(n.id);
                  setEditBody(n.body);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-lib-text"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="حذف"
                onClick={() => void handleDelete(n.id)}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ),
      )}

      {/* Composer or add trigger */}
      {composerOpen ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="یادداشت شما…"
            rows={3}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className={cn(
              "w-full resize-none rounded-lib-sm border border-lib-border bg-transparent",
              "px-2 py-1.5 text-sm text-lib-text placeholder:text-lib-text-muted/50",
              "focus:outline-none focus:ring-1 focus:ring-lib-accent",
            )}
            style={{ fontFamily: "var(--lib-font-persian)" }}
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={saving || !body.trim()}
              onClick={() => void handleCreate()}
              className={cn(
                "rounded-lib-sm bg-lib-accent px-2.5 py-1 text-xs font-medium text-lib-accent-fg",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              style={{ fontFamily: "var(--lib-font-persian)" }}
            >
              {saving ? "…" : "ذخیره"}
            </button>
            <button
              type="button"
              onClick={() => {
                setComposerOpen(false);
                setBody("");
              }}
              className="rounded-lib-sm px-2.5 py-1 text-xs text-lib-text-muted transition-colors hover:bg-lib-hover"
              style={{ fontFamily: "var(--lib-font-persian)" }}
            >
              لغو
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-lib-sm border border-dashed border-lib-border/50 px-2.5 py-1.5",
            "text-xs text-lib-text-muted transition-colors",
            "hover:border-lib-accent/40 hover:bg-lib-accent-soft hover:text-lib-accent",
          )}
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          یادداشت جدید
        </button>
      )}
    </div>
  );
}
