import Link from "next/link";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canSeeLeaveDetails } from "@/lib/permissions";
import {
  getLeaveEvents,
  getPersonalEvents,
  groupEventsByDay,
  spreadLeavesByDay,
} from "@/server/services/events";
import { Button, Card } from "@/components/ui";
import { EventIcon, LeaveTypeIcon, safeColor } from "@/components/icons";
import { addDays, dateKey, isWeekend, toDateOnly } from "@/lib/dates";
import { pluralUk } from "@/lib/dates";

export const metadata = { title: "Календар — HurmaStr" };
export const dynamic = "force-dynamic";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Зсув до понеділка: у JS тиждень починається з неділі (0). */
function mondayOffset(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  const today = toDateOnly(new Date());
  const match = params.month?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : today.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : today.getUTCMonth();

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0));

  // Сітка завжди починається з понеділка і містить цілі тижні.
  const gridStart = addDays(monthStart, -mondayOffset(monthStart));
  const weeks = Math.ceil((mondayOffset(monthStart) + monthEnd.getUTCDate()) / 7);
  const gridEnd = addDays(gridStart, weeks * 7 - 1);

  const [personal, leaves] = await Promise.all([
    getPersonalEvents(gridStart, gridEnd),
    getLeaveEvents(gridStart, gridEnd),
  ]);

  const personalByDay = groupEventsByDay(personal);
  const leavesByDay = spreadLeavesByDay(leaves, gridStart, gridEnd);

  const prevMonth = new Date(Date.UTC(year, month - 1, 1));
  const nextMonth = new Date(Date.UTC(year, month + 1, 1));
  const monthParam = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  const days = Array.from({ length: weeks * 7 }, (_, index) => addDays(gridStart, index));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/calendar">
          <Button variant="secondary" size="sm">
            Сьогодні
          </Button>
        </Link>
        <div className="flex items-center gap-1">
          <Link href={`/calendar?month=${monthParam(prevMonth)}`} aria-label="Попередній місяць">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
          </Link>
          <Link href={`/calendar?month=${monthParam(nextMonth)}`} aria-label="Наступний місяць">
            <Button variant="ghost" size="sm">
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink first-letter:uppercase">
          {format(monthStart, "LLLL yyyy", { locale: uk })}
        </h1>

        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <EventIcon kind="birthday" className="size-3.5" />
            День народження
          </span>
          <span className="flex items-center gap-1.5">
            <EventIcon kind="anniversary" className="size-3.5" />
            Річниця роботи
          </span>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <div className="min-w-3xl">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="px-2 py-2 text-right text-xs font-medium text-ink-muted"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day);
              const inMonth = day.getUTCMonth() === month;
              const isToday = key === dateKey(today);
              const dayPersonal = personalByDay.get(key) ?? [];
              const dayLeaves = leavesByDay.get(key) ?? [];

              return (
                <div
                  key={key}
                  className={`min-h-28 border-b border-r border-line p-1.5 ${
                    !inMonth ? "bg-surface-muted/60" : isWeekend(day) ? "bg-surface-muted/40" : ""
                  }`}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                        isToday
                          ? "bg-brand font-semibold text-white"
                          : inMonth
                            ? "text-ink-soft"
                            : "text-ink-faint"
                      }`}
                    >
                      {day.getUTCDate()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {dayPersonal.map((event, index) => (
                      <Link
                        key={`p-${event.employee.id}-${index}`}
                        href={`/employees/${event.employee.id}`}
                        title={
                          event.kind === "birthday"
                            ? `День народження — ${event.employee.lastName} ${event.employee.firstName}`
                            : `${event.years} ${pluralUk(event.years, ["рік", "роки", "років"])} у компанії — ${event.employee.lastName} ${event.employee.firstName}`
                        }
                        className="flex items-center gap-1 truncate rounded bg-brand-soft px-1.5 py-0.5 text-xs text-ink-soft hover:bg-brand-line"
                      >
                        <EventIcon kind={event.kind} className="size-3 shrink-0" />
                        <span className="truncate">
                          {event.employee.lastName} {event.employee.firstName.charAt(0)}.
                        </span>
                        {event.kind === "anniversary" ? (
                          <span className="shrink-0 text-ink-faint">{event.years}р</span>
                        ) : null}
                      </Link>
                    ))}

                    {dayLeaves.map((leave, index) => {
                      const showType = canSeeLeaveDetails(
                        session,
                        { employeeId: leave.employee.id, managerIds: [] },
                        leave.leaveType.isMedical,
                      );
                      const color = showType ? safeColor(leave.leaveType.colorHex) : "#9CA3AF";

                      return (
                        <Link
                          key={`l-${leave.employee.id}-${index}`}
                          href={`/employees/${leave.employee.id}`}
                          title={`${showType ? leave.leaveType.nameUk : "Відсутній"} — ${leave.employee.lastName} ${leave.employee.firstName}`}
                          className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs text-white"
                          style={{ backgroundColor: color }}
                        >
                          <LeaveTypeIcon
                            icon={showType ? leave.leaveType.icon : "calendar"}
                            color="#ffffff"
                            className="size-3 shrink-0"
                          />
                          <span className="truncate">
                            {leave.employee.lastName} {leave.employee.firstName.charAt(0)}.
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
