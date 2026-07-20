"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

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

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, isActive: true, tokenVersion: true },
  });

  // Одне й те саме повідомлення для «немає такого користувача» і «невірний пароль»,
  // щоб не давати змоги перебирати існуючі адреси.
  const invalid = { error: "Невірна пошта або пароль" };
  if (!user || !user.isActive || !user.passwordHash) return invalid;

  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordOk) return invalid;

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
