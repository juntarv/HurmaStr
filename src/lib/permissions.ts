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

/** Чи є користувач одним із керівників (основний + додаткові). */
export function isManagerOf(session: Session, managerIds: (string | null | undefined)[]): boolean {
  return !!session.employeeId && managerIds.some((id) => id === session.employeeId);
}

/** Усі керівники співробітника: основний + додаткові (co-managers). */
export function managerSet(e: {
  managerId?: string | null;
  coManagers?: { id: string }[];
}): string[] {
  const s = new Set<string>();
  if (e.managerId) s.add(e.managerId);
  for (const m of e.coManagers ?? []) if (m.id) s.add(m.id);
  return [...s];
}

/**
 * Чутливі поля картки: особиста пошта, контакт для екстрених випадків,
 * службова нотатка, причина звільнення.
 * Решта довідника (ПІБ, посада, відділ, робочі контакти) відкрита всім своїм.
 */
export function canViewSensitive(
  session: Session,
  employee: { id: string; managerIds?: (string | null | undefined)[] },
): boolean {
  return (
    isHrOrAdmin(session) ||
    isSelf(session, employee.id) ||
    isManagerOf(session, employee.managerIds ?? [])
  );
}

/**
 * Рішення по кроку погодження.
 * Заборонено погоджувати власну заявку — навіть адміністратору.
 * isManager — чи є користувач одним із керівників заявника.
 */
export function canDecideApproval(
  session: Session,
  step: { role: "MANAGER" | "HR" },
  request: { employeeId: string; isManager?: boolean },
): boolean {
  if (isSelf(session, request.employeeId)) return false;
  if (step.role === "MANAGER" && request.isManager) return true;
  if (step.role === "HR" && isHrOrAdmin(session)) return true;
  // Адміністратор — запасний погоджувач, якщо призначений керівник недоступний.
  return isAdmin(session);
}

/**
 * Чи видно деталі відсутності (тип, коментар) у спільному календарі.
 * Медичні типи ховаємо від усіх, крім самого співробітника,
 * його керівників і HR — стороннім показуємо просто «Відсутній».
 */
export function canSeeLeaveDetails(
  session: Session,
  leave: { employeeId: string; managerIds?: (string | null | undefined)[] },
  isMedical: boolean,
): boolean {
  if (!isMedical) return true;
  return (
    isHrOrAdmin(session) ||
    isSelf(session, leave.employeeId) ||
    isManagerOf(session, leave.managerIds ?? [])
  );
}
