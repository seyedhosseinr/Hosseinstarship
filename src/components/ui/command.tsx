"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function Command({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="command"
      className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)}
      {...props}
    />
  );
}

function CommandDialog({
  children,
  className,
  open,
  onOpenChange,
  title: _title,
  description: _description,
  showCloseButton: _showCloseButton,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  showCloseButton?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("overflow-hidden p-0", className)} {...props}>
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div data-slot="command-input-wrapper" className="flex h-12 items-center gap-2 border-b border-border px-3">
      <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        data-slot="command-input"
        className={cn("h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="command-list" className={cn("max-h-[360px] overflow-y-auto p-1", className)} {...props} />;
}

function CommandEmpty(_props: React.HTMLAttributes<HTMLDivElement>) {
  return null;
}

function CommandGroup({ className, heading, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { heading?: React.ReactNode }) {
  return (
    <div data-slot="command-group" className={cn("p-1", className)} {...props}>
      {heading ? <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{heading}</div> : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CommandSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="command-separator" className={cn("my-1 h-px bg-border", className)} {...props} />;
}

function CommandItem({
  className,
  onSelect,
  onClick,
  children,
  ...props
}: React.HTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) {
  return (
    <button
      type="button"
      data-slot="command-item"
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-right text-sm outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.();
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span data-slot="command-shortcut" className={cn("mr-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
