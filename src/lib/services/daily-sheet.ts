import { format, startOfDay, startOfWeek, subDays } from "date-fns";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { allocateTaskKey } from "@/lib/board/task-key";
import { itemsForTapPerson, pickOpenTapItems, tapDepartment } from "@/lib/data/tap-catalog";
import { getEnv } from "@/lib/env";
import { pickDailyTapLineup, type TodayTapChip } from "@/lib/today/tap-lineup";

export type DailySlotInput = {
  title: string;
  priority: TaskPriority | null;
};

async function ensureWorkProject(organizationId: string) {
  const existing = await db.project.findFirst({
    where: { organizationId, key: "D5" },
  });
  if (existing) return existing;

  return db.project.create({
    data: {
      organizationId,
      name: "Silverleaf Tasks",
      key: "D5",
      description: "Silverleaf Academy staff tasks",
    },
  });
}

export async function submitDailyFive(userId: string, slots: DailySlotInput[]) {
  const filled = slots.filter((slot) => slot.title.trim());
  if (filled.length === 0) {
    throw new Error("Write at least one task");
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Person not found");

  const project = await ensureWorkProject(user.organizationId);
  const planDate = startOfDay(new Date());

  const existing = await db.dailyPlan.findUnique({
    where: { userId_planDate: { userId, planDate } },
    include: { items: true },
  });

  const morningItems = existing?.items.filter((item) => item.slot <= 5) ?? [];
  const morningTaskIds = morningItems.map((item) => item.taskId).filter((id): id is string => !!id);
  if (morningTaskIds.length) {
    await db.task.deleteMany({ where: { id: { in: morningTaskIds } } });
  }
  if (existing) {
    await db.dailyPlanItem.deleteMany({
      where: { dailyPlanId: existing.id, slot: { lte: 5 } },
    });
  }

  const plan = await db.dailyPlan.upsert({
    where: { userId_planDate: { userId, planDate } },
    create: { userId, planDate },
    update: { submittedAt: new Date() },
  });

  for (const [index, slot] of filled.entries()) {
    const taskKey = await allocateTaskKey(project.id);
    const task = await db.task.create({
      data: {
        organizationId: user.organizationId,
        projectId: project.id,
        assigneeId: userId,
        authorId: userId,
        moveOwnerId: userId,
        taskKey,
        title: slot.title.trim(),
        status: "TODO",
        priority: slot.priority,
        source: "DAILY",
        departmentSlug: user.departmentSlug,
        columnOrder: index,
      },
    });

    await db.dailyPlanItem.create({
      data: {
        dailyPlanId: plan.id,
        slot: index + 1,
        title: slot.title.trim(),
        status: "TODO",
        taskId: task.id,
      },
    });

    await db.taskActivity.create({
      data: {
        taskId: task.id,
        userId,
        type: "DAILY_SUBMITTED",
        toStatus: "TODO",
        message: `Daily slot ${index + 1}`,
      },
    });
  }

  return getTodaySheet(user.organizationId);
}

/** Yesterday’s cards still sitting in Tasks move to Backlog. In progress stays put. */
export async function parkUnfinishedDailyTasks(organizationId: string) {
  const today = startOfDay(new Date());
  const stale = await db.task.findMany({
    where: {
      organizationId,
      status: "TODO",
      dailyItem: { is: { dailyPlan: { planDate: { lt: today } } } },
    },
    select: { id: true },
  });
  if (stale.length === 0) return;

  const ids = stale.map((task) => task.id);
  await db.task.updateMany({
    where: { id: { in: ids } },
    data: { status: "BACKLOG" },
  });
  await db.dailyPlanItem.updateMany({
    where: { taskId: { in: ids } },
    data: { status: "BACKLOG" },
  });
}

export async function getTodaySheet(organizationId?: string) {
  const env = getEnv();
  const org =
    (organizationId
      ? await db.organization.findUnique({ where: { id: organizationId } })
      : null) ??
    (await db.organization.findUnique({ where: { slug: env.DEFAULT_ORG_SLUG } }));

  if (!org) return { people: [], date: startOfDay(new Date()).toISOString() };

  await parkUnfinishedDailyTasks(org.id);
  await attachMissingDailyCards(org.id);
  const planDate = startOfDay(new Date());
  const people = await db.user.findMany({
    where: { organizationId: org.id, isActive: true },
    orderBy: { name: "asc" },
    include: {
      dailyPlans: {
        where: { planDate },
        include: {
          items: { orderBy: { slot: "asc" }, include: { task: true } },
        },
      },
    },
  });

  return {
    date: planDate.toISOString(),
    organizationId: org.id,
    people: people.map((person) => {
      const plan = person.dailyPlans[0] ?? null;
      return {
        id: person.id,
        name: person.name ?? person.phone,
        phone: person.phone,
        departmentSlug: person.departmentSlug,
        submitted: !!plan && plan.items.length > 0,
        slots: plan
          ? plan.items.map((item) => ({
              slot: item.slot,
              title: item.title,
              status: item.task?.status ?? item.status,
              priority: item.task?.priority ?? null,
              taskId: item.taskId,
            }))
          : [],
      };
    }),
  };
}

const TAP_STATUS_RANK: Record<string, number> = {
  IN_PROGRESS: 0,
  TODO: 1,
  BACKLOG: 2,
};

export async function getPickableTodayTasks(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user) return [];
  const rows = await db.task.findMany({
    where: {
      organizationId: user.organizationId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      OR: [{ assigneeId: userId }, { sharedWithIds: { has: userId } }, { moveOwnerId: userId }],
    },
    select: { id: true, title: true, status: true, labels: true, dailyItem: { select: { id: true } } },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
  return rows
    .filter((row) => !row.dailyItem)
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      tap: row.labels.includes("TAP"),
    }));
}

