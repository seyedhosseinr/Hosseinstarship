import ContentManager from "@/components/import/ContentManager";
import { safeGetContentStats, type ContentStats } from "@/lib/import-light/content-stats";
import { safeListRecentImports } from "@/lib/import-light/queries";

export const dynamic = "force-dynamic";

const EMPTY_STATS: ContentStats = {
  questions: { total: 0, lastImportedAt: null },
  flashcards: { total: 0, lastImportedAt: null },
  notes: { total: 0, lastImportedAt: null },
  yield: { total: 0, lastImportedAt: null },
};

export default async function ImportPage() {
  // Run both queries concurrently but isolate their failures so one bad query
  // doesn't hide the other. Both safe-wrappers catch internally and return a
  // typed error string rather than throwing, so the page always renders.
  const [statsResult, historyResult] = await Promise.all([
    safeGetContentStats(),
    safeListRecentImports(24, "ImportPage"),
  ]);

  if (!statsResult.ok) {
    // Surface the real error text — it survives Next.js dev-mode log forwarding
    // unlike a raw Error object which serialises as {} in the browser console.
    console.error("[import] Failed to load content stats:", statsResult.error);
  }
  if (historyResult.error) {
    console.error("[import] Failed to load import history:", historyResult.error);
  }

  const stats = statsResult.ok ? statsResult.stats : EMPTY_STATS;
  const history = historyResult.history;

  return <ContentManager stats={stats} history={history} />;
}
