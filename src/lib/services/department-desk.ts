import { startOfDay } from "date-fns";
import { isNamedStaff } from "@/lib/board/missing-daily";
import { opsDeskPersonLabel } from "@/lib/auth/admin";
import { canAddDeskMembers, canAssignDesk, canEditDeskTap, type DeskSlug } from "@/lib/auth/desk";
import type { DepartmentSlug } from "@/lib/departments";
import {
  deskCatalogPeople,
  departmentTapCatalog,
  tapItemBelongsOnOpsDesk,
  tapOwnerKey,
  tapPeople,
  type TapItem,
} from "@/lib/data/tap-catalog";
import { db } from "@/lib/db";
import { isAllowedStaffEmail, normalizeStaffEmail } from "@/lib/email";
import { sheetCardPhrase } from "@/lib/board/sheet-status";
import { taskForTapLine } from "@/lib/board/tap-match";
import { syncTapTasks } from "@/lib/services/tap-sync";

export type DeskPerson = { id: string; name: string; role: string | null; departmentSlug: string | null };

export type DeskAllocationSlot = { slot: number; title: string; taskId: string | null };

export type DeskAllocation = {
  person: DeskPerson;
  slots: DeskAllocationSlot[];
};

export type DeskCard = {
  id: string;
  title: string;
  status: string;
  assigneeId: string | null;
  sharedWithIds: string[];
};

export type DeskLine = {
  code: string;
  title: string;
  owners: string[];
  helpers: string[];
  owned: boolean;
  catalogStatus: string;
  sheetStatus: string | null;
  originalDeadline: string | null;
  taskId: string | null;
  status: string;
  dueDate: string | null;
  assignee: { id: string; name: string | null } | null;
  today: { slot: number; person: string | null } | null;
};

type BoardTap = {
  id: string;
  title: string;
  status: string;
  description: string | null;
  labels: string[];
  source: string;
  departmentSlug: string | null;
  dueDate: Date | null;
  assigneeId: string | null;
  sharedWithIds: string[];
  moveOwnerId: string | null;
  assignee: { id: string; name: string | null; username: string | null } | null;
  dailyItem: {
    slot: number;
    dailyPlan: { planDate: Date; userId: string; user: { name: string | null } };
  } | null;
};

