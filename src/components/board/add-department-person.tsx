"use client";

import { useState } from "react";
import { DEPARTMENTS } from "@/lib/departments";

export function AddDepartmentPerson({
  departmentSlug,
  departmentName,
}: {
  departmentSlug?: string | null;
  departmentName?: string | null;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [dept, setDept] = useState(departmentSlug ?? "data-tech");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function addPerson(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setPending(true);
    const res = await fetch("/api/board/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        role: role || undefined,
        departmentSlug: departmentSlug ?? dept,
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string; name?: string } | null;
    setPending(false);
    if (!res.ok) {
      setNotice(data?.error ?? "That person was not added.");
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={(event) => void addPerson(event)} className="mt-4 rounded-3xl bg-[#FFF7E5] px-4 py-3">
      <p className="text-sm font-semibold text-[#002368]">Add a name to this TAP</p>
      <p className="mt-1 text-xs text-[#4f555f]">
        For people who help {departmentName ?? "the team"} but are not written on the TAP.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {departmentSlug ? null : (
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Department</span>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
            >
              {DEPARTMENTS.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Irene"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">How they help</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Supports Paul and Mourine"
            className="w-56 rounded-lg border border-zinc-300 bg-white px-3 py-2"
          />
        </label>
        <button type="submit" disabled={pending} className="on-navy rounded-lg px-3 py-2 text-sm font-semibold">
          {pending ? "Adding…" : "Add to department"}
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm text-[#002368]">{notice}</p> : null}
    </form>
  );
}
