import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { StudyCockpitShell } from "../study-cockpit-shell";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("StudyCockpitShell synthetic dashboard wiring", () => {
  it("renders mission/header, KPI cards, real FSRS curves, and action handlers", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onStartStudy = vi.fn();
    const onCreateMCQ = vi.fn();
    const onOpenSettings = vi.fn();

    act(() => {
      root.render(
        <StudyCockpitShell
          syncState="synced"
          lastSyncLabel="synthetic sync"
          pendingCrdtOps={[
            {
              id: "dashboard-smoke-pending",
              topic: "Synthetic local op",
              field: "frontHtml",
              localValue: "local",
              remoteValue: "remote",
              autoResolved: false,
            },
          ]}
          storageUsedMB={42.5}
          storagePercent={33}
          isOpfsHydrating={false}
          dueCardsCount={9}
          mcqThisWeek={18}
          overallAccuracy={67}
          studyStreakDays={14}
          weekNumber={7}
          totalWeeks={24}
          daysUntilBoard={109}
          focusTopic="Synthetic Weak Chapter"
          fsrsStatsByChapter={[
            // avgStability exercises the direct-stability path in curveStabilities
            { chapterId: "dashboard-smoke-ch-strong",  totalCards: 8, avgRetention: 94, avgStability: 21 },
            { chapterId: "dashboard-smoke-ch-overdue", totalCards: 6, avgRetention: 45, avgStability: 3 },
          ]}
          onStartStudy={onStartStudy}
          onCreateMCQ={onCreateMCQ}
          onOpenSettings={onOpenSettings}
        >
          <div data-testid="children">synthetic panels slot</div>
        </StudyCockpitShell>,
      );
    });

    expect(container.textContent).toContain("STUDY COCKPIT");
    expect(container.textContent).toContain("synthetic sync");
    expect(container.textContent).toContain("pending");
    expect(container.textContent).toContain("42.5 MB");
    expect(container.textContent).toContain("109");
    expect(container.textContent).toContain("Synthetic Weak Chapter");
    expect(container.textContent).toContain("9");
    expect(container.textContent).toContain("18");
    expect(container.textContent).toContain("67%");
    expect(container.textContent).toContain("14");
    expect(container.textContent).not.toContain("(Ù†Ù…ÙˆÙ†Ù‡)");

    const headerButtons = Array.from(container.querySelectorAll("header button"));
    const mainButtons = Array.from(container.querySelectorAll("main button"));
    const settingsButton = headerButtons.at(-1);
    const startButton = mainButtons[0];
    const mcqButton = mainButtons[1];

    act(() => {
      settingsButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      mcqButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onStartStudy).toHaveBeenCalledTimes(1);
    expect(onCreateMCQ).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});
