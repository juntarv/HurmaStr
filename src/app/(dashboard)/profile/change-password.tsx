"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, KeyRound, TriangleAlert } from "lucide-react";
import { changePasswordAction, type FormState } from "@/server/actions/auth";
import { Button, Field, Input } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    changePasswordAction,
    null,
  );
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Після успіху чистимо поля, щоб паролі не лишались у формі.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field label="Поточний пароль" htmlFor="currentPassword" required className="sm:col-span-2">
        <Input
          id="currentPassword"
          name="currentPassword"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required
        />
      </Field>

      <Field
        label="Новий пароль"
        htmlFor="newPassword"
        hint="Щонайменше 6 символів"
        required
      >
        <Input
          id="newPassword"
          name="newPassword"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>

      <Field label="Повторіть новий пароль" htmlFor="confirm" required>
        <Input
          id="confirm"
          name="confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink-soft sm:col-span-2">
        <input
          type="checkbox"
          checked={show}
          onChange={(e) => setShow(e.target.checked)}
          className="size-4 accent-[var(--color-brand)]"
        />
        Показати паролі
      </label>

      {state?.error ? (
        <p
          role="alert"
          className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-success-line bg-success-soft px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" aria-hidden />
          Пароль змінено. Інші сесії завершено.
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          <KeyRound className="size-4" aria-hidden />
          {pending ? "Зберігаємо…" : "Змінити пароль"}
        </Button>
      </div>
    </form>
  );
}
