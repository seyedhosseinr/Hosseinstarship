from pathlib import Path
import shutil
import sys

TARGET = Path(r"src/components/library-linear/LinearLibraryView.tsx")

if not TARGET.exists():
    print(f"ERROR: file not found: {TARGET}")
    sys.exit(1)

src = TARGET.read_text(encoding="utf-8")
original = src
changes = []


def replace_once(text: str, old: str, new: str, label: str):
    if old not in text:
        print(f"SKIP: {label}")
        return text
    print(f"PATCH: {label}")
    changes.append(label)
    return text.replace(old, new, 1)


# ------------------------------------------------------------
# 1) imports: add BookOpen + TrendingUp if missing
# ------------------------------------------------------------
old_import = '''import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Clock,
  Compass,
  Disc,
  FolderTree,
  Library,
  Layers3,
  Search,
  Sparkles,
  Star,
} from "lucide-react";'''

new_import = '''import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Clock,
  Compass,
  Disc,
  FolderTree,
  Library,
  Layers3,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";'''

src = replace_once(src, old_import, new_import, "imports")


# ------------------------------------------------------------
# 2) add ll-anthropic-active if missing
# ------------------------------------------------------------
old_css_anchor = """.ll-hover-soft:hover {
  background: hsl(var(--foreground) / 0.03);
}

.ll-surface-card {"""

new_css_anchor = """.ll-hover-soft:hover {
  background: hsl(var(--foreground) / 0.03);
}

.ll-anthropic-active {
  background: hsl(var(--foreground) / 0.04);
  border-color: hsl(var(--border) / 0.85);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.03);
}

.ll-surface-card {"""

src = replace_once(src, old_css_anchor, new_css_anchor, "ll-anthropic-active css")


# ------------------------------------------------------------
# 3) widen main container
# ------------------------------------------------------------
src = replace_once(
    src,
    '''          <div className="mx-auto max-w-5xl px-6 py-8 md:px-10 lg:px-14 lg:py-9">''',
    '''          <div className="mx-auto max-w-[1180px] px-6 py-8 md:px-8 lg:px-10 lg:py-10">''',
    "main width",
)

# ------------------------------------------------------------
# 4) add icons/tone to SectionHeading calls
# ------------------------------------------------------------
src = replace_once(
    src,
    '''                  <SectionHeading
                    eyebrow="مطالعه"
                    title="ادامه مطالعه"
                    description="فصل‌های اخیر و نقاط بازگشت."
                    count={
                      dashboard.recentlyRead.length > 0
                        ? `${dashboard.recentlyRead.length} اخیر`
                        : undefined
                    }
                  />''',
    '''                  <SectionHeading
                    eyebrow="مطالعه"
                    title="ادامه مطالعه"
                    description="فصل‌های اخیر و نقاط بازگشت."
                    count={
                      dashboard.recentlyRead.length > 0
                        ? `${dashboard.recentlyRead.length} اخیر`
                        : undefined
                    }
                    icon={<Clock className="h-3.5 w-3.5" />}
                    tone="green"
                  />''',
    "continue heading",
)

src = replace_once(
    src,
    '''                  <SectionHeading
                    eyebrow="مرور"
                    title="فصل‌های ضعیف"
                    description="فصل‌هایی با دقت زیر ۶۰ درصد."
                    count={
                      dashboard.weakChapters.length > 0
                        ? `${dashboard.weakChapters.length} ضعیف`
                        : undefined
                    }
                  />''',
    '''                  <SectionHeading
                    eyebrow="مرور"
                    title="فصل‌های ضعیف"
                    description="فصل‌هایی با دقت زیر ۶۰ درصد."
                    count={
                      dashboard.weakChapters.length > 0
                        ? `${dashboard.weakChapters.length} ضعیف`
                        : undefined
                    }
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    tone="orange"
                  />''',
    "weak heading",
)

src = replace_once(
    src,
    '''              <SectionHeading
                eyebrow="مرور"
                title="جلدها"
                description="مرور کتاب بر اساس جلد."
                count={`${volumes.length} جلد`}
              />''',
    '''              <SectionHeading
                eyebrow="مرور"
                title="جلدها"
                description="مرور کتاب بر اساس جلد."
                count={`${volumes.length} جلد`}
                icon={<Layers3 className="h-3.5 w-3.5" />}
                tone="green"
              />''',
    "volumes heading",
)

