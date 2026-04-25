"use client";

/* ═══════════════════════════════════════════════════════
   Typography Inspector — /ui-preview/clinical/type
   Full scale in both scripts with real Campbell content.
   ═══════════════════════════════════════════════════════ */

const SCALE: {
  name: string;
  token: string;
  size: string;
  weight: number;
  font: string;
  fa: string;
  en: string;
}[] = [
  {
    name: "Display",
    token: "--c-text-display",
    size: "2rem / 32px",
    weight: 700,
    font: "persian",
    fa: "\u06A9\u0627\u0631\u0633\u06CC\u0646\u0648\u0645 \u0633\u0644\u0648\u0644 \u06A9\u0644\u06CC\u0648\u06CC",
    en: "Renal Cell Carcinoma",
  },
  {
    name: "H1",
    token: "--c-text-h1",
    size: "1.625rem / 26px",
    weight: 700,
    font: "persian",
    fa: "\u0627\u067E\u06CC\u062F\u0645\u06CC\u0648\u0644\u0648\u0698\u06CC \u0648 \u0639\u0648\u0627\u0645\u0644 \u062E\u0637\u0631",
    en: "Epidemiology & Risk Factors",
  },
  {
    name: "H2",
    token: "--c-text-h2",
    size: "1.25rem / 20px",
    weight: 700,
    font: "persian",
    fa: "\u067E\u0627\u062A\u0648\u0644\u0648\u0698\u06CC \u2014 \u0632\u06CC\u0631\u0646\u0648\u0639\u200C\u0647\u0627\u06CC \u0647\u06CC\u0633\u062A\u0648\u0644\u0648\u0698\u06CC\u06A9",
    en: "Pathology \u2014 Histologic Subtypes",
  },
  {
    name: "H3",
    token: "--c-text-h3",
    size: "1.0625rem / 17px",
    weight: 700,
    font: "persian",
    fa: "\u0633\u0644\u0648\u0644 \u0634\u0641\u0627\u0641 \u0648 \u0645\u0633\u06CC\u0631 VHL/HIF",
    en: "Clear Cell & the VHL/HIF Pathway",
  },
  {
    name: "H4",
    token: "--c-text-h4",
    size: "0.9375rem / 15px",
    weight: 600,
    font: "persian",
    fa: "\u0645\u0631\u062D\u0644\u0647\u200C\u0628\u0646\u062F\u06CC TNM \u0648 \u067E\u06CC\u0634\u200C\u0622\u06AF\u0647\u06CC",
    en: "TNM Staging & Prognosis",
  },
  {
    name: "Body",
    token: "--c-text-body",
    size: "1.0625rem / 17px",
    weight: 400,
    font: "persian",
    fa: "\u06A9\u0627\u0631\u0633\u06CC\u0646\u0648\u0645 \u0633\u0644\u0648\u0644 \u06A9\u0644\u06CC\u0648\u06CC \u062A\u0642\u0631\u06CC\u0628\u0627\u064B \u06F3\u066A \u0627\u0632 \u06A9\u0644 \u0628\u062F\u062E\u06CC\u0645\u06CC\u200C\u0647\u0627\u06CC \u0628\u0632\u0631\u06AF\u0633\u0627\u0644\u0627\u0646 \u0648 \u06F9\u06F0\u066A \u062A\u0645\u0627\u0645 \u0646\u0626\u0648\u067E\u0644\u0627\u0633\u0645\u200C\u0647\u0627\u06CC \u06A9\u0644\u06CC\u0647 \u0631\u0627 \u062A\u0634\u06A9\u06CC\u0644 \u0645\u06CC\u200C\u062F\u0647\u062F.",
    en: "Renal cell carcinoma accounts for approximately 3% of all adult malignancies and 90% of all kidney neoplasms.",
  },
  {
    name: "Medical Term",
    token: "--c-text-term",
    size: "0.9375rem / 15px",
    weight: 600,
    font: "latin-prose",
    fa: "Von Hippel-Lindau \u00B7 Hypoxia-Inducible Factor \u00B7 VEGF",
    en: "Von Hippel-Lindau \u00B7 Hypoxia-Inducible Factor \u00B7 VEGF",
  },
  {
    name: "Term (Abbreviation)",
    token: "--c-text-term + smcp",
    size: "0.9375rem / 15px",
    weight: 600,
    font: "latin-prose-abbr",
    fa: "RCC \u00B7 VHL \u00B7 HIF \u00B7 VEGF \u00B7 TKI \u00B7 NSS \u00B7 AML",
    en: "RCC \u00B7 VHL \u00B7 HIF \u00B7 VEGF \u00B7 TKI \u00B7 NSS \u00B7 AML",
  },
  {
    name: "Caption",
    token: "--c-text-caption",
    size: "0.8125rem / 13px",
    weight: 400,
    font: "persian",
    fa: "\u06A9\u0645\u067E\u0628\u0644\u200C\u0648\u0627\u0644\u0634\u200C\u0648\u06CC\u0646 \u0627\u0648\u0631\u0648\u0644\u0648\u0698\u06CC \u00B7 \u0641\u0635\u0644 \u06F5\u06F7 \u00B7 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u06F1\u06F2",
    en: "Campbell-Walsh-Wein Urology \u00B7 Chapter 57 \u00B7 12th Edition",
  },
  {
    name: "Mono",
    token: "--c-text-mono",
    size: "0.875rem / 14px",
    weight: 400,
    font: "mono",
    fa: "T1a (\u2264\u06F4cm) \u00B7 T1b (4\u20137cm) \u00B7 eGFR 82 mL/min",
    en: "T1a (\u22644cm) \u00B7 T1b (4\u20137cm) \u00B7 eGFR 82 mL/min",
  },
  {
    name: "UI Chrome",
    token: "--c-font-ui",
    size: "0.8125rem / 13px",
    weight: 500,
    font: "ui",
    fa: "\u0641\u0647\u0631\u0633\u062A \u0645\u0637\u0627\u0644\u0628 \u00B7 \u062C\u0633\u062A\u062C\u0648 \u00B7 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u00B7 \u062A\u0631\u0627\u06A9\u0645",
    en: "Table of Contents \u00B7 Search \u00B7 Settings \u00B7 Density",
  },
];

