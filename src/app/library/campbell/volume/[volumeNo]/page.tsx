import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { notFound } from "next/navigation";
import { getCampbellVolumeDetail } from "@/lib/library/queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ volumeNo: string }>;
};

export default async function CampbellVolumePage({ params }: PageProps) {
  const { volumeNo: volumeNoParam } = await params;
  const volumeNo = Number(volumeNoParam);
  const volume = Number.isFinite(volumeNo) ? await getCampbellVolumeDetail(volumeNo) : null;

  if (!volume) {
    notFound();
  }

  const parts = Array.from(new Set(volume.chapters.map((chapter) => chapter.part)));

  return (
    <div className="min-h-screen px-5 py-8 md:px-6">
      <div className="mx-auto max-w-6xl space-y-7">
        {/* Header */}
        <header className="rounded-[24px] border border-border/40 bg-card/70 px-7 py-7 shadow-sm backdrop-blur-xl dark:bg-card/40">
          <Link
            href="/library/campbell"
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Campbell
          </Link>
          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
                Volume browser
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{volume.title}</h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Chapters", value: volume.chapterCount },
                { label: "Available", value: volume.availableChapterCount },
                { label: "Segments", value: volume.segmentCount },
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

        {/* Part sections */}
        <div className="space-y-5">
          {parts.map((part) => (
            <section
              key={part}
              className="rounded-[24px] border border-border/40 bg-card/70 px-7 py-6 shadow-sm backdrop-blur-xl dark:bg-card/40"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
                <BookOpen className="h-4 w-4" />
                {part}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {volume.chapters
                  .filter((chapter) => chapter.part === part)
                  .map((chapter) => (
                    <Link
                      key={chapter.chapterNo}
                      href={chapter.href}
                      className="group rounded-[22px] border border-border/40 bg-muted/20 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card/80 hover:shadow-[0_8px_32px_hsl(var(--primary)/0.06)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                          Chapter {chapter.chapterNo}
                        </span>
                        <span className="rounded-full border border-border/40 bg-muted/40 px-3 py-1 text-[10px] font-bold text-muted-foreground/70">
                          {chapter.segmentCount} segments
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-bold text-foreground">{chapter.title}</h2>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {chapter.hasContent ? "Ready to enter" : "No note segments yet"}
                        </span>
                        <span className="font-semibold text-primary transition group-hover:-translate-x-0.5">
                          Open
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
