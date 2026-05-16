import {
  bigint,
  pgTable,
  text,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const integer = (name: string) => bigint(name, { mode: "number" });
const nowMs = sql`(extract(epoch from now()) * 1000)::bigint`;

/**
 * Notes:
 * - All IDs are app-generated strings (ulid/cuid/uuid) for portability.
 * - Timestamps are stored as unix ms bigint values for Postgres compatibility.
 * - JSON-like payloads are stored as TEXT and typed in TS via .$type<...>().
 * - Status/enum-like fields are TEXT with narrow TS unions.
 */

export const importStatus = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
} as const;

export const chunkKind = {
  notes: "notes",
  questions: "questions",
  flashcards: "flashcards",
  mixed: "mixed",
} as const;

export const questionType = {
  singleBestAnswer: "single_best_answer",
  multipleSelect: "multiple_select",
  trueFalse: "true_false",
  extendedMatching: "extended_matching",
} as const;

export const flashcardType = {
  basic: "basic",
  basicReverse: "basic_reverse",
  cloze: "cloze",
  imageOcclusion: "image_occlusion",
  mcq: "mcq",
  compare: "compare",
  management: "management",
  pearl: "pearl",
  trap: "trap",
} as const;

export const flashcardStatus = {
  active: "active",
  pendingReview: "pending_review",
  rejected: "rejected",
} as const;

export const flashcardCreatedFrom = {
  manual: "manual",
  question: "question",
  note: "note",
} as const;

export const examMode = {
  study: "study",   // Educational mode: no timer, study panel auto-open, immediate explanations
  tutor: "tutor",
  timed: "timed",
  untimed: "untimed", // No time limit, explanations shown after block submission
} as const;

export const examStatus = {
  active: "active",
  suspended: "suspended",
  completed: "completed",
  abandoned: "abandoned",
} as const;

export const questionPoolMode = {
  all: "all",
  unused: "unused",
  incorrect: "incorrect",
  marked: "marked",
  custom: "custom",
} as const;

export const attemptOutcome = {
  correct: "correct",
  incorrect: "incorrect",
  omitted: "omitted",
} as const;

export const notebookLinkType = {
  question: "question",
  concept: "concept",
  explanation: "explanation",
  chapter: "chapter",
  chunk: "chunk",
} as const;

export const reviewRating = {
  again: 1,
  hard: 2,
  good: 3,
  easy: 4,
} as const;

/* -------------------------------------------------------------------------- */
/* CORE                                    */
/* -------------------------------------------------------------------------- */

export const chapters = pgTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    volumeNo: integer("volume_no").notNull(),
    partNo: integer("part_no"),
    partTitle: text("part_title").notNull(),
    sectionTitle: text("section_title"),
    chapterNo: integer("chapter_no").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    sourceBook: text("source_book").notNull().default("Campbell-Walsh-Wein"),
    sourceEdition: text("source_edition").notNull().default("13"),
    isActive: integer("is_active").notNull().default(1),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    chapterNoUnique: uniqueIndex("chapters_chapter_no_unique").on(t.chapterNo),
    slugUnique: uniqueIndex("chapters_slug_unique").on(t.slug),
    volumeIdx: index("chapters_volume_idx").on(t.volumeNo),
    partIdx: index("chapters_part_idx").on(t.partNo),
  }),
);

export const imports = pgTable(
  "imports",
  {
    id: text("id").primaryKey(),
    sourceName: text("source_name").notNull(), // e.g. "campbell-ch132-batch-04"
    sourceType: text("source_type").notNull(), // batch | chapter | chunk | manual
    sourceVersion: text("source_version"),
    schemaVersion: text("schema_version").notNull().default("dna-v3.1"),
    status: text("status").$type<(typeof importStatus)[keyof typeof importStatus]>().notNull(),
    inputPath: text("input_path"),
    manifestJson: text("manifest_json").$type<Record<string, unknown> | null>(),
    qcReportJson: text("qc_report_json").$type<Record<string, unknown> | null>(),
    errorMessage: text("error_message"),
    fileName: text("file_name"), // original file name
    fileType: text("file_type"), // json | csv | html | zip
    contentType: text("content_type"), // questions | flashcards | chunks | mixed
    itemCount: integer("item_count"), // total items imported
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    sourceNameIdx: index("imports_source_name_idx").on(t.sourceName),
    statusIdx: index("imports_status_idx").on(t.status),
  }),
);

export const chunks = pgTable(
  "chunks",
  {
    id: text("id").primaryKey(),
    importId: text("import_id").references(() => imports.id, { onDelete: "set null" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    title: text("title"),
    slug: text("slug").notNull(),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    anchorStart: text("anchor_start"),
    anchorEnd: text("anchor_end"),
    chunkKind: text("chunk_kind")
      .$type<(typeof chunkKind)[keyof typeof chunkKind]>()
      .notNull(),
    tokenEstimate: integer("token_estimate"),
    wordCount: integer("word_count"),
    notesHtml: text("notes_html"),
    plainText: text("plain_text"),
    metadataJson: text("metadata_json").$type<Record<string, unknown> | null>(),
    qcScore: integer("qc_score"), // 0-100
    isPublished: integer("is_published").notNull().default(1),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    chapterChunkUnique: uniqueIndex("chunks_chapter_chunk_unique").on(t.chapterId, t.chunkIndex),
    slugUnique: uniqueIndex("chunks_slug_unique").on(t.slug),
    chapterIdx: index("chunks_chapter_idx").on(t.chapterId),
    importIdx: index("chunks_import_idx").on(t.importId),
    kindIdx: index("chunks_kind_idx").on(t.chunkKind),
  }),
);

export const chunkAssets = pgTable(
  "chunk_assets",
  {
    id: text("id").primaryKey(),
    chunkId: text("chunk_id")
      .notNull()
      .references(() => chunks.id, { onDelete: "cascade" }),
    assetType: text("asset_type").notNull(), // image | table | figure | pdf | html
    label: text("label"),
    path: text("path"),
    url: text("url"),
    mimeType: text("mime_type"),
    sortOrder: integer("sort_order").notNull().default(0),
    metadataJson: text("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    chunkIdx: index("chunk_assets_chunk_idx").on(t.chunkId),
    typeIdx: index("chunk_assets_type_idx").on(t.assetType),
  }),
);

/* -------------------------------------------------------------------------- */
/* QUESTIONS                                  */
/* -------------------------------------------------------------------------- */

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    importId: text("import_id").references(() => imports.id, { onDelete: "set null" }),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    chunkId: text("chunk_id").references(() => chunks.id, { onDelete: "set null" }),
    externalKey: text("external_key"), // source-stable id from pipeline
    stemHtml: text("stem_html").notNull(),
    stemText: text("stem_text"),
    leadIn: text("lead_in"),
    explanationHtml: text("explanation_html"),
    educationalObjective: text("educational_objective"),
    whyCorrect: text("why_correct"),
    whyOthersWrongJson: text("why_others_wrong_json").$type<Record<string, string> | null>(),
    questionType: text("question_type")
      .$type<(typeof questionType)[keyof typeof questionType]>()
      .notNull()
      .default(questionType.singleBestAnswer),
    difficulty: text("difficulty"), // easy | medium | hard
    subject: text("subject"),
    system: text("system"),
    category: text("category"),
    topic: text("topic"),
    tagsJson: text("tags_json").$type<string[] | null>(),
    notebookAnchorId: text("notebook_anchor_id"),
    correctOptionId: text("correct_option_id"),
    sourceJson: text("source_json").$type<Record<string, unknown> | null>(),
    isActive: integer("is_active").notNull().default(1),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),

    // ── LWW-CRDT fields ──────────────────────────────────────────────────────
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
    // ─────────────────────────────────────────────────────────────────────────
  },
  (t) => ({
    externalKeyUnique: uniqueIndex("questions_external_key_unique").on(t.externalKey),
    chapterIdx: index("questions_chapter_idx").on(t.chapterId),
    chunkIdx: index("questions_chunk_idx").on(t.chunkId),
    importIdx: index("questions_import_idx").on(t.importId),
    subjectIdx: index("questions_subject_idx").on(t.subject),
    topicIdx: index("questions_topic_idx").on(t.topic),
    activeIdx: index("questions_active_idx").on(t.isActive),
    clockIdx: index("questions_clock_idx").on(t.logicalClock),
    deletedIdx: index("questions_deleted_idx").on(t.isDeleted),
  }),
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    optionKey: text("option_key").notNull(), // A/B/C/D/E
    contentHtml: text("content_html").notNull(),
    contentText: text("content_text"),
    isCorrect: integer("is_correct").notNull().default(0),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    qOptionUnique: uniqueIndex("question_options_q_option_unique").on(t.questionId, t.optionKey),
    questionIdx: index("question_options_question_idx").on(t.questionId),
  }),
);

