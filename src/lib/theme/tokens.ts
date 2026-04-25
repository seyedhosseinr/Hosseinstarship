// src/lib/theme/tokens.ts
// Phase 1 – Design Foundation
// Single source of truth for color, radius, shadow, space, and typography.

/** Merge Tailwind class strings, filtering falsy values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Palettes ─────────────────────────────────────────────────────────────────

/** Light-mode colour palette — AMBOSS design system. */
export const colorLight = {
  bg:            "#F5F7F9",
  surface:       "#FFFFFF",
  surfaceSubtle: "#F8FAFB",
  border:        "#E0E6EB",
  borderStrong:  "#D0D8E0",
  text:          "#1A1C1C",
  textSoft:      "#454D54",
  textMuted:     "#6B7780",
  accent:        "#0AA6B8",
  accentHover:   "#047A88",
  accentSoft:    "#E7F6F8",
  accentBorder:  "#7DD8E3",
  success:       "#16A34A",
  warning:       "#D97706",
  danger:        "#DC2626",
};

/** Dark-mode colour palette — AMBOSS design system. */
export const colorDark = {
  bg:            "#1A1C1C",
  surface:       "#24282D",
  surfaceSubtle: "#2A2E33",
  border:        "#32363E",
  borderStrong:  "#444A52",
  text:          "#E8EAED",
  textSoft:      "#A0A8B0",
  textMuted:     "#6B7780",
  accent:        "#2DB5C6",
  accentHover:   "#0AA6B8",
  accentSoft:    "#0A2E33",
  accentBorder:  "#047A88",
  success:       "#22C55E",
  warning:       "#F59E0B",
  danger:        "#EF4444",
};

/** Structural palette type — same keys as colorLight, string values. */
export type ColorPalette = { readonly [K in keyof typeof colorLight]: string };

// ─── Design tokens ────────────────────────────────────────────────────────────

export const tokens = {
  /** Light-mode colour tokens. Use getTokens(isDark) for dark-aware access. */
  color: colorLight,

  radius: {
    sm: "10px",
    md: "14px",
    lg: "18px",
    xl: "24px",
  },

  shadow: {
    xs: "0 1px 2px rgba(26, 28, 28, 0.04)",
    sm: "0 4px 10px rgba(26, 28, 28, 0.04)",
    md: "0 10px 24px rgba(26, 28, 28, 0.06)",
  },

  space: {
    1:  "4px",
    2:  "8px",
    3:  "12px",
    4:  "16px",
    5:  "20px",
    6:  "24px",
    8:  "32px",
    10: "40px",
    12: "48px",
  },

  /**
   * Tailwind class presets for consistent typography.
   * Use with cn() / className — not with style props.
   */
  typography: {
    pageTitle:    "text-2xl md:text-3xl font-semibold tracking-tight",
    sectionTitle: "text-lg md:text-xl font-semibold",
    body:         "text-sm md:text-[15px] leading-7",
    label:        "text-sm font-medium",
    meta:         "text-xs text-muted-foreground",
  },

} as const;

// ─── Runtime helper ───────────────────────────────────────────────────────────

/**
 * Returns the colour palette for the current theme.
 * Use in inline `style` props where Tailwind dark-mode classes are not enough.
 *
 * @example
 *   const c = getTokens(isDark);
 *   <div style={{ background: c.surface, color: c.text }}>…</div>
 */
export function getTokens(isDark: boolean): ColorPalette {
  return isDark ? colorDark : colorLight;
}
