"use client";

import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export interface OptionRowProps {
  optionId: string;
  index: number;
  contentHtml: string;
  fontSize?: number;
  isSelected: boolean;
  isSubmitted: boolean;
  isCorrectOption: boolean;
  isStruck: boolean;
  onSelect: () => void;
  onStrike: () => void;
  className?: string;
}

export function OptionRow({
  index,
  contentHtml,
  fontSize = 15,
  isSelected,
  isSubmitted,
  isCorrectOption,
  isStruck,
  onSelect,
  onStrike,
  className,
}: OptionRowProps) {
  const isWrongAnswer = isSubmitted && isSelected && !isCorrectOption;
  const isQuietWrong = isSubmitted && !isCorrectOption && !isWrongAnswer;

  /* Determine visual state */
  let rowClasses: string;
  let badgeClasses: string;

  if (isSubmitted && isCorrectOption) {
    rowClasses = "border-lib-correct-border bg-lib-correct-bg shadow-[0_0_0_1px_var(--lib-correct-border)] border-s-[3px] border-s-lib-correct";
    badgeClasses = "bg-lib-correct text-white";
  } else if (isWrongAnswer) {
    rowClasses = "border-lib-incorrect-border bg-lib-incorrect-bg shadow-[0_0_0_1px_var(--lib-incorrect-border)] border-s-[3px] border-s-lib-incorrect";
    badgeClasses = "bg-lib-incorrect text-white";
  } else if (!isSubmitted && isSelected) {
    rowClasses = "border-lib-accent bg-lib-accent-soft shadow-[0_0_0_1px_var(--lib-accent)22] border-s-[3px] border-s-lib-accent";
    badgeClasses = "bg-lib-accent text-white";
  } else {
    rowClasses = "border-lib-border bg-lib-surface";
    badgeClasses = "bg-muted text-muted-foreground";
  }

  return (
    <button
      onClick={isSubmitted ? undefined : onSelect}
      onContextMenu={(e) => {
        if (!isSubmitted) {
          e.preventDefault();
          onStrike();
        }
      }}
      disabled={isSubmitted}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-lib-sm border p-3",
        "min-h-touch text-start transition-all duration-lib-fade ease-lib-fade",
        "cursor-pointer select-none [-webkit-tap-highlight-color:transparent]",
        "disabled:cursor-default",
        rowClasses,
        isQuietWrong && "opacity-55",
        isStruck && !isSubmitted && "opacity-50 line-through",
        className,
      )}
    >
      {/* Letter badge */}
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold",
          badgeClasses,
        )}
      >
        {LETTERS[index] ?? index + 1}
      </span>

      {/* Content */}
      <div
        className="flex-1 text-lib-text"
        style={{ fontSize }}
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />

      {/* Strikethrough toggle hint (visible on hover, before submit) */}
      {!isSubmitted && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onStrike();
          }}
          className={cn(
            "absolute end-2 top-2 flex h-5 w-5 items-center justify-center rounded-full",
            "text-[10px] font-bold text-lib-text-muted opacity-0 transition-opacity",
            "group-hover:opacity-60 hover:!opacity-100",
            isStruck && "opacity-60",
          )}
          title="Strikethrough"
        >
          S
        </span>
      )}
    </button>
  );
}