/* -------------------------------------------------------------------------- */
/* FLASHCARDS                                  */
/* -------------------------------------------------------------------------- */

export const flashcards = pgTable(
  "flashcards",
  {
    id: text("id").primaryKey(),
    importId: text("import_id").references(() => imports.id, { onDelete: "set null" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chapterNo: integer("chapter_no"),
    chunkId: text("chunk_id").references(() => chunks.id, { onDelete: "set null" }),
    sourceQuestionId: text("source_question_id").references(() => questions.id, {
      onDelete: "set null",
    }),
    sourceDocId: text("source_doc_id"),
    sourceFrameId: text("source_frame_id"),
    anchorId: text("anchor_id"),
    highlightText: text("highlight_text"),
    cardType: text("card_type")
      .$type<(typeof flashcardType)[keyof typeof flashcardType]>()
      .notNull()
      .default(flashcardType.basic),
    createdFrom: text("created_from")
      .$type<(typeof flashcardCreatedFrom)[keyof typeof flashcardCreatedFrom]>()
      .notNull()
      .default(flashcardCreatedFrom.manual),
    status: text("status")
      .$type<(typeof flashcardStatus)[keyof typeof flashcardStatus]>()
      .notNull()
      .default(flashcardStatus.active),
    deck: text("deck"),
    deckId: text("deck_id"),
    frontHtml: text("front_html").notNull(),
    backHtml: text("back_html").notNull(),
    extraHtml: text("extra_html"),
    clozeText: text("cloze_text"),
    educationalObjective: text("educational_objective"),
    tagsJson: text("tags_json").$type<string[] | null>(),
    sourceJson: text("source_json").$type<Record<string, unknown> | null>(),
    fsrsStability: real("fsrs_stability").notNull().default(0),
    fsrsDifficulty: real("fsrs_difficulty").notNull().default(0),
    fsrsElapsedDays: integer("fsrs_elapsed_days").notNull().default(0),
    fsrsScheduledDays: integer("fsrs_scheduled_days").notNull().default(0),
    fsrsReps: integer("fsrs_reps").notNull().default(0),
    fsrsLapses: integer("fsrs_lapses").notNull().default(0),
    fsrsState: text("fsrs_state").notNull().default("new"),
    fsrsLastReview: integer("fsrs_last_review"),
    fsrsDue: integer("fsrs_due"),
    learningStep: integer("learning_step").notNull().default(0),
    easeFactor: real("ease_factor").notNull().default(2.5),
    intervalDays: integer("interval_days").notNull().default(0),
    isLeech: integer("is_leech").notNull().default(0),
    leechCount: integer("leech_count").notNull().default(0),
    isBuried: integer("is_buried").notNull().default(0),
    buriedUntil: integer("buried_until"),
    suspendReason: text("suspend_reason"),
    suspendedAt: integer("suspended_at"),
    siblingGroup: text("sibling_group"),
    importance: integer("importance").notNull().default(5),
    yieldScore: integer("yield_score"),
    yieldFactors: text("yield_factors").$type<string[] | null>(),
    isSuspended: integer("is_suspended").notNull().default(0),
    isArchived: integer("is_archived").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),

    // ── LWW-CRDT fields ──────────────────────────────────────────────────────
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
    // ─────────────────────────────────────────────────────────────────────────
  },
  (t) => ({
    sourceQuestionIdx: index("flashcards_source_question_idx").on(t.sourceQuestionId),
    chapterIdx: index("flashcards_chapter_idx").on(t.chapterId),
    chapterNoIdx: index("flashcards_chapter_no_idx").on(t.chapterNo),
    chunkIdx: index("flashcards_chunk_idx").on(t.chunkId),
    deckIdx: index("flashcards_deck_idx").on(t.deck),
    deckIdIdx: index("flashcards_deck_id_idx").on(t.deckId),
    dueIdx: index("flashcards_due_idx").on(t.fsrsDue),
    dueStatusSuspendedIdx: index("flashcards_due_status_suspended_idx").on(
      t.fsrsDue,
      t.status,
      t.isSuspended,
    ),
    stateIdx: index("flashcards_state_idx").on(t.fsrsState),
    statusIdx: index("flashcards_status_idx").on(t.status),
    lastReviewedIdx: index("flashcards_last_reviewed_idx").on(t.fsrsLastReview),
    siblingIdx: index("flashcards_sibling_idx").on(t.siblingGroup),
    clockIdx: index("flashcards_clock_idx").on(t.logicalClock),
    deletedIdx: index("flashcards_deleted_idx").on(t.isDeleted),
  }),
);

export const flashcardReviews = pgTable(
  "flashcard_reviews",
  {
    id: text("id").primaryKey(),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    rating: integer("rating").$type<1 | 2 | 3 | 4>().notNull(),
    state: text("state"), // FSRS state if needed
    dueAt: integer("due_at"),
    reviewedAt: integer("reviewed_at").notNull(),
    elapsedDays: integer("elapsed_days"),
    scheduledDays: integer("scheduled_days"),
    stability: integer("stability"),
    difficulty: integer("difficulty"),
    retrievability: integer("retrievability"),
    fsrsSnapshotJson: text("fsrs_snapshot_json").$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at").notNull().default(nowMs),
    // LWW-CRDT sync columns
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
  },
  (t) => ({
    flashcardIdx: index("flashcard_reviews_flashcard_idx").on(t.flashcardId),
    reviewedAtIdx: index("flashcard_reviews_reviewed_at_idx").on(t.reviewedAt),
    dueAtIdx: index("flashcard_reviews_due_at_idx").on(t.dueAt),
    clockIdx: index("fr_clock_idx").on(t.logicalClock),
  }),
);
/* -------------------------------------------------------------------------- */
/* STUDY / PROGRESS                               */
/* -------------------------------------------------------------------------- */

export const chunkStudySessions = pgTable(
  "chunk_study_sessions",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chunkId: text("chunk_id").references(() => chunks.id, { onDelete: "set null" }),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    durationSeconds: integer("duration_seconds"),
    progressPercent: integer("progress_percent"),
    lastAnchorId: text("last_anchor_id"),
    notesCount: integer("notes_count").notNull().default(0),
    highlightsCount: integer("highlights_count").notNull().default(0),
    metadataJson: text("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    chapterIdx: index("chunk_study_sessions_chapter_idx").on(t.chapterId),
    chunkIdx: index("chunk_study_sessions_chunk_idx").on(t.chunkId),
    startedAtIdx: index("chunk_study_sessions_started_at_idx").on(t.startedAt),
  }),
);

export const flashcardDecks = pgTable(
  "flashcard_decks",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: text("parent_id"),
    chapterNo: integer("chapter_no"),
    isAutoGenerated: integer("is_auto_generated").notNull().default(0),
    cardCount: integer("card_count").notNull().default(0),
    dueCount: integer("due_count").notNull().default(0),
    newCount: integer("new_count").notNull().default(0),
    settings: text("settings").$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    parentIdx: index("flashcard_decks_parent_idx").on(t.parentId),
    chapterNoIdx: index("flashcard_decks_chapter_no_idx").on(t.chapterNo),
    autoIdx: index("flashcard_decks_auto_idx").on(t.isAutoGenerated),
  }),
);

export const flashcardReviewHistory = pgTable(
  "flashcard_review_history",
  {
    id: text("id").primaryKey(),
    flashcardId: text("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    rating: integer("rating").$type<1 | 2 | 3 | 4>().notNull(),
    previousState: text("previous_state").notNull(),
    newState: text("new_state").notNull(),
    timeSpentMs: integer("time_spent_ms"),
    reviewedAt: integer("reviewed_at").notNull(),
    undone: integer("undone").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    flashcardIdx: index("flashcard_review_history_flashcard_idx").on(t.flashcardId),
    sessionIdx: index("flashcard_review_history_session_idx").on(t.sessionId),
    reviewedIdx: index("flashcard_review_history_reviewed_idx").on(t.reviewedAt),
    undoneIdx: index("flashcard_review_history_undone_idx").on(t.undone),
  }),
);

export const chapterProgressStatus = {
  notStarted: "not_started",
  reading: "reading",
  read: "read",
  reviewed: "reviewed",
  mastered: "mastered",
} as const;

export const chapterProgress = pgTable(
  "chapter_progress",
  {
    chapterNo: integer("chapter_no").primaryKey(),
    status: text("status")
      .$type<(typeof chapterProgressStatus)[keyof typeof chapterProgressStatus]>()
      .notNull()
      .default(chapterProgressStatus.notStarted),
    readCount: integer("read_count").notNull().default(0),
    lastReadAt: integer("last_read_at"),
    qAttempted: integer("q_attempted").notNull().default(0),
    qCorrect: integer("q_correct").notNull().default(0),
    // LWW-CRDT sync columns
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
  },
  (t) => ({
    statusIdx: index("chapter_progress_status_idx").on(t.status),
    lastReadIdx: index("chapter_progress_last_read_idx").on(t.lastReadAt),
    clockIdx: index("cp_clock_idx").on(t.logicalClock),
  }),
);

