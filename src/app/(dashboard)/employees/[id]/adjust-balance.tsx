"use client";

import { useActionState, useState } from "react";
import { Check, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { adjustBalanceAction, type BalanceAdjustResult } from "@/server/actions/balance";
import { Button, Field, Input, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Ручна зміна балансу днів співробітника (HR/адмін).
 * «Встановити» — задати точний баланс (міграція з іншого сервісу).
 * «Додати» — скоригувати на ±днів.
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
  const [mode, setMode] = useState<"set" | "add">("set");

  if (!open) {
    return (
      <div className="px-5 pb-5">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <SlidersHorizontal className="size-4" aria-hidden />
          Змінити баланс днів
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line bg-surface-muted px-5 py-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="mode" value={mode} />

      {/* Перемикач режиму */}
      <div className="inline-flex w-fit rounded-lg border border-line bg-surface p-0.5 text-sm">
        {(["set", "add"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-3 py-1 font-medium transition-colors",
              mode === m ? "bg-brand text-white" : "text-ink-soft hover:text-ink",
            )}
          >
            {m === "set" ? "Встановити" : "Додати ±"}
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-muted">
        {mode === "set" ? (
          <>Задайте точний баланс — напр. перенесення з попереднього сервісу: <b>15</b>. Система сама порахує коригування.</>
        ) : (
          <>Скоригуйте на ± днів, напр. <b>+3</b> або <b>−2</b>.</>
        )}{" "}
        Відпустка — безстроково; лікарняні — на поточний рік.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="Тип" htmlFor="adj-type">
          <Select id="adj-type" name="leaveTypeId" defaultValue={types[0]?.id ?? ""}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.nameUk}</option>
            ))}
          </Select>
        </Field>
        <Field label={mode === "set" ? "Баланс, днів" : "± днів"} htmlFor="adj-value">
          <Input
            id="adj-value"
            name="value"
            type="number"
            step="0.5"
            min={mode === "set" ? "0" : undefined}
            placeholder={mode === "set" ? "15" : "+3"}
            required
          />
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
