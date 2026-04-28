"use client";

import { useEffect, useState } from "react";
import { MediaRefProvider } from "@/components/starship-media/MediaRefProvider";
import { SegmentRenderer } from "@/components/library-v2/SegmentRenderer";
import {
  isStarshipMediaReaderEnabled,
  setStarshipMediaReaderOverride,
} from "@/lib/starship-media/flag";
import type {
  FrameViewModel,
  SectionViewModel,
} from "@/lib/contract/note-viewer.types";
import {
  emptyDisplayV8,
  emptyFlagsV8,
} from "@/lib/contract/note-v8.types";

const CHAPTER_NO = 164;
const SEGMENT_ID = "ch164-debug-seg-01";

function buildFrame(overrides: Partial<FrameViewModel>): FrameViewModel {
  return {
    id: "frame-x",
    kind: "concept",
    title: "",
    summary: null,
    body: "",
    marginNote: null,
    linkedQuestions: [],
    content: "",
    listItems: undefined,
    tableData: undefined,
    mermaid: undefined,
    highYield: undefined,
    clinicalPearl: undefined,
    interactiveData: undefined,
    schemaVersion: "8.0",
    contentHash: "sha256:probe",
    v8Display: emptyDisplayV8(),
    v8Flags: emptyFlagsV8(),
    hasStructuralReformat: false,
    ...overrides,
  };
}

const SECTIONS: SectionViewModel[] = [
  {
    id: "probe-en",
    title: "English references",
    hook: null,
    closingKeypoint: null,
    frames: [
      buildFrame({
        id: "probe-en-f1",
        kind: "concept",
        title: "Anatomy review",
        body:
          "Detailed anatomy is shown in Figure 164.4 — please review carefully.\n\n" +
          "See Fig. 164-4 for the lateral landmark, Image 2 for the axial cut, and Table 5.2 for the differential.",
        content:
          "Detailed anatomy is shown in Figure 164.4 — please review carefully.\n\n" +
          "See Fig. 164-4 for the lateral landmark, Image 2 for the axial cut, and Table 5.2 for the differential.",
      }),
    ],
  },
  {
    id: "probe-fa",
    title: "Persian references",
    hook: null,
    closingKeypoint: null,
    frames: [
      buildFrame({
        id: "probe-fa-f1",
        kind: "concept",
        title: "بررسی تصاویر و اشکال",
        body:
          "نگاه کنید به تصویر ۲ و سپس شکل ۳ برای جزئیات بیشتر در مورد آناتومی منطقه.\n\n" +
          "همچنین جدول ۴ مقایسه تشخیص افتراقی را خلاصه می‌کند.",
        content:
          "نگاه کنید به تصویر ۲ و سپس شکل ۳ برای جزئیات بیشتر در مورد آناتومی منطقه.\n\n" +
          "همچنین جدول ۴ مقایسه تشخیص افتراقی را خلاصه می‌کند.",
      }),
    ],
  },
  {
    id: "probe-mixed-emphasis",
    title: "Refs inside emphasis",
    hook: null,
    closingKeypoint: null,
    frames: [
      buildFrame({
        id: "probe-mix-f1",
        kind: "pearl",
        title: "Refs inside bold and italics",
        body:
          "Important: see **Figure 1** and *Image 3* for the canonical view; شکل ۵ also helps.",
        content:
          "Important: see **Figure 1** and *Image 3* for the canonical view; شکل ۵ also helps.",
      }),
    ],
  },
  {
    id: "probe-noref",
    title: "Plain prose without references",
    hook: null,
    closingKeypoint: null,
    frames: [
      buildFrame({
        id: "probe-plain-f1",
        kind: "concept",
        title: "Plain paragraph",
        body:
          "این پاراگراف هیچ ارجاع تصویری یا شکلی ندارد و باید بدون لنگر رندر شود.",
        content:
          "این پاراگراف هیچ ارجاع تصویری یا شکلی ندارد و باید بدون لنگر رندر شود.",
      }),
    ],
  },
];

export default function MediaReaderProbe() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  // Resolve the live flag on mount (env + localStorage).
  useEffect(() => {
    setEnabled(isStarshipMediaReaderEnabled());
  }, []);

  function setFlag(next: "0" | "1") {
    setStarshipMediaReaderOverride(next);
    // Hard reload so the provider remounts cleanly.
    window.location.reload();
  }

  function clearOverride() {
    setStarshipMediaReaderOverride(null);
    window.location.reload();
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-lib-bg text-lib-text"
      style={{ padding: "24px" }}
    >
      <header
        dir="ltr"
        style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>
          /debug/media-reader — Phase 1 verification harness
        </div>
        <div>
          NEXT_PUBLIC_STARSHIP_MEDIA_READER ={" "}
          <code>{process.env.NEXT_PUBLIC_STARSHIP_MEDIA_READER ?? "(unset)"}</code>
          {" · "}
          resolved enabled = <code>{enabled === null ? "…" : String(enabled)}</code>
          {" · "}chapter = <code>{CHAPTER_NO}</code>
          {" · "}segment = <code>{SEGMENT_ID}</code>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setFlag("1")}
            data-testid="flag-on"
            style={btnStyle}
          >
            Force flag ON (localStorage=1)
          </button>
          <button
            type="button"
            onClick={() => setFlag("0")}
            data-testid="flag-off"
            style={btnStyle}
          >
            Force flag OFF (localStorage=0)
          </button>
          <button
            type="button"
            onClick={clearOverride}
            data-testid="flag-clear"
            style={btnStyle}
          >
            Clear override (use env)
          </button>
        </div>
      </header>

      {/* Real provider + segment renderer. The provider is what every real
          Reader page mounts; this harness goes through the same path. */}
      <article
        data-reader-content="true"
        className="reader-content"
        style={{ maxWidth: "70ch", margin: "0 auto" }}
      >
        <MediaRefProvider>
          <SegmentRenderer
            sections={SECTIONS}
            chapterNo={CHAPTER_NO}
            segmentId={SEGMENT_ID}
          />
        </MediaRefProvider>
      </article>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontFamily: "inherit",
  fontSize: 11,
  cursor: "pointer",
};
