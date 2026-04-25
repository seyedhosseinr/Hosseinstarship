import { getDb } from "@/db/index";
import {
  noteDocuments,
  noteSections,
  noteFrames,
  contractQuestionNoteLinks,
  contractQuestions,
} from "@/db/schema";
import { eq, and, asc, desc, sql, type SQL } from "drizzle-orm";
import type {
  NoteViewerModel,
  NoteDocumentListItem,
  TocItem,
  FrameViewModel,
  SectionViewModel,
  NoteStats,
  LinkedQuestionPreview,
  InteractiveAlgorithmData,
  InteractiveAlgorithmStep,
  TableData,
} from "./note-viewer.types";
import type { FrameKind, LinkRelationType } from "./types";
import {
  emptyDisplayV8,
  emptyFlagsV8,
  type BlockDisplayV8,
  type BlockFlagsV8,
  type InteractiveDataV8,
} from "./note-v8.types";

// ─── Types ────────────────────────────────────────────────────────────────────

type FrameRow   = Awaited<ReturnType<typeof fetchFrames>>[number];
type SectionRow = Awaited<ReturnType<typeof fetchSections>>[number];
type LinkRow    = Awaited<ReturnType<typeof fetchLinks>>[number];

// ─── Private fetchers ─────────────────────────────────────────────────────────

async function fetchSections(db: Awaited<ReturnType<typeof getDb>>, docId: string) {
  return db.query.noteSections.findMany({
    where: eq(noteSections.docId, docId),
    orderBy: noteSections.orderIndex,
  });
}

async function fetchFrames(db: Awaited<ReturnType<typeof getDb>>, docId: string) {
  return db.query.noteFrames.findMany({
    where: eq(noteFrames.docId, docId),
    orderBy: noteFrames.orderIndex,
  });
}

async function fetchLinks(db: Awaited<ReturnType<typeof getDb>>, docId: string) {
  return db
    .select({
      frameId:      contractQuestionNoteLinks.frameId,
      questionId:   contractQuestionNoteLinks.questionId,
      relationType: contractQuestionNoteLinks.relationType,
      stem:         contractQuestions.stem,
    })
    .from(contractQuestionNoteLinks)
    .innerJoin(
      contractQuestions,
      eq(contractQuestions.questionId, contractQuestionNoteLinks.questionId)
    )
    .where(
      and(
        eq(contractQuestionNoteLinks.docId, docId),
        eq(contractQuestionNoteLinks.linkStatus, "active")
      )
    );
}

// ─── Private builders ─────────────────────────────────────────────────────────

function buildLinksByFrame(links: LinkRow[]): Map<string, LinkedQuestionPreview[]> {
  const map = new Map<string, LinkedQuestionPreview[]>();

  for (const link of links) {
    // Skip links with no resolved questionId (LEFT JOIN edge-case guard)
    if (link.questionId == null) continue;

    const preview: LinkedQuestionPreview = {
      questionId:   link.questionId,
      stem:         link.stem.length > 100 ? `${link.stem.slice(0, 100)}…` : link.stem,
      relationType: link.relationType as LinkRelationType,
    };

    const bucket = map.get(link.frameId) ?? [];
    bucket.push(preview);
    map.set(link.frameId, bucket);
  }

  return map;
}

function buildFramesBySection(frames: FrameRow[]): Map<string, FrameRow[]> {
  const map = new Map<string, FrameRow[]>();
  for (const frame of frames) {
    const bucket = map.get(frame.sectionId) ?? [];
    bucket.push(frame);
    map.set(frame.sectionId, bucket);
  }
  return map;
}

// ─── v8 → renderer shape helpers ─────────────────────────────────────────────
//
// The renderer (FrameCardV2 / FrameBody) was originally wired to v7.2 optional
// fields on FrameViewModel: listItems, tableData (TableDataCell rows), mermaid,
// interactiveData (array-of-steps shape), clinicalPearl, highYield.
// v8 stores display in a slightly different shape. These helpers convert v8 →
// the shape the renderer expects, without altering the renderer itself.

function parseDisplayJson(raw: string | null | undefined): BlockDisplayV8 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BlockDisplayV8>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...emptyDisplayV8(),
      ...parsed,
    };
  } catch {
    return null;
  }
}

