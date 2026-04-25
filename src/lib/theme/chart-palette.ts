// src/lib/theme/chart-palette.ts
// AMBOSS-harmonized chart & data-viz palette.
// Each series uses a distinct hue that complements the brand teal (#0AA6B8).

/** Ordered series colours for charts and data visualisation. */
export const CHART_PALETTE = [
  "#0AA6B8", // brand primary — teal
  "#047A88", // brand deep — dark teal
  "#2DB5C6", // brand light — sky teal
  "#7DD8E3", // brand tint — pale teal
  "#16A34A", // success — green
  "#D97706", // warning — amber
  "#DC2626", // danger — red
  "#7C6FD4", // violet — accent contrast
  "#5B63D4", // indigo — secondary accent
  "#D946A8", // pink — tertiary accent
  "#E88B30", // orange — warm accent
  "#6B7780", // neutral — muted
] as const;

/** Semantic subset for common dashboard widgets. */
export const CHART_SEMANTIC = {
  correct:   "#16A34A",
  incorrect: "#DC2626",
  omitted:   "#6B7780",
  partial:   "#D97706",
  primary:   "#0AA6B8",
  secondary: "#047A88",
} as const;

/** CSS variable references for chart colours (use in inline styles). */
export const CHART_CSS_VARS = {
  primary:   "hsl(var(--primary))",
  success:   "hsl(var(--success))",
  warning:   "hsl(var(--warning))",
  danger:    "hsl(var(--danger))",
  info:      "hsl(var(--info))",
  muted:     "hsl(var(--muted-foreground))",
} as const;
