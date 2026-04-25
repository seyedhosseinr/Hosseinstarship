"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, Search as SearchIcon } from "lucide-react";
import { colorLight, colorDark } from "@/lib/theme/tokens";
import { useExamStore } from "@/store/useExamStore";
import type { QBankQuestion } from "@/lib/qbank/queries";
import QBankScreen from "./QBankScreen";

/* ── CSS-variable bridge for automatic dark mode ── */
const QBE_STYLES = `
[data-qbank-entry] {
${Object.entries(colorLight).map(([k, v]) => `  --qb-${k}: ${v};`).join('\n')}
}
.dark [data-qbank-entry] {
${Object.entries(colorDark).map(([k, v]) => `  --qb-${k}: ${v};`).join('\n')}
}
`;
const C = Object.fromEntries(
  Object.keys(colorLight).map(k => [k, `var(--qb-${k})`]),
) as Record<keyof typeof colorLight, string>;

interface Props {
  questions: QBankQuestion[];
}

export default function QBankEntryPage({ questions }: Props) {
  const router = useRouter();
  const [initialChapterId, setInitialChapterId] = useState<string | null>(null);
  const [view, setView] = useState<"browser" | "builder">("builder");

  useEffect(() => {
    const chapter = new URLSearchParams(window.location.search).get("chapter");
    if (chapter) {
      setInitialChapterId(chapter);
      setView("browser");
    }
  }, []);
  const { startBuild } = useExamStore();

  const goToBuilder = () => {
    startBuild();
    router.push("/exam/builder");
  };

  return (
    <div data-qbank-entry style={{ minHeight: "100vh", background: C.bg }} dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: QBE_STYLES }} />
      {/* Top nav tabs */}
      <div
        style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}
        >
          <button
            onClick={() => setView("builder")}
            style={{
              padding: "14px 20px",
              fontSize: 14,
              fontWeight: view === "builder" ? 700 : 400,
              color: view === "builder" ? C.accent : C.textSoft,
              // رفع تداخل با جایگزینی border: "none"
              borderTop: "none",
              borderRight: "none",
              borderLeft: "none",
              borderBottom:
                view === "builder"
                  ? `2px solid ${C.accent}`
                  : "2px solid transparent",
              background: "none",
              borderRadius: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Play style={{ width: 15, height: 15 }} />
            ساخت آزمون
          </button>
          <button
            onClick={() => setView("browser")}
            style={{
              padding: "14px 20px",
              fontSize: 14,
              fontWeight: view === "browser" ? 700 : 400,
              color: view === "browser" ? C.accent : C.textSoft,
              // رفع تداخل با جایگزینی border: "none"
              borderTop: "none",
              borderRight: "none",
              borderLeft: "none",
              borderBottom:
                view === "browser"
                  ? `2px solid ${C.accent}`
                  : "2px solid transparent",
              background: "none",
              borderRadius: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <SearchIcon style={{ width: 15, height: 15 }} />
            مرور سوالات ({questions.length})
          </button>
        </div>
      </div>

      {view === "builder" ? (
        // Inline builder redirect
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 500 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: C.accentSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Play style={{ width: 32, height: 32, color: C.accent }} />
            </div>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: C.text,
                marginBottom: 8,
              }}
            >
              آزمون‌ساز Campbell
            </h2>
            <p
              style={{
                color: C.textSoft,
                lineHeight: 1.7,
                marginBottom: 28,
              }}
            >
              آزمون سفارشی بر اساس جلدها، بخش‌ها و فصل‌های Campbell Urology
              بسازید. حالت‌های Tutor، Timed و Untimed.
            </p>
            <button
              onClick={goToBuilder}
              style={{
                padding: "14px 36px",
                borderRadius: 14,
                background: C.accent,
                color: C.surface,
                border: "none", // اینجا مشکلی ندارد چون borderBottom مجزا تعریف نشده
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(14,165,164,0.3)",
              }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <Play style={{ width: 18, height: 18 }} />
                شروع ساخت آزمون
              </span>
            </button>
          </div>
        </div>
      ) : (
        <QBankScreen questions={questions} initialChapterId={initialChapterId} />
      )}
    </div>
  );
}
