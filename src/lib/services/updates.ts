import { startOfDay } from "date-fns";
import { db } from "@/lib/db";

export const UPDATES_PAGE_SIZE = 12;
export const PEOPLE_PAGE_SIZE = 24;

type NoteKind = "PROGRESS" | "CHALLENGE";

export type UpdateFilter = {
  authorId?: string;
  query?: string;
  day?: "today" | "past";
  from?: Date;
  to?: Date;
};

function noteWhere(organizationId: string, kind: NoteKind | null, filter: UpdateFilter) {
  const today = startOfDay(new Date());
  const query = filter.query?.trim();
  const author =
    filter.authorId || query
      ? {
          ...(filter.authorId ? { id: filter.authorId } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { username: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        }
      : undefined;

  let planDate: Date | { lt?: Date; lte?: Date; gte?: Date } | undefined;
  if (filter.day === "today") {
    planDate = today;
  } else if (filter.day === "past") {
    const end = filter.to && filter.to < today ? filter.to : undefined;
    planDate = {
      lt: today,
      ...(filter.from ? { gte: filter.from } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  return {
    organizationId,
    ...(kind ? { kind } : {}),
    ...(author ? { author } : {}),
    ...(planDate ? { planDate } : {}),
  };
}

export async function countUnreadUpdates(organizationId: string, userId: string) {
  return db.progressUpdate.count({
    where: {
      organizationId,
      planDate: startOfDay(new Date()),
      authorId: { not: userId },
      NOT: { readByIds: { has: userId } },
    },
  });
}

export async function listUpdates(
  organizationId: string,
  userId: string,
  page: number,
  kind: NoteKind | null,
  filter: UpdateFilter = {},
) {
  const where = noteWhere(organizationId, kind, filter);
  const total = await db.progressUpdate.count({ where });
  const pages = Math.max(1, Math.ceil(total / UPDATES_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), pages);
  const updates = await db.progressUpdate.findMany({
    where,
    include: { author: { select: { id: true, name: true, username: true } } },
    orderBy: filter.day === "past" ? [{ planDate: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
    skip: (safePage - 1) * UPDATES_PAGE_SIZE,
    take: UPDATES_PAGE_SIZE,
  });

  const unreadIds = updates
    .filter((item) => item.authorId !== userId && !item.readByIds.includes(userId))
    .map((item) => item.id);
  if (unreadIds.length) {
    await db.progressUpdate.updateMany({
      where: { id: { in: unreadIds } },
      data: { readByIds: { push: userId } },
    });
  }

  return {
    page: safePage,
    pages,
    total,
    updates: updates.map((item) => ({
      id: item.id,
      body: item.body,
      kind: item.kind,
      planDate: item.planDate.toISOString(),
      createdAt: item.createdAt.toISOString(),
      authorName: item.author.name ?? item.author.username ?? "Someone",
      mine: item.authorId === userId,
      unread: unreadIds.includes(item.id),
    })),
  };
}

function noteFields(kind: NoteKind | null, filter: UpdateFilter) {
  const today = startOfDay(new Date());
  let planDate: Date | { lt?: Date; lte?: Date; gte?: Date } | undefined;
  if (filter.day === "today") {
    planDate = today;
  } else if (filter.day === "past") {
    const end = filter.to && filter.to < today ? filter.to : undefined;
    planDate = {
      lt: today,
      ...(filter.from ? { gte: filter.from } : {}),
      ...(end ? { lte: end } : {}),
    };
  }
  return {
    ...(kind ? { kind } : {}),
    ...(planDate ? { planDate } : {}),
  };
}

export async function listPeopleNotes(
  organizationId: string,
  userId: string,
  page: number,
  kind: NoteKind | null,
  filter: UpdateFilter = {},
) {
  const query = filter.query?.trim();
  const notes = noteFields(kind, filter);
  const where = {
    organizationId,
    isActive: true,
    ...(filter.authorId ? { id: filter.authorId } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { username: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    progressUpdates: { some: notes },
  };
  const total = await db.user.count({ where });
  const pages = Math.max(1, Math.ceil(total / PEOPLE_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), pages);
  const people = await db.user.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (safePage - 1) * PEOPLE_PAGE_SIZE,
    take: PEOPLE_PAGE_SIZE,
    select: {
      id: true,
      name: true,
      username: true,
      progressUpdates: {
        where: notes,
        orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
        take: filter.day === "past" ? 40 : 8,
        select: { id: true, body: true, kind: true, planDate: true, createdAt: true, authorId: true, readByIds: true },
      },
      _count: { select: { progressUpdates: { where: notes } } },
    },
  });

  const unreadIds = people.flatMap((person) =>
    person.progressUpdates
      .filter((item) => item.authorId !== userId && !item.readByIds.includes(userId))
      .map((item) => item.id),
  );
  if (unreadIds.length) {
    await db.progressUpdate.updateMany({
      where: { id: { in: unreadIds } },
      data: { readByIds: { push: userId } },
    });
  }

  return {
    page: safePage,
    pages,
    total,
    people: people.map((person) => ({
      id: person.id,
      name: person.name ?? person.username ?? "Someone",
      total: person._count.progressUpdates,
      notes: person.progressUpdates.map((item) => ({
        id: item.id,
        body: item.body,
        kind: item.kind,
        planDate: item.planDate.toISOString(),
        createdAt: item.createdAt.toISOString(),
        unread: unreadIds.includes(item.id),
      })),
    })),
  };
}

export async function listUpdatesForExport(organizationId: string, kind: NoteKind | null, filter: UpdateFilter) {
  return db.progressUpdate.findMany({
    where: noteWhere(organizationId, kind, { ...filter, day: "past" }),
    include: { author: { select: { name: true, username: true } } },
    orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
    take: 5000,
  });
}
