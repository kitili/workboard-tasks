import { db } from "@/lib/db";
import { allocateTaskKey } from "@/lib/board/task-key";
import type { DepartmentSlug } from "@/lib/departments";
import { repairStaffIdentities } from "@/lib/auth/staff-user";
import {
  isOpenTapStatus,
  personMatchesTapOwner,
  tapFirstNameIsShared,
  tapStatusToBoard,
  uniqueTapRosterPeople,
  TAP_DEPARTMENTS,
  type TapDepartment,
} from "@/lib/data/tap-catalog";

type TapUser = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  phone?: string | null;
  jobTitle: string | null;
  role: string;
  departmentSlug: string | null;
};

function isLiveStaff(user: TapUser) {
  if (user.email) return true;
  if (user.phone && !user.phone.startsWith("tap:")) return true;
  if (user.username && !user.username.startsWith("tap-")) return true;
  return false;
}

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

function tapUserScore(user: { name: string | null; email: string | null; role: string }) {
  const nameParts = user.name?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return (user.email ? 4 : 0) + (user.role === "ADMIN" ? 2 : 0) + nameParts;
}

function matchTapName(users: TapUser[], name: string | undefined) {
  if (!name) return [];
  return users
    .filter((user) =>
      name.split("/").some((part) => personMatchesTapOwner(user, part.trim())),
    )
    .sort((a, b) => tapUserScore(b) - tapUserScore(a));
}

function departmentSupervisor(users: TapUser[], dept: TapDepartment) {
  return (
    matchTapName(users, dept.responsible)[0] ??
    matchTapName(users, dept.accountable)[0] ??
    users.find((user) => user.departmentSlug === dept.slug) ??
    null
  );
}

function matchesTapPerson(user: TapUser, person: { name: string; slug: string; support?: boolean }) {
  if (!personMatchesTapOwner(user, person.name)) return false;
  if (person.support) return user.departmentSlug === person.slug;
  if (tapFirstNameIsShared(person.name) && user.departmentSlug && user.departmentSlug !== person.slug) {
    return false;
  }
  return true;
}

function alreadyOnRoster(users: TapUser[], person: { name: string; slug: string; support?: boolean }) {
  return users.some((user) => matchesTapPerson(user, person));
}

async function ensureTapPeople(organizationId: string, users: TapUser[]) {
  const created: TapUser[] = [];
  for (const person of uniqueTapRosterPeople()) {
    const match = users.find((user) => matchesTapPerson(user, person));
    if (match) {
      const nextName = !isLiveStaff(match) && match.name !== person.name ? person.name : undefined;
      const nextTitle = !isLiveStaff(match) && person.role && !match.jobTitle ? person.role : undefined;
      if (nextName || nextTitle) {
        await db.user.update({
          where: { id: match.id },
          data: { ...(nextName ? { name: nextName } : {}), ...(nextTitle ? { jobTitle: nextTitle } : {}) },
        });
        if (nextName) match.name = nextName;
        if (nextTitle) match.jobTitle = nextTitle;
      }
      continue;
    }
    if (alreadyOnRoster(users, person)) continue;
    const key = [person.support ? person.slug : null, person.name]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "person";
    const username = `tap-${key}`.slice(0, 40);
    try {
      const row = await db.user.create({
        data: {
          organizationId,
          name: person.name,
          username,
          phone: `tap:${key}`,
          departmentSlug: person.slug,
          jobTitle: person.role ?? (person.support ? "Department support" : null),
          role: "STAFF",
        },
        select: { id: true, name: true, username: true, email: true, phone: true, jobTitle: true, role: true, departmentSlug: true },
      });
      created.push(row);
      users.push(row);
    } catch {
      const existing = await db.user.findFirst({
        where: { organizationId, OR: [{ username }, { phone: `tap:${key}` }] },
        select: { id: true, name: true, username: true, email: true, phone: true, jobTitle: true, role: true, departmentSlug: true },
      });
      if (existing && !isLiveStaff(existing)) {
        await db.user.update({
          where: { id: existing.id },
          data: {
            name: person.name,
            departmentSlug: existing.departmentSlug ?? person.slug,
            jobTitle: existing.jobTitle ?? person.role ?? null,
          },
        });
      }
    }
  }
  return created;
}

export async function syncTapTasks(organizationId: string, slug?: DepartmentSlug | string | null) {
  const departments = slug
    ? TAP_DEPARTMENTS.filter((item) => item.slug === slug)
    : TAP_DEPARTMENTS;
  if (departments.length === 0) return;

  await repairStaffIdentities(organizationId);

  const [project, existingUsers, existing] = await Promise.all([
    ensureWorkProject(organizationId),
    db.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, username: true, email: true, phone: true, jobTitle: true, role: true, departmentSlug: true },
    }),
    db.task.findMany({
      where: {
        organizationId,
        source: "PROJECT",
        labels: { has: "TAP" },
        ...(slug ? { departmentSlug: slug } : {}),
      },
      select: {
        id: true,
        title: true,
        description: true,
        departmentSlug: true,
        labels: true,
        source: true,
        assigneeId: true,
        sharedWithIds: true,
        dueDate: true,
        dailyItem: { select: { id: true } },
      },
    }),
  ]);
  const users = [...existingUsers, ...(await ensureTapPeople(organizationId, existingUsers))];

  const grouped = new Map<string, typeof existing>();
  for (const task of existing) {
    const key = `${task.departmentSlug ?? ""}::${task.title}`;
    const list = grouped.get(key) ?? [];
    list.push(task);
    grouped.set(key, list);
  }

  for (const dept of departments) {
    const supervisor = departmentSupervisor(users, dept);
    for (const item of dept.items) {
      if (!isOpenTapStatus(item.status)) continue;
      const title = `${item.code} ${item.title}`;
      const key = `${dept.slug}::${title}`;
      const named = [...item.owners, ...(item.helpers ?? [])];
      const owners: TapUser[] = [];
      for (const name of named) {
        const hits = users
          .filter((user) => personMatchesTapOwner(user, name))
          .sort((a, b) => {
            const boost = (user: TapUser) => (user.departmentSlug === dept.slug ? 20 : 0);
            return boost(b) + tapUserScore(b) - (boost(a) + tapUserScore(a));
          });
        for (const hit of hits) {
          if (!owners.some((owner) => owner.id === hit.id)) owners.push(hit);
        }
      }
      const assignee = owners[0] ?? supervisor;
      const sharedWithIds = owners.filter((user) => user.id !== assignee?.id).map((user) => user.id);
      const description = `${dept.tap} · Person responsible: ${item.owners.join(" / ") || dept.responsible}${
        item.helpers?.length ? ` · With: ${item.helpers.join(" / ")}` : ""
      } · ${item.status}`;
      const matches = grouped.get(key) ?? [];
      const keep = matches[0];
      const extras = matches
        .slice(1)
        .filter((task) => task.source === "PROJECT" && task.labels.includes("TAP") && !task.dailyItem)
        .map((task) => task.id);
      if (extras.length) {
        await db.task.deleteMany({ where: { id: { in: extras } } });
      }
      if (keep) {
        const liveAssignee =
          keep.assigneeId && users.some((user) => user.id === keep.assigneeId) ? keep.assigneeId : null;
        const assigneeId = liveAssignee ?? assignee?.id ?? keep.assigneeId ?? null;
        const nextShared = Array.from(new Set(owners.map((user) => user.id).filter((id) => id !== assigneeId)));
        const nextDue = keep.dueDate ?? (item.deadline ? new Date(`${item.deadline}T00:00:00+03:00`) : null);
        const same =
          keep.description === description &&
          keep.assigneeId === assigneeId &&
          keep.sharedWithIds.length === nextShared.length &&
          keep.sharedWithIds.every((id) => nextShared.includes(id)) &&
          keep.labels.includes("TAP") &&
          keep.labels.includes(`Rock ${item.code}`) &&
          (keep.dueDate?.toISOString() ?? null) === (nextDue?.toISOString() ?? null);
        if (!same) {
          await db.task.update({
            where: { id: keep.id },
            data: {
              description,
              assigneeId,
              authorId: assigneeId ?? undefined,
              moveOwnerId: assigneeId ?? undefined,
              sharedWithIds: nextShared,
              labels: ["TAP", `Rock ${item.code}`],
              dueDate: nextDue,
            },
          });
        }
        continue;
      }

      const status = tapStatusToBoard(item.status);
      const taskKey = await allocateTaskKey(project.id);
      await db.task.create({
        data: {
          organizationId,
          projectId: project.id,
          taskKey,
          title,
          description,
          status,
          source: "PROJECT",
          departmentSlug: dept.slug,
          assigneeId: assignee?.id,
          authorId: assignee?.id,
          moveOwnerId: assignee?.id,
          sharedWithIds,
          labels: ["TAP", `Rock ${item.code}`],
          dueDate: item.deadline ? new Date(`${item.deadline}T00:00:00+03:00`) : null,
          columnOrder: Math.round(Number.parseFloat(item.code.replace(/^[^\d]*/, "")) * 100) || 0,
        },
      });
    }
  }

}

export async function syncDataTechTapTasks(organizationId: string) {
  return syncTapTasks(organizationId, "data-tech");
}
