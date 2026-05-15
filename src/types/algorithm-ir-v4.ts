// Algorithm IR v4 — viewer-side types
// Uses REAL field names from the JSON: surfaceId, nodeId, edgeId
// DO NOT use these types for the Outliner system (which normalizes to .id)

export const ALGORITHM_IR_V4_SCHEMA = "starship-algorithm-ir-v4" as const;

export interface AlgorithmMetaV4 {
  title: string;
  chapterId?: string;
  examTarget?: string;
  language?: string;
  contentPolicy?: string;
  [key: string]: unknown;
}

export interface AlgorithmNodeV4 {
  nodeId: string;
  nodeType: string;
  label: string;
  detail?: string;
  testablePoint?: string;
  memoryRole?: string;
  sourceTextRole?: string;
  sourceSupport?: string;
  linkedBlockIds?: string[];
}

export interface AlgorithmEdgeV4 {
  edgeId: string;
  from: string;
  to: string;
  condition?: string;
  edgeType?: string;
  linkedBlockIds?: string[];
  sourceSupport?: string;
}

export interface ThresholdV4 {
  thresholdId?: string;
  variable: string;
  value: string;
  conditionText?: string;
  decisionImpact?: string;
  memoryAnchor?: string;
  linkedBlockIds?: string[];
}

export interface GateV4 {
  gateId?: string;
  title: string;
  entryCondition?: string;
  includeCriteria?: string[];
  excludeCriteria?: string[];
  actionIfPass?: string;
  actionIfFail?: string;
  exceptions?: string[];
  linkedBlockIds?: string[];
}

export interface MatrixRowV4 {
  condition?: string;
  decision?: string;
  reason?: string;
  trap?: string;
  linkedBlockIds?: string[];
}

export interface DecisionMatrixV4 {
  matrixId?: string;
  title: string;
  rows: MatrixRowV4[];
}

export interface BoardTrapV4 {
  trapId?: string;
  trapTitle: string;
  wrongPath?: string;
  correctPath?: string;
  whyItMatters?: string;
  linkedBlockIds?: string[];
  linkedNodeIds?: string[];
}

export interface CheckpointV4 {
  checkpointId?: string;
  checkpointType?: string;
  prompt: string;
  answer: string;
  whyItMatters?: string;
  linkedNodeIds?: string[];
  linkedBlockIds?: string[];
}

export interface MediaLinkV4 {
  mediaId?: string;
  type?: string;
  title?: string;
  uri?: string;
  linkedBlockIds?: string[];
}

export interface AlgorithmSurfaceV4 {
  surfaceId: string;
  surfaceType: string;
  algorithmShape: string;
  semanticRole?: string;
  complexityLevel?: string;
  title: string;
  clinicalQuestion?: string;
  examEntryPoints?: string[];
  memoryAnchor?: string;
  linkedBlockIds?: string[];
  sourceSectionHeadings?: string[];

  nodes: AlgorithmNodeV4[];
  edges: AlgorithmEdgeV4[];
  thresholds?: ThresholdV4[];
  gates?: GateV4[];
  matrices?: DecisionMatrixV4[];
  boardTraps?: BoardTrapV4[];
  followUpRules?: unknown[];
  complicationRules?: unknown[];
  checkpoints?: CheckpointV4[];
  mediaLinks?: MediaLinkV4[];

  // Ignored in v1 viewer
  mermaid?: string;
}

export interface AlgorithmIRV4 {
  schemaVersion: typeof ALGORITHM_IR_V4_SCHEMA;
  segmentId: string;
  algorithmMeta: AlgorithmMetaV4;
  surfaces: AlgorithmSurfaceV4[];

  // Optional global fields
  sourceNote?: unknown;
  coverageMap?: unknown;
  globalThresholds?: ThresholdV4[];
  globalBoardTraps?: BoardTrapV4[];
  globalCheckpoints?: CheckpointV4[];
  mediaRefs?: unknown[];
}

// ─── Validation ────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

export interface AlgorithmIRV4ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAlgorithmIRV4(raw: unknown): AlgorithmIRV4ValidationResult {
  const errors: string[] = [];

  if (!isObject(raw)) {
    return { valid: false, errors: ["Algorithm IR must be a JSON object."] };
  }

  if (raw.schemaVersion !== ALGORITHM_IR_V4_SCHEMA) {
    errors.push(
      `schemaVersion must equal "${ALGORITHM_IR_V4_SCHEMA}" (got: ${String(raw.schemaVersion ?? "undefined")})`,
    );
  }

  if (!str(raw.segmentId)) errors.push("segmentId must be a non-empty string.");

  if (!isObject(raw.algorithmMeta)) {
    errors.push("algorithmMeta must be an object.");
  }

