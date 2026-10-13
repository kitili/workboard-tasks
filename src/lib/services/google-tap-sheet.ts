import crypto from "node:crypto";
import type { TaskStatus } from "@/generated/prisma/client";
import { columnForStatus } from "@/lib/board/columns";
import { startOfEatDay } from "@/lib/board/missing-daily";
import { cellA1, findStatusCell, rockCodeFromLabels } from "@/lib/board/sheet-grid";
import {
  columnForSheetPhrase,
  isSheetPhrase,
  sheetCardPhrase,
  writeSheetPhrase,
  type SheetPhrase,
} from "@/lib/board/sheet-status";
import { db } from "@/lib/db";

/** Tab titles in the TAP workbook. Matched loosely so a leading space still hits. */
const SHEET_TABS: Record<string, string> = {
  "data-tech": "Q3&Q4 DATA & TECH TAP 2026",
  hr: "HUMAN RESOURCE - TAP 2026 Q3&Q4",
  finance: "FINANCE TAP - 2026-Q3&Q4",
  marketing: "Q3 & Q4 Marketing & Partnership",
  operations: "Cluster - Operations TAP",
  expansion: "Q3&4 - EXPANSION TAP 2026",
  ece: "Cluster ECE TAP - Q3 & Q4",
  "elimu-soko": "Elimu Soko 2026",
  "usa-river": "Usa River TAP",
  "arusha-modern": "Arusha Modern TAP",
  boma: "Boma TAP",
  kijenge: "Kijenge TAP",
  ilboru: "Ilboru TAP",
};

type PushResult = { skipped?: boolean; written: number; error?: string };

let cachedToken: { value: string; exp: number } | null = null;

export function googleTapConfigured() {
  return Boolean(
    process.env.GOOGLE_TAP_SPREADSHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

function sheetTitle(slug: string) {
  return SHEET_TABS[slug] ?? null;
}

function normalizeTitle(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

async function accessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  const key = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.value;
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const signature = signer.sign(key).toString("base64url");
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: `${header}.${claim}.${signature}`,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || "Google did not accept the sheet login.");
  }
  cachedToken = { value: payload.access_token, exp: now + 3500 };
  return payload.access_token;
}

async function spreadsheetId() {
  return process.env.GOOGLE_TAP_SPREADSHEET_ID ?? "";
}

async function resolvedTab(slug: string, token: string) {
  const wanted = sheetTitle(slug);
  if (!wanted) return null;
  const id = await spreadsheetId();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties.title`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as { sheets?: Array<{ properties?: { title?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Could not open the TAP workbook.");
  const titles = (payload.sheets ?? []).map((sheet) => sheet.properties?.title ?? "").filter(Boolean);
  return titles.find((title) => normalizeTitle(title) === normalizeTitle(wanted)) ?? null;
}

async function readGrid(tab: string, token: string) {
  const id = await spreadsheetId();
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A1:L500`);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = (await response.json()) as { values?: string[][]; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Could not read the TAP tab.");
  return payload.values ?? [];
}

async function writeCells(tab: string, token: string, cells: Array<{ a1: string; phrase: string }>) {
  if (cells.length === 0) return 0;
  const id = await spreadsheetId();
  const quoted = tab.replace(/'/g, "''");
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: cells.map((cell) => ({
        range: `'${quoted}'!${cell.a1}`,
        values: [[cell.phrase]],
      })),
    }),
  });
  const payload = (await response.json()) as { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Could not write the TAP tab.");
  return cells.length;
}

export async function pushRockStatus(input: { slug: string; code: string; phrase: string }): Promise<PushResult> {
  if (!googleTapConfigured()) return { skipped: true, written: 0 };
  try {
    const token = await accessToken();
    const tab = await resolvedTab(input.slug, token);
    if (!tab) return { written: 0, error: `No Google tab for ${input.slug}.` };
    const rows = await readGrid(tab, token);
    const cell = findStatusCell(rows, input.code);
    if (!cell) return { written: 0, error: `Rock ${input.code} is not on ${tab}.` };
    const written = await writeCells(tab, token, [{ a1: cellA1(cell.row, cell.column), phrase: input.phrase }]);
    return { written };
  } catch (error) {
    return { written: 0, error: error instanceof Error ? error.message : "Google Sheet update failed." };
  }
}

/** Only rocks someone moved in the app are sent back to Google. */
export function tasksWithSheetAction<T extends { id: string }>(tasks: T[], actedIds: Iterable<string>) {
  const ids = new Set(actedIds);
  return tasks.filter((task) => ids.has(task.id));
}

const pullCache = new Map<string, number>();
const PULL_TTL_MS = 2 * 60 * 1000;

