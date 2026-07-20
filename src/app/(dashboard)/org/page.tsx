import Link from "next/link";
import { Network } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getDepartmentOrgMap } from "@/server/queries/employees";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { DepartmentIcon } from "@/components/icons";
import { safeColor } from "@/components/icons";
import { pluralUk } from "@/lib/dates";

export const metadata = { title: "Оргструктура — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function OrgPage() {
  await requireSession();
  const { departments, headcount, topManagers } = await getDepartmentOrgMap();

  const hasData = headcount > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Оргструктура"
        subtitle="Компанія за відділами — керівники, склад і чисельність"
      />

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<Network className="size-5" />}
            title="Оргструктура порожня"
            description="Додайте співробітників і призначте відділи — карта збудується автоматично."
          />
        </Card>
      ) : (
        <div className="flex flex-col items-center">
          {/* --------------------------- Вузол компанії --------------------------- */}
          <div className="w-full max-w-xs rounded-card border border-line bg-surface px-5 py-4 text-center shadow-card">
            <p className="text-base font-semibold text-ink">Компанія</p>
            <p className="mt-1 text-sm text-ink-muted">
              {headcount} {pluralUk(headcount, ["співробітник", "співробітники", "співробітників"])}
            </p>
            {topManagers.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                {topManagers.map((m) => (
                  <Link key={m.id} href={`/employees/${m.id}`} className="group flex flex-col items-center">
                    <Avatar firstName={m.firstName} lastName={m.lastName} avatarUrl={m.avatarUrl} />
                    <span className="mt-1 max-w-24 truncate text-xs font-medium text-ink group-hover:text-brand">
                      {m.lastName} {m.firstName}
                    </span>
                    <span className="max-w-24 truncate text-[11px] text-ink-muted">
                      {m.position?.title ?? ""}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {/* Вертикальний з'єднувач */}
          <div className="h-6 w-px bg-line-strong" aria-hidden />

          {/* ----------------------------- Відділи ------------------------------- */}
          <div className="grid w-full gap-4 sm:grid-cols-2">
            {departments.map((dep) => {
              const color = safeColor(dep.colorHex, "#E38324");
              return (
                <Card key={dep.id} className="overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: color }}
                    >
                      <DepartmentIcon icon={dep.icon} className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/employees?department=${dep.id}`}
                        className="block truncate text-sm font-semibold text-ink hover:text-brand"
                      >
                        {dep.name}
                      </Link>
                      <p className="text-xs text-ink-muted">
                        {dep.employees.length}{" "}
                        {pluralUk(dep.employees.length, ["особа", "особи", "осіб"])}
                      </p>
                    </div>
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {dep.employees.length}
                    </span>
                  </div>

                  {dep.head ? (
                    <div className="flex items-center gap-2.5 border-t border-line bg-surface-muted px-4 py-2.5">
                      <Avatar
                        firstName={dep.head.firstName}
                        lastName={dep.head.lastName}
                        avatarUrl={dep.head.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/employees/${dep.head.id}`}
                          className="block truncate text-xs font-medium text-ink hover:text-brand"
                        >
                          {dep.head.lastName} {dep.head.firstName}
                        </Link>
                        <span className="block truncate text-[11px] text-ink-muted">
                          {dep.head.position?.title ?? "Керівник відділу"}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {dep.employees.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 px-4 py-3">
                      {dep.employees.slice(0, 8).map((e) => (
                        <Link key={e.id} href={`/employees/${e.id}`} title={`${e.lastName} ${e.firstName}`}>
                          <Avatar firstName={e.firstName} lastName={e.lastName} avatarUrl={e.avatarUrl} size="sm" />
                        </Link>
                      ))}
                      {dep.employees.length > 8 ? (
                        <span className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-ink-muted">
                          +{dep.employees.length - 8}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
