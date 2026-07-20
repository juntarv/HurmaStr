import Link from "next/link";
import { Inbox, Plus, UserRound } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getRequestsForEmployee } from "@/server/queries/leaves";
import { getEmployeeBalances } from "@/server/services/balance";
import { Badge, Button, Card, CardHeader, Divider, EmptyState, PageHeader } from "@/components/ui";
import { LeaveTypeIcon } from "@/components/icons";
import { leaveStatusLabels, leaveStatusTone } from "@/lib/labels";
import { daysLabel, formatRangeUk } from "@/lib/dates";

export const metadata = { title: "Мої заявки — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function MyLeavesPage() {
  const session = await requireSession();

  if (!session.employeeId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <EmptyState
            icon={<UserRound className="size-5" />}
            title="Акаунт не пов'язаний з карткою співробітника"
            description="Зверніться до адміністратора, щоб отримати доступ до заявок."
          />
        </Card>
      </div>
    );
  }

  const year = new Date().getUTCFullYear();
  const [requests, balances] = await Promise.all([
    getRequestsForEmployee(session.employeeId),
    getEmployeeBalances(session.employeeId),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Мої заявки"
        subtitle="Відпустки, лікарняні та day off"
        action={
          <Link href="/leaves/new">
            <Button>
              <Plus className="size-4" aria-hidden />
              Нова заявка
            </Button>
          </Link>
        }
      />

      <Card className="mb-5">
        <CardHeader title={`Баланс за ${year}`} />
        <Divider />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {balances.map((b) => (
            <div key={b.type.id} className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <LeaveTypeIcon icon={b.type.icon} color={b.type.colorHex} />
                <span className="text-lg font-semibold leading-none text-ink">
                  {b.tracks ? b.available : b.used}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-tight text-ink-muted">{b.type.nameUk}</p>
              {b.tracks && b.pending > 0 ? (
                <p className="mt-0.5 text-xs text-warning">на погодженні {b.pending}</p>
              ) : (
                <p className="mt-0.5 text-xs text-ink-faint">
                  {b.tracks ? "доступно" : "взято цьогоріч"}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Заявок ще немає"
            description="Створіть першу заявку — вона піде на погодження керівнику."
            action={
              <Link href="/leaves/new">
                <Button>
                  <Plus className="size-4" aria-hidden />
                  Нова заявка
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((request) => (
            <li key={request.id}>
              <Link href={`/leaves/${request.id}`} className="block">
                <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:border-line-strong">
                  <LeaveTypeIcon
                    icon={request.leaveType.icon}
                    color={request.leaveType.colorHex}
                    className="size-5"
                  />
                  <div className="min-w-44 flex-1">
                    <p className="text-sm font-medium text-ink">{request.leaveType.nameUk}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {formatRangeUk(request.startDate, request.endDate)} ·{" "}
                      {daysLabel(request.daysCount)}
                    </p>
                  </div>
                  <span className="text-xs text-ink-faint">{request.number}</span>
                  <Badge tone={leaveStatusTone[request.status]}>
                    {leaveStatusLabels[request.status]}
                  </Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
