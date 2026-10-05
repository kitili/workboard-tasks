"use client";

import { useState, type ReactNode } from "react";
import { Pager } from "@/components/pager";

type RosterPerson = { name: string; role: string };
type RosterGroup = { name: string; tap?: string; people: RosterPerson[] };

const PAGE = 3;
const TONES = [
  { wash: "#D9ECF9", ink: "#002368", chip: "#80BFEC" },
  { wash: "#FFF7E5", ink: "#14233B", chip: "#FFC952" },
  { wash: "#F3EEFF", ink: "#3B1F7A", chip: "#C4B5FD" },
];

function PeopleGrid({ people }: { people: RosterPerson[] }) {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((person) => (
        <li key={`${person.name}-${person.role}`} className="rounded-2xl bg-white/80 px-3 py-2">
          <p className="text-sm font-semibold text-[#14233B]">{person.name}</p>
          <p className="text-xs text-[#4f555f]">{person.role}</p>
        </li>
      ))}
    </ul>
  );
}

export function TapRoster({
  title,
  people,
  groups = [],
  extra,
}: {
  title: string;
  people?: RosterPerson[];
  groups?: RosterGroup[];
  extra?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(groups.length / PAGE));
  const slice = groups.slice((page - 1) * PAGE, page * PAGE);

  return (
    <section className="mb-5 rounded-3xl border border-[#002368]/10 bg-white px-5 py-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">{title}</p>
      <h3 className="mt-1 text-lg font-semibold text-[#002368]">
        {groups.length > 0 ? "Who’s on each TAP" : "Who’s on this TAP"}
      </h3>
      <p className="mt-1 text-sm text-[#4f555f]">
        {groups.length > 0
          ? "Each block is a TAP. The small line is the workbook it came from."
          : "These names sit on this TAP. Support people can be added below."}
      </p>
      {groups.length > 0 ? (
        <div className="mt-4 grid gap-4">
          {slice.map((group, index) => {
            const tone = TONES[index % TONES.length];
            return (
              <div key={group.name} className="rounded-3xl px-4 py-4" style={{ background: tone.wash }}>
                <p className="text-sm font-semibold" style={{ color: tone.ink }}>
                  {group.name}
                </p>
                <p className="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: tone.chip, color: tone.ink }}>
                  From {group.tap ?? "this TAP"}
                </p>
                <PeopleGrid people={group.people} />
              </div>
            );
          })}
          <Pager page={page} pages={pages} onPage={setPage} />
        </div>
      ) : (
        <div className="mt-4 rounded-3xl bg-[#D9ECF9] px-4 py-4">
          <PeopleGrid people={people ?? []} />
        </div>
      )}
      {extra}
    </section>
  );
}
