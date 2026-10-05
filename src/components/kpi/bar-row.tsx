export function BarRow({
  label,
  value,
  max = 100,
  tone = "navy",
}: {
  label: string;
  value: number;
  max?: number;
  tone?: "navy" | "gold" | "sky";
}) {
  const width = max <= 0 ? 0 : Math.max(4, Math.min(100, Math.round((value / max) * 100)));
  const fill = tone === "gold" ? "#FFC952" : tone === "sky" ? "#80BFEC" : "#002368";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
      <div>
        <p className="truncate text-sm text-[#14233B]">{label}</p>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#ececec]">
          <div className="h-full rounded-full" style={{ width: `${width}%`, background: fill }} />
        </div>
      </div>
      <p className="text-right text-sm font-semibold text-[#002368]">{value}%</p>
    </div>
  );
}
