"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  BookOpen,
  Brain,
  CalendarRange,
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  FileDown,
  Film,
  History,
  HardDrive,
  Inbox,
  LayoutGrid,
  type LucideIcon,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Search,
  Settings2,
  Star,
  Sun,
  Workflow,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { useCommandPaletteStore } from "@/components/command/CommandPalette";
import { SyncStatusBadge } from "@/components/sync/SyncStatusBadge";
import { Button } from "@/components/ui/button";

/* ── Widths ───────────────────────────────────────────────────
 *  Explicit-toggle only. No hover expansion.
 */
export const SIDEBAR_WIDTH  = 244;   // expanded
export const SIDEBAR_NARROW = 52;    // collapsed rail

/* ── Scoped CSS (minimal) ─────────────────────────────────── */
const SIDEBAR_CSS = `
.sb-scroll::-webkit-scrollbar { width: 4px; }
.sb-scroll::-webkit-scrollbar-track { background: transparent; }
.sb-scroll::-webkit-scrollbar-thumb {
  background: hsl(var(--border) / 0.4);
  border-radius: 999px;
}
.sb-scroll::-webkit-scrollbar-thumb:hover { background: hsl(var(--border) / 0.7); }

.sb-kbd {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 10.5px;
  line-height: 1;
  padding: 2px 4px;
  min-width: 14px;
  border-radius: 3px;
  background: hsl(var(--foreground) / 0.06);
  color: hsl(var(--muted-foreground) / 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.sb-kbd + .sb-kbd { margin-inline-start: 2px; }

.sb-chev { transition: transform 160ms cubic-bezier(0.4, 0, 0.2, 1); }
`;

/* ── Brand avatar ─────────────────────────────────────────── */
function WorkspaceAvatar({ size = 20 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/pwa-icon.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden
      className="shrink-0 rounded-[5px]"
      style={{ width: size, height: size }}
    />
  );
}

/* ── Nav data ─────────────────────────────────────────────── */
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: [string, string] | [string];
  badge?: "due" | "beta";
  /** Optional nested items — one level only. Used for Flashcards. */
  children?: NavChild[];
  /** When true, parent is active only on exact route match. */
  exact?: boolean;
};
type NavChild = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "due" | "beta";
  exact?: boolean;
};
type NavSection = {
  id: string;
  /** Omit to render as the primary (headerless) group. */
  title?: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "core",
    defaultOpen: true,
    items: [
      { href: "/dashboard",          label: "داشبورد",    icon: LayoutGrid, shortcut: ["G", "H"], exact: true },
      { href: "/flashcards/review",  label: "مرور امروز", icon: Inbox,      shortcut: ["G", "I"], badge: "due" },
      { href: "/library",            label: "کتابخانه",   icon: BookOpen,   shortcut: ["G", "L"] },
      { href: "/qbank",              label: "بانک سوال",  icon: Brain,      shortcut: ["G", "Q"] },
      {
        href: "/flashcards",
        label: "فلش‌کارت",
        icon: CreditCard,
        shortcut: ["G", "F"],
        exact: true,
        children: [
          { href: "/flashcards",         label: "خانه",            icon: LayoutGrid, exact: true },
          { href: "/flashcards/library", label: "کتابخانه فصل‌ها", icon: BookOpen },
        ],
      },
      { href: "/planner",            label: "برنامه‌ریز", icon: CalendarRange, shortcut: ["G", "P"] },
      { href: "/outliner",           label: "Outliner",   icon: Workflow,      shortcut: ["G", "O"] },
    ],
  },
  {
    id: "study",
    title: "مطالعه",
    defaultOpen: true,
    items: [
      { href: "/history", label: "تاریخچه", icon: History, shortcut: ["G", "T"] },
      { href: "/yield",   label: "یلد",     icon: Star,    shortcut: ["G", "Y"] },
    ],
  },
  {
    id: "system",
    title: "سیستم",
    defaultOpen: false,
    items: [
      {
        href: "/import",
        label: "ورودی",
        icon: FileDown,
        shortcut: ["G", "U"],
        exact: true,
        children: [
          { href: "/import",          label: "محتوا",    icon: FileDown, exact: true },
          { href: "/import/media",    label: "مدیا",     icon: Film },
          { href: "/import/outliner", label: "Outliner", icon: Workflow },
        ],
      },
      { href: "/settings/data", label: "تنظیمات", icon: Settings2, shortcut: ["G", "S"] },
    ],
  },
];

