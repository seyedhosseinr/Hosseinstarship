'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, SlidersHorizontal, Play, BookmarkCheck, Bookmark,
  ChevronDown, ChevronUp, Eye, EyeOff, ChevronRight,
  Layers, GraduationCap, FolderPlus, FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { colorLight, colorDark } from '@/lib/theme/tokens';
import { PageHeader } from '@/components/ui/page-header';
import { AmbossReviewPanel } from '@/components/qbank/AmbossReviewPanel';
import type { QBankQuestion } from '@/lib/qbank/queries';
import {
  getAllSubjects,
  getAllChapters,
} from '@/lib/exam/campbell-exam-builder';
import { useCollections } from '@/hooks/useCollections';

/* ── CSS-variable bridge for automatic dark mode ── */
const QB_STYLES = `
[data-qbank] {
${Object.entries(colorLight).map(([k, v]) => `  --qb-${k}: ${v};`).join('\n')}
}
.dark [data-qbank] {
${Object.entries(colorDark).map(([k, v]) => `  --qb-${k}: ${v};`).join('\n')}
}
`;
const C = Object.fromEntries(
  Object.keys(colorLight).map(k => [k, `var(--qb-${k})`]),
) as Record<keyof typeof colorLight, string>;

type DiffFilter = 'all' | 'easy' | 'medium' | 'hard';

const DIFFICULTY_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  easy:   { label: '\u0622\u0633\u0627\u0646', bg: 'rgba(22,163,74,0.08)', color: C.success },
  medium: { label: '\u0645\u062A\u0648\u0633\u0637', bg: 'rgba(217,119,6,0.08)', color: C.warning },
  hard:   { label: '\u0633\u062E\u062A', bg: 'rgba(220,38,38,0.08)', color: C.danger },
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/* ------------------------------------------------------------------ */
/*  Campbell sidebar — static data from schema                         */
/* ------------------------------------------------------------------ */

const ALL_SUBJECTS = getAllSubjects();
const ALL_CHAPTERS = getAllChapters();
const CHAPTER_TITLE_MAP = new Map(ALL_CHAPTERS.map(c => [c.id, c.title]));

interface QBankScreenProps {
  questions: QBankQuestion[];
  initialChapterId?: string | null;
}

