"use client";

import { useActionState, useState } from "react";
import { Check, KeyRound, TriangleAlert } from "lucide-react";
import { setCredentialsAction, type ActionResult } from "@/server/actions/employees";
import { Button, Field, Input, Select } from "@/components/ui";
import { roleLabels } from "@/lib/labels";
import type { Role } from "@/generated/prisma/enums";

export function CredentialsPanel({
  employeeId,
  defaultEmail,
  currentEmail,
  currentRole,
  hasAccount,
  isActive,
}: {
  employeeId: string;
  defaultEmail: string;
  currentEmail: string | null;
  currentRole: Role | null;
  hasAccount: boolean;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    setCredentialsAction,
    null,
  );
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3 p-5">
      <input type="hidden" name="employeeId" value={employeeId} />

      <p className="text-sm text-ink-muted">
        {hasAccount
          ? "Змініть логін, роль або встановіть новий пароль. Порожній пароль лишає поточний."
          : "Задайте логін і пароль вручну — співробітник увійде з ними. Пошта не потрібна."}
      </p>

      <Field label="Логін (email)" htmlFor="cred-email" required>
        <Input
          id="cred-email"
          name="email"
          type="email"
          defaultValue={currentEmail ?? defaultEmail}
          placeholder="name@company.com"
          required
        />
      </Field>

      <Field
        label={hasAccount ? "Новий пароль" : "Пароль"}
        htmlFor="cred-password"
        hint={hasAccount ? "Залиште порожнім, щоб не змінювати" : "Щонайменше 6 символів"}
        required={!hasAccount}
      >
        <div className="flex gap-2">
          <Input
            id="cred-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            minLength={6}
            required={!hasAccount}
          />
          <Button type="button" variant="secondary" size="md" onClick={() => setShow((v) => !v)}>
            {show ? "Сховати" : "Показати"}
          </Button>
        </div>
      </Field>

      <Field label="Роль у системі" htmlFor="cred-role">
        <Select id="cred-role" name="role" defaultValue={currentRole ?? "EMPLOYEE"}>
          {(Object.keys(roleLabels) as Role[]).map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <Button type="submit" disabled={pending}>
          <KeyRound className="size-4" aria-hidden />
          {pending ? "Зберігаємо…" : hasAccount ? "Оновити доступ" : "Створити доступ"}
        </Button>
      </div>

      {hasAccount && !isActive ? (
        <p className="text-xs text-warning">Доступ вимкнено. Збереження знову його активує.</p>
      ) : null}

      {state?.ok ? (
        <p className="flex items-center gap-2 rounded-lg border border-success-line bg-success-soft px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : null}
      {state && !state.ok ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
