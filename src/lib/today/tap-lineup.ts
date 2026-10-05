export type TodayTapChip = {
  id: string;
  title: string;
  source: string;
  status: string;
};

export function normalizeTapTitle(title: string) {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export function pickDailyTapLineup<T extends { id: string; title: string }>(
  open: T[],
  yesterday: Array<{ taskId?: string | null; title: string }>,
  limit = 3,
): T[] {
  const yesterdayIds = new Set(yesterday.map((row) => row.taskId).filter((id): id is string => Boolean(id)));
  const yesterdayTitles = new Set(yesterday.map((row) => normalizeTapTitle(row.title)));
  const stillOn = open.filter(
    (item) => yesterdayIds.has(item.id) || yesterdayTitles.has(normalizeTapTitle(item.title)),
  );
  const fresh = open.filter((item) => !stillOn.some((row) => row.id === item.id));
  return [...stillOn, ...fresh].slice(0, limit);
}
