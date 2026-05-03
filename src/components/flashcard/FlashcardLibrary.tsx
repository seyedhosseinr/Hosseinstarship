'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  ChevronLeft,
  Search,
  BookOpen,
  Brain,
  Layers,
  Library,
  Clock,
  Sparkles,
  AlertTriangle,
  X,
  FileText,
  HelpCircle,
  Tag,
  BarChart3,
  Pause,
  Trash2,
  Play,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colorLight, colorDark } from '@/lib/theme/tokens';
import { BidiText } from '@/components/shared/BidiText';
import { processHtmlBidi } from '@/lib/text/bidi';

/* ── CSS-variable bridge (light / dark) ───────────────────────────── */
const FL_STYLES = `
[data-fclib] {
${Object.entries(colorLight).map(([k, v]) => `  --fl-${k}: ${v};`).join("\n")}
}
.dark [data-fclib] {
${Object.entries(colorDark).map(([k, v]) => `  --fl-${k}: ${v};`).join("\n")}
}
[data-fclib] .fl-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
[data-fclib] .fl-scroll::-webkit-scrollbar-track { background: transparent; }
[data-fclib] .fl-scroll::-webkit-scrollbar-thumb {
  background: var(--fl-border);
  border-radius: 999px;
}
[data-fclib] .fl-scroll::-webkit-scrollbar-thumb:hover { background: var(--fl-a, var(--fl-accent)); }
[data-fclib] .fl-tabnum { font-variant-numeric: tabular-nums; }
@keyframes fl-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
[data-fclib] .fl-pulse { animation: fl-pulse 1.5s ease-in-out infinite; }

/* ── Dashboard-aligned token additions ── */
[data-fclib] {
  --fl-a:         hsl(166 90% 26%);
  --fl-a2:        hsl(38 92% 50%);
  --fl-blue:      #0369A1;
  --fl-violet:    #7C3AED;
  --fl-emerald:   #047857;
  --fl-cyan:      #0891B2;
  --fl-amber:     #D97706;
  --fl-rose-dsh:  #BE123C;
  --fl-a-glow:    color-mix(in srgb, hsl(166 90% 26%) 28%, transparent);
  --fl-a-dim:     color-mix(in srgb, hsl(166 90% 26%) 10%, transparent);
  --fl-glass-bg:  linear-gradient(155deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.60) 100%);
  --fl-glass-bd:  rgba(255,255,255,0.75);
  --fl-sh:        0 2px 8px rgba(0,70,60,.06), 0 10px 40px rgba(0,70,60,.08), inset 0 1px 0 rgba(255,255,255,.98);
  --fl-sh-lg:     0 16px 56px rgba(0,70,60,.13), 0 0 0 1.5px color-mix(in srgb, hsl(166 90% 26%) 35%, transparent), inset 0 1px 0 rgba(255,255,255,.98);
}
.dark [data-fclib] {
  --fl-a:         hsl(172 72% 46%);
  --fl-a2:        hsl(38 88% 58%);
  --fl-blue:      #22D3EE;
  --fl-violet:    #A78BFA;
  --fl-emerald:   #34D399;
  --fl-cyan:      #67E8F9;
  --fl-amber:     #FBBF24;
  --fl-rose-dsh:  #FB7185;
  --fl-a-glow:    color-mix(in srgb, hsl(172 72% 46%) 32%, transparent);
  --fl-a-dim:     color-mix(in srgb, hsl(172 72% 46%) 13%, transparent);
  --fl-glass-bg:  linear-gradient(155deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%);
  --fl-glass-bd:  rgba(80,210,190,0.10);
  --fl-sh:        0 2px 6px rgba(0,0,0,.22), 0 8px 28px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.06);
  --fl-sh-lg:     0 12px 48px rgba(0,0,0,.30), 0 0 0 1.5px color-mix(in srgb, hsl(172 72% 46%) 35%, transparent), inset 0 1px 0 rgba(255,255,255,.07);
}

/* ── Mesh gradient aurora (matches dashboard hs-mesh) ── */
[data-fclib] .fl-mesh {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 120% 80% at 0% 0%, color-mix(in srgb, var(--fl-a) 28%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 80% 100% at 100% 100%, color-mix(in srgb, var(--fl-blue) 22%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse 70% 60% at 60% 0%, color-mix(in srgb, var(--fl-emerald) 16%, transparent) 0%, transparent 48%),
    radial-gradient(ellipse 60% 80% at 15% 100%, color-mix(in srgb, var(--fl-violet) 22%, transparent) 0%, transparent 48%),
    radial-gradient(circle 45% at 80% 30%, color-mix(in srgb, var(--fl-cyan) 14%, transparent) 0%, transparent 42%);
  animation: fl-mesh-shift 20s ease-in-out infinite alternate;
}
@keyframes fl-mesh-shift {
  0% { filter: hue-rotate(0deg) saturate(1); }
  50% { filter: hue-rotate(4deg) saturate(1.06); }
  100% { filter: hue-rotate(-4deg) saturate(1.03); }
}
[data-fclib] .fl-noise {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ── Accent animated line at top ── */
[data-fclib] .fl-accent-line {
  height: 3px;
  background: linear-gradient(90deg, var(--fl-a), var(--fl-a2), var(--fl-blue), var(--fl-a));
  background-size: 300% 100%;
  animation: fl-accent-shift 8s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes fl-accent-shift {
  0%,100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* ── Glass pane (sidebar, main content wrapper, detail) ── */
[data-fclib] .fl-pane {
  background: var(--fl-glass-bg);
  border: 1.5px solid var(--fl-glass-bd);
  box-shadow: var(--fl-sh);
  position: relative; z-index: 1;
}

/* ── Summary tile glass style ── */
[data-fclib] .fl-summary {
  background: var(--fl-glass-bg) !important;
  border: 1.5px solid var(--fl-glass-bd) !important;
  box-shadow: var(--fl-sh);
  transition: all 0.35s cubic-bezier(.22,1,.36,1);
  position: relative; overflow: hidden;
}
[data-fclib] .fl-summary::before {
  content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--fl-a), var(--fl-blue));
  opacity: 0.65; transition: opacity .3s;
}
[data-fclib] .fl-summary:hover::before { opacity: 1; }
[data-fclib] .fl-summary:hover {
  transform: translateY(-3px);
  box-shadow: var(--fl-sh-lg);
}

/* ── Volume row hover ── */
[data-fclib] .fl-vol-row { transition: background 0.2s, transform 0.2s; }
[data-fclib] .fl-vol-row:hover { background: color-mix(in srgb, var(--fl-a) 6%, transparent) !important; }

/* ── Review primary button shimmer ── */
[data-fclib] .fl-review-btn {
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, var(--fl-a), color-mix(in srgb, var(--fl-blue) 45%, var(--fl-a))) !important;
  box-shadow: 0 4px 14px var(--fl-a-glow) !important;
  transition: all 0.3s cubic-bezier(.22,1,.36,1);
}
[data-fclib] .fl-review-btn::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%);
  transform: translateX(-100%); transition: transform 0.4s;
}
[data-fclib] .fl-review-btn:hover::after { transform: translateX(100%); }
[data-fclib] .fl-review-btn:hover {
  box-shadow: 0 8px 28px var(--fl-a-glow) !important;
  transform: translateY(-2px);
}
`;

