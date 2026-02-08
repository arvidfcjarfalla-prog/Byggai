"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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

const INTRO_LINE_PAUSES: number[] = [200, 200, 800];

const CHOICES: { id: RoleId; title: string; subtitle: string; desc: string }[] = [
  {
    id: "privat",
    title: "Privatperson",
    subtitle: "Starta byggprojekt",
    desc: "Jag planerar ett projekt för min bostad"
  },
  {
    id: "brf",
    title: "Bostadsrättsförening",
    subtitle: "Planera åtgärder",
    desc: "Vi behöver strukturera renoveringar"
  },
  {
    id: "entreprenor",
    title: "Entreprenör",
    subtitle: "Ta emot förfrågningar",
    desc: "Jag vill ta emot projekt och ge offerter"
  },
  {
    id: "osaker",
    title: "Osäker / Annat",
    subtitle: "Hjälp mig hitta rätt",
    desc: "Jag behöver vägledning"
  },
];

const ROLE_LABELS: Record<RoleId, string> = {
  privat: "Privatperson",
  brf: "Bostadsrättsförening",
  entreprenor: "Entreprenör",
  osaker: "Osäker / Annat",
};

const WIZARD_ROUTES: Record<RoleId, string> = {
  privat: "/start",
  brf: "/brf/start",
  entreprenor: "/entreprenor",
  osaker: "/start",
};

const CARDS_ENABLE_DELAY_MS = 1200;
const ROUTE_DELAY_MS = 800;

