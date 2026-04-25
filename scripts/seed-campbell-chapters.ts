#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Seed the `chapters` table from data/campbell-board-2025.json.
 *
 * Idempotent — uses ON CONFLICT (chapter_no) DO UPDATE so re-running just
 * refreshes the row in place. Inserts ALL 165 TOC entries (included + excluded);
 * `is_active` mirrors `included` so the planner / library can filter as needed.
 *
 * Usage (Neon / Postgres):
 *   $env:DB_RUNTIME   = "postgres"
 *   $env:DATABASE_URL = "<your Neon connection string>"
 *   npx tsx --tsconfig tsconfig.json scripts/seed-campbell-chapters.ts
 *
 * Usage (local PGlite):
 *   $env:DB_RUNTIME = "pglite"
 *   npx tsx --tsconfig tsconfig.json scripts/seed-campbell-chapters.ts
 */

import * as nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";

import { getDb } from "@/db/index";
import { chapters } from "@/db/schema";

interface RawEntry {
  chapter: number;
  volume: number;
  part: string;
  title: string;
  start_page: number;
  end_page: number;
  included: boolean;
}

const TOC_PATH = resolve(process.cwd(), "data/campbell-board-2025.json");

function chapterId(chapterNo: number): string {
  return `ch-${chapterNo}`;
}

function chapterSlug(chapterNo: number): string {
  return `ch-${chapterNo}`;
}

async function main(): Promise<void> {
  console.log(`[seed-campbell-chapters] Reading ${TOC_PATH}`);
  const raw = readFileSync(TOC_PATH, "utf8");
  const entries = JSON.parse(raw) as RawEntry[];

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`No entries in ${TOC_PATH}`);
  }

  // Validate shape on first row to fail fast on schema drift
  const first = entries[0];
  if (
    typeof first.chapter !== "number" ||
    typeof first.volume !== "number" ||
    typeof first.part !== "string" ||
    typeof first.title !== "string"
  ) {
    throw new Error(
      `Unexpected row shape in ${TOC_PATH}. First row: ${JSON.stringify(first)}`,
    );
  }

  const db = await getDb();
  const now = Date.now();

  const rows = entries.map((e) => ({
    id: chapterId(e.chapter),
    volumeNo: e.volume,
    partNo: null as number | null,
    partTitle: e.part,
    sectionTitle: null as string | null,
    chapterNo: e.chapter,
    title: e.title,
    slug: chapterSlug(e.chapter),
    pageStart: typeof e.start_page === "number" ? e.start_page : null,
    pageEnd: typeof e.end_page === "number" ? e.end_page : null,
    sourceBook: "Campbell-Walsh-Wein",
    sourceEdition: "13",
    isActive: e.included ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  }));

  console.log(
    `[seed-campbell-chapters] Upserting ${rows.length} rows ` +
      `(${rows.filter((r) => r.isActive === 1).length} active / ${rows.filter((r) => r.isActive === 0).length} inactive)`,
  );

  // Drizzle ON CONFLICT — target the unique chapter_no constraint
  // and update everything except createdAt.
  await db
    .insert(chapters)
    .values(rows)
    .onConflictDoUpdate({
      target: chapters.chapterNo,
      set: {
        id: sql`excluded.id`,
        volumeNo: sql`excluded.volume_no`,
        partNo: sql`excluded.part_no`,
        partTitle: sql`excluded.part_title`,
        sectionTitle: sql`excluded.section_title`,
        title: sql`excluded.title`,
        slug: sql`excluded.slug`,
        pageStart: sql`excluded.page_start`,
        pageEnd: sql`excluded.page_end`,
        sourceBook: sql`excluded.source_book`,
        sourceEdition: sql`excluded.source_edition`,
        isActive: sql`excluded.is_active`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  // Verify
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(chapters);
  const [{ active }] = await db
    .select({ active: sql<number>`count(*)::int` })
    .from(chapters)
    .where(sql`${chapters.isActive} = 1`);

  console.log("[seed-campbell-chapters] ✓ Done");
  console.log(`[seed-campbell-chapters]   total chapters in DB:  ${total}`);
  console.log(`[seed-campbell-chapters]   active (included):     ${active}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-campbell-chapters] ✗ Failed:");
    console.error(err);
    process.exit(1);
  });
