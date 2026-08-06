"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canDecideApproval, isHrOrAdmin, isSelf, managerSet } from "@/lib/permissions";
import { rangesOverlap, toDateOnly } from "@/lib/dates";
import {
  buildApprovalRoute,
  calcLeaveDays,
  nextRequestNumber,
  validateSubmission,
} from "@/server/services/leave";
import { getBalanceForType } from "@/server/services/balance";
import { isAllowedUpload, saveLeaveAttachment } from "@/lib/uploads";

export type LeaveActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; warnings?: string[] };

const requestSchema = z.object({
  leaveTypeId: z.string().min(1, "Оберіть тип відсутності"),
  startDate: z.coerce.date({ error: "Вкажіть дату початку" }),
  endDate: z.coerce.date({ error: "Вкажіть дату завершення" }),
  comment: z.string().max(1000).nullable(),
  documentNumber: z.string().max(60).nullable(),
});

function revalidateLeaves(requestId?: string) {
  revalidatePath("/");
  revalidatePath("/leaves");
  revalidatePath("/leaves/approvals");
  revalidatePath("/leaves/balances");
  revalidatePath("/calendar");
  if (requestId) revalidatePath(`/leaves/${requestId}`);
}

// ============================ СТВОРЕННЯ ЗАЯВКИ ===============================

export async function createLeaveRequestAction(
  _prev: LeaveActionResult | null,
  formData: FormData,
): Promise<LeaveActionResult> {
  const session = await requireSession();
  if (!session.employeeId) {
    return { ok: false, error: "Ваш акаунт не пов'язаний з карткою співробітника" };
  }

  const parsed = requestSchema.safeParse({
    leaveTypeId: String(formData.get("leaveTypeId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    comment: String(formData.get("comment") ?? "").trim() || null,
    documentNumber: String(formData.get("documentNumber") ?? "").trim() || null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { leaveTypeId, comment, documentNumber } = parsed.data;
  const startDate = toDateOnly(parsed.data.startDate);
  const endDate = toDateOnly(parsed.data.endDate);

  const type = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!type || !type.isActive) return { ok: false, error: "Невідомий тип відсутності" };

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: session.employeeId },
    select: {
      id: true,
      managerId: true,
      coManagers: { select: { id: true } },
      department: { select: { headId: true } },
    },
  });

  const days = calcLeaveDays(type, startDate, endDate);
  const year = startDate.getUTCFullYear();

  const [balance, activeRequests] = await Promise.all([
    getBalanceForType(employee.id, type.id),
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id, status: { in: ["PENDING", "APPROVED"] } },
      select: { number: true, startDate: true, endDate: true },
    }),
  ]);

  const overlaps = activeRequests.filter((r) =>
    rangesOverlap(startDate, endDate, r.startDate, r.endDate),
  );

  const issues = validateSubmission({
    startDate,
    endDate,
    days,
    type,
    documentNumber,
    tracksBalance: balance.tracks,
    available: balance.available,
    overlaps,
  });

  const blocking = issues.filter((i) => i.blocking);
  if (blocking.length > 0) {
    return {
      ok: false,
      error: blocking[0].message,
      warnings: issues.filter((i) => !i.blocking).map((i) => i.message),
    };
  }

  // Фото/скан довідки (не обов'язкове).
  let attachment: { attachmentPath: string; attachmentName: string; attachmentMime: string } | null = null;
  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    if (!isAllowedUpload(file)) {
      return { ok: false, error: "Дозволені лише зображення чи PDF до 10 МБ" };
    }
    const saved = await saveLeaveAttachment(file);
    attachment = {
      attachmentPath: saved.storedName,
      attachmentName: saved.originalName,
      attachmentMime: saved.mime,
    };
  }

  const route = await buildApprovalRoute({
    employeeId: employee.id,
    managerIds: managerSet(employee),
    departmentHeadId: employee.department?.headId ?? null,
    route: type.approvalRoute,
  });

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.leaveRequest.create({
      data: {
        number: await nextRequestNumber(year),
        employeeId: employee.id,
        leaveTypeId: type.id,
        startDate,
        endDate,
        daysCount: days,
        unitSnapshot: type.unit,
        comment,
        documentNumber,
        ...(attachment ?? {}),
        submittedAt: new Date(),
        status: route.autoApprove ? "APPROVED" : "PENDING",
        currentStep: route.autoApprove ? 0 : 1,
        decidedAt: route.autoApprove ? new Date() : null,
      },
    });

    if (!route.autoApprove) {
      await tx.leaveApproval.createMany({
        data: route.steps.map((step) => ({
          requestId: request.id,
          step: step.step,
          role: step.role,
          approverId: step.approverId,
        })),
      });
    }
    return request;
  });

  revalidateLeaves(created.id);
  redirect(`/leaves/${created.id}`);
}

