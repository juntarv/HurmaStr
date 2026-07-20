import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "hurma_session";
const SESSION_DAYS = 7;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET не задано в .env");
  return new TextEncoder().encode(secret);
}

export type Session = {
  userId: string;
  email: string;
  role: Role;
  /** null, якщо акаунт не прив'язаний до кадрової картки. */
  employeeId: string | null;
  fullName: string;
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: { id: string; tokenVersion: number }) {
  const token = await new SignJWT({ tv: user.tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // За замовчуванням false — щоб працювало по локальній мережі через HTTP.
    // Для справжнього HTTPS-деплою виставте COOKIE_SECURE=true у .env.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Читає й перевіряє сесію.
 *
 * JWT сам по собі stateless, тож ми додатково звіряємо tokenVersion із базою:
 * при звільненні або зміні ролі HR інкрементує tokenVersion — і всі раніше
 * видані токени миттєво стають недійсними.
 *
 * cache() з React дедуплікує звернення в межах одного запиту, тож виклик
 * requireSession() на кожній сторінці не породжує зайвих запитів до БД.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let userId: string;
  let tokenVersion: number;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    userId = String(payload.sub);
    tokenVersion = Number(payload.tv);
  } catch {
    return null; // прострочений або підроблений токен
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      tokenVersion: true,
      employeeId: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  if (!user || !user.isActive || user.tokenVersion !== tokenVersion) return null;

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId,
    fullName: user.employee
      ? `${user.employee.lastName} ${user.employee.firstName}`
      : user.email,
  };
});

/** Для сторінок і Server Actions: без сесії — на форму входу. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Обмежує доступ переліком ролей. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect("/?error=forbidden");
  return session;
}
