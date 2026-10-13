import { columnForStatus } from "@/lib/board/columns";
import { preferredCompletedWord } from "@/lib/data/tap-catalog";

/** Default TAP sheet words, used by every department. */
export const SHEET_COLUMNS = {
  TODO: "On Schedule",
  IN_PROGRESS: "Ongoing",
  BACKLOG: "Not Started",
  COMPLETED: "Fully Completed",
} as const;

export const SHEET_PROGRESS = ["Ongoing", "Partially Completed", "Behind Schedule"] as const;

/** @deprecated Use SHEET_COLUMNS. Kept so older Data & Tech call sites still compile. */
export const DATA_TECH_SHEET = SHEET_COLUMNS;
/** @deprecated Use SHEET_PROGRESS. */
export const DATA_TECH_PROGRESS = SHEET_PROGRESS;

export const SHEET_PHRASES = [
  "Not Started",
  "On Schedule",
  "Ongoing",
  "Partially Completed",
  "Behind Schedule",
  "Fully Completed",
  "Completed",
] as const;

export type SheetPhrase = (typeof SHEET_PHRASES)[number];

const PHRASE_COLUMN: Record<SheetPhrase, string> = {
  "Not Started": "BACKLOG",
  "On Schedule": "TODO",
  Ongoing: "IN_PROGRESS",
  "Partially Completed": "IN_PROGRESS",
  "Behind Schedule": "IN_PROGRESS",
  "Fully Completed": "COMPLETED",
  Completed: "COMPLETED",
};

export function isSheetPhrase(value: string | null | undefined): value is SheetPhrase {
  return SHEET_PHRASES.includes(value as SheetPhrase);
}

export function columnForSheetPhrase(phrase: SheetPhrase) {
  return PHRASE_COLUMN[phrase];
}

export function readSheetPhrase(description: string | null | undefined): SheetPhrase | null {
  if (!description) return null;
  const match = description.match(
    / · (Not Started|On Schedule|Ongoing|Partially Completed|Behind Schedule|Fully Completed|Completed)\s*$/,
  );
  return match && isSheetPhrase(match[1]) ? match[1] : null;
}

export function writeSheetPhrase(description: string | null | undefined, phrase: SheetPhrase) {
  const base = (description ?? "").replace(
    /\s·\s(?:Not Started|On Schedule|Ongoing|Partially Completed|Behind Schedule|Fully Completed|Completed|Removed)\s*$/i,
    "",
  );
  return `${base} · ${phrase}`.replace(/^ · /, "");
}

export function sheetColumnTitle(status: string, departmentSlug?: string | null) {
  const column = columnForStatus(status);
  if (column === "TODO") return SHEET_COLUMNS.TODO;
  if (column === "IN_PROGRESS") return SHEET_COLUMNS.IN_PROGRESS;
  if (column === "COMPLETED") return preferredCompletedWord(departmentSlug);
  return SHEET_COLUMNS.BACKLOG;
}

/** Sheet word for a TAP card, keeping Partially Completed and Behind Schedule when they still match the column. */
export function sheetCardPhrase(status: string, description: string | null | undefined, departmentSlug?: string | null) {
  const column = columnForStatus(status);
  const stamped = readSheetPhrase(description);
  if (stamped && columnForSheetPhrase(stamped) === column) return stamped;
  return sheetColumnTitle(status, departmentSlug);
}

export function sheetDeskBlurb(doneWord: string = "Fully Completed") {
  return `The app reads the Google Sheet. On Schedule, Ongoing, Partially Completed, Behind Schedule, Not Started, and ${doneWord} stay in sync. A card you move is written back at 6pm Tanzanian time. If nobody moves a card, the Google Sheet is left as it is.`;
}

export const dataTechColumnTitle = sheetColumnTitle;
export const dataTechCardPhrase = sheetCardPhrase;

export function usesSheetWords(_departmentSlug?: string | null) {
  return true;
}

export const usesDataTechSheet = usesSheetWords;