export async function getTodayTapLineup(userId: string): Promise<{ lineup: TodayTapChip[]; more: TodayTapChip[] }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      jobTitle: true,
      departmentSlug: true,
      organizationId: true,
    },
  });
  if (!user) return { lineup: [], more: [] };

  const today = startOfDay(new Date());
  const yesterday = subDays(today, 1);
  const [openTaps, doneTaps, yesterdayPlan] = await Promise.all([
    db.task.findMany({
      where: {
        organizationId: user.organizationId,
        labels: { has: "TAP" },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        OR: [{ assigneeId: userId }, { sharedWithIds: { has: userId } }, { moveOwnerId: userId }],
      },
      select: { id: true, title: true, status: true, labels: true, description: true, columnOrder: true },
    }),
    db.task.findMany({
      where: {
        organizationId: user.organizationId,
        labels: { has: "TAP" },
        status: "COMPLETED",
        OR: [{ assigneeId: userId }, { sharedWithIds: { has: userId } }, { moveOwnerId: userId }],
      },
      select: { title: true },
    }),
    db.dailyPlan.findUnique({
      where: { userId_planDate: { userId, planDate: yesterday } },
      include: { items: { where: { slot: { lte: 3 } }, include: { task: { select: { id: true, title: true, status: true, labels: true } } } } },
    }),
  ]);

  const yesterdaySlots = (yesterdayPlan?.items ?? []).map((item) => ({
    taskId: item.taskId,
    title: item.title,
    done: item.task?.status === "COMPLETED",
  }));
  const doneTitles = new Set([
    ...doneTaps.map((task) => task.title.toLowerCase().replace(/\s+/g, " ").trim()),
    ...yesterdaySlots.filter((item) => item.done).map((item) => item.title.toLowerCase().replace(/\s+/g, " ").trim()),
  ]);

  const boardChips: TodayTapChip[] = [...openTaps]
    .sort((a, b) => {
      const rock = (task: (typeof openTaps)[number]) =>
        task.labels.some((label) => /\.0$/.test(label.replace(/^Rock\s+/i, "")));
      return (
        Number(rock(b)) - Number(rock(a)) ||
        (TAP_STATUS_RANK[a.status] ?? 9) - (TAP_STATUS_RANK[b.status] ?? 9) ||
        a.columnOrder - b.columnOrder
      );
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      source: task.description?.split(" · ")[0] ?? "TAP",
      status: task.status,
    }));

  const seen = new Set(boardChips.map((chip) => chip.title.toLowerCase().replace(/\s+/g, " ").trim()));
  const dept = tapDepartment(user.departmentSlug);
  const catalog = pickOpenTapItems(itemsForTapPerson(user), {
    skipTitles: [...doneTitles, ...seen],
    keepTitles: yesterdaySlots.filter((item) => !item.done).map((item) => item.title),
    limit: 12,
  });
  const catalogChips: TodayTapChip[] = catalog
    .map((item) => ({
      id: `catalog:${user.departmentSlug ?? "tap"}:${item.code}`,
      title: `${item.code} ${item.title}`,
      source: dept?.tap ?? "TAP",
      status: item.status,
    }))
    .filter((chip) => !seen.has(chip.title.toLowerCase().replace(/\s+/g, " ").trim()));

  const pool = [...boardChips, ...catalogChips];
  const keepYesterday = yesterdaySlots.filter((item) => !item.done);
  const lineup = pickDailyTapLineup(pool, keepYesterday, 3);
  const more = pool.filter((chip) => !lineup.some((item) => item.id === chip.id)).slice(0, 8);
  return { lineup, more };
}

