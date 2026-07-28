"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  Inbox,
  LayoutDashboard,
  Network,
  Palmtree,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";

// Явна мапа замість import * — так у бандл потрапляють лише потрібні іконки.
const icons: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  Users,
  Building2,
  Network,
  Inbox,
  Check,
  Palmtree,
  Boxes,
  BriefcaseBusiness,
};

export function SidebarNav({
  groups,
  pendingApprovals,
}: {
  groups: NavGroup[];
  pendingApprovals: number;
}) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group, index) => (
        <div key={group.title ?? index} className="flex flex-col gap-1">
          {group.title ? (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {group.title}
            </p>
          ) : null}

          {group.items.map((item) => {
            const Icon = icons[item.icon] ?? LayoutDashboard;
            const active = isActive(item.href, item.exact);
            const showBadge = item.href === "/leaves/approvals" && pendingApprovals > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-brand-soft font-medium text-brand"
                    : "text-ink-soft hover:bg-surface-muted",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
                {showBadge ? (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-warning px-1.5 py-0.5 text-xs font-semibold text-white">
                    {pendingApprovals}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
