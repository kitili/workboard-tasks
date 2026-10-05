export function Donut({
  value,
  label,
  tone = "#002368",
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 108 108" className="h-28 w-28">
        <circle cx="54" cy="54" r={r} fill="none" stroke="#ECECEC" strokeWidth="12" />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 54 54)"
        />
        <text x="54" y="58" textAnchor="middle" className="fill-[#002368]" fontSize="18" fontWeight="700">
          {pct}%
        </text>
      </svg>
      <p className="text-sm text-[#4f555f]">{label}</p>
    </div>
  );
}

export function MiniBars({
  rows,
}: {
  rows: Array<{ label: string; done: number; undone: number }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const total = row.done + row.undone || 1;
        const done = Math.round((row.done / total) * 100);
        return (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-xs text-[#14233B]">
              <span>{row.label}</span>
              <span>{done}% done</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-[#FFF7E5]">
              <div className="h-full bg-[#002368]" style={{ width: `${done}%` }} />
              <div className="h-full bg-[#FFC952]" style={{ width: `${100 - done}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
