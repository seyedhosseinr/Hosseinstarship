"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  );
}

function useTooltip() {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error("Tooltip components must be used inside Tooltip");
  return ctx;
}

function TooltipTrigger({
  children,
  asChild,
}: {
  children: React.ReactElement;
  asChild?: boolean;
}) {
  const tooltip = useTooltip();
  const triggerProps = {
    onMouseEnter: () => tooltip.setOpen(true),
    onMouseLeave: () => tooltip.setOpen(false),
    onFocus: () => tooltip.setOpen(true),
    onBlur: () => tooltip.setOpen(false),
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, triggerProps);
  }

  return <span {...triggerProps}>{children}</span>;
}

function TooltipContent({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const tooltip = useTooltip();
  if (!tooltip.open) return null;

  return (
    <div
      role="tooltip"
      className={cn(
        "absolute bottom-full left-1/2 z-50 mb-2 min-w-max -translate-x-1/2 rounded-lg border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
