import { describe, it, expect } from "vitest";
import {
  toDateOnly,
  dateKey,
  parseDateOnly,
  isWeekend,
  eachDayInRange,
  addDays,
  countWorkingDays,
  countCalendarDays,
  rangesOverlap,
  formatDateUk,
  formatDateLongUk,
  formatRangeUk,
  pluralUk,
  daysLabel,
  ageFrom,
  tenureUk,
} from "@/lib/dates";

/**
 * Усі дати створюємо через Date.UTC(...) для детермінізму (без впливу локального TZ).
 * Опорні дні тижня (перевірено): 2024-01-01 = понеділок, 05 = п'ятниця,
 * 06 = субота, 07 = неділя.
 */
const D = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(Date.UTC(y, m, d, h, min));

describe("toDateOnly", () => {
  it("обрізає час до опівночі UTC для Date", () => {
    const r = toDateOnly(D(2026, 2, 15, 23, 59));
    expect(r.getUTCHours()).toBe(0);
    expect(r.getUTCMinutes()).toBe(0);
    expect(r.getUTCSeconds()).toBe(0);
    expect(r.getUTCMilliseconds()).toBe(0);
    expect(dateKey(r)).toBe("2026-03-15");
  });

  it("не зсуває календарний день навіть о 23:59 UTC", () => {
    expect(dateKey(toDateOnly(D(2026, 2, 15, 23, 59)))).toBe("2026-03-15");
  });

  it("приймає рядок ISO та нормалізує до UTC-опівночі", () => {
    const r = toDateOnly("2026-03-15T12:30:00Z");
    expect(dateKey(r)).toBe("2026-03-15");
    expect(r.getUTCHours()).toBe(0);
  });

  it("приймає короткий рядок YYYY-MM-DD", () => {
    expect(dateKey(toDateOnly("2026-03-15"))).toBe("2026-03-15");
  });

  it("є ідемпотентною", () => {
    const once = toDateOnly(D(2026, 2, 15, 10));
    const twice = toDateOnly(once);
    expect(twice.getTime()).toBe(once.getTime());
  });
});

describe("dateKey", () => {
  it("повертає формат YYYY-MM-DD", () => {
    expect(dateKey(D(2026, 2, 15))).toBe("2026-03-15");
  });

  it("нулі у місяці/дні залишаються з провідними нулями", () => {
    expect(dateKey(D(2026, 0, 1))).toBe("2026-01-01");
    expect(dateKey(D(2026, 8, 9))).toBe("2026-09-09");
  });

  it("ігнорує час доби", () => {
    expect(dateKey(D(2026, 2, 15, 23, 59))).toBe("2026-03-15");
  });

  it("приймає рядок", () => {
    expect(dateKey("2026-12-31T05:00:00Z")).toBe("2026-12-31");
  });
});

describe("parseDateOnly", () => {
  it("створює UTC-опівніч із YYYY-MM-DD", () => {
    const d = parseDateOnly("2026-03-15");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(0);
  });

  it("узгоджений із dateKey (round-trip)", () => {
    expect(dateKey(parseDateOnly("2026-03-15"))).toBe("2026-03-15");
  });

  it("перший день місяця", () => {
    expect(dateKey(parseDateOnly("2026-01-01"))).toBe("2026-01-01");
  });
});

describe("isWeekend", () => {
  it("субота — вихідний", () => {
    expect(isWeekend(D(2024, 0, 6))).toBe(true);
  });
  it("неділя — вихідний", () => {
    expect(isWeekend(D(2024, 0, 7))).toBe(true);
  });
  it("понеділок — робочий", () => {
    expect(isWeekend(D(2024, 0, 1))).toBe(false);
  });
  it("п'ятниця — робочий", () => {
    expect(isWeekend(D(2024, 0, 5))).toBe(false);
  });
  it("час доби не впливає (субота о 23:59)", () => {
    expect(isWeekend(D(2024, 0, 6, 23, 59))).toBe(true);
  });
});

describe("addDays", () => {
  it("додає дні в межах місяця", () => {
    expect(dateKey(addDays(D(2026, 2, 15), 3))).toBe("2026-03-18");
  });
  it("переходить через межу місяця", () => {
    expect(dateKey(addDays(D(2026, 0, 31), 1))).toBe("2026-02-01");
  });
  it("переходить через межу року", () => {
    expect(dateKey(addDays(D(2025, 11, 31), 1))).toBe("2026-01-01");
  });
  it("від'ємна кількість — назад", () => {
    expect(dateKey(addDays(D(2026, 2, 1), -1))).toBe("2026-02-28");
  });
  it("нуль повертає той самий день (опівніч)", () => {
    expect(dateKey(addDays(D(2026, 2, 15, 10), 0))).toBe("2026-03-15");
    expect(addDays(D(2026, 2, 15, 10), 0).getUTCHours()).toBe(0);
  });
  it("враховує високосний рік (29 лютого 2024)", () => {
    expect(dateKey(addDays(D(2024, 1, 28), 1))).toBe("2024-02-29");
  });
});

