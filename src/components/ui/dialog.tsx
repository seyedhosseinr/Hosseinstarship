"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode; }

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [io, setIo] = React.useState(false);
  const isOpen = open ?? io;
  const setOpen = onOpenChange ?? setIo;
  return <>{React.Children.map(children, (child) => React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { __open: isOpen, __setOpen: setOpen }) : child)}</>;
}

function DialogTrigger({ children, __setOpen, ...props }: any) {
  return <span onClick={() => __setOpen?.(true)} {...props}>{children}</span>;
}

function DialogContent({ children, className, __open, __setOpen, ...props }: any) {
  if (!__open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80" onClick={() => __setOpen?.(false)} />
      <div className={cn("fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-2xl", className)} {...props}>
        {children}
        <button onClick={() => __setOpen?.(false)} className="absolute left-4 top-4 rounded-sm opacity-70 hover:opacity-100">
          <X className="h-4 w-4" /><span className="sr-only">Close</span>
        </button>
      </div>
    </>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-right", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 sm:space-x-reverse", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

const DialogOverlay = () => null;
const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const DialogClose = ({ children, ...props }: any) => <span {...props}>{children}</span>;

export { Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
