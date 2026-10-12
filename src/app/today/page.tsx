import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isOpsCrew } from "@/lib/auth/admin";
import { deskTitle, viewerDeskSlug } from "@/lib/auth/desk";
import { getMyHistory, getTodaySheet, getTodayTapLineup } from "@/lib/services/daily-sheet";
import { TodayForm } from "@/components/today/today-form";
import { TaskHistory } from "@/components/today/task-history";
import { departmentNameFor } from "@/lib/departments";
import { syncUserDepartment } from "@/lib/services/departments";
import { syncTapTasks } from "@/lib/services/tap-sync";
import { tapDepartment, tapPeople } from "@/lib/data/tap-catalog";
import { TapRoster } from "@/components/board/tap-roster";
import { deskPermissions, getDepartmentTapDesk } from "@/lib/services/department-desk";
import { DepartmentTapDesk } from "@/components/desk/department-tap-desk";
import { getDefaultOrganization } from "@/lib/data/dashboard";

export const dynamic = "force-dynamic";

const DESK_BLURB = {
  operations:
    "Every ops rock and sub-rock, plus TAP that names Baraka, Francis, Kusaduka, or Shikunzi anywhere in the sheet. Baraka and Shikunzi can add people with roles. Drag your own cards; park today’s three on the team.",
  hr: "Every HR rock and sub-rock lives here. Park TAP on today’s 1–5s, share cards inside HR, and drag your own cards across Backlog, To do, Doing, and Done.",
  marketing:
    "Kilusu, Erick, and Mariam all sit on this desk. Pick TAP onto today’s 1–5s, share or allocate cards inside marketing, and drag your own cards to Backlog, To do, Doing, or Done.",
} as const;

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const departmentSlug = await syncUserDepartment(user.id);
  const person = { ...user, departmentSlug };
  const deskSlug = viewerDeskSlug(person);

  if (deskSlug) {
    const org = await getDefaultOrganization();
    if (!org) return <p className="text-zinc-500">No organization yet.</p>;
    const desk = await getDepartmentTapDesk(org.id, deskSlug, user.id);
    const access = deskPermissions(person, deskSlug);
    return (
      <DepartmentTapDesk
        slug={deskSlug}
        title={deskTitle(deskSlug)}
        blurb={DESK_BLURB[deskSlug]}
        viewerId={user.id}
        groups={desk.groups}
        people={desk.people}
        allocations={desk.allocations}
        myCards={desk.myCards}
        catalogNames={desk.catalogNames}
        canAssign={access.canAssign}
        canEditStatus={access.canEditStatus}
        canAddMembers={access.canAddMembers}
      />
    );
  }

  if (departmentSlug) {
    await syncTapTasks(user.organizationId, departmentSlug);
  }
  const [sheet, history, taps] = await Promise.all([
    getTodaySheet(user.organizationId),
    getMyHistory(user.id),
    getTodayTapLineup(user.id),
  ]);
  const me = sheet.people.find((row) => row.id === user.id);
  const departmentName = departmentNameFor(person);
  const crew = isOpsCrew(person);
  const roster = crew ? [] : tapPeople(departmentSlug);
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
        assignedOnly={false}
      />
      <TaskHistory entries={history.entries} diligence={history.diligence} />
    </div>
  );
}
