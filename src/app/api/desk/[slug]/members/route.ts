import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { canAddDeskMembers, isDeskSlug } from "@/lib/auth/desk";
import { addDeskMember, getDepartmentTapDesk } from "@/lib/services/department-desk";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(254).optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const { slug } = await context.params;
  if (!isDeskSlug(slug) || !canAddDeskMembers(session, slug)) {
    return NextResponse.json({ error: "Only a desk host can add people here." }, { status: 403 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Name is required. Email lets them log in." }, { status: 400 });

  try {
    const person = await addDeskMember(session.organizationId, slug, body.data);
    const desk = await getDepartmentTapDesk(session.organizationId, slug, session.id);
    return NextResponse.json({ ...person, desk });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that person.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
