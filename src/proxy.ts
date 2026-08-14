import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * У Next.js 16 middleware називається proxy.
 *
 * Це ОПТИМІСТИЧНА перевірка: перевіряємо лише підпис і термін дії cookie,
 * щоб швидко відсіяти анонімів у edge-рантаймі. Справжня авторизація
 * (активність акаунта, tokenVersion, ролі) робиться в RSC і Server Actions
 * через requireSession() — layout межею безпеки не є.
 *
 * ВАЖЛИВО: наявність cookie ≠ дійсна сесія. Cookie може бути коректно
 * підписаним, але вказувати на видаленого користувача (напр. після скидання
 * бази). Тому редіректу «/login → /» тут НЕМАЄ — інакше виникає цикл
 * (/ веде на /login, а /login назад на /). Рішення «вже увійшов» ухвалює
 * сама сторінка входу через getSession().
 */
async function hasValidCookie(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false; // прострочений або підроблений
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Машинний API (/api/v1/*) автентифікується Bearer-токеном у самому роуті —
  // сесійного cookie там немає, і редірект на /login зламав би інтеграції.
  if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const isAuthRoute = pathname === "/login";

  const valid = await hasValidCookie(token);

  if (!valid && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?from=${encodeURIComponent(pathname + search)}`;
    const res = NextResponse.redirect(url);
    // Прибираємо непридатний cookie, щоб він не тягнувся далі.
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
