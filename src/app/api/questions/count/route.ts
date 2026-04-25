import { getDb } from "@/db/index";
import { questions } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const db = await getDb();
    const result = await db.select({ value: count() }).from(questions).where(eq(questions.isActive, 1));
    return NextResponse.json({ ok: true, count: result[0]?.value ?? 0 });
  } catch {
    return NextResponse.json({ ok: true, count: 0 });
  }
}
