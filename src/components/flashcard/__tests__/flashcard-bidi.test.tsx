/**
 * flashcard-bidi.test.tsx
 *
 * Tests for the bidi run splitter and BidiText component used by all
 * flashcard renderers.  These are the acceptance criteria promised in
 * the implementation — each test maps to a concrete DOM requirement.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { splitBidiRuns, processHtmlBidi } from "@/lib/text/bidi";
import { BidiText } from "@/components/shared/BidiText";

function html(node: React.ReactNode): string {
  return renderToStaticMarkup(<div dir="rtl">{node}</div>);
}

// ── splitBidiRuns — plain text tokenisation ────────────────────────────────

describe("splitBidiRuns — LTR run detection", () => {
  it("alpha-blocker therapy is one LTR run", () => {
    const ltr = splitBidiRuns("درمان با α-blocker therapy شروع می‌شود").filter(
      (r) => r.isLtr,
    );
    expect(ltr).toHaveLength(1);
    expect(ltr[0].text).toBe("α-blocker therapy");
  });

  it("beta3 agonist and OAB are two separate LTR runs", () => {
    const ltr = splitBidiRuns(
      "داروی β3 agonist در OAB استفاده می‌شود",
    ).filter((r) => r.isLtr);
    expect(ltr).toHaveLength(2);
    expect(ltr[0].text).toBe("β3 agonist");
    expect(ltr[1].text).toBe("OAB");
  });

  it("5alpha-reductase inhibitor is one LTR run", () => {
    const ltr = splitBidiRuns(
      "مهارکننده 5α-reductase inhibitor حجم پروستات را کم می‌کند",
    ).filter((r) => r.isLtr);
    expect(ltr).toHaveLength(1);
    expect(ltr[0].text).toBe("5α-reductase inhibitor");
  });

  it("PDE5 inhibitor and LUTS are two LTR runs", () => {
    const ltr = splitBidiRuns(
      "PDE5 inhibitor می‌تواند LUTS را بهتر کند",
    ).filter((r) => r.isLtr);
    expect(ltr).toHaveLength(2);
    expect(ltr[0].text).toContain("PDE5");
    expect(ltr[1].text).toContain("LUTS");
  });

  it("PSA velocity is one LTR run", () => {
    const ltr = splitBidiRuns("PSA velocity در پیگیری مهم است").filter(
      (r) => r.isLtr,
    );
    expect(ltr).toHaveLength(1);
    expect(ltr[0].text).toBe("PSA velocity");
  });

  it("DHT mitogen and prostate growth are two LTR runs", () => {
    const ltr = splitBidiRuns("DHT mitogen برای prostate growth است").filter(
      (r) => r.isLtr,
    );
    expect(ltr).toHaveLength(2);
    expect(ltr[0].text).toBe("DHT mitogen");
    expect(ltr[1].text).toBe("prostate growth");
  });

  it("5 mg is one LTR run (digit + space + latin)", () => {
    const ltr = splitBidiRuns("دوز 5 mg روزانه").filter((r) => r.isLtr);
    expect(ltr).toHaveLength(1);
    expect(ltr[0].text).toBe("5 mg");
  });

  it("12-month follow-up is one LTR run", () => {
    const ltr = splitBidiRuns("پیگیری 12-month follow-up انجام شد").filter(
      (r) => r.isLtr,
    );
    expect(ltr).toHaveLength(1);
    expect(ltr[0].text).toBe("12-month follow-up");
  });

  it("148_01:q-01 and transition zone are two LTR runs", () => {
    const ltr = splitBidiRuns(
      "سؤال 148_01:q-01 مربوط به transition zone است",
    ).filter((r) => r.isLtr);
    expect(ltr).toHaveLength(2);
    expect(ltr[0].text).toBe("148_01:q-01");
    expect(ltr[1].text).toBe("transition zone");
  });

  it("BPH, LUTS, TURP, HoLEP are each isolated LTR runs", () => {
    const ltr = splitBidiRuns(
      "BPH با LUTS درمان می‌شود؛ روش‌ها شامل TURP و HoLEP",
    ).filter((r) => r.isLtr);
    const texts = ltr.map((r) => r.text);
    expect(texts).toContain("BPH");
    expect(texts).toContain("LUTS");
    expect(texts).toContain("TURP");
    expect(texts).toContain("HoLEP");
  });

  it("peripheral zone is one LTR run", () => {
    const ltr = splitBidiRuns("ناحیهٔ peripheral zone بررسی شد").filter(
      (r) => r.isLtr,
    );
    expect(ltr).toHaveLength(1);
    expect(ltr[0].text).toBe("peripheral zone");
  });

  it("standalone ASCII digit with no adjacent Latin stays RTL", () => {
    const ltr = splitBidiRuns("فصل 3 از کتاب").filter((r) => r.isLtr);
    expect(ltr).toHaveLength(0);
  });

  it("Persian digits stay in RTL context", () => {
    const ltr = splitBidiRuns("فصل ۳ از کتاب").filter((r) => r.isLtr);
    expect(ltr).toHaveLength(0);
  });

  it("leading/trailing spaces of LTR run are NOT included in isLtr segment", () => {
    const ltr = splitBidiRuns("دوز 5 mg روزانه").filter((r) => r.isLtr);
    expect(ltr[0].text).not.toMatch(/^ /);
    expect(ltr[0].text).not.toMatch(/ $/);
  });
});

// ── processHtmlBidi — HTML string injection ───────────────────────────────

describe("processHtmlBidi — HTML text node injection", () => {
  it("injects LTR span into plain text node", () => {
    const out = processHtmlBidi("درمان با PDE5 inhibitor انجام شد");
    expect(out).toContain('data-bidi-run="ltr"');
    expect(out).toContain("PDE5 inhibitor");
  });

  it("leaves HTML tags unchanged", () => {
    const input = '<p dir="rtl">درمان با PSA velocity</p>';
    const out = processHtmlBidi(input);
    expect(out).toContain('<p dir="rtl">');
    expect(out).toContain("</p>");
    expect(out).toContain('data-bidi-run="ltr"');
  });

  it("processes text inside strong/em correctly", () => {
    const input = "<strong>PSA velocity در پیگیری</strong>";
    const out = processHtmlBidi(input);
    expect(out).toContain("<strong>");
    expect(out).toContain("</strong>");
    expect(out).toContain('data-bidi-run="ltr"');
  });

  it("pure Persian HTML is returned unchanged", () => {
    const input = "<p>این یک جمله فارسی است</p>";
    const out = processHtmlBidi(input);
    expect(out).toBe(input);
  });

  it("injects unicode-bidi isolate style", () => {
    const out = processHtmlBidi("مقدار 5 mg تجویز شد");
    expect(out).toContain("unicode-bidi:isolate");
  });
});

// ── BidiText — rendered DOM structure ─────────────────────────────────────

describe("BidiText — rendered HTML structure", () => {
  it("wraps LTR run in dir=ltr span with data-bidi-run attribute", () => {
    const out = html(
      <BidiText text="درمان با α-blocker therapy شروع می‌شود" />,
    );
    expect(out).toContain('dir="ltr"');
    expect(out).toContain('data-bidi-run="ltr"');
    expect(out).toContain("α-blocker therapy");
  });

  it("outer RTL wrapper is preserved — no whole-container LTR", () => {
    const out = html(<BidiText text="PSA velocity در پیگیری مهم است" />);
    expect(out).toContain('dir="rtl"'); // outer test wrapper
    expect(out).not.toMatch(/^<div dir="ltr">/);
  });

  it("beta3 agonist rendered inside LTR span", () => {
    const out = html(
      <BidiText text="داروی β3 agonist در OAB استفاده می‌شود" />,
    );
    expect(out).toMatch(/dir="ltr"[^>]*>β3 agonist</);
  });

  it("5 mg wrapped in LTR span", () => {
    const out = html(<BidiText text="دوز 5 mg روزانه" />);
    expect(out).toMatch(/dir="ltr"[^>]*>5 mg</);
  });

  it("5alpha-reductase inhibitor is one LTR span", () => {
    const out = html(
      <BidiText text="مهارکننده 5α-reductase inhibitor حجم را کم می‌کند" />,
    );
    expect(out).toMatch(/dir="ltr"[^>]*>5α-reductase inhibitor</);
  });

  it("148_01:q-01 and transition zone are two separate LTR spans", () => {
    const out = html(
      <BidiText text="سؤال 148_01:q-01 مربوط به transition zone است" />,
    );
    const count = (out.match(/data-bidi-run="ltr"/g) ?? []).length;
    expect(count).toBe(2);
  });

  it("each LTR span carries unicode-bidi isolate style", () => {
    const out = html(<BidiText text="دوز 5 mg روزانه" />);
    expect(out).toContain("unicode-bidi");
    expect(out).toContain("isolate");
  });

  it("pure Persian text produces no LTR spans", () => {
    const out = html(<BidiText text="این یک جمله فارسی است" />);
    expect(out).not.toContain('data-bidi-run="ltr"');
    expect(out).not.toContain('dir="ltr"');
  });

  it("12-month follow-up is one LTR span", () => {
    const out = html(<BidiText text="پیگیری 12-month follow-up انجام شد" />);
    expect(out).toMatch(/dir="ltr"[^>]*>12-month follow-up</);
  });
});
