import { notFound } from "next/navigation";
import { AlgorithmShell } from "@/components/algorithms/AlgorithmShell";
import { AlgorithmErrorState } from "@/components/algorithms/AlgorithmErrorState";
import { loadAlgorithmIR, isKnownSegmentId } from "@/lib/algorithms/algorithm-loader";

interface AlgorithmPageProps {
  params: Promise<{ segmentId: string }>;
}

export default async function AlgorithmPage({ params }: AlgorithmPageProps) {
  const { segmentId } = await params;
  const decoded = decodeURIComponent(segmentId);

  if (!isKnownSegmentId(decoded)) {
    notFound();
  }

  try {
    const ir = await loadAlgorithmIR(decoded);
    return <AlgorithmShell ir={ir} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطای ناشناخته";
    return <AlgorithmErrorState message={message} />;
  }
}

export function generateStaticParams() {
  return [{ segmentId: "96_01" }];
}

export const metadata = {
  title: "اطلس الگوریتمی | Hossein Starship",
};
