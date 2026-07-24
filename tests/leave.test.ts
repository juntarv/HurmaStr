import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calcLeaveDays,
  validateSubmission,
  buildApprovalRoute,
  nextRequestNumber,
  type SubmitContext,
} from "@/server/services/leave";
import { prisma } from "@/lib/prisma";

// Всі мокі знімаємо після кожного тесту, а фейковий час повертаємо до реального.
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ========================= calcLeaveDays =====================================

describe("calcLeaveDays", () => {
  // Пн 2026-03-02 … Нд 2026-03-08 — рівно один тиждень.
  const from = new Date(Date.UTC(2026, 2, 2)); // понеділок
  const to = new Date(Date.UTC(2026, 2, 8)); // неділя

  it("WORKING_DAYS рахує лише робочі дні (без вихідних)", () => {
    expect(calcLeaveDays({ unit: "WORKING_DAYS" }, from, to)).toBe(5);
  });

  it("CALENDAR_DAYS рахує всі дні поспіль", () => {
    expect(calcLeaveDays({ unit: "CALENDAR_DAYS" }, from, to)).toBe(7);
  });

  it("на однакових датах CALENDAR_DAYS >= WORKING_DAYS", () => {
    const cal = calcLeaveDays({ unit: "CALENDAR_DAYS" }, from, to);
    const work = calcLeaveDays({ unit: "WORKING_DAYS" }, from, to);
    expect(cal).toBeGreaterThan(work);
  });
});

// ========================= validateSubmission ================================

// Базовий валідний контекст. Фейковий "сьогодні" = 2026-06-15 (див. beforeEach).
function baseCtx(
  overrides: Partial<SubmitContext> = {},
  typeOverrides: Partial<SubmitContext["type"]> = {},
): SubmitContext {
  const base: SubmitContext = {
    startDate: new Date(Date.UTC(2026, 5, 20)), // 20 червня — у майбутньому
    endDate: new Date(Date.UTC(2026, 5, 22)),
    days: 3,
    type: {
      nameUk: "Відпустка",
      minNoticeDays: 0,
      allowPastDates: true,
      allowNegativeBalance: false,
      affectsBalance: true,
      requiresDocument: false,
    },
    documentNumber: null,
    tracksBalance: false,
    available: 100,
    overlaps: [],
  };
  return {
    ...base,
    ...overrides,
    type: { ...base.type, ...typeOverrides },
  };
}

function codes(issues: ReturnType<typeof validateSubmission>): string[] {
  return issues.map((i) => i.code);
}

describe("validateSubmission", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z")); // сьогодні = 2026-06-15 UTC
  });

  it("RANGE: end < start → blocking і решта перевірок не виконується", () => {
    const issues = validateSubmission(
      baseCtx({
        startDate: new Date(Date.UTC(2026, 5, 20)),
        endDate: new Date(Date.UTC(2026, 5, 10)), // раніше за старт
        days: 0, // спровокувало б NO_DAYS
        overlaps: [
          { number: "ЗВ-2026-000001", startDate: new Date(), endDate: new Date() },
        ], // спровокувало б OVERLAP
      }),
    );
    expect(codes(issues)).toEqual(["RANGE"]);
    expect(issues[0].blocking).toBe(true);
  });

  it("NO_DAYS: days <= 0 → blocking", () => {
    const issues = validateSubmission(
      baseCtx({
        startDate: new Date(Date.UTC(2026, 5, 20)),
        endDate: new Date(Date.UTC(2026, 5, 20)),
        days: 0,
      }),
    );
    const noDays = issues.find((i) => i.code === "NO_DAYS");
    expect(noDays).toBeDefined();
    expect(noDays!.blocking).toBe(true);
  });

  it("PAST: минула дата + allowPastDates=false → blocking", () => {
    const issues = validateSubmission(
      baseCtx(
        {
          startDate: new Date(Date.UTC(2026, 5, 10)), // до сьогодні (15 червня)
          endDate: new Date(Date.UTC(2026, 5, 12)),
        },
        { allowPastDates: false },
      ),
    );
    const past = issues.find((i) => i.code === "PAST");
    expect(past).toBeDefined();
    expect(past!.blocking).toBe(true);
  });

  it("PAST: минула дата + allowPastDates=true → немає PAST", () => {
    const issues = validateSubmission(
      baseCtx(
        {
          startDate: new Date(Date.UTC(2026, 5, 10)),
          endDate: new Date(Date.UTC(2026, 5, 12)),
        },
        { allowPastDates: true },
      ),
    );
    expect(codes(issues)).not.toContain("PAST");
  });

  it("NOTICE: старт раніше дедлайну сповіщення → попередження (не blocking)", () => {
    const issues = validateSubmission(
      baseCtx(
        {
          startDate: new Date(Date.UTC(2026, 5, 17)), // >= сьогодні, < сьогодні+5
          endDate: new Date(Date.UTC(2026, 5, 18)),
        },
        { minNoticeDays: 5 },
      ),
    );
    const notice = issues.find((i) => i.code === "NOTICE");
    expect(notice).toBeDefined();
    expect(notice!.blocking).toBe(false);
  });

  it("OVERLAP: непорожній overlaps → blocking", () => {
    const issues = validateSubmission(
      baseCtx({
        overlaps: [
          {
            number: "ЗВ-2026-000007",
            startDate: new Date(Date.UTC(2026, 5, 20)),
            endDate: new Date(Date.UTC(2026, 5, 22)),
          },
        ],
      }),
    );
    const overlap = issues.find((i) => i.code === "OVERLAP");
    expect(overlap).toBeDefined();
    expect(overlap!.blocking).toBe(true);
    expect(overlap!.message).toContain("ЗВ-2026-000007");
  });

  it("DOCUMENT: requiresDocument=true і порожній номер → не blocking", () => {
    const issues = validateSubmission(
      baseCtx({ documentNumber: "   " }, { requiresDocument: true }),
    );
    const doc = issues.find((i) => i.code === "DOCUMENT");
    expect(doc).toBeDefined();
    expect(doc!.blocking).toBe(false);
  });

  it("DOCUMENT: requiresDocument=true але номер вказано → немає DOCUMENT", () => {
    const issues = validateSubmission(
      baseCtx({ documentNumber: "Довідка №5" }, { requiresDocument: true }),
    );
    expect(codes(issues)).not.toContain("DOCUMENT");
  });

  it("BALANCE: days > available і allowNegativeBalance=false → blocking", () => {
    const issues = validateSubmission(
      baseCtx({ tracksBalance: true, days: 10, available: 3 }, { allowNegativeBalance: false }),
    );
    const balance = issues.find((i) => i.code === "BALANCE");
    expect(balance).toBeDefined();
    expect(balance!.blocking).toBe(true);
  });

  it("BALANCE: days > available але allowNegativeBalance=true → не blocking", () => {
    const issues = validateSubmission(
      baseCtx({ tracksBalance: true, days: 10, available: 3 }, { allowNegativeBalance: true }),
    );
    const balance = issues.find((i) => i.code === "BALANCE");
    expect(balance).toBeDefined();
    expect(balance!.blocking).toBe(false);
  });

  it("комбо: коли проблем немає → порожній масив", () => {
    expect(validateSubmission(baseCtx())).toEqual([]);
  });
});

