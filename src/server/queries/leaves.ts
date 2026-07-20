import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/auth";
import { isHrOrAdmin } from "@/lib/permissions";

/**
 * Заявка вважається такою, що чекає на конкретний крок, коли
 * approval.step збігається з request.currentStep. Усі кроки маршруту
 * створюються одразу — так користувач бачить, хто ще має погодити.
 */

const approvalInclude = {
  request: {
    select: {
      id: true,
      number: true,
      status: true,
      currentStep: true,
      startDate: true,
      endDate: true,
      daysCount: true,
      comment: true,
      documentNumber: true,
      submittedAt: true,
      employeeId: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          managerId: true,
          position: { select: { title: true } },
          department: { select: { name: true } },
        },
      },
      leaveType: {
        select: { id: true, nameUk: true, icon: true, colorHex: true, isMedical: true },
      },
    },
  },
} as const;

/** Кроки погодження, рішення по яких має ухвалити саме ця людина. */
export async function getPendingApprovalsFor(session: Session) {
  const or: object[] = [];
  if (session.employeeId) or.push({ approverId: session.employeeId });
  // Крок HR знеособлений — його закриває будь-який HR або адміністратор.
  if (isHrOrAdmin(session)) or.push({ role: "HR", approverId: null });
  if (or.length === 0) return [];

  const approvals = await prisma.leaveApproval.findMany({
    where: {
      status: "PENDING",
      request: {
        status: "PENDING",
        // Власну заявку погоджувати не можна за жодних умов.
        ...(session.employeeId ? { employeeId: { not: session.employeeId } } : {}),
      },
      OR: or,
    },
    include: approvalInclude,
    orderBy: { createdAt: "asc" },
  });

  // Активний лише той крок, до якого дійшов маршрут.
  return approvals.filter((a) => a.step === a.request.currentStep);
}

export async function countPendingApprovalsFor(session: Session): Promise<number> {
  const approvals = await getPendingApprovalsFor(session);
  return approvals.length;
}

/** Заявки конкретного співробітника. */
export async function getRequestsForEmployee(employeeId: string) {
  return prisma.leaveRequest.findMany({
    where: { employeeId },
    include: {
      leaveType: { select: { id: true, nameUk: true, icon: true, colorHex: true } },
      approvals: {
        orderBy: { step: "asc" },
        include: {
          approver: { select: { firstName: true, lastName: true } },
          decidedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ startDate: "desc" }],
  });
}

/** Одна заявка з усім потрібним для сторінки деталей. */
export async function getRequestById(id: string) {
  return prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          managerId: true,
          position: { select: { title: true } },
          department: { select: { name: true } },
        },
      },
      leaveType: true,
      approvals: {
        orderBy: { step: "asc" },
        include: {
          approver: { select: { firstName: true, lastName: true } },
          decidedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

export { getEmployeeBalances } from "@/server/services/balance";
