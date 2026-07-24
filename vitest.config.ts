import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Юніт-тести бізнес-логіки.
 *
 * DATABASE_URL / AUTH_SECRET задаємо на фіктивні значення, щоб модулі,
 * які транзитивно імпортують @/lib/prisma чи @/lib/auth, вантажились без
 * помилок. Чисті функції тестуються напряму; запити до Prisma мокаються
 * у самих тестах (vi.spyOn(prisma.x, "method")).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "file:./.vitest.db",
      AUTH_SECRET: "vitest-secret-0123456789-abcdef",
      COOKIE_SECURE: "false",
    },
  },
});
