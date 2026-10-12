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
import { BOARD_COLUMNS, PRIORITY_LABELS, columnForStatus, returnToTasksError } from "@/lib/board/columns";
import { sheetColumnTitle, writeSheetPhrase, type SheetPhrase } from "@/lib/board/sheet-status";
import { preferredCompletedWord } from "@/lib/data/tap-catalog";
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
  viewerDepartment?: string | null;
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

function boardIntro({
  admin,
  mine,
  departmentSlug,
  departmentName,
}: {
  admin: boolean;
  mine: boolean;
  departmentSlug: string | null;
  departmentName: string | null;
}) {
  const done = preferredCompletedWord(departmentSlug);
  const words = `On Schedule, Ongoing, Not Started, and ${done}. A touched card does not go back to On Schedule. Leftover On Schedule cards move to Not Started the next day. At 6pm Tanzanian time the sheet catches up with the cards.`;
  if (admin && !mine) {
    if (!departmentSlug) return `Every TAP uses the sheet words: ${words}`;
    return `${departmentName ?? "This department"} uses the sheet words: ${words}`;
  }
  if (mine) return `Your cards use the sheet words: ${words}`;
  return `${departmentName ?? "This department"} uses the sheet words: ${words}`;
}

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
  viewerDepartment = null,
  missingDaily = [],
  filedToday = [],
  tapTitle = null,
  tapPeople = [],
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
  const sheetDept = departmentSlug ?? viewerDepartment;
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
    const blocked = returnToTasksError(task.status, targetStatus);
    if (blocked) {
      setNotice(blocked);
      return;
    }

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
      setNotice(`Marked ${preferredCompletedWord(task.departmentSlug ?? sheetDept)}. The sheet uses that same word, and it stays completed.`);
    } else {
      setNotice("The live sheet now uses the same word as this card.");
    }
  }

  async function changeTask(
    taskId: string,
    patch: {
      title?: string;
      priority?: string | null;
      shareWith?: string;
      handoverTo?: string;
      assigneeId?: string | null;
      tapStatus?: string;
    },
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
          description: patch.tapStatus ? writeSheetPhrase(task.description, patch.tapStatus as SheetPhrase) : task.description,
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
      {departmentSlug && tapPeople.length > 0 && !mine ? (
        <details className="admin-fold">
          <summary>Who’s on {departmentName ?? "this department"}</summary>
          <TapRoster
            title={tapTitle ?? "TAP"}
            people={tapPeople}
            extra={
              admin ? (
                <AddDepartmentPerson departmentSlug={departmentSlug} departmentName={departmentName} />
              ) : null
            }
          />
        </details>
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
            {boardIntro({ admin, mine, departmentSlug, departmentName })}
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
      {admin && !mine ? (
        <details className="admin-fold">
          <summary>
            Today’s 1–5s
            {departmentName ? ` · ${departmentName}` : ""}
          </summary>
          <FiledTodayList people={filedToday} departmentName={departmentName} />
          <MissingDailyList people={missingDaily} departmentName={departmentName} />
        </details>
      ) : null}

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
              column={{ ...column, title: sheetColumnTitle(column.id, departmentSlug ?? viewerDepartment) }}
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
