import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

/**
 * 🚨 UTF-8 & PERSIAN TEXT HANDLING:
 * This API explicitly handles UTF-8 encoding for Persian (Farsi) text.
 * - Response headers include charset=utf-8
 * - All text data is normalized using UTF-8 Buffer encoding
 * - Source hash is computed on UTF-8 encoded text for duplicate detection
 */

// ── Utility: Generate source hash for duplicate detection ──
function generateSourceHash(content: string): string {
  return createHash('sha256')
    .update(Buffer.from(content, 'utf-8'))
    .digest('hex');
}

// ── Utility: Normalize Persian text (UTF-8) ──
function normalizePersianText(text: string): string {
  if (!text) return '';
  // Force UTF-8 encoding
  const normalized = Buffer.from(text, 'utf-8').toString('utf-8');
  return normalized.replace(/\s+/g, ' ').trim();
}

// ── Validation & Type Definitions ──
interface ValidatedFlashcard {
  id: string;
  front: string;
  back: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  sourceHash: string;
  createdAt: string;
}

interface ValidatedQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  stem: string;
  options?: string;
  correctAnswer: string | string[];
  explanation?: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  sourceHash: string;
  createdAt: string;
}

interface ValidatedNotebook {
  id: string;
  title: string;
  description?: string;
  chunks: {
    id: string;
    content: string;
    contentType: 'text' | 'html' | 'markdown';
    sourceHash: string;
  }[];
  createdAt: string;
}

