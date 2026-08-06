"use client";

import { useActionState, useState } from "react";
import { Check, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import {
  archivePositionAction,
  createPositionAction,
  restorePositionAction,
  updatePositionAction,
  type PositionResult,
} from "@/server/actions/positions";
import { Button, Field, Input, Select } from "@/components/ui";

type Dept = { id: string; name: string };

export function CreatePositionForm({ departments }: { departments: Dept[] }) {
  const [state, formAction, pending] = useActionState<PositionResult | null, FormData>(
    createPositionAction,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-[2fr_1.5fr_auto]">
      <Field label="Назва посади" htmlFor="new-title" required>
        <Input id="new-title" name="title" placeholder="Senior iOS Developer" required />
      </Field>
      <Field label="Відділ" htmlFor="new-dep" hint="Не обов'язково">
        <Select id="new-dep" name="departmentId" defaultValue="">
          <option value="">Без відділу</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          <Plus className="size-4" aria-hidden />
          {pending ? "…" : "Додати"}
        </Button>
      </div>
      <label className="sm:col-span-3 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="isManagerial" className="size-4 accent-[var(--color-brand)]" />
        Керівна посада (може бути керівником — вище керівництво, хеди, тімліди)
      </label>

      {state && !state.ok ? (
        <p role="alert" className="sm:col-span-3 flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="sm:col-span-3 rounded-lg border border-success-line bg-success-soft px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function PositionRow({
  position,
  departments,
}: {
  position: { id: string; title: string; departmentId: string | null; sortOrder: number; isArchived: boolean; isManagerial: boolean; count: number };
  departments: Dept[];
}) {
  const [state, formAction, pending] = useActionState<PositionResult | null, FormData>(
    updatePositionAction,
    null,
  );
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function archive() {
    setBusy(true);
    await archivePositionAction(position.id);
    setBusy(false);
  }
  async function restore() {
    setBusy(true);
    await restorePositionAction(position.id);
    setBusy(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-44 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {position.title}
            {position.isManagerial ? (
              <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand">
                керівна
              </span>
            ) : null}
            {position.isArchived ? <span className="text-xs text-ink-faint">(архів)</span> : null}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {departments.find((d) => d.id === position.departmentId)?.name ?? "Без відділу"}
            {position.count > 0 ? ` · ${position.count} співробітн.` : ""}
          </p>
        </div>
        {position.isArchived ? (
          <Button type="button" variant="ghost" size="sm" onClick={restore} disabled={busy}>
            <RotateCcw className="size-3.5" aria-hidden /> Відновити
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" aria-hidden /> Змінити
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={archive} disabled={busy} title="Архівувати">
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => setTimeout(() => setEditing(false), 50)}
      className="grid gap-3 bg-surface-muted px-4 py-3 sm:grid-cols-[2fr_1.5fr_auto]"
    >
      <input type="hidden" name="id" value={position.id} />
      <input type="hidden" name="sortOrder" value={position.sortOrder} />
      <Input name="title" defaultValue={position.title} required />
      <Select name="departmentId" defaultValue={position.departmentId ?? ""}>
        <option value="">Без відділу</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          <Check className="size-3.5" aria-hidden /> Зберегти
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Скасувати
        </Button>
      </div>
      <label className="sm:col-span-3 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="isManagerial"
          defaultChecked={position.isManagerial}
          className="size-4 accent-[var(--color-brand)]"
        />
        Керівна посада (може бути керівником)
      </label>
      {state && !state.ok ? (
        <p role="alert" className="sm:col-span-3 text-sm text-danger">{state.error}</p>
      ) : null}
    </form>
  );
}
