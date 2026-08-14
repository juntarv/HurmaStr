import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { API_HEADERS, mapPersonRef, requireApiToken, WORKING } from "@/lib/api-v1";

/**
 * GET /api/v1/teams — команди (відділи) з керівником і складом.
 *   Authorization: Bearer <API_TOKEN>
 *
 * Лише неархівні відділи; у складі — лише працюючі співробітники.
 */
export async function GET(request: NextRequest) {
  const denied = requireApiToken(request);
  if (denied) return denied;

  const teams = await prisma.department.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      name: true,
      head: { select: { id: true, lastName: true, firstName: true, workEmail: true } },
      employees: {
        where: WORKING,
        select: {
          id: true,
          lastName: true,
          firstName: true,
          workEmail: true,
          position: { select: { title: true } },
        },
        orderBy: [{ lastName: "asc" }],
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const data = teams.map((t) => ({
    id: t.id,
    name: t.name,
    head: t.head ? mapPersonRef(t.head) : null,
    membersCount: t.employees.length,
    members: t.employees.map((e) => ({
      ...mapPersonRef(e),
      position: e.position?.title ?? null,
    })),
  }));

  return Response.json({ count: data.length, teams: data }, { headers: API_HEADERS });
}
