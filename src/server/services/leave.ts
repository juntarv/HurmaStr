import { prisma } from "@/lib/prisma";
import { countCalendarDays, countWorkingDays, toDateOnly } from "@/lib/dates";
import { round1 } from "@/server/services/balance";
import type { ApproverRole, LeaveUnit } from "@/generated/prisma/enums";

// ========================= РОЗРАХУНОК ДНІВ ===================================

export type LeaveTypeRules = { unit: LeaveUnit };

/**
 * Тривалість відсутності.
 * WORKING_DAYS — лише робочі дні (без субот і неділь). Це режим за замовчуванням.
 * CALENDAR_DAYS — усі дні поспіль.
 */
export function calcLeaveDays(rules: LeaveTypeRules, from: Date, to: Date): number {
  return rules.unit === "WORKING_DAYS"
    ? countWorkingDays(from, to)
    : countCalendarDays(from, to);
}

// ====================== МАРШРУТ ПОГОДЖЕННЯ ===================================

export type RouteStep = {
  step: number;
  role: ApproverRole;
  approverId: string | null;
};

export type RouteResult = {
  steps: RouteStep[];
  /** Немає кому погоджувати — заявка має бути погоджена автоматично. */
  autoApprove: boolean;
  autoApproveReason?: string;
};

/**
 * Будує маршрут погодження.
 *
 * Головна вимога: маршрут НІКОЛИ не має залишити заявку без погоджувача —
 * інакше вона зависає в статусі «На погодженні» назавжди.
 * Тому кроки без реального виконавця пропускаються, а якщо не лишилось
 * жодного — заявка погоджується автоматично з явною позначкою.
 */
export async function buildApprovalRoute(params: {
  employeeId: string;
  /** Усі керівники (основний + додаткові). Погодити може будь-хто з них. */
  managerIds: string[];
  departmentHeadId: string | null;
  route: "MANAGER_THEN_HR" | "MANAGER_ONLY" | "HR_ONLY";
}): Promise<RouteResult> {
  const { employeeId, managerIds, departmentHeadId, route } = params;

  // Погоджувачі-керівники: явні керівники, інакше — керівник відділу. Себе не рахуємо.
  const managers = [...new Set(managerIds.filter((m) => m && m !== employeeId))];
  const hasManagerApprover =
    managers.length > 0 || (!!departmentHeadId && departmentHeadId !== employeeId);

  const wantsManager = route === "MANAGER_THEN_HR" || route === "MANAGER_ONLY";
  const wantsHr = route === "MANAGER_THEN_HR" || route === "HR_ONLY";

  const steps: RouteStep[] = [];
  // Крок керівника — рольовий: погоджує будь-хто з керівників заявника.
  if (wantsManager && hasManagerApprover) {
    steps.push({ step: steps.length + 1, role: "MANAGER", approverId: null });
  }

  if (wantsHr) {
    const otherHrExists = await prisma.user.count({
      where: { isActive: true, role: { in: ["HR", "ADMIN"] }, NOT: { employeeId } },
    });
    if (otherHrExists > 0) {
      steps.push({ step: steps.length + 1, role: "HR", approverId: null });
    }
  }

  if (steps.length === 0) {
    return {
      steps: [],
      autoApprove: true,
      autoApproveReason: hasManagerApprover
        ? "Немає доступного погоджувача HR"
        : "У співробітника не призначено керівника, а вільного HR-погоджувача немає",
    };
  }

  return { steps, autoApprove: false };
}

// ========================= ПРАВИЛА ПОДАННЯ ===================================

export type ValidationIssue = { code: string; message: string; blocking: boolean };

export type SubmitContext = {
  startDate: Date;
  endDate: Date;
  days: number;
  type: {
    nameUk: string;
    minNoticeDays: number;
    allowPastDates: boolean;
    allowNegativeBalance: boolean;
    affectsBalance: boolean;
    requiresDocument: boolean;
  };
  documentNumber?: string | null;
  tracksBalance: boolean;
  available: number;
  overlaps: { number: string; startDate: Date; endDate: Date }[];
};

export function validateSubmission(ctx: SubmitContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const today = toDateOnly(new Date());
  const start = toDateOnly(ctx.startDate);
  const end = toDateOnly(ctx.endDate);

  if (end < start) {
    issues.push({ code: "RANGE", message: "Дата завершення не може бути раніше за дату початку", blocking: true });
    return issues;
  }

  if (ctx.days <= 0) {
    issues.push({ code: "NO_DAYS", message: "У вибраному періоді немає жодного робочого дня", blocking: true });
  }

  if (!ctx.type.allowPastDates && start < today) {
    issues.push({ code: "PAST", message: `Тип «${ctx.type.nameUk}» не можна оформити заднім числом`, blocking: true });
  }

  if (ctx.type.minNoticeDays > 0) {
    const deadline = new Date(today);
    deadline.setUTCDate(deadline.getUTCDate() + ctx.type.minNoticeDays);
    if (start < deadline && start >= today) {
      issues.push({
        code: "NOTICE",
        message: `Заявку варто подавати щонайменше за ${ctx.type.minNoticeDays} дн. до початку`,
        blocking: false,
      });
    }
  }

  if (ctx.overlaps.length > 0) {
    issues.push({ code: "OVERLAP", message: `Період перетинається з заявкою ${ctx.overlaps[0].number}`, blocking: true });
  }

  if (ctx.type.requiresDocument && !ctx.documentNumber?.trim()) {
    issues.push({ code: "DOCUMENT", message: `Для типу «${ctx.type.nameUk}» треба вказати номер довідки`, blocking: false });
  }

  if (ctx.tracksBalance && ctx.days > ctx.available) {
    issues.push({
      code: "BALANCE",
      message: `Не вистачає днів: доступно ${round1(ctx.available)}, потрібно ${round1(ctx.days)}`,
      blocking: !ctx.type.allowNegativeBalance,
    });
  }

  return issues;
}

// ========================= НОМЕР ЗАЯВКИ ======================================

export async function nextRequestNumber(year: number): Promise<string> {
  const prefix = `ЗВ-${year}-`;
  const last = await prisma.leaveRequest.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const lastSeq = last ? Number(last.number.slice(prefix.length)) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(6, "0")}`;
}
