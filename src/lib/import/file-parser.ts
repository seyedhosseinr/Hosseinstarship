// src/lib/import/file-parser.ts
import type { ImportBundle, Flashcard } from '@/types/index'; // Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â·Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â¦Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â´Ãƒâ„¢Ã‹â€  Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â³Ãƒâ€ºÃ…â€™ÃƒËœÃ‚Â± ÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã‚Â¾Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â±ÃƒËœÃ‚Âª ÃƒËœÃ‚ÂªÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™Ãƒâ„¢Ã‚Â¾ÃƒÂ¢Ã¢â€šÂ¬Ã…â€™Ãƒâ„¢Ã¢â‚¬Â¡ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³ÃƒËœÃ‚Âª ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚Âª

export interface ParseResult {
  success: boolean;
  data: ImportBundle | null;
  error?: string;
  warnings: string[];
}

// ÃƒËœÃ‚ÂªÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â¹ ÃƒÅ¡Ã‚Â©Ãƒâ„¢Ã¢â‚¬Â¦ÃƒÅ¡Ã‚Â©Ãƒâ€ºÃ…â€™ ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™ ÃƒËœÃ‚Â®Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â¯Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â·ÃƒËœÃ‚Â¹Ãƒâ€ºÃ…â€™ Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§ Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â±Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Âª UTF-8
function readFileAsUTF8(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("File is empty or could not be read."));
      }
    };
    reader.onerror = () => reject(new Error("Error reading file."));
    // ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§ÃƒËœÃ‚Â± ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Â¡ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒâ„¢Ã‚ÂÃƒËœÃ‚Â§ÃƒËœÃ‚Â¯Ãƒâ„¢Ã¢â‚¬Â¡ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² UTF-8 ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™ ÃƒËœÃ‚Â¬Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ„¢Ã‹â€ ÃƒÅ¡Ã‚Â¯Ãƒâ€ºÃ…â€™ÃƒËœÃ‚Â±Ãƒâ€ºÃ…â€™ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² Mojibake ÃƒËœÃ‚Â­ÃƒËœÃ‚Â±Ãƒâ„¢Ã‹â€ Ãƒâ„¢Ã‚Â Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â§ÃƒËœÃ‚Â±ÃƒËœÃ‚Â³Ãƒâ€ºÃ…â€™
    reader.readAsText(file, "UTF-8"); 
  });
}

export async function parseImportFile(file: File): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    // ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒâ„¢Ã‚ÂÃƒËœÃ‚Â§ÃƒËœÃ‚Â¯Ãƒâ„¢Ã¢â‚¬Â¡ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² ÃƒËœÃ‚ÂªÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â¹ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ„¢Ã¢â‚¬Â  ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Â¡ ÃƒËœÃ‚Â¬ÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™ file.text()
    const content = await readFileAsUTF8(file); 
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'json') {
      return parseJSON(content, warnings);
    }

    if (ext === 'csv') {
      return parseCSV(content, warnings);
    }

    if (ext === 'txt') {
      return parseTXT(content, warnings);
    }

    return {
      success: false,
      data: null,
      error: `Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â±Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Âª ${ext} Ãƒâ„¢Ã‚Â¾ÃƒËœÃ‚Â´ÃƒËœÃ‚ÂªÃƒâ€ºÃ…â€™ÃƒËœÃ‚Â¨ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â Ãƒâ€ºÃ…â€™ Ãƒâ„¢Ã¢â‚¬Â Ãƒâ„¢Ã¢â‚¬Â¦Ãƒâ€ºÃ…â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…â€™ÃƒËœÃ‚Â´Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â¯`,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'ÃƒËœÃ‚Â®ÃƒËœÃ‚Â·ÃƒËœÃ‚Â§ ÃƒËœÃ‚Â¯ÃƒËœÃ‚Â± ÃƒËœÃ‚Â®Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â¯Ãƒâ„¢Ã¢â‚¬Â  Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™Ãƒâ„¢Ã¢â‚¬Å¾',
      warnings,
    };
  }
}

