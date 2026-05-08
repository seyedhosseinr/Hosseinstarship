import type { FrameViewModel } from "@/lib/contract/note-viewer.types";
import type { CalloutV8 } from "@/lib/contract/note-v8.types";

const DUPLICATE_MIN_CHARS = 18;

export function normalizeComparableText(text: string | null | undefined): string {
  if (!text) return "";

  return text
    .replace(/\*\*|`|~~|_/g, "")
    .replace(/^\s*-+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isDuplicateText(
  secondary: string | null | undefined,
  primary: string | null | undefined,
): boolean {
  const s = normalizeComparableText(secondary);
  const p = normalizeComparableText(primary);

  if (!s || !p) return false;
  if (s === p) return true;
  if (s.length >= DUPLICATE_MIN_CHARS && p.includes(s)) return true;
  if (p.length >= DUPLICATE_MIN_CHARS && s.includes(p)) return true;

  return false;
}

function normalizeCalloutsForRender(
  callouts: CalloutV8[] | null | undefined,
  body: string | null | undefined,
): CalloutV8[] | null {
  if (!callouts?.length) return null;

  const filtered = callouts.filter((callout) => !isDuplicateText(callout.text, body));

  return filtered.length > 0 ? filtered : null;
}

export function normalizeFrameForRender(frame: FrameViewModel): FrameViewModel {
  const body = frame.content || frame.body;

  const normalizedCallouts = normalizeCalloutsForRender(
    frame.v8Display?.callouts,
    body,
  );

  const isPearlDuplicateOfCallouts =
    normalizedCallouts?.some((callout) =>
      isDuplicateText(frame.clinicalPearl, callout.text),
    ) ?? false;

  const normalizedClinicalPearl =
    isDuplicateText(frame.clinicalPearl, body) || isPearlDuplicateOfCallouts
      ? undefined
      : frame.clinicalPearl;

  return {
    ...frame,
    summary: isDuplicateText(frame.summary, body) ? null : frame.summary,
    clinicalPearl: normalizedClinicalPearl,
    marginNote: isDuplicateText(frame.marginNote, body) ? null : frame.marginNote,
    v8Display: frame.v8Display
      ? {
          ...frame.v8Display,
          callouts: normalizedCallouts,
        }
      : undefined,
  };
}
