"use client";

import { useActionState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { createDepartmentAction, type DirectoryResult } from "@/server/actions/departments";
import { Button, Field, Input, Select } from "@/components/ui";
import { ui } from "@/lib/labels";

export function DepartmentForm({
  departments,
  employees,
}: {
  departments: { id: string; name: string }[];
  employees: { id: string; firstName: string; lastName: string }[];
}) {
  const [state, formAction, pending] = useActionState<DirectoryResult | null, FormData>(
    createDepartmentAction,
    null,
  );

  return (
    <form action={formAction} className="grid gap-4 p-5 sm:grid-cols-2">
      <Field label="Назва відділу" htmlFor="name" required>
        <Input id="name" name="name" placeholder="Наприклад: Розробка" required />
      </Field>

      <Field label="Батьківський відділ" htmlFor="parentId">
        <Select id="parentId" name="parentId" defaultValue="">
          <option value="">Верхній рівень</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Керівник відділу" htmlFor="headId" hint="Може погоджувати заявки відділу">
        <Select id="headId" name="headId" defaultValue="">
          <option value="">{ui.notSpecified}</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.lastName} {employee.firstName}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Опис" htmlFor="description">
        <Input id="description" name="description" />
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
          {pending ? "Створюємо…" : "Додати відділ"}
        </Button>
      </div>
    </form>
  );
}
