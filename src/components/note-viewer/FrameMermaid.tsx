"use client";

/**
 * FrameMermaid (v8.2)
 *
 * Renders a Mermaid diagram from the `code` string. The pipeline is:
 *
 *   1. Server + first client render emit a <pre> showing the Mermaid source
 *      (identical HTML on both sides — no hydration mismatch).
 *   2. On mount, useEffect dynamically imports `mermaid`, renders to SVG,
 *      and swaps the <pre> for the SVG when successful.
 *   3. Any failure path (module missing, parse error, async throw) leaves
 *      the <pre> in place and surfaces a small muted error chip. The page
 *      continues to function; one bad diagram never crashes the reader.
 *
 * Offline: no network fetches (mermaid renders fully client-side). The
 * module is imported lazily so pages that don't use diagrams don't pay
 * the cost.
 *
 * Anchoring: this component is PRESENTATIONAL only. The canonical text
 * backbone lives in `frame.content` / `frame.body`, not in the diagram.
 */

import React, { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, GitBranch } from "lucide-react";

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

// Single shared promise so mermaid only imports + initializes once per tab.
let mermaidPromise: Promise<MermaidApi | null> | null = null;
function loadMermaid(): Promise<MermaidApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!mermaidPromise) {
    // Variable-based specifier + @vite-ignore makes the dynamic import
    // opaque to bundler static analyzers. Keeps the component usable in
    // environments where `mermaid` is not yet installed (tests pre-install)
    // without breaking dev/prod bundling once it IS installed.
    const specifier = "mermaid";
    mermaidPromise = import(/* @vite-ignore */ specifier)
      .then((mod: unknown) => {
        const m = mod as { default?: MermaidApi } & MermaidApi;
        const api: MermaidApi | null = m?.default ?? (m as MermaidApi);
        if (!api || typeof api.render !== "function") return null;
        try {
          api.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "default",
            fontFamily:
              "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            // Mermaid's internal layout is LTR — the container can be RTL around it.
            // Declaring EN here keeps diagram internals predictable.
            flowchart: { htmlLabels: true, curve: "basis" },
          });
          return api;
        } catch {
          return null;
        }
      })
      .catch(() => null);
  }
  return mermaidPromise;
}

interface FrameMermaidProps {
  code: string;
}

// Inner renderer: attempts SVG; shows <pre> fallback if anything goes wrong.
function FrameMermaidInner({ code }: FrameMermaidProps) {
  // useId gives a stable id across SSR + CSR → safe for mermaid.render's DOM id.
  const reactId = useId();
  const safeId = `mmd-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
    let cancelled = false;

    (async () => {
      const api = await loadMermaid();
      if (cancelled) return;

      if (!api) {
        // Module failed to load — stay on <pre> fallback, silent (expected
        // state when dep isn't installed yet). Not an error.
        return;
      }

      try {
        const { svg: rendered } = await api.render(`${safeId}-svg`, codeRef.current);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "mermaid render failed");
          setSvg(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, safeId]);

  const hasSvg = svg !== null;

  return (
    <div
      className="mt-4 overflow-hidden rounded-lib-md border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30"
      data-mermaid-state={error ? "error" : hasSvg ? "svg" : "source"}
    >
      <div className="flex items-center justify-between gap-2 border-b border-violet-200 bg-violet-100/60 px-4 py-2 dark:border-violet-800 dark:bg-violet-900/30">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            Diagram
          </span>
        </div>
        {error && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            source shown
          </span>
        )}
      </div>

      {hasSvg ? (
        // Mermaid's SVG is trusted output from the library. The library's
        // `securityLevel: "strict"` sanitizes user text inside the diagram.
        // Container is LTR-forced so graph coordinates aren't flipped in RTL pages.
        <div
          dir="ltr"
          className="overflow-x-auto px-4 py-4 [&>svg]:max-w-full [&>svg]:h-auto"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg! }}
        />
      ) : (
        <pre
          dir="ltr"
          className="overflow-x-auto px-4 py-3 font-mono text-xs leading-6 text-violet-900 dark:text-violet-200"
        >
          {code}
        </pre>
      )}
    </div>
  );
}

// Per-diagram error boundary — one bad block can never take down the reader.
interface FrameMermaidBoundaryState {
  hasError: boolean;
}

class FrameMermaidBoundary extends Component<
  { code: string; children: ReactNode },
  FrameMermaidBoundaryState
> {
  state: FrameMermaidBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FrameMermaidBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    // swallow — user-visible fallback is rendered below
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mt-4 overflow-hidden rounded-lib-md border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30">
          <div className="flex items-center justify-between gap-2 border-b border-violet-200 bg-violet-100/60 px-4 py-2 dark:border-violet-800 dark:bg-violet-900/30">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Diagram
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-3 w-3" />
              source shown
            </span>
          </div>
          <pre
            dir="ltr"
            className="overflow-x-auto px-4 py-3 font-mono text-xs leading-6 text-violet-900 dark:text-violet-200"
          >
            {this.props.code}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function FrameMermaid({ code }: FrameMermaidProps) {
  const trimmed = typeof code === "string" ? code.trim() : "";
  if (!trimmed) return null;
  return (
    <FrameMermaidBoundary code={trimmed}>
      <FrameMermaidInner code={trimmed} />
    </FrameMermaidBoundary>
  );
}