export const questionAttempts = pgTable(
  "question_attempts",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    examSessionId: text("exam_session_id").references(() => examSessions.id, {
      onDelete: "set null",
    }),
    selectedOptionId: text("selected_option_id"),
    correctOptionId: text("correct_option_id"),
    outcome: text("outcome")
      .$type<(typeof attemptOutcome)[keyof typeof attemptOutcome]>()
      .notNull(),
    isMarked: integer("is_marked").notNull().default(0),
    confidence: integer("confidence"), // 1-5 optional
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    attemptedAt: integer("attempted_at").notNull(),
    metadataJson: text("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at").notNull().default(nowMs),
    // LWW-CRDT sync columns
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
  },
  (t) => ({
    questionIdx: index("question_attempts_question_idx").on(t.questionId),
    examSessionIdx: index("question_attempts_exam_session_idx").on(t.examSessionId),
    outcomeIdx: index("question_attempts_outcome_idx").on(t.outcome),
    attemptedAtIdx: index("question_attempts_attempted_at_idx").on(t.attemptedAt),
    outcomeAttemptedAtIdx: index("question_attempts_outcome_attempted_at_idx").on(
      t.outcome,
      t.attemptedAt,
    ),
    clockIdx: index("qa_clock_idx").on(t.logicalClock),
  }),
);

/* -------------------------------------------------------------------------- */
/* EXAMS                                   */
/* -------------------------------------------------------------------------- */

export const examSessions = pgTable(
  "exam_sessions",
  {
    id: text("id").primaryKey(),
    title: text("title"),
    mode: text("mode").$type<(typeof examMode)[keyof typeof examMode]>().notNull(),
    status: text("status").$type<(typeof examStatus)[keyof typeof examStatus]>().notNull(),
    questionPoolMode: text("question_pool_mode")
      .$type<(typeof questionPoolMode)[keyof typeof questionPoolMode]>()
      .notNull(),
    totalQuestions: integer("total_questions").notNull(),
    currentQuestionIndex: integer("current_question_index").notNull().default(0),
    selectedSubjectIdsJson: text("selected_subject_ids_json").$type<string[] | null>(),
    selectedSystemIdsJson: text("selected_system_ids_json").$type<string[] | null>(),
    selectedChapterIdsJson: text("selected_chapter_ids_json").$type<string[] | null>(),
    configJson: text("config_json").$type<Record<string, unknown> | null>(),
    scorePercent: integer("score_percent"),
    totalCorrect: integer("total_correct").notNull().default(0),
    totalIncorrect: integer("total_incorrect").notNull().default(0),
    totalOmitted: integer("total_omitted").notNull().default(0),
    startedAt: integer("started_at").notNull(),
    suspendedAt: integer("suspended_at"),
    completedAt: integer("completed_at"),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
    // LWW-CRDT sync columns
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
  },
  (t) => ({
    statusIdx: index("exam_sessions_status_idx").on(t.status),
    modeIdx: index("exam_sessions_mode_idx").on(t.mode),
    startedAtIdx: index("exam_sessions_started_at_idx").on(t.startedAt),
    completedAtIdx: index("exam_sessions_completed_at_idx").on(t.completedAt),
    clockIdx: index("es_clock_idx").on(t.logicalClock),
  }),
);

export const examSessionQuestions = pgTable(
  "exam_session_questions",
  {
    id: text("id").primaryKey(),
    examSessionId: text("exam_session_id")
      .notNull()
      .references(() => examSessions.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull(),
    stemHtmlSnapshot: text("stem_html_snapshot"),
    explanationHtmlSnapshot: text("explanation_html_snapshot"),
    selectedOptionId: text("selected_option_id"),
    correctOptionId: text("correct_option_id"),
    isMarked: integer("is_marked").notNull().default(0),
    isSubmitted: integer("is_submitted").notNull().default(0),
    outcome: text("outcome").$type<(typeof attemptOutcome)[keyof typeof attemptOutcome] | null>(),
    timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
    answeredAt: integer("answered_at"),
    highlightJson: text("highlight_json").$type<Record<string, unknown> | null>(),
    strikeoutJson: text("strikeout_json").$type<Record<string, unknown> | null>(),
    notesJson: text("notes_json").$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    sessionOrderUnique: uniqueIndex("exam_session_questions_session_order_unique").on(
      t.examSessionId,
      t.orderIndex,
    ),
    sessionQuestionUnique: uniqueIndex("exam_session_questions_session_question_unique").on(
      t.examSessionId,
      t.questionId,
    ),
    sessionIdx: index("exam_session_questions_session_idx").on(t.examSessionId),
    questionIdx: index("exam_session_questions_question_idx").on(t.questionId),
    outcomeIdx: index("exam_session_questions_outcome_idx").on(t.outcome),
  }),
);

/* -------------------------------------------------------------------------- */
/* NOTES / BOOKMARKS / LINKS                       */
/* -------------------------------------------------------------------------- */

export const questionNotes = pgTable(
  "question_notes",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").references(() => questions.id, { onDelete: "cascade" }),
    examSessionId: text("exam_session_id").references(() => examSessions.id, {
      onDelete: "set null",
    }),
    examSessionQuestionId: text("exam_session_question_id").references(
      () => examSessionQuestions.id,
      { onDelete: "set null" },
    ),
    title: text("title"),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    questionIdx: index("question_notes_question_idx").on(t.questionId),
    sessionIdx: index("question_notes_session_idx").on(t.examSessionId),
    sessionQuestionIdx: index("question_notes_session_question_idx").on(t.examSessionQuestionId),
  }),
);

export const questionBookmarks = pgTable(
  "question_bookmarks",
  {
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.questionId] }),
  }),
);

export const questionNotebookLinks = pgTable(
  "question_notebook_links",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chunkId: text("chunk_id").references(() => chunks.id, { onDelete: "set null" }),
    linkType: text("link_type")
      .$type<(typeof notebookLinkType)[keyof typeof notebookLinkType]>()
      .notNull(),
    notebookAnchorId: text("notebook_anchor_id"),
    label: text("label"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    questionIdx: index("question_notebook_links_question_idx").on(t.questionId),
    chapterIdx: index("question_notebook_links_chapter_idx").on(t.chapterId),
    chunkIdx: index("question_notebook_links_chunk_idx").on(t.chunkId),
    anchorIdx: index("question_notebook_links_anchor_idx").on(t.notebookAnchorId),
  }),
);

/* -------------------------------------------------------------------------- */
/* RELATIONS                                 */
/* -------------------------------------------------------------------------- */

export const chaptersRelations = relations(chapters, ({ many }) => ({
  chunks: many(chunks),
  questions: many(questions),
  flashcards: many(flashcards),
  studySessions: many(chunkStudySessions),
  notebookLinks: many(questionNotebookLinks),
}));

export const importsRelations = relations(imports, ({ many }) => ({
  chunks: many(chunks),
  questions: many(questions),
  flashcards: many(flashcards),
}));

export const chunksRelations = relations(chunks, ({ one, many }) => ({
  chapter: one(chapters, {
    fields: [chunks.chapterId],
    references: [chapters.id],
  }),
  import: one(imports, {
    fields: [chunks.importId],
    references: [imports.id],
  }),
  assets: many(chunkAssets),
  questions: many(questions),
  flashcards: many(flashcards),
  studySessions: many(chunkStudySessions),
  notebookLinks: many(questionNotebookLinks),
}));

export const chunkAssetsRelations = relations(chunkAssets, ({ one }) => ({
  chunk: one(chunks, {
    fields: [chunkAssets.chunkId],
    references: [chunks.id],
  }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  chapter: one(chapters, {
    fields: [questions.chapterId],
    references: [chapters.id],
  }),
  chunk: one(chunks, {
    fields: [questions.chunkId],
    references: [chunks.id],
  }),
  import: one(imports, {
    fields: [questions.importId],
    references: [imports.id],
  }),
  options: many(questionOptions),
  flashcards: many(flashcards),
  attempts: many(questionAttempts),
  examSessionQuestions: many(examSessionQuestions),
  notes: many(questionNotes),
  notebookLinks: many(questionNotebookLinks),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const flashcardsRelations = relations(flashcards, ({ one, many }) => ({
  import: one(imports, {
    fields: [flashcards.importId],
    references: [imports.id],
  }),
  chapter: one(chapters, {
    fields: [flashcards.chapterId],
    references: [chapters.id],
  }),
  chunk: one(chunks, {
    fields: [flashcards.chunkId],
    references: [chunks.id],
  }),
  sourceQuestion: one(questions, {
    fields: [flashcards.sourceQuestionId],
    references: [questions.id],
  }),
  deckRef: one(flashcardDecks, {
    fields: [flashcards.deckId],
    references: [flashcardDecks.id],
  }),
  reviews: many(flashcardReviews),
  reviewHistory: many(flashcardReviewHistory),
}));

export const flashcardReviewsRelations = relations(flashcardReviews, ({ one }) => ({
  flashcard: one(flashcards, {
    fields: [flashcardReviews.flashcardId],
    references: [flashcards.id],
  }),
}));

export const flashcardDecksRelations = relations(flashcardDecks, ({ one, many }) => ({
  parent: one(flashcardDecks, {
    fields: [flashcardDecks.parentId],
    references: [flashcardDecks.id],
  }),
  children: many(flashcardDecks),
  flashcards: many(flashcards),
}));

export const flashcardReviewHistoryRelations = relations(flashcardReviewHistory, ({ one }) => ({
  flashcard: one(flashcards, {
    fields: [flashcardReviewHistory.flashcardId],
    references: [flashcards.id],
  }),
}));

export const chunkStudySessionsRelations = relations(chunkStudySessions, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chunkStudySessions.chapterId],
    references: [chapters.id],
  }),
  chunk: one(chunks, {
    fields: [chunkStudySessions.chunkId],
    references: [chunks.id],
  }),
}));

