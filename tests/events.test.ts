import { describe, it, expect, vi, afterEach } from "vitest";
import {
  spreadLeavesByDay,
  groupEventsByDay,
  getPersonalEvents,
  type LeaveEvent,
  type PersonalEvent,
  type EmployeeBrief,
} from "@/server/services/events";
import { prisma } from "@/lib/prisma";

/**
 * Юніт-тести чистих хелперів events.ts + getPersonalEvents з моком prisma.
 * Усі дати будуємо як опівніч UTC (як робить toDateOnly у сорсі).
 */

// Опівніч UTC; місяць 1-based для читабельності.
const d = (y: number, m: number, day: number): Date => new Date(Date.UTC(y, m - 1, day));

function brief(id: string): EmployeeBrief {
  return {
    id,
    firstName: "Ім'я",
    lastName: "Прізвище",
    avatarUrl: null,
    positionTitle: null,
    departmentName: null,
  };
}

// LeaveEvent будуємо вручну — spreadLeavesByDay читає лише startDate/endDate,
// решта полів потрібні лише для типу.
function makeLeave(id: string, startDate: Date, endDate: Date): LeaveEvent {
  return {
    kind: "leave",
    startDate,
    endDate,
    daysCount: 1,
    employee: brief(id),
    leaveType: {
      id: "lt-1",
      nameUk: "Відпустка",
      icon: "🌴",
      colorHex: "#38bdf8",
      isMedical: false,
    },
  };
}

// Форма, яку реально селектить getPersonalEvents (employeeSelect + birthDate/hireDate).
type RawEmp = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  position: { title: string } | null;
  department: { name: string } | null;
  birthDate: Date | null;
  hireDate: Date;
};

function rawEmployee(over: Partial<RawEmp> & { id: string; hireDate: Date }): RawEmp {
  return {
    firstName: "Тест",
    lastName: "Юзер",
    avatarUrl: null,
    position: { title: "Розробник" },
    department: { name: "IT" },
    birthDate: null,
    ...over,
  };
}

function mockEmployees(list: RawEmp[]) {
  return vi.spyOn(prisma.employee, "findMany").mockResolvedValue(list as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("spreadLeavesByDay", () => {
  it("розкладає багатоденну відсутність на кожен день", () => {
    const leave = makeLeave("e1", d(2026, 3, 10), d(2026, 3, 12));
    const map = spreadLeavesByDay([leave], d(2026, 3, 1), d(2026, 3, 31));

    expect([...map.keys()].sort()).toEqual(["2026-03-10", "2026-03-11", "2026-03-12"]);
    expect(map.get("2026-03-10")).toEqual([leave]);
    expect(map.get("2026-03-11")).toEqual([leave]);
    expect(map.get("2026-03-12")).toEqual([leave]);
  });

  it("обрізає відсутність до діапазону [from, to] з обох боків", () => {
    // Відсутність виходить за межі і зліва, і справа.
    const leave = makeLeave("e1", d(2026, 2, 25), d(2026, 4, 10));
    const map = spreadLeavesByDay([leave], d(2026, 3, 1), d(2026, 3, 5));

    expect([...map.keys()].sort()).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
    // Жодного дня за межами діапазону.
    expect(map.has("2026-02-25")).toBe(false);
    expect(map.has("2026-04-10")).toBe(false);
  });

  it("додає кілька відсутностей за один день у спільний список", () => {
    const a = makeLeave("e1", d(2026, 3, 10), d(2026, 3, 10));
    const b = makeLeave("e2", d(2026, 3, 10), d(2026, 3, 11));
    const map = spreadLeavesByDay([a, b], d(2026, 3, 1), d(2026, 3, 31));

    expect(map.get("2026-03-10")).toEqual([a, b]);
    expect(map.get("2026-03-11")).toEqual([b]);
  });
});

describe("groupEventsByDay", () => {
  it("групує події за днем; кілька в один день → список", () => {
    const bday: PersonalEvent = { kind: "birthday", date: d(2026, 3, 15), employee: brief("e1") };
    const anniv: PersonalEvent = {
      kind: "anniversary",
      date: d(2026, 3, 15),
      years: 3,
      employee: brief("e2"),
    };
    const other: PersonalEvent = { kind: "birthday", date: d(2026, 3, 20), employee: brief("e3") };

    const map = groupEventsByDay([bday, anniv, other]);

    expect(map.size).toBe(2);
    expect(map.get("2026-03-15")).toEqual([bday, anniv]);
    expect(map.get("2026-03-20")).toEqual([other]);
  });
});

describe("getPersonalEvents", () => {
  it("день народження потрапляє в діапазон з перенесенням дня/місяця в рік діапазону", async () => {
    mockEmployees([
      rawEmployee({
        id: "A",
        birthDate: d(1990, 3, 15),
        hireDate: d(2019, 7, 1), // липень — поза березневим діапазоном, щоб не додати річницю
      }),
    ]);

    const events = await getPersonalEvents(d(2026, 3, 1), d(2026, 3, 31));

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("birthday");
    expect(events[0].date.getTime()).toBe(d(2026, 3, 15).getTime());
    expect(events[0].employee.id).toBe("A");
  });

  it("річниця найму рівно N років тому дає anniversary з years=N", async () => {
    mockEmployees([
      rawEmployee({
        id: "B",
        birthDate: null,
        hireDate: d(2021, 6, 10), // 5 років до 2026
      }),
    ]);

    const events = await getPersonalEvents(d(2026, 6, 1), d(2026, 6, 30));

    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.kind).toBe("anniversary");
    if (ev.kind === "anniversary") {
      expect(ev.years).toBe(5);
      expect(ev.date.getTime()).toBe(d(2026, 6, 10).getTime());
    }
  });

  it("сам рік найму (years=0) не показується", async () => {
    mockEmployees([
      rawEmployee({
        id: "C",
        birthDate: null,
        hireDate: d(2026, 6, 10), // найнятий цього ж року
      }),
    ]);

    const events = await getPersonalEvents(d(2026, 6, 1), d(2026, 6, 30));

    expect(events).toEqual([]);
  });

  it("перетин Нового року враховує обидва роки діапазону", async () => {
    mockEmployees([
      // День народження 25 грудня — має розвʼязатися через рік СТАРТУ (2025).
      rawEmployee({ id: "DEC", birthDate: d(1990, 12, 25), hireDate: d(2020, 7, 1) }),
      // День народження 5 січня — має розвʼязатися через рік КІНЦЯ (2026).
      rawEmployee({ id: "JAN", birthDate: d(1995, 1, 5), hireDate: d(2019, 7, 1) }),
    ]);

    const events = await getPersonalEvents(d(2025, 12, 20), d(2026, 1, 10));

    expect(events).toHaveLength(2);
    // Відсортовано за датою за зростанням.
    expect(events[0].employee.id).toBe("DEC");
    expect(events[0].date.getTime()).toBe(d(2025, 12, 25).getTime());
    expect(events[1].employee.id).toBe("JAN");
    expect(events[1].date.getTime()).toBe(d(2026, 1, 5).getTime());
  });
});
