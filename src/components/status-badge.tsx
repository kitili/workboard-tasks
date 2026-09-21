const styles: Record<string, string> = {
  BACKLOG: "bg-zinc-100 text-zinc-700",
  TODO: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  IN_REVIEW: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  BLOCKED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.BACKLOG}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
