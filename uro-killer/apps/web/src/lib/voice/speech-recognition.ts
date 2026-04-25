/**
 * Voice Input Engine
 * 
 * Wraps the Web Speech API (SpeechRecognition) with a clean interface.
 * Supports Persian (fa-IR) and English (en-US) with real-time transcription.
 */

export type VoiceLanguage = "fa-IR" | "en-US" | "ar-SA";

export interface VoiceConfig {
  language: VoiceLanguage;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface VoiceResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  language: VoiceLanguage;
}

export type VoiceStatus = "idle" | "listening" | "processing" | "error" | "unsupported";

export interface VoiceCallbacks {
  onResult?: (result: VoiceResult) => void;
  onInterim?: (transcript: string) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: VoiceStatus) => void;
  onEnd?: () => void;
}

const DEFAULT_CONFIG: VoiceConfig = {
  language: "fa-IR",
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
};

export class VoiceInputEngine {
  private recognition: SpeechRecognition | null = null;
  private config: VoiceConfig;
  private callbacks: VoiceCallbacks;
  private _status: VoiceStatus = "idle";
  private _isSupported: boolean = false;

  constructor(config: Partial<VoiceConfig> = {}, callbacks: VoiceCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;

    // Check browser support
    const SpeechRecognitionAPI =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognitionAPI) {
      this._isSupported = true;
      this.recognition = new SpeechRecognitionAPI();
      this.setupRecognition();
    } else {
      this._isSupported = false;
      this.setStatus("unsupported");
    }
  }

  get isSupported(): boolean {
    return this._isSupported;
  }

  get status(): VoiceStatus {
    return this._status;
  }

  get isListening(): boolean {
    return this._status === "listening";
  }

  /**
   * Start voice recognition
   */
  start(): boolean {
    if (!this.recognition || !this._isSupported) {
      this.callbacks.onError?.("مرورگر شما از ورودی صوتی پشتیبانی نمی‌کند");
      return false;
    }

    if (this._status === "listening") {
      this.stop();
      return false;
    }

    try {
      this.recognition.start();
      this.setStatus("listening");
      return true;
    } catch (error) {
      // Already started or other error
      if ((error as Error).message?.includes("already started")) {
        this.stop();
      } else {
        this.setStatus("error");
        this.callbacks.onError?.("خطا در شروع تشخیص صدا");
      }
      return false;
    }
  }

  /**
   * Stop voice recognition
   */
  stop(): void {
    if (this.recognition && this._status === "listening") {
      this.recognition.stop();
      this.setStatus("processing");
    }
  }

  /**
   * Abort voice recognition immediately
   */
  abort(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.setStatus("idle");
    }
  }

  /**
   * Change recognition language
   */
  setLanguage(language: VoiceLanguage): void {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: Partial<VoiceCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.abort();
    this.recognition = null;
  }

  // ─── Private ────────────────────────────────────────────────

  private setupRecognition(): void {
    if (!this.recognition) return;

    const rec = this.recognition;
    rec.lang = this.config.language;
    rec.continuous = this.config.continuous;
    rec.interimResults = this.config.interimResults;
    rec.maxAlternatives = this.config.maxAlternatives;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcript;
          this.callbacks.onResult?.({
            transcript: transcript.trim(),
            confidence,
            isFinal: true,
            language: this.config.language,
          });
        } else {
          interimTranscript += transcript;
          this.callbacks.onInterim?.(interimTranscript);
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessages: Record<string, string> = {
        "no-speech": "صدایی تشخیص داده نشد",
        "audio-capture": "میکروفون در دسترس نیست",
        "not-allowed": "دسترسی به میکروفون رد شد",
        "network": "خطای شبکه در تشخیص صدا",
        "aborted": "تشخیص صدا لغو شد",
      };
      const msg = errorMessages[event.error] || `خطا: ${event.error}`;
      this.setStatus("error");
      this.callbacks.onError?.(msg);
    };

    rec.onend = () => {
      if (this._status === "listening") {
        // Auto-restart if continuous mode
        if (this.config.continuous) {
          try {
            rec.start();
          } catch {
            this.setStatus("idle");
            this.callbacks.onEnd?.();
          }
        } else {
          this.setStatus("idle");
          this.callbacks.onEnd?.();
        }
      } else {
        this.setStatus("idle");
        this.callbacks.onEnd?.();
      }
    };

    rec.onspeechstart = () => {
      this.setStatus("listening");
    };
  }

  private setStatus(status: VoiceStatus): void {
    this._status = status;
    this.callbacks.onStatusChange?.(status);
  }
}