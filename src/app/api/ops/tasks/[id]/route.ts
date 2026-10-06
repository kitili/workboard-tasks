import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canRunOpsDesk, getOpsTapDesk } from "@/lib/services/ops-desk";
import { db } from "@/lib/db";

const schema = z.object({
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!canRunOpsDesk(session)) {
    return NextResponse.json({ error: "Only Majundo or an admin can change TAP deadlines." }, { status: 403 });
  }

  const { id } = await context.params;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Use a date, or clear it." }, { status: 400 });

  const task = await db.task.findUnique({ where: { id }, select: { id: true, labels: true, organizationId: true } });
  if (!task?.labels.includes("TAP") || task.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "TAP line not found." }, { status: 404 });
  }

  await db.task.update({
    where: { id },
    data: { dueDate: body.data.dueDate ? new Date(`${body.data.dueDate}T00:00:00+03:00`) : null },
  });
  const desk = await getOpsTapDesk(session.organizationId);
  return NextResponse.json({ desk });
}