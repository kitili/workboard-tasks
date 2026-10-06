import "dotenv/config";
import { db } from "../src/lib/db";
import { inferDepartment } from "../src/lib/departments";
import { groupTapRocks, opsTapDeskCatalog, personMatchesTapOwner, pickOpenTapItems, TAP_DEPARTMENTS, tapDepartment, tapPeople } from "../src/lib/data/tap-catalog";
import { isOpsLead } from "../src/lib/auth/admin";
import { getKpiDashboard } from "../src/lib/services/kpi";
import { pickDailyTapLineup } from "../src/lib/today/tap-lineup";
import { syncTapTasks } from "../src/lib/services/tap-sync";
import { noonHasPassed, selectDepartmentStaff, selectMissingDaily } from "../src/lib/board/missing-daily";
import { syncAllUserDepartments } from "../src/lib/services/departments";

const EXPECTED: Record<string, string[]> = {
  "data-tech": ["Nelly Zablon", "Paul Gitigan Victor", "Mourine Kitili", "Onesmo", "Nehemia", "Katya", "Irene Musau"],
  operations: ["Baraka Majundo", "Shikunzi", "Francis", "Kusaduka"],
  hr: ["Esther Mwalyego", "Valentina"],
  finance: ["Imani", "Dan", "Lilian"],
  marketing: ["Kilusu Mattasia", "Erick", "Mariam"],
  expansion: ["Zuhura Msangi"],
  ece: ["Pascaline A. Sarakikya", "Jacqueline Karomo", "Julius Kimani"],
  "elimu-soko": ["Chris"],
  "usa-river": ["Jephason"],
  "arusha-modern": ["Brenda Changara"],
  boma: ["Neema George Emanuel"],
  kijenge: ["Grace Kambona"],
  ilboru: ["Irene Didass Machange"],
};

const USER_DEPT: Record<string, string> = {
  "Mourine Kitili": "data-tech",
  Mourine: "data-tech",
  Paul: "data-tech",
  Francis: "operations",
};

