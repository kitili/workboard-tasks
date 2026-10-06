import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { opsDeskPersonLabel } from "@/lib/auth/admin";
import { assignTapToday, clearTapTodaySlot } from "@/lib/services/daily-sheet";
import { canRunOpsDesk, getOpsTapDesk } from "@/lib/services/ops-desk";
import { db } from "@/lib/db";

const schema = z.object({
  userId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  clear: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!canRunOpsDesk(session)) {
    return NextResponse.json({ error: "Only Majundo or an admin can assign today’s TAP." }, { status: 403 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick a TAP line and a person." }, { status: 400 });

  const person = await db.user.findUnique({
    where: { id: body.data.userId },
    select: { id: true, name: true, username: true, email: true, organizationId: true },
  });
  if (!person || person.organizationId !== session.organizationId || !opsDeskPersonLabel(person)) {
    return NextResponse.json({ error: "Give today’s three to Baraka, Francis, Kusaduka, or Shikunzi." }, { status: 404 });
  }

  if (body.data.clear) {
    await clearTapTodaySlot(person.id, body.data.slot ?? 0);
    const desk = await getOpsTapDesk(session.organizationId);
    return NextResponse.json({ cleared: true, desk });
  }

  if (!body.data.taskId) {
    return NextResponse.json({ error: "Pick a TAP line and a person." }, { status: 400 });
  }

  const task = await db.task.findUnique({ where: { id: body.data.taskId }, select: { id: true, labels: true } });
  if (!task?.labels.includes("TAP")) {
    return NextResponse.json({ error: "That TAP line or person was not found." }, { status: 404 });
  }

  const result = await assignTapToday(person.id, task.id, body.data.slot);
  const desk = await getOpsTapDesk(session.organizationId);
  return NextResponse.json({ ...result, desk });
}
