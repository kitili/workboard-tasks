import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { assignTapToday } from "@/lib/services/daily-sheet";
import { canRunOpsDesk, getOpsTapDesk } from "@/lib/services/ops-desk";
import { db } from "@/lib/db";

const schema = z.object({
  taskId: z.string().min(1),
  userId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!canRunOpsDesk(session)) {
    return NextResponse.json({ error: "Only Majundo or an admin can assign today’s TAP." }, { status: 403 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick a TAP line and a person." }, { status: 400 });

  const [task, person] = await Promise.all([
    db.task.findUnique({ where: { id: body.data.taskId }, select: { id: true, labels: true } }),
    db.user.findUnique({ where: { id: body.data.userId }, select: { id: true, organizationId: true } }),
  ]);
  if (!task?.labels.includes("TAP") || !person || person.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "That TAP line or person was not found." }, { status: 404 });
  }

  const result = await assignTapToday(person.id, task.id);
  const desk = await getOpsTapDesk(session.organizationId);
  return NextResponse.json({ ...result, desk });
}