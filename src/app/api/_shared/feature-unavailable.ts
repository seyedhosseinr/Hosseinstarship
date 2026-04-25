import { NextResponse } from "next/server";

export function featureUnavailable(feature: string) {
  return NextResponse.json(
    {
      ok: false,
      code: "FEATURE_UNAVAILABLE",
      feature,
      message: `${feature} is not available in the current Postgres deployment slice.`,
    },
    { status: 503 },
  );
}