export const examSessionsRelations = relations(examSessions, ({ many }) => ({
  sessionQuestions: many(examSessionQuestions),
  attempts: many(questionAttempts),
  notes: many(questionNotes),
}));

export const examSessionQuestionsRelations = relations(
  examSessionQuestions,
  ({ one, many }) => ({
    examSession: one(examSessions, {
      fields: [examSessionQuestions.examSessionId],
      references: [examSessions.id],
    }),
    question: one(questions, {
      fields: [examSessionQuestions.questionId],
      references: [questions.id],
    }),
    notes: many(questionNotes),
  }),
);

export const questionAttemptsRelations = relations(questionAttempts, ({ one }) => ({
  question: one(questions, {
    fields: [questionAttempts.questionId],
    references: [questions.id],
  }),
  examSession: one(examSessions, {
    fields: [questionAttempts.examSessionId],
    references: [examSessions.id],
  }),
}));

export const questionNotesRelations = relations(questionNotes, ({ one }) => ({
  question: one(questions, {
    fields: [questionNotes.questionId],
    references: [questions.id],
  }),
  examSession: one(examSessions, {
    fields: [questionNotes.examSessionId],
    references: [examSessions.id],
  }),
  examSessionQuestion: one(examSessionQuestions, {
    fields: [questionNotes.examSessionQuestionId],
    references: [examSessionQuestions.id],
  }),
}));

export const questionNotebookLinksRelations = relations(
  questionNotebookLinks,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionNotebookLinks.questionId],
      references: [questions.id],
    }),
    chapter: one(chapters, {
      fields: [questionNotebookLinks.chapterId],
      references: [chapters.id],
    }),
    chunk: one(chunks, {
      fields: [questionNotebookLinks.chunkId],
      references: [chunks.id],
    }),
  }),
);

/* ========================================================================== */
/* STUDY PLANNER                                 */
/* ========================================================================== */

export const taskType = {
  chapterRead: "chapter_read",
  chunkReview: "chunk_review",
  questionBlock: "question_block",
  flashcardReview: "flashcard_review",
  examBlock: "exam_block",
  notebookReview: "notebook_review",
  customTask: "custom_task",
  weakAreaReview: "weak_area_review",
} as const;

export const taskStatus = {
  pending: "pending",
  inProgress: "in_progress",
  completed: "completed",
  skipped: "skipped",
  overdue: "overdue",
  rescheduled: "rescheduled",
} as const;

export const planStatus = {
  draft: "draft",
  active: "active",
  paused: "paused",
  completed: "completed",
  archived: "archived",
} as const;

export const taskEventKind = {
  created: "created",
  started: "started",
  completed: "completed",
  skipped: "skipped",
  rescheduled: "rescheduled",
  overdue_marked: "overdue_marked",
  note_added: "note_added",
  progress_updated: "progress_updated",
} as const;

export const dayOfWeek = {
  saturday: "saturday",
  sunday: "sunday",
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
} as const;

export const targetMode = {
  examPrep: "exam_prep",
  generalReview: "general_review",
  deepStudy: "deep_study",
  weakAreaFocus: "weak_area_focus",
} as const;

export const planDayStatus = {
  scheduled: "scheduled",
  completed: "completed",
  partial: "partial",
  skipped: "skipped",
  rest: "rest",
} as const;

export const taskSourceType = {
  manual: "manual",
  aiGenerated: "ai_generated",
  fsrsDue: "fsrs_due",
  weakArea: "weak_area",
} as const;

export const segmentReadStatus = {
  unread: "unread",
  reading: "reading",
  read: "read",
} as const;

export const originRefType = {
  chapter: "chapter",
  chunk: "chunk",
  question: "question",
  flashcard: "flashcard",
  weakArea: "weak_area",
  concept: "concept",
  segment: "segment",
  frame: "frame",
  document: "document",
} as const;

export const plannerMode = {
  manual: "manual",
  aiGuided: "ai_guided",
  hybrid: "hybrid",
} as const;

export const weakAreaEventType = {
  detected: "detected",
  questionMiss: "question_miss",
  flashcardLapse: "flashcard_lapse",
  remediated: "remediated",
  recovered: "recovered",
  worsened: "worsened",
} as const;

/* -------------------------------------------------------------------------- */
/* study_plans — top-level plan container                                     */
/* -------------------------------------------------------------------------- */

export const studyPlans = pgTable(
  "study_plans",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status")
      .$type<(typeof planStatus)[keyof typeof planStatus]>()
      .notNull()
      .default(planStatus.draft),
    startDate: text("start_date").notNull(), // ISO date YYYY-MM-DD
    endDate: text("end_date"),               // ISO date YYYY-MM-DD
    selectedChapterIdsJson: text("selected_chapter_ids_json").$type<string[] | null>(),
    goalJson: text("goal_json").$type<Record<string, unknown> | null>(),
    repeatPattern: text("repeat_pattern"), // e.g. "weekly", "custom"
    totalTasks: integer("total_tasks").notNull().default(0),
    completedTasks: integer("completed_tasks").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    lessonId: text("lesson_id"),
    examDate: text("exam_date"),                  // ISO date YYYY-MM-DD
    targetMode: text("target_mode")
      .$type<(typeof targetMode)[keyof typeof targetMode]>(),
    dailyTimeBudgetMin: integer("daily_time_budget_min").notNull().default(120),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    statusIdx: index("study_plans_status_idx").on(t.status),
    startDateIdx: index("study_plans_start_date_idx").on(t.startDate),
    examDateIdx: index("study_plans_exam_date_idx").on(t.examDate),
    targetModeIdx: index("study_plans_target_mode_idx").on(t.targetMode),
  }),
);

/* -------------------------------------------------------------------------- */
/* study_plan_days — one row per calendar day in a plan                        */
/* -------------------------------------------------------------------------- */

export const studyPlanDays = pgTable(
  "study_plan_days",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    date: text("date").notNull(),               // ISO date YYYY-MM-DD
    dayOfWeek: text("day_of_week")
      .$type<(typeof dayOfWeek)[keyof typeof dayOfWeek]>()
      .notNull(),
    label: text("label"),                        // e.g. "تمرکز روی فصل ۱۳۲"
    isRestDay: integer("is_rest_day").notNull().default(0),
    totalTasks: integer("total_tasks").notNull().default(0),
    completedTasks: integer("completed_tasks").notNull().default(0),
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    actualMinutes: integer("actual_minutes").notNull().default(0),
    notesText: text("notes_text"),
    targetMinutes: integer("target_minutes").notNull().default(0),
    assignedMinutes: integer("assigned_minutes").notNull().default(0),
    completedMinutes: integer("completed_minutes").notNull().default(0),
    loadScore: integer("load_score").notNull().default(0),
    status: text("status")
      .$type<(typeof planDayStatus)[keyof typeof planDayStatus]>()
      .notNull()
      .default(planDayStatus.scheduled),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    planDateUnique: uniqueIndex("study_plan_days_plan_date_unique").on(t.planId, t.date),
    planIdx: index("study_plan_days_plan_idx").on(t.planId),
    dateIdx: index("study_plan_days_date_idx").on(t.date),
    dayOfWeekIdx: index("study_plan_days_dow_idx").on(t.dayOfWeek),
    statusIdx: index("study_plan_days_status_idx").on(t.status),
  }),
);

/* -------------------------------------------------------------------------- */
/* study_tasks — individual tasks within a plan day                             */
/* -------------------------------------------------------------------------- */

