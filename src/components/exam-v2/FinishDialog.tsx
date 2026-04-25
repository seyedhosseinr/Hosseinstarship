"use client";

import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "./ConfirmButton";

export interface FinishDialogProps {
  open: boolean;
  total: number;
  answeredCount: number;
  markedCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function FinishDialog({
  open,
  total,
  answeredCount,
  markedCount,
  onCancel,
  onConfirm,
}: FinishDialogProps) {
  const unanswered = total - answeredCount;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55"
          onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            className="w-[90%] max-w-[420px] rounded-lib-lg bg-lib-surface p-8 shadow-[0_25px_60px_rgba(0,0,0,0.25)]"
          >
            <div className="mb-5 flex items-center gap-3">
              <AlertCircle size={28} className="text-lib-marked" />
              <h3 className="text-lg font-bold text-lib-text">End Block?</h3>
            </div>

            <div className="mb-5 flex gap-4">
              {[
                { label: "Answered", value: answeredCount, cls: "text-lib-correct" },
                { label: "Unanswered", value: unanswered, cls: unanswered > 0 ? "text-lib-incorrect" : "text-lib-text-muted" },
                { label: "Marked", value: markedCount, cls: "text-lib-marked" },
              ].map((item) => (
                <div key={item.label} className="flex-1 rounded-lib-sm bg-lib-hover p-3 text-center">
                  <div className={cn("text-[22px] font-extrabold", item.cls)}>{item.value}</div>
                  <div className="mt-0.5 text-[11px] text-lib-text-muted">{item.label}</div>
                </div>
              ))}
            </div>

            {unanswered > 0 && (
              <p className="mb-5 text-[13px] leading-relaxed text-lib-incorrect">
                {unanswered} question{unanswered > 1 ? "s" : ""} will be marked as omitted.
              </p>
            )}

            <div className="flex justify-end gap-2.5">
              <ConfirmButton variant="ghost" onClick={onCancel} className="border border-lib-border">
                Resume
              </ConfirmButton>
              <ConfirmButton variant="danger" onClick={onConfirm} className="bg-destructive text-destructive-foreground border-none hover:bg-destructive/90">
                End &amp; Submit
              </ConfirmButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
