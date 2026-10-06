import type { DepartmentPerson, DepartmentSlug, TapSuggestion } from "@/lib/departments";
import { departmentBySlug, inferDepartment } from "@/lib/departments";
import { DATA_TECH_TAP, DATA_TECH_TAP_ITEMS } from "@/lib/data/data-tech-tap";
import { supportPeople } from "@/lib/data/department-support";
import tapOther from "@/lib/data/tap-other.json";

export type TapStatus =
  | "Not Started"
  | "On Schedule"
  | "Ongoing"
  | "Partially Completed"
  | "Behind Schedule"
  | "Fully Completed"
  | "Completed"
  | "Removed";

export type TapItem = {
  code: string;
  title: string;
  owners: string[];
  helpers?: string[];
  status: TapStatus;
};

export type TapDepartment = {
  slug: DepartmentSlug;
  name: string;
  tap: string;
  accountable?: string;
  responsible: string;
  items: TapItem[];
};

const DONE = new Set<TapStatus>(["Fully Completed", "Completed", "Removed"]);

const TEAM_OWNER = new Set([
  "team",
  "finance team",
  "finance",
  "department heads",
  "class teachers",
  "class teacher",
  "hr department",
  "hr",
  "data",
  "tech",
  "tec",
  "dos",
  "marketing",
  "all",
  "kp",
  "tech team",
  "ece leads",
  "heads of section",
  "operations lead",
  "tech teacher",
  "academic head",
  "head of student experience",
  "head of ece",
  "head teacher",
  "hr & data & tech",
  "hr & data & tec",
  "data & tech",
]);

const OWNER_DISPLAY: Record<string, string> = {
  paul: "Paul Gitigan Victor",
  mourine: "Mourine Kitili",
  onesmo: "Onesmo",
  nehemia: "Nehemia",
  katya: "Katya",
  esther: "Esther Mwalyego",
  valentina: "Valentina",
  nelly: "Nelly Zablon",
  imani: "Imani",
  lilian: "Lilian",
  dan: "Dan",
  vaileth: "Vaileth",
  kilusu: "Kilusu Mattasia",
  erick: "Erick",
  eric: "Erick",
  mariam: "Mariam",
  baraka: "Baraka Majundo",
  zuhura: "Zuhura Msangi",
  jacqueline: "Jacqueline Karomo",
  pascaline: "Pascaline A. Sarakikya",
  julius: "Julius Kimani",
  chris: "Chris",
  aloyce: "Aloyce Shirima",
  jephason: "Jephason",
  msafiri: "Msafiri",
  brenda: "Brenda Changara",
  agness: "Agness",
  glory: "Glory",
  francis: "Francis",
  shikunzi: "Shikunzi",
  kusaduka: "Kusaduka",
  neema: "Neema George Emanuel",
  grace: "Grace Kambona",
  irene: "Irene Didass Machange",
  musau: "Irene Musau",
  krupa: "Krupa Patel",
};

const SHARED_FIRST_NAMES = new Set([
  "irene",
  "mourine",
  "maureen",
  "grace",
  "neema",
  "glory",
  "agness",
  "lilian",
  "erick",
  "eric",
  "anna",
  "david",
  "elizabeth",
  "george",
  "jackson",
  "joyce",
  "leah",
  "monica",
  "salome",
  "sayuni",
  "veronica",
  "happiness",
  "daniel",
]);

