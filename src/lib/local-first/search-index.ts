/**
 * Offline full-text search powered by FlexSearch.
 *
 * Builds an index from Dexie stores (annotations, planner tasks,
 * import manifests, dashboard snapshot). The index is rebuilt on boot
 * and updated incrementally on each entity write.
 *
 * The serialized index is persisted in the Dexie `meta` store so
 * cold starts can show results before a full rebuild completes.
 */

import FlexSearch from "flexsearch";
import { getLocalDb, getMeta, setMeta } from "./idb";

export type SearchResultItem = {
  id: string;
  type: "annotation" | "task" | "import";
  title: string;
  subtitle: string;
  href?: string;
};

type IndexEntry = { id: string; type: SearchResultItem["type"]; title: string; subtitle: string; href?: string };

let index: FlexSearch.Index | null = null;
const entryMap = new Map<string, IndexEntry>();

function getIndex(): FlexSearch.Index {
  if (!index) {
    index = new FlexSearch.Index({
      tokenize: "forward",
      resolution: 5,
    });
  }
  return index;
}

let numericId = 0;
const idToNumeric = new Map<string, number>();
const numericToId = new Map<number, string>();

function getNumericId(stringId: string): number {
  let n = idToNumeric.get(stringId);
  if (n === undefined) {
    n = numericId++;
    idToNumeric.set(stringId, n);
    numericToId.set(n, stringId);
  }
  return n;
}

function addToIndex(entry: IndexEntry) {
  const idx = getIndex();
  const nId = getNumericId(entry.id);
  entryMap.set(entry.id, entry);
  const text = `${entry.title} ${entry.subtitle}`;
  idx.add(nId, text);
}

export function removeFromIndex(id: string) {
  const idx = getIndex();
  const nId = idToNumeric.get(id);
  if (nId !== undefined) {
    idx.remove(nId);
    entryMap.delete(id);
    numericToId.delete(nId);
    idToNumeric.delete(id);
  }
}

/** Rebuild the full index from Dexie stores. */
export async function rebuildIndex(): Promise<void> {
  const db = getLocalDb();

  // Reset
  index = null;
  entryMap.clear();
  idToNumeric.clear();
  numericToId.clear();
  numericId = 0;

  // Annotations
  const annotations = await db.annotations.toArray();
  for (const ann of annotations) {
    addToIndex({
      id: `ann:${ann.id}`,
      type: "annotation",
      title: ann.textQuote.slice(0, 100),
      subtitle: ann.comment ?? "",
      href: ann.docId ? `/notes/${ann.docId}` : undefined,
    });
  }

  // Planner tasks
  const tasks = await db.plannerTasks.toArray();
  for (const t of tasks) {
    const p = (t.payload ?? {}) as Record<string, unknown>;
    addToIndex({
      id: `task:${t.id}`,
      type: "task",
      title: t.title,
      subtitle: (p.description as string) ?? "",
      href: "/planner",
    });
  }

  // Import manifests
  const manifests = await db.importManifests.toArray();
  for (const m of manifests) {
    addToIndex({
      id: `imp:${m.sha256}`,
      type: "import",
      title: m.originalName,
      subtitle: `${(m.sizeBytes / 1024).toFixed(1)} KB — ${m.status}`,
      href: "/import",
    });
  }

  // Persist entry map for fast cold start
  try {
    await setMeta("search-entries", Array.from(entryMap.values()));
  } catch { /* Dexie full or unavailable */ }
}

/** Load cached entries from meta for fast cold start. */
export async function loadCachedIndex(): Promise<void> {
  try {
    const entries = await getMeta<IndexEntry[]>("search-entries");
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        addToIndex(entry);
      }
    }
  } catch { /* no cached index */ }
}

/** Add or update a single entity in the index. */
export function indexEntity(entry: IndexEntry) {
  removeFromIndex(entry.id);
  addToIndex(entry);
}

/** Search the local index. */
export function searchLocal(query: string): SearchResultItem[] {
  if (!query.trim()) return [];
  const idx = getIndex();
  const results = idx.search(query, { limit: 20 });
  const items: SearchResultItem[] = [];
  for (const numId of results) {
    const stringId = numericToId.get(numId as number);
    if (stringId) {
      const entry = entryMap.get(stringId);
      if (entry) items.push(entry);
    }
  }
  return items;
}
