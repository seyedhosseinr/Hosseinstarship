import Link from "next/link";

import { getDataSettingsSnapshot } from "@/lib/settings/data-queries";

export const dynamic = "force-dynamic";

function metricLabel(label: string, value: number) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value.toLocaleString()}</p>
    </div>
  );
}

export default async function DataSettingsPage() {
  const snapshot = await getDataSettingsSnapshot();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
      <section className="rounded-3xl border border-border bg-card/70 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Settings / Data</p>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">Runtime and study data</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              This page reflects the supported data surface only. Unsupported admin, backup, and
              migration flows remain intentionally unavailable in the current hosted/offline build.
            </p>
          </div>
          <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <p className="font-medium uppercase tracking-[0.18em]">{snapshot.runtime}</p>
            <p className="mt-1 text-success/90">{snapshot.storageLabel}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metricLabel("Chapters", snapshot.counts.chapters)}
        {metricLabel("Documents", snapshot.counts.documents)}
        {metricLabel("Flashcards", snapshot.counts.flashcards)}
        {metricLabel("Flashcards due", snapshot.counts.dueFlashcards)}
        {metricLabel("Active plans", snapshot.counts.activePlans)}
        {metricLabel("Queued planner tasks", snapshot.counts.queuedPlannerTasks)}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="text-lg font-semibold text-foreground">Supported product slices</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {snapshot.supportedSlices.map((slice) => (
              <span
                key={slice.key}
                className="rounded-full border border-border bg-muted px-3 py-1 text-sm text-foreground"
              >
                {slice.label}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/library"
              className="rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground transition hover:bg-card"
            >
              Open library
            </Link>
            <Link
              href="/flashcards"
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-border/60 hover:bg-muted"
            >
              Open flashcards
            </Link>
            <Link
              href="/planner"
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-border/60 hover:bg-muted"
            >
              Open planner
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="text-lg font-semibold text-foreground">Unavailable operations</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {snapshot.unavailableOperations.map((item) => (
              <li key={item} className="rounded-2xl border border-border bg-muted px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            These paths stay disabled until they are migrated to the shared PGlite + OPFS runtime.
          </p>
        </div>
      </section>
    </div>
  );
}
