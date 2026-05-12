export type KnowledgeNodeKind =
  | "system"
  | "chapter"
  | "topic"
  | "segment"
  | "frame"
  | "concept";

export type KnowledgeNodeStatus =
  | "mastered"
  | "stable"
  | "needs_review"
  | "weak"
  | "critical"
  | "unknown";

export type KnowledgeEdgeKind =
  | "curriculum_order"
  | "same_chapter"
  | "shared_tag"
  | "co_missed"
  | "prerequisite_manual";

export type KnowledgeActionKind =
  | "open_reader"
  | "start_mcq"
  | "review_flashcards"
  | "review_wrong_mcqs"
  | "create_study_session";

export interface KnowledgeSphereData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  summary: KnowledgeSphereSummary;
}

export interface KnowledgeSphereSummary {
  totalNodes: number;
  knownNodeCount: number;
  unknownNodeCount: number;
  dataCoverage: number; // 0..100, percent of visible curriculum with any reliable signal

  masteredCount: number;
  stableCount: number;
  needsReviewCount: number;
  weakCount: number;
  criticalCount: number;
  dueNowCount: number;

  /** Average only across known/signal-bearing nodes. This is the number shown as readiness. */
  averageMastery: number;

  /** Average across all nodes, including unknown as 0. Useful for curriculum coverage dashboards only. */
  rawCurriculumMastery: number;

  topPriorityNodeIds: string[];
}

export interface KnowledgeNode {
  id: string;
  kind: KnowledgeNodeKind;

  titleFa: string;
  titleEn?: string;

  chapterId?: string;
  topicId?: string;
  segmentId?: string;
  frameId?: string;

  parentId?: string;
  order?: number;
  tags: string[];

  metrics: KnowledgeMetrics;
  visual: KnowledgeNodeVisual;
  actions: KnowledgeNodeAction[];

  updatedAt: string;
}

export interface KnowledgeMetrics {
  /** True when at least one real Reader/MCQ/Flashcard signal exists. */
  hasRealSignal: boolean;

  mastery: number; // 0..100
  confidence: number; // 0..100

  mcqScore: number | null;
  flashcardScore: number | null;
  readerScore: number | null;

  readerCoverage: number;
  mcqAccuracy: number | null;
  flashcardRetention: number | null;
  flashcardRetrievability: number | null;

  mcqCount: number;
  correctMcqCount: number;
  wrongMcqCount: number;

  flashcardCount: number;
  dueFlashcardCount: number;
  reviewedFlashcardCount: number;

  lastStudiedAt: string | null;
  daysSinceLastStudy: number | null;

  estimatedReviewMinutes: number;
  priorityScore: number;

  highYieldWeight: number; // 0..1
}

export interface KnowledgeNodeVisual {
  status: KnowledgeNodeStatus;
  size: number;
  colorToken: string;
  ringProgress: number;
  pulse: boolean;
  opacity: number;
}

export interface KnowledgeNodeAction {
  kind: KnowledgeActionKind;
  label: string;
  href: string;
  count?: number;
  recommended?: boolean;
  disabled?: boolean;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: KnowledgeEdgeKind;
  weight: number; // 0..1
}
