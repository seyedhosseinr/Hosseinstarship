/**
 * /import/media — Phase 3 chapter media bundle importer.
 *
 * Standalone page for the legacy / non-Edge media import flow. Mounts
 * the <MediaBundleImporter /> client component. Edge / V3 importer is
 * unaffected — it remains at /import.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MediaBundleImporter } from "@/components/starship-media/MediaBundleImporter";

export const dynamic = "force-dynamic";

export default function MediaBundleImportPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/import"
        className="mb-4 inline-flex items-center gap-1 text-sm text-lib-text-muted hover:text-lib-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Import
      </Link>
      <MediaBundleImporter />
    </div>
  );
}
