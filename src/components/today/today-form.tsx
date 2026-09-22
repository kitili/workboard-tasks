"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAILY_LINES } from "@/lib/daily-lines";

type Row = { slot: number; title: string; priority: string | null; locked: boolean };

export function TodayForm({
  existing,
}: {
  existing: Array<{ slot: number; title: string; priority: string | null }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => {
    const bySlot = new Map(existing.map((item) => [item.slot, item]));
    return DAILY_LINES.map((line) => {
      const saved = bySlot.get(line.slot);
      return {
        slot: line.slot,
        title: saved?.title ?? "",
        priority: saved?.priority ?? null,
        locked: Boolean(saved),
      };
    });
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveList(e: React.FormEvent) {
    e.preventDefault();
    const slots = rows.filter((row) => !row.locked && row.title.trim());
    if (slots.length === 0) {
      setError("Fill in at least one open line.");
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
          priority: row.slot <= 3 ? row.priority : null,
        })),
      }),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add those tasks");
      return;
    }
    router.refresh();
  }

  const priorities = DAILY_LINES.filter((line) => line.slot <= 3);
  const challenge = DAILY_LINES[3];
  const yesterday = DAILY_LINES[4];

  return (
    <form onSubmit={saveList} className="space-y-5 rounded-2xl border border-[#002368]/10 bg-white p-6">
      <div>
        <h3 className="text-lg font-semibold">Today’s three priorities</h3>
        <p className="mt-1 text-sm text-[#4f555f]">Write the ones you have. Blank lines stay empty.</p>
      </div>

      <div className="space-y-3">
        {priorities.map((line) => (
          <LineField
            key={line.slot}
            line={line}
            row={rows[line.slot - 1]}
            showPriority
            onChange={(patch) =>
              setRows((current) => current.map((item) => (item.slot === line.slot ? { ...item, ...patch } : item)))
            }
          />
        ))}
      </div>

      <div className="space-y-3 border-t border-[#002368]/10 pt-5">
        <h3 className="text-lg font-semibold">Challenge</h3>
        <p className="text-sm text-[#4f555f]">Setbacks that got in the way of those priorities.</p>
        <LineField
          line={challenge}
          row={rows[3]}
          onChange={(patch) =>
            setRows((current) => current.map((item) => (item.slot === 4 ? { ...item, ...patch } : item)))
          }
        />
      </div>

      <div className="space-y-3 border-t border-[#002368]/10 pt-5">
        <h3 className="text-lg font-semibold">Yesterday</h3>
        <p className="text-sm text-[#4f555f]">Progress or updates on yesterday’s priorities.</p>
        <LineField
          line={yesterday}
          row={rows[4]}
          onChange={(patch) =>
            setRows((current) => current.map((item) => (item.slot === 5 ? { ...item, ...patch } : item)))
          }
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#002368] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add to my tasks"}
      </button>
      {error ? <p className="text-sm text-[#002368]">{error}</p> : null}
    </form>
  );
}

function LineField({
  line,
  row,
  showPriority,
  onChange,
}: {
  line: (typeof DAILY_LINES)[number];
  row: Row;
  showPriority?: boolean;
  onChange: (patch: Partial<Pick<Row, "title" | "priority">>) => void;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr] items-center gap-3 sm:grid-cols-[36px_1fr_150px]">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
          line.slot === 4
            ? "bg-[#FFC952] text-[#14233B]"
            : line.slot === 5
              ? "bg-[#80BFEC] text-[#002368]"
              : "bg-[#002368] text-white"
        }`}
      >
        {line.slot}
      </span>
      <input
        value={row.title}
        disabled={row.locked}
        onChange={(e) => onChange({ title: e.target.value })}
        placeholder={line.hint}
        className="rounded-xl border border-[#002368]/15 px-3 py-2.5 text-sm disabled:bg-[#f4f7fb]"
      />
      {showPriority ? (
        <select
          value={row.priority ?? ""}
          disabled={row.locked}
          onChange={(e) => onChange({ priority: e.target.value || null })}
          className="col-start-2 rounded-xl border border-[#002368]/15 px-3 py-2.5 text-sm disabled:bg-[#f4f7fb] sm:col-start-auto"
        >
          <option value="">No priority</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="HIGHEST">Highest</option>
        </select>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
}
