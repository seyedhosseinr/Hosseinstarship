import type {
  KnowledgeNode,
  KnowledgeNodeAction,
  KnowledgeSphereData,
  KnowledgeSphereSummary,
} from "./knowledge-sphere.types";
import type {
  CoMissedKnowledgeEdgeInput,
  ManualKnowledgeEdgeInput,
} from "./knowledge-sphere-edges";
import { buildKnowledgeEdges } from "./knowledge-sphere-edges";
import {
  clampScore,
  clampUnit,
  daysBetweenNow,
  getConfidenceScore,
  getEstimatedReviewMinutes,
  getFlashcardScore,
  getKnowledgeStatus,
  getMasteryScore,
  getMcqAccuracy,
  getMcqScore,
  getPriorityScore,
  getReaderScore,
  getRecencyScore,
  getStatusColorToken,
  latestIsoDate,
  normalizePercent,
} from "./knowledge-sphere-metrics";

export interface KnowledgeSphereAdapterInput {
  chapters: ChapterKnowledgeInput[];
  topics?: TopicKnowledgeInput[];
  mcqStats?: McqKnowledgeInput[];
  flashcardStats?: FlashcardKnowledgeInput[];
  readerStats?: ReaderKnowledgeInput[];
  manualEdges?: ManualKnowledgeEdgeInput[];
  coMissedPairs?: CoMissedKnowledgeEdgeInput[];
  routes?: KnowledgeRouteBuilders;
  includeTopicNodes?: boolean;
  includeUnknownNodes?: boolean;
  minimumKnownConfidence?: number;
  now?: Date;
}

export interface ChapterKnowledgeInput {
  chapterId: string;
  titleFa: string;
  titleEn?: string;
  order?: number;
  tags?: string[];
  highYieldWeight?: number;
}

export interface TopicKnowledgeInput {
  chapterId: string;
  topicId: string;
  titleFa: string;
  titleEn?: string;
  order?: number;
  tags?: string[];
  highYieldWeight?: number;
}

export interface McqKnowledgeInput {
  chapterId: string;
  topicId?: string;
  total: number;
  correct: number;
  wrong: number;
  lastAnsweredAt?: string | null;
}

export interface FlashcardKnowledgeInput {
  chapterId: string;
  topicId?: string;
  total: number;
  due: number;
  reviewed: number;
  retention?: number | null;
  averageRetrievability?: number | null;
  lastReviewedAt?: string | null;
}

export interface ReaderKnowledgeInput {
  chapterId: string;
  topicId?: string;
  totalFrames: number;
  openedFrames: number;
  lastOpenedAt?: string | null;
}

export interface KnowledgeRouteBuilders {
  openReader?: (node: Pick<KnowledgeNode, "chapterId" | "topicId" | "frameId">) => string;
  startMcq?: (node: Pick<KnowledgeNode, "chapterId" | "topicId">) => string;
  reviewFlashcards?: (node: Pick<KnowledgeNode, "chapterId" | "topicId">) => string;
  reviewWrongMcqs?: (node: Pick<KnowledgeNode, "chapterId" | "topicId">) => string;
  createStudySession?: (node: Pick<KnowledgeNode, "chapterId" | "topicId">) => string;
}

interface WeightedMetric {
  sum: number;
  weight: number;
}

interface AggregatedStats {
  mcqTotal: number;
  mcqCorrect: number;
  mcqWrong: number;
  mcqLastAt: string | null;

  flashcardTotal: number;
  flashcardDue: number;
  flashcardReviewed: number;
  flashcardRetention: WeightedMetric;
  flashcardRetrievability: WeightedMetric;
  flashcardLastAt: string | null;

  readerTotalFrames: number;
  readerOpenedFrames: number;
  readerLastAt: string | null;
}

function emptyStats(): AggregatedStats {
  return {
    mcqTotal: 0,
    mcqCorrect: 0,
    mcqWrong: 0,
    mcqLastAt: null,
    flashcardTotal: 0,
    flashcardDue: 0,
    flashcardReviewed: 0,
    flashcardRetention: { sum: 0, weight: 0 },
    flashcardRetrievability: { sum: 0, weight: 0 },
    flashcardLastAt: null,
    readerTotalFrames: 0,
    readerOpenedFrames: 0,
    readerLastAt: null,
  };
}

export function buildKnowledgeSphereData(
  input: KnowledgeSphereAdapterInput
): KnowledgeSphereData {
  const now = input.now ?? new Date();
  const includeTopicNodes = input.includeTopicNodes ?? Boolean(input.topics?.length);
  const includeUnknownNodes = input.includeUnknownNodes ?? true;
  const minimumKnownConfidence = input.minimumKnownConfidence ?? 20;
  const statsByNodeId = aggregateStats(input, includeTopicNodes);

  const chapterNodes = input.chapters.map((chapter) => {
    const nodeId = chapterNodeId(chapter.chapterId);
    return buildNode({
      id: nodeId,
      kind: "chapter",
      titleFa: chapter.titleFa,
      titleEn: chapter.titleEn,
      chapterId: chapter.chapterId,
      order: chapter.order,
      tags: chapter.tags ?? [],
      highYieldWeight: chapter.highYieldWeight ?? 0.5,
      stats: statsByNodeId.get(nodeId) ?? emptyStats(),
      routes: input.routes,
      now,
    });
  });

  const topicNodes = includeTopicNodes
    ? (input.topics ?? []).map((topic) => {
        const nodeId = topicNodeId(topic.chapterId, topic.topicId);
        return buildNode({
          id: nodeId,
          kind: "topic",
          titleFa: topic.titleFa,
          titleEn: topic.titleEn,
          chapterId: topic.chapterId,
          topicId: topic.topicId,
          parentId: chapterNodeId(topic.chapterId),
          order: topic.order,
          tags: topic.tags ?? [],
          highYieldWeight: topic.highYieldWeight ?? 0.5,
          stats: statsByNodeId.get(nodeId) ?? emptyStats(),
          routes: input.routes,
          now,
        });
      })
    : [];

  const allNodes = [...chapterNodes, ...topicNodes];
  const hasAnyRealSignal = allNodes.some((node) => node.metrics.hasRealSignal);

  // Real empty state: chapter metadata alone should not draw a fake sphere.
  if (!hasAnyRealSignal) {
    return {
      nodes: [],
      edges: [],
      summary: summarizeKnowledgeSphere([], minimumKnownConfidence),
    };
  }

  const nodes = includeUnknownNodes
    ? allNodes
    : allNodes.filter((node) => node.metrics.confidence >= minimumKnownConfidence);

  const edges = buildKnowledgeEdges(nodes, {
    manualEdges: input.manualEdges ?? [],
    coMissedPairs: input.coMissedPairs ?? [],
  });

  return {
    nodes,
    edges,
    summary: summarizeKnowledgeSphere(nodes, minimumKnownConfidence),
  };
}

