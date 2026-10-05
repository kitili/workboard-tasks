"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { canMoveTask, cardOwnerId } from "@/lib/board/access";
import { BOARD_COLUMNS, PRIORITY_LABELS, columnForStatus } from "@/lib/board/columns";
import { DEPARTMENTS } from "@/lib/departments";
import { AddDepartmentPerson } from "@/components/board/add-department-person";
import { FiledTodayList } from "@/components/board/filed-today-list";
import { MissingDailyList } from "@/components/board/missing-daily-list";
import { TapRoster } from "@/components/board/tap-roster";
import type { BoardTask, BoardUser, FiledTodayPerson, MissingDailyPerson } from "@/lib/board/types";
import { BoardColumn } from "@/components/board/board-column";

type KanbanBoardProps = {
  initialTasks: BoardTask[];
  users: BoardUser[];
  currentUserId: string | null;
  mine?: boolean;
  admin?: boolean;
  departmentName?: string | null;
  departmentSlug?: string | null;
  missingDaily?: MissingDailyPerson[];
  filedToday?: FiledTodayPerson[];
  tapTitle?: string | null;
  tapPeople?: Array<{ name: string; role: string }>;
  tapDepartments?: Array<{ name: string; tap?: string; people: Array<{ name: string; role: string }> }>;
  assignUsers?: BoardUser[];
};

const collisionDetection: CollisionDetection = (args) => {
  const pointed = pointerWithin(args);
  if (pointed.length > 0) return pointed;
  return rectIntersection(args);
};

function groupByStatus(tasks: BoardTask[]): Record<string, BoardTask[]> {
  const grouped: Record<string, BoardTask[]> = {};
  for (const col of BOARD_COLUMNS) grouped[col.id] = [];
  for (const task of tasks) {
    const column = columnForStatus(task.status);
    grouped[column].push(task);
  }
  return grouped;
}

