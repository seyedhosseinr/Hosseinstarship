import { NextResponse } from "next/server";
import { getMonthlyActivityLite } from "@/lib/dashboard/lite-queries";

export async function GET(request: Request) {
  try {
    const search = new URL(request.url).searchParams;
    const now = new Date();
    const year = Number(search.get("year")) || now.getFullYear();
    const month = Number(search.get("month")) || now.getMonth() + 1;

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ activity: [] }, { status: 400 });
    }

    const activity = await getMonthlyActivityLite({ year, month });

    return NextResponse.json({
      activity,
      year,
      month,
    });
  } catch {
    return NextResponse.json({ activity: [] }, { status: 200 });
  }
}