async function actedTaskIds(organizationId: string, since: Date) {
  const rows = await db.taskActivity.findMany({
    where: {
      createdAt: { gte: since },
      type: "STATUS_CHANGED",
      task: { organizationId, labels: { has: "TAP" } },
    },
    select: { taskId: true },
  });
  return new Set(rows.map((row) => row.taskId));
}

/** Read each department tab and apply its Status cell, unless that card was moved in the app today. */
export async function pullLiveTapSheet(organizationId: string, options: { force?: boolean } = {}) {
  if (!googleTapConfigured()) return { skipped: true, updated: 0 };
  const last = pullCache.get(organizationId) ?? 0;
  if (!options.force && Date.now() - last < PULL_TTL_MS) return { skipped: true, updated: 0 };
  let updated = 0;
  try {
    const token = await accessToken();
    const acted = await actedTaskIds(organizationId, startOfEatDay());
    for (const slug of Object.keys(SHEET_TABS)) {
      const tab = await resolvedTab(slug, token);
      if (!tab) continue;
      const rows = await readGrid(tab, token);
      const tasks = await db.task.findMany({
        where: { organizationId, departmentSlug: slug, labels: { has: "TAP" }, status: { not: "CANCELLED" } },
        select: { id: true, labels: true, status: true, description: true, departmentSlug: true },
      });
      for (const task of tasks) {
        if (acted.has(task.id)) continue;
        const code = rockCodeFromLabels(task.labels);
        if (!code) continue;
        const cell = findStatusCell(rows, code);
        if (!cell) continue;
        const phrase = (rows[cell.row]?.[cell.column] ?? "").trim();
        if (!isSheetPhrase(phrase)) continue;
        const nextStatus = columnForSheetPhrase(phrase);
        const nextDescription = writeSheetPhrase(task.description, phrase);
        const samePhrase = sheetCardPhrase(task.status, task.description, task.departmentSlug) === phrase;
        const sameColumn = columnForStatus(task.status) === nextStatus;
        if (samePhrase && sameColumn && nextDescription === (task.description ?? "")) continue;
        await db.task.update({
          where: { id: task.id },
          data: {
            description: nextDescription,
            status: nextStatus as TaskStatus,
            completedAt: nextStatus === "COMPLETED" ? new Date() : nextStatus === columnForStatus(task.status) ? undefined : null,
          },
        });
        updated += 1;
      }
    }
    pullCache.set(organizationId, Date.now());
  } catch (error) {
    return { updated, error: error instanceof Error ? error.message : "Could not read the Google Sheet." };
  }
  return { updated };
}

/** At 6pm, write back only the TAP cards that were moved today. No moves means the Google Sheet is not touched. */
export async function syncGoogleTapSheet(organizationId: string, now = new Date()): Promise<PushResult> {
  if (!googleTapConfigured()) return { skipped: true, written: 0 };
  const acted = await actedTaskIds(organizationId, startOfEatDay(now));
  if (acted.size === 0) return { skipped: true, written: 0 };
  const tasks = await db.task.findMany({
    where: { organizationId, id: { in: [...acted] }, labels: { has: "TAP" }, status: { not: "CANCELLED" } },
    select: { id: true, labels: true, departmentSlug: true, description: true, status: true },
  });
  const moved = tasksWithSheetAction(tasks, acted);
  const bySlug = new Map<string, Array<{ code: string; phrase: string }>>();
  for (const task of moved) {
    const code = rockCodeFromLabels(task.labels);
    if (!code || !task.departmentSlug || !sheetTitle(task.departmentSlug)) continue;
    const phrase = sheetCardPhrase(task.status, task.description, task.departmentSlug);
    const list = bySlug.get(task.departmentSlug) ?? [];
    list.push({ code, phrase });
    bySlug.set(task.departmentSlug, list);
  }
  if (bySlug.size === 0) return { skipped: true, written: 0 };
  let written = 0;
  const errors: string[] = [];
  try {
    const token = await accessToken();
    for (const [slug, items] of bySlug) {
      const tab = await resolvedTab(slug, token);
      if (!tab) {
        errors.push(`No Google tab for ${slug}.`);
        continue;
      }
      const rows = await readGrid(tab, token);
      const cells: Array<{ a1: string; phrase: string }> = [];
      for (const item of items) {
        const cell = findStatusCell(rows, item.code);
        if (!cell) continue;
        const current = (rows[cell.row]?.[cell.column] ?? "").trim();
        if (current === item.phrase) continue;
        cells.push({ a1: cellA1(cell.row, cell.column), phrase: item.phrase });
      }
      written += await writeCells(tab, token, cells);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Google Sheet update failed.");
  }
  return { written, error: errors.length ? errors.join(" ") : undefined };
}
