import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isBoardAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { allocateTaskKey } from "@/lib/board/task-key";

const createSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z
    .enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED", "CANCELLED"])
    .optional(),
  type: z.enum(["TASK", "STORY", "BUG"]).optional(),
  priority: z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).optional(),
  assigneeId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
    const body = createSchema.parse(await request.json());

    const project = await db.project.findUnique({
      where: { id: body.projectId },
      select: { id: true, organizationId: true },
    });

    if (!project || project.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let departmentSlug = session.departmentSlug;
    if (body.assigneeId) {
      const person = await db.user.findUnique({
        where: { id: body.assigneeId },
        select: { departmentSlug: true, organizationId: true },
      });
      if (!person || person.organizationId !== session.organizationId) {
        return NextResponse.json({ error: "That person is not on this desk." }, { status: 404 });
      }
      if (
        !isBoardAdmin(session) &&
        session.departmentSlug &&
        person.departmentSlug &&
        person.departmentSlug !== session.departmentSlug
      ) {
        return NextResponse.json({ error: "Give this task to someone in your department." }, { status: 403 });
      }
      departmentSlug = person.departmentSlug ?? departmentSlug;
    }

    const taskKey = await allocateTaskKey(project.id);
    const maxOrder = await db.task.aggregate({
      where: { projectId: project.id, status: body.status ?? "BACKLOG" },
      _max: { columnOrder: true },
    });

    const task = await db.task.create({
      data: {
        organizationId: project.organizationId,
        projectId: project.id,
        taskKey,
        title: body.title,
        description: body.description,
        status: body.status ?? "BACKLOG",
        type: body.type ?? "TASK",
        priority: body.priority ?? "MEDIUM",
        assigneeId: body.assigneeId,
        labels: body.labels ?? [],
        departmentSlug,
        storyPoints: body.storyPoints,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        columnOrder: (maxOrder._max.columnOrder ?? -1) + 1,
        source: "MANUAL",
        completedAt: body.status === "COMPLETED" ? new Date() : null,
      },
      include: {
        assignee: { select: { id: true, name: true, phone: true } },
        project: { select: { id: true, name: true, key: true } },
        _count: { select: { comments: true } },
      },
    });

    await db.taskActivity.create({
      data: {
        taskId: task.id,
        userId: body.assigneeId ?? undefined,
        type: "CREATED",
        toStatus: task.status,
        message: `Created ${taskKey} on board`,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
