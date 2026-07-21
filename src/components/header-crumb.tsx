"use client";

import { usePathname } from "next/navigation";

/** Назва поточного розділу для лівої частини топбару. */
const RULES: { test: (p: string) => boolean; label: string }[] = [
  { test: (p) => p === "/", label: "Панель" },
  { test: (p) => p === "/calendar", label: "Календар" },
  { test: (p) => p === "/employees/new", label: "Новий співробітник" },
  { test: (p) => /^\/employees\/[^/]+\/edit$/.test(p), label: "Редагування картки" },
  { test: (p) => /^\/employees\/[^/]+$/.test(p), label: "Картка співробітника" },
  { test: (p) => p.startsWith("/employees"), label: "Співробітники" },
  { test: (p) => p === "/departments", label: "Відділи" },
  { test: (p) => p === "/org", label: "Оргструктура" },
  { test: (p) => p === "/assets", label: "Майно" },
  { test: (p) => p === "/leaves/new", label: "Нова заявка" },
  { test: (p) => p === "/leaves/approvals", label: "На погодженні" },
  { test: (p) => p === "/leaves/balances", label: "Баланси" },
  { test: (p) => /^\/leaves\/[^/]+$/.test(p), label: "Заявка" },
  { test: (p) => p.startsWith("/leaves"), label: "Мої заявки" },
  { test: (p) => p === "/profile", label: "Мій профіль" },
];

export function HeaderCrumb() {
  const pathname = usePathname();
  const label = RULES.find((r) => r.test(pathname))?.label ?? "HurmaStr";
  return <div className="text-sm font-medium text-ink-muted">{label}</div>;
}
