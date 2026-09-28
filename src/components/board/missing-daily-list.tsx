"use client";

import { useEffect, useState } from "react";
import type { MissingDailyPerson } from "@/lib/board/types";

function noonHasPassed() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour > 12 || (hour === 12 && minute >= 0);
}

export function MissingDailyList({ people }: { people: MissingDailyPerson[] }) {
  const [afterNoon, setAfterNoon] = useState(false);

  useEffect(() => {
    function refresh() {
      setAfterNoon(noonHasPassed());
    }
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!afterNoon) return null;

  return (
    <section className="mb-5 rounded-2xl border border-[#FFC952] bg-[#FFF7E5] px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#14233B]">After 12:00</p>
      <h3 className="mt-1 text-lg font-semibold text-[#002368]">Have not filled today’s 1–5’s</h3>
      {people.length === 0 ? (
        <p className="mt-2 text-sm text-[#4f555f]">Everyone in the system has listed their 1–5’s.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#4f555f]">
            {people.length} {people.length === 1 ? "person has" : "people have"} not listed today’s 1–5’s.
          </p>
          <ol className="mt-3 columns-1 gap-x-6 text-sm text-[#14233B] sm:columns-2 lg:columns-3">
            {people.map((person) => (
              <li key={person.id} className="break-inside-avoid py-0.5">
                {person.name}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
