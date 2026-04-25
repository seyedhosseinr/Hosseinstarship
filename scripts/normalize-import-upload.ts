import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

type LegacyQuestion = {
  chapter?: number;
  concept_id?: string;
  topic?: string;
  bloom?: string;
  difficulty?: number;
  stem?: string;
  options?: string[];
  correct?: string;
  explanation?: string;
  why_a?: string;
  why_b?: string;
  why_c?: string;
  why_d?: string;
  why_e?: string;
  clinical_pearl?: string;
  trap_option?: string;
  tags?: string | string[];
  source_anchor?: string;
  source_file?: string;
  image_url?: string;
  irt_a?: number;
  irt_b?: number;
  irt_c?: number;
};

type PipelineOption = {
  id?: string;
  contentHtml: string;
  contentText?: string | null;
  isCorrect: boolean;
  sortOrder?: number;
};

type PipelineQuestion = {
  id?: string;
  chapterId?: string | null;
  chapterNo?: number | null;
  chapterSlug?: string | null;
  chunkId?: string | null;
  chunkSlug?: string | null;
  externalKey?: string | null;
  stemHtml: string;
  stemText?: string | null;
  leadIn?: string | null;
  explanationHtml?: string | null;
  educationalObjective?: string | null;
  whyCorrect?: string | null;
  whyOthersWrong?: Record<string, string> | null;
  questionType?: string | null;
  difficulty?: number | null;
  subject?: string | null;
  system?: string | null;
  category?: string | null;
  topic?: string | null;
  tags?: string[] | null;
  notebookAnchorId?: string | null;
  source?: Record<string, Json> | null;
  isActive?: boolean;
  options: PipelineOption[];
};

type PipelineChunk = {
  id?: string;
  chapterId?: string | null;
  chapterNo?: number | null;
  chapterSlug?: string | null;
  chunkIndex: number;
  title?: string | null;
  slug: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  anchorStart?: string | null;
  anchorEnd?: string | null;
  chunkKind?: string | null;
  tokenEstimate?: number | null;
  wordCount?: number | null;
  notesHtml?: string | null;
  plainText?: string | null;
  metadata?: Record<string, Json> | null;
  qcScore?: number | null;
  isPublished?: boolean;
};

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

function required(name: string): string {
  const value = arg(name);
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return value;
}

function nowMs(): number {
  return Date.now();
}

function stableSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function makeId(prefix: string, seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrapParagraph(text: string): string {
  const trimmed = text.trim();
  return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : "<p></p>";
}

function normalizeHtmlDocument(raw: string): string {
  const trimmed = raw.trim();
  if (/<!doctype html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Imported Note</title>
</head>
<body>
${trimmed}
</body>
</html>`;
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null) return [];
  return [value as T];
}

function deriveChunkSlug(chapterNo: number, chunkIndex: number, explicit?: string): string {
  if (explicit && explicit.trim()) return stableSlug(explicit);
  return `ch${String(chapterNo).padStart(3, "0")}-seg${String(chunkIndex).padStart(2, "0")}`;
}

function deriveQuestionExternalKey(q: PipelineQuestion, chapterNo: number, index: number): string {
  const seed =
    q.externalKey ||
    q.stemText ||
    stripTags(q.stemHtml) ||
    `${chapterNo}|${index}`;
  return makeId("qext", `${chapterNo}|${index}|${seed}`);
}

function convertLegacyQuestion(
  q: LegacyQuestion,
  chapterNo: number,
  chunkSlug: string,
  index: number
): PipelineQuestion {
  const optionTexts = ensureArray<string>(q.options).slice(0, 5);
  const correctLetter = (q.correct || "").trim().toUpperCase();
  const correctIndex = ["A", "B", "C", "D", "E"].indexOf(correctLetter);

  const options: PipelineOption[] = optionTexts.map((opt, i) => ({
    id: `${makeId("q", `${q.concept_id ?? index}`)}_opt_${i}`,
    contentHtml: wrapParagraph(opt),
    contentText: opt,
    isCorrect: i === correctIndex,
    sortOrder: i,
  }));

  if (options.length === 0) {
    throw new Error(`Legacy question at index ${index} has no options`);
  }

  if (!options.some((o) => o.isCorrect)) {
    throw new Error(`Legacy question at index ${index} has no correct option`);
  }

  const whyOthersWrong: Record<string, string> = {};
  if (q.why_a) whyOthersWrong.A = q.why_a;
  if (q.why_b) whyOthersWrong.B = q.why_b;
  if (q.why_c) whyOthersWrong.C = q.why_c;
  if (q.why_d) whyOthersWrong.D = q.why_d;
  if (q.why_e) whyOthersWrong.E = q.why_e;

  const tags = Array.isArray(q.tags)
    ? q.tags
    : typeof q.tags === "string"
      ? q.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  const stemText = (q.stem || "").trim();
  const explanationText = (q.explanation || "").trim();

  const out: PipelineQuestion = {
    id: makeId("q", `${q.concept_id ?? index}|${stemText}`),
    chapterNo,
    chunkSlug,
    externalKey: q.concept_id || deriveQuestionExternalKey({
      stemHtml: wrapParagraph(stemText),
      stemText,
      options,
    }, chapterNo, index),
    stemHtml: wrapParagraph(stemText),
    stemText,
    explanationHtml: explanationText ? wrapParagraph(explanationText) : null,
    educationalObjective: q.clinical_pearl || null,
    whyCorrect: explanationText || null,
    whyOthersWrong: Object.keys(whyOthersWrong).length ? whyOthersWrong : null,
    questionType: "mcq-single",
    difficulty: typeof q.difficulty === "number" ? q.difficulty : null,
    topic: q.topic || null,
    tags,
    source: {
      sourceType: "legacy-question-json",
      conceptId: q.concept_id ?? null,
      sourceAnchor: q.source_anchor ?? null,
      sourceFile: q.source_file ?? null,
      bloom: q.bloom ?? null,
      irtA: q.irt_a ?? null,
      irtB: q.irt_b ?? null,
      irtC: q.irt_c ?? null,
    },
    isActive: true,
    options,
  };

  return out;
}

function convertModernishQuestion(
  q: any,
  chapterNo: number,
  chunkSlug: string,
  index: number
): PipelineQuestion {
  const stemHtml = typeof q.stemHtml === "string"
    ? q.stemHtml
    : typeof q.stem === "string"
      ? wrapParagraph(q.stem)
      : typeof q.question === "string"
        ? wrapParagraph(q.question)
        : "<p></p>";

  const stemText = typeof q.stemText === "string"
    ? q.stemText
    : stripTags(stemHtml);

  let options: PipelineOption[] = [];

  if (Array.isArray(q.options)) {
    if (q.options.length > 0 && typeof q.options[0] === "string") {
      const correctLetter = String(q.correct ?? q.answer ?? "").trim().toUpperCase();
      const correctIndex = ["A", "B", "C", "D", "E"].indexOf(correctLetter);

      options = q.options.map((opt: string, i: number) => ({
        id: `${makeId("q", `${index}|${stemText}`)}_opt_${i}`,
        contentHtml: wrapParagraph(opt),
        contentText: opt,
        isCorrect: i === correctIndex,
        sortOrder: i,
      }));
    } else {
      options = q.options.map((opt: any, i: number) => ({
        id: opt.id ?? `${makeId("q", `${index}|${stemText}`)}_opt_${i}`,
        contentHtml:
          typeof opt.contentHtml === "string"
            ? opt.contentHtml
            : wrapParagraph(String(opt.contentText ?? opt.text ?? "")),
        contentText:
          typeof opt.contentText === "string"
            ? opt.contentText
            : typeof opt.text === "string"
              ? opt.text
              : stripTags(typeof opt.contentHtml === "string" ? opt.contentHtml : ""),
        isCorrect: Boolean(opt.isCorrect),
        sortOrder: typeof opt.sortOrder === "number" ? opt.sortOrder : i,
      }));
    }
  }

  if (options.length === 0) {
    throw new Error(`Question at index ${index} has no options`);
  }

  if (!options.some((o) => o.isCorrect)) {
    const answer = String(q.correctAnswer ?? q.correct ?? q.answer ?? "").trim().toUpperCase();
    const idx = ["A", "B", "C", "D", "E"].indexOf(answer);
    if (idx >= 0 && idx < options.length) {
      options[idx]!.isCorrect = true;
    }
  }

  if (!options.some((o) => o.isCorrect)) {
    throw new Error(`Question at index ${index} still has no correct option after normalization`);
  }

  return {
    id: q.id ?? makeId("q", `${chapterNo}|${index}|${stemText}`),
    chapterNo,
    chunkSlug,
    externalKey: q.externalKey ?? q.concept_id ?? deriveQuestionExternalKey({
      stemHtml,
      stemText,
      options,
    }, chapterNo, index),
    stemHtml,
    stemText,
    leadIn: q.leadIn ?? null,
    explanationHtml:
      typeof q.explanationHtml === "string"
        ? q.explanationHtml
        : typeof q.explanation === "string"
          ? wrapParagraph(q.explanation)
          : null,
    educationalObjective: q.educationalObjective ?? q.clinical_pearl ?? null,
    whyCorrect: q.whyCorrect ?? q.explanation ?? null,
    whyOthersWrong: q.whyOthersWrong ?? null,
    questionType: q.questionType ?? "mcq-single",
    difficulty: typeof q.difficulty === "number" ? q.difficulty : null,
    subject: q.subject ?? null,
    system: q.system ?? null,
    category: q.category ?? null,
    topic: q.topic ?? null,
    tags: Array.isArray(q.tags)
      ? q.tags
      : typeof q.tags === "string"
        ? q.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : [],
    notebookAnchorId: q.notebookAnchorId ?? q.source_anchor ?? null,
    source: q.source ?? {
      sourceType: "normalized-upload",
      originalShape: "modernish",
    },
    isActive: q.isActive === false ? false : true,
    options,
  };
}

function normalizeQuestion(
  q: any,
  chapterNo: number,
  chunkSlug: string,
  index: number
): PipelineQuestion {
  if (q && ("concept_id" in q || "stem" in q || "correct" in q || "why_a" in q)) {
    return convertLegacyQuestion(q as LegacyQuestion, chapterNo, chunkSlug, index);
  }
  return convertModernishQuestion(q, chapterNo, chunkSlug, index);
}

async function main() {
  const htmlPath = arg("--html");
  const questionsPath = arg("--questions");
  const outDir = resolve(required("--out"));
  const chapterNo = Number(required("--chapter"));
  const chunkIndex = Number(arg("--chunkIndex") ?? "1");
  const sourceName = arg("--sourceName") ?? basename(outDir);
  const title = arg("--title") ?? `Chapter ${chapterNo} Segment ${chunkIndex}`;
  const explicitChunkSlug = arg("--chunkSlug");

  if (!Number.isFinite(chapterNo)) throw new Error("--chapter must be a number");
  if (!Number.isFinite(chunkIndex)) throw new Error("--chunkIndex must be a number");
  if (!htmlPath && !questionsPath) {
    throw new Error("Provide at least one of --html or --questions");
  }

  await mkdir(outDir, { recursive: true });

  const chunkSlug = deriveChunkSlug(chapterNo, chunkIndex, explicitChunkSlug);

  let html = "";
  if (htmlPath) {
    html = await readFile(resolve(htmlPath), "utf8");
    html = normalizeHtmlDocument(html);
  }

  const plainText = html ? stripTags(html) : "";

  const chunks: PipelineChunk[] = html
    ? [{
        id: makeId("chk", `${chapterNo}|${chunkIndex}|${chunkSlug}`),
        chapterNo,
        chunkIndex,
        title,
        slug: chunkSlug,
        chunkKind: "note",
        tokenEstimate: plainText ? Math.ceil(plainText.length / 4) : null,
        wordCount: plainText ? plainText.split(/\s+/).filter(Boolean).length : null,
        notesHtml: html,
        plainText: plainText || null,
        metadata: {
          sourceType: "html-upload",
          sourceName,
        },
        qcScore: null,
        isPublished: true,
      }]
    : [];

  let questions: PipelineQuestion[] = [];
  if (questionsPath) {
    const raw = JSON.parse(await readFile(resolve(questionsPath), "utf8"));
    const arr = ensureArray<any>(raw);
    questions = arr.map((q, i) => normalizeQuestion(q, chapterNo, chunkSlug, i));
  }

  const manifest = {
    sourceName,
    sourceType: "upload-normalized",
    sourceVersion: "1.0.0",
    schemaVersion: "dna-v3.1",
    generatedAt: nowMs(),
    chapterNo,
    chunkSlug,
    files: {
      chunks: "chunks.json",
      questions: "questions.json",
      flashcards: "flashcards.json",
      qcReport: "qc_report.json",
    },
  };

  const qcReport = {
    generatedAt: nowMs(),
    sourceName,
    chapterNo,
    chunkSlug,
    chunkCount: chunks.length,
    questionCount: questions.length,
    flashcardCount: 0,
    warnings: [],
    errors: [],
  };

  await writeFile(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await writeFile(resolve(outDir, "qc_report.json"), JSON.stringify(qcReport, null, 2), "utf8");
  await writeFile(resolve(outDir, "chunks.json"), JSON.stringify(chunks, null, 2), "utf8");
  await writeFile(resolve(outDir, "questions.json"), JSON.stringify(questions, null, 2), "utf8");
  await writeFile(resolve(outDir, "flashcards.json"), JSON.stringify([], null, 2), "utf8");

  console.log("Normalized import bundle written to:", outDir);
  console.log("chunkSlug:", chunkSlug);
  console.log("chunks:", chunks.length);
  console.log("questions:", questions.length);
  console.log("flashcards:", 0);
}

main().catch((err) => {
  console.error("[normalize-import-upload] failed");
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
