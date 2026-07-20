import type {
  AccrualMode,
  ApprovalStepStatus,
  ApprovalRoute,
  ApproverRole,
  AssetCategory,
  AssetStatus,
  EmployeeStatus,
  EmploymentType,
  Gender,
  LeaveStatus,
  LeaveUnit,
  PaymentType,
  PayKind,
  Role,
} from "@/generated/prisma/enums";

/**
 * Єдине джерело українських підписів. У JSX не має бути хардкод-рядків
 * для доменних значень — інакше термінологія розповзається по екранах.
 */

export const roleLabels: Record<Role, string> = {
  ADMIN: "Адміністратор",
  HR: "HR-менеджер",
  MANAGER: "Керівник",
  EMPLOYEE: "Співробітник",
};

export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  PROBATION: "Випробувальний термін",
  ACTIVE: "Працює",
  TERMINATED: "Звільнений",
};

export const employmentTypeLabels: Record<EmploymentType, string> = {
  FULL_TIME: "Повна зайнятість",
  PART_TIME: "Часткова зайнятість",
  CONTRACT: "Строковий договір",
  FOP: "ФОП (договір з підприємцем)",
  INTERN: "Стажування",
};

export const genderLabels: Record<Gender, string> = {
  MALE: "Чоловіча",
  FEMALE: "Жіноча",
  UNSPECIFIED: "Не вказано",
};

export const paymentTypeLabels: Record<PaymentType, string> = {
  CRYPTO: "Крипто",
  CASH: "Готівка",
  FOP: "ФОП",
};

export const paymentTypeIcons: Record<PaymentType, string> = {
  CRYPTO: "Bitcoin",
  CASH: "Banknote",
  FOP: "Landmark",
};

export const leaveUnitLabels: Record<LeaveUnit, string> = {
  CALENDAR_DAYS: "Календарні дні",
  WORKING_DAYS: "Робочі дні",
};

export const payKindLabels: Record<PayKind, string> = {
  PAID: "Оплачувана",
  UNPAID: "Без збереження зарплати",
  // Фонд соцстрахування ліквідовано у 2023 р., виплати адмініструє ПФУ.
  STATE_FUNDED: "За рахунок ПФУ",
};

export const approvalRouteLabels: Record<ApprovalRoute, string> = {
  MANAGER_THEN_HR: "Керівник, потім HR",
  MANAGER_ONLY: "Лише керівник",
  HR_ONLY: "Лише HR",
};

export const leaveStatusLabels: Record<LeaveStatus, string> = {
  DRAFT: "Чернетка",
  PENDING: "На погодженні",
  APPROVED: "Погоджено",
  REJECTED: "Відхилено",
  CANCELLED: "Скасовано",
};

export const approvalStepStatusLabels: Record<ApprovalStepStatus, string> = {
  PENDING: "Очікує рішення",
  APPROVED: "Погоджено",
  REJECTED: "Відхилено",
  SKIPPED: "Пропущено",
};

export const approverRoleLabels: Record<ApproverRole, string> = {
  MANAGER: "Керівник",
  HR: "HR",
};

export const accrualModeLabels: Record<AccrualMode, string> = {
  MONTHLY: "Щомісячне нарахування",
  ANNUAL: "Річна норма",
  NONE: "Без балансу",
};

export const assetCategoryLabels: Record<AssetCategory, string> = {
  LAPTOP: "Ноутбук",
  MONITOR: "Монітор",
  PHONE: "Телефон",
  TABLET: "Планшет",
  PERIPHERAL: "Периферія",
  FURNITURE: "Меблі",
  ACCESS_CARD: "Перепустка",
  OTHER: "Інше",
};

export const assetStatusLabels: Record<AssetStatus, string> = {
  IN_USE: "Видано",
  IN_STOCK: "На складі",
  REPAIR: "У ремонті",
  WRITTEN_OFF: "Списано",
};

export const assetStatusTone: Record<AssetStatus, "neutral" | "brand" | "success" | "warning"> = {
  IN_USE: "brand",
  IN_STOCK: "success",
  REPAIR: "warning",
  WRITTEN_OFF: "neutral",
};

export const assetCategoryIcons: Record<AssetCategory, string> = {
  LAPTOP: "Laptop",
  MONITOR: "Monitor",
  PHONE: "Smartphone",
  TABLET: "Tablet",
  PERIPHERAL: "Mouse",
  FURNITURE: "Armchair",
  ACCESS_CARD: "IdCard",
  OTHER: "Package",
};

/** Кольорові теми бейджів статусів. */
export const leaveStatusTone: Record<LeaveStatus, "neutral" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export const employeeStatusTone: Record<EmployeeStatus, "neutral" | "warning" | "success"> = {
  PROBATION: "warning",
  ACTIVE: "success",
  TERMINATED: "neutral",
};

/** Загальні підписи інтерфейсу. */
export const ui = {
  appName: "HurmaStr",
  appTagline: "Облік співробітників",

  save: "Зберегти",
  cancel: "Скасувати",
  // Кнопка закриття діалогу — навмисно НЕ «Скасувати»,
  // щоб не конфліктувати з доменною дією «Скасувати заявку».
  close: "Закрити",
  back: "Назад",
  create: "Створити",
  edit: "Редагувати",
  archive: "Архівувати",
  restore: "Відновити",
  search: "Пошук",
  filters: "Фільтри",
  resetFilters: "Скинути фільтри",
  loading: "Завантаження…",
  nothingFound: "Нічого не знайдено",
  tryAgain: "Спробувати ще раз",
  required: "Обов'язкове поле",
  all: "Усі",
  notSpecified: "Не вказано",
} as const;
