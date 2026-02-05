"use client";

import { useEffect, useState } from "react";

interface TypewriterProps {
  /** Text to type out character by character */
  text: string;
  /** Delay in ms between characters */
  speed?: number;
  /** Delay before starting */
  delay?: number;
  /** Called when typing is complete */
  onComplete?: () => void;
  /** Optional class for the wrapper */
  className?: string;
  /** Show cursor while typing */
  cursor?: boolean;
}

export function Typewriter({
  text,
  speed = 40,
  delay = 0,
  onComplete,
  className = "",
  cursor = true,
}: TypewriterProps) {
  const [display, setDisplay] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!text) {
      onComplete?.();
      return;
    }
    const startTimer = window.setTimeout(() => setStarted(true), delay);
    return () => window.clearTimeout(startTimer);
  }, [text, delay, onComplete]);

  useEffect(() => {
    if (!started || !text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplay(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [started, text, speed, onComplete]);

  return (
    <span className={className}>
      {display}
      {cursor && started && display.length < text.length && (
        <span className="animate-pulse" aria-hidden>
          |
        </span>
      )}
    </span>
  );
}
