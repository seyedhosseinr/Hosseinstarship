"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import {
  BookOpen, Brain, LayoutDashboard,
  CalendarRange, Clock, CreditCard,
  Search, X, Moon, Sun, Menu,
  Timer, PanelLeftClose, Bookmark,
  Check, Maximize2,
} from "lucide-react";
import {
  DICTIONARY, TOC, SECTIONS, QUESTION, TODAY_TASKS,
  SAMPLE_ANNOTATIONS, type ContentBlock,
} from "./content";

/* ═══════════════════════════════════════════════════════
   CLINICAL INTELLIGENCE OS
   Bilingual · Reading-first · Keyboard-primary · Local-first
   ═══════════════════════════════════════════════════════ */

type Surface = "today" | "reader" | "qbank";
type Density = "compact" | "comfortable" | "spacious";
type SyncStatus = "local" | "writing" | "syncing" | "synced";

interface SessionState {
  active: boolean;
  startTime: number | null;
  targetMinutes: number;
  blocksRead: number;
  blocksTotal: number;
}

const DENSITY_VALUES: Record<Density, number> = { compact: 0.9, comfortable: 1, spacious: 1.1 };
const DENSITY_ORDER: Density[] = ["compact", "comfortable", "spacious"];
const DENSITY_LABELS: Record<Density, string> = { compact: "\u0641\u0634\u0631\u062F\u0647", comfortable: "\u0639\u0627\u062F\u06CC", spacious: "\u06AF\u0634\u0627\u062F\u0647" };
const ALL_BLOCK_IDS = SECTIONS.flatMap(s => s.blocks.map(b => b.id));
const ANNOTATION_MAP = new Map(SAMPLE_ANNOTATIONS.map(a => [a.blockId, a]));

const NAV: { surface: Surface; icon: typeof BookOpen; label: string }[] = [
  { surface: "today", icon: LayoutDashboard, label: "\u0627\u0645\u0631\u0648\u0632" },
  { surface: "reader", icon: BookOpen, label: "\u062E\u0648\u0627\u0646\u062F\u0646" },
  { surface: "qbank", icon: Brain, label: "\u0628\u0627\u0646\u06A9 \u0633\u0624\u0627\u0644" },
];
const SECONDARY_NAV = [
  { icon: CreditCard, label: "\u0641\u0644\u0634\u200C\u06A9\u0627\u0631\u062A" },
  { icon: CalendarRange, label: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632" },
  { icon: Clock, label: "\u062A\u0627\u0631\u06CC\u062E\u0686\u0647" },
];

// ─── Hooks ───────────────────────────────────────────

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setM(mq.matches);
    const h = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return m;
}

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── renderContent ───────────────────────────────────

function renderContent(
  content: ContentBlock["content"],
  onHover?: (key: string, rect: DOMRect) => void,
  onLeave?: () => void,
) {
  return content.map((part, i) => {
    if (typeof part === "string") return <span key={i}>{part}</span>;
    const def = DICTIONARY[part.term];
    return (
      <bdi
        key={i}
        className="medical-term"
        data-abbr={def?.abbr ? "" : undefined}
        onMouseEnter={e => onHover?.(part.term, e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => onLeave?.()}
      >
        {def?.abbr || def?.en || part.term}
      </bdi>
    );
  });
}

// ─── CrossRefPeek ────────────────────────────────────

function CrossRefPeek({ termKey, rect }: { termKey: string; rect: DOMRect }) {
  const def = DICTIONARY[termKey];
  if (!def) return null;
  const left = Math.max(16, Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 1200) - 336));
  return (
    <div style={{
      position: "fixed", top: rect.bottom + 8, left, width: 320,
      maxWidth: "calc(100vw - 32px)", zIndex: 60,
      background: "hsl(var(--c-surface-overlay))",
      border: "1px solid hsl(var(--c-border-structural))",
      borderRadius: "var(--c-radius-lg)",
      boxShadow: "var(--c-shadow-lg)",
      padding: "12px 16px",
      animation: "fadeIn 120ms ease-out",
    }}>
      <div style={{ fontFamily: "var(--c-font-latin-prose)", fontWeight: 600, fontSize: "var(--c-text-body)", color: "hsl(var(--c-text-primary))", marginBottom: 4, direction: "ltr", textAlign: "left" }}>
        {def.en}
      </div>
      <div style={{ color: "hsl(var(--c-text-secondary))", fontSize: "var(--c-text-caption)", marginBottom: 8 }}>
        {def.fa}
      </div>
      <div style={{ color: "hsl(var(--c-text-tertiary))", fontSize: "var(--c-text-caption)", lineHeight: 1.7 }}>
        {def.definition}
      </div>
    </div>
  );
}

// ─── SyncStatusBadge ─────────────────────────────────

const SYNC_CONFIG: Record<SyncStatus, { color: string; label: string; pulse: boolean }> = {
  local:   { color: "var(--c-sync-local)",   label: "\u0645\u062D\u0644\u06CC",          pulse: false },
  writing: { color: "var(--c-sync-writing)",  label: "\u0646\u0648\u0634\u062A\u0646",        pulse: true },
  syncing: { color: "var(--c-sync-syncing)",  label: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC", pulse: true },
  synced:  { color: "var(--c-sync-synced)",   label: "\u0647\u0645\u06AF\u0627\u0645",        pulse: false },
};

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const c = SYNC_CONFIG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: "var(--c-text-caption)", fontWeight: 500,
      color: `hsl(${c.color})`, fontFamily: "var(--c-font-persian)",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: `hsl(${c.color})`,
        ...(c.pulse ? { animation: "pulse 1.5s ease-in-out infinite" } : {}),
      }} />
      {c.label}
    </span>
  );
}