/* ========================================================================== */
/*  Types                                                                      */
/* ========================================================================== */

export type HierarchyNode = {
  id: string;
  label: string;
  type: 'volume' | 'part' | 'chapter';
  volumeNo?: number;
  chapterNo?: number;
  total: number;
  due: number;
  newCount: number;
  learning: number;
  children?: HierarchyNode[];
};

export interface FlashcardLibraryProps {
  hierarchy: HierarchyNode[];
  totalDue: number;
  totalNew: number;
  totalCards: number;
}

type QuickFilter = 'all' | 'due' | 'new' | 'leech';

type SortMode = 'due' | 'created' | 'alphabetical' | 'importance';

interface CardRow {
  id: string;
  frontHtml: string;
  backHtml: string;
  cardType: string;
  deck: string | null;
  chapterNo: number | null;
  chapterTitle: string | null;
  state: string;
  fsrsDue: number | null;
  intervalDays: number;
  importance: number;
  isLeech: boolean;
  isSuspended: boolean;
  tags: string[];
  sourceDocId: string | null;
  sourceFrameId: string | null;
  sourceQuestionId: string | null;
  createdAt: number;
}

interface CardDetail extends CardRow {
  backHtml: string;
  extraHtml: string | null;
  educationalObjective: string | null;
  relatedCards: { id: string; frontHtml: string; state: string }[];
  relatedQuestionCount: number;
  volumeNo: number | null;
  partTitle: string | null;
}

/* ========================================================================== */
/*  Helpers                                                                    */
/* ========================================================================== */

