import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canViewDesk, deskTitle } from "@/lib/auth/desk";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { deskPermissions, getDepartmentTapDesk } from "@/lib/services/department-desk";
import { DepartmentTapDesk } from "@/components/desk/department-tap-desk";

export const dynamic = "force-dynamic";

export default async function MarketingTapPage() {
  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;
  if (!canViewDesk(session, "marketing")) redirect("/today");

  const desk = await getDepartmentTapDesk(org.id, "marketing", session.id);
  const access = deskPermissions(session, "marketing");
  return (
    <DepartmentTapDesk
      slug="marketing"
      title={deskTitle("marketing")}
      blurb="Kilusu, Erick, and Mariam all sit on this desk. Pick TAP onto today’s 1–5s, share or allocate cards inside marketing, and drag your own cards to Backlog, To do, Doing, or Done."
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
