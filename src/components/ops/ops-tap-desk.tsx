"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { OpsAllocation, OpsDeskLine, OpsDeskPerson } from "@/lib/services/ops-desk";

type Group = {
  slug: string;
  name: string;
  tap: string;
  rocks: Array<{ parent: OpsDeskLine; children: OpsDeskLine[] }>;
};

const WASH: Record<string, string> = {
  operations: "#D9ECF9",
  ece: "#FFF7E5",
  expansion: "#F3EEFF",
  "usa-river": "#FFE8EE",
  "arusha-modern": "#E8F7F1",
  boma: "#FFF0D9",
  kijenge: "#EDE7F6",
  ilboru: "#FCE4EC",
  "data-tech": "#E3F2FD",
};

const PERSON_WASH: Record<string, string> = {
  Baraka: "#002368",
  Francis: "#C45C26",
  Kusaduka: "#5B4B8A",
  Shikunzi: "#1F6B4A",
};

const STATUSES = [
  { value: "BACKLOG", label: "Backlog", wash: "#F3EEFF" },
  { value: "TODO", label: "To do", wash: "#D9ECF9" },
  { value: "IN_PROGRESS", label: "Doing", wash: "#FFF7E5" },
  { value: "COMPLETED", label: "Done", wash: "#E8F7F1" },
] as const;

function dayValue(iso: string | null) {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(value);
}

function prettyDay(iso: string | null) {
  if (!iso) return "none";
  const value = new Date(iso.includes("T") ? iso : `${iso}T00:00:00+03:00`);
  return Number.isNaN(value.getTime()) ? iso.slice(0, 10) : format(value, "d MMM");
}

function boardStatus(status: string) {
  if (status === "COMPLETED" || status === "Fully Completed" || status === "Completed") return "COMPLETED";
  if (status === "BACKLOG" || status === "Not Started") return "BACKLOG";
  if (status === "IN_PROGRESS" || status === "IN_REVIEW" || status === "BLOCKED") return "IN_PROGRESS";
  if (status === "Partially Completed" || status === "Behind Schedule" || status === "Ongoing") return "IN_PROGRESS";
  return "TODO";
}

