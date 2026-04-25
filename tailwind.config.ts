import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-vazir)", "Vazirmatn", "Tahoma", "SF Pro Text", "-apple-system", "sans-serif"],
        vazir: ["var(--font-vazir)", "Vazirmatn", "Tahoma", "sans-serif"],
      },
      screens: {
        /* Standard Tailwind + iPad-specific */
        "ipad-portrait": "768px",
        "ipad-landscape": "1024px",
        "ipad-pro": "1194px",
      },
      colors: {
        /* ── AMBOSS brand palette ──────────────────── */
        brand: {
          DEFAULT:  "hsl(var(--brand-primary) / <alpha-value>)",
          dark:     "hsl(var(--brand-primary-dark) / <alpha-value>)",
          light:    "hsl(var(--brand-primary-light) / <alpha-value>)",
          deep:     "hsl(var(--brand-deep) / <alpha-value>)",
          tint:     "hsl(var(--brand-tint) / <alpha-value>)",
        },

        /* ── Surfaces ──────────────────────────────── */
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        surface:    "hsl(var(--surface) / <alpha-value>)",
        "surface-2":"hsl(var(--surface-2) / <alpha-value>)",

        /* ── shadcn/ui semantic ────────────────────── */
        border:     "hsl(var(--border) / <alpha-value>)",
        input:      "hsl(var(--input) / <alpha-value>)",
        ring:       "hsl(var(--ring) / <alpha-value>)",
        primary: {
          DEFAULT:    "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT:    "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },

        /* ── Semantic colors ───────────────────────── */
        success: {
          DEFAULT:    "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        danger: {
          DEFAULT:    "hsl(var(--danger) / <alpha-value>)",
          foreground: "hsl(var(--danger-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT:    "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
        },

        /* ── Text tokens ───────────────────────────── */
        "text-color":  "hsl(var(--text) / <alpha-value>)",
        "text-muted":  "hsl(var(--text-muted) / <alpha-value>)",

        /* ── Sidebar ───────────────────────────────── */
        sidebar: {
          bg:     "hsl(var(--sidebar-bg) / <alpha-value>)",
          fg:     "hsl(var(--sidebar-fg) / <alpha-value>)",
          active: "hsl(var(--sidebar-active) / <alpha-value>)",
          hover:  "hsl(var(--sidebar-hover) / <alpha-value>)",
        },

        /* ── Reader ────────────────────────────────── */
        reader: {
          bg:        "hsl(var(--reader-bg) / <alpha-value>)",
          fg:        "hsl(var(--reader-fg) / <alpha-value>)",
          muted:     "hsl(var(--reader-muted) / <alpha-value>)",
          border:    "hsl(var(--reader-border) / <alpha-value>)",
          highlight: "hsl(var(--reader-highlight) / <alpha-value>)",
          underline: "hsl(var(--reader-underline) / <alpha-value>)",
          comment:   "hsl(var(--reader-comment) / <alpha-value>)",
        },

        /* ── Library design system (pre-resolved) ──── */
        lib: {
          bg: "var(--lib-bg)",
          surface: "var(--lib-surface)",
          "surface-raised": "var(--lib-surface-raised)",
          glass: "var(--lib-glass)",
          border: "var(--lib-border)",
          "border-subtle": "var(--lib-border-subtle)",
          text: "var(--lib-text)",
          "text-secondary": "var(--lib-text-secondary)",
          "text-muted": "var(--lib-text-muted)",
          accent: "var(--lib-accent)",
          "accent-fg": "var(--lib-accent-fg)",
          "accent-soft": "var(--lib-accent-soft)",
          "accent-hover": "var(--lib-accent-hover)",
          success: "var(--lib-success)",
          "success-soft": "var(--lib-success-soft)",
          warning: "var(--lib-warning)",
          "warning-soft": "var(--lib-warning-soft)",
          danger: "var(--lib-danger)",
          "danger-soft": "var(--lib-danger-soft)",
          hover: "var(--lib-hover)",
          active: "var(--lib-active)",
          "active-border": "var(--lib-active-border)",
          highlight: "var(--lib-highlight)",
          underline: "var(--lib-underline)",
          /* Exam surface */
          correct: "var(--lib-correct)",
          "correct-bg": "var(--lib-correct-bg)",
          "correct-border": "var(--lib-correct-border)",
          incorrect: "var(--lib-incorrect)",
          "incorrect-bg": "var(--lib-incorrect-bg)",
          "incorrect-border": "var(--lib-incorrect-border)",
          "omitted-bg": "var(--lib-omitted-bg)",
          marked: "var(--lib-marked)",
          "marked-bg": "var(--lib-marked-bg)",
          bar: "var(--lib-bar)",
          "bar-border": "var(--lib-bar-border)",
          "bar-text": "var(--lib-bar-text)",
          "bar-muted": "var(--lib-bar-muted)",
          "nav-bg": "var(--lib-nav-bg)",
          "nav-item": "var(--lib-nav-item)",
          "exp-bg": "var(--lib-exp-bg)",
          "exp-border": "var(--lib-exp-border)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "lib-sm": "var(--lib-radius-sm)",
        "lib-md": "var(--lib-radius-md)",
        "lib-lg": "var(--lib-radius-lg)",
        "lib-xl": "var(--lib-radius-xl)",
      },
      maxWidth: {
        "lib-measure": "var(--lib-measure)",
        "lib-question": "var(--lib-question-measure)",
      },
      width: {
        "lib-spine": "var(--lib-spine-width)",
        "lib-gutter": "var(--lib-gutter-width)",
        "lib-nav-rail": "var(--lib-nav-rail-width)",
        "lib-study-panel": "var(--lib-study-panel-width)",
      },
      height: {
        "lib-dock": "var(--lib-dock-height)",
      },
      transitionDuration: {
        "lib-spring": "var(--lib-spring-duration)",
        "lib-fade": "var(--lib-fade-duration)",
      },
      transitionTimingFunction: {
        "lib-spring": "var(--lib-spring-easing)",
        "lib-fade": "var(--lib-fade-easing)",
      },
      minHeight: {
        "touch": "44px",
      },
      minWidth: {
        "touch": "44px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
