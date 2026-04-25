import { createHash } from "crypto";

export function generateSourceHash(content: string): string {
  return createHash("sha256").update(Buffer.from(content, "utf-8")).digest("hex");
}

export function normalizePersianText(text: string): string {
  if (!text) return "";
  return Buffer.from(text, "utf-8").toString("utf-8").replace(/\s+/g, " ").trim();
}

export function validateFlashcard(data: any) {
  const front = normalizePersianText(data.front || data.question || "");
  const back = normalizePersianText(data.back || data.answer || "");
  if (!front || !back) return { valid: false, error: "محتوا ناقص است" };
  return { 
    valid: true, 
    data: { 
      front, 
      back, 
      tags: data.tags || [], 
      difficulty: data.difficulty || "medium", 
      sourceHash: generateSourceHash(front + back) 
    } 
  };
}