export function OpsTapDesk({
  groups,
  people,
  allocations,
  canAssign,
  canEditStatus,
}: {
  groups: Group[];
  people: OpsDeskPerson[];
  allocations: OpsAllocation[];
  canAssign: boolean;
  canEditStatus: boolean;
}) {
  const [desk, setDesk] = useState(groups);
  const [board, setBoard] = useState(allocations);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ operations: true });

  function applyDesk(next: { groups?: Group[]; allocations?: OpsAllocation[] }) {
    if (next.groups) setDesk(next.groups);
    if (next.allocations) setBoard(next.allocations);
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
    const data = (await res.json()) as {
      error?: string;
      parked?: boolean;
      slot?: number | null;
      desk?: { groups: Group[]; allocations: OpsAllocation[] };
    };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not assign that TAP.");
      return;
    }
    if (data.desk) applyDesk(data.desk);
    const who = people.find((person) => person.id === userId)?.name ?? "them";
    setNotice(
      data.parked
        ? `On ${who}’s line ${data.slot} today.`
        : `${who} already has today’s three. Take one out first, then give this TAP.`,
    );
  }

  async function clearSlot(userId: string, slot: number) {
    setPending(`${userId}-${slot}`);
    setNotice("");
    const res = await fetch("/api/ops/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, slot, clear: true }),
    });
    const data = (await res.json()) as { error?: string; desk?: { groups: Group[]; allocations: OpsAllocation[] } };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not take that line back.");
      return;
    }
    if (data.desk) applyDesk(data.desk);
    setNotice("Taken off today’s three.");
  }

  async function patchLine(taskId: string, body: { dueDate?: string | null; status?: string }) {
    setPending(taskId);
    setNotice("");
    const res = await fetch(`/api/ops/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string; desk?: { groups: Group[]; allocations: OpsAllocation[] } };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not keep that TAP.");
      return;
    }
    if (data.desk) applyDesk(data.desk);
    setNotice(body.status ? "Sheet status kept." : "Deadline kept.");
  }

  const lines = desk.flatMap((group) => group.rocks.flatMap((rock) => [rock.parent, ...rock.children]));
  const done = lines.filter((line) => boardStatus(line.status) === "COMPLETED").length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="overflow-hidden rounded-[2rem] bg-[#002368] px-6 py-6 text-white shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#80BFEC]">Cluster operations</p>
        <h2 className="mt-1 text-3xl font-semibold" style={{ color: "#ffffff" }}>
          Majundo’s TAP desk
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#D9ECF9]">
          Every ops rock and sub-rock, plus TAP that names Baraka, Francis, Kusaduka, or Shikunzi anywhere in the sheet.
          Park today’s three on Baraka too. Marking Done, Doing, or Backlog writes the live sheet for the admin board.
        </p>
        <p className="mt-4 text-xs font-semibold text-[#80BFEC]">
          {lines.length} TAP lines · {done} done · today’s three for four people
        </p>
      </header>

      {notice ? (
        <p className="rounded-2xl bg-[#FFF7E5] px-4 py-3 text-sm text-[#14233B]">{notice}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {board.map((row) => {
          const color = PERSON_WASH[row.person.name] ?? "#002368";
          return (
            <article key={row.person.id} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#002368]/10">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ background: color }}
                >
                  {row.person.name}
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#80BFEC]">Today</p>
              </div>
              <div className="mt-3 space-y-2">
                {row.slots.map((item) => (
                  <div key={item.slot} className="rounded-2xl bg-[#F8FBFF] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#80BFEC]">Line {item.slot}</p>
                    <p className="mt-0.5 text-sm leading-5 text-[#14233B]">{item.title.trim() || "Open"}</p>
                    {canAssign && item.title.trim() ? (
                      <button
                        type="button"
                        disabled={pending === `${row.person.id}-${item.slot}`}
                        onClick={() => void clearSlot(row.person.id, item.slot)}
                        className="mt-1 text-xs font-semibold text-[#9B2C2C]"
                      >
                        Take out
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      {desk.map((group) => {
        const revealed = open[group.slug] ?? group.slug === "operations";
        return (
          <section key={group.slug} className="overflow-hidden rounded-[1.8rem] bg-white shadow-sm ring-1 ring-[#002368]/10">
            <button
              type="button"
              onClick={() => setOpen((current) => ({ ...current, [group.slug]: !revealed }))}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              style={{ background: WASH[group.slug] ?? "#D9ECF9" }}
            >
              <span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#002368]">{group.name}</p>
                <h3 className="mt-1 text-lg font-semibold text-[#002368]">{group.tap}</h3>
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#002368]">
                {revealed ? "Hide" : `${group.rocks.length} rocks`}
              </span>
            </button>
            {revealed ? (
              <div className="divide-y divide-[#002368]/8">
                {group.rocks.map((rock) => (
                  <div key={`${group.slug}-${rock.parent.code}`} className="px-3 py-3 sm:px-4">
                    <LineRow
                      line={rock.parent}
                      rock
                      people={people}
                      canAssign={canAssign}
                      canEditStatus={canEditStatus}
                      pending={pending}
                      onAssign={assign}
                      onDeadline={(taskId, dueDate) => void patchLine(taskId, { dueDate })}
                      onStatus={(taskId, status) => void patchLine(taskId, { status })}
                    />
                    {rock.children.length ? (
                      <div className="mt-2 space-y-2 border-l-4 border-[#80BFEC] pl-3 sm:pl-4">
                        {rock.children.map((child) => (
                          <LineRow
                            key={child.code}
                            line={child}
                            people={people}
                            canAssign={canAssign}
                            canEditStatus={canEditStatus}
                            pending={pending}
                            onAssign={assign}
                            onDeadline={(taskId, dueDate) => void patchLine(taskId, { dueDate })}
                            onStatus={(taskId, status) => void patchLine(taskId, { status })}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function LineRow({
  line,
  rock = false,
  people,
  canAssign,
  canEditStatus,
  pending,
  onAssign,
  onDeadline,
  onStatus,
}: {
  line: OpsDeskLine;
  rock?: boolean;
  people: OpsDeskPerson[];
  canAssign: boolean;
  canEditStatus: boolean;
  pending: string | null;
  onAssign: (taskId: string, userId: string) => void;
  onDeadline: (taskId: string, dueDate: string) => void;
  onStatus: (taskId: string, status: string) => void;
}) {
  const owners = [...line.owners, ...line.helpers].filter(Boolean);
  const busy = pending === line.taskId;
  const original = line.originalDeadline;
  const current = dayValue(line.dueDate);
  const currentStatus = boardStatus(line.status);
  const live = Boolean(line.taskId && line.owned);

  return (
    <article className={`rounded-2xl px-3 py-3 ${rock ? "bg-[#F8FBFF]" : "bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className={`min-w-0 flex-1 text-[#002368] ${rock ? "text-base font-semibold" : "text-sm font-medium"}`}>
          <span className="mr-2 inline-flex rounded-full bg-[#002368] px-2 py-0.5 text-[11px] font-semibold text-white">
            {line.code}
          </span>
          {line.title}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {owners.map((name) => (
          <span key={name} className="rounded-full bg-[#D9ECF9] px-2 py-0.5 text-[11px] font-semibold text-[#002368]">
            {name}
          </span>
        ))}
        {line.today ? (
          <span className="rounded-full bg-[#FFF7E5] px-2 py-0.5 text-[11px] font-semibold text-[#C45C26]">
            Today · {line.today.person ?? "staff"} L{line.today.slot}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {STATUSES.map((item) => {
          const active = currentStatus === item.value;
          return (
            <button
              key={item.value}
              type="button"
              disabled={!canEditStatus || !live || busy}
              onClick={() => line.taskId && onStatus(line.taskId, item.value)}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
              style={{
                background: active ? "#002368" : item.wash,
                color: active ? "white" : "#002368",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[11px] font-semibold text-[#002368]">
          Deadline
          <input
            type="date"
            value={current}
            disabled={!canAssign || !live || busy}
            onChange={(event) => line.taskId && onDeadline(line.taskId, event.target.value)}
            className="mt-1 block rounded-xl border border-[#002368]/15 px-3 py-1.5 text-sm"
          />
          <span className="mt-1 block font-normal text-[#4f555f]">
            Sheet {prettyDay(original)}
            {original && current && original !== current ? ` · now ${prettyDay(line.dueDate)}` : ""}
          </span>
        </label>
        {canAssign && live ? (
          <div className="flex flex-wrap gap-1.5">
            {people.map((person) => {
              const color = PERSON_WASH[person.name] ?? "#002368";
              const active = line.today?.person === person.name;
              return (
                <button
                  key={person.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onAssign(line.taskId as string, person.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{
                    background: active ? color : "white",
                    color: active ? "white" : color,
                    boxShadow: `inset 0 0 0 1px ${color}`,
                  }}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </article>
  );
}
