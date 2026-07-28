import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { buildSearchKey } from "../src/server/schemas/employee";
import { countWorkingDays, toDateOnly } from "../src/lib/dates";
import { nextRequestNumber } from "../src/server/services/leave";
import type { AssetCategory } from "../src/generated/prisma/enums";

/**
 * Початкове наповнення.
 *   • типи відсутностей (4);
 *   • відділи зі списку компанії;
 *   • акаунт адміністратора;
 *   • демо-персонал із рандомними датами найму (тільки якщо база порожня) —
 *     баланси при цьому справжні, бо рахуються з дати найму та заявок.
 *
 * SEED_DEMO=false вимикає створення демо-персоналу.
 */

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@hurma.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
const WITH_DEMO = process.env.SEED_DEMO !== "false";

// ------------------------------- утиліти ------------------------------------

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[rand(0, arr.length - 1)];
}
function chance(p: number): boolean {
  return Math.random() < p;
}
/** Випадкова дата між днями від сьогодні (від'ємні — у минулому). */
function dateBetween(daysAgoFrom: number, daysAgoTo: number): Date {
  const days = rand(daysAgoTo, daysAgoFrom);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return toDateOnly(d);
}
function translit(s: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
    з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
    о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia",
  };
  return s.toLowerCase().split("").map((c) => map[c] ?? c).join("");
}

// ------------------------------- довідники ----------------------------------

async function seedLeaveTypes() {
  const types = [
    {
      code: "VACATION", nameUk: "Відпустка",
      description: "Основна оплачувана відпустка. Нараховується 2 дні за кожен місяць роботи.",
      icon: "palm", colorHex: "#16A34A", unit: "WORKING_DAYS" as const, payKind: "PAID" as const,
      affectsBalance: true, accrualMode: "MONTHLY" as const, accrualPerMonth: 2, annualEntitlement: null,
      minNoticeDays: 0, allowPastDates: false, requiresDocument: false, isMedical: false,
      approvalRoute: "MANAGER_ONLY" as const, sortOrder: 10,
    },
    {
      code: "SICK_NO_DOC", nameUk: "Лікарняний без довідки",
      description: "До 2 днів на рік без підтвердних документів.",
      icon: "heart", colorHex: "#F87171", unit: "WORKING_DAYS" as const, payKind: "PAID" as const,
      affectsBalance: true, accrualMode: "ANNUAL" as const, accrualPerMonth: null, annualEntitlement: 2,
      minNoticeDays: 0, allowPastDates: true, requiresDocument: false, isMedical: true,
      approvalRoute: "MANAGER_ONLY" as const, sortOrder: 20,
    },
    {
      code: "SICK_DOC", nameUk: "Лікарняний з довідкою",
      description: "До 5 днів на рік за наявності медичної довідки.",
      icon: "bandage", colorHex: "#DC2626", unit: "WORKING_DAYS" as const, payKind: "PAID" as const,
      affectsBalance: true, accrualMode: "ANNUAL" as const, accrualPerMonth: null, annualEntitlement: 5,
      minNoticeDays: 0, allowPastDates: true, requiresDocument: true, isMedical: true,
      approvalRoute: "MANAGER_ONLY" as const, sortOrder: 30,
    },
    {
      code: "DAY_OFF", nameUk: "Day Off",
      description: "День відсутності без списання з балансу відпустки.",
      icon: "home", colorHex: "#0EA5E9", unit: "WORKING_DAYS" as const, payKind: "UNPAID" as const,
      affectsBalance: false, accrualMode: "NONE" as const, accrualPerMonth: null, annualEntitlement: null,
      minNoticeDays: 1, allowPastDates: false, requiresDocument: false, isMedical: false,
      approvalRoute: "MANAGER_ONLY" as const, sortOrder: 40,
    },
  ];
  for (const type of types) {
    await prisma.leaveType.upsert({ where: { code: type.code }, create: type, update: type });
  }
  console.log(`✓ Типи відсутностей: ${types.length}`);
}

const DEPARTMENTS = [
  { name: "Менеджмент", icon: "crown", colorHex: "#7C3AED" },
  { name: "Android Development", icon: "smartphone", colorHex: "#22C55E" },
  { name: "iOS Development", icon: "smartphone", colorHex: "#64748B" },
  { name: "Design", icon: "palette", colorHex: "#EC4899" },
  { name: "Support", icon: "headset", colorHex: "#0EA5E9" },
  { name: "IT & RnD", icon: "cpu", colorHex: "#F59E0B" },
  { name: "Farm/Publish", icon: "sprout", colorHex: "#84CC16" },
  { name: "Finance", icon: "wallet", colorHex: "#14B8A6" },
  { name: "HR", icon: "users", colorHex: "#E38324" },
];

