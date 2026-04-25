import {
  getCampbellNavigation,
  getCampbellVolumeSummaries,
  getLibraryDashboardData,
} from "@/lib/library/queries";
import { LinearLibraryView } from "@/components/library-linear/LinearLibraryView";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const [navigation, dashboard, volumes] = await Promise.all([
    getCampbellNavigation(),
    getLibraryDashboardData(),
    getCampbellVolumeSummaries(),
  ]);
  const renderedAt = Date.now();

  return (
    <LinearLibraryView
      navigation={navigation}
      dashboard={dashboard}
      volumes={volumes}
      renderedAt={renderedAt}
    />
  );
}
