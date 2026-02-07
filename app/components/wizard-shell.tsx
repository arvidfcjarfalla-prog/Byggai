"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWizard } from "./wizard-context";

interface ShellProps {
  children: React.ReactNode;
  currentPath?: string;
  showLandingLink?: boolean; // Endast första steget
  showResumePrompt?: boolean; // Om användaren kan återuppta
}

export function WizardShell({ 
  children, 
  currentPath,
  showLandingLink = false,
  showResumePrompt = false,
}: ShellProps) {
  const router = useRouter();
  const { 
    data, 
    stepConfig, 
    currentStep, 
    canResume, 
    getResumePoint,
    calculateProgress,
  } = useWizard();
  
  const [showResume, setShowResume] = useState(false);
  const progress = calculateProgress();

  // Check resume på mount
  useEffect(() => {
    if (showResumePrompt && canResume && currentPath === "/start/nulage") {
      const resumePath = getResumePoint();
      if (resumePath && resumePath !== currentPath) {
        // Undvik synkron setState i själva effektkroppen
        window.setTimeout(() => {
          setShowResume(true);
        }, 0);
      }
    }
  }, [showResumePrompt, canResume, getResumePoint, currentPath]);

  const handleResume = () => {
    const resumePath = getResumePoint();
    if (resumePath) {
      router.push(resumePath);
    }
    setShowResume(false);
  };

  const handleStartFresh = () => {
    setShowResume(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#2A2520] antialiased">
      {/* Subtle background */}
      <div 
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(205, 180, 155, 0.04) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(140, 120, 100, 0.03) 0%, transparent 50%)
          `,
        }}
      />

      {/* Minimal header */}
      <header className="border-b border-[#E8E3DC]/60 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          {/* Logo/Back */}
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm font-medium text-[#766B60] outline-none transition-colors hover:text-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
          >
            <svg
              className="transition-transform group-hover:-translate-x-0.5"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 4L6 8l4 4" />
            </svg>
            Avsluta
          </Link>

          {/* Optional: Landing link (endast första steget) */}
          {showLandingLink && data.userRole === "privat" && (
            <Link
              href="/privatperson"
              className="text-xs text-[#766B60] underline-offset-2 outline-none transition-colors hover:text-[#8C7860] hover:underline focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
            >
              Hur fungerar plattformen?
            </Link>
          )}

          {/* Progress indicator */}
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[#766B60] sm:inline">
              {currentStep} / {stepConfig.length}
            </span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#E8E3DC]">
              <div 
                className="h-full bg-gradient-to-r from-[#8C7860] to-[#6B5A47] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Resume prompt (optional) */}
      {showResume && (
        <div className="border-b border-[#CDB49B] bg-gradient-to-r from-[#CDB49B]/10 to-transparent px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#8C7860]"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[#2A2520]">
                  Du har sparat information från tidigare
                </p>
                <p className="mt-0.5 text-xs text-[#766B60]">
                  Vill du fortsätta där du var eller börja om?
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartFresh}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#766B60] outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-[#8C7860]"
              >
                Börja om
              </button>
              <button
                type="button"
                onClick={handleResume}
                className="rounded-lg bg-[#8C7860] px-3 py-1.5 text-xs font-medium text-white outline-none transition-colors hover:bg-[#6B5A47] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
              >
                Fortsätt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        {children}
      </main>

      {/* Minimal footer with breadcrumb */}
      {stepConfig.length > 0 && (
        <footer className="border-t border-[#E8E3DC]/60 px-6 py-4">
          <div className="mx-auto max-w-5xl">
            <nav aria-label="Wizard steg" className="flex items-center gap-2 overflow-x-auto">
              {stepConfig.map((step, idx) => {
                const isActive = idx === currentStep - 1;
                const isCompleted = idx < currentStep - 1;
                
                return (
                  <div key={step.path} className="flex items-center gap-2">
                    <span
                      className={`whitespace-nowrap text-xs transition-colors ${
                        isActive
                          ? "font-semibold text-[#8C7860]"
                          : isCompleted
                          ? "text-[#766B60]"
                          : "text-[#9A9086]"
                      }`}
                    >
                      {step.label}
                    </span>
                    {idx < stepConfig.length - 1 && (
                      <svg
                        className="h-3 w-3 text-[#CDB49B]"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 4l4 4-4 4" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </footer>
      )}
    </div>
  );
}