import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { canViewDesk, deskPath, deskTitle, isDeskSlug } from "@/lib/auth/desk";
import { departmentBySlug } from "@/lib/departments";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { deskPermissions, getDepartmentTapDesk } from "@/lib/services/department-desk";
import { DepartmentTapDesk } from "@/components/desk/department-tap-desk";
import { sheetDeskBlurb } from "@/lib/board/sheet-status";
import { preferredCompletedWord } from "@/lib/data/tap-catalog";

export const dynamic = "force-dynamic";

export default async function DepartmentTapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isDeskSlug(slug)) redirect("/today");
  const dedicated = deskPath(slug);
  if (dedicated !== `/tap/${slug}`) redirect(dedicated);

  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;
  if (!canViewDesk(session, slug)) redirect("/today");

  const desk = await getDepartmentTapDesk(org.id, slug, session.id);
  const access = deskPermissions(session, slug);
  const name = departmentBySlug(slug)?.name ?? "This department";
  return (
    <DepartmentTapDesk
      slug={slug}
      title={deskTitle(slug)}
      blurb={`${name} sees its own people here. Add a task and give it to someone on this team. ${sheetDeskBlurb(preferredCompletedWord(slug))}`}
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
