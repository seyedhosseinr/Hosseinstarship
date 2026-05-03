"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserNoteRow } from "@/lib/local-first/idb";
import { useReaderUserNotes } from "@/hooks/useReaderUserNotes";

/* ── Types ────────────────────────────────────────────────── */

interface ReaderUserNotesPanelProps {
  docId: string;
  segmentId: string;
  chapterNo: number | null;
  onClose(): void;
}

type PanelMode = "expanded" | "collapsed";
type EditorMode =
  | { kind: "none" }
  | { kind: "new" }
  | { kind: "edit"; note: UserNoteRow };

/* ── Relative-time helper ────────────────────────────────── */

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "همین الان";
  if (mins < 60) return `${mins} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  return `${days} روز پیش`;
}

/* ── Note composer sub-component ─────────────────────────── */

interface ComposerProps {
  initial?: { title: string; body: string };
  onSave(title: string, body: string): Promise<void>;
  onCancel(): void;
}

function NoteComposer({ initial, onSave, onCancel }: ComposerProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus body when opening.
  useEffect(() => {
    bodyRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!body.trim()) return;
      setSaving(true);
      try {
        await onSave(title.trim() || "", body.trim());
      } finally {
        setSaving(false);
      }
    },
    [title, body, onSave],
  );

  return (
    <form
      dir="rtl"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lib-lg border border-lib-border bg-lib-bg p-3"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="عنوان یادداشت"
        maxLength={120}
        className={cn(
          "w-full rounded-lib-sm border border-lib-border bg-transparent",
          "px-2 py-1.5 text-sm text-lib-text placeholder:text-lib-text-muted/60",
          "focus:outline-none focus:ring-1 focus:ring-lib-accent",
        )}
        style={{ fontFamily: "var(--lib-font-persian)" }}
      />
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="متن یادداشت…"
        rows={5}
        className={cn(
          "w-full resize-none rounded-lib-sm border border-lib-border bg-transparent",
          "px-2 py-1.5 text-sm text-lib-text placeholder:text-lib-text-muted/60",
          "focus:outline-none focus:ring-1 focus:ring-lib-accent",
        )}
        style={{ fontFamily: "var(--lib-font-persian)" }}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "rounded-lib-sm px-3 py-1.5 text-sm text-lib-text-muted",
            "transition-colors hover:bg-lib-hover hover:text-lib-text",
          )}
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          لغو
        </button>
        <button
          type="submit"
          disabled={saving || !body.trim()}
          className={cn(
            "rounded-lib-sm bg-lib-accent px-3 py-1.5 text-sm font-medium text-lib-accent-fg",
            "transition-colors hover:bg-lib-accent/90",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          {saving ? "…" : "ذخیره"}
        </button>
      </div>
    </form>
  );
}

/* ── Note list item sub-component ────────────────────────── */

interface NoteItemProps {
  note: UserNoteRow;
  onEdit(): void;
  onDelete(): void;
}

function NoteItem({ note, onEdit, onDelete }: NoteItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      dir="rtl"
      className="rounded-lib-md border border-lib-border bg-lib-surface p-3 text-sm"
    >
      {note.title && (
        <p
          className="mb-1 font-semibold text-lib-text"
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          {note.title}
        </p>
      )}
      <p
        className="line-clamp-3 whitespace-pre-wrap text-lib-text-secondary"
        style={{ fontFamily: "var(--lib-font-persian)" }}
      >
        {note.body}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-lib-text-muted/60">
          {relativeTime(note.updatedAt)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="ویرایش"
            aria-label="ویرایش یادداشت"
            onClick={onEdit}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-lib-text"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-0.5 text-[11px] text-lib-text-muted transition-colors hover:bg-lib-hover"
              >
                لغو
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20"
              >
                حذف
              </button>
            </>
          ) : (
            <button
              type="button"
              title="حذف"
              aria-label="حذف یادداشت"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main panel ───────────────────────────────────────────── */

export function ReaderUserNotesPanel({
  docId,
  segmentId,
  chapterNo,
  onClose,
}: ReaderUserNotesPanelProps) {
  const [mode, setMode] = useState<PanelMode>("expanded");
  const [editor, setEditor] = useState<EditorMode>({ kind: "none" });

  const { notes, loading, create, update, remove } = useReaderUserNotes(
    docId,
    segmentId,
    chapterNo,
  );

  const isExpanded = mode === "expanded";

  /* ── Callbacks ─ */

  const handleSaveNew = useCallback(
    async (title: string, body: string) => {
      await create(title || null, body);
      setEditor({ kind: "none" });
    },
    [create],
  );

  const handleSaveEdit = useCallback(
    async (note: UserNoteRow, title: string, body: string) => {
      await update(note.id, { title: title || null, body });
      setEditor({ kind: "none" });
    },
    [update],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id);
      setEditor((prev) =>
        prev.kind === "edit" && prev.note.id === id ? { kind: "none" } : prev,
      );
    },
    [remove],
  );

  /* ── Collapsed rail ─ */

  if (!isExpanded) {
    return (
      <div
        dir="rtl"
        className={cn(
          // Desktop: slim vertical rail on the right
          "fixed inset-y-0 right-0 z-30 flex w-12 flex-col items-center",
          "border-l border-lib-border bg-lib-surface shadow-lg",
          // Mobile: slim bottom tab
          "max-md:inset-x-0 max-md:inset-y-auto max-md:bottom-0 max-md:h-14 max-md:w-full",
          "max-md:flex-row max-md:justify-between max-md:border-l-0 max-md:border-t max-md:px-4",
        )}
      >
        {/* Rail: expand button */}
        <button
          type="button"
          title="باز کردن پنل یادداشت‌ها"
          aria-label="باز کردن پنل یادداشت‌ها"
          onClick={() => setMode("expanded")}
          className={cn(
            "mt-3 inline-flex flex-col items-center gap-1 rounded-full p-2",
            "text-lib-text-secondary transition-colors hover:bg-lib-hover hover:text-lib-text",
            "max-md:mt-0 max-md:flex-row max-md:gap-2",
          )}
        >
          <NotebookPen className="h-4 w-4" />
          {notes.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-lib-accent px-1 text-[9px] font-bold tabular-nums text-lib-accent-fg">
              {notes.length}
            </span>
          )}
        </button>

        {/* Rail: open-panel chevron */}
        <button
          type="button"
          title="باز کردن پنل یادداشت‌ها"
          aria-label="باز کردن پنل یادداشت‌ها"
          onClick={() => setMode("expanded")}
          className={cn(
            "mt-auto mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full",
            "text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-lib-text",
            "max-md:mt-0 max-md:mb-0",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* ── Expanded panel ─ */

  return (
    <div
      dir="rtl"
      className={cn(
        // Desktop: fixed right column
        "fixed inset-y-0 right-0 z-30 flex w-80 flex-col",
        "border-l border-lib-border bg-lib-surface shadow-2xl",
        // Mobile: bottom sheet
        "max-md:inset-x-0 max-md:inset-y-auto max-md:bottom-0 max-md:h-[65dvh] max-md:w-full",
        "max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t",
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-lib-border px-4 py-3">
        <span
          className="font-semibold text-lib-text"
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          یادداشت‌های من
        </span>
        <div className="flex items-center gap-1">
          {/* Collapse to rail */}
          <button
            type="button"
            title="جمع کردن پنل یادداشت‌ها"
            aria-label="جمع کردن پنل یادداشت‌ها"
            onClick={() => setMode("collapsed")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-lib-text"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* Close completely */}
          <button
            type="button"
            title="بستن یادداشت‌ها"
            aria-label="بستن یادداشت‌ها"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-lib-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">

        {/* New note composer or trigger */}
        {editor.kind === "new" ? (
          <NoteComposer
            onSave={handleSaveNew}
            onCancel={() => setEditor({ kind: "none" })}
          />
        ) : (
          <button
            type="button"
            aria-label="یادداشت جدید"
            onClick={() => setEditor({ kind: "new" })}
            className={cn(
              "flex w-full items-center gap-2 rounded-lib-md border border-dashed border-lib-border px-3 py-2.5",
              "text-sm text-lib-text-muted transition-colors hover:border-lib-accent/50 hover:bg-lib-accent-soft hover:text-lib-accent",
            )}
            style={{ fontFamily: "var(--lib-font-persian)" }}
          >
            <Plus className="h-4 w-4 shrink-0" />
            یادداشت جدید
          </button>
        )}

        {/* Empty state */}
        {!loading && notes.length === 0 && editor.kind === "none" && (
          <div
            dir="rtl"
            className="flex flex-col items-center gap-2 rounded-lib-lg bg-lib-hover/50 px-4 py-8 text-center"
          >
            <NotebookPen className="h-8 w-8 text-lib-text-muted/40" />
            <p
              className="text-sm font-medium text-lib-text-secondary"
              style={{ fontFamily: "var(--lib-font-persian)" }}
            >
              هنوز یادداشتی برای این بخش ننوشته‌اید.
            </p>
            <p
              className="text-xs text-lib-text-muted/70"
              style={{ fontFamily: "var(--lib-font-persian)" }}
            >
              اینجا می‌توانید یادداشت‌های شخصی خود را برای همین فصل یا بخش
              بنویسید.
            </p>
          </div>
        )}

        {/* Notes list */}
        {notes.map((note) =>
          editor.kind === "edit" && editor.note.id === note.id ? (
            <NoteComposer
              key={note.id}
              initial={{ title: note.title ?? "", body: note.body }}
              onSave={(t, b) => handleSaveEdit(note, t, b)}
              onCancel={() => setEditor({ kind: "none" })}
            />
          ) : (
            <NoteItem
              key={note.id}
              note={note}
              onEdit={() => setEditor({ kind: "edit", note })}
              onDelete={() => void handleDelete(note.id)}
            />
          ),
        )}
      </div>
    </div>
  );
}