/* ── Helpers ──────────────────────────────────────────────── */
function matchRoute(href: string, pathname: string, exact?: boolean): boolean {
  if (href === "/") return pathname === "/";
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* ── Right-edge metadata (count OR dim shortcut) ──────────── */
function ItemMeta({
  dueCount,
  item,
}: {
  dueCount: number;
  item: { badge?: "due" | "beta"; shortcut?: [string, string] | [string] };
}) {
  const hasDue = item.badge === "due" && dueCount > 0;
  const hasBeta = item.badge === "beta";

  if (hasDue) {
    return (
      <span className="text-[11px] tabular-nums text-muted-foreground/70">
        {dueCount}
      </span>
    );
  }
  if (hasBeta) {
    return (
      <span className="rounded border border-border/50 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground/70">
        Beta
      </span>
    );
  }
  if (item.shortcut) {
    return (
      <span className="flex items-center opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
        {item.shortcut.map((k, i) => (
          <kbd key={i} className="sb-kbd">{k}</kbd>
        ))}
      </span>
    );
  }
  return null;
}

/* ── Leaf row ─────────────────────────────────────────────── */
interface LeafRowProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  dueCount: number;
  badge?: "due" | "beta";
  shortcut?: [string, string] | [string];
  /** Indent used for child items of a parent (expanded only). */
  indent?: boolean;
  onNavigate?: () => void;
}

function LeafRow({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  dueCount,
  badge,
  shortcut,
  indent,
  onNavigate,
}: LeafRowProps) {
  const hasDue = badge === "due" && dueCount > 0;
  const hasBeta = badge === "beta";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-active={active}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-[5px]",
        "transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/45 focus-visible:ring-offset-0",
        collapsed
          ? "mx-auto h-9 w-9 justify-center"
          : cn("h-8 gap-2", indent ? "ps-[30px] pe-2" : "px-2"),
        active
          ? "bg-foreground/[0.06] text-foreground dark:bg-foreground/[0.075]"
          : "text-muted-foreground/85 hover:bg-foreground/[0.035] hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0",
          active ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground",
        )}
        strokeWidth={1.75}
      />

      {!collapsed && (
        <>
          <span
            className={cn(
              "flex-1 truncate text-[12.5px]",
              active ? "font-medium" : "font-normal",
            )}
            style={{ textWrap: "balance" as never }}
          >
            {label}
          </span>
          <div className="flex h-4 items-center justify-end">
            <ItemMeta dueCount={dueCount} item={{ badge, shortcut }} />
          </div>
        </>
      )}

      {collapsed && (hasDue || hasBeta) && (
        <span
          className={cn(
            "absolute right-1 top-1 h-[5px] w-[5px] rounded-full",
            hasDue ? "bg-primary" : "bg-muted-foreground/70",
          )}
        />
      )}
    </Link>
  );
}

/* ── Parent row (has children disclosure) ─────────────────── */
interface ParentRowProps {
  item: NavItem;
  active: boolean;
  anyChildActive: boolean;
  openChildren: boolean;
  onToggleChildren: () => void;
  collapsed: boolean;
  dueCount: number;
  isActive: (href: string, exact?: boolean) => boolean;
  onNavigate?: () => void;
}