function parseFlagsJson(raw: string | null | undefined): BlockFlagsV8 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BlockFlagsV8>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...emptyFlagsV8(),
      ...parsed,
    };
  } catch {
    return null;
  }
}

/** v8 TableData (string[][] rows) → renderer TableData (TableDataCell[][]). */
function v8TableToRendererTable(t: BlockDisplayV8["tableData"]): TableData | undefined {
  if (!t) return undefined;
  return {
    headers: t.headers,
    rows: t.rows.map((row) => row.map((cell) => ({ text: cell }))),
  };
}

/** v8 InteractiveData (Record<stepId, {prompt, options[], finalMessage?}>) → v7.2 array shape.
 *
 * Terminal mapping (v8.2.1):
 *   - If the step has `finalMessage` set, that is the authoritative result text.
 *   - Otherwise, fall back to the first terminal option's `outcome` (legacy
 *     synthesized shape still works for any pre-existing v8 payloads).
 *   - A step with zero live options is a "result"; otherwise "question".
 */
function v8InteractiveToRendererInteractive(
  d: InteractiveDataV8 | null | undefined,
): InteractiveAlgorithmData | undefined {
  if (!d) return undefined;
  const steps: InteractiveAlgorithmStep[] = Object.entries(d.steps).map(([stepId, step]) => {
    const hasLiveOption = step.options.some((o) => o.nextStepId !== null);
    const terminalOutcome =
      step.finalMessage ??
      step.options.find((o) => o.nextStepId === null && o.outcome)?.outcome ??
      undefined;
    return {
      stepId,
      type: hasLiveOption ? "question" : "result",
      text: step.prompt,
      // Carry outcome text on terminal steps so FrameAlgorithm renders it.
      finalMessage: terminalOutcome ?? undefined,
      options: hasLiveOption
        ? step.options
            .filter((o) => o.nextStepId !== null)
            .map((o) => ({
              label: o.label,
              nextStepId: o.nextStepId as string,
              explanation: o.outcome ?? undefined,
            }))
        : undefined,
    };
  });
  return {
    initialStepId: d.initialStepId,
    steps,
  };
}

function buildFrameViewModel(
  frame: FrameRow,
  linksByFrame: Map<string, LinkedQuestionPreview[]>
): FrameViewModel {
  // Cast: drizzle infers any newly-added columns into FrameRow automatically,
  // but TS may need a narrow cast if the runner hasn't re-inferred yet.
  const row = frame as FrameRow & {
    schemaVersion?: string | null;
    contentHash?: string | null;
    displayJson?: string | null;
    flagsJson?: string | null;
  };

  const display = parseDisplayJson(row.displayJson);
  const flags = parseFlagsJson(row.flagsJson);

  // Build the v7.2-shaped optional fields that FrameCardV2 already renders.
  // Any field that is absent from display just stays undefined — renderer skips it.
  const listItems = display?.listItems ?? undefined;
  const tableData = v8TableToRendererTable(display?.tableData ?? null);
  const mermaid = display?.mermaid ?? undefined;
  const interactiveData = v8InteractiveToRendererInteractive(display?.interactiveData ?? null);
  // v8.1 Patch 1 — callouts:
  // All callouts now render via FrameCallouts from frame.v8Display.callouts.
  // The legacy `clinicalPearl` field is no longer populated here, so we don't
  // double-render the first clinical_pearl. Legacy rows never had a structured
  // clinicalPearl column anyway (v7.5 flattened it into body), so dropping this
  // populator has no effect on back-compat.
  const clinicalPearl: string | undefined = undefined;
  const highYield = flags?.highYield ?? undefined;

  const hasStructuralReformat = Boolean(
    (display?.listItems && display.listItems.length > 0) ||
      display?.tableData ||
      display?.interactiveData,
  );

  // content = canonical prose. For v8 rows body IS the canonical content.
  // For legacy/v7.5 rows body holds the linearized text (still the best prose
  // surface we have); renderer prefers frame.content ?? frame.body.
  const content = row.schemaVersion === "8.0" ? row.body : undefined;

  const schemaVersion =
    row.schemaVersion === "7.5" || row.schemaVersion === "8.0"
      ? (row.schemaVersion as "7.5" | "8.0")
      : undefined;

  return {
    id:              row.frameId,
    kind:            row.kind as FrameKind,
    title:           row.title,
    summary:         row.summary,
    body:            row.body,
    marginNote:      row.marginNote,
    linkedQuestions: linksByFrame.get(row.frameId) ?? [],
    // v7.2-shaped renderer fields (populated from v8 payload when present):
    content,
    listItems,
    tableData,
    mermaid,
    interactiveData,
    clinicalPearl,
    highYield,
    // v8.1 raw payload:
    schemaVersion,
    contentHash: row.contentHash ?? undefined,
    v8Display: display ?? undefined,
    v8Flags: flags ?? undefined,
    hasStructuralReformat,
  };
}

