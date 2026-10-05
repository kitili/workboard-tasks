"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DAILY_LINES } from "@/lib/daily-lines";
import { normalizeTapTitle, type TodayTapChip } from "@/lib/today/tap-lineup";

type Row = { slot: number; title: string; taskId?: string | null };

const WASH = ["#D9ECF9", "#FFF7E5", "#F3EEFF"];

function rowsFrom(saved: Array<{ slot: number; title: string; taskId?: string | null }>): Row[] {
  return DAILY_LINES.map((line) => ({
    slot: line.slot,
    title: saved.find((item) => item.slot === line.slot)?.title ?? "",
    taskId: saved.find((item) => item.slot === line.slot)?.taskId ?? null,
  }));
}

function chipTaskId(chip: TodayTapChip) {
  return chip.id.startsWith("catalog:") ? null : chip.id;
}

export function TodayForm({
  filed,
  saved = [],
  lineup = [],
  more = [],
  departmentName = null,
}: {
  filed: boolean;
  saved?: Array<{ slot: number; title: string; taskId?: string | null }>;
  lineup?: TodayTapChip[];
  more?: TodayTapChip[];
  departmentName?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(saved));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [notice, setNotice] = useState(
    filed ? "Swap a TAP in, write a line, or take one out. Save when it feels right." : "Drag a TAP into 1, 2 or 3 — or tap it.",
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );

  const placed = useMemo(() => {
    const ids = new Set(rows.filter((row) => row.slot <= 3 && row.taskId).map((row) => row.taskId as string));
    const titles = new Set(rows.filter((row) => row.slot <= 3 && row.title.trim()).map((row) => normalizeTapTitle(row.title)));
    return { ids, titles };
  }, [rows]);

  const tray = lineup.filter((chip) => !placed.ids.has(chip.id) && !placed.titles.has(normalizeTapTitle(chip.title)));
  const extra = more.filter((chip) => !placed.ids.has(chip.id) && !placed.titles.has(normalizeTapTitle(chip.title)));

  function setRow(slot: number, patch: Partial<Row>) {
    setRows((current) => current.map((item) => (item.slot === slot ? { ...item, ...patch } : item)));
  }

  function placeChip(slot: number, chip: TodayTapChip) {
    if (slot > 3) return;
    setRows((current) =>
      current.map((row) => {
        if (row.slot === slot) return { slot: row.slot, title: chip.title, taskId: chipTaskId(chip) };
        if (row.taskId && (row.taskId === chip.id || row.taskId === chipTaskId(chip))) {
          return { slot: row.slot, title: "", taskId: null };
        }
        if (row.title.trim() && normalizeTapTitle(row.title) === normalizeTapTitle(chip.title)) {
          return { slot: row.slot, title: "", taskId: null };
        }
        return row;
      }),
    );
    setNotice("Parked on today’s list. Keep when you’re happy.");
  }

  function dropChipOnFirstEmpty(chip: TodayTapChip) {
    const empty = rows.find((row) => row.slot <= 3 && !row.title.trim());
    if (!empty) {
      setNotice("Those three are full. Take one out, or drop this TAP on a line.");
      return;
    }
    placeChip(empty.slot, chip);
  }

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over?.id;
    const chipId = String(event.active.id);
    if (!overId || !String(overId).startsWith("slot-")) return;
    const slot = Number(String(overId).replace("slot-", ""));
    const chip = [...lineup, ...more].find((item) => item.id === chipId);
    if (chip && slot >= 1 && slot <= 3) placeChip(slot, chip);
  }

  async function saveList(e: React.FormEvent) {
    e.preventDefault();
    const slots = rows.filter((row) => row.title.trim());
    if (slots.length === 0) {
      setError("Drop a TAP or write at least one line for today.");
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
    setNotice("Back in the TAP tray.");
    router.refresh();
  }

  const priorities = DAILY_LINES.filter((line) => line.slot <= 3);

  return (
    <form onSubmit={saveList} className="overflow-hidden rounded-3xl border border-[#002368]/10 bg-white shadow-sm">
      <div className="h-2 bg-[linear-gradient(90deg,#002368,#80BFEC,#FFC952)]" />
      <div className="space-y-6 p-6">
        {notice ? <p className="rounded-2xl bg-[#FFF7E5] px-4 py-3 text-sm text-[#14233B]">{notice}</p> : null}

        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <section className="space-y-3 rounded-3xl bg-[#F3EEFF] p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">Today’s TAP</p>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">
                {departmentName ? `${departmentName} lineup` : "Your lineup"}
              </h3>
              <p className="mt-1 text-sm text-[#4f555f]">
                Three open TAP lines. If yesterday’s went to Done, new ones show up here. Drag into 1–3, or tap to fill a blank.
              </p>
            </div>
            {tray.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {tray.map((chip, index) => (
                  <TapChip key={chip.id} chip={chip} wash={WASH[index % WASH.length]} onTap={() => dropChipOnFirstEmpty(chip)} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-[#4f555f]">
                {lineup.length
                  ? "Those TAP lines are already on today’s list."
                  : "No open TAP cards for you right now. Write your own 1–3 below."}
              </p>
            )}
            {extra.length ? (
              <div>
                <button
                  type="button"
                  onClick={() => setShowMore((value) => !value)}
                  className="text-xs font-semibold text-[#002368]"
                >
                  {showMore ? "Hide extra TAP" : `More open TAP (${extra.length})`}
                </button>
                {showMore ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {extra.map((chip, index) => (
                      <TapChip
                        key={chip.id}
                        chip={chip}
                        wash={WASH[(index + 1) % WASH.length]}
                        onTap={() => dropChipOnFirstEmpty(chip)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">01 — 03</p>
              <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">Drop today’s three</h3>
              <p className="mt-1 text-sm text-[#4f555f]">Blank until you park a TAP or write a line of your own.</p>
            </div>
            {priorities.map((line) => (
              <SlotField
                key={line.slot}
                line={line}
                value={rows[line.slot - 1]?.title ?? ""}
                onChange={(title) => setRow(line.slot, { title, taskId: null })}
                onRemove={() => void removeLine(line.slot)}
              />
            ))}
          </section>
        </DndContext>

        <section className="space-y-3 rounded-3xl bg-[#FFF7E5] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#14233B]">04</p>
            <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl text-[#002368]">The wobble</h3>
            <p className="mt-1 text-sm text-[#4f555f]">What might get in the way today.</p>
          </div>
          <NoteField
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
          <NoteField
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

function TapChip({
  chip,
  wash,
  onTap,
}: {
  chip: TodayTapChip;
  wash: string;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: chip.id });
  const style = {
    background: wash,
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onTap}
      className="rounded-3xl px-4 py-3 text-left shadow-sm ring-1 ring-[#002368]/10"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#002368]">{chip.source}</p>
      <p className="mt-1 text-sm font-semibold text-[#14233B]">{chip.title}</p>
    </button>
  );
}

function SlotField({
  line,
  value,
  onChange,
  onRemove,
}: {
  line: (typeof DAILY_LINES)[number];
  value: string;
  onChange: (title: string) => void;
  onRemove: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${line.slot}` });
  const filled = Boolean(value.trim());

  return (
    <div
      ref={setNodeRef}
      className={`rounded-3xl border p-3 ${
        isOver ? "border-[#002368] bg-[#D9ECF9]" : filled ? "border-[#002368]/10 bg-white" : "border-dashed border-[#002368]/25 bg-[#F8FBFF]"
      }`}
    >
      <div className="grid grid-cols-[40px_1fr] items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold on-navy">
          {line.slot}
        </span>
        <div className="space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={filled ? line.hint : "Drop a TAP here, or write your own"}
            className="w-full rounded-2xl border border-[#002368]/15 px-3 py-2.5 text-sm"
            style={{ color: "#14233B", backgroundColor: "#ffffff" }}
          />
          {filled ? (
            <button type="button" onClick={onRemove} className="rounded-full bg-[#FFF0F0] px-3 py-1 text-xs font-semibold text-[#9B2C2C]">
              Take out
            </button>
          ) : (
            <p className="text-xs text-[#4f555f]">Empty on purpose.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteField({
  line,
  value,
  onChange,
  onRemove,
}: {
  line: (typeof DAILY_LINES)[number];
  value: string;
  onChange: (title: string) => void;
  onRemove: () => void;
}) {
  const filled = Boolean(value.trim());
  return (
    <div className="rounded-3xl border border-[#002368]/8 bg-white/70 p-3">
      <div className="grid grid-cols-[40px_1fr] items-start gap-3">
        <span
          className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold bg-[#FFC952]"
          style={{ color: "#14233B", WebkitTextFillColor: "#14233B" }}
        >
          {line.slot}
        </span>
        <div className="space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={line.hint}
            className="w-full rounded-2xl border border-[#002368]/15 px-3 py-2.5 text-sm"
            style={{ color: "#14233B", backgroundColor: "#ffffff" }}
          />
          {filled ? (
            <button type="button" onClick={onRemove} className="rounded-full bg-[#FFF0F0] px-3 py-1 text-xs font-semibold text-[#9B2C2C]">
              Take out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
