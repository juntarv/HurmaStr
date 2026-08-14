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

export type DocumentResult = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Завантаження кадрового документа (офер, посадова, NDA — будь-який).
 * Кількість документів не обмежена. Лише HR/адмін.
 * Назва опційна: без неї беремо ім'я файлу без розширення.
 */
export async function uploadEmployeeDocumentAction(
  _prev: DocumentResult | null,
  formData: FormData,
): Promise<DocumentResult> {
  const session = await requireSession();
  if (!canManageEmployees(session)) return { ok: false, error: "Недостатньо прав" };

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return { ok: false, error: "Некоректний запит" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Оберіть файл" };
  }
  if (!isAllowedDocument(file)) {
    return { ok: false, error: "Дозволено PDF, DOC/DOCX або зображення до 10 МБ" };
  }

  const title =
    String(formData.get("title") ?? "")
      .trim()
      .slice(0, 120) || file.name.replace(/\.[^.]+$/, "");

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!employee) return { ok: false, error: "Співробітника не знайдено" };

  const storedName = await saveEmployeeDocument(file);
  await prisma.employeeDocument.create({
    data: {
      employeeId,
      title,
      fileName: file.name,
      storedName,
      mime: file.type,
      size: file.size,
      uploadedById: session.employeeId,
    },
  });

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
