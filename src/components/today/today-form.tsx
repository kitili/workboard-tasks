"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Row = { title: string; priority: string | null; locked: boolean };

const EMPTY = (): Row => ({ title: "", priority: null, locked: false });

export function TodayForm({
  existing,
}: {
  existing: Array<{ title: string; priority: string | null }>;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => {
    const filled = existing.slice(0, 5).map((item) => ({
      title: item.title,
      priority: item.priority,
      locked: true,
    }));
    while (filled.length < 5) filled.push(EMPTY());
    return filled;
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
        slots: slots.map((row) => ({ title: row.title, priority: row.priority })),
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

  return (
    <div className="space-y-4">
      <form onSubmit={saveList} className="rounded-2xl border border-[#002368]/10 bg-white p-6">
        <h3 className="text-lg font-semibold">Daily 1–5</h3>
        <p className="mt-1 text-sm text-[#4f555f]">Fill the lines you have. Blank lines are skipped.</p>
        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-[36px_1fr_150px] items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#002368] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <input
                value={row.title}
                disabled={row.locked}
                onChange={(e) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)),
                  )
                }
                placeholder={`Task ${index + 1}`}
                className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm disabled:bg-[#f4f7fb]"
              />
              <select
                value={row.priority ?? ""}
                disabled={row.locked}
                onChange={(e) =>
                  setRows((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, priority: e.target.value || null } : item,
                    ),
                  )
                }
                className="rounded-xl border border-zinc-200 px-3 py-2.5 text-sm disabled:bg-[#f4f7fb]"
              >
                <option value="">No priority</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="HIGHEST">Highest</option>
              </select>
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-xl bg-[#002368] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add to my tasks"}
        </button>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </form>
    </div>
  );
}