function buildNode(args: {
  id: string;
  kind: "chapter" | "topic";
  titleFa: string;
  titleEn?: string;
  chapterId: string;
  topicId?: string;
  parentId?: string;
  order?: number;
  tags: string[];
  highYieldWeight: number;
  stats: AggregatedStats;
  routes?: KnowledgeRouteBuilders;
  now: Date;
}): KnowledgeNode {
  const retention = averageWeighted(args.stats.flashcardRetention);
  const retrievability = averageWeighted(args.stats.flashcardRetrievability);

  const mcqScore = getMcqScore({
    total: args.stats.mcqTotal,
    correct: args.stats.mcqCorrect,
  });

  const flashcardScore = getFlashcardScore({
    total: args.stats.flashcardTotal,
    due: args.stats.flashcardDue,
    retention,
    averageRetrievability: retrievability,
  });

  const readerScore = getReaderScore({
    totalFrames: args.stats.readerTotalFrames,
    openedFrames: args.stats.readerOpenedFrames,
  });

  const lastStudiedAt = latestIsoDate([
    args.stats.mcqLastAt,
    args.stats.flashcardLastAt,
    args.stats.readerLastAt,
  ]);
  const daysSinceLastStudy = daysBetweenNow(lastStudiedAt, args.now);
  const recencyScore = getRecencyScore(daysSinceLastStudy);

  const hasRealSignal = Boolean(
    args.stats.mcqTotal > 0 ||
      args.stats.flashcardTotal > 0 ||
      args.stats.readerTotalFrames > 0 ||
      lastStudiedAt
  );

  const mastery = hasRealSignal
    ? getMasteryScore({
        mcqScore,
        flashcardScore,
        readerScore,
        recencyScore,
      })
    : 0;

  const readerCoverage = readerScore ?? 0;
  const highYieldWeight = clampUnit(args.highYieldWeight);

  const priorityScore = hasRealSignal
    ? getPriorityScore({
        mastery,
        dueFlashcardCount: args.stats.flashcardDue,
        flashcardCount: args.stats.flashcardTotal,
        highYieldWeight,
        daysSinceLastStudy,
        mcqCount: args.stats.mcqTotal,
        flashcardCountTotal: args.stats.flashcardTotal,
        readerFrameCount: args.stats.readerTotalFrames,
      })
    : 0;

  const confidence = hasRealSignal
    ? getConfidenceScore({
        mcqCount: args.stats.mcqTotal,
        flashcardCount: args.stats.flashcardTotal,
        readerFrameCount: args.stats.readerTotalFrames,
        hasRecency: Boolean(lastStudiedAt),
      })
    : 0;

  const status = getKnowledgeStatus({
    hasRealSignal,
    mastery,
    confidence,
    priorityScore,
    dueFlashcardCount: args.stats.flashcardDue,
  });

  const estimatedReviewMinutes = getEstimatedReviewMinutes({
    dueFlashcardCount: args.stats.flashcardDue,
    wrongMcqCount: args.stats.mcqWrong,
    readerCoverage,
    hasRealSignal,
  });

  const metrics = {
    hasRealSignal,
    mastery,
    confidence,
    mcqScore,
    flashcardScore,
    readerScore,
    readerCoverage,
    mcqAccuracy: getMcqAccuracy({
      total: args.stats.mcqTotal,
      correct: args.stats.mcqCorrect,
    }),
    flashcardRetention: retention,
    flashcardRetrievability: retrievability,
    mcqCount: args.stats.mcqTotal,
    correctMcqCount: args.stats.mcqCorrect,
    wrongMcqCount: args.stats.mcqWrong,
    flashcardCount: args.stats.flashcardTotal,
    dueFlashcardCount: args.stats.flashcardDue,
    reviewedFlashcardCount: args.stats.flashcardReviewed,
    lastStudiedAt,
    daysSinceLastStudy,
    estimatedReviewMinutes,
    priorityScore,
    highYieldWeight,
  };

  const volume = args.stats.mcqTotal + args.stats.flashcardTotal + args.stats.readerTotalFrames / 4;
  const size = hasRealSignal
    ? Math.max(10, Math.min(28, 10 + Math.sqrt(volume) * 2.1 + highYieldWeight * 4))
    : 8;

  const partialNode = {
    id: args.id,
    kind: args.kind,
    titleFa: args.titleFa,
    titleEn: args.titleEn,
    chapterId: args.chapterId,
    topicId: args.topicId,
    parentId: args.parentId,
    order: args.order,
    tags: args.tags,
    metrics,
    visual: {
      status,
      size,
      colorToken: getStatusColorToken(status),
      ringProgress: hasRealSignal ? mastery : 0,
      pulse: hasRealSignal && (status === "critical" || args.stats.flashcardDue > 0 || priorityScore >= 78),
      opacity: hasRealSignal ? Math.max(0.48, confidence / 100) : 0.34,
    },
    actions: [],
    updatedAt: new Date().toISOString(),
  } satisfies Omit<KnowledgeNode, "actions"> & { actions: KnowledgeNodeAction[] };

  return {
    ...partialNode,
    actions: buildActions(partialNode, args.routes),
  };
}

