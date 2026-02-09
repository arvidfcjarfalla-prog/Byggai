import { ActionPortfolioGantt } from "../components/gantt/ActionPortfolioGantt";
import { MOCK_GANTT_DATA } from "../components/gantt/types";

export default function GanttPage() {
  return (
    <main className="min-h-screen bg-[#FAF8F5] px-4 py-6 md:px-8 md:py-8">
      <ActionPortfolioGantt projects={MOCK_GANTT_DATA} />
    </main>
  );
}
