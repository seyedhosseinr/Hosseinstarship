"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export interface ConfirmButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost";
}

export function ConfirmButton({
  className,
  variant = "primary",
  children,
  ...props
}: ConfirmButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lib-md",
        "min-h-touch px-5 py-2 text-sm font-bold tracking-wide",
        "transition-all duration-lib-spring ease-lib-spring",
        "cursor-pointer select-none [-webkit-tap-highlight-color:transparent]",
        "disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-lib-accent text-white hover:brightness-110",
        variant === "danger" && "border border-lib-incorrect-border bg-transparent text-lib-incorrect hover:bg-lib-incorrect-bg",
        variant === "ghost" && "bg-transparent text-lib-bar-text hover:bg-lib-hover",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
