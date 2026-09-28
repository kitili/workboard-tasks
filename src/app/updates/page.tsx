import { startOfDay } from "date-fns";
import { redirect } from "next/navigation";
import { Pager } from "@/components/pager";
import { PersonNotes } from "@/components/person-notes";
import { UpdatesFilter } from "@/components/updates-filter";
import { isUpdatesAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { listPeopleNotes } from "@/lib/services/updates";

export const dynamic = "force-dynamic";

function pageNumber(value: string | undefined) {
  const requested = Number(value ?? "1");
  return Number.isFinite(requested) ? requested : 1;
}

function parseDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "2026-09-01") return undefined;
  const day = startOfDay(new Date(`${value}T00:00:00`));
  return Number.isNaN(day.getTime()) ? undefined : day;
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    hpage?: string;
    from?: string;
    to?: string;
    hk?: string;
  }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!isUpdatesAdmin(user)) redirect("/today");

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const fromValue = params.from && params.from >= "2026-09-01" ? params.from : "2026-09-01";
  const toValue = params.to && params.to >= "2026-09-01" ? params.to : "";
  const historyKind = params.hk === "PROGRESS" || params.hk === "CHALLENGE" ? params.hk : "all";
  const peopleFilter = query ? { query } : {};
  const [today, history] = await Promise.all([
    listPeopleNotes(user.organizationId, user.id, pageNumber(params.page), null, {
      ...peopleFilter,
      day: "today",
    }),
    listPeopleNotes(user.organizationId, user.id, pageNumber(params.hpage), historyKind === "all" ? null : historyKind, {
      ...peopleFilter,
      day: "past",
      from: parseDay(fromValue),
      to: parseDay(toValue),
    }),
  ]);
  const exportQuery = new URLSearchParams();
  if (query) exportQuery.set("q", query);
  if (fromValue) exportQuery.set("from", fromValue);
  if (toValue) exportQuery.set("to", toValue);
  if (historyKind !== "all") exportQuery.set("hk", historyKind);
  const keep = {
    q: query || undefined,
    hpage: history.page > 1 ? history.page : undefined,
    from: fromValue === "2026-09-01" ? undefined : fromValue,
    to: toValue || undefined,
    hk: historyKind === "all" ? undefined : historyKind,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#002368]">Team</p>
          <h2 className="mt-1 text-2xl font-semibold">Updates</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Names only, until you open one. Today shows that person’s progress and challenge together. Earlier days are under History.
          </p>
        </div>
        <UpdatesFilter query={query} from={fromValue === "2026-09-01" ? undefined : fromValue} to={toValue || undefined} kind={historyKind} />
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[#002368]">Today</h3>
        <PersonNotes
          people={today.people}
          empty="No one has written today yet. Progress and challenges from 1–5’s show up here, one name at a time."
        />
        <Pager page={today.page} pages={today.pages} basePath="/updates" param="page" keep={keep} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[#002368]">History</h3>
            <p className="text-sm text-[#4f555f]">Earlier days, grouped by name. Open a name to read them.</p>
          </div>
          <a
            href={`/api/updates/export?${exportQuery.toString()}`}
            className="rounded-xl border border-[#002368] px-4 py-2 text-sm font-medium text-[#002368]"
          >
            Export
          </a>
        </div>

        <form method="get" action="/updates" className="flex flex-wrap items-end gap-2">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          <label className="text-sm text-[#4f555f]">
            From
            <input
              type="date"
              name="from"
              min="2026-09-01"
              defaultValue={fromValue}
              className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
              style={{ color: "#14233B" }}
            />
          </label>
          <label className="text-sm text-[#4f555f]">
            To
            <input
              type="date"
              name="to"
              min="2026-09-01"
              defaultValue={toValue}
              className="ml-2 rounded-xl border border-zinc-200 bg-white px-3 py-2"
              style={{ color: "#14233B" }}
            />
          </label>
          <select
            name="hk"
            defaultValue={historyKind}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
            style={{ color: "#14233B" }}
          >
            <option value="all">Progress and challenges</option>
            <option value="PROGRESS">Progress</option>
            <option value="CHALLENGE">Challenges</option>
          </select>
          <button type="submit" className="on-navy rounded-xl px-4 py-2 text-sm font-semibold">
            Filter
          </button>
        </form>

        <PersonNotes people={history.people} empty="Nothing in this range yet. Notes from before today show up here by name." />
        <Pager
          page={history.page}
          pages={history.pages}
          basePath="/updates"
          param="hpage"
          keep={{
            page: today.page > 1 ? today.page : undefined,
            q: query || undefined,
            from: fromValue === "2026-09-01" ? undefined : fromValue,
            to: toValue || undefined,
            hk: historyKind === "all" ? undefined : historyKind,
          }}
        />
      </section>
    </div>
  );
}
