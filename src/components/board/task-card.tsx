"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PRIORITY_LABELS } from "@/lib/board/columns";
import type { BoardTask, BoardUser } from "@/lib/board/types";

const PRIORITY_BORDER: Record<string, string> = {
  HIGHEST: "border-l-rose-500",
  HIGH: "border-l-orange-500",
  MEDIUM: "border-l-indigo-500",
  LOW: "border-l-sky-400",
  LOWEST: "border-l-zinc-300",
};

type TaskCardProps = {
  task: BoardTask;
  columnStatus: string;
  users: BoardUser[];
  onChange: (taskId: string, patch: { assigneeId?: string | null; priority?: string | null }) => void;
};

export function TaskCard({ task, columnStatus, users, onChange }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", status: columnStatus },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = PRIORITY_LABELS[task.priority ?? ""] ?? PRIORITY_LABELS[""];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-zinc-200 border-l-4 bg-white shadow-sm ${
        PRIORITY_BORDER[task.priority ?? ""] ?? "border-l-zinc-300"
      } ${isDragging ? "opacity-70 ring-2 ring-sky-400" : ""}`}
    >
      <div className="cursor-grab px-3 pt-3 active:cursor-grabbing" {...attributes} {...listeners}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-5 text-zinc-900">{task.title}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority.className}`}>
            {priority.label}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">
          {task.dailyItem ? `Task ${task.dailyItem.slot}` : task.taskKey ?? "Task"} · drag to move
        </p>
      </div>

      <div className="grid gap-2 px-3 pt-2 pb-3" onPointerDown={(e) => e.stopPropagation()}>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Who</span>
          <select
            value={task.assignee?.id ?? ""}
            onChange={(e) => onChange(task.id, { assigneeId: e.target.value || null })}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ?? user.username ?? user.phone}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Priority</span>
          <select
            value={task.priority ?? ""}
            onChange={(e) => onChange(task.id, { priority: e.target.value || null })}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
          >
            <option value="">No priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="HIGHEST">Highest</option>
          </select>
        </label>
      </div>
    </article>
  );
}
