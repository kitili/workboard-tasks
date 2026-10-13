import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { returnToTasksError } from "@/lib/board/columns";
import { sheetCardPhrase, writeSheetPhrase, type SheetPhrase } from "@/lib/board/sheet-status";
import { canEditOpsTap, canRunOpsDesk, getOpsTapDesk } from "@/lib/services/ops-desk";
import { syncDailyItemStatus } from "@/lib/services/daily-sheet";
import { db } from "@/lib/db";

const schema = z
  .object({
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
  })
  .refine((value) => value.dueDate !== undefined || value.status);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!canEditOpsTap(session)) {
    return NextResponse.json({ error: "Only ops or an admin can edit this TAP." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Use a date or a status." }, { status: 400 });
  if (body.data.dueDate !== undefined && !canRunOpsDesk(session)) {
    return NextResponse.json({ error: "Only Majundo or an admin can change TAP deadlines." }, { status: 403 });
  }

  const task = await db.task.findUnique({
    where: { id },
    select: { id: true, labels: true, organizationId: true, description: true, status: true, departmentSlug: true },
  });
  if (!task?.labels.includes("TAP") || task.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "TAP line not found." }, { status: 404 });
  }

  const nextStatus = body.data.status;
  if (nextStatus) {
    const blocked = returnToTasksError(task.status, nextStatus);
    if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });
  }
  await db.task.update({
    where: { id },
    data: {
      dueDate: body.data.dueDate === undefined ? undefined : body.data.dueDate ? new Date(`${body.data.dueDate}T00:00:00+03:00`) : null,
      status: nextStatus,
      description:
        nextStatus && nextStatus !== task.status
          ? writeSheetPhrase(task.description, sheetCardPhrase(nextStatus, task.description, task.departmentSlug) as SheetPhrase)
          : undefined,
      completedAt: nextStatus ? (nextStatus === "COMPLETED" ? new Date() : null) : undefined,
    },
  });
  if (nextStatus && nextStatus !== task.status) {
    await syncDailyItemStatus(task.id, nextStatus);
    await db.taskActivity.create({
      data: {
        taskId: task.id,
        type: "STATUS_CHANGED",
        fromStatus: task.status,
        toStatus: nextStatus,
        message: "Moved on the ops desk",
      },
    });
  }
  const desk = await getOpsTapDesk(session.organizationId);
  return NextResponse.json({ desk });
}