export function RoleIntro() {
  const router = useRouter();
  const { updateData } = useWizard();
  const [phase, setPhase] = useState<"typing" | "choices" | "action" | "transitioning">("typing");
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [cardsEnabled, setCardsEnabled] = useState(false);
  const [transitionText, setTransitionText] = useState("");

  const saveRole = useCallback((role: RoleId) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    }
  }, []);

  const handleDone = useCallback(() => {
    setPhase("choices");
    setTimeout(() => setCardsEnabled(true), CARDS_ENABLE_DELAY_MS);
  }, []);

  const handleRoleChoice = useCallback(
    (role: RoleId) => {
      if (!cardsEnabled || selectedRole) return;
      
      setSelectedRole(role);
      setPhase("action");
      saveRole(role);
      
      if (role === "osaker") updateData({ projectType: "annat" });
    },
    [cardsEnabled, selectedRole, saveRole, updateData]
  );

  const handleActionChoice = useCallback(
    (action: "landing" | "wizard") => {
      if (!selectedRole) return;
      
      setPhase("transitioning");
      setTransitionText(action === "landing" ? "tar dig till startsidan…" : "startar projektet…");
      
      setTimeout(() => {
        if (action === "wizard") {
          router.push(WIZARD_ROUTES[selectedRole]);
        } else {
          // Navigate to role-specific landing
          if (selectedRole === "privat") router.push("/privatperson");
          else if (selectedRole === "brf") router.push("/brf");
          else if (selectedRole === "entreprenor") router.push("/entreprenor");
          else router.push("/privatperson");
        }
      }, ROUTE_DELAY_MS);
    },
    [selectedRole, router]
  );

  return (
    <main
      className="min-h-screen bg-[#FAF8F5] text-[#2A2520] antialiased"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(205, 180, 155, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(140, 120, 100, 0.06) 0%, transparent 50%)
        `,
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-12">
        {/* Typing phase */}
        {phase === "typing" && (
          <div className="mx-auto w-full max-w-3xl text-center">
            <Typewriter
              lines={INTRO_LINES}
              speedMs={50}
              linePauseMs={INTRO_LINE_PAUSES}
              onDone={handleDone}
              skippable
              cursor
              className="font-display text-3xl font-light leading-relaxed text-[#2A2520] md:text-4xl lg:text-5xl"
            />
          </div>
        )}

        {/* Role choices */}
        {phase === "choices" && (
          <div className="w-full">
            <div className="mb-16 space-y-3 text-center">
              {INTRO_LINES.map((line, i) => (
                <div 
                  key={i} 
                  className={`font-display text-2xl md:text-3xl lg:text-4xl ${
                    i === INTRO_LINES.length - 1 
                      ? 'font-bold text-[#2A2520]' 
                      : 'font-light text-[#766B60]'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
              {CHOICES.map((choice, idx) => {
                const isDisabled = !cardsEnabled;

                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleRoleChoice(choice.id)}
                    disabled={isDisabled}
                    className={`group relative overflow-hidden rounded-3xl border-2 p-10 text-left transition-all duration-500 ${
                      isDisabled
                        ? 'border-[#E8E3DC]/50 bg-white/50 opacity-60 cursor-not-allowed'
                        : 'border-[#E8E3DC] bg-white hover:border-[#CDB49B] hover:shadow-2xl hover:scale-[1.02] cursor-pointer'
                    }`}
                    style={{
                      animation: `fadeInUp 0.8s ease-out ${idx * 150}ms both`
                    }}
                  >
                    <h3 className="mb-2 font-display text-2xl font-bold text-[#2A2520] lg:text-3xl">
                      {choice.title}
                    </h3>

                    <p className="mb-4 text-base font-semibold text-[#8C7860]">
                      {choice.subtitle}
                    </p>

                    <p className="text-base leading-relaxed text-[#766B60]">
                      {choice.desc}
                    </p>

                    <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[#CDB49B]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>

            <p className="mt-8 text-center text-sm text-[#766B60]">
              {cardsEnabled 
                ? "Välj ett alternativ för att fortsätta" 
                : "Väntar…"}
            </p>
          </div>
        )}

        {/* Action choice (landing vs wizard) */}
        {phase === "action" && selectedRole && (
          <div className="w-full">
            <div className="mb-12 space-y-3 text-center">
              {INTRO_LINES.map((line, i) => (
                <div 
                  key={i} 
                  className={`font-display text-2xl md:text-3xl lg:text-4xl ${
                    i === INTRO_LINES.length - 1 
                      ? 'font-bold text-[#2A2520]' 
                      : 'font-light text-[#766B60]'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>

            <div className="mx-auto max-w-3xl">
              <div className="mb-10 rounded-3xl border-2 border-[#8C7860] bg-gradient-to-br from-[#8C7860]/5 to-[#CDB49B]/5 p-8 text-center">
                <p className="text-lg text-[#766B60]">Du har valt:</p>
                <p className="font-display mt-2 text-3xl font-bold text-[#2A2520]">
                  {ROLE_LABELS[selectedRole]}
                </p>
              </div>

              <h2 className="mb-8 text-center font-display text-2xl font-bold text-[#2A2520] md:text-3xl">
                Vad vill du göra?
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleActionChoice("landing")}
                  className="group relative overflow-hidden rounded-3xl border-2 border-[#E8E3DC] bg-white p-10 text-center transition-all duration-300 hover:border-[#8C7860] hover:shadow-2xl hover:scale-[1.02]"
                >
                  <h3 className="mb-3 font-display text-2xl font-bold text-[#2A2520]">
                    Läs mer
                  </h3>
                  <p className="mb-6 text-base text-[#766B60]">
                    Om plattformen och hur den fungerar
                  </p>
                  <div className="mx-auto inline-flex items-center gap-2 text-sm font-semibold text-[#8C7860]">
                    Gå till startsidan
                    <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="8" x2="14" y2="8" />
                      <polyline points="10 4 14 8 10 12" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-[#CDB49B]/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>

                <button
                  type="button"
                  onClick={() => handleActionChoice("wizard")}
                  className="group relative overflow-hidden rounded-3xl border-2 border-[#8C7860] bg-gradient-to-br from-[#8C7860]/10 to-[#CDB49B]/10 p-10 text-center transition-all duration-300 hover:border-[#6B5A47] hover:shadow-2xl hover:scale-[1.02]"
                >
                  <h3 className="mb-3 font-display text-2xl font-bold text-[#2A2520]">
                    Initiera projekt
                  </h3>
                  <p className="mb-6 text-base text-[#766B60]">
                    Kom igång direkt med projektet
                  </p>
                  <div className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#8C7860] to-[#6B5A47] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform group-hover:scale-105">
                    Starta nu
                    <svg className="transition-transform group-hover:translate-x-1" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="8" x2="14" y2="8" />
                      <polyline points="10 4 14 8 10 12" />
                    </svg>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transitioning */}
        {phase === "transitioning" && (
          <div className="mx-auto w-full max-w-3xl text-center">
            <div className="space-y-3">
              {INTRO_LINES.map((line, i) => (
                <div 
                  key={i} 
                  className={`font-display text-2xl md:text-3xl lg:text-4xl ${
                    i === INTRO_LINES.length - 1 
                      ? 'font-bold text-[#2A2520]' 
                      : 'font-light text-[#766B60]'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
            
            <div className="mt-12">
              <p className="font-display text-2xl text-[#8C7860] md:text-3xl">
                {transitionText}
                <span className="animate-pulse">|</span>
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
