"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canAdjustBalances } from "@/lib/permissions";

export type BalanceAdjustResult = { ok: true; message?: string } | { ok: false; error: string };

const schema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1, "Оберіть тип"),
  days: z.coerce
    .number({ error: "Вкажіть кількість днів" })
    .refine((n) => n !== 0, "Кількість не може бути 0")
    .refine((n) => Math.abs(n) <= 400, "Забагато днів"),
  reason: z.string().min(2, "Вкажіть причину").max(200),
});

/**
 * Ручне коригування балансу днів (± днів).
 * Основний сценарій — перенесення залишку з іншого сервісу при міграції.
 * Для щомісячних типів (відпустка) коригування безстрокове (year = null),
 * для річних (лікарняні) — прив'язується до поточного року.
 */
export async function adjustBalanceAction(
  _prev: BalanceAdjustResult | null,
  formData: FormData,
): Promise<BalanceAdjustResult> {
  const session = await requireSession();
  if (!canAdjustBalances(session)) return { ok: false, error: "Недостатньо прав" };

  const parsed = schema.safeParse({
    employeeId: String(formData.get("employeeId") ?? ""),
    leaveTypeId: String(formData.get("leaveTypeId") ?? ""),
    days: String(formData.get("days") ?? ""),
    reason: String(formData.get("reason") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { employeeId, leaveTypeId, days, reason } = parsed.data;

  const type = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: { accrualMode: true, affectsBalance: true, nameUk: true },
  });
  if (!type || !type.affectsBalance || type.accrualMode === "NONE") {
    return { ok: false, error: "Цей тип не веде облік днів" };
  }

  await prisma.leaveAdjustment.create({
    data: {
      employeeId,
      leaveTypeId,
      // MONTHLY — безстроково; ANNUAL — поточний рік.
      year: type.accrualMode === "MONTHLY" ? null : new Date().getUTCFullYear(),
      days,
      reason,
      createdById: session.employeeId,
    },
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/leaves/balances");
  revalidatePath("/leaves");
  revalidatePath("/");

  return {
    ok: true,
    message: `Баланс «${type.nameUk}» скориговано на ${days > 0 ? "+" : ""}${days} дн.`,
  };
}