export const studyTasks = pgTable(
  "study_tasks",
  {
    id: text("id").primaryKey(),
    planId: text("plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    dayId: text("day_id")
      .references(() => studyPlanDays.id, { onDelete: "set null" }),
    taskType: text("task_type")
      .$type<(typeof taskType)[keyof typeof taskType]>()
      .notNull(),
    status: text("status")
      .$type<(typeof taskStatus)[keyof typeof taskStatus]>()
      .notNull()
      .default(taskStatus.pending),
    title: text("title").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    actualMinutes: integer("actual_minutes").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    targetCount: integer("target_count"),       // e.g. 20 questions, 50 flashcards
    completedCount: integer("completed_count").notNull().default(0),
    priority: integer("priority").notNull().default(0), // 0=normal, 1=high, 2=critical
    dueAt: integer("due_at"),                   // optional deadline in unix ms
    startedAt: integer("started_at"),
    completedAt: integer("completed_at"),
    rescheduledTo: text("rescheduled_to"),      // dayId of destination if rescheduled
    resultJson: text("result_json").$type<Record<string, unknown> | null>(),
    notesText: text("notes_text"),
    sourceType: text("source_type")
      .$type<(typeof taskSourceType)[keyof typeof taskSourceType]>()
      .default(taskSourceType.manual),
    difficultyWeight: integer("difficulty_weight").notNull().default(1),
    scheduledFor: text("scheduled_for"),       // ISO date YYYY-MM-DD
    originRefType: text("origin_ref_type")
      .$type<(typeof originRefType)[keyof typeof originRefType]>(),
    originRefId: text("origin_ref_id"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
    // LWW-CRDT sync columns
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
  },
  (t) => ({
    planIdx: index("study_tasks_plan_idx").on(t.planId),
    dayIdx: index("study_tasks_day_idx").on(t.dayId),
    taskTypeIdx: index("study_tasks_type_idx").on(t.taskType),
    statusIdx: index("study_tasks_status_idx").on(t.status),
    sortOrderIdx: index("study_tasks_sort_order_idx").on(t.dayId, t.sortOrder),
    dueAtIdx: index("study_tasks_due_at_idx").on(t.dueAt),
    priorityIdx: index("study_tasks_priority_idx").on(t.priority),
    sourceTypeIdx: index("study_tasks_source_type_idx").on(t.sourceType),
    originIdx: index("study_tasks_origin_idx").on(t.originRefType, t.originRefId),
    scheduledForIdx: index("study_tasks_scheduled_for_idx").on(t.scheduledFor),
    statusScheduledForIdx: index("study_tasks_status_scheduled_for_idx").on(
      t.status,
      t.scheduledFor,
    ),
    clockIdx: index("st_clock_idx").on(t.logicalClock),
  }),
);

/* -------------------------------------------------------------------------- */
/* study_task_links — references from a task to content entities              */
/* -------------------------------------------------------------------------- */

export const studyTaskLinks = pgTable(
  "study_task_links",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => studyTasks.id, { onDelete: "cascade" }),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chunkId: text("chunk_id").references(() => chunks.id, { onDelete: "set null" }),
    questionId: text("question_id").references(() => questions.id, { onDelete: "set null" }),
    flashcardId: text("flashcard_id").references(() => flashcards.id, { onDelete: "set null" }),
    examSessionId: text("exam_session_id").references(() => examSessions.id, { onDelete: "set null" }),
    segmentId: text("segment_id"),
    docId: text("doc_id"),
    frameId: text("frame_id"),
    conceptId: text("concept_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    metadataJson: text("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    taskIdx: index("study_task_links_task_idx").on(t.taskId),
    chapterIdx: index("study_task_links_chapter_idx").on(t.chapterId),
    chunkIdx: index("study_task_links_chunk_idx").on(t.chunkId),
    questionIdx: index("study_task_links_question_idx").on(t.questionId),
    flashcardIdx: index("study_task_links_flashcard_idx").on(t.flashcardId),
    examSessionIdx: index("study_task_links_exam_session_idx").on(t.examSessionId),
    segmentIdx: index("study_task_links_segment_idx").on(t.segmentId),
    docIdx: index("study_task_links_doc_idx").on(t.docId),
    frameIdx: index("study_task_links_frame_idx").on(t.frameId),
    conceptIdx: index("study_task_links_concept_idx").on(t.conceptId),
  }),
);

/* -------------------------------------------------------------------------- */
/* segment_progress — segment-level progress within a study plan              */
/* -------------------------------------------------------------------------- */

export const segmentProgress = pgTable(
  "segment_progress",
  {
    planId: text("plan_id")
      .notNull()
      .references(() => studyPlans.id, { onDelete: "cascade" }),
    segmentId: text("segment_id").notNull(),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    chapterNo: integer("chapter_no"),
    docId: text("doc_id"),
    segmentTitle: text("segment_title"),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    frameCount: integer("frame_count").notNull().default(0),
    highYieldCount: integer("high_yield_count").notNull().default(0),
    readStatus: text("read_status")
      .$type<(typeof segmentReadStatus)[keyof typeof segmentReadStatus]>()
      .notNull()
      .default(segmentReadStatus.unread),
    readAt: integer("read_at"),
    framesTotal: integer("frames_total").notNull().default(0),
    framesMastered: integer("frames_mastered").notNull().default(0),
    mcqsTotal: integer("mcqs_total").notNull().default(0),
    mcqsAttempted: integer("mcqs_attempted").notNull().default(0),
    mcqsCorrect: integer("mcqs_correct").notNull().default(0),
    cardsTotal: integer("cards_total").notNull().default(0),
    cardsDue: integer("cards_due").notNull().default(0),
    cardsMastered: integer("cards_mastered").notNull().default(0),
    masteryScore: integer("mastery_score").notNull().default(0),
    needsReview: integer("needs_review").notNull().default(0),
    lastComputedAt: integer("last_computed_at"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.planId, t.segmentId], name: "segment_progress_pk" }),
    planIdx: index("segment_progress_plan_idx").on(t.planId),
    segmentIdx: index("segment_progress_segment_idx").on(t.segmentId),
    chapterIdx: index("segment_progress_chapter_idx").on(t.chapterId),
    chapterNoIdx: index("segment_progress_chapter_no_idx").on(t.chapterNo),
    readStatusIdx: index("segment_progress_read_status_idx").on(t.readStatus),
    needsReviewIdx: index("segment_progress_needs_review_idx").on(t.needsReview),
    masteryIdx: index("segment_progress_mastery_idx").on(t.masteryScore),
    docIdx: index("segment_progress_doc_idx").on(t.docId),
  }),
);

/* -------------------------------------------------------------------------- */
/* study_task_events — append-only audit log for task lifecycle               */
/* -------------------------------------------------------------------------- */

export const studyTaskEvents = pgTable(
  "study_task_events",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => studyTasks.id, { onDelete: "cascade" }),
    eventKind: text("event_kind")
      .$type<(typeof taskEventKind)[keyof typeof taskEventKind]>()
      .notNull(),
    payload: text("payload").$type<Record<string, unknown> | null>(),
    occurredAt: integer("occurred_at").notNull().default(nowMs),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    taskIdx: index("study_task_events_task_idx").on(t.taskId),
    kindIdx: index("study_task_events_kind_idx").on(t.eventKind),
    occurredAtIdx: index("study_task_events_occurred_at_idx").on(t.occurredAt),
  }),
);

/* -------------------------------------------------------------------------- */
/* study_planner_settings — per-user planner preferences                      */
/* -------------------------------------------------------------------------- */

export const studyPlannerSettings = pgTable(
  "study_planner_settings",
  {
    id: text("id").primaryKey(),           // singleton row or user-scoped
    defaultPlanId: text("default_plan_id").references(() => studyPlans.id, { onDelete: "set null" }),
    dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(120),
    preferredStartTime: text("preferred_start_time"), // HH:MM
    restDaysJson: text("rest_days_json")
      .$type<(typeof dayOfWeek)[keyof typeof dayOfWeek][] | null>(),
    notificationsEnabled: integer("notifications_enabled").notNull().default(1),
    autoReschedule: integer("auto_reschedule").notNull().default(0),
    defaultTaskDurationMinutes: integer("default_task_duration_minutes").notNull().default(30),
    streakCurrent: integer("streak_current").notNull().default(0),
    streakLongest: integer("streak_longest").notNull().default(0),
    lastStudyDate: text("last_study_date"),  // ISO date YYYY-MM-DD
    preferencesJson: text("preferences_json").$type<Record<string, unknown> | null>(),
    userId: text("user_id"),
    plannerMode: text("planner_mode")
      .$type<(typeof plannerMode)[keyof typeof plannerMode]>()
      .default(plannerMode.manual),
    autoScheduleFsrs: integer("auto_schedule_fsrs").notNull().default(1),
    autoScheduleWeakAreas: integer("auto_schedule_weak_areas").notNull().default(0),
    autoScheduleQuestions: integer("auto_schedule_questions").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    userIdx: index("study_planner_settings_user_idx").on(t.userId),
  }),
);