function ParentRow({
  item,
  active,
  anyChildActive,
  openChildren,
  onToggleChildren,
  collapsed,
  dueCount,
  isActive,
  onNavigate,
}: ParentRowProps) {
  const Icon = item.icon;

  // Rail: parent is simply a single icon link (no children rendered).
  if (collapsed) {
    return (
      <LeafRow
        href={item.href}
        label={item.label}
        icon={Icon}
        active={active || anyChildActive}
        collapsed
        dueCount={dueCount}
        badge={item.badge}
        onNavigate={onNavigate}
      />
    );
  }

  const parentHighlighted = active || (anyChildActive && !openChildren);

  return (
    <div className="relative">
      <Link
        href={item.href}
        onClick={onNavigate}
        data-active={parentHighlighted}
        className={cn(
          "group flex h-8 items-center gap-2 rounded-[5px] ps-2 pe-6",
          "transition-colors duration-100",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/45 focus-visible:ring-offset-0",
          parentHighlighted
            ? "bg-foreground/[0.06] text-foreground dark:bg-foreground/[0.075]"
            : "text-muted-foreground/85 hover:bg-foreground/[0.035] hover:text-foreground",
        )}
      >
        <Icon
          className={cn(
            "h-[15px] w-[15px] shrink-0",
            parentHighlighted ? "text-foreground" : "text-muted-foreground/70 group-hover:text-foreground",
          )}
          strokeWidth={1.75}
        />
        <span
          className={cn(
            "flex-1 truncate text-[12.5px]",
            parentHighlighted ? "font-medium" : "font-normal",
          )}
          style={{ textWrap: "balance" as never }}
        >
          {item.label}
        </span>
        <span className="flex h-4 items-center justify-end">
          <ItemMeta dueCount={dueCount} item={{ badge: item.badge, shortcut: item.shortcut }} />
        </span>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleChildren();
        }}
        aria-label={openChildren ? "بستن زیرمجموعه" : "باز کردن زیرمجموعه"}
        aria-expanded={openChildren}
        className={cn(
          "absolute inset-y-0 end-0 z-10 flex w-6 items-center justify-center rounded-[5px]",
          "text-muted-foreground/50 transition-colors hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        )}
      >
        <ChevronDown
          className={cn("sb-chev h-3 w-3", !openChildren && "rotate-90")}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence initial={false}>
        {openChildren && item.children && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 space-y-px">
              {item.children.map((child) => (
                <LeafRow
                  key={child.href + child.label}
                  href={child.href}
                  label={child.label}
                  icon={child.icon}
                  active={isActive(child.href, child.exact)}
                  collapsed={false}
                  dueCount={dueCount}
                  badge={child.badge}
                  indent
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Section (optional title, collapsible when titled) ────── */
interface SectionProps {
  section: NavSection;
  open: boolean;
  onToggle: () => void;
  openSubitems: Record<string, boolean>;
  onToggleSubitem: (id: string) => void;
  isActive: (href: string, exact?: boolean) => boolean;
  collapsed: boolean;
  dueCount: number;
  onNavigate?: () => void;
  isFirstSection: boolean;
}

function Section({
  section,
  open,
  onToggle,
  openSubitems,
  onToggleSubitem,
  isActive,
  collapsed,
  dueCount,
  onNavigate,
  isFirstSection,
}: SectionProps) {
  // In the collapsed rail, groups are just visually separated by hairlines.
  if (collapsed) {
    return (
      <div
        className={cn(
          "space-y-0.5",
          !isFirstSection && "mt-2 border-t border-border/25 pt-2",
        )}
      >
        {section.items.map((item) => {
          const active = isActive(item.href, item.exact);
          const anyChildActive =
            !!item.children && item.children.some((c) => isActive(c.href, c.exact));
          if (item.children) {
            return (
              <ParentRow
                key={item.href + item.label}
                item={item}
                active={active}
                anyChildActive={anyChildActive}
                openChildren={false}
                onToggleChildren={() => {}}
                collapsed
                dueCount={dueCount}
                isActive={isActive}
                onNavigate={onNavigate}
              />
            );
          }
          return (
            <LeafRow
              key={item.href + item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={active}
              collapsed
              dueCount={dueCount}
              badge={item.badge}
              onNavigate={onNavigate}
            />
          );
        })}
      </div>
    );
  }

  const body = (
    <div className="space-y-px">
      {section.items.map((item) => {
        const active = isActive(item.href, item.exact);
        const anyChildActive =
          !!item.children && item.children.some((c) => isActive(c.href, c.exact));
        if (item.children) {
          const subitemKey = item.href + ":" + item.label;
          const openChildren = openSubitems[subitemKey] ?? anyChildActive;
          return (
            <ParentRow
              key={item.href + item.label}
              item={item}
              active={active}
              anyChildActive={anyChildActive}
              openChildren={openChildren}
              onToggleChildren={() => onToggleSubitem(subitemKey)}
              collapsed={false}
              dueCount={dueCount}
              isActive={isActive}
              onNavigate={onNavigate}
            />
          );
        }
        return (
          <LeafRow
            key={item.href + item.label}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={active}
            collapsed={false}
            dueCount={dueCount}
            badge={item.badge}
            shortcut={item.shortcut}
            onNavigate={onNavigate}
          />
        );
      })}
    </div>
  );

  if (!section.title) {
    return <div className={cn(isFirstSection ? "mt-1" : "mt-3")}>{body}</div>;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group flex h-6 w-full items-center gap-1 rounded-[4px] px-2",
          "text-[11px] font-medium text-muted-foreground/60",
          "transition-colors hover:text-foreground/85",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        )}
        aria-expanded={open}
      >
        <span className="flex-1 truncate text-start">{section.title}</span>
        <ChevronDown
          className={cn(
            "sb-chev h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100",
            !open && "rotate-90",
          )}
          strokeWidth={2}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-0.5">{body}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Inner content ────────────────────────────────────────── */
interface ContentProps {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onClose,
  onNavigate,
}: ContentProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const openPalette = useCommandPaletteStore((s) => s.openPalette);
  const stats = useAppStore((s) => s.stats);
  const dueCount = stats?.dueFlashcards ?? 0;
  const isDark = resolvedTheme === "dark";
  const isDashboard = pathname.startsWith("/dashboard");
  const [dashboardLocalState, setDashboardLocalState] = useState({
    storageMB: 0,
    storagePct: 0,
    lastSyncLabel: "لحظاتی پیش",
    pendingOps: 0,
    hydrating: true,
  });

  // Section (group) collapse state — persisted.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_SECTIONS.forEach((s) => (init[s.id] = s.defaultOpen ?? true));
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("sb-sections");
        if (raw) Object.assign(init, JSON.parse(raw) as Record<string, boolean>);
      } catch {}
    }
    return init;
  });
  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("sb-sections", JSON.stringify(next)); } catch {}
      return next;
    });

  // Per-parent (children) disclosure state — persisted.
  const [openSubitems, setOpenSubitems] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("sb-subitems");
      if (raw) return JSON.parse(raw) as Record<string, boolean>;
    } catch {}
    return {};
  });
  const toggleSubitem = (id: string) =>
    setOpenSubitems((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem("sb-subitems", JSON.stringify(next)); } catch {}
      return next;
    });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isDashboard) return;

    let cancelled = false;

    const refreshDashboardState = async () => {
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      let storageMB = 0;
      let storagePct = 0;
      let pendingOps = 0;

      try {
        const estimate = await navigator.storage?.estimate?.();
        if (estimate) {
          const used = estimate.usage ?? 0;
          const quota = estimate.quota ?? 134_217_728;
          storageMB = Math.round((used / 1024 / 1024) * 10) / 10;
          storagePct = Math.round((used / Math.max(quota, 1)) * 100);
        }
      } catch {}

      try {
        const { listUnsynced } = await import("@/lib/local-first/outbox");
        pendingOps = (await listUnsynced()).length;
      } catch {}

      if (!cancelled) {
        setDashboardLocalState({
          storageMB,
          storagePct,
          lastSyncLabel: online ? "لحظاتی پیش" : "آفلاین",
          pendingOps,
          hydrating: false,
        });
      }
    };

    void refreshDashboardState();
    const intervalId = window.setInterval(refreshDashboardState, 30_000);
    window.addEventListener("online", refreshDashboardState);
    window.addEventListener("offline", refreshDashboardState);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("online", refreshDashboardState);
      window.removeEventListener("offline", refreshDashboardState);
    };
  }, [isDashboard]);

  const isActive = (href: string, exact?: boolean) => matchRoute(href, pathname, exact);

  return (
    <div className="flex h-full flex-col">
      <style dangerouslySetInnerHTML={{ __html: SIDEBAR_CSS }} />

      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-[44px] shrink-0 items-center",
          collapsed ? "justify-center px-1.5" : "justify-between pe-1.5 ps-2",
        )}
      >
        {collapsed ? (
          // Rail header = brand identity only. The expand toggle lives
          // above the footer, out of the iPad PWA status-bar zone.
          <WorkspaceAvatar size={22} />
        ) : (
          <>
            <button
              type="button"
              className={cn(
                "group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[5px] px-1.5",
                "transition-colors hover:bg-foreground/[0.04]",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
              )}
              title="Hossein Starship"
              aria-label="Hossein Starship"
            >
              <WorkspaceAvatar size={20} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold tracking-tight text-foreground">
                Hossein Starship
              </span>
              <ChevronsUpDown
                className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground"
                strokeWidth={2}
              />
            </button>
            <div className="flex items-center">
              {onToggleCollapse && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onToggleCollapse}
                  className="h-8 w-8 rounded-[5px] text-muted-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
                  title="بستن منو"
                  aria-label="بستن منو"
                  style={{ touchAction: "manipulation" }}
                >
                  <PanelLeft className="h-[14px] w-[14px]" strokeWidth={1.75} />
                </Button>
              )}
              {onClose && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-7 w-7 rounded-[5px] text-muted-foreground/55 hover:bg-foreground/[0.04] hover:text-foreground"
                  aria-label="بستن"
                >
                  <X className="h-[14px] w-[14px]" strokeWidth={1.75} />
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div className={cn("px-2 pb-1", collapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={() => openPalette()}
          title={collapsed ? "جستجو (⌘K)" : undefined}
          aria-label="جستجو"
          className={cn(
            "group flex items-center text-muted-foreground/80",
            "transition-colors duration-100",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/45 focus-visible:ring-offset-0",
            collapsed
              ? "h-9 w-9 justify-center rounded-[5px] hover:bg-foreground/[0.035] hover:text-foreground"
              : [
                  "h-8 w-full gap-2 rounded-[5px] bg-foreground/[0.03] px-2 text-[12.5px]",
                  "hover:bg-foreground/[0.055] hover:text-foreground",
                ],
          )}
        >
          <Search className="h-[14px] w-[14px] shrink-0" strokeWidth={1.75} />
          {!collapsed && (
            <>
              <span className="flex-1 text-start">جستجو</span>
              <span className="flex items-center">
                <kbd className="sb-kbd">⌘</kbd>
                <kbd className="sb-kbd">K</kbd>
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav
        className="sb-scroll flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1"
        style={{ WebkitOverflowScrolling: "touch" }}
        aria-label="ناوبری اصلی"
      >
        {NAV_SECTIONS.map((section, i) => (
          <Section
            key={section.id}
            section={section}
            open={!!openSections[section.id]}
            onToggle={() => toggleSection(section.id)}
            openSubitems={openSubitems}
            onToggleSubitem={toggleSubitem}
            isActive={isActive}
            collapsed={collapsed}
            dueCount={dueCount}
            onNavigate={onNavigate}
            isFirstSection={i === 0}
          />
        ))}
      </nav>

      {isDashboard && !collapsed && (
        <div className="shrink-0 border-t border-border/25 p-3 text-xs text-muted-foreground">
          <div className="space-y-3 rounded-[8px] border border-border/35 bg-background/35 p-3">
            <div>
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <HardDrive className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <span>حافظه محلی</span>
              </div>
              <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                <div
                  style={{ width: `${Math.min(100, dashboardLocalState.storagePct)}%` }}
                  className={cn(
                    "h-full rounded-full bg-primary",
                    dashboardLocalState.hydrating && "animate-pulse",
                  )}
                />
              </div>
              <div dir="ltr" className="font-mono text-[11px] text-muted-foreground/80">
                {dashboardLocalState.storageMB.toFixed(1)} MB
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <RefreshCw className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <span>آخرین sync</span>
              </div>
              <div>{dashboardLocalState.lastSyncLabel}</div>
            </div>

            {dashboardLocalState.pendingOps > 0 && (
              <div className="font-medium text-warning">
                <span dir="ltr">{dashboardLocalState.pendingOps}</span>
                <span> تغییر محلی</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Expand toggle (collapsed rail only) ───────────────
         Placed above the footer so it sits in a comfortable
         thumb zone on iPad PWA — never near the status-bar.  */}
      {collapsed && onToggleCollapse && (
        <div className="shrink-0 border-t border-border/25 px-2 py-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="باز کردن منو"
            title="باز کردن منو"
            className={cn(
              "mx-auto flex h-9 w-9 items-center justify-center rounded-[5px]",
              "text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/45",
            )}
            style={{ touchAction: "manipulation" }}
          >
            <PanelRight className="h-[15px] w-[15px]" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        className={cn(
          "shrink-0 border-t border-border/25",
          collapsed
            ? "flex flex-col items-center gap-1 px-2 py-2"
            : "flex items-center justify-between px-2 py-1.5",
        )}
      >
        {collapsed ? (
          <>
            <SyncStatusBadge compact />
            {mounted && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setTheme(isDark ? "light" : "dark")}
                title={isDark ? "روشن" : "تاریک"}
                aria-label={isDark ? "روشن" : "تاریک"}
                className="h-8 w-8 rounded-[5px] text-muted-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"
              >
                {isDark ? (
                  <Sun className="h-[14px] w-[14px]" strokeWidth={1.75} />
                ) : (
                  <Moon className="h-[14px] w-[14px]" strokeWidth={1.75} />
                )}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-1.5">
              <SyncStatusBadge compact />
              <span className="truncate text-[11px] text-muted-foreground/70">
                همگام
              </span>
            </div>
            <div className="flex items-center">
              {mounted && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  title={isDark ? "روشن" : "تاریک"}
                  aria-label={isDark ? "روشن" : "تاریک"}
                  className="h-7 w-7 rounded-[5px] text-muted-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  {isDark ? (
                    <Sun className="h-[14px] w-[14px]" strokeWidth={1.75} />
                  ) : (
                    <Moon className="h-[14px] w-[14px]" strokeWidth={1.75} />
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-[5px] text-muted-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground"
                title="بیشتر"
                aria-label="بیشتر"
              >
                <MoreHorizontal className="h-[14px] w-[14px]" strokeWidth={1.75} />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────── */
export function Sidebar() {
  const sidebarOpen         = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen      = useAppStore((s) => s.setSidebarOpen);
  const sidebarCollapsed    = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  // Explicit toggle ONLY — no hover, no peek, no timers.
  const collapsed = sidebarCollapsed;
  const toggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);
  const closeMobile = () => setSidebarOpen(false);

  return (
    <>
      {/* Desktop layout spacer — reserves the current sidebar width. */}
      <div
        aria-hidden
        className="hidden shrink-0 lg:block"
        style={{ width: collapsed ? SIDEBAR_NARROW : SIDEBAR_WIDTH }}
      />

      {/* Desktop sidebar */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          "hidden lg:flex lg:flex-col",
          "fixed right-0 top-0 z-30 h-[100dvh] overflow-hidden",
          "border-l border-border/30",
          "bg-[hsl(var(--card))] supports-[backdrop-filter]:bg-[hsl(var(--card)/0.82)] supports-[backdrop-filter]:backdrop-blur-xl",
          "transition-[width] duration-200 ease-out",
        )}
        style={{
          width: collapsed ? SIDEBAR_NARROW : SIDEBAR_WIDTH,
          // iOS/iPadOS PWA safe area — keeps controls out from under the
          // status bar (battery/clock notch) and home indicator.
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* Mobile / tablet drawer (unchanged behavior) */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="sb-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
              onClick={closeMobile}
              aria-hidden
            />
            <motion.aside
              key="sb-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className={cn(
                "fixed right-0 top-0 z-50 h-[100dvh]",
                "border-l border-border/30",
                "bg-[hsl(var(--card))] supports-[backdrop-filter]:bg-[hsl(var(--card)/0.95)] supports-[backdrop-filter]:backdrop-blur-2xl",
                "shadow-[-16px_0_36px_-12px_rgba(0,0,0,0.28)]",
                "lg:hidden",
              )}
              style={{
                width: SIDEBAR_WIDTH,
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <SidebarContent
                collapsed={false}
                onClose={closeMobile}
                onNavigate={closeMobile}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
