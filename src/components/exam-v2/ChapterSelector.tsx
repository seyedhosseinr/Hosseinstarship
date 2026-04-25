"use client";

import { useMemo, useState } from "react";
import { BookOpen, Layers, BarChart3, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChip } from "./FilterChip";
import {
  getCampbellVolumes,
  getPartsByVolumeIds,
  getChaptersByPartIds,
} from "@/lib/exam/campbell-hierarchy";

export interface ChapterSelectorProps {
  selectedVolumeIds: string[];
  selectedPartIds: string[];
  selectedChapterIds: string[];
  onToggleVolume: (id: string) => void;
  onTogglePart: (id: string) => void;
  onToggleChapter: (id: string) => void;
  onSelectAllChapters: () => void;
  onClearChapters: () => void;
  className?: string;
}

function SectionCard({
  title,
  icon,
  actions,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lib-md border border-lib-border bg-lib-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lib-accent">{icon}</span>
          <h3 className="text-sm font-bold text-lib-text">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function ChapterSelector({
  selectedVolumeIds,
  selectedPartIds,
  selectedChapterIds,
  onToggleVolume,
  onTogglePart,
  onToggleChapter,
  onSelectAllChapters,
  onClearChapters,
  className,
}: ChapterSelectorProps) {
  const [chapterSearch, setChapterSearch] = useState("");

  const volumes = useMemo(() => getCampbellVolumes(), []);
  const allParts = useMemo(() => getPartsByVolumeIds([]), []);

  const availableParts = useMemo(
    () => getPartsByVolumeIds(selectedVolumeIds.length > 0 ? selectedVolumeIds : volumes.map((v) => v.id)),
    [selectedVolumeIds, volumes],
  );

  const availableChapters = useMemo(() => {
    const partIds =
      selectedPartIds.length > 0
        ? selectedPartIds
        : selectedVolumeIds.length > 0
          ? availableParts.map((p) => p.id)
          : allParts.map((p) => p.id);
    return getChaptersByPartIds(partIds).filter(
      (c) =>
        !chapterSearch ||
        c.title.toLowerCase().includes(chapterSearch.toLowerCase()) ||
        String(c.chapterNo).includes(chapterSearch),
    );
  }, [selectedPartIds, selectedVolumeIds, availableParts, allParts, chapterSearch]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Volumes */}
      <SectionCard title="جلدها (Volumes)" icon={<BookOpen size={16} />}>
        <div className="flex flex-wrap gap-2">
          <FilterChip label="همه جلدها" active={selectedVolumeIds.length === 0} onClick={() => {}} />
          {volumes.map((vol) => (
            <FilterChip
              key={vol.id}
              label={vol.label}
              active={selectedVolumeIds.includes(vol.id)}
              onClick={() => onToggleVolume(vol.id)}
            />
          ))}
        </div>
      </SectionCard>

      {/* Parts */}
      <SectionCard title="بخش‌ها (Parts)" icon={<Layers size={16} />}>
        <div className="flex flex-wrap gap-2">
          <FilterChip label="همه بخش‌ها" active={selectedPartIds.length === 0} onClick={() => {}} />
          {availableParts.map((part) => (
            <FilterChip
              key={part.id}
              label={part.label}
              active={selectedPartIds.includes(part.id)}
              onClick={() => onTogglePart(part.id)}
            />
          ))}
        </div>
      </SectionCard>

      {/* Chapters */}
      <SectionCard
        title={`فصل‌ها (${availableChapters.length} فصل)`}
        icon={<BarChart3 size={16} />}
        actions={
          <div className="flex gap-2">
            <button onClick={onSelectAllChapters} className="cursor-pointer rounded-md border border-lib-border bg-transparent px-2.5 py-0.5 text-[11px] text-lib-accent">
              انتخاب همه
            </button>
            {selectedChapterIds.length > 0 && (
              <button onClick={onClearChapters} className="cursor-pointer rounded-md border border-lib-border bg-transparent px-2.5 py-0.5 text-[11px] text-lib-incorrect">
                پاک کردن
              </button>
            )}
          </div>
        }
      >
        {/* Search */}
        <div className="mb-3 flex items-center gap-2 rounded-lib-sm border border-lib-border bg-lib-hover px-3 py-2">
          <Search size={14} className="text-lib-text-muted" />
          <input
            value={chapterSearch}
            onChange={(e) => setChapterSearch(e.target.value)}
            placeholder="جستجوی فصل..."
            className="flex-1 border-none bg-transparent text-xs text-lib-text outline-none placeholder:text-lib-text-muted"
          />
          {chapterSearch && (
            <button onClick={() => setChapterSearch("")} className="cursor-pointer text-lib-text-muted">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Chapter grid */}
        <div className="grid max-h-[400px] grid-cols-1 gap-1 overflow-y-auto ipad-landscape:grid-cols-2">
          {availableChapters.map((ch) => {
            const selected = selectedChapterIds.includes(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => onToggleChapter(ch.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lib-sm px-3 py-2.5 text-start",
                  "min-h-touch cursor-pointer border transition-colors",
                  selected
                    ? "border-lib-accent bg-lib-accent-soft text-lib-accent"
                    : "border-lib-border bg-transparent text-lib-text hover:bg-lib-hover",
                )}
              >
                <Check size={12} className={cn("shrink-0", selected ? "opacity-100" : "opacity-0")} />
                <span className="flex-1 text-xs">
                  <span className="font-semibold">Ch. {ch.chapterNo}</span>{" "}
                  <span className="text-lib-text-secondary">{ch.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
