// Клієнт-безпечний модуль: без next/headers, щоб його могли імпортувати
// і серверні, і клієнтські компоненти.
export type Theme = "light" | "dark";
export const THEME_COOKIE = "hurma_theme";
