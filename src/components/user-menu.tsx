"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
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
  return (
    <div className="flex items-center gap-3">
      <Link href="/profile" className="hidden text-right sm:block group">
        <p className="text-sm font-medium leading-tight text-ink group-hover:text-brand">
          {fullName}
        </p>
        <p className="text-xs leading-tight text-ink-muted">
          {roleLabels[role]} · {email}
        </p>
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
