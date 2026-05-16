import { getLocalDb, type OutlinerAlgorithmSegmentRow } from "./idb";
import { normalizeAlgorithmIR, type AlgorithmIR } from "@/types/algorithm-ir";
import { ALGORITHM_IR_V4_SCHEMA, validateAlgorithmIRV4 } from "@/types/algorithm-ir-v4";

export type LoadedOutlinerAlgorithmSegment = {
  segment: OutlinerAlgorithmSegmentRow;
  ir: AlgorithmIR;
  parseWarnings?: string[];
  validationRaw?: unknown;
  mediaRaw?: unknown;
  mdxMirror?: string | null;
};

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function titleFromIR(ir: AlgorithmIR): string | null {
  return ir.algorithmMeta?.title ?? ir.surfaces?.[0]?.title ?? null;
}

function chapterFromSegment(segmentId: string, ir: AlgorithmIR): number | null {
  const meta = ir.algorithmMeta as Record<string, unknown> | undefined;
  const raw = meta?.chapterNo ?? meta?.chapterId ?? segmentId.match(/(\d{2,3})/)?.[1];
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) ? value : null;
}

function coverageCount(ir: AlgorithmIR): number {
  return Array.isArray(ir.coverageMap) ? ir.coverageMap.length : 0;
}

export async function importOutlinerAlgorithmIRLocal(params: {
  raw: unknown;
  sourceFileName?: string | null;
  validationRaw?: unknown;
  mdxMirror?: string | null;
  validationStatus?: string;
}): Promise<OutlinerAlgorithmSegmentRow> {
  const minimal = validateAlgorithmIRV4(params.raw);
  if (!minimal.valid) throw new Error(minimal.errors.join("\n"));
  const ir = normalizeAlgorithmIR(params.raw as AlgorithmIR);
  const rawJson = JSON.stringify(ir);
  const jsonHash = await sha256(rawJson);
  const now = new Date().toISOString();
  const segmentId = ir.segmentId;
  const row: OutlinerAlgorithmSegmentRow = {
    segmentId,
    schemaVersion: ir.schemaVersion ?? ALGORITHM_IR_V4_SCHEMA,
    title: titleFromIR(ir),
    sourceNoteSegmentId: typeof (ir.sourceNote as Record<string, unknown> | undefined)?.segmentId === "string" ? String((ir.sourceNote as Record<string, unknown>).segmentId) : null,
    sourceNoteSchemaVersion: typeof (ir.sourceNote as Record<string, unknown> | undefined)?.schemaVersion === "string" ? String((ir.sourceNote as Record<string, unknown>).schemaVersion) : null,
    sourceFileName: params.sourceFileName ?? null,
    jsonHash,
    surfaceCount: ir.surfaces.length,
    coverageBlockCount: coverageCount(ir),
    totalBlockCount: coverageCount(ir),
    validationStatus: params.validationStatus ?? "LOCAL_MINIMAL_PASS",
    chapterNo: chapterFromSegment(segmentId, ir),
    importedAt: now,
    updatedAt: now,
  };
  const db = getLocalDb();
  await db.transaction("rw", [db.outlinerAlgorithmSegments, db.outlinerAlgorithmIR, db.outlinerSurfaceIndex, db.outlinerValidationReports, db.outlinerMdxMirrors], async () => {
    await db.outlinerAlgorithmSegments.put(row);
    await db.outlinerAlgorithmIR.put({ segmentId, rawJson: ir, jsonHash, importedAt: now });
    await db.outlinerSurfaceIndex.where("segmentId").equals(segmentId).delete();
    await db.outlinerSurfaceIndex.bulkPut(ir.surfaces.map((surface) => ({
      id: `${segmentId}:${surface.id}`,
      segmentId,
      surfaceId: surface.id,
      surfaceType: surface.surfaceType ?? null,
      algorithmShape: surface.algorithmShape ?? null,
      semanticRole: surface.semanticRole ?? null,
      title: surface.title ?? null,
      linkedBlockIds: surface.linkedBlockIds ?? [],
    })));
    if (params.validationRaw) {
      const status = typeof (params.validationRaw as Record<string, unknown>)?.status === "string" ? String((params.validationRaw as Record<string, unknown>).status) : row.validationStatus;
      const warnings = Array.isArray((params.validationRaw as Record<string, unknown>)?.warnings) ? ((params.validationRaw as Record<string, unknown>).warnings as unknown[]).filter((item): item is string => typeof item === "string") : [];
      await db.outlinerValidationReports.put({ segmentId, status, rawReportJson: params.validationRaw, warnings, importedAt: now });
    }
    if (params.mdxMirror) await db.outlinerMdxMirrors.put({ segmentId, rawMdx: params.mdxMirror, importedAt: now });
  });
  return row;
}

export async function listOutlinerSegmentsLocal(): Promise<OutlinerAlgorithmSegmentRow[]> {
  const rows = await getLocalDb().outlinerAlgorithmSegments.orderBy("updatedAt").reverse().toArray();
  return rows;
}

export async function loadOutlinerAlgorithmIR(segmentId: string): Promise<LoadedOutlinerAlgorithmSegment | null> {
  const db = getLocalDb();
  const [segment, payload, report, mdx] = await Promise.all([
    db.outlinerAlgorithmSegments.get(segmentId),
    db.outlinerAlgorithmIR.get(segmentId),
    db.outlinerValidationReports.get(segmentId),
    db.outlinerMdxMirrors.get(segmentId),
  ]);
  if (!segment) {
    console.warn("[outliner-local] segment row not found for segmentId:", segmentId);
    return null;
  }
  if (!payload) {
    console.warn(
      "[outliner-local] IR payload missing for segmentId:", segmentId,
      "— segment row exists but outlinerAlgorithmIR is empty.",
      "Re-import from /import/outliner to fix.",
    );
    return null;
  }
  return { segment, ir: normalizeAlgorithmIR(payload.rawJson as AlgorithmIR), validationRaw: report?.rawReportJson, mdxMirror: mdx?.rawMdx ?? null };
}

export async function deleteOutlinerSegmentsLocal(segmentIds: string[]): Promise<void> {
  const db = getLocalDb();
  await db.transaction("rw", [db.outlinerAlgorithmSegments, db.outlinerAlgorithmIR, db.outlinerSurfaceIndex, db.outlinerValidationReports, db.outlinerMdxMirrors], async () => {
    await db.outlinerAlgorithmSegments.bulkDelete(segmentIds);
    await db.outlinerAlgorithmIR.bulkDelete(segmentIds);
    await db.outlinerValidationReports.bulkDelete(segmentIds);
    await db.outlinerMdxMirrors.bulkDelete(segmentIds);
    for (const segmentId of segmentIds) await db.outlinerSurfaceIndex.where("segmentId").equals(segmentId).delete();
  });
}

export async function getOutlinerUserState(segmentId: string): Promise<{ lastSurfaceId?: string | null } | null> {
  const raw = localStorage.getItem(`outliner:user:${segmentId}`);
  return raw ? JSON.parse(raw) as { lastSurfaceId?: string | null } : null;
}

export async function patchOutlinerUserState(segmentId: string, patch: { lastSurfaceId?: string | null }): Promise<void> {
  const prev = await getOutlinerUserState(segmentId) ?? {};
  localStorage.setItem(`outliner:user:${segmentId}`, JSON.stringify({ ...prev, ...patch }));
}
