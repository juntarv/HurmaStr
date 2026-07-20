"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { isHrOrAdmin } from "@/lib/permissions";

export type AssetResult = { ok: true; message?: string } | { ok: false; error: string };

const categories = [
  "LAPTOP",
  "MONITOR",
  "PHONE",
  "TABLET",
  "PERIPHERAL",
  "FURNITURE",
  "ACCESS_CARD",
  "OTHER",
] as const;

const assetSchema = z.object({
  name: z.string().min(2, "Назва щонайменше 2 символи").max(120),
  category: z.enum(categories),
  inventoryNumber: z.string().max(60).nullable(),
  serialNumber: z.string().max(120).nullable(),
  purchaseDate: z.coerce.date().nullable(),
  note: z.string().max(1000).nullable(),
});

function read(formData: FormData) {
  const value = (key: string) => {
    const raw = formData.get(key);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    return trimmed === "" ? null : trimmed;
  };
  return {
    name: value("name") ?? "",
    category: value("category") ?? "OTHER",
    inventoryNumber: value("inventoryNumber"),
    serialNumber: value("serialNumber"),
    purchaseDate: value("purchaseDate"),
    note: value("note"),
  };
}

function refresh(employeeId?: string | null) {
  revalidatePath("/assets");
  if (employeeId) revalidatePath(`/employees/${employeeId}`);
}

export async function createAssetAction(
  _prev: AssetResult | null,
  formData: FormData,
): Promise<AssetResult> {
  const session = await requireSession();
  if (!isHrOrAdmin(session)) return { ok: false, error: "Недостатньо прав" };

  const parsed = assetSchema.safeParse(read(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  if (parsed.data.inventoryNumber) {
    const taken = await prisma.asset.findUnique({
      where: { inventoryNumber: parsed.data.inventoryNumber },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "Такий інвентарний номер уже існує" };
  }

  await prisma.asset.create({ data: { ...parsed.data, status: "IN_STOCK" } });
  refresh();
  return { ok: true, message: "Одиницю майна додано" };
}

/** Видати майно співробітнику (або зняти видачу, якщо employeeId порожній). */
export async function assignAssetAction(
  _prev: AssetResult | null,
  formData: FormData,
): Promise<AssetResult> {
  const session = await requireSession();
  if (!isHrOrAdmin(session)) return { ok: false, error: "Недостатньо прав" };

  const assetId = String(formData.get("assetId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "").trim() || null;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, assignedToId: true, status: true },
  });
  if (!asset) return { ok: false, error: "Одиницю не знайдено" };
  if (asset.status === "WRITTEN_OFF") return { ok: false, error: "Списане майно не видається" };

  if (employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, status: true },
    });
    if (!employee || employee.status === "TERMINATED") {
      return { ok: false, error: "Не можна видати цьому співробітнику" };
    }
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      assignedToId: employeeId,
      assignedAt: employeeId ? new Date() : null,
      // Видача переводить у «Видано», зняття — на склад (якщо не в ремонті).
      status: employeeId ? "IN_USE" : asset.status === "REPAIR" ? "REPAIR" : "IN_STOCK",
    },
  });

  refresh(asset.assignedToId);
  refresh(employeeId);
  return { ok: true, message: employeeId ? "Майно видано" : "Видачу знято" };
}

export async function setAssetStatusAction(
  _prev: AssetResult | null,
  formData: FormData,
): Promise<AssetResult> {
  const session = await requireSession();
  if (!isHrOrAdmin(session)) return { ok: false, error: "Недостатньо прав" };

  const assetId = String(formData.get("assetId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["IN_USE", "IN_STOCK", "REPAIR", "WRITTEN_OFF"].includes(status)) {
    return { ok: false, error: "Невідомий статус" };
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { assignedToId: true },
  });
  if (!asset) return { ok: false, error: "Одиницю не знайдено" };

  // Ремонт/склад/списання знімають закріплення за людиною.
  const unassign = status !== "IN_USE";

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      status: status as "IN_USE" | "IN_STOCK" | "REPAIR" | "WRITTEN_OFF",
      ...(unassign ? { assignedToId: null, assignedAt: null } : {}),
    },
  });

  refresh(asset.assignedToId);
  return { ok: true, message: "Статус оновлено" };
}
