import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { canRunOpsDesk, canViewOpsDesk, getOpsTapDesk } from "@/lib/services/ops-desk";
import { OpsTapDesk } from "@/components/ops/ops-tap-desk";

export const dynamic = "force-dynamic";

export default async function OpsTapPage() {
  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) redirect("/login");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;
  if (!canViewOpsDesk(session)) redirect("/today");

  const desk = await getOpsTapDesk(org.id);
  return (
    <OpsTapDesk
      groups={desk.groups}
      people={desk.people}
      canAssign={canRunOpsDesk(session)}
    />
  );
}