/* -------------------------------------------------------------------------- */
/* PLANNER RELATIONS                                                          */
/* -------------------------------------------------------------------------- */

export const studyPlansRelations = relations(studyPlans, ({ many }) => ({
  days: many(studyPlanDays),
  tasks: many(studyTasks),
  segments: many(segmentProgress),
}));

export const studyPlanDaysRelations = relations(studyPlanDays, ({ one, many }) => ({
  plan: one(studyPlans, {
    fields: [studyPlanDays.planId],
    references: [studyPlans.id],
  }),
  tasks: many(studyTasks),
}));

export const studyTasksRelations = relations(studyTasks, ({ one, many }) => ({
  plan: one(studyPlans, {
    fields: [studyTasks.planId],
    references: [studyPlans.id],
  }),
  day: one(studyPlanDays, {
    fields: [studyTasks.dayId],
    references: [studyPlanDays.id],
  }),
  links: many(studyTaskLinks),
  events: many(studyTaskEvents),
}));

export const studyTaskLinksRelations = relations(studyTaskLinks, ({ one }) => ({
  task: one(studyTasks, {
    fields: [studyTaskLinks.taskId],
    references: [studyTasks.id],
  }),
  chapter: one(chapters, {
    fields: [studyTaskLinks.chapterId],
    references: [chapters.id],
  }),
  chunk: one(chunks, {
    fields: [studyTaskLinks.chunkId],
    references: [chunks.id],
  }),
  question: one(questions, {
    fields: [studyTaskLinks.questionId],
    references: [questions.id],
  }),
  flashcard: one(flashcards, {
    fields: [studyTaskLinks.flashcardId],
    references: [flashcards.id],
  }),
  examSession: one(examSessions, {
    fields: [studyTaskLinks.examSessionId],
    references: [examSessions.id],
  }),
}));

export const segmentProgressRelations = relations(segmentProgress, ({ one }) => ({
  plan: one(studyPlans, {
    fields: [segmentProgress.planId],
    references: [studyPlans.id],
  }),
  chapter: one(chapters, {
    fields: [segmentProgress.chapterId],
    references: [chapters.id],
  }),
}));

export const studyTaskEventsRelations = relations(studyTaskEvents, ({ one }) => ({
  task: one(studyTasks, {
    fields: [studyTaskEvents.taskId],
    references: [studyTasks.id],
  }),
}));

export const studyPlannerSettingsRelations = relations(studyPlannerSettings, ({ one }) => ({
  defaultPlan: one(studyPlans, {
    fields: [studyPlannerSettings.defaultPlanId],
    references: [studyPlans.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* weak_areas — tracks weak concepts per user                                 */
/* -------------------------------------------------------------------------- */

export const weakAreas = pgTable(
  "weak_areas",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    conceptId: text("concept_id"),
    chapterId: text("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    strengthScore: integer("strength_score").notNull().default(50),
    weaknessScore: integer("weakness_score").notNull().default(50),
    lastSeenAt: integer("last_seen_at"),
    lastRemediatedAt: integer("last_remediated_at"),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    userIdx: index("weak_areas_user_idx").on(t.userId),
    conceptIdx: index("weak_areas_concept_idx").on(t.userId, t.conceptId),
    chapterIdx: index("weak_areas_chapter_idx").on(t.chapterId),
    activeIdx: index("weak_areas_active_idx").on(t.userId, t.active),
  }),
);

/* -------------------------------------------------------------------------- */
/* weak_area_events — event log for weak area changes                         */
/* -------------------------------------------------------------------------- */

export const weakAreaEvents = pgTable(
  "weak_area_events",
  {
    id: text("id").primaryKey(),
    weakAreaId: text("weak_area_id")
      .notNull()
      .references(() => weakAreas.id, { onDelete: "cascade" }),
    eventType: text("event_type")
      .$type<(typeof weakAreaEventType)[keyof typeof weakAreaEventType]>()
      .notNull(),
    sourceRefType: text("source_ref_type")
      .$type<(typeof originRefType)[keyof typeof originRefType]>(),
    sourceRefId: text("source_ref_id"),
    weight: integer("weight").notNull().default(1),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    weakAreaIdx: index("weak_area_events_weak_area_idx").on(t.weakAreaId),
    eventTypeIdx: index("weak_area_events_type_idx").on(t.eventType),
    sourceIdx: index("weak_area_events_source_idx").on(t.sourceRefType, t.sourceRefId),
  }),
);

/* -------------------------------------------------------------------------- */
/* concept_mastery — aggregated mastery scores per concept per user          */
/* -------------------------------------------------------------------------- */

export const conceptMastery = pgTable(
  "concept_mastery",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    conceptId: text("concept_id").notNull(),
    masteryScore: integer("mastery_score").notNull().default(0),
    questionAccuracy: integer("question_accuracy").notNull().default(0),
    flashcardRetention: integer("flashcard_retention").notNull().default(0),
    recencyScore: integer("recency_score").notNull().default(0),
    exposureCount: integer("exposure_count").notNull().default(0),
    lastReviewedAt: integer("last_reviewed_at"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    userConceptUnique: uniqueIndex("concept_mastery_user_concept_unique").on(t.userId, t.conceptId),
    userIdx: index("concept_mastery_user_idx").on(t.userId),
    conceptIdx: index("concept_mastery_concept_idx").on(t.conceptId),
    masteryIdx: index("concept_mastery_mastery_idx").on(t.userId, t.masteryScore),
  }),
);

/* -------------------------------------------------------------------------- */
/* WEAK AREAS & CONCEPT MASTERY RELATIONS                                     */
/* -------------------------------------------------------------------------- */

export const weakAreasRelations = relations(weakAreas, ({ one, many }) => ({
  chapter: one(chapters, {
    fields: [weakAreas.chapterId],
    references: [chapters.id],
  }),
  events: many(weakAreaEvents),
}));

export const weakAreaEventsRelations = relations(weakAreaEvents, ({ one }) => ({
  weakArea: one(weakAreas, {
    fields: [weakAreaEvents.weakAreaId],
    references: [weakAreas.id],
  }),
}));
/* ============================================ */
/* URO Knowledge Contract Tables (v1.0.0)      */
/* Added for note-viewer system                */
/* Do not modify tables above this line        */
/* ============================================ */

export const contractChapters = pgTable(
  "contract_chapters",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    chapterNo: integer("chapter_no").notNull(),
    chapterTitle: text("chapter_title").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    sourceChapterUnique: uniqueIndex("contract_chapters_source_chapter_unique").on(
      t.sourceId,
      t.chapterNo,
    ),
  }),
);

export const ingestBatches = pgTable(
  "ingest_batches",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    contractVersion: text("contract_version").notNull(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull().default("pending"),
    documentsCount: integer("documents_count").notNull().default(0),
    questionsCount: integer("questions_count").notNull().default(0),
    linksCount: integer("links_count").notNull().default(0),
    validationStatus: text("validation_status").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),

    updatedAt: integer("updated_at").notNull().default(nowMs),
    isDeleted: integer("is_deleted").notNull().default(0),
    logicalClock: integer("logical_clock").notNull().default(0),
    originId: text("origin_id"),
  },
  (t) => ({
    batchIdUnique: uniqueIndex("ingest_batches_batch_id_unique").on(t.batchId),
    clockIdx: index("ingest_batches_clock_idx").on(t.logicalClock),
    deletedIdx: index("ingest_batches_deleted_idx").on(t.isDeleted),
  }),
);

export const noteDocuments = pgTable(
  "note_documents",
  {
    id: text("id").primaryKey(),
    docId: text("doc_id").notNull().unique(), 
    logicalChunkId: text("logical_chunk_id").notNull(),
    version: integer("version").notNull(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => contractChapters.id),
    chapterNo: integer("chapter_no").notNull(),
    chapterTitle: text("chapter_title").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    pageRange: text("page_range"),
    generatedAt: integer("generated_at").notNull(),
    ingestStatus: text("ingest_status").notNull().default("active"),
    ingestBatchId: text("ingest_batch_id").references(() => ingestBatches.id),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    // 👈 خط مربوط به docIdUnique از اینجا حذف شد تا تداخل برطرف شود
    chapterIdx: index("note_documents_chapter_idx").on(t.chapterId),
    chapterNoIdx: index("note_documents_chapter_no_idx").on(t.chapterNo),
    createdAtIdx: index("note_documents_created_at_idx").on(t.createdAt),
    batchIdx: index("note_documents_batch_idx").on(t.ingestBatchId),
  }),
);

