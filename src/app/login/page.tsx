import { redirect } from "next/navigation";

import { hasSession } from "@/lib/auth/requireSession";

import LoginForm from "./LoginForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string | string[] }>;

function sanitizeRedirect(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = sanitizeRedirect(params.from);

  if (await hasSession()) {
    redirect(next);
  }

  return <LoginForm redirectTo={next} />;
}