function personText(person: DepartmentPerson) {
  return [person.name, person.username, person.email, person.jobTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function nameTokens(value: string) {
  return value.toLowerCase().replace(/\./g, "").trim().split(/\s+/).filter(Boolean);
}

export function tapOwnerKey(name: string) {
  const value = name.toLowerCase().replace(/\./g, "").trim();
  const parts = nameTokens(value);
  const first = parts[0] ?? value;
  const last = parts[parts.length - 1] ?? first;
  if (TEAM_OWNER.has(value) || TEAM_OWNER.has(first) || value.includes("team") || value.includes("department")) {
    return `team:${first}`;
  }
  if (last === "musau") return "musau";
  if (first === "paul") return "paul";
  if (OWNER_DISPLAY[first]) return first;
  return first;
}

function isParentRock(code: string) {
  return /\.0$/.test(code) || /^7\.[12]$/.test(code);
}

export function isTeamOwner(name: string) {
  return tapOwnerKey(name).startsWith("team:");
}

export function tapFirstNameIsShared(name: string) {
  const first = nameTokens(name)[0] ?? "";
  return SHARED_FIRST_NAMES.has(first) || SHARED_FIRST_NAMES.has(tapOwnerKey(name));
}

export function personMatchesTapOwner(person: DepartmentPerson, owner: string) {
  if (isTeamOwner(owner)) return false;
  const ownerParts = nameTokens(owner);
  const ownerFirst = ownerParts[0];
  if (!ownerFirst) return false;
  const key = tapOwnerKey(owner);
  if (!key || key.startsWith("team:")) return false;

  const expectedLast = ownerParts.length > 1 ? ownerParts.slice(1) : nameTokens(OWNER_DISPLAY[key] ?? owner).slice(1);
  const personParts = nameTokens(person.name ?? "");
  const personLast = personParts.slice(1);
  const text = personText(person);
  if (!text) return false;
  const firstHits =
    personParts[0] === ownerFirst ||
    personParts[0] === key ||
    new RegExp(`\\b${ownerFirst}\\b`, "i").test(text) ||
    (key === "paul" && /\bpaul\b/.test(text));
  if (!firstHits) return false;

  if (expectedLast.length && personLast.length) {
    return expectedLast.some((token) => personLast.includes(token));
  }
  if (SHARED_FIRST_NAMES.has(ownerFirst) || SHARED_FIRST_NAMES.has(key)) {
    if (personLast.length) return false;
    if (person.email) return false;
  }
  return true;
}

export function isOpenTapStatus(status: TapStatus) {
  return !DONE.has(status);
}

export function tapStatusToBoard(status: TapStatus) {
  if (status === "Fully Completed" || status === "Completed") return "COMPLETED" as const;
  if (status === "Not Started") return "BACKLOG" as const;
  if (status === "Partially Completed" || status === "Behind Schedule" || status === "Ongoing") {
    return "IN_PROGRESS" as const;
  }
  return "TODO" as const;
}

const OTHER = (tapOther as TapDepartment[]).map((dept) => ({
  ...dept,
  items: dept.items.map((item) => ({
    ...item,
    status: item.status as TapStatus,
  })),
}));

export const TAP_DEPARTMENTS: TapDepartment[] = [
  {
    slug: "data-tech",
    name: DATA_TECH_TAP.name,
    tap: DATA_TECH_TAP.tap,
    accountable: DATA_TECH_TAP.accountable,
    responsible: DATA_TECH_TAP.responsible,
    items: DATA_TECH_TAP_ITEMS,
  },
  ...OTHER,
];

export function tapDepartment(slug: string | null | undefined) {
  const key = slug === "academic" ? "ece" : slug;
  return TAP_DEPARTMENTS.find((item) => item.slug === key) ?? null;
}

function itemPeople(item: TapItem) {
  return [...item.owners, ...(item.helpers ?? [])];
}

export function itemsForTapPerson(person: DepartmentPerson, slug = inferDepartment(person)) {
  const dept = tapDepartment(slug);
  if (!dept) return [];
  return dept.items.filter((item) => itemPeople(item).some((owner) => personMatchesTapOwner(person, owner)));
}

export function pickOpenTapItems(
  items: TapItem[],
  opts?: { skipTitles?: string[]; keepTitles?: string[]; limit?: number },
) {
  const limit = opts?.limit ?? 3;
  const skip = new Set((opts?.skipTitles ?? []).map((title) => title.toLowerCase().replace(/\s+/g, " ").trim()));
  const keepWanted = new Set((opts?.keepTitles ?? []).map((title) => title.toLowerCase().replace(/\s+/g, " ").trim()));
  const titled = items
    .filter((item) => isOpenTapStatus(item.status))
    .map((item) => ({ item, title: `${item.code} ${item.title}` }));
  const keep = titled.filter((row) => keepWanted.has(row.title.toLowerCase().replace(/\s+/g, " ").trim()));
  const rest = titled.filter((row) => {
    const key = row.title.toLowerCase().replace(/\s+/g, " ").trim();
    return !keep.some((held) => held.item.code === row.item.code) && !skip.has(key);
  });
  const rocks = rest.filter((row) => /\.0$/.test(row.item.code) || /-\d+\.0$/.test(row.item.code));
  const others = rest.filter((row) => !rocks.includes(row));
  return [...keep, ...rocks, ...others].slice(0, limit).map((row) => row.item);
}

export function suggestionsForTapPerson(
  person: DepartmentPerson,
  opts?: { skipTitles?: string[]; keepTitles?: string[] },
): TapSuggestion[] {
  const slug = inferDepartment(person);
  const dept = tapDepartment(slug);
  if (!dept) return [];
  const picked = pickOpenTapItems(itemsForTapPerson(person, slug), { ...opts, limit: 3 });
  if (picked.length === 0) return [];
  const label = departmentBySlug(slug)?.name ?? dept.name;
  return [
    ...picked.map((item, index) => ({
      slot: (index + 1) as 1 | 2 | 3,
      title: `${item.code} ${item.title}`,
      source: `${dept.tap} · ${item.owners.join(" / ") || "TAP"} · ${item.status}`,
    })),
    {
      slot: 4,
      title: `A challenge that may get in the way of today’s ${label} TAP rocks`,
      source: "Challenge",
    },
    {
      slot: 5,
      title: `Progress recap on yesterday’s ${label} TAP rocks`,
      source: "Progress recap",
    },
  ];
}

export function tapHomeDepartment(name: string): DepartmentSlug | null {
  const key = tapOwnerKey(name);
  if (!key || isTeamOwner(name)) return null;
  let best: { slug: DepartmentSlug; score: number } | null = null;
  for (const dept of TAP_DEPARTMENTS) {
    const responsible = tapOwnerKey(dept.responsible.split("/")[0] ?? "");
    const accountable = tapOwnerKey(dept.accountable ?? "");
    let score = 0;
    if (key === responsible || key === accountable) score += 1000;
    for (const item of dept.items) {
      if (![...item.owners, ...(item.helpers ?? [])].some((owner) => tapOwnerKey(owner) === key)) continue;
      score += isParentRock(item.code) ? 10 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { slug: dept.slug, score };
  }
  return best?.slug ?? null;
}

export function uniqueTapRosterPeople() {
  const people = new Map<string, { name: string; slug: DepartmentSlug; support?: boolean; role?: string }>();
  for (const dept of TAP_DEPARTMENTS) {
    for (const person of tapPeople(dept.slug).filter((item) => !item.role.startsWith("Supports"))) {
      const key = tapOwnerKey(person.name);
      if (!key || isTeamOwner(person.name) || people.has(key)) continue;
      const slug = tapHomeDepartment(person.name) ?? dept.slug;
      people.set(key, { name: OWNER_DISPLAY[key] ?? person.name, slug });
    }
  }
  for (const person of supportPeople()) {
    people.set(`${person.slug}:${tapOwnerKey(person.name)}`, {
      name: person.name,
      slug: person.slug,
      support: true,
      role: person.role,
    });
  }
  return [...people.values()];
}

export function allTapWorkers() {
  return TAP_DEPARTMENTS.map((dept) => ({
    slug: dept.slug,
    name: dept.name,
    tap: dept.tap,
    people: tapPeople(dept.slug),
  })).filter((dept) => dept.people.length > 0);
}

export function tapPeople(slug: string | null | undefined) {
  const dept = tapDepartment(slug);
  if (!dept) return [];
  const names = new Map<string, { name: string; open: number; parent: boolean }>();
  for (const item of dept.items) {
    for (const owner of itemPeople(item)) {
      if (isTeamOwner(owner)) continue;
      const key = tapOwnerKey(owner);
      const name = OWNER_DISPLAY[key] ?? owner;
      const current = names.get(key) ?? { name, open: 0, parent: false };
      if (isOpenTapStatus(item.status)) current.open += 1;
      if (isParentRock(item.code)) current.parent = true;
      names.set(key, current);
    }
  }
  const responsibleKey = tapOwnerKey(dept.responsible.split("/")[0] ?? "");
  const people = [
    ...(dept.accountable ? [{ name: dept.accountable, role: "Accountable" }] : []),
    ...(dept.responsible ? [{ name: dept.responsible, role: "Person responsible" }] : []),
    ...[...names.entries()]
      .filter(([key, person]) => {
        if (key === responsibleKey || key === tapOwnerKey(dept.accountable ?? "")) return false;
        return person.parent || person.open >= 3;
      })
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([, person]) => ({ name: person.name, role: `${person.open} open TAP lines` })),
  ];
  const seen = new Set(people.map((person) => person.name.toLowerCase()));
  for (const extra of supportPeople(dept.slug)) {
    if (seen.has(extra.name.toLowerCase())) continue;
    people.push({ name: extra.name, role: extra.role });
    seen.add(extra.name.toLowerCase());
  }
  return people;
}
