"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageDirectories } from "@/lib/permissions";

export type DirectoryResult = { ok: true; message?: string } | { ok: false; error: string };

const departmentSchema = z.object({
  name: z.string().min(2, "Назва щонайменше 2 символи").max(80),
  description: z.string().max(500).nullable(),
  parentId: z.string().nullable(),
  headId: z.string().nullable(),
});

function read(formData: FormData) {
  const value = (key: string) => {
    const raw = formData.get(key);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed === "" ? null : trimmed;
  };
  return {
    name: value("name") ?? "",
    description: value("description"),
    parentId: value("parentId"),
    headId: value("headId"),
  };
}

/** Відділ не може стати власним предком — інакше дерево зациклиться. */
async function wouldCycle(departmentId: string, parentId: string): Promise<boolean> {
  if (departmentId === parentId) return true;
  let current: string | null = parentId;
  const seen = new Set<string>();
  while (current) {
    if (current === departmentId) return true;
    if (seen.has(current)) break;
    seen.add(current);
    const parent: { parentId: string | null } | null = await prisma.department.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }
  return false;
}

export async function createDepartmentAction(
  _prev: DirectoryResult | null,
  formData: FormData,
): Promise<DirectoryResult> {
  const session = await requireSession();
  if (!canManageDirectories(session)) return { ok: false, error: "Недостатньо прав" };

  const parsed = departmentSchema.safeParse(read(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const exists = await prisma.department.findUnique({ where: { name: parsed.data.name } });
  if (exists) return { ok: false, error: "Відділ з такою назвою вже існує" };

  await prisma.department.create({ data: parsed.data });
  revalidatePath("/departments");
  revalidatePath("/employees");
  return { ok: true, message: "Відділ створено" };
}

export async function updateDepartmentAction(
  _prev: DirectoryResult | null,
  formData: FormData,
): Promise<DirectoryResult> {
  const session = await requireSession();
  if (!canManageDirectories(session)) return { ok: false, error: "Недостатньо прав" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не вказано відділ" };

  const parsed = departmentSchema.safeParse(read(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (parsed.data.parentId && (await wouldCycle(id, parsed.data.parentId))) {
    return { ok: false, error: "Такий батьківський відділ створить цикл" };
  }

  const nameOwner = await prisma.department.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (nameOwner && nameOwner.id !== id) {
    return { ok: false, error: "Відділ з такою назвою вже існує" };
  }

  await prisma.department.update({ where: { id }, data: parsed.data });
  revalidatePath("/departments");
  revalidatePath("/employees");
  return { ok: true, message: "Відділ оновлено" };
}

export async function archiveDepartmentAction(
  _prev: DirectoryResult | null,
  formData: FormData,
): Promise<DirectoryResult> {
  const session = await requireSession();
  if (!canManageDirectories(session)) return { ok: false, error: "Недостатньо прав" };

  const id = String(formData.get("id") ?? "");
  const employees = await prisma.employee.count({ where: { departmentId: id, isArchived: false } });
  if (employees > 0) {
    return {
      ok: false,
      error: `У відділі ще ${employees} активних співробітників — спершу переведіть їх в інший відділ`,
    };
  }

  await prisma.department.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/departments");
  return { ok: true, message: "Відділ архівовано" };
}