# ------------------------------------------------------------
# 5) make middle section cards
# ------------------------------------------------------------
src = replace_once(
    src,
    '''            <section className="py-9">
              <div className="grid gap-8 lg:grid-cols-2">
                <div>''',
    '''            <section className="py-9">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="ll-surface-card rounded-[24px] p-5 md:p-6">''',
    "middle cards first",
)

src = replace_once(
    src,
    '''                <div>
                  <SectionHeading
                    eyebrow="مرور"
                    title="فصل‌های ضعیف"''',
    '''                <div className="ll-surface-card rounded-[24px] p-5 md:p-6">
                  <SectionHeading
                    eyebrow="مرور"
                    title="فصل‌های ضعیف"''',
    "middle cards second",
)

# ------------------------------------------------------------
# 6) ContinueReadingList polish
# ------------------------------------------------------------
src = replace_once(
    src,
    '''            className="group grid gap-3 border-b border-border/24 py-3 transition-colors sm:grid-cols-[64px_minmax(0,1fr)_72px]"''',
    '''            className="group grid gap-3 rounded-2xl border border-transparent px-3 py-3 transition-all ll-hover-soft hover:border-border/55 sm:grid-cols-[64px_minmax(0,1fr)_72px]"''',
    "continue row class",
)

src = replace_once(
    src,
    '''            <div className="pt-0.5 text-[11px] font-mono tabular-nums text-muted-foreground/46">
              {row.chapterNo}
            </div>''',
    '''            <div className="pt-0.5">
              <span className="ll-chip-green h-7 min-w-7 px-2 text-[10px] font-semibold ll-meta">
                {row.chapterNo}
              </span>
            </div>''',
    "continue badge",
)

src = replace_once(
    src,
    '''            <div className="pt-0.5 text-[12px] font-medium text-muted-foreground/46 transition-colors group-hover:text-foreground/72 sm:text-right">
              بازگشت
            </div>''',
    '''            <div className="pt-0.5 sm:text-left">
              <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground/52 transition-colors group-hover:text-foreground/72">
                بازگشت
              </span>
            </div>''',
    "continue return pill",
)

# ------------------------------------------------------------
# 7) WeakChaptersList polish
# ------------------------------------------------------------
src = replace_once(
    src,
    '''            className="group grid gap-3 border-b border-border/24 py-3 transition-colors sm:grid-cols-[64px_minmax(0,1fr)_104px]"''',
    '''            className="group grid gap-3 rounded-2xl border border-transparent px-3 py-3 transition-all ll-hover-soft hover:border-border/55 sm:grid-cols-[64px_minmax(0,1fr)_104px]"''',
    "weak row class",
)

src = replace_once(
    src,
    '''            <div className="pt-0.5 text-[11px] font-mono tabular-nums text-muted-foreground/46">
              {row.chapterNo}
            </div>''',
    '''            <div className="pt-0.5">
              <span className="ll-chip-orange h-7 min-w-7 px-2 text-[10px] font-semibold ll-meta">
                {row.chapterNo}
              </span>
            </div>''',
    "weak badge",
)

src = replace_once(
    src,
    '''            <div className="flex flex-col items-start gap-1 pt-0.5 sm:items-end">
              <div className={cn("text-[12px] font-medium tabular-nums", accuracyTone)}>
                {row.accuracyPercent}%
              </div>
              <div className="text-[11px] text-muted-foreground/44 transition-colors group-hover:text-foreground/66">
                مرور
              </div>
            </div>''',
    '''            <div className="flex flex-col items-start gap-1 pt-0.5 sm:items-end">
              <div className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium tabular-nums", accuracyTone)}>
                {row.accuracyPercent}%
              </div>
              <div className="text-[11px] text-muted-foreground/44 transition-colors group-hover:text-foreground/66">
                مرور
              </div>
            </div>''',
    "weak accuracy pill",
)

# ------------------------------------------------------------
# 8) VolumeIndex polish
# ------------------------------------------------------------
src = replace_once(
    src,
    '''            className="group grid gap-3 border-b border-border/24 py-3.5 transition-colors lg:grid-cols-[96px_minmax(0,1fr)_150px]"''',
    '''            className="group grid gap-4 rounded-[22px] border border-border/60 bg-background px-4 py-4 transition-all hover:-translate-y-[1px] hover:border-border/85 hover:shadow-[0_10px_24px_hsl(var(--foreground)/0.04)] lg:grid-cols-[110px_minmax(0,1fr)_170px]"''',
    "volume row class",
)

