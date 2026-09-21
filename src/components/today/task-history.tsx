"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";

type Entry = {
  id: string;
  date: string;
  slot: number;
  title: string;
  priority: string | null;
  status: string;
  completedAt: string | null;
};

type Week = {
  weekStart: string;
  created: number;
  done: number;
  percent: number;
};

export function TaskHistory({ entries, diligence }: { entries: Entry[]; diligence: Week[] }) {
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");

  const visible = useMemo(() => {
    const start = new Date(from || "2026-09-01");
    const end = to ? new Date(`${to}T23:59:59`) : null;
    return entries.filter((entry) => {
      const day = new Date(entry.date);
      if (day < start) return false;
      if (end && day > end) return false;
      if (status === "done" && entry.status !== "COMPLETED") return false;
      if (status === "open" && entry.status === "COMPLETED") return false;
      return true;
    });
  }, [entries, from, to, status]);

  const visibleWeeks = diligence.filter((item) => new Date(item.weekStart) >= new Date(from || "2026-09-01"));
  const exportHref = `/api/me/export?status=${status}&from=${from || "2026-09-01"}&to=${to}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">History</h3>
          <p className="text-sm text-[#4f555f]">How much of each week’s 1–5 you finished.</p>
        </div>
        <a
          href={exportHref}
          className="rounded-xl border border-[#002368] px-4 py-2 text-sm font-medium text-[#002368]"
        >
          Export
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleWeeks.slice(0, 4).map((item) => (
          <article key={item.weekStart} className="rounded-2xl border border-[#002368]/10 bg-white p-4">
            <p className="text-xs text-[#818283]">Week of {format(new Date(item.weekStart), "d MMM")}</p>
            <p className="mt-2 text-3xl font-semibold text-[#002368]">{item.percent}%</p>
            <p className="mt-1 text-xs text-[#4f555f]">
              {item.done} of {item.created} finished
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#d9ecf9]">
              <div className="h-full rounded-full bg-[#ffc952]" style={{ width: `${item.percent}%` }} />
            </div>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="text-sm text-[#4f555f]">
          From
          <input
            type="date"
            min="2026-09-01"
            value={from}
            onChange={(e) => setFrom(e.target.value < "2026-09-01" ? "2026-09-01" : e.target.value)}
            className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm text-[#4f555f]">
          To
          <input
            type="date"
            min="2026-09-01"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="done">Done</option>
          <option value="open">Not done</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#002368]/10 bg-white">
        {visible.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#4f555f]">Nothing in this filter yet.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f4f7fb] text-[#4f555f]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-[#4f555f]">{format(new Date(entry.date), "d MMM yyyy")}</td>
                  <td className="px-4 py-3">
                    <span className="mr-2 text-[#818283]">{entry.slot}.</span>
                    {entry.title}
                  </td>
                  <td className="px-4 py-3 text-[#4f555f]">{entry.priority?.toLowerCase() ?? "—"}</td>
                  <td className="px-4 py-3">{entry.status === "COMPLETED" ? "Done" : "Open"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
