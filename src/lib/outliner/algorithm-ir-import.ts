import { unzipSync, strFromU8 } from "fflate";
import { validateOutlinerAlgorithmIR } from "./algorithm-ir-validate";
import { importOutlinerAlgorithmIRLocal } from "@/lib/local-first/outliner-local";

export interface OutlinerImportResultRow { segmentId: string; title: string | null; status: string; surfaces: number; coverage: number; warnings: string[]; errors: string[]; sourceFileName: string }
export interface OutlinerImportResult { totalFilesScanned: number; validJsonFound: number; imported: number; skipped: number; duplicates: string[]; rows: OutlinerImportResultRow[]; warnings: string[] }

function title(raw: unknown): string | null {
  const obj = raw as Record<string, unknown>;
  const meta = obj.algorithmMeta as Record<string, unknown> | undefined;
  return typeof meta?.title === "string" ? meta.title : null;
}

async function importOne(raw: unknown, sourceFileName: string, validationRaw?: unknown, mdxMirror?: string | null): Promise<OutlinerImportResultRow> {
  const validation = validateOutlinerAlgorithmIR(raw);
  const obj = raw as Record<string, unknown>;
  const segmentId = typeof obj.segmentId === "string" ? obj.segmentId : sourceFileName;
  if (!validation.ok) return { segmentId, title: title(raw), status: "ERROR", surfaces: 0, coverage: 0, warnings: validation.warnings, errors: validation.errors, sourceFileName };
  const reportStatus = validationRaw && typeof (validationRaw as Record<string, unknown>).status === "string" ? String((validationRaw as Record<string, unknown>).status) : "LOCAL_MINIMAL_PASS";
  if (reportStatus.toUpperCase() === "FAIL") return { segmentId, title: title(raw), status: "FAIL", surfaces: 0, coverage: 0, warnings: validation.warnings, errors: ["Validation report status is FAIL."], sourceFileName };
  const row = await importOutlinerAlgorithmIRLocal({ raw, sourceFileName, validationRaw, mdxMirror, validationStatus: reportStatus });
  return { segmentId: row.segmentId, title: row.title, status: row.validationStatus, surfaces: row.surfaceCount, coverage: row.coverageBlockCount, warnings: validation.warnings, errors: [], sourceFileName };
}

export async function importOutlinerFiles(files: File[]): Promise<OutlinerImportResult> {
  const rows: OutlinerImportResultRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const duplicates: string[] = [];
  let scanned = 0;
  let validJsonFound = 0;
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const names = Object.keys(entries);
      scanned += names.length;
      const jsons = new Map<string, unknown>();
      const reports = new Map<string, unknown>();
      const mdx = new Map<string, string>();
      for (const name of names) {
        const lower = name.toLowerCase();
        if (lower.match(/\.(png|jpg|jpeg|webp|gif|svg|mp4|webm)$/)) warnings.push("media file وارد نشده است؛ لینک‌های media فعلاً فقط به‌صورت reference ذخیره شدند.");
        if (lower.endsWith(".json")) {
          try {
            const raw = JSON.parse(strFromU8(entries[name]));
            const segmentId = typeof raw?.segmentId === "string" ? raw.segmentId : name;
            if (raw?.schemaVersion === "starship-algorithm-ir-v4") { jsons.set(segmentId, raw); validJsonFound++; }
            else if (name.includes("algorithm_ir_validation_")) reports.set(name.replace(/^.*algorithm_ir_validation_/, "").replace(/\.json$/i, ""), raw);
          } catch { warnings.push(`فایل JSON خوانده نشد: ${name}`); }
        } else if (lower.endsWith(".structured.mdx")) {
          const key = name.replace(/^.*algorithm_ir_/, "").replace(/\.structured\.mdx$/i, "");
          mdx.set(key, strFromU8(entries[name]));
        }
      }
      for (const [segmentId, raw] of jsons) {
        if (seen.has(segmentId)) duplicates.push(segmentId);
        seen.add(segmentId);
        rows.push(await importOne(raw, file.name, reports.get(segmentId), mdx.get(segmentId)));
      }
    } else if (file.name.toLowerCase().endsWith(".json")) {
      scanned += 1;
      try {
        const raw = JSON.parse(await file.text());
        if (raw?.schemaVersion === "starship-algorithm-ir-v4") validJsonFound++;
        const segmentId = typeof raw?.segmentId === "string" ? raw.segmentId : file.name;
        if (seen.has(segmentId)) duplicates.push(segmentId);
        seen.add(segmentId);
        rows.push(await importOne(raw, file.name));
      } catch (error) {
        rows.push({ segmentId: file.name, title: null, status: "ERROR", surfaces: 0, coverage: 0, warnings: [], errors: [error instanceof Error ? error.message : "JSON خوانده نشد."], sourceFileName: file.name });
      }
    } else {
      scanned += 1;
      warnings.push(`فایل پشتیبانی نمی‌شود و نادیده گرفته شد: ${file.name}`);
    }
  }
  const imported = rows.filter((row) => row.errors.length === 0).length;
  return { totalFilesScanned: scanned, validJsonFound, imported, skipped: rows.length - imported, duplicates, rows, warnings };
}
