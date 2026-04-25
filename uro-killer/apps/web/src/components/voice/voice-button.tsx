"use client";

import { useVoiceInput } from "@/hooks/use-voice-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type VoiceLanguage } from "@/lib/voice";
import { toast } from "sonner";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  language?: VoiceLanguage;
  className?: string;
  size?: "sm" | "default" | "lg" | "icon";
  showStatus?: boolean;
  continuous?: boolean;
}

export function VoiceButton({
  onTranscript,
  language = "fa-IR",
  className,
  size = "icon",
  showStatus = false,
  continuous = false,
}: VoiceButtonProps) {
  const {
    isListening,
    isSupported,
    status,
    transcript,
    interimTranscript,
    toggleListening,
    resetTranscript,
  } = useVoiceInput({
    language,
    continuous,
    onResult: (result) => {
      onTranscript(result.transcript);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  if (!isSupported) {
    return (
      <Button
        variant="ghost"
        size={size}
        disabled
        className={cn("text-muted-foreground", className)}
        title="مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند"
      >
        <MicOff className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <Button
        variant={isListening ? "destructive" : "outline"}
        size={size}
        onClick={toggleListening}
        className={cn(
          "relative transition-all duration-300",
          isListening && "animate-pulse shadow-lg shadow-destructive/25",
          className
        )}
        title={isListening ? "توقف ضبط صدا" : "شروع ضبط صدا"}
      >
        {status === "processing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isListening ? (
          <>
            <Mic className="h-4 w-4" />
            {/* Ripple effect */}
            <span className="absolute inset-0 rounded-md">
              <span className="absolute inset-0 rounded-md animate-ping bg-destructive/20" />
            </span>
          </>
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* Live transcription badge */}
      {showStatus && isListening && (interimTranscript || transcript) && (
        <Badge
          variant="outline"
          className="absolute -top-8 right-0 text-xs max-w-[200px] truncate animate-in fade-in slide-in-from-bottom-2"
        >
          {interimTranscript || "در حال گوش دادن..."}
        </Badge>
      )}
    </div>
  );
}