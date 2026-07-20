"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import { createLeaveRequestAction, type LeaveActionResult } from "@/server/actions/leaves";
import { Button, Card, CardHeader, Divider, Field, Input, Select, Textarea } from "@/components/ui";
import { LeaveTypeIcon } from "@/components/icons";
import { countCalendarDays, countWorkingDays, daysLabel, parseDateOnly } from "@/lib/dates";
import { ui } from "@/lib/labels";

export type LeaveTypeOption = {
  id: string;
  nameUk: string;
  icon: string;
  colorHex: string;
  unit: "WORKING_DAYS" | "CALENDAR_DAYS";
  affectsBalance: boolean;
  requiresDocument: boolean;
  allowPastDates: boolean;
  minNoticeDays: number;
  description: string | null;
  available: number;
};

export function RequestForm({ types }: { types: LeaveTypeOption[] }) {
  const [state, formAction, pending] = useActionState<LeaveActionResult | null, FormData>(
    createLeaveRequestAction,
    null,
  );

  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const selected = types.find((type) => type.id === typeId) ?? types[0];

  /**
   * Попередній підрахунок днів на клієнті — лише для підказки.
   * Остаточне число завжди рахує сервер, клієнту тут не довіряють.
   */
  const preview = useMemo(() => {
    if (!start || !end || !selected) return null;
    const from = parseDateOnly(start);
    const to = parseDateOnly(end);
    if (to < from) return { error: "Дата завершення раніша за дату початку" };
    const days =
      selected.unit === "WORKING_DAYS"
        ? countWorkingDays(from, to)
        : countCalendarDays(from, to);
    return { days };
  }, [start, end, selected]);

  const notEnough =
    preview?.days != null && selected?.affectsBalance && preview.days > selected.available;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Нова заявка" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Тип відсутності" htmlFor="leaveTypeId" required className="sm:col-span-2">
            <Select
              id="leaveTypeId"
              name="leaveTypeId"
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
              required
            >
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.nameUk}
                  {type.affectsBalance ? ` — доступно ${type.available}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          {selected ? (
            <div className="sm:col-span-2 flex items-start gap-2.5 rounded-lg border border-line bg-surface-muted px-3 py-2.5">
              <LeaveTypeIcon icon={selected.icon} color={selected.colorHex} className="mt-0.5 size-4" />
              <div className="text-xs text-ink-muted">
                {selected.description ? <p>{selected.description}</p> : null}
                <p className="mt-0.5">
                  Рахується в{" "}
                  {selected.unit === "WORKING_DAYS" ? "робочих днях" : "календарних днях"}
                  {selected.affectsBalance ? ` · доступно ${selected.available}` : " · без списання з балансу"}
                  {selected.minNoticeDays > 0 ? ` · подавати за ${selected.minNoticeDays} дн.` : ""}
                </p>
              </div>
            </div>
          ) : null}

          <Field label="Дата початку" htmlFor="startDate" required>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={start}
              onChange={(event) => {
                setStart(event.target.value);
                if (!end || event.target.value > end) setEnd(event.target.value);
              }}
              required
            />
          </Field>

          <Field label="Дата завершення" htmlFor="endDate" required>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              value={end}
              min={start || undefined}
              onChange={(event) => setEnd(event.target.value)}
              required
            />
          </Field>

          {preview ? (
            <div className="sm:col-span-2">
              {"error" in preview ? (
                <p className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  {preview.error}
                </p>
              ) : (
                <p
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    notEnough
                      ? "border-warning-line bg-warning-soft text-warning"
                      : "border-brand-line bg-brand-soft text-brand"
                  }`}
                >
                  <Info className="size-4 shrink-0" aria-hidden />
                  Буде враховано {daysLabel(preview.days)}
                  {notEnough ? ` — це більше, ніж доступно (${selected?.available})` : ""}
                </p>
              )}
            </div>
          ) : null}

          {selected?.requiresDocument ? (
            <>
              <Field
                label="Номер довідки"
                htmlFor="documentNumber"
                hint="Для цього типу потрібен підтвердний документ"
                className="sm:col-span-2"
              >
                <Input id="documentNumber" name="documentNumber" />
              </Field>
              <Field
                label="Фото / скан довідки"
                htmlFor="attachment"
                hint="Зображення або PDF до 10 МБ"
                className="sm:col-span-2"
              >
                <input
                  id="attachment"
                  name="attachment"
                  type="file"
                  accept="image/*,application/pdf"
                  className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand-line"
                />
              </Field>
            </>
          ) : null}

          <Field label="Коментар" htmlFor="comment" className="sm:col-span-2">
            <Textarea
              id="comment"
              name="comment"
              rows={3}
              placeholder="Не обов'язково — але допомагає керівнику швидше погодити"
            />
          </Field>
        </div>
      </Card>

      {state && !state.ok ? (
        <div
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <p className="flex items-center gap-2">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
          {state.warnings?.length ? (
            <ul className="mt-1 list-disc pl-6 text-xs">
              {state.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || !types.length}>
          {pending ? "Надсилаємо…" : "Подати заявку"}
        </Button>
        <Link href="/leaves">
          <Button type="button" variant="ghost">
            {ui.cancel}
          </Button>
        </Link>
      </div>
    </form>
  );
}
