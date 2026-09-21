import type { TaskStatus } from "@/generated/prisma/client";

export type BoardColumn = {
  id: TaskStatus;
  title: string;
  color: string;
};

/** Four stacks, left to right — today's tasks, then progress, holding, and done. */
export const BOARD_COLUMNS: BoardColumn[] = [
  { id: "TODO", title: "Tasks", color: "border-sky-200 bg-[#f4f8fc]" },
  { id: "IN_PROGRESS", title: "In progress", color: "border-amber-200 bg-[#fffaf3]" },
  { id: "BACKLOG", title: "Backlog", color: "border-zinc-200 bg-zinc-50" },
  { id: "COMPLETED", title: "Done", color: "border-emerald-200 bg-[#f3faf6]" },
];

/** Older statuses still land in a visible stack. */
export function columnForStatus(status: string): TaskStatus {
  if (status === "IN_REVIEW" || status === "BLOCKED") return "IN_PROGRESS";
  if (status === "CANCELLED") return "BACKLOG";
  if (status === "TODO" || status === "IN_PROGRESS" || status === "BACKLOG" || status === "COMPLETED") {
    return status;
  }
  return "BACKLOG";
}

export const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  "": { label: "No priority", className: "bg-zinc-100 text-zinc-500" },
  LOWEST: { label: "Lowest", className: "bg-zinc-100 text-zinc-600" },
  LOW: { label: "Low", className: "bg-sky-100 text-sky-700" },
  MEDIUM: { label: "Medium", className: "bg-indigo-100 text-indigo-700" },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-700" },
  HIGHEST: { label: "Highest", className: "bg-rose-100 text-rose-700" },
};

export const TYPE_ICONS: Record<string, string> = {
  TASK: "✓",
  STORY: "📖",
  BUG: "🐛",
};
