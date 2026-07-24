import { prisma } from "@/lib/prisma";
import { addDays, dateKey, eachDayInRange, toDateOnly } from "@/lib/dates";

/**
 * Події компанії: дні народження, річниці роботи та відсутності.
 * Живлять і панель, і календар.
 *
 * Дні народження й річниці не зберігаються окремо — вони обчислюються
 * з birthDate / hireDate. Тому нове свято ніколи не «загубиться»:
 * достатньо, щоб у картці була дата.
 */

export type EmployeeBrief = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  positionTitle: string | null;
  departmentName: string | null;
};

export type BirthdayEvent = {
  kind: "birthday";
  date: Date;
  employee: EmployeeBrief;
};

export type AnniversaryEvent = {
  kind: "anniversary";
  date: Date;
  years: number;
  employee: EmployeeBrief;
};

export type LeaveEvent = {
  kind: "leave";
  startDate: Date;
  endDate: Date;
  daysCount: number;
  employee: EmployeeBrief;
  leaveType: { id: string; nameUk: string; icon: string; colorHex: string; isMedical: boolean };
};

export type PersonalEvent = BirthdayEvent | AnniversaryEvent;

const employeeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  position: { select: { title: true } },
  department: { select: { name: true } },
} as const;

type RawEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  position: { title: string } | null;
  department: { name: string } | null;
};

function toBrief(e: RawEmployee): EmployeeBrief {
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    avatarUrl: e.avatarUrl,
    positionTitle: e.position?.title ?? null,
    departmentName: e.department?.name ?? null,
  };
}

/**
 * Переносить день/місяць дати у вказаний рік.
 * Якщо в цільовому місяці немає такого числа (напр. 29 лютого у невисокосний
 * рік), обрізаємо до останнього дня місяця — щоб подія не «перекотилась»
 * на 1 березня, а показалась 28 лютого.
 */
function inYear(source: Date, year: number): Date {
  const d = toDateOnly(source);
  const month = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Дні народження і річниці роботи в діапазоні дат.
 * Річниця рахується від дати найму: 1 рік, 2 роки, 3 роки і далі.
 */
export async function getPersonalEvents(from: Date, to: Date): Promise<PersonalEvent[]> {
  const start = toDateOnly(from);
  const end = toDateOnly(to);

  const employees = await prisma.employee.findMany({
    where: { isArchived: false, status: { not: "TERMINATED" } },
    select: { ...employeeSelect, birthDate: true, hireDate: true },
  });

  // Діапазон може перетинати межі років — перебираємо всі роки від початку
  // до кінця (а не лише крайні), щоб не пропустити проміжний рік.
  const years: number[] = [];
  for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) years.push(y);
  const events: PersonalEvent[] = [];

  for (const employee of employees) {
    const brief = toBrief(employee);

    for (const year of years) {
      if (employee.birthDate) {
        const date = inYear(employee.birthDate, year);
        if (date >= start && date <= end) {
          events.push({ kind: "birthday", date, employee: brief });
        }
      }

      const date = inYear(employee.hireDate, year);
      const years_ = year - toDateOnly(employee.hireDate).getUTCFullYear();
      // Сам день найму — це не річниця, показуємо від першого року.
      if (years_ >= 1 && date >= start && date <= end) {
        events.push({ kind: "anniversary", date, years: years_, employee: brief });
      }
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Погоджені відсутності, що перетинаються з діапазоном. */
export async function getLeaveEvents(from: Date, to: Date): Promise<LeaveEvent[]> {
  const start = toDateOnly(from);
  const end = toDateOnly(to);

  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: {
      startDate: true,
      endDate: true,
      daysCount: true,
      employee: { select: employeeSelect },
      leaveType: {
        select: { id: true, nameUk: true, icon: true, colorHex: true, isMedical: true },
      },
    },
    orderBy: { startDate: "asc" },
  });

  return requests.map((r) => ({
    kind: "leave" as const,
    startDate: r.startDate,
    endDate: r.endDate,
    daysCount: r.daysCount,
    employee: toBrief(r.employee),
    leaveType: r.leaveType,
  }));
}

/** Хто сьогодні відсутній (у відпустці, на лікарняному тощо). */
export async function getAbsencesOn(date: Date = new Date()): Promise<LeaveEvent[]> {
  const day = toDateOnly(date);
  return getLeaveEvents(day, day);
}

/** Найближчі особисті події — для блоку «Важливі дати» на панелі. */
export async function getUpcomingPersonalEvents(daysAhead = 14): Promise<PersonalEvent[]> {
  const today = toDateOnly(new Date());
  return getPersonalEvents(today, addDays(today, daysAhead));
}

/**
 * Розкладає відсутності по днях місяця — зручно для сітки календаря.
 * Ключ — YYYY-MM-DD.
 */
export function spreadLeavesByDay(
  leaves: LeaveEvent[],
  from: Date,
  to: Date,
): Map<string, LeaveEvent[]> {
  const map = new Map<string, LeaveEvent[]>();
  const start = toDateOnly(from);
  const end = toDateOnly(to);

  for (const leave of leaves) {
    const segFrom = leave.startDate > start ? toDateOnly(leave.startDate) : start;
    const segTo = leave.endDate < end ? toDateOnly(leave.endDate) : end;
    for (const day of eachDayInRange(segFrom, segTo)) {
      const key = dateKey(day);
      const list = map.get(key) ?? [];
      list.push(leave);
      map.set(key, list);
    }
  }
  return map;
}

/** Групує особисті події по днях. Ключ — YYYY-MM-DD. */
export function groupEventsByDay(events: PersonalEvent[]): Map<string, PersonalEvent[]> {
  const map = new Map<string, PersonalEvent[]>();
  for (const event of events) {
    const key = dateKey(event.date);
    const list = map.get(key) ?? [];
    list.push(event);
    map.set(key, list);
  }
  return map;
}