describe("eachDayInRange", () => {
  it("повертає всі дні включно з межами", () => {
    const days = eachDayInRange(D(2024, 0, 1), D(2024, 0, 7));
    expect(days).toHaveLength(7);
    expect(dateKey(days[0])).toBe("2024-01-01");
    expect(dateKey(days[6])).toBe("2024-01-07");
  });
  it("один день — масив з одного елемента", () => {
    const days = eachDayInRange(D(2024, 0, 1), D(2024, 0, 1));
    expect(days).toHaveLength(1);
    expect(dateKey(days[0])).toBe("2024-01-01");
  });
  it("from > to — порожній масив", () => {
    expect(eachDayInRange(D(2024, 0, 7), D(2024, 0, 1))).toHaveLength(0);
  });
  it("кожен елемент нормалізований до опівночі UTC", () => {
    const days = eachDayInRange(D(2024, 0, 1, 15), D(2024, 0, 3, 20));
    expect(days).toHaveLength(3);
    for (const d of days) expect(d.getUTCHours()).toBe(0);
  });
  it("послідовні унікальні дні (без аліасингу)", () => {
    const keys = eachDayInRange(D(2024, 0, 1), D(2024, 0, 4)).map(dateKey);
    expect(keys).toEqual(["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04"]);
  });
});

describe("countCalendarDays", () => {
  it("тиждень включно = 7", () => {
    expect(countCalendarDays(D(2024, 0, 1), D(2024, 0, 7))).toBe(7);
  });
  it("один день = 1", () => {
    expect(countCalendarDays(D(2024, 0, 1), D(2024, 0, 1))).toBe(1);
  });
  it("from > to = 0", () => {
    expect(countCalendarDays(D(2024, 0, 7), D(2024, 0, 1))).toBe(0);
  });
});

describe("countWorkingDays", () => {
  it("пн–пт = 5", () => {
    expect(countWorkingDays(D(2024, 0, 1), D(2024, 0, 5))).toBe(5);
  });
  it("пн–нд = 5 (субота/неділя не рахуються)", () => {
    expect(countWorkingDays(D(2024, 0, 1), D(2024, 0, 7))).toBe(5);
  });
  it("один робочий день = 1", () => {
    expect(countWorkingDays(D(2024, 0, 1), D(2024, 0, 1))).toBe(1);
  });
  it("одна субота = 0", () => {
    expect(countWorkingDays(D(2024, 0, 6), D(2024, 0, 6))).toBe(0);
  });
  it("одна неділя = 0", () => {
    expect(countWorkingDays(D(2024, 0, 7), D(2024, 0, 7))).toBe(0);
  });
  it("самі вихідні (сб–нд) = 0", () => {
    expect(countWorkingDays(D(2024, 0, 6), D(2024, 0, 7))).toBe(0);
  });
  it("from > to = 0", () => {
    expect(countWorkingDays(D(2024, 0, 5), D(2024, 0, 1))).toBe(0);
  });
  it("два повні тижні (пн–пт наступного) = 10", () => {
    expect(countWorkingDays(D(2024, 0, 1), D(2024, 0, 12))).toBe(10);
  });
  it("святковий будній день віднімається", () => {
    const holidays = new Set(["2024-01-03"]); // середа
    expect(countWorkingDays(D(2024, 0, 1), D(2024, 0, 5), holidays)).toBe(4);
  });
  it("святковий день на вихідних не віднімається двічі", () => {
    const holidays = new Set(["2024-01-06"]); // субота
    expect(countWorkingDays(D(2024, 0, 1), D(2024, 0, 7), holidays)).toBe(5);
  });
  it("кілька святкових буднів", () => {
    const holidays = new Set(["2024-01-01", "2024-01-02"]);
    expect(countWorkingDays(D(2024, 0, 1), D(2024, 0, 5), holidays)).toBe(3);
  });
});

