import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canViewDesk, deskTitle } from "@/lib/auth/desk";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { deskPermissions, getDepartmentTapDesk } from "@/lib/services/department-desk";
import { DepartmentTapDesk } from "@/components/desk/department-tap-desk";
import { sheetDeskBlurb } from "@/lib/board/sheet-status";
import { preferredCompletedWord } from "@/lib/data/tap-catalog";

export const dynamic = "force-dynamic";

export default async function OpsTapPage() {
  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;
  if (!canViewDesk(session, "operations")) redirect("/today");

  const desk = await getDepartmentTapDesk(org.id, "operations", session.id);
  const access = deskPermissions(session, "operations");
  return (
    <DepartmentTapDesk
      slug="operations"
      title={deskTitle("operations")}
      blurb={`Every ops rock and sub-rock, plus TAP that names Baraka, Francis, Kusaduka, or Shikunzi anywhere in the sheet. Baraka and Shikunzi can add people with roles. ${sheetDeskBlurb(preferredCompletedWord("operations"))}`}
      viewerId={session.id}
      groups={desk.groups}
      people={desk.people}
      allocations={desk.allocations}
      myCards={desk.myCards}
      catalogNames={desk.catalogNames}
      canAssign={access.canAssign}
      canEditStatus={access.canEditStatus}
      canAddMembers={access.canAddMembers}
    />
  );
}
