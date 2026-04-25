"use client";

/**
 * Surfaces annotations whose text anchor has been lost (status = orphaned).
 *
 * This is a debug/recovery UI — shown in the debug panel, and optionally
 * inline when the user opens a chapter that has orphaned annotations.
 *
 * Offers two actions per entry:
 *   - "حذف" (delete) — discard the lost annotation.
 *   - "بازخوانی" (open source) — deep-link to the owning chapter so the
 *     user can re-create the annotation from the actual text.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AnnotationRow } from "@/lib/local-first/idb";
import {
  deleteAnnotation,
  listOrphanedAnnotations,
} from "@/lib/local-first/annotations";

export function NeedsReviewList() {
  const [rows, setRows] = useState<AnnotationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listOrphanedAnnotations();
      setRows(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-3 text-[12px] text-muted-foreground" dir="rtl">
        در حال بارگذاری…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-3 text-[12px] text-muted-foreground" dir="rtl">
        هیچ یادداشت نیازمند بازبینی وجود ندارد.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border" dir="rtl">
      {rows.map((row) => {
        const chapterHref =
          row.chapterNo != null
            ? `/library/campbell/chapter/${row.chapterNo}`
            : "/library";
        return (
          <li key={row.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <div className="truncate text-[13px] font-medium text-foreground">
                {row.textQuote || <em className="text-muted-foreground">بدون متن</em>}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {row.docId}
                {row.chapterNo != null ? ` · فصل ${row.chapterNo}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={chapterHref}
                className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"
              >
                بازخوانی
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await deleteAnnotation(row.id);
                  await reload();
                }}
                className="rounded-md border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
              >
                حذف
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
