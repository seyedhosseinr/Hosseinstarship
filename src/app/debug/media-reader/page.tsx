/**
 * Dev-only verification harness for the Phase 1 media-reference reader.
 *
 * Visit at /debug/media-reader (NODE_ENV=development only). Mounts the
 * real <MediaRefProvider> + <SegmentRenderer> stack with a synthetic
 * NoteViewerModel that contains every supported reference shape:
 *   - English: Figure 164.4, Fig. 164-4, Image 2, Table 5.2
 *   - Persian: تصویر ۲, شکل ۳
 *
 * No DB read. No importer. No schema change. Pure render-tree harness
 * for browser verification of the Phase-1 anchor + lightbox behavior.
 *
 * Toggle the feature flag at runtime via the localStorage override the
 * MediaRefProvider already supports — buttons on the page wire it.
 */
import { notFound } from "next/navigation";
import MediaReaderProbe from "./Probe";

export const dynamic = "force-dynamic";

export default function MediaReaderDebugPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <MediaReaderProbe />;
}
