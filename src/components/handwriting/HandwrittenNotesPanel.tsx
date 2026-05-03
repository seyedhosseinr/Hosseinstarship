"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Eraser, PenLine, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadHandwrittenNote,
  saveHandwrittenNote,
} from "@/lib/handwriting/handwriting-store";
import type { HandwritingStroke } from "@/lib/handwriting/types";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "./HandwritingCanvas";

interface HandwrittenNotesPanelProps {
  chapterId: string;
  segmentId: string;
  /** Current active block ID from useActiveBlockAnchor. */
  blockId: string | null;
  onClose(): void;
}

const PEN_COLOR = "#1a1a2e";
const PEN_WIDTH = 2;
const ERASER_WIDTH = 20;

type Tool = "pen" | "eraser";

/** Debounce strokes saves — we don't want to hit IndexedDB on every pointer event. */
function useDebouncedSave(
  chapterId: string,
  segmentId: string,
  blockId: string | null,
  strokes: HandwritingStroke[],
  delay = 600,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!blockId) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveHandwrittenNote(chapterId, segmentId, blockId, strokes).catch(
        (err) => console.error("[handwriting] save failed:", err),
      );
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [chapterId, segmentId, blockId, strokes, delay]);
}

export function HandwrittenNotesPanel({
  chapterId,
  segmentId,
  blockId,
  onClose,
}: HandwrittenNotesPanelProps) {
  const [tool, setTool] = useState<Tool>("pen");
  const [strokes, setStrokes] = useState<HandwritingStroke[]>([]);
  const [loadedBlockId, setLoadedBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HandwritingCanvasHandle>(null);

  // Load strokes whenever the active block changes.
  useEffect(() => {
    if (!blockId || blockId === loadedBlockId) return;
    setLoadedBlockId(blockId);

    loadHandwrittenNote(chapterId, segmentId, blockId)
      .then((note) => setStrokes(note?.strokes ?? []))
      .catch((err) => console.error("[handwriting] load failed:", err));
  }, [chapterId, segmentId, blockId, loadedBlockId]);

  useDebouncedSave(chapterId, segmentId, blockId, strokes);

  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
  }, []);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const effectiveTool = tool;
  const effectiveWidth = tool === "eraser" ? ERASER_WIDTH : PEN_WIDTH;

  return (
    <div
      dir="rtl"
      className={cn(
        // Wide / landscape: right side column
        "fixed inset-y-0 right-0 z-30 flex w-[340px] flex-col",
        "border-r border-lib-border bg-lib-surface shadow-2xl",
        // Narrow / portrait: bottom sheet at full width
        "max-md:inset-x-0 max-md:inset-y-auto max-md:bottom-0 max-md:right-0 max-md:h-[55dvh] max-md:w-full max-md:rounded-t-2xl max-md:border-t max-md:border-lib-border",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-lib-border px-4 py-3">
        <span
          className="text-sm font-semibold text-lib-text"
          style={{ fontFamily: "var(--lib-font-persian)" }}
        >
          حاشیه‌نویسی
        </span>
        <button
          type="button"
          onClick={onClose}
          title="بستن"
          aria-label="بستن"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-lib-text-muted transition-colors hover:bg-lib-hover hover:text-lib-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Anchor indicator */}
      {blockId && (
        <div className="border-b border-lib-border/40 px-4 py-1.5">
          <span className="truncate text-[10px] font-mono text-lib-text-muted/60">
            {blockId}
          </span>
        </div>
      )}

      {/* Canvas — fills remaining height */}
      <div className="relative flex-1 overflow-hidden bg-white dark:bg-neutral-950">
        {!blockId ? (
          <div className="flex h-full items-center justify-center text-sm text-lib-text-muted">
            در حال بارگذاری…
          </div>
        ) : (
          <HandwritingCanvas
            ref={canvasRef}
            strokes={strokes}
            onChange={setStrokes}
            tool={effectiveTool}
            color={PEN_COLOR}
            width={effectiveWidth}
            className="h-full w-full"
          />
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-t border-lib-border px-3 py-2">
        <div className="flex items-center gap-1">
          <ToolButton
            active={tool === "pen"}
            label="قلم"
            onClick={() => setTool("pen")}
          >
            <PenLine className="h-4 w-4" />
          </ToolButton>

          <ToolButton
            active={tool === "eraser"}
            label="پاک‌کن"
            onClick={() => setTool("eraser")}
          >
            <Eraser className="h-4 w-4" />
          </ToolButton>
        </div>

        <div className="flex items-center gap-1">
          <ToolButton label="برگشت" onClick={handleUndo}>
            <RotateCcw className="h-4 w-4" />
          </ToolButton>

          <ToolButton label="پاک کردن" onClick={handleClear}>
            <Trash2 className="h-4 w-4" />
          </ToolButton>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-lib-accent-soft text-lib-accent"
          : "text-lib-text-secondary hover:bg-lib-hover hover:text-lib-text",
      )}
    >
      {children}
    </button>
  );
}
