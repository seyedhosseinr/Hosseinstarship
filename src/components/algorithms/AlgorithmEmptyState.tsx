"use client";

import { GitBranch } from "lucide-react";

interface AlgorithmEmptyStateProps {
  message?: string;
}

export function AlgorithmEmptyState({ message }: AlgorithmEmptyStateProps) {
  return (
    <div
      dir="rtl"
      lang="fa"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700/50">
        <GitBranch className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-base text-slate-400">
        {message ?? "سطحی برای نمایش وجود ندارد"}
      </p>
    </div>
  );
}
