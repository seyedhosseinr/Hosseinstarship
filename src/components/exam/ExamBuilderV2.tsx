"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Check,
  Loader2,
  BookOpen,
  Layers,
  BarChart3,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { C } from "./exam-tokens";
import {
  getCampbellVolumes,
  getPartsByVolumeIds,
  getChaptersByPartIds,
  computeCampbellPoolSize,
} from "@/lib/exam/campbell-hierarchy";
import { useExamStore } from "@/store/useExamStore";
import type { ExamConfig, ExamMode, ExamPoolMode } from "@/types/exam";

export default function ExamBuilderV2() {
  const router = useRouter();
  const { initExam, error } = useExamStore();

  const volumes = useMemo(() => getCampbellVolumes(), []);
  const allParts = useMemo(
    () => getPartsByVolumeIds([]),
    []
  );

  // Mode state
  const [mode, setMode] = useState<ExamMode>("tutor");
  const [poolMode, setPoolMode] = useState<ExamPoolMode>("all");
  const [questionCount, setQuestionCount] = useState(20);
  const [customCount, setCustomCount] = useState("");

  // Selection state
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<string[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<string[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  // UI state
  const [chapterSearch, setChapterSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dbCount, setDbCount] = useState<number | null>(null);

  // Get available parts based on selected volumes
  const availableParts = useMemo(
    () =>
      getPartsByVolumeIds(
        selectedVolumeIds.length > 0
          ? selectedVolumeIds
          : volumes.map((v) => v.id)
      ),
    [selectedVolumeIds, volumes]
  );

  // Get available chapters
  const availableChapters = useMemo(() => {
    const partIds =
      selectedPartIds.length > 0
        ? selectedPartIds
        : selectedVolumeIds.length > 0
        ? availableParts.map((p) => p.id)
        : allParts.map((p) => p.id);
    return getChaptersByPartIds(partIds).filter(
      (c) =>
        !chapterSearch ||
        c.title.toLowerCase().includes(chapterSearch.toLowerCase()) ||
        String(c.chapterNo).includes(chapterSearch)
    );
  }, [
    selectedPartIds,
    selectedVolumeIds,
    availableParts,
    allParts,
    chapterSearch,
  ]);

  // Pool size
  const poolSize = useMemo(
    () =>
      computeCampbellPoolSize(
        selectedVolumeIds,
        selectedPartIds,
        selectedChapterIds
      ),
    [selectedVolumeIds, selectedPartIds, selectedChapterIds]
  );

  // Fetch DB count
  useEffect(() => {
    fetch("/api/questions/count")
      .then((r) => r.json())
      .then((d) => setDbCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  // Handlers
  const toggleVolume = useCallback((id: string) => {
    setSelectedVolumeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectedPartIds([]);
    setSelectedChapterIds([]);
  }, []);

  const togglePart = useCallback((id: string) => {
    setSelectedPartIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectedChapterIds([]);
  }, []);

  const toggleChapter = useCallback((id: string) => {
    setSelectedChapterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectAllChapters = () =>
    setSelectedChapterIds(availableChapters.map((c) => c.id));
  const clearChapters = () => setSelectedChapterIds([]);

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
    if (success) {
      router.push("/exam/active");
    }
  };

  const PRESETS = [10, 20, 40];

  return (
    <div
      style={{ minHeight: "100vh", background: C.bg, paddingBottom: 40 }}
      dir="rtl"
    >
      {/* Header */}
      <div
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: C.text,
                margin: 0,
              }}
            >
              ساخت آزمون
            </h1>
            <p
              style={{
                fontSize: 13,
                color: C.textSoft,
                margin: "4px 0 0",
              }}
            >
              Campbell Urology —{" "}
              {dbCount !== null
                ? `${dbCount} سوال در بانک`
                : "در حال بارگذاری..."}
            </p>
          </div>
          <button
            onClick={handleStart}
            disabled={isLoading || (dbCount !== null && dbCount === 0)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 28px",
              borderRadius: 12,
              background: C.accent,
              color: "#fff",
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              opacity: isLoading ? 0.7 : 1,
              boxShadow: "0 4px 16px rgba(14,165,164,0.25)",
            }}
          >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            {isLoading ? (
              <Loader2
                style={{
                  width: 18,
                  height: 18,
                  animation: "spin 0.8s linear infinite",
                }}
              />
            ) : (
              <Play style={{ width: 18, height: 18 }} />
            )}
            شروع آزمون
          </button>
        </div>
      </div>

      <div
        style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}
      >
        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 10,
              background: "#FFF5F5",
              border: "1px solid #FCA5A5",
              color: "#B91C1C",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {dbCount === 0 && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 10,
              background: "#FFF7ED",
              border: "1px solid #FED7AA",
              color: "#92400E",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle style={{ width: 16, height: 16 }} />
            بانک سوال خالی است. ابتدا از صفحه Import سوالات را وارد کنید.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          {/* ── LEFT: Campbell hierarchy selection ── */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Section 1: Volumes */}
            <Section
              title="جلدها (Volumes)"
              icon={<BookOpen style={{ width: 16, height: 16 }} />}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelectedVolumeIds([])}
                  style={chipStyle(selectedVolumeIds.length === 0)}
                >
                  همه جلدها
                </button>
                {volumes.map((vol) => (
                  <button
                    key={vol.id}
                    onClick={() => toggleVolume(vol.id)}
                    style={chipStyle(selectedVolumeIds.includes(vol.id))}
                  >
                    <Check
                      style={{
                        width: 12,
                        height: 12,
                        opacity: selectedVolumeIds.includes(vol.id) ? 1 : 0,
                      }}
                    />
                    {vol.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Section 2: Parts */}
            <Section
              title="بخش‌ها (Parts)"
              icon={<Layers style={{ width: 16, height: 16 }} />}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelectedPartIds([])}
                  style={chipStyle(selectedPartIds.length === 0)}
                >
                  همه بخش‌ها
                </button>
                {availableParts.map((part) => (
                  <button
                    key={part.id}
                    onClick={() => togglePart(part.id)}
                    style={chipStyle(selectedPartIds.includes(part.id))}
                  >
                    <Check
                      style={{
                        width: 12,
                        height: 12,
                        opacity: selectedPartIds.includes(part.id) ? 1 : 0,
                      }}
                    />
                    {part.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Section 3: Chapters */}
            <Section
              title={`فصل‌ها (${availableChapters.length} فصل)`}
              icon={<BarChart3 style={{ width: 16, height: 16 }} />}
              actions={
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={selectAllChapters}
                    style={{
                      fontSize: 11,
                      padding: "2px 10px",
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: "transparent",
                      color: C.accent,
                      cursor: "pointer",
                    }}
                  >
                    انتخاب همه
                  </button>
                  {selectedChapterIds.length > 0 && (
                    <button
                      onClick={clearChapters}
                      style={{
                        fontSize: 11,
                        padding: "2px 10px",
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        background: "transparent",
                        color: C.danger,
                        cursor: "pointer",
                      }}
                    >
                      پاک کردن
                    </button>
                  )}
                </div>
              }
            >
              {/* Chapter search */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceSubtle,
                  marginBottom: 12,
                }}
              >
                <Search style={{ width: 14, height: 14, color: C.textMuted }} />
                <input
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  placeholder="جستجو فصل..."
                  style={{
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    outline: "none",
                    fontSize: 13,
                    color: C.text,
                  }}
                />
                {chapterSearch && (
                  <button
                    onClick={() => setChapterSearch("")}
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <X style={{ width: 12, height: 12, color: C.textMuted }} />
                  </button>
                )}
              </div>

              {/* Chapter list */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 6,
                }}
              >
                {availableChapters.map((ch) => {
                  const isSelected = selectedChapterIds.includes(ch.id);
                  return (
                    <button
                      key={ch.id}
                      onClick={() => toggleChapter(ch.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${
                          isSelected ? C.accent : C.border
                        }`,
                        background: isSelected ? C.accentSoft : C.surface,
                        cursor: "pointer",
                        textAlign: "right",
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          flexShrink: 0,
                          background: isSelected ? C.accent : C.surfaceSubtle,
                          border: `1px solid ${
                            isSelected ? C.accent : C.border
                          }`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected && (
                          <Check
                            style={{ width: 10, height: 10, color: "#fff" }}
                          />
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.textMuted,
                          minWidth: 22,
                          flexShrink: 0,
                        }}
                      >
                        {ch.chapterNo}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: C.text,
                          flex: 1,
                          textAlign: "right",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ch.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* ── RIGHT: Config panel ── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              position: "sticky",
              top: 80,
            }}
          >
            {/* Mode */}
            <ConfigCard title="حالت آزمون">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(
                  [
                    {
                      id: "tutor" as ExamMode,
                      label: "راهنما (Tutor)",
                      desc: "پاسخ بعد از هر سوال نمایش داده می‌شود",
                    },
                    {
                      id: "timed" as ExamMode,
                      label: "زمان‌دار (Timed)",
                      desc: "۹۰ ثانیه برای هر سوال",
                    },
                    {
                      id: "untimed" as ExamMode,
                      label: "بدون زمان (Untimed)",
                      desc: "بدون محدودیت زمانی",
                    },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      textAlign: "right",
                      border: `1px solid ${
                        mode === m.id ? C.accent : C.border
                      }`,
                      background:
                        mode === m.id ? C.accentSoft : C.surface,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border: `2px solid ${
                            mode === m.id ? C.accent : C.border
                          }`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {mode === m.id && (
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: C.accent,
                            }}
                          />
                        )}
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: C.text,
                            margin: 0,
                          }}
                        >
                          {m.label}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            color: C.textSoft,
                            margin: 0,
                          }}
                        >
                          {m.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ConfigCard>

            {/* Question pool */}
            <ConfigCard title="استخر سوالات">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(
                  [
                    { id: "all" as ExamPoolMode, label: "همه" },
                    { id: "unused" as ExamPoolMode, label: "استفاده نشده" },
                    { id: "incorrect" as ExamPoolMode, label: "اشتباه" },
                    { id: "marked" as ExamPoolMode, label: "علامت‌گذاری" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPoolMode(p.id)}
                    style={chipStyle(poolMode === p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </ConfigCard>

            {/* Question count */}
            <ConfigCard title="تعداد سوال">
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {PRESETS.map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setQuestionCount(n);
                      setCustomCount("");
                    }}
                    style={chipStyle(
                      questionCount === n && customCount === ""
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                max={200}
                value={customCount}
                onChange={(e) => {
                  setCustomCount(e.target.value);
                  setQuestionCount(Number(e.target.value) || 20);
                }}
                placeholder="دلخواه..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.surfaceSubtle,
                  fontSize: 13,
                  color: C.text,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </ConfigCard>

            {/* Summary */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: C.accentSoft,
                border: `1px solid ${C.accentBorder}`,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: C.accent,
                  fontWeight: 600,
                  marginBottom: 8,
                  margin: "0 0 8px",
                }}
              >
                خلاصه آزمون
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <Row
                  label="حالت"
                  value={
                    mode === "tutor"
                      ? "راهنما"
                      : mode === "timed"
                      ? "زمان‌دار"
                      : "بدون زمان"
                  }
                />
                <Row
                  label="استخر"
                  value={
                    poolMode === "all"
                      ? "همه"
                      : poolMode === "unused"
                      ? "استفاده نشده"
                      : poolMode === "incorrect"
                      ? "اشتباه"
                      : "علامت‌گذاری"
                  }
                />
                <Row label="تعداد سوال" value={String(questionCount)} />
                <Row
                  label="فصل‌های انتخابی"
                  value={
                    selectedChapterIds.length > 0
                      ? String(selectedChapterIds.length)
                      : "همه"
                  }
                />
                {mode === "timed" && (
                  <Row
                    label="زمان"
                    value={`${Math.round(questionCount * 1.5)} دقیقه`}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──
function Section({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: C.accent }}>{icon}</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: C.text,
            flex: 1,
          }}
        >
          {title}
        </span>
        {actions}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function ConfigCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: 16,
      }}
    >
      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: C.textSoft,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 12,
          margin: "0 0 12px",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}
    >
      <span style={{ color: C.textSoft }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 14px",
    borderRadius: 20,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accentSoft : C.surface,
    color: active ? C.accent : C.textSoft,
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
  };
}
