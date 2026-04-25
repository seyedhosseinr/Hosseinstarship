"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card variant="glass" className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Ø®Ø·Ø§ÛŒÛŒ Ø±Ø® Ø¯Ø§Ø¯Ù‡ Ø§Ø³Øª</h2>
            <p className="text-muted-foreground text-sm">
              Ù…ØªØ§Ø³ÙØ§Ù†Ù‡ Ù…Ø´Ú©Ù„ÛŒ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ø§ÛŒÙ† ØµÙØ­Ù‡ Ù¾ÛŒØ´ Ø¢Ù…Ø¯Ù‡.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                Ú©Ø¯ Ø®Ø·Ø§: {error.digest}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} variant="default" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              ØªÙ„Ø§Ø´ Ù…Ø¬Ø¯Ø¯
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Ø¨Ø§Ø²Ú¯Ø´Øª Ø¨Ù‡ Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}