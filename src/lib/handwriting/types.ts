export interface HandwritingPoint {
  x: number;
  y: number;
  pressure?: number;
  t?: number;
}

export interface HandwritingStroke {
  id: string;
  points: HandwritingPoint[];
  color: string;
  width: number;
  tool: "pen" | "eraser";
}

export interface HandwrittenNote {
  id: string;
  chapterId: string;
  segmentId: string;
  blockId: string;
  anchorKey: string;
  strokes: HandwritingStroke[];
  viewportHint?: {
    scrollY?: number;
    containerWidth?: number;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
