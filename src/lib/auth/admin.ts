export type AdminPerson = {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  departmentSlug?: string | null;
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
    named(user, "mourine", ["kitili", "kittili"]) ||
    named(user, "paul", ["victor"])
  );
}

export function isOpsLead(user: AdminPerson | null | undefined) {
  if (!user) return false;
  return named(user, "baraka", ["majundo"]) || named(user, "majundo");
}

export const OPS_CREW_NAMES = ["Francis", "Kusaduka", "Shikunzi"] as const;
export type OpsCrewName = (typeof OPS_CREW_NAMES)[number];
export const OPS_DESK_NAMES = ["Baraka", "Francis", "Kusaduka", "Shikunzi"] as const;
export type OpsDeskName = (typeof OPS_DESK_NAMES)[number];

export function opsCrewLabel(user: AdminPerson | null | undefined): OpsCrewName | null {
  if (!user || isOpsLead(user)) return null;
  const text = haystack(user);
  if (/\bshikunzi\b|\bshikuze\b|\bshikonze\b|\bshikunze\b/.test(text)) return "Shikunzi";
  if (/\bkusaduka\b/.test(text)) return "Kusaduka";
  if (/\bfrancis\b/.test(text)) return "Francis";
  return null;
}

export function opsDeskPersonLabel(user: AdminPerson | null | undefined): OpsDeskName | null {
  if (!user) return null;
  if (isOpsLead(user)) return "Baraka";
  return opsCrewLabel(user);
}

export function isOpsCrew(user: AdminPerson | null | undefined) {
  return Boolean(opsCrewLabel(user));
}

export function isShikunzi(user: AdminPerson | null | undefined) {
  return opsCrewLabel(user) === "Shikunzi";
}

export function isHrLead(user: AdminPerson | null | undefined) {
  if (!user) return false;
  return named(user, "esther", ["mwalyego"]);
}

export function isHrMember(user: AdminPerson | null | undefined) {
  if (!user) return false;
  if (user.departmentSlug === "hr" || isHrLead(user)) return true;
  return named(user, "valentina") || named(user, "bwana");
}

export function isMarketingLead(user: AdminPerson | null | undefined) {
  if (!user) return false;
  return named(user, "kilusu", ["mattasia"]);
}

export function isMarketingMember(user: AdminPerson | null | undefined) {
  if (!user) return false;
  if (user.departmentSlug === "marketing" || isMarketingLead(user)) return true;
  return named(user, "mariam");
}

export function isDataTechMember(user: AdminPerson | null | undefined) {
  if (!user) return false;
  if (user.departmentSlug === "data-tech") return true;
  return (
    named(user, "onesmo") ||
    named(user, "nehemia") ||
    named(user, "katya") ||
    named(user, "irene", ["musau"])
  );
}

export function isUpdatesAdmin(user: AdminPerson | null | undefined) {
  return isBoardAdmin(user);
}
