import { createHash, timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Машинний API для інтеграцій (Vaultwarden-провіжинінг тощо).
 *
 * GET /api/v1/employees
 *   Authorization: Bearer <API_TOKEN>
 *
 * Повертає всіх ПРАЦЮЮЧИХ співробітників (звільнені й архівні виключені):
 * ім'я, посада, відділ (команда), керівники, робочі контакти.
 * Платіжні дані навмисно НЕ віддаються.
 *
 * Токен задається змінною середовища API_TOKEN (Fly Secrets / .env).
 * Без токена в env — API вимкнено (503).
 */

/** Порівняння через хеші — стала довжина і сталий час (без ранніх виходів). */
function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const expected = process.env.API_TOKEN;
  if (!expected) {
    return Response.json(
      { error: "API вимкнено: змінна API_TOKEN не задана" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!provided || !tokenMatches(provided, expected)) {
    return Response.json({ error: "Невірний або відсутній токен" }, { status: 401 });
  }

  const employees = await prisma.employee.findMany({
    where: { isArchived: false, status: { not: "TERMINATED" } },
    select: {
      id: true,
      lastName: true,
      firstName: true,
      middleName: true,
      workEmail: true,
      phone: true,
      telegram: true,
      mattermost: true,
      status: true,
      hireDate: true,
      position: { select: { title: true } },
      department: { select: { name: true } },
      manager: { select: { id: true, lastName: true, firstName: true, workEmail: true } },
      coManagers: { select: { id: true, lastName: true, firstName: true, workEmail: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const data = employees.map((e) => {
    // Усі керівники: основний + додаткові, без дублів.
    const managers = [...(e.manager ? [e.manager] : []), ...e.coManagers]
      .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
      .map((m) => ({
        id: m.id,
        name: `${m.lastName} ${m.firstName}`.trim(),
        email: m.workEmail,
      }));

    return {
      id: e.id,
      name: `${e.lastName} ${e.firstName}`.trim(),
      lastName: e.lastName,
      firstName: e.firstName,
      middleName: e.middleName,
      email: e.workEmail,
      phone: e.phone,
      telegram: e.telegram,
      mattermost: e.mattermost,
      position: e.position?.title ?? null,
      team: e.department?.name ?? null,
      status: e.status,
      hireDate: e.hireDate.toISOString().slice(0, 10),
      managers,
    };
  });

  return Response.json(
    { count: data.length, employees: data },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
