"use client";

import { useActionState, useState } from "react";
import { Check, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { adjustBalanceAction, type BalanceAdjustResult } from "@/server/actions/balance";
import { Button, Field, Input, Select } from "@/components/ui";

/**
 * Ручне коригування балансу днів співробітника (HR/адмін).
 * Головний сценарій — перенести залишок з іншого сервісу при міграції.
 */
export function AdjustBalancePanel({
  employeeId,
  types,
}: {
  employeeId: string;
  types: { id: string; nameUk: string }[];
}) {
  const [state, formAction, pending] = useActionState<BalanceAdjustResult | null, FormData>(
    adjustBalanceAction,
    null,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="px-5 pb-5">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-4" aria-hidden />
          Коригувати баланс
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line bg-surface-muted px-5 py-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <p className="text-xs text-ink-muted">
        Введіть ± днів. Напр. перенесення з іншого сервісу: <b>+15</b>. Відпустка додається
        до нарахованого назавжди; лікарняні — до поточного року.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
        <Field label="Тип" htmlFor="adj-type">
          <Select id="adj-type" name="leaveTypeId" defaultValue={types[0]?.id ?? ""}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.nameUk}</option>
            ))}
          </Select>
        </Field>
        <Field label="± днів" htmlFor="adj-days">
          <Input id="adj-days" name="days" type="number" step="0.5" placeholder="+15" required />
        </Field>
      </div>

      <Field label="Причина" htmlFor="adj-reason">
        <Input id="adj-reason" name="reason" placeholder="Перенесення залишку з BambooHR" required />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Зберігаємо…" : "Застосувати"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Закрити
        </Button>
      </div>

      {state?.ok ? (
        <p className="flex items-center gap-2 rounded-lg border border-success-line bg-success-soft px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : null}
      {state && !state.ok ? (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