async function main() {
  const failures: string[] = [];
  function check(ok: boolean, message: string) {
    if (ok) console.log(`PASS  ${message}`);
    else {
      failures.push(message);
      console.log(`FAIL  ${message}`);
    }
  }

  for (const [slug, names] of Object.entries(EXPECTED)) {
    const roster = tapPeople(slug).map((person) => person.name);
    for (const name of names) {
      check(roster.some((item) => item.includes(name.split(" ")[0])), `${slug} roster includes ${name}`);
    }
  }

  check(noonHasPassed(new Date("2026-10-05T08:59:00+03:00")) === false, "alert hidden at 08:59 EAT");
  check(noonHasPassed(new Date("2026-10-05T12:00:00+03:00")) === true, "alert visible at 12:00 EAT");
  check(noonHasPassed(new Date("2026-10-05T12:49:00+03:00")) === true, "alert visible at 12:49 EAT");

  const sample = [
    { id: "1", name: "Francis", phone: "255700000001", departmentSlug: "operations", submitted: false },
    { id: "2", name: "Mourine Kitili", phone: "mail:mourine@silverleaf.co.tz", departmentSlug: "data-tech", submitted: false },
    { id: "3", name: "254712345678", phone: "254712345678", departmentSlug: "operations", submitted: false },
    { id: "4", name: "Amina", phone: "255700000004", departmentSlug: null, submitted: false },
    { id: "5", name: "Baraka", phone: "tap:baraka", departmentSlug: "operations", submitted: true },
    { id: "6", name: "Julius Kimani", phone: "tap:julius-imai", departmentSlug: "ece", submitted: false },
  ];
  const opsMissing = selectMissingDaily(sample, "operations");
  check(opsMissing.map((row) => row.name).join() === "Francis", "after-12 ops list is only unfiled ops staff");
  const allMissing = selectMissingDaily(sample, undefined, (slug) => (slug === "data-tech" ? "DATA & TECH" : slug));
  check(
    allMissing.map((row) => row.name).join() === "Mourine Kitili,Francis",
    "after-12 all-dept list skips phones and people with no department",
  );
  check(allMissing[0]?.departmentName === "DATA & TECH", "after-12 all-dept rows keep department names");
  check(
    personMatchesTapOwner({ name: "Irene Musau", email: "irene-fellow@silverleaf.co.tz" }, "Irene Didass Machange") === false,
    "Irene Musau is not Irene Didass",
  );
  check(
    personMatchesTapOwner({ name: "Irene Didass Machange" }, "Irene Didass Machange") === true,
    "Irene Didass matches her own TAP name",
  );
  check(
    inferDepartment({ name: "Irene Musau", email: "irene-fellow@silverleaf.co.tz", departmentSlug: "ilboru" }) === "data-tech",
    "Irene Musau stays on DATA & TECH even if TAP sync parked her in Ilboru",
  );
  check(
    inferDepartment({ name: "Irene Didass Machange" }) === "ilboru",
    "Irene Didass stays on Ilboru",
  );
  check(
    personMatchesTapOwner({ name: "Mourine Lauwo", email: "moureenlauwo@silverleaf.co.tz" }, "Mourine Kitili") === false,
    "Mourine Lauwo is not Mourine Kitili",
  );
  check(isOpsLead({ name: "Baraka Majundo" }) === true, "Baraka Majundo is the ops TAP lead");
  const desk = opsTapDeskCatalog();
  check(desk.some((dept) => dept.slug === "operations" && dept.items.length >= 40), "ops desk includes Cluster Operations TAP");
  check(
    desk.some((dept) => dept.slug === "ece" && dept.items.some((item) => item.code === "9.3")),
    "ops desk keeps Majundo’s ECE TAP lines",
  );
  check(
    desk.some((dept) => dept.slug === "expansion" && dept.items.some((item) => item.code === "3.3")),
    "ops desk keeps Majundo’s expansion TAP lines",
  );
  const opsRock = tapDepartment("operations");
  const grouped = groupTapRocks(opsRock?.items ?? []);
  const transport = grouped.find((rock) => rock.parent.code === "1.0");
  check(Boolean(transport?.children.some((item) => item.code === "1.1")), "ops TAP 1.1 sits under rock 1.0");
  check(opsRock?.items.find((item) => item.code === "1.1")?.deadline === "2026-08-31", "ops TAP 1.1 keeps its Excel deadline");
  check(
    desk
      .find((dept) => dept.slug === "ece")
      ?.items.find((item) => item.code === "9.3")?.deadline === "2026-10-31",
    "Majundo ECE playground TAP keeps its Excel deadline",
  );
  const showEveryone = selectDepartmentStaff(sample).map((row) => row.name);
  check(
    showEveryone.join() === "Francis,Mourine Kitili,Baraka,Julius Kimani",
    "Show Everyone only lists named staff with a department",
  );

  const org = await db.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error("No organization");
  await syncAllUserDepartments(org.id);
  const users = await db.user.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { name: true, username: true, departmentSlug: true },
    orderBy: { name: "asc" },
  });
  console.log("\nUsers and departments");
  for (const user of users) {
    const inferred = inferDepartment(user);
    console.log(`  ${(user.name ?? user.username ?? "(no name)").padEnd(18)} stored=${user.departmentSlug ?? "-"} inferred=${inferred ?? "-"}`);
    const expected = user.name ? USER_DEPT[user.name] : undefined;
    if (expected) check(user.departmentSlug === expected, `${user.name} is in ${expected}`);
  }

  await syncTapTasks(org.id, "ece");
  await syncTapTasks(org.id, "usa-river");
  await syncTapTasks(org.id, "arusha-modern");
  await syncTapTasks(org.id, "kijenge");
  await syncTapTasks(org.id, "ilboru");
  const julius = await db.user.findFirst({ where: { name: { contains: "Julius Kimani" } } });
  check(!!julius && julius.departmentSlug === "ece", "Julius Kimani is in Cluster ECE");
  const juliusCards = await db.task.findMany({
    where: { labels: { has: "TAP" }, title: { startsWith: "6." }, departmentSlug: "ece", assigneeId: julius?.id ?? "__none__" },
    select: { title: true, sharedWithIds: true },
  });
  check(juliusCards.length >= 3, "Julius owns ECE curriculum TAP cards");
  const pascaline = await db.user.findFirst({ where: { name: { contains: "Pascaline" } }, select: { id: true } });
  check(
    !!pascaline && juliusCards.some((card) => card.sharedWithIds.includes(pascaline.id)),
    "Pascaline is on Julius’s ECE curriculum team",
  );

  const kpi = await getKpiDashboard(org.id);
  check(kpi.tapDepts.length === TAP_DEPARTMENTS.length, "KPI covers every TAP department");
  check(
    kpi.tapDepts.every((dept) => dept.total === 0 || Math.abs(dept.pctDone + dept.pctUndone - 100) <= 1),
    "KPI done+undone is 100% per dept",
  );
  check(typeof kpi.overall.tapPct === "number", "KPI overall TAP percent is a number");
  check(kpi.tapDepts.every((dept) => typeof dept.onTrack === "number"), "KPI scoreboard has on-track counts");
  check(typeof kpi.overall.onTrack === "number", "KPI overall mix includes on-track");

  const first = pickDailyTapLineup(
    [
      { id: "a", title: "1.0 First" },
      { id: "b", title: "2.0 Second" },
      { id: "c", title: "3.0 Third" },
      { id: "d", title: "4.0 Fourth" },
    ],
    [{ taskId: "a", title: "1.0 First" }, { taskId: "b", title: "2.0 Second" }],
    3,
  );
  check(first.map((item) => item.id).join() === "a,b,c", "still-open TAP lines stay in today’s lineup");
  const rotated = pickDailyTapLineup(
    [
      { id: "b", title: "2.0 Second" },
      { id: "c", title: "3.0 Third" },
      { id: "d", title: "4.0 Fourth" },
    ],
    [{ taskId: "a", title: "1.0 First" }, { taskId: "b", title: "2.0 Second" }],
    3,
  );
  check(rotated.map((item) => item.id).join() === "b,c,d", "done TAP lines are replaced by the next open ones");
  const eceTap = tapDepartment("ece");
  const eceSix = eceTap?.items.find((item) => item.code === "6.0");
  const eceOpen = pickOpenTapItems(eceTap?.items ?? [], {
    skipTitles: eceSix ? [`${eceSix.code} ${eceSix.title}`] : [],
    limit: 3,
  });
  check(
    eceOpen.length > 0 && !eceOpen.some((item) => item.code === "6.0"),
    "catalog picks skip TAP lines that already moved on",
  );
  check(
    Boolean(eceTap?.items.some((item) => item.owners.includes("Julius") && (item.helpers ?? []).includes("Pascaline"))),
    "ECE 6.0 helpers include Pascaline",
  );

  if (failures.length) {
    console.log(`\n${failures.length} failed`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