const c = Object.fromEntries(
  Object.keys(colorLight).map((k) => [k, `var(--fl-${k})`]),
) as Record<keyof typeof colorLight, string>;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDueDate(ts: number | null): string {
  if (!ts) return 'جدید';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = ts - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)} روز گذشته`;
  if (diffDays === 0) return 'امروز';
  if (diffDays === 1) return 'فردا';
  if (diffDays < 7) return `${diffDays} روز دیگر`;
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function stateLabel(state: string): { text: string; color: string } {
  switch (state) {
    case 'new':
      return { text: 'جدید', color: c.accent };
    case 'learning':
    case 'relearning':
      return { text: 'یادگیری', color: c.warning };
    case 'review':
      return { text: 'مرور', color: c.success };
    default:
      return { text: state, color: c.textMuted };
  }
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/* ========================================================================== */
/*  Shared style constants                                                     */
/* ========================================================================== */

const SIDEBAR_W = 300;
const DETAIL_W = 360;
const R_SM = 8;
const R_MD = 10;

const chipMuted: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 10.5,
  fontWeight: 600,
  background: c.surfaceSubtle,
  color: c.textMuted,
  lineHeight: 1.6,
  fontVariantNumeric: 'tabular-nums',
};

const chipTint = (color: string): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '1px 7px',
  borderRadius: 999,
  fontSize: 10.5,
  fontWeight: 600,
  background: `${color}12`,
  color,
  lineHeight: 1.6,
  fontVariantNumeric: 'tabular-nums',
});

const filterPillStyle = (active: boolean): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 10px',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  border: `1px solid ${active ? c.border : 'transparent'}`,
  background: active ? c.surface : 'transparent',
  color: active ? c.text : c.textMuted,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background 120ms, color 120ms, border-color 120ms',
});

/* ========================================================================== */
/*  Sub-components                                                             */
/* ========================================================================== */

/* ---- Tree node ---------------------------------------------------------- */

function TreeNode({
  node,
  depth,
  selectedChapterId,
  expandedNodes,
  activeFilter,
  onToggleExpand,
  onSelectChapter,
}: {
  node: HierarchyNode;
  depth: number;
  selectedChapterId: string | null;
  expandedNodes: Set<string>;
  activeFilter: QuickFilter;
  onToggleExpand: (id: string) => void;
  onSelectChapter: (id: string) => void;
}) {
  const isExpanded = expandedNodes.has(node.id);
  const isChapter = node.type === 'chapter';
  const isVolume = node.type === 'volume';
  const isSelected = isChapter && selectedChapterId === node.id;
  const hasChildren = (node.children?.length ?? 0) > 0;
  const sortedChildren = useMemo(() => {
    if (!node.children) return [];
    return [...node.children].sort((a, b) => {
      if (a.type === 'chapter' && b.type === 'chapter') {
        return (a.chapterNo ?? 0) - (b.chapterNo ?? 0);
      }
      return 0;
    });
  }, [node.children]);

  // Filter-aware visibility
  const visibleCount = activeFilter === 'due' ? node.due
    : activeFilter === 'new' ? node.newCount
    : activeFilter === 'leech' ? 0
    : node.total;

  if (activeFilter !== 'all' && activeFilter !== 'leech' && visibleCount === 0 && !isChapter) {
    const anyChildVisible = node.children?.some(ch => {
      const cv = activeFilter === 'due' ? ch.due : ch.newCount;
      return cv > 0 || (ch.children?.length ?? 0) > 0;
    });
    if (!anyChildVisible) return null;
  }

  const paddingRight = 14 + depth * 16;

  const nodeStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '6px 12px',
    paddingRight,
    background: isSelected ? c.accentSoft : 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: isChapter ? 12.5 : 12.5,
    fontWeight: isSelected ? 600 : isVolume ? 600 : 500,
    color: isSelected ? c.accent : isVolume ? c.text : c.textSoft,
    textAlign: 'right',
    lineHeight: 1.55,
    gap: 6,
    transition: 'background 120ms',
    letterSpacing: isVolume ? '0.01em' : undefined,
    textTransform: isVolume ? undefined : undefined,
  };

  const handleClick = () => {
    if (isChapter) {
      onSelectChapter(node.id);
    } else {
      onToggleExpand(node.id);
    }
  };

  return (
    <>
      <button style={nodeStyle} onClick={handleClick}>
        {hasChildren ? (
          <span style={{
            width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, color: c.textMuted, transition: 'transform 150ms',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>
            <ChevronLeft style={{ width: 11, height: 11 }} />
          </span>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        {isChapter && node.chapterNo != null && (
          <span
            className="fl-tabnum"
            style={{ fontSize: 10.5, fontWeight: 600, minWidth: 20, flexShrink: 0, color: isSelected ? c.accent : c.textMuted }}
          >
            {node.chapterNo}
          </span>
        )}

        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.label}
        </span>

        {node.due > 0 && (
          <span className="fl-tabnum" style={{ fontSize: 10.5, fontWeight: 600, color: c.warning, flexShrink: 0 }}>
            {node.due}
          </span>
        )}

        {node.newCount > 0 && !isChapter && (
          <span className="fl-tabnum" style={{ fontSize: 10.5, fontWeight: 600, color: c.accent, flexShrink: 0 }}>
            +{node.newCount}
          </span>
        )}

        {!isChapter && (
          <span className="fl-tabnum" style={{ fontSize: 10.5, color: c.textMuted, flexShrink: 0 }}>
            {node.total}
          </span>
        )}

        {isChapter && (
          <span className="fl-tabnum" style={{ fontSize: 10.5, color: c.textMuted, flexShrink: 0 }}>
            {node.total}
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            {sortedChildren.map(child => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedChapterId={selectedChapterId}
                expandedNodes={expandedNodes}
                activeFilter={activeFilter}
                onToggleExpand={onToggleExpand}
                onSelectChapter={onSelectChapter}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ---- Overview summary row (quiet stat) ---------------------------------- */

function SummaryTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div
      className="fl-summary"
      style={{
        flex: 1,
        minWidth: 140,
        padding: '18px 20px',
        borderRadius: 16,
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 700, color: c.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div
        className="fl-tabnum"
        style={{ fontSize: 28, fontWeight: 900, color: c.text, marginTop: 8, lineHeight: 1.05, letterSpacing: '-0.04em' }}
      >
        {value.toLocaleString('fa-IR')}
      </div>
      {hint ? (
        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 4 }}>{hint}</div>
      ) : null}
    </div>
  );
}

/* ========================================================================== */
/*  Main component                                                             */
/* ========================================================================== */

export default function FlashcardLibrary({
  hierarchy,
  totalDue,
  totalNew,
  totalCards,
}: FlashcardLibraryProps) {
  /* ---- State ------------------------------------------------------------ */
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (hierarchy.length > 0) initial.add(hierarchy[0].id);
    return initial;
  });
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('due');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [cards, setCards] = useState<CardRow[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardDetail, setCardDetail] = useState<CardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  /* ---- Derived ---------------------------------------------------------- */

  const selectedChapter = useMemo<HierarchyNode | null>(() => {
    if (!selectedChapterId) return null;
    for (const vol of hierarchy) {
      if (vol.id === selectedChapterId) return vol;
      for (const part of vol.children ?? []) {
        if (part.id === selectedChapterId) return part;
        for (const ch of part.children ?? []) {
          if (ch.id === selectedChapterId) return ch;
        }
      }
    }
    return null;
  }, [hierarchy, selectedChapterId]);

  const breadcrumb = useMemo<{ label: string; id: string }[]>(() => {
    if (!selectedChapterId) return [];
    for (const vol of hierarchy) {
      for (const part of vol.children ?? []) {
        for (const ch of part.children ?? []) {
          if (ch.id === selectedChapterId) {
            return [
              { label: vol.label, id: vol.id },
              { label: part.label, id: part.id },
              { label: ch.label, id: ch.id },
            ];
          }
        }
        if (part.id === selectedChapterId) {
          return [
            { label: vol.label, id: vol.id },
            { label: part.label, id: part.id },
          ];
        }
      }
    }
    return [];
  }, [hierarchy, selectedChapterId]);

  const clusters = useMemo(() => {
    const filtered = cards.filter(card => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const front = stripHtml(card.frontHtml).toLowerCase();
        const tags = (card.tags ?? []).join(' ').toLowerCase();
        if (!front.includes(q) && !tags.includes(q)) return false;
      }
      if (activeFilter === 'due' && (!card.fsrsDue || card.fsrsDue > Date.now())) return false;
      if (activeFilter === 'new' && card.state !== 'new') return false;
      if (activeFilter === 'leech' && !card.isLeech) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'due':
          return (a.fsrsDue ?? Infinity) - (b.fsrsDue ?? Infinity);
        case 'created':
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        case 'alphabetical':
          return stripHtml(a.frontHtml).localeCompare(stripHtml(b.frontHtml), 'fa');
        case 'importance':
          return (b.importance ?? 5) - (a.importance ?? 5);
        default:
          return 0;
      }
    });

    const map = new Map<string, CardRow[]>();
    for (const card of sorted) {
      const key = card.deck ?? 'بدون دسته';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [cards, debouncedSearch, activeFilter, sortMode]);

  /* ---- Side effects ----------------------------------------------------- */

  useEffect(() => {
    if (!selectedChapterId) {
      setCards([]);
      return;
    }
    const chapterNode = selectedChapter;
    if (!chapterNode || chapterNode.chapterNo == null) return;

    let cancelled = false;
    setCardsLoading(true);
    setSelectedCardId(null);
    setCardDetail(null);

    fetch(`/api/flashcards/by-chapter?chapterNo=${chapterNode.chapterNo}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setCards(Array.isArray(data.cards) ? data.cards : []);
          setCardsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCards([]);
          setCardsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [selectedChapterId, selectedChapter]);

  useEffect(() => {
    if (!selectedCardId) {
      setCardDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);

    fetch(`/api/flashcards/detail?id=${selectedCardId}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setCardDetail(data.card ?? null);
          setDetailLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCardDetail(null);
          setDetailLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [selectedCardId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ---- Handlers --------------------------------------------------------- */

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectChapter = useCallback((id: string) => {
    setSelectedChapterId(prev => prev === id ? null : id);
    for (const vol of hierarchy) {
      for (const part of vol.children ?? []) {
        for (const ch of part.children ?? []) {
          if (ch.id === id) {
            setExpandedNodes(prev => new Set([...prev, vol.id, part.id]));
            return;
          }
        }
      }
    }
  }, [hierarchy]);

  const handleSelectCard = useCallback((id: string) => {
    setSelectedCardId(prev => prev === id ? null : id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedCardId(null);
    setCardDetail(null);
  }, []);

  /* ---- Collapsed cluster state ----------------------------------------- */

  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(new Set());

  const toggleCluster = useCallback((deck: string) => {
    setCollapsedClusters(prev => {
      const next = new Set(prev);
      if (next.has(deck)) next.delete(deck); else next.add(deck);
      return next;
    });
  }, []);

  /* ---- Render ----------------------------------------------------------- */

  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'due', label: 'تاریخ مرور' },
    { value: 'created', label: 'تاریخ ایجاد' },
    { value: 'alphabetical', label: 'الفبایی' },
    { value: 'importance', label: 'اهمیت' },
  ];

  const FILTER_OPTIONS: { value: QuickFilter; label: string; icon: React.ReactNode; count?: number }[] = [
    { value: 'all', label: 'همه', icon: <Layers style={{ width: 13, height: 13 }} /> },
    { value: 'due', label: 'مرور', icon: <Clock style={{ width: 13, height: 13 }} />, count: totalDue },
    { value: 'new', label: 'جدید', icon: <Sparkles style={{ width: 13, height: 13 }} />, count: totalNew },
    { value: 'leech', label: 'ضعیف', icon: <AlertTriangle style={{ width: 13, height: 13 }} /> },
  ];

  return (
    <div
      dir="rtl"
      data-fclib
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: c.bg,
        color: c.text,
        fontFamily: 'var(--font-vazir, Vazirmatn), Tahoma, system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: FL_STYLES }} />

      {/* Aurora mesh + noise background (matches dashboard) */}
      <div className="fl-mesh" />
      <div className="fl-noise" />

      {/* Accent line at top */}
      <div className="fl-accent-line" />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>

      {/* ================================================================== */}
      {/*  LEFT PANEL — Hierarchy tree                                        */}
      {/* ================================================================== */}
      <aside
        className="fl-pane"
        style={{
          width: SIDEBAR_W,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: `1px solid ${c.border}`,
          borderTop: 'none',
          borderBottom: 'none',
          borderRight: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar header */}
        <div style={{ padding: '18px 18px 12px' }}>
          <Link
            href="/flashcards"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              color: c.textMuted,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              transition: 'color 120ms',
            }}
            title="بازگشت به هاب فلش‌کارت"
          >
            <ChevronLeft style={{ width: 11, height: 11 }} />
            فلش‌کارت
          </Link>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.text, letterSpacing: '-0.01em' }}>
              کتابخانه
            </div>
            <div
              className="fl-tabnum"
              style={{ fontSize: 11, color: c.textMuted }}
            >
              {totalCards.toLocaleString('fa-IR')} {'کارت'}
            </div>
          </div>

          {/* Quick filters */}
          <div style={{ display: 'flex', gap: 4, marginTop: 12, flexWrap: 'wrap' }}>
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                style={filterPillStyle(activeFilter === f.value)}
              >
                {f.icon}
                {f.label}
                {f.count != null && f.count > 0 && (
                  <span
                    className="fl-tabnum"
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: activeFilter === f.value ? c.accent : c.textMuted,
                    }}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: 1, background: c.border, margin: '0 14px' }} />

        {/* Tree */}
        <div className="fl-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {/* All cards button */}
          <button
            onClick={() => setSelectedChapterId(null)}
            style={{
              width: '100%',
              textAlign: 'right',
              padding: '6px 14px',
              fontSize: 12.5,
              fontWeight: !selectedChapterId ? 600 : 500,
              border: 'none',
              background: !selectedChapterId ? c.accentSoft : 'transparent',
              color: !selectedChapterId ? c.accent : c.textSoft,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 120ms',
            }}
          >
            <span style={{ width: 14, flexShrink: 0 }} />
            <Layers style={{ width: 13, height: 13 }} />
            <span style={{ flex: 1 }}>{'نمای کلی'}</span>
            <span className="fl-tabnum" style={{ fontSize: 10.5, color: !selectedChapterId ? c.accent : c.textMuted }}>
              {totalCards}
            </span>
          </button>

          <div style={{ marginTop: 4 }}>
            {hierarchy.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                selectedChapterId={selectedChapterId}
                expandedNodes={expandedNodes}
                activeFilter={activeFilter}
                onToggleExpand={toggleExpand}
                onSelectChapter={handleSelectChapter}
              />
            ))}
          </div>
        </div>

        {/* Bottom action */}
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${c.border}` }}>
          <Link
            href="/flashcards/review"
            className="fl-review-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '11px 0',
              borderRadius: 12,
              background: c.accent,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'background 120ms',
              minHeight: 44,
            }}
          >
            <Brain style={{ width: 14, height: 14 }} />
            {'مطالعه مرور\u200Cها'}
            {totalDue > 0 && (
              <span
                className="fl-tabnum"
                style={{
                  fontSize: 11,
                  padding: '0 7px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.18)',
                  fontWeight: 700,
                }}
              >
                {totalDue}
              </span>
            )}
          </Link>
        </div>
      </aside>

      {/* ================================================================== */}
      {/*  CENTER PANEL — Card list                                           */}
      {/* ================================================================== */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        {/* Center header */}
        <div
          style={{
            padding: '18px 28px 14px',
            borderBottom: `1px solid ${c.border}`,
            background: 'transparent',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {/* Breadcrumb */}
          {breadcrumb.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8, fontSize: 11.5, color: c.textMuted }}>
              {breadcrumb.map((b, i) => (
                <span key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <ChevronLeft style={{ width: 11, height: 11, color: c.border }} />}
                  <span style={{
                    color: i === breadcrumb.length - 1 ? c.textSoft : c.textMuted,
                    fontWeight: i === breadcrumb.length - 1 ? 500 : 400,
                  }}>
                    {b.label}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 10.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
              مرور کلی
            </div>
          )}

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h1
                style={{
                  fontSize: selectedChapter ? 19 : 22,
                  fontWeight: 600,
                  color: c.text,
                  margin: 0,
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                }}
              >
                {selectedChapter ? (
                  <>
                    {selectedChapter.chapterNo != null && (
                      <span
                        className="fl-tabnum"
                        style={{ color: c.textMuted, marginLeft: 8, fontWeight: 500 }}
                      >
                        {selectedChapter.chapterNo}
                      </span>
                    )}
                    {selectedChapter.label}
                  </>
                ) : 'نمای کلی فلش\u200Cکارت\u200Cها'}
              </h1>

              {selectedChapter && (
                <span className="fl-tabnum" style={{ fontSize: 12, color: c.textMuted }}>
                  {cards.length.toLocaleString('fa-IR')} {'کارت'}
                </span>
              )}
            </div>
          </div>

          {/* Action bar */}
          {selectedChapter && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'center' }}>
              {/* Search */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  borderRadius: R_SM,
                  border: `1px solid ${c.border}`,
                  background: c.surface,
                  maxWidth: 420,
                }}
              >
                <Search style={{ width: 14, height: 14, color: c.textMuted, flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={'جستجو در کارت\u200Cها'}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: 12.5,
                    color: c.text,
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, display: 'flex', padding: 2 }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div ref={sortDropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowSortDropdown(p => !p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 10px',
                    borderRadius: R_SM,
                    border: `1px solid ${c.border}`,
                    background: c.surface,
                    fontSize: 12,
                    color: c.textSoft,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <ArrowUpDown style={{ width: 12, height: 12 }} />
                  {SORT_OPTIONS.find(s => s.value === sortMode)?.label}
                  <ChevronDown style={{ width: 11, height: 11 }} />
                </button>
                <AnimatePresence>
                  {showSortDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: 4,
                        background: c.surface,
                        border: `1px solid ${c.border}`,
                        borderRadius: R_SM,
                        boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
                        zIndex: 20,
                        minWidth: 160,
                        overflow: 'hidden',
                      }}
                    >
                      {SORT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortMode(opt.value); setShowSortDropdown(false); }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'right',
                            padding: '7px 12px',
                            fontSize: 12,
                            background: sortMode === opt.value ? c.accentSoft : 'transparent',
                            color: sortMode === opt.value ? c.accent : c.textSoft,
                            fontWeight: sortMode === opt.value ? 600 : 500,
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Study button */}
              <Link
                href={`/flashcards/review${selectedChapter?.chapterNo ? `?chapter=${selectedChapter.chapterNo}` : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: R_SM,
                  background: c.accent,
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'background 120ms',
                }}
              >
                <Play style={{ width: 13, height: 13 }} />
                {'مطالعه این فصل'}
              </Link>
            </div>
          )}
        </div>

        {/* Center body */}
        <div className="fl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {!selectedChapterId ? (
            /* ---- Overview ---- */
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                <SummaryTile label="مجموع کارت" value={totalCards} />
                <SummaryTile label="نیاز به مرور" value={totalDue} />
                <SummaryTile label="کارت جدید" value={totalNew} />
              </div>

              {/* Section label */}
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: c.textMuted,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                  paddingInline: 2,
                }}
              >
                جلدها
              </div>

              {/* Volume rows */}
              <div
                className="fl-pane"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 18,
                  overflow: 'hidden',
                }}
              >
                {hierarchy.map((vol, idx) => (
                  <button
                    key={vol.id}
                    onClick={() => toggleExpand(vol.id)}
                    className="fl-vol-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '16px 18px',
                      background: 'transparent',
                      border: 'none',
                      borderTop: idx === 0 ? 'none' : `1px solid ${c.border}`,
                      cursor: 'pointer',
                      textAlign: 'right',
                      width: '100%',
                      transition: 'background 120ms, transform 0.2s',
                    }}
                  >
                    <BookOpen style={{ width: 15, height: 15, color: c.textMuted, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: c.text, lineHeight: 1.4, letterSpacing: '-0.01em' }}>
                        {vol.label}
                      </div>
                      <div
                        className="fl-tabnum"
                        style={{ fontSize: 11.5, color: c.textMuted, marginTop: 2 }}
                      >
                        {vol.total.toLocaleString('fa-IR')} {'کارت'}
                        {vol.children && ` · ${vol.children.length} بخش`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {vol.due > 0 && (
                        <span style={chipTint(c.warning)}>
                          {vol.due.toLocaleString('fa-IR')} {'مرور'}
                        </span>
                      )}
                      {vol.newCount > 0 && (
                        <span style={chipTint(c.accent)}>
                          +{vol.newCount.toLocaleString('fa-IR')}
                        </span>
                      )}
                      <ChevronLeft style={{ width: 14, height: 14, color: c.textMuted }} />
                    </div>
                  </button>
                ))}
              </div>

              {/* Empty state */}
              {hierarchy.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '56px 20px',
                    color: c.textMuted,
                    fontSize: 13,
                    lineHeight: 2,
                    background: c.surface,
                    border: `1px solid ${c.border}`,
                    borderRadius: R_MD,
                  }}
                >
                  <Library style={{ width: 28, height: 28, color: c.border, margin: '0 auto 12px' }} />
                  <div style={{ color: c.textSoft, fontWeight: 500 }}>
                    {'هنوز فلش\u200Cکارتی ایجاد نشده است'}
                  </div>
                  <div style={{ fontSize: 12 }}>{'از صفحه جزوه یا واردکردن، کارت بسازید.'}</div>
                </div>
              )}
            </div>
          ) : cardsLoading ? (
            /* ---- Loading ---- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div
                  key={i}
                  className="fl-pulse"
                  style={{ height: 44, borderRadius: R_SM, background: c.surfaceSubtle }}
                />
              ))}
            </div>
          ) : cards.length === 0 ? (
            /* ---- Empty ---- */
            <div
              style={{
                textAlign: 'center',
                padding: '56px 20px',
                color: c.textMuted,
                fontSize: 13,
                background: c.surface,
                border: `1px solid ${c.border}`,
                borderRadius: R_MD,
                maxWidth: 640,
                margin: '0 auto',
              }}
            >
              <Layers style={{ width: 26, height: 26, color: c.border, margin: '0 auto 10px' }} />
              <div style={{ color: c.textSoft, fontWeight: 500 }}>
                {'کارتی در این فصل یافت نشد'}
              </div>
            </div>
          ) : (
            /* ---- Concept clusters ---- */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {Array.from(clusters.entries()).map(([deck, deckCards]) => {
                const isCollapsed = collapsedClusters.has(deck);
                const deckDue = deckCards.filter(cd => cd.fsrsDue && cd.fsrsDue <= Date.now()).length;

                return (
                  <div key={deck}>
                    {/* Cluster header — flat section header */}
                    <button
                      onClick={() => toggleCluster(deck)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 2px 8px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${c.border}`,
                        cursor: 'pointer',
                        textAlign: 'right',
                      }}
                    >
                      <span
                        style={{
                          width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: c.textMuted, transition: 'transform 150ms',
                          transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                        }}
                      >
                        <ChevronLeft style={{ width: 11, height: 11 }} />
                      </span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: c.text, letterSpacing: '-0.01em' }}>
                        {deck}
                      </span>
                      <span className="fl-tabnum" style={{ fontSize: 11, color: c.textMuted }}>
                        {deckCards.length.toLocaleString('fa-IR')} {'کارت'}
                      </span>
                      {deckDue > 0 && (
                        <span style={chipTint(c.warning)}>
                          {deckDue.toLocaleString('fa-IR')} {'مرور'}
                        </span>
                      )}
                    </button>

                    {/* Card rows */}
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          transition={{ duration: 0.18 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ marginTop: 2 }}>
                            {deckCards.map((card, ci) => {
                              const st = stateLabel(card.state);
                              const isActive = selectedCardId === card.id;
                              const isLast = ci === deckCards.length - 1;
                              return (
                                <button
                                  key={card.id}
                                  onClick={() => handleSelectCard(card.id)}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '8px 10px',
                                    background: isActive ? c.accentSoft : 'transparent',
                                    border: 'none',
                                    borderBottom: isLast ? 'none' : `1px solid ${c.border}`,
                                    cursor: 'pointer',
                                    textAlign: 'right',
                                    transition: 'background 80ms',
                                  }}
                                >
                                  <span
                                    style={{
                                      flex: 1,
                                      fontSize: 12.5,
                                      color: isActive ? c.accent : c.text,
                                      fontWeight: isActive ? 600 : 400,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      lineHeight: 1.6,
                                      direction: 'rtl',
                                    }}
                                    dir="rtl"
                                    lang="fa"
                                    data-bidi-text="flashcard"
                                  >
                                    <BidiText text={stripHtml(card.frontHtml)} />
                                  </span>

                                  {card.isLeech && (
                                    <AlertTriangle style={{ width: 12, height: 12, color: c.danger, flexShrink: 0 }} />
                                  )}

                                  <span style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    color: st.color,
                                    flexShrink: 0,
                                  }}>
                                    {st.text}
                                  </span>

                                  <span
                                    className="fl-tabnum"
                                    style={{
                                      fontSize: 10.5,
                                      color: c.textMuted,
                                      flexShrink: 0,
                                      minWidth: 64,
                                      textAlign: 'left',
                                    }}
                                  >
                                    {formatDueDate(card.fsrsDue)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {clusters.size === 0 && cards.length > 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: c.textMuted,
                    fontSize: 12.5,
                  }}
                >
                  {'نتیجه\u200Cای با این فیلتر یافت نشد.'}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ================================================================== */}
      {/*  RIGHT PANEL — Card detail                                          */}
      {/* ================================================================== */}
      <AnimatePresence>
        {selectedCardId && (
          <motion.aside
            key="detail-panel"
            className="fl-pane"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: DETAIL_W, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRight: `1px solid ${c.border}`,
              borderTop: 'none',
              borderBottom: 'none',
              borderLeft: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Detail header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: `1px solid ${c.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  کارت
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: c.text, marginTop: 2 }}>
                  {'جزئیات'}
                </div>
              </div>
              <button
                onClick={handleCloseDetail}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: `1px solid ${c.border}`,
                  cursor: 'pointer',
                  color: c.textMuted,
                  transition: 'all 100ms',
                }}
              >
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>

            {/* Detail body */}
            <div className="fl-scroll" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
              {detailLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="fl-pulse"
                      style={{
                        height: i === 1 ? 80 : 40,
                        borderRadius: R_SM,
                        background: c.surfaceSubtle,
                      }}
                    />
                  ))}
                </div>
              ) : cardDetail ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Front */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: R_MD,
                      background: c.surfaceSubtle,
                      border: `1px solid ${c.border}`,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      {'جلو'}
                    </div>
                    <div
                      style={{ fontSize: 13.5, color: c.text, lineHeight: 1.8, direction: 'rtl' }}
                      dir="rtl"
                      lang="fa"
                      data-bidi-text="flashcard"
                      dangerouslySetInnerHTML={{ __html: processHtmlBidi(cardDetail.frontHtml) }}
                    />
                  </div>

                  {/* Back */}
                  <div
                    style={{
                      padding: 14,
                      borderRadius: R_MD,
                      background: c.surface,
                      border: `1px solid ${c.accentBorder}`,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: c.accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                      {'پشت'}
                    </div>
                    <div
                      style={{ fontSize: 13.5, color: c.text, lineHeight: 1.8, direction: 'rtl' }}
                      dir="rtl"
                      lang="fa"
                      data-bidi-text="flashcard"
                      dangerouslySetInnerHTML={{ __html: processHtmlBidi(cardDetail.backHtml) }}
                    />
                  </div>

                  {/* Source context */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: R_MD,
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                      {'منبع'}
                    </div>

                    {cardDetail.chapterNo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: c.textSoft, lineHeight: 1.6 }}>
                        <BookOpen style={{ width: 13, height: 13, color: c.textMuted, flexShrink: 0 }} />
                        <span>
                          {cardDetail.volumeNo && `جلد ${cardDetail.volumeNo} · `}
                          {cardDetail.partTitle && `${cardDetail.partTitle} · `}
                          {'فصل '}{cardDetail.chapterNo}
                          {cardDetail.chapterTitle && ` · ${cardDetail.chapterTitle}`}
                        </span>
                      </div>
                    )}

                    {cardDetail.sourceDocId && (
                      <Link
                        href={`/notes/${cardDetail.sourceDocId}${cardDetail.sourceFrameId ? `?frame=${cardDetail.sourceFrameId}` : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: c.accent,
                          textDecoration: 'none',
                        }}
                      >
                        <FileText style={{ width: 13, height: 13, flexShrink: 0 }} />
                        {'مشاهده جزوه'}
                        <ExternalLink style={{ width: 10, height: 10, opacity: 0.6 }} />
                      </Link>
                    )}

                    {cardDetail.relatedQuestionCount > 0 && (
                      <Link
                        href={`/qbank?chapter=${cardDetail.chapterNo}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: c.accent,
                          textDecoration: 'none',
                        }}
                      >
                        <HelpCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
                        {'مشاهده سوالات'}
                        <span style={chipMuted}>{cardDetail.relatedQuestionCount}</span>
                      </Link>
                    )}
                  </div>

                  {/* Related cards */}
                  {cardDetail.relatedCards && cardDetail.relatedCards.length > 0 && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: R_MD,
                        background: c.surface,
                        border: `1px solid ${c.border}`,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
                        {'کارت\u200Cهای مرتبط'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {cardDetail.relatedCards.slice(0, 5).map(rc => {
                          const rst = stateLabel(rc.state);
                          return (
                            <button
                              key={rc.id}
                              onClick={() => setSelectedCardId(rc.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 8px',
                                borderRadius: 6,
                                background: selectedCardId === rc.id ? c.accentSoft : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'right',
                                width: '100%',
                                fontSize: 12,
                                transition: 'background 80ms',
                              }}
                            >
                              <span
                                style={{
                                  flex: 1,
                                  color: c.textSoft,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  direction: 'rtl',
                                }}
                                dir="rtl"
                                lang="fa"
                                data-bidi-text="flashcard"
                              >
                                <BidiText text={stripHtml(rc.frontHtml)} />
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: rst.color,
                                }}
                              >
                                {rst.text}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {cardDetail.tags && cardDetail.tags.length > 0 && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: R_MD,
                        background: c.surface,
                        border: `1px solid ${c.border}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Tag style={{ width: 11, height: 11, color: c.textMuted }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                          {'برچسب\u200Cها'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {cardDetail.tags.map((tag, ti) => (
                          <span key={ti} style={chipMuted}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SRS meta */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: R_MD,
                      background: c.surface,
                      border: `1px solid ${c.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <BarChart3 style={{ width: 11, height: 11, color: c.textMuted }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: c.textMuted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                        {'اطلاعات SRS'}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        rowGap: 10,
                        columnGap: 16,
                        fontSize: 12,
                      }}
                    >
                      {[
                        { label: 'وضعیت', value: stateLabel(cardDetail.state).text },
                        { label: 'موعد مرور', value: formatDueDate(cardDetail.fsrsDue) },
                        { label: 'فاصله', value: `${cardDetail.intervalDays} روز` },
                        { label: 'اهمیت', value: `${cardDetail.importance}/10` },
                        { label: 'Leech', value: cardDetail.isLeech ? 'بله' : 'خیر' },
                        { label: 'نوع کارت', value: cardDetail.cardType.replace(/_/g, ' ') },
                      ].map((m, mi) => (
                        <div key={mi}>
                          <div style={{ fontSize: 10, color: c.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {m.label}
                          </div>
                          <div
                            className="fl-tabnum"
                            style={{ fontSize: 12.5, fontWeight: 500, color: c.text, marginTop: 2 }}
                          >
                            {m.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link
                      href={`/flashcards/review?cardId=${cardDetail.id}`}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '9px 0',
                        borderRadius: R_SM,
                        background: c.accent,
                        color: '#fff',
                        fontSize: 12.5,
                        fontWeight: 600,
                        textDecoration: 'none',
                        transition: 'background 100ms',
                      }}
                    >
                      <Play style={{ width: 13, height: 13 }} />
                      {'مطالعه'}
                    </Link>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: '9px 12px',
                        borderRadius: R_SM,
                        background: 'transparent',
                        border: `1px solid ${c.border}`,
                        color: c.textSoft,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <Pause style={{ width: 12, height: 12 }} />
                      {'تعلیق'}
                    </button>
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        padding: '9px 12px',
                        borderRadius: R_SM,
                        background: 'transparent',
                        border: `1px solid ${c.border}`,
                        color: c.danger,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} />
                      {'حذف'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: c.textMuted, fontSize: 12.5 }}>
                  {'اطلاعاتی یافت نشد.'}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
