import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Спільне для машинного API /api/v1/*:
 * Bearer-токен з env API_TOKEN, стале за часом порівняння, спільні заголовки.
 */

/** Порівняння через хеші — стала довжина і сталий час (без ранніх виходів). */
function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Перевіряє Bearer-токен. Повертає Response з помилкою або null, якщо все ок. */
export function requireApiToken(request: NextRequest): Response | null {
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
  return null;
}

export const API_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

/** Умова «працює зараз» — звільнені й архівні в API не існують. */
export const WORKING = { isArchived: false, status: { not: "TERMINATED" as const } };

type PersonRef = {
  id: string;
  lastName: string;
  firstName: string;
  workEmail: string | null;
};

export function mapPersonRef(m: PersonRef) {
  return {
    id: m.id,
    name: `${m.lastName} ${m.firstName}`.trim(),
    email: m.workEmail,
  };
}

/** Базовий select співробітника для API-відповідей. */
export const employeeApiSelect = {
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
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, lastName: true, firstName: true, workEmail: true } },
  coManagers: { select: { id: true, lastName: true, firstName: true, workEmail: true } },
} as const;

type EmployeeApiRow = PersonRef & {
  middleName: string | null;
  phone: string | null;
  telegram: string | null;
  mattermost: string | null;
  status: string;
  hireDate: Date;
  position: { title: string } | null;
  department: { id: string; name: string } | null;
  manager: PersonRef | null;
  coManagers: PersonRef[];
};

export function mapEmployee(e: EmployeeApiRow) {
  // Усі керівники: основний + додаткові, без дублів.
  const managers = [...(e.manager ? [e.manager] : []), ...e.coManagers]
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
    .map(mapPersonRef);

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
    teamId: e.department?.id ?? null,
    status: e.status,
    hireDate: e.hireDate.toISOString().slice(0, 10),
    managers,
  };
}