function buildSections(
  sectionsData:    SectionRow[],
  framesBySection: Map<string, FrameRow[]>,
  linksByFrame:    Map<string, LinkedQuestionPreview[]>
): SectionViewModel[] {
  return sectionsData.map((section) => {
    const frames = framesBySection.get(section.sectionId) ?? [];
    return {
      id:              section.sectionId,
      title:           section.title,
      hook:            section.hook,
      closingKeypoint: section.closingKeypoint,
      frames:          frames.map((f) => buildFrameViewModel(f, linksByFrame)),
    };
  });
}

function buildToc(
  sectionsData:    SectionRow[],
  framesBySection: Map<string, FrameRow[]>
): TocItem[] {
  return sectionsData.map((section) => {
    const frames = framesBySection.get(section.sectionId) ?? [];
    return {
      sectionId:  section.sectionId,
      title:      section.title,
      frameCount: frames.length,
      frames:     frames.map((f) => ({
        frameId: f.frameId,
        title:   f.title,
        kind:    f.kind as FrameKind,
      })),
    };
  });
}

const INITIAL_FRAMES_BY_KIND: Record<FrameKind, number> = {
  core: 0, pearl: 0, warning: 0, pitfall: 0, keypoint: 0,
  concept: 0, trap: 0, threshold: 0, indication: 0, differential: 0,
  algorithm: 0, clinical_decision: 0, complication: 0, follow_up: 0,
  high_yield: 0, interactive_algorithm: 0,
};

function buildStats(frames: FrameRow[], links: LinkRow[]): NoteStats {
  const framesByKind = { ...INITIAL_FRAMES_BY_KIND };

  for (const frame of frames) {
    const kind = frame.kind as FrameKind;
    if (kind in framesByKind) framesByKind[kind]++;
  }

  return {
    totalFrames:    frames.length,
    totalQuestions: new Set(links.map((l) => l.questionId).filter(Boolean)).size,
    framesByKind,
  };
}

// ─── Public queries ───────────────────────────────────────────────────────────

export interface NoteFrameQueryHit {
  docId: string;
  frameId: string;
  sectionId: string;
  kind: FrameKind;
  title: string;
  body: string;
  schemaVersion?: "7.5" | "8.0";
  contentHash?: string;
}

async function listFramesByWhere(whereClause: SQL): Promise<NoteFrameQueryHit[]> {
  const db = await getDb();
  const rows = await db
    .select({
      docId: noteFrames.docId,
      frameId: noteFrames.frameId,
      sectionId: noteFrames.sectionId,
      kind: noteFrames.kind,
      title: noteFrames.title,
      body: noteFrames.body,
      schemaVersion: noteFrames.schemaVersion,
      contentHash: noteFrames.contentHash,
    })
    .from(noteFrames)
    .where(whereClause)
    .orderBy(asc(noteFrames.docId), asc(noteFrames.orderIndex));

  return rows.map((row) => ({
    ...row,
    kind: row.kind as FrameKind,
    schemaVersion:
      row.schemaVersion === "7.5" || row.schemaVersion === "8.0"
        ? (row.schemaVersion as "7.5" | "8.0")
        : undefined,
    contentHash: row.contentHash ?? undefined,
  }));
}

