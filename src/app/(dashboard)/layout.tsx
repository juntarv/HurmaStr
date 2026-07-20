import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTheme } from "@/lib/theme.server";
import { navigationFor } from "@/lib/nav";
import { countPendingApprovalsFor } from "@/server/queries/leaves";
import { SidebarNav } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoBadge } from "@/components/logo";
import { Button } from "@/components/ui";
import { ui } from "@/lib/labels";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const groups = navigationFor(session.role);
  const [pendingApprovals, theme] = await Promise.all([
    countPendingApprovalsFor(session),
    getTheme(),
  ]);

  const brand = (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoBadge className="size-9" />
      <span>
        <span className="block text-sm font-semibold leading-tight text-ink">{ui.appName}</span>
        <span className="block text-xs leading-tight text-ink-muted">{ui.appTagline}</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Бічна панель — на вузьких екранах ховається у випадайку топбару. */}
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col">
        <div className="px-5 py-4">{brand}</div>
        <div className="px-3 pb-4">
          <Link href="/leaves/new" className="block">
            <Button className="w-full" size="sm">
              <Plus className="size-4" aria-hidden />
              Створити заявку
            </Button>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav groups={groups} pendingApprovals={pendingApprovals} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <div className="lg:hidden">{brand}</div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1.5">
            <ThemeToggle initial={theme} />
            <UserMenu fullName={session.fullName} email={session.email} role={session.role} />
          </div>
        </header>

        {/* Мобільна навігація: без JS, звичайний нативний випадайко. */}
        <details className="border-b border-line bg-surface lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-ink-soft">
            <Menu className="size-4" aria-hidden />
            Меню
          </summary>
          <div className="px-3 pb-4">
            <SidebarNav groups={groups} pendingApprovals={pendingApprovals} />
          </div>
        </details>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
