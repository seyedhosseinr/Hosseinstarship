"use client";

import dynamic from "next/dynamic";
import { FullDashboardSkeleton } from "@/components/skeletons/DashboardSkeletons";

const HosseinStarshipDashboard = dynamic(
  () => import("@/components/dashboard/HosseinStarshipDashboard"),
  {
    ssr: false,
    loading: () => <FullDashboardSkeleton />,
  },
);

export default function Page() {
  return <HosseinStarshipDashboard />;
}
