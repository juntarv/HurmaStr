import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  API_HEADERS,
  employeeApiSelect,
  mapEmployee,
  mapPersonRef,
  requireApiToken,
  WORKING,
} from "@/lib/api-v1";

/**
 * GET /api/v1/managers — усі керівники з їхніми підлеглими.
 *   Authorization: Bearer <API_TOKEN>
 *
 * Керівник = обіймає керівну посаду (isManagerial) АБО фактично має
 * підлеглих чи очолює відділ. Для кожного — reports: прямі підлеглі
 * (основні + додаткові, без дублів) і головування у відділах.
 */
export async function GET(request: NextRequest) {
  const denied = requireApiToken(request);
  if (denied) return denied;

  const managers = await prisma.employee.findMany({
    where: {
      ...WORKING,
      OR: [
        { position: { isManagerial: true } },
        { subordinates: { some: WORKING } },
        { coManaging: { some: WORKING } },
        { headedDepartments: { some: { isArchived: false } } },
      ],
    },
    select: {
      ...employeeApiSelect,
      subordinates: {
        where: WORKING,
        select: { id: true, lastName: true, firstName: true, workEmail: true },
        orderBy: [{ lastName: "asc" }],
      },
      coManaging: {
        where: WORKING,
        select: { id: true, lastName: true, firstName: true, workEmail: true },
        orderBy: [{ lastName: "asc" }],
      },
      headedDepartments: {
        where: { isArchived: false },
        select: { id: true, name: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const data = managers.map((m) => {
    const reports = [...m.subordinates, ...m.coManaging]
      .filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i)
      .map(mapPersonRef);
    return {
      ...mapEmployee(m),
      headsTeams: m.headedDepartments.map((d) => ({ id: d.id, name: d.name })),
      reportsCount: reports.length,
      reports,
    };
  });

  return Response.json({ count: data.length, managers: data }, { headers: API_HEADERS });
}
