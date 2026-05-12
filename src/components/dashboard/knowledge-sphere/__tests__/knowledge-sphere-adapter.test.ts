import { describe, expect, it } from "vitest";

import { buildKnowledgeSphereData } from "../knowledge-sphere-adapter";
import {
  syntheticChapters,
  syntheticFlashcardStats,
  syntheticMcqStats,
  syntheticReaderStats,
} from "../../__tests__/dashboard-synthetic-fixture";

describe("buildKnowledgeSphereData synthetic dashboard wiring", () => {
  it("prioritizes weak and due synthetic chapters", () => {
    const data = buildKnowledgeSphereData({
      chapters: syntheticChapters,
      mcqStats: syntheticMcqStats,
      flashcardStats: syntheticFlashcardStats,
      readerStats: syntheticReaderStats,
      includeTopicNodes: false,
      includeUnknownNodes: true,
    });

    const weakNode = data.nodes.find((node) => node.chapterId === "dashboard-smoke-ch-weak");
    const overdueNode = data.nodes.find((node) => node.chapterId === "dashboard-smoke-ch-overdue");
    const strongNode = data.nodes.find((node) => node.chapterId === "dashboard-smoke-ch-strong");

    expect(weakNode?.metrics.hasRealSignal).toBe(true);
    expect(overdueNode?.metrics.dueFlashcardCount).toBeGreaterThan(0);
    expect(weakNode?.metrics.priorityScore).toBeGreaterThan(strongNode?.metrics.priorityScore ?? 0);
    expect(data.summary.topPriorityNodeIds).toContain(overdueNode?.id);
  });

  it("does not draw a fake sphere when only chapter metadata exists", () => {
    const data = buildKnowledgeSphereData({
      chapters: syntheticChapters,
      includeTopicNodes: false,
      includeUnknownNodes: true,
    });

    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
    expect(data.summary.dataCoverage).toBe(0);
  });
});

