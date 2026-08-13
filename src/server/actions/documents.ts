"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { canManageEmployees } from "@/lib/permissions";
import {
  deleteEmployeeDocument,
  isAllowedDocument,
  saveEmployeeDocument,
} from "@/lib/uploads";
import type { DocumentKind } from "@/generated/prisma/enums";

export type DocumentResult = { ok: true; message?: string } | { ok: false; error: string };

const KINDS: DocumentKind[] = ["OFFER", "JOB_DESCRIPTION"];

/**
 * Завантаження оферу/посадової інструкції. Лише HR/адмін.
 * Один документ кожного типу: новий файл замінює попередній.
 */
export async function uploadEmployeeDocumentAction(
  _prev: DocumentResult | null,
  formData: FormData,
): Promise<DocumentResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };

  const employeeId = String(formData.get("employeeId") ?? "");
  const kind = String(formData.get("kind") ?? "") as DocumentKind;
  if (!employeeId || !KINDS.includes(kind)) return { ok: false, error: "Некоректний запит" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Оберіть файл" };
  }
  if (!isAllowedDocument(file)) {
    return { ok: false, error: "Дозволено PDF, DOC/DOCX або зображення до 10 МБ" };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!employee) return { ok: false, error: "Співробітника не знайдено" };

  const storedName = await saveEmployeeDocument(file);

  // Замінюємо документ цього типу; старий файл прибираємо з диска.
  const previous = await prisma.employeeDocument.findUnique({
    where: { employeeId_kind: { employeeId, kind } },
    select: { storedName: true },
  });
  await prisma.employeeDocument.upsert({
    where: { employeeId_kind: { employeeId, kind } },
    create: {
      employeeId,
      kind,
      fileName: file.name,
      storedName,
      mime: file.type,
      size: file.size,
      uploadedById: session.employeeId,
    },
    update: {
      fileName: file.name,
      storedName,
      mime: file.type,
      size: file.size,
      uploadedById: session.employeeId,
    },
  });
  if (previous) await deleteEmployeeDocument(previous.storedName);

  revalidatePath(`/employees/${employeeId}`);
  return { ok: true, message: "Документ завантажено" };
}

/** Видалення документа. Лише HR/адмін. */
export async function deleteEmployeeDocumentAction(documentId: string): Promise<DocumentResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };

  const doc = await prisma.employeeDocument.findUnique({
    where: { id: documentId },
    select: { id: true, employeeId: true, storedName: true },
  });
  if (!doc) return { ok: false, error: "Документ не знайдено" };

  await prisma.employeeDocument.delete({ where: { id: doc.id } });
  await deleteEmployeeDocument(doc.storedName);

  revalidatePath(`/employees/${doc.employeeId}`);
  return { ok: true, message: "Документ видалено" };
}
