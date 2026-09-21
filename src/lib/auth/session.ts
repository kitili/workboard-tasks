import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "d5_user";

export async function getSessionUser() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;

  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      phone: true,
      organizationId: true,
      role: true,
      jobTitle: true,
      bio: true,
      avatarUrl: true,
    },
  });
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
