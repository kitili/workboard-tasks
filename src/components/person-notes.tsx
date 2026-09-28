"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";

export type PersonNote = {
  id: string;
  body: string;
  kind: string;
  planDate: string;
  createdAt: string;
  unread: boolean;
};

export type PersonGroup = {
  id: string;
  name: string;
  total: number;
  notes: PersonNote[];
};

export function PersonNotes({
  people,
  empty,
  startOpen = false,
}: {
  people: PersonGroup[];
  empty: string;
  startOpen?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (startOpen && people[0]) setOpenId(people[0].id);
  }, [startOpen, people]);

  if (people.length === 0) {
    return <p className="rounded-2xl border border-[#002368]/10 bg-white px-5 py-8 text-sm text-[#4f555f]">{empty}</p>;
  }

  return (
    <ol className="overflow-hidden rounded-2xl border border-[#002368]/10 bg-white shadow-sm">
      {people.map((person) => {
        const open = openId === person.id;
        const hasProgress = person.notes.some((note) => note.kind === "PROGRESS");
        const hasChallenge = person.notes.some((note) => note.kind === "CHALLENGE");
        const fresh = person.notes.some((note) => note.unread);
        return (
          <li key={person.id} className="border-b border-[#002368]/10 last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : person.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[#f4f7fb]"
              aria-expanded={open}
            >
              <span className="min-w-0 truncate text-sm font-semibold" style={{ color: "#14233B" }}>
                {person.name}
                {fresh ? <span className="ml-2 text-[10px] font-semibold text-[#002368]">New</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs" style={{ color: "#4f555f" }}>
                {hasProgress ? <span className="rounded-full bg-[#D9ECF9] px-2 py-0.5 text-[#002368]">Progress</span> : null}
                {hasChallenge ? <span className="rounded-full bg-[#FFF7E5] px-2 py-0.5 text-[#14233B]">Challenge</span> : null}
                <span>
                  {person.total} {open ? "▾" : "▸"}
                </span>
              </span>
            </button>
            {open ? (
              <div className="space-y-3 border-t border-[#002368]/10 bg-[#f4f7fb] px-4 py-3">
                {groupByDay(person.notes).map((day) => (
                  <div key={day.key}>
                    <p className="text-xs font-semibold text-[#002368]">{format(new Date(`${day.key}T00:00:00`), "EEE d MMM yyyy")}</p>
                    <ul className="mt-1 space-y-2">
                      {day.notes.map((note) => (
                        <li key={note.id} className="rounded-xl bg-white px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#818283]">
                            {note.kind === "CHALLENGE" ? "Challenge" : "Progress"}
                          </p>
                          <p className="mt-1 text-sm text-[#14233B]">{note.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {person.total > person.notes.length ? (
                  <p className="text-xs text-[#4f555f]">Showing the latest {person.notes.length} of {person.total}. Narrow the dates to see more.</p>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function groupByDay(notes: PersonNote[]) {
  const groups = new Map<string, PersonNote[]>();
  for (const note of notes) {
    const key = format(new Date(note.planDate), "yyyy-MM-dd");
    const list = groups.get(key) ?? [];
    list.push(note);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, dayNotes]) => ({ key, notes: dayNotes }));
}