src = replace_once(
    src,
    '''            <div className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/56">
              جلد {volume.volumeNo}
            </div>''',
    '''            <div className="pt-0.5">
              <div className="ll-chip-green h-9 w-9">
                <Layers3 className="h-4 w-4" />
              </div>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/56">
                جلد {volume.volumeNo}
              </div>
            </div>''',
    "volume left block",
)

src = replace_once(
    src,
    '''              <div className="text-[12px] font-medium text-foreground/72 group-hover:text-foreground">
                باز کردن جلد
              </div>''',
    '''              <div className="text-[12px] font-medium text-foreground/72 group-hover:text-foreground">
                <span className="rounded-full border border-border/60 px-2.5 py-1">
                  باز کردن جلد
                </span>
              </div>''',
    "volume open pill",
)

# ------------------------------------------------------------
# 9) StatusLegend full replacement
# ------------------------------------------------------------
old_legend = '''function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] text-muted-foreground/56">
      <span className="flex items-center gap-1.5">
        <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
        شروع نشده
      </span>
      <span className="flex items-center gap-1.5">
        <Disc className="h-2.5 w-2.5 text-primary" />
        در حال مطالعه
      </span>
      <span className="flex items-center gap-1.5">
        <Check className="h-2.5 w-2.5 text-success" />
        خوانده‌شده
      </span>
      <span className="flex items-center gap-1.5">
        <CheckCheck className="h-2.5 w-2.5 text-success" />
        مرور شده
      </span>
      <span className="flex items-center gap-1.5">
        <Star className="h-2.5 w-2.5 fill-warning text-warning" />
        تسلط
      </span>
    </div>
  );
}'''

new_legend = '''function StatusLegend() {
  const items = [
    {
      label: "شروع نشده",
      icon: <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />,
      tone: "muted",
    },
    {
      label: "در حال مطالعه",
      icon: <Disc className="h-2.5 w-2.5 text-primary" />,
      tone: "green",
    },
    {
      label: "خوانده‌شده",
      icon: <Check className="h-2.5 w-2.5 text-success" />,
      tone: "green",
    },
    {
      label: "مرور شده",
      icon: <CheckCheck className="h-2.5 w-2.5 text-success" />,
      tone: "green",
    },
    {
      label: "تسلط",
      icon: <Star className="h-2.5 w-2.5 fill-warning text-warning" />,
      tone: "orange",
    },
  ] as const;

  return (
    <div className="ll-surface-card rounded-[22px] p-5">
      <div className="flex items-center gap-2">
        <span className="ll-chip-muted h-7 w-7">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/58">
          وضعیت‌ها
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2.5">
        {items.map((item) => (
          <span
            key={item.label}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]",
              item.tone === "orange"
                ? "border-amber-200/60 bg-amber-50/60 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                : item.tone === "green"
                ? "border-primary/18 bg-primary/8 text-foreground"
                : "border-border/60 bg-background text-muted-foreground/72",
            )}
          >
            {item.icon}
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}'''

src = replace_once(src, old_legend, new_legend, "status legend")

# ------------------------------------------------------------
# 10) volumes section wrapper
# ------------------------------------------------------------
src = replace_once(
    src,
    '''            <section id="volumes" className="border-t border-border/42 py-9">
              <SectionHeading''',
    '''            <section id="volumes" className="py-4">
              <div className="ll-surface-card rounded-[26px] p-5 md:p-6">
              <SectionHeading''',
    "volumes wrapper open",
)

src = replace_once(
    src,
    '''              <div className="mt-4">
                <VolumeIndex volumes={volumes} />
              </div>
            </section>''',
    '''              <div className="mt-4">
                <VolumeIndex volumes={volumes} />
              </div>
              </div>
            </section>''',
    "volumes wrapper close",
)

# ------------------------------------------------------------
# write file
# ------------------------------------------------------------
if not changes:
    print("No changes applied.")
    sys.exit(1)

backup = TARGET.with_suffix(TARGET.suffix + ".bak")
shutil.copy2(TARGET, backup)
TARGET.write_text(src, encoding="utf-8")

print("\nDone.")
print(f"Patched: {TARGET}")
print(f"Backup:  {backup}")
print("Applied patches:")
for c in changes:
    print(f" - {c}")