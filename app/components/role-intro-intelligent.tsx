"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Typewriter } from "./ui/typewriter";
import { useWizard } from "./wizard-context";

const ROLE_STORAGE_KEY = "byggplattformen-role";

export type RoleId = "privat" | "brf" | "entreprenor" | "osaker";

const INTRO_LINES = [
  "välkommen",
  "välkommen till din projektplattform",
  "låt oss skapa struktur innan du tar nästa beslut",
  "vem är du?",
];

// Längre paus innan sista raden för bättre känsla
const INTRO_LINE_PAUSES: number[] = [200, 200, 500];

const ROLES: {
  id: RoleId;
  label: string;
  subtitle: string;
  route: string;
}[] = [
  {
    id: "privat",
    label: "Privatperson",
    subtitle: "Starta byggprojekt",
    route: "/start", // Direkt till wizard
  },
  {
    id: "brf",
    label: "Bostadsrättsförening",
    subtitle: "Planera åtgärder & upphandling",
    route: "/brf",
  },
  {
    id: "entreprenor",
    label: "Entreprenör",
    subtitle: "Ta emot strukturerade förfrågningar",
    route: "/entreprenor",
  },
  {
    id: "osaker",
    label: "Osäker / Annat",
    subtitle: "Hjälp mig hitta rätt",
    route: "/start", // Går också till wizard
  },
];

const TRANSITION_TEXTS: Record<RoleId, string> = {
  privat: "initierar projekt för privatperson…",
  brf: "initierar planering för bostadsrättsförening…",
  entreprenor: "laddar strukturerade projektförfrågningar…",
  osaker: "vi hjälper dig hitta rätt väg…",
};

type Phase = "typing" | "choices" | "thinking" | "transitioning";

export function RoleIntro() {
  const router = useRouter();
  const { setRole, canResume, getResumePoint } = useWizard();
  
  const [phase, setPhase] = useState<Phase>("typing");
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [thinkingDots, setThinkingDots] = useState("");
  const [transitionText, setTransitionText] = useState("");

  // Thinking animation (tre prickar som pulserar)
  useEffect(() => {
    if (phase !== "thinking") return;
    
    let dots = 0;
    const interval = setInterval(() => {
      dots = (dots + 1) % 4;
      setThinkingDots(".".repeat(dots));
    }, 400);
    
    return () => clearInterval(interval);
  }, [phase]);

  const handleDone = useCallback(() => {
    setPhase("choices");
  }, []);

  const handleRoleChoice = useCallback(
    (role: RoleId) => {
      if (selectedRole) return;
      
      setSelectedRole(role);
      setPhase("thinking");
      
      // Spara roll
      setRole(role);
      if (typeof window !== "undefined") {
        localStorage.setItem(ROLE_STORAGE_KEY, role);
      }
      
      // Thinking state (simulerar systemanalys)
      setTimeout(() => {
        setPhase("transitioning");
        setTransitionText(TRANSITION_TEXTS[role]);
        
        // Navigera efter kort transition utan att manipulera body-opacity
        setTimeout(() => {
          const target = ROLES.find((r) => r.id === role);
          if (target) {
            router.push(target.route);
          }
        }, 1200);
      }, 800);
    },
    [selectedRole, setRole, router]
  );

  // Check for resume
  useEffect(() => {
    if (canResume && phase === "typing") {
      const resumePath = getResumePoint();
      if (resumePath) {
        console.log("User can resume from:", resumePath);
        // Du kan auto-redirect här om du vill, eller visa en prompt
      }
    }
  }, [canResume, getResumePoint, phase]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#FAF8F5] px-6 antialiased">
      {/* Subtle background */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(205, 180, 155, 0.04) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(140, 120, 100, 0.03) 0%, transparent 50%)
          `,
        }}
      />

      {/* Content */}
      <div className="relative w-full max-w-3xl">
        {/* Typing phase */}
        {phase === "typing" && (
          <div className="text-left">
            <Typewriter
              lines={INTRO_LINES}
              speedMs={45}
              linePauseMs={INTRO_LINE_PAUSES}
              onDone={handleDone}
              skippable
              cursor
              className="font-sans text-xl leading-relaxed text-[#2A2520] md:text-2xl"
            />
          </div>
        )}

        {/* Choices phase - terminal style */}
        {phase === "choices" && (
          <div className="space-y-1 text-left">
            {/* Show completed typewriter text */}
            {INTRO_LINES.map((line, i) => (
              <div 
                key={i} 
                className={`font-sans text-xl leading-relaxed md:text-2xl ${
                  i === INTRO_LINES.length - 1 
                    ? 'text-[#2A2520]' 
                    : 'text-[#766B60]'
                }`}
              >
                {line}
              </div>
            ))}

            {/* Terminal-style choices */}
            <div className="mt-8 space-y-2">
              {ROLES.map((role, idx) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleChoice(role.id)}
                  className="group flex w-full items-center justify-between rounded-xl border border-transparent px-5 py-4 text-left font-sans text-base transition-all duration-200 hover:border-[#E8E3DC] hover:bg-white/60 focus:outline-none focus-visible:border-[#8C7860] focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2 md:text-lg"
                  style={{
                    animation: `fadeInUp 0.4s ease-out ${idx * 100}ms both`
                  }}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[#766B60]">{idx + 1})</span>
                    <div>
                      <div className="font-medium text-[#2A2520]">{role.label}</div>
                      <div className="mt-0.5 text-sm text-[#766B60]">{role.subtitle}</div>
                    </div>
                  </div>
                  
                  <svg 
                    className="h-5 w-5 text-[#8C7860] opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100"
                    viewBox="0 0 20 20" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <path d="M7 3l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            {/* Helper text */}
            <p className="mt-6 text-xs text-[#766B60] opacity-0 animate-fadeIn" style={{ animationDelay: '600ms' }}>
              Tryck Enter eller mellanslag för att hoppa över text.
            </p>
          </div>
        )}

        {/* Thinking phase - systemet "tänker" */}
        {phase === "thinking" && selectedRole && (
          <div className="space-y-1 text-left">
            {INTRO_LINES.map((line, i) => (
              <div 
                key={i} 
                className={`font-sans text-xl leading-relaxed md:text-2xl ${
                  i === INTRO_LINES.length - 1 
                    ? 'text-[#2A2520]' 
                    : 'text-[#766B60]'
                }`}
              >
                {line}
              </div>
            ))}

            <div className="mt-8 flex items-center gap-3 text-[#8C7860]">
              <div className="flex h-2 w-2 items-center justify-center">
                <span className="absolute h-2 w-2 animate-ping rounded-full bg-[#8C7860] opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-[#8C7860]" />
              </div>
              <span className="font-sans text-lg">
                systemet analyserar{thinkingDots}
              </span>
            </div>
          </div>
        )}

        {/* Transitioning phase */}
        {phase === "transitioning" && (
          <div className="space-y-1 text-left">
            {INTRO_LINES.map((line, i) => (
              <div 
                key={i} 
                className={`font-sans text-xl leading-relaxed md:text-2xl ${
                  i === INTRO_LINES.length - 1 
                    ? 'text-[#2A2520]' 
                    : 'text-[#766B60]'
                }`}
              >
                {line}
              </div>
            ))}
            
            <div className="mt-8">
              <p className="font-sans text-lg text-[#8C7860]">
                {transitionText}
                <span className="animate-pulse">|</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Custom animations */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out both;
        }
      `}</style>
    </main>
  );
}
