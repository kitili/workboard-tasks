export type DepartmentSlug =
  | "data-tech"
  | "hr"
  | "finance"
  | "marketing"
  | "operations"
  | "expansion"
  | "ece"
  | "elimu-soko"
  | "usa-river"
  | "arusha-modern"
  | "boma"
  | "kijenge"
  | "ilboru";

export type TapSuggestion = {
  slot: 1 | 2 | 3 | 4 | 5;
  title: string;
  source: string;
};

export type DepartmentPerson = {
  name?: string | null;
  username?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  departmentSlug?: string | null;
};

export type Department = {
  slug: DepartmentSlug;
  name: string;
  tap: string;
};

export const DEPARTMENTS: Department[] = [
  { slug: "data-tech", name: "DATA & TECH", tap: "Q3&Q4 DATA & TECH TAP 2026" },
  { slug: "hr", name: "HUMAN RESOURCE", tap: "HUMAN RESOURCE - TAP 2026 Q3&Q4" },
  { slug: "finance", name: "FINANCE", tap: "FINANCE TAP - 2026-Q3&Q4" },
  { slug: "marketing", name: "Marketing & Partnership", tap: "Q3 & Q4 Marketing & Partnership" },
  { slug: "operations", name: "Cluster - Operations", tap: "Cluster - Operations TAP" },
  { slug: "expansion", name: "EXPANSION", tap: "Q3&4 - EXPANSION TAP 2026" },
  { slug: "ece", name: "Cluster ECE", tap: "Cluster ECE TAP - Q3 & Q4" },
  { slug: "elimu-soko", name: "Teaching Innovation Lab (TIL) Elimu Soko", tap: "Elimu Soko 2026" },
  { slug: "usa-river", name: "Usa River TAP", tap: "Usa River TAP" },
  { slug: "arusha-modern", name: "Arusha Modern TAP", tap: "Arusha Modern TAP" },
  { slug: "boma", name: "Boma TAP", tap: "Boma TAP" },
  { slug: "kijenge", name: "Kijenge TAP", tap: "Kijenge TAP" },
  { slug: "ilboru", name: "Ilboru TAP", tap: "Ilboru TAP" },
];

const challenge = (title: string): TapSuggestion => ({
  slot: 4,
  title,
  source: "Challenge",
});

const recap = (title: string): TapSuggestion => ({
  slot: 5,
  title,
  source: "Progress recap",
});

