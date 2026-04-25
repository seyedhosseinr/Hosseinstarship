/**
 * Seed a chapter record needed by the test batch import.
 * Usage: npx tsx --tsconfig tsconfig.json scripts/_seed-chapter.ts
 */
import { db } from "@/db/index";
import { chapters } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const chapterNo = 132;
  const id = "ch_132";
  const slug = "campbell-ch132-bph";

  const existing = await db.query.chapters.findFirst({
    where: eq(chapters.chapterNo, chapterNo),
  });

  if (existing) {
    console.log(`Chapter ${chapterNo} already exists (id=${existing.id}). Skipping.`);
    return;
  }

  await db.insert(chapters).values({
    id,
    volumeNo: 3,
    partNo: 12,
    partTitle: "Benign Prostatic Hyperplasia",
    sectionTitle: "Lower Urinary Tract Dysfunction",
    chapterNo,
    title: "Benign Prostatic Hyperplasia: Etiology, Pathophysiology, Epidemiology, and Natural History",
    slug,
    pageStart: 3100,
    pageEnd: 3140,
    sourceBook: "Campbell-Walsh-Wein",
    sourceEdition: "13",
    isActive: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  console.log(`✓ Seeded chapter ${chapterNo} (id=${id})`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
