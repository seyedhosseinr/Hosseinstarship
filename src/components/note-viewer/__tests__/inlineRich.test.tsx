import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderInlineRich } from "../inlineRich";

function html(node: React.ReactNode): string {
  return renderToStaticMarkup(<div>{node}</div>);
}

describe("renderInlineRich defensive scrubbing", () => {
  it("renders closed bold/italic correctly in mixed Persian + English text", () => {
    const out = html(
      renderInlineRich(
        "**vulva** شامل **mons pubis** و *labia majora* است.",
      ),
    );
    expect(out).toContain("<strong");
    expect(out).toContain("vulva");
    expect(out).toContain("mons pubis");
    expect(out).toContain("<em");
    expect(out).toContain("labia majora");
    expect(out).not.toContain("**vulva**");
    expect(out).not.toContain("**mons pubis**");
    expect(out).not.toContain("*labia majora*");
  });

  it("strips orphan ** markers when one half is missing (no raw ** leakage)", () => {
    const out = html(renderInlineRich("Aortic stenosis **plus a typo without close"));
    expect(out).not.toContain("**");
    expect(out).toContain("Aortic stenosis plus a typo without close");
  });

  it("strips a leading bullet marker from list-item style strings", () => {
    expect(html(renderInlineRich("* Always check **serum creatinine**"))).not.toContain(
      "* Always",
    );
    expect(html(renderInlineRich("- Check **eGFR**"))).not.toContain("- Check");
    expect(html(renderInlineRich("• Note: *renal ultrasound*"))).not.toContain("• Note");
  });

  it("does not over-strip ** in valid pairs even when the rest of the text has stray characters", () => {
    const out = html(renderInlineRich("Use **bold** but mention 2*3=6 calculations"));
    expect(out).toContain("<strong");
    expect(out).toContain("bold");
    expect(out).toContain("2*3=6");
    expect(out).not.toContain("**bold**");
  });
});
