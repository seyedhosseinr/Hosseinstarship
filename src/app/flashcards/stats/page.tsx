import Link from "next/link";
import { ArrowLeft, BarChart3, Brain, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getManagedFlashcardStats } from "@/lib/services/flashcard-service";

export const dynamic = "force-dynamic";

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const ratingLabel: Record<1 | 2 | 3 | 4, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export default async function FlashcardStatsPage() {
  const stats = await getManagedFlashcardStats();

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-[32px] border border-border/40 bg-card/70 px-8 py-8 shadow-sm backdrop-blur-xl dark:bg-card/40">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Link href="/flashcards" className="inline-flex items-center gap-2 transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Flashcards
            </Link>
            <span>&bull;</span>
            <span>Stats</span>
          </div>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">SRS snapshot</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                A lightweight view of your current flashcard workload
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                This keeps the hosted and offline flashcard slice focused on real review state instead of broad analytics.
              </p>
            </div>

            <Link
              href="/flashcards/review"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Review due cards
              <Brain className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[28px] border-border/40 bg-card/70 p-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Brain className="h-5 w-5 text-success" />
              <span className="text-xs uppercase tracking-[0.18em]">Due now</span>
            </div>
            <div className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{stats.due}</div>
          </Card>
          <Card className="rounded-[28px] border-border/40 bg-card/70 p-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
            <div className="flex items-center gap-3 text-muted-foreground">
              <BarChart3 className="h-5 w-5 text-info" />
              <span className="text-xs uppercase tracking-[0.18em]">Reviewed</span>
            </div>
            <div className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{stats.reviewed}</div>
          </Card>
          <Card className="rounded-[28px] border-border/40 bg-card/70 p-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock3 className="h-5 w-5 text-warning" />
              <span className="text-xs uppercase tracking-[0.18em]">Recent 7d reviews</span>
            </div>
            <div className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{stats.recentReviewCount}</div>
          </Card>
          <Card className="rounded-[28px] border-border/40 bg-card/70 p-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Brain className="h-5 w-5 text-danger" />
              <span className="text-xs uppercase tracking-[0.18em]">Leech</span>
            </div>
            <div className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{stats.leech}</div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[30px] border-border/40 bg-card/70 p-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
            <h2 className="text-lg font-semibold text-foreground">State breakdown</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Total cards</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">New</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stats.newCount}</div>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Learning</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stats.learning}</div>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Suspended</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stats.suspended}</div>
              </div>
              <div className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Decks</div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{stats.deckCount}</div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] border-border/40 bg-card/70 p-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
            <h2 className="text-lg font-semibold text-foreground">Recent review log</h2>
            <div className="mt-5 space-y-3">
              {stats.recentActivity.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
                  No review events yet.
                </div>
              ) : (
                stats.recentActivity.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-border/40 bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">
                          {stripHtml(review.flashcardFrontHtml)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(review.reviewedAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {ratingLabel[review.rating]}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
