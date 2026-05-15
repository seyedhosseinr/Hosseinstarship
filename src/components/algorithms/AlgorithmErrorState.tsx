"use client";

import { AlertTriangle } from "lucide-react";

interface AlgorithmErrorStateProps {
  message?: string;
}

export function AlgorithmErrorState({ message }: AlgorithmErrorStateProps) {
  return (
    <div
      dir="rtl"
      lang="fa"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold text-slate-100">
        فایل الگوریتم معتبر نیست
      </h2>
      {message && (
        <p className="max-w-md text-sm text-slate-400">{message}</p>
      )}
    </div>
  );
}
