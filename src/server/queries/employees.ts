import { prisma } from "@/lib/prisma";
import type { EmployeeStatus } from "@/generated/prisma/enums";

export type EmployeeFilters = {
  q?: string;
  departmentId?: string;
  status?: EmployeeStatus;
  /**
   * Показати звільнених та архівних. Дозволено ЛИШЕ адміністратору —
   * викликач мусить сам це гарантувати (щоб звільнених не бачив ніхто інший).
   */
  showTerminated?: boolean;
};

/**
 * Список співробітників із пошуком і фільтрами.
 * Пошук іде по searchKey — денормалізованому полю в нижньому регістрі,
 * бо SQLite не вміє insensitive-пошук по кирилиці.
 *
 * Звільнених (status TERMINATED) і архівних видно лише коли showTerminated=true;
 * за замовчуванням список містить тих, хто працює.
 */
export async function listEmployees(filters: EmployeeFilters = {}) {
  const query = filters.q?.trim().toLowerCase();

  return prisma.employee.findMany({
    where: {
      // Без явного показу — приховуємо і архівних, і звільнених.
      ...(filters.showTerminated ? {} : { isArchived: false, status: { not: "TERMINATED" } }),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(query ? { searchKey: { contains: query } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      avatarUrl: true,
      workEmail: true,
      phone: true,
      telegram: true,
      status: true,
      isArchived: true,
      hireDate: true,
      birthDate: true,
      position: { select: { title: true } },
      department: { select: { id: true, name: true } },
      account: { select: { id: true, lastLoginAt: true, inviteAcceptedAt: true, isActive: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getEmployeeById(id: string) {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      position: true,
      department: { select: { id: true, name: true } },
      manager: {
        select: { id: true, firstName: true, lastName: true, avatarUrl: true },
      },
      subordinates: {
        where: { isArchived: false },
        select: { id: true, firstName: true, lastName: true, avatarUrl: true, position: { select: { title: true } } },
        orderBy: [{ lastName: "asc" }],
      },
      account: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          inviteSentAt: true,
          inviteAcceptedAt: true,
        },
      },
      headedDepartments: { select: { id: true, name: true } },
    },
  });
}

/** Довідники для випадайок у формі картки. */
export async function getEmployeeFormOptions(excludeEmployeeId?: string) {
  const [departments, positions, managers] = await Promise.all([
    prisma.department.findMany({
      where: { isArchived: false },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.position.findMany({
      where: { isArchived: false },
      select: { id: true, title: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.findMany({
      where: {
        isArchived: false,
        status: { not: "TERMINATED" },
        ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }],
    }),
  ]);

  return { departments, positions, managers };
}

/**
 * Карта оргструктури: компанія → відділи з керівниками, лічильниками
 * та аватарами. Плюс топ-керівники (без керівника над собою).
 */
export async function getDepartmentOrgMap() {
  const [departments, headcount, topManagers] = await Promise.all([
    prisma.department.findMany({
      where: { isArchived: false },
      select: {
        id: true,
        name: true,
        icon: true,
        colorHex: true,
        head: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, position: { select: { title: true } } } },
        employees: {
          where: { isArchived: false, status: { not: "TERMINATED" } },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          orderBy: [{ lastName: "asc" }],
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.count({ where: { isArchived: false, status: { not: "TERMINATED" } } }),
    // Керівництво у верхньому вузлі — це співробітники відділу «Менеджмент»
    // (CEO/COO), а не всі, у кого немає керівника (інакше туди потрапляють
    // системний адмін без відділу та тімліди без призначеного керівника).
    prisma.employee.findMany({
      where: {
        isArchived: false,
        status: { not: "TERMINATED" },
        department: { name: "Менеджмент" },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        position: { select: { title: true } },
        department: { select: { name: true } },
        _count: { select: { subordinates: true } },
      },
      orderBy: [{ position: { sortOrder: "asc" } }, { lastName: "asc" }],
    }),
  ]);

  return { departments, headcount, topManagers };
}

/** Оргдерево: усі активні співробітники з посиланням на керівника. */
export async function getOrgTree() {
  const employees = await prisma.employee.findMany({
    where: { isArchived: false, status: { not: "TERMINATED" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      managerId: true,
      position: { select: { title: true } },
      department: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }],
  });

  type Node = (typeof employees)[number] & { children: Node[] };

  const byId = new Map<string, Node>();
  for (const employee of employees) byId.set(employee.id, { ...employee, children: [] });

  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.managerId ? byId.get(node.managerId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
