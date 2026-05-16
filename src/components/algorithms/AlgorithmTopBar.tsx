"use client";

import { ChevronLeft } from "lucide-react";
import { getAlgorithmShortTitle, type AlgorithmIRV4 } from "@/types/algorithm-ir-v4";

interface AlgorithmTopBarProps {
  ir: AlgorithmIRV4;
}

export function AlgorithmTopBar({ ir }: AlgorithmTopBarProps) {
  const shortTitle = getAlgorithmShortTitle(ir);
  const fullTitle = ir.algorithmMeta.title;
  const examTarget = ir.algorithmMeta.examTarget as string | undefined;
  const language = ir.algorithmMeta.language as string | undefined;
  const segmentId = ir.segmentId;
  const chapterId = ir.algorithmMeta.chapterId as string | undefined;

  return (
    <header
      dir="rtl"
      lang="fa"
      className="border-b border-slate-700/50 bg-slate-950/90 backdrop-blur-sm"
    >
      <div className="px-4 py-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
          <span>الگوریتم‌ها</span>
          <ChevronLeft className="h-3 w-3" />
          <span className="text-slate-400">{shortTitle}</span>
        </div>

        {/* Main title */}
        <h1 className="text-base font-bold leading-snug text-slate-100">
          {fullTitle}
        </h1>

        {/* Subtitle */}
        <p className="mt-0.5 text-xs text-slate-400">
          اطلس الگوریتمی — مسیرهای تشخیصی، تصویربرداری و کنترل درد
        </p>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {examTarget && (
            <span className="rounded-full border border-indigo-500/30 bg-indigo-950/40 px-2 py-0.5 text-[10px] text-indigo-300">
              {examTarget}
            </span>
          )}
          {language && (
            <span className="rounded-full border border-slate-600/40 px-2 py-0.5 text-[10px] text-slate-400">
              {language}
            </span>
          )}
          <span className="text-[10px] text-slate-600">
            {chapterId && `فصل ${chapterId} · `}
            اطلس الگوریتمی
            {" · "}
            <span className="font-mono">{segmentId}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
