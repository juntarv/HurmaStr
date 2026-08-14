import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  API_HEADERS,
  employeeApiSelect,
  mapEmployee,
  requireApiToken,
  WORKING,
} from "@/lib/api-v1";

/**
 * GET /api/v1/employees — усі працюючі співробітники.
 *   Authorization: Bearer <API_TOKEN>
 *
 * Фільтри (усі опційні, комбінуються):
 *   ?q=<пошук>        — по ПІБ/пошті/телефону/ніках (searchKey)
 *   ?team=<id|назва>  — відділ (id або точна назва)
 *   ?manager=<id>     — прямі підлеглі цього керівника (основний або додатковий)
 *
 * Звільнені й архівні виключені завжди. Платіжні дані не віддаються.
 */
export async function GET(request: NextRequest) {
  const denied = requireApiToken(request);
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const q = sp.get("q")?.trim().toLowerCase();
  const team = sp.get("team")?.trim();
  const managerId = sp.get("manager")?.trim();

  const employees = await prisma.employee.findMany({
    where: {
      ...WORKING,
      ...(q ? { searchKey: { contains: q } } : {}),
      ...(team ? { department: { OR: [{ id: team }, { name: team }] } } : {}),
      ...(managerId
        ? { OR: [{ managerId }, { coManagers: { some: { id: managerId } } }] }
        : {}),
    },
    select: employeeApiSelect,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const data = employees.map(mapEmployee);
  return Response.json({ count: data.length, employees: data }, { headers: API_HEADERS });
}
