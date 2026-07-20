"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/**
 * Перемикач світлої/темної теми.
 * Тема пишеться в cookie й одразу застосовується класом .dark на <html>,
 * тож наступний серверний рендер уже віддасть правильні кольори (без миготіння).
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    // 1 рік життя, щоб вибір не скидався.
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Світла тема" : "Темна тема"}
      className="flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
    >
      {theme === "dark" ? <Sun className="size-4.5" aria-hidden /> : <Moon className="size-4.5" aria-hidden />}
      <span className="sr-only">Перемкнути тему</span>
    </button>
  );
}
