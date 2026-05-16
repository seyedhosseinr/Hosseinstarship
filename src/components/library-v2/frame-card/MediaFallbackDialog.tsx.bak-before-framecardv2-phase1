"use client";

import React from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MediaFallbackDialog({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    if (!el.open) el.showModal();

    const onBackdropClick = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;

      if (outside) onClose();
    };

    el.addEventListener("click", onBackdropClick);
    return () => el.removeEventListener("click", onBackdropClick);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      data-reader-media-fallback="true"
      aria-label={label + " media reference"}
      className={cn(
        "m-auto w-full max-w-sm rounded-lib-lg border border-lib-border",
        "bg-lib-surface p-5 text-lib-text shadow-xl",
        "backdrop:bg-black/35 backdrop:backdrop-blur-sm",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lib-accent-soft text-lib-accent">
          <ImageIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{label}</div>
          <p className="mt-1 text-sm leading-6 text-lib-text-secondary">
            This image/media reference is not imported yet.
          </p>
        </div>

        <button
          type="button"
          aria-label="Close media reference"
          onClick={onClose}
          className="rounded-lib-sm p-1.5 text-lib-text-muted transition hover:bg-lib-hover hover:text-lib-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </dialog>
  );
}
