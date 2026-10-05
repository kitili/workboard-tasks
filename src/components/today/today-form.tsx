"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAILY_LINES } from "@/lib/daily-lines";
import type { TapSuggestion } from "@/lib/departments";

type Row = { slot: number; title: string; taskId?: string | null };
export type PickableTask = { id: string; title: string; status: string; tap: boolean };

function rowsFrom(saved: Array<{ slot: number; title: string; taskId?: string | null }>, suggestions: TapSuggestion[]): Row[] {
  return DAILY_LINES.map((line) => ({
    slot: line.slot,
    title:
      saved.find((item) => item.slot === line.slot)?.title ??
      suggestions.find((item) => item.slot === line.slot)?.title ??
      "",
    taskId: saved.find((item) => item.slot === line.slot)?.taskId ?? null,
  }));
}

export function TodayForm({
  filed,
  saved = [],
  suggestions = [],
  pickable = [],
  departmentName = null,
}: {
  filed: boolean;
  saved?: Array<{ slot: number; title: string; taskId?: string | null }>;
  suggestions?: TapSuggestion[];
  pickable?: PickableTask[];
  departmentName?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(saved, filed ? [] : suggestions));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(filed ? "Tweak a line, pick a TAP card, or take one out. Save when it feels right." : "");

  function setRow(slot: number, patch: Partial<Row>) {
    setRows((current) => current.map((item) => (item.slot === slot ? { ...item, ...patch } : item)));
  }

  async function saveList(e: React.FormEvent) {
    e.preventDefault();
    const slots = rows.filter((row) => row.title.trim());
    if (slots.length === 0) {
      setError("Add or pick at least one line for today.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slots: slots.map((row) => ({
          slot: row.slot,
          title: row.title,
          taskId: row.taskId || undefined,
          priority: null,
        })),
      }),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not keep those tasks");
      return;
    }
    setNotice("Kept. Your board has the same words.");
    router.refresh();
  }

  async function removeLine(slot: number) {
    setRow(slot, { title: "", taskId: null });
    if (!filed) return;
    await fetch(`/api/today?slot=${slot}`, { method: "DELETE" });
    setNotice("Taken out of today.");
    router.refresh();
  }

  const priorities = DAILY_LINES.filter((line) => line.slot <= 3);

  return (
    <form onSubmit={saveList} className="overflow-hidden rounded-3xl border border-[#002368]/10 bg-white shadow-sm">
      <div className="h-2 bg-[linear-gradient(90deg,#002368,#80BFEC,#FFC952)]" />
      <div className="space-y-6 p-6">
        {notice ? <p className="rounded-2xl bg-[#FFF7E5] px-4 py-3 text-sm text-[#14233B]">{notice}</p> : null}
        <section className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">01 — 03</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">Today’s three</h3>
            <p className="mt-1 text-sm text-[#4f555f]">
              Add from your TAP, write your own, or take a line out. {departmentName ? `${departmentName} first.` : ""}
            </p>
          </div>
          {priorities.map((line) => (
            <LineField
              key={line.slot}
              line={line}
              value={rows[line.slot - 1]?.title ?? ""}
              pickable={pickable}
              source={!filed ? suggestions.find((item) => item.slot === line.slot)?.source : undefined}
              onChange={(title) => setRow(line.slot, { title, taskId: null })}
              onPick={(task) => setRow(line.slot, { title: task.title, taskId: task.id })}
              onRemove={() => void removeLine(line.slot)}
            />
          ))}
        </section>

        <section className="space-y-3 rounded-3xl bg-[#FFF7E5] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#14233B]">04</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">The wobble</h3>
            <p className="mt-1 text-sm text-[#4f555f]">What might get in the way today.</p>
          </div>
          <LineField
            line={DAILY_LINES[3]}
            value={rows[3]?.title ?? ""}
            onChange={(title) => setRow(4, { title })}
            onRemove={() => void removeLine(4)}
          />
        </section>

        <section className="space-y-3 rounded-3xl bg-[#D9ECF9] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">05</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">Yesterday’s glow</h3>
            <p className="mt-1 text-sm text-[#4f555f]">A short recap of what moved.</p>
          </div>
          <LineField
            line={DAILY_LINES[4]}
            value={rows[4]?.title ?? ""}
            onChange={(title) => setRow(5, { title })}
            onRemove={() => void removeLine(5)}
          />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="on-navy rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? "Keeping…" : "Keep today’s 1–5"}
          </button>
          {error ? <p className="text-sm text-[#002368]">{error}</p> : null}
        </div>
      </div>
    </form>
  );
}

function LineField({
  line,
  value,
  source,
  pickable,
  onChange,
  onPick,
  onRemove,
}: {
  line: (typeof DAILY_LINES)[number];
  value: string;
  source?: string;
  pickable?: PickableTask[];
  onChange: (title: string) => void;
  onPick?: (task: PickableTask) => void;
  onRemove: () => void;
}) {
  const challenge = line.slot === 4;
  const filled = Boolean(value.trim());

  return (
    <div className="rounded-3xl border border-[#002368]/8 bg-white/70 p-3">
      <div className="grid grid-cols-[40px_1fr] items-start gap-3">
        <span
          className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
            challenge ? "bg-[#FFC952]" : "on-navy"
          }`}
          style={challenge ? { color: "#14233B", WebkitTextFillColor: "#14233B" } : undefined}
        >
          {line.slot}
        </span>
        <div className="space-y-2">
          {pickable?.length && onPick ? (
            <select
              defaultValue=""
              onChange={(e) => {
                const task = pickable.find((item) => item.id === e.target.value);
                if (task) onPick(task);
                e.currentTarget.value = "";
              }}
              className="w-full rounded-2xl border border-[#002368]/15 bg-[#F4FBFF] px-3 py-2 text-sm"
            >
              <option value="">Add from my TAP…</option>
              {pickable.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.tap ? "TAP · " : ""}
                  {task.title}
                </option>
              ))}
            </select>
          ) : null}
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={line.hint}
            className="w-full rounded-2xl border border-[#002368]/15 px-3 py-2.5 text-sm"
            style={{ color: "#14233B", backgroundColor: "#ffffff" }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {source ? <span className="text-xs text-[#4f555f]">{source}</span> : null}
            <span className="ml-auto flex gap-2">
              {filled ? (
                <button
                  type="button"
                  onClick={onRemove}
                  className="rounded-full bg-[#FFF0F0] px-3 py-1 text-xs font-semibold text-[#9B2C2C]"
                >
                  Take out
                </button>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
