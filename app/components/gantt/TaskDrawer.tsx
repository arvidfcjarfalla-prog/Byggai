"use client";

import { useMemo, useState } from "react";
import type {
  ScheduleTask,
  ScheduleTaskCategory,
  ScheduleTaskStatus,
  ScheduleOwnerRole,
} from "../../lib/schedule";

function toList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function TaskDrawer({
  task,
  allTasks,
  onClose,
  onSave,
  onDelete,
}: {
  task: ScheduleTask;
  allTasks: ScheduleTask[];
  onClose: () => void;
  onSave: (task: ScheduleTask) => void;
  onDelete: (taskId: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [phase, setPhase] = useState(task.phase);
  const [category, setCategory] = useState<ScheduleTaskCategory>(task.category);
  const [startDate, setStartDate] = useState(task.startDate);
  const [endDate, setEndDate] = useState(task.endDate);
  const [status, setStatus] = useState<ScheduleTaskStatus>(task.status);
  const [ownerRole, setOwnerRole] = useState<ScheduleOwnerRole | "">(task.ownerRole || "");
  const [notes, setNotes] = useState(task.notes || "");
  const [tagsText, setTagsText] = useState((task.tags || []).join(", "));
  const [dependencies, setDependencies] = useState<string[]>(task.dependencies);
  const [error, setError] = useState<string | null>(null);

  const dependencyOptions = useMemo(
    () => allTasks.filter((item) => item.id !== task.id),
    [allTasks, task.id]
  );

  const toggleDependency = (dependencyId: string) => {
    setDependencies((current) =>
      current.includes(dependencyId)
        ? current.filter((id) => id !== dependencyId)
        : [...current, dependencyId]
    );
  };

  const handleSave = () => {
    if (title.trim().length < 2) {
      setError("Titel måste vara minst 2 tecken.");
      return;
    }
    if (!/\d{4}-\d{2}-\d{2}/.test(startDate) || !/\d{4}-\d{2}-\d{2}/.test(endDate)) {
      setError("Start- och slutdatum måste vara i format YYYY-MM-DD.");
      return;
    }
    if (new Date(`${endDate}T00:00:00`).getTime() < new Date(`${startDate}T00:00:00`).getTime()) {
      setError("Slutdatum kan inte vara före startdatum.");
      return;
    }

    onSave({
      ...task,
      title: title.trim(),
      phase: phase.trim() || "Övrigt",
      category,
      startDate,
      endDate,
      status,
      ownerRole: ownerRole || undefined,
      notes: notes.trim() || undefined,
      tags: toList(tagsText),
      dependencies,
      source: "manual",
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleDelete = () => {
    const confirmed = window.confirm("Ta bort den här tasken?");
    if (!confirmed) return;
    onDelete(task.id);
    onClose();
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-[70] w-full max-w-md overflow-y-auto border-l border-[#E6DFD6] bg-white p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-[#2A2520]">Taskdetaljer</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[#D9D1C6] px-3 py-1.5 text-xs font-semibold text-[#6B5A47]"
        >
          Stäng
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block font-semibold text-[#2A2520]">Titel</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block font-semibold text-[#2A2520]">Fas</span>
            <input
              value={phase}
              onChange={(event) => setPhase(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-[#2A2520]">Kategori</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as ScheduleTaskCategory)}
              className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
            >
              <option value="pre">Pre</option>
              <option value="build">Build</option>
              <option value="post">Post</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block font-semibold text-[#2A2520]">Start</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-[#2A2520]">Slut</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block font-semibold text-[#2A2520]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ScheduleTaskStatus)}
              className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
            >
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-[#2A2520]">Ansvarig</span>
            <select
              value={ownerRole}
              onChange={(event) => setOwnerRole(event.target.value as ScheduleOwnerRole | "")}
              className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
            >
              <option value="">Ej satt</option>
              <option value="brf">BRF</option>
              <option value="privatperson">Privatperson</option>
              <option value="entreprenor">Entreprenör</option>
              <option value="consultant">Konsult</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block font-semibold text-[#2A2520]">Taggar (komma-separerat)</span>
          <input
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-semibold text-[#2A2520]">Noteringar</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-xl border border-[#D9D1C6] px-3 py-2"
          />
        </label>

        <fieldset className="rounded-xl border border-[#E6DFD6] p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[#8C7860]">
            Beroenden
          </legend>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {dependencyOptions.length === 0 && (
              <p className="text-xs text-[#766B60]">Inga andra tasks att bero på.</p>
            )}
            {dependencyOptions.map((option) => (
              <label key={option.id} className="flex items-center gap-2 text-xs text-[#2A2520]">
                <input
                  type="checkbox"
                  checked={dependencies.includes(option.id)}
                  onChange={() => toggleDependency(option.id)}
                />
                <span>{option.title}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-[#8C7860] px-4 py-2 text-sm font-semibold text-white"
        >
          Spara task
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
        >
          Ta bort
        </button>
      </div>
    </aside>
  );
}

