import { NextRequest, NextResponse } from "next/server";
import type { TaskStatus } from "@/generated/prisma/client";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canAssignDesk, canEditDeskTap, canViewDesk, isDeskSlug } from "@/lib/auth/desk";
import { returnToTasksError } from "@/lib/board/columns";
import { columnForSheetPhrase, isSheetPhrase, sheetCardPhrase, writeSheetPhrase, type SheetPhrase } from "@/lib/board/sheet-status";
import { syncDailyItemStatus } from "@/lib/services/daily-sheet";
import { getDepartmentTapDesk } from "@/lib/services/department-desk";
import { db } from "@/lib/db";

const schema = z
  .object({
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
    tapStatus: z
      .enum(["Not Started", "On Schedule", "Ongoing", "Partially Completed", "Behind Schedule", "Fully Completed", "Completed"])
      .optional(),
    shareWith: z.string().min(1).optional(),
    assigneeId: z.string().nullable().optional(),
  })
  .refine((value) => value.dueDate !== undefined || value.status || value.tapStatus || value.shareWith || value.assigneeId !== undefined);

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
    select: { id: true, labels: true, source: true, organizationId: true, description: true, status: true, sharedWithIds: true, departmentSlug: true },
  });
  const onThisDesk = Boolean(task && (task.labels.includes("TAP") || (task.source === "DAILY" && task.departmentSlug === slug)));
  if (!onThisDesk || task?.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "That card is not on this tab." }, { status: 404 });
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

  const phrase = body.data.tapStatus && isSheetPhrase(body.data.tapStatus) ? body.data.tapStatus : null;
  const nextStatus = phrase ? columnForSheetPhrase(phrase) : body.data.status;
  if (nextStatus) {
    const blocked = returnToTasksError(task.status, nextStatus);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  }
  const nextShared = body.data.shareWith
    ? Array.from(new Set([...task.sharedWithIds, body.data.shareWith]))
    : undefined;
  await db.task.update({
    where: { id },
    data: {
      dueDate: body.data.dueDate === undefined ? undefined : body.data.dueDate ? new Date(`${body.data.dueDate}T00:00:00+03:00`) : null,
      status: nextStatus as "BACKLOG" | "TODO" | "IN_PROGRESS" | "COMPLETED" | undefined,
      assigneeId: body.data.assigneeId === undefined ? undefined : body.data.assigneeId,
      moveOwnerId: body.data.assigneeId === undefined ? undefined : body.data.assigneeId ?? undefined,
      sharedWithIds: nextShared,
      description: phrase
        ? writeSheetPhrase(task.description, phrase as SheetPhrase)
        : nextStatus && nextStatus !== task.status
          ? writeSheetPhrase(task.description, sheetCardPhrase(nextStatus, task.description, task.departmentSlug ?? slug) as SheetPhrase)
          : undefined,
      completedAt: nextStatus ? (nextStatus === "COMPLETED" ? new Date() : null) : undefined,
    },
  });
  if (nextStatus && nextStatus !== task.status) {
    await syncDailyItemStatus(task.id, nextStatus as TaskStatus);
  }
  const desk = await getDepartmentTapDesk(session.organizationId, slug, session.id);
  return NextResponse.json({ desk });
}
