"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  BookOpen,
  Brain,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  FlaskConical,
  Flag,
  Hash,
  LayoutDashboard,
  Moon,
  Pencil,
  Search,
  Sun,
  X,
  Check,
  ArrowRight,
  Wifi,
  WifiOff,
  CloudUpload,
  CheckCircle2,
  Circle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   STARSHIP — SPATIAL DIRECTION
   ─────────────────────────────────────────────────────
   visionOS discipline meets a medical cockpit.
   Materials on floating surfaces. Depth, not decoration.
   Local-first state is visible chrome.
   ═══════════════════════════════════════════════════════ */

type Surface = "today" | "reader" | "qbank";
type SyncStatus = "local" | "syncing" | "synced" | "offline";

// ─── Medical Content ──────────────────────────────────

const RCC_CONTENT = {
  title: "Renal Cell Carcinoma",
  subtitle: "Campbell-Walsh-Wein Urology, Chapter 57",
  toc: [
    { id: "epidemiology", label: "Epidemiology", level: 1 },
    { id: "etiology", label: "Etiology & Risk Factors", level: 1 },
    { id: "pathology", label: "Pathology", level: 1 },
    { id: "clear-cell", label: "Clear Cell RCC", level: 2 },
    { id: "papillary", label: "Papillary RCC", level: 2 },
    { id: "chromophobe", label: "Chromophobe RCC", level: 2 },
    { id: "presentation", label: "Clinical Presentation", level: 1 },
    { id: "diagnosis", label: "Diagnosis & Workup", level: 1 },
    { id: "staging", label: "Staging", level: 1 },
    { id: "treatment", label: "Surgical Management", level: 1 },
  ],
  sections: [
    {
      id: "epidemiology",
      heading: "Epidemiology",
      paragraphs: [
        "Renal cell carcinoma (RCC) accounts for approximately 3% of all adult malignancies and 90% of all kidney neoplasms. The American Cancer Society estimates approximately 79,000 new cases of kidney cancer annually in the United States, with roughly 14,000 deaths attributed to the disease.",
        "The incidence of RCC has been rising steadily at approximately 2% per year, partly attributed to the widespread use of cross-sectional imaging. Incidental detection now accounts for over 60% of newly diagnosed renal masses. Despite this stage migration toward smaller, organ-confined tumors, mortality rates have not declined proportionally.",
        "RCC is approximately twice as common in men as in women, with peak incidence in the sixth and seventh decades of life. Geographic variation is notable, with the highest incidence rates observed in North America, Europe, and Australia.",
      ],
    },
    {
      id: "etiology",
      heading: "Etiology & Risk Factors",
      paragraphs: [
        "Cigarette smoking remains the most consistently identified modifiable risk factor for RCC, conferring a relative risk of 1.4 to 2.5. The risk is dose-dependent and diminishes following cessation, though it does not fully normalize for 15 to 20 years.",
        "Obesity is independently associated with RCC risk through mechanisms involving chronic tissue hypoxia, lipid peroxidation, and upregulation of the insulin-like growth factor (IGF) axis. Hypertension represents an additional independent risk factor, though the contribution of antihypertensive medications remains debated.",
        "Hereditary forms of RCC account for 3% to 5% of cases. Von Hippel-Lindau (VHL) disease, caused by germline mutations in the VHL tumor suppressor gene on chromosome 3p25, predisposes to bilateral, multifocal clear cell RCC. The VHL protein regulates hypoxia-inducible factor (HIF), and its inactivation drives angiogenesis through vascular endothelial growth factor (VEGF) overexpression.",
      ],
    },
    {
      id: "pathology",
      heading: "Pathology",
      paragraphs: [
        "The 2016 WHO classification recognizes over 16 distinct subtypes of renal cell carcinoma. The three most common histologic subtypes — clear cell (70-80%), papillary (10-15%), and chromophobe (5%) — account for the vast majority of surgically managed tumors and carry distinct molecular signatures, clinical behaviors, and prognostic implications.",
      ],
    },
  ],
};

const QUESTION = {
  number: 14,
  total: 40,
  stem: "A 58-year-old man presents with painless gross hematuria. CT abdomen with contrast reveals a 6.2 cm solid, heterogeneously enhancing mass in the left kidney, confined to the renal parenchyma without evidence of renal vein involvement. Core needle biopsy confirms clear cell renal cell carcinoma, WHO/ISUP grade 2. CT chest is unremarkable. Bone scan shows no metastatic disease. Serum creatinine is 0.9 mg/dL and estimated GFR is 82 mL/min.",
  question: "What is the most appropriate next step in management?",
  options: [
    { letter: "A", text: "Active surveillance with repeat imaging in 3 months" },
    { letter: "B", text: "Radical nephrectomy with regional lymphadenectomy" },
    { letter: "C", text: "Partial nephrectomy" },
    { letter: "D", text: "Targeted therapy with sunitinib" },
    { letter: "E", text: "Percutaneous cryoablation" },
  ],
  correct: "C",
  labValues: [
    { name: "Creatinine", value: "0.9 mg/dL", ref: "0.7-1.3", status: "normal" as const },
    { name: "eGFR", value: "82 mL/min", ref: ">60", status: "normal" as const },
    { name: "Hemoglobin", value: "13.1 g/dL", ref: "13.5-17.5", status: "low" as const },
    { name: "Calcium", value: "10.8 mg/dL", ref: "8.5-10.5", status: "high" as const },
    { name: "LDH", value: "245 U/L", ref: "140-280", status: "normal" as const },
    { name: "Platelet", value: "210 K/uL", ref: "150-400", status: "normal" as const },
    { name: "WBC", value: "7.2 K/uL", ref: "4.5-11.0", status: "normal" as const },
    { name: "Albumin", value: "3.9 g/dL", ref: "3.5-5.0", status: "normal" as const },
  ],
  explanation: "For a T1b (4-7 cm) clear cell RCC confined to the renal parenchyma with a normal contralateral kidney and adequate renal function (eGFR 82), partial nephrectomy is the recommended approach per AUA and EAU guidelines when technically feasible. Partial nephrectomy provides equivalent oncologic outcomes to radical nephrectomy for T1 tumors while preserving renal function and reducing the long-term risk of chronic kidney disease, cardiovascular events, and overall mortality.",
};