describe("rangesOverlap", () => {
  it("дотик країв (спільна межа) = перетин", () => {
    expect(rangesOverlap(D(2024, 0, 1), D(2024, 0, 2), D(2024, 0, 2), D(2024, 0, 3))).toBe(true);
  });
  it("вкладений інтервал = перетин", () => {
    expect(rangesOverlap(D(2024, 0, 1), D(2024, 0, 10), D(2024, 0, 3), D(2024, 0, 5))).toBe(true);
  });
  it("роз'єднані інтервали (проміжок) = без перетину", () => {
    expect(rangesOverlap(D(2024, 0, 1), D(2024, 0, 2), D(2024, 0, 4), D(2024, 0, 5))).toBe(false);
  });
  it("суміжні без спільного дня = без перетину", () => {
    expect(rangesOverlap(D(2024, 0, 1), D(2024, 0, 2), D(2024, 0, 3), D(2024, 0, 4))).toBe(false);
  });
  it("ідентичні інтервали = перетин", () => {
    expect(rangesOverlap(D(2024, 0, 1), D(2024, 0, 5), D(2024, 0, 1), D(2024, 0, 5))).toBe(true);
  });
  it("частковий перетин = перетин", () => {
    expect(rangesOverlap(D(2024, 0, 1), D(2024, 0, 4), D(2024, 0, 3), D(2024, 0, 6))).toBe(true);
  });
  it("порядок аргументів не має значення (b раніше a)", () => {
    expect(rangesOverlap(D(2024, 0, 4), D(2024, 0, 5), D(2024, 0, 1), D(2024, 0, 2))).toBe(false);
  });
  it("ігнорує час доби на межах", () => {
    expect(rangesOverlap(D(2024, 0, 1, 20), D(2024, 0, 2, 8), D(2024, 0, 2, 22), D(2024, 0, 3))).toBe(true);
  });
});

describe("pluralUk (українські правила відмінювання)", () => {
  const f: [string, string, string] = ["день", "дні", "днів"];

  it("1 → форма1", () => expect(pluralUk(1, f)).toBe("день"));
  it("2 → форма2", () => expect(pluralUk(2, f)).toBe("дні"));
  it("3 → форма2", () => expect(pluralUk(3, f)).toBe("дні"));
  it("4 → форма2", () => expect(pluralUk(4, f)).toBe("дні"));
  it("5 → форма3", () => expect(pluralUk(5, f)).toBe("днів"));
  it("0 → форма3", () => expect(pluralUk(0, f)).toBe("днів"));
  it("11 → форма3 (виняток 11-19)", () => expect(pluralUk(11, f)).toBe("днів"));
  it("12 → форма3", () => expect(pluralUk(12, f)).toBe("днів"));
  it("14 → форма3", () => expect(pluralUk(14, f)).toBe("днів"));
  it("15 → форма3", () => expect(pluralUk(15, f)).toBe("днів"));
  it("19 → форма3", () => expect(pluralUk(19, f)).toBe("днів"));
  it("20 → форма3", () => expect(pluralUk(20, f)).toBe("днів"));
  it("21 → форма1", () => expect(pluralUk(21, f)).toBe("день"));
  it("22 → форма2", () => expect(pluralUk(22, f)).toBe("дні"));
  it("24 → форма2", () => expect(pluralUk(24, f)).toBe("дні"));
  it("25 → форма3", () => expect(pluralUk(25, f)).toBe("днів"));
  it("100 → форма3", () => expect(pluralUk(100, f)).toBe("днів"));
  it("101 → форма1", () => expect(pluralUk(101, f)).toBe("день"));
  it("111 → форма3", () => expect(pluralUk(111, f)).toBe("днів"));
  it("122 → форма2", () => expect(pluralUk(122, f)).toBe("дні"));
  it("від'ємні беруться за модулем: -1 → форма1", () => expect(pluralUk(-1, f)).toBe("день"));
  it("від'ємні: -2 → форма2", () => expect(pluralUk(-2, f)).toBe("дні"));
  it("від'ємні: -21 → форма1", () => expect(pluralUk(-21, f)).toBe("день"));
});

describe("daysLabel", () => {
  it("1 день", () => expect(daysLabel(1)).toBe("1 день"));
  it("2 дні", () => expect(daysLabel(2)).toBe("2 дні"));
  it("3 дні", () => expect(daysLabel(3)).toBe("3 дні"));
  it("5 днів", () => expect(daysLabel(5)).toBe("5 днів"));
  it("0 днів", () => expect(daysLabel(0)).toBe("0 днів"));
  it("11 днів", () => expect(daysLabel(11)).toBe("11 днів"));
  it("21 день", () => expect(daysLabel(21)).toBe("21 день"));
});

