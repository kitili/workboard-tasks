import "dotenv/config";
import { db } from "../src/lib/db";
import { inferDepartment } from "../src/lib/departments";
import { boardStatusToTap, deskCatalogPeople, departmentTapCatalog, groupTapRocks, opsTapDeskCatalog, personMatchesTapOwner, pickOpenTapItems, preferredCompletedWord, TAP_DEPARTMENTS, tapDepartment, tapItemBelongsOnOpsDesk, tapPeople } from "../src/lib/data/tap-catalog";
import { isDataTechMember, isHrLead, isHrMember, isMarketingLead, isMarketingMember, isOpsCrew, isOpsLead, isShikunzi, opsCrewLabel, opsDeskPersonLabel } from "../src/lib/auth/admin";
import { canAddDeskMembers } from "../src/lib/auth/desk";
import { getKpiDashboard } from "../src/lib/services/kpi";
import { pickDailyTapLineup } from "../src/lib/today/tap-lineup";
import { syncTapTasks } from "../src/lib/services/tap-sync";
import { noonHasPassed, selectDepartmentStaff, selectMissingDaily, sixPmHasPassed } from "../src/lib/board/missing-daily";
import { returnToTasksError } from "../src/lib/board/columns";
import { cellA1, findStatusCell } from "../src/lib/board/sheet-grid";
import { sheetCardPhrase, sheetColumnTitle, writeSheetPhrase } from "../src/lib/board/sheet-status";
import { canAssignDesk, canGiveDeskTask, canViewDesk, isDeskSlug } from "../src/lib/auth/desk";
import { googleTapConfigured, pushRockStatus } from "../src/lib/services/google-tap-sheet";
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
  check(isOpsLead({ name: "Majundo Hassan" }) === true, "Ed Admin Majundo Hassan is the ops TAP lead");
  check(isOpsCrew({ name: "Francis" }) === true, "Francis is ops crew, not a TAP portal");
  check(isOpsCrew({ name: "Kusaduka" }) === true, "Kusaduka is ops crew, not a TAP portal");
  check(isOpsCrew({ name: "Shikunzi" }) === true, "Shikunzi is ops crew, not a TAP portal");
  check(opsCrewLabel({ name: "Shikuze" }) === "Shikunzi", "Shikuze stays labelled Shikunzi");
  check(isOpsCrew({ name: "Majundo Hassan" }) === false, "Majundo is the ops lead, not crew");
  check(
    personMatchesTapOwner({ name: "Majundo Hassan", email: "baraka@silverleaf.co.tz" }, "Baraka") === true,
    "Majundo Hassan still owns Baraka TAP lines",
  );
  check(
    personMatchesTapOwner({ name: "Baraka Lema", email: "barakalema@silverleaf.co.tz" }, "Baraka") === false,
    "Baraka Lema is not Cluster Ops TAP",
  );
  check(opsDeskPersonLabel({ name: "Majundo Hassan" }) === "Baraka", "Majundo can take a TAP himself");
  check(opsDeskPersonLabel({ name: "Francis" }) === "Francis", "Francis is on the ops desk people");
  check(boardStatusToTap("COMPLETED") === "Fully Completed", "board Done stamps Fully Completed on the sheet");
  check(boardStatusToTap("COMPLETED", "On Schedule", "finance") === "Completed", "finance Done stamps Completed on the sheet");
  check(boardStatusToTap("IN_PROGRESS") === "Ongoing", "board Doing stamps Ongoing on the sheet");
  check(boardStatusToTap("BACKLOG") === "Not Started", "board Backlog stamps Not Started on the sheet");
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
  check(
    desk.some((dept) => dept.slug === "arusha-modern" && dept.items.some((item) => item.code === "11.1")),
    "ops desk includes campus TAP that names Francis and Baraka",
  );
  check(
    desk.some((dept) => dept.slug === "kijenge" && dept.items.some((item) => item.code === "11.0")),
    "ops desk includes Kijenge TAP that names Francis",
  );
  check(
    desk.some((dept) => dept.slug === "data-tech" && dept.items.some((item) => item.code === "2.5")),
    "ops desk includes DATA & TECH 2.5 where Baraka helps",
  );
  const am = TAP_DEPARTMENTS.find((dept) => dept.slug === "arusha-modern");
  const amEleven = am?.items.find((item) => item.code === "11.0");
  check(Boolean(amEleven && tapItemBelongsOnOpsDesk("arusha-modern", amEleven)), "Francis-owned campus TAP belongs on the ops desk");
  check(!(amEleven?.helpers ?? []).some((name) => /dec|2026/i.test(name)), "campus TAP helpers are people, not deadline text");
  const hrDesk = departmentTapCatalog("hr");
  check(hrDesk.some((dept) => dept.slug === "hr" && dept.items.length >= 40), "HR desk includes HUMAN RESOURCE TAP rocks");
  check(deskCatalogPeople("hr").includes("Esther Mwalyego"), "HR desk lists Esther Mwalyego");
  check(deskCatalogPeople("hr").includes("Valentina"), "HR desk lists Valentina");
  check(deskCatalogPeople("hr").includes("Bwana"), "HR desk lists Bwana");
  const marketingDesk = departmentTapCatalog("marketing");
  check(marketingDesk.some((dept) => dept.slug === "marketing" && dept.items.length >= 40), "Marketing desk includes Marketing TAP rocks");
  check(deskCatalogPeople("marketing").includes("Kilusu Mattasia"), "Marketing desk lists Kilusu");
  check(deskCatalogPeople("marketing").includes("Erick"), "Marketing desk lists Erick");
  check(deskCatalogPeople("marketing").includes("Mariam"), "Marketing desk lists Mariam");
  check(isHrLead({ name: "Esther Mwalyego" }) === true, "Esther is the HR TAP lead");
  check(isHrMember({ name: "Valentina" }) === true, "Valentina is on the HR desk");
  check(isMarketingLead({ name: "Kilusu Mattasia" }) === true, "Kilusu is the marketing TAP lead");
  check(isMarketingMember({ name: "Mariam" }) === true, "Mariam is on the marketing desk");
  check(isShikunzi({ name: "Shikunzi" }) === true, "Shikunzi can host the ops desk");
  check(canAddDeskMembers({ name: "Majundo Hassan" }, "operations") === true, "Baraka can add ops people");
  check(canAddDeskMembers({ name: "Shikunzi" }, "operations") === true, "Shikunzi can add ops people");
  check(canAddDeskMembers({ name: "Francis" }, "operations") === false, "Francis does not add ops people");
  check(canAddDeskMembers({ name: "Esther Mwalyego" }, "hr") === true, "Esther can add HR people");
  check(canAddDeskMembers({ name: "Kilusu Mattasia" }, "marketing") === true, "Kilusu can add marketing people");
  check(isDataTechMember({ departmentSlug: "data-tech" }) === true, "Data & Tech department slug is on the Data & Tech desk");
  check(isDataTechMember({ name: "Irene Musau" }) === true, "Irene Musau is on the Data & Tech desk");
  check(isDataTechMember({ name: "Irene Didass Machange" }) === false, "Irene Didass is not on the Data & Tech desk");
  check(returnToTasksError("IN_PROGRESS", "TODO") !== null, "in progress cannot go back to untouched tasks");
  check(returnToTasksError("COMPLETED", "BACKLOG") !== null, "done cards stay completed");
  check(returnToTasksError("TODO", "IN_PROGRESS") === null, "untouched tasks can move to in progress");
  check(returnToTasksError("BACKLOG", "IN_PROGRESS") === null, "backlog can move to in progress");
  check(sheetColumnTitle("TODO") === "On Schedule", "tasks column uses On Schedule");
  check(sheetColumnTitle("IN_PROGRESS") === "Ongoing", "doing column uses Ongoing");
  check(sheetColumnTitle("BACKLOG") === "Not Started", "backlog column uses Not Started");
  check(sheetColumnTitle("COMPLETED", "hr") === "Fully Completed", "HR done column uses Fully Completed");
  check(sheetColumnTitle("COMPLETED", "operations") === "Fully Completed", "ops done column uses Fully Completed");
  check(sheetColumnTitle("COMPLETED", "marketing") === "Fully Completed", "marketing done column uses Fully Completed");
  check(sheetColumnTitle("COMPLETED", "finance") === "Completed", "finance done column uses Completed");
  check(preferredCompletedWord("arusha-modern") === "Completed", "Arusha Modern sheet says Completed");
  check(
    sheetCardPhrase("IN_PROGRESS", "MEL calendar · Partially Completed", "hr") === "Partially Completed",
    "in-progress cards keep Partially Completed",
  );
  check(writeSheetPhrase("MEL calendar · On Schedule", "Fully Completed") === "MEL calendar · Fully Completed", "sheet phrase stamp replaces the last word");
  check(sixPmHasPassed(new Date("2026-10-12T17:59:00+03:00")) === false, "sheet sync waits until 18:00 EAT");
  check(sixPmHasPassed(new Date("2026-10-12T18:00:00+03:00")) === true, "sheet sync is due at 18:00 EAT");
  const dataTechGrid = [
    ["", "", "", "", "", ""],
    ["", "", "", "", "", "Status (RYGG)", "Person Responsible", "", "", "", "Status code"],
    ["Rocks", "1.0", "Ed Admin", "", "", "On Schedule"],
    ["", "2.0", "AI", "", "", "On Schedule"],
  ];
  const dataTechCell = findStatusCell(dataTechGrid, "1.0");
  check(dataTechCell?.row === 2 && dataTechCell.column === 5, "Data & Tech status sits in column F beside rock 1.0");
  check(cellA1(dataTechCell?.row ?? 0, dataTechCell?.column ?? 0) === "F3", "Data & Tech rock 1.0 writes F3");
  const hrGrid = [
    ["", "", "", "", "", "Status code"],
    ["", "", "", "", "", "Status", "Person Responsible"],
    ["Rocks", "1.0", "Recruitment", "", "", "Partially Completed"],
    ["", "", "", "", "", "Status"],
    ["", "1.1", "Monthly report", "", "", "Ongoing"],
  ];
  const hrChild = findStatusCell(hrGrid, "1.1");
  check(hrChild?.row === 4 && hrChild.column === 5, "a later Status header still finds rock 1.1");
  check(findStatusCell(hrGrid, "9.9") === null, "a missing rock is not written to the sheet");
  check(isDeskSlug("finance") && isDeskSlug("ece") && isDeskSlug("ilboru"), "every TAP department has its own desk");
  check(canViewDesk({ name: "Imani", departmentSlug: "finance" }, "finance") === true, "finance sees its own people");
  check(canViewDesk({ name: "Imani", departmentSlug: "finance" }, "hr") === false, "finance does not open the HR desk");
  check(canViewDesk({ name: "Jephason", departmentSlug: "usa-river" }, "usa-river") === true, "Usa River sees its own desk");
  check(canViewDesk({ name: "Jephason", departmentSlug: "usa-river" }, "operations") === false, "a campus does not open the ops desk");
  check(canAssignDesk({ name: "Esther Mwalyego" }, "hr") === true, "Esther can give HR tasks to HR people");
  check(canAssignDesk({ name: "Francis" }, "operations") === false, "ops crew cannot hand tasks to other people");
  check(canGiveDeskTask({ name: "Francis" }, "operations", true) === true, "ops crew can still take a line themselves");
  check(canGiveDeskTask({ name: "Francis" }, "operations", false) === false, "ops crew cannot give a line to someone else");
  check(canAssignDesk({ name: "Jacqueline Karomo", departmentSlug: "ece" }, "ece") === true, "Jacqueline can give ECE tasks to ECE people");
  if (!googleTapConfigured()) {
    const pending = await pushRockStatus({ slug: "hr", code: "1.0", phrase: "Ongoing" });
    check(pending.skipped === true && pending.written === 0, "Google Sheet write waits until the workbook is connected");
  } else {
    check(googleTapConfigured() === true, "Google Sheet workbook is connected");
  }
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
