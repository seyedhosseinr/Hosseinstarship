import { NextResponse } from "next/server";
import { getAppShellContext } from "@/lib/app-shell/queries";
import { SUPPORTED_RUNTIME_CAPABILITIES } from "@/lib/runtime/capabilities";

export async function GET() {
  try {
    const context = await getAppShellContext();
    return NextResponse.json(context);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "App shell context is unavailable.",
        capabilities: SUPPORTED_RUNTIME_CAPABILITIES,
      },
      { status: 503 },
    );
  }
}
