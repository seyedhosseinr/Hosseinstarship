import Link from "next/link";
import { ArrowLeft, BookOpen, Layers } from "lucide-react";
import { getCampbellVolumeSummaries, getLibraryDashboardData } from "@/lib/library/queries";

export const dynamic = "force-dynamic";

export default async function CampbellLibraryPage() {
  const [volumes, dashboard] = await Promise.all([
    getCampbellVolumeSummaries(),
    getLibraryDashboardData(),
  ]);

  return (
    <div className="min-h-screen px-5 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-7">
        {/* Header */}
        <header className="rounded-[24px] border border-border/40 bg-card/70 px-7 py-7 shadow-sm backdrop-blur-xl dark:bg-card/40">
          <Link
            href="/library"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Library
          </Link>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
                Campbell Library
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
                Campbell-Walsh-Wein Urology
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Browse by volume first. Segment-level navigation begins only after you enter a chapter.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Included", value: dashboard.totalIncluded },
                { label: "Read", value: dashboard.totalRead },
                { label: "Mastered", value: dashboard.totalMastered },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
                    {stat.label}
                  </div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Volume Cards */}
        <section className="grid gap-5 lg:grid-cols-3">
          {volumes.map((volume) => (
            <Link
              key={volume.volumeNo}
              href={volume.href}
              className="group rounded-[22px] border border-border/40 bg-card/70 p-6 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_8px_32px_hsl(var(--primary)/0.06)] dark:bg-card/40"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                <BookOpen className="h-3.5 w-3.5" />
                {volume.title}
              </div>
              <h2 className="mt-5 text-2xl font-bold text-foreground">Volume {volume.volumeNo}</h2>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Chapters", value: volume.chapterCount },
                  { label: "Available", value: volume.availableChapterCount },
                  { label: "Segments", value: volume.segmentCount },
                  { label: "Read", value: `${volume.readCount}/${volume.chapterCount}` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-border/20 bg-muted/30 px-3.5 py-2.5"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60">
                      {stat.label}
                    </div>
                    <div className="mt-1 font-bold tabular-nums text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                Open volume
                <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
              </div>
            </Link>
          ))}
        </section>

        {/* Progress Snapshot */}
        <section className="rounded-[24px] border border-border/40 bg-card/70 px-7 py-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
            <Layers className="h-4 w-4" />
            Progress snapshot
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {dashboard.recentlyRead.slice(0, 3).map((chapter) => (
              <Link
                key={chapter.chapterNo}
                href={`/library/campbell/chapter/${chapter.chapterNo}`}
                className="rounded-[18px] border border-border/30 bg-muted/20 px-5 py-4 text-sm transition-all duration-200 hover:border-primary/20 hover:bg-muted/40"
              >
                <div className="font-bold text-foreground">Chapter {chapter.chapterNo}</div>
                <div className="mt-1 text-muted-foreground">{chapter.title}</div>
              </Link>
            ))}
            {dashboard.recentlyRead.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-border/50 bg-muted/10 px-5 py-8 text-sm text-muted-foreground md:col-span-3">
                No reading activity yet. Start from a volume to begin the new library flow.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
