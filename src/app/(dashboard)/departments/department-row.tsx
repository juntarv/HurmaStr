"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Pencil, Trash2, TriangleAlert } from "lucide-react";
import {
  archiveDepartmentAction,
  updateDepartmentAction,
  type DirectoryResult,
} from "@/server/actions/departments";
import { Avatar, Button, Card, Field, Input, Select } from "@/components/ui";
import { DepartmentIcon, safeColor } from "@/components/icons";
import { pluralUk } from "@/lib/dates";
import { ui } from "@/lib/labels";

type Dept = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  colorHex: string;
  parentId: string | null;
  parentName: string | null;
  head: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
  count: number;
};
type Option = { id: string; name: string };
type Emp = { id: string; firstName: string; lastName: string };

export function DepartmentRow({
  department,
  departments,
  employees,
  canManage,
}: {
  department: Dept;
  departments: Option[];
  employees: Emp[];
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState<DirectoryResult | null, FormData>(
    updateDepartmentAction,
    null,
  );
  const [archState, archAction, archiving] = useActionState<DirectoryResult | null, FormData>(
    archiveDepartmentAction,
    null,
  );
  const [editing, setEditing] = useState(false);
  const color = safeColor(department.colorHex, "#E38324");

  if (editing) {
    return (
      <Card className="p-5">
        <form
          action={formAction}
          onSubmit={() => setTimeout(() => setEditing(false), 50)}
          className="grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={department.id} />
          <Field label="Назва" htmlFor={`name-${department.id}`} required>
            <Input id={`name-${department.id}`} name="name" defaultValue={department.name} required />
          </Field>
          <Field label="Батьківський відділ" htmlFor={`parent-${department.id}`}>
            <Select id={`parent-${department.id}`} name="parentId" defaultValue={department.parentId ?? ""}>
              <option value="">Верхній рівень</option>
              {departments
                .filter((d) => d.id !== department.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </Select>
          </Field>
          <Field label="Керівник відділу" htmlFor={`head-${department.id}`}>
            <Select id={`head-${department.id}`} name="headId" defaultValue={department.head?.id ?? ""}>
              <option value="">{ui.notSpecified}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.lastName} {e.firstName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Опис" htmlFor={`desc-${department.id}`}>
            <Input id={`desc-${department.id}`} name="description" defaultValue={department.description ?? ""} />
          </Field>

          {state && !state.ok ? (
            <p role="alert" className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          ) : null}

          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              <Check className="size-3.5" aria-hidden /> Зберегти
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {ui.cancel}
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span
        className="flex size-10 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: color }}
      >
        <DepartmentIcon icon={department.icon} className="size-5" />
      </span>

      <div className="min-w-44 flex-1">
        <p className="text-sm font-medium text-ink">{department.name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          {department.parentName ? `у складі «${department.parentName}»` : "Верхній рівень"}
          {department.description ? ` · ${department.description}` : ""}
        </p>
      </div>

      {department.head ? (
        <Link
          href={`/employees/${department.head.id}`}
          className="flex items-center gap-2 text-xs text-ink-soft hover:text-brand"
        >
          <Avatar
            firstName={department.head.firstName}
            lastName={department.head.lastName}
            avatarUrl={department.head.avatarUrl}
            size="sm"
          />
          {department.head.lastName} {department.head.firstName}
        </Link>
      ) : (
        <span className="text-xs text-ink-faint">Керівник {ui.notSpecified.toLowerCase()}</span>
      )}

      <span className="inline-flex items-center rounded-full border border-line bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">
        {department.count} {pluralUk(department.count, ["особа", "особи", "осіб"])}
      </span>

      {canManage ? (
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" aria-hidden /> Змінити
          </Button>
          <form action={archAction}>
            <input type="hidden" name="id" value={department.id} />
            <Button type="submit" variant="ghost" size="sm" disabled={archiving} title="Архівувати відділ">
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          </form>
        </div>
      ) : null}

      {archState && !archState.ok ? (
        <p role="alert" className="w-full text-xs text-danger">{archState.error}</p>
      ) : null}
    </Card>
  );
}
