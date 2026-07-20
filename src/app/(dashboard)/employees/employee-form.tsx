"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { ActionResult } from "@/server/actions/employees";
import { Button, Card, CardHeader, Divider, Field, Input, Select, Textarea } from "@/components/ui";
import {
  employeeStatusLabels,
  employmentTypeLabels,
  genderLabels,
  paymentTypeLabels,
  ui,
} from "@/lib/labels";
import type {
  EmployeeStatus,
  EmploymentType,
  Gender,
  PaymentType,
} from "@/generated/prisma/enums";

export type EmployeeFormValues = {
  id?: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  gender: Gender;
  birthDate: Date | null;
  hireDate: Date | null;
  probationEndDate: Date | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  positionId: string | null;
  departmentId: string | null;
  managerId: string | null;
  workEmail: string | null;
  personalEmail: string | null;
  phone: string | null;
  telegram: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  paymentType: PaymentType | null;
  payoutAmount: number | null;
  payoutCurrency: string | null;
  walletAddress: string | null;
  note: string | null;
};

export type FormOptions = {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  managers: { id: string; firstName: string; lastName: string }[];
};

/** Date → «YYYY-MM-DD» для <input type="date">. */
function dateInputValue(value: Date | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function EmployeeForm({
  action,
  options,
  values,
  submitLabel,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  options: FormOptions;
  values?: Partial<EmployeeFormValues>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(action, null);
  const v = values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}

      {/* ------------------------------ Основне ------------------------------ */}
      <Card>
        <CardHeader title="Основне" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Прізвище" htmlFor="lastName" required>
            <Input id="lastName" name="lastName" defaultValue={v.lastName ?? ""} required />
          </Field>
          <Field label="Ім'я" htmlFor="firstName" required>
            <Input id="firstName" name="firstName" defaultValue={v.firstName ?? ""} required />
          </Field>
          <Field label="По батькові" htmlFor="middleName">
            <Input id="middleName" name="middleName" defaultValue={v.middleName ?? ""} />
          </Field>
          <Field label="Стать" htmlFor="gender">
            <Select id="gender" name="gender" defaultValue={v.gender ?? "UNSPECIFIED"}>
              {(Object.keys(genderLabels) as Gender[]).map((key) => (
                <option key={key} value={key}>
                  {genderLabels[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата народження" htmlFor="birthDate" hint="Показується у важливих датах">
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              defaultValue={dateInputValue(v.birthDate)}
            />
          </Field>
        </div>
      </Card>

      {/* ------------------------------- Робота ------------------------------ */}
      <Card>
        <CardHeader title="Робота" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Дата найму"
            htmlFor="hireDate"
            required
            hint="Від неї рахуються річниці та нарахування днів"
          >
            <Input
              id="hireDate"
              name="hireDate"
              type="date"
              defaultValue={dateInputValue(v.hireDate)}
              required
            />
          </Field>
          <Field label="Статус" htmlFor="status">
            <Select id="status" name="status" defaultValue={v.status ?? "PROBATION"}>
              {(Object.keys(employeeStatusLabels) as EmployeeStatus[]).map((key) => (
                <option key={key} value={key}>
                  {employeeStatusLabels[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Кінець випробувального" htmlFor="probationEndDate">
            <Input
              id="probationEndDate"
              name="probationEndDate"
              type="date"
              defaultValue={dateInputValue(v.probationEndDate)}
            />
          </Field>
          <Field label="Тип зайнятості" htmlFor="employmentType">
            <Select
              id="employmentType"
              name="employmentType"
              defaultValue={v.employmentType ?? "FULL_TIME"}
            >
              {(Object.keys(employmentTypeLabels) as EmploymentType[]).map((key) => (
                <option key={key} value={key}>
                  {employmentTypeLabels[key]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Відділ" htmlFor="departmentId">
            <Select id="departmentId" name="departmentId" defaultValue={v.departmentId ?? ""}>
              <option value="">{ui.notSpecified}</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Посада" htmlFor="positionId">
            <Select id="positionId" name="positionId" defaultValue={v.positionId ?? ""}>
              <option value="">{ui.notSpecified}</option>
              {options.positions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Керівник"
            htmlFor="managerId"
            hint="Погоджує заявки на відсутність"
            className="sm:col-span-2"
          >
            <Select id="managerId" name="managerId" defaultValue={v.managerId ?? ""}>
              <option value="">{ui.notSpecified}</option>
              {options.managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.lastName} {manager.firstName}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {/* ------------------------------ Контакти ----------------------------- */}
      <Card>
        <CardHeader title="Контакти" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field
            label="Робоча пошта"
            htmlFor="workEmail"
            hint="Пропонується як логін під час створення доступу"
          >
            <Input id="workEmail" name="workEmail" type="email" defaultValue={v.workEmail ?? ""} />
          </Field>
          <Field label="Особиста пошта" htmlFor="personalEmail">
            <Input
              id="personalEmail"
              name="personalEmail"
              type="email"
              defaultValue={v.personalEmail ?? ""}
            />
          </Field>
          <Field label="Телефон" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={v.phone ?? ""} placeholder="+380 XX XXX XX XX" />
          </Field>
          <Field label="Telegram" htmlFor="telegram">
            <Input id="telegram" name="telegram" defaultValue={v.telegram ?? ""} placeholder="@nickname" />
          </Field>
          <Field label="Місто" htmlFor="city">
            <Input id="city" name="city" defaultValue={v.city ?? ""} />
          </Field>
          <div />
          <Field label="Контакт для екстрених випадків" htmlFor="emergencyContactName">
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={v.emergencyContactName ?? ""}
            />
          </Field>
          <Field label="Телефон екстреного контакту" htmlFor="emergencyContactPhone">
            <Input
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              defaultValue={v.emergencyContactPhone ?? ""}
            />
          </Field>
          <Field label="Службова нотатка" htmlFor="note" className="sm:col-span-2">
            <Textarea id="note" name="note" defaultValue={v.note ?? ""} rows={3} />
          </Field>
        </div>
      </Card>

      {/* ------------------------------ Виплати ------------------------------ */}
      <Card>
        <CardHeader title="Виплати" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Тип оплати" htmlFor="paymentType">
            <Select id="paymentType" name="paymentType" defaultValue={v.paymentType ?? ""}>
              <option value="">{ui.notSpecified}</option>
              {(Object.keys(paymentTypeLabels) as PaymentType[]).map((key) => (
                <option key={key} value={key}>
                  {paymentTypeLabels[key]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Field label="Сума" htmlFor="payoutAmount">
              <Input
                id="payoutAmount"
                name="payoutAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={v.payoutAmount ?? ""}
                placeholder="0"
              />
            </Field>
            <Field label="Валюта" htmlFor="payoutCurrency">
              <Input
                id="payoutCurrency"
                name="payoutCurrency"
                defaultValue={v.payoutCurrency ?? ""}
                placeholder="USDT"
                className="w-24"
              />
            </Field>
          </div>
          <Field
            label="Гаманець / реквізити"
            htmlFor="walletAddress"
            hint="Крипто-адреса, номер картки або реквізити ФОП"
            className="sm:col-span-2"
          >
            <Input
              id="walletAddress"
              name="walletAddress"
              defaultValue={v.walletAddress ?? ""}
              placeholder="TRC20: T… / IBAN / картка"
            />
          </Field>
        </div>
      </Card>

      {state && !state.ok ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Зберігаємо…" : submitLabel}
        </Button>
        <Link href={v.id ? `/employees/${v.id}` : "/employees"}>
          <Button type="button" variant="ghost">
            {ui.cancel}
          </Button>
        </Link>
      </div>
    </form>
  );
}
