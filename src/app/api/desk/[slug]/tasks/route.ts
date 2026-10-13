import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canAssignDesk, canViewDesk, isDeskSlug } from "@/lib/auth/desk";
import { addDeskTask, getDepartmentTapDesk } from "@/lib/services/department-desk";

const schema = z.object({
  title: z.string().trim().min(1).max(240),
  assigneeId: z.string().min(1),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const { slug } = await context.params;
  if (!isDeskSlug(slug) || !canViewDesk(session, slug) || !canAssignDesk(session, slug)) {
    return NextResponse.json({ error: "Only this department can add a task for its own people." }, { status: 403 });
  }
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Write the task and pick someone on this department." }, { status: 400 });

  try {
    await addDeskTask(session.organizationId, slug, {
      title: body.data.title,
      assigneeId: body.data.assigneeId,
      authorId: session.id,
    });
    const desk = await getDepartmentTapDesk(session.organizationId, slug, session.id);
    return NextResponse.json({ desk });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
