/**
 * GET /api/local-first/sync/pull?since=<clock>
 * ─────────────────────────────────────────────────────────────────────────────
 * Delta pull endpoint. Returns changes newer than the client's last-pulled
 * clock plus an updated clock value to store for the next tick.
 *
 * Shape (response):
 *   { clock: string | null, entities?: Record<string, unknown> }
 *
 * This is a minimal stub for Phase 6 — it returns an advancing wall-clock
 * marker and an empty entities map. Real dispatch per entityType is wired
 * incrementally as each entity's server-side store is extended.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  void _req;
  // Advance the clock monotonically so the client-side "lastPulledClock"
  // meta row updates on every tick even before real entities are wired.
  return NextResponse.json({
    clock: new Date().toISOString(),
    entities: {},
  });
}
