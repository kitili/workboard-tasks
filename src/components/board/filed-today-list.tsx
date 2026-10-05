"use client";

import { useState } from "react";
import type { FiledTodayPerson } from "@/lib/board/types";
import { Pager } from "@/components/pager";

const SIZE = 6;

export function FiledTodayList({
  people,
  departmentName = null,
}: {
  people: FiledTodayPerson[];
  departmentName?: string | null;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(people.length / SIZE));
  const slice = people.slice((page - 1) * SIZE, page * SIZE);
  const scope = departmentName ? ` in ${departmentName}` : "";

  return (
    <section className="mb-5 rounded-3xl bg-[#D9ECF9] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">Today’s 1–5’s</p>
      <h3 className="mt-1 text-lg font-semibold text-[#002368]">
        {departmentName ? `${departmentName}: in for today` : "In for today"}
      </h3>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-[#4f555f]">No one{scope} has added today’s 1–5’s yet.</p>
      ) : (
        <>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slice.map((person) => (
              <li key={person.id} className="rounded-2xl bg-white px-3 py-2">
                <p className="text-sm font-semibold text-[#14233B]">{person.name}</p>
                {person.departmentName ? <p className="text-xs text-[#4f555f]">{person.departmentName}</p> : null}
                <ol className="mt-1 list-decimal pl-4 text-sm text-[#14233B]">
                  {person.titles.map((title) => (
                    <li key={title} className="py-0.5">
                      {title}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Pager page={Math.min(page, pages)} pages={pages} onPage={setPage} />
          </div>
        </>
      )}
    </section>
  );
}
