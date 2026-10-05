import { NextResponse } from "next/server";
import { isBoardAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { getOrganizationBoard } from "@/lib/data/board";

export async function GET() {
  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const admin = isBoardAdmin(session);
  const data = await getOrganizationBoard(org.id, {
    assigneeId: admin || session.departmentSlug ? undefined : session.id,
    departmentSlug: admin ? undefined : session.departmentSlug,
  });
  if (!data) return NextResponse.json({ error: "No organization" }, { status: 404 });

  return NextResponse.json(data);
}
