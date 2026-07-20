"use client";

import { useActionState, useState } from "react";
import { Check, Plus, TriangleAlert, Wrench, X } from "lucide-react";
import {
  assignAssetAction,
  createAssetAction,
  setAssetStatusAction,
  type AssetResult,
} from "@/server/actions/assets";
import { Button, Field, Input, Select } from "@/components/ui";
import { assetCategoryLabels } from "@/lib/labels";
import type { AssetCategory } from "@/generated/prisma/enums";

type EmployeeOption = { id: string; firstName: string; lastName: string };

/** Форма додавання нової одиниці майна. */
export function CreateAssetForm() {
  const [state, formAction, pending] = useActionState<AssetResult | null, FormData>(
    createAssetAction,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field label="Назва" htmlFor="name" required>
        <Input id="name" name="name" placeholder="MacBook Pro 14 M3" required />
      </Field>
      <Field label="Категорія" htmlFor="category">
        <Select id="category" name="category" defaultValue="LAPTOP">
          {(Object.keys(assetCategoryLabels) as AssetCategory[]).map((key) => (
            <option key={key} value={key}>
              {assetCategoryLabels[key]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Інвентарний номер" htmlFor="inventoryNumber">
        <Input id="inventoryNumber" name="inventoryNumber" placeholder="INV-0042" />
      </Field>
      <Field label="Серійний номер" htmlFor="serialNumber">
        <Input id="serialNumber" name="serialNumber" />
      </Field>
      <Field label="Дата придбання" htmlFor="purchaseDate">
        <Input id="purchaseDate" name="purchaseDate" type="date" />
      </Field>
      <Field label="Нотатка" htmlFor="note">
        <Input id="note" name="note" />
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
        <p className="sm:col-span-2 rounded-lg border border-success-line bg-success-soft px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          <Plus className="size-4" aria-hidden />
          {pending ? "Додаємо…" : "Додати майно"}
        </Button>
      </div>
    </form>
  );
}

/** Видача одиниці співробітнику та зміна статусу — в рядку списку. */
export function AssetRowControls({
  assetId,
  assignedToId,
  status,
  employees,
}: {
  assetId: string;
  assignedToId: string | null;
  status: string;
  employees: EmployeeOption[];
}) {
  const [assignState, assignAction, assigning] = useActionState<AssetResult | null, FormData>(
    assignAssetAction,
    null,
  );
  const [statusState, statusAction, changingStatus] = useActionState<AssetResult | null, FormData>(
    setAssetStatusAction,
    null,
  );

  const [selected, setSelected] = useState(assignedToId ?? "");
  const busy = assigning || changingStatus;
  const error = (assignState && !assignState.ok && assignState.error) ||
    (statusState && !statusState.ok && statusState.error) || null;

  if (status === "WRITTEN_OFF") {
    return (
      <form action={statusAction} className="flex items-center gap-2">
        <input type="hidden" name="assetId" value={assetId} />
        <input type="hidden" name="status" value="IN_STOCK" />
        <Button type="submit" variant="ghost" size="sm" disabled={busy}>
          Повернути на склад
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <form action={assignAction} className="flex items-center gap-1.5">
        <input type="hidden" name="assetId" value={assetId} />
        <Select
          name="employeeId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-8 min-w-40 text-xs"
        >
          <option value="">— на складі —</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.lastName} {e.firstName}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="secondary" disabled={busy}>
          <Check className="size-3.5" aria-hidden />
          {selected ? "Видати" : "Зняти"}
        </Button>
      </form>

      <div className="flex items-center gap-1">
        {status !== "REPAIR" ? (
          <form action={statusAction}>
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="status" value="REPAIR" />
            <Button type="submit" size="sm" variant="ghost" title="У ремонт" disabled={busy}>
              <Wrench className="size-3.5" aria-hidden />
            </Button>
          </form>
        ) : (
          <form action={statusAction}>
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="status" value="IN_STOCK" />
            <Button type="submit" size="sm" variant="ghost" title="З ремонту на склад" disabled={busy}>
              <Check className="size-3.5" aria-hidden />
            </Button>
          </form>
        )}
        <form action={statusAction}>
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="status" value="WRITTEN_OFF" />
          <Button type="submit" size="sm" variant="ghost" title="Списати" disabled={busy}>
            <X className="size-3.5" aria-hidden />
          </Button>
        </form>
      </div>

      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
