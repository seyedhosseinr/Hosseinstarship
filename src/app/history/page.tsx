import Link from "next/link";
import { ArrowLeft, Clock3, FileText, PauseCircle, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getHistoryLightSnapshot } from "@/lib/history/queries";

export const dynamic = "force-dynamic";

function formatDate(value: number | null) {
  if (!value) return "Not completed";

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="rounded-full bg-success/10 text-success hover:bg-success/10 dark:bg-success/15 dark:text-success dark:hover:bg-success/20">Completed</Badge>;
    case "active":
      return <Badge className="rounded-full bg-info/10 text-info hover:bg-info/10 dark:bg-info/15 dark:text-info dark:hover:bg-info/20">Active</Badge>;
    case "paused":
    case "suspended":
      return <Badge className="rounded-full bg-warning/10 text-warning hover:bg-warning/10 dark:bg-warning/15 dark:text-warning dark:hover:bg-warning/20">Paused</Badge>;
    case "abandoned":
      return <Badge className="rounded-full bg-danger/10 text-danger hover:bg-danger/10 dark:bg-danger/15 dark:text-danger dark:hover:bg-danger/20">Abandoned</Badge>;
    default:
      return (
        <Badge variant="secondary" className="rounded-full">
          {status}
        </Badge>
      );
  }
}

export default async function Page() {
  const snapshot = await getHistoryLightSnapshot();

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="rounded-[32px] border border-border/40 bg-card/70 px-8 py-8 shadow-sm backdrop-blur-xl dark:bg-card/40">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Link href="/" className="inline-flex items-center gap-2 transition hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span>&bull;</span>
            <span>History</span>
          </div>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Hosted exam history</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Recent exam sessions on the shared runtime
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                History is now available as a read-only surface. Resume, analysis, and review flows stay gated
                until the exam runtime itself is fully migrated.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/planner">Open Planner</Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link href="/settings/data">Runtime Status</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-border/30 bg-muted/30 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Shown</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{snapshot.counts.total}</div>
            </div>
            <div className="rounded-2xl bg-success/10 px-4 py-3 dark:bg-success/15">
              <div className="text-xs uppercase tracking-[0.16em] text-success">Completed</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-success">{snapshot.counts.completed}</div>
            </div>
            <div className="rounded-2xl bg-info/10 px-4 py-3 dark:bg-info/15">
              <div className="text-xs uppercase tracking-[0.16em] text-info">Active</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-info">{snapshot.counts.active}</div>
            </div>
            <div className="rounded-2xl bg-warning/10 px-4 py-3 dark:bg-warning/15">
              <div className="text-xs uppercase tracking-[0.16em] text-warning">Paused</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-warning">{snapshot.counts.paused}</div>
            </div>
            <div className="rounded-2xl bg-danger/10 px-4 py-3 dark:bg-danger/15">
              <div className="text-xs uppercase tracking-[0.16em] text-danger">Abandoned</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-danger">{snapshot.counts.abandoned}</div>
            </div>
          </div>
        </header>

        <section className="rounded-[32px] border border-border/40 bg-card/70 px-8 py-6 shadow-sm backdrop-blur-xl dark:bg-card/40">
          <div className="flex flex-col gap-3 border-b border-border/40 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Read-only timeline</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Latest hosted sessions</h2>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              We only expose stable summary data here. Actions that would hand off into the legacy exam runtime remain disabled on purpose.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {snapshot.sessions.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-border bg-muted/30 px-5 py-10 text-center text-sm text-muted-foreground">
                No exam sessions have been recorded on the shared runtime yet.
              </div>
            ) : (
              snapshot.sessions.map((session) => (
                <Card
                  key={session.id}
                  className="rounded-[26px] border-border/40 bg-muted/30 p-5 transition hover:-translate-y-0.5 hover:border-primary/25 hover:bg-card dark:bg-muted/20"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusBadge(session.status)}
                        <Badge variant="outline" className="rounded-full uppercase">
                          {session.mode}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {session.title?.trim() || "Untitled exam session"}
                        </h3>
                        <p className="text-sm leading-7 text-muted-foreground">
                          {session.totalCorrect} correct, {session.totalIncorrect} incorrect, {session.totalOmitted} omitted
                          {" "}across {session.totalQuestions} questions.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4" />
                          {formatDuration(session.elapsedSeconds)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Started {formatDate(session.startedAt)}
                        </span>
                        {session.status === "paused" || session.status === "suspended" ? (
                          <span className="inline-flex items-center gap-2">
                            <PauseCircle className="h-4 w-4" />
                            Awaiting full exam migration
                          </span>
                        ) : null}
                        {session.status === "active" ? (
                          <span className="inline-flex items-center gap-2">
                            <PlayCircle className="h-4 w-4" />
                            Resume stays gated for now
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
                      <div className="rounded-2xl bg-card px-4 py-3 text-right shadow-sm">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Score</div>
                        <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                          {session.scorePercent == null ? "In progress" : `${session.scorePercent}%`}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-card px-4 py-3 text-right shadow-sm">
                        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Completed</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{formatDate(session.completedAt)}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
