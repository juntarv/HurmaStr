import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, Paperclip, X } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canDecideApproval, canSeeLeaveDetails, isHrOrAdmin, isSelf } from "@/lib/permissions";
import { getRequestById } from "@/server/queries/leaves";
import { Avatar, Badge, Card, CardHeader, Divider, PageHeader } from "@/components/ui";
import { LeaveTypeIcon } from "@/components/icons";
import { CancelRequestForm, DecisionButtons } from "@/components/leave-decision";
import {
  approvalStepStatusLabels,
  approverRoleLabels,
  leaveStatusLabels,
  leaveStatusTone,
  payKindLabels,
  ui,
} from "@/lib/labels";
import { daysLabel, formatDateUk, formatRangeUk } from "@/lib/dates";
import { forbidden } from "@/components/forbidden";

export const dynamic = "force-dynamic";

export default async function LeaveRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const request = await getRequestById(id);
  if (!request) notFound();

  const owner = isSelf(session, request.employeeId);
  const isManagerOfOwner =
    !!session.employeeId && request.employee.managerId === session.employeeId;

  // Заявку бачать: автор, його керівник, HR/адмін і призначені погоджувачі.
  const isAssignedApprover = request.approvals.some(
    (approval) => approval.approverId && approval.approverId === session.employeeId,
  );
  if (!owner && !isManagerOfOwner && !isHrOrAdmin(session) && !isAssignedApprover) {
    return forbidden("Ця заявка належить іншому співробітнику.");
  }

  // Медичні типи ховаємо від сторонніх очей.
  const showType = canSeeLeaveDetails(
    session,
    { employeeId: request.employeeId, employeeManagerId: request.employee.managerId },
    request.leaveType.isMedical,
  );

  const activeApproval = request.approvals.find(
    (approval) => approval.step === request.currentStep && approval.status === "PENDING",
  );
  const canDecide =
    request.status === "PENDING" &&
    !!activeApproval &&
    canDecideApproval(
      session,
      { role: activeApproval.role, approverId: activeApproval.approverId },
      { employeeId: request.employeeId },
    );

  const canCancel =
    (request.status === "PENDING" || request.status === "APPROVED") &&
    (owner || isHrOrAdmin(session));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={owner ? "/leaves" : "/leaves/approvals"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {ui.back}
      </Link>

      <PageHeader
        title={showType ? request.leaveType.nameUk : "Відсутність"}
        subtitle={`Заявка ${request.number}`}
        action={
          <Badge tone={leaveStatusTone[request.status]}>{leaveStatusLabels[request.status]}</Badge>
        }
      />

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Деталі" />
          <Divider />
          <div className="divide-y divide-line">
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
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
              <span className="text-sm text-ink-muted">Тип</span>
              <span className="flex items-center gap-1.5 text-sm text-ink">
                {showType ? (
                  <>
                    <LeaveTypeIcon
                      icon={request.leaveType.icon}
                      color={request.leaveType.colorHex}
                    />
                    {request.leaveType.nameUk}
                  </>
                ) : (
                  "Приховано"
                )}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
              <span className="text-sm text-ink-muted">Період</span>
              <span className="text-sm text-ink">
                {formatRangeUk(request.startDate, request.endDate)}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
              <span className="text-sm text-ink-muted">Тривалість</span>
              <span className="text-sm text-ink">
                {daysLabel(request.daysCount)}{" "}
                <span className="text-ink-muted">
                  ({request.unitSnapshot === "WORKING_DAYS" ? "робочих" : "календарних"})
                </span>
              </span>
            </div>

            {showType ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
                <span className="text-sm text-ink-muted">Оплата</span>
                <span className="text-sm text-ink">{payKindLabels[request.leaveType.payKind]}</span>
              </div>
            ) : null}

            {request.documentNumber ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
                <span className="text-sm text-ink-muted">Номер довідки</span>
                <span className="text-sm text-ink">{request.documentNumber}</span>
              </div>
            ) : null}

            {showType && request.attachmentPath ? (
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
                <span className="text-sm text-ink-muted">Довідка</span>
                <a
                  href={`/api/leave-attachments/${request.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                >
                  <Paperclip className="size-3.5" aria-hidden />
                  {request.attachmentName ?? "Переглянути"}
                </a>
              </div>
            ) : null}

            {request.comment ? (
              <div className="px-5 py-3">
                <p className="text-sm text-ink-muted">Коментар</p>
                <p className="mt-1 text-sm text-ink">{request.comment}</p>
              </div>
            ) : null}

            {request.cancelReason ? (
              <div className="px-5 py-3">
                <p className="text-sm text-ink-muted">Причина скасування</p>
                <p className="mt-1 text-sm text-ink">{request.cancelReason}</p>
              </div>
            ) : null}
          </div>
        </Card>

        {/* --------------------------- Маршрут погодження -------------------- */}
        <Card>
          <CardHeader title="Погодження" />
          <Divider />
          {request.approvals.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-muted">
              Заявку погоджено автоматично — доступного погоджувача не знайшлося.
            </p>
          ) : (
            <ol className="divide-y divide-line">
              {request.approvals.map((approval) => {
                const isActive =
                  approval.step === request.currentStep &&
                  approval.status === "PENDING" &&
                  request.status === "PENDING";

                return (
                  <li key={approval.id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        approval.status === "APPROVED"
                          ? "bg-success-soft text-success"
                          : approval.status === "REJECTED"
                            ? "bg-danger-soft text-danger"
                            : isActive
                              ? "bg-warning-soft text-warning"
                              : "bg-surface-muted text-ink-faint"
                      }`}
                    >
                      {approval.status === "APPROVED" ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : approval.status === "REJECTED" ? (
                        <X className="size-3.5" aria-hidden />
                      ) : isActive ? (
                        <Clock className="size-3.5" aria-hidden />
                      ) : (
                        approval.step
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        {approverRoleLabels[approval.role]}
                        {approval.approver
                          ? ` · ${approval.approver.lastName} ${approval.approver.firstName}`
                          : " · будь-який HR"}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {approvalStepStatusLabels[approval.status]}
                        {approval.decidedBy
                          ? ` · ${approval.decidedBy.lastName} ${approval.decidedBy.firstName}`
                          : ""}
                        {approval.decidedAt ? ` · ${formatDateUk(approval.decidedAt)}` : ""}
                      </p>
                      {approval.comment ? (
                        <p className="mt-1 text-sm text-ink-soft">{approval.comment}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {canDecide && activeApproval ? (
            <>
              <Divider />
              <div className="p-5">
                <DecisionButtons approvalId={activeApproval.id} />
              </div>
            </>
          ) : null}
        </Card>

        {canCancel ? (
          <Card className="p-5">
            <CancelRequestForm requestId={request.id} />
            {request.status === "APPROVED" ? (
              <p className="mt-2 text-xs text-ink-muted">
                Дні повернуться в баланс автоматично.
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
