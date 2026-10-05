export type DailySheetPerson = {
  id: string;
  name: string;
  phone?: string | null;
  departmentSlug?: string | null;
  submitted: boolean;
  slots?: Array<{ slot: number; title: string }>;
};

export function isRealLogin(phone?: string | null) {
  if (!phone?.trim()) return false;
  if (phone.startsWith("tap:")) return false;
  return /^\d{9,}$/.test(phone.replace(/\D/g, "")) || phone.startsWith("mail:");
}

export function noonHasPassed(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return hour >= 12;
}

export function isNamedStaff(name: string | null | undefined) {
  if (!name?.trim()) return false;
  return !/^\d+$/.test(name.trim());
}

export function selectDepartmentStaff<T extends { name?: string | null; username?: string | null; departmentSlug?: string | null }>(
  people: T[],
  departmentSlug?: string | null,
) {
  return people.filter((person) => {
    if (!isNamedStaff(person.name ?? person.username)) return false;
    if (!person.departmentSlug) return false;
    if (departmentSlug && person.departmentSlug !== departmentSlug) return false;
    return true;
  });
}

export function selectMissingDaily(
  people: DailySheetPerson[],
  departmentSlug?: string | null,
  departmentNameFor?: (slug: string) => string | null,
) {
  return selectDepartmentStaff(people, departmentSlug)
    .filter((person) => isRealLogin(person.phone))
    .filter((person) => !person.submitted)
    .map((person) => ({
      id: person.id,
      name: person.name,
      departmentName: person.departmentSlug ? departmentNameFor?.(person.departmentSlug) ?? null : null,
    }))
    .sort((a, b) => {
      const dept = (a.departmentName ?? "").localeCompare(b.departmentName ?? "", undefined, { sensitivity: "base" });
      if (dept !== 0) return dept;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}

export function selectFiledToday(
  people: DailySheetPerson[],
  departmentSlug?: string | null,
  departmentNameFor?: (slug: string) => string | null,
) {
  return people
    .filter((person) => {
      if (!person.submitted) return false;
      if (!isNamedStaff(person.name)) return false;
      if (departmentSlug && person.departmentSlug !== departmentSlug) return false;
      return true;
    })
    .map((person) => ({
      id: person.id,
      name: person.name,
      departmentName: person.departmentSlug ? departmentNameFor?.(person.departmentSlug) ?? null : null,
      titles: (person.slots ?? [])
        .filter((slot) => slot.slot <= 3 && slot.title.trim())
        .sort((a, b) => a.slot - b.slot)
        .map((slot) => slot.title),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
