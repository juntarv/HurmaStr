import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHrOrAdmin, isSelf } from "@/lib/permissions";
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
      employee: { select: { managerId: true } },
    },
  });

  if (!request?.attachmentPath) return new Response("Не знайдено", { status: 404 });

  const allowed =
    isHrOrAdmin(session) ||
    isSelf(session, request.employeeId) ||
    (!!session.employeeId && request.employee.managerId === session.employeeId);
  if (!allowed) return new Response("Немає доступу", { status: 403 });

  let data: Buffer;
  try {
    data = await readLeaveAttachment(request.attachmentPath);
  } catch {
    return new Response("Файл недоступний", { status: 404 });
  }

  const filename = encodeURIComponent(request.attachmentName ?? "dovidka");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": request.attachmentMime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
