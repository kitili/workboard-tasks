import { startOfDay, subDays } from "date-fns";
import { isOpenTapStatus, TAP_DEPARTMENTS } from "@/lib/data/tap-catalog";
import { DEPARTMENTS } from "@/lib/departments";
import { isNamedStaff, isRealLogin } from "@/lib/board/missing-daily";
import { db } from "@/lib/db";

const DONE = new Set(["Fully Completed", "Completed"]);

export async function getKpiDashboard(organizationId: string) {
  const today = startOfDay(new Date());
  const weekAgo = subDays(today, 7);

  const tapDepts = TAP_DEPARTMENTS.map((dept) => {
    const items = dept.items.filter((item) => item.status !== "Removed");
    const done = items.filter((item) => DONE.has(item.status)).length;
    const behind = items.filter((item) => item.status === "Behind Schedule").length;
    const notStarted = items.filter((item) => item.status === "Not Started").length;
    const onTrack = items.filter((item) =>
      item.status === "On Schedule" || item.status === "Ongoing" || item.status === "Partially Completed",
    ).length;
    const open = items.filter((item) => isOpenTapStatus(item.status)).length;
    const lagging = items
      .filter((item) => item.status === "Behind Schedule" || (item.status === "Not Started" && /\.0$/.test(item.code)))
      .slice(0, 4)
      .map((item) => ({
        code: item.code,
        title: item.title,
        status: item.status,
        owners: item.owners.join(" / "),
      }));
    return {
      slug: dept.slug,
      name: DEPARTMENTS.find((item) => item.slug === dept.slug)?.name ?? dept.name,
      total: items.length,
      done,
      open,
      undone: items.length - done,
      behind,
      notStarted,
      onTrack,
      pctDone: items.length ? Math.round((done / items.length) * 100) : 0,
      pctUndone: items.length ? Math.round(((items.length - done) / items.length) * 100) : 0,
      lagging,
    };
  }).sort((a, b) => a.pctDone - b.pctDone);

  const [users, boardTasks] = await Promise.all([
    db.user.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        phone: true,
        departmentSlug: true,
        dailyPlans: {
          orderBy: { planDate: "desc" },
          take: 1,
          select: { planDate: true, items: { select: { id: true } } },
        },
        progressUpdates: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    db.task.groupBy({
      by: ["departmentSlug", "status"],
      where: { organizationId, labels: { has: "TAP" }, status: { not: "CANCELLED" } },
      _count: true,
    }),
  ]);

  const staff = users.filter((user) => isNamedStaff(user.name) && isRealLogin(user.phone) && user.departmentSlug);
  const filedToday = staff.filter((user) => {
    const plan = user.dailyPlans[0];
    return plan && plan.planDate.getTime() === today.getTime() && plan.items.length > 0;
  });
  const missingToday = staff.filter((user) => !filedToday.some((row) => row.id === user.id));
  const quietWeek = staff.filter((user) => {
    const last = user.dailyPlans[0]?.planDate;
    return !last || last < weekAgo;
  });
  const noUpdates = staff.filter((user) => {
    const last = user.progressUpdates[0]?.createdAt;
    return !last || last < weekAgo;
  });

  const boardByDept = new Map<string, { done: number; open: number }>();
  for (const row of boardTasks) {
    const key = row.departmentSlug ?? "none";
    const cur = boardByDept.get(key) ?? { done: 0, open: 0 };
    if (row.status === "COMPLETED") cur.done += row._count;
    else cur.open += row._count;
    boardByDept.set(key, cur);
  }

  const overall = tapDepts.reduce(
    (sum, dept) => ({
      total: sum.total + dept.total,
      done: sum.done + dept.done,
      behind: sum.behind + dept.behind,
      onTrack: sum.onTrack + dept.onTrack,
      notStarted: sum.notStarted + dept.notStarted,
    }),
    { total: 0, done: 0, behind: 0, onTrack: 0, notStarted: 0 },
  );

  const alerts = [
    ...tapDepts
      .filter((dept) => dept.behind > 0)
      .map((dept) => `${dept.name}: ${dept.behind} TAP line${dept.behind === 1 ? "" : "s"} behind schedule`),
    ...tapDepts
      .filter((dept) => dept.pctDone < 15 && dept.total > 0)
      .map((dept) => `${dept.name}: only ${dept.pctDone}% of OPSP TAP lines are done`),
    missingToday.length ? `${missingToday.length} staff with a department have not filed today’s 1–5’s` : "",
    quietWeek.length ? `${quietWeek.length} staff have not filed a 1–5 in 7 days` : "",
    noUpdates.length ? `${noUpdates.length} staff have not posted an update in 7 days` : "",
  ].filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    overall: {
      tapLines: overall.total,
      tapDone: overall.done,
      tapPct: overall.total ? Math.round((overall.done / overall.total) * 100) : 0,
      behind: overall.behind,
      onTrack: overall.onTrack,
      notStarted: overall.notStarted,
      filedToday: filedToday.length,
      expected: staff.length,
      missingToday: missingToday.length,
      quietWeek: quietWeek.length,
    },
    tapDepts,
    boardByDept: tapDepts.map((dept) => {
      const board = boardByDept.get(dept.slug) ?? { done: 0, open: 0 };
      const total = board.done + board.open;
      return {
        ...dept,
        boardDone: board.done,
        boardOpen: board.open,
        boardPct: total ? Math.round((board.done / total) * 100) : 0,
      };
    }),
    missingToday: missingToday
      .map((user) => ({
        id: user.id,
        name: user.name ?? "Staff",
        department: DEPARTMENTS.find((item) => item.slug === user.departmentSlug)?.name ?? user.departmentSlug,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    quietWeek: quietWeek
      .map((user) => ({
        id: user.id,
        name: user.name ?? "Staff",
        last: user.dailyPlans[0]?.planDate.toISOString() ?? null,
        department: DEPARTMENTS.find((item) => item.slug === user.departmentSlug)?.name ?? user.departmentSlug,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    noUpdates: noUpdates
      .map((user) => ({
        id: user.id,
        name: user.name ?? "Staff",
        department: DEPARTMENTS.find((item) => item.slug === user.departmentSlug)?.name ?? user.departmentSlug,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    alerts,
  };
}
