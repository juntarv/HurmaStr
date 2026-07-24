import { describe, it, expect } from "vitest";
import {
  monthsAccrued,
  round1,
  computeTypeBalance,
  type LeaveTypeLike,
} from "@/server/services/balance";

/**
 * Юніт-тести чистої логіки балансів (без БД).
 * Усі аргументи будуються вручну: LeaveTypeLike, «сирі» рядки заявок і коригувань.
 */

// Дата-хелпер: місяць 1-based для читабельності (січень = 1).
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

// Форма RequestRow (тип у модулі не експортований — відтворюємо структурно).
type Row = { leaveTypeId: string; status: string; startDate: Date; daysCount: number };
const req = (leaveTypeId: string, status: string, startDate: Date, daysCount: number): Row => ({
  leaveTypeId,
  status,
  startDate,
  daysCount,
});

function makeType(over: Partial<LeaveTypeLike> = {}): LeaveTypeLike {
  return {
    id: "vac",
    code: "VACATION",
    nameUk: "Відпустка",
    icon: "🌴",
    colorHex: "#00aa00",
    unit: "CALENDAR_DAYS",
    payKind: "PAID",
    affectsBalance: true,
    accrualMode: "MONTHLY",
    accrualPerMonth: 2,
    annualEntitlement: null,
    isMedical: false,
    ...over,
  };
}

describe("monthsAccrued", () => {
  it("рівно N повних місяців → N", () => {
    expect(monthsAccrued(d(2025, 1, 15), d(2025, 7, 15))).toBe(6);
  });

  it("той самий день найму → 0", () => {
    expect(monthsAccrued(d(2025, 3, 10), d(2025, 3, 10))).toBe(0);
  });

  it("день ще не настав у місяці (to.date < hire.date) → мінус місяць", () => {
    // Найнято 20-го, зараз лише 15-те → останній місяць не зараховано.
    expect(monthsAccrued(d(2025, 1, 20), d(2025, 7, 15))).toBe(5);
  });

  it("дата найму в майбутньому (to < from) → 0", () => {
    expect(monthsAccrued(d(2026, 1, 1), d(2025, 6, 15))).toBe(0);
  });

  it("перетин року: число найму настало → повні місяці", () => {
    // 10 лист. 2024 → 10 лют. 2025: лис→гру→січ→лют = 3 повних місяці.
    expect(monthsAccrued(d(2024, 11, 10), d(2025, 2, 10))).toBe(3);
  });

  it("перетин року: число найму ще не настало → мінус місяць", () => {
    // 20 лист. 2024 → 10 лют. 2025: 20-те лютого не настало → 2 місяці.
    expect(monthsAccrued(d(2024, 11, 20), d(2025, 2, 10))).toBe(2);
  });

  it("край місяця: найм 31-го, у наступному місяці немає 31-го → 0 (правило «день у день»)", () => {
    // Задокументоване обмеження правила day-of-month: 31 січ → 28 лют не рахує місяць.
    expect(monthsAccrued(d(2025, 1, 31), d(2025, 2, 28))).toBe(0);
  });
});

describe("round1", () => {
  it("округлює до 2 знаків, півдня зберігаються", () => {
    expect(round1(0.5)).toBe(0.5);
    expect(round1(2.5)).toBe(2.5);
    expect(round1(2.25)).toBe(2.25);
    expect(round1(2)).toBe(2);
  });

  it("округлення половини вгору на 2-му знаку (2.125 → 2.13)", () => {
    // 2.125 і 212.5 точно представні в double → чиста перевірка half-up і 2 знаків.
    expect(round1(2.125)).toBe(2.13);
  });

  it("очищає хвіст float-арифметики (0.1 + 0.2 → 0.3)", () => {
    expect(round1(0.1 + 0.2)).toBe(0.3);
    expect(round1(18 * 0.1)).toBe(1.8);
  });
});

