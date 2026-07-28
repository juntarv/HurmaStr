"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession, hashPassword } from "@/lib/auth";
import { canManageEmployees, isAdmin, isSelf } from "@/lib/permissions";
import {
  buildSearchKey,
  employeeCoreSchema,
  formValue,
  readEmployeeForm,
  readSelfContactsForm,
  selfContactsSchema,
} from "@/server/schemas/employee";
import { getBalanceForType, round1 } from "@/server/services/balance";

export type ActionResult =
  | { ok: true; message?: string; inviteLink?: string }
  | { ok: false; error: string };

/**
 * Керівник не може опинитися власним підлеглим — інакше оргдерево
 * зациклиться і рекурсивні обходи зависнуть.
 */
async function wouldCreateCycle(employeeId: string, managerId: string): Promise<boolean> {
  if (employeeId === managerId) return true;

  let current: string | null = managerId;
  const seen = new Set<string>();
  while (current) {
    if (current === employeeId) return true;
    if (seen.has(current)) break; // страховка від уже наявного циклу в даних
    seen.add(current);
    const parent: { managerId: string | null } | null = await prisma.employee.findUnique({
      where: { id: current },
      select: { managerId: true },
    });
    current = parent?.managerId ?? null;
  }
  return false;
}

function searchKeyFrom(data: {
  lastName: string;
  firstName: string;
  middleName: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  phone: string | null;
  telegram: string | null;
}): string {
  return buildSearchKey([
    data.lastName,
    data.firstName,
    data.middleName,
    data.workEmail,
    data.personalEmail,
    data.phone,
    data.telegram,
  ]);
}

// ============================ СТВОРЕННЯ ======================================

export async function createEmployeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };

  const parsed = employeeCoreSchema.safeParse(readEmployeeForm(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue.path.join(".") || "Форма"}: ${issue.message}` };
  }
  const input = parsed.data;

  if (input.workEmail) {
    const taken = await prisma.employee.findUnique({ where: { workEmail: input.workEmail } });
    if (taken) return { ok: false, error: "Такий робочий email уже використовується" };
  }

  let created;
  try {
    created = await prisma.employee.create({
      data: { ...input, searchKey: searchKeyFrom(input) },
      select: { id: true },
    });
  } catch {
    return { ok: false, error: "Не вдалося створити картку. Перевірте унікальні поля." };
  }

  // Міграція: якщо вказано вже накопичену відпустку — виставляємо баланс так,
  // щоб доступний залишок дорівнював цьому числу (коригуванням).
  const startVacRaw = formValue(formData, "startingVacationDays");
  if (startVacRaw != null) {
    const startVac = Number(startVacRaw);
    if (!Number.isNaN(startVac) && startVac > 0) {
      const vac = await prisma.leaveType.findFirst({
        where: { code: "VACATION", isActive: true },
        select: { id: true },
      });
      if (vac) {
        const bal = await getBalanceForType(created.id, vac.id);
        const delta = round1(startVac - bal.available);
        if (delta !== 0) {
          await prisma.leaveAdjustment.create({
            data: {
              employeeId: created.id,
              leaveTypeId: vac.id,
              year: null,
              days: delta,
              reason: "Перенесення залишку з попереднього сервісу",
              createdById: session.employeeId,
            },
          });
        }
      }
    }
  }

  revalidatePath("/employees");
  revalidatePath("/org");
  redirect(`/employees/${created.id}`);
}

// ============================ РЕДАГУВАННЯ ====================================

export async function updateEmployeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не вказано співробітника" };

  const parsed = employeeCoreSchema.safeParse(readEmployeeForm(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue.path.join(".") || "Форма"}: ${issue.message}` };
  }
  const input = parsed.data;

  if (input.managerId && (await wouldCreateCycle(id, input.managerId))) {
    return { ok: false, error: "Такий керівник створить цикл в оргструктурі" };
  }

  if (input.workEmail) {
    const taken = await prisma.employee.findUnique({
      where: { workEmail: input.workEmail },
      select: { id: true },
    });
    if (taken && taken.id !== id) {
      return { ok: false, error: "Такий робочий email уже використовується" };
    }
  }

  await prisma.employee.update({
    where: { id },
    data: { ...input, searchKey: searchKeyFrom(input) },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/org");
  redirect(`/employees/${id}`);
}

/**
 * Окрема дія для самостійного редагування контактів.
 * Навмисно НЕ ділить схему з updateEmployeeAction: інакше співробітник
 * міг би дописати в payload managerId або status і змінити собі посаду.
 */
export async function updateOwnContactsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.employeeId) return { ok: false, error: "Акаунт не пов'язаний з карткою" };

  const parsed = selfContactsSchema.safeParse(readSelfContactsForm(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: session.employeeId },
    select: {
      lastName: true,
      firstName: true,
      middleName: true,
      workEmail: true,
    },
  });

  await prisma.employee.update({
    where: { id: session.employeeId },
    data: {
      ...parsed.data,
      searchKey: searchKeyFrom({ ...employee, ...parsed.data }),
    },
  });

  revalidatePath("/profile");
  revalidatePath(`/employees/${session.employeeId}`);
  return { ok: true, message: "Контакти оновлено" };
}

// ======================= АРХІВ / ЗВІЛЬНЕННЯ ==================================

