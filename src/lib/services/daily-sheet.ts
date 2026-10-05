import { format, startOfDay, startOfWeek } from "date-fns";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { allocateTaskKey } from "@/lib/board/task-key";
import { getEnv } from "@/lib/env";

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
        }
      }
      await db.dailyPlanItem.update({
        where: { id: current.id },
        data: { title, taskId: nextTaskId },
      });
      if (nextTaskId && !slot.taskId) {
        await db.task.update({
          where: { id: nextTaskId },
          data: { title, priority: slot.priority ?? current.task?.priority ?? null },
        });
      }
      if (line === 4 || line === 5) {
        const kind = line === 4 ? "CHALLENGE" : "PROGRESS";
        const note = await db.progressUpdate.findFirst({
          where: { authorId: userId, planDate, kind },
          orderBy: { createdAt: "desc" },
        });
        if (note) await db.progressUpdate.update({ where: { id: note.id }, data: { body: title } });
        else {
          await db.progressUpdate.create({
            data: { organizationId: user.organizationId, authorId: userId, body: title, planDate, kind },
          });
        }
      }
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
    await db.progressUpdate.create({
      data: {
        organizationId: user.organizationId,
        authorId: userId,
        body: title,
        planDate,
        kind: slot === 4 ? "CHALLENGE" : "PROGRESS",
      },
    });
    await db.dailyPlanItem.create({
      data: {
        dailyPlanId: plan.id,
        slot,
        title,
        status: "BACKLOG",
      },
    });
    return null;
  }

  const status = input.status ?? "TODO";
  const taskKey = await allocateTaskKey(project.id);

  const task = await db.task.create({
    data: {
      organizationId: user.organizationId,
      projectId: project.id,
      assigneeId: userId,
      authorId: userId,
      moveOwnerId: userId,
      taskKey,
      title,
      status,
      priority: input.priority,
      source: "DAILY",
      departmentSlug: user.departmentSlug,
      columnOrder: slot,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
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
