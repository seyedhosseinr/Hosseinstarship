export interface QualityCheck {
  score: number;
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

const MIN_QUALITY_SCORE = 60;

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function calculateSimilarity(a: string, b: string) {
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const bWords = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union > 0 ? intersection / union : 0;
}

export function checkCardQuality(card: {
  front: string;
  back: string;
  source: "cloze" | "qa" | "highlight" | "question";
  importance?: number;
}): QualityCheck {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const frontText = stripHtml(card.front);
  const backText = stripHtml(card.back);
  let score = 100;

  if (frontText.length < 10) {
    score -= 30;
    issues.push("Front is too short");
    suggestions.push("Add more context to the prompt");
  }
  if (frontText.length > 500) {
    score -= 20;
    issues.push("Front is too long");
    suggestions.push("Break this into smaller cards");
  }
  if (backText.length < 3) {
    score -= 40;
    issues.push("Back is too short");
    suggestions.push("Add the answer or key teaching point");
  }
  if (backText.length > 300) {
    score -= 10;
    issues.push("Back is long");
    suggestions.push("Consider a cloze or multiple cards");
  }

  if (calculateSimilarity(frontText, backText) > 0.8) {
    score -= 30;
    issues.push("Front and back are too similar");
    suggestions.push("Make the prompt and answer more distinct");
  }

  if (/^\d+$/.test(backText) || /^\d{4}$/.test(backText)) {
    score -= 15;
    issues.push("Answer is only a number");
    suggestions.push("Add context or a high-yield anchor");
  }

  if (card.source === "cloze" && backText.split(/\s+/).length === 1) {
    const commonWords = new Set(["the", "a", "an", "is", "are", "was", "were", "and", "or"]);
    if (commonWords.has(backText.toLowerCase())) {
      score -= 50;
      issues.push("Cloze answer is too generic");
      suggestions.push("Hide a more meaningful medical term");
    }
  }

  const highYieldPatterns = [
    /first[- ]line/i,
    /most common/i,
    /gold standard/i,
    /pathognomonic/i,
    /diagnostic/i,
    /treatment of choice/i,
    /contraindicated/i,
    /always|never/i,
  ];
  if (highYieldPatterns.some((pattern) => pattern.test(frontText) || pattern.test(backText))) {
    score += 10;
  }

  const vaguePatterns = [/may be/i, /sometimes/i, /possibly/i, /etc\.?$/i, /and others/i];
  if (vaguePatterns.some((pattern) => pattern.test(frontText) || pattern.test(backText))) {
    score -= 10;
    issues.push("Content is vague");
    suggestions.push("Be more specific and board-relevant");
  }

  if (card.source === "question") {
    score += 10;
  }
  if (card.source === "highlight") {
    score -= 5;
    suggestions.push("Review whether this highlight is truly card-worthy");
  }

  if (card.importance !== undefined) {
    if (card.importance >= 8) {
      score += 5;
    } else if (card.importance <= 3) {
      score -= 15;
      issues.push("Low importance content");
    }
  }

  const bounded = Math.max(0, Math.min(100, score));
  return {
    score: bounded,
    passed: bounded >= MIN_QUALITY_SCORE,
    issues,
    suggestions,
  };
}

export interface BatchQualityResult {
  total: number;
  passed: number;
  failed: number;
  cards: Array<{
    card: { front: string; back: string; source: string; importance?: number };
    quality: QualityCheck;
    action: "create" | "review" | "discard";
  }>;
}

export function batchQualityCheck(
  cards: Array<{ front: string; back: string; source: "cloze" | "qa" | "highlight" | "question"; importance?: number }>,
): BatchQualityResult {
  const result: BatchQualityResult = {
    total: cards.length,
    passed: 0,
    failed: 0,
    cards: [],
  };

  for (const card of cards) {
    const quality = checkCardQuality(card);
    let action: "create" | "review" | "discard";
    if (quality.score >= 70) {
      action = "create";
      result.passed += 1;
    } else if (quality.score >= 40) {
      action = "review";
    } else {
      action = "discard";
      result.failed += 1;
    }
    result.cards.push({ card, quality, action });
  }

  return result;
}
