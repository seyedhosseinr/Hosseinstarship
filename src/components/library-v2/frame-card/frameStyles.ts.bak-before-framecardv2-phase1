import type { CalloutV8 } from "@/lib/contract/note-v8.types";
import type { FrameKind } from "@/lib/contract/types";
import type { ReaderCSS, Tone } from "./frameTypes";

export const KIND_LABELS: Record<FrameKind, string> = {
  core: "Core",
  pearl: "Pearl",
  warning: "Warning",
  pitfall: "Pitfall",
  keypoint: "Key Point",
  concept: "Concept",
  trap: "Exam Trap",
  threshold: "Threshold",
  indication: "Indication",
  differential: "Differential",
  algorithm: "Algorithm",
  clinical_decision: "Clinical Decision",
  complication: "Complication",
  follow_up: "Follow-up",
  high_yield: "High Yield",
  interactive_algorithm: "Interactive Algorithm",
};

export const CALLOUT_FOR_KIND: Partial<Record<FrameKind, Tone>> = {
  clinical_decision: {
    label: KIND_LABELS.clinical_decision,
    accent: "border-s-sky-500/80 dark:border-s-sky-400/80",
    bg: "bg-sky-50/60 dark:bg-sky-950/20",
    badgeBg:
      "border-sky-500/20 bg-sky-500/[0.07] dark:border-sky-400/20 dark:bg-sky-400/[0.07]",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500/85 dark:bg-sky-400/85",
  },
  threshold: {
    label: KIND_LABELS.threshold,
    accent: "border-s-violet-500/75 dark:border-s-violet-400/75",
    bg: "bg-violet-50/60 dark:bg-violet-950/20",
    badgeBg:
      "border-violet-500/20 bg-violet-500/[0.07] dark:border-violet-400/20 dark:bg-violet-400/[0.07]",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500/85 dark:bg-violet-400/85",
  },
  high_yield: {
    label: KIND_LABELS.high_yield,
    accent: "border-s-amber-500/80 dark:border-s-amber-400/80",
    bg: "bg-amber-50/55 dark:bg-amber-950/20",
    badgeBg:
      "border-amber-500/20 bg-amber-500/[0.07] dark:border-amber-400/20 dark:bg-amber-400/[0.07]",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500/85 dark:bg-amber-400/85",
  },
  keypoint: {
    label: KIND_LABELS.keypoint,
    accent: "border-s-emerald-500/75 dark:border-s-emerald-400/75",
    bg: "bg-emerald-50/55 dark:bg-emerald-950/20",
    badgeBg:
      "border-emerald-500/20 bg-emerald-500/[0.07] dark:border-emerald-400/20 dark:bg-emerald-400/[0.07]",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500/85 dark:bg-emerald-400/85",
  },
  pearl: {
    label: KIND_LABELS.pearl,
    accent: "border-s-amber-500/70 dark:border-s-amber-400/70",
    bg: "bg-amber-50/45 dark:bg-amber-950/15",
    badgeBg:
      "border-amber-500/20 bg-amber-500/[0.06] dark:border-amber-400/20 dark:bg-amber-400/[0.06]",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500/75 dark:bg-amber-400/75",
  },
  warning: {
    label: KIND_LABELS.warning,
    accent: "border-s-rose-500/75 dark:border-s-rose-400/75",
    bg: "bg-rose-50/60 dark:bg-rose-950/20",
    badgeBg:
      "border-rose-500/20 bg-rose-500/[0.07] dark:border-rose-400/20 dark:bg-rose-400/[0.07]",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500/85 dark:bg-rose-400/85",
  },
  pitfall: {
    label: KIND_LABELS.pitfall,
    accent: "border-s-rose-500/70 dark:border-s-rose-400/70",
    bg: "bg-rose-50/50 dark:bg-rose-950/20",
    badgeBg:
      "border-rose-500/20 bg-rose-500/[0.06] dark:border-rose-400/20 dark:bg-rose-400/[0.06]",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500/75 dark:bg-rose-400/75",
  },
  trap: {
    label: KIND_LABELS.trap,
    accent: "border-s-rose-500/80 dark:border-s-rose-400/80",
    bg: "bg-rose-50/60 dark:bg-rose-950/20",
    badgeBg:
      "border-rose-500/20 bg-rose-500/[0.07] dark:border-rose-400/20 dark:bg-rose-400/[0.07]",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500/90 dark:bg-rose-400/90",
  },
  complication: {
    label: KIND_LABELS.complication,
    accent: "border-s-orange-500/75 dark:border-s-orange-400/75",
    bg: "bg-orange-50/55 dark:bg-orange-950/20",
    badgeBg:
      "border-orange-500/20 bg-orange-500/[0.07] dark:border-orange-400/20 dark:bg-orange-400/[0.07]",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500/85 dark:bg-orange-400/85",
  },
  indication: {
    label: KIND_LABELS.indication,
    accent: "border-s-emerald-500/75 dark:border-s-emerald-400/75",
    bg: "bg-emerald-50/55 dark:bg-emerald-950/20",
    badgeBg:
      "border-emerald-500/20 bg-emerald-500/[0.07] dark:border-emerald-400/20 dark:bg-emerald-400/[0.07]",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500/85 dark:bg-emerald-400/85",
  },
  follow_up: {
    label: KIND_LABELS.follow_up,
    accent: "border-s-sky-500/60 dark:border-s-sky-400/60",
    bg: "bg-sky-50/40 dark:bg-sky-950/15",
    badgeBg:
      "border-sky-500/20 bg-sky-500/[0.05] dark:border-sky-400/20 dark:bg-sky-400/[0.05]",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500/65 dark:bg-sky-400/65",
  },
};

export const PLAIN_EYEBROW: Partial<Record<FrameKind, { label: string; text: string }>> = {
  differential: {
    label: KIND_LABELS.differential,
    text: "text-indigo-700 dark:text-indigo-300",
  },
  algorithm: {
    label: KIND_LABELS.algorithm,
    text: "text-violet-700 dark:text-violet-300",
  },
  interactive_algorithm: {
    label: KIND_LABELS.interactive_algorithm,
    text: "text-teal-700 dark:text-teal-300",
  },
};

export const CALLOUT_TONE: Record<CalloutV8["kind"], { text: string; dot: string }> = {
  clinical_pearl: {
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500/75 dark:bg-amber-400/75",
  },
  warning: {
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500/75 dark:bg-rose-400/75",
  },
  tip: {
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500/75 dark:bg-sky-400/75",
  },
};

export const proseStyle: ReaderCSS = {
  textAlign: "start",
  textWrap: "pretty",
  overflowWrap: "break-word",
  wordBreak: "normal",
  lineBreak: "auto",
};

export const titleStyle: ReaderCSS = {
  textWrap: "balance",
  textAlign: "start",
  overflowWrap: "break-word",
};

export function resolveKind(kind: string | null | undefined): FrameKind {
  return KIND_LABELS[kind as FrameKind] ? (kind as FrameKind) : "core";
}
