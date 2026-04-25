"use client";

import { useState, useRef, useEffect } from "react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Loader2, X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { type VoiceLanguage } from "@/lib/voice";
import { toast } from "sonner";

interface VoiceTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  language?: VoiceLanguage;
  rows?: number;
  label?: string;
}

const LANGUAGES: { value: VoiceLanguage; label: string; flag: string }[] = [
  { value: "fa-IR", label: "فارسی", flag: "🇮🇷" },
  { value: "en-US", label: "English", flag: "🇺🇸" },
  { value: "ar-SA", label: "العربیة", flag: "🇸🇦" },
];

export function VoiceTextInput({
  value,
  onChange,
  placeholder = "تایپ کنید یا از میکروفون استفاده کنید...",
  className,
  language: initialLang = "fa-IR",
  rows = 3,
  label,
}: VoiceTextInputProps) {
  const [selectedLang, setSelectedLang] = useState<VoiceLanguage>(initialLang);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isListening,
    isSupported,
    status,
    interimTranscript,
    toggleListening,
    setLanguage,
  } = useVoiceInput({
    language: selectedLang,
    continuous: true,
    onResult: (result) => {
      onChange(value ? value + " " + result.transcript : result.transcript);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const handleLanguageChange = (lang: VoiceLanguage) => {
    setSelectedLang(lang);
    setLanguage(lang);
    setShowLangSelector(false);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-sm font-bold">{label}</label>
      )}

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={isListening && interimTranscript ? value + " " + interimTranscript : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          dir="auto"
          className={cn(
            "w-full rounded-xl border bg-background/50 p-3 pl-24 text-sm resize-none",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
            isListening && "ring-2 ring-destructive/50 border-destructive/30"
          )}
        />

        {/* Controls */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
          {/* Language selector */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowLangSelector(!showLangSelector)}
              title="انتخاب زبان"
            >
              <Globe className="h-3.5 w-3.5" />
            </Button>
            {showLangSelector && (
              <div className="absolute bottom-full left-0 mb-1 bg-popover border rounded-lg shadow-lg p-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.value}
                    onClick={() => handleLanguageChange(lang.value)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-xs rounded-md hover:bg-accent transition-colors",
                      selectedLang === lang.value && "bg-accent"
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mic button */}
          {isSupported ? (
            <Button
              type="button"
              variant={isListening ? "destructive" : "ghost"}
              size="icon"
              className={cn(
                "h-7 w-7 transition-all",
                isListening && "animate-pulse"
              )}
              onClick={toggleListening}
            >
              {status === "processing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled>
              <MicOff className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Listening indicator */}
        {isListening && (
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" size="sm" className="animate-pulse text-[10px]">
              🔴 ضبط
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}