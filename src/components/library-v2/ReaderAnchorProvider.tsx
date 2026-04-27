"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_REFERENCE_LABEL,
  isSafeAnchorId,
  parseFrameSearchParams,
  readAnchorFromHash,
  scrollToReaderAnchor,
  type ReaderAnchorJumpOptions,
  type ReaderReferenceKind,
} from "@/lib/reader/anchor-bubble";

/**
 * Active bubble state: which block is being explained, what kind of source
 * triggered the jump, and an optional snippet to render. The DOM element is
 * captured at trigger time so the bubble can portal into it without
 * re-querying.
 */
export interface ActiveAnchorBubble {
  anchorId: string;
  el: HTMLElement;
  kind: ReaderReferenceKind;
  label: string;
  snippet?: string;
  /**
   * Bumped on every successful re-trigger so the bubble component can
   * restart its auto-dismiss timer even if the user re-clicks the same
   * source link without anything else changing.
   */
  nonce: number;
}

interface ReaderAnchorContextValue {
  bubble: ActiveAnchorBubble | null;
  jumpToAnchor: (anchorId: string, options: ReaderAnchorJumpOptions) => Promise<boolean>;
  dismissBubble: () => void;
}

const ReaderAnchorContext = createContext<ReaderAnchorContextValue | null>(null);

/**
 * Provider that owns the active inline-source-bubble state and exposes
 * `jumpToAnchor` for any descendant to coordinate scroll + highlight +
 * bubble in one call. Mount this once per Reader page (NOT app-globally),
 * around the scroll surface and the bubble.
 */
export function ReaderAnchorProvider({ children }: { children: ReactNode }) {
  const [bubble, setBubble] = useState<ActiveAnchorBubble | null>(null);
  const nonceRef = useRef(0);
  /**
   * Tracks the most recent anchor we wrote into `location.hash` ourselves,
   * so the `hashchange` listener (added by useHashAnchorJump) can ignore
   * its own echoes and avoid an infinite jump loop.
   */
  const selfHashRef = useRef<string | null>(null);

  const jumpToAnchor = useCallback(
    async (anchorId: string, options: ReaderAnchorJumpOptions): Promise<boolean> => {
      if (!isSafeAnchorId(anchorId)) return false;
      selfHashRef.current = anchorId;
      const ok = await scrollToReaderAnchor(anchorId, {
        ...options,
        onResolved: (el, opts) => {
          nonceRef.current += 1;
          setBubble({
            anchorId,
            el,
            kind: opts.kind,
            label: opts.label ?? DEFAULT_REFERENCE_LABEL[opts.kind],
            snippet: opts.snippet,
            nonce: nonceRef.current,
          });
        },
      });
      return ok;
    },
    [],
  );

  const dismissBubble = useCallback(() => {
    setBubble(null);
  }, []);

  // Auto-dismiss when the underlying element leaves the DOM (e.g. tab
  // switch unmounts the article) or scrolls fully out of view.
  useEffect(() => {
    if (!bubble) return;
    const el = bubble.el;
    if (!el.isConnected) {
      setBubble(null);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            setBubble((prev) => (prev?.anchorId === bubble.anchorId ? null : prev));
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [bubble]);

  const value = useMemo<ReaderAnchorContextValue>(
    () => ({ bubble, jumpToAnchor, dismissBubble }),
    [bubble, jumpToAnchor, dismissBubble],
  );

  return (
    <ReaderAnchorContext.Provider value={value}>
      {/* Expose selfHashRef to the consumer hook via context attachment. */}
      <SelfHashRefContext.Provider value={selfHashRef}>
        {children}
      </SelfHashRefContext.Provider>
    </ReaderAnchorContext.Provider>
  );
}

const SelfHashRefContext = createContext<React.MutableRefObject<string | null> | null>(null);

export function useReaderAnchor(): ReaderAnchorContextValue {
  const ctx = useContext(ReaderAnchorContext);
  if (!ctx) {
    throw new Error("useReaderAnchor must be used inside <ReaderAnchorProvider>");
  }
  return ctx;
}

/**
 * Deep-link consumer for the Reader. Runs once on mount and again on every
 * `hashchange`. Sources of jumps:
 *
 *   • `?frame=<id>&ref=<kind>` query params — typed source kind (e.g.
 *     flashcard "باز کردن منبع" link).
 *   • `#<frameId>` URL hash — falls back to `kind = "note-link"` since the
 *     hash alone doesn't encode the source.
 *
 * The `searchParams` argument is optional so ChapterReaderV2 (which has
 * no `?frame=` route param today) can call this without plumbing one in.
 */
export function useReaderDeepLink(searchParams?: URLSearchParams | null) {
  const { jumpToAnchor } = useReaderAnchor();
  const selfHashRef = useContext(SelfHashRefContext);

  // One-shot: query param wins over hash on first paint.
  useEffect(() => {
    const fromQuery = parseFrameSearchParams(searchParams ?? null);
    const initial = fromQuery
      ? fromQuery
      : (() => {
          const anchorId = readAnchorFromHash();
          return anchorId ? { anchorId, kind: "note-link" as ReaderReferenceKind } : null;
        })();
    if (!initial) return;
    const handle = requestAnimationFrame(() => {
      void jumpToAnchor(initial.anchorId, { kind: initial.kind });
    });
    return () => cancelAnimationFrame(handle);
    // Intentionally empty deps: this is one-shot on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live: respond to subsequent hashchange events (back/forward, paste, etc).
  // Skip echoes from our own replaceState by comparing against selfHashRef.
  useEffect(() => {
    const onHashChange = () => {
      const anchorId = readAnchorFromHash();
      if (!anchorId) return;
      if (selfHashRef && selfHashRef.current === anchorId) {
        // This is the hash WE just wrote during a jump; don't re-trigger.
        selfHashRef.current = null;
        return;
      }
      void jumpToAnchor(anchorId, { kind: "note-link" });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [jumpToAnchor, selfHashRef]);
}
