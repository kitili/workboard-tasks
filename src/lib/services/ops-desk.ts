import { startOfDay } from "date-fns";
import { isBoardAdmin, isOpsCrew, isOpsLead, opsDeskPersonLabel, OPS_DESK_NAMES, type OpsDeskName } from "@/lib/auth/admin";
import type { DepartmentSlug } from "@/lib/departments";
import { opsTapDeskCatalog, tapItemBelongsOnOpsDesk, type TapItem } from "@/lib/data/tap-catalog";
import { db } from "@/lib/db";
import { syncTapTasks } from "@/lib/services/tap-sync";

export type OpsDeskPerson = { id: string; name: OpsDeskName; departmentSlug: string | null };

export type OpsAllocationSlot = { slot: number; title: string; taskId: string | null };

export type OpsAllocation = {
  person: OpsDeskPerson;
  slots: OpsAllocationSlot[];
};

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
  return isBoardAdmin(user) || isOpsLead(user) || isOpsCrew(user);
}

export function canRunOpsDesk(user: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
}) {
  return isBoardAdmin(user) || isOpsLead(user);
}

export function canEditOpsTap(user: {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
}) {
  return canViewOpsDesk(user);
}

export async function getOpsTapDesk(organizationId: string) {
  const catalog = opsTapDeskCatalog();
  const slugs = [...new Set(["operations", ...catalog.map((dept) => dept.slug)])] as DepartmentSlug[];
  for (const slug of slugs) {
    await syncTapTasks(organizationId, slug);
  }
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
        OR: [
          { departmentSlug: "operations" },
          { name: { contains: "Francis" } },
          { name: { contains: "Kusaduka" } },
          { name: { contains: "Shikunzi" } },
          { name: { contains: "Shikuze" } },
          { name: { contains: "Shikonze" } },
          { name: { contains: "Baraka" } },
          { name: { contains: "Majundo" } },
        ],
      },
      select: { id: true, name: true, username: true, email: true, departmentSlug: true },
    }),
  ]);

  const people: OpsDeskPerson[] = OPS_DESK_NAMES.flatMap((label) => {
    const user = team.find((row) => opsDeskPersonLabel(row) === label);
    if (!user) return [];
    return [{ id: user.id, name: label, departmentSlug: user.departmentSlug }];
  });

  const plans = people.length
    ? await db.dailyPlan.findMany({
        where: { userId: { in: people.map((person) => person.id) }, planDate: today },
        select: {
          userId: true,
          items: { where: { slot: { lte: 3 } }, select: { slot: true, title: true, taskId: true } },
        },
      })
    : [];

  const allocations: OpsAllocation[] = people.map((person) => {
    const plan = plans.find((row) => row.userId === person.id);
    return {
      person,
      slots: [1, 2, 3].map((slot) => {
        const item = plan?.items.find((row) => row.slot === slot);
        return { slot, title: item?.title ?? "", taskId: item?.taskId ?? null };
      }),
    };
  });

  return {
    groups: catalog.map((dept) => ({
      slug: dept.slug,
      name: dept.name,
      tap: dept.tap,
      rocks: dept.rocks.map((rock) => ({
        parent: hydrateLine(rock.parent, dept.slug, tasks, today, people),
        children: rock.children.map((item) => hydrateLine(item, dept.slug, tasks, today, people)),
      })),
    })),
    people,
    allocations,
  };
}

function eatDay(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value.includes("T") ? value : `${value}T00:00:00+03:00`) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(date);
}

function hydrateLine(item: TapItem, slug: string, tasks: BoardTap[], today: Date, crew: OpsDeskPerson[]): OpsDeskLine {
  const title = `${item.code} ${item.title}`;
  const task = tasks.find((row) => row.departmentSlug === slug && row.title === title);
  const onToday = task?.dailyItem && task.dailyItem.dailyPlan.planDate.getTime() === today.getTime();
  const todayPerson = onToday && task?.dailyItem ? task.dailyItem.dailyPlan.user.name : null;
  const todayLabel = todayPerson
    ? (crew.find((person) => person.id === task?.assignee?.id)?.name ?? opsDeskPersonLabel({ name: todayPerson }) ?? todayPerson)
    : null;
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
    assignee: task?.assignee
      ? {
          id: task.assignee.id,
          name: crew.find((person) => person.id === task.assignee?.id)?.name ?? task.assignee.name ?? task.assignee.username,
        }
      : null,
    today: onToday && task?.dailyItem ? { slot: task.dailyItem.slot, person: todayLabel } : null,
  };
}
