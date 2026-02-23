"use client";

import Link from "next/link";

import type { EntreprenorOfferFlowStep } from "../../lib/offers/flow";

function stateStyles(state: EntreprenorOfferFlowStep["state"]) {
  if (state === "current") {
    return {
      dot: "bg-[#2F2F31] text-white border-[#2F2F31]",
      card: "border-[#D7C3A8] bg-[#FFF9F1]",
      title: "text-[#2A2520]",
      desc: "text-[#6B5A47]",
    };
  }
  if (state === "complete") {
    return {
      dot: "bg-[#2F2F31] text-white border-[#2F2F31]",
      card: "border-[#E6DFD6] bg-white hover:bg-[#FAF8F5]",
      title: "text-[#2A2520]",
      desc: "text-[#6B5A47]",
    };
  }
  if (state === "available") {
    return {
      dot: "bg-[#F8B62A] text-[#2A2520] border-[#F8B62A]",
      card: "border-[#E6DFD6] bg-white hover:bg-[#FAF8F5]",
      title: "text-[#2A2520]",
      desc: "text-[#6B5A47]",
    };
  }
  return {
    dot: "bg-white text-[#9B8E7D] border-[#D9D1C6]",
    card: "border-[#EFE8DD] bg-[#FAF8F5]",
    title: "text-[#7A6D5C]",
    desc: "text-[#9B8E7D]",
  };
}

export function EntreprenorOfferFlowStepper({
  steps,
  heading = "Offertflöde",
  subheading = "Följ stegen från förfrågningsförståelse till färdig offert.",
}: {
  steps: EntreprenorOfferFlowStep[];
  heading?: string;
  subheading?: string;
}) {
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const progressPercent =
    currentIndex >= 0 ? Math.round(((currentIndex + 1) / Math.max(steps.length, 1)) * 100) : 0;

  return (
    <section className="rounded-2xl border border-[#E6DFD6] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8C7860]">{heading}</p>
          <p className="mt-1 text-sm text-[#6B5A47]">{subheading}</p>
        </div>
        <div className="rounded-xl border border-[#EFE8DD] bg-[#FAF8F5] px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-wide text-[#8C7860]">Progress</p>
          <p className="text-lg font-bold text-[#2A2520]">{progressPercent}%</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EFE8DD]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#F8B62A] to-[#2F2F31]"
          style={{ width: `${Math.max(4, progressPercent)}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {steps.map((step) => {
          const styles = stateStyles(step.state);
          const content = (
            <div className={`rounded-xl border p-3 transition ${styles.card}`}>
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${styles.dot}`}
                >
                  {step.state === "complete" ? "✓" : step.number}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${styles.title}`}>{step.title}</p>
                  <p className={`mt-1 text-xs ${styles.desc}`}>{step.description}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8C7860]">
                    {step.state === "current"
                      ? "Pågående steg"
                      : step.state === "complete"
                        ? "Klar / tillgänglig"
                        : step.state === "available"
                          ? "Nästa steg"
                          : "Låst tills tidigare steg är klart"}
                  </p>
                </div>
              </div>
            </div>
          );

          if (!step.href || step.state === "locked") {
            return <div key={step.id}>{content}</div>;
          }

          return (
            <Link key={step.id} href={step.href} className="block">
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
