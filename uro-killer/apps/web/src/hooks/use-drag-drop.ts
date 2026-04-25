"use client";

import { useState, useCallback, useRef, type DragEvent } from "react";

interface UseDragDropOptions {
  accept?: string[];     // MIME types to accept
  maxFiles?: number;
  maxSize?: number;      // bytes
  onDrop?: (files: File[]) => void;
  onError?: (error: string) => void;
}

interface UseDragDropReturn {
  isDragging: boolean;
  dragRef: React.RefObject<HTMLDivElement>;
  handleDragEnter: (e: DragEvent) => void;
  handleDragLeave: (e: DragEvent) => void;
  handleDragOver: (e: DragEvent) => void;
  handleDrop: (e: DragEvent) => void;
  openFilePicker: () => void;
}

export function useDragDrop(options: UseDragDropOptions = {}): UseDragDropReturn {
  const {
    accept,
    maxFiles = 10,
    maxSize = 50 * 1024 * 1024, // 50MB default
    onDrop,
    onError,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null!);
  const dragCounter = useRef(0);

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      const valid: File[] = [];

      for (const file of files) {
        if (valid.length >= maxFiles) {
          onError?.(`حداکثر ${maxFiles} فایل مجاز است`);
          break;
        }

        if (file.size > maxSize) {
          onError?.(`فایل "${file.name}" بیش از حد مجاز (${Math.round(maxSize / 1024 / 1024)}MB) است`);
          continue;
        }

        if (accept && accept.length > 0) {
          const isAccepted = accept.some((type) => {
            if (type.endsWith("/*")) {
              return file.type.startsWith(type.replace("/*", ""));
            }
            return file.type === type || file.name.endsWith(type.replace(".", "").replace("*", ""));
          });

          if (!isAccepted) {
            onError?.(`فرمت فایل "${file.name}" پشتیبانی نمی‌شود`);
            continue;
          }
        }

        valid.push(file);
      }

      return valid;
    },
    [accept, maxFiles, maxSize, onError]
  );

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const validFiles = validateFiles(files);
      if (validFiles.length > 0) {
        onDrop?.(validFiles);
      }
    },
    [validateFiles, onDrop]
  );

  const openFilePicker = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = maxFiles > 1;
    if (accept) {
      input.accept = accept.join(",");
    }
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const validFiles = validateFiles(files);
      if (validFiles.length > 0) {
        onDrop?.(validFiles);
      }
    };
    input.click();
  }, [accept, maxFiles, validateFiles, onDrop]);

  return {
    isDragging,
    dragRef,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFilePicker,
  };
}