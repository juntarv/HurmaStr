import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/dates";
import type { AccrualMode, LeaveUnit, PayKind } from "@/generated/prisma/enums";

/**
 * Модель обліку днів
 * ------------------
 * Баланс НІДЕ не зберігається — він завжди обчислюється із заявок і дати найму.
 * Це виключає дрейф цифр: не буває «кешу», що розійшовся з реальністю.
 *
 * • Відпустка (MONTHLY): 2 дні за кожен повний місяць від дати найму,
 *   НАРОСТАЮЧИМ підсумком за весь час роботи (не скидається щороку).
 *   доступно = 2 × місяців_від_найму − використано_за_весь_час − на_погодженні
 *
 * • Лікарняні (ANNUAL): річна норма, що скидається щороку.
 *   доступно = річна_норма − використано_цьогоріч − на_погодженні_цьогоріч
 *
 * • Day Off (NONE): балансу немає, рахуємо лише скільки взято цьогоріч.
 */

/** Кількість ПОВНИХ місяців від дати найму до вказаної дати. */
export function monthsAccrued(hireDate: Date, asOf: Date = new Date()): number {
  const from = toDateOnly(hireDate);
  const to = toDateOnly(asOf);
  if (to < from) return 0;

  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  // Місяць зараховується лише коли настало число найму (день у день).
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function round1(n: number): number {
  return Math.round(n * 100) / 100;
}

export type LeaveTypeLike = {
  id: string;
  code: string;
  nameUk: string;
  icon: string;
  colorHex: string;
  unit: LeaveUnit;
  payKind: PayKind;
  affectsBalance: boolean;
  accrualMode: AccrualMode;
  accrualPerMonth: number | null;
  annualEntitlement: number | null;
  isMedical: boolean;
};

export type TypeBalance = {
  type: LeaveTypeLike;
  /** Чи ведеться баланс днів (Day Off — ні). */
  tracks: boolean;
  /** Скільки нараховано (для NONE — 0). */
  entitled: number;
  /** Ручне коригування HR (± днів): перенесення з іншого сервісу тощо. */
  adjustment: number;
  /** Використано погодженими заявками. */
  used: number;
  /** Заброньовано заявками на погодженні. */
  pending: number;
  /** Доступний залишок = entitled + adjustment − used − pending. */
  available: number;
};

type RequestRow = {
  leaveTypeId: string;
  status: string;
  startDate: Date;
  daysCount: number;
};

export type AdjustmentRow = {
  leaveTypeId: string;
  year: number | null;
  days: number;
};

function sumFor(
  rows: RequestRow[],
  typeId: string,
  status: "APPROVED" | "PENDING",
  year: number | null,
): number {
  return round1(
    rows
      .filter(
        (r) =>
          r.leaveTypeId === typeId &&
          r.status === status &&
          (year === null || toDateOnly(r.startDate).getUTCFullYear() === year),
      )
      .reduce((acc, r) => acc + r.daysCount, 0),
  );
}

/** Обчислює баланс одного типу для співробітника. */
export function computeTypeBalance(
  type: LeaveTypeLike,
  employee: { hireDate: Date },
  rows: RequestRow[],
  asOf: Date,
  adjustments: AdjustmentRow[] = [],
): TypeBalance {
  const year = toDateOnly(asOf).getUTCFullYear();
  const tracks = type.affectsBalance && type.accrualMode !== "NONE";

  let entitled = 0;
  // MONTHLY рахує за весь час, ANNUAL і NONE — у межах року.
  const scopeYear = type.accrualMode === "MONTHLY" ? null : year;

  if (type.accrualMode === "MONTHLY") {
    entitled = round1(monthsAccrued(employee.hireDate, asOf) * (type.accrualPerMonth ?? 0));
  } else if (type.accrualMode === "ANNUAL") {
    entitled = round1(type.annualEntitlement ?? 0);
  }

  // Коригування без року застосовуються завжди; з роком — лише у свій рік.
  const adjustment = round1(
    adjustments
      .filter((a) => a.leaveTypeId === type.id && (a.year === null || a.year === year))
      .reduce((acc, a) => acc + a.days, 0),
  );

  const used = sumFor(rows, type.id, "APPROVED", scopeYear);
  const pending = sumFor(rows, type.id, "PENDING", scopeYear);
  const available = round1(entitled + adjustment - used - pending);

  return { type, tracks, entitled, adjustment, used, pending, available };
}

const typeSelect = {
  id: true,
  code: true,
  nameUk: true,
  icon: true,
  colorHex: true,
  unit: true,
  payKind: true,
  affectsBalance: true,
  accrualMode: true,
  accrualPerMonth: true,
  annualEntitlement: true,
  isMedical: true,
} as const;

/** Баланси всіх активних типів для співробітника. */
export async function getEmployeeBalances(
  employeeId: string,
  asOf: Date = new Date(),
): Promise<TypeBalance[]> {
  const [employee, types, rows, adjustments] = await Promise.all([
    prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      select: { hireDate: true },
    }),
    prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: typeSelect }),
    prisma.leaveRequest.findMany({
      where: { employeeId, status: { in: ["APPROVED", "PENDING"] } },
      select: { leaveTypeId: true, status: true, startDate: true, daysCount: true },
    }),
    prisma.leaveAdjustment.findMany({
      where: { employeeId },
      select: { leaveTypeId: true, year: true, days: true },
    }),
  ]);

  return types.map((type) => computeTypeBalance(type, employee, rows, asOf, adjustments));
}

/** Баланс лише за одним типом — для перевірки при поданні заявки. */
export async function getBalanceForType(
  employeeId: string,
  leaveTypeId: string,
  asOf: Date = new Date(),
): Promise<TypeBalance> {
  const [employee, type, rows, adjustments] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { hireDate: true } }),
    prisma.leaveType.findUniqueOrThrow({ where: { id: leaveTypeId }, select: typeSelect }),
    prisma.leaveRequest.findMany({
      where: { employeeId, leaveTypeId, status: { in: ["APPROVED", "PENDING"] } },
      select: { leaveTypeId: true, status: true, startDate: true, daysCount: true },
    }),
    prisma.leaveAdjustment.findMany({
      where: { employeeId, leaveTypeId },
      select: { leaveTypeId: true, year: true, days: true },
    }),
  ]);

  return computeTypeBalance(type, employee, rows, asOf, adjustments);
}