function buildActions(
  node: Pick<KnowledgeNode, "chapterId" | "topicId" | "frameId" | "metrics">,
  routes?: KnowledgeRouteBuilders
): KnowledgeNodeAction[] {
  const query = buildChapterTopicQuery(node.chapterId, node.topicId);
  const hasChapter = Boolean(node.chapterId);

  const readerHref = routes?.openReader?.(node) ?? (() => {
    if (!node.chapterId) return "#";
    const chapterNoMatch = String(node.chapterId).match(/\d+/);
    const chapterNo = chapterNoMatch ? parseInt(chapterNoMatch[0], 10) : null;
    return chapterNo ? `/library/campbell/chapter/${chapterNo}` : "/library";
  })();

  const mcqHref = routes?.startMcq?.(node) ?? `/qbank${query}`;
  const flashcardHref = routes?.reviewFlashcards?.(node) ?? `/flashcards/review${query}`;
  const wrongHref = routes?.reviewWrongMcqs?.(node) ?? `${query ? `/qbank${query}&mode=wrong` : "/qbank?mode=wrong"}`;

  const recommendedKind = getRecommendedActionKind(node.metrics);

  return [
    {
      kind: "review_flashcards",
      label: "مرور فلش‌کارت‌های موعددار",
      href: flashcardHref,
      count: node.metrics.dueFlashcardCount,
      recommended: recommendedKind === "review_flashcards",
      disabled: !hasChapter,
    },
    {
      kind: "review_wrong_mcqs",
      label: "مرور اشتباهات MCQ",
      href: wrongHref,
      count: node.metrics.wrongMcqCount,
      recommended: recommendedKind === "review_wrong_mcqs",
      disabled: !hasChapter,
    },
    {
      kind: "start_mcq",
      label: "حل MCQ همین مبحث",
      href: mcqHref,
      count: node.metrics.mcqCount,
      recommended: recommendedKind === "start_mcq",
      disabled: !hasChapter,
    },
    {
      kind: "open_reader",
      label: "ادامه مطالعه در Reader",
      href: readerHref,
      recommended: recommendedKind === "open_reader",
      disabled: !hasChapter,
    },
  ];
}

function buildChapterTopicQuery(chapterId?: string, topicId?: string): string {
  const params = new URLSearchParams();
  if (chapterId) params.set("chapter", chapterId);
  if (topicId) params.set("topic", topicId);
  const value = params.toString();
  return value ? `?${value}` : "";
}

function getRecommendedActionKind(metrics: KnowledgeNode["metrics"]): KnowledgeNodeAction["kind"] {
  if (!metrics.hasRealSignal) return "open_reader";
  if (metrics.dueFlashcardCount > 0) return "review_flashcards";
  if (metrics.wrongMcqCount >= 3) return "review_wrong_mcqs";
  if ((metrics.mcqAccuracy ?? 100) < 70) return "start_mcq";
  if (metrics.readerCoverage < 70) return "open_reader";
  return "start_mcq";
}

export function summarizeKnowledgeSphere(
  nodes: KnowledgeNode[],
  minimumKnownConfidence = 20
): KnowledgeSphereSummary {
  const totalNodes = nodes.length;
  const knownNodes = nodes.filter(
    (node) => node.metrics.hasRealSignal && node.metrics.confidence >= minimumKnownConfidence
  );
  const signalNodes = nodes.filter((node) => node.metrics.hasRealSignal);
  const averageBase = knownNodes.length ? knownNodes : signalNodes;

  const averageMastery = averageBase.length
    ? clampScore(averageBase.reduce((sum, node) => sum + node.metrics.mastery, 0) / averageBase.length)
    : 0;

  const rawCurriculumMastery = totalNodes
    ? clampScore(nodes.reduce((sum, node) => sum + node.metrics.mastery, 0) / totalNodes)
    : 0;

  return {
    totalNodes,
    knownNodeCount: knownNodes.length,
    unknownNodeCount: Math.max(0, totalNodes - knownNodes.length),
    dataCoverage: totalNodes ? clampScore((knownNodes.length / totalNodes) * 100) : 0,
    masteredCount: nodes.filter((node) => node.visual.status === "mastered").length,
    stableCount: nodes.filter((node) => node.visual.status === "stable").length,
    needsReviewCount: nodes.filter((node) => node.visual.status === "needs_review").length,
    weakCount: nodes.filter((node) => node.visual.status === "weak").length,
    criticalCount: nodes.filter((node) => node.visual.status === "critical").length,
    dueNowCount: nodes.reduce((sum, node) => sum + node.metrics.dueFlashcardCount, 0),
    averageMastery,
    rawCurriculumMastery,
    topPriorityNodeIds: [...nodes]
      .filter((node) => node.metrics.hasRealSignal)
      .sort((a, b) => b.metrics.priorityScore - a.metrics.priorityScore)
      .slice(0, 5)
      .map((node) => node.id),
  };
}

