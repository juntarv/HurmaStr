import Link from "next/link";
import { Mail, MessagesSquare, Phone, Plus, Search, Send, UserRound } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canManageEmployees, isAdmin } from "@/lib/permissions";
import { listEmployees, listTerminatedEmployees } from "@/server/queries/employees";
import { prisma } from "@/lib/prisma";
import { Avatar, Badge, Button, Card, EmptyState, Input, Select } from "@/components/ui";
import { employeeStatusLabels, employeeStatusTone, ui } from "@/lib/labels";
import { formatDateUk, pluralUk } from "@/lib/dates";
import type { EmployeeStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Співробітники — HurmaStr" };
export const dynamic = "force-dynamic";

type EmployeeListItem = Awaited<ReturnType<typeof listEmployees>>[number];

/** Рядок співробітника у списку. */
function EmployeeRow({ employee, canManage }: { employee: EmployeeListItem; canManage: boolean }) {
  const accountDisabled = !!employee.account && !employee.account.isActive;
  const noAccount = !employee.account;

  return (
    <li>
      <Card interactive className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Avatar firstName={employee.firstName} lastName={employee.lastName} avatarUrl={employee.avatarUrl} />

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
          {employee.mattermost ? (
            <p className="mt-0.5 flex items-center gap-1.5">
              <MessagesSquare className="size-3.5 shrink-0" aria-hidden />
              {employee.mattermost}
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
          {employee.status === "TERMINATED" && employee.terminationDate
            ? `звільнений ${formatDateUk(employee.terminationDate)}`
            : `з ${formatDateUk(employee.hireDate)}`}
        </p>
      </Card>
    </li>
  );
}

/** Групує співробітників по відділах у порядку відділів (без відділу — в кінці). */
function groupByDepartment(
  employees: EmployeeListItem[],
  order: { id: string; name: string }[],
) {
  const orderIndex = new Map(order.map((d, i) => [d.id, i]));
  const groups = new Map<string, { id: string | null; name: string; members: EmployeeListItem[] }>();

  for (const e of employees) {
    const key = e.department?.id ?? "__none__";
    if (!groups.has(key)) {
      groups.set(key, { id: e.department?.id ?? null, name: e.department?.name ?? "Без відділу", members: [] });
    }
    groups.get(key)!.members.push(e);
  }

  return [...groups.values()].sort((a, b) => {
    const ai = a.id ? (orderIndex.get(a.id) ?? 998) : 1000;
    const bi = b.id ? (orderIndex.get(b.id) ?? 998) : 1000;
    return ai - bi;
  });
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; status?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  // Звільнені живуть в окремій «папці» внизу — бачить її лише адмін.
  const canSeeTerminated = isAdmin(session);
  // Whitelist: TERMINATED з URL ігноруємо — звільнені лише в адмінській секції.
  const status =
    params.status === "PROBATION" || params.status === "ACTIVE"
      ? (params.status as EmployeeStatus)
      : undefined;

  const [employees, terminated, departments] = await Promise.all([
    listEmployees({
      q: params.q,
      departmentId: params.department || undefined,
      status,
    }),
    canSeeTerminated ? listTerminatedEmployees(params.q) : Promise.resolve([]),
    prisma.department.findMany({
      where: { isArchived: false },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const canManage = canManageEmployees(session);
  const hasFilters = Boolean(params.q || params.department || params.status);

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
          {(Object.keys(employeeStatusLabels) as EmployeeStatus[])
            // «Звільнений» у фільтрі не пропонуємо — звільнених показує окремий перемикач (лише адмін).
            .filter((value) => value !== "TERMINATED")
            .map((value) => (
              <option key={value} value={value}>
                {employeeStatusLabels[value]}
              </option>
            ))}
        </Select>

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
        <div className="flex flex-col gap-6">
          {groupByDepartment(employees, departments).map((group) => (
            <section key={group.id ?? "none"}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="text-sm font-semibold text-ink">{group.name}</h2>
                <span className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
                  {group.members.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {group.members.map((employee) => (
                  <EmployeeRow key={employee.id} employee={employee} canManage={canManage} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* --------------- Окрема «папка» звільнених (лише адмін) --------------- */}
      {canSeeTerminated && terminated.length > 0 ? (
        <section className="mt-8">
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-sm font-semibold text-danger">Звільнені</h2>
            <span className="inline-flex items-center rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              {terminated.length}
            </span>
          </div>
          <ul className="flex flex-col gap-2 opacity-75">
            {terminated.map((employee) => (
              <EmployeeRow key={employee.id} employee={employee} canManage={canManage} />
            ))}
          </ul>
        </section>
      ) : null}

      {employees.length > 0 ? (
        <p className="mt-4 text-xs text-ink-muted">
          Показано {employees.length}{" "}
          {pluralUk(employees.length, ["співробітника", "співробітників", "співробітників"])}
        </p>
      ) : null}
    </div>
  );
}