// ─── SessionInfo ─────────────────────────────────────

function SessionInfo({ session, elapsed, onToggle }: { session: SessionState; elapsed: number; onToggle: () => void }) {
  if (!session.active) {
    return (
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", background: "hsl(var(--c-accent-muted))",
        color: "hsl(var(--c-accent))", border: "none",
        borderRadius: "var(--c-radius-sm)", fontSize: "var(--c-text-caption)",
        fontFamily: "var(--c-font-persian)", fontWeight: 500, cursor: "pointer",
      }}>
        <Timer size={12} />
        {"\u0634\u0631\u0648\u0639 \u062C\u0644\u0633\u0647"}
      </button>
    );
  }
  const progress = Math.min(1, elapsed / (session.targetMinutes * 60));
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--c-text-caption)", fontFamily: "var(--c-font-mono)", color: "hsl(var(--c-session-active))" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: `conic-gradient(hsl(var(--c-session-active)) ${progress * 360}deg, hsl(var(--c-border-hairline)) 0deg)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "hsl(var(--c-surface-panel))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, fontWeight: 700,
        }}>
          {session.blocksRead}
        </div>
      </div>
      <span>{fmt(elapsed)}</span>
      <span style={{ color: "hsl(var(--c-text-quaternary))", fontSize: 10 }}>/ {session.targetMinutes}m</span>
      <button onClick={onToggle} style={{ background: "none", border: "none", color: "hsl(var(--c-text-tertiary))", cursor: "pointer", padding: 2 }}>
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Breadcrumbs ─────────────────────────────────────

function Breadcrumbs({ section }: { section: string }) {
  const entry = TOC.find(t => t.id === section);
  const parent = entry?.level === 2
    ? [...TOC].reverse().find(t => t.level === 1 && TOC.indexOf(t) < TOC.indexOf(entry!))
    : null;
  const sep = <span style={{ opacity: 0.3, margin: "0 2px" }}>/</span>;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      fontSize: "var(--c-text-caption)", color: "hsl(var(--c-text-tertiary))",
      fontFamily: "var(--c-font-persian)", overflow: "hidden", whiteSpace: "nowrap",
    }}>
      <span style={{ color: "hsl(var(--c-text-quaternary))" }}>{"\u06A9\u0645\u067E\u0628\u0644 \u0641\u0635\u0644 \u06F5\u06F7"}</span>
      {parent && <>{sep}<span>{parent.label}</span></>}
      {entry && <>{sep}<span style={{ color: "hsl(var(--c-text-primary))", fontWeight: 500 }}>{entry.label}</span></>}
    </div>
  );
}

// ─── NavigationRail ──────────────────────────────────

function NavigationRail({
  surface, onSurface, collapsed, onToggle, syncStatus, isMobile, isDark, onToggleTheme,
}: {
  surface: Surface; onSurface: (s: Surface) => void;
  collapsed: boolean; onToggle: () => void;
  syncStatus: SyncStatus; isMobile: boolean;
  isDark: boolean; onToggleTheme: () => void;
}) {
  if (isMobile) return null;
  const w = collapsed ? "var(--c-rail-collapsed)" : "var(--c-rail-expanded)";
  const px = collapsed ? "0 14px" : "0 20px";
  return (
    <nav style={{
      width: w, flexShrink: 0, height: "100dvh",
      background: "hsl(var(--c-surface-panel))",
      borderInlineEnd: "1px solid hsl(var(--c-border-hairline))",
      display: "flex", flexDirection: "column",
      transition: "width var(--c-duration-slow) var(--c-ease)",
      overflow: "hidden",
    }}>
      <div style={{ padding: `16px ${collapsed ? "14px" : "20px"}`, display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && <span style={{ fontFamily: "var(--c-font-ui)", fontWeight: 600, fontSize: "var(--c-text-h4)", color: "hsl(var(--c-text-primary))", whiteSpace: "nowrap" }}>Clinical OS</span>}
        <button onClick={onToggle} style={{ background: "none", border: "none", color: "hsl(var(--c-text-tertiary))", cursor: "pointer", padding: 4 }}>
          <PanelLeftClose size={16} style={{ transform: collapsed ? "scaleX(-1)" : "none" }} />
        </button>
      </div>

      <div style={{ padding: "4px 8px", flex: 1 }}>
        {NAV.map(item => {
          const Icon = item.icon;
          const active = surface === item.surface;
          return (
            <button key={item.surface} onClick={() => onSurface(item.surface)} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: collapsed ? "10px 0" : "8px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              background: active ? "hsl(var(--c-accent-muted))" : "transparent",
              color: active ? "hsl(var(--c-accent))" : "hsl(var(--c-text-secondary))",
              border: "none", borderRadius: "var(--c-radius-sm)", cursor: "pointer",
              fontSize: "var(--c-text-caption)", fontFamily: "var(--c-font-persian)",
              fontWeight: active ? 500 : 400, whiteSpace: "nowrap", marginBottom: 2,
            }}>
              <Icon size={18} />
              {!collapsed && item.label}
            </button>
          );
        })}
        <div style={{ height: 1, background: "hsl(var(--c-border-hairline))", margin: "8px 4px" }} />
        {SECONDARY_NAV.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: collapsed ? "10px 0" : "8px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              background: "transparent", color: "hsl(var(--c-text-tertiary))",
              border: "none", borderRadius: "var(--c-radius-sm)", cursor: "pointer",
              fontSize: "var(--c-text-caption)", fontFamily: "var(--c-font-persian)",
              whiteSpace: "nowrap", marginBottom: 2,
            }}>
              <Icon size={18} />
              {!collapsed && item.label}
            </button>
          );
        })}
      </div>

      <div style={{
        padding: collapsed ? "12px 0" : "12px 16px",
        borderTop: "1px solid hsl(var(--c-border-hairline))",
        display: "flex", flexDirection: "column",
        alignItems: collapsed ? "center" : "flex-start", gap: 8,
      }}>
        <SyncStatusBadge status={syncStatus} />
        <button onClick={onToggleTheme} style={{
          background: "none", border: "none",
          color: "hsl(var(--c-text-quaternary))", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, padding: 0,
          fontSize: 11, fontFamily: "var(--c-font-persian)",
        }}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {!collapsed && (isDark ? "\u062D\u0627\u0644\u062A \u0631\u0648\u0634\u0646" : "\u062D\u0627\u0644\u062A \u062A\u06CC\u0631\u0647")}
        </button>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "hsl(var(--c-text-quaternary))", fontSize: 11 }}>
            <kbd style={{ fontFamily: "var(--c-font-mono)", fontSize: 10, padding: "1px 4px", background: "hsl(var(--c-surface-canvas))", borderRadius: 2 }}>{"\u2318K"}</kbd>
            <span>{"\u062C\u0633\u062A\u062C\u0648"}</span>
          </div>
        )}
      </div>
    </nav>
  );
}

