"use client";

import { useActionState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { updateOwnContactsAction, type ActionResult } from "@/server/actions/employees";
import { Button, Field, Input } from "@/components/ui";

export function ProfileForm({
  values,
}: {
  values: {
    personalEmail: string | null;
    phone: string | null;
    telegram: string | null;
    mattermost: string | null;
    city: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    updateOwnContactsAction,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field label="Особиста пошта" htmlFor="personalEmail">
        <Input
          id="personalEmail"
          name="personalEmail"
          type="email"
          defaultValue={values.personalEmail ?? ""}
        />
      </Field>
      <Field label="Телефон" htmlFor="phone">
        <Input id="phone" name="phone" defaultValue={values.phone ?? ""} />
      </Field>
      <Field label="Telegram" htmlFor="telegram">
        <Input id="telegram" name="telegram" defaultValue={values.telegram ?? ""} />
      </Field>
      <Field label="MatterMost" htmlFor="mattermost">
        <Input id="mattermost" name="mattermost" defaultValue={values.mattermost ?? ""} placeholder="@nickname" />
      </Field>
      <Field label="Місто" htmlFor="city">
        <Input id="city" name="city" defaultValue={values.city ?? ""} />
      </Field>
      <Field label="Контакт для екстрених випадків" htmlFor="emergencyContactName">
        <Input
          id="emergencyContactName"
          name="emergencyContactName"
          defaultValue={values.emergencyContactName ?? ""}
        />
      </Field>
      <Field label="Телефон екстреного контакту" htmlFor="emergencyContactPhone">
        <Input
          id="emergencyContactPhone"
          name="emergencyContactPhone"
          defaultValue={values.emergencyContactPhone ?? ""}
        />
      </Field>

      {state && !state.ok ? (
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
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Зберігаємо…" : "Зберегти"}
        </Button>
      </div>
    </form>
  );
}
