"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseCountdownOptions {
  initialTime: number; // seconds
  onComplete?: () => void;
  autoStart?: boolean;
}

interface UseCountdownReturn {
  time: number;
  isRunning: boolean;
  isPaused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: (newTime?: number) => void;
  formatted: string;
  progress: number;
}

export function useCountdown({
  initialTime,
  onComplete,
  autoStart = false,
}: UseCountdownOptions): UseCountdownReturn {
  const [time, setTime] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimeRef = useRef(initialTime);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
    setIsPaused(true);
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const reset = useCallback(
    (newTime?: number) => {
      clearTimer();
      const t = newTime ?? initialTime;
      setTime(t);
      totalTimeRef.current = t;
      setIsRunning(false);
      setIsPaused(false);
    },
    [clearTimer, initialTime]
  );

  useEffect(() => {
    if (isRunning && time > 0) {
      intervalRef.current = setInterval(() => {
        setTime((prev) => {
          if (prev <= 1) {
            clearTimer();
            setIsRunning(false);
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return clearTimer;
  }, [isRunning, time, clearTimer, onComplete]);

  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = time % 60;
  const formatted = hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const progress = totalTimeRef.current > 0
    ? ((totalTimeRef.current - time) / totalTimeRef.current) * 100
    : 0;

  return { time, isRunning, isPaused, start, pause, resume, reset, formatted, progress };
}