// =========================== РІШЕННЯ ПО ЗАЯВЦІ ===============================

export async function decideApprovalAction(
  _prev: LeaveActionResult | null,
  formData: FormData,
): Promise<LeaveActionResult> {
  const session = await requireSession();

  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!approvalId || !["APPROVE", "REJECT"].includes(decision)) {
    return { ok: false, error: "Некоректне рішення" };
  }

  const approval = await prisma.leaveApproval.findUnique({
    where: { id: approvalId },
    include: {
      request: {
        select: {
          id: true,
          employeeId: true,
          status: true,
          currentStep: true,
          employee: {
            select: {
              managerId: true,
              coManagers: { select: { id: true } },
              department: { select: { headId: true } },
            },
          },
        },
      },
    },
  });
  if (!approval) return { ok: false, error: "Крок погодження не знайдено" };

  const { request } = approval;
  if (request.status !== "PENDING" || approval.status !== "PENDING") {
    return { ok: false, error: "Рішення по цій заявці вже ухвалено" };
  }
  if (approval.step !== request.currentStep) {
    return { ok: false, error: "Зараз черга іншого погоджувача" };
  }

  // Керівник заявника (основний + додаткові + керівник відділу).
  const managers = managerSet(request.employee);
  const headId = request.employee.department?.headId;
  const isManager =
    !!session.employeeId &&
    (managers.includes(session.employeeId) || headId === session.employeeId);

  if (!canDecideApproval(session, { role: approval.role }, { employeeId: request.employeeId, isManager })) {
    return { ok: false, error: "У вас немає права погоджувати цю заявку" };
  }

  const totalSteps = await prisma.leaveApproval.count({ where: { requestId: request.id } });

  await prisma.$transaction(async (tx) => {
    await tx.leaveApproval.update({
      where: { id: approval.id },
      data: {
        status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
        decidedById: session.employeeId,
        decidedAt: new Date(),
        comment,
      },
    });

    if (decision === "REJECT") {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      await tx.leaveApproval.updateMany({
        where: { requestId: request.id, status: "PENDING" },
        data: { status: "SKIPPED" },
      });
    } else if (approval.step >= totalSteps) {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", decidedAt: new Date() },
      });
    } else {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { currentStep: approval.step + 1 },
      });
    }
  });

  revalidateLeaves(request.id);
  return { ok: true, message: decision === "APPROVE" ? "Заявку погоджено" : "Заявку відхилено" };
}

// ============================= СКАСУВАННЯ ====================================

export async function cancelRequestAction(
  _prev: LeaveActionResult | null,
  formData: FormData,
): Promise<LeaveActionResult> {
  const session = await requireSession();

  const requestId = String(formData.get("requestId") ?? "");
  const reason = String(formData.get("cancelReason") ?? "").trim() || null;

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    select: { id: true, employeeId: true, status: true },
  });
  if (!request) return { ok: false, error: "Заявку не знайдено" };

  const isOwner = isSelf(session, request.employeeId);
  if (!isOwner && !isHrOrAdmin(session)) {
    return { ok: false, error: "Скасувати заявку може автор або HR" };
  }
  if (request.status !== "PENDING" && request.status !== "APPROVED") {
    return { ok: false, error: "Цю заявку вже не можна скасувати" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    await tx.leaveApproval.updateMany({
      where: { requestId: request.id, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
  });

  revalidateLeaves(request.id);
  return { ok: true, message: "Заявку скасовано" };
}
