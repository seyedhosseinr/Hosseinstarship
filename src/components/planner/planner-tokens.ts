/**
 * CSS-variable bridge for planner components.
 *
 * Usage:
 *  1. The planner root component injects PLANNER_STYLES and sets data-planner on its wrapper.
 *  2. All child components use `C.accent`, `C.text`, etc. which resolve to CSS vars
 *     that automatically switch between light/dark palettes.
 */
import { colorLight, colorDark } from "@/lib/theme/tokens";

export const PLANNER_STYLES = `
[data-planner] {
${Object.entries(colorLight).map(([k, v]) => `  --pl-${k}: ${v};`).join("\n")}
}
.dark [data-planner] {
${Object.entries(colorDark).map(([k, v]) => `  --pl-${k}: ${v};`).join("\n")}
}
`;

/** Token object backed by CSS custom properties — safe to use at module level. */
export const C = Object.fromEntries(
  Object.keys(colorLight).map((k) => [k, `var(--pl-${k})`]),
) as Record<keyof typeof colorLight, string>;
