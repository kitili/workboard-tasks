import { NextRequest, NextResponse } from "next/server";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { syncLiveSheet } from "@/lib/services/daily-sheet";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.API_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return bearer === secret || request.headers.get("x-api-secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getDefaultOrganization();
  if (!org) return NextResponse.json({ error: "No organization yet." }, { status: 404 });
  const result = await syncLiveSheet(org.id);
  return NextResponse.json({ ok: true, ...result });
}