describe("computeTypeBalance — MONTHLY (відпустка)", () => {
  const type = makeType({ accrualMode: "MONTHLY", accrualPerMonth: 2 });
  // Найм 15 січ. 2024, дивимось на 15 лип. 2025 → 18 повних місяців.
  const employee = { hireDate: d(2024, 1, 15) };
  const asOf = d(2025, 7, 15);

  it("entitled = місяців × perMonth НАРОСТАЮЧИМ підсумком (через межу року)", () => {
    const b = computeTypeBalance(type, employee, [], asOf);
    expect(b.entitled).toBe(36); // 18 міс × 2, не скидається щороку
    expect(b.tracks).toBe(true);
  });

  it("used = сума APPROVED за ВЕСЬ час; pending = сума PENDING за весь час", () => {
    const rows: Row[] = [
      req("vac", "APPROVED", d(2024, 6, 1), 5), // минулий рік — теж рахується
      req("vac", "APPROVED", d(2025, 3, 1), 3),
      req("vac", "PENDING", d(2025, 8, 1), 2),
      req("vac", "REJECTED", d(2025, 4, 1), 4), // не APPROVED/PENDING → ігнор
      req("other", "APPROVED", d(2025, 2, 1), 10), // інший тип → ігнор
    ];
    const b = computeTypeBalance(type, employee, rows, asOf);
    expect(b.used).toBe(8); // 5 + 3 за весь час
    expect(b.pending).toBe(2);
    expect(b.available).toBe(26); // 36 + 0 − 8 − 2
  });

  it("піврічні (0.5) заявки підсумовуються без float-дрейфу", () => {
    const rows: Row[] = [
      req("vac", "APPROVED", d(2025, 1, 10), 0.5),
      req("vac", "APPROVED", d(2025, 2, 10), 0.5),
      req("vac", "APPROVED", d(2025, 3, 10), 0.5),
    ];
    const b = computeTypeBalance(type, employee, rows, asOf);
    expect(b.used).toBe(1.5);
    expect(b.available).toBe(34.5); // 36 − 1.5
  });

  it("дробовий accrualPerMonth → round1 очищає хвіст у entitled", () => {
    const t = makeType({ accrualMode: "MONTHLY", accrualPerMonth: 0.1 });
    const b = computeTypeBalance(t, employee, [], asOf);
    expect(b.entitled).toBe(1.8); // round1(18 × 0.1), а не 1.8000000000000003
  });
});

describe("computeTypeBalance — ANNUAL (лікарняні)", () => {
  const type = makeType({
    id: "sick",
    code: "SICK",
    accrualMode: "ANNUAL",
    accrualPerMonth: null,
    annualEntitlement: 10,
    isMedical: true,
  });
  const employee = { hireDate: d(2020, 1, 1) };
  const asOf = d(2025, 7, 15); // рік = 2025

  it("entitled = річна норма; used/pending рахуються ЛИШЕ за поточний рік", () => {
    const rows: Row[] = [
      req("sick", "APPROVED", d(2025, 2, 1), 3), // цей рік → рахується
      req("sick", "APPROVED", d(2024, 11, 1), 5), // минулий рік → ігнор
      req("sick", "PENDING", d(2025, 6, 1), 2), // цей рік → рахується
      req("sick", "PENDING", d(2024, 6, 1), 4), // минулий рік → ігнор
    ];
    const b = computeTypeBalance(type, employee, rows, asOf);
    expect(b.entitled).toBe(10);
    expect(b.used).toBe(3); // лише 2025
    expect(b.pending).toBe(2); // лише 2025
    expect(b.available).toBe(5); // 10 − 3 − 2
    expect(b.tracks).toBe(true);
  });
});

describe("computeTypeBalance — NONE (Day Off)", () => {
  const type = makeType({
    id: "dayoff",
    code: "DAYOFF",
    accrualMode: "NONE",
    accrualPerMonth: null,
    annualEntitlement: null,
    affectsBalance: false,
  });
  const employee = { hireDate: d(2020, 1, 1) };
  const asOf = d(2025, 7, 15);

  it("entitled = 0, tracks = false, але used рахує взяте за поточний рік", () => {
    const rows: Row[] = [
      req("dayoff", "APPROVED", d(2025, 4, 1), 1), // цей рік → used
      req("dayoff", "APPROVED", d(2024, 4, 1), 1), // минулий рік → ігнор
      req("dayoff", "PENDING", d(2025, 5, 1), 1), // цей рік → pending
    ];
    const b = computeTypeBalance(type, employee, rows, asOf);
    expect(b.entitled).toBe(0);
    expect(b.tracks).toBe(false);
    expect(b.used).toBe(1); // лише 2025
    expect(b.pending).toBe(1);
    expect(b.available).toBe(-2); // 0 − 1 − 1
  });
});

describe("computeTypeBalance — коригування (adjustment)", () => {
  const type = makeType({ accrualMode: "MONTHLY", accrualPerMonth: 2 });
  // Найм = asOf → 0 місяців → entitled 0, немає заявок → баланс = лише коригування.
  const asOf = d(2025, 7, 15); // рік 2025
  const employee = { hireDate: asOf };

  it("year=null застосовується завжди; year=<рік asOf> застосовується; інший рік/тип — ні", () => {
    const adjustments = [
      { leaveTypeId: "vac", year: null, days: 5 }, // завжди → +5
      { leaveTypeId: "vac", year: 2025, days: 3 }, // збігається з роком asOf → +3
      { leaveTypeId: "vac", year: 2024, days: 100 }, // інший рік → ігнор
      { leaveTypeId: "other", year: null, days: 50 }, // інший тип → ігнор
    ];
    const b = computeTypeBalance(type, employee, [], asOf, adjustments);
    expect(b.entitled).toBe(0);
    expect(b.adjustment).toBe(8); // 5 + 3
    expect(b.available).toBe(8); // 0 + 8 − 0 − 0
  });

  it("коригування year=<інший рік> не впливає на баланс", () => {
    const b = computeTypeBalance(type, employee, [], asOf, [
      { leaveTypeId: "vac", year: 2024, days: 42 },
    ]);
    expect(b.adjustment).toBe(0);
    expect(b.available).toBe(0);
  });
});
