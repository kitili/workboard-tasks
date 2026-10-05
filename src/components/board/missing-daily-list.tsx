"use client";

import { useEffect, useMemo, useState } from "react";
import type { MissingDailyPerson } from "@/lib/board/types";
import { noonHasPassed } from "@/lib/board/missing-daily";
import { Pager } from "@/components/pager";

const SIZE = 3;

export function MissingDailyList({
  people,
  departmentName = null,
}: {
  people: MissingDailyPerson[];
  departmentName?: string | null;
}) {
  const [afterNoon, setAfterNoon] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    function refresh() {
      setAfterNoon(noonHasPassed());
    }
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    if (departmentName) return [{ name: departmentName, people }];
    const byDept = new Map<string, MissingDailyPerson[]>();
    for (const person of people) {
      const key = person.departmentName ?? "No department";
      byDept.set(key, [...(byDept.get(key) ?? []), person]);
    }
    return [...byDept.entries()].map(([name, rows]) => ({ name, people: rows }));
  }, [people, departmentName]);

  if (!afterNoon) return null;

  const pages = Math.max(1, Math.ceil(groups.length / SIZE));
  const slice = groups.slice((page - 1) * SIZE, page * SIZE);

  return (
    <section className="mb-5 rounded-3xl bg-[#FFF7E5] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#14233B]">After 12:00 EAT</p>
      <h3 className="mt-1 text-lg font-semibold text-[#002368]">Still to file</h3>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-[#4f555f]">
          {departmentName
            ? `Everyone in ${departmentName} has added today’s 1–5’s.`
            : "Everyone on a TAP has added today’s 1–5’s."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#4f555f]">
            {people.length} still missing{departmentName ? ` in ${departmentName}` : ""}.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {slice.map((group) => (
              <div key={group.name} className="rounded-2xl bg-white px-3 py-2">
                {departmentName ? null : (
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#002368]">{group.name}</p>
                )}
                <ol className="mt-1 text-sm text-[#14233B]">
                  {group.people.map((person) => (
                    <li key={person.id} className="py-0.5">
                      {person.name}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Pager page={Math.min(page, pages)} pages={pages} onPage={setPage} />
          </div>
        </>
      )}
    </section>
  );
}
