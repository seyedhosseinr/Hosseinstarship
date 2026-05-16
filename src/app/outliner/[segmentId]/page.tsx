import { OutlinerWorkspace } from "@/components/outliner/OutlinerWorkspace";

export const dynamic = "force-dynamic";

type Params = Promise<{ segmentId: string }>;

export default async function OutlinerSegmentPage({ params }: { params: Params }) {
  const { segmentId } = await params;
  return <OutlinerWorkspace initialSegmentId={segmentId} />;
}
