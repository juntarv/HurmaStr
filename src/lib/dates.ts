import { format } from "date-fns";
import { uk } from "date-fns/locale";

/**
 * Дати відпусток — це «календарні дати», а не моменти часу.
 * Щоб не ловити зсуви через часові пояси, всі дати нормалізуємо
 * до опівночі UTC і порівнюємо тільки за календарним днем.
 */
export function toDateOnly(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Ключ дати у форматі YYYY-MM-DD — зручно для Set/Map і порівнянь. */
export function dateKey(value: Date | string): string {
  return toDateOnly(value).toISOString().slice(0, 10);
}

/** Створює дату з рядка YYYY-MM-DD (як опівніч UTC). */
export function parseDateOnly(input: string): Date {
  const [y, m, d] = input.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isWeekend(value: Date): boolean {
  const day = toDateOnly(value).getUTCDay();
  return day === 0 || day === 6; // неділя або субота
}

/** Усі календарні дні в діапазоні включно. */
export function eachDayInRange(from: Date, to: Date): Date[] {
  const start = toDateOnly(from);
  const end = toDateOnly(to);
  const days: Date[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

export function addDays(value: Date, amount: number): Date {
  const d = toDateOnly(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + amount));
}

/**
 * Кількість РОБОЧИХ днів у діапазоні: без субот, неділь і святкових днів.
 * holidays — набір ключів YYYY-MM-DD (див. dateKey).
 */
export function countWorkingDays(from: Date, to: Date, holidays: Set<string> = new Set()): number {
  return eachDayInRange(from, to).filter(
    (day) => !isWeekend(day) && !holidays.has(dateKey(day)),
  ).length;
}

/** Кількість календарних днів у діапазоні включно. */
export function countCalendarDays(from: Date, to: Date): number {
  return eachDayInRange(from, to).length;
}

/** Чи перетинаються два діапазони дат (включно з межами). */
export function rangesOverlap(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return toDateOnly(aFrom) <= toDateOnly(bTo) && toDateOnly(bFrom) <= toDateOnly(aTo);
}

/** 15 берез. 2026 */
export function formatDateUk(value: Date | string): string {
  return format(toDateOnly(value), "d MMM yyyy", { locale: uk });
}

/** 15 березня 2026 */
export function formatDateLongUk(value: Date | string): string {
  return format(toDateOnly(value), "d MMMM yyyy", { locale: uk });
}

/** Період: «15 – 22 берез. 2026» або «28 берез. – 3 квіт. 2026» */
export function formatRangeUk(from: Date | string, to: Date | string): string {
  const a = toDateOnly(from);
  const b = toDateOnly(to);
  if (dateKey(a) === dateKey(b)) return formatDateUk(a);
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    if (a.getUTCMonth() === b.getUTCMonth()) {
      return `${format(a, "d", { locale: uk })} – ${formatDateUk(b)}`;
    }
    return `${format(a, "d MMM", { locale: uk })} – ${formatDateUk(b)}`;
  }
  return `${formatDateUk(a)} – ${formatDateUk(b)}`;
}

/**
 * Українське відмінювання: 1 день, 2 дні, 5 днів.
 * forms = [однина, 2-4, 5+]
 */
export function pluralUk(count: number, forms: [string, string, string]): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

/** «5 днів», «1 день», «3 дні» */
export function daysLabel(count: number): string {
  return `${count} ${pluralUk(count, ["день", "дні", "днів"])}`;
}

/** Вік у повних роках. */
export function ageFrom(birthDate: Date | string): number {
  const b = toDateOnly(birthDate);
  const now = toDateOnly(new Date());
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - b.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** Стаж у компанії, українською: «2 роки 3 місяці». */
export function tenureUk(hiredAt: Date | string, until: Date | string = new Date()): string {
  const from = toDateOnly(hiredAt);
  const to = toDateOnly(until);
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months--;
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralUk(years, ["рік", "роки", "років"])}`);
  if (restMonths > 0) parts.push(`${restMonths} ${pluralUk(restMonths, ["місяць", "місяці", "місяців"])}`);
  if (parts.length === 0) return "менше місяця";
  return parts.join(" ");
}
