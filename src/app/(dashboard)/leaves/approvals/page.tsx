import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canSeeLeaveDetails, managerSet } from "@/lib/permissions";
import { getPendingApprovalsFor } from "@/server/queries/leaves";
import { Avatar, Card, CardHeader, Divider, EmptyState, PageHeader } from "@/components/ui";
import { LeaveTypeIcon } from "@/components/icons";
import { DecisionButtons } from "@/components/leave-decision";
import { approverRoleLabels } from "@/lib/labels";
import { daysLabel, formatDateUk, formatRangeUk } from "@/lib/dates";

export const metadata = { title: "На погодженні — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await requireSession();
  const approvals = await getPendingApprovalsFor(session);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="На погодженні"
        subtitle={
          approvals.length > 0
            ? `${approvals.length} заявок чекають вашого рішення`
            : "Черга погоджень порожня"
        }
      />

      {approvals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCheck className="size-5" />}
            title="Немає заявок на погодження"
            description="Тут з'являться заявки ваших підлеглих або заявки, що потребують рішення HR."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {approvals.map((approval) => {
            const request = approval.request;
            const showType = canSeeLeaveDetails(
              session,
              {
                employeeId: request.employeeId,
                managerIds: managerSet(request.employee),
              },
              request.leaveType.isMedical,
            );

            return (
              <Card key={approval.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {showType ? (
                        <LeaveTypeIcon
                          icon={request.leaveType.icon}
                          color={request.leaveType.colorHex}
                        />
                      ) : null}
                      {showType ? request.leaveType.nameUk : "Відсутність"}
                    </span>
                  }
                  action={
                    <Link
                      href={`/leaves/${request.id}`}
                      className="text-xs text-ink-muted hover:text-brand"
                    >
                      {request.number}
                    </Link>
                  }
                />
                <Divider />

                <div className="flex items-center gap-3 px-5 py-3">
                  <Avatar
                    firstName={request.employee.firstName}
                    lastName={request.employee.lastName}
                    avatarUrl={request.employee.avatarUrl}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/employees/${request.employee.id}`}
                      className="text-sm font-medium text-ink hover:text-brand"
                    >
                      {request.employee.lastName} {request.employee.firstName}
                    </Link>
                    <p className="text-xs text-ink-muted">
                      {request.employee.position?.title ?? ""}
                      {request.employee.department ? ` · ${request.employee.department.name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">
                    крок «{approverRoleLabels[approval.role]}»
                  </span>
                </div>

                <Divider />

                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-5 py-3 text-sm">
                  <span className="text-ink">
                    {formatRangeUk(request.startDate, request.endDate)}
                  </span>
                  <span className="text-ink-muted">{daysLabel(request.daysCount)}</span>
                  {request.submittedAt ? (
                    <span className="text-xs text-ink-faint">
                      подано {formatDateUk(request.submittedAt)}
                    </span>
                  ) : null}
                </div>

                {request.comment ? (
                  <p className="px-5 pb-3 text-sm text-ink-soft">{request.comment}</p>
                ) : null}

                <Divider />
                <div className="p-5">
                  <DecisionButtons approvalId={approval.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
