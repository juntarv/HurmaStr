import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/**
 * Локальне сховище вкладень (фото довідок).
 * Файли лежать поза public і віддаються лише через захищений роут
 * /api/leave-attachments/[id] з перевіркою прав.
 */

// Базовий каталог сховища можна винести на постійний том через STORAGE_DIR
// (напр. на Fly.io — /data/storage). За замовчуванням — ./storage у проєкті.
const STORAGE_ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage");
const STORAGE_DIR = path.join(STORAGE_ROOT, "leave-attachments");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 МБ

export type SavedFile = { storedName: string; originalName: string; mime: string };

export function isAllowedUpload(file: File): boolean {
  return ALLOWED_MIME.has(file.type) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
}

/** Зберігає файл під випадковим ім'ям, повертає метадані для БД. */
export async function saveLeaveAttachment(file: File): Promise<SavedFile> {
  await mkdir(STORAGE_DIR, { recursive: true });
  const ext = EXT_BY_MIME[file.type] ?? "";
  const storedName = `${randomBytes(16).toString("hex")}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(STORAGE_DIR, storedName), bytes);
  return { storedName, originalName: file.name, mime: file.type };
}

/**
 * Читає файл вкладення. storedName береться ВИКЛЮЧНО з запису в БД,
 * тож user-input у шлях не потрапляє. Додатково перевіряємо, що
 * підсумковий шлях не виходить за межі директорії сховища.
 */
export async function readLeaveAttachment(storedName: string): Promise<Buffer> {
  const safe = path.basename(storedName); // прибирає будь-які "../"
  const full = path.join(STORAGE_DIR, safe);
  if (!full.startsWith(STORAGE_DIR)) throw new Error("Недопустимий шлях");
  return readFile(full);
}

export async function deleteLeaveAttachment(storedName: string): Promise<void> {
  try {
    await unlink(path.join(STORAGE_DIR, path.basename(storedName)));
  } catch {
    // файлу вже немає — не критично
  }
}
