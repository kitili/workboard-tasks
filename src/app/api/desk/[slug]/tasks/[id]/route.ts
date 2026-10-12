import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canAssignDesk, canEditDeskTap, canViewDesk, isDeskSlug } from "@/lib/auth/desk";
import { boardStatusToTap, stampTapDescription } from "@/lib/data/tap-catalog";
import { syncDailyItemStatus } from "@/lib/services/daily-sheet";
import { getDepartmentTapDesk } from "@/lib/services/department-desk";
import { db } from "@/lib/db";

const schema = z
  .object({
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
    shareWith: z.string().min(1).optional(),
    assigneeId: z.string().nullable().optional(),
  })
  .refine((value) => value.dueDate !== undefined || value.status || value.shareWith || value.assigneeId !== undefined);

type RouteContext = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const { slug, id } = await context.params;
  if (!isDeskSlug(slug) || !canViewDesk(session, slug)) {
    return NextResponse.json({ error: "That TAP desk stays inside its department." }, { status: 403 });
  }
  if (!canEditDeskTap(session, slug)) {
    return NextResponse.json({ error: "Only this department can edit this TAP." }, { status: 403 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Use a date, a status, or a teammate." }, { status: 400 });
  if (body.data.dueDate !== undefined && !canAssignDesk(session, slug)) {
    return NextResponse.json({ error: "Only a lead can change TAP deadlines." }, { status: 403 });
  }

  const task = await db.task.findUnique({
    where: { id },
    select: { id: true, labels: true, organizationId: true, description: true, status: true, sharedWithIds: true, departmentSlug: true },
  });
  if (!task?.labels.includes("TAP") || task.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "TAP line not found." }, { status: 404 });
  }

  if (body.data.shareWith || body.data.assigneeId) {
    const otherId = body.data.shareWith ?? body.data.assigneeId;
    if (otherId) {
      const other = await db.user.findUnique({ where: { id: otherId }, select: { departmentSlug: true, organizationId: true } });
      if (!other || other.organizationId !== session.organizationId || other.departmentSlug !== slug) {
        return NextResponse.json({ error: "Cards stay inside this department." }, { status: 403 });
      }
    }
  }

  const nextStatus = body.data.status;
  const nextShared = body.data.shareWith
    ? Array.from(new Set([...task.sharedWithIds, body.data.shareWith]))
    : undefined;
  await db.task.update({
    where: { id },
    data: {
      dueDate: body.data.dueDate === undefined ? undefined : body.data.dueDate ? new Date(`${body.data.dueDate}T00:00:00+03:00`) : null,
      status: nextStatus,
      assigneeId: body.data.assigneeId === undefined ? undefined : body.data.assigneeId,
      moveOwnerId: body.data.assigneeId === undefined ? undefined : body.data.assigneeId ?? undefined,
      sharedWithIds: nextShared,
      description:
        nextStatus && nextStatus !== task.status
          ? stampTapDescription(task.description, boardStatusToTap(nextStatus))
          : undefined,
      completedAt: nextStatus ? (nextStatus === "COMPLETED" ? new Date() : null) : undefined,
    },
  });
  if (nextStatus && nextStatus !== task.status) {
    await syncDailyItemStatus(task.id, nextStatus);
  }
  const desk = await getDepartmentTapDesk(session.organizationId, slug, session.id);
  return NextResponse.json({ desk });
}
