import { z } from "zod";

/**
 * Схеми — єдине джерело правди про форму даних.
 * Дати приходять із <input type="date"> як «YYYY-MM-DD»; z.coerce.date()
 * розбирає такий рядок як опівніч UTC, що збігається з інваріантом дат.
 */

/** Порожнє поле форми — це «не заповнено», а не порожній рядок. */
export function formValue(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

export function formBool(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

const nameField = z
  .string()
  .min(2, "Щонайменше 2 символи")
  .max(60, "Задовго");

const optionalEmail = z.email("Некоректна адреса пошти").nullable();
const optionalPhone = z
  .string()
  .regex(/^[\d\s+()-]{5,20}$/, "Некоректний номер телефону")
  .nullable();

export const employeeCoreSchema = z.object({
  lastName: nameField,
  firstName: nameField,
  middleName: z.string().max(60).nullable(),

  workEmail: optionalEmail,
  personalEmail: optionalEmail,
  phone: optionalPhone,
  telegram: z.string().max(60).nullable(),
  mattermost: z.string().max(60).nullable(),
  city: z.string().max(80).nullable(),

  gender: z.enum(["MALE", "FEMALE", "UNSPECIFIED"]),
  birthDate: z.coerce.date().nullable(),

  hireDate: z.coerce.date({ error: "Вкажіть дату найму" }),
  probationEndDate: z.coerce.date().nullable(),

  status: z.enum(["PROBATION", "ACTIVE", "TERMINATED"]),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "FOP", "INTERN"]),

  positionId: z.string().nullable(),
  departmentId: z.string().nullable(),

  emergencyContactName: z.string().max(120).nullable(),
  emergencyContactPhone: optionalPhone,

  // Виплати (з можливістю розподілу на два способи)
  payoutTotal: z.coerce.number().min(0, "Сума не може бути від'ємною").nullable(),
  payoutCurrency: z.string().max(10).nullable(),
  paymentType: z.enum(["CRYPTO", "CASH", "FOP"]).nullable(),
  payoutAmount: z.coerce.number().min(0, "Сума не може бути від'ємною").nullable(),
  walletAddress: z.string().max(200).nullable(),
  paymentType2: z.enum(["CRYPTO", "CASH", "FOP"]).nullable(),
  payoutAmount2: z.coerce.number().min(0, "Сума не може бути від'ємною").nullable(),
  walletAddress2: z.string().max(200).nullable(),

  note: z.string().max(2000).nullable(),
});

export type EmployeeCoreInput = z.infer<typeof employeeCoreSchema>;

/** Те, що співробітник може змінити сам у своєму профілі. */
export const selfContactsSchema = z.object({
  personalEmail: optionalEmail,
  phone: optionalPhone,
  telegram: z.string().max(60).nullable(),
  mattermost: z.string().max(60).nullable(),
  city: z.string().max(80).nullable(),
  emergencyContactName: z.string().max(120).nullable(),
  emergencyContactPhone: optionalPhone,
});

/** Збирає дані картки з FormData. */
export function readEmployeeForm(formData: FormData) {
  return {
    lastName: formValue(formData, "lastName") ?? "",
    firstName: formValue(formData, "firstName") ?? "",
    middleName: formValue(formData, "middleName"),
    workEmail: formValue(formData, "workEmail"),
    personalEmail: formValue(formData, "personalEmail"),
    phone: formValue(formData, "phone"),
    telegram: formValue(formData, "telegram"),
    mattermost: formValue(formData, "mattermost"),
    city: formValue(formData, "city"),
    gender: formValue(formData, "gender") ?? "UNSPECIFIED",
    birthDate: formValue(formData, "birthDate"),
    hireDate: formValue(formData, "hireDate"),
    probationEndDate: formValue(formData, "probationEndDate"),
    status: formValue(formData, "status") ?? "PROBATION",
    employmentType: formValue(formData, "employmentType") ?? "FULL_TIME",
    positionId: formValue(formData, "positionId"),
    departmentId: formValue(formData, "departmentId"),
    emergencyContactName: formValue(formData, "emergencyContactName"),
    emergencyContactPhone: formValue(formData, "emergencyContactPhone"),
    payoutTotal: formValue(formData, "payoutTotal"),
    payoutCurrency: formValue(formData, "payoutCurrency"),
    paymentType: formValue(formData, "paymentType"),
    payoutAmount: formValue(formData, "payoutAmount"),
    walletAddress: formValue(formData, "walletAddress"),
    paymentType2: formValue(formData, "paymentType2"),
    payoutAmount2: formValue(formData, "payoutAmount2"),
    walletAddress2: formValue(formData, "walletAddress2"),
    note: formValue(formData, "note"),
  };
}

/** Керівники з форми (масив id) — перший стає основним, решта — додаткові. */
export function readManagerIds(formData: FormData): string[] {
  return formData
    .getAll("managerIds")
    .map((v) => String(v).trim())
    .filter((v) => v !== "");
}

export function readSelfContactsForm(formData: FormData) {
  return {
    personalEmail: formValue(formData, "personalEmail"),
    phone: formValue(formData, "phone"),
    telegram: formValue(formData, "telegram"),
    mattermost: formValue(formData, "mattermost"),
    city: formValue(formData, "city"),
    emergencyContactName: formValue(formData, "emergencyContactName"),
    emergencyContactPhone: formValue(formData, "emergencyContactPhone"),
  };
}

/** Пошуковий ключ — SQLite не вміє insensitive-пошук по кирилиці. */
export function buildSearchKey(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}
