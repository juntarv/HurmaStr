import { describe, it, expect } from "vitest";
import { monthsAccrued } from "@/server/services/balance";
import { pluralUk } from "@/lib/dates";

// Смоук: підтверджує, що модулі з транзитивним імпортом @/lib/prisma
// вантажаться в тест-оточенні, і чисті функції рахують коректно.
describe("smoke", () => {
  it("monthsAccrued рахує повні місяці", () => {
    const hire = new Date(Date.UTC(2025, 0, 15));
    const asOf = new Date(Date.UTC(2025, 11, 15));
    expect(monthsAccrued(hire, asOf)).toBe(11);
  });

  it("pluralUk відмінює", () => {
    expect(pluralUk(1, ["день", "дні", "днів"])).toBe("день");
    expect(pluralUk(3, ["день", "дні", "днів"])).toBe("дні");
    expect(pluralUk(5, ["день", "дні", "днів"])).toBe("днів");
  });
});
