"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  VoiceInputEngine,
  type VoiceConfig,
  type VoiceResult,
  type VoiceStatus,
  type VoiceLanguage,
} from "@/lib/voice/speech-recognition";

interface UseVoiceInputOptions {
  language?: VoiceLanguage;
  continuous?: boolean;
  onResult?: (result: VoiceResult) => void;
  onError?: (error: string) => void;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  status: VoiceStatus;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  setLanguage: (lang: VoiceLanguage) => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [confidence, setConfidence] = useState(0);

  const engineRef = useRef<VoiceInputEngine | null>(null);

  useEffect(() => {
    const engine = new VoiceInputEngine(
      {
        language: options.language || "fa-IR",
        continuous: options.continuous ?? false,
        interimResults: true,
        maxAlternatives: 1,
      },
      {
        onResult: (result) => {
          setTranscript((prev) => (prev ? prev + " " + result.transcript : result.transcript));
          setInterimTranscript("");
          setConfidence(result.confidence);
          options.onResult?.(result);
        },
        onInterim: (text) => {
          setInterimTranscript(text);
        },
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
          setIsListening(newStatus === "listening");
        },
        onError: (error) => {
          options.onError?.(error);
        },
        onEnd: () => {
          setIsListening(false);
          setInterimTranscript("");
        },
      }
    );

    engineRef.current = engine;
    setIsSupported(engine.isSupported);

    return () => {
      engine.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(() => {
    engineRef.current?.start();
  }, []);

  const stopListening = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  const toggleListening = useCallback(() => {
    if (engineRef.current?.isListening) {
      engineRef.current.stop();
    } else {
      engineRef.current?.start();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setConfidence(0);
  }, []);

  const setLanguage = useCallback((lang: VoiceLanguage) => {
    engineRef.current?.setLanguage(lang);
  }, []);

  return {
    isListening,
    isSupported,
    status,
    transcript,
    interimTranscript,
    confidence,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setLanguage,
  };
}