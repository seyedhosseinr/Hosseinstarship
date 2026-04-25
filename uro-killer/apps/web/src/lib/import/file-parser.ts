/**
 * File Import Parser
 * 
 * Parses various file formats into a unified structure for
 * creating flashcards or exam questions.
 */

export type ImportFileType = "json" | "csv" | "html" | "txt" | "pdf" | "image" | "unknown";

export interface ParsedItem {
  front: string;
  back: string;
  tags: string[];
  source: string;
  confidence: number; // 0-1 how confident the parser is
}

export interface ParseResult {
  items: ParsedItem[];
  fileType: ImportFileType;
  fileName: string;
  fileSize: number;
  errors: string[];
  warnings: string[];
  parseTime: number; // ms
}

/**
 * Detect file type from extension and MIME
 */
export function detectFileType(file: File): ImportFileType {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const mime = file.type;

  if (ext === "json" || mime === "application/json") return "json";
  if (ext === "csv" || mime === "text/csv") return "csv";
  if (ext === "html" || ext === "htm" || mime === "text/html") return "html";
  if (ext === "txt" || mime === "text/plain") return "txt";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "unknown";
}

/**
 * Parse JSON file (Anki export, custom format, array of Q&A)
 */
export async function parseJSON(content: string, fileName: string): Promise<ParseResult> {
  const start = Date.now();
  const result: ParseResult = {
    items: [],
    fileType: "json",
    fileName,
    fileSize: content.length,
    errors: [],
    warnings: [],
    parseTime: 0,
  };

  try {
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      for (const item of data) {
        const parsed = extractQA(item);
        if (parsed) result.items.push({ ...parsed, source: fileName, confidence: 0.9 });
      }
    } else if (data.cards || data.flashcards || data.questions) {
      const arr = data.cards || data.flashcards || data.questions;
      if (Array.isArray(arr)) {
        for (const item of arr) {
          const parsed = extractQA(item);
          if (parsed) result.items.push({ ...parsed, source: fileName, confidence: 0.85 });
        }
      }
    } else if (data.front || data.question || data.text) {
      const parsed = extractQA(data);
      if (parsed) result.items.push({ ...parsed, source: fileName, confidence: 0.9 });
    } else {
      result.warnings.push("ساختار JSON شناسایی نشد. سعی کنید آرایه‌ای از {front, back} ارسال کنید.");
    }
  } catch (e) {
    result.errors.push(`خطا در تجزیه JSON: ${(e as Error).message}`);
  }

  result.parseTime = Date.now() - start;
  return result;
}

/**
 * Parse CSV content (expects front,back or question,answer columns)
 */
export async function parseCSV(content: string, fileName: string): Promise<ParseResult> {
  const start = Date.now();
  const result: ParseResult = {
    items: [],
    fileType: "csv",
    fileName,
    fileSize: content.length,
    errors: [],
    warnings: [],
    parseTime: 0,
  };

  try {
    const lines = content.split("\n").filter((l) => l.trim());
    if (lines.length < 2) {
      result.errors.push("فایل CSV باید حداقل ۲ خط (هدر + داده) داشته باشد");
      return result;
    }

    // Parse header
    const separator = lines[0].includes("\t") ? "\t" : ",";
    const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase().replace(/"/g, ""));

    // Find front/back columns
    const frontIdx = headers.findIndex((h) =>
      ["front", "question", "سوال", "جلو", "q", "term"].includes(h)
    );
    const backIdx = headers.findIndex((h) =>
      ["back", "answer", "پاسخ", "پشت", "a", "definition"].includes(h)
    );
    const tagIdx = headers.findIndex((h) =>
      ["tags", "tag", "تگ", "برچسب", "topic"].includes(h)
    );

    if (frontIdx === -1 || backIdx === -1) {
      // Try positional: first col = front, second = back
      result.warnings.push("ستون‌های front/back یافت نشد. از ستون اول و دوم استفاده می‌شود.");
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], separator);
        if (cols.length >= 2) {
          result.items.push({
            front: cols[0],
            back: cols[1],
            tags: cols[2] ? [cols[2]] : [],
            source: fileName,
            confidence: 0.7,
          });
        }
      }
    } else {
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], separator);
        const front = cols[frontIdx]?.trim();
        const back = cols[backIdx]?.trim();

        if (front && back) {
          result.items.push({
            front,
            back,
            tags: tagIdx >= 0 && cols[tagIdx] ? cols[tagIdx].split(/[,;]/).map((t: string) => t.trim()) : [],
            source: fileName,
            confidence: 0.85,
          });
        }
      }
    }
  } catch (e) {
    result.errors.push(`خطا در تجزیه CSV: ${(e as Error).message}`);
  }

  result.parseTime = Date.now() - start;
  return result;
}

/**
 * Parse HTML content (Anki HTML export, study guides)
 */
export async function parseHTML(content: string, fileName: string): Promise<ParseResult> {
  const start = Date.now();
  const result: ParseResult = {
    items: [],
    fileType: "html",
    fileName,
    fileSize: content.length,
    errors: [],
    warnings: [],
    parseTime: 0,
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    // Strategy 1: Look for table rows (common in Anki exports)
    const rows = doc.querySelectorAll("tr");
    if (rows.length > 0) {
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
          const front = cells[0].textContent?.trim() || "";
          const back = cells[1].textContent?.trim() || "";
          if (front && back) {
            result.items.push({
              front,
              back,
              tags: [],
              source: fileName,
              confidence: 0.8,
            });
          }
        }
      }
    }

    // Strategy 2: Look for dt/dd pairs (definition lists)
    if (result.items.length === 0) {
      const dts = doc.querySelectorAll("dt");
      const dds = doc.querySelectorAll("dd");
      const count = Math.min(dts.length, dds.length);
      for (let i = 0; i < count; i++) {
        const front = dts[i].textContent?.trim() || "";
        const back = dds[i].textContent?.trim() || "";
        if (front && back) {
          result.items.push({
            front,
            back,
            tags: [],
            source: fileName,
            confidence: 0.75,
          });
        }
      }
    }

    // Strategy 3: Look for heading + paragraph pairs
    if (result.items.length === 0) {
      const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (const heading of headings) {
        const front = heading.textContent?.trim() || "";
        let back = "";
        let sibling = heading.nextElementSibling;
        while (sibling && !["H1", "H2", "H3", "H4", "H5", "H6"].includes(sibling.tagName)) {
          back += (sibling.textContent?.trim() || "") + " ";
          sibling = sibling.nextElementSibling;
        }
        if (front && back.trim()) {
          result.items.push({
            front,
            back: back.trim(),
            tags: [],
            source: fileName,
            confidence: 0.65,
          });
        }
      }
    }

    if (result.items.length === 0) {
      result.warnings.push("ساختار HTML قابل تجزیه نبود. از فرمت جدول یا لیست تعریف استفاده کنید.");
    }
  } catch (e) {
    result.errors.push(`خطا در تجزیه HTML: ${(e as Error).message}`);
  }

  result.parseTime = Date.now() - start;
  return result;
}

/**
 * Parse plain text (Q: / A: format, line-by-line, double-newline separated)
 */
export async function parsePlainText(content: string, fileName: string): Promise<ParseResult> {
  const start = Date.now();
  const result: ParseResult = {
    items: [],
    fileType: "txt",
    fileName,
    fileSize: content.length,
    errors: [],
    warnings: [],
    parseTime: 0,
  };

  try {
    // Strategy 1: Q:/A: or سوال:/پاسخ: format
    const qaRegex = /(?:Q|question|سوال|س)\s*[:：]\s*(.+?)[\n\r]+(?:A|answer|پاسخ|ج)\s*[:：]\s*(.+?)(?=(?:\n\r?\n|\n(?:Q|question|سوال|س)\s*[:：])|$)/gis;
    let match;
    while ((match = qaRegex.exec(content)) !== null) {
      result.items.push({
        front: match[1].trim(),
        back: match[2].trim(),
        tags: [],
        source: fileName,
        confidence: 0.85,
      });
    }

    // Strategy 2: Double-newline separated pairs
    if (result.items.length === 0) {
      const blocks = content.split(/\n\s*\n/).filter((b) => b.trim());
      for (let i = 0; i < blocks.length - 1; i += 2) {
        const front = blocks[i].trim();
        const back = blocks[i + 1]?.trim();
        if (front && back) {
          result.items.push({
            front,
            back,
            tags: [],
            source: fileName,
            confidence: 0.6,
          });
        }
      }
    }

    // Strategy 3: Tab-separated lines
    if (result.items.length === 0) {
      const lines = content.split("\n").filter((l) => l.includes("\t"));
      for (const line of lines) {
        const [front, back] = line.split("\t");
        if (front?.trim() && back?.trim()) {
          result.items.push({
            front: front.trim(),
            back: back.trim(),
            tags: [],
            source: fileName,
            confidence: 0.7,
          });
        }
      }
    }

    if (result.items.length === 0) {
      result.warnings.push("فرمت متنی شناسایی نشد. از فرمت «Q: ... A: ...» یا جداسازی با Tab استفاده کنید.");
    }
  } catch (e) {
    result.errors.push(`خطا در تجزیه متن: ${(e as Error).message}`);
  }

  result.parseTime = Date.now() - start;
  return result;
}

// ─── Helpers ────────────────────────────────────────────────

function extractQA(item: any): { front: string; back: string; tags: string[] } | null {
  const front = item.front || item.question || item.text || item.term || item.q || item.سوال;
  const back = item.back || item.answer || item.explanation || item.definition || item.a || item.پاسخ;

  if (!front || !back) return null;

  const tags: string[] = [];
  if (item.tags) {
    if (Array.isArray(item.tags)) tags.push(...item.tags);
    else if (typeof item.tags === "string") tags.push(...item.tags.split(",").map((t: string) => t.trim()));
  }
  if (item.topic) tags.push(item.topic);

  return { front: String(front).trim(), back: String(back).trim(), tags };
}

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}