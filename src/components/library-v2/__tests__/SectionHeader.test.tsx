import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SectionHeader } from "../SectionHeader";

describe("SectionHeader inline rich rendering", () => {
  it("renders inline bold/italic in section title and hook", () => {
    const html = renderToStaticMarkup(
      <SectionHeader
        title="Workup of **microscopic hematuria**"
        hook="Stratify by *risk* before deciding."
        index={3}
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("microscopic hematuria");
    expect(html).toContain("<em");
    expect(html).toContain("risk");
    expect(html).not.toContain("**microscopic hematuria**");
    expect(html).not.toContain("*risk*");
  });
});
