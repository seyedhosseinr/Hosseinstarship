"use client";

import { cn } from "@/lib/utils";
import type { YieldSectionGroup } from "@/lib/yield/types";

interface YieldTocProps {
  sections: YieldSectionGroup[];
  activeSectionTitle: string | null;
  onSelectSection: (sectionTitle: string) => void;
}

/**
 * Right-panel sidebar navigation for the YIELD tab.
 * Groups yield cards by their source section title.
 * Visually matches NoteToc (border-l, bg-background/80, sticky, hidden on small screens).
 */
export function YieldToc({
  sections,
  activeSectionTitle,
  onSelectSection,
}: YieldTocProps) {
  if (sections.length < 2) return null;

  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 overflow-y-auto border-l border-border/70 bg-background/80 xl:block">
      <div className="border-b border-border/70 px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Yield Sections
        </div>
      </div>
      <nav className="space-y-1 px-3 py-3">
        {sections.map((section) => (
          <button
            key={section.sectionTitle}
            type="button"
            onClick={() => onSelectSection(section.sectionTitle)}
            className={cn(
              "block w-full rounded-lg px-3 py-2 text-start text-sm transition-colors",
              activeSectionTitle === section.sectionTitle
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <span className="block truncate">{section.sectionTitle}</span>
            <span className="mt-0.5 block text-xs opacity-60">
              {section.cards.length} {section.cards.length === 1 ? "card" : "cards"}
            </span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