  if (!Array.isArray(raw.surfaces) || raw.surfaces.length === 0) {
    errors.push("surfaces must be a non-empty array.");
  } else {
    (raw.surfaces as unknown[]).forEach((s, i) => {
      if (!isObject(s)) { errors.push(`surfaces[${i}] is not an object.`); return; }
      if (!str(s.surfaceId)) errors.push(`surfaces[${i}].surfaceId is missing.`);
      if (!str(s.title)) errors.push(`surfaces[${i}].title is missing.`);
      if (!str(s.surfaceType)) errors.push(`surfaces[${i}].surfaceType is missing.`);
      if (!str(s.algorithmShape)) errors.push(`surfaces[${i}].algorithmShape is missing.`);
      if (!Array.isArray(s.nodes)) errors.push(`surfaces[${i}].nodes must be an array.`);
      if (!Array.isArray(s.edges)) errors.push(`surfaces[${i}].edges must be an array.`);
    });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export function getAlgorithmDisplayTitle(ir: AlgorithmIRV4): string {
  return ir.algorithmMeta?.title || "الگوریتم بالینی";
}

export function getAlgorithmShortTitle(ir: AlgorithmIRV4): string {
  return ir.algorithmMeta?.title?.split(":")[0]?.trim() || "الگوریتم بالینی";
}

// Surface type family grouping
export type SurfaceFamily =
  | "pathway"
  | "decision"
  | "classification"
  | "gate"
  | "trap"
  | "chain"
  | "other";

const PATHWAY_TYPES = new Set([
  "diagnostic_pathway",
  "management_pathway",
  "follow_up_pathway",
  "postoperative_pathway",
  "failure_pathway",
]);

const DECISION_TYPES = new Set([
  "differential_algorithm",
  "treatment_selection",
  "procedure_selection",
]);

const CLASSIFICATION_TYPES = new Set([
  "classification_tree",
  "risk_stratification",
  "staging_pathway",
]);

const GATE_TYPES = new Set(["indication_gate", "contraindication_gate"]);

const TRAP_TYPES = new Set(["board_trap_map"]);

const CHAIN_TYPES = new Set([
  "concept_chain",
  "mechanism_chain",
  "recognition_chain",
  "classification_chain",
  "board_memory_chain",
]);

export function getSurfaceFamily(surfaceType: string): SurfaceFamily {
  if (PATHWAY_TYPES.has(surfaceType)) return "pathway";
  if (DECISION_TYPES.has(surfaceType)) return "decision";
  if (CLASSIFICATION_TYPES.has(surfaceType)) return "classification";
  if (GATE_TYPES.has(surfaceType)) return "gate";
  if (TRAP_TYPES.has(surfaceType)) return "trap";
  if (CHAIN_TYPES.has(surfaceType)) return "chain";
  return "other";
}

export const FAMILY_LABELS: Record<SurfaceFamily, string> = {
  pathway: "مسیر بالینی",
  decision: "تصمیم‌گیری",
  classification: "طبقه‌بندی",
  gate: "دروازه",
  trap: "تله‌های بوردی",
  chain: "زنجیره مفهومی",
  other: "سایر",
};

export const SURFACE_TYPE_LABELS: Record<string, string> = {
  diagnostic_pathway: "مسیر تشخیصی",
  management_pathway: "مسیر مدیریتی",
  follow_up_pathway: "مسیر پیگیری",
  postoperative_pathway: "مسیر بعد از عمل",
  failure_pathway: "مسیر شکست درمان",
  differential_algorithm: "الگوریتم افتراقی",
  treatment_selection: "انتخاب درمان",
  procedure_selection: "انتخاب روش",
  classification_tree: "درخت طبقه‌بندی",
  risk_stratification: "طبقه‌بندی ریسک",
  staging_pathway: "مسیر استیجینگ",
  indication_gate: "دروازه اندیکاسیون",
  contraindication_gate: "دروازه کنتراندیکاسیون",
  board_trap_map: "نقشه تله بوردی",
  concept_chain: "زنجیره مفهومی",
  mechanism_chain: "زنجیره مکانیسم",
  recognition_chain: "زنجیره شناخت",
  classification_chain: "زنجیره طبقه‌بندی",
  board_memory_chain: "زنجیره حافظه بوردی",
  threshold_ladder: "نردبان آستانه",
  decision_matrix: "ماتریس تصمیم",
  complication_escalation: "تشدید عوارض",
  combined_algorithm: "الگوریتم ترکیبی",
  media_recognition: "شناخت تصویری",
};

export function getSurfaceTypeLabel(surfaceType: string): string {
  return SURFACE_TYPE_LABELS[surfaceType] ?? surfaceType;
}

export const NODE_TYPE_LABELS: Record<string, string> = {
  entry: "ورود",
  question: "سؤال",
  finding: "یافته",
  test: "آزمایش",
  threshold: "آستانه",
  treatment: "درمان",
  escalation: "اورژانس",
  endpoint: "پایان",
  trap: "تله",
  exception: "استثناء",
  mechanism: "مکانیسم",
  clinical_effect: "اثر بالینی",
  classification: "طبقه‌بندی",
};

export function getNodeTypeLabel(nodeType: string): string {
  return NODE_TYPE_LABELS[nodeType] ?? nodeType;
}
