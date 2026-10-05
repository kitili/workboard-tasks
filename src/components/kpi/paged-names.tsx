"use client";

import { useState } from "react";
import { Pager } from "@/components/pager";

const SIZE = 6;

export function PagedNames({
  title,
  people,
  empty,
}: {
  title: string;
  people: Array<{ id: string; name: string; department?: string | null }>;
  empty: string;
}) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(people.length / SIZE));
  const slice = people.slice((page - 1) * SIZE, page * SIZE);

  return (
    <article className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#002368]/10">
      <h3 className="text-lg font-semibold">{title}</h3>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-[#4f555f]">{empty}</p>
      ) : (
        <>
          <ol className="mt-3 space-y-1 text-sm text-[#14233B]">
            {slice.map((person) => (
              <li key={person.id}>
                {person.name}
                {person.department ? <span className="text-[#4f555f]"> · {person.department}</span> : null}
              </li>
            ))}
          </ol>
          <div className="mt-3">
            <Pager page={Math.min(page, pages)} pages={pages} onPage={setPage} />
          </div>
        </>
      )}
    </article>
  );
}
