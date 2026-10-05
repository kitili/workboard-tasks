import { redirect } from "next/navigation";
import { isBoardAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { getKpiDashboard } from "@/lib/services/kpi";
import { Donut, MiniBars, StatusPie } from "@/components/kpi/charts";
import { DeptScoreboard } from "@/components/kpi/scoreboard";
import { PagedNames } from "@/components/kpi/paged-names";

export const dynamic = "force-dynamic";

export default async function KpiPage() {
  const [session, org] = await Promise.all([getSessionUser(), getDefaultOrganization()]);
  if (!session) redirect("/login");
  if (!isBoardAdmin(session)) redirect("/today");
  if (!org) return <p className="text-zinc-500">No organization yet.</p>;

  const kpi = await getKpiDashboard(org.id);
  const topAlerts = kpi.alerts.slice(0, 4);
  const lagging = kpi.tapDepts.flatMap((dept) =>
    dept.lagging.slice(0, 1).map((item) => ({
      id: `${dept.slug}-${item.code}`,
      name: `${dept.name}: ${item.code} ${item.title}`,
    })),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl bg-[#002368] px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#80BFEC]">Pulse</p>
        <h2 className="mt-1 text-3xl font-semibold text-white">KPI</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#D9ECF9]">
          {kpi.overall.tapPct}% of OPSP TAP is done. {kpi.overall.behind} lines are behind. {kpi.overall.filedToday} of{" "}
          {kpi.overall.expected} filed today’s 1–5’s.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat wash="#D9ECF9" label="TAP done" value={`${kpi.overall.tapPct}%`} />
        <Stat wash="#FFF7E5" label="Behind" value={String(kpi.overall.behind)} />
        <Stat wash="#F3EEFF" label="Filed today" value={`${kpi.overall.filedToday}/${kpi.overall.expected}`} />
        <Stat wash="#FFE8EE" label="Quiet 7 days" value={String(kpi.overall.quietWeek)} />
      </section>

      {topAlerts.length ? (
        <section className="rounded-3xl bg-[#FFF7E5] px-5 py-4">
          <h3 className="text-lg font-semibold">Watch</h3>
          <ul className="mt-2 space-y-1 text-sm text-[#14233B]">
            {topAlerts.map((alert) => (
              <li key={alert}>• {alert}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#002368]/10">
          <h3 className="text-sm font-semibold text-[#002368]">All TAP mix</h3>
          <p className="mb-3 text-xs text-[#4f555f]">Where every OPSP TAP line sits right now.</p>
          <StatusPie
            slices={[
              { label: "Done", value: kpi.overall.tapDone, color: "#002368" },
              { label: "On track", value: kpi.overall.onTrack, color: "#80BFEC" },
              { label: "Behind", value: kpi.overall.behind, color: "#FFC952" },
              { label: "Not started", value: kpi.overall.notStarted, color: "#C4B5FD" },
            ]}
          />
        </article>
        <article className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#002368]/10">
          <h3 className="text-sm font-semibold text-[#002368]">Done share</h3>
          <Donut value={kpi.overall.tapPct} label={`${kpi.overall.tapDone} finished · ${kpi.overall.tapLines - kpi.overall.tapDone} still open`} />
          <div className="mt-4">
            <p className="mb-2 text-xs text-[#4f555f]">Navy is done. Gold is still open.</p>
            <MiniBars
              rows={[...kpi.tapDepts]
                .sort((a, b) => b.pctDone - a.pctDone)
                .map((dept) => ({
                  label: dept.name,
                  done: dept.done,
                  undone: dept.undone,
                }))}
            />
          </div>
        </article>
      </section>

      <DeptScoreboard rows={kpi.tapDepts} />

      <section className="grid gap-4 md:grid-cols-3">
        <PagedNames title="No 1–5 today" people={kpi.missingToday} empty="Everyone filed." />
        <PagedNames title="Quiet a week" people={kpi.quietWeek} empty="No quiet names." />
        <PagedNames title="Lagging rocks" people={lagging} empty="Nothing flagged." />
      </section>
    </div>
  );
}

function Stat({ wash, label, value }: { wash: string; label: string; value: string }) {
  return (
    <article className="rounded-3xl px-4 py-4" style={{ background: wash }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#4f555f]">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-[#002368]">{value}</p>
    </article>
  );
}
