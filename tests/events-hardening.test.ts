import { describe, it, expect, vi, afterEach } from "vitest";
import { getPersonalEvents } from "@/server/services/events";
import { prisma } from "@/lib/prisma";
import { dateKey } from "@/lib/dates";

/**
 * Тести на посилення крайових випадків getPersonalEvents:
 *  1) 29 лютого у невисокосний рік → показ 28 лютого (обрізання, не 1 березня);
 *  2) діапазон, що охоплює цілий проміжний рік → події того року не губляться.
 */

type FakeEmp = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  position: { title: string } | null;
  department: { name: string } | null;
  birthDate: Date | null;
  hireDate: Date;
};

function emp(over: Partial<FakeEmp>): FakeEmp {
  return {
    id: "e1",
    firstName: "Іван",
    lastName: "Тест",
    avatarUrl: null,
    position: null,
    department: null,
    birthDate: null,
    hireDate: new Date(Date.UTC(2020, 0, 1)),
    ...over,
  };
}

function mockEmployees(list: FakeEmp[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(prisma.employee, "findMany").mockResolvedValue(list as any);
}

afterEach(() => vi.restoreAllMocks());

describe("getPersonalEvents — 29 лютого", () => {
  it("ДН 29 лютого показується 28 лютого у невисокосний рік (2026)", async () => {
    mockEmployees([emp({ birthDate: new Date(Date.UTC(2000, 1, 29)) })]);
    const events = await getPersonalEvents(
      new Date(Date.UTC(2026, 1, 1)),
      new Date(Date.UTC(2026, 1, 28)),
    );
    const bday = events.find((e) => e.kind === "birthday");
    expect(bday).toBeDefined();
    // Саме 28 лютого 2026, а не 1 березня.
    expect(dateKey(bday!.date)).toBe("2026-02-28");
  });

  it("ДН 29 лютого показується 29 лютого у високосний рік (2028)", async () => {
    mockEmployees([emp({ birthDate: new Date(Date.UTC(2000, 1, 29)) })]);
    const events = await getPersonalEvents(
      new Date(Date.UTC(2028, 1, 1)),
      new Date(Date.UTC(2028, 1, 29)),
    );
    const bday = events.find((e) => e.kind === "birthday");
    expect(bday).toBeDefined();
    expect(dateKey(bday!.date)).toBe("2028-02-29");
  });
});

describe("getPersonalEvents — діапазон через цілий рік", () => {
  it("подія проміжного року не губиться (2025-12-20 … 2027-01-10 містить 15.07.2026)", async () => {
    mockEmployees([emp({ birthDate: new Date(Date.UTC(1990, 6, 15)) })]);
    const events = await getPersonalEvents(
      new Date(Date.UTC(2025, 11, 20)),
      new Date(Date.UTC(2027, 0, 10)),
    );
    const keys = events.filter((e) => e.kind === "birthday").map((e) => dateKey(e.date));
    // Раніше (лише крайні роки) 2026 губився — тепер має бути.
    expect(keys).toContain("2026-07-15");
  });
});
