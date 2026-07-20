import { cookies } from "next/headers";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/** Тема поточного користувача (зі cookie). За замовчуванням — світла. */
export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  return store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
