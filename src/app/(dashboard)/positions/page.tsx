import { requireSession } from "@/lib/auth";
import { canManageDirectories } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, Divider, EmptyState, PageHeader } from "@/components/ui";
import { BriefcaseBusiness } from "lucide-react";
import { forbidden } from "@/components/forbidden";
import { CreatePositionForm, PositionRow } from "./position-forms";

export const metadata = { title: "Посади — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  const session = await requireSession();
  if (!canManageDirectories(session)) return forbidden("Керування посадами доступне HR та адміністратору.");

  const [positions, departments] = await Promise.all([
    prisma.position.findMany({
      select: {
        id: true,
        title: true,
        departmentId: true,
        sortOrder: true,
        isArchived: true,
        _count: { select: { employees: true } },
      },
      orderBy: [{ isArchived: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.department.findMany({
      where: { isArchived: false },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const active = positions.filter((p) => !p.isArchived);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Посади" subtitle="Довідник посад для карток співробітників" />

      <Card className="mb-5">
        <CardHeader title={`Посади — ${active.length}`} />
        <Divider />
        {positions.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness className="size-5" />}
            title="Посад ще немає"
            description="Додайте першу посаду нижче."
          />
        ) : (
          <ul className="divide-y divide-line">
            {positions.map((p) => (
              <li key={p.id}>
                <PositionRow
                  position={{
                    id: p.id,
                    title: p.title,
                    departmentId: p.departmentId,
                    sortOrder: p.sortOrder,
                    isArchived: p.isArchived,
                    count: p._count.employees,
                  }}
                  departments={departments}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Нова посада" />
        <Divider />
        <CreatePositionForm departments={departments} />
      </Card>
    </div>
  );
}
