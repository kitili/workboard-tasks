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
import { DEPARTMENTS } from "@/lib/departments";

export const DESK_SLUGS = ["operations", "hr", "marketing", "data-tech"] as const;
export type DeskSlug = (typeof DESK_SLUGS)[number];

export function isDeskSlug(value: string | null | undefined): value is DeskSlug {
  return DESK_SLUGS.includes(value as DeskSlug);
}

export function deskTitle(slug: DeskSlug) {
  if (slug === "operations") return "Majundo’s TAP desk";
  if (slug === "hr") return "HR TAP desk";
  if (slug === "data-tech") return "Data & Tech TAP";
  return "Marketing TAP desk";
}

export function deskNavLabel(slug: DeskSlug) {
  if (slug === "operations") return "Ops TAP";
  if (slug === "hr") return "HR TAP";
  if (slug === "data-tech") return "Data & Tech TAP";
  return "Marketing TAP";
}

export function deskPath(slug: DeskSlug) {
  if (slug === "operations") return "/ops";
  if (slug === "hr") return "/hr";
  if (slug === "data-tech") return "/data-tech";
  return "/marketing";
}

export function isDeskMember(user: AdminPerson | null | undefined, slug: DeskSlug) {
  if (!user) return false;
  if (isBoardAdmin(user)) return true;
  if (user.departmentSlug === slug) return true;
  if (slug === "operations") return isOpsLead(user) || isOpsCrew(user);
  if (slug === "hr") return isHrMember(user);
  if (slug === "marketing") return isMarketingMember(user);
  if (slug === "data-tech") return isDataTechMember(user);
  return false;
}

export function canViewDesk(user: AdminPerson | null | undefined, slug: DeskSlug) {
  return isDeskMember(user, slug);
}

export function canAddDeskMembers(user: AdminPerson | null | undefined, slug: DeskSlug) {
  if (!user) return false;
  if (isBoardAdmin(user)) return true;
  if (slug === "operations") return isOpsLead(user) || isShikunzi(user);
  if (slug === "hr") return isHrLead(user);
  if (slug === "data-tech") return isBoardAdmin(user);
  return isMarketingLead(user);
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

export function viewerDeskSlug(user: AdminPerson | null | undefined): Exclude<DeskSlug, "data-tech"> | null {
  if (!user) return null;
  if (isOpsLead(user) || isOpsCrew(user) || user.departmentSlug === "operations") return "operations";
  if (isHrMember(user) || user.departmentSlug === "hr") return "hr";
  if (isMarketingMember(user) || user.departmentSlug === "marketing") return "marketing";
  return null;
}
