"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { runBrowserMigrations } from "@/db/pglite-browser";
import { allMigrations } from "@/db/migrations/generated-migrations";
import OfflineAuthGate from "@/components/auth/OfflineAuthGate";

const PLAIN_LAYOUT_ROUTES = ["/space", "/ui-preview", "/login"];
const UNGATED_ROUTES = ["/login"];

export default function ShellGate({
  plain,
  shell,
}: {
  plain: React.ReactNode;
  shell: React.ReactNode;
}) {
  const pathname = usePathname();

  // Apply OPFS schema migrations once per browser session (version-gated inside).
  useEffect(() => {
    runBrowserMigrations(allMigrations).catch(() => {
      // Non-fatal: existing users keep working with their current schema.
      // The next app load will retry.
    });
  }, []);

  const usePlainLayout = PLAIN_LAYOUT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isUngated = UNGATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  const content = usePlainLayout ? plain : shell;

  if (isUngated) return <>{content}</>;
  return <OfflineAuthGate>{content}</OfflineAuthGate>;
}
