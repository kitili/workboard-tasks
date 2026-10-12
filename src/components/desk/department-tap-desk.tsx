"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { DeskAllocation, DeskCard, DeskLine, DeskPerson } from "@/lib/services/department-desk";
import type { DeskSlug } from "@/lib/auth/desk";
import { Pager } from "@/components/pager";

type Group = {
  slug: string;
  name: string;
  tap: string;
  rocks: Array<{ parent: DeskLine; children: DeskLine[] }>;
};

const WASH: Record<string, string> = {
  operations: "#D9ECF9",
  hr: "#FFF0D9",
  marketing: "#F3EEFF",
  ece: "#FFF7E5",
  expansion: "#F3EEFF",
  "usa-river": "#FFE8EE",
  "arusha-modern": "#E8F7F1",
  boma: "#FFF0D9",
  kijenge: "#EDE7F6",
  ilboru: "#FCE4EC",
  "data-tech": "#E3F2FD",
};

const PERSON_COLORS = ["#002368", "#C45C26", "#5B4B8A", "#1F6B4A", "#9B2C2C", "#0F6C8C"];
const CARD_PAGE_SIZE = 8;
const ROCK_PAGE_SIZE = 5;

const SHEET_DESK_COLUMNS = [
  { value: "TODO", label: "On Schedule", wash: "#D9ECF9", tapStatus: "On Schedule" },
  { value: "IN_PROGRESS", label: "Ongoing", wash: "#FFF7E5", tapStatus: "Ongoing" },
  { value: "BACKLOG", label: "Not Started", wash: "#ECECEC", tapStatus: "Not Started" },
  { value: "COMPLETED", label: "Fully Completed", wash: "#002368", tapStatus: "Fully Completed" },
] as const;

