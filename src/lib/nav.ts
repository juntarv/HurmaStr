import type { Role } from "@/generated/prisma/enums";

export type NavItem = {
  href: string;
  label: string;
  /** Ключ іконки lucide — резолвиться у клієнтському компоненті сайдбару. */
  icon: string;
  /** Якщо задано — пункт видно лише цим ролям. */
  roles?: Role[];
  /** Точний збіг шляху (для головної, щоб не підсвічувалась усюди). */
  exact?: boolean;
};

export type NavGroup = { title?: string; items: NavItem[] };

export const navigation: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Панель", icon: "LayoutDashboard", exact: true },
      { href: "/calendar", label: "Календар", icon: "CalendarDays" },
    ],
  },
  {
    title: "Персонал",
    items: [
      { href: "/employees", label: "Співробітники", icon: "Users" },
      { href: "/departments", label: "Відділи", icon: "Building2" },
      { href: "/positions", label: "Посади", icon: "BriefcaseBusiness", roles: ["ADMIN", "HR"] },
      { href: "/org", label: "Оргструктура", icon: "Network" },
      { href: "/assets", label: "Майно", icon: "Boxes", roles: ["ADMIN"] },
    ],
  },
  {
    title: "Відсутності",
    items: [
      { href: "/leaves", label: "Мої заявки", icon: "Inbox" },
      { href: "/leaves/approvals", label: "На погодженні", icon: "Check" },
      { href: "/leaves/balances", label: "Баланси", icon: "Palmtree", roles: ["ADMIN", "HR"] },
    ],
  },
];

/** Пункти, доступні конкретній ролі. */
export function navigationFor(role: Role): NavGroup[] {
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.roles || item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}
