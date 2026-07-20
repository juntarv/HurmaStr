import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Об'єднує Tailwind-класи, коректно розв'язуючи конфлікти. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
