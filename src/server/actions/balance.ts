"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canAdjustBalances } from "@/lib/permissions";
import { getBalanceForType, round1 } from "@/server/services/balance";

export type BalanceAdjustResult = { ok: true; message?: string } | { ok: false; error: string };

const schema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1, "Оберіть тип"),
  mode: z.enum(["set", "add"]),
  value: z.coerce
    .number({ error: "Вкажіть кількість днів" })
    .refine((n) => Math.abs(n) <= 999, "Забагато днів"),
  reason: z.string().min(2, "Вкажіть причину").max(200),
});

/**
 * Ручна зміна балансу днів (лише HR/адмін).
 *
 * mode = "set" — ВСТАНОВИТИ доступний баланс рівно на value (головний
 *   сценарій міграції: «у людини вже 15 днів»). Система рахує потрібне
 *   коригування = value − поточний_доступний і зберігає його.
 * mode = "add" — ДОДАТИ ±value днів (корекція).
 *
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
    mode: String(formData.get("mode") ?? "set"),
    value: String(formData.get("value") ?? ""),
    reason: String(formData.get("reason") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { employeeId, leaveTypeId, mode, value, reason } = parsed.data;

  const type = await prisma.leaveType.findUnique({
    where: { id: leaveTypeId },
    select: { accrualMode: true, affectsBalance: true, nameUk: true },
  });
  if (!type || !type.affectsBalance || type.accrualMode === "NONE") {
    return { ok: false, error: "Цей тип не веде облік днів" };
  }

  // Обчислюємо фактичну зміну (days), яку записуємо коригуванням.
  let days: number;
  if (mode === "set") {
    if (value < 0) return { ok: false, error: "Баланс не може бути від'ємним" };
    const current = await getBalanceForType(employeeId, leaveTypeId);
    days = round1(value - current.available);
    if (days === 0) return { ok: true, message: `Баланс уже дорівнює ${value} дн.` };
  } else {
    if (value === 0) return { ok: false, error: "Кількість не може бути 0" };
    days = round1(value);
  }

  await prisma.leaveAdjustment.create({
    data: {
      employeeId,
      leaveTypeId,
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
    message:
      mode === "set"
        ? `Баланс «${type.nameUk}» встановлено на ${value} дн.`
        : `Баланс «${type.nameUk}» змінено на ${days > 0 ? "+" : ""}${days} дн.`,
  };
}