export async function getDepartmentTapDesk(organizationId: string, slug: DeskSlug, viewerId?: string | null) {
  const catalog = departmentTapCatalog(slug);
  const slugs = (slug === "operations"
    ? [...new Set(["operations", ...catalog.map((dept) => dept.slug)])]
    : [slug]) as DepartmentSlug[];
  for (const item of slugs) {
    await syncTapTasks(organizationId, item);
  }
  const today = startOfDay(new Date());

  const [tasks, team] = await Promise.all([
    db.task.findMany({
      where: {
        organizationId,
        status: { not: "CANCELLED" },
        OR: [
          { labels: { has: "TAP" }, departmentSlug: { in: slugs } },
          { source: "DAILY", departmentSlug: { in: slugs } },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        description: true,
        labels: true,
        source: true,
        departmentSlug: true,
        dueDate: true,
        assigneeId: true,
        sharedWithIds: true,
        moveOwnerId: true,
        assignee: { select: { id: true, name: true, username: true } },
        dailyItem: {
          select: {
            slot: true,
            dailyPlan: { select: { planDate: true, userId: true, user: { select: { name: true } } } },
          },
        },
      },
    }),
    db.user.findMany({
      where: {
        organizationId,
        isActive: true,
        departmentSlug: slug,
      },
      select: { id: true, name: true, username: true, email: true, jobTitle: true, departmentSlug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const catalogRoles = new Map(tapPeople(slug).map((person) => [person.name.toLowerCase(), person.role]));
  const ranked = [...team].sort((a, b) => {
    const score = (row: (typeof team)[number]) => (row.email ? 4 : 0) + (row.username && !row.username.startsWith("tap-") ? 2 : 0);
    return score(b) - score(a);
  });
  const people: DeskPerson[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    const label = row.name?.trim() || row.username || "Staff";
    if (!isNamedStaff(label)) continue;
    const display = slug === "operations" ? opsDeskPersonLabel(row) ?? label : label;
    const key = tapOwnerKey(display);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    people.push({
      id: row.id,
      name: display,
      role: row.jobTitle?.trim() || catalogRoles.get(display.toLowerCase()) || catalogRoles.get(label.toLowerCase()) || null,
      departmentSlug: row.departmentSlug,
    });
  }

  const plans = people.length
    ? await db.dailyPlan.findMany({
        where: { userId: { in: people.map((person) => person.id) }, planDate: today },
        select: {
          userId: true,
          items: { where: { slot: { lte: 3 } }, select: { slot: true, title: true, taskId: true } },
        },
      })
    : [];

  const allocations: DeskAllocation[] = people.map((person) => {
    const plan = plans.find((row) => row.userId === person.id);
    return {
      person,
      slots: [1, 2, 3].map((slot) => {
        const item = plan?.items.find((row) => row.slot === slot);
        return { slot, title: item?.title ?? "", taskId: item?.taskId ?? null };
      }),
    };
  });

  const myCards: DeskCard[] = viewerId
    ? tasks
        .filter(
          (task) =>
            task.assigneeId === viewerId ||
            task.moveOwnerId === viewerId ||
            task.sharedWithIds.includes(viewerId),
        )
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          assigneeId: task.assigneeId,
          sharedWithIds: task.sharedWithIds,
        }))
    : [];

  return {
    slug,
    catalogNames: deskCatalogPeople(slug),
    groups: catalog.map((dept) => ({
      slug: dept.slug,
      name: dept.name,
      tap: dept.tap,
      rocks: dept.rocks.map((rock) => ({
        parent: hydrateLine(rock.parent, dept.slug, tasks, today, people, slug),
        children: rock.children.map((item) => hydrateLine(item, dept.slug, tasks, today, people, slug)),
      })),
    })),
    people,
    allocations,
    myCards,
  };
}

export async function addDeskMember(
  organizationId: string,
  slug: DeskSlug,
  input: { name: string; role?: string | null; email?: string | null },
) {
  const name = input.name.trim();
  const role = input.role?.trim() || "Team";
  const email = input.email ? normalizeStaffEmail(input.email) : null;
  if (email && !isAllowedStaffEmail(email)) {
    throw new Error("Use a silverleaf.co.tz email so they can log in.");
  }

  if (email) {
    const byEmail = await db.user.findUnique({ where: { email } });
    if (byEmail) {
      await db.user.update({
        where: { id: byEmail.id },
        data: {
          isActive: true,
          name: byEmail.name?.trim() ? byEmail.name : name,
          jobTitle: role,
          departmentSlug: slug,
        },
      });
      return { id: byEmail.id, name: byEmail.name ?? name, email };
    }
  }

  const existing = await db.user.findFirst({
    where: {
      organizationId,
      isActive: true,
      name: { equals: name, mode: "insensitive" },
      departmentSlug: slug,
    },
  });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        jobTitle: existing.jobTitle?.trim() ? existing.jobTitle : role,
        email: existing.email ?? email,
        departmentSlug: slug,
      },
    });
    return { id: existing.id, name: existing.name ?? name, email: existing.email ?? email };
  }

  const key = `${slug}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const base = (email?.split("@")[0] || `tap-${key}`).replace(/[^a-z0-9._-]/g, "").slice(0, 36) || `tap-${key}`;
  let username = base;
  let n = 0;
  while (await db.user.findUnique({ where: { username } })) {
    n += 1;
    username = `${base}${n}`.slice(0, 40);
  }
  const user = await db.user.create({
    data: {
      organizationId,
      name,
      email,
      username,
      phone: email ? `mail:${email}` : `tap:${key}`,
      departmentSlug: slug,
      jobTitle: role,
    },
  });
  return { id: user.id, name: user.name, email: user.email };
}

export function deskPermissions(
  user: { name?: string | null; username?: string | null; email?: string | null; role?: string | null; departmentSlug?: string | null },
  slug: DeskSlug,
) {
  return {
    canAssign: canAssignDesk(user, slug),
    canEditStatus: canEditDeskTap(user, slug),
    canAddMembers: canAddDeskMembers(user, slug),
  };
}

function eatDay(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value.includes("T") ? value : `${value}T00:00:00+03:00`) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(date);
}

function hydrateLine(
  item: TapItem,
  itemSlug: string,
  tasks: BoardTap[],
  today: Date,
  crew: DeskPerson[],
  deskSlug: DeskSlug,
): DeskLine {
  const task = taskForTapLine(tasks, itemSlug, item.code, item.title);
  const onToday = task?.dailyItem && task.dailyItem.dailyPlan.planDate.getTime() === today.getTime();
  const todayPerson = onToday && task?.dailyItem ? task.dailyItem.dailyPlan.user.name : null;
  const todayLabel = todayPerson
    ? (crew.find((person) => person.id === task?.dailyItem?.dailyPlan.userId)?.name ?? todayPerson)
    : null;
  const owned = deskSlug === "operations" ? tapItemBelongsOnOpsDesk(itemSlug, item) : item.status !== "Removed";
  return {
    code: item.code,
    title: item.title,
    owners: item.owners,
    helpers: item.helpers ?? [],
    catalogStatus: item.status,
    sheetStatus: task ? sheetCardPhrase(task.status, task.description, task.departmentSlug) : item.status,
    owned,
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
