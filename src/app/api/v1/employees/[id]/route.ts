import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  API_HEADERS,
  employeeApiSelect,
  mapEmployee,
  mapPersonRef,
  requireApiToken,
} from "@/lib/api-v1";

/**
 * GET /api/v1/employees/{id} — детальна інфа про одного співробітника.
 *   Authorization: Bearer <API_TOKEN>
 *
 * Понад список: місто, тип зайнятості, випробувальний, відділ з id,
 * прямі підлеглі (основні + додаткові). Звільнені/архівні — 404
 * (для API їх не існує). Платіжні дані не віддаються.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = requireApiToken(request);
  if (denied) return denied;

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      ...employeeApiSelect,
      city: true,
      employmentType: true,
      probationEndDate: true,
      isArchived: true,
      subordinates: {
        where: { isArchived: false, status: { not: "TERMINATED" } },
        select: { id: true, lastName: true, firstName: true, workEmail: true },
        orderBy: [{ lastName: "asc" }],
      },
      coManaging: {
        where: { isArchived: false, status: { not: "TERMINATED" } },
        select: { id: true, lastName: true, firstName: true, workEmail: true },
        orderBy: [{ lastName: "asc" }],
      },
    },
  });

  // Для машинного API звільнених і архівних не існує.
  if (!employee || employee.isArchived || employee.status === "TERMINATED") {
    return Response.json({ error: "Співробітника не знайдено" }, { status: 404 });
  }

  // Усі прямі підлеглі: основні + через co-менеджерство, без дублів.
  const reports = [...employee.subordinates, ...employee.coManaging]
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
    .map(mapPersonRef);

  return Response.json(
    {
      employee: {
        ...mapEmployee(employee),
        city: employee.city,
        employmentType: employee.employmentType,
        probationEndDate: employee.probationEndDate
          ? employee.probationEndDate.toISOString().slice(0, 10)
          : null,
        reports,
      },
    },
    { headers: API_HEADERS },
  );
}