export async function listInteractiveAlgorithmFrames(): Promise<NoteFrameQueryHit[]> {
  return listFramesByWhere(eq(noteFrames.kind, "interactive_algorithm"));
}

export async function listMermaidFrames(): Promise<NoteFrameQueryHit[]> {
  return listFramesByWhere(eq(noteFrames.hasMermaid, 1));
}

export async function listDifferentialFrames(): Promise<NoteFrameQueryHit[]> {
  return listFramesByWhere(eq(noteFrames.kind, "differential"));
}

export async function listHighYieldFrames(): Promise<NoteFrameQueryHit[]> {
  return listFramesByWhere(eq(noteFrames.highYield, 1));
}

export async function listDecisionChangingFrames(): Promise<NoteFrameQueryHit[]> {
  return listFramesByWhere(eq(noteFrames.decisionChanging, 1));
}

export async function getNoteByDocId(docId: string): Promise<NoteViewerModel | null> {
  const db = await getDb();

  const doc = await db.query.noteDocuments.findFirst({
    where: eq(noteDocuments.docId, docId),
  });
  if (!doc) return null;

  const [sectionsData, framesData, linksData] = await Promise.all([
    fetchSections(db, docId),
    fetchFrames(db, docId),
    fetchLinks(db, docId),
  ]);

  const linksByFrame    = buildLinksByFrame(linksData);
  const framesBySection = buildFramesBySection(framesData);

  return {
    meta: {
      docId:          doc.docId,
      logicalChunkId: doc.logicalChunkId,
      chapterNo:      doc.chapterNo,
      chapterTitle:   doc.chapterTitle,
      chunkIndex:     doc.chunkIndex,
      pageRange:      doc.pageRange,
      version:        doc.version,
      generatedAt:    new Date(doc.generatedAt).toISOString(),
    },
    toc:      buildToc(sectionsData, framesBySection),
    sections: buildSections(sectionsData, framesBySection, linksByFrame),
    stats:    buildStats(framesData, linksData),
  };
}

export async function getLatestDocIdForChunk(logicalChunkId: string): Promise<string | null> {
  const db  = await getDb();
  const doc = await db.query.noteDocuments.findFirst({
    where: and(
      eq(noteDocuments.logicalChunkId, logicalChunkId),
      eq(noteDocuments.ingestStatus, "active")
    ),
    orderBy: desc(noteDocuments.version),
    columns: { docId: true },
  });

  return doc?.docId ?? null;
}

export async function listNoteDocuments(): Promise<NoteDocumentListItem[]> {
  const db = await getDb();

  const docs = await db.query.noteDocuments.findMany({
    orderBy: [
      desc(noteDocuments.generatedAt),
      desc(noteDocuments.chapterNo),
      desc(noteDocuments.chunkIndex),
    ],
  });
  if (docs.length === 0) return [];

  const frameRows = await db
    .select({
      docId: noteFrames.docId,
      count: sql<number>`COUNT(${noteFrames.id})`,
    })
    .from(noteFrames)
    .groupBy(noteFrames.docId);

  const frameCountByDocId = new Map(frameRows.map((r) => [r.docId, r.count]));

  return docs.map((doc) => ({
    docId:       doc.docId,
    chapterNo:   doc.chapterNo,
    chapterTitle: doc.chapterTitle,
    chunkIndex:  doc.chunkIndex,
    generatedAt: new Date(doc.generatedAt).toISOString(),
    pageRange:   doc.pageRange,
    frameCount:  frameCountByDocId.get(doc.docId) ?? 0,
  }));
}

export async function listNoteDocumentsForChapterNo(chapterNo: number) {
  const db = await getDb();

  const docs = await db.query.noteDocuments.findMany({
    where: and(
      eq(noteDocuments.chapterNo, chapterNo),
      eq(noteDocuments.ingestStatus, "active")
    ),
    orderBy: [desc(noteDocuments.version), desc(noteDocuments.generatedAt)],
    limit: 4,
  });

  return docs.map((doc) => ({
    docId:        doc.docId,
    chapterNo:    doc.chapterNo,
    chapterTitle: doc.chapterTitle,
    chunkIndex:   doc.chunkIndex,
  }));
}
