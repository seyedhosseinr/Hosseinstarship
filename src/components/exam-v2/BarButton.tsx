"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const BarButton = forwardRef<HTMLButtonElement, BarButtonProps>(
  ({ className, active, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-lib-sm",
        "min-h-touch min-w-touch p-2",
        "border-none bg-transparent text-lib-bar-muted",
        "transition-colors duration-lib-fade ease-lib-fade",
        "hover:bg-lib-hover active:bg-lib-active",
        "disabled:pointer-events-none disabled:opacity-40",
        "cursor-pointer select-none [-webkit-tap-highlight-color:transparent]",
        active && "bg-lib-accent-soft text-lib-accent",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
);
BarButton.displayName = "BarButton";
