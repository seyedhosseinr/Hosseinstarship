import {
  validateAlgorithmIRV4,
  type AlgorithmIRV4,
} from "@/types/algorithm-ir-v4";

// Safe static mapping — only known segmentIds are permitted.
// To add a new algorithm: add an entry here and place the JSON under src/data/algorithms/.
const algorithmFiles = {
  "96_01": () => import("@/data/algorithms/algorithm_ir_96_01.json"),
} as const;

type KnownSegmentId = keyof typeof algorithmFiles;

export function isKnownSegmentId(segmentId: string): segmentId is KnownSegmentId {
  return segmentId in algorithmFiles;
}

export async function loadAlgorithmIR(
  segmentId: string,
): Promise<Readonly<AlgorithmIRV4>> {
  if (!isKnownSegmentId(segmentId)) {
    throw new Error(`Algorithm file not found for segmentId: ${segmentId}`);
  }

  const loader = algorithmFiles[segmentId];
  const mod = await loader();
  const raw = mod.default;

  const result = validateAlgorithmIRV4(raw);
  if (!result.valid) {
    throw new Error(
      `Invalid Algorithm IR: ${result.errors.join("; ")}`,
    );
  }

  return Object.freeze(raw as AlgorithmIRV4);
}
