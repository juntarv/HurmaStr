import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHrOrAdmin, isManagerOf, isSelf, managerSet } from "@/lib/permissions";
import { readLeaveAttachment } from "@/lib/uploads";

/**
 * Віддає фото/скан довідки конкретної заявки.
 * Доступ: автор, його керівник, HR/адмін. Шлях до файлу береться з БД,
 * тож user-input у файлову систему не потрапляє.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Не авторизовано", { status: 401 });

  const { id } = await params;
  const request = await prisma.leaveRequest.findUnique({
    where: { id },
    select: {
      employeeId: true,
      attachmentPath: true,
      attachmentName: true,
      attachmentMime: true,
      employee: { select: { managerId: true, coManagers: { select: { id: true } } } },
    },
  });

  if (!request?.attachmentPath) return new Response("Не знайдено", { status: 404 });

  const allowed =
    isHrOrAdmin(session) ||
    isSelf(session, request.employeeId) ||
    isManagerOf(session, managerSet(request.employee));
  if (!allowed) return new Response("Немає доступу", { status: 403 });

  let data: Buffer;
  try {
    data = await readLeaveAttachment(request.attachmentPath);
  } catch {
    return new Response("Файл недоступний", { status: 404 });
  }

  const filename = encodeURIComponent(request.attachmentName ?? "dovidka");
  // MIME задає клієнт при завантаженні, тож забороняємо браузеру «вгадувати»
  // тип (nosniff) і обмежуємося безпечними типами — захист від XSS через
  // підроблений файл, що видає себе за зображення.
  const mime = request.attachmentMime ?? "application/octet-stream";
  const safeMime = /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(mime)
    ? mime
    : "application/octet-stream";
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
