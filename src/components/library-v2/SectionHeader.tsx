"use client";

import React, { useCallback, useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { renderInlineRich } from "@/components/note-viewer/inlineRich";

type ReaderCSS = React.CSSProperties & {
  textWrap?: "balance" | "pretty" | "wrap" | "nowrap";
  unicodeBidi?:
    | "normal"
    | "embed"
    | "isolate"
    | "bidi-override"
    | "isolate-override"
    | "plaintext";
};

/* ═══════════════════════════════════════════════════════════════════
   SectionHeader — v5 (Persian-dominant + anchor link)
   ─────────────────────────────────────────────────────────────────
   v5 adds: copy-to-clipboard anchor link on hover — a
   small chain icon appears next to the heading on hover/focus.
   Clicking it copies the section's deep-link URL to clipboard
   and briefly shows a checkmark. Works with keyboard navigation.
═══════════════════════════════════════════════════════════════════ */

interface SectionHeaderProps {
  title: string;
  hook?: string | null;
  index?: number;
  variant?: "default" | "anchor" | "quiet";
  id?: string;
  className?: string;
}

export function SectionHeader({
  title,
  hook,
  index,
  variant = "default",
  id,
  className,
}: SectionHeaderProps) {
  const indexLabel = typeof index === "number" ? String(index).padStart(2, "0") : null;
  const isQuiet = variant === "quiet";
  const [copied, setCopied] = useState(false);

  const copyAnchor = useCallback(() => {
    if (!id || typeof window === "undefined") return;
    const url = `${window.location.href.split("#")[0]}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [id]);

  const h2Style: ReaderCSS = {
    textWrap: "balance",
    textAlign: "start",
    overflowWrap: "break-word",
    wordBreak: "normal",
    lineBreak: "auto",
  };

  const hookStyle: ReaderCSS = {
    textWrap: "pretty",
    textAlign: "start",
    overflowWrap: "break-word",
    wordBreak: "normal",
    lineBreak: "auto",
  };

  return (
    <header
      id={id}
      data-section-header
      data-section-variant={variant}
      className={cn(
        "group/section scroll-mt-24",
        isQuiet ? "mb-1.5 mt-5" : "mb-2.5 mt-7 first:mt-1",
        variant === "anchor" && "border-s-2 border-lib-accent/40 ps-4",
        className,
      )}
    >
      <h2
        className={cn(
          "flex items-baseline gap-2.5 text-lib-text",
          "[&_strong]:font-[780] [&_strong]:text-lib-text",
          "[&_em]:italic",
          isQuiet
            ? "text-[18px] font-[680] leading-[1.45] tracking-[-0.006em]"
            : "text-[24px] font-[700] leading-[1.38] tracking-[-0.012em]",
        )}
        style={h2Style}
      >
        {indexLabel && !isQuiet && (
          <span
            aria-hidden="true"
            dir="ltr"
            className={cn(
              "inline-flex shrink-0 translate-y-[-2px] items-center justify-center",
              "rounded-[5px] border border-lib-border/70 bg-lib-surface/60",
              "px-[6px] py-[1px] font-mono text-[11px] font-[540] leading-none tabular-nums",
              "text-lib-text-muted/80",
            )}
          >
            {indexLabel}
          </span>
        )}
        <span className="min-w-0">{renderInlineRich(title)}</span>

        {/* Anchor copy button — fades in on hover/focus-within */}
        {id && (
          <button
            type="button"
            onClick={copyAnchor}
            aria-label={copied ? "Link copied!" : "Copy section link"}
            title={copied ? "Copied!" : "Copy link to this section"}
            className={cn(
              "inline-flex shrink-0 translate-y-[-1px] items-center justify-center",
              "rounded-[4px] p-[3px]",
              "text-lib-text-muted/0 transition-all duration-150",
              "group-hover/section:text-lib-text-muted/50",
              "hover:!text-lib-text-muted hover:bg-lib-hover",
              "focus-visible:text-lib-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lib-accent/50",
              copied && "!text-lib-success",
            )}
          >
            {copied
              ? <Check className="h-3.5 w-3.5" />
              : <LinkIcon className="h-3.5 w-3.5" />}
          </button>
        )}
      </h2>

      {hook && (
        <p
          className={cn(
            "mt-1.5 max-w-[62ch] text-lib-text-muted",
            isQuiet
              ? "text-[13.5px] leading-[1.78]"
              : "text-[14.5px] leading-[1.82]",
            "[&_strong]:font-[720] [&_strong]:text-lib-text/95",
            "[&_em]:italic [&_em]:text-lib-text/90",
            "[&_code]:rounded-[4px] [&_code]:border [&_code]:border-lib-border/40",
            "[&_code]:bg-lib-hover/55 [&_code]:px-1.5 [&_code]:py-[1px]",
            "[&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-lib-text/95",
          )}
          style={hookStyle}
        >
          {renderInlineRich(hook)}
        </p>
      )}
    </header>
  );
}
