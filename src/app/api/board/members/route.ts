import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isBoardAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { DEPARTMENTS } from "@/lib/departments";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  departmentSlug: z.string(),
  role: z.string().trim().max(80).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  if (!isBoardAdmin(session)) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = schema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Name and department are required." }, { status: 400 });

  const department = DEPARTMENTS.find((item) => item.slug === body.data.departmentSlug);
  if (!department) return NextResponse.json({ error: "Unknown department." }, { status: 400 });

  const name = body.data.name.trim();
  const role = body.data.role?.trim() || "Department support";
  const key = `${department.slug}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const existing = await db.user.findFirst({
    where: {
      organizationId: session.organizationId,
      isActive: true,
      name: { equals: name, mode: "insensitive" },
      departmentSlug: department.slug,
    },
  });
  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: { jobTitle: existing.jobTitle?.trim() ? existing.jobTitle : role },
    });
    return NextResponse.json({ id: existing.id, name: existing.name, departmentSlug: department.slug });
  }

  const user = await db.user.create({
    data: {
      organizationId: session.organizationId,
      name,
      username: `tap-${key}`.slice(0, 40),
      phone: `tap:${key}`,
      departmentSlug: department.slug,
      jobTitle: role,
    },
  });

  return NextResponse.json({ id: user.id, name: user.name, departmentSlug: department.slug });
}
