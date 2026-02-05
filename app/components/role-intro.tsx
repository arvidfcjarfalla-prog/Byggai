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

/** Pause only before last line ("vem är du?") */
const INTRO_LINE_PAUSES: number[] = [0, 0, 420];

const CHOICES: { id: RoleId; label: string; cta: string }[] = [
  { id: "privat", label: "Privatperson", cta: "Starta byggprojekt" },
  { id: "brf", label: "Bostadsrättsförening", cta: "Planera åtgärder & upphandling" },
  { id: "entreprenor", label: "Entreprenör", cta: "Ta emot strukturerade förfrågningar" },
  { id: "osaker", label: "Osäker / Annat", cta: "Hjälp mig hitta rätt" },
];

const INITIERAR: Record<RoleId, string> = {
  privat: "initierar projekt för privatperson…",
  brf: "initierar planering för förening…",
  entreprenor: "initierar entreprenörsläge…",
  osaker: "initierar vägledning…",
};

const ROUTE_AFTER_MS = 450;

export function RoleIntro() {
  const router = useRouter();
  const { updateData } = useWizard();
  const [phase, setPhase] = useState<"typing" | "choices" | "initierar">("typing");
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [initierarLine, setInitierarLine] = useState("");

  const saveRole = useCallback((role: RoleId) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ROLE_STORAGE_KEY, role);
    }
  }, []);

  const handleDone = useCallback(() => {
    setPhase("choices");
  }, []);

  const handleChoice = useCallback(
    (role: RoleId) => {
      if (selectedRole) return;
      setSelectedRole(role);
      setPhase("initierar");
      setInitierarLine(INITIERAR[role]);
      saveRole(role);
      if (role === "osaker") updateData({ projectType: "annat" });
    },
    [selectedRole, saveRole, updateData]
  );

  useEffect(() => {
    if (phase !== "initierar" || !selectedRole) return;
    const t = window.setTimeout(() => {
      if (selectedRole === "privat") router.push("/start");
      else if (selectedRole === "brf") router.push("/brf");
      else if (selectedRole === "entreprenor") router.push("/entreprenor");
      else router.push("/start");
    }, ROUTE_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [phase, selectedRole, router]);

  return (
    <main
      className="min-h-screen bg-[#FAF8F5] text-[#2A2520] antialiased"
      style={{
        backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(205, 180, 155, 0.06) 0%, transparent 50%),
          radial-gradient(circle at 80% 70%, rgba(140, 120, 100, 0.05) 0%, transparent 50%)
        `,
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <div
          className="rounded-2xl border border-[#E8E3DC] bg-white/70 p-8 shadow-sm backdrop-blur-sm"
          aria-live="polite"
        >
          {phase === "typing" && (
            <Typewriter
              lines={INTRO_LINES}
              speedMs={42}
              linePauseMs={INTRO_LINE_PAUSES}
              onDone={handleDone}
              skippable
              cursor
              className="font-sans text-lg leading-relaxed text-[#2A2520] md:text-xl"
            />
          )}

          {phase === "choices" && (
            <div className="space-y-1">
              {INTRO_LINES.map((line, i) => (
                <div key={i} className="min-h-[1.5em] text-lg text-[#2A2520] md:text-xl">
                  {line}
                </div>
              ))}
              <div className="mt-6 space-y-2 border-t border-[#E8E3DC] pt-6">
                {CHOICES.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleChoice(c.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E8E3DC] bg-white px-4 py-3 text-left font-sans text-[#2A2520] transition-colors hover:border-[#8C7860] hover:bg-[#FAF8F5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8C7860] focus-visible:ring-offset-2"
                  >
                    <span className="font-medium">
                      {idx + 1}) {c.label}
                    </span>
                    <span className="text-sm text-[#8C7860]">{c.cta}</span>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-[#766B60]">
                Tryck Enter eller mellanslag för att hoppa över text.
              </p>
            </div>
          )}

          {phase === "initierar" && (
            <div className="space-y-1">
              {INTRO_LINES.map((line, i) => (
                <div key={i} className="min-h-[1.5em] text-lg text-[#2A2520] md:text-xl">
                  {line}
                </div>
              ))}
              <div className="mt-6 border-t border-[#E8E3DC] pt-6">
                <p className="font-sans text-lg text-[#8C7860] md:text-xl">
                  {initierarLine}
                  <span className="animate-pulse">|</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
