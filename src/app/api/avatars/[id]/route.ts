import { type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { avatarMime, readAvatar } from "@/lib/uploads";

/**
 * Віддає фото співробітника. Доступне будь-якому автентифікованому користувачу
 * (фото — частина внутрішнього довідника). Ім'я файлу береться з БД.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return new Response("Не авторизовано", { status: 401 });

  const { id } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { avatarFile: true },
  });
  if (!employee?.avatarFile) return new Response("Немає фото", { status: 404 });

  let data: Buffer;
  try {
    data = await readAvatar(employee.avatarFile);
  } catch {
    return new Response("Файл недоступний", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": avatarMime(employee.avatarFile),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
}
