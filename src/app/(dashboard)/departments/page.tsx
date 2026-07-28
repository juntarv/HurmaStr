import { Building2 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canManageDirectories } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, Divider, EmptyState, PageHeader } from "@/components/ui";
import { DepartmentForm } from "./department-form";
import { DepartmentRow } from "./department-row";

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
        parentId: true,
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
              <DepartmentRow
                canManage={canManage}
                departments={departments.map((d) => ({ id: d.id, name: d.name }))}
                employees={employees}
                department={{
                  id: department.id,
                  name: department.name,
                  description: department.description,
                  icon: department.icon,
                  colorHex: department.colorHex,
                  parentId: department.parentId,
                  parentName: department.parent?.name ?? null,
                  head: department.head,
                  count: department._count.employees,
                }}
              />
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