const TODAY_TASKS = [
  { id: "1", type: "read" as const, title: "Renal Cell Carcinoma", detail: "Campbell Ch. 57 — continue from Pathology", time: "~35 min", done: false },
  { id: "2", type: "qbank" as const, title: "GU Oncology Block", detail: "40 questions — timed mode", time: "~60 min", done: false },
  { id: "3", type: "flashcard" as const, title: "23 cards due", detail: "Renal, Adrenal, Retroperitoneal chapters", time: "~12 min", done: false },
  { id: "4", type: "read" as const, title: "Bladder Cancer: Non-Muscle Invasive", detail: "Campbell Ch. 59 — pre-reading", time: "~25 min", done: false },
];

const RECENT_ACTIVITY = [
  { action: "Completed QBank block", detail: "Adrenal Pathology", result: "82% (33/40)", time: "2h ago" },
  { action: "Reviewed 45 flashcards", detail: "Mixed chapters", result: "91% retention", time: "4h ago" },
  { action: "Read", detail: "Bladder Cancer Staging", result: "28 min", time: "Yesterday" },
];

// ─── Utility: Material Surface ────────────────────────

function MaterialSurface({
  children,
  material = "solid",
  z = 1,
  className = "",
  style = {},
}: {
  children: ReactNode;
  material?: "solid" | "regular" | "thick";
  z?: 1 | 2 | 3 | 4;
  className?: string;
  style?: React.CSSProperties;
}) {
  const zShadow = `var(--s-z${z})`;

  if (material === "solid") {
    return (
      <div
        className={className}
        style={{
          background: "hsl(var(--s-surface-raised))",
          border: "1px solid hsl(var(--s-border-hairline))",
          borderRadius: "var(--s-radius-md)",
          boxShadow: zShadow,
          position: "relative",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  const alpha = material === "regular" ? "var(--s-material-regular-alpha)" : "var(--s-material-thick-alpha)";
  const blur = material === "regular" ? "var(--s-material-regular-blur)" : "var(--s-material-thick-blur)";
  const sat = material === "regular" ? "var(--s-material-regular-sat)" : "var(--s-material-thick-sat)";

  return (
    <div
      className={className}
      style={{
        background: `hsl(var(--s-surface-raised) / ${alpha})`,
        backdropFilter: `blur(${blur}) saturate(${sat})`,
        WebkitBackdropFilter: `blur(${blur}) saturate(${sat})`,
        border: "1px solid hsl(var(--s-border-hairline) / 0.6)",
        borderRadius: "var(--s-radius-md)",
        boxShadow: zShadow,
        position: "relative",
        ...style,
      }}
    >
      {/* Noise grain overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          opacity: "var(--s-noise-opacity)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

// ─── Sync Indicator ───────────────────────────────────

function SyncIndicator({ status }: { status: SyncStatus }) {
  const config = {
    local: { color: "var(--s-signal-local)", icon: CloudUpload, label: "Local", pulse: false },
    syncing: { color: "var(--s-signal-syncing)", icon: Wifi, label: "Syncing", pulse: true },
    synced: { color: "var(--s-signal-synced)", icon: CheckCircle2, label: "Synced", pulse: false },
    offline: { color: "var(--s-signal-offline)", icon: WifiOff, label: "Offline", pulse: false },
  };
  const c = config[status];
  const Icon = c.icon;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "var(--s-radius-sm)",
        background: `hsl(${c.color} / 0.1)`,
        fontSize: 11,
        fontWeight: 500,
        color: `hsl(${c.color})`,
      }}
    >
      <Icon style={{
        width: 13,
        height: 13,
        ...(c.pulse ? { animation: "syncPulse 1.8s ease-in-out infinite" } : {}),
      }} />
      <span>{c.label}</span>
      <style>{`
        @keyframes syncPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// ─── Floating Command Bar ─────────────────────────────

function CommandBar({
  open,
  onClose,
  onNavigate,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (s: Surface) => void;
  onOpen: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const items = [
    { section: "Navigate", entries: [
      { label: "Today", sub: "Dashboard & daily plan", action: () => { onNavigate("today"); onClose(); } },
      { label: "Reader", sub: "Chapter reading view", action: () => { onNavigate("reader"); onClose(); } },
      { label: "QBank", sub: "Question practice", action: () => { onNavigate("qbank"); onClose(); } },
      { label: "Flashcards", sub: "Spaced repetition review" },
      { label: "Planner", sub: "Weekly study schedule" },
    ]},
    { section: "Recent", entries: [
      { label: "Renal Cell Carcinoma", sub: "Campbell Ch. 57" },
      { label: "Adrenal Pathology QBank", sub: "40 questions — 82%" },
      { label: "Bladder Cancer Staging", sub: "Campbell Ch. 59" },
    ]},
    { section: "Quick Actions", entries: [
      { label: "Start Exam Block", sub: "Configure a timed set" },
      { label: "Review Due Cards", sub: "23 cards ready" },
    ]},
  ];

  const filtered = query.trim()
    ? items.map(s => ({
        ...s,
        entries: s.entries.filter(e =>
          e.label.toLowerCase().includes(query.toLowerCase()) ||
          e.sub.toLowerCase().includes(query.toLowerCase())
        ),
      })).filter(s => s.entries.length > 0)
    : items;

  // Collapsed state (mini bar)
  if (!open) {
    return (
      <div style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
      }}>
        <MaterialSurface material="regular" z={2} style={{ borderRadius: "var(--s-radius-lg)" }}>
          <button
            onClick={onOpen}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 40,
              padding: "0 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              color: "hsl(var(--s-text-tertiary))",
            }}
          >
            <Search style={{ width: 15, height: 15 }} />
            <span style={{ minWidth: 140 }}>Search or jump to...</span>
            <kbd style={{
              fontSize: 11, fontWeight: 500,
              padding: "2px 6px",
              borderRadius: "var(--s-radius-xs)",
              background: "hsl(var(--s-surface-canvas) / 0.7)",
              border: "1px solid hsl(var(--s-border-hairline))",
              color: "hsl(var(--s-text-quaternary))",
              fontFamily: "inherit",
            }}>
              ⌘K
            </kbd>
          </button>
        </MaterialSurface>
      </div>
    );
  }

  // Expanded state (full palette)
  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "hsl(var(--s-surface-canvas) / 0.6)",
          backdropFilter: "blur(8px) saturate(1.5)",
          WebkitBackdropFilter: "blur(8px) saturate(1.5)",
          animation: "starshipFadeIn 180ms var(--s-ease)",
        }}
      />
      {/* Palette */}
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(580px, calc(100vw - 48px))",
          maxHeight: "min(500px, 72vh)",
          zIndex: 101,
          animation: "starshipExpand 220ms var(--s-ease)",
        }}
      >
        <MaterialSurface material="thick" z={3} style={{
          borderRadius: "var(--s-radius-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "14px 18px",
            borderBottom: "1px solid hsl(var(--s-border-hairline))",
          }}>
            <Search style={{ width: 16, height: 16, color: "hsl(var(--s-text-quaternary))", flexShrink: 0 }} />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search or jump to..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 15,
                color: "hsl(var(--s-text-primary))",
                fontFamily: "inherit",
              }}
            />
            <button
              onClick={onClose}
              style={{
                width: 24, height: 24,
                borderRadius: "var(--s-radius-xs)",
                border: "none",
                background: "hsl(var(--s-surface-canvas) / 0.5)",
                color: "hsl(var(--s-text-quaternary))",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>
          {/* Results */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {filtered.map(section => (
              <div key={section.section} style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  color: "hsl(var(--s-text-quaternary))",
                  padding: "6px 10px 4px",
                }}>
                  {section.section}
                </div>
                {section.entries.map(entry => (
                  <button
                    key={entry.label}
                    onClick={entry.action}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "10px 10px",
                      borderRadius: "var(--s-radius-sm)",
                      border: "none", background: "transparent",
                      cursor: "pointer", textAlign: "left",
                      fontFamily: "inherit",
                      transition: "background var(--s-duration-fast) var(--s-ease)",
                      minHeight: 44,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--s-surface-canvas) / 0.5)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "hsl(var(--s-text-primary))" }}>
                        {entry.label}
                      </div>
                      <div style={{ fontSize: 12, color: "hsl(var(--s-text-tertiary))", marginTop: 2 }}>
                        {entry.sub}
                      </div>
                    </div>
                    {entry.action && (
                      <ArrowRight style={{ width: 14, height: 14, color: "hsl(var(--s-text-quaternary))" }} />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {/* Footer hints */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "8px 18px",
            borderTop: "1px solid hsl(var(--s-border-hairline))",
            fontSize: 11, color: "hsl(var(--s-text-quaternary))",
          }}>
            <span><kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>↑↓</kbd> navigate</span>
            <span><kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>↵</kbd> open</span>
            <span><kbd style={{ fontFamily: "inherit", fontWeight: 600 }}>esc</kbd> close</span>
          </div>
        </MaterialSurface>
      </div>
      <style>{`
        @keyframes starshipFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes starshipExpand { from { opacity: 0; transform: translateX(-50%) scale(0.97); } to { opacity: 1; transform: translateX(-50%) scale(1); } }
      `}</style>
    </>
  );
}

// ─── Sheet Navigation ─────────────────────────────────

function SheetNav({
  open,
  onClose,
  activeSurface,
  onNavigate,
  syncStatus,
}: {
  open: boolean;
  onClose: () => void;
  activeSurface: Surface;
  onNavigate: (s: Surface) => void;
  syncStatus: SyncStatus;
}) {
  if (!open) return null;

  const navItems = [
    { surface: "today" as Surface, icon: LayoutDashboard, label: "Today", sub: "Daily plan & activity" },
    { surface: "reader" as Surface, icon: BookOpen, label: "Reader", sub: "Chapter reading" },
    { surface: "qbank" as Surface, icon: Brain, label: "QBank", sub: "Question practice" },
  ];

  const secondaryItems = [
    { icon: CreditCard, label: "Flashcards", sub: "23 cards due" },
    { icon: CalendarRange, label: "Planner", sub: "Weekly schedule" },
    { icon: Clock, label: "History", sub: "Past sessions" },
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 80,
          background: "hsl(var(--s-surface-canvas) / 0.4)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          animation: "starshipFadeIn 150ms var(--s-ease)",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          zIndex: 81,
          maxHeight: "70vh",
          animation: "sheetSlideUp var(--s-duration-sheet) var(--s-ease)",
        }}
      >
        <MaterialSurface material="thick" z={3} style={{
          borderRadius: "var(--s-radius-xl) var(--s-radius-xl) 0 0",
          padding: "12px 0 max(env(safe-area-inset-bottom, 0px), 20px)",
        }}>
          {/* Handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 16px" }}>
            <div style={{
              width: 36, height: 4,
              borderRadius: 2,
              background: "hsl(var(--s-border-structural))",
            }} />
          </div>

          {/* Nav sections */}
          <div style={{ padding: "0 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--s-text-quaternary))", padding: "0 8px 8px" }}>
              Surfaces
            </div>
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeSurface === item.surface;
              return (
                <button
                  key={item.surface}
                  onClick={() => { onNavigate(item.surface); onClose(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    width: "100%", padding: "14px 12px",
                    borderRadius: "var(--s-radius-md)",
                    border: "none",
                    background: isActive ? "hsl(var(--s-accent-muted))" : "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 52,
                    textAlign: "left",
                    transition: "background var(--s-duration-fast) var(--s-ease)",
                  }}
                >
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: "var(--s-radius-sm)",
                    background: isActive ? "hsl(var(--s-accent) / 0.12)" : "hsl(var(--s-surface-canvas))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon style={{ width: 18, height: 18, color: isActive ? "hsl(var(--s-accent))" : "hsl(var(--s-text-tertiary))" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: isActive ? 600 : 500, color: isActive ? "hsl(var(--s-accent))" : "hsl(var(--s-text-primary))" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(var(--s-text-tertiary))", marginTop: 1 }}>
                      {item.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: "hsl(var(--s-border-hairline))", margin: "12px 24px" }} />

          <div style={{ padding: "0 16px" }}>
            {secondaryItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    width: "100%", padding: "12px 12px",
                    borderRadius: "var(--s-radius-md)",
                    border: "none", background: "transparent",
                    cursor: "pointer", fontFamily: "inherit",
                    minHeight: 48, textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: "var(--s-radius-sm)",
                    background: "hsl(var(--s-surface-canvas))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon style={{ width: 18, height: 18, color: "hsl(var(--s-text-quaternary))" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "hsl(var(--s-text-secondary))" }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(var(--s-text-quaternary))", marginTop: 1 }}>
                      {item.sub}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sync status in sheet chrome */}
          <div style={{ padding: "12px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SyncIndicator status={syncStatus} />
            <span style={{ fontSize: 11, color: "hsl(var(--s-text-quaternary))" }}>PGlite + OPFS</span>
          </div>
        </MaterialSurface>
      </div>
      <style>{`
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ─── Today Surface ────────────────────────────────────

function TodaySurface({ syncStatus, isMobile }: { syncStatus: SyncStatus; isMobile: boolean }) {
  const [tasks, setTasks] = useState(TODAY_TASKS);
  const toggleTask = (id: string) =>
    setTasks(t => t.map(item => item.id === id ? { ...item, done: !item.done } : item));

  return (
    <div style={{ padding: "72px 24px 40px", maxWidth: 880, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "hsl(var(--s-text-tertiary))", marginBottom: 4 }}>
            Thursday, April 9
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, letterSpacing: "-0.025em",
            color: "hsl(var(--s-text-primary))", margin: 0,
          }}>
            Today
          </h1>
        </div>
        <SyncIndicator status={syncStatus} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* Task cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--s-text-quaternary))", marginBottom: 4, paddingLeft: 4 }}>
            Study Plan
          </div>
          {tasks.map((task, i) => {
            const typeIcon = task.type === "read" ? BookOpen : task.type === "qbank" ? Brain : CreditCard;
            const Icon = typeIcon;
            return (
              <MaterialSurface
                key={task.id}
                material={i === 0 ? "solid" : "solid"}
                z={i === 0 ? 2 : 1}
                style={{
                  borderRadius: "var(--s-radius-md)",
                  ...(i === 0 ? { borderColor: "hsl(var(--s-accent) / 0.2)" } : {}),
                  opacity: task.done ? 0.55 : 1,
                  transition: `opacity var(--s-duration-base) var(--s-ease)`,
                }}
              >
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "14px 16px",
                  cursor: "pointer",
                }}>
                  <button
                    onClick={() => toggleTask(task.id)}
                    style={{
                      width: 22, height: 22, marginTop: 1,
                      borderRadius: "50%",
                      border: task.done ? "none" : "2px solid hsl(var(--s-border-structural))",
                      background: task.done ? "hsl(var(--s-accent))" : "transparent",
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      transition: "all var(--s-duration-fast) var(--s-ease)",
                    }}
                  >
                    {task.done && <Check style={{ width: 13, height: 13, color: "hsl(var(--s-accent-fg))" }} />}
                  </button>
                  <Icon style={{ width: 17, height: 17, color: "hsl(var(--s-text-tertiary))", marginTop: 3, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500,
                      color: task.done ? "hsl(var(--s-text-tertiary))" : "hsl(var(--s-text-primary))",
                      textDecoration: task.done ? "line-through" : "none",
                      lineHeight: 1.35,
                    }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: "hsl(var(--s-text-tertiary))", marginTop: 3, lineHeight: 1.3 }}>
                      {task.detail}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, color: "hsl(var(--s-text-quaternary))",
                    whiteSpace: "nowrap", marginTop: 3,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {task.time}
                  </span>
                </div>
              </MaterialSurface>
            );
          })}
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Weekly summary */}
          <MaterialSurface material="solid" z={1}>
            <div style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--s-text-quaternary))", marginBottom: 14 }}>
                This Week
              </div>
              <div style={{ fontSize: 14, color: "hsl(var(--s-text-primary))", lineHeight: 1.75 }}>
                <span style={{ fontWeight: 600 }}>12.4 hours</span> studied
                <span style={{ color: "hsl(var(--s-text-quaternary))", margin: "0 6px" }}>&middot;</span>
                <span style={{ fontWeight: 600 }}>280</span> questions
              </div>
              <div style={{ fontSize: 14, color: "hsl(var(--s-text-primary))", lineHeight: 1.75 }}>
                <span style={{ fontWeight: 600, color: "hsl(var(--s-accent))" }}>89%</span> correct
                <span style={{ color: "hsl(var(--s-text-quaternary))", margin: "0 6px" }}>&middot;</span>
                <span style={{ fontWeight: 600 }}>47 day</span> streak
              </div>
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: "1px solid hsl(var(--s-border-hairline))",
                fontSize: 13, color: "hsl(var(--s-text-secondary))",
              }}>
                Retention: <span style={{ fontWeight: 600, color: "hsl(var(--s-accent))" }}>91%</span>
              </div>
            </div>
          </MaterialSurface>

          {/* Recent */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--s-text-quaternary))", marginBottom: 10, paddingLeft: 4 }}>
              Recent
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {RECENT_ACTIVITY.map((a, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                  padding: "0 4px",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "hsl(var(--s-text-primary))", lineHeight: 1.35 }}>
                      {a.action}: <span style={{ fontWeight: 500 }}>{a.detail}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "hsl(var(--s-text-tertiary))", marginTop: 1 }}>
                      {a.result}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "hsl(var(--s-text-quaternary))", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {a.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reader Surface ───────────────────────────────────

function ReaderSurface({ syncStatus, isMobile }: { syncStatus: SyncStatus; isMobile: boolean }) {
  const [activeTocId, setActiveTocId] = useState("epidemiology");

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", paddingTop: 56 }}>
      {/* TOC pane (material surface on the left) */}
      {!isMobile && <div style={{ width: 240, flexShrink: 0, padding: "0 8px", overflowY: "auto" }}>
        <MaterialSurface material="solid" z={1} style={{ borderRadius: "var(--s-radius-md)" }}>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(var(--s-text-quaternary))", marginBottom: 6 }}>
              Chapter 57
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "hsl(var(--s-text-primary))", lineHeight: 1.35, marginBottom: 16 }}>
              Renal Cell Carcinoma
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {RCC_CONTENT.toc.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTocId(item.id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: `5px ${item.level === 2 ? 20 : 8}px`,
                    borderRadius: "var(--s-radius-xs)",
                    border: "none",
                    background: activeTocId === item.id ? "hsl(var(--s-accent-muted))" : "transparent",
                    color: activeTocId === item.id ? "hsl(var(--s-accent))" : "hsl(var(--s-text-secondary))",
                    fontSize: item.level === 2 ? 12 : 13,
                    fontWeight: activeTocId === item.id ? 600 : 400,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    lineHeight: 1.45,
                    transition: "all var(--s-duration-fast) var(--s-ease)",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            {/* Sync in TOC */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid hsl(var(--s-border-hairline))" }}>
              <SyncIndicator status={syncStatus} />
            </div>
          </div>
        </MaterialSurface>
      </div>}

      {/* Content pane */}
      <div style={{
        flex: 1, overflowY: "auto",
        display: "flex", justifyContent: "center",
        background: "hsl(var(--s-reader-bg))",
        padding: "40px 32px",
        borderRadius: "var(--s-radius-lg) 0 0 0",
      }}>
        <article style={{
          maxWidth: "var(--s-reader-measure)",
          width: "100%",
          fontFamily: "var(--font-preview-serif), 'Source Serif 4', Georgia, serif",
          color: "hsl(var(--s-text-primary))",
        }}>
          <header style={{ marginBottom: 36 }}>
            <div style={{
              fontSize: 10, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "hsl(var(--s-text-quaternary))",
              fontFamily: "var(--font-preview-sans), Inter, sans-serif",
              marginBottom: 8,
            }}>
              Campbell-Walsh-Wein Urology &mdash; Chapter 57
            </div>
            <h1 style={{
              fontSize: 30, fontWeight: 700,
              letterSpacing: "-0.025em", lineHeight: 1.15,
              color: "hsl(var(--s-text-primary))",
              margin: "0 0 14px",
            }}>
              Renal Cell Carcinoma
            </h1>
            <div style={{
              display: "flex", gap: 16,
              fontSize: 12, color: "hsl(var(--s-text-tertiary))",
              fontFamily: "var(--font-preview-sans), Inter, sans-serif",
            }}>
              <span>Last reviewed: Apr 7, 2026</span>
              <SyncIndicator status="synced" />
            </div>
          </header>

          {RCC_CONTENT.sections.map(section => (
            <section key={section.id} style={{ marginBottom: 36 }}>
              <h2 style={{
                fontSize: 21, fontWeight: 650,
                letterSpacing: "-0.015em", lineHeight: 1.3,
                color: "hsl(var(--s-text-primary))",
                margin: "0 0 18px",
                paddingBottom: 10,
                borderBottom: "1px solid hsl(var(--s-border-hairline))",
              }}>
                {section.heading}
              </h2>
              {section.paragraphs.map((p, i) => (
                <p key={i} style={{
                  fontSize: 17,
                  lineHeight: "var(--s-reader-line-height)",
                  margin: "0 0 20px",
                  color: "hsl(var(--s-text-primary))",
                }}>
                  {i === 0 && section.id === "epidemiology" ? (
                    <>
                      Renal cell carcinoma (RCC) accounts for approximately{" "}
                      <mark style={{
                        background: "hsl(var(--s-reader-highlight))",
                        padding: "2px 3px",
                        borderRadius: 3,
                      }}>
                        3% of all adult malignancies and 90% of all kidney neoplasms
                      </mark>
                      . {p.slice(p.indexOf(". ") + 2)}
                    </>
                  ) : i === 2 && section.id === "etiology" ? (
                    <span style={{
                      borderLeft: "3px solid hsl(var(--s-warning))",
                      display: "block",
                      background: "hsl(var(--s-warning) / 0.06)",
                      borderRadius: "0 var(--s-radius-sm) var(--s-radius-sm) 0",
                      padding: "10px 14px",
                    }}>
                      {p}
                    </span>
                  ) : (
                    p
                  )}
                </p>
              ))}
            </section>
          ))}

          <div style={{
            marginTop: 44,
            padding: "18px 22px",
            borderRadius: "var(--s-radius-md)",
            border: "1px dashed hsl(var(--s-border-structural))",
            display: "flex", alignItems: "center", gap: 14,
            fontFamily: "var(--font-preview-sans), Inter, sans-serif",
            fontSize: 13, color: "hsl(var(--s-text-tertiary))",
          }}>
            <Pencil style={{ width: 16, height: 16 }} />
            Tap and hold to annotate — highlights and notes sync instantly via PGlite.
          </div>
        </article>
      </div>
    </div>
  );
}

// ─── QBank Surface ────────────────────────────────────

function QBankSurface({ syncStatus, isMobile }: { syncStatus: SyncStatus; isMobile: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [labPanelOpen, setLabPanelOpen] = useState(true);

  const handleSubmit = () => {
    if (!selected) return;
    setSubmitted(true);
    setShowExplanation(true);
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", paddingTop: 56 }}>
      {/* Question area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: "hsl(var(--s-accent))",
            }}>
              Q{QUESTION.number} / {QUESTION.total}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 500,
              padding: "3px 10px",
              borderRadius: "var(--s-radius-sm)",
              background: "hsl(var(--s-surface-canvas))",
              color: "hsl(var(--s-text-tertiary))",
              border: "1px solid hsl(var(--s-border-hairline))",
            }}>
              GU Oncology
            </span>
            <SyncIndicator status="local" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setFlagged(!flagged)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36,
                borderRadius: "var(--s-radius-sm)",
                border: "1px solid hsl(var(--s-border-hairline))",
                background: flagged ? "hsl(var(--s-warning) / 0.1)" : "transparent",
                cursor: "pointer",
                color: flagged ? "hsl(var(--s-warning))" : "hsl(var(--s-text-quaternary))",
                transition: "all var(--s-duration-fast) var(--s-ease)",
              }}
            >
              <Flag style={{ width: 15, height: 15 }} />
            </button>
            <button
              onClick={() => setLabPanelOpen(!labPanelOpen)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36,
                borderRadius: "var(--s-radius-sm)",
                border: "1px solid hsl(var(--s-border-hairline))",
                background: "transparent",
                cursor: "pointer",
                color: "hsl(var(--s-text-quaternary))",
              }}
            >
              <FlaskConical style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>

        {/* Stem */}
        <div style={{
          maxWidth: "var(--s-reader-measure)",
          fontFamily: "var(--font-preview-serif), 'Source Serif 4', Georgia, serif",
          fontSize: 16.5, lineHeight: 1.65,
          color: "hsl(var(--s-text-primary))",
          marginBottom: 24,
        }}>
          <p style={{ margin: "0 0 14px" }}>{QUESTION.stem}</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{QUESTION.question}</p>
        </div>

        {/* Options */}
        <div style={{ maxWidth: "var(--s-reader-measure)", display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
          {QUESTION.options.map(opt => {
            const isSelected = selected === opt.letter;
            const isCorrect = opt.letter === QUESTION.correct;
            const showResult = submitted;
            let borderColor = "hsl(var(--s-border-structural))";
            let bg = "hsl(var(--s-surface-raised))";

            if (showResult && isCorrect) {
              borderColor = "hsl(var(--s-success))";
              bg = "hsl(var(--s-success) / 0.06)";
            } else if (showResult && isSelected && !isCorrect) {
              borderColor = "hsl(var(--s-error))";
              bg = "hsl(var(--s-error) / 0.06)";
            } else if (isSelected && !showResult) {
              borderColor = "hsl(var(--s-accent))";
              bg = "hsl(var(--s-accent-muted))";
            }

            return (
              <button
                key={opt.letter}
                onClick={() => !submitted && setSelected(opt.letter)}
                disabled={submitted}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 14,
                  padding: "14px 18px",
                  borderRadius: "var(--s-radius-md)",
                  border: `1.5px solid ${borderColor}`,
                  background: bg,
                  boxShadow: isSelected && !showResult ? "var(--s-z1)" : "none",
                  cursor: submitted ? "default" : "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all var(--s-duration-fast) var(--s-ease)",
                  minHeight: 48,
                }}
              >
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  fontFamily: "var(--font-preview-sans), Inter, sans-serif",
                  color: showResult && isCorrect
                    ? "hsl(var(--s-success))"
                    : showResult && isSelected && !isCorrect
                      ? "hsl(var(--s-error))"
                      : isSelected
                        ? "hsl(var(--s-accent))"
                        : "hsl(var(--s-text-tertiary))",
                  width: 22, flexShrink: 0, marginTop: 2,
                }}>
                  {opt.letter}.
                </span>
                <span style={{ fontSize: 15, lineHeight: 1.5, color: "hsl(var(--s-text-primary))" }}>
                  {opt.text}
                </span>
                {showResult && isCorrect && (
                  <Check style={{ width: 17, height: 17, color: "hsl(var(--s-success))", flexShrink: 0, marginTop: 3, marginLeft: "auto" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Submit */}
        {!submitted ? (
          <button
            onClick={handleSubmit}
            disabled={!selected}
            style={{
              height: 48,
              padding: "0 32px",
              borderRadius: "var(--s-radius-md)",
              border: "none",
              background: selected ? "hsl(var(--s-accent))" : "hsl(var(--s-border-hairline))",
              color: selected ? "hsl(var(--s-accent-fg))" : "hsl(var(--s-text-quaternary))",
              fontSize: 14, fontWeight: 600,
              fontFamily: "var(--font-preview-sans), Inter, sans-serif",
              cursor: selected ? "pointer" : "not-allowed",
              boxShadow: selected ? "var(--s-z1)" : "none",
              transition: "all var(--s-duration-base) var(--s-ease)",
            }}
          >
            Submit Answer
          </button>
        ) : (
          <MaterialSurface material="solid" z={1} style={{ maxWidth: "var(--s-reader-measure)" }}>
            <div style={{ padding: 20 }}>
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-preview-sans), Inter, sans-serif",
                  fontSize: 14, fontWeight: 600,
                  color: "hsl(var(--s-text-primary))",
                }}
              >
                {showExplanation ? <ChevronDown style={{ width: 16, height: 16 }} /> : <ChevronRight style={{ width: 16, height: 16 }} />}
                Explanation
              </button>
              {showExplanation && (
                <div style={{
                  marginTop: 14,
                  fontFamily: "var(--font-preview-serif), 'Source Serif 4', Georgia, serif",
                  fontSize: 15.5, lineHeight: 1.65,
                  color: "hsl(var(--s-text-secondary))",
                }}>
                  {QUESTION.explanation}
                </div>
              )}
            </div>
          </MaterialSurface>
        )}

        {/* Question nav */}
        <div style={{ marginTop: 28, display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Array.from({ length: QUESTION.total }, (_, i) => {
            const n = i + 1;
            const isCurrent = n === QUESTION.number;
            const isAnswered = n < QUESTION.number;
            return (
              <button
                key={n}
                style={{
                  width: 30, height: 30,
                  borderRadius: "var(--s-radius-sm)",
                  border: isCurrent ? "1.5px solid hsl(var(--s-accent))" : "1px solid hsl(var(--s-border-hairline))",
                  background: isCurrent
                    ? "hsl(var(--s-accent-muted))"
                    : isAnswered
                      ? "hsl(var(--s-surface-panel))"
                      : "hsl(var(--s-surface-raised))",
                  fontSize: 11, fontWeight: 500,
                  color: isCurrent
                    ? "hsl(var(--s-accent))"
                    : isAnswered
                      ? "hsl(var(--s-text-secondary))"
                      : "hsl(var(--s-text-quaternary))",
                  fontFamily: "var(--font-preview-sans), Inter, sans-serif",
                  cursor: "pointer",
                  boxShadow: isCurrent ? "var(--s-z1)" : "none",
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lab values floating panel */}
      {labPanelOpen && !isMobile && (
        <div style={{
          width: 280, flexShrink: 0,
          padding: "0 8px 8px 0",
          overflowY: "auto",
        }}>
          <MaterialSurface material="regular" z={2} style={{ borderRadius: "var(--s-radius-md)" }}>
            <div style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FlaskConical style={{ width: 14, height: 14, color: "hsl(var(--s-text-tertiary))" }} />
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    color: "hsl(var(--s-text-quaternary))",
                  }}>
                    Lab Values
                  </span>
                </div>
                <button
                  onClick={() => setLabPanelOpen(false)}
                  style={{
                    width: 22, height: 22,
                    borderRadius: "var(--s-radius-xs)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "hsl(var(--s-text-quaternary))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--font-preview-sans), Inter, sans-serif" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid hsl(var(--s-border-structural))" }}>
                    <th style={{ textAlign: "left", padding: "0 0 8px", fontWeight: 600, fontSize: 11, color: "hsl(var(--s-text-tertiary))" }}>Test</th>
                    <th style={{ textAlign: "right", padding: "0 0 8px", fontWeight: 600, fontSize: 11, color: "hsl(var(--s-text-tertiary))" }}>Value</th>
                    <th style={{ textAlign: "right", padding: "0 0 8px", fontWeight: 600, fontSize: 11, color: "hsl(var(--s-text-tertiary))" }}>Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {QUESTION.labValues.map(lab => (
                    <tr key={lab.name} style={{ borderBottom: "1px solid hsl(var(--s-border-hairline))" }}>
                      <td style={{ padding: "9px 0", color: "hsl(var(--s-text-secondary))" }}>{lab.name}</td>
                      <td style={{
                        padding: "9px 0", textAlign: "right",
                        fontWeight: 600, fontVariantNumeric: "tabular-nums",
                        color: lab.status === "high"
                          ? "hsl(var(--s-error))"
                          : lab.status === "low"
                            ? "hsl(var(--s-warning))"
                            : "hsl(var(--s-text-primary))",
                      }}>
                        {lab.value}
                        {lab.status !== "normal" && (
                          <span style={{ fontSize: 10, marginLeft: 4 }}>
                            {lab.status === "high" ? "↑" : "↓"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "9px 0", textAlign: "right", color: "hsl(var(--s-text-quaternary))", fontSize: 12 }}>
                        {lab.ref}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MaterialSurface>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

export default function StarshipPreviewPage() {
  const [surface, setSurface] = useState<Surface>("today");
  const [commandOpen, setCommandOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [syncStatus] = useState<SyncStatus>("synced");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const navigateTo = useCallback((s: Surface) => {
    setSurface(s);
  }, []);

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      background: "hsl(var(--s-surface-canvas))",
      color: "hsl(var(--s-text-primary))",
      fontFamily: "var(--font-preview-sans), Inter, system-ui, sans-serif",
      position: "relative",
    }}>
      {/* ── Bottom chrome bar ── */}
      <div style={{
        position: "fixed",
        bottom: 0, left: 0, right: 0,
        zIndex: 40,
        padding: "0 0 max(env(safe-area-inset-bottom, 0px), 8px)",
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          margin: "0 12px",
          borderRadius: "var(--s-radius-lg)",
          background: "hsl(var(--s-surface-raised) / 0.85)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
          border: "1px solid hsl(var(--s-border-hairline) / 0.6)",
          boxShadow: "var(--s-z2)",
        }}>
          {/* Nav tabs */}
          <div style={{ display: "flex", gap: 2 }}>
            {([
              { s: "today" as Surface, icon: LayoutDashboard, label: "Today" },
              { s: "reader" as Surface, icon: BookOpen, label: "Reader" },
              { s: "qbank" as Surface, icon: Brain, label: "QBank" },
            ] as const).map(item => {
              const Icon = item.icon;
              const isActive = surface === item.s;
              return (
                <button
                  key={item.s}
                  onClick={() => setSurface(item.s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    height: 40, padding: "0 14px",
                    borderRadius: "var(--s-radius-sm)",
                    border: "none",
                    background: isActive ? "hsl(var(--s-accent-muted))" : "transparent",
                    color: isActive ? "hsl(var(--s-accent))" : "hsl(var(--s-text-tertiary))",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 13, fontWeight: isActive ? 600 : 500,
                    transition: "all var(--s-duration-fast) var(--s-ease)",
                  }}
                >
                  <Icon style={{ width: 17, height: 17 }} />
                  {item.label}
                </button>
              );
            })}
          </div>
          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SyncIndicator status={syncStatus} />
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title="Toggle theme"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 36, height: 36,
                  borderRadius: "var(--s-radius-sm)",
                  border: "none",
                  background: "transparent",
                  color: "hsl(var(--s-text-tertiary))",
                  cursor: "pointer",
                }}
              >
                {theme === "dark" ? <Sun style={{ width: 16, height: 16 }} /> : <Moon style={{ width: 16, height: 16 }} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <main style={{ flex: 1, overflow: "hidden" }}>
        {surface === "today" && <TodaySurface syncStatus={syncStatus} isMobile={isMobile} />}
        {surface === "reader" && <ReaderSurface syncStatus={syncStatus} isMobile={isMobile} />}
        {surface === "qbank" && <QBankSurface syncStatus={syncStatus} isMobile={isMobile} />}
      </main>

      {/* ── Floating Command Bar ── */}
      <CommandBar
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={navigateTo}
        onOpen={() => setCommandOpen(true)}
      />

      {/* ── Sheet Nav ── */}
      <SheetNav
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        activeSurface={surface}
        onNavigate={navigateTo}
        syncStatus={syncStatus}
      />
    </div>
  );
}
