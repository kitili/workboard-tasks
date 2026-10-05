import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getMyHistory, getTodaySheet, getTodayTapLineup } from "@/lib/services/daily-sheet";
import { TodayForm } from "@/components/today/today-form";
import { TaskHistory } from "@/components/today/task-history";
import { departmentNameFor } from "@/lib/departments";
import { syncUserDepartment } from "@/lib/services/departments";
import { syncTapTasks } from "@/lib/services/tap-sync";
import { tapDepartment, tapPeople } from "@/lib/data/tap-catalog";
import { TapRoster } from "@/components/board/tap-roster";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const departmentSlug = await syncUserDepartment(user.id);
  if (departmentSlug) {
    await syncTapTasks(user.organizationId, departmentSlug);
  }
  const person = { ...user, departmentSlug };
  const [sheet, history, taps] = await Promise.all([
    getTodaySheet(user.organizationId),
    getMyHistory(user.id),
    getTodayTapLineup(user.id),
  ]);
  const me = sheet.people.find((row) => row.id === user.id);
  const departmentName = departmentNameFor(person);
  const roster = tapPeople(departmentSlug);
  const tap = tapDepartment(departmentSlug);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-[#D9ECF9] px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#002368]">
            {user.name ?? user.username}
            {departmentName ? ` · ${departmentName}` : ""}
          </p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-[#002368]">My 1–5’s</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4f555f]">
            {departmentName
              ? `Park up to three open ${departmentName} TAP lines into today’s blanks. Done ones rotate out tomorrow.`
              : "Park up to three open TAP lines into today’s blanks. Done ones rotate out tomorrow."}
          </p>
        </div>
        <Link href="/board?mine=1" className="on-navy rounded-full px-4 py-2.5 text-sm font-semibold">
          Open my board
        </Link>
      </div>
      {roster.length ? <TapRoster title={tap?.tap ?? "TAP"} people={roster} /> : null}
      <TodayForm
        filed={(me?.slots.length ?? 0) > 0}
        saved={me?.slots ?? []}
        lineup={taps.lineup}
        more={taps.more}
        departmentName={departmentName}
      />
      <TaskHistory entries={history.entries} diligence={history.diligence} />
    </div>
  );
}
