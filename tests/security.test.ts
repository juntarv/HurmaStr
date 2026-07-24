import { describe, it, expect } from "vitest";
import { File as NodeFile } from "node:buffer";
import { checkLoginRate, registerFailure, registerSuccess } from "@/lib/rate-limit";
import { isAllowedUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";

/**
 * Юніт-тести безпекових утиліт:
 *  - src/lib/rate-limit.ts  (лічильник спроб входу)
 *  - isAllowedUpload з src/lib/uploads.ts (валідація вкладень)
 *
 * УВАГА: стан rate-limit — глобальна Map у модулі, живе між тестами.
 * Тому кожен тест бере УНІКАЛЬНИЙ ключ (freshKey), а час подаємо явно
 * через параметр `now` для повного детермінізму (реальний час не чіпаємо).
 */

// Дзеркалимо константи з rate-limit.ts (вони не експортуються).
const MAX_ATTEMPTS = 8; // невдалих спроб до блокування
const BLOCK_MS = 15 * 60 * 1000; // тривалість блокування

// Фіксований момент часу — жоден тест не залежить від Date.now().
const NOW = 1_700_000_000_000;

let keySeq = 0;
const freshKey = () => `rk-${++keySeq}-${Math.random()}`;

describe("rate-limit: checkLoginRate / registerFailure / registerSuccess", () => {
  it("свіжий ключ дозволений", () => {
    const key = freshKey();
    const res = checkLoginRate(key, NOW);
    expect(res.allowed).toBe(true);
    expect(res.retryAfterSec).toBeUndefined();
  });

  it("до граничної спроби (MAX_ATTEMPTS-1 невдач) вхід ще дозволений", () => {
    const key = freshKey();
    // Перша registerFailure створює бакет з count=1, далі інкремент.
    // Блок вмикається САМЕ на MAX_ATTEMPTS-й невдачі (count >= MAX_ATTEMPTS),
    // тож після MAX_ATTEMPTS-1 невдач блокування ще немає.
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) registerFailure(key, NOW);
    expect(checkLoginRate(key, NOW).allowed).toBe(true);
  });

  it("рівно MAX_ATTEMPTS невдач вмикає блокування з retryAfterSec>0 (гранична спроба)", () => {
    const key = freshKey();
    for (let i = 0; i < MAX_ATTEMPTS; i++) registerFailure(key, NOW);
    const res = checkLoginRate(key, NOW);
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSec).toBeGreaterThan(0);
    // blockedUntil = NOW + BLOCK_MS → retryAfterSec = ceil(BLOCK_MS/1000).
    expect(res.retryAfterSec).toBe(Math.ceil(BLOCK_MS / 1000));
  });

  it("різні ключі не впливають один на одного", () => {
    const blocked = freshKey();
    const other = freshKey();
    for (let i = 0; i < MAX_ATTEMPTS; i++) registerFailure(blocked, NOW);
    expect(checkLoginRate(blocked, NOW).allowed).toBe(false);
    // Інший ключ лишається чистим.
    expect(checkLoginRate(other, NOW).allowed).toBe(true);
  });

  it("registerSuccess скидає лічильник → знову дозволено", () => {
    const key = freshKey();
    for (let i = 0; i < MAX_ATTEMPTS; i++) registerFailure(key, NOW);
    expect(checkLoginRate(key, NOW).allowed).toBe(false);
    registerSuccess(key);
    expect(checkLoginRate(key, NOW).allowed).toBe(true);
  });

  it("після завершення вікна блокування знову дозволено", () => {
    const key = freshKey();
    for (let i = 0; i < MAX_ATTEMPTS; i++) registerFailure(key, NOW);
    // Всередині вікна — заблоковано.
    expect(checkLoginRate(key, NOW).allowed).toBe(false);
    // Просуваємо час за blockedUntil (NOW + BLOCK_MS).
    const after = NOW + BLOCK_MS + 1;
    expect(checkLoginRate(key, after).allowed).toBe(true);
  });
});

// File глобальний у Node 20+/vitest; фолбек на node:buffer про всяк випадок.
const FileCtor: typeof File = (globalThis as unknown as { File?: typeof File }).File ?? (NodeFile as unknown as typeof File);

const makeFile = (bytes: number, type: string) =>
  new FileCtor([new Uint8Array(bytes)], "f.jpg", { type });

describe("uploads: isAllowedUpload", () => {
  it("дозволяє валідні MIME-типи", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]) {
      expect(isAllowedUpload(makeFile(1024, type))).toBe(true);
    }
  });

  it("забороняє небезпечні/невідомі MIME-типи", () => {
    for (const type of ["text/html", "image/svg+xml", "application/octet-stream"]) {
      expect(isAllowedUpload(makeFile(1024, type))).toBe(false);
    }
  });

  it("порожній файл (0 байт) заборонений", () => {
    expect(isAllowedUpload(makeFile(0, "image/jpeg"))).toBe(false);
  });

  it("файл рівно на межі MAX_UPLOAD_BYTES дозволений", () => {
    expect(isAllowedUpload(makeFile(MAX_UPLOAD_BYTES, "image/jpeg"))).toBe(true);
  });

  it("файл на 1 байт більший за межу заборонений", () => {
    expect(isAllowedUpload(makeFile(MAX_UPLOAD_BYTES + 1, "image/jpeg"))).toBe(false);
  });
});
