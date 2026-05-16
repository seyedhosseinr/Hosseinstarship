import { ALGORITHM_IR_V4_SCHEMA, validateAlgorithmIRV4 } from "@/types/algorithm-ir-v4";

const FORBIDDEN_COVERAGE = new Set(["not_algorithmic_but_preserved", "omitted_with_reason", "omitted", "preserved_as_prose", "not_applicable"]);
const FORBIDDEN_KEYS = ["WebGPU", "Canvas", "OPFS", "CRDT", "Pencil", "stylus", "annotation", "latency", "performance", "storage", "sync", "renderPlan", "renderHint", "styleHint", "layoutIntent", "renderPriority", "coordinates", "zoom", "pan", "viewport"];

function walk(value: unknown, path: string, visit: (key: string, value: unknown, path: string) => void): void {
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`, visit));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${key}` : key;
      visit(key, child, next);
      walk(child, next, visit);
    }
  }
}

export function validateOutlinerAlgorithmIR(raw: unknown): { ok: boolean; errors: string[]; warnings: string[] } {
  const base = validateAlgorithmIRV4(raw);
  const errors = [...base.errors];
  const warnings: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors, warnings };
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== ALGORITHM_IR_V4_SCHEMA) errors.push(`schemaVersion باید ${ALGORITHM_IR_V4_SCHEMA} باشد.`);
  const meta = obj.algorithmMeta as Record<string, unknown> | undefined;
  if (meta?.contentPolicy !== "algorithm_only") errors.push('algorithmMeta.contentPolicy باید "algorithm_only" باشد.');
  if (!Array.isArray(obj.coverageMap)) errors.push("coverageMap باید آرایه باشد.");
  if (Array.isArray(obj.surfaces)) {
    obj.surfaces.forEach((surface, index) => {
      if (!surface || typeof surface !== "object" || !Array.isArray((surface as Record<string, unknown>).linkedBlockIds)) errors.push(`surface ${index + 1}: linkedBlockIds الزامی است.`);
    });
  }
  if (Array.isArray(obj.coverageMap)) {
    obj.coverageMap.forEach((item, index) => {
      const status = item && typeof item === "object" ? String((item as Record<string, unknown>).status ?? "") : "";
      if (FORBIDDEN_COVERAGE.has(status)) errors.push(`coverageMap[${index}]: status غیرمجاز ${status}`);
    });
  }
  walk(raw, "", (key, _value, path) => {
    if (FORBIDDEN_KEYS.some((forbidden) => key.toLowerCase() === forbidden.toLowerCase())) errors.push(`فیلد renderer/storage غیرمجاز: ${path}`);
  });
  if (!obj.validationReport) warnings.push("گزارش validation رسمی همراه فایل نبود؛ فقط validation داخلی انجام شد.");
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), warnings };
}
