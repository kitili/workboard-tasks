import { startOfDay } from "date-fns";
import { isBoardAdmin, isOpsLead } from "@/lib/auth/admin";
import { opsTapDeskCatalog, tapItemBelongsOnOpsDesk, type TapItem } from "@/lib/data/tap-catalog";
import { db } from "@/lib/db";
import { syncTapTasks } from "@/lib/services/tap-sync";

export type OpsDeskPerson = { id: string; name: string; departmentSlug: string | null };

type BoardTap = {
  id: string;
  title: string;
  status: string;
  departmentSlug: string | null;
  dueDate: Date | null;
  assignee: { id: string; name: string | null; username: string | null } | null;
  dailyItem: {
    slot: number;
    dailyPlan: { planDate: Date; user: { name: string | null } };
  } | null;
};

export type OpsDeskLine = {
  code: string;
  title: string;
  owners: string[];
  helpers: string[];
  owned: boolean;
  catalogStatus: string;
  originalDeadline: string | null;
  taskId: string | null;
  status: string;
  dueDate: string | null;
  assignee: { id: string; name: string | null } | null;
  today: { slot: number; person: string | null } | null;
};

export function canViewOpsDesk(user: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  departmentSlug?: string | null;
}) {
  return isBoardAdmin(user) || isOpsLead(user) || user.departmentSlug === "operations";
}

export function canRunOpsDesk(user: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
}) {
  return isBoardAdmin(user) || isOpsLead(user);
}

export async function getOpsTapDesk(organizationId: string) {
  for (const slug of ["operations", "ece", "usa-river", "expansion", "arusha-modern"] as const) {
    await syncTapTasks(organizationId, slug);
  }

  const catalog = opsTapDeskCatalog();
  const slugs = catalog.map((dept) => dept.slug);
  const today = startOfDay(new Date());

  const [tasks, team] = await Promise.all([
    db.task.findMany({
      where: {
        organizationId,
        labels: { has: "TAP" },
        departmentSlug: { in: slugs },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        title: true,
        status: true,
        departmentSlug: true,
        dueDate: true,
        assignee: { select: { id: true, name: true, username: true } },
        dailyItem: {
          select: {
            slot: true,
            dailyPlan: { select: { planDate: true, user: { select: { name: true } } } },
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [{ departmentSlug: "operations" }, { name: { contains: "Baraka" } }, { name: { contains: "Majundo" } }],
      },
      select: { id: true, name: true, username: true, departmentSlug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const people: OpsDeskPerson[] = team
    .filter((user) => user.name)
    .map((user) => ({
      id: user.id,
      name: user.name ?? user.username ?? "Staff",
      departmentSlug: user.departmentSlug,
    }));

  return {
    groups: catalog.map((dept) => ({
      slug: dept.slug,
      name: dept.name,
      tap: dept.tap,
      rocks: dept.rocks.map((rock) => ({
        parent: hydrateLine(rock.parent, dept.slug, tasks, today),
        children: rock.children.map((item) => hydrateLine(item, dept.slug, tasks, today)),
      })),
    })),
    people,
  };
}

function eatDay(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value.includes("T") ? value : `${value}T00:00:00+03:00`) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(date);
}

function hydrateLine(item: TapItem, slug: string, tasks: BoardTap[], today: Date): OpsDeskLine {
  const title = `${item.code} ${item.title}`;
  const task = tasks.find((row) => row.departmentSlug === slug && row.title === title);
  const onToday = task?.dailyItem && task.dailyItem.dailyPlan.planDate.getTime() === today.getTime();
  return {
    code: item.code,
    title: item.title,
    owners: item.owners,
    helpers: item.helpers ?? [],
    catalogStatus: item.status,
    owned: tapItemBelongsOnOpsDesk(slug, item),
    originalDeadline: item.deadline ?? null,
    taskId: task?.id ?? null,
    status: task?.status ?? item.status,
    dueDate: eatDay(task?.dueDate) ?? item.deadline ?? null,
    assignee: task?.assignee ? { id: task.assignee.id, name: task.assignee.name ?? task.assignee.username } : null,
    today: onToday && task?.dailyItem ? { slot: task.dailyItem.slot, person: task.dailyItem.dailyPlan.user.name } : null,
  };
}
