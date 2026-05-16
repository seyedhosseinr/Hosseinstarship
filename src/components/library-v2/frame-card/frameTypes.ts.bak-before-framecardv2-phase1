import type { CSSProperties } from "react";
import type { FrameViewModel } from "@/lib/contract/note-viewer.types";
import type { ReaderAnnotation } from "@/hooks/useReaderAnnotations";

export type ReaderCSS = CSSProperties & {
  textWrap?: "balance" | "pretty" | "wrap" | "nowrap";
  unicodeBidi?:
    | "normal"
    | "embed"
    | "isolate"
    | "bidi-override"
    | "isolate-override"
    | "plaintext";
};

export type LinkedQuestion = FrameViewModel["linkedQuestions"][number];

export type Tone = {
  label: string;
  accent: string;
  bg: string;
  badgeBg: string;
  text: string;
  dot: string;
};

export interface FrameCardV2Props {
  frame: FrameViewModel;
  isHighlighted?: boolean;
  annotationCount?: number;
  annotations?: ReaderAnnotation[];
  highlightsVisible?: boolean;
  showHighYieldMarker?: boolean;
  isKeyExamFrame?: boolean;
  isMissedFrame?: boolean;
}