describe("formatDateUk", () => {
  it("форматує д MMM рррр українською", () => {
    expect(formatDateUk(D(2026, 2, 15))).toBe("15 берез. 2026");
  });
  it("приймає рядок і нормалізує день", () => {
    expect(formatDateUk("2026-03-15T20:00:00Z")).toBe("15 берез. 2026");
  });
});

describe("formatDateLongUk", () => {
  it("форматує д MMMM рррр повною назвою місяця", () => {
    expect(formatDateLongUk(D(2026, 2, 15))).toBe("15 березня 2026");
  });
});

describe("formatRangeUk", () => {
  it("однаковий день → одна дата", () => {
    expect(formatRangeUk(D(2026, 2, 15), D(2026, 2, 15))).toBe("15 берез. 2026");
  });
  it("той самий місяць і рік → «15 – 22 берез. 2026»", () => {
    expect(formatRangeUk(D(2026, 2, 15), D(2026, 2, 22))).toBe("15 – 22 берез. 2026");
  });
  it("різні місяці того ж року → «28 берез. – 3 квіт. 2026»", () => {
    expect(formatRangeUk(D(2026, 2, 28), D(2026, 3, 3))).toBe("28 берез. – 3 квіт. 2026");
  });
  it("різні роки → повні дати з обох боків", () => {
    expect(formatRangeUk(D(2025, 11, 28), D(2026, 0, 3))).toBe("28 груд. 2025 – 3 січ. 2026");
  });
  it("приймає рядки", () => {
    expect(formatRangeUk("2026-03-15", "2026-03-22")).toBe("15 – 22 берез. 2026");
  });
});

describe("ageFrom", () => {
  // Дати будуємо відносно «сьогодні», щоб тест був детермінованим у будь-який день запуску.
  const now = toDateOnly(new Date());
  const bornYearsAgo = (y: number) =>
    new Date(Date.UTC(now.getUTCFullYear() - y, now.getUTCMonth(), now.getUTCDate()));

  it("день народження сьогодні, 30 років тому → 30", () => {
    expect(ageFrom(bornYearsAgo(30))).toBe(30);
  });
  it("день народження вчора (вже було цьогоріч) → повні роки", () => {
    expect(ageFrom(addDays(bornYearsAgo(30), -1))).toBe(30);
  });
  it("день народження завтра (ще не було) → на 1 менше", () => {
    expect(ageFrom(addDays(bornYearsAgo(30), 1))).toBe(29);
  });
  it("народжений сьогодні → 0", () => {
    expect(ageFrom(now)).toBe(0);
  });
  it("приймає рядок", () => {
    expect(ageFrom(dateKey(bornYearsAgo(25)))).toBe(25);
  });
});

describe("tenureUk", () => {
  it("3 роки 3 місяці", () => {
    expect(tenureUk(D(2023, 0, 15), D(2026, 3, 15))).toBe("3 роки 3 місяці");
  });
  it("1 рік 1 місяць", () => {
    expect(tenureUk(D(2025, 0, 10), D(2026, 1, 10))).toBe("1 рік 1 місяць");
  });
  it("рівно 2 роки (без місяців)", () => {
    expect(tenureUk(D(2024, 0, 15), D(2026, 0, 15))).toBe("2 роки");
  });
  it("5 років", () => {
    expect(tenureUk(D(2021, 0, 1), D(2026, 0, 1))).toBe("5 років");
  });
  it("лише місяці: 11 місяців", () => {
    expect(tenureUk(D(2025, 0, 1), D(2025, 11, 1))).toBe("11 місяців");
  });
  it("1 місяць", () => {
    expect(tenureUk(D(2026, 0, 10), D(2026, 1, 10))).toBe("1 місяць");
  });
  it("4 місяці", () => {
    expect(tenureUk(D(2026, 0, 1), D(2026, 4, 1))).toBe("4 місяці");
  });
  it("менше місяця (менше 30 днів)", () => {
    expect(tenureUk(D(2026, 0, 1), D(2026, 0, 20))).toBe("менше місяця");
  });
  it("день ще не настав → місяць не зараховується", () => {
    expect(tenureUk(D(2026, 0, 20), D(2026, 1, 10))).toBe("менше місяця");
  });
  it("until раніше hired → менше місяця (без від'ємних)", () => {
    expect(tenureUk(D(2026, 5, 1), D(2026, 0, 1))).toBe("менше місяця");
  });
  it("майбутня дата найму з дефолтним until (new Date) → менше місяця", () => {
    expect(tenureUk(D(2099, 0, 1))).toBe("менше місяця");
  });
  it("приймає рядки", () => {
    expect(tenureUk("2024-01-15", "2026-01-15")).toBe("2 роки");
  });
});
