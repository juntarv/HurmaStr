"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  requireSession,
  verifyPassword,
} from "@/lib/auth";
import { checkLoginRate, registerFailure, registerSuccess } from "@/lib/rate-limit";

export type FormState = { error?: string; ok?: boolean } | null;

const loginSchema = z.object({
  email: z.email("Вкажіть коректну робочу пошту"),
  password: z.string().min(1, "Введіть пароль"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Rate-limit проти перебору пароля: ключ за поштою + IP.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateKey = `${parsed.data.email}|${ip}`;
  const rate = checkLoginRate(rateKey);
  if (!rate.allowed) {
    return { error: `Забагато спроб. Спробуйте за ${Math.ceil((rate.retryAfterSec ?? 60) / 60)} хв.` };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, isActive: true, tokenVersion: true },
  });

  // Одне й те саме повідомлення для «немає такого користувача» і «невірний пароль»,
  // щоб не давати змоги перебирати існуючі адреси.
  const invalid = { error: "Невірна пошта або пароль" };
  if (!user || !user.isActive || !user.passwordHash) {
    registerFailure(rateKey);
    return invalid;
  }

  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordOk) {
    registerFailure(rateKey);
    return invalid;
  }

  registerSuccess(rateKey);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await createSession(user);

  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ========================= ЗМІНА ВЛАСНОГО ПАРОЛЯ =============================

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Введіть поточний пароль"),
    newPassword: z.string().min(6, "Новий пароль щонайменше 6 символів").max(100),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Паролі не збігаються",
    path: ["confirm"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "Новий пароль має відрізнятися від поточного",
    path: ["newPassword"],
  });

/**
 * Зміна власного пароля залогіненим користувачем.
 * Вимагає поточний пароль (захист від зміни при перехопленій сесії).
 * Після зміни інкрементуємо tokenVersion — усі ІНШІ сесії завершуються,
 * а поточну одразу переоформлюємо, щоб користувача не викинуло.
 */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: String(formData.get("currentPassword") ?? ""),
    newPassword: String(formData.get("newPassword") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) return { error: "Акаунт не знайдено" };

  // Порожній хеш — акаунт без пароля (не має статися при звичайному потоці).
  const currentOk = user.passwordHash
    ? await verifyPassword(parsed.data.currentPassword, user.passwordHash)
    : false;
  if (!currentOk) return { error: "Поточний пароль невірний" };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword),
      tokenVersion: { increment: 1 },
    },
    select: { id: true, tokenVersion: true },
  });

  // Переоформлюємо поточну сесію під новий tokenVersion.
  await createSession(updated);

  return { ok: true };
}
