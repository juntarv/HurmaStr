import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { CalendarDays, Gift, Plus, UserRound, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeBalances } from "@/server/services/balance";
import { getAbsencesOn, getUpcomingPersonalEvents } from "@/server/services/events";
import { canSeeLeaveDetails } from "@/lib/permissions";
import { Avatar, Badge, Button, Card, CardHeader, Divider, EmptyState } from "@/components/ui";
import { EventIcon, LeaveTypeIcon } from "@/components/icons";
import { daysLabel, formatDateUk, pluralUk, toDateOnly } from "@/lib/dates";

export const metadata = { title: "Панель — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const today = toDateOnly(new Date());

  const [balances, absences, events, headcount] = await Promise.all([
    session.employeeId ? getEmployeeBalances(session.employeeId) : Promise.resolve([]),
    getAbsencesOn(today),
    getUpcomingPersonalEvents(14),
    prisma.employee.count({ where: { isArchived: false, status: { not: "TERMINATED" } } }),
  ]);

  const absenceByType = new Map<string, { count: number; type: (typeof absences)[number]["leaveType"] }>();
  for (const absence of absences) {
    const entry = absenceByType.get(absence.leaveType.id);
    if (entry) entry.count += 1;
    else absenceByType.set(absence.leaveType.id, { count: 1, type: absence.leaveType });
  }

  const firstName = session.fullName.split(" ")[1] ?? session.fullName;

  return (
    <div className="mx-auto max-w-6xl">
      {/* ------------------------------ Привітання ----------------------------- */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted first-letter:uppercase">
            {format(today, "EEEE, d MMMM", { locale: uk })}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
            Вітаємо, {firstName}!
          </h1>
        </div>
        <Link href="/leaves/new">
          <Button>
            <Plus className="size-4" aria-hidden />
            Створити заявку
          </Button>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------ Мій баланс ------------------------------ */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between bg-gradient-to-r from-[var(--color-accent-to)] to-[#c96f16] px-5 py-4">
            <div>
              <p className="text-sm font-medium text-white/80">Мій баланс днів</p>
              <p className="text-xs text-white/70">Відпустка нараховується по 2 дні щомісяця</p>
            </div>
            <Link
              href="/leaves"
              className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/25"
            >
              Мої заявки
            </Link>
          </div>

          {!session.employeeId ? (
            <EmptyState
              icon={<UserRound className="size-5" />}
              title="Акаунт не пов'язаний з карткою співробітника"
              description="Попросіть адміністратора прив'язати ваш акаунт до кадрової картки — тоді запрацюють баланси та заявки."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
              {balances.map((b) => (
                <div
                  key={b.type.id}
                  className="rounded-lg border border-line bg-surface-muted px-3 py-3 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-brand-line"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <LeaveTypeIcon icon={b.type.icon} color={b.type.colorHex} className="size-5" />
                    {b.tracks && b.pending > 0 ? (
                      <span className="text-[10px] font-medium text-warning">+{b.pending}</span>
                    ) : null}
                  </div>
                  <p className="text-2xl font-semibold leading-none text-ink">
                    {b.tracks ? b.available : b.used}
                  </p>
                  <p className="mt-1.5 text-xs leading-tight text-ink-muted">{b.type.nameUk}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ---------------------------- Компанія ---------------------------- */}
        <Card>
          <CardHeader title="Компанія" />
          <Divider />
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Users className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-semibold leading-none text-ink">{headcount}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {pluralUk(headcount, ["співробітник", "співробітники", "співробітників"])} у штаті
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-warning-soft text-warning">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xl font-semibold leading-none text-ink">{absences.length}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  {pluralUk(absences.length, ["відсутній", "відсутні", "відсутніх"])} сьогодні
                </p>
              </div>
            </div>
            <Link href="/employees" className="mt-1">
              <Button variant="secondary" size="sm" className="w-full">
                Усі співробітники
              </Button>
            </Link>
          </div>
        </Card>

        {/* ------------------------ Відсутності сьогодні ------------------------- */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Відсутності сьогодні
                {absences.length > 0 ? <Badge tone="brand">{absences.length}</Badge> : null}
              </span>
            }
            action={
              <Link href="/calendar">
                <Button variant="ghost" size="sm">
                  Календар
                </Button>
              </Link>
            }
          />
          <Divider />

          {absences.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="Сьогодні всі на місці"
              description="Ніхто не у відпустці та не на лікарняному."
            />
          ) : (
            <div>
              <div className="flex flex-wrap gap-2 px-5 py-3">
                {[...absenceByType.values()].map(({ type, count }) => (
                  <span
                    key={type.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-soft"
                  >
                    <LeaveTypeIcon icon={type.icon} color={type.colorHex} className="size-3.5" />
                    {count}
                  </span>
                ))}
              </div>
              <Divider />
              <ul className="divide-y divide-line">
                {absences.map((absence, index) => {
                  const canSeeType = canSeeLeaveDetails(
                    session,
                    { employeeId: absence.employee.id, managerIds: [] },
                    absence.leaveType.isMedical,
                  );

                  return (
                    <li key={`${absence.employee.id}-${index}`} className="flex items-center gap-3 px-5 py-2.5">
                      <LeaveTypeIcon
                        icon={canSeeType ? absence.leaveType.icon : "calendar"}
                        color={canSeeType ? absence.leaveType.colorHex : "#9CA3AF"}
                      />
                      <Avatar
                        firstName={absence.employee.firstName}
                        lastName={absence.employee.lastName}
                        avatarUrl={absence.employee.avatarUrl}
                        size="sm"
                      />
                      <Link
                        href={`/employees/${absence.employee.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-brand"
                      >
                        {absence.employee.lastName} {absence.employee.firstName}
                      </Link>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {canSeeType ? absence.leaveType.nameUk : "Відсутній"} ·{" "}
                        {daysLabel(absence.daysCount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>

        {/* ---------------------------- Важливі дати ----------------------------- */}
        <Card>
          <CardHeader title="Важливі дати" />
          <Divider />

          {events.length === 0 ? (
            <EmptyState
              icon={<Gift className="size-5" />}
              title="Найближчим часом подій немає"
              description="Тут з'являться дні народження та річниці роботи."
            />
          ) : (
            <ul className="divide-y divide-line">
              {events.slice(0, 8).map((event, index) => (
                <li key={`${event.kind}-${event.employee.id}-${index}`} className="flex items-center gap-3 px-5 py-2.5">
                  <EventIcon kind={event.kind} />
                  <Avatar
                    firstName={event.employee.firstName}
                    lastName={event.employee.lastName}
                    avatarUrl={event.employee.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/employees/${event.employee.id}`}
                      className="block truncate text-sm font-medium text-ink hover:text-brand"
                    >
                      {event.employee.lastName} {event.employee.firstName}
                    </Link>
                    <p className="truncate text-xs text-ink-muted">
                      {event.kind === "birthday"
                        ? "День народження"
                        : `${event.years} ${pluralUk(event.years, ["рік", "роки", "років"])} у компанії`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">{formatDateUk(event.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
