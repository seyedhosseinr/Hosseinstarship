"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <main dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Alert variant="warning" className="max-w-xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <AlertTitle className="text-lg">داشبورد بارگذاری نشد</AlertTitle>
        <AlertDescription>
          این بازیابی به اینترنت وابسته نیست. اگر داده محلی یا OPFS لحظه‌ای آماده نشده، دوباره تلاش کنید یا به صفحه اصلی برگردید.
        </AlertDescription>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset} variant="clinical">
            <RefreshCw className="h-4 w-4" />
            تلاش دوباره
        </Button>
          <Button variant="outline" asChild>
          <Link href="/">
              <Home className="h-4 w-4" />
              خانه
          </Link>
        </Button>
      </div>
      </Alert>
    </main>
  );
}
