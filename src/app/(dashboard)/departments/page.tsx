import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canManageDirectories } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Avatar, Badge, Card, CardHeader, Divider, EmptyState, PageHeader } from "@/components/ui";
import { DepartmentIcon, safeColor } from "@/components/icons";
import { DepartmentForm } from "./department-form";
import { pluralUk } from "@/lib/dates";
import { ui } from "@/lib/labels";

export const metadata = { title: "Відділи — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const session = await requireSession();
  const canManage = canManageDirectories(session);

  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        colorHex: true,
        parent: { select: { name: true } },
        head: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.findMany({
      where: { isArchived: false, status: { not: "TERMINATED" } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }],
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Відділи" subtitle="Структура компанії та керівники підрозділів" />

      {departments.length === 0 ? (
        <Card className="mb-5">
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Відділів ще немає"
            description="Створіть перший відділ — далі його можна буде призначити співробітникам."
          />
        </Card>
      ) : (
        <ul className="mb-5 flex flex-col gap-2">
          {departments.map((department) => (
            <li key={department.id}>
              <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span
                  className="flex size-10 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: safeColor(department.colorHex, "#E38324") }}
                >
                  <DepartmentIcon icon={department.icon} className="size-5" />
                </span>

                <div className="min-w-44 flex-1">
                  <p className="text-sm font-medium text-ink">{department.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {department.parent ? `у складі «${department.parent.name}»` : "Верхній рівень"}
                    {department.description ? ` · ${department.description}` : ""}
                  </p>
                </div>

                {department.head ? (
                  <Link
                    href={`/employees/${department.head.id}`}
                    className="flex items-center gap-2 text-xs text-ink-soft hover:text-brand"
                  >
                    <Avatar
                      firstName={department.head.firstName}
                      lastName={department.head.lastName}
                      avatarUrl={department.head.avatarUrl}
                      size="sm"
                    />
                    {department.head.lastName} {department.head.firstName}
                  </Link>
                ) : (
                  <span className="text-xs text-ink-faint">Керівник {ui.notSpecified.toLowerCase()}</span>
                )}

                <Badge>
                  {department._count.employees}{" "}
                  {pluralUk(department._count.employees, ["особа", "особи", "осіб"])}
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <Card>
          <CardHeader title="Новий відділ" />
          <Divider />
          <DepartmentForm departments={departments} employees={employees} />
        </Card>
      ) : null}
    </div>
  );
}
