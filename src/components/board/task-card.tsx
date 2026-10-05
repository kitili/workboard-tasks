"use client";

import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { canAssignTask, canMoveTask } from "@/lib/board/access";
import { BOARD_COLUMNS, PRIORITY_LABELS } from "@/lib/board/columns";
import { dailyLineLabel } from "@/lib/daily-lines";
import type { BoardTask, BoardUser } from "@/lib/board/types";

type TaskCardProps = {
  task: BoardTask;
  columnStatus: string;
  users: BoardUser[];
  assignUsers?: BoardUser[];
  currentUserId: string | null;
  admin?: boolean;
  viewerDept?: string | null;
  onChange: (
    taskId: string,
    patch: { title?: string; priority?: string | null; shareWith?: string; handoverTo?: string; assigneeId?: string | null },
  ) => void;
};

function personName(users: BoardUser[], id: string) {
  const user = users.find((item) => item.id === id);
  return user?.name ?? user?.username ?? "Someone";
}

export function TaskCard({
  task,
  columnStatus,
  users,
  assignUsers,
  currentUserId,
  admin = false,
  viewerDept = null,
  onChange,
}: TaskCardProps) {
  const directory = assignUsers?.length ? assignUsers : users;
  const allowed = canMoveTask(task, currentUserId, admin);
  const canAssign = canAssignTask(task, currentUserId, admin, viewerDept);
  const assignList = admin
    ? directory
    : directory.filter(
        (user) => !user.departmentSlug || !task.departmentSlug || user.departmentSlug === task.departmentSlug,
      );
  const [title, setTitle] = useState(task.title);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", status: columnStatus },
    disabled: !allowed,
  });

  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = PRIORITY_LABELS[task.priority ?? ""] ?? PRIORITY_LABELS[""];
  const phase = BOARD_COLUMNS.find((column) => column.id === columnStatus) ?? BOARD_COLUMNS[0];

  function saveTitle() {
    const next = title.trim();
    if (!next || next === task.title) {
      setTitle(task.title);
      return;
    }
    onChange(task.id, { title: next });
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-l-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${phase.card} ${
        isDragging ? "opacity-80 ring-2 ring-[#FFC952]" : ""
      }`}
    >
      <div
        className={`px-3 pt-3 ${allowed ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        {...(allowed ? { ...attributes, ...listeners } : {})}
      >
        {canAssign ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm font-semibold leading-5"
            style={{ color: "#14233B" }}
          />
        ) : (
          <p className="text-sm font-semibold leading-5" style={{ color: "#14233B" }}>
            {task.title}
          </p>
        )}
        <div className="mt-1 flex items-start justify-between gap-2">
          <p className="text-[11px] text-zinc-400">
            {task.dailyItem ? dailyLineLabel(task.dailyItem.slot) : task.taskKey ?? "Task"}
            {allowed ? " · drag to move" : " · only the owner or someone it was shared with can move this"}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority.className}`}>
            {priority.label}
          </span>
        </div>
        {task.sharedWithIds.length > 0 ? (
          <p className="mt-1 text-[11px] text-[#002368]">
            Shared with {task.sharedWithIds.map((id) => personName(users, id)).join(", ")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2 px-3 pt-2 pb-3" onPointerDown={(e) => e.stopPropagation()}>
        {canAssign ? (
          <>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Assigned to</span>
              <select
                value={task.assignee?.id ?? ""}
                onChange={(e) => onChange(task.id, { assigneeId: e.target.value || null })}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
              >
                <option value="">Unassigned</option>
                {assignList.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.username ?? user.phone}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Share</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onChange(task.id, { shareWith: e.target.value });
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
              >
                <option value="">{admin ? "Share this card so they can also move it" : "Share, both of you can move it"}</option>
                {assignList
                  .filter((user) => user.id !== currentUserId && user.id !== task.assignee?.id)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name ?? user.username ?? user.phone}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                {admin ? "Reassign ownership" : "Hand over"}
              </span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onChange(task.id, { handoverTo: e.target.value });
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs"
              >
                <option value="">{admin ? "Give this card to someone else" : "Hand over, only they can move it"}</option>
                {assignList
                  .filter((user) => user.id !== currentUserId)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name ?? user.username ?? user.phone}
                    </option>
                  ))}
              </select>
            </label>
          </>
        ) : null}
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
