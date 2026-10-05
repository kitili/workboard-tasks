import type { DepartmentPerson, TapSuggestion } from "@/lib/departments";

export type TapStatus =
  | "Not Started"
  | "On Schedule"
  | "Ongoing"
  | "Partially Completed"
  | "Behind Schedule"
  | "Fully Completed"
  | "Completed";

export type DataTechTapItem = {
  code: string;
  title: string;
  owners: string[];
  status: TapStatus;
};

export const DATA_TECH_TAP = {
  name: "DATA & TECH",
  tap: "Q3&Q4 DATA & TECH TAP 2026",
  accountable: "Nelly Zablon",
  responsible: "Paul Gitigan Victor",
} as const;

const DONE = new Set<TapStatus>(["Fully Completed", "Completed"]);

export const DATA_TECH_TAP_ITEMS: DataTechTapItem[] = [
  { code: "1.0", status: "On Schedule", owners: ["Paul"], title: "Ed Admin Live in 5 campuses and 80% utilization (19 modules fully implemented)" },
  { code: "1.1", status: "On Schedule", owners: ["Paul"], title: "Ensure 100% of staff onboarding on system usage for all new modules" },
  { code: "1.2", status: "On Schedule", owners: ["Paul"], title: "Onboard AM and Boma parents to the Ed-Admin system through EMP portal" },
  { code: "1.3", status: "On Schedule", owners: ["Paul"], title: "KPI data dashboards development using API (With Mark's support)" },
  { code: "1.4", status: "On Schedule", owners: ["Paul"], title: "100% parents information available and fully updated on Ed-admin across all sites" },
  { code: "1.5", status: "Ongoing", owners: ["Paul"], title: "Monitor Ed-admin data accuracy (attendance, enrollment, grades, reports) across the 5 sites" },
  { code: "1.6", status: "Partially Completed", owners: ["Finance Team"], title: "Ensure 100% Inventory module implementation" },
  { code: "1.8", status: "Partially Completed", owners: ["Finance Team"], title: "Ensure 100% General Ledger & Budgeting implementation" },
  { code: "1.9", status: "On Schedule", owners: ["Finance Team"], title: "Fee administration implementation" },
  { code: "2.0", status: "On Schedule", owners: ["Mourine"], title: "AI, Automation, tech enhancement through digital systems development" },
  { code: "2.1", status: "Ongoing", owners: ["Paul"], title: "Update the Silverleaf BPR - Tech & Automation Project- 2026 document to track systems installation weekly" },
  { code: "2.2", status: "Ongoing", owners: ["Paul"], title: "Identify and prioritize areas where AI and automation can reduce manual work and improve efficiency" },
  { code: "2.3", status: "On Schedule", owners: ["Paul"], title: "Create a summary dashboard tab, one view showing all departments, overall % completion, and what changed that week" },
  { code: "2.4", status: "Ongoing", owners: ["Paul"], title: "Train staff and provide support to ensure successful adoption of new systems" },
  { code: "2.5", status: "Ongoing", owners: ["Mourine", "Nehemia"], title: "Operations department system development" },
  { code: "2.7", status: "Ongoing", owners: ["Mourine"], title: "HR system automation" },
  { code: "2.8", status: "Ongoing", owners: ["Nehemia"], title: "Expansion system automation (app development)" },
  { code: "3.0", status: "On Schedule", owners: ["Paul"], title: "MEL Systems, Data collection tools and Dashboards Live" },
  { code: "3.1", status: "Partially Completed", owners: ["Katya"], title: "Organization-wide MEL and impact measurement strategy aligned with international standards" },
  { code: "3.2", status: "On Schedule", owners: ["Katya"], title: "Validated Theories of Change with aligned indicators, particularly for the Talent Academy" },
  { code: "3.3", status: "Partially Completed", owners: ["Katya"], title: "Diagnostic review of existing data tools and systems with prioritized recommendations" },
  { code: "3.4", status: "Not Started", owners: ["Katya"], title: "Benchmarking brief drawing lessons from peer organizations" },
  { code: "3.5", status: "Partially Completed", owners: ["Katya"], title: "Unified, user-friendly digital impact system (beyond spreadsheets)" },
  { code: "3.6", status: "Partially Completed", owners: ["Katya"], title: "Automated dashboards and streamlined reporting workflows" },
  { code: "3.7", status: "Behind Schedule", owners: ["Katya"], title: "Targeted capacity building and monitored system adoption" },
  { code: "3.8", status: "Partially Completed", owners: ["Katya"], title: "Practical MEL implementation manual" },
  { code: "3.9", status: "Partially Completed", owners: ["Katya"], title: "Externally facing impact assets, including dashboards, quarterly updates, and annual impact report templates" },
  { code: "4.0", status: "Partially Completed", owners: ["Paul"], title: "Strengthen Departmental capacity through strategic hiring, expertise building, and professional development" },
  { code: "4.1", status: "Fully Completed", owners: ["Paul"], title: "Conduct team capacity and skills gap assessments" },
  { code: "4.2", status: "Fully Completed", owners: ["Paul"], title: "Strengthen role clarity and departmental structure" },
  { code: "4.3", status: "Partially Completed", owners: ["Paul"], title: "Build department-specific expertise and technical skills" },
  { code: "4.4", status: "Ongoing", owners: ["Paul"], title: "Implement a structured professional development program" },
  { code: "4.5", status: "Fully Completed", owners: ["Paul"], title: "Develop a strategic hiring plan for critical team roles and capacity needs" },
  { code: "5.0", status: "On Schedule", owners: ["Paul"], title: "Data Dashboards" },
  { code: "5.1", status: "Ongoing", owners: ["Paul"], title: "Develop and maintain monthly KPI dashboards consolidated into one master sheet covering all campuses" },
  { code: "5.2", status: "Ongoing", owners: ["Paul"], title: "Ensure dashboards are updated, accurate, and shared with SLT on a monthly basis" },
  { code: "5.3", status: "Fully Completed", owners: ["Paul"], title: "Finalize a comprehensive MEL calendar covering assessments, data collection, and reporting" },
  { code: "5.4", status: "Ongoing", owners: ["Paul"], title: "Ensure all departments and school leaders adhere to the MEL calendar timelines" },
  { code: "5.5", status: "Ongoing", owners: ["Paul"], title: "Track completion of MEL activities and follow up on missed or delayed submissions" },
  { code: "6.0", status: "On Schedule", owners: ["Paul"], title: "Technology & Access to Technology at schools" },
  { code: "6.1", status: "Fully Completed", owners: ["Paul"], title: "Tech policy review, update, sign off and implementation" },
  { code: "6.2", status: "Fully Completed", owners: ["Nehemia"], title: "Identify and document technology resource needs across all 5 campuses" },
  { code: "6.3", status: "Partially Completed", owners: ["Paul"], title: "Review the ACTT agreement to confirm alignment with Silverleaf’s current priorities" },
  { code: "6.4", status: "Fully Completed", owners: ["Nehemia"], title: "Conduct quarterly campus device audits led by the Tech Officer" },
  { code: "6.5", status: "Ongoing", owners: ["Onesmo"], title: "Ensure weekly teacher training and capacity building at Usa River, Arusha Modern, and Boma" },
  { code: "6.6", status: "Partially Completed", owners: ["Onesmo"], title: "Conduct baseline technology competency assessments for all teachers across the five campuses" },
  { code: "6.7", status: "Ongoing", owners: ["Nehemia"], title: "Assess tech support needs for ongoing digital teaching resources" },
  { code: "6.8", status: "Ongoing", owners: ["Nehemia"], title: "Ensure weekly student technology classes run consistently across campuses" },
  { code: "6.9", status: "Not Started", owners: ["Nehemia"], title: "Conduct tech assessments to understand staff tech proficiency levels (semi-annually)" },
  { code: "6.91", status: "On Schedule", owners: ["Paul"], title: "Budget creation for tech resources created and shared with SLT for approval" },
  { code: "6.92", status: "Ongoing", owners: ["Nehemia"], title: "Formal assessment of existing technology tools, challenges, and required improvements" },
  { code: "6.93", status: "Ongoing", owners: ["Paul", "Nehemia"], title: "Research and assess alternative suppliers for computers, projectors, and tablets" },
  { code: "6.94", status: "Ongoing", owners: ["Nehemia"], title: "Ensure network equipment (routers, switches, Wi-Fi access points) meets campus needs" },
  { code: "7.0", status: "Ongoing", owners: ["Paul"], title: "End-to-end design, deployment, analysis, and reporting of monthly stakeholder satisfaction surveys" },
  { code: "7.1", status: "Partially Completed", owners: ["Paul"], title: "Design and finalize the monthly stakeholder pulse survey questions" },
  { code: "7.2", status: "Partially Completed", owners: ["Paul"], title: "Coordinate with campus leaders to prepare for survey rollout across all 5 campuses" },
  { code: "7.3", status: "Ongoing", owners: ["Paul"], title: "Launch and distribute the survey by the 15th of each month" },
  { code: "7.4", status: "Ongoing", owners: ["Paul"], title: "Monitor response rates and follow up with reminders to achieve 70%+ participation per campus" },
  { code: "7.5", status: "Partially Completed", owners: ["Paul"], title: "Clean and analyse survey data to identify key trends, strengths, and priority issues" },
  { code: "7.6", status: "On Schedule", owners: ["Paul"], title: "Prepare and share a monthly stakeholder satisfaction report with leadership" },
  { code: "7.7", status: "Ongoing", owners: ["Paul"], title: "Close the feedback loop by sharing actions taken with stakeholders" },
  { code: "8.0", status: "On Schedule", owners: ["Onesmo"], title: "Deliver a JDO program that empowers teachers and students to confidently use technology" },
  { code: "8.1", status: "Ongoing", owners: ["Onesmo"], title: "Assess current teacher technology skills and confidence levels" },
  { code: "8.2", status: "Ongoing", owners: ["Onesmo"], title: "Define clear technology competency standards for teachers" },
  { code: "8.3", status: "Partially Completed", owners: ["Onesmo"], title: "Deliver hands-on training on core classroom technology tools" },
  { code: "8.4", status: "Ongoing", owners: ["Onesmo"], title: "Monitor teacher technology adoption and classroom usage" },
  { code: "8.5", status: "On Schedule", owners: ["Onesmo"], title: "Continuously refine the JDO program based on feedback and results" },
  { code: "8.6", status: "On Schedule", owners: ["Onesmo"], title: "Ensure all leaders are certified in Google Workspace through free online learning platforms" },
  { code: "9.0", status: "On Schedule", owners: ["Paul"], title: "Silverleaf SIS" },
  { code: "9.1", status: "Not Started", owners: ["Paul"], title: "Research the best approach" },
  { code: "9.2", status: "Not Started", owners: ["Paul"], title: "Define scope and core modules" },
  { code: "9.3", status: "Not Started", owners: ["Paul"], title: "Gather requirements from real users" },
  { code: "9.4", status: "Not Started", owners: ["Paul"], title: "Design the data model and architecture" },
  { code: "9.5", status: "Not Started", owners: ["Paul"], title: "Plan for data migration and privacy" },
  { code: "9.51", status: "Not Started", owners: ["Paul"], title: "Build in phases, starting with a pilot" },
  { code: "9.52", status: "Not Started", owners: ["Paul"], title: "Test thoroughly before rollout" },
  { code: "9.6", status: "Not Started", owners: ["Paul"], title: "Train staff and plan ongoing support" },
];

