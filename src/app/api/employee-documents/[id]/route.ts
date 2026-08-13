import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin, isHrOrAdmin, isManagerOf, managerSet } from "@/lib/permissions";
import { readEmployeeDocument } from "@/lib/uploads";

/**
 * Віддає кадровий документ (офер / посадову інструкцію).
 * Доступ ЛИШЕ керівництву: HR/адмін та керівники цього співробітника.
 * Сам співробітник і сторонні документ не бачать.
 * Шлях до файлу береться з БД — user-input у файлову систему не потрапляє.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Не авторизовано", { status: 401 });

  const { id } = await params;
  const doc = await prisma.employeeDocument.findUnique({
    where: { id },
    select: {
      fileName: true,
      storedName: true,
      mime: true,
      employee: {
        select: { status: true, managerId: true, coManagers: { select: { id: true } } },
      },
    },
  });
  if (!doc) return new Response("Не знайдено", { status: 404 });

  // Звільнені «існують» лише для адміна — це стосується і їхніх документів.
  const allowed =
    doc.employee.status === "TERMINATED"
      ? isAdmin(session)
      : isHrOrAdmin(session) || isManagerOf(session, managerSet(doc.employee));
  if (!allowed) return new Response("Немає доступу", { status: 403 });

  let data: Buffer;
  try {
    data = await readEmployeeDocument(doc.storedName);
  } catch {
    return new Response("Файл недоступний", { status: 404 });
  }

  // MIME задає клієнт при завантаженні — обмежуємося безпечним списком
  // і забороняємо браузеру «вгадувати» тип (nosniff).
  const safeMime =
    /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/(jpeg|png|webp))$/.test(
      doc.mime,
    )
      ? doc.mime
      : "application/octet-stream";
  const filename = encodeURIComponent(doc.fileName || "document");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": safeMime,
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
