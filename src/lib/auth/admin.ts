export type AdminPerson = {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
};

function haystack(user: AdminPerson) {
  return [user.name, user.username, user.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function wordsOf(text: string) {
  return text.split(/[^a-z0-9]+/).filter(Boolean);
}

function named(user: AdminPerson, first: string, lasts: string[] = []) {
  const words = [...new Set(wordsOf(haystack(user)))];
  if (!words.includes(first)) return false;
  if (lasts.length === 0) return true;
  if (lasts.some((last) => words.includes(last))) return true;
  return words.length === 1;
}

export function isBoardAdmin(user: AdminPerson | null | undefined) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return (
    named(user, "nelly", ["zablon"]) ||
    named(user, "krupa", ["patel"]) ||
    named(user, "cook") ||
    named(user, "maureen", ["kitili", "kittili"]) ||
    named(user, "paul", ["victor"])
  );
}

export function isUpdatesAdmin(user: AdminPerson | null | undefined) {
  return isBoardAdmin(user);
}
