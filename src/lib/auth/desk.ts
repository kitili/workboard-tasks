import {
  isBoardAdmin,
  isDataTechMember,
  isHrLead,
  isHrMember,
  isMarketingLead,
  isMarketingMember,
  isOpsCrew,
  isOpsLead,
  isShikunzi,
  type AdminPerson,
} from "@/lib/auth/admin";
import { DEPARTMENTS, departmentBySlug, type DepartmentSlug } from "@/lib/departments";
import { tapDepartment, tapOwnerKey } from "@/lib/data/tap-catalog";

export const DESK_SLUGS = DEPARTMENTS.map((item) => item.slug);
export type DeskSlug = DepartmentSlug;

export function isDeskSlug(value: string | null | undefined): value is DeskSlug {
  return DESK_SLUGS.includes(value as DeskSlug);
}

const NAV_LABELS: Partial<Record<DeskSlug, string>> = {
  operations: "Ops",
  hr: "HR",
  marketing: "Marketing",
  "data-tech": "Data & Tech",
  finance: "Finance",
  expansion: "Expansion",
  ece: "ECE",
  "elimu-soko": "Elimu Soko",
  "usa-river": "Usa River",
  "arusha-modern": "Arusha Modern",
  boma: "Boma",
  kijenge: "Kijenge",
  ilboru: "Ilboru",
};

export function deskTitle(slug: DeskSlug) {
  if (slug === "operations") return "Majundo’s TAP desk";
  if (slug === "hr") return "HR TAP desk";
  if (slug === "data-tech") return "Data & Tech TAP";
  if (slug === "marketing") return "Marketing TAP desk";
  return `${departmentBySlug(slug)?.name ?? "Department"} TAP`;
}

export function deskNavLabel(slug: DeskSlug) {
  return NAV_LABELS[slug] ?? departmentBySlug(slug)?.name ?? slug;
}

export function deskPath(slug: DeskSlug) {
  if (slug === "operations") return "/ops";
  if (slug === "hr") return "/hr";
  if (slug === "marketing") return "/marketing";
  if (slug === "data-tech") return "/data-tech";
  return `/tap/${slug}`;
}

export function isDepartmentResponsible(user: AdminPerson | null | undefined, slug: DeskSlug) {
  if (!user) return false;
  const responsible = tapDepartment(slug)?.responsible ?? "";
  const key = tapOwnerKey(user.name ?? user.username ?? "");
  if (!key || key.startsWith("team:")) return false;
  return responsible.split("/").some((part) => {
    const lead = tapOwnerKey(part);
    return Boolean(lead) && !lead.startsWith("team:") && lead === key;
  });
}

export function isDeskMember(user: AdminPerson | null | undefined, slug: DeskSlug) {
  if (!user) return false;
  if (isBoardAdmin(user)) return true;
  if (user.departmentSlug === slug) return true;
  if (slug === "operations") return isOpsLead(user) || isOpsCrew(user);
  if (slug === "hr") return isHrMember(user);
  if (slug === "marketing") return isMarketingMember(user);
  if (slug === "data-tech") return isDataTechMember(user);
  return isDepartmentResponsible(user, slug);
}

export function canViewDesk(user: AdminPerson | null | undefined, slug: DeskSlug) {
  return isDeskMember(user, slug);
}

export function canAddDeskMembers(user: AdminPerson | null | undefined, slug: DeskSlug) {
  if (!user) return false;
  if (isBoardAdmin(user)) return true;
  if (isDepartmentResponsible(user, slug)) return true;
  if (slug === "operations") return isOpsLead(user) || isShikunzi(user);
  if (slug === "hr") return isHrLead(user);
  if (slug === "marketing") return isMarketingLead(user);
  return false;
}

/** A person can park a line on their own 1–5. Giving it to someone else stays inside the department, and only a lead does that on Ops. */
export function canGiveDeskTask(user: AdminPerson | null | undefined, slug: DeskSlug, targetIsSelf: boolean) {
  if (!canViewDesk(user, slug)) return false;
  if (targetIsSelf) return true;
  return canAssignDesk(user, slug);
}

export function desksForUser(user: AdminPerson | null | undefined) {
  if (!user) return [];
  return DESK_SLUGS.filter((slug) => canViewDesk(user, slug)).map((slug) => ({
    href: deskPath(slug),
    label: deskNavLabel(slug),
  }));
}

export function canAssignDesk(user: AdminPerson | null | undefined, slug: DeskSlug) {
  if (!user) return false;
  if (isBoardAdmin(user)) return true;
  if (slug === "operations") return isOpsLead(user);
  return isDeskMember(user, slug);
}

export function canEditDeskTap(user: AdminPerson | null | undefined, slug: DeskSlug) {
  return isDeskMember(user, slug);
}

export function deskDepartmentName(slug: DeskSlug) {
  return DEPARTMENTS.find((item) => item.slug === slug)?.name ?? slug;
}

export function viewerDeskSlug(user: AdminPerson | null | undefined): "operations" | "hr" | "marketing" | null {
  if (!user) return null;
  if (isOpsLead(user) || isOpsCrew(user) || user.departmentSlug === "operations") return "operations";
  if (isHrMember(user) || user.departmentSlug === "hr") return "hr";
  if (isMarketingMember(user) || user.departmentSlug === "marketing") return "marketing";
  return null;
}