export default function QBankScreen({ questions: initialQuestions, initialChapterId }: QBankScreenProps) {
  const router = useRouter();

  const [questions, setQuestions] = useState<QBankQuestion[]>(initialQuestions);

  // Sidebar selection
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Question list state
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Collections (saved questions / folders)
  const { collections, addItem, isBookmarked: isInCollection } = useCollections();
  const [saveMenuOpen, setSaveMenuOpen] = useState<string | null>(null);

  // Close save-menu on any outside click
  useEffect(() => {
    if (!saveMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-save-menu]')) setSaveMenuOpen(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [saveMenuOpen]);

  // ── Persistent QBank filters ──
  const hydrated = useRef(false);

  // Rehydrate filters from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('starship:qbank-filters');
      if (!raw) { hydrated.current = true; return; }
      const saved = JSON.parse(raw);
      if (saved.diffFilter) setDiffFilter(saved.diffFilter);
      if (saved.bookmarkOnly === true) setBookmarkOnly(true);
      if (saved.sidebarOpen !== undefined) setSidebarOpen(saved.sidebarOpen);
    } catch { /* ignore */ }
    hydrated.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only

  // Persist filter state whenever it changes — but skip until rehydration is done
  const persistFilters = useCallback(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem('starship:qbank-filters', JSON.stringify({
        diffFilter,
        bookmarkOnly,
        sidebarOpen,
      }));
    } catch { /* ignore */ }
  }, [diffFilter, bookmarkOnly, sidebarOpen]);

  useEffect(() => { persistFilters(); }, [persistFilters]);
  const [showAnswer, setShowAnswer] = useState<Set<string>>(new Set());

  // Chapter / system / subject question counts
  // Questions are tagged with non-padded IDs like "ch-95",
  // but the Campbell schema uses zero-padded IDs like "ch-095".
  // Build counts indexed by BOTH formats so sidebar lookups work.
  const chapterCounts = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach(q => {
      (q.tags ?? []).forEach(t => {
        if (!t.startsWith('ch-')) return;
        const n = parseInt(t.replace(/^ch-0*/i, ''), 10);
        if (isNaN(n)) return;
        // Index by both non-padded ("ch-95") and padded ("ch-095") forms
        const unpadded = `ch-${n}`;
        const padded = `ch-${String(n).padStart(3, '0')}`;
        map.set(unpadded, (map.get(unpadded) ?? 0) + 1);
        if (padded !== unpadded) map.set(padded, (map.get(padded) ?? 0) + 1);
      });
    });
    return map;
  }, [questions]);

  const systemCounts = useMemo(() => {
    const map = new Map<string, number>();
    ALL_SUBJECTS.forEach(sub =>
      sub.systems.forEach(sys => {
        const n = sys.chapterIds.reduce((s, cid) => s + (chapterCounts.get(cid) ?? 0), 0);
        if (n > 0) map.set(sys.id, n);
      }),
    );
    return map;
  }, [chapterCounts]);

  const subjectCounts = useMemo(() => {
    const map = new Map<string, number>();
    ALL_SUBJECTS.forEach(sub => {
      const n = sub.systems.reduce((s, sys) => s + (systemCounts.get(sys.id) ?? 0), 0);
      if (n > 0) map.set(sub.id, n);
    });
    return map;
  }, [systemCounts]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = questions;
    if (selectedChapterId) {
      list = list.filter(q => (q.tags ?? []).includes(selectedChapterId));
    } else if (selectedSystemId) {
      const chapIds = new Set<string>();
      ALL_SUBJECTS.forEach(sub =>
        sub.systems.forEach(sys => {
          if (sys.id === selectedSystemId) sys.chapterIds.forEach(id => chapIds.add(id));
        }),
      );
      list = list.filter(q => (q.tags ?? []).some(t => chapIds.has(t)));
    } else if (selectedSubjectId) {
      list = list.filter(q => q.subject === selectedSubjectId);
    }
    if (search) {
      const sq = search.toLowerCase();
      list = list.filter(item =>
        item.text.toLowerCase().includes(sq) ||
        (item.subject ?? '').toLowerCase().includes(sq) ||
        (item.tags ?? []).some(t => t.toLowerCase().includes(sq)),
      );
    }
    if (diffFilter !== 'all') list = list.filter(item => item.difficulty === diffFilter);
    if (bookmarkOnly) list = list.filter(item => item.bookmarked);
    return list;
  }, [questions, search, diffFilter, bookmarkOnly, selectedChapterId, selectedSystemId, selectedSubjectId]);

  // Sidebar interaction helpers
  function toggleSubjectExpand(id: string) {
    setExpandedSubjects(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSystemExpand(id: string) {
    setExpandedSystems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectSubject(id: string) {
    setSelectedSubjectId(id === selectedSubjectId ? null : id);
    setSelectedSystemId(null);
    setSelectedChapterId(null);
  }
  function selectSystem(subjectId: string, systemId: string) {
    setSelectedSubjectId(subjectId);
    setSelectedSystemId(systemId === selectedSystemId ? null : systemId);
    setSelectedChapterId(null);
    setExpandedSubjects(prev => new Set([...prev, subjectId]));
  }
  function selectChapter(subjectId: string, systemId: string, chapterId: string) {
    // Normalize to non-padded form so it matches question tags (e.g. "ch-95" not "ch-095")
    const n = parseInt(chapterId.replace(/^ch-0*/i, ''), 10);
    const normalizedId = !isNaN(n) ? `ch-${n}` : chapterId;
    const currentNorm = selectedChapterId ? parseInt(selectedChapterId.replace(/^ch-0*/i, ''), 10) : NaN;
    const isDeselect = !isNaN(currentNorm) && currentNorm === n;
    setSelectedSubjectId(subjectId);
    setSelectedSystemId(systemId);
    setSelectedChapterId(isDeselect ? null : normalizedId);
    setExpandedSubjects(prev => new Set([...prev, subjectId]));
    setExpandedSystems(prev => new Set([...prev, systemId]));
  }
  function clearSelection() {
    setSelectedSubjectId(null);
    setSelectedSystemId(null);
    setSelectedChapterId(null);
  }

  useEffect(() => {
    if (!initialChapterId) return;
    // Normalize incoming ID to a plain number for matching.
    // URL sends "ch-95", schema stores "ch-095" — strip prefix, parse, reformat both ways.
    const incomingNum = parseInt(initialChapterId.replace(/^ch-0*/i, ''), 10);
    if (isNaN(incomingNum)) return;
    for (const sub of ALL_SUBJECTS) {
      for (const sys of sub.systems) {
        const match = sys.chapterIds.find(cid => {
          const n = parseInt(cid.replace(/^ch-0*/i, ''), 10);
          return n === incomingNum;
        });
        if (match) {
          setSelectedSubjectId(sub.id);
          setSelectedSystemId(sys.id);
          // Use the tag format (ch-N without padding) for question filtering
          setSelectedChapterId(`ch-${incomingNum}`);
          setExpandedSubjects(new Set([sub.id]));
          setExpandedSystems(new Set([sys.id]));
          return;
        }
      }
    }
  }, [initialChapterId]);

  const toggleBookmark = async (q: QBankQuestion) => {
    // Optimistic update so the UI stays responsive; roll back if the
    // server call fails so we never desync from the DB.
    const nextBookmarked = !q.bookmarked;
    setQuestions(prev =>
      prev.map(item =>
        item.id === q.id ? { ...item, bookmarked: nextBookmarked } : item,
      ),
    );
    try {
      const res = await fetch('/api/questions/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id }),
      });
      if (!res.ok) throw new Error('bookmark toggle failed');
      const data = await res.json() as { ok: boolean; bookmarked?: boolean };
      // Reconcile with server truth (handles out-of-order clicks).
      if (data.ok && typeof data.bookmarked === 'boolean') {
        setQuestions(prev =>
          prev.map(item =>
            item.id === q.id ? { ...item, bookmarked: data.bookmarked! } : item,
          ),
        );
      }
    } catch {
      setQuestions(prev =>
        prev.map(item =>
          item.id === q.id ? { ...item, bookmarked: q.bookmarked } : item,
        ),
      );
    }
  };
  const toggleAnswer = (id: string) => {
    setShowAnswer(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const selectionLabel = useMemo(() => {
    if (selectedChapterId) {
      // selectedChapterId is non-padded ("ch-95"); CHAPTER_TITLE_MAP keys are padded ("ch-095")
      const n = parseInt(selectedChapterId.replace(/^ch-0*/i, ''), 10);
      const paddedKey = !isNaN(n) ? `ch-${String(n).padStart(3, '0')}` : selectedChapterId;
      return CHAPTER_TITLE_MAP.get(paddedKey) ?? CHAPTER_TITLE_MAP.get(selectedChapterId) ?? selectedChapterId;
    }
    if (selectedSystemId) {
      for (const sub of ALL_SUBJECTS) {
        const sys = sub.systems.find(s => s.id === selectedSystemId);
        if (sys) return sys.label;
      }
    }
    if (selectedSubjectId) return ALL_SUBJECTS.find(s => s.id === selectedSubjectId)?.label ?? selectedSubjectId;
    return null;
  }, [selectedChapterId, selectedSystemId, selectedSubjectId]);

  const hasFilter = !!(selectedSubjectId || selectedSystemId || selectedChapterId);

  return (
    <div data-qbank style={{ minHeight: '100vh', background: C.bg }} dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: QB_STYLES }} />

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '24px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <PageHeader
            breadcrumb={[
              { label: '\u062F\u0627\u0634\u0628\u0648\u0631\u062F', href: '/' },
              { label: '\u0628\u0627\u0646\u06A9 \u0633\u0624\u0627\u0644\u0627\u062A' },
            ]}
            title="\u0628\u0627\u0646\u06A9 \u0633\u0624\u0627\u0644\u0627\u062A"
            description={
              questions.length + ' \u0633\u0624\u0627\u0644' +
              (filtered.length !== questions.length ? ' \u2022 ' + filtered.length + ' \u0646\u062A\u06CC\u062C\u0647' : '') +
              (selectionLabel ? ' \u2022 ' + selectionLabel : '')
            }
            compact
            className="mb-4 pt-0"
            actions={
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSidebarOpen(o => !o)}
                  style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${sidebarOpen ? C.accent : C.border}`, background: sidebarOpen ? C.accentSoft : C.surface, color: sidebarOpen ? C.accent : C.textMuted, cursor: 'pointer' }}
                >
                  <Layers style={{ width: 18, height: 18 }} />
                </button>
                <button
                  onClick={() => router.push('/exam/builder')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: C.accent, color: C.surface, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,165,164,0.2)' }}
                >
                  <Play style={{ width: 16, height: 16 }} />
                  {'\u0634\u0631\u0648\u0639 \u0622\u0632\u0645\u0648\u0646'}
                </button>
              </div>
            }
          />
          {/* Search row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: C.surfaceSubtle }}>
              <Search style={{ width: 18, height: 18, color: C.textMuted }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={'\u062C\u0633\u062A\u062C\u0648 \u062F\u0631 \u0633\u0624\u0627\u0644\u0627\u062A...'}
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, color: C.text }}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${showFilters ? C.accent : C.border}`, background: showFilters ? C.accentSoft : C.surface, color: showFilters ? C.accent : C.textMuted, cursor: 'pointer' }}
            >
              <SlidersHorizontal style={{ width: 18, height: 18 }} />
            </button>
          </div>
          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['all', 'easy', 'medium', 'hard'] as DiffFilter[]).map(d => (
                    <button key={d} onClick={() => setDiffFilter(d)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${diffFilter === d ? C.accent : C.border}`, background: diffFilter === d ? C.accentSoft : C.surface, color: diffFilter === d ? C.accent : C.textSoft, cursor: 'pointer' }}>
                      {d === 'all' ? '\u0647\u0645\u0647' : DIFFICULTY_STYLES[d]?.label}
                    </button>
                  ))}
                  <button
                    onClick={() => setBookmarkOnly(!bookmarkOnly)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${bookmarkOnly ? C.warning : C.border}`, background: bookmarkOnly ? 'rgba(245,158,11,0.06)' : C.surface, color: bookmarkOnly ? C.warning : C.textSoft, cursor: 'pointer' }}
                  >
                    {bookmarkOnly ? <BookmarkCheck style={{ width: 14, height: 14 }} /> : <Bookmark style={{ width: 14, height: 14 }} />}
                    {'\u0646\u0634\u0627\u0646\u200C\u06AF\u0630\u0627\u0631\u06CC'}
                  </button>
                  {hasFilter && (
                    <button onClick={clearSelection} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, border: `1px solid ${C.danger}`, background: 'rgba(220,38,38,0.05)', color: C.danger, cursor: 'pointer' }}>
                      {'\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u0641\u06CC\u0644\u062A\u0631 \u0641\u0635\u0644'}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: 20, display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ flexShrink: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 200px)', position: 'sticky', top: 140, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, overflowX: 'hidden' }}
            >
              {/* Sidebar header */}
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, background: C.surface, zIndex: 1 }}>
                <GraduationCap style={{ width: 16, height: 16, color: C.accent }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                  {'\u0641\u0635\u0644\u200C\u0647\u0627\u06CC Campbell'}
                </span>
                {hasFilter && (
                  <button onClick={clearSelection} style={{ marginRight: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.danger}`, background: 'transparent', color: C.danger, cursor: 'pointer' }}>
                    {'\u067E\u0627\u06A9'}
                  </button>
                )}
              </div>
              {/* All questions button */}
              <button
                onClick={clearSelection}
                style={{ width: '100%', textAlign: 'right', padding: '10px 16px', fontSize: 13, border: 'none', background: !selectedSubjectId ? C.accentSoft : 'transparent', color: !selectedSubjectId ? C.accent : C.textSoft, cursor: 'pointer', borderBottom: `1px solid ${C.border}`, fontWeight: !selectedSubjectId ? 600 : 400 }}
              >
                {'\u0647\u0645\u0647 \u0633\u0624\u0627\u0644\u0627\u062A'} ({questions.length})
              </button>

              {/* Subject tree */}
              {ALL_SUBJECTS.map(sub => {
                const subCount = subjectCounts.get(sub.id) ?? 0;
                if (subCount === 0) return null;
                const subExpanded = expandedSubjects.has(sub.id);
                const subSelected = selectedSubjectId === sub.id && !selectedSystemId;
                return (
                  <div key={sub.id}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button onClick={() => toggleSubjectExpand(sub.id)} style={{ width: 28, height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted }}>
                        {subExpanded ? <ChevronDown style={{ width: 14, height: 14 }} /> : <ChevronRight style={{ width: 14, height: 14 }} />}
                      </button>
                      <button onClick={() => selectSubject(sub.id)} style={{ flex: 1, textAlign: 'right', padding: '8px 8px 8px 0', fontSize: 12, border: 'none', background: subSelected ? C.accentSoft : 'transparent', color: subSelected ? C.accent : C.text, cursor: 'pointer', fontWeight: subSelected ? 600 : 500, lineHeight: 1.4 }}>
                        {sub.label}
                      </button>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: C.surfaceSubtle, color: C.textMuted, marginLeft: 8, flexShrink: 0 }}>{subCount}</span>
                    </div>
                    {subExpanded && sub.systems.map(sys => {
                      const sysCount = systemCounts.get(sys.id) ?? 0;
                      if (sysCount === 0) return null;
                      const sysExpanded = expandedSystems.has(sys.id);
                      const sysSelected = selectedSystemId === sys.id && !selectedChapterId;
                      return (
                        <div key={sys.id} style={{ paddingRight: 28 }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button onClick={() => toggleSystemExpand(sys.id)} style={{ width: 24, height: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted }}>
                              {sysExpanded ? <ChevronDown style={{ width: 12, height: 12 }} /> : <ChevronRight style={{ width: 12, height: 12 }} />}
                            </button>
                            <button onClick={() => selectSystem(sub.id, sys.id)} style={{ flex: 1, textAlign: 'right', padding: '6px 6px 6px 0', fontSize: 11.5, border: 'none', background: sysSelected ? C.accentSoft : 'transparent', color: sysSelected ? C.accent : C.textSoft, cursor: 'pointer', fontWeight: sysSelected ? 600 : 400, lineHeight: 1.4 }}>
                              {sys.label}
                            </button>
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: C.surfaceSubtle, color: C.textMuted, marginLeft: 8, flexShrink: 0 }}>{sysCount}</span>
                          </div>
                          {sysExpanded && sys.chapterIds.map(cid => {
                            const cCount = chapterCounts.get(cid) ?? 0;
                            if (cCount === 0) return null;
                            const chNo = parseInt(cid.replace(/^ch-0*/i, ''), 10);
                            const chTitle = CHAPTER_TITLE_MAP.get(cid) ?? cid;
                            // Compare normalized (strip leading zeros from both)
                            const selectedNum = selectedChapterId ? parseInt(selectedChapterId.replace(/^ch-0*/i, ''), 10) : NaN;
                            const chSelected = !isNaN(selectedNum) && selectedNum === chNo;
                            return (
                              <button
                                key={cid}
                                onClick={() => selectChapter(sub.id, sys.id, cid)}
                                style={{ width: '100%', textAlign: 'right', paddingRight: 24, paddingLeft: 8, paddingTop: 5, paddingBottom: 5, fontSize: 11, border: 'none', background: chSelected ? C.accentSoft : 'transparent', color: chSelected ? C.accent : C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1.4, fontWeight: chSelected ? 600 : 400 }}
                              >
                                <span style={{ fontSize: 10, fontWeight: 600, minWidth: 22, flexShrink: 0 }}>{chNo}</span>
                                <span style={{ flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chTitle}</span>
                                <span style={{ fontSize: 10, padding: '0px 4px', borderRadius: 6, background: C.surfaceSubtle, color: C.textMuted, flexShrink: 0 }}>{cCount}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Questions */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>{'\u0633\u0624\u0627\u0644\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F'}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((q, qi) => {
                const isExpanded = expanded === q.id;
                const isShowAnswer = showAnswer.has(q.id);
                const diff = q.difficulty ? DIFFICULTY_STYLES[q.difficulty] : null;
                const chapterTag = (q.tags ?? []).find(t => t.startsWith('ch-'));
                const chNo = chapterTag ? parseInt(chapterTag.replace(/^ch-0*/i, ''), 10) : undefined;
                // CHAPTER_TITLE_MAP keys are padded ("ch-095"); tags are non-padded ("ch-95")
                const paddedTag = chNo != null ? `ch-${String(chNo).padStart(3, '0')}` : undefined;
                const chLabel = paddedTag ? CHAPTER_TITLE_MAP.get(paddedTag) : undefined;

                return (
                  <motion.div key={q.id} layout style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

                    {/* Row header */}
                    <button onClick={() => setExpanded(isExpanded ? null : q.id)} style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, minWidth: 24 }}>{qi + 1}</span>
                      <span style={{ flex: 1, fontSize: 14, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap', lineHeight: 1.6, textAlign: 'right' }}>{q.text}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {chNo !== undefined && (
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: C.accentSoft, color: C.accent, fontWeight: 600 }}>
                            {'\u0641\u0635\u0644'} {chNo}
                          </span>
                        )}
                        {diff && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: diff.bg, color: diff.color }}>{diff.label}</span>}
                        {q.bookmarked && <BookmarkCheck style={{ width: 14, height: 14, color: C.warning }} />}
                        {isExpanded ? <ChevronUp style={{ width: 16, height: 16, color: C.textMuted }} /> : <ChevronDown style={{ width: 16, height: 16, color: C.textMuted }} />}
                      </div>
                    </button>

                    {/* Expanded body */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                          <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.border}` }}>
                            {/* Meta */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '12px 0 8px' }}>
                              {chLabel && (
                                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 8, background: C.accentSoft, color: C.accent, fontWeight: 500 }}>
                                  {'\u0641\u0635\u0644'} {chNo}: {chLabel}
                                </span>
                              )}
                              {(q.tags ?? []).filter(t => !t.startsWith('ch-')).map(t => (
                                <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: C.surfaceSubtle, color: C.textMuted }}>{t}</span>
                              ))}
                            </div>
                            {/* Options */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                              {q.options.map((opt, oi) => {
                                const isCorrect = oi === q.answer;
                                return (
                                  <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: isShowAnswer && isCorrect ? 'rgba(22,163,74,0.06)' : C.surfaceSubtle, border: `1px solid ${isShowAnswer && isCorrect ? C.success : 'transparent'}`, fontSize: 13 }}>
                                    <span style={{ width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: isShowAnswer && isCorrect ? C.success : C.surface, color: isShowAnswer && isCorrect ? '#fff' : C.textSoft }}>
                                      {OPTION_LETTERS[oi]}
                                    </span>
                                    <span style={{ color: C.text }}>{opt}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Action buttons */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button onClick={() => toggleAnswer(q.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, background: 'transparent', border: `1px solid ${C.border}`, color: C.textSoft, cursor: 'pointer', minHeight: 44 }}>
                                {isShowAnswer ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                                {isShowAnswer ? '\u0645\u062E\u0641\u06CC \u06A9\u0631\u062F\u0646 \u067E\u0627\u0633\u062E' : '\u0646\u0645\u0627\u06CC\u0634 \u067E\u0627\u0633\u062E'}
                              </button>
                              <button onClick={() => toggleBookmark(q)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, background: q.bookmarked ? 'rgba(245,158,11,0.06)' : 'transparent', border: `1px solid ${q.bookmarked ? C.warning : C.border}`, color: q.bookmarked ? C.warning : C.textSoft, cursor: 'pointer', minHeight: 44 }}>
                                {q.bookmarked ? <BookmarkCheck style={{ width: 14, height: 14 }} /> : <Bookmark style={{ width: 14, height: 14 }} />}
                                {q.bookmarked ? '\u062D\u0630\u0641 \u0646\u0634\u0627\u0646' : '\u0646\u0634\u0627\u0646\u200C\u06AF\u0630\u0627\u0631\u06CC'}
                              </button>

                              {/* Save to Collection */}
                              <div style={{ position: 'relative' }} data-save-menu>
                                <button
                                  onClick={() => setSaveMenuOpen(saveMenuOpen === q.id ? null : q.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, background: isInCollection(`/qbank?q=${q.id}`) ? 'rgba(13,148,136,0.06)' : 'transparent', border: `1px solid ${isInCollection(`/qbank?q=${q.id}`) ? C.accent : C.border}`, color: isInCollection(`/qbank?q=${q.id}`) ? C.accent : C.textSoft, cursor: 'pointer', minHeight: 44 }}
                                >
                                  <FolderPlus style={{ width: 14, height: 14 }} />
                                  {'\u0630\u062E\u06CC\u0631\u0647'}
                                </button>
                                {saveMenuOpen === q.id && (
                                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 180, overflow: 'hidden' }}>
                                    {collections.map(col => (
                                      <button
                                        key={col.id}
                                        onClick={() => {
                                          addItem(col.id, {
                                            type: 'question',
                                            title: q.text.slice(0, 80),
                                            href: `/qbank?q=${q.id}`,
                                            chapterNo: chNo,
                                          });
                                          setSaveMenuOpen(null);
                                        }}
                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 12, border: 'none', background: 'transparent', color: C.text, cursor: 'pointer', textAlign: 'right', minHeight: 44 }}
                                        onMouseEnter={e => (e.currentTarget.style.background = C.surfaceSubtle)}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <FolderOpen style={{ width: 14, height: 14, color: C.accent, flexShrink: 0 }} />
                                        <span style={{ flex: 1 }}>{col.name}</span>
                                        <span style={{ fontSize: 10, color: C.textMuted }}>{col.items.length}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Explanation */}
                            {isShowAnswer && q.review && (
                              <AmbossReviewPanel
                                stem={q.text}
                                options={q.options}
                                optionKeys={q.optionKeys}
                                correctAnswer={q.correctAnswer}
                                review={q.review}
                              />
                            )}
                            {isShowAnswer && !q.review && q.explanation && (
                              <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: C.accentSoft, border: `1px solid ${C.accentBorder}`, fontSize: 13, lineHeight: 1.8, color: C.text, whiteSpace: 'pre-wrap' }}>
                                {q.explanation}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
