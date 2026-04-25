"use client";

/**
 * QBankCardList  v4.0 — Flagship 2026
 * Uses QB-* CSS classes defined in QBankBrowser.
 * Premium question cards with smooth expand animations.
 */

import { useState, useEffect } from "react";
import {
  Search, Eye, EyeOff, Bookmark, BookmarkCheck,
  ChevronDown, FileQuestion,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const DIFF_CLASS: Record<string, string> = {
  easy:   "QB-diff QB-diff-easy",
  medium: "QB-diff QB-diff-med",
  hard:   "QB-diff QB-diff-hard",
};
const DIFF_LABEL: Record<string, string> = {
  easy: "آسان", medium: "متوسط", hard: "سخت",
};

export interface QBankCardQuestion {
  id: string;
  text: string;
  options: string[];
  answer: number;
  explanation?: string;
  subject?: string;
  tags?: string[];
  difficulty?: string;
  bookmarked: boolean;
  chapterNo?: number;
}

export interface QBankCardListProps {
  questions: QBankCardQuestion[];
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  /** Optional search string passed from parent (header search box) */
  externalSearch?: string;
  className?: string;
}

type DiffFilter = "all" | "easy" | "medium" | "hard";

export function QBankCardList({
  questions,
  isBookmarked,
  onToggleBookmark,
  externalSearch = "",
}: QBankCardListProps) {
  const [search,       setSearch]       = useState(externalSearch);
  const [diffFilter,   setDiffFilter]   = useState<DiffFilter>("all");
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [showAnswer,   setShowAnswer]   = useState<Set<string>>(new Set());

  /* Sync external search (from header) into local state */
  useEffect(() => { if (externalSearch !== search) setSearch(externalSearch); }, [externalSearch]);

  const filtered = questions.filter((q) => {
    if (bookmarkOnly && !isBookmarked(q.id)) return false;
    if (diffFilter !== "all" && q.difficulty !== diffFilter) return false;
    if (search && !q.text.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleAnswer = (id: string) => {
    setShowAnswer((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="QB-main">
      {/* Filter bar */}
      <div className="QB-fbar">
        <div className="QB-fsearch">
          <Search size={14} style={{ color: "var(--t3)", flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی سؤال…"
          />
        </div>
        <div className="QB-chips">
          {(["all", "easy", "medium", "hard"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`QB-chip QB-chip-${d === "all" ? "all" : d === "easy" ? "easy" : d === "medium" ? "med" : "hard"} ${diffFilter === d ? "on" : ""}`}
              onClick={() => setDiffFilter(d)}
            >
              {d === "all" ? "همه" : DIFF_LABEL[d]}
            </button>
          ))}
          <button
            type="button"
            className={`QB-chip QB-chip-bm ${bookmarkOnly ? "on" : ""}`}
            onClick={() => setBookmarkOnly((p) => !p)}
          >
            <Bookmark size={11} />
            نشان‌شده
          </button>
          <span className="QB-fcount">{filtered.length} سؤال</span>
        </div>
      </div>

      {/* Question list */}
      <div className="QB-qlist">
        {filtered.length === 0 && (
          <div className="QB-empty">
            <div className="QB-empty-icon"><FileQuestion size={30} /></div>
            <p className="QB-empty-title">سؤالی پیدا نشد</p>
            <p className="QB-empty-sub">فیلتر یا جستجو را تغییر دهید</p>
          </div>
        )}

        {filtered.map((q, i) => {
          const isOpen    = expanded === q.id;
          const isMarked  = isBookmarked(q.id);
          const revealed  = showAnswer.has(q.id);

          /* extract chapter tag for display */
          const chTag = (q.tags ?? []).find(t => t.startsWith("ch-"));
          const chNum = chTag ? chTag.replace(/^ch-0*/i, "") : null;

          return (
            <div key={q.id} className={`QB-card ${isOpen ? "open" : ""}`}>
              {/* Card header */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                className="QB-card-head"
                onClick={() => setExpanded(isOpen ? null : q.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpanded(isOpen ? null : q.id);
                  }
                }}
              >
                <span className="QB-card-idx">{i + 1}</span>

                <div className="QB-card-content">
                  <p className="QB-card-stem">{q.text}</p>
                  <div className="QB-card-tags">
                    {q.difficulty && (
                      <span className={DIFF_CLASS[q.difficulty] ?? "QB-diff"}>
                        {DIFF_LABEL[q.difficulty] ?? q.difficulty}
                      </span>
                    )}
                    {chNum && (
                      <span className="QB-chtag">فصل {chNum}</span>
                    )}
                  </div>
                </div>

                <div className="QB-card-actions">
                  <button
                    type="button"
                    aria-label={isMarked ? "حذف نشانه" : "نشانه‌گذاری"}
                    className={`QB-bm ${isMarked ? "on" : ""}`}
                    onClick={(e) => { e.stopPropagation(); onToggleBookmark(q.id); }}
                  >
                    {isMarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                  </button>
                  <ChevronDown size={15} className="QB-chev" />
                </div>
              </div>

              {/* Expanded body */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="QB-card-body">
                      {/* Full stem */}
                      <div className="QB-full-stem">{q.text}</div>

                      {/* Options */}
                      <div className="QB-options">
                        {q.options.map((opt, oi) => (
                          <div
                            key={oi}
                            className={`QB-opt ${revealed && oi === q.answer ? "correct" : ""}`}
                          >
                            <span className="QB-opt-letter">{LETTERS[oi]}.</span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>

                      {/* Reveal toggle */}
                      <button
                        type="button"
                        className={`QB-reveal ${revealed ? "shown" : ""}`}
                        onClick={() => toggleAnswer(q.id)}
                      >
                        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                        {revealed ? "مخفی کردن پاسخ" : "نمایش پاسخ صحیح"}
                      </button>

                      {/* Explanation */}
                      {revealed && q.explanation && (
                        <div className="QB-explanation">
                          <div className="QB-explanation-label">توضیحات</div>
                          {q.explanation}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