export async function deleteTodaySlot(userId: string, slot: number) {
  const planDate = startOfDay(new Date());
  const plan = await db.dailyPlan.findUnique({
    where: { userId_planDate: { userId, planDate } },
    include: { items: true },
  });
  const item = plan?.items.find((row) => row.slot === slot);
  if (!item) return;
  if (item.taskId) {
    const task = await db.task.findUnique({ where: { id: item.taskId }, select: { source: true } });
    if (task?.source === "DAILY") {
      await db.task.delete({ where: { id: item.taskId } }).catch(() => undefined);
    }
  }
  await db.dailyPlanItem.delete({ where: { id: item.id } });
  if (slot === 4 || slot === 5) {
    await db.progressUpdate.deleteMany({
      where: { authorId: userId, planDate, kind: slot === 4 ? "CHALLENGE" : "PROGRESS" },
    });
  }
}

export async function saveTodaySlots(
  userId: string,
  slots: Array<{ slot?: number; title: string; priority?: TaskPriority | null; taskId?: string | null }>,
) {
  const filled = slots.filter((slot) => slot.title.trim());
  if (filled.length === 0) throw new Error("Fill in at least one open line.");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Log in first");

  const planDate = startOfDay(new Date());
  const plan = await db.dailyPlan.upsert({
    where: { userId_planDate: { userId, planDate } },
    create: { userId, planDate },
    update: { submittedAt: new Date() },
  });
  const existing = await db.dailyPlanItem.findMany({
    where: { dailyPlanId: plan.id, slot: { lte: 5 } },
    include: { task: true },
  });

  for (const slot of filled) {
    const title = slot.title.trim();
    const line = slot.slot && slot.slot >= 1 && slot.slot <= 5 ? slot.slot : undefined;
    if (!line) {
      await addTodayTask(userId, { title, priority: slot.priority ?? null });
      continue;
    }
    const current = existing.find((item) => item.slot === line);
    if (current) {
      let nextTaskId = current.taskId;
      let lineTitle = title;
      if (slot.taskId && slot.taskId !== current.taskId) {
        const picked = await db.task.findFirst({
          where: {
            id: slot.taskId,
            OR: [{ assigneeId: userId }, { sharedWithIds: { has: userId } }, { moveOwnerId: userId }],
          },
        });
        if (picked) {
          if (current.taskId && current.task?.source === "DAILY") {
            await db.task.delete({ where: { id: current.taskId } }).catch(() => undefined);
          }
          nextTaskId = picked.id;
          lineTitle = picked.title;
        }
      }
      if (!nextTaskId) {
        const project = await ensureWorkProject(user.organizationId);
        const created = await createDailyCard({
          organizationId: user.organizationId,
          projectId: project.id,
          userId,
          departmentSlug: user.departmentSlug,
          title: lineTitle,
          slot: line,
          priority: slot.priority ?? null,
        });
        nextTaskId = created.id;
      } else if (nextTaskId === current.taskId) {
        if (current.task?.labels.includes("TAP")) {
          if (current.title.trim() !== lineTitle) {
            const project = await ensureWorkProject(user.organizationId);
            const created = await createDailyCard({
              organizationId: user.organizationId,
              projectId: project.id,
              userId,
              departmentSlug: user.departmentSlug,
              title: lineTitle,
              slot: line,
              priority: slot.priority ?? null,
            });
            nextTaskId = created.id;
          }
        } else {
          await db.task.update({
            where: { id: nextTaskId },
            data: { title: lineTitle, priority: slot.priority ?? current.task?.priority ?? null },
          });
        }
      }
      await db.dailyPlanItem.update({
        where: { id: current.id },
        data: { title: lineTitle, taskId: nextTaskId },
      });
      if (line === 4 || line === 5) await upsertLineNote(user.organizationId, userId, planDate, line, lineTitle);
      continue;
    }
    if (slot.taskId) {
      const picked = await db.task.findFirst({
        where: {
          id: slot.taskId,
          OR: [{ assigneeId: userId }, { sharedWithIds: { has: userId } }, { moveOwnerId: userId }],
        },
      });
      if (picked) {
        await db.dailyPlanItem.create({
          data: { dailyPlanId: plan.id, slot: line, title: picked.title, status: picked.status, taskId: picked.id },
        });
        continue;
      }
    }
    await addTodayTask(userId, { title, priority: slot.priority ?? null, slot: line });
  }

  const kept = new Set(filled.map((slot) => slot.slot).filter((slot): slot is number => typeof slot === "number"));
  const extras = existing.filter((item) => !kept.has(item.slot));
  for (const item of extras) {
    if (item.taskId && item.task?.source === "DAILY") {
      await db.task.delete({ where: { id: item.taskId } }).catch(() => undefined);
    }
    await db.dailyPlanItem.delete({ where: { id: item.id } });
  }

  return getTodaySheet(user.organizationId);
}