export async function setArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };
  if (isSelf(session, id)) return { ok: false, error: "Не можна архівувати власну картку" };

  await prisma.employee.update({
    where: { id },
    data: { isArchived: archived, archivedAt: archived ? new Date() : null },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  return { ok: true, message: archived ? "Картку архівовано" : "Картку відновлено" };
}

export async function terminateEmployeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };

  const id = String(formData.get("id") ?? "");
  const dateRaw = String(formData.get("terminationDate") ?? "");
  const reason = String(formData.get("terminationReason") ?? "").trim() || null;
  if (!id || !dateRaw) return { ok: false, error: "Вкажіть дату звільнення" };
  if (isSelf(session, id)) return { ok: false, error: "Не можна звільнити себе" };

  // Не-адмін не може звільнити (а отже вимкнути) адміністратора/HR.
  const targetAccount = await prisma.user.findFirst({ where: { employeeId: id }, select: { role: true } });
  if (targetAccount && (targetAccount.role === "ADMIN" || targetAccount.role === "HR") && !isAdmin(session)) {
    return { ok: false, error: "Звільнити адміністратора/HR може лише адміністратор" };
  }

  const terminationDate = new Date(dateRaw);
  if (Number.isNaN(terminationDate.getTime())) {
    return { ok: false, error: "Некоректна дата звільнення" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id },
      data: {
        status: "TERMINATED",
        terminationDate,
        terminationReason: reason,
        isArchived: true,
        archivedAt: new Date(),
      },
    });

    // Акаунт вимикаємо і знецінюємо всі його токени — доступ зникає миттєво.
    await tx.user.updateMany({
      where: { employeeId: id },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });

    // Підлеглих відв'язуємо, щоб оргдерево не вказувало на звільненого.
    await tx.employee.updateMany({ where: { managerId: id }, data: { managerId: null } });
    await tx.department.updateMany({ where: { headId: id }, data: { headId: null } });
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/org");
  return { ok: true, message: "Співробітника звільнено" };
}

// ============================= ДОСТУП У СИСТЕМУ ==============================

const credentialsSchema = z.object({
  email: z.email("Некоректний логін (email)"),
  password: z.string().min(6, "Пароль щонайменше 6 символів").max(100).or(z.literal("")),
  role: z.enum(["ADMIN", "HR", "MANAGER", "EMPLOYEE"]),
});

/**
 * Створює або оновлює обліковий запис співробітника: логін (email),
 * пароль і роль задає адміністратор/HR вручну. Без пошти й запрошень.
 * Порожній пароль при оновленні існуючого акаунта — лишає поточний.
 */
export async function setCredentialsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };

  const employeeId = String(formData.get("employeeId") ?? "");
  const parsed = credentialsSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    role: String(formData.get("role") ?? "EMPLOYEE"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, role } = parsed.data;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, status: true, account: { select: { id: true, role: true } } },
  });
  if (!employee) return { ok: false, error: "Співробітника не знайдено" };
  if (employee.status === "TERMINATED") {
    return { ok: false, error: "Не можна створити доступ звільненому співробітнику" };
  }

  // Ескалація привілеїв: лише адміністратор може призначати ролі ADMIN/HR
  // або редагувати доступ уже привілейованих акаунтів. Інакше HR міг би
  // підняти себе до ADMIN чи перехопити акаунт адміністратора.
  const currentRole = employee.account?.role ?? null;
  if (!isAdmin(session)) {
    if (role === "ADMIN" || role === "HR") {
      return { ok: false, error: "Ролі «Адміністратор» і «HR» може призначати лише адміністратор" };
    }
    if (currentRole === "ADMIN" || currentRole === "HR") {
      return { ok: false, error: "Змінювати доступ адміністратора/HR може лише адміністратор" };
    }
  }

  // Логін має бути унікальним серед усіх акаунтів.
  const emailOwner = await prisma.user.findUnique({
    where: { email },
    select: { id: true, employeeId: true },
  });
  if (emailOwner && emailOwner.employeeId !== employee.id) {
    return { ok: false, error: "Цей логін уже зайнятий іншим акаунтом" };
  }

  const isNew = !employee.account;
  if (isNew && !password) {
    return { ok: false, error: "Для нового акаунта потрібно задати пароль" };
  }

  const passwordData = password
    ? { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } }
    : {};

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role,
      isActive: true,
      employeeId: employee.id,
      passwordHash: password ? await hashPassword(password) : "",
      inviteAcceptedAt: new Date(),
    },
    update: {
      email,
      role,
      isActive: true,
      employeeId: employee.id,
      ...passwordData,
    },
  });

  revalidatePath(`/employees/${employee.id}`);
  revalidatePath("/employees");

  return {
    ok: true,
    message: isNew
      ? "Доступ створено. Передайте співробітнику логін і пароль."
      : password
        ? "Пароль оновлено, роль збережено."
        : "Роль оновлено.",
  };
}

/** Вимкнути доступ співробітника (без видалення картки). */
export async function disableAccessAction(employeeId: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };
  if (isSelf(session, employeeId)) return { ok: false, error: "Не можна вимкнути власний доступ" };

  const account = await prisma.user.findFirst({
    where: { employeeId },
    select: { role: true },
  });
  if (account && (account.role === "ADMIN" || account.role === "HR") && !isAdmin(session)) {
    return { ok: false, error: "Вимкнути доступ адміністратора/HR може лише адміністратор" };
  }

  await prisma.user.updateMany({
    where: { employeeId },
    data: { isActive: false, tokenVersion: { increment: 1 } },
  });
  revalidatePath(`/employees/${employeeId}`);
  return { ok: true, message: "Доступ вимкнено" };
}