export const noteSections = pgTable(
  "note_sections",
  {
    id: text("id").primaryKey(),
    sectionId: text("section_id").notNull().unique(), 
    docId: text("doc_id")
      .notNull()
      .references(() => noteDocuments.docId, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    title: text("title").notNull(),
    hook: text("hook"),
    closingKeypoint: text("closing_keypoint"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    // 👈 خط مربوط به sectionIdUnique حذف شد
    docIdx: index("note_sections_doc_idx").on(t.docId),
  }),
);

export const noteFrames = pgTable(
  "note_frames",
  {
    id: text("id").primaryKey(),
    frameId: text("frame_id").notNull().unique(),
    docId: text("doc_id")
      .notNull()
      .references(() => noteDocuments.docId, { onDelete: "cascade" }),
    sectionId: text("section_id")
      .notNull()
      .references(() => noteSections.sectionId, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    marginNote: text("margin_note"),
    // ── v8.1 additive columns (all nullable — legacy rows keep NULL) ──
    // schemaVersion: "7.5" | "8.0" | null. NULL = pre-v8.1 legacy row.
    schemaVersion: text("schema_version"),
    // sha256 digest of normalized content. Runtime-computed at import.
    contentHash: text("content_hash"),
    // v8 BlockDisplayV8, serialized JSON. NULL for v7.5 / legacy.
    displayJson: text("display_json"),
    // v8 BlockFlagsV8, serialized JSON. NULL for v7.5 / legacy.
    flagsJson: text("flags_json"),
    // ── v8.2 pushdown columns (nullable int; 0/1 boolean) ──
    // Populated by the importer at write time (not GENERATED ALWAYS AS, because
    // that would require jsonb expression reliability across Postgres and
    // PGlite). Legacy rows keep NULL (unknown). Filters in SQL are cheap:
    //   WHERE has_mermaid = 1
    //   WHERE high_yield = 1
    // Partial indexes keep the on-disk cost tiny.
    hasMermaid: integer("has_mermaid"),
    highYield: integer("high_yield"),
    decisionChanging: integer("decision_changing"),
    examRelevant: integer("exam_relevant"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    docIdx: index("note_frames_doc_idx").on(t.docId),
    sectionIdx: index("note_frames_section_idx").on(t.sectionId),
    // Cheap categorical filter for query helpers (e.g. "all v8 blocks").
    schemaVersionIdx: index("note_frames_schema_version_idx").on(t.schemaVersion),
    // v8.2 pushdown indexes. Partial indexes (WHERE = 1) keep them tiny and
    // only useful for the "present" case, which is the only direction filters
    // go in practice.
    hasMermaidIdx: index("note_frames_has_mermaid_idx").on(t.hasMermaid),
    highYieldIdx: index("note_frames_high_yield_idx").on(t.highYield),
    decisionChangingIdx: index("note_frames_decision_changing_idx").on(t.decisionChanging),
    examRelevantIdx: index("note_frames_exam_relevant_idx").on(t.examRelevant),
  }),
);

export const contractQuestions = pgTable(
  "contract_questions",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").notNull().unique(), 
    chapterNo: integer("chapter_no").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    logicalChunkId: text("logical_chunk_id").notNull(),
    stem: text("stem").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    explanation: text("explanation").notNull(),
    linkedDocId: text("linked_doc_id").references(() => noteDocuments.docId),
    primaryAnchorId: text("primary_anchor_id"),
    difficulty: text("difficulty"),
    tagsJson: text("tags_json").$type<string[] | null>(),
    ingestBatchId: text("ingest_batch_id").references(() => ingestBatches.id),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    // 👈 خط مربوط به questionIdUnique حذف شد
    docIdx: index("contract_questions_doc_idx").on(t.linkedDocId),
    batchIdx: index("contract_questions_batch_idx").on(t.ingestBatchId),
  }),
);

export const contractQuestionChoices = pgTable(
  "contract_question_choices",
  {
    id: text("id").primaryKey(),

    // internal FK -> parent PK
    contractQuestionId: text("contract_question_id")
      .notNull()
      .references(() => contractQuestions.id, { onDelete: "cascade" }),

    // optional external id copy for debugging/import traceability
    questionId: text("question_id"),

    letter: text("letter").notNull(),
    text: text("text").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    questionLetterUnique: uniqueIndex("contract_choices_question_letter_unique").on(
      t.contractQuestionId,
      t.letter,
    ),
    questionIdx: index("contract_choices_question_idx").on(t.contractQuestionId),
    externalQuestionIdx: index("contract_choices_external_question_idx").on(t.questionId),
  }),
);

export const contractQuestionNoteLinks = pgTable(
  "contract_question_note_links",
  {
    id: text("id").primaryKey(),
    linkId: text("link_id").notNull(),

    // internal FK -> parent PK
    contractQuestionId: text("contract_question_id")
      .notNull()
      .references(() => contractQuestions.id, { onDelete: "cascade" }),

    // optional external id copy for debugging/import traceability
    questionId: text("question_id"),

    docId: text("doc_id")
      .notNull()
      .references(() => noteDocuments.docId, { onDelete: "cascade" }),

    frameId: text("frame_id")
      .notNull()
      .references(() => noteFrames.frameId, { onDelete: "cascade" }),

    relationType: text("relation_type").notNull(),
    linkStatus: text("link_status").notNull(),
    linkedAt: integer("linked_at").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (t) => ({
    linkIdUnique: uniqueIndex("contract_qnl_link_id_unique").on(t.linkId),
    questionIdx: index("contract_qnl_question_idx").on(t.contractQuestionId),
    externalQuestionIdx: index("contract_qnl_external_question_idx").on(t.questionId),
    docIdx: index("contract_qnl_doc_idx").on(t.docId),
    frameIdx: index("contract_qnl_frame_idx").on(t.frameId),
  }),
);

/* ---- Contract Relations ---- */

export const contractChaptersRelations = relations(contractChapters, ({ many }) => ({
  documents: many(noteDocuments),
}));

export const ingestBatchesRelations = relations(ingestBatches, ({ many }) => ({
  documents: many(noteDocuments),
  questions: many(contractQuestions),
}));

export const noteDocumentsRelations = relations(noteDocuments, ({ one, many }) => ({
  chapter: one(contractChapters, {
    fields: [noteDocuments.chapterId],
    references: [contractChapters.id],
  }),
  batch: one(ingestBatches, {
    fields: [noteDocuments.ingestBatchId],
    references: [ingestBatches.id],
  }),
  sections: many(noteSections),
  frames: many(noteFrames),
  contractQuestions: many(contractQuestions),
  questionLinks: many(contractQuestionNoteLinks),
}));

export const noteSectionsRelations = relations(noteSections, ({ one, many }) => ({
  document: one(noteDocuments, {
    fields: [noteSections.docId],
    references: [noteDocuments.docId],
  }),
  frames: many(noteFrames),
}));

export const noteFramesRelations = relations(noteFrames, ({ one, many }) => ({
  document: one(noteDocuments, {
    fields: [noteFrames.docId],
    references: [noteDocuments.docId],
  }),
  section: one(noteSections, {
    fields: [noteFrames.sectionId],
    references: [noteSections.sectionId],
  }),
  questionLinks: many(contractQuestionNoteLinks),
}));

export const contractQuestionsRelations = relations(contractQuestions, ({ one, many }) => ({
  batch: one(ingestBatches, {
    fields: [contractQuestions.ingestBatchId],
    references: [ingestBatches.id],
  }),
  linkedDocument: one(noteDocuments, {
    fields: [contractQuestions.linkedDocId],
    references: [noteDocuments.docId],
  }),
  choices: many(contractQuestionChoices),
  noteLinks: many(contractQuestionNoteLinks),
}));

export const contractQuestionChoicesRelations = relations(
  contractQuestionChoices,
  ({ one }) => ({
    question: one(contractQuestions, {
      fields: [contractQuestionChoices.contractQuestionId],
      references: [contractQuestions.id],
    }),
  }),
);

export const contractQuestionNoteLinksRelations = relations(
  contractQuestionNoteLinks,
  ({ one }) => ({
    question: one(contractQuestions, {
      fields: [contractQuestionNoteLinks.contractQuestionId],
      references: [contractQuestions.id],
    }),
    document: one(noteDocuments, {
      fields: [contractQuestionNoteLinks.docId],
      references: [noteDocuments.docId],
    }),
    frame: one(noteFrames, {
      fields: [contractQuestionNoteLinks.frameId],
      references: [noteFrames.frameId],
    }),
  }),
);

/* -------------------------------------------------------------------------- */
/* YIELD ANNOTATIONS                               */
/* -------------------------------------------------------------------------- */

export const yieldAnnotations = pgTable(
  "yield_annotations",
  {
    id: text("id").primaryKey(),
    chapterNo: integer("chapter_no").notNull(),
    segmentNo: integer("segment_no"),
    sourceDocId: text("source_doc_id").references(() => noteDocuments.docId, {
      onDelete: "set null",
    }),
    summaryLabel: text("summary_label").notNull(),
    sourceSectionTitles: text("source_section_titles")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    sourceAnchorHints: text("source_anchor_hints")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    conceptLabels: text("concept_labels").$type<string[]>().notNull().default(sql`'[]'`),
    reasons: text("reasons").$type<string[]>().notNull().default(sql`'[]'`),
    yieldTier: integer("yield_tier").notNull().default(1),
    keyExamInfo: integer("key_exam_info").notNull().default(0),
    highYieldVisible: integer("high_yield_visible").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    chapterNoIdx: index("yield_annotations_chapter_no_idx").on(t.chapterNo),
    sourceDocIdx: index("yield_annotations_source_doc_idx").on(t.sourceDocId),
    tierIdx: index("yield_annotations_tier_idx").on(t.yieldTier),
    keyExamIdx: index("yield_annotations_key_exam_idx").on(t.keyExamInfo),
  }),
);

