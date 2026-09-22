import type { TaskStatus } from "@/generated/prisma/client";

export type BoardColumn = {
  id: TaskStatus;
  title: string;
  color: string;
  card: string;
  pill: string;
};

/** Four stacks, left to right — today's tasks, then progress, holding, and done. */
export const BOARD_COLUMNS: BoardColumn[] = [
  {
    id: "TODO",
    title: "Tasks",
    color: "border-[#80BFEC] bg-[#e8f4fc]",
    card: "border-[#b7daf3] border-l-[#002368] bg-[#f5fbff]",
    pill: "bg-[#002368] text-white",
  },
  {
    id: "IN_PROGRESS",
    title: "In progress",
    color: "border-[#FFC952] bg-[#fff6df]",
    card: "border-[#ffe3a3] border-l-[#d9a227] bg-[#fffbf0]",
    pill: "bg-[#FFC952] text-[#14233B]",
  },
  {
    id: "BACKLOG",
    title: "Backlog",
    color: "border-[#c8c9cb] bg-[#f3f4f5]",
    card: "border-[#d9dadc] border-l-[#818283] bg-[#fafafa]",
    pill: "bg-[#818283] text-white",
  },
  {
    id: "COMPLETED",
    title: "Done",
    color: "border-[#8ed4ad] bg-[#e9f8ef]",
    card: "border-[#b7e6c8] border-l-[#1f8f4e] bg-[#f4fbf7]",
    pill: "bg-[#1f8f4e] text-white",
  },
];

export function phaseStyle(status: string) {
  const id = columnForStatus(status);
  return BOARD_COLUMNS.find((column) => column.id === id) ?? BOARD_COLUMNS[2];
}

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
