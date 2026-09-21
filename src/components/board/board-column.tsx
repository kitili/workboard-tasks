"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { BoardColumn as ColumnDef } from "@/lib/board/columns";
import type { BoardTask, BoardUser } from "@/lib/board/types";
import { TaskCard } from "@/components/board/task-card";

type BoardColumnProps = {
  column: ColumnDef;
  tasks: BoardTask[];
  users: BoardUser[];
  forceOpen: boolean;
  openGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void;
  onChangeTask: (taskId: string, patch: { assigneeId?: string | null; priority?: string | null }) => void;
};

function personKey(task: BoardTask) {
  return task.assignee?.id ?? "unassigned";
}

function personName(task: BoardTask) {
  return task.assignee?.name ?? task.assignee?.username ?? "Unassigned";
}

export function BoardColumn({
  column,
  tasks,
  users,
  forceOpen,
  openGroups,
  onToggleGroup,
  onChangeTask,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", status: column.id },
  });

  const groups = new Map<string, BoardTask[]>();
  for (const task of tasks) {
    const key = personKey(task);
    const list = groups.get(key) ?? [];
    list.push(task);
    groups.set(key, list);
  }

  return (
    <section
      ref={setNodeRef}
      className={`flex w-80 shrink-0 flex-col rounded-2xl border ${column.color} ${
        isOver ? "ring-2 ring-sky-400" : ""
      }`}
    >
      <header className="flex items-center justify-between px-3 py-3">
        <h3 className="text-sm font-semibold text-zinc-800">{column.title}</h3>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium text-zinc-600">
          {tasks.length}
        </span>
      </header>

      <div className="flex min-h-[180px] flex-1 flex-col gap-2 px-2 pb-3">
        {[...groups.entries()].map(([key, groupTasks]) => {
          const storageKey = `${column.id}:${key}`;
          const open = forceOpen || openGroups[storageKey];
          const ids = groupTasks.map((task) => task.id);

          return (
            <div key={storageKey} className="rounded-xl bg-white/80 p-2">
              <button
                type="button"
                onClick={() => onToggleGroup(storageKey)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-white"
              >
                <span className="text-sm font-semibold text-zinc-900">{personName(groupTasks[0])}</span>
                <span className="text-xs text-zinc-500">
                  {groupTasks.length} {open ? "▾" : "▸"}
                </span>
              </button>

              {open ? (
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <div className="mt-2 flex flex-col gap-2">
                    {groupTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        columnStatus={column.id}
                        users={users}
                        onChange={onChangeTask}
                      />
                    ))}
                  </div>
                </SortableContext>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