function parseJSON(content: string, warnings: string[]): ParseResult {
  try {
    const data = JSON.parse(content);

    // Valid import bundle
    if (((data.format === 'uro-omega.import' || data.format === 'starship.import') && data.version === 1)) {
      return { success: true, data: data as ImportBundle, warnings };
    }

    // Array of items
    if (Array.isArray(data)) {
      const flashcards: Flashcard[] = [];
      for (const item of data) {
        if (item.front && item.back) {
          flashcards.push({
            id: item.id || crypto.randomUUID(),
            front: item.front,
            back: item.back,
            tags: item.tags,
            created_at: item.created_at || new Date().toISOString(),
          });
        }
      }
      warnings.push(`${flashcards.length} Ãƒâ„¢Ã‚ÂÃƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â´ÃƒÂ¢Ã¢â€šÂ¬Ã…â€™ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â§ÃƒËœÃ‚Â±ÃƒËœÃ‚Âª ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² ÃƒËœÃ‚Â¢ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§Ãƒâ€ºÃ…â€™Ãƒâ„¢Ã¢â‚¬Â¡ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒËœÃ‚Â®ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¬ ÃƒËœÃ‚Â´ÃƒËœÃ‚Â¯`);
      return { success: true, data: createBundle({ flashcards }), warnings };
    }

    // Object with flashcards/questions
    if (data.flashcards || data.questions) {
      return { success: true, data: createBundle(data), warnings };
    }

    return {
      success: false,
      data: null,
      error: 'ÃƒËœÃ‚Â³ÃƒËœÃ‚Â§ÃƒËœÃ‚Â®ÃƒËœÃ‚ÂªÃƒËœÃ‚Â§ÃƒËœÃ‚Â± JSON Ãƒâ„¢Ã¢â‚¬Å¡ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨Ãƒâ„¢Ã¢â‚¬Å¾ ÃƒËœÃ‚ÂªÃƒËœÃ‚Â´ÃƒËœÃ‚Â®Ãƒâ€ºÃ…â€™ÃƒËœÃ‚Âµ Ãƒâ„¢Ã¢â‚¬Â Ãƒâ€ºÃ…â€™ÃƒËœÃ‚Â³ÃƒËœÃ‚Âª',
      warnings,
    };
  } catch {
    return {
      success: false,
      data: null,
      error: 'JSON Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Â¦ÃƒËœÃ‚Â¹ÃƒËœÃ‚ÂªÃƒËœÃ‚Â¨ÃƒËœÃ‚Â± ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚Âª',
      warnings,
    };
  }
}

function parseCSV(content: string, warnings: string[]): ParseResult {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) {
    return { success: false, data: null, error: 'CSV ÃƒËœÃ‚Â®ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾Ãƒâ€ºÃ…â€™ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚Âª', warnings };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const frontIdx = headers.findIndex((h) => h.includes('front') || h.includes('ÃƒËœÃ‚Â³Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â§Ãƒâ„¢Ã¢â‚¬Å¾'));
  const backIdx = headers.findIndex((h) => h.includes('back') || h.includes('ÃƒËœÃ‚Â¬Ãƒâ„¢Ã‹â€ ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¨'));

  if (frontIdx === -1 || backIdx === -1) {
    return { success: false, data: null, error: 'ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒâ„¢Ã‹â€ Ãƒâ„¢Ã¢â‚¬Â  front/back Ãƒâ€ºÃ…â€™ÃƒËœÃ‚Â§Ãƒâ„¢Ã‚ÂÃƒËœÃ‚Âª Ãƒâ„¢Ã¢â‚¬Â ÃƒËœÃ‚Â´ÃƒËœÃ‚Â¯', warnings };
  }

  const flashcards: Flashcard[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    if (vals[frontIdx] && vals[backIdx]) {
      flashcards.push({
        id: crypto.randomUUID(),
        front: vals[frontIdx].trim(),
        back: vals[backIdx].trim(),
        created_at: new Date().toISOString(),
      });
    }
  }

  warnings.push(`${flashcards.length} Ãƒâ„¢Ã‚ÂÃƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â´ÃƒÂ¢Ã¢â€šÂ¬Ã…â€™ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â§ÃƒËœÃ‚Â±ÃƒËœÃ‚Âª ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² CSV ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒËœÃ‚Â®ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¬ ÃƒËœÃ‚Â´ÃƒËœÃ‚Â¯`);
  return { success: flashcards.length > 0, data: createBundle({ flashcards }), warnings };
}

function parseTXT(content: string, warnings: string[]): ParseResult {
  const flashcards: Flashcard[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Format: Front | Back
    if (line.includes('|')) {
      const [front, back] = line.split('|').map((s) => s.trim());
      if (front && back) {
        flashcards.push({
          id: crypto.randomUUID(),
          front,
          back,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  if (flashcards.length > 0) {
    warnings.push(`${flashcards.length} Ãƒâ„¢Ã‚ÂÃƒâ„¢Ã¢â‚¬Å¾ÃƒËœÃ‚Â´ÃƒÂ¢Ã¢â€šÂ¬Ã…â€™ÃƒÅ¡Ã‚Â©ÃƒËœÃ‚Â§ÃƒËœÃ‚Â±ÃƒËœÃ‚Âª ÃƒËœÃ‚Â§ÃƒËœÃ‚Â² TXT ÃƒËœÃ‚Â§ÃƒËœÃ‚Â³ÃƒËœÃ‚ÂªÃƒËœÃ‚Â®ÃƒËœÃ‚Â±ÃƒËœÃ‚Â§ÃƒËœÃ‚Â¬ ÃƒËœÃ‚Â´ÃƒËœÃ‚Â¯`);
  }

  return { success: flashcards.length > 0, data: createBundle({ flashcards }), warnings };
}

function createBundle(data: Partial<ImportBundle>): ImportBundle {
  return {
    format: 'starship.import',
    version: 1,
    meta: {
      bundle_id: crypto.randomUUID(),
      title: 'Imported Data',
      language: 'fa',
      created_at: new Date().toISOString(),
    },
    ...data,
  };
}