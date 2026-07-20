import Link from "next/link";
import { Palmtree } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canAdjustBalances } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { computeTypeBalance, type LeaveTypeLike } from "@/server/services/balance";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { LeaveTypeIcon } from "@/components/icons";
import { forbidden } from "@/components/forbidden";

export const metadata = { title: "Баланси — HurmaStr" };
export const dynamic = "force-dynamic";

const typeSelect = {
  id: true,
  code: true,
  nameUk: true,
  icon: true,
  colorHex: true,
  unit: true,
  payKind: true,
  affectsBalance: true,
  accrualMode: true,
  accrualPerMonth: true,
  annualEntitlement: true,
  isMedical: true,
} as const;

export default async function BalancesPage() {
  const session = await requireSession();
  if (!canAdjustBalances(session)) return forbidden();

  const now = new Date();
  const year = now.getUTCFullYear();

  const [types, employees, rows, allAdjustments] = await Promise.all([
    prisma.leaveType.findMany({
      where: { isActive: true, affectsBalance: true, accrualMode: { not: "NONE" } },
      orderBy: { sortOrder: "asc" },
      select: typeSelect,
    }),
    prisma.employee.findMany({
      where: { isArchived: false, status: { not: "TERMINATED" } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        hireDate: true,
        position: { select: { title: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.leaveRequest.findMany({
      where: { status: { in: ["APPROVED", "PENDING"] } },
      select: { employeeId: true, leaveTypeId: true, status: true, startDate: true, daysCount: true },
    }),
    prisma.leaveAdjustment.findMany({
      select: { employeeId: true, leaveTypeId: true, year: true, days: true },
    }),
  ]);

  const rowsByEmployee = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = rowsByEmployee.get(r.employeeId) ?? [];
    list.push(r);
    rowsByEmployee.set(r.employeeId, list);
  }

  const adjByEmployee = new Map<string, typeof allAdjustments>();
  for (const a of allAdjustments) {
    const list = adjByEmployee.get(a.employeeId) ?? [];
    list.push(a);
    adjByEmployee.set(a.employeeId, list);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Баланси днів"
        subtitle={`Доступні залишки станом на ${year} рік. Відпустка нараховується по 2 дні за кожен місяць від дати найму.`}
      />

      {employees.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Palmtree className="size-5" />}
            title="Немає активних співробітників"
            description="Додайте картки співробітників, щоб побачити їхні баланси."
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-medium text-ink-muted">Співробітник</th>
                {types.map((type) => (
                  <th key={type.id} className="px-4 py-3 font-medium text-ink-muted">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <LeaveTypeIcon icon={type.icon} color={type.colorHex} className="size-3.5" />
                      {type.nameUk}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {employees.map((employee) => {
                const empRows = rowsByEmployee.get(employee.id) ?? [];
                const empAdj = adjByEmployee.get(employee.id) ?? [];
                return (
                  <tr key={employee.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar
                          firstName={employee.firstName}
                          lastName={employee.lastName}
                          avatarUrl={employee.avatarUrl}
                          size="sm"
                        />
                        <span className="min-w-0">
                          <Link
                            href={`/employees/${employee.id}`}
                            className="block truncate font-medium text-ink hover:text-brand"
                          >
                            {employee.lastName} {employee.firstName}
                          </Link>
                          <span className="block truncate text-xs text-ink-muted">
                            {employee.position?.title ?? ""}
                          </span>
                        </span>
                      </span>
                    </td>

                    {types.map((type) => {
                      const b = computeTypeBalance(type as LeaveTypeLike, employee, empRows, now, empAdj);
                      return (
                        <td key={type.id} className="px-4 py-2.5">
                          <span className={`font-semibold ${b.available < 0 ? "text-danger" : "text-ink"}`}>
                            {b.available}
                          </span>
                          {b.pending > 0 ? (
                            <span className="ml-1.5 text-xs text-warning">+{b.pending} чекає</span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
