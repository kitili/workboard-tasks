import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canViewDesk, deskTitle } from "@/lib/auth/desk";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { deskPermissions, getDepartmentTapDesk } from "@/lib/services/department-desk";
import { DepartmentTapDesk } from "@/components/desk/department-tap-desk";
import { sheetDeskBlurb } from "@/lib/board/sheet-status";
import { preferredCompletedWord } from "@/lib/data/tap-catalog";

export const dynamic = "force-dynamic";

export default async function DataTechTapPage() {
  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;
  if (!canViewDesk(session, "data-tech")) redirect("/today");

  const desk = await getDepartmentTapDesk(org.id, "data-tech", session.id);
  const access = deskPermissions(session, "data-tech");
  return (
    <DepartmentTapDesk
      slug="data-tech"
      title={deskTitle("data-tech")}
      blurb={`Data & Tech TAP. ${sheetDeskBlurb(preferredCompletedWord("data-tech"))}`}
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
