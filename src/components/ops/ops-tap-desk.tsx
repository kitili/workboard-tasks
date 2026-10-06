"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { OpsDeskLine, OpsDeskPerson } from "@/lib/services/ops-desk";

type Group = {
  slug: string;
  name: string;
  tap: string;
  rocks: Array<{ parent: OpsDeskLine; children: OpsDeskLine[] }>;
};

const WASH = ["#D9ECF9", "#FFF7E5", "#F3EEFF", "#FFE8EE"];

function dayValue(iso: string | null) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(value);
}

function prettyDay(iso: string | null) {
  if (!iso) return "No date";
  const value = new Date(iso.includes("T") ? iso : `${iso}T00:00:00+03:00`);
  return Number.isNaN(value.getTime()) ? iso.slice(0, 10) : format(value, "d MMM yyyy");
}

export function OpsTapDesk({
  groups,
  people,
  canAssign,
}: {
  groups: Group[];
  people: OpsDeskPerson[];
  canAssign: boolean;
}) {
  const [desk, setDesk] = useState(groups);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  function applyDesk(next: Group[]) {
    setDesk(next);
  }

  async function assign(taskId: string, userId: string) {
    if (!userId) return;
    setPending(taskId);
    setNotice("");
    const res = await fetch("/api/ops/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, userId }),
    });
    const data = (await res.json()) as { error?: string; parked?: boolean; slot?: number | null; desk?: { groups: Group[] } };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not assign that TAP.");
      return;
    }
    if (data.desk) applyDesk(data.desk.groups);
    setNotice(
      data.parked
        ? `Parked on today’s line ${data.slot}. They can still swap it on My 1–5’s.`
        : "Assigned. Their 1–5 is full, so they can swap a line themselves.",
    );
  }

  async function saveDeadline(taskId: string, dueDate: string) {
    setPending(taskId);
    setNotice("");
    const res = await fetch(`/api/ops/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: dueDate || null }),
    });
    const data = (await res.json()) as { error?: string; desk?: { groups: Group[] } };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not keep that deadline.");
      return;
    }
    if (data.desk) applyDesk(data.desk.groups);
    setNotice("Deadline kept.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-3xl bg-[#002368] px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#80BFEC]">Cluster operations</p>
        <h2 className="mt-1 text-3xl font-semibold text-white">Majundo’s TAP desk</h2>
        <p className="mt-2 max-w-3xl text-sm text-[#D9ECF9]">
          Every ops OPSP line, plus Majundo’s TAP in ECE and other departments, grouped as rocks and sub-rocks.
          Assign who is doing a line today. The team can still edit their own 1–5’s if the plan changes.
        </p>
      </header>

      {notice ? <p className="rounded-2xl bg-[#FFF7E5] px-4 py-3 text-sm text-[#14233B]">{notice}</p> : null}

      {desk.map((group, index) => (
        <section key={group.slug} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#002368]/10">
          <div className="px-5 py-4" style={{ background: WASH[index % WASH.length] }}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#002368]">{group.name}</p>
            <h3 className="mt-1 text-xl font-semibold text-[#002368]">{group.tap}</h3>
          </div>
          <div className="divide-y divide-[#002368]/8">
            {group.rocks.map((rock) => (
              <div key={`${group.slug}-${rock.parent.code}`} className="px-3 py-3 sm:px-5">
                <LineRow
                  line={rock.parent}
                  rock
                  people={people}
                  canAssign={canAssign}
                  pending={pending}
                  onAssign={assign}
                  onDeadline={saveDeadline}
                />
                <div className="mt-2 space-y-2 border-l-4 border-[#80BFEC] pl-3 sm:pl-4">
                  {rock.children.map((child) => (
                    <LineRow
                      key={child.code}
                      line={child}
                      people={people}
                      canAssign={canAssign}
                      pending={pending}
                      onAssign={assign}
                      onDeadline={saveDeadline}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function LineRow({
  line,
  rock = false,
  people,
  canAssign,
  pending,
  onAssign,
  onDeadline,
}: {
  line: OpsDeskLine;
  rock?: boolean;
  people: OpsDeskPerson[];
  canAssign: boolean;
  pending: string | null;
  onAssign: (taskId: string, userId: string) => void;
  onDeadline: (taskId: string, dueDate: string) => void;
}) {
  const owners = [...line.owners, ...line.helpers].join(" / ") || "TAP";
  const busy = pending === line.taskId;
  const original = line.originalDeadline;
  const current = dayValue(line.dueDate);
  const moved = original && current && original !== current;

  return (
    <article className={`rounded-2xl px-3 py-3 ${rock ? "bg-[#F8FBFF]" : "bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[#002368] ${rock ? "text-base font-semibold" : "text-sm font-medium"}`}>
            <span className="mr-2 rounded-full bg-[#002368] px-2 py-0.5 text-xs font-semibold text-white">{line.code}</span>
            {line.title}
          </p>
          <p className="mt-1 text-xs text-[#4f555f]">
            TAP belongs to {owners}
            {line.today ? ` · Today: ${line.today.person ?? "staff"} on line ${line.today.slot}` : ""}
            {line.assignee?.name ? ` · Doing it: ${line.assignee.name}` : ""}
          </p>
        </div>
        <p className="text-xs font-semibold text-[#002368]">{line.status}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-[#002368]">
          Deadline
          <input
            type="date"
            value={current}
            disabled={!canAssign || !line.taskId || !line.owned || busy}
            onChange={(event) => line.taskId && onDeadline(line.taskId, event.target.value)}
            className="mt-1 block rounded-xl border border-[#002368]/15 px-3 py-1.5 text-sm"
          />
          <span className="mt-1 block font-normal text-[#4f555f]">
            Initial {original ? prettyDay(original) : "none"}
            {moved ? ` · now ${prettyDay(line.dueDate)}` : ""}
          </span>
        </label>
        {canAssign && line.taskId && line.owned ? (
          <label className="text-xs font-semibold text-[#002368]">
            Who does this today
            <select
              defaultValue=""
              disabled={busy}
              onChange={(event) => {
                if (event.target.value) onAssign(line.taskId as string, event.target.value);
                event.currentTarget.value = "";
              }}
              className="mt-1 block min-w-[12rem] rounded-xl border border-[#002368]/15 px-3 py-1.5 text-sm"
            >
              <option value="">Assign…</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </article>
  );
}