async function seedDepartments() {
  for (const [index, dep] of DEPARTMENTS.entries()) {
    await prisma.department.upsert({
      where: { name: dep.name },
      create: { ...dep, sortOrder: index * 10 },
      update: { icon: dep.icon, colorHex: dep.colorHex, sortOrder: index * 10 },
    });
  }
  console.log(`✓ Відділи: ${DEPARTMENTS.length}`);
}

async function seedAdmin() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL }, select: { id: true } });
  if (existing) {
    console.log(`✓ Адміністратор уже існує: ${ADMIN_EMAIL}`);
    return;
  }
  const employee = await prisma.employee.create({
    data: {
      lastName: "Адміністратор", firstName: "Системи", workEmail: ADMIN_EMAIL,
      hireDate: new Date(Date.UTC(new Date().getUTCFullYear() - 2, 0, 15)),
      status: "ACTIVE", searchKey: buildSearchKey(["Адміністратор", "Системи", ADMIN_EMAIL]),
    },
  });
  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "ADMIN", isActive: true, employeeId: employee.id, inviteAcceptedAt: new Date(),
    },
  });
  console.log(`✓ Адміністратор: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

// ------------------------------- демо-персонал ------------------------------

const MALE_FIRST = ["Олександр", "Дмитро", "Андрій", "Сергій", "Максим", "Іван", "Богдан", "Владислав", "Артем", "Назар", "Тарас", "Ігор", "Роман", "Денис", "Павло", "Віталій", "Юрій", "Микита", "Олег", "Ярослав"];
const FEMALE_FIRST = ["Олена", "Марія", "Анна", "Наталія", "Ірина", "Оксана", "Тетяна", "Юлія", "Катерина", "Софія", "Вікторія", "Дарина", "Аліна", "Христина", "Людмила", "Валерія", "Уляна", "Яна", "Марина", "Діана"];
const LAST = ["Коваленко", "Бондаренко", "Ткаченко", "Кравченко", "Олійник", "Шевченко", "Поліщук", "Бойко", "Мельник", "Марченко", "Гончар", "Іваненко", "Савчук", "Руденко", "Кузьменко", "Лисенко", "Мороз", "Панченко", "Дорошенко", "Соколов", "Гриценко", "Захарченко", "Литвин", "Романюк", "Костенко", "Ткачук", "Волошин", "Данилюк", "Головко", "Науменко"];

const POSITIONS_BY_DEPT: Record<string, string[]> = {
  "Менеджмент": ["CEO", "COO", "Head of Product"],
  "Android Development": ["Android Team Lead", "Senior Android Developer", "Middle Android Developer", "Junior Android Developer"],
  "iOS Development": ["iOS Team Lead", "Senior iOS Developer", "Middle iOS Developer", "Junior iOS Developer"],
  "Design": ["Design Lead", "Product Designer", "UI/UX Designer", "Motion Designer"],
  "Support": ["Support Lead", "Support Specialist", "Customer Success Manager"],
  "IT & RnD": ["Head of IT", "DevOps Engineer", "QA Engineer", "System Administrator"],
  "Farm/Publish": ["Publishing Lead", "ASO Specialist", "Farm Specialist"],
  "Finance": ["CFO", "Financial Manager", "Accountant"],
  "HR": ["HR Lead", "HR Manager", "Recruiter"],
};

const HEADCOUNT_BY_DEPT: Record<string, number> = {
  "Менеджмент": 3,
  "Android Development": 8,
  "iOS Development": 7,
  "Design": 5,
  "Support": 5,
  "IT & RnD": 6,
  "Farm/Publish": 4,
  "Finance": 3,
  "HR": 3,
};

async function seedDemoPeople() {
  const total = await prisma.employee.count();
  if (total > 1) {
    console.log("• Демо-персонал пропущено (у базі вже є співробітники)");
    return;
  }

  const departments = await prisma.department.findMany();
  const depByName = new Map(departments.map((d) => [d.name, d]));
  const usedEmails = new Set<string>();

  const mgmt = depByName.get("Менеджмент")!;
  let ceoId: string | null = null;
  const headByDept = new Map<string, string>();

  // Спершу — керівники відділів (перша людина кожного відділу).
  for (const dep of DEPARTMENTS) {
    const department = depByName.get(dep.name)!;
    const positions = POSITIONS_BY_DEPT[dep.name];
    const isFemale = chance(0.45);
    const firstName = pick(isFemale ? FEMALE_FIRST : MALE_FIRST);
    const lastName = pick(LAST);

    let email = `${translit(firstName)}.${translit(lastName)}@sator.dev`;
    let n = 1;
    while (usedEmails.has(email)) email = `${translit(firstName)}.${translit(lastName)}${n++}@sator.dev`;
    usedEmails.add(email);

    const head = await prisma.employee.create({
      data: {
        firstName, lastName,
        gender: isFemale ? "FEMALE" : "MALE",
        workEmail: email,
        phone: `+38067${rand(1000000, 9999999)}`,
        telegram: `@${translit(firstName)}_${translit(lastName)}`,
        city: pick(["Київ", "Львів", "Одеса", "Харків", "Дніпро"]),
        birthDate: dateBetween(365 * 45, 365 * 27),
        hireDate: dateBetween(365 * 4, 365 * 2),
        status: "ACTIVE",
        employmentType: "FULL_TIME",
        departmentId: department.id,
        positionId: null,
        searchKey: buildSearchKey([lastName, firstName, email]),
        note: null,
      },
    });

    // Посада керівника — перша у списку відділу.
    const pos = await prisma.position.create({
      data: { title: positions[0], departmentId: department.id, sortOrder: 0 },
    });
    await prisma.employee.update({ where: { id: head.id }, data: { positionId: pos.id } });
    await prisma.department.update({ where: { id: department.id }, data: { headId: head.id } });
    headByDept.set(dep.name, head.id);
    if (dep.name === "Менеджмент") ceoId = head.id;
  }

  // Керівники відділів підпорядковані CEO.
  for (const [name, headId] of headByDept) {
    if (name !== "Менеджмент" && ceoId) {
      await prisma.employee.update({ where: { id: headId }, data: { managerId: ceoId } });
    }
  }

  // Далі — решта співробітників відділів.
  let created = DEPARTMENTS.length;
  for (const dep of DEPARTMENTS) {
    const department = depByName.get(dep.name)!;
    const positions = POSITIONS_BY_DEPT[dep.name];
    const headId = headByDept.get(dep.name)!;
    const extra = HEADCOUNT_BY_DEPT[dep.name] - 1;

    for (let i = 0; i < extra; i++) {
      const isFemale = chance(0.45);
      const firstName = pick(isFemale ? FEMALE_FIRST : MALE_FIRST);
      const lastName = pick(LAST);
      let email = `${translit(firstName)}.${translit(lastName)}@sator.dev`;
      let n = 1;
      while (usedEmails.has(email)) email = `${translit(firstName)}.${translit(lastName)}${n++}@sator.dev`;
      usedEmails.add(email);

      const hireDate = dateBetween(365 * 3, 20);
      const monthsWorked =
        (new Date().getUTCFullYear() - hireDate.getUTCFullYear()) * 12 +
        (new Date().getUTCMonth() - hireDate.getUTCMonth());
      const status = monthsWorked < 3 ? "PROBATION" : "ACTIVE";

      const title = pick(positions.slice(1));
      const pos = await prisma.position.create({
        data: { title, departmentId: department.id, sortOrder: rand(1, 9) },
      });

      await prisma.employee.create({
        data: {
          firstName, lastName,
          gender: isFemale ? "FEMALE" : "MALE",
          workEmail: email,
          phone: `+38067${rand(1000000, 9999999)}`,
          telegram: chance(0.6) ? `@${translit(firstName)}_${translit(lastName)}` : null,
          city: pick(["Київ", "Львів", "Одеса", "Харків", "Дніпро", "Вінниця"]),
          birthDate: dateBetween(365 * 40, 365 * 22),
          hireDate,
          status,
          employmentType: pick(["FULL_TIME", "FULL_TIME", "FULL_TIME", "PART_TIME", "CONTRACT"]),
          departmentId: department.id,
          positionId: pos.id,
          managerId: headId,
          searchKey: buildSearchKey([lastName, firstName, email]),
        },
      });
      created++;
    }
  }

  console.log(`✓ Демо-персонал: ${created} співробітників у ${DEPARTMENTS.length} відділах`);
  await seedDemoLeaves();
  await seedDemoAssets();
}

async function seedDemoLeaves() {
  const types = await prisma.leaveType.findMany();
  const vacation = types.find((t) => t.code === "VACATION")!;
  const sickNoDoc = types.find((t) => t.code === "SICK_NO_DOC")!;
  const dayOff = types.find((t) => t.code === "DAY_OFF")!;

  const employees = await prisma.employee.findMany({
    where: { workEmail: { not: ADMIN_EMAIL } },
    select: { id: true, hireDate: true },
  });

  const year = new Date().getUTCFullYear();
  let count = 0;

  for (const emp of employees) {
    // Приблизно кожен третій зараз відсутній (щоб панель і календар були живими).
    if (chance(0.32)) {
      const type = chance(0.7) ? vacation : chance(0.5) ? sickNoDoc : dayOff;
      const startOffset = rand(-3, 1);
      const start = toDateOnly(new Date());
      start.setUTCDate(start.getUTCDate() + startOffset);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + rand(1, 6));
      const days = countWorkingDays(start, toDateOnly(end));
      if (days <= 0) continue;

      await prisma.leaveRequest.create({
        data: {
          number: await nextRequestNumber(year),
          employeeId: emp.id, leaveTypeId: type.id,
          startDate: start, endDate: toDateOnly(end),
          daysCount: days, unitSnapshot: type.unit,
          status: "APPROVED", currentStep: 0,
          submittedAt: start, decidedAt: start,
        },
      });
      count++;
    }

    // Історична відпустка в минулому (щоб баланси показували використання).
    if (chance(0.5)) {
      const start = dateBetween(300, 40);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + rand(3, 9));
      const days = countWorkingDays(start, toDateOnly(end));
      if (days <= 0) continue;
      await prisma.leaveRequest.create({
        data: {
          number: await nextRequestNumber(year),
          employeeId: emp.id, leaveTypeId: vacation.id,
          startDate: start, endDate: toDateOnly(end),
          daysCount: days, unitSnapshot: vacation.unit,
          status: "APPROVED", currentStep: 0,
          submittedAt: start, decidedAt: start,
        },
      });
      count++;
    }
  }
  console.log(`✓ Демо-заявки: ${count}`);
}

async function seedDemoAssets() {
  const employees = await prisma.employee.findMany({
    where: { workEmail: { not: ADMIN_EMAIL } },
    select: { id: true },
  });

  const models: { name: string; category: AssetCategory }[] = [
    { name: "MacBook Pro 14 M3", category: "LAPTOP" },
    { name: "MacBook Air M2", category: "LAPTOP" },
    { name: "Dell XPS 15", category: "LAPTOP" },
    { name: "Lenovo ThinkPad X1", category: "LAPTOP" },
    { name: "LG UltraFine 27\"", category: "MONITOR" },
    { name: "Dell UltraSharp 24\"", category: "MONITOR" },
    { name: "iPhone 15 Pro", category: "PHONE" },
    { name: "Pixel 8 Pro", category: "PHONE" },
    { name: "iPad Air", category: "TABLET" },
    { name: "Logitech MX Master 3", category: "PERIPHERAL" },
    { name: "Keychron K3", category: "PERIPHERAL" },
    { name: "Крісло Herman Miller", category: "FURNITURE" },
  ];

  let inv = 1000;
  let count = 0;
  for (const emp of employees) {
    // Ноутбук майже кожному.
    if (chance(0.9)) {
      const m = pick(models.filter((x) => x.category === "LAPTOP"));
      await prisma.asset.create({
        data: {
          name: m.name, category: m.category, inventoryNumber: `INV-${inv++}`,
          status: "IN_USE", assignedToId: emp.id, assignedAt: new Date(),
          purchaseDate: dateBetween(365 * 3, 30),
        },
      });
      count++;
    }
    if (chance(0.4)) {
      const m = pick(models.filter((x) => x.category === "MONITOR"));
      await prisma.asset.create({
        data: {
          name: m.name, category: m.category, inventoryNumber: `INV-${inv++}`,
          status: "IN_USE", assignedToId: emp.id, assignedAt: new Date(),
          purchaseDate: dateBetween(365 * 3, 30),
        },
      });
      count++;
    }
  }

  // Кілька одиниць на складі та в ремонті.
  for (let i = 0; i < 8; i++) {
    const m = pick(models);
    await prisma.asset.create({
      data: {
        name: m.name, category: m.category, inventoryNumber: `INV-${inv++}`,
        status: chance(0.75) ? "IN_STOCK" : "REPAIR",
        purchaseDate: dateBetween(365 * 2, 30),
      },
    });
    count++;
  }
  console.log(`✓ Демо-майно: ${count} одиниць`);
}

// -------------------------------- запуск ------------------------------------

async function main() {
  await seedLeaveTypes();
  await seedDepartments();
  await seedAdmin();
  if (WITH_DEMO) await seedDemoPeople();
  console.log("\nГотово. Вхід: " + ADMIN_EMAIL + " / " + ADMIN_PASSWORD);
}

main()
  .catch((error) => {
    console.error("Помилка наповнення:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
