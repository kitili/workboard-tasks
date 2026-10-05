import { redirect } from "next/navigation";
import { isBoardAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { getOrganizationBoard } from "@/lib/data/board";
import { KanbanBoard } from "@/components/board/kanban-board";
import { getTodaySheet } from "@/lib/services/daily-sheet";
import { syncAllUserDepartments, syncUserDepartment } from "@/lib/services/departments";
import { syncTapTasks } from "@/lib/services/tap-sync";
import { allTapWorkers, tapDepartment, tapPeople } from "@/lib/data/tap-catalog";
import { departmentBySlug } from "@/lib/departments";
import type { BoardTask } from "@/lib/board/types";
import { isNamedStaff, selectDepartmentStaff, selectFiledToday, selectMissingDaily } from "@/lib/board/missing-daily";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string; dept?: string }>;
}) {
  const [session, org, params] = await Promise.all([getSessionUser(), getDefaultOrganization(), searchParams]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;

  const admin = isBoardAdmin(session);
  const departmentSlug = await syncUserDepartment(session.id);
  if (admin) await syncAllUserDepartments(org.id);
  const mine = !admin || params.mine === "1";
  const selectedDept = admin && !mine ? (params.dept || undefined) : undefined;
  if (admin && !mine) {
    await syncTapTasks(org.id, selectedDept);
  }
  const [data, sheet, assignUsers] = await Promise.all([
    getOrganizationBoard(org.id, {
      assigneeId: mine ? session.id : undefined,
      departmentSlug: mine ? undefined : selectedDept,
    }),
    admin && !mine ? getTodaySheet(org.id) : Promise.resolve(null),
    db.user.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true, username: true, phone: true, departmentSlug: true, jobTitle: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!data) return <p className="text-zinc-500">No organization yet.</p>;
  const deptName = (slug: string) => departmentBySlug(slug)?.name ?? null;
  const assignedIds = new Set(data.tasks.map((task) => task.assignee?.id).filter(Boolean));
  const named = assignUsers.filter((user) => isNamedStaff(user.name ?? user.username));
  const departmentPeople = named.filter((user) => {
    if (selectedDept) return user.departmentSlug === selectedDept || assignedIds.has(user.id);
    return Boolean(user.departmentSlug) || assignedIds.has(user.id);
  });
  const assignDirectory = selectDepartmentStaff(named, mine ? departmentSlug : selectedDept);
  const missingDaily = admin
    ? selectMissingDaily(sheet?.people ?? [], selectedDept, deptName)
    : [];
  const filedToday = admin ? selectFiledToday(sheet?.people ?? [], selectedDept, deptName) : [];
  const rosterPeople = selectedDept
    ? (() => {
        const tap = tapPeople(selectedDept);
        const seen = new Set(tap.map((person) => person.name.toLowerCase()));
        const extras = named
          .filter((user) => user.departmentSlug === selectedDept && user.name && !seen.has(user.name.toLowerCase()))
          .map((user) => ({ name: user.name as string, role: user.jobTitle?.trim() || "Department support" }));
        return [...tap, ...extras];
      })()
    : [];
  const rosterDepartments = !selectedDept
    ? allTapWorkers().map((dept) => {
        const seen = new Set(dept.people.map((person) => person.name.toLowerCase()));
        const extras = named
          .filter((user) => user.departmentSlug === dept.slug && user.name && !seen.has(user.name.toLowerCase()))
          .map((user) => ({ name: user.name as string, role: user.jobTitle?.trim() || "Department support" }));
        return { ...dept, people: [...dept.people, ...extras] };
      })
    : [];

  const tasks: BoardTask[] = data.tasks
    .map((task) => ({
      id: task.id,
      taskKey: task.taskKey,
      title: task.title,
      description: task.description,
      status: task.status,
      type: task.type,
      priority: task.priority,
      labels: task.labels,
      departmentSlug: task.departmentSlug,
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
      users={departmentPeople}
      currentUserId={session.id}
      mine={mine}
      admin={admin}
      departmentName={departmentBySlug(selectedDept)?.name ?? null}
      departmentSlug={selectedDept ?? null}
      missingDaily={missingDaily}
      filedToday={filedToday}
      tapTitle={selectedDept ? tapDepartment(selectedDept)?.tap ?? null : admin && !mine ? "All TAP departments" : null}
      tapPeople={!mine && selectedDept ? rosterPeople : []}
      tapDepartments={!mine && !selectedDept ? rosterDepartments : []}
      assignUsers={assignDirectory}
    />
  );
}
