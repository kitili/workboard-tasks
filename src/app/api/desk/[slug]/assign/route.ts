import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canAssignDesk, canViewDesk, isDeskSlug } from "@/lib/auth/desk";
import { assignTapToday, clearTapTodaySlot } from "@/lib/services/daily-sheet";
import { getDepartmentTapDesk } from "@/lib/services/department-desk";
import { db } from "@/lib/db";

const schema = z.object({
  userId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  clear: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const { slug } = await context.params;
  if (!isDeskSlug(slug) || !canViewDesk(session, slug)) {
    return NextResponse.json({ error: "That TAP desk stays inside its department." }, { status: 403 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pick a TAP line and a person." }, { status: 400 });

  const targetingSelf = body.data.userId === session.id;
  if (!canAssignDesk(session, slug) && !targetingSelf) {
    return NextResponse.json({ error: "You can park TAP on your own 1–5s, or ask a lead to allocate." }, { status: 403 });
  }

  const person = await db.user.findUnique({
    where: { id: body.data.userId },
    select: { id: true, name: true, username: true, email: true, organizationId: true, departmentSlug: true },
  });
  if (!person || person.organizationId !== session.organizationId || person.departmentSlug !== slug) {
    return NextResponse.json({ error: "Give this TAP to someone on this desk." }, { status: 404 });
  }

  if (body.data.clear) {
    await clearTapTodaySlot(person.id, body.data.slot ?? 0);
    const desk = await getDepartmentTapDesk(session.organizationId, slug, session.id);
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
  const desk = await getDepartmentTapDesk(session.organizationId, slug, session.id);
  return NextResponse.json({ ...result, desk });
}
