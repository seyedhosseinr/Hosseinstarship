export function CRDTStatusBar({ segmentId }: { segmentId: string }) {
  return <div className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">Local Outliner sync - {segmentId}</div>;
}
