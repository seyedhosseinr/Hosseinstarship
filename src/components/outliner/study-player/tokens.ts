import type React from "react";

// ── Design tokens ────────────────────────────────────────────────────────────
export const SP_TOKENS = {
  shellBg:     "#F4F7F8",
  canvasBg:    "#F7F9F6",
  canvasDot:   "#DCE5DE",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F8FAFC",
  border:      "#D7E0E5",
  text:        "#0F172A",
  textMuted:   "#5F6F7E",
  accent:      "#0F766E",
  accentSoft:  "#E0F2F1",
  amberBg:     "#FFF4D6",
  amberBorder: "#E7A821",
} as const;

// Applied as inline style on shell root so children can use var(--sp-*)
export const SP_ROOT_VARS: React.CSSProperties = {
  "--sp-shell-bg":     SP_TOKENS.shellBg,
  "--sp-canvas-bg":    SP_TOKENS.canvasBg,
  "--sp-canvas-dot":   SP_TOKENS.canvasDot,
  "--sp-surface":      SP_TOKENS.surface,
  "--sp-surface-alt":  SP_TOKENS.surfaceAlt,
  "--sp-border":       SP_TOKENS.border,
  "--sp-text":         SP_TOKENS.text,
  "--sp-text-muted":   SP_TOKENS.textMuted,
  "--sp-accent":       SP_TOKENS.accent,
  "--sp-accent-soft":  SP_TOKENS.accentSoft,
  "--sp-amber-bg":     SP_TOKENS.amberBg,
  "--sp-amber-border": SP_TOKENS.amberBorder,
  fontFamily:          "'Vazirmatn', system-ui, sans-serif",
  lineHeight:          "1.7",
} as unknown as React.CSSProperties;

// ── Persian digit helper ─────────────────────────────────────────────────────
export const toFa = (n: number): string =>
  n.toString().replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d] ?? d);

// ── Mode definitions ─────────────────────────────────────────────────────────
export const MODE_LABELS = {
  free:     "مرور آزاد",
  stepwise: "قدم‌به‌قدم",
  traps:    "دام‌ها",
  recall:   "یادآوری",
  exam:     "امتحانی",
} as const;

export const MODE_BANNERS: Record<string, string | null> = {
  free:     null,
  stepwise: "تمرین تصمیم بالینی — یک تصمیم در هر قدم. پیامد بعد از انتخاب نمایش داده می‌شود.",
  traps:    "فقط گره‌هایی با نقش دام برجسته هستند.",
  recall:   "متن گره‌ها پنهان است. روی هر گره بزن تا نمایش داده شود.",
  exam:     "نکات قابل‌آزمون پنهان است. پاسخ خود را بده، سپس مشاهده کن.",
};
