/**
 * Простий in-memory rate-limit для захисту входу від перебору пароля.
 *
 * Обмеження: стан живе в пам'яті процесу — підходить для одного інстансу
 * (саме так і розгорнуто на LAN). Для кількох реплік потрібен спільний
 * стор (Redis тощо). Це best-effort бар'єр, а не абсолютний захист.
 */

type Bucket = { count: number; resetAt: number; blockedUntil: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000; // вікно обліку спроб
const MAX_ATTEMPTS = 8; // невдалих спроб до блокування
const BLOCK_MS = 15 * 60 * 1000; // тривалість блокування

/** Періодичне прибирання простроченого стану, щоб мапа не росла безмежно. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) {
    if (b.resetAt < now && b.blockedUntil < now) buckets.delete(key);
  }
}

export type RateResult = { allowed: boolean; retryAfterSec?: number };

/** Перевіряє, чи дозволена спроба входу для ключа (напр. email|ip). */
export function checkLoginRate(key: string, now = Date.now()): RateResult {
  sweep(now);
  const b = buckets.get(key);
  if (!b) return { allowed: true };
  if (b.blockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  return { allowed: true };
}

/** Фіксує НЕВДАЛУ спробу; за перевищення ліміту вмикає блокування. */
export function registerFailure(key: string, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS, blockedUntil: 0 });
    return;
  }
  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) {
    b.blockedUntil = now + BLOCK_MS;
    b.count = 0;
    b.resetAt = now + WINDOW_MS;
  }
}

/** Скидає лічильник після успішного входу. */
export function registerSuccess(key: string) {
  buckets.delete(key);
}
