import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { StudyCockpitPanels } from "../study-cockpit-panels";
import {
  syntheticActivityFeed,
  syntheticChapterStats,
  syntheticChapters,
  syntheticFlashcardStats,
  syntheticFsrsQueue,
  syntheticHeatmapDays,
  syntheticMcqStats,
  syntheticReaderStats,
} from "./dashboard-synthetic-fixture";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("StudyCockpitPanels synthetic dashboard card wiring", () => {
  it("renders FSRS queue, knowledge sphere, MCQ chart, heatmap, and activity feed in order", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onStartReview = vi.fn();

    act(() => {
      root.render(
        <StudyCockpitPanels
          sphereChapters={syntheticChapters}
          sphereMcqStats={syntheticMcqStats}
          sphereFlashcardStats={syntheticFlashcardStats}
          sphereReaderStats={syntheticReaderStats}
          fsrsQueue={syntheticFsrsQueue}
          chapterStats={syntheticChapterStats}
          heatmapDays={syntheticHeatmapDays}
          activityFeed={syntheticActivityFeed}
          onStartReview={onStartReview}
        />,
      );
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Synthetic overdue retention card");
    expect(text).toContain("Synthetic weak-area recall card");
    expect(text).toContain("Starship Knowledge Map");
    expect(text).toContain("Synthetic Weak Chapter");
    expect(text).toContain("Synthetic Strong Chapter");
    expect(text).toContain("Synthetic weak MCQ block");

    const queueIndex = text.indexOf("Synthetic overdue retention card");
    const sphereIndex = text.indexOf("Starship Knowledge Map");
    const mcqIndex = text.indexOf("92%");
    const activityIndex = text.indexOf("Synthetic weak MCQ block");
    expect(queueIndex).toBeGreaterThanOrEqual(0);
    expect(sphereIndex).toBeGreaterThan(queueIndex);
    expect(mcqIndex).toBeGreaterThan(sphereIndex);
    expect(activityIndex).toBeGreaterThan(mcqIndex);

    const heatmapCells = container.querySelectorAll("[title^='2026-']");
    expect(heatmapCells).toHaveLength(35);

    const startReviewButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.getAttribute("style")?.includes("var(--accent)"),
    );
    act(() => {
      startReviewButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onStartReview).toHaveBeenCalledTimes(1);

    const weakNode = Array.from(container.querySelectorAll('[role="button"]')).find((node) =>
      node.getAttribute("aria-label")?.includes("Synthetic Weak Chapter"),
    );
    act(() => {
      weakNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain("Synthetic Weak Chapter");
    expect(container.querySelector('a[href="/flashcards/review?chapter=dashboard-smoke-ch-weak"]')).not.toBeNull();
    expect(container.querySelector('a[href="/qbank?chapter=dashboard-smoke-ch-weak"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
