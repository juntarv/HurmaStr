"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageDirectories } from "@/lib/permissions";

export type PositionResult = { ok: true; message?: string } | { ok: false; error: string };

const schema = z.object({
  title: z.string().min(2, "Назва щонайменше 2 символи").max(100),
  departmentId: z.string().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  isManagerial: z.coerce.boolean(),
});

function read(formData: FormData) {
  const dep = String(formData.get("departmentId") ?? "").trim();
  const order = String(formData.get("sortOrder") ?? "").trim();
  return {
    title: String(formData.get("title") ?? "").trim(),
    departmentId: dep === "" ? null : dep,
    sortOrder: order === "" ? 0 : order,
    // checkbox: присутній у formData лише коли увімкнено
    isManagerial: formData.get("isManagerial") != null,
  };
}

export async function createPositionAction(
  _prev: PositionResult | null,
  formData: FormData,
): Promise<PositionResult> {
  const session = await requireSession();
  if (!canManageDirectories(session)) return { ok: false, error: "Недостатньо прав" };

  const parsed = schema.safeParse(read(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.position.create({ data: parsed.data });
  revalidatePath("/positions");
  revalidatePath("/employees/new");
  return { ok: true, message: "Посаду додано" };
}

export async function updatePositionAction(
  _prev: PositionResult | null,
  formData: FormData,
): Promise<PositionResult> {
  const session = await requireSession();
  if (!canManageDirectories(session)) return { ok: false, error: "Недостатньо прав" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не вказано посаду" };

  const parsed = schema.safeParse(read(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await prisma.position.update({ where: { id }, data: parsed.data });
  revalidatePath("/positions");
  revalidatePath("/employees");
  revalidatePath("/employees/new");
  return { ok: true, message: "Посаду оновлено" };
}

export async function archivePositionAction(id: string): Promise<PositionResult> {
  const session = await requireSession();
  if (!canManageDirectories(session)) return { ok: false, error: "Недостатньо прав" };

  const inUse = await prisma.employee.count({ where: { positionId: id, isArchived: false } });
  if (inUse > 0) {
    return {
      ok: false,
      error: `Посаду призначено ${inUse} співробітникам — спершу переведіть їх на іншу`,
    };
  }

  await prisma.position.update({ where: { id }, data: { isArchived: true } });
  revalidatePath("/positions");
  return { ok: true, message: "Посаду архівовано" };
}

export async function restorePositionAction(id: string): Promise<PositionResult> {
  const session = await requireSession();
  if (!canManageDirectories(session)) return { ok: false, error: "Недостатньо прав" };
  await prisma.position.update({ where: { id }, data: { isArchived: false } });
  revalidatePath("/positions");
  return { ok: true, message: "Посаду відновлено" };
}
