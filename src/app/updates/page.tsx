import { format } from "date-fns";
import { redirect } from "next/navigation";
import { Pager } from "@/components/pager";
import { UpdatesFilter } from "@/components/updates-filter";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listUpdates } from "@/lib/services/updates";

export const dynamic = "force-dynamic";

function pageNumber(value: string | undefined) {
  const requested = Number(value ?? "1");
  return Number.isFinite(requested) ? requested : 1;
}

export default async function UpdatesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; challenges?: string; who?: string; q?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const people = await db.user.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    select: { id: true, name: true, username: true },
    orderBy: { name: "asc" },
  });
  const selected = people.some((person) => person.id === params.who) ? params.who! : "all";
  const filter = {
    ...(selected === "all" ? {} : { authorId: selected }),
    ...(query ? { query } : {}),
  };
  const [progress, challenges] = await Promise.all([
    listUpdates(user.organizationId, user.id, pageNumber(params.page), "PROGRESS", filter),
    listUpdates(user.organizationId, user.id, pageNumber(params.challenges), "CHALLENGE", filter),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#002368]">Team</p>
          <h2 className="mt-1 text-2xl font-semibold">Updates</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Everyone’s progress and challenges. Use Show to look at one name.
          </p>
        </div>
        <UpdatesFilter
          who={selected}
          query={query}
          people={people.map((person) => ({
            id: person.id,
            label: person.name ?? person.username ?? "Someone",
          }))}
        />
      </div>

      <NoteSection
        title="Progress"
        empty="No progress yet. When someone fills Progress recap on 1-5's, it shows up here."
        notes={progress.updates}
        page={progress.page}
        pages={progress.pages}
        param="page"
        keep={{
          challenges: challenges.page > 1 ? challenges.page : undefined,
          who: selected === "all" ? undefined : selected,
          q: query || undefined,
        }}
      />

      <NoteSection
        title="Challenges"
        empty="No challenges yet. When someone writes a challenge on 1-5's, it shows up here."
        notes={challenges.updates}
        page={challenges.page}
        pages={challenges.pages}
        param="challenges"
        keep={{
          page: progress.page > 1 ? progress.page : undefined,
          who: selected === "all" ? undefined : selected,
          q: query || undefined,
        }}
        tone="challenge"
      />
    </div>
  );
}

function NoteSection({
  title,
  empty,
  notes,
  page,
  pages,
  param,
  keep,
  tone = "progress",
}: {
  title: string;
  empty: string;
  notes: Array<{
    id: string;
    body: string;
    planDate: string;
    createdAt: string;
    authorName: string;
    unread: boolean;
  }>;
  page: number;
  pages: number;
  param: string;
  keep: Record<string, string | number | undefined>;
  tone?: "progress" | "challenge";
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-[#002368]">{title}</h3>
      {notes.length === 0 ? (
        <p className="rounded-2xl border border-[#002368]/10 bg-white px-5 py-8 text-sm text-[#4f555f]">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border bg-white px-5 py-4 shadow-sm ${
                item.unread
                  ? tone === "challenge"
                    ? "border-[#FFC952]"
                    : "border-[#80BFEC]"
                  : "border-[#002368]/10"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#002368]">{item.authorName}</p>
                {item.unread ? (
                  <span className="rounded-full bg-[#FFC952] px-2 py-0.5 text-[10px] font-semibold text-[#14233B]">
                    New
                  </span>
                ) : null}
                <p className="text-xs text-[#818283]">
                  {format(new Date(item.planDate), "EEE d MMM")} · {format(new Date(item.createdAt), "HH:mm")}
                </p>
              </div>
              <p className="mt-2 text-sm text-[#14233B]">{item.body}</p>
            </li>
          ))}
        </ol>
      )}
      <Pager page={page} pages={pages} basePath="/updates" param={param} keep={keep} />
    </section>
  );
}
