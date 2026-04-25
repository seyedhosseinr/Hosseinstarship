/**
 * OCR Engine
 * 
 * Client-side OCR using Tesseract.js for image-to-text conversion.
 * Falls back to a mock engine if Tesseract is not available.
 */

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  processingTime: number;
  words: OCRWord[];
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export type OCRStatus = "idle" | "loading" | "recognizing" | "complete" | "error";

export interface OCRProgress {
  status: OCRStatus;
  progress: number; // 0-100
  message: string;
}

/**
 * Process an image file with OCR
 */
export async function processImageOCR(
  file: File,
  language: string = "fas+eng",
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  const start = Date.now();

  onProgress?.({ status: "loading", progress: 10, message: "بارگذاری موتور OCR..." });

  try {
    // Try to dynamically import Tesseract.js
    const Tesseract = await import("tesseract.js").catch(() => null);

    if (Tesseract) {
      return await processWithTesseract(file, language, onProgress, start);
    } else {
      // Mock fallback
      return await processWithMock(file, onProgress, start);
    }
  } catch (error) {
    onProgress?.({ status: "error", progress: 0, message: "خطا در پردازش OCR" });
    throw error;
  }
}

async function processWithTesseract(
  file: File,
  language: string,
  onProgress?: (progress: OCRProgress) => void,
  startTime: number = Date.now()
): Promise<OCRResult> {
  const Tesseract = await import("tesseract.js");

  onProgress?.({ status: "loading", progress: 20, message: "آماده‌سازی Tesseract..." });

  const worker = await Tesseract.createWorker(language, undefined, {
    logger: (m: any) => {
      if (m.status === "recognizing text") {
        const progress = Math.round(m.progress * 70) + 20;
        onProgress?.({
          status: "recognizing",
          progress,
          message: `تشخیص متن... (${progress}%)`,
        });
      }
    },
  });

  const imageUrl = URL.createObjectURL(file);

  try {
    const { data } = await worker.recognize(imageUrl);

    onProgress?.({ status: "complete", progress: 100, message: "تکمیل شد!" });

    await worker.terminate();

    return {
      text: data.text,
      confidence: data.confidence / 100,
      language,
      processingTime: Date.now() - startTime,
      words: data.words?.map((w: any) => ({
        text: w.text,
        confidence: w.confidence / 100,
        bbox: w.bbox,
      })) || [],
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function processWithMock(
  file: File,
  onProgress?: (progress: OCRProgress) => void,
  startTime: number = Date.now()
): Promise<OCRResult> {
  // Simulate OCR processing
  onProgress?.({ status: "loading", progress: 20, message: "آماده‌سازی..." });
  await sleep(500);

  onProgress?.({ status: "recognizing", progress: 50, message: "تشخیص متن..." });
  await sleep(1000);

  onProgress?.({ status: "recognizing", progress: 80, message: "پردازش نتایج..." });
  await sleep(500);

  onProgress?.({ status: "complete", progress: 100, message: "تکمیل شد!" });

  return {
    text: `[OCR Mock] محتوای تصویر "${file.name}" - برای OCR واقعی، Tesseract.js را نصب کنید:\nnpm install tesseract.js\n\nنمونه خروجی:\nسوال: شایع‌ترین نوع سنگ کلیه چیست?\nپاسخ: کلسیم اگزالات (80% موارد)`,
    confidence: 0.85,
    language: "fas+eng",
    processingTime: Date.now() - startTime,
    words: [],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an image file is valid for OCR
 */
export function validateImageForOCR(file: File): { valid: boolean; error?: string } {
  const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/bmp", "image/tiff"];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: "فرمت تصویر پشتیبانی نمی‌شود. از PNG, JPEG, WebP یا BMP استفاده کنید." };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "حجم تصویر بیش از ۱۰ مگابایت است." };
  }

  return { valid: true };
}