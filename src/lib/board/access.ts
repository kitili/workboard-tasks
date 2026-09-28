export function cardOwnerId(task: {
  moveOwnerId?: string | null;
  authorId?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string } | null;
}) {
  return task.moveOwnerId ?? task.authorId ?? task.assigneeId ?? task.assignee?.id ?? null;
}

export function canMoveTask(
  task: { moveOwnerId?: string | null; authorId?: string | null; sharedWithIds?: string[]; assignee?: { id: string } | null },
  userId: string | null,
  admin = false,
) {
  if (!userId) return false;
  if (admin) return true;
  if (cardOwnerId(task) === userId) return true;
  return (task.sharedWithIds ?? []).includes(userId);
}

export function canAssignTask(
  task: { moveOwnerId?: string | null; authorId?: string | null; assignee?: { id: string } | null },
  userId: string | null,
  admin = false,
) {
  if (!userId) return false;
  if (admin) return true;
  return cardOwnerId(task) === userId;
}
