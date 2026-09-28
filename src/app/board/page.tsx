import { redirect } from "next/navigation";
import { isBoardAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { getOrganizationBoard } from "@/lib/data/board";
import { KanbanBoard } from "@/components/board/kanban-board";
import { getTodaySheet } from "@/lib/services/daily-sheet";
import type { BoardTask } from "@/lib/board/types";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const [session, org, params] = await Promise.all([getSessionUser(), getDefaultOrganization(), searchParams]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;

  const admin = isBoardAdmin(session);
  const mine = !admin || params.mine === "1";
  const [data, sheet] = await Promise.all([
    getOrganizationBoard(org.id, mine ? session.id : undefined),
    admin ? getTodaySheet(org.id) : Promise.resolve(null),
  ]);
  if (!data) return <p className="text-zinc-500">No organization yet.</p>;
  const missingDaily = admin
    ? (sheet?.people ?? [])
        .filter((person) => !person.submitted)
        .map((person) => ({ id: person.id, name: person.name }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    : [];

  const tasks: BoardTask[] = data.tasks.map((task) => ({
    id: task.id,
    taskKey: task.taskKey,
    title: task.title,
    description: task.description,
    status: task.status,
    type: task.type,
    priority: task.priority,
    labels: task.labels,
    storyPoints: task.storyPoints,
    columnOrder: task.columnOrder,
    dueDate: task.dueDate?.toISOString() ?? null,
    blockerNote: task.blockerNote,
    authorId: task.authorId,
    moveOwnerId: task.moveOwnerId,
    sharedWithIds: task.sharedWithIds,
    assignee: task.assignee,
    dailyItem: task.dailyItem,
    _count: task._count,
  }));

  return (
    <KanbanBoard
      initialTasks={tasks}
      users={data.users}
      currentUserId={session.id}
      mine={mine}
      admin={admin}
      missingDaily={missingDaily}
    />
  );
}
