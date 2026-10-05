const WASH = ["#D9ECF9", "#FFF7E5", "#F3EEFF", "#FFE8EE"];

export type ScoreRow = {
  slug: string;
  name: string;
  total: number;
  done: number;
  undone: number;
  behind: number;
  onTrack: number;
  notStarted: number;
  pctDone: number;
};

export function DeptScoreboard({ rows }: { rows: ScoreRow[] }) {
  const ranked = [...rows].sort((a, b) => b.pctDone - a.pctDone || a.name.localeCompare(b.name));

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#002368]/10">
      <div className="flex flex-wrap items-end justify-between gap-3 bg-[#002368] px-5 py-4 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#80BFEC]">All TAPs</p>
          <h3 className="mt-1 text-2xl font-semibold text-white">Department scoreboard</h3>
        </div>
        <p className="text-sm text-[#D9ECF9]">OPSP TAP lines done vs still open.</p>
      </div>
      <ol className="divide-y divide-[#002368]/8">
        {ranked.map((dept, index) => (
          <li key={dept.slug} className="grid gap-3 px-5 py-4 sm:grid-cols-[3rem_1fr_auto] sm:items-center">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
              style={{ background: WASH[index % WASH.length], color: "#002368" }}
            >
              {index + 1}
            </span>
            <div>
              <p className="font-semibold text-[#002368]">{dept.name}</p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-[#ECECEC]">
                <div className="h-full bg-[#002368]" style={{ width: `${dept.pctDone}%` }} />
                <div
                  className="h-full bg-[#80BFEC]"
                  style={{ width: `${dept.total ? Math.round((dept.onTrack / dept.total) * 100) : 0}%` }}
                />
                <div
                  className="h-full bg-[#FFC952]"
                  style={{ width: `${dept.total ? Math.round((dept.behind / dept.total) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[#4f555f]">
                {dept.done} done · {dept.onTrack} on track · {dept.behind} behind · {dept.notStarted} not started
              </p>
            </div>
            <p className="text-right">
              <span className="text-2xl font-semibold text-[#002368]">{dept.pctDone}%</span>
              <span className="block text-xs text-[#4f555f]">
                {dept.done}/{dept.total}
              </span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}