"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center space-y-6" dir="auto">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            خطایی رخ داد
          </h2>
          <p className="text-sm max-w-sm mx-auto text-muted-foreground">
            متأسفانه مشکلی پیش آمد. لطفاً دوباره تلاش کنید.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" />
            تلاش مجدد
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors text-muted-foreground border border-border hover:bg-muted/50"
          >
            <Home className="h-4 w-4" />
            خانه
          </Link>
        </div>
      </div>
    </div>
  );
}
