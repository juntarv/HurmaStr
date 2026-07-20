import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * Prisma 7 працює через driver adapter — без нього клієнт не ініціалізується.
 * DATABASE_URL ("file:./dev.db") резолвиться відносно кореня проєкту.
 *
 * timeout — це busy_timeout SQLite: під WAL паралельні транзакції
 * (наприклад, два одночасні погодження) інакше падають із SQLITE_BUSY.
 *
 * better-sqlite3 вмикає PRAGMA foreign_keys за замовчуванням — перевірено
 * тестом на onDelete: Restrict (див. scripts/check-db-integrity.ts).
 */
function createPrismaClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL!,
    timeout: 5000,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

// У dev режимі Next.js перезавантажує модулі — тримаємо один інстанс на глобалі,
// щоб не плодити з'єднання з базою.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
