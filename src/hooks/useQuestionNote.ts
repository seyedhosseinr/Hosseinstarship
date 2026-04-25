"use client";

import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   Types — mirrors the API response shape
═══════════════════════════════════════════════════════════════ */

export interface QNFrame {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  body: string;
  marginNote: string | null;
  linkedQuestions: { questionId: string; stem: string }[];
  content?: string;
  listItems?: string[];
  tableData?: { headers: string[]; rows: ({ text: string; bold?: boolean } | string)[][] } | null;
  mermaid?: string;
  highYield?: boolean;
  clinicalPearl?: string;
}

export interface QNSection {
  id: string;
  title: string;
  hook: string | null;
  closingKeypoint: string | null;
  frames: QNFrame[];
}

export interface QuestionNoteData {
  meta: {
    docId: string;
    logicalChunkId: string;
    chapterNo: number;
    chapterTitle: string;
    chunkIndex: number;
    pageRange: string | null;
    version: number;
    generatedAt: string;
  };
  sections: QNSection[];
  stats: {
    totalFrames: number;
    totalQuestions: number;
  };
}

export interface QNAnchors {
  primary: string | null;
  supporting: string[];
}

export interface UseQuestionNoteResult {
  note: QuestionNoteData | null;
  anchors: QNAnchors | null;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_ANCHORS: QNAnchors = { primary: null, supporting: [] };

function parseAnchors(raw: unknown): QNAnchors {
  if (!raw || typeof raw !== "object") return EMPTY_ANCHORS;
  const r = raw as Record<string, unknown>;
  const primary = typeof r.primary === "string" ? r.primary : null;
  const supporting = Array.isArray(r.supporting)
    ? r.supporting.filter((v): v is string => typeof v === "string")
    : [];
  return { primary, supporting };
}

/* ═══════════════════════════════════════════════════════════════
   In-memory cache (per session, cleared on page refresh)
═══════════════════════════════════════════════════════════════ */
type CachedResponse = { note: QuestionNoteData | null; anchors: QNAnchors };
const cache = new Map<string, CachedResponse>();

/* ═══════════════════════════════════════════════════════════════
   Hook
═══════════════════════════════════════════════════════════════ */
export function useQuestionNote(questionId: string | null): UseQuestionNoteResult {
  const [note, setNote] = useState<QuestionNoteData | null>(null);
  const [anchors, setAnchors] = useState<QNAnchors | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!questionId) {
      setNote(null);
      setAnchors(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Serve from cache
    const cached = cache.get(questionId);
    if (cached) {
      setNote(cached.note);
      setAnchors(cached.anchors);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Abort any in-flight request for the previous question
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetch(
      `/api/exams/question-note?questionId=${encodeURIComponent(questionId)}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const noteData: QuestionNoteData | null = data.note ?? null;
        const anchorData = parseAnchors(data.anchors);
        cache.set(questionId, { note: noteData, anchors: anchorData });
        setNote(noteData);
        setAnchors(anchorData);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return; // expected on navigation
        console.error("[useQuestionNote]", err);
        setError("خطا در بارگذاری جزوه");
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [questionId]);

  return { note, anchors, isLoading, error };
}
