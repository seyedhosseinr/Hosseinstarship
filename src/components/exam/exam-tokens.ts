/**
 * CSS-variable bridge for exam components.
 *
 * The exam root component (ActiveExamPage) injects EXAM_STYLES and
 * sets data-exam on its wrapper.  All child components use `C.accent`,
 * `C.text`, etc. — which resolve to CSS vars that automatically
 * switch between light/dark palettes.
 */
import { colorLight, colorDark } from "@/lib/theme/tokens";

export const EXAM_STYLES = `
[data-exam] {
${Object.entries(colorLight).map(([k, v]) => `  --ex-${k}: ${v};`).join("\n")}
}
.dark [data-exam] {
${Object.entries(colorDark).map(([k, v]) => `  --ex-${k}: ${v};`).join("\n")}
}
`;

/** Token object backed by CSS custom properties — safe to use at module level. */
export const C = Object.fromEntries(
  Object.keys(colorLight).map((k) => [k, `var(--ex-${k})`]),
) as Record<keyof typeof colorLight, string>;
