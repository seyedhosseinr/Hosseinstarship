/**
 * GET /api/sync/pull?since=<number>&tables=<comma-separated>
 * ───────────────────────────────────────────────────────────────���─────────────
 * Returns rows whose logical_clock exceeds `since` for each requested table.
 *
 * Default tables (all syncable):
 *   questions, flashcards, flashcard_reviews, chapter_progress,
 *   exam_sessions, question_attempts, study_tasks
 *
 * Response shape:
 *   { tables: { [tableName]: rows[] }, maxClock: number }
 *
 * Each table query: SELECT * WHERE logical_clock > since
 *                   ORDER BY logical_clock ASC LIMIT 500
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { isPGliteRuntime } from "@/db/config";
import { createPostgresDb } from "@/db/postgres";

// ── Constants ─────────────────────────────���──────────────────────────────────

const PULL_LIMIT = 500;

const ALL_SYNCABLE_TABLES = [
  "questions",
  "flashcards",
  "flashcard_reviews",
  "chapter_progress",
  "exam_sessions",
  "question_attempts",
  "study_tasks",
] as const;

type SyncableTable = (typeof ALL_SYNCABLE_TABLES)[number];

const SYNCABLE_SET = new Set<string>(ALL_SYNCABLE_TABLES);

// ── Response type ──────────────────────────��─────────────────────────────────

export interface SyncPullResult {
  tables: Record<string, Record<string, unknown>[]>;
  maxClock: number;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // When running in PGlite mode there is no server-side Postgres to pull from.
  if (isPGliteRuntime()) {
    return NextResponse.json({ tables: {}, maxClock: 0 } satisfies SyncPullResult);
  }

  const { searchParams } = request.nextUrl;

  // Parse `since` — default 0
  const since = Math.max(0, Number(searchParams.get("since") ?? "0"));
  if (Number.isNaN(since)) {
    return NextResponse.json({ error: "Invalid `since` parameter" }, { status: 400 });
  }

  // Parse `tables` — default all
  let requestedTables: SyncableTable[];
  const tablesParam = searchParams.get("tables");
  if (tablesParam) {
    const names = tablesParam.split(",").map((s: string) => s.trim()).filter(Boolean);
    const invalid = names.filter((n: string) => !SYNCABLE_SET.has(n));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unknown tables: ${invalid.join(", ")}` },
        { status: 400 },
      );
    }
    requestedTables = names as SyncableTable[];
  } else {
    requestedTables = [...ALL_SYNCABLE_TABLES];
  }

  const db = createPostgresDb();
  if (!db) {
    return NextResponse.json(
      { ok: false, error: "Server sync not configured" },
      { status: 503 },
    );
  }

  const tables: Record<string, Record<string, unknown>[]> = {};
  let maxClock = since;

  for (const table of requestedTables) {
    const rows = await db.execute<Record<string, unknown>>(
      sql.raw(
        `SELECT * FROM "${table}" WHERE logical_clock > ${Number(since)} ORDER BY logical_clock ASC LIMIT ${PULL_LIMIT}`,
      ),
    );

    const rowArray = Array.isArray(rows) ? rows : (rows as { rows: Record<string, unknown>[] }).rows ?? [];

    tables[table] = rowArray;

    // Track the highest clock across all pulled rows
    for (const row of rowArray) {
      const clock = Number(row.logical_clock ?? 0);
      if (clock > maxClock) maxClock = clock;
    }
  }

  const result: SyncPullResult = { tables, maxClock };
  return NextResponse.json(result);
}
