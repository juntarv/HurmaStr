"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";
import { loginAction, type FormState } from "@/server/actions/auth";
import { Button, Field, Input } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Робоча пошта" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          required
          autoFocus
        />
      </Field>

      <Field label="Пароль" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      {state?.error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Входимо…" : "Увійти"}
      </Button>
    </form>
  );
}
