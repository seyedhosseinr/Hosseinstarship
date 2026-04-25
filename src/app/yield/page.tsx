import type { Metadata } from "next";
import { getAllYieldByChapter } from "@/lib/yield/queries";
import { YieldPageShell } from "@/components/yield/YieldPageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yield Review",
  description: "High-yield annotations grouped by chapter and semantic section.",
};

export default async function YieldPage() {
  const chapters = await getAllYieldByChapter();

  return (
    <div className="min-h-screen">
      <YieldPageShell chapters={chapters} />
    </div>
  );
}
