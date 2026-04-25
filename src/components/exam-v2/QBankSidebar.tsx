"use client";

/**
 * QBankSidebar  v4.0 — Flagship 2026
 * Uses QB-* CSS classes defined in QBankBrowser.
 */

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface SidebarSubject {
  id: string;
  label: string;
  systems: { id: string; label: string; chapterIds: string[] }[];
}

export interface QBankSidebarProps {
  subjects: SidebarSubject[];
  chapterCounts: Map<string, number>;
  chapterTitleMap: Map<string, string>;
  selectedSubjectId: string | null;
  selectedSystemId: string | null;
  selectedChapterId: string | null;
  onSelectSubject: (id: string | null) => void;
  onSelectSystem: (id: string | null) => void;
  onSelectChapter: (id: string | null) => void;
  className?: string;
}

export function QBankSidebar({
  subjects,
  chapterCounts,
  chapterTitleMap,
  selectedSubjectId,
  selectedSystemId,
  selectedChapterId,
  onSelectSubject,
  onSelectSystem,
  onSelectChapter,
}: QBankSidebarProps) {
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedSystems,  setExpandedSystems]  = useState<Set<string>>(new Set());

  const toggleSubject = (id: string) => setExpandedSubjects(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const toggleSystem = (id: string) => setExpandedSystems(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const totalCount = useMemo(() => {
    let sum = 0; chapterCounts.forEach(v => { sum += v; }); return sum;
  }, [chapterCounts]);

  return (
    <nav className="QB-sidebar">
      {/* All questions */}
      <button
        type="button"
        className={`QB-all ${!selectedSubjectId && !selectedSystemId && !selectedChapterId ? "on" : ""}`}
        onClick={() => { onSelectSubject(null); onSelectSystem(null); onSelectChapter(null); }}
      >
        <span className="QB-all-label">همه سؤالات</span>
        <span className="QB-cnt">{totalCount}</span>
      </button>

      {/* Subject tree */}
      {subjects.map((sub) => {
        const subCount = sub.systems.reduce(
          (s, sys) => s + sys.chapterIds.reduce((c, cid) => c + (chapterCounts.get(cid) ?? 0), 0), 0
        );
        if (subCount === 0) return null;

        const isExpanded = expandedSubjects.has(sub.id);
        const isSelected = selectedSubjectId === sub.id;

        return (
          <div key={sub.id}>
            <button
              type="button"
              className={`QB-sub ${isSelected ? "on" : ""}`}
              onClick={() => {
                toggleSubject(sub.id);
                onSelectSubject(sub.id);
                onSelectSystem(null);
                onSelectChapter(null);
              }}
            >
              {isExpanded
                ? <ChevronDown size={13} className="QB-sub-chev" />
                : <ChevronRight size={13} className="QB-sub-chev" />}
              <span className="QB-sub-name">{sub.label}</span>
              <span className="QB-cnt">{subCount}</span>
            </button>

            {isExpanded && sub.systems.map((sys) => {
              const sysCount = sys.chapterIds.reduce((c, cid) => c + (chapterCounts.get(cid) ?? 0), 0);
              if (sysCount === 0) return null;

              const sysExpanded = expandedSystems.has(sys.id);
              const sysSelected = selectedSystemId === sys.id;

              return (
                <div key={sys.id}>
                  <button
                    type="button"
                    className={`QB-sys ${sysSelected ? "on" : ""} ${sysExpanded ? "ex" : ""}`}
                    onClick={() => {
                      toggleSystem(sys.id);
                      onSelectSystem(sys.id);
                      onSelectChapter(null);
                    }}
                  >
                    {sysExpanded
                      ? <ChevronDown size={11} className="QB-sys-chev" />
                      : <ChevronRight size={11} className="QB-sys-chev" />}
                    <span className="QB-sys-name">{sys.label}</span>
                    <span className="QB-cnt">{sysCount}</span>
                  </button>

                  {sysExpanded && sys.chapterIds.map((cid) => {
                    const count = chapterCounts.get(cid) ?? 0;
                    if (count === 0) return null;
                    return (
                      <button
                        key={cid}
                        type="button"
                        className={`QB-ch ${selectedChapterId === cid ? "on" : ""}`}
                        onClick={() => onSelectChapter(cid)}
                      >
                        <span className="QB-ch-label">
                          {chapterTitleMap.get(cid) ?? cid}
                        </span>
                        <span className="QB-cnt">{count}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
