"use client";

/**
 * RescheduleDialog — a simple modal to pick a new date for a task.
 *
 * Uses rescheduleTaskAction to move the task to the chosen date.
 */

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CalendarDays, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Surface } from "@/components/ui/surface";
import { C } from "./planner-tokens";
import { rescheduleTaskAction } from "@/lib/actions/planner-runtime-actions";
import { isLocalFirstEnabled } from "@/lib/local-first/flag";
import { rescheduleTask as lfReschedule } from "@/lib/local-first/planner-local";

interface RescheduleDialogProps {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

export function RescheduleDialog({ open, taskId, onClose, onDone }: RescheduleDialogProps) {
  const [targetDate, setTargetDate] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset the target date each time the dialog opens
  useEffect(() => {
    if (open) setTargetDate("");
  }, [open]);

  function handleSubmit() {
    if (!taskId || !targetDate) return;
    startTransition(async () => {
      if (isLocalFirstEnabled()) {
        try {
          await lfReschedule(taskId, targetDate);
          toast.success("تسک به تاریخ جدید منتقل شد");
          onDone?.();
          onClose();
          return;
        } catch { /* Dexie unavailable — fall through to server */ }
      }
      const res = await rescheduleTaskAction(taskId, targetDate);
      if (res.ok) {
        toast.success("تسک به تاریخ جدید منتقل شد");
        onDone?.();
        onClose();
      } else {
        if (res.error.code === "NOT_FOUND") {
          toast.error("این تسک دیگر وجود ندارد");
          onClose();
          onDone?.();
        } else {
          toast.error(res.error.message);
        }
      }
    });
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed z-50 inset-x-4 bottom-4 top-auto max-w-sm mx-auto
                       sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
          >
            <Surface variant="elevated" padding="lg" className="rounded-2xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarDays size={18} style={{ color: C.accent }} />
                  <h2 className="text-sm font-bold" style={{ color: C.text }}>
                    تغییر تاریخ تسک
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X size={16} style={{ color: C.textMuted }} />
                </button>
              </div>

              <div className="mb-4">
                <label
                  className="text-xs font-medium mb-1.5 block"
                  style={{ color: C.text }}
                >
                  تاریخ جدید
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    borderColor: C.border,
                    color: C.text,
                    backgroundColor: C.surface,
                  }}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!targetDate || isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                           transition-colors flex items-center justify-center gap-2
                           disabled:opacity-50"
                style={{ backgroundColor: C.accent }}
              >
                {isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    انتقال
                    <ArrowLeft size={14} />
                  </>
                )}
              </button>
            </Surface>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
