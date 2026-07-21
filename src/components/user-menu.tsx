"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { Avatar } from "@/components/ui";
import { roleLabels } from "@/lib/labels";
import type { Role } from "@/generated/prisma/enums";

export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: Role;
}) {
  // fullName приходить як «Прізвище Ім'я» — розкладаємо для аватара.
  const [lastName = fullName, firstName = ""] = fullName.split(" ");

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/profile"
        className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-surface-muted"
      >
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-sm font-medium text-ink group-hover:text-brand">
            {fullName}
          </span>
          <span className="block text-xs text-ink-muted">
            {roleLabels[role]} · {email}
          </span>
        </span>
        <Avatar firstName={firstName} lastName={lastName} />
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          title="Вийти"
          className="flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-danger"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="sr-only">Вийти</span>
        </button>
      </form>
    </div>
  );
}