// ========================= buildApprovalRoute ================================

describe("buildApprovalRoute", () => {
  it("MANAGER_THEN_HR з managerId і доступним HR → 2 кроки (MANAGER, HR)", async () => {
    vi.spyOn(prisma.user, "count").mockResolvedValue(2);
    const res = await buildApprovalRoute({
      employeeId: "emp-1",
      managerId: "mgr-1",
      departmentHeadId: null,
      route: "MANAGER_THEN_HR",
    });
    expect(res.autoApprove).toBe(false);
    expect(res.steps).toHaveLength(2);
    expect(res.steps[0]).toMatchObject({ step: 1, role: "MANAGER", approverId: "mgr-1" });
    expect(res.steps[1]).toMatchObject({ step: 2, role: "HR", approverId: null });
  });

  it("MANAGER_ONLY без managerId → autoApprove=true", async () => {
    const countSpy = vi.spyOn(prisma.user, "count").mockResolvedValue(5);
    const res = await buildApprovalRoute({
      employeeId: "emp-1",
      managerId: null,
      departmentHeadId: null,
      route: "MANAGER_ONLY",
    });
    expect(res.autoApprove).toBe(true);
    expect(res.steps).toHaveLength(0);
    // HR не запитуємо для MANAGER_ONLY.
    expect(countSpy).not.toHaveBeenCalled();
  });

  it("managerId === employeeId → крок менеджера пропускається", async () => {
    vi.spyOn(prisma.user, "count").mockResolvedValue(3);
    const res = await buildApprovalRoute({
      employeeId: "emp-1",
      managerId: "emp-1", // сам собі керівник
      departmentHeadId: null,
      route: "MANAGER_THEN_HR",
    });
    expect(res.autoApprove).toBe(false);
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0]).toMatchObject({ step: 1, role: "HR", approverId: null });
    expect(res.steps.some((s) => s.role === "MANAGER")).toBe(false);
  });

  it("departmentHeadId як запасний, коли managerId=null", async () => {
    const countSpy = vi.spyOn(prisma.user, "count").mockResolvedValue(0);
    const res = await buildApprovalRoute({
      employeeId: "emp-1",
      managerId: null,
      departmentHeadId: "head-1",
      route: "MANAGER_ONLY",
    });
    expect(res.autoApprove).toBe(false);
    expect(res.steps).toHaveLength(1);
    expect(res.steps[0]).toMatchObject({ step: 1, role: "MANAGER", approverId: "head-1" });
    expect(countSpy).not.toHaveBeenCalled();
  });

  it("HR_ONLY і немає вільного HR (count=0) → autoApprove=true", async () => {
    vi.spyOn(prisma.user, "count").mockResolvedValue(0);
    const res = await buildApprovalRoute({
      employeeId: "emp-1",
      managerId: null,
      departmentHeadId: null,
      route: "HR_ONLY",
    });
    expect(res.autoApprove).toBe(true);
    expect(res.steps).toHaveLength(0);
  });
});

// ========================= nextRequestNumber =================================

describe("nextRequestNumber", () => {
  it("немає попередніх заявок → перший номер ...000001", async () => {
    vi.spyOn(prisma.leaveRequest, "findFirst").mockResolvedValue(null as never);
    expect(await nextRequestNumber(2026)).toBe("ЗВ-2026-000001");
  });

  it("остання ЗВ-2026-000041 → наступна ...000042", async () => {
    vi.spyOn(prisma.leaveRequest, "findFirst").mockResolvedValue({
      number: "ЗВ-2026-000041",
    } as never);
    expect(await nextRequestNumber(2026)).toBe("ЗВ-2026-000042");
  });

  it("формат номера: ЗВ-{рік}-{6 цифр}", async () => {
    vi.spyOn(prisma.leaveRequest, "findFirst").mockResolvedValue(null as never);
    const n = await nextRequestNumber(2030);
    expect(n).toMatch(/^ЗВ-2030-\d{6}$/);
  });
});
