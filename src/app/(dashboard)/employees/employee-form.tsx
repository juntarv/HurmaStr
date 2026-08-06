"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { ActionResult } from "@/server/actions/employees";
import { Avatar, Button, Card, CardHeader, Divider, Field, Input, Select, Textarea } from "@/components/ui";
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
  avatarUrl: string | null;
  gender: Gender;
  birthDate: Date | null;
  hireDate: Date | null;
  probationEndDate: Date | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  positionId: string | null;
  departmentId: string | null;
  managerIds: string[];
  workEmail: string | null;
  personalEmail: string | null;
  phone: string | null;
  telegram: string | null;
  mattermost: string | null;
  city: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  payoutTotal: number | null;
  payoutCurrency: string | null;
  paymentType: PaymentType | null;
  payoutAmount: number | null;
  walletAddress: string | null;
  paymentType2: PaymentType | null;
  payoutAmount2: number | null;
  walletAddress2: string | null;
  note: string | null;
};

export type FormOptions = {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string }[];
  managers: { id: string; firstName: string; lastName: string; position: { title: string } | null }[];
};

function dateInputValue(value: Date | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function PaymentMethod({
  n,
  type,
  amount,
  wallet,
}: {
  n: 1 | 2;
  type: PaymentType | null;
  amount: number | null;
  wallet: string | null;
}) {
  const suffix = n === 1 ? "" : "2";
  return (
    <div className="grid gap-4 rounded-lg border border-line bg-surface-muted/50 p-4 sm:grid-cols-2">
      <p className="sm:col-span-2 text-xs font-semibold text-ink-soft">
        Спосіб №{n}{n === 2 ? " (не обов'язково)" : ""}
      </p>
      <Field label="Тип оплати" htmlFor={`paymentType${suffix}`}>
        <Select id={`paymentType${suffix}`} name={`paymentType${suffix}`} defaultValue={type ?? ""}>
          <option value="">{ui.notSpecified}</option>
          {(Object.keys(paymentTypeLabels) as PaymentType[]).map((key) => (
            <option key={key} value={key}>{paymentTypeLabels[key]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Сума" htmlFor={`payoutAmount${suffix}`}>
        <Input
          id={`payoutAmount${suffix}`}
          name={`payoutAmount${suffix}`}
          type="number"
          step="0.01"
          min="0"
          defaultValue={amount ?? ""}
          placeholder="0"
        />
      </Field>
      <Field label="Гаманець / реквізити" htmlFor={`walletAddress${suffix}`} className="sm:col-span-2">
        <Input
          id={`walletAddress${suffix}`}
          name={`walletAddress${suffix}`}
          defaultValue={wallet ?? ""}
          placeholder="TRC20: T… / IBAN / картка"
        />
      </Field>
    </div>
  );
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
  const selectedManagers = new Set(v.managerIds ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}

      {/* ------------------------------ Основне ------------------------------ */}
      <Card>
        <CardHeader title="Основне" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {/* Фото */}
          <Field label="Фото" htmlFor="photo" className="sm:col-span-2">
            <div className="flex items-center gap-4">
              <Avatar
                firstName={v.firstName ?? "?"}
                lastName={v.lastName ?? "?"}
                avatarUrl={v.avatarUrl}
                size="lg"
              />
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/*"
                className="block text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand-line"
              />
            </div>
          </Field>

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
                <option key={key} value={key}>{genderLabels[key]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Дата народження" htmlFor="birthDate" hint="Показується у важливих датах">
            <Input id="birthDate" name="birthDate" type="date" defaultValue={dateInputValue(v.birthDate)} />
          </Field>
        </div>
      </Card>

      {/* ------------------------------- Робота ------------------------------ */}
      <Card>
        <CardHeader title="Робота" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Дата найму" htmlFor="hireDate" required hint="Від неї рахуються річниці та нарахування днів">
            <Input id="hireDate" name="hireDate" type="date" defaultValue={dateInputValue(v.hireDate)} required />
          </Field>
          <Field label="Статус" htmlFor="status">
            <Select id="status" name="status" defaultValue={v.status ?? "PROBATION"}>
              {(Object.keys(employeeStatusLabels) as EmployeeStatus[]).map((key) => (
                <option key={key} value={key}>{employeeStatusLabels[key]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Кінець випробувального" htmlFor="probationEndDate">
            <Input id="probationEndDate" name="probationEndDate" type="date" defaultValue={dateInputValue(v.probationEndDate)} />
          </Field>
          {!v.id ? (
            <Field
              label="Відпустка вже накопичена (днів)"
              htmlFor="startingVacationDays"
              hint="Для міграції: скільки днів у людини вже є. Далі баланс рахується сам"
            >
              <Input id="startingVacationDays" name="startingVacationDays" type="number" step="0.5" min="0" placeholder="напр. 15" />
            </Field>
          ) : null}
          <Field label="Тип зайнятості" htmlFor="employmentType">
            <Select id="employmentType" name="employmentType" defaultValue={v.employmentType ?? "FULL_TIME"}>
              {(Object.keys(employmentTypeLabels) as EmploymentType[]).map((key) => (
                <option key={key} value={key}>{employmentTypeLabels[key]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Відділ" htmlFor="departmentId">
            <Select id="departmentId" name="departmentId" defaultValue={v.departmentId ?? ""}>
              <option value="">{ui.notSpecified}</option>
              {options.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Посада" htmlFor="positionId">
            <Select id="positionId" name="positionId" defaultValue={v.positionId ?? ""}>
              <option value="">{ui.notSpecified}</option>
              {options.positions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </Select>
          </Field>

          {/* Керівники (кілька; лише керівні посади) */}
          <Field
            label="Керівники"
            hint="Погоджують заявки на відсутність. Обрати можна кількох (перший — основний)"
            className="sm:col-span-2"
          >
            {options.managers.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Немає керівних посад. Позначте посаду як керівну в розділі «Посади».
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2">
                {options.managers.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-surface-muted"
                  >
                    <input
                      type="checkbox"
                      name="managerIds"
                      value={m.id}
                      defaultChecked={selectedManagers.has(m.id)}
                      className="size-4 accent-[var(--color-brand)]"
                    />
                    <span className="text-ink">{m.lastName} {m.firstName}</span>
                    {m.position ? <span className="text-xs text-ink-muted">· {m.position.title}</span> : null}
                  </label>
                ))}
              </div>
            )}
          </Field>
        </div>
      </Card>

      {/* ------------------------------ Контакти ----------------------------- */}
      <Card>
        <CardHeader title="Контакти" />
        <Divider />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Робоча пошта" htmlFor="workEmail" hint="Пропонується як логін під час створення доступу">
            <Input id="workEmail" name="workEmail" type="email" defaultValue={v.workEmail ?? ""} />
          </Field>
          <Field label="Особиста пошта" htmlFor="personalEmail">
            <Input id="personalEmail" name="personalEmail" type="email" defaultValue={v.personalEmail ?? ""} />
          </Field>
          <Field label="Телефон" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={v.phone ?? ""} placeholder="+380 XX XXX XX XX" />
          </Field>
          <Field label="Telegram" htmlFor="telegram">
            <Input id="telegram" name="telegram" defaultValue={v.telegram ?? ""} placeholder="@nickname" />
          </Field>
          <Field label="MatterMost" htmlFor="mattermost">
            <Input id="mattermost" name="mattermost" defaultValue={v.mattermost ?? ""} placeholder="@nickname" />
          </Field>
          <Field label="Місто" htmlFor="city">
            <Input id="city" name="city" defaultValue={v.city ?? ""} />
          </Field>
          <Field label="Контакт для екстрених випадків" htmlFor="emergencyContactName">
            <Input id="emergencyContactName" name="emergencyContactName" defaultValue={v.emergencyContactName ?? ""} />
          </Field>
          <Field label="Телефон екстреного контакту" htmlFor="emergencyContactPhone">
            <Input id="emergencyContactPhone" name="emergencyContactPhone" defaultValue={v.emergencyContactPhone ?? ""} />
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
        <div className="grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <Field label="Загальна ставка" htmlFor="payoutTotal" hint="Сумарно за всіма способами">
              <Input id="payoutTotal" name="payoutTotal" type="number" step="0.01" min="0" defaultValue={v.payoutTotal ?? ""} placeholder="0" />
            </Field>
            <Field label="Валюта" htmlFor="payoutCurrency">
              <Input id="payoutCurrency" name="payoutCurrency" defaultValue={v.payoutCurrency ?? ""} placeholder="USDT" />
            </Field>
          </div>
          <p className="text-xs text-ink-muted">Оплату можна розподілити на два способи (напр. крипто + ФОП).</p>
          <PaymentMethod n={1} type={v.paymentType ?? null} amount={v.payoutAmount ?? null} wallet={v.walletAddress ?? null} />
          <PaymentMethod n={2} type={v.paymentType2 ?? null} amount={v.payoutAmount2 ?? null} wallet={v.walletAddress2 ?? null} />
        </div>
      </Card>

      {state && !state.ok ? (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Зберігаємо…" : submitLabel}
        </Button>
        <Link href={v.id ? `/employees/${v.id}` : "/employees"}>
          <Button type="button" variant="ghost">{ui.cancel}</Button>
        </Link>
      </div>
    </form>
  );
}
