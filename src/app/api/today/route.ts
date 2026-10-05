import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { addTodayTask, deleteTodaySlot, getTodaySheet, saveTodaySlots } from "@/lib/services/daily-sheet";

const prioritySchema = z.enum(["LOWEST", "LOW", "MEDIUM", "HIGH", "HIGHEST"]).nullable().optional();

const listSchema = z.object({
  slots: z
    .array(
      z.object({
        title: z.string(),
        priority: prioritySchema,
        slot: z.number().int().min(1).max(5).optional(),
        taskId: z.string().optional(),
      }),
    )
    .min(1)
    .max(8),
});

const extraSchema = z.object({
  title: z.string().min(1),
  priority: prioritySchema,
  status: z.enum(["TODO", "IN_PROGRESS", "BACKLOG", "COMPLETED"]).optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const sheet = await getTodaySheet(user.organizationId);
  const me = sheet.people.find((person) => person.id === user.id) ?? null;
  return NextResponse.json({ user, me });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });

  try {
    const body = await request.json();
    if (body && Array.isArray(body.slots)) {
      const list = listSchema.parse(body);
      const filled = list.slots.filter((slot) => slot.title.trim());
      if (filled.length === 0) {
        return NextResponse.json({ error: "Fill in at least one task" }, { status: 400 });
      }
      await saveTodaySlots(
        user.id,
        filled.map((slot) => ({
          title: slot.title,
          priority: slot.priority ?? null,
          slot: slot.slot,
          taskId: slot.taskId,
        })),
      );
    } else {
      const extra = extraSchema.parse(body);
      await addTodayTask(user.id, {
        title: extra.title,
        priority: extra.priority ?? null,
        status: extra.status,
      });
    }
    const sheet = await getTodaySheet(user.organizationId);
    return NextResponse.json({ me: sheet.people.find((person) => person.id === user.id) ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const slot = Number(new URL(request.url).searchParams.get("slot"));
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
    return NextResponse.json({ error: "Which line should be removed?" }, { status: 400 });
  }
  await deleteTodaySlot(user.id, slot);
  const sheet = await getTodaySheet(user.organizationId);
  return NextResponse.json({ me: sheet.people.find((person) => person.id === user.id) ?? null });
}
