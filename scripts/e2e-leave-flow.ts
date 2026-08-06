import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  buildApprovalRoute,
  calcLeaveDays,
  nextRequestNumber,
  validateSubmission,
} from "../src/server/services/leave";
import { computeTypeBalance, getBalanceForType, monthsAccrued } from "../src/server/services/balance";
import { toDateOnly } from "../src/lib/dates";

/**
 * Наскрізна перевірка обліку днів (баланс рахується із заявок і дати найму).
 * Створює тимчасові дані, проганяє життєвий цикл, прибирає за собою.
 */

const TAG = "__E2E__";
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (очікувалось ${JSON.stringify(expected)})`}`);
}

async function cleanup() {
  const ids = (await prisma.employee.findMany({ where: { note: TAG }, select: { id: true } })).map((e) => e.id);
  if (!ids.length) return;
  await prisma.leaveApproval.deleteMany({ where: { request: { employeeId: { in: ids } } } });
  await prisma.leaveRequest.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.user.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.employee.updateMany({ where: { id: { in: ids } }, data: { managerId: null } });
  await prisma.employee.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  await cleanup();
  const now = new Date();
  const year = now.getUTCFullYear();
  const vacation = await prisma.leaveType.findUniqueOrThrow({ where: { code: "VACATION" } });

  // --- 1. Нарахування наростаючим підсумком від дати найму -------------------
  check("monthsAccrued: рівно 11 місяців тому = 11", monthsAccrued(new Date(Date.UTC(year - 1, now.getUTCMonth() - 1 < 0 ? 11 : now.getUTCMonth() - 1, now.getUTCDate())), now) >= 11, true);

  const hireMonths = 11;
  const hireDate = toDateOnly(new Date());
  hireDate.setUTCMonth(hireDate.getUTCMonth() - hireMonths);

  const manager = await prisma.employee.create({
    data: { lastName: "Тестенко", firstName: "Керівник", hireDate, status: "ACTIVE", searchKey: "тестенко керівник", note: TAG },
  });
  const worker = await prisma.employee.create({
    data: { lastName: "Тестенко", firstName: "Підлеглий", hireDate, status: "ACTIVE", searchKey: "тестенко підлеглий", note: TAG, managerId: manager.id },
  });

  const expectedEntitled = monthsAccrued(hireDate, now) * 2;
  check("11 місяців → нараховано 22 дні", expectedEntitled, 22);

  let bal = await getBalanceForType(worker.id, vacation.id, now);
  check("баланс відпустки = 22", bal.available, 22);
  check("нараховано = 22", bal.entitled, 22);
  check("використано = 0", bal.used, 0);

  // --- 2. Маршрут погодження -------------------------------------------------
  const route = await buildApprovalRoute({
    employeeId: worker.id, managerIds: [manager.id], departmentHeadId: null, route: "MANAGER_THEN_HR",
  });
  check("маршрут: керівник + HR = 2 кроки", route.steps.length, 2);
  // Крок керівника рольовий: погоджує будь-хто з керівників (approverId=null).
  check("перший крок — керівник", route.steps[0].role, "MANAGER");

  const routeNoOne = await buildApprovalRoute({
    employeeId: worker.id, managerIds: [], departmentHeadId: null, route: "MANAGER_ONLY",
  });
  check("без керівника — автопогодження (не зависає)", routeNoOne.autoApprove, true);

  // --- 3. Тривалість у робочих днях ------------------------------------------
  const monday = toDateOnly(new Date());
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
  const friday = new Date(monday);
  friday.setUTCDate(friday.getUTCDate() + 4);
  const saturday = new Date(monday);
  saturday.setUTCDate(saturday.getUTCDate() + 5);
  check("пн–пт = 5 робочих днів", calcLeaveDays(vacation, monday, friday), 5);
  check("пн–сб теж 5 (субота не рахується)", calcLeaveDays(vacation, monday, toDateOnly(saturday)), 5);

  // --- 4. Подання (PENDING) резервує дні -------------------------------------
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        number: await nextRequestNumber(year), employeeId: worker.id, leaveTypeId: vacation.id,
        startDate: monday, endDate: friday, daysCount: 5, unitSnapshot: vacation.unit,
        status: "PENDING", currentStep: 1, submittedAt: new Date(),
      },
    });
    await tx.leaveApproval.createMany({
      data: route.steps.map((s) => ({ requestId: created.id, step: s.step, role: s.role, approverId: s.approverId })),
    });
    return created;
  });

  bal = await getBalanceForType(worker.id, vacation.id, now);
  check("PENDING резервує 5 днів", bal.pending, 5);
  check("доступно = 22 − 5 = 17", bal.available, 17);
  check("використано ще 0", bal.used, 0);

  // --- 5. Перевірки подання --------------------------------------------------
  const overlap = validateSubmission({
    startDate: monday, endDate: friday, days: 5, type: vacation, tracksBalance: true, available: 17,
    overlaps: [{ number: request.number, startDate: monday, endDate: friday }],
  });
  check("перетин періодів блокує", overlap.some((i) => i.code === "OVERLAP" && i.blocking), true);

  const notEnough = validateSubmission({
    startDate: monday, endDate: friday, days: 5, type: vacation, tracksBalance: true, available: 2, overlaps: [],
  });
  check("нестача днів блокує", notEnough.some((i) => i.code === "BALANCE" && i.blocking), true);

  // --- 6. Погодження переводить у used ---------------------------------------
  await prisma.$transaction(async (tx) => {
    await tx.leaveApproval.updateMany({ where: { requestId: request.id }, data: { status: "APPROVED", decidedAt: new Date() } });
    await tx.leaveRequest.update({ where: { id: request.id }, data: { status: "APPROVED", decidedAt: new Date() } });
  });
  bal = await getBalanceForType(worker.id, vacation.id, now);
  check("після погодження used = 5", bal.used, 5);
  check("бронювання знято", bal.pending, 0);
  check("доступно = 17", bal.available, 17);

  // --- 7. Скасування повертає дні --------------------------------------------
  await prisma.leaveRequest.update({ where: { id: request.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  bal = await getBalanceForType(worker.id, vacation.id, now);
  check("після скасування доступно знову 22", bal.available, 22);
  check("used обнулено", bal.used, 0);

  // --- 8. computeTypeBalance напряму (без БД) ---------------------------------
  const sick = await prisma.leaveType.findUniqueOrThrow({ where: { code: "SICK_NO_DOC" } });
  const sickBal = computeTypeBalance(sick, { hireDate }, [], now);
  check("лікарняний без довідки: річна норма 2", sickBal.available, 2);

  await cleanup();
  console.log(failures === 0 ? "\nУСІ ПЕРЕВІРКИ ПРОЙДЕНО" : `\nПРОВАЛЕНО: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Помилка тесту:", e);
  await cleanup();
  process.exit(1);
});
