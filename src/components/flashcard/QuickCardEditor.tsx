"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, FileQuestion, Layers, Type, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { checkCardQuality, type QualityCheck } from "@/lib/flashcard/quality-gate";

interface QuickCardEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (card: { front: string; back: string; type: string }) => Promise<void> | void;
  initialFront?: string;
  initialBack?: string;
  sourceType?: "selection" | "highlight" | "question" | "manual";
}

export function QuickCardEditor({
  isOpen,
  onClose,
  onSave,
  initialFront = "",
  initialBack = "",
  sourceType = "manual",
}: QuickCardEditorProps) {
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [cardType, setCardType] = useState<"basic" | "cloze">("basic");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFront(initialFront);
    setBack(initialBack);
  }, [initialBack, initialFront, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => frontRef.current?.focus(), 20);
  }, [isOpen]);

  const quality = useMemo<QualityCheck | null>(() => {
    if (!front.trim() || !back.trim()) return null;
    return checkCardQuality({
      front,
      back,
      source: sourceType === "question" ? "question" : cardType === "cloze" ? "cloze" : "highlight",
    });
  }, [back, cardType, front, sourceType]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        void handleSave();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleSave = async () => {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    try {
      await onSave({ front, back, type: cardType });
      setFront("");
      setBack("");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const detectCloze = () => {
    const selection = window.getSelection()?.toString().trim();
    if (!selection || !front.includes(selection)) return;
    setFront(front.replace(selection, `{{c1::${selection}}}`));
    setBack(selection);
    setCardType("cloze");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-3xl border-border/40 bg-card p-0 shadow-2xl">
        <div className="space-y-4 p-6">
          <DialogHeader className="text-left sm:text-left">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-info" />
                <DialogTitle>Quick Card</DialogTitle>
                <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-[0.16em]">
                  {sourceType}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={cardType === "basic" ? "default" : "outline"}
              size="sm"
              onClick={() => setCardType("basic")}
            >
              <Type className="mr-1 h-3 w-3" />
              Basic
            </Button>
            <Button
              variant={cardType === "cloze" ? "default" : "outline"}
              size="sm"
              onClick={() => setCardType("cloze")}
            >
              <FileQuestion className="mr-1 h-3 w-3" />
              Cloze
            </Button>
            <Button variant="ghost" size="sm" onClick={detectCloze}>
              <Wand2 className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Front {cardType === "cloze" ? "(use {{c1::text}} for cloze)" : ""}
              </label>
              <Textarea
                ref={frontRef}
                value={front}
                onChange={(event) => setFront(event.target.value)}
                className="min-h-[120px]"
                placeholder={cardType === "cloze" ? "The {{c1::kidney}} filters blood..." : "Question or prompt..."}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted-foreground">Back</label>
              <Textarea
                value={back}
                onChange={(event) => setBack(event.target.value)}
                className="min-h-[120px]"
                placeholder="Answer or explanation..."
              />
            </div>
          </div>

          {quality ? (
            <div
              className={`rounded-2xl border p-3 text-sm ${
                quality.passed ? "border-success/30 bg-success/10" : "border-warning/30 bg-warning/10"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {quality.passed ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
                Quality: {quality.score}/100
              </div>
              {quality.issues.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {quality.issues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Ctrl+Enter to save, Esc to cancel</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={!front.trim() || !back.trim() || saving}>
                <Check className="mr-1 h-4 w-4" />
                {saving ? "Creating..." : "Create Card"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