// ── Validation Functions ──
function validateFlashcard(data: any): { valid: boolean; data?: ValidatedFlashcard; error?: string } {
  try {
    const front = normalizePersianText(data.front || data.question || '');
    const back = normalizePersianText(data.back || data.answer || '');

    if (!front || !back) {
      return { valid: false, error: 'Front and back content are required' };
    }

    const sourceHash = generateSourceHash(front + '|' + back);

    return {
      valid: true,
      data: {
        id: uuidv4(),
        front,
        back,
        tags: Array.isArray(data.tags) ? data.tags.map((t: any) => String(t)) : [],
        difficulty: ['easy', 'medium', 'hard'].includes(data.difficulty) ? data.difficulty : 'medium',
        sourceHash,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid flashcard format',
    };
  }
}

function validateQuestion(data: any): { valid: boolean; data?: ValidatedQuestion; error?: string } {
  try {
    const stem = normalizePersianText(data.stem || data.question || '');
    const correctAnswer = data.correctAnswer || data.correct_answer;

    if (!stem) {
      return { valid: false, error: 'Question stem is required' };
    }

    if (!correctAnswer) {
      return { valid: false, error: 'Correct answer is required' };
    }

    const sourceHash = generateSourceHash(stem);

    return {
      valid: true,
      data: {
        id: uuidv4(),
        type: ['multiple_choice', 'true_false', 'short_answer'].includes(data.type)
          ? data.type
          : 'multiple_choice',
        stem,
        options: data.options ? JSON.stringify(data.options) : undefined,
        correctAnswer,
        explanation: data.explanation ? normalizePersianText(data.explanation) : undefined,
        tags: Array.isArray(data.tags) ? data.tags.map((t: any) => String(t)) : [],
        difficulty: ['easy', 'medium', 'hard'].includes(data.difficulty) ? data.difficulty : 'medium',
        sourceHash,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid question format',
    };
  }
}

function validateNotebook(data: any): { valid: boolean; data?: ValidatedNotebook; error?: string } {
  try {
    const title = normalizePersianText(data.title || '');

    if (!title) {
      return { valid: false, error: 'Notebook title is required' };
    }

    const chunks = (data.chunks || []).map((chunk: any) => ({
      id: uuidv4(),
      content: normalizePersianText(chunk.content || ''),
      contentType: ['text', 'html', 'markdown'].includes(chunk.contentType) ? chunk.contentType : 'text',
      sourceHash: generateSourceHash(chunk.content || ''),
    }));

    return {
      valid: true,
      data: {
        id: uuidv4(),
        title,
        description: data.description ? normalizePersianText(data.description) : undefined,
        chunks,
        createdAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid notebook format',
    };
  }
}

// ── In-Memory Storage (Replace with actual database in production) ──
// For now, we'll store in a simple in-memory map
const storage: {
  flashcards: Map<string, ValidatedFlashcard>;
  questions: Map<string, ValidatedQuestion>;
  notebooks: Map<string, ValidatedNotebook>;
  sourceHashes: Set<string>;
} = {
  flashcards: new Map(),
  questions: new Map(),
  notebooks: new Map(),
  sourceHashes: new Set(),
};

// ── API Route Handler ──
export async function POST(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    // 🚨 UTF-8 FIX: Set explicit UTF-8 response headers
    const responseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    };

    const body = await request.json();
    const data = body.data || [];
    const type = params.type as 'flashcards' | 'notes' | 'questions';

    // Validate import type
    if (!['flashcards', 'notes', 'questions'].includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid import type. Must be one of: flashcards, notes, questions',
        },
        { status: 400, headers: responseHeaders }
      );
    }

    // Validate data is array
    if (!Array.isArray(data)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data must be an array',
        },
        { status: 400, headers: responseHeaders }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        {
          success: true,
          type,
          total: 0,
          imported: 0,
          skipped: 0,
          message: 'No items to import',
        },
        { headers: responseHeaders }
      );
    }

    let imported = 0;
    let skipped = 0;
    const errors: { index: number; message: string }[] = [];

    // ────── Process FLASHCARDS ──────
    if (type === 'flashcards') {
      for (let i = 0; i < data.length; i++) {
        const validation = validateFlashcard(data[i]);

        if (!validation.valid) {
          errors.push({ index: i, message: validation.error || 'Invalid data' });
          skipped++;
          continue;
        }

        const validated = validation.data!;

        // Check for duplicate
        if (storage.sourceHashes.has(validated.sourceHash)) {
          skipped++;
          continue;
        }

        storage.flashcards.set(validated.id, validated);
        storage.sourceHashes.add(validated.sourceHash);
        imported++;
      }
    }

    // ────── Process QUESTIONS ──────
    else if (type === 'questions') {
      for (let i = 0; i < data.length; i++) {
        const validation = validateQuestion(data[i]);

        if (!validation.valid) {
          errors.push({ index: i, message: validation.error || 'Invalid data' });
          skipped++;
          continue;
        }

        const validated = validation.data!;

        // Check for duplicate
        if (storage.sourceHashes.has(validated.sourceHash)) {
          skipped++;
          continue;
        }

        storage.questions.set(validated.id, validated);
        storage.sourceHashes.add(validated.sourceHash);
        imported++;
      }
    }

    // ────── Process NOTEBOOKS (NOTES) ──────
    else if (type === 'notes') {
      for (let i = 0; i < data.length; i++) {
        const validation = validateNotebook(data[i]);

        if (!validation.valid) {
          errors.push({ index: i, message: validation.error || 'Invalid data' });
          skipped++;
          continue;
        }

        const validated = validation.data!;

        // Check for duplicate notebook
        let isDuplicate = false;
        for (const notebook of storage.notebooks.values()) {
          if (notebook.title === validated.title) {
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) {
          skipped++;
          continue;
        }

        storage.notebooks.set(validated.id, validated);
        validated.chunks.forEach((chunk) => {
          storage.sourceHashes.add(chunk.sourceHash);
        });
        imported++;
      }
    }

    // ────── Response ──────
    return NextResponse.json(
      {
        success: true,
        type,
        total: data.length,
        imported,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully imported ${imported}/${data.length} items${
          skipped > 0 ? ` (${skipped} skipped)` : ''
        }`,
      },
      { headers: responseHeaders }
    );
  } catch (err) {
    const responseHeaders = {
      'Content-Type': 'application/json; charset=utf-8',
    };

    console.error('Import error:', err);

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500, headers: responseHeaders }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}
