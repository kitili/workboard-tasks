"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BOARD_COLUMNS, PRIORITY_LABELS } from "@/lib/board/columns";
import { dailyLineLabel } from "@/lib/daily-lines";
import type { BoardTask, BoardUser } from "@/lib/board/types";

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
  const phase = BOARD_COLUMNS.find((column) => column.id === columnStatus) ?? BOARD_COLUMNS[0];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-l-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${phase.card} ${
        isDragging ? "opacity-80 ring-2 ring-[#FFC952]" : ""
      }`}
    >
      <div className="cursor-grab px-3 pt-3 active:cursor-grabbing" {...attributes} {...listeners}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-5 text-zinc-900">{task.title}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority.className}`}>
            {priority.label}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">
          {task.dailyItem ? dailyLineLabel(task.dailyItem.slot) : task.taskKey ?? "Task"} · drag to move
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
