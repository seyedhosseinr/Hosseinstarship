/**
 * Combines multiple HTML/text note segments into a single clean HTML document.
 *
 * Rules:
 * - Segments must be pre-sorted by segmentNo before calling this function.
 * - Each segment's inner <body> content is extracted when present.
 * - Full HTML documents are never naively concatenated.
 * - Segment boundaries are marked with invisible HTML comments.
 * - The result is ONE valid HTML document that can safely be stored as a chunk.
 */

export function combineNoteSegments(
  segments: Array<{ content: string; fileName: string; segmentNo: number }>,
): string {
  if (segments.length === 0) return "";
  if (segments.length === 1) {
    const only = segments[0];
    return wrapWithComment(
      extractBodyContent(only.content, only.fileName),
      segmentLabel(only.fileName, only.segmentNo),
    );
  }

  const parts: string[] = [];

  for (const seg of segments) {
    const label = segmentLabel(seg.fileName, seg.segmentNo);
    const bodyContent = extractBodyContent(seg.content, seg.fileName);
    parts.push(`<!-- segment: ${label} -->\n${bodyContent}`);
  }

  const combined = parts.join("\n\n");

  return `<!DOCTYPE html>\n<html>\n<body>\n${combined}\n</body>\n</html>`;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Extracts inner body content from an HTML string.
 * If no <body> tag is found, the raw content is returned as-is.
 * This prevents duplicate <html>/<head>/<body> tags in the merged output.
 */
function extractBodyContent(html: string, _fileName: string): string {
  // Try to extract content between <body ...> and </body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1].trim();
  }

  // No <body> tag found — check whether it looks like a full document
  // (has <html> or <head> tag). If so, strip the outer wrapper.
  if (/<html[^>]*>/i.test(html) || /<head[^>]*>/i.test(html)) {
    // Remove everything before and including the last opening structural tag
    return html
      .replace(/^[\s\S]*?<\/head>/i, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .trim();
  }

  // Plain HTML fragment or plain text — return as-is
  return html.trim();
}

/**
 * Derive a short label for a segment comment from the filename and segment number.
 * e.g. "149_01.html" + segmentNo=1 → "149_01"
 */
function segmentLabel(fileName: string, segmentNo: number): string {
  // Strip extension and use the bare filename (which already encodes chapter+segment)
  const bare = fileName.replace(/\.[^.]+$/, "");
  // If the filename already has the right shape (e.g. "149_01") use it
  if (/^\d+_\d+/.test(bare)) return bare;
  // Fallback: just include the segment number
  return `segment_${String(segmentNo).padStart(2, "0")}`;
}

function wrapWithComment(content: string, label: string): string {
  return `<!DOCTYPE html>\n<html>\n<body>\n<!-- segment: ${label} -->\n${content}\n</body>\n</html>`;
}
