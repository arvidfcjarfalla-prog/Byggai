"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TypewriterProps {
  /** Lines to type out in order */
  lines: string[];
  /** Delay in ms between characters */
  speedMs?: number;
  /** Pause in ms after each line (before next). Can be a number or array (per-line). */
  linePauseMs?: number | number[];
  /** Called when all lines are done */
  onDone?: () => void;
  /** Allow skip with Enter or Space */
  skippable?: boolean;
  /** Show blinking cursor */
  cursor?: boolean;
  className?: string;
}

export function Typewriter({
  lines,
  speedMs = 45,
  linePauseMs = 0,
  onDone,
  skippable = true,
  cursor = true,
  className = "",
}: TypewriterProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const currentLine = lines[lineIndex] ?? "";
  const visibleText = skipped ? currentLine : (currentLine.slice(0, charIndex));

  const finishAll = useCallback(() => {
    if (done) return;
    setDone(true);
    setSkipped(true);
    setLineIndex(lines.length - 1);
    setCharIndex(lines[lines.length - 1]?.length ?? 0);
    onDoneRef.current?.();
  }, [done, lines]);

  const skipOne = useCallback(() => {
    if (lineIndex >= lines.length - 1 && charIndex >= currentLine.length) {
      finishAll();
      return;
    }
    if (charIndex < currentLine.length) {
      setCharIndex(currentLine.length);
      return;
    }
    setLineIndex((i) => i + 1);
    setCharIndex(0);
  }, [lineIndex, charIndex, currentLine.length, lines.length, finishAll]);

  useEffect(() => {
    if (lines.length === 0) {
      onDoneRef.current?.();
      return;
    }
    if (done) return;

    if (charIndex < currentLine.length) {
      const id = window.setTimeout(() => setCharIndex((c) => c + 1), speedMs);
      return () => window.clearTimeout(id);
    }

    if (lineIndex < lines.length - 1) {
      const pause = Array.isArray(linePauseMs) ? (linePauseMs[lineIndex] ?? 0) : linePauseMs;
      const id = window.setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharIndex(0);
      }, pause);
      return () => window.clearTimeout(id);
    }

    setDone(true);
    onDoneRef.current?.();
  }, [lineIndex, charIndex, currentLine.length, lines.length, speedMs, linePauseMs, done]);

  useEffect(() => {
    if (!skippable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (done) return;
        if (lineIndex >= lines.length - 1 && charIndex >= currentLine.length) finishAll();
        else skipOne();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skippable, done, lineIndex, charIndex, currentLine.length, lines.length, finishAll, skipOne]);

  if (lines.length === 0) return null;

  return (
    <div className={className}>
      {lines.slice(0, lineIndex + 1).map((line, i) => (
        <div key={i} className="min-h-[1.5em]">
          {i < lineIndex
            ? line
            : i === lineIndex
              ? <>
                  {visibleText}
                  {cursor && !skipped && charIndex < line.length && (
                    <span className="animate-pulse" aria-hidden>|</span>
                  )}
                  {cursor && skipped && charIndex >= line.length && (
                    <span className="animate-pulse" aria-hidden>|</span>
                  )}
                </>
              : null}
        </div>
      ))}
    </div>
  );
}
