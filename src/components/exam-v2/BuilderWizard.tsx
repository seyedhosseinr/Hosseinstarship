"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExamShell } from "./ExamShell";
import { ChapterSelector } from "./ChapterSelector";
import { FilterChip } from "./FilterChip";
import { ConfirmButton } from "./ConfirmButton";
import { useExamStore } from "@/store/useExamStore";
import {
  getCampbellVolumes,
  getPartsByVolumeIds,
  getChaptersByPartIds,
  computeCampbellPoolSize,
} from "@/lib/exam/campbell-hierarchy";
import type { ExamConfig, ExamMode, ExamPoolMode } from "@/types/exam";

type Step = "select" | "configure" | "review";
const STEP_ORDER: Step[] = ["select", "configure", "review"];

const MODE_OPTIONS: { id: ExamMode; label: string; desc: string }[] = [
  { id: "tutor", label: "آموزشی (Tutor)", desc: "پاسخ و توضیح بعد از هر سوال" },
  { id: "timed", label: "زمان‌دار (Timed)", desc: "۹۰ ثانیه برای هر سوال" },
  { id: "untimed", label: "آزاد (Untimed)", desc: "بدون محدودیت زمانی" },
];

const POOL_OPTIONS: { id: ExamPoolMode; label: string }[] = [
  { id: "all", label: "همه" },
  { id: "unused", label: "استفاده نشده" },
  { id: "incorrect", label: "اشتباه‌ها" },
  { id: "marked", label: "نشان‌شده" },
];

const PRESETS = [10, 20, 40];


function normalizeChapterQuery(value: string | null): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const n = Number.parseInt(text.replace(/^ch-0*/i, ''), 10)
  return Number.isFinite(n) && n > 0 ? `ch-${String(n).padStart(3, '0')}` : text
}

export function BuilderWizard() {
  const router = useRouter();
  const { initExam, error } = useExamStore();
  const [step, setStep] = useState<Step>("select");
  const [isLoading, setIsLoading] = useState(false);
  const [dbCount, setDbCount] = useState<number | null>(null);

  // Selection
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<string[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  // Config
  const [mode, setMode] = useState<ExamMode>("tutor");
  const [poolMode, setPoolMode] = useState<ExamPoolMode>("all");
  const [questionCount, setQuestionCount] = useState(20);
  const [customCount, setCustomCount] = useState("");

  const volumes = useMemo(() => getCampbellVolumes(), []);
  const allParts = useMemo(() => getPartsByVolumeIds([]), []);

  const availableChapters = useMemo(() => {
    const partIds =
      selectedPartIds.length > 0
        ? selectedPartIds
        : selectedVolumeIds.length > 0
          ? getPartsByVolumeIds(selectedVolumeIds).map((p) => p.id)
          : allParts.map((p) => p.id);
    return getChaptersByPartIds(partIds);
  }, [selectedPartIds, selectedVolumeIds, allParts]);

  const poolSize = useMemo(
    () => computeCampbellPoolSize(selectedVolumeIds, selectedPartIds, selectedChapterIds),
    [selectedVolumeIds, selectedPartIds, selectedChapterIds],
  );

  useEffect(() => {
    fetch("/api/questions/count")
      .then((r) => r.json())
      .then((d) => setDbCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedChapter = normalizeChapterQuery(new URLSearchParams(window.location.search).get("chapter"));
    if (!requestedChapter) return;

    const allChapters = getChaptersByPartIds(allParts.map((part) => part.id));
    const requestedNo = Number.parseInt(requestedChapter.replace(/^ch-0*/i, ""), 10);
    const match = allChapters.find((chapter) => {
      const chapterNo = Number.parseInt(chapter.id.replace(/^ch-0*/i, ""), 10);
      return chapter.id === requestedChapter || (!Number.isNaN(requestedNo) && chapterNo === requestedNo);
    });

    if (!match) return;
    setSelectedVolumeIds([]);
    setSelectedPartIds([]);
    setSelectedChapterIds([match.id]);
    setStep("configure");
  }, [allParts]);

  const toggleVolume = useCallback((id: string) => {
    setSelectedVolumeIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setSelectedPartIds([]);
    setSelectedChapterIds([]);
  }, []);
  const togglePart = useCallback((id: string) => {
    setSelectedPartIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setSelectedChapterIds([]);
  }, []);
  const toggleChapter = useCallback((id: string) => {
    setSelectedChapterIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }, []);

  const handleStart = async () => {
    setIsLoading(true);
    const config: ExamConfig = {
      mode,
      poolMode,
      questionCount,
      timeLimit: mode === "timed" ? questionCount * 90 : 0,
      selectedVolumeIds,
      selectedPartIds,
      selectedChapterIds,
    };
    const success = await initExam(config);
    setIsLoading(false);
    if (success) router.push("/exam/active");
  };

  const stepIdx = STEP_ORDER.indexOf(step);
  const canNext = step === "select" || step === "configure";
  const canPrev = stepIdx > 0;

  return (
    <ExamShell className="overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 border-b border-lib-border bg-lib-surface px-6 py-5">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-lib-text">ساخت آزمون</h1>
            <p className="mt-1 text-[13px] text-lib-text-secondary">
              Campbell Urology — {dbCount !== null ? `${dbCount} سوال در بانک` : "در حال بارگذاری..."}
            </p>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <button
                  onClick={() => setStep(s)}
                  className={cn(
                    "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                    step === s ? "bg-lib-accent text-white" : "bg-lib-hover text-lib-text-muted",
                  )}
                >
                  {i + 1}
                </button>
                <span className={cn("hidden text-[11px] ipad-portrait:inline", step === s ? "font-semibold text-lib-accent" : "text-lib-text-muted")}>
                  {s === "select" ? "انتخاب" : s === "configure" ? "تنظیمات" : "بررسی"}
                </span>
                {i < 2 && <span className="h-px w-4 bg-lib-border" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error / warning */}
      <div className="mx-auto w-full max-w-[1100px] px-6 pt-6">
        {error && (
          <div className="mb-4 rounded-lib-sm border border-lib-incorrect-border bg-lib-incorrect-bg p-3 text-[13px] text-lib-incorrect">
            {error}
          </div>
        )}
        {dbCount === 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lib-sm border border-lib-marked-bg bg-lib-marked-bg p-3 text-[13px] text-lib-marked">
            <AlertTriangle size={16} />
            بانک سوال خالی است. ابتدا از صفحه Import سوالات را وارد کنید.
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-[1100px] flex-1 px-6 pb-10">
        {step === "select" && (
          <ChapterSelector
            selectedVolumeIds={selectedVolumeIds}
            selectedPartIds={selectedPartIds}
            selectedChapterIds={selectedChapterIds}
            onToggleVolume={toggleVolume}
            onTogglePart={togglePart}
            onToggleChapter={toggleChapter}
            onSelectAllChapters={() => setSelectedChapterIds(availableChapters.map((c) => c.id))}
            onClearChapters={() => setSelectedChapterIds([])}
          />
        )}

        {step === "configure" && (
          <div className="grid grid-cols-1 gap-6 ipad-landscape:grid-cols-2">
            {/* Mode */}
            <div className="rounded-lib-md border border-lib-border bg-lib-surface p-5">
              <h3 className="mb-3 text-sm font-bold text-lib-text">حالت آزمون</h3>
              <div className="flex flex-col gap-2">
                {MODE_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "flex min-h-touch items-center gap-3 rounded-lib-sm border px-4 py-3 text-start transition-colors cursor-pointer",
                      mode === m.id
                        ? "border-lib-accent bg-lib-accent-soft"
                        : "border-lib-border hover:bg-lib-hover",
                    )}
                  >
                    <span className={cn("h-3 w-3 rounded-full border-2", mode === m.id ? "border-lib-accent bg-lib-accent" : "border-lib-text-muted")} />
                    <div>
                      <div className={cn("text-xs font-semibold", mode === m.id ? "text-lib-accent" : "text-lib-text")}>{m.label}</div>
                      <div className="text-[11px] text-lib-text-muted">{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pool + Count */}
            <div className="flex flex-col gap-6">
              <div className="rounded-lib-md border border-lib-border bg-lib-surface p-5">
                <h3 className="mb-3 text-sm font-bold text-lib-text">منبع سوالات</h3>
                <div className="flex flex-wrap gap-2">
                  {POOL_OPTIONS.map((p) => (
                    <FilterChip key={p.id} label={p.label} active={poolMode === p.id} onClick={() => setPoolMode(p.id)} />
                  ))}
                </div>
              </div>

              <div className="rounded-lib-md border border-lib-border bg-lib-surface p-5">
                <h3 className="mb-3 text-sm font-bold text-lib-text">تعداد سوالات</h3>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((n) => (
                    <FilterChip key={n} label={String(n)} active={questionCount === n && !customCount} onClick={() => { setQuestionCount(n); setCustomCount(""); }} />
                  ))}
                  <input
                    type="number"
                    value={customCount}
                    onChange={(e) => {
                      setCustomCount(e.target.value);
                      const n = parseInt(e.target.value, 10);
                      if (n > 0) setQuestionCount(n);
                    }}
                    placeholder="سفارشی..."
                    className="w-24 rounded-lib-sm border border-lib-border bg-transparent px-3 py-1.5 text-xs text-lib-text outline-none focus:border-lib-accent"
                  />
                </div>
                <p className="mt-2 text-[11px] text-lib-text-muted">
                  مجموع {poolSize} سوال در حوزه انتخاب شده
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="mx-auto max-w-[600px]">
            <div className="rounded-lib-lg border border-lib-border bg-lib-surface p-8">
              <h3 className="mb-6 text-center text-lg font-bold text-lib-text">خلاصه آزمون</h3>
              <div className="mb-6 grid grid-cols-2 gap-3">
                {[
                  { label: "حالت", value: mode === "tutor" ? "آموزشی" : mode === "timed" ? "زمان‌دار" : "آزاد" },
                  { label: "تعداد سوال", value: String(questionCount) },
                  { label: "منبع", value: poolMode === "all" ? "همه" : poolMode === "unused" ? "استفاده نشده" : poolMode === "incorrect" ? "اشتباه‌ها" : "نشان‌شده" },
                  { label: "فصل‌ها", value: selectedChapterIds.length > 0 ? `${selectedChapterIds.length} فصل` : "همه فصل‌ها" },
                ].map((row) => (
                  <div key={row.label} className="rounded-lib-sm bg-lib-hover p-3">
                    <div className="text-[11px] text-lib-text-muted">{row.label}</div>
                    <div className="text-sm font-semibold text-lib-text">{row.value}</div>
                  </div>
                ))}
              </div>
              <ConfirmButton
                onClick={handleStart}
                disabled={isLoading || (dbCount !== null && dbCount === 0)}
                className="w-full justify-center gap-2 py-3 text-[15px]"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                شروع آزمون
              </ConfirmButton>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="shrink-0 border-t border-lib-border bg-lib-surface px-6 py-3">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <ConfirmButton variant="ghost" onClick={() => canPrev && setStep(STEP_ORDER[stepIdx - 1])} disabled={!canPrev} className="gap-1.5 border border-lib-border">
            <ChevronRight size={16} /> قبلی
          </ConfirmButton>
          {canNext ? (
            <ConfirmButton onClick={() => setStep(STEP_ORDER[stepIdx + 1])} className="gap-1.5">
              بعدی <ChevronLeft size={16} />
            </ConfirmButton>
          ) : (
            <div />
          )}
        </div>
      </div>
    </ExamShell>
  );
}
