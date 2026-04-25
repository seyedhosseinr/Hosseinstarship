"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImportError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = (error.message || "").toLowerCase();
  const isTimeout = message.includes("timeout") || message.includes("etimedout");
  const details = error.message?.trim() || "Unknown import route error.";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
      <div className="mb-4">
        <AlertTriangle className="h-12 w-12 text-danger" />
      </div>

      <h2 className="mb-2 text-xl font-semibold">{isTimeout ? "Import timed out" : "Import route failed"}</h2>
      <p className="mb-6 max-w-md text-center text-muted-foreground">
        {isTimeout
          ? "The batch import took too long to process. Retry after checking the batch size."
          : "The import route hit an unrecoverable error before the workspace could finish rendering."}
      </p>

      <div className="mb-6 w-full max-w-3xl rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-left text-sm text-danger">
        <p className="font-semibold text-danger">Underlying error</p>
        <p className="mt-2 break-words">{details}</p>
        {error.digest ? (
          <p className="mt-2 text-xs text-danger/80">Digest: {error.digest}</p>
        ) : null}
      </div>

      <Button onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}
