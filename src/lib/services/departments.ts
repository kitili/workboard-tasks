import { db } from "@/lib/db";
import { inferDepartment } from "@/lib/departments";

export async function syncAllUserDepartments(organizationId: string) {
  const users = await db.user.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, username: true, email: true, jobTitle: true, departmentSlug: true },
  });
  for (const user of users) {
    const slug = inferDepartment(user);
    if (!slug || user.departmentSlug === slug) continue;
    await db.user.update({ where: { id: user.id }, data: { departmentSlug: slug } });
    await db.task.updateMany({
      where: { assigneeId: user.id, OR: [{ departmentSlug: null }, { departmentSlug: "" }] },
      data: { departmentSlug: slug },
    });
  }
}

export async function syncUserDepartment(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, email: true, jobTitle: true, departmentSlug: true },
  });
  if (!user) return null;
  const slug = inferDepartment(user);
  if (!slug) return user.departmentSlug ?? null;
  if (user.departmentSlug !== slug) {
    await db.user.update({ where: { id: user.id }, data: { departmentSlug: slug } });
    await db.task.updateMany({
      where: { assigneeId: user.id, OR: [{ departmentSlug: null }, { departmentSlug: "" }] },
      data: { departmentSlug: slug },
    });
  }
  return slug;
}
