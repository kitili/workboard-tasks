import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getMyHistory, getTodaySheet } from "@/lib/services/daily-sheet";
import { TodayForm } from "@/components/today/today-form";
import { TaskHistory } from "@/components/today/task-history";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [sheet, history] = await Promise.all([
    getTodaySheet(user.organizationId),
    getMyHistory(user.id),
  ]);
  const me = sheet.people.find((person) => person.id === user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#002368]">
            {user.name ?? user.username}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">My tasks</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Fill today’s 1–5. Those exact lines stay in your history, numbered the way you wrote them.
          </p>
        </div>
        <Link href="/board" className="text-sm font-medium text-[#002368]">
          Open the board
        </Link>
      </div>
      <TodayForm existing={(me?.slots ?? []).map((slot) => ({ title: slot.title, priority: slot.priority }))} />
      <TaskHistory entries={history.entries} diligence={history.diligence} />
    </div>
  );
}
