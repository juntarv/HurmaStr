import Link from "next/link";
import { Mail, Phone, Plus, Search, Send, UserRound } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canManageEmployees } from "@/lib/permissions";
import { listEmployees } from "@/server/queries/employees";
import { prisma } from "@/lib/prisma";
import { Avatar, Badge, Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { employeeStatusLabels, employeeStatusTone, ui } from "@/lib/labels";
import { formatDateUk, pluralUk } from "@/lib/dates";
import type { EmployeeStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Співробітники — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; status?: string; archived?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const includeArchived = params.archived === "1";
  const status = (params.status || undefined) as EmployeeStatus | undefined;

  const [employees, departments] = await Promise.all([
    listEmployees({
      q: params.q,
      departmentId: params.department || undefined,
      status,
      includeArchived,
    }),
    prisma.department.findMany({
      where: { isArchived: false },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const canManage = canManageEmployees(session);
  const hasFilters = Boolean(params.q || params.department || params.status || includeArchived);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Пошук і фільтри — звичайна GET-форма, стан живе в URL. */}
      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Пошук за ПІБ, посадою, поштою, телефоном"
            className="pl-9"
            aria-label={ui.search}
          />
        </div>

        <Select name="department" defaultValue={params.department ?? ""} className="w-auto min-w-40">
          <option value="">Усі відділи</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>

        <Select name="status" defaultValue={params.status ?? ""} className="w-auto min-w-40">
          <option value="">Усі статуси</option>
          {(Object.keys(employeeStatusLabels) as EmployeeStatus[]).map((value) => (
            <option key={value} value={value}>
              {employeeStatusLabels[value]}
            </option>
          ))}
        </Select>

        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={includeArchived}
            className="size-4 accent-[var(--color-brand)]"
          />
          Архівні
        </label>

        <Button type="submit" variant="secondary">
          Знайти
        </Button>
        {hasFilters ? (
          <Link href="/employees">
            <Button type="button" variant="ghost">
              {ui.resetFilters}
            </Button>
          </Link>
        ) : null}
      </form>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Співробітники — {employees.length}
        </h1>
        {canManage ? (
          <Link href="/employees/new">
            <Button>
              <Plus className="size-4" aria-hidden />
              Додати співробітника
            </Button>
          </Link>
        ) : null}
      </div>

      {employees.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserRound className="size-5" />}
            title={hasFilters ? ui.nothingFound : "Ще немає жодного співробітника"}
            description={
              hasFilters
                ? "Спробуйте змінити пошуковий запит або скиньте фільтри."
                : "Додайте першу картку — і тут з'явиться список команди."
            }
            action={
              canManage && !hasFilters ? (
                <Link href="/employees/new">
                  <Button>
                    <Plus className="size-4" aria-hidden />
                    Додати співробітника
                  </Button>
                </Link>
              ) : null
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {employees.map((employee) => {
            const accountDisabled = !!employee.account && !employee.account.isActive;
            const noAccount = !employee.account;

            return (
              <li key={employee.id}>
                <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:border-line-strong">
                  <Avatar
                    firstName={employee.firstName}
                    lastName={employee.lastName}
                    avatarUrl={employee.avatarUrl}
                  />

                  <div className="min-w-44 flex-1">
                    <Link
                      href={`/employees/${employee.id}`}
                      className="text-sm font-medium text-ink hover:text-brand"
                    >
                      {employee.lastName} {employee.firstName} {employee.middleName ?? ""}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {employee.position?.title ?? ui.notSpecified}
                      {employee.department ? ` · ${employee.department.name}` : ""}
                    </p>
                  </div>

                  <div className="min-w-52 text-xs text-ink-muted">
                    {employee.workEmail ? (
                      <p className="flex items-center gap-1.5 truncate">
                        <Mail className="size-3.5 shrink-0" aria-hidden />
                        <a href={`mailto:${employee.workEmail}`} className="truncate hover:text-brand">
                          {employee.workEmail}
                        </a>
                      </p>
                    ) : null}
                    {employee.phone ? (
                      <p className="mt-0.5 flex items-center gap-1.5">
                        <Phone className="size-3.5 shrink-0" aria-hidden />
                        {employee.phone}
                      </p>
                    ) : null}
                    {employee.telegram ? (
                      <p className="mt-0.5 flex items-center gap-1.5">
                        <Send className="size-3.5 shrink-0" aria-hidden />
                        {employee.telegram}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {employee.isArchived ? <Badge>Архів</Badge> : null}
                    <Badge tone={employeeStatusTone[employee.status]}>
                      {employeeStatusLabels[employee.status]}
                    </Badge>
                    {canManage && accountDisabled ? <Badge tone="warning">Доступ вимкнено</Badge> : null}
                    {canManage && noAccount ? <Badge>Без доступу</Badge> : null}
                  </div>

                  <p className="w-full text-xs text-ink-faint sm:w-auto">
                    з {formatDateUk(employee.hireDate)}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {employees.length > 0 ? (
        <p className="mt-4 text-xs text-ink-muted">
          Показано {employees.length}{" "}
          {pluralUk(employees.length, ["співробітника", "співробітників", "співробітників"])}
        </p>
      ) : null}
    </div>
  );
}