export function KanbanBoard({
  initialTasks,
  users,
  currentUserId,
  mine = false,
  admin = false,
  departmentName = null,
  departmentSlug = null,
  missingDaily = [],
  filedToday = [],
  tapTitle = null,
  tapPeople = [],
  tapDepartments = [],
  assignUsers,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [personFilter, setPersonFilter] = useState(mine && currentUserId ? currentUserId : "all");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");

  const people = useMemo(
    () =>
      [...users].sort((a, b) =>
        (a.name ?? a.username ?? a.phone).localeCompare(b.name ?? b.username ?? b.phone, undefined, { sensitivity: "base" }),
      ),
    [users],
  );
  const visible = useMemo(
    () =>
      personFilter === "all"
        ? tasks
        : tasks.filter((task) => (task.assignee?.id ?? "unassigned") === personFilter),
    [tasks, personFilter],
  );
  const columns = useMemo(() => groupByStatus(visible), [visible]);
  const activeTask = tasks.find((task) => task.id === activeId) ?? null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((item) => item.id === String(event.active.id));
    if (!task || !canMoveTask(task, currentUserId, admin)) return;
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const task = tasks.find((item) => item.id === taskId);
    if (!task || !canMoveTask(task, currentUserId, admin)) return;

    const overData = over.data.current as { type?: string; status?: string } | undefined;
    let targetStatus: string = columnForStatus(task.status);
    if (overData?.type === "column" || overData?.type === "task") {
      targetStatus = String(overData.status);
    } else if (String(over.id).startsWith("column-")) {
      targetStatus = String(over.id).replace("column-", "");
    }

    if (targetStatus === columnForStatus(task.status)) return;

    setTasks((prev) => prev.map((item) => (item.id === taskId ? { ...item, status: targetStatus } : item)));
    setOpenGroups((prev) => ({ ...prev, [`${targetStatus}:${task.assignee?.id ?? "unassigned"}`]: true }));

    const res = await fetch(`/api/board/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: targetStatus }),
    });
    if (!res.ok) {
      setTasks((prev) => prev.map((item) => (item.id === taskId ? task : item)));
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setNotice(data?.error ?? "That card stayed where it was.");
      return;
    }
    if (targetStatus === "COMPLETED") {
      setNotice("Marked Done for today. It stays here until tomorrow, and 1–5 history keeps it as Done.");
    }
  }

  async function changeTask(
    taskId: string,
    patch: { title?: string; priority?: string | null; shareWith?: string; handoverTo?: string; assigneeId?: string | null },
  ) {
    setNotice("");
    const directory = assignUsers?.length ? assignUsers : users;
    const personId = patch.handoverTo ?? patch.shareWith ?? patch.assigneeId;
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const assignee =
          patch.assigneeId === null
            ? null
            : personId
              ? (directory.find((user) => user.id === personId) ?? task.assignee)
              : task.assignee;
        return {
          ...task,
          title: patch.title ?? task.title,
          priority: patch.priority === undefined ? task.priority : patch.priority,
          assignee,
          sharedWithIds: patch.handoverTo
            ? []
            : patch.shareWith
              ? Array.from(new Set([...task.sharedWithIds, patch.shareWith]))
              : task.sharedWithIds,
          moveOwnerId: patch.handoverTo ?? (patch.assigneeId !== undefined ? patch.assigneeId : task.moveOwnerId ?? cardOwnerId(task)),
        };
      }),
    );

    const res = await fetch(`/api/board/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setTasks(initialTasks);
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setNotice(data?.error ?? "That change was not saved.");
    }
  }

  return (
    <>
      {(tapPeople.length > 0 || tapDepartments.length > 0) && !mine ? (
        <TapRoster
          title={tapTitle ?? "TAP"}
          people={tapPeople}
          groups={tapDepartments}
          extra={
            admin ? (
              <AddDepartmentPerson departmentSlug={departmentSlug} departmentName={departmentName} />
            ) : null
          }
        />
      ) : null}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">
            {admin && !mine
              ? "Admin board"
              : mine
                ? "My board"
                : departmentName
                  ? `${departmentName} board`
                  : "Silverleaf Tasks"}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {admin && !mine
              ? "Pick a TAP, or look at all of them. Each block names the TAP it came from."
              : mine
                ? "Only your cards. Done stays visible for today, then clears tomorrow. 1–5 history keeps it as Done."
                : `${departmentName ?? "This department"} only. Other departments stay private.`}
          </p>
        </div>
        {admin && !mine ? (
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mr-2 text-zinc-500">Department</span>
              <select
                value={departmentSlug ?? "all"}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  if (e.target.value === "all") url.searchParams.delete("dept");
                  else url.searchParams.set("dept", e.target.value);
                  window.location.href = url.toString();
                }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
              >
                <option value="all">All TAPs</option>
                {DEPARTMENTS.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mr-2 text-zinc-500">Show</span>
              <select
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
              >
                <option value="all">Everyone</option>
                {people.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.username ?? user.phone}
                    {user.departmentSlug && !departmentSlug
                      ? ` · ${DEPARTMENTS.find((item) => item.slug === user.departmentSlug)?.name ?? user.departmentSlug}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {notice ? <p className="mb-4 text-sm text-[#002368]">{notice}</p> : null}
      {admin && !mine ? <FiledTodayList people={filedToday} departmentName={departmentName} /> : null}
      {admin && !mine ? <MissingDailyList people={missingDaily} departmentName={departmentName} /> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
      >
        <div className="flex gap-4 overflow-x-auto pb-6">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={columns[column.id] ?? []}
              users={people}
              assignUsers={assignUsers ?? people}
              forceOpen={false}
              openGroups={openGroups}
              onToggleGroup={(key) => setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))}
              currentUserId={currentUserId}
              admin={admin}
              viewerDept={departmentSlug}
              onChangeTask={(id, patch) => void changeTask(id, patch)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
              <p className="text-sm font-semibold">{activeTask.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {PRIORITY_LABELS[activeTask.priority ?? ""]?.label ?? "No priority"}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