function aggregateStats(
  input: KnowledgeSphereAdapterInput,
  includeTopicNodes: boolean
): Map<string, AggregatedStats> {
  const map = new Map<string, AggregatedStats>();

  const ensure = (id: string): AggregatedStats => {
    const existing = map.get(id);
    if (existing) return existing;

    const next = emptyStats();
    map.set(id, next);
    return next;
  };

  for (const stat of input.mcqStats ?? []) {
    const ids = statIds(stat.chapterId, stat.topicId, includeTopicNodes);
    for (const id of ids) {
      const bucket = ensure(id);
      bucket.mcqTotal += safeCount(stat.total);
      bucket.mcqCorrect += safeCount(stat.correct);
      bucket.mcqWrong += safeCount(stat.wrong);
      bucket.mcqLastAt = latestIsoDate([bucket.mcqLastAt, stat.lastAnsweredAt]);
    }
  }

  for (const stat of input.flashcardStats ?? []) {
    const ids = statIds(stat.chapterId, stat.topicId, includeTopicNodes);
    for (const id of ids) {
      const bucket = ensure(id);
      const total = safeCount(stat.total);
      const reviewed = safeCount(stat.reviewed);
      bucket.flashcardTotal += total;
      bucket.flashcardDue += safeCount(stat.due);
      bucket.flashcardReviewed += reviewed;
      bucket.flashcardLastAt = latestIsoDate([bucket.flashcardLastAt, stat.lastReviewedAt]);

      addWeightedPercent(bucket.flashcardRetention, stat.retention, Math.max(1, reviewed || total));
      addWeightedPercent(bucket.flashcardRetrievability, stat.averageRetrievability, Math.max(1, total));
    }
  }

  for (const stat of input.readerStats ?? []) {
    const ids = statIds(stat.chapterId, stat.topicId, includeTopicNodes);
    for (const id of ids) {
      const bucket = ensure(id);
      bucket.readerTotalFrames += safeCount(stat.totalFrames);
      bucket.readerOpenedFrames += safeCount(stat.openedFrames);
      bucket.readerLastAt = latestIsoDate([bucket.readerLastAt, stat.lastOpenedAt]);
    }
  }

  return map;
}

function statIds(chapterId: string, topicId: string | undefined, includeTopicNodes: boolean): string[] {
  const ids = [chapterNodeId(chapterId)];
  if (includeTopicNodes && topicId) ids.push(topicNodeId(chapterId, topicId));
  return ids;
}

export function chapterNodeId(chapterId: string): string {
  return `chapter:${chapterId}`;
}

export function topicNodeId(chapterId: string, topicId: string): string {
  return `topic:${chapterId}:${topicId}`;
}

function addWeightedPercent(metric: WeightedMetric, value: number | null | undefined, weight: number): void {
  const normalized = normalizePercent(value);
  if (normalized === null || weight <= 0) return;
  metric.sum += normalized * weight;
  metric.weight += weight;
}

function averageWeighted(metric: WeightedMetric): number | null {
  if (metric.weight <= 0) return null;
  return clampScore(metric.sum / metric.weight);
}

function safeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}