function fontFamily(font: string) {
  switch (font) {
    case "persian": return "var(--c-font-persian)";
    case "latin-prose": return "var(--c-font-latin-prose)";
    case "latin-prose-abbr": return "var(--c-font-latin-prose)";
    case "mono": return "var(--c-font-mono)";
    case "ui": return "var(--c-font-ui)";
    default: return "var(--c-font-persian)";
  }
}

export default function TypeInspector() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "hsl(var(--c-surface-canvas))",
      color: "hsl(var(--c-text-primary))",
      padding: "3rem 2rem",
    }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 48, borderBottom: "1px solid hsl(var(--c-border-structural))", paddingBottom: 24 }}>
          <h1 style={{
            fontFamily: "var(--c-font-ui)", fontWeight: 700,
            fontSize: "var(--c-text-h1)", color: "hsl(var(--c-text-primary))",
            marginBottom: 8,
          }}>
            Typography Inspector
          </h1>
          <p style={{
            fontFamily: "var(--c-font-persian)", fontSize: "var(--c-text-body)",
            color: "hsl(var(--c-text-tertiary))", lineHeight: 1.8,
          }}>
            {"\u0633\u06CC\u0633\u062A\u0645 \u062A\u0627\u06CC\u067E\u0648\u06AF\u0631\u0627\u0641\u06CC \u062F\u0648\u0632\u0628\u0627\u0646\u0647 \u0628\u0631\u0627\u06CC Clinical Intelligence OS \u2014 \u0641\u0627\u0631\u0633\u06CC (Vazirmatn) + \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC \u067E\u0632\u0634\u06A9\u06CC (Source Serif 4) + \u06A9\u0631\u0648\u0645 \u0631\u0627\u0628\u0637 (Inter)"}
          </p>
        </div>

        {/* Scale */}
        {SCALE.map(item => (
          <div key={item.name} style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            gap: 24,
            padding: "20px 0",
            borderBottom: "1px solid hsl(var(--c-border-hairline))",
            alignItems: "start",
          }}>
            {/* Meta column */}
            <div>
              <div style={{ fontFamily: "var(--c-font-ui)", fontWeight: 600, fontSize: 13, color: "hsl(var(--c-text-primary))", marginBottom: 4 }}>
                {item.name}
              </div>
              <div style={{ fontFamily: "var(--c-font-mono)", fontSize: 11, color: "hsl(var(--c-text-quaternary))", lineHeight: 1.6 }}>
                <div>{item.token}</div>
                <div>{item.size}</div>
                <div>weight: {item.weight}</div>
              </div>
            </div>

            {/* Sample column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Persian */}
              <div
                dir="rtl"
                lang="fa"
                style={{
                  fontFamily: fontFamily(item.font),
                  fontSize: `var(${item.token.split(" ")[0]})`,
                  fontWeight: item.weight,
                  lineHeight: item.font === "persian" ? "var(--c-reader-line-height)" : 1.5,
                  color: "hsl(var(--c-text-primary))",
                  ...(item.font === "latin-prose-abbr" ? { fontFeatureSettings: '"smcp", "c2sc"', letterSpacing: "0.04em" } : {}),
                  ...(item.font === "latin-prose" ? { letterSpacing: "0.01em" } : {}),
                }}
              >
                {item.fa}
              </div>

              {/* English */}
              <div
                dir="ltr"
                lang="en"
                style={{
                  fontFamily: fontFamily(item.font),
                  fontSize: `var(${item.token.split(" ")[0]})`,
                  fontWeight: item.weight,
                  lineHeight: 1.5,
                  color: "hsl(var(--c-text-secondary))",
                  ...(item.font === "latin-prose-abbr" ? { fontFeatureSettings: '"smcp", "c2sc"', letterSpacing: "0.04em" } : {}),
                  ...(item.font === "latin-prose" ? { letterSpacing: "0.01em" } : {}),
                }}
              >
                {item.en}
              </div>
            </div>
          </div>
        ))}

        {/* Bilingual paragraph demo */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid hsl(var(--c-border-structural))" }}>
          <h2 style={{ fontFamily: "var(--c-font-ui)", fontWeight: 600, fontSize: "var(--c-text-h3)", marginBottom: 16 }}>
            Bilingual Paragraph Demo
          </h2>
          <div style={{
            maxWidth: "var(--c-reader-measure)",
            background: "hsl(var(--c-reader-bg))",
            borderRadius: "var(--c-radius-md)",
            border: "1px solid hsl(var(--c-border-hairline))",
            padding: 24,
          }}>
            <p dir="rtl" lang="fa" style={{
              fontFamily: "var(--c-font-persian)",
              fontSize: "var(--c-text-body)",
              fontWeight: 400,
              lineHeight: "var(--c-reader-line-height)",
              color: "hsl(var(--c-text-primary))",
              margin: 0,
            }}>
              {"\u06A9\u0627\u0631\u0633\u06CC\u0646\u0648\u0645 \u0633\u0644\u0648\u0644 \u06A9\u0644\u06CC\u0648\u06CC ("}
              <bdi className="medical-term" data-abbr="">RCC</bdi>
              {") \u062A\u0642\u0631\u06CC\u0628\u0627\u064B \u06F3\u066A \u0627\u0632 \u06A9\u0644 \u0628\u062F\u062E\u06CC\u0645\u06CC\u200C\u0647\u0627\u06CC \u0628\u0632\u0631\u06AF\u0633\u0627\u0644\u0627\u0646 \u0631\u0627 \u062A\u0634\u06A9\u06CC\u0644 \u0645\u06CC\u200C\u062F\u0647\u062F. \u0628\u06CC\u0645\u0627\u0631\u06CC "}
              <bdi className="medical-term">Von Hippel-Lindau</bdi>
              {" \u0646\u0627\u0634\u06CC \u0627\u0632 \u062C\u0647\u0634 \u0698\u0646 \u0633\u0631\u06A9\u0648\u0628\u06AF\u0631 \u062A\u0648\u0645\u0648\u0631 "}
              <bdi className="medical-term" data-abbr="">VHL</bdi>
              {" \u0627\u0633\u062A \u06A9\u0647 \u0645\u0646\u062C\u0631 \u0628\u0647 \u062A\u062C\u0645\u0639 "}
              <bdi className="medical-term" data-abbr="">HIF</bdi>
              {" \u0648 \u0628\u06CC\u0634\u200C\u0628\u06CC\u0627\u0646 "}
              <bdi className="medical-term" data-abbr="">VEGF</bdi>
              {" \u0645\u06CC\u200C\u0634\u0648\u062F. \u062F\u0631\u0645\u0627\u0646 \u0647\u062F\u0641\u0645\u0646\u062F \u0628\u0627 "}
              <bdi className="medical-term">Tyrosine Kinase Inhibitor</bdi>
              {" (\u0645\u0627\u0646\u0646\u062F sunitinib) \u0627\u0632 \u062E\u0637\u0648\u0637 \u0627\u0648\u0644 \u062F\u0631\u0645\u0627\u0646 \u0627\u0633\u062A."}
            </p>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: "hsl(var(--c-text-quaternary))", fontFamily: "var(--c-font-mono)" }}>
            measure: var(--c-reader-measure) = 42em &asymp; 714px &bull; line-height: var(--c-reader-line-height) = calc(1.9 &times; density) &bull; body: 17px Vazirmatn &bull; terms: 15px Source Serif 4 w600
          </div>
        </div>

        {/* Measure ruler */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid hsl(var(--c-border-structural))" }}>
          <h2 style={{ fontFamily: "var(--c-font-ui)", fontWeight: 600, fontSize: "var(--c-text-h3)", marginBottom: 16 }}>
            Persian Measure Lock
          </h2>
          <div style={{
            maxWidth: "var(--c-reader-measure)",
            background: "hsl(var(--c-reader-bg))",
            borderRadius: "var(--c-radius-md)",
            border: "1px solid hsl(var(--c-border-hairline))",
            padding: "24px 24px 12px",
          }}>
            <p dir="rtl" lang="fa" style={{
              fontFamily: "var(--c-font-persian)", fontSize: "var(--c-text-body)",
              lineHeight: "var(--c-reader-line-height)", color: "hsl(var(--c-text-primary))",
              margin: 0,
            }}>
              {"\u0637\u0628\u0642\u0647\u200C\u0628\u0646\u062F\u06CC WHO \u0633\u0627\u0644 \u06F2\u06F0\u06F1\u06F6 \u0628\u06CC\u0634 \u0627\u0632 \u06F1\u06F6 \u0632\u06CC\u0631\u0646\u0648\u0639 \u0645\u062C\u0632\u0627 \u0627\u0632 \u06A9\u0627\u0631\u0633\u06CC\u0646\u0648\u0645 \u0633\u0644\u0648\u0644 \u06A9\u0644\u06CC\u0648\u06CC \u0631\u0627 \u0634\u0646\u0627\u0633\u0627\u06CC\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F. \u0633\u0647 \u0632\u06CC\u0631\u0646\u0648\u0639 \u0634\u0627\u06CC\u0639 \u0634\u0627\u0645\u0644 \u0633\u0644\u0648\u0644 \u0634\u0641\u0627\u0641 (\u06F7\u06F0\u2013\u06F8\u06F0\u066A)\u060C \u067E\u0627\u067E\u06CC\u0644\u0627\u0631\u06CC (\u06F1\u06F0\u2013\u06F1\u06F5\u066A) \u0648 \u06A9\u0631\u0648\u0645\u0648\u0641\u0648\u0628 (\u06F5\u066A) \u0627\u06A9\u062B\u0631\u06CC\u062A \u062A\u0648\u0645\u0648\u0631\u0647\u0627\u06CC \u062A\u062D\u062A \u062C\u0631\u0627\u062D\u06CC \u0631\u0627 \u062A\u0634\u06A9\u06CC\u0644 \u0645\u06CC\u200C\u062F\u0647\u0646\u062F \u0648 \u0647\u0631 \u06CC\u06A9 \u0627\u0645\u0636\u0627\u06CC \u0645\u0648\u0644\u06A9\u0648\u0644\u06CC \u0648 \u067E\u06CC\u0634\u200C\u0622\u06AF\u0647\u06CC \u0645\u062A\u0641\u0627\u0648\u062A\u06CC \u062F\u0627\u0631\u0646\u062F. \u0628\u0631\u0627\u06CC \u062A\u0648\u0645\u0648\u0631\u0647\u0627\u06CC T1\u060C \u0646\u0641\u0631\u06A9\u062A\u0648\u0645\u06CC \u067E\u0627\u0631\u0634\u06CC\u0627\u0644 \u0631\u0648\u06CC\u06A9\u0631\u062F \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F \u0627\u0633\u062A."}
            </p>
            <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: "hsl(var(--c-border-hairline))", position: "relative" }}>
              <div style={{
                position: "absolute", top: -16, left: 0,
                fontSize: 9, color: "hsl(var(--c-text-quaternary))", fontFamily: "var(--c-font-mono)",
              }}>0</div>
              <div style={{
                position: "absolute", top: -16, right: 0,
                fontSize: 9, color: "hsl(var(--c-text-quaternary))", fontFamily: "var(--c-font-mono)",
              }}>42em</div>
              <div style={{ width: "100%", height: "100%", borderRadius: 2, background: "hsl(var(--c-accent-muted))" }} />
            </div>
            <div style={{ fontSize: 10, color: "hsl(var(--c-text-quaternary))", fontFamily: "var(--c-font-mono)", marginTop: 4, textAlign: "center" }}>
              ~62-70 Persian characters per line at 17px body
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
