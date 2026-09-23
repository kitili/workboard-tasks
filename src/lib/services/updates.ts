import { db } from "@/lib/db";

export const UPDATES_PAGE_SIZE = 12;

export async function countUnreadUpdates(organizationId: string, userId: string) {
  return db.progressUpdate.count({
    where: {
      organizationId,
      authorId: { not: userId },
      NOT: { readByIds: { has: userId } },
    },
  });
}

export async function listUpdates(
  organizationId: string,
  userId: string,
  page: number,
  kind: "PROGRESS" | "CHALLENGE",
  filter: { authorId?: string; query?: string } = {},
) {
  const query = filter.query?.trim();
  const where = {
    organizationId,
    kind,
    author: {
      ...(filter.authorId ? { id: filter.authorId } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { username: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
  };
  const total = await db.progressUpdate.count({ where });
  const pages = Math.max(1, Math.ceil(total / UPDATES_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), pages);
  const updates = await db.progressUpdate.findMany({
    where,
    include: { author: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "desc" },
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
      planDate: item.planDate.toISOString(),
      createdAt: item.createdAt.toISOString(),
      authorName: item.author.name ?? item.author.username ?? "Someone",
      mine: item.authorId === userId,
      unread: unreadIds.includes(item.id),
    })),
  };
}