function personText(person: DepartmentPerson) {
  return [person.name, person.username, person.email, person.jobTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function tapOwnerKey(name: string) {
  const value = name.toLowerCase().replace(/\./g, "").trim();
  if (value.includes("finance")) return "finance";
  if (value.includes("mourine")) return "mourine";
  if (value.includes("paul")) return "paul";
  if (value.includes("onesmo")) return "onesmo";
  if (value.includes("nehemia")) return "nehemia";
  if (value.includes("katya")) return "katya";
  return value;
}

export function personMatchesTapOwner(person: DepartmentPerson, owner: string) {
  const key = tapOwnerKey(owner);
  const text = personText(person);
  if (!text) return false;
  if (key === "finance") return /\bfinance\b/.test(text);
  if (key === "mourine") return text.includes("mourine");
  if (key === "paul") return /\bpaul\b/.test(text);
  if (key === "onesmo") return text.includes("onesmo");
  if (key === "nehemia") return text.includes("nehemia");
  if (key === "katya") return text.includes("katya");
  return text.includes(key);
}

export function isOpenTapStatus(status: TapStatus) {
  return !DONE.has(status);
}

export function itemsForDataTechPerson(person: DepartmentPerson) {
  return DATA_TECH_TAP_ITEMS.filter((item) => item.owners.some((owner) => personMatchesTapOwner(person, owner)));
}

export function suggestionsForDataTechPerson(person: DepartmentPerson): TapSuggestion[] {
  const mine = itemsForDataTechPerson(person).filter((item) => isOpenTapStatus(item.status));
  const rocks = mine.filter((item) => item.code.endsWith(".0"));
  const lines = rocks.length >= 3 ? rocks : [...rocks, ...mine.filter((item) => !item.code.endsWith(".0"))];
  const picked = lines.slice(0, 3);
  if (picked.length === 0) return [];
  return [
    ...picked.map((item, index) => ({
      slot: (index + 1) as 1 | 2 | 3,
      title: `${item.code} ${item.title}`,
      source: `DATA & TECH TAP · ${item.owners.join(" / ")} · ${item.status}`,
    })),
    {
      slot: 4,
      title: "A challenge that may get in the way of today’s DATA & TECH TAP rocks",
      source: "Challenge",
    },
    {
      slot: 5,
      title: "Progress recap on yesterday’s DATA & TECH TAP rocks",
      source: "Progress recap",
    },
  ];
}

const OWNER_DISPLAY: Record<string, string> = {
  paul: "Paul Gitigan Victor",
  mourine: "Mourine Kitili",
  onesmo: "Onesmo",
  nehemia: "Nehemia",
  katya: "Katya",
};

export function dataTechTapPeople() {
  const names = new Map<string, { name: string; open: number; total: number }>();
  for (const item of DATA_TECH_TAP_ITEMS) {
    for (const owner of item.owners) {
      const key = tapOwnerKey(owner);
      if (key === "finance") continue;
      const name = OWNER_DISPLAY[key] ?? owner;
      const current = names.get(key) ?? { name, open: 0, total: 0 };
      current.total += 1;
      if (isOpenTapStatus(item.status)) current.open += 1;
      names.set(key, current);
    }
  }
  return [
    { name: DATA_TECH_TAP.accountable, role: "Accountable" },
    { name: DATA_TECH_TAP.responsible, role: "Person responsible" },
    ...[...names.entries()]
      .filter(([key]) => key !== "paul")
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([, person]) => ({ name: person.name, role: `${person.open} open TAP lines` })),
  ];
}

export function tapStatusToBoard(status: TapStatus) {
  if (status === "Fully Completed" || status === "Completed") return "COMPLETED" as const;
  if (status === "Not Started") return "BACKLOG" as const;
  if (status === "Partially Completed" || status === "Behind Schedule" || status === "Ongoing") {
    return "IN_PROGRESS" as const;
  }
  return "TODO" as const;
}