// ─── CommandPalette ──────────────────────────────────

function CommandPalette({
  onClose, onNavigate, onToggleSession, sessionActive, onToggleTheme,
}: {
  onClose: () => void;
  onNavigate: (s: Surface) => void;
  onToggleSession: () => void;
  sessionActive: boolean;
  onToggleTheme: () => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const items = [
    { section: "\u0646\u0627\u0648\u0628\u0631\u06CC", entries: [
      { label: "\u0627\u0645\u0631\u0648\u0632", hint: "\u2318\u06F1", action: () => { onNavigate("today"); onClose(); } },
      { label: "\u062E\u0648\u0627\u0646\u062F\u0646", hint: "\u2318\u06F2", action: () => { onNavigate("reader"); onClose(); } },
      { label: "\u0628\u0627\u0646\u06A9 \u0633\u0624\u0627\u0644", hint: "\u2318\u06F3", action: () => { onNavigate("qbank"); onClose(); } },
    ]},
    { section: "\u062C\u0644\u0633\u0647", entries: [
      { label: sessionActive ? "\u067E\u0627\u06CC\u0627\u0646 \u062C\u0644\u0633\u0647" : "\u0634\u0631\u0648\u0639 \u062C\u0644\u0633\u0647", hint: "", action: () => { onToggleSession(); onClose(); } },
    ]},
    { section: "\u0639\u0645\u0644\u06CC\u0627\u062A", entries: [
      { label: "\u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC", hint: "\u2318\\", action: onClose },
      { label: "\u062D\u0627\u0644\u062A \u062A\u0645\u0631\u06A9\u0632", hint: "\u2325F", action: onClose },
      { label: "\u0641\u0634\u0631\u062F\u0647\u200C\u062A\u0631", hint: "\u2318[", action: onClose },
      { label: "\u06AF\u0634\u0627\u062F\u0647\u200C\u062A\u0631", hint: "\u2318]", action: onClose },
      { label: "\u0646\u0634\u0627\u0646\u0647\u200C\u06AF\u0630\u0627\u0631\u06CC", hint: "\u2318B", action: onClose },
      { label: "\u062A\u063A\u06CC\u06CC\u0631 \u062A\u0645", hint: "", action: () => { onToggleTheme(); onClose(); } },
    ]},
  ];

  const filtered = query.trim()
    ? items.map(s => ({ ...s, entries: s.entries.filter(e => e.label.includes(query)) })).filter(s => s.entries.length > 0)
    : items;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", animation: "fadeIn 120ms ease-out" }} />
      <div style={{
        position: "fixed", top: "min(20%, 120px)", left: "50%", transform: "translateX(-50%)",
        width: "min(520px, calc(100vw - 48px))", maxHeight: "min(420px, 70vh)", zIndex: 101,
        background: "hsl(var(--c-surface-overlay))",
        border: "1px solid hsl(var(--c-border-structural))",
        borderRadius: "var(--c-radius-lg)", boxShadow: "var(--c-shadow-overlay)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "slideUp 150ms var(--c-ease)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid hsl(var(--c-border-hairline))" }}>
          <Search style={{ width: 16, height: 16, color: "hsl(var(--c-text-quaternary))", flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={"\u062C\u0633\u062A\u062C\u0648 \u06CC\u0627 \u067E\u0631\u0634 \u0628\u0647\u2026"}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 14, color: "hsl(var(--c-text-primary))",
              fontFamily: "var(--c-font-persian)", direction: "rtl",
            }}
          />
          <kbd style={{ fontSize: 10, fontFamily: "var(--c-font-mono)", padding: "2px 6px", background: "hsl(var(--c-surface-canvas))", borderRadius: 3, color: "hsl(var(--c-text-quaternary))" }}>Esc</kbd>
        </div>
        <div style={{ overflow: "auto", padding: "8px 0" }}>
          {filtered.map(sec => (
            <div key={sec.section}>
              <div style={{ padding: "4px 16px", fontSize: 10, fontWeight: 600, color: "hsl(var(--c-text-quaternary))", fontFamily: "var(--c-font-ui)", letterSpacing: "0.05em" }}>{sec.section}</div>
              {sec.entries.map(entry => (
                <button key={entry.label} onClick={entry.action} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "8px 16px", background: "transparent",
                  border: "none", cursor: "pointer", fontSize: "var(--c-text-caption)",
                  color: "hsl(var(--c-text-secondary))", fontFamily: "var(--c-font-persian)",
                  textAlign: "start",
                }}>
                  <span>{entry.label}</span>
                  {entry.hint && <kbd style={{ fontSize: 10, fontFamily: "var(--c-font-mono)", color: "hsl(var(--c-text-quaternary))", padding: "1px 5px", background: "hsl(var(--c-surface-canvas))", borderRadius: 2 }}>{entry.hint}</kbd>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── MobileTocDrawer ─────────────────────────────────

function MobileTocDrawer({ onClose, activeSection }: { onClose: () => void; activeSection: string }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.3)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 280, zIndex: 91,
        background: "hsl(var(--c-surface-panel))",
        borderInlineEnd: "1px solid hsl(var(--c-border-structural))",
        padding: 16, overflow: "auto",
        animation: "slideInRight 200ms var(--c-ease)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontWeight: 600, fontSize: 14, fontFamily: "var(--c-font-persian)" }}>{"\u0641\u0647\u0631\u0633\u062A \u0645\u0637\u0627\u0644\u0628"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--c-text-tertiary))" }}><X size={16} /></button>
        </div>
        {TOC.map(entry => (
          <button key={entry.id} onClick={() => { document.getElementById(`section-${entry.id}`)?.scrollIntoView({ behavior: "smooth" }); onClose(); }} style={{
            display: "block", width: "100%", textAlign: "start",
            padding: `4px ${entry.level === 2 ? 24 : 8}px`,
            background: entry.id === activeSection ? "hsl(var(--c-accent-muted))" : "transparent",
            color: entry.id === activeSection ? "hsl(var(--c-accent))" : "hsl(var(--c-text-secondary))",
            border: "none", borderRadius: 2, cursor: "pointer",
            fontSize: "var(--c-text-caption)", lineHeight: 1.8, marginBottom: 1,
            fontFamily: "var(--c-font-persian)",
          }}>
            {entry.label}
          </button>
        ))}
      </div>
    </>
  );
}

// ─── TodaySurface ────────────────────────────────────

function TodaySurface() {
  return (
    <div style={{ overflow: "auto", height: "100%", padding: "calc(1.5rem * var(--c-reading-density))" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{
          fontSize: "var(--c-text-h1)", fontFamily: "var(--c-font-persian)",
          fontWeight: 700, color: "hsl(var(--c-text-primary))", marginBottom: 4,
        }}>
          {"\u0633\u0644\u0627\u0645\u060C \u062D\u0633\u06CC\u0646 \u{1F44B}"}
        </h1>
        <p style={{ fontSize: "var(--c-text-caption)", color: "hsl(var(--c-text-tertiary))", marginBottom: "calc(1.5rem * var(--c-reading-density))" }}>
          {"\u06F4 \u0645\u0648\u0631\u062F \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0634\u062F\u0647 \u0627\u0633\u062A \u00B7 \u062A\u062E\u0645\u06CC\u0646 \u06F2 \u0633\u0627\u0639\u062A \u0648 \u06F1\u06F2 \u062F\u0642\u06CC\u0642\u0647"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "calc(6px * var(--c-reading-density))" }}>
          {TODAY_TASKS.map(task => (
            <div key={task.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "calc(10px * var(--c-reading-density)) 14px",
              background: "hsl(var(--c-surface-raised))",
              borderRadius: "var(--c-radius-sm)",
              border: "1px solid hsl(var(--c-border-hairline))",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                border: task.done ? "none" : "1.5px solid hsl(var(--c-border-structural))",
                background: task.done ? "hsl(var(--c-success))" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {task.done && <Check size={12} color="white" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--c-text-body)", fontWeight: 500, color: "hsl(var(--c-text-primary))", fontFamily: "var(--c-font-persian)" }}>
                  {task.title}
                </div>
                <div style={{ fontSize: "var(--c-text-caption)", color: "hsl(var(--c-text-tertiary))", fontFamily: "var(--c-font-persian)" }}>
                  {task.detail}
                </div>
              </div>
              <span style={{
                fontSize: "var(--c-text-caption)", color: "hsl(var(--c-text-quaternary))",
                fontFamily: "var(--c-font-mono)", whiteSpace: "nowrap",
              }}>
                {task.time}
              </span>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: `hsl(var(${task.type === "read" ? "--c-accent" : task.type === "qbank" ? "--c-warning" : "--c-success"}))`,
              }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ReaderSurface ───────────────────────────────────

function ReaderSurface({
  isMobile, focusBlockIdx, onFocusBlock,
  onScroll, activeSection, onActiveSection,
  onTermHover, onTermLeave, onTocToggle, bookmarks,
}: {
  isMobile: boolean;
  focusBlockIdx: number | null;
  onFocusBlock: (idx: number | null) => void;
  onScroll: (p: number) => void;
  activeSection: string;
  onActiveSection: (id: string) => void;
  onTermHover: (key: string, rect: DOMRect) => void;
  onTermLeave: () => void;
  onTocToggle: () => void;
  bookmarks: Set<string>;
}) {
  const readerRef = useRef<HTMLDivElement>(null);
  const hasFocus = focusBlockIdx !== null;

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const sid = e.target.getAttribute("data-section");
          if (sid) onActiveSection(sid);
        }
      }
    }, { root: el, rootMargin: "-10% 0px -80% 0px" });
    el.querySelectorAll("[data-section]").forEach(h => obs.observe(h));
    return () => obs.disconnect();
  }, [onActiveSection]);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      {/* TOC (desktop) */}
      {!isMobile && (
        <div style={{
          width: 220, flexShrink: 0, overflow: "auto",
          borderInlineEnd: "1px solid hsl(var(--c-border-hairline))",
          padding: "16px 12px", background: "hsl(var(--c-surface-panel))",
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "hsl(var(--c-text-quaternary))", marginBottom: 12, fontFamily: "var(--c-font-ui)", letterSpacing: "0.05em" }}>
            {"\u0641\u0647\u0631\u0633\u062A \u0645\u0637\u0627\u0644\u0628"}
          </div>
          {TOC.map(entry => (
            <button key={entry.id} onClick={() => document.getElementById(`section-${entry.id}`)?.scrollIntoView({ behavior: "smooth" })} style={{
              display: "flex", alignItems: "center", gap: 6,
              width: "100%", textAlign: "start",
              padding: `4px ${entry.level === 2 ? 24 : 8}px`,
              background: entry.id === activeSection ? "hsl(var(--c-accent-muted))" : "transparent",
              color: entry.id === activeSection ? "hsl(var(--c-accent))" : "hsl(var(--c-text-secondary))",
              border: "none", borderRadius: "var(--c-radius-xs)", cursor: "pointer",
              fontSize: "var(--c-text-caption)", fontFamily: "var(--c-font-persian)",
              lineHeight: 1.8, marginBottom: 1,
            }}>
              {bookmarks.has(entry.id) && <Bookmark size={10} fill="hsl(var(--c-warning))" color="hsl(var(--c-warning))" />}
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {/* Reader scroll area */}
      <div
        ref={readerRef}
        onScroll={e => {
          const el = e.currentTarget;
          onScroll(Math.min(1, Math.max(0, el.scrollTop / (el.scrollHeight - el.clientHeight || 1))));
        }}
        style={{ flex: 1, overflow: "auto", background: "hsl(var(--c-reader-bg))" }}
      >
        {isMobile && (
          <button onClick={onTocToggle} style={{
            position: "sticky", top: 8, right: 8, zIndex: 10, float: "right",
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", background: "hsl(var(--c-surface-raised))",
            border: "1px solid hsl(var(--c-border-hairline))",
            borderRadius: "var(--c-radius-sm)", boxShadow: "var(--c-shadow-sm)",
            fontSize: 12, fontFamily: "var(--c-font-persian)",
            color: "hsl(var(--c-text-secondary))", cursor: "pointer",
          }}>
            <Menu size={14} />
            {"\u0641\u0647\u0631\u0633\u062A"}
          </button>
        )}

        <article
          className={hasFocus ? "focus-active" : ""}
          style={{
            maxWidth: "var(--c-reader-measure)", margin: "0 auto",
            padding: "calc(2rem * var(--c-reading-density)) 1.5rem calc(8rem * var(--c-reading-density))",
            position: "relative",
          }}
        >
          <h1 style={{
            fontFamily: "var(--c-font-persian)", fontSize: "var(--c-text-display)",
            fontWeight: 700, color: "hsl(var(--c-text-primary))",
            lineHeight: 1.4, marginBottom: "0.5em",
          }}>
            {"\u06A9\u0627\u0631\u0633\u06CC\u0646\u0648\u0645 \u0633\u0644\u0648\u0644 \u06A9\u0644\u06CC\u0648\u06CC"}
          </h1>
          <p style={{
            fontFamily: "var(--c-font-latin-prose)", fontSize: "var(--c-text-caption)",
            color: "hsl(var(--c-text-tertiary))",
            marginBottom: "calc(2em * var(--c-reading-density))",
            direction: "ltr", textAlign: "left",
          }}>
            Campbell-Walsh-Wein Urology &mdash; Chapter 57: Renal Cell Carcinoma
          </p>

          {SECTIONS.map(section => (
            <section key={section.id} style={{ marginBottom: "calc(2em * var(--c-reading-density))" }}>
              <div id={`section-${section.id}`} data-section={section.id} style={{ scrollMarginTop: 80 }} />
              {section.level === 1 ? (
                <h2 style={{
                  fontFamily: "var(--c-font-persian)", fontSize: "var(--c-text-h2)",
                  fontWeight: 700, color: "hsl(var(--c-text-primary))",
                  lineHeight: 1.5, marginBottom: "var(--c-reader-paragraph-gap)",
                  paddingBottom: 8, borderBottom: "1px solid hsl(var(--c-border-hairline))",
                }}>
                  {section.heading}
                  <bdi style={{
                    fontFamily: "var(--c-font-latin-prose)", fontSize: "var(--c-text-caption)",
                    color: "hsl(var(--c-text-quaternary))", fontWeight: 400,
                    marginInlineStart: 8, unicodeBidi: "isolate", direction: "ltr",
                  }}>
                    {section.headingEn}
                  </bdi>
                </h2>
              ) : (
                <h3 style={{
                  fontFamily: "var(--c-font-persian)", fontSize: "var(--c-text-h3)",
                  fontWeight: 700, color: "hsl(var(--c-text-primary))",
                  lineHeight: 1.5, marginBottom: "var(--c-reader-paragraph-gap)",
                }}>
                  {section.heading}
                  <bdi style={{
                    fontFamily: "var(--c-font-latin-prose)", fontSize: "var(--c-text-caption)",
                    color: "hsl(var(--c-text-quaternary))", fontWeight: 400,
                    marginInlineStart: 8, unicodeBidi: "isolate", direction: "ltr",
                  }}>
                    {section.headingEn}
                  </bdi>
                </h3>
              )}

              {section.blocks.map(block => {
                const gIdx = ALL_BLOCK_IDS.indexOf(block.id);
                const isFocused = focusBlockIdx === gIdx;
                const ann = ANNOTATION_MAP.get(block.id);
                return (
                  <div
                    key={block.id}
                    id={`block-${block.id}`}
                    className={`reader-block${isFocused ? " reader-block--focused" : ""}`}
                    style={{ position: "relative", marginBottom: "var(--c-reader-paragraph-gap)", cursor: hasFocus ? "pointer" : undefined }}
                    onClick={() => hasFocus && onFocusBlock(gIdx)}
                  >
                    {ann && (
                      <div style={{
                        position: "absolute", left: -24, top: 6,
                        width: 8, height: ann.type === "bookmark" ? 12 : 8,
                        borderRadius: ann.type === "bookmark" ? "1px 1px 50% 50%" : "50%",
                        background: ann.type === "highlight" ? "hsl(var(--c-reader-highlight))" : ann.type === "note" ? "hsl(var(--c-accent))" : "hsl(var(--c-warning))",
                        opacity: 0.8,
                      }} />
                    )}
                    {block.type === "key-point" ? (
                      <div style={{
                        padding: "var(--c-reader-block-padding)",
                        background: "hsl(var(--c-accent-muted))",
                        borderInlineStart: "3px solid hsl(var(--c-accent))",
                        borderRadius: "var(--c-radius-sm)",
                        fontSize: "var(--c-text-body)", fontFamily: "var(--c-font-persian)",
                        lineHeight: "var(--c-reader-line-height)",
                        color: "hsl(var(--c-text-primary))",
                      }}>
                        {renderContent(block.content, onTermHover, onTermLeave)}
                      </div>
                    ) : (
                      <p style={{
                        fontSize: "var(--c-text-body)", fontFamily: "var(--c-font-persian)",
                        lineHeight: "var(--c-reader-line-height)",
                        color: "hsl(var(--c-text-primary))",
                        fontWeight: 400, margin: 0,
                      }}>
                        {renderContent(block.content, onTermHover, onTermLeave)}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}

// ─── QBankSurface ────────────────────────────────────

function QBankSurface({
  selectedAnswer, onSelectAnswer, onTermHover, onTermLeave,
}: {
  selectedAnswer: string | null;
  onSelectAnswer: (a: string) => void;
  onTermHover: (key: string, rect: DOMRect) => void;
  onTermLeave: () => void;
}) {
  const answered = selectedAnswer !== null;
  const correct = selectedAnswer === QUESTION.correct;
  return (
    <div style={{ overflow: "auto", height: "100%", padding: "calc(1.5rem * var(--c-reading-density))" }}>
      <div style={{ maxWidth: "var(--c-reader-measure)", margin: "0 auto" }}>
        {/* Progress */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: "var(--c-text-caption)", color: "hsl(var(--c-text-tertiary))", fontFamily: "var(--c-font-mono)" }}>
          <span>{"\u0633\u0624\u0627\u0644"} {QUESTION.number} / {QUESTION.total}</span>
          <span>{"\u0627\u0646\u06A9\u0648\u0644\u0648\u0698\u06CC GU"}</span>
        </div>

        {/* Stem */}
        <div style={{
          padding: "var(--c-reader-block-padding)",
          background: "hsl(var(--c-surface-raised))",
          borderRadius: "var(--c-radius-md)",
          border: "1px solid hsl(var(--c-border-hairline))",
          marginBottom: 16,
          fontSize: "var(--c-text-body)", fontFamily: "var(--c-font-persian)",
          lineHeight: "var(--c-reader-line-height)",
          color: "hsl(var(--c-text-primary))",
        }}>
          <p style={{ margin: 0 }}>
            {QUESTION.stem}
            {QUESTION.stemTerms.map((st, i) => (
              <bdi key={i} className="medical-term" onMouseEnter={e => onTermHover(st.term, e.currentTarget.getBoundingClientRect())} onMouseLeave={onTermLeave}>
                {DICTIONARY[st.term]?.en || st.term}
              </bdi>
            ))}
            {QUESTION.stemSuffix}
          </p>
          <p style={{ margin: "12px 0 0", fontWeight: 600 }}>{QUESTION.question}</p>
        </div>

        {/* Lab values */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
          marginBottom: 16, fontSize: 11, fontFamily: "var(--c-font-mono)",
        }}>
          {QUESTION.labValues.map(lab => (
            <div key={lab.name} style={{
              padding: "6px 8px", borderRadius: "var(--c-radius-xs)",
              background: "hsl(var(--c-surface-raised))",
              border: `1px solid hsl(var(${lab.status === "high" ? "--c-error" : lab.status === "low" ? "--c-warning" : "--c-border-hairline"}))`,
            }}>
              <div style={{ color: "hsl(var(--c-text-tertiary))", fontSize: 9 }}>{lab.name}</div>
              <div style={{ color: "hsl(var(--c-text-primary))", fontWeight: 600 }}>{lab.value}</div>
              <div style={{ color: "hsl(var(--c-text-quaternary))", fontSize: 9 }}>{lab.ref}</div>
            </div>
          ))}
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {QUESTION.options.map(opt => {
            const isSelected = selectedAnswer === opt.letter;
            const isCorrect = opt.letter === QUESTION.correct;
            let borderColor = "var(--c-border-hairline)";
            let bg = "var(--c-surface-raised)";
            if (answered) {
              if (isCorrect) { borderColor = "var(--c-success)"; bg = "152 52% 96%"; }
              else if (isSelected) { borderColor = "var(--c-error)"; bg = "0 58% 96%"; }
            } else if (isSelected) {
              borderColor = "var(--c-accent)"; bg = "var(--c-accent-muted)";
            }
            return (
              <button key={opt.letter} onClick={() => !answered && onSelectAnswer(opt.letter)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "calc(10px * var(--c-reading-density)) 14px",
                background: `hsl(${bg})`, border: `1.5px solid hsl(${borderColor})`,
                borderRadius: "var(--c-radius-sm)", cursor: answered ? "default" : "pointer",
                textAlign: "start", fontFamily: "var(--c-font-persian)",
                fontSize: "var(--c-text-body)", color: "hsl(var(--c-text-primary))",
              }}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%",
                  border: `1.5px solid hsl(${borderColor})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 600, flexShrink: 0,
                  background: isSelected ? `hsl(${borderColor})` : "transparent",
                  color: isSelected ? "white" : "hsl(var(--c-text-secondary))",
                }}>
                  {opt.letter}
                </span>
                <span style={{ flex: 1 }}>{opt.text}</span>
                {opt.termHint && (
                  <bdi style={{ fontFamily: "var(--c-font-latin-prose)", fontSize: 11, color: "hsl(var(--c-text-quaternary))", unicodeBidi: "isolate", direction: "ltr" }}>
                    {opt.termHint}
                  </bdi>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {answered && (
          <div style={{
            padding: "var(--c-reader-block-padding)",
            background: correct ? "hsl(152 52% 96%)" : "hsl(0 58% 96%)",
            borderInlineStart: `3px solid hsl(var(${correct ? "--c-success" : "--c-error"}))`,
            borderRadius: "var(--c-radius-sm)",
            fontSize: "var(--c-text-body)", fontFamily: "var(--c-font-persian)",
            lineHeight: "var(--c-reader-line-height)",
            color: "hsl(var(--c-text-primary))",
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {correct ? "\u2705 \u0635\u062D\u06CC\u062D!" : "\u274C \u0646\u0627\u062F\u0631\u0633\u062A"}
            </div>
            {QUESTION.explanation}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────

export default function ClinicalPage() {
  const [surface, setSurface] = useState<Surface>("reader");
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [session, setSession] = useState<SessionState>({
    active: false, startTime: null, targetMinutes: 90,
    blocksRead: 0, blocksTotal: ALL_BLOCK_IDS.length,
  });
  const [elapsed, setElapsed] = useState(0);
  const [focusBlockIdx, setFocusBlockIdx] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState("epidemiology");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [peekTerm, setPeekTerm] = useState<{ key: string; rect: DOMRect } | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();

  // Session timer
  useEffect(() => {
    if (!session.active || !session.startTime) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - session.startTime!) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [session.active, session.startTime]);

  // Sync demo cycling
  useEffect(() => {
    const states: SyncStatus[] = ["local", "writing", "syncing", "synced"];
    let idx = 0;
    const iv = setInterval(() => { idx = (idx + 1) % states.length; setSyncStatus(states[idx]); }, 4000);
    return () => clearInterval(iv);
  }, []);

  // Blocks read via scroll progress
  useEffect(() => {
    if (session.active) {
      setSession(prev => ({ ...prev, blocksRead: Math.floor(scrollProgress * prev.blocksTotal) }));
    }
  }, [scrollProgress, session.active]);

  // Scroll to focused block
  useEffect(() => {
    if (focusBlockIdx !== null) {
      document.getElementById(`block-${ALL_BLOCK_IDS[focusBlockIdx]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusBlockIdx]);

  const toggleSession = useCallback(() => {
    setSession(prev => prev.active
      ? { ...prev, active: false, startTime: null, blocksRead: 0 }
      : { ...prev, active: true, startTime: Date.now(), blocksRead: 0 }
    );
    setElapsed(0);
  }, []);

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "k") { e.preventDefault(); setCmdOpen(p => !p); return; }
      if (meta && e.key === "\\") { e.preventDefault(); setCollapsed(p => !p); return; }
      if (e.altKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFocusBlockIdx(prev => prev !== null ? null : 0);
        return;
      }
      if (meta && e.key === "[") {
        e.preventDefault();
        setDensity(prev => { const i = DENSITY_ORDER.indexOf(prev); return i > 0 ? DENSITY_ORDER[i - 1] : prev; });
        return;
      }
      if (meta && e.key === "]") {
        e.preventDefault();
        setDensity(prev => { const i = DENSITY_ORDER.indexOf(prev); return i < DENSITY_ORDER.length - 1 ? DENSITY_ORDER[i + 1] : prev; });
        return;
      }
      if (meta && e.key === "b") {
        e.preventDefault();
        setBookmarks(prev => { const n = new Set(prev); if (n.has(activeSection)) n.delete(activeSection); else n.add(activeSection); return n; });
        return;
      }
      if (e.key === "Escape") { setCmdOpen(false); setTocOpen(false); setPeekTerm(null); setFocusBlockIdx(prev => prev !== null ? null : prev); return; }
      if (focusBlockIdx !== null && e.key === "ArrowDown") { e.preventDefault(); setFocusBlockIdx(prev => Math.min((prev ?? 0) + 1, ALL_BLOCK_IDS.length - 1)); return; }
      if (focusBlockIdx !== null && e.key === "ArrowUp") { e.preventDefault(); setFocusBlockIdx(prev => Math.max((prev ?? 0) - 1, 0)); return; }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [focusBlockIdx, activeSection]);

  return (
    <div style={{
      "--c-reading-density": DENSITY_VALUES[density],
      display: "flex", height: "100dvh", overflow: "hidden",
      background: "hsl(var(--c-surface-canvas))",
      color: "hsl(var(--c-text-primary))",
      fontFamily: "var(--c-font-persian)",
    } as React.CSSProperties}>

      {/* Rhythm bar */}
      {surface === "reader" && (
        <div className="rhythm-bar">
          <div className="rhythm-bar-fill" style={{ width: `${scrollProgress * 100}%` }} />
        </div>
      )}

      {/* Rail */}
      <NavigationRail
        surface={surface} onSurface={setSurface}
        collapsed={collapsed} onToggle={() => setCollapsed(p => !p)}
        syncStatus={syncStatus} isMobile={isMobile}
        isDark={theme === "dark"} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      {/* Content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: isMobile ? 52 : 0 }}>
        {/* Top bar */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", gap: 12, flexShrink: 0,
          borderBottom: "1px solid hsl(var(--c-border-hairline))",
          background: "hsl(var(--c-surface-panel))",
        }}>
          <Breadcrumbs section={activeSection} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {surface === "reader" && focusBlockIdx !== null && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "hsl(var(--c-accent))", fontFamily: "var(--c-font-ui)" }}>
                <Maximize2 size={12} /> Focus
              </span>
            )}
            <button onClick={() => setDensity(prev => { const i = DENSITY_ORDER.indexOf(prev); return DENSITY_ORDER[(i + 1) % DENSITY_ORDER.length]; })} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 8px", background: "transparent",
              border: "1px solid hsl(var(--c-border-hairline))",
              borderRadius: "var(--c-radius-sm)", color: "hsl(var(--c-text-tertiary))",
              fontSize: 11, fontFamily: "var(--c-font-persian)", cursor: "pointer",
            }}>
              {DENSITY_LABELS[density]}
            </button>
            {isMobile && <SyncStatusBadge status={syncStatus} />}
            <SessionInfo session={session} elapsed={elapsed} onToggle={toggleSession} />
          </div>
        </header>

        {/* Surface */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {surface === "today" && <TodaySurface />}
          {surface === "reader" && (
            <ReaderSurface
              isMobile={isMobile} focusBlockIdx={focusBlockIdx}
              onFocusBlock={setFocusBlockIdx} onScroll={setScrollProgress}
              activeSection={activeSection} onActiveSection={setActiveSection}
              onTermHover={(k, r) => setPeekTerm({ key: k, rect: r })}
              onTermLeave={() => setPeekTerm(null)}
              onTocToggle={() => setTocOpen(p => !p)}
              bookmarks={bookmarks}
            />
          )}
          {surface === "qbank" && (
            <QBankSurface
              selectedAnswer={selectedAnswer} onSelectAnswer={setSelectedAnswer}
              onTermHover={(k, r) => setPeekTerm({ key: k, rect: r })}
              onTermLeave={() => setPeekTerm(null)}
            />
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, height: 52,
          display: "flex", background: "hsl(var(--c-surface-panel))",
          borderTop: "1px solid hsl(var(--c-border-hairline))", zIndex: 40,
        }}>
          {NAV.map(item => {
            const Icon = item.icon;
            const active = surface === item.surface;
            return (
              <button key={item.surface} onClick={() => setSurface(item.surface)} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 2,
                background: "none", border: "none",
                color: active ? "hsl(var(--c-accent))" : "hsl(var(--c-text-tertiary))",
                fontSize: 10, cursor: "pointer", fontFamily: "var(--c-font-persian)",
              }}>
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Overlays */}
      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onNavigate={s => { setSurface(s); setCmdOpen(false); }}
          onToggleSession={toggleSession}
          sessionActive={session.active}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
      )}
      {peekTerm && <CrossRefPeek termKey={peekTerm.key} rect={peekTerm.rect} />}
      {isMobile && tocOpen && <MobileTocDrawer onClose={() => setTocOpen(false)} activeSection={activeSection} />}
    </div>
  );
}