export const yieldAnnotationsRelations = relations(yieldAnnotations, ({ one }) => ({
  sourceDocument: one(noteDocuments, {
    fields: [yieldAnnotations.sourceDocId],
    references: [noteDocuments.docId],
  }),
}));

/* -------------------------------------------------------------------------- */
/* LOCAL-FIRST SYNC — server-side idempotency ledger                          */
/* -------------------------------------------------------------------------- */
/*
 * client_mutations is a write-once ledger keyed by the client-generated
 * outbox mutationId (UUID v4). The local-first push route checks this table
 * before applying any mutation so a retry after a network retry returns the
 * SAME result shape as the original call. This keeps every entity apply
 * idempotent without requiring per-table mutation_id columns.
 *
 * status:
 *   applied  — mutation succeeded; resultJson holds { serverId, serverVersion }
 *   conflict — business-rule conflict; client moves row to 'conflict' state
 *   fatal    — permanent rejection (schema/validation); client moves row to 'failed'
 *
 * Rows are never updated after first insert (transition is one-shot). The
 * push route first SELECTs by mutationId; on hit it replays the stored
 * result, on miss it attempts the apply and records the outcome.
 */

export const clientMutations = pgTable(
  "client_mutations",
  {
    mutationId: text("mutation_id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityLocalId: text("entity_local_id").notNull(),
    entityServerId: text("entity_server_id"),
    operation: text("operation").notNull(),
    status: text("status").notNull(),
    resultJson: text("result_json").$type<{
      serverId?: string | null;
      serverVersion?: number;
      error?: string;
    } | null>(),
    errorMessage: text("error_message"),
    appliedAt: integer("applied_at").notNull().default(nowMs),
  },
  (t) => ({
    entityIdx: index("client_mutations_entity_idx").on(t.entityType, t.entityLocalId),
    appliedAtIdx: index("client_mutations_applied_at_idx").on(t.appliedAt),
  }),
);

/* -------------------------------------------------------------------------- */
/* LOCAL-FIRST ANNOTATIONS (reader highlights / underlines / comments)        */
/* -------------------------------------------------------------------------- */
/*
 * lf_annotations stores the server-side mirror of reader annotations pushed
 * from the local-first outbox. PK is the client-generated UUID v4. Anchor
 * columns mirror the Dexie schema exactly so re-anchoring can run on either
 * side if we ever need to (today it runs client-side only).
 */

export const lfAnnotations = pgTable(
  "lf_annotations",
  {
    id: text("id").primaryKey(),
    docId: text("doc_id").notNull(),
    chapterNo: integer("chapter_no"),
    sourceBlockId: text("source_block_id").notNull(),
    kind: text("kind").$type<"highlight" | "underline" | "comment">().notNull(),
    color: text("color"),
    comment: text("comment"),
    textQuote: text("text_quote").notNull(),
    textPositionStart: integer("text_position_start").notNull().default(0),
    textPositionEnd: integer("text_position_end").notNull().default(0),
    prefix: text("prefix").notNull().default(""),
    suffix: text("suffix").notNull().default(""),
    blockChecksum: text("block_checksum").notNull().default(""),
    isDeleted: integer("is_deleted").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    docIdx: index("lf_annotations_doc_idx").on(t.docId),
    blockIdx: index("lf_annotations_block_idx").on(t.docId, t.sourceBlockId),
    deletedIdx: index("lf_annotations_deleted_idx").on(t.isDeleted),
  }),
);

/* -------------------------------------------------------------------------- */
/* LOCAL-FIRST USER NOTES                                                     */
/* -------------------------------------------------------------------------- */
/*
 * lf_user_notes stores general-purpose notebook rows pushed from the
 * local-first outbox. This is separate from `question_notes` which is tied
 * to exam questions. PK is client UUID v4 to allow offline creation.
 */

export const lfUserNotes = pgTable(
  "lf_user_notes",
  {
    id: text("id").primaryKey(),
    title: text("title"),
    body: text("body").notNull().default(""),
    tagsJson: text("tags_json").$type<string[] | null>(),
    isDeleted: integer("is_deleted").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    updatedAtIdx: index("lf_user_notes_updated_at_idx").on(t.updatedAt),
    deletedIdx: index("lf_user_notes_deleted_idx").on(t.isDeleted),
  }),
);

/* -------------------------------------------------------------------------- */
/* MEDIA ASSETS — Phase 2 (read-only registry for the media-reference reader) */
/* -------------------------------------------------------------------------- */
/*
 * `media_assets` is the deterministic lookup registry the Reader uses to
 * resolve detected figure / image / table references against imported assets.
 *
 * Phase 2 scope:
 *   - read-only from the app's perspective (no UI writes here)
 *   - decoupled from `chunk_assets` (which is per-chunk import metadata);
 *     `media_assets` is keyed by chapter + ref so the resolver can match
 *     references that appear anywhere in the chapter's prose
 *   - the importer that populates this table is intentionally NOT included
 *     in this phase. Inserting rows by hand or via a future importer is
 *     enough to flip a reference from fallback to populated.
 *
 * Compatibility:
 *   - Plain `text` and `integer` (bigint-as-number) columns; works on
 *     Postgres and PGlite without dialect-specific types
 *   - Boolean stored as `integer` 0/1 (project-wide convention; see
 *     `lf_user_notes.is_deleted` and `note_frames.high_yield`)
 *   - JSON-shaped fields stored as `text` and typed via `.$type<>()` so
 *     the same column round-trips on both runtimes
 */

export const mediaAssetKind = {
  figure: "figure",
  image: "image",
  table: "table",
} as const;

export type MediaAssetKind = (typeof mediaAssetKind)[keyof typeof mediaAssetKind];

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    /** Logical, importer-stable id (e.g. "campbell-164-fig-164-4"). Unique. */
    mediaId: text("media_id").notNull(),
    /** Owning chapter — denormalised for cheap per-chapter manifest queries. */
    chapterNumber: integer("chapter_number").notNull(),
    /** Optional segment-level scope (matches `notes.meta.logicalChunkId`). */
    segmentId: text("segment_id"),
    /** Stable resolver key matching the detector's output, e.g. "figure:164.4". */
    refId: text("ref_id"),
    /** Human-readable label as it should appear in the lightbox. */
    figureLabel: text("figure_label"),
    /** "figure" | "image" | "table" — narrow union enforced in TS. */
    kind: text("kind").$type<MediaAssetKind>().notNull(),
    /** Filename of the asset on disk (no path). */
    filename: text("filename"),
    /** Relative storage path the lightbox uses to render the image. */
    storagePath: text("storage_path"),
    /** Source page in the print edition, if known. */
    sourcePage: integer("source_page"),
    /** Caption / longer description shown beneath the image. */
    caption: text("caption"),
    /** Free-form tags (importer-defined). Stored as JSON array of strings. */
    tagsJson: text("tags_json").$type<string[] | null>(),
    /** High-yield flag — surfaces a badge in the lightbox header. */
    highYield: integer("high_yield").notNull().default(0),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    mediaIdUnique: uniqueIndex("media_assets_media_id_unique").on(t.mediaId),
    chapterIdx: index("media_assets_chapter_idx").on(t.chapterNumber),
    refIdIdx: index("media_assets_ref_id_idx").on(t.refId),
    kindIdx: index("media_assets_kind_idx").on(t.kind),
    chapterKindIdx: index("media_assets_chapter_kind_idx").on(
      t.chapterNumber,
      t.kind,
    ),
  }),
);

export const mediaAssetPayloads = pgTable(
  "media_asset_payloads",
  {
    /** Relative bundle path, e.g. `campbell/164/ch164_fig_164_1.png`. */
    storageKey: text("storage_key").primaryKey(),
    /** MIME type returned by the Vercel-safe media route. */
    contentType: text("content_type").notNull(),
    /** Base64-encoded payload kept out of the read-only filesystem. */
    base64Data: text("base64_data").notNull(),
    /** Original byte length before base64 inflation. */
    byteLength: integer("byte_length").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (t) => ({
    updatedAtIdx: index("media_asset_payloads_updated_at_idx").on(t.updatedAt),
  }),
);