const TAP: Record<DepartmentSlug, TapSuggestion[]> = {
  "data-tech": [
    { slot: 1, title: "Ed Admin Live in 5 campuses and 80% utilization (19 modules fully implemented)", source: "Rock 1.0" },
    { slot: 2, title: "AI, Automation, tech enhancement through digital systems development", source: "Rock 2.0" },
    { slot: 3, title: "MEL Systems, Data collection tools and Dashboards Live", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s DATA & TECH TAP rocks"),
    recap("Progress recap on yesterday’s DATA & TECH TAP rocks"),
  ],
  hr: [
    { slot: 1, title: "Recruitment & Hiring Excellence — 90% of approved roles filled through a technology-driven recruitment process", source: "Rock 1.0" },
    { slot: 2, title: "Employee Onboarding Excellence — 95% of new hires complete a structured, standardized, and digital onboarding process", source: "Rock 2.0" },
    { slot: 3, title: "Employee Engagement & Experience — Achieve >60 eNPS and implement quarterly engagement action plans", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s HUMAN RESOURCE TAP rocks"),
    recap("Progress recap on yesterday’s HUMAN RESOURCE TAP rocks"),
  ],
  finance: [
    { slot: 1, title: "2025 audit completed and 2026 quarterly audits institutionalized effectively", source: "Rock 1.0" },
    { slot: 2, title: "Fee Collection", source: "Rock 2.0" },
    { slot: 3, title: "Finance Policies and Processes reviewed, refined, signed off by the Finance Committee and 100% implemented", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s FINANCE TAP rocks"),
    recap("Progress recap on yesterday’s FINANCE TAP rocks"),
  ],
  marketing: [
    { slot: 1, title: "Marketing strategy Live (with Gantt chart of all activities) — 90% of total seat capacity filled (1,525 students)", source: "Rock 1.0" },
    { slot: 2, title: "Customer Retention & 2027 Re-enrollment — ≥95% retention cluster-wide", source: "Rock 2.0" },
    { slot: 3, title: "Secondary School Pipeline (SLA Alumni) — build a sustainable secondary school enrollment pipeline", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Marketing & Partnership TAP rocks"),
    recap("Progress recap on yesterday’s Marketing & Partnership TAP rocks"),
  ],
  operations: [
    { slot: 1, title: "Transport: Build a safe, efficient, technology-driven, and cost-effective transport system", source: "Rock 1.0" },
    { slot: 2, title: "Kitchen: Achieve ≥90% food-quality compliance and ≥90% food-safety audit compliance", source: "Rock 2.0" },
    { slot: 3, title: "Facilities: Maintain ≥80% budget adherence and ≥90% preventive maintenance adherence", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Cluster - Operations TAP rocks"),
    recap("Progress recap on yesterday’s Cluster - Operations TAP rocks"),
  ],
  expansion: [
    { slot: 1, title: "Full Expansion Plan (Strategy) — cost, ownership, timelines & deadlines", source: "Rock 1.0" },
    { slot: 2, title: "Dodoma Business Plan — competitors & pricing", source: "Rock 2.0" },
    { slot: 3, title: "New Full Academy in Dodoma Launched", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s EXPANSION TAP rocks"),
    recap("Progress recap on yesterday’s EXPANSION TAP rocks"),
  ],
  ece: [
    { slot: 1, title: "ECE Excellence Defined and Scored — ECE Success Card with A–E criteria, all 5 campuses baselined", source: "Rock 1.0" },
    { slot: 2, title: "ECE Enrollment — >90% of ECE capacity filled (574 seats)", source: "Rock 2.0" },
    { slot: 3, title: "ECE Retention — >98% retention across Daycare, KG1 and KG2", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Cluster ECE TAP rocks"),
    recap("Progress recap on yesterday’s Cluster ECE TAP rocks"),
  ],
  "elimu-soko": [
    { slot: 1, title: "Project Planning & Stakeholder Mobilisation — overall implementation plan", source: "Rock 1" },
    { slot: 2, title: "Identify and map all key stakeholders", source: "Activity 2.0" },
    { slot: 3, title: "Develop stakeholder engagement strategy", source: "Activity 3.0" },
    challenge("A challenge that may get in the way of today’s Elimu Soko / TIL work"),
    recap("Progress recap on yesterday’s Teaching Innovation Lab (TIL) Elimu Soko work"),
  ],
  "usa-river": [
    { slot: 1, title: "Student Enrollment — >90% Capacity (2026 capacity is 900 students; therefore 810 and above)", source: "Rock 1.0" },
    { slot: 2, title: "Student Retention — >98% Retention. Attrition not more than 45 students in 2026", source: "Rock 2.0" },
    { slot: 3, title: "Teachers Competency — 75% or more of teachers' average ratings are in Advanced level or above", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Usa River TAP rocks"),
    recap("Progress recap on yesterday’s Usa River TAP rocks"),
  ],
  "arusha-modern": [
    { slot: 1, title: "Student Enrollment — >90% Capacity (2026 capacity is 370 students; therefore 333 and above)", source: "Rock 1.0" },
    { slot: 2, title: "Student Retention — >98% Retention", source: "Rock 2.0" },
    { slot: 3, title: "Teachers Competency — 75% or more of teachers' average ratings are in Advanced level or above", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Arusha Modern TAP rocks"),
    recap("Progress recap on yesterday’s Arusha Modern TAP rocks"),
  ],
  boma: [
    { slot: 1, title: "Student Enrollment — >90% Capacity", source: "Rock 1.0" },
    { slot: 2, title: "Student Retention — >98% Retention", source: "Rock 2.0" },
    { slot: 3, title: "Teachers Competency — 100% of teachers' average ratings are in Advanced level or above", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Boma TAP rocks"),
    recap("Progress recap on yesterday’s Boma TAP rocks"),
  ],
  kijenge: [
    { slot: 1, title: "Student Enrollment — >90% Capacity (2026 conservative capacity is 85 students)", source: "Rock 1.0" },
    { slot: 2, title: "Student Retention — 98% Retention", source: "Rock 2.0" },
    { slot: 3, title: "Teachers Competency — 100% of teachers' average ratings are in Advanced level or above", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Kijenge TAP rocks"),
    recap("Progress recap on yesterday’s Kijenge TAP rocks"),
  ],
  ilboru: [
    { slot: 1, title: "Student Enrollment — >90% Capacity (75 students)", source: "Rock 1.0" },
    { slot: 2, title: "Student Retention — >98% Retention; attrition not more than 2 students", source: "Rock 2.0" },
    { slot: 3, title: "Teachers Competency — 100% of teachers' average ratings are in Advanced level or above", source: "Rock 3.0" },
    challenge("A challenge that may get in the way of today’s Ilboru TAP rocks"),
    recap("Progress recap on yesterday’s Ilboru TAP rocks"),
  ],
};

function haystack(person: DepartmentPerson) {
  return [person.departmentSlug, person.jobTitle, person.name, person.username, person.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function departmentBySlug(slug: string | null | undefined) {
  const key = slug === "academic" ? "ece" : slug;
  return DEPARTMENTS.find((item) => item.slug === key) ?? null;
}

function inferDepartmentFromIdentity(person: DepartmentPerson): DepartmentSlug | null {
  const text = haystack(person);
  if (/\birene\b/.test(text) && /\bmusau\b/.test(text)) return "data-tech";
  if (/\b(machange|didass)\b/.test(text)) return "ilboru";
  if (/\bgeoffrey\b/.test(text) && /\bmuli\b/.test(text)) return "data-tech";
  if (/\bmourine\b/.test(text) && /\bkitili\b/.test(text)) return "data-tech";
  if (/\b(julius|macharia)\b/.test(text) && /\bkimani\b/.test(text)) return "ece";
  return null;
}

export function inferDepartment(person: DepartmentPerson): DepartmentSlug | null {
  const named = inferDepartmentFromIdentity(person);
  if (named) return named;

  const stored = person.departmentSlug === "academic" ? "ece" : person.departmentSlug;
  if (stored && DEPARTMENTS.some((item) => item.slug === stored)) {
    return stored as DepartmentSlug;
  }

  const text = haystack(person);
  if (!text.trim()) return null;

  if (/\busa\s*river\b/.test(text)) return "usa-river";
  if (/\barusha\s*modern\b/.test(text)) return "arusha-modern";
  if (/\bboma\b/.test(text)) return "boma";
  if (/\bkijenge\b/.test(text)) return "kijenge";
  if (/\bilboru\b/.test(text)) return "ilboru";
  if (/\belimu\b|\bsoko\b|\btil\b|\bchris\b|\baloyce\b/.test(text)) return "elimu-soko";
  if (/\bexpansion\b|\bzuhura\b/.test(text)) return "expansion";
  if (/\bmarketing\b|\bpartnership\b|\benrol/.test(text) || /\bkilusu\b|\bmattasia\b/.test(text)) return "marketing";
  if (/\bhuman resource\b|\bhr\b|\brecruit|\bonboard|\btalent\b|\besther\b|\bvalentina\b/.test(text)) {
    return "hr";
  }
  if (/\bfinance\b|\baccount|\bbudget|\bfee\b|\blilian\b|\bimani\b|\bvaileth\b/.test(text)) return "finance";
  if (
    /\boperations\b|\btransport\b|\bkitchen\b|\bfacilit|\bfarm\b|\bbaraka\b|\bfrancis\b|\bshikunzi\b|\bkusaduka\b/.test(
      text,
    )
  ) {
    return "operations";
  }
  if (
    /\bdata\b|\btech\b|\bsis\b|\bsoftware\b|\bdeveloper\b|\bfellow\b|\bpaul\b|\bnehemia\b|\bonesmo\b|\bkatya\b|\bgeoffrey\b/.test(
      text,
    )
  ) {
    return "data-tech";
  }
  if (
    /\bece\b|\bearly childhood\b|\bdaycare\b|\bkg1\b|\bkg2\b|\bpascaline\b|\bjacqueline\b|\bjulius\b|\bkimani\b/.test(
      text,
    )
  ) {
    return "ece";
  }
  if (/\bjephason\b|\bmsafiri\b/.test(text)) return "usa-river";
  if (/\bbrenda\b|\bagness\b|\bglory\b/.test(text)) return "arusha-modern";
  if (/\bneema\b/.test(text)) return "boma";
  if (/\bkambona\b/.test(text)) return "kijenge";
  if (/\bmachange\b|\bdidass\b/.test(text)) return "ilboru";
  return null;
}

export function suggestionsForPerson(person: DepartmentPerson): TapSuggestion[] {
  const slug = inferDepartment(person);
  return slug ? TAP[slug] : [];
}

export function departmentNameFor(person: DepartmentPerson) {
  return departmentBySlug(inferDepartment(person))?.name ?? null;
}

export function canSeeDepartment(
  viewer: DepartmentPerson & { id?: string },
  resource: { departmentSlug?: string | null; assigneeId?: string | null; authorId?: string | null },
  admin = false,
) {
  if (admin) return true;
  if (viewer.id && (resource.assigneeId === viewer.id || resource.authorId === viewer.id)) return true;
  const viewerDept = inferDepartment(viewer);
  if (!viewerDept || !resource.departmentSlug) return false;
  return viewerDept === resource.departmentSlug;
}
