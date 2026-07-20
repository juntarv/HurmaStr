import type { Session } from "@/lib/auth";

/**
 * Правила доступу.
 *
 * Принциповий момент: право ПОГОДЖУВАТИ визначається структурно
 * (ти керівник заявника або керівник його відділу), а не роллю User.role.
 * Керівник команди цілком може мати роль EMPLOYEE — і все одно мусить
 * бачити свою чергу погоджень.
 */

export function isAdmin(session: Session): boolean {
  return session.role === "ADMIN";
}

export function isHrOrAdmin(session: Session): boolean {
  return session.role === "ADMIN" || session.role === "HR";
}

/** Створення/редагування кадрових карток, звільнення. */
export function canManageEmployees(session: Session): boolean {
  return isHrOrAdmin(session);
}

/** Довідники: відділи, посади, типи відсутностей, виробничий календар. */
export function canManageDirectories(session: Session): boolean {
  return isHrOrAdmin(session);
}

/** Керування акаунтами і ролями — лише адміністратор. */
export function canManageUsers(session: Session): boolean {
  return isAdmin(session);
}

/** Ручне коригування балансів днів. */
export function canAdjustBalances(session: Session): boolean {
  return isHrOrAdmin(session);
}

/** Перегляд платіжних даних (сума, гаманець) — HR/адмін і сам співробітник. */
export function canViewPayroll(
  session: Session,
  employee: { id: string },
): boolean {
  return isHrOrAdmin(session) || isSelf(session, employee.id);
}

export function isSelf(session: Session, employeeId: string | null | undefined): boolean {
  return !!session.employeeId && !!employeeId && session.employeeId === employeeId;
}

/**
 * Чутливі поля картки: особиста пошта, контакт для екстрених випадків,
 * табельний номер, службова нотатка, причина звільнення.
 * Решта довідника (ПІБ, посада, відділ, робочі контакти) відкрита всім своїм.
 */
export function canViewSensitive(
  session: Session,
  employee: { id: string; managerId?: string | null },
): boolean {
  return (
    isHrOrAdmin(session) ||
    isSelf(session, employee.id) ||
    (!!session.employeeId && employee.managerId === session.employeeId)
  );
}

/**
 * Рішення по кроку погодження.
 * Заборонено погоджувати власну заявку — навіть адміністратору.
 */
export function canDecideApproval(
  session: Session,
  step: { role: "MANAGER" | "HR"; approverId: string | null },
  request: { employeeId: string },
): boolean {
  if (isSelf(session, request.employeeId)) return false;
  if (step.approverId && session.employeeId === step.approverId) return true;
  if (step.role === "HR" && isHrOrAdmin(session)) return true;
  // Адміністратор — запасний погоджувач, якщо призначений керівник недоступний.
  return isAdmin(session);
}

/**
 * Чи видно деталі відсутності (тип, коментар) у спільному календарі.
 * Медичні типи ховаємо від усіх, крім самого співробітника,
 * його керівника і HR — стороннім показуємо просто «Відсутній».
 */
export function canSeeLeaveDetails(
  session: Session,
  leave: { employeeId: string; employeeManagerId?: string | null },
  isMedical: boolean,
): boolean {
  if (!isMedical) return true;
  return (
    isHrOrAdmin(session) ||
    isSelf(session, leave.employeeId) ||
    (!!session.employeeId && leave.employeeManagerId === session.employeeId)
  );
}