export async function addTodayTask(
  userId: string,
  input: { title: string; priority: TaskPriority | null; status?: TaskStatus; slot?: number },
) {
  const title = input.title.trim();
  if (!title) throw new Error("Write the task first");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Log in first");

  const project = await ensureWorkProject(user.organizationId);
  const planDate = startOfDay(new Date());
  const plan = await db.dailyPlan.upsert({
    where: { userId_planDate: { userId, planDate } },
    create: { userId, planDate },
    update: {},
  });

  let slot = input.slot;
  if (slot != null) {
    if (slot < 1 || slot > 5) throw new Error("That line is not on today's list");
    const taken = await db.dailyPlanItem.findFirst({
      where: { dailyPlanId: plan.id, slot },
    });
    if (taken) throw new Error("That line is already on your list");
  } else {
    const last = await db.dailyPlanItem.aggregate({
      where: { dailyPlanId: plan.id },
      _max: { slot: true },
    });
    slot = (last._max.slot ?? 0) + 1;
  }

  if (slot === 4 || slot === 5) {
    await upsertLineNote(user.organizationId, userId, planDate, slot, title);
  }

  const status = input.status ?? "TODO";
  const task = await createDailyCard({
    organizationId: user.organizationId,
    projectId: project.id,
    userId,
    departmentSlug: user.departmentSlug,
    title,
    slot,
    priority: input.priority,
    status,
  });

  await db.dailyPlanItem.create({
    data: {
      dailyPlanId: plan.id,
      slot,
      title,
      status,
      taskId: task.id,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  return task;
}

export async function getMyHistory(userId: string) {
  const plans = await db.dailyPlan.findMany({
    where: { userId, planDate: { gte: new Date("2026-09-01") } },
    include: {
      items: {
        orderBy: { slot: "asc" },
        include: { task: true },
      },
    },
    orderBy: { planDate: "desc" },
    take: 120,
  });

  const entries = plans.flatMap((plan) =>
    plan.items.map((item) => ({
      id: item.id,
      date: plan.planDate.toISOString(),
      slot: item.slot,
      title: item.title,
      priority: item.task?.priority ?? null,
      status: item.task?.status ?? item.status,
      completedAt: item.task?.completedAt?.toISOString() ?? item.completedAt?.toISOString() ?? null,
    })),
  );

  const weeks = new Map<string, { weekStart: string; created: number; done: number }>();
  for (const entry of entries) {
    const weekStart = startOfWeek(new Date(entry.date), { weekStartsOn: 1 });
    const key = format(weekStart, "yyyy-MM-dd");
    const bucket = weeks.get(key) ?? { weekStart: weekStart.toISOString(), created: 0, done: 0 };
    if (entry.slot === 4 || entry.slot === 5) continue;
    bucket.created += 1;
    if (entry.status === "COMPLETED") bucket.done += 1;
    weeks.set(key, bucket);
  }

  const diligence = [...weeks.values()]
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .map((week) => ({
      ...week,
      percent: week.created === 0 ? 0 : Math.round((week.done / week.created) * 100),
    }));

  return { entries, diligence };
}

export async function syncDailyItemStatus(taskId: string, status: TaskStatus) {
  await db.dailyPlanItem.updateMany({
    where: { taskId },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
}

export async function syncDailyItemTitle(taskId: string, title: string) {
  const item = await db.dailyPlanItem.findUnique({
    where: { taskId },
    include: { dailyPlan: { select: { userId: true, planDate: true, user: { select: { organizationId: true } } } } },
  });
  if (!item) return;
  await db.dailyPlanItem.update({ where: { id: item.id }, data: { title } });
  if (item.slot === 4 || item.slot === 5) {
    await upsertLineNote(item.dailyPlan.user.organizationId, item.dailyPlan.userId, item.dailyPlan.planDate, item.slot, title);
  }
}

async function upsertLineNote(
  organizationId: string,
  userId: string,
  planDate: Date,
  slot: number,
  body: string,
) {
  const kind = slot === 4 ? "CHALLENGE" : "PROGRESS";
  const note = await db.progressUpdate.findFirst({
    where: { authorId: userId, planDate, kind },
    orderBy: { createdAt: "desc" },
  });
  if (note) await db.progressUpdate.update({ where: { id: note.id }, data: { body } });
  else {
    await db.progressUpdate.create({
      data: { organizationId, authorId: userId, body, planDate, kind },
    });
  }
}

async function createDailyCard(input: {
  organizationId: string;
  projectId: string;
  userId: string;
  departmentSlug: string | null;
  title: string;
  slot: number;
  priority: TaskPriority | null;
  status?: TaskStatus;
}) {
  const status = input.status ?? "TODO";
  const taskKey = await allocateTaskKey(input.projectId);
  return db.task.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      assigneeId: input.userId,
      authorId: input.userId,
      moveOwnerId: input.userId,
      taskKey,
      title: input.title,
      status,
      priority: input.priority,
      source: "DAILY",
      departmentSlug: input.departmentSlug,
      labels: input.slot === 4 ? ["Challenge"] : input.slot === 5 ? ["Progress recap"] : [],
      columnOrder: input.slot,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
}

async function attachMissingDailyCards(organizationId: string) {
  const planDate = startOfDay(new Date());
  const missing = await db.dailyPlanItem.findMany({
    where: {
      taskId: null,
      slot: { gte: 1, lte: 5 },
      dailyPlan: { planDate, user: { organizationId } },
    },
    include: {
      dailyPlan: {
        select: { userId: true, user: { select: { departmentSlug: true } } },
      },
    },
  });
  if (missing.length === 0) return;
  const project = await ensureWorkProject(organizationId);
  for (const item of missing) {
    const title = item.title.trim();
    if (!title) continue;
    const task = await createDailyCard({
      organizationId,
      projectId: project.id,
      userId: item.dailyPlan.userId,
      departmentSlug: item.dailyPlan.user.departmentSlug,
      title,
      slot: item.slot,
      priority: null,
      status: "TODO",
    });
    await db.dailyPlanItem.update({
      where: { id: item.id },
      data: { taskId: task.id, status: "TODO" },
    });
  }
}

export async function assignTapToday(userId: string, taskId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Person not found");
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { dailyItem: { include: { dailyPlan: true } } },
  });
  if (!task) throw new Error("TAP line not found");

  const sharedWithIds = Array.from(new Set([...task.sharedWithIds, task.assigneeId].filter(Boolean) as string[])).filter(
    (id) => id !== userId,
  );
  await db.task.update({
    where: { id: taskId },
    data: { assigneeId: userId, moveOwnerId: userId, sharedWithIds },
  });

  const planDate = startOfDay(new Date());
  const current = task.dailyItem;
  const alreadyToday =
    current &&
    current.dailyPlan.userId === userId &&
    current.dailyPlan.planDate.getTime() === planDate.getTime() &&
    current.slot >= 1 &&
    current.slot <= 3;
  if (alreadyToday) {
    return { parked: true as const, slot: current.slot };
  }

  if (current) {
    await db.dailyPlanItem.update({ where: { id: current.id }, data: { taskId: null } });
  }

  const plan = await db.dailyPlan.upsert({
    where: { userId_planDate: { userId, planDate } },
    create: { userId, planDate },
    update: { submittedAt: new Date() },
  });
  const items = await db.dailyPlanItem.findMany({ where: { dailyPlanId: plan.id, slot: { lte: 3 } } });
  const empty = [1, 2, 3].find((slot) => {
    const row = items.find((item) => item.slot === slot);
    return !row || !row.title.trim();
  });
  if (!empty) {
    return { parked: false as const, slot: null as number | null };
  }
  const row = items.find((item) => item.slot === empty);
  const payload = { title: task.title, status: task.status, taskId: task.id };
  if (row) {
    await db.dailyPlanItem.update({ where: { id: row.id }, data: payload });
  } else {
    await db.dailyPlanItem.create({
      data: { dailyPlanId: plan.id, slot: empty, ...payload },
    });
  }
  return { parked: true as const, slot: empty };
}