const SHEET_DESK_PHRASES = [
  { value: "TODO", label: "On Schedule", wash: "#D9ECF9", tapStatus: "On Schedule" },
  { value: "IN_PROGRESS", label: "Ongoing", wash: "#FFF7E5", tapStatus: "Ongoing" },
  { value: "IN_PROGRESS", label: "Partially Completed", wash: "#FFF7E5", tapStatus: "Partially Completed" },
  { value: "IN_PROGRESS", label: "Behind Schedule", wash: "#FFF0D9", tapStatus: "Behind Schedule" },
  { value: "BACKLOG", label: "Not Started", wash: "#ECECEC", tapStatus: "Not Started" },
  { value: "COMPLETED", label: "Fully Completed", wash: "#002368", tapStatus: "Fully Completed" },
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

function personColor(name: string, index: number) {
  if (name === "Baraka") return "#002368";
  if (name === "Francis") return "#C45C26";
  if (name === "Kusaduka") return "#5B4B8A";
  if (name === "Shikunzi") return "#1F6B4A";
  return PERSON_COLORS[index % PERSON_COLORS.length];
}

export function DepartmentTapDesk({
  slug,
  title,
  blurb,
  viewerId,
  groups,
  people,
  allocations,
  myCards,
  catalogNames,
  canAssign,
  canEditStatus,
  canAddMembers,
}: {
  slug: DeskSlug;
  title: string;
  blurb: string;
  viewerId: string;
  groups: Group[];
  people: DeskPerson[];
  allocations: DeskAllocation[];
  myCards: DeskCard[];
  catalogNames: string[];
  canAssign: boolean;
  canEditStatus: boolean;
  canAddMembers: boolean;
}) {
  const [desk, setDesk] = useState(groups);
  const [board, setBoard] = useState(allocations);
  const [cards, setCards] = useState(myCards);
  const [team, setTeam] = useState(people);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ [slug]: true, operations: true });
  const [rockPage, setRockPage] = useState<Record<string, number>>({});
  const [droppedId, setDroppedId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function applyDesk(next: { groups?: Group[]; allocations?: DeskAllocation[]; people?: DeskPerson[]; myCards?: DeskCard[] }) {
    if (next.groups) setDesk(next.groups);
    if (next.allocations) setBoard(next.allocations);
    if (next.people) setTeam(next.people);
    if (next.myCards) setCards(next.myCards);
  }

  async function assign(taskId: string, userId: string) {
    if (!userId) return;
    setPending(taskId);
    setNotice("");
    const res = await fetch(`/api/desk/${slug}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, userId }),
    });
    const data = (await res.json()) as {
      error?: string;
      parked?: boolean;
      slot?: number | null;
      desk?: { groups: Group[]; allocations: DeskAllocation[]; people: DeskPerson[]; myCards: DeskCard[] };
    };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not give that TAP.");
      return;
    }
    if (data.desk) applyDesk(data.desk);
    const who = team.find((person) => person.id === userId)?.name ?? "them";
    setNotice(
      data.parked
        ? `On ${who}’s line ${data.slot} today.`
        : `${who} already has today’s three. Take one out first, then give this TAP.`,
    );
  }

  async function clearSlot(userId: string, slot: number) {
    setPending(`${userId}-${slot}`);
    setNotice("");
    const res = await fetch(`/api/desk/${slug}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, slot, clear: true }),
    });
    const data = (await res.json()) as { error?: string; desk?: { groups: Group[]; allocations: DeskAllocation[]; people: DeskPerson[]; myCards: DeskCard[] } };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not take that line back.");
      return;
    }
    if (data.desk) applyDesk(data.desk);
    setNotice("Taken off today’s three.");
  }

  async function patchLine(taskId: string, body: { dueDate?: string | null; status?: string; tapStatus?: string; shareWith?: string; assigneeId?: string | null }) {
    setPending(taskId);
    setNotice("");
    const res = await fetch(`/api/desk/${slug}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { error?: string; desk?: { groups: Group[]; allocations: DeskAllocation[]; people: DeskPerson[]; myCards: DeskCard[] } };
    setPending(null);
    if (!res.ok) {
      setNotice(data.error ?? "Could not keep that TAP.");
      return;
    }
    if (data.desk) applyDesk(data.desk);
    setNotice(body.tapStatus ? `Sheet says ${body.tapStatus}.` : body.status ? "Card moved." : body.shareWith ? "Shared with the team." : "Kept.");
  }

  async function onCardDrop(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const over = event.over?.id ? String(event.over.id) : "";
    const next = SHEET_DESK_COLUMNS.find((item) => item.value === over);
    const card = cards.find((item) => item.id === taskId);
    if (!next || !card || boardStatus(card.status) === next.value) return;
    if (boardStatus(card.status) === "COMPLETED") {
      setNotice("That card is already done. It stays completed.");
      return;
    }
    if (next.value === "TODO" && boardStatus(card.status) !== "TODO") {
      setNotice("That card has already been touched. It does not go back to untouched tasks.");
      return;
    }
    setDroppedId(taskId);
    setCards((current) => current.map((item) => (item.id === taskId ? { ...item, status: next.value } : item)));
    await patchLine(taskId, { status: next.value });
  }

  const pile = SHEET_DESK_COLUMNS;
  const phrases = SHEET_DESK_PHRASES;
  const lines = desk.flatMap((group) => group.rocks.flatMap((rock) => [rock.parent, ...rock.children]));
  const done = lines.filter((line) => boardStatus(line.status) === "COMPLETED").length;
  const mine = useMemo(() => {
    const grouped: Record<string, DeskCard[]> = { BACKLOG: [], TODO: [], IN_PROGRESS: [], COMPLETED: [] };
    for (const card of cards) grouped[boardStatus(card.status)].push(card);
    return grouped;
  }, [cards]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="overflow-hidden rounded-[2rem] bg-[#002368] px-6 py-6 text-white shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#80BFEC]">{slug === "operations" ? "Cluster operations" : slug === "hr" ? "Human resource" : slug === "data-tech" ? "Data & Tech" : "Marketing & partnership"}</p>
        <h2 className="mt-1 text-3xl font-semibold" style={{ color: "#ffffff" }}>
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#D9ECF9]">{blurb}</p>
        <p className="mt-4 text-xs font-semibold text-[#80BFEC]">
          {lines.length} TAP lines · {done} done · {team.length} people present
        </p>
      </header>

      {notice ? <p className="rounded-2xl bg-[#FFF7E5] px-4 py-3 text-sm text-[#14233B]">{notice}</p> : null}

      <section className="rounded-[1.8rem] bg-white p-4 shadow-sm ring-1 ring-[#002368]/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#002368]">People present</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {team.map((person, index) => (
            <span
              key={person.id}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: personColor(person.name, index) }}
            >
              {person.name}
              {person.role ? ` · ${person.role}` : ""}
            </span>
          ))}
        </div>
        {catalogNames.length ? (
          <p className="mt-3 text-xs text-[#4f555f]">On the TAP: {catalogNames.join(" · ")}</p>
        ) : null}
        {canAddMembers ? <AddMemberForm slug={slug} onAdded={(desk) => { applyDesk(desk); setNotice("They can log in and move their own cards."); }} /> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {board.map((row, index) => {
          const color = personColor(row.person.name, index);
          return (
            <article key={row.person.id} className="rounded-[1.6rem] bg-white p-4 shadow-sm ring-1 ring-[#002368]/10">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: color }}>
                  {row.person.name}
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#80BFEC]">Today</p>
              </div>
              <div className="mt-3 space-y-2">
                {row.slots.map((item) => (
                  <div key={item.slot} className="rounded-2xl bg-[#F8FBFF] px-3 py-2">
                    <p className="text-[11px] font-semibold text-[#80BFEC]">Line {item.slot}</p>
                    <p className="mt-0.5 text-sm leading-5 text-[#14233B]">{item.title.trim() || "Open"}</p>
                    {(canAssign || row.person.id === viewerId) && item.title.trim() ? (
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

      <section className="rounded-[1.8rem] bg-white p-4 shadow-sm ring-1 ring-[#002368]/10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#002368]">My TAP cards</p>
        <p className="mt-1 text-sm text-[#4f555f]">Only your cards. Drag them to On Schedule, Ongoing, Not Started, or Fully Completed.</p>
        <DndContext sensors={sensors} onDragEnd={(event) => void onCardDrop(event)}>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pile.map((column) => (
              <CardColumn
                key={column.value}
                status={column.value}
                label={column.label}
                wash={column.wash}
                cards={mine[column.value] ?? []}
                focusId={droppedId}
              />
            ))}
          </div>
        </DndContext>
      </section>

      {desk.map((group) => {
        const revealed = open[group.slug] ?? group.slug === slug;
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
              <RockPages
                rocks={group.rocks}
                page={rockPage[group.slug] ?? 1}
                onPage={(page) => setRockPage((current) => ({ ...current, [group.slug]: page }))}
                renderRock={(rock) => (
                  <div key={`${group.slug}-${rock.parent.code}`} className="px-3 py-3 sm:px-4">
                    <LineRow
                      line={rock.parent}
                      rock
                      people={team}
                      viewerId={viewerId}
                      canAssign={canAssign}
                      canEditStatus={canEditStatus}
                      pending={pending}
                      onAssign={assign}
                      onDeadline={(taskId, dueDate) => void patchLine(taskId, { dueDate })}
                      onStatus={(taskId, status, tapStatus) => void patchLine(taskId, { status, tapStatus })}
                      onShare={(taskId, userId) => void patchLine(taskId, { shareWith: userId })}
                      phrases={phrases}
                    />
                    {rock.children.length ? (
                      <div className="mt-2 space-y-2 border-l-4 border-[#80BFEC] pl-3 sm:pl-4">
                        {rock.children.map((child) => (
                          <LineRow
                            key={child.code}
                            line={child}
                            people={team}
                            viewerId={viewerId}
                            canAssign={canAssign}
                            canEditStatus={canEditStatus}
                            pending={pending}
                            onAssign={assign}
                            onDeadline={(taskId, dueDate) => void patchLine(taskId, { dueDate })}
                            onStatus={(taskId, status, tapStatus) => void patchLine(taskId, { status, tapStatus })}
                            onShare={(taskId, userId) => void patchLine(taskId, { shareWith: userId })}
                            phrases={phrases}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function CardColumn({
  status,
  label,
  wash,
  cards,
  focusId,
}: {
  status: string;
  label: string;
  wash: string;
  cards: DeskCard[];
  focusId?: string | null;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(cards.length / CARD_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * CARD_PAGE_SIZE;
  const visible = cards.slice(start, start + CARD_PAGE_SIZE);
  const { setNodeRef, isOver } = useDroppable({ id: status });

  useEffect(() => {
    if (!focusId) return;
    const index = cards.findIndex((card) => card.id === focusId);
    if (index >= 0) setPage(Math.floor(index / CARD_PAGE_SIZE) + 1);
  }, [focusId, cards]);

  return (
    <div ref={setNodeRef} className="rounded-2xl p-3" style={{ background: wash, outline: isOver ? "2px solid #002368" : undefined }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#002368]">
        {label} · {cards.length}
      </p>
      <div className="mt-2 space-y-2 min-h-[4.5rem]">
        {visible.map((card) => (
          <MineCard key={card.id} card={card} />
        ))}
      </div>
      <div className="mt-3">
        <Pager page={safePage} pages={pages} onPage={setPage} />
      </div>
    </div>
  );
}

function RockPages({
  rocks,
  page,
  onPage,
  renderRock,
}: {
  rocks: Array<{ parent: DeskLine; children: DeskLine[] }>;
  page: number;
  onPage: (page: number) => void;
  renderRock: (rock: { parent: DeskLine; children: DeskLine[] }) => ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(rocks.length / ROCK_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * ROCK_PAGE_SIZE;
  const visible = rocks.slice(start, start + ROCK_PAGE_SIZE);
  return (
    <div>
      <div className="divide-y divide-[#002368]/8">{visible.map((rock) => renderRock(rock))}</div>
      <div className="px-4 py-3">
        <Pager page={safePage} pages={pages} onPage={onPage} />
      </div>
    </div>
  );
}

function MineCard({ card }: { card: DeskCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-2xl bg-white px-3 py-2 text-sm text-[#14233B] shadow-sm ring-1 ring-[#002368]/10 active:cursor-grabbing"
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.6 : 1 }}
    >
      {card.title}
    </article>
  );
}

function AddMemberForm({
  slug,
  onAdded,
}: {
  slug: DeskSlug;
  onAdded: (desk: { groups: Group[]; allocations: DeskAllocation[]; people: DeskPerson[]; myCards: DeskCard[] }) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    const res = await fetch(`/api/desk/${slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role: role || undefined, email: email || undefined }),
    });
    const data = (await res.json()) as { error?: string; desk?: { groups: Group[]; allocations: DeskAllocation[]; people: DeskPerson[]; myCards: DeskCard[] } };
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Could not add that person.");
      return;
    }
    setName("");
    setRole("");
    setEmail("");
    if (data.desk) onAdded(data.desk);
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 rounded-2xl bg-[#FFF7E5] px-4 py-3">
      <p className="text-sm font-semibold text-[#002368]">Add someone and give them a role</p>
      <p className="mt-1 text-xs text-[#4f555f]">They get this TAP portal and can move cards you give them.</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-[#002368]">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required className="mt-1 block rounded-xl border border-[#002368]/15 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-[#002368]">
          Role
          <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="Transport lead" className="mt-1 block rounded-xl border border-[#002368]/15 px-3 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-semibold text-[#002368]">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="name@silverleaf.co.tz" className="mt-1 block min-w-[16rem] rounded-xl border border-[#002368]/15 px-3 py-1.5 text-sm" />
        </label>
        <button type="submit" disabled={pending} className="on-navy rounded-full px-4 py-2 text-sm font-semibold">
          {pending ? "Adding…" : "Add to the desk"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-[#9B2C2C]">{error}</p> : null}
    </form>
  );
}

function LineRow({
  line,
  rock = false,
  people,
  viewerId,
  canAssign,
  canEditStatus,
  pending,
  onAssign,
  onDeadline,
  onStatus,
  onShare,
  phrases,
}: {
  line: DeskLine;
  rock?: boolean;
  people: DeskPerson[];
  viewerId: string;
  canAssign: boolean;
  canEditStatus: boolean;
  pending: string | null;
  onAssign: (taskId: string, userId: string) => void;
  onDeadline: (taskId: string, dueDate: string) => void;
  onStatus: (taskId: string, status: string, tapStatus?: string) => void;
  phrases: ReadonlyArray<{ value: string; label: string; wash: string; tapStatus: string }>;
  onShare: (taskId: string, userId: string) => void;
}) {
  const owners = [...line.owners, ...line.helpers].filter(Boolean);
  const busy = pending === line.taskId;
  const original = line.originalDeadline;
  const current = dayValue(line.dueDate);
  const currentStatus = boardStatus(line.status);
  const live = Boolean(line.taskId && line.owned);
  const canGive = Boolean(live && (canAssign || true));

  return (
    <article className={`rounded-2xl px-3 py-3 ${rock ? "bg-[#F8FBFF]" : "bg-white"}`}>
      <p className={`min-w-0 text-[#002368] ${rock ? "text-base font-semibold" : "text-sm font-medium"}`}>
        <span className="mr-2 inline-flex rounded-full bg-[#002368] px-2 py-0.5 text-[11px] font-semibold text-white">{line.code}</span>
        {line.title}
      </p>
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
        {phrases.map((item) => {
          const active = item.tapStatus ? line.sheetStatus === item.tapStatus : currentStatus === item.value;
          const locked = currentStatus === "COMPLETED" || (item.value === "TODO" && currentStatus !== "TODO");
          return (
            <button
              key={item.tapStatus || item.value}
              type="button"
              disabled={!canEditStatus || !live || busy || locked}
              onClick={() => line.taskId && onStatus(line.taskId, item.value, item.tapStatus || undefined)}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
              style={{
                background: active ? "#002368" : item.wash,
                color: active || item.wash === "#002368" ? "white" : "#002368",
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
        {canGive && live ? (
          <div className="flex flex-wrap gap-1.5">
            {people.map((person, index) => {
              const color = personColor(person.name, index);
              const active = line.today?.person === person.name;
              const allow = canAssign || person.id === viewerId;
              return (
                <button
                  key={person.id}
                  type="button"
                  disabled={busy || !allow}
                  onClick={() => onAssign(line.taskId as string, person.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  style={{
                    background: active ? color : "white",
                    color: active ? "white" : color,
                    boxShadow: `inset 0 0 0 1px ${color}`,
                  }}
                >
                  {person.id === viewerId ? "My 1–5" : person.name}
                </button>
              );
            })}
            <select
              defaultValue=""
              disabled={busy}
              onChange={(event) => {
                if (event.target.value && line.taskId) onShare(line.taskId, event.target.value);
                event.currentTarget.value = "";
              }}
              className="rounded-full border border-[#002368]/15 px-3 py-1.5 text-xs"
            >
              <option value="">Share card…</option>
              {people
                .filter((person) => person.id !== viewerId)
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </div>
    </article>
  );
}
