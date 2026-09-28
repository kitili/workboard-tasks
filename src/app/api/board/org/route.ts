import { NextResponse } from "next/server";
import { isBoardAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { getOrganizationBoard } from "@/lib/data/board";

export async function GET() {
  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const data = await getOrganizationBoard(org.id, isBoardAdmin(session) ? undefined : session.id);
  if (!data) return NextResponse.json({ error: "No organization" }, { status: 404 });

  return NextResponse.json(data);
}
