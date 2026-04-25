"use client";

import { useState, useCallback } from "react";
import {
  detectFileType,
  parseJSON,
  parseCSV,
  parseHTML,
  parsePlainText,
  processImageOCR,
  type ParseResult,
  type OCRProgress,
  type ImportFileType,
} from "@/lib/import";

export interface ProcessingFile {
  file: File;
  type: ImportFileType;
  status: "pending" | "processing" | "complete" | "error";
  result?: ParseResult;
  ocrProgress?: OCRProgress;
  error?: string;
}

interface UseFileProcessorReturn {
  files: ProcessingFile[];
  isProcessing: boolean;
  totalItems: number;
  processFiles: (files: File[]) => Promise<void>;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  getAllParsedItems: () => ParseResult["items"];
}

export function useFileProcessor(): UseFileProcessorReturn {
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(async (newFiles: File[]) => {
    const processingFiles: ProcessingFile[] = newFiles.map((file) => ({
      file,
      type: detectFileType(file),
      status: "pending" as const,
    }));

    setFiles((prev) => [...prev, ...processingFiles]);
    setIsProcessing(true);

    for (let i = 0; i < processingFiles.length; i++) {
      const pf = processingFiles[i];

      setFiles((prev) => {
        const updated = [...prev];
        const idx = prev.length - processingFiles.length + i;
        updated[idx] = { ...updated[idx], status: "processing" };
        return updated;
      });

      try {
        const content = pf.type !== "image" ? await readFileAsText(pf.file) : "";
        let result: ParseResult;

        switch (pf.type) {
          case "json":
            result = await parseJSON(content, pf.file.name);
            break;
          case "csv":
            result = await parseCSV(content, pf.file.name);
            break;
          case "html":
            result = await parseHTML(content, pf.file.name);
            break;
          case "txt":
            result = await parsePlainText(content, pf.file.name);
            break;
          case "image": {
            const ocrResult = await processImageOCR(pf.file, "fas+eng", (progress) => {
              setFiles((prev) => {
                const updated = [...prev];
                const idx = prev.length - processingFiles.length + i;
                updated[idx] = { ...updated[idx], ocrProgress: progress };
                return updated;
              });
            });
            // Convert OCR text to parsed items using plain text parser
            result = await parsePlainText(ocrResult.text, pf.file.name);
            result.fileType = "image";
            break;
          }
          case "pdf": {
            // PDF parsing - try to extract text
            const pdfText = await extractPDFText(pf.file);
            result = await parsePlainText(pdfText, pf.file.name);
            result.fileType = "pdf";
            break;
          }
          default:
            result = {
              items: [],
              fileType: "unknown",
              fileName: pf.file.name,
              fileSize: pf.file.size,
              errors: ["فرمت فایل پشتیبانی نمی‌شود"],
              warnings: [],
              parseTime: 0,
            };
        }

        setFiles((prev) => {
          const updated = [...prev];
          const idx = prev.length - processingFiles.length + i;
          updated[idx] = { ...updated[idx], status: "complete", result };
          return updated;
        });
      } catch (error) {
        setFiles((prev) => {
          const updated = [...prev];
          const idx = prev.length - processingFiles.length + i;
          updated[idx] = {
            ...updated[idx],
            status: "error",
            error: (error as Error).message,
          };
          return updated;
        });
      }
    }

    setIsProcessing(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setFiles([]);
  }, []);

  const getAllParsedItems = useCallback(() => {
    return files.flatMap((f) => f.result?.items || []);
  }, [files]);

  const totalItems = files.reduce(
    (sum, f) => sum + (f.result?.items.length || 0),
    0
  );

  return {
    files,
    isProcessing,
    totalItems,
    processFiles,
    removeFile,
    clearFiles,
    getAllParsedItems,
  };
}

// ─── Helpers ────────────────────────────────────────────────

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("خطا در خواندن فایل"));
    reader.readAsText(file, "utf-8");
  });
}

async function extractPDFText(file: File): Promise<string> {
  try {
    // Try dynamic import of pdf.js
    const pdfjsLib = await import("pdfjs-dist").catch(() => null);

    if (pdfjsLib) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const textParts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        textParts.push(pageText);
      }

      return textParts.join("\n\n");
    }
  } catch (e) {
    // Fall through to mock
  }

  // Mock PDF extraction
  return `[PDF Mock] محتوای فایل "${file.name}" - برای استخراج واقعی PDF:\nnpm install pdfjs-dist\n\nQ: سوال نمونه از PDF\nA: پاسخ نمونه`;
}