"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ReaderBgTheme, BgThemeConfig } from "@/hooks/useReaderSettings";
import { BG_THEMES } from "@/hooks/useReaderSettings";

const SPINE_WIDTH = 300;

interface ReaderStageProps {
  children: ReactNode;
  className?: string;
  bgTheme?: ReaderBgTheme;
  spineOpen?: boolean;
}

export const ReaderStage = forwardRef<HTMLDivElement, ReaderStageProps>(
  function ReaderStage({ children, className, bgTheme, spineOpen = false }, ref) {
    const themeConfig: BgThemeConfig | undefined = bgTheme
      ? BG_THEMES.find((t) => t.id === bgTheme)
      : undefined;

    const gutterVar = "var(--lib-stage-padding-x, clamp(1rem, 4vw, 3rem))";
    const style: CSSProperties = {
      WebkitOverflowScrolling: "touch",
      paddingInlineEnd: gutterVar,
      paddingInlineStart: spineOpen
        ? `calc(${SPINE_WIDTH}px + ${gutterVar})`
        : gutterVar,
      ...(themeConfig ? { "--reader-bg": themeConfig.bgHsl } as React.CSSProperties : {}),
    };

    return (
      <div
        ref={ref}
        data-reader-stage
        data-bg-theme={bgTheme ?? "paper"}
        className={cn(
          "relative h-dvh overflow-y-auto bg-[hsl(var(--reader-bg))]",
          "pb-24 pt-2 transition-[background-color,padding] duration-300 ease-out",
          className,
        )}
        style={style}
      >
        {children}
      </div>
    );
  },
);
