"use client";

import React, { type ReactNode } from "react";
import { detectMediaRefs } from "@/lib/starship-media/detectMediaRefs";
import { useMediaRefRenderScope } from "./MediaRefContext";
import { MediaRefAnchor } from "./MediaRefAnchor";

interface MediaLeafProps {
  text: string;
}

/**
 * A text leaf that linkifies media references when (and only when) a
 * <MediaRefProvider> + <MediaRefSegmentScope> are mounted upstream.
 *
 * Hot path: when no provider is mounted, this component returns the
 * raw text fragment with no allocations beyond the JSX wrapper itself.
 * The provider is opt-in behind NEXT_PUBLIC_STARSHIP_MEDIA_READER, so
 * non-Reader surfaces (exam, note-viewer, generator preview) pay only
 * a single useContext lookup per leaf.
 */
function MediaLeafImpl({ text }: MediaLeafProps) {
  const scope = useMediaRefRenderScope();
  if (!scope?.enabled || !text) {
    return <>{text}</>;
  }
  const refs = detectMediaRefs(text);
  if (refs.length === 0) {
    return <>{text}</>;
  }

  const out: ReactNode[] = [];
  let cursor = 0;
  refs.forEach((ref, i) => {
    if (ref.start > cursor) {
      out.push(
        <React.Fragment key={`t${i}`}>
          {text.slice(cursor, ref.start)}
        </React.Fragment>,
      );
    }
    out.push(
      <MediaRefAnchor
        key={`a${i}`}
        ref={ref}
        chapterNo={scope.chapterNo}
        segmentId={scope.segmentId}
      />,
    );
    cursor = ref.end;
  });
  if (cursor < text.length) {
    out.push(
      <React.Fragment key="tail">{text.slice(cursor)}</React.Fragment>,
    );
  }
  return <>{out}</>;
}

export const MediaLeaf = React.memo(MediaLeafImpl);
