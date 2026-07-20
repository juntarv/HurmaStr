# HurmaStr — Єдина білд-специфікація MVP

**Проєкт:** `C:\Users\Admin\Desktop\HurmaStr`
**Статус:** консолідація документів A (модель даних), B (модуль співробітників), C (модуль відпусток), D (UX/тех/глосарій) в одне несуперечливе джерело правди.
**Верифіковано на реальному стані репозиторію** (`package.json`, `prisma.config.ts`, `src/lib/prisma.ts`, `prisma/schema.prisma`) та `npx prisma validate` + `migrate diff` (58 DDL-стейтментів, помилок немає).

---

## 0. Реєстр розв'язаних суперечностей

Чотири документи суперечать одне одному у 14 місцях. Нижче — прийняті рішення. **Усе, що суперечить цій таблиці в документах A–D, вважається скасованим.**

| # | Питання | A | B | C | D | **РІШЕННЯ** | Обґрунтування |
|---|---|---|---|---|---|---|---|
| 1 | `User` окремо чи авторизація на `Employee` | окремо | на Employee | окремо | окремо | **Окремі `User` + `Employee` (1:1 опційно, FK на боці `User`)** | Employee — кадрова сутність; звільнені лишаються в довіднику без акаунта; сторінка `/settings/users` з D потребує окремої сутності |
| 2 | Prisma `enum` на SQLite | так (перевірено) | так | так | ні, тільки `String` | **Native `enum`** | Емпірично перевірено на Prisma 7.8: enum компілюється в `TEXT NOT NULL DEFAULT`. Твердження D застаріле |
| 3 | `url` у `datasource` | немає | `env(...)` | — | `env(...)` | **`datasource` = тільки `provider`** | Prisma 7 кидає P1012; URL живе в `prisma.config.ts` (уже так у репо) |
| 4 | Тип для днів | `Float` | `Int` | `Decimal` | `Int` | **`Float`** | Значення кратні 0.5, точно представні в IEEE-754; Decimal тягне DecimalJS через RSC-межу |
| 5 | Гранулярність `LeaveStatus` | `PENDING_MANAGER`/`PENDING_HR` | — | `PENDING` + `currentStep` | `PENDING` | **`DRAFT PENDING APPROVED REJECTED CANCELLED` + `currentStep` + таблиця `LeaveApproval`** | Крок зберігається в `LeaveApproval`, а не в статусі → маршрут розширюваний без міграції |
| 6 | Назва довідника типів | `LeaveType` | — | `AbsenceType` | `LeaveType` | **`LeaveType`** | 2:1; UI-підпис лишається «Тип відсутності» |
| 7 | Модель свят | `CompanyHoliday` | — | `CompanyHoliday` | `Holiday` | **`Holiday`** | Коротше, збігається з роутом `/settings/holidays` |
| 8 | Файл проксі | `middleware.ts` | `middleware.ts` | — | `src/proxy.ts` | **`src/proxy.ts`, `export function proxy()`** | Next 16 перейменував middleware → proxy; перевірено в докsах Next у `node_modules` |
| 9 | Роути відсутностей | — | — | `/absences`, `/approvals`, `/calendar`, `/admin/*` | `/leaves/*`, `/settings/*` | **`/leaves/*` + `/settings/*`** | D — профільний IA-документ |
| 10 | Журнал руху днів (`LeaveLedgerEntry`) | немає | — | є | немає | **Є** | Без нього неможливі ідемпотентне нарахування, `/leaves/balances/[id]` і перевірка цілісності |
| 11 | Кількість типів відпусток | 13 | — | 14 | 9 | **14 (об'єднаний список, §9.4)** | Надмножина A∪C; список D — підмножина |
| 12 | Шрифт | — | — | — | Inter (cyrillic) | **Inter `subsets: ['cyrillic','latin']`** | Geist зі scaffold не має кириличного subset |
| 13 | Роут-групи | `(app)` | `(app)` | `(app)` | `(auth)`/`(dashboard)` | **`(auth)` + `(dashboard)`** | D |
| 14 | Розташування Server Actions | `src/actions/*` | `src/actions/*` | поруч зі сторінкою | `src/server/actions/*` | **`src/server/actions/*`** | Дозволяє шарити дії між сторінками; queries/services поруч |

**Додатково зафіксовано:** `personnelNumber` — **опційний** unique (B вимагав обов'язковий; це блокує швидке створення картки). `Department.headId` — **без `@unique`** (одна людина може очолювати кілька відділів).

---

## 1. Огляд і ролі

### 1.1 Продукт

HR-система обліку співробітників (аналог hurma.work) для української компанії. Мова інтерфейсу — **українська**, доменна термінологія — за КЗпП і ЗУ «Про відпустки».

**MVP = два модулі:**

- **Модуль 1 — Довідник співробітників + оргструктура:** картки співробітників, вкладені відділи, посади, ієрархія керівників, оргчарт, пошук/фільтри, ролі доступу, звільнення/архівація.
- **Модуль 2 — Відпустки / лікарняні:** заявки, баланс днів, погодження керівником/HR, календар відсутностей, українські типи відсутностей, виробничий календар.

**Поза MVP (згадано, не проєктується):** облік робочого часу, рекрутинг/ATS, оцінки та 1-on-1, звіти й аналітика.

### 1.2 Стек (зафіксовано, уже встановлено)

Next.js 16.2.10 (App Router, RSC, Server Actions) · React 19.2.4 · TypeScript 5 · Tailwind CSS v4 (`@theme` у CSS, **без `tailwind.config.js`**) · Prisma 7.8.0 + `@prisma/adapter-better-sqlite3` + `better-sqlite3` + SQLite · zod 4.4.3 · react-hook-form 7.82 + `@hookform/resolvers` 5.4 · date-fns 4.4 (`locale/uk`) · lucide-react · bcryptjs 3 · jose 6 · clsx + tailwind-merge · tsx (dev).

**Нічого доставляти не треба** — усі залежності присутні в `package.json`, `src/lib/prisma.ts` уже коректно ініціалізує Prisma 7 через driver adapter.

### 1.3 Критичні особливості платформи (визначають архітектуру)

1. **Next 16:** `cookies()`, `headers()`, `params`, `searchParams` — асинхронні, завжди `await`.
2. **Next 16:** middleware → **Proxy**. Файл `src/proxy.ts`, `export function proxy(req: NextRequest)` + `export const config = { matcher }`. Файл `middleware.ts` не створювати.
3. Proxy — **оптимістична** перевірка (наявність/підпис cookie). Реальна авторизація — в RSC і Server Actions.
4. **Cache Components не вмикати** — усі дані персоналізовані per-request.
5. **Prisma 7:** `datasource` без `url`; генератор `prisma-client`; клієнт у `src/generated/prisma`; імпорт `@/generated/prisma/client` та `@/generated/prisma/enums`; `PrismaClient` вимагає driver adapter.
6. **SQLite:** `mode: 'insensitive'` не підтримується → денормалізоване поле `Employee.searchKey`. FK вимкнені за замовчуванням → в адаптері виконати `PRAGMA foreign_keys = ON` і `PRAGMA journal_mode = WAL`.
7. **SQLite не має типу DATE** → інваріант: усі «дати-дні» зберігаються як **UTC-північ**.

### 1.4 Ролі

| Роль | UA-підпис | Обсяг доступу |
|---|---|---|
| `ADMIN` | Адміністратор | Повний доступ, у т.ч. `/settings/users` і довідники |
| `HR` | HR-менеджер | Повний доступ до кадрових і відпускних даних; без керування акаунтами |
| `MANAGER` | Керівник | Своя команда (рекурсивно по `managerId`) — перегляд і погодження |
| `EMPLOYEE` | Співробітник | Самообслуговування: свій профіль, свої заявки, оргчарт, календар |

Роль зберігається явно в `User.role` і **не виводиться** з наявності підлеглих. Право погоджувати має: керівник заявника (`Employee.managerId`) **або** керівник його відділу (`Department.head`) **або** будь-який ADMIN/HR.

### 1.5 Наскрізні інваріанти (обов'язкові)

1. **Дати-дні = UTC-північ.** Хелпери тільки в `src/lib/date.ts`. У доменному коді заборонено `new Date(y,m,d)` і голий `new Date()` — ESLint `no-restricted-syntax`.
2. **Клієнту не довіряти.** Кількість днів, статуси, дозволи рахуються на сервері. Клієнтський розрахунок — виключно прев'ю через Server Action.
3. **Кожен Server Action** починається з `requireSession()` → `assertCan(...)` → `Schema.safeParse` → транзакція → `revalidatePath`.
4. **Жодних хардкод-рядків у JSX.** Усі підписи — з `src/lib/labels.ts` / `src/schemas/*`.
5. **Ніяких фізичних видалень** співробітників, відділів, посад, типів відсутностей — тільки `isArchived` / `isActive` / `TERMINATED`. Виняток: `DRAFT`-заявка.
6. **DTO-мапери** — з Prisma-моделі назовні ніколи не віддається `passwordHash`, `taxId`, `address` без перевірки прав.

---

## 2. ФІНАЛЬНИЙ `prisma/schema.prisma`

> Готовий до вставки. Перевірено: `prisma validate` → valid; `migrate diff --from-empty` → 58 стейтментів без помилок. Замінює модель-заглушку `Probe`.

```prisma
// ============================================================================
//  HurmaStr — HR-система обліку співробітників
//  Prisma 7.8 + SQLite (dev) → PostgreSQL (prod)
// ============================================================================

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

// ============================== ENUMS =======================================

enum Role {
  ADMIN
  HR
  MANAGER
  EMPLOYEE
}

enum EmployeeStatus {
  PROBATION
  ACTIVE
  ON_LEAVE
  MATERNITY_LEAVE
  TERMINATED
}

enum EmploymentType {
  FULL_TIME
  PART_TIME
  CONTRACT
  GIG
  INTERN
}

enum WorkFormat {
  OFFICE
  REMOTE
  HYBRID
}

enum Gender {
  MALE
  FEMALE
  UNSPECIFIED
}

enum LeaveUnit {
  CALENDAR_DAYS
  WORKING_DAYS
}

enum PayKind {
  PAID
  UNPAID
  STATE_FUNDED
}

enum ApprovalRoute {
  MANAGER_THEN_HR
  MANAGER_ONLY
  HR_ONLY
  AUTO
}

enum LeaveStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum ApprovalStepStatus {
  PENDING
  APPROVED
  REJECTED
  SKIPPED
}

enum ApproverRole {
  MANAGER
  HR
}

enum HalfDayPart {
  NONE
  FIRST
  SECOND
}

enum HolidayKind {
  PUBLIC_HOLIDAY
  NON_WORKING
  SHORTENED
  WORKING_SATURDAY
}

enum LedgerKind {
  ACCRUAL
  CARRY_OVER
  USAGE
  USAGE_REVERSAL
  ADJUSTMENT
  COMPENSATION
  EXPIRY
}

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGIN_FAILED
  LOGOUT
  APPROVE
  REJECT
  CANCEL
}

// ============================== AUTH ========================================

model User {
  id                 String    @id @default(cuid())
  email              String    @unique
  passwordHash       String
  role               Role      @default(EMPLOYEE)
  isActive           Boolean   @default(true)
  tokenVersion       Int       @default(0)
  mustChangePassword Boolean   @default(false)
  lastLoginAt        DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  employeeId String?   @unique
  employee   Employee? @relation("EmployeeAccount", fields: [employeeId], references: [id], onDelete: SetNull)

  auditLogs AuditLog[] @relation("AuditActor")

  @@index([role])
  @@index([isActive])
}

// ========================== ОРГСТРУКТУРА ====================================

model Department {
  id          String  @id @default(cuid())
  name        String  @unique
  code        String? @unique
  description String?
  isArchived  Boolean @default(false)
  sortOrder   Int     @default(0)

  parentId String?
  parent   Department?  @relation("DepartmentTree", fields: [parentId], references: [id], onDelete: SetNull)
  children Department[] @relation("DepartmentTree")

  headId String?
  head   Employee? @relation("DepartmentHead", fields: [headId], references: [id], onDelete: SetNull)

  employees Employee[] @relation("EmployeeDepartment")
  positions Position[] @relation("PositionDepartment")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
  @@index([headId])
  @@index([isArchived])
}

model Position {
  id          String  @id @default(cuid())
  title       String
  grade       String?
  description String?
  isArchived  Boolean @default(false)
  sortOrder   Int     @default(0)

  departmentId String?
  department   Department? @relation("PositionDepartment", fields: [departmentId], references: [id], onDelete: SetNull)

  employees Employee[] @relation("EmployeePosition")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([title, departmentId])
  @@index([departmentId])
  @@index([isArchived])
}

model Employee {
  id String @id @default(cuid())

  lastName   String
  firstName  String
  middleName String?
  searchKey  String  @default("")

  personnelNumber String? @unique
  avatarUrl       String?
  gender          Gender  @default(UNSPECIFIED)

  workEmail     String  @unique
  personalEmail String?
  phone         String?
  telegram      String?
  city          String?
  address       String?
  taxId         String?

  emergencyContactName  String?
  emergencyContactPhone String?

  birthDate DateTime?

  hireDate          DateTime
  probationEndDate  DateTime?
  terminationDate   DateTime?
  terminationReason String?

  status         EmployeeStatus @default(PROBATION)
  employmentType EmploymentType @default(FULL_TIME)
  workFormat     WorkFormat     @default(OFFICE)
  workRate       Float          @default(1)

  isArchived Boolean   @default(false)
  archivedAt DateTime?

  positionId String?
  position   Position? @relation("EmployeePosition", fields: [positionId], references: [id], onDelete: SetNull)

  departmentId String?
  department   Department? @relation("EmployeeDepartment", fields: [departmentId], references: [id], onDelete: SetNull)

  managerId    String?
  manager      Employee?  @relation("EmployeeHierarchy", fields: [managerId], references: [id], onDelete: SetNull)
  subordinates Employee[] @relation("EmployeeHierarchy")

  account           User?        @relation("EmployeeAccount")
  headedDepartments Department[] @relation("DepartmentHead")

  leaveRequests     LeaveRequest[]     @relation("LeaveOwner")
  substitutedFor    LeaveRequest[]     @relation("LeaveSubstitute")
  createdRequests   LeaveRequest[]     @relation("LeaveAuthor")
  expectedApprovals LeaveApproval[]    @relation("ApprovalExpected")
  madeApprovals     LeaveApproval[]    @relation("ApprovalDecider")
  balances          LeaveBalance[]     @relation("BalanceEmployee")
  ledgerEntries     LeaveLedgerEntry[] @relation("LedgerEmployee")
  auditLogs         AuditLog[]         @relation("AuditEmployee")

  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([departmentId])
  @@index([positionId])
  @@index([managerId])
  @@index([status])
  @@index([searchKey])
  @@index([lastName, firstName])
  @@index([isArchived])
  @@index([hireDate])
  @@index([birthDate])
}

// ============================ ВІДСУТНОСТІ ===================================

model LeaveType {
  id          String  @id @default(cuid())
  code        String  @unique
  nameUk      String
  shortNameUk String?
  description String?

  unit            LeaveUnit @default(CALENDAR_DAYS)
  excludeHolidays Boolean   @default(true)
  payKind         PayKind   @default(PAID)
  affectsBalance  Boolean   @default(false)

  defaultEntitlement Float?
  maxPerYear         Float?
  maxConsecutiveDays Float?

  minNoticeDays        Int     @default(0)
  allowPastDates       Boolean @default(false)
  pastDatesGraceDays   Int     @default(0)
  allowNegativeBalance Boolean @default(false)
  allowHalfDay         Boolean @default(false)
  requiresDocument     Boolean @default(false)
  requiresSubstitute   Boolean @default(false)
  carryOverAllowed     Boolean @default(false)
  carryOverMaxDays     Float?

  approvalRoute ApprovalRoute @default(MANAGER_THEN_HR)

  colorHex       String  @default("#64748B")
  legalReference String?
  isActive       Boolean @default(true)
  isSystem       Boolean @default(false)
  sortOrder      Int     @default(100)

  requests LeaveRequest[]     @relation("RequestType")
  balances LeaveBalance[]     @relation("BalanceType")
  ledger   LeaveLedgerEntry[] @relation("LedgerType")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, sortOrder])
}

model Holiday {
  id     String      @id @default(cuid())
  date   DateTime    @unique
  year   Int
  nameUk String
  kind   HolidayKind @default(PUBLIC_HOLIDAY)
  note   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([year, kind])
}

model LeaveRequest {
  id     String @id @default(cuid())
  number String @unique

  employeeId String
  employee   Employee @relation("LeaveOwner", fields: [employeeId], references: [id], onDelete: Cascade)

  leaveTypeId String
  leaveType   LeaveType @relation("RequestType", fields: [leaveTypeId], references: [id], onDelete: Restrict)

  startDate    DateTime
  endDate      DateTime
  halfDayStart HalfDayPart @default(NONE)
  halfDayEnd   HalfDayPart @default(NONE)

  daysCount    Float
  unitSnapshot LeaveUnit @default(CALENDAR_DAYS)

  status      LeaveStatus @default(DRAFT)
  currentStep Int         @default(0)

  comment        String?
  documentNumber String?
  attachmentPath String?

  substituteId String?
  substitute   Employee? @relation("LeaveSubstitute", fields: [substituteId], references: [id], onDelete: SetNull)

  createdById String?
  createdBy   Employee? @relation("LeaveAuthor", fields: [createdById], references: [id], onDelete: SetNull)

  submittedAt  DateTime?
  decidedAt    DateTime?
  cancelledAt  DateTime?
  cancelReason String?

  approvals LeaveApproval[]    @relation("RequestApprovals")
  events    LeaveEvent[]       @relation("RequestEvents")
  ledger    LeaveLedgerEntry[] @relation("LedgerRequest")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([employeeId, status])
  @@index([status, startDate])
  @@index([startDate, endDate])
  @@index([leaveTypeId])
}

model LeaveApproval {
  id String @id @default(cuid())

  requestId String
  request   LeaveRequest @relation("RequestApprovals", fields: [requestId], references: [id], onDelete: Cascade)

  step   Int
  role   ApproverRole
  status ApprovalStepStatus @default(PENDING)

  approverId String?
  approver   Employee? @relation("ApprovalExpected", fields: [approverId], references: [id], onDelete: SetNull)

  decidedById String?
  decidedBy   Employee? @relation("ApprovalDecider", fields: [decidedById], references: [id], onDelete: SetNull)

  comment   String?
  decidedAt DateTime?
  createdAt DateTime  @default(now())

  @@unique([requestId, step])
  @@index([approverId, status])
  @@index([status])
}

model LeaveBalance {
  id String @id @default(cuid())

  employeeId String
  employee   Employee @relation("BalanceEmployee", fields: [employeeId], references: [id], onDelete: Cascade)

  leaveTypeId String
  leaveType   LeaveType @relation("BalanceType", fields: [leaveTypeId], references: [id], onDelete: Restrict)

  year Int
  unit LeaveUnit @default(CALENDAR_DAYS)

  entitledDays    Float @default(0)
  carriedOverDays Float @default(0)
  adjustmentDays  Float @default(0)
  usedDays        Float @default(0)
  pendingDays     Float @default(0)

  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, leaveTypeId, year])
  @@index([year])
  @@index([leaveTypeId, year])
}

model LeaveLedgerEntry {
  id String @id @default(cuid())

  employeeId String
  employee   Employee @relation("LedgerEmployee", fields: [employeeId], references: [id], onDelete: Cascade)

  leaveTypeId String
  leaveType   LeaveType @relation("LedgerType", fields: [leaveTypeId], references: [id], onDelete: Restrict)

  year  Int
  kind  LedgerKind
  days  Float
  month Int?

  requestId String?
  request   LeaveRequest? @relation("LedgerRequest", fields: [requestId], references: [id], onDelete: SetNull)

  reasonUk    String
  createdById String?
  createdAt   DateTime @default(now())

  @@index([employeeId, leaveTypeId, year])
  @@index([requestId])
  @@index([kind, year])
}

model LeaveEvent {
  id String @id @default(cuid())

  requestId String
  request   LeaveRequest @relation("RequestEvents", fields: [requestId], references: [id], onDelete: Cascade)

  actorId    String?
  action     String
  fromStatus LeaveStatus?
  toStatus   LeaveStatus?
  payload    Json?

  createdAt DateTime @default(now())

  @@index([requestId, createdAt])
}

model LeaveSettings {
  id String @id @default("default")

  workingWeekdays             String  @default("1,2,3,4,5")
  martialLawHolidaysSuspended Boolean @default(true)
  accrualMode                 String  @default("MONTHLY_PRORATA")
  carryOverEnabled            Boolean @default(true)
  carryOverMaxDays            Float?
  simpleApproval              Boolean @default(false)
  probationBlocksAnnual       Boolean @default(true)
  approvalOverdueDays         Int     @default(3)

  updatedAt DateTime @updatedAt
}

// ============================== АУДИТ =======================================

model AuditLog {
  id String @id @default(cuid())

  action     AuditAction
  entityType String
  entityId   String?
  summary    String?
  changes    Json?

  actorUserId String?
  actorUser   User?   @relation("AuditActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  actorEmployeeId String?
  actorEmployee   Employee? @relation("AuditEmployee", fields: [actorEmployeeId], references: [id], onDelete: SetNull)

  ipAddress String?
  userAgent String?

  createdAt DateTime @default(now())

  @@index([entityType, entityId])
  @@index([actorUserId])
  @@index([createdAt])
}
```

### 2.1 Пояснення ключових полів

| Поле | Навіщо |
|---|---|
| `User.tokenVersion` | JWT stateless, таблиці сесій немає. Клеїмо версію в payload; при звільненні / зміні ролі / «вийти всюди» робимо `tokenVersion++` — усі старі токени миттєво невалідні |
| `Employee.searchKey` | SQLite не вміє `mode:'insensitive'`, `LIKE` не знижує регістр кирилиці. Перераховується на кожному create/update |
| `Employee.workRate` | Ставка 0.5/1.0. Впливає **лише** на нарахування днів, не на розрахунок тривалості заявки |
| `LeaveRequest.daysCount` | Фіксується **на момент подання**. Зміна довідника свят не «перевзуває» історію |
| `LeaveRequest.unitSnapshot` | Знімок `LeaveType.unit`; захист від зміни налаштувань типу заднім числом |
| `LeaveRequest.number` | Людський номер `ЗВ-2026-000042`, генерується в `lib/leave/numbering.ts` |
| `LeaveBalance` | **Кеш.** Джерело істини — `LeaveLedgerEntry`. `recomputeBalance()` перебудовує кеш із журналу |
| `LeaveBalance.pendingDays` | Без нього співробітник подає 3 заявки поспіль і йде в мінус, бо жодна ще не погоджена |
| **`remainingDays` НЕ зберігається** | `available = entitled + carriedOver + adjustment − used − pending`. Персистувати похідне = гарантований дрейф. Формула — `lib/leave/balance.ts::available()` |
| `LeaveType.affectsBalance` vs `payKind` | Незалежні: лікарняний оплачується, але баланс щорічної не чіпає; неоплачувана має ліміт 15 днів |
| `LeaveSettings.martialLawHolidaysSuspended` | На період воєнного стану норми ст. 73 КЗпП про святкові/неробочі дні призупинені. За замовчуванням `true` |

### 2.2 Каскади

- `Employee` **ніколи не видаляється** фізично → `status: TERMINATED` + `isArchived`. `Cascade` на `LeaveRequest`/`LeaveBalance` існує лише для чистки тестових даних.
- Довідники (`Department`, `Position`) — `SetNull` на входах.
- `LeaveType` — `Restrict` у `LeaveRequest`/`LeaveBalance`/`LeaveLedgerEntry`: тип з історією видалити не можна, лише `isActive: false`.
- `AuditLog` — `SetNull` на обох акторах, щоб журнал пережив видалення користувача.

### 2.3 Адаптер SQLite (обов'язкові PRAGMA)

`src/lib/prisma.ts` уже створює клієнт через `PrismaBetterSqlite3`. **Додати** ініціалізацію:

```ts
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
// FK у SQLite вимкнені за замовчуванням — без цього Restrict/SetNull мовчки не працюють
// journal_mode=WAL — один writer, серіалізує конкурентні транзакції
```
> Якщо адаптер не дає доступу до сирого з'єднання — виконати `PRAGMA` першим запитом у `prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON')` при старті процесу (у `instrumentation.ts`).

### 2.4 План міграції на PostgreSQL

`provider = "postgresql"` → enum'и стають нативними без правок DSL → `Json` → `jsonb` → `Float` днів → `Decimal @db.Decimal(5,2)` → дати → `@db.Date` → `searchKey` видаляється на користь `ILIKE`/`pg_trgm` → `EXCLUDE USING gist` на перетин відпусток (raw SQL у міграції) → часткові індекси на `status = 'PENDING'`.

---

## 3. Карта маршрутів і сторінок

Дві роут-групи: `(auth)` — центрована картка без шеллу; `(dashboard)` — сайдбар 264 px + топбар 64 px.

### 3.1 Група `(auth)`

| Роут | Сторінка | Доступ | Зміст |
|---|---|---|---|
| `/login` | Вхід | публічний | email + пароль, `useActionState`, помилка «Невірна пошта або пароль» |
| `/api/auth/logout` | — | сесія | Route Handler `POST`: чистить cookie, `redirect('/login')` |

Реєстрації немає — акаунти створює ADMIN у `/settings/users`.

### 3.2 Група `(dashboard)`

`layout.tsx`: `const session = await requireSession()` → `Sidebar` (меню фільтрується за роллю) + `Topbar`.

| # | Роут | Сторінка (UA) | ADMIN | HR | MANAGER | EMPLOYEE | Ключові блоки |
|---|---|---|:---:|:---:|:---:|:---:|---|
| 1 | `/` | **Панель** | ✔ | ✔ | ✔ | ✔ | 4 плитки KPI (Штат / Сьогодні відсутні / На погодженні / Мій залишок), «Хто сьогодні відсутній», «Найближчі дні народження», «Мій баланс відпустки», «Потребують погодження» (MANAGER/HR) |
| 2 | `/employees` | **Співробітники** | ✔ | ✔ | ✔¹ | ✔² | таблиця/сітка, пошук, фільтри (відділ, посада, керівник, статус, тип зайнятості), сортування, пагінація 25 |
| 3 | `/employees/new` | Новий співробітник | ✔ | ✔ | ✖ | ✖ | форма-майстер: Особисті дані → Робота → Доступ |
| 4 | `/employees/[id]` | **Картка співробітника** | ✔ | ✔ | ✔¹ | ✔² | шапка + вкладки `?tab=` |
| 4.1 | `…?tab=profile` | Профіль | ✔ | ✔ | базове | своє | контакти, ДН, адреса³, РНОКПП³ |
| 4.2 | `…?tab=job` | Робота | ✔ | ✔ | ✔¹ | своє | посада, відділ, керівник, дата прийняття, тип зайнятості |
| 4.3 | `…?tab=leaves` | Відсутності | ✔ | ✔ | ✔¹ | своє | баланси + історія заявок |
| 4.4 | `…?tab=team` | Підлеглі | ✔ | ✔ | ✔ | ✔ | список прямих підлеглих |
| 4.5 | `…?tab=audit` | Історія змін | ✔ | ✔ | ✖ | ✖ | `AuditLog` по цій сутності |
| 5 | `/employees/[id]/edit` | Редагування | ✔ | ✔ | ✖ | ✔⁴ | та сама форма, що й `new` |
| 6 | `/org-chart` | **Оргструктура** | ✔ | ✔ | ✔ | ✔ | інтерактивне дерево, згортання, пошук з автофокусом, перемикач «За керівниками / За відділами» |
| 7 | `/departments` | **Відділи** | ✔ | ✔ | read | ✖ | дерево + лічильники, inline-створення в модалці |
| 8 | `/departments/[id]` | Картка відділу | ✔ | ✔ | read | ✖ | керівник, підвідділи, склад |
| 9 | `/positions` | **Посади** | ✔ | ✔ | read | ✖ | таблиця: назва, відділ, кількість носіїв; CRUD у модалці |
| 10 | `/leaves` | Відсутності (хаб) | ✔ | ✔ | ✔ | ✔ | редирект: EMPLOYEE → `/leaves/my`, решта → `/leaves/approvals` |
| 11 | `/leaves/my` | **Мої заявки** | ✔ | ✔ | ✔ | ✔ | `BalanceStrip` + таблиця заявок, фільтр статус/рік, розгортання в таймлайн |
| 12 | `/leaves/new` | Нова заявка | ✔ | ✔ | ✔ | ✔ | форма з live-прев'ю днів, блоком попереджень, прев'ю ланцюжка погодження |
| 13 | `/leaves/[id]` | Деталі заявки | ✔ | ✔ | ✔¹ | своє | зведення, `ApprovalTimeline`, кнопки за правами |
| 14 | `/leaves/[id]/edit` | Редагування заявки | ✔ | ✔ | ✖ | своє (`DRAFT`) | та сама форма |
| 15 | `/leaves/approvals` | **На погодженні** | ✔ | ✔ | ✔ | ✖ | вкладки: Очікують мого рішення (badge) · Усі активні (HR) · Історія моїх рішень; масові дії |
| 16 | `/leaves/calendar` | **Календар відсутностей** | ✔ | ✔ | ✔ | ✔⁵ | «Місяць × Співробітники» / «Рік × Співробітник», фільтр відділу, легенда, свята підсвічені |
| 17 | `/leaves/balances` | **Баланси днів** | ✔ | ✔ | ✔¹ | ✖⁶ | матриця «співробітник × тип», дії «Коригувати», «Нарахувати», «Перенести», «Експорт CSV» |
| 18 | `/leaves/balances/[employeeId]` | Деталізація балансу | ✔ | ✔ | ✔¹ | ✖ | журнал `LeaveLedgerEntry` |
| 19 | `/settings` | **Налаштування** | ✔ | ✔ | ✖ | ✖ | хаб-плитки |
| 20 | `/settings/leave-types` | Типи відсутностей | ✔ | ✔ | ✖ | ✖ | CRUD усіх полів `LeaveType` |
| 21 | `/settings/holidays` | Виробничий календар | ✔ | ✔ | ✖ | ✖ | свята по роках, «Заповнити типовими», прапорець воєнного стану |
| 22 | `/settings/leave-rules` | Правила відпусток | ✔ | ✔ | ✖ | ✖ | `LeaveSettings`: робочі дні тижня, режим нарахування, перенесення, спрощене погодження |
| 23 | `/settings/users` | Користувачі та ролі | ✔ | ✖ | ✖ | ✖ | зв'язок акаунт↔співробітник, зміна ролі, скидання пароля, деактивація |
| 24 | `/profile` | Мій профіль | ✔ | ✔ | ✔ | ✔ | те саме, що `/employees/[id]`, з обмеженим редагуванням (контакти) |

**Виноски:**
¹ MANAGER — своя команда рекурсивно по `managerId` (+ фільтр «Моя команда» увімкнено за замовчуванням); інших бачить у скороченому вигляді (ПІБ, посада, відділ, робоча пошта).
² EMPLOYEE — довідник у скороченому вигляді (без чутливих полів), повна картка лише своя.
³ Чутливі поля (`taxId`, `address`, `personalEmail`, `emergencyContact*`) вирізаються **на сервері через `select`**, не приховуються CSS.
⁴ EMPLOYEE редагує лише себе і лише через `selfUpdateSchema` (контакти).
⁵ EMPLOYEE у календарі бачить чужі відділи як «Відсутній» + період, без типу і коментаря (приватність медичних даних).
⁶ EMPLOYEE → редирект на `/leaves/my` (баланси там у смузі).

### 3.3 Спец-файли

`app/(dashboard)/loading.tsx` (skeleton) · `error.tsx` · `not-found.tsx` · `app/global-error.tsx` · `app/forbidden/page.tsx` («Недостатньо прав для перегляду цієї сторінки»).

### 3.4 Сайдбар (`src/lib/nav.ts`)

Декларативний масив з полем `roles: Role[]`, фільтрація на сервері в layout.

| Пункт | Роут | Іконка (lucide) | Ролі |
|---|---|---|---|
| Панель | `/` | `LayoutDashboard` | усі |
| Співробітники | `/employees` | `Users` | усі |
| ↳ Оргструктура | `/org-chart` | `Network` | усі |
| ↳ Відділи | `/departments` | `Building2` | ADMIN, HR, MANAGER |
| ↳ Посади | `/positions` | `BriefcaseBusiness` | ADMIN, HR, MANAGER |
| Відсутності | `/leaves` | `CalendarDays` | усі |
| ↳ Мої заявки | `/leaves/my` | `FileText` | усі |
| ↳ На погодженні | `/leaves/approvals` | `CheckCheck` | ADMIN, HR, MANAGER |
| ↳ Календар відсутностей | `/leaves/calendar` | `CalendarRange` | усі |
| ↳ Баланси днів | `/leaves/balances` | `Scale` | ADMIN, HR, MANAGER |
| Налаштування | `/settings` | `Settings` | ADMIN, HR |
| ↳ Типи відсутностей | `/settings/leave-types` | `Tags` | ADMIN, HR |
| ↳ Виробничий календар | `/settings/holidays` | `CalendarCheck` | ADMIN, HR |
| ↳ Правила відпусток | `/settings/leave-rules` | `SlidersHorizontal` | ADMIN, HR |
| ↳ Користувачі та ролі | `/settings/users` | `ShieldCheck` | ADMIN |

Внизу сайдбару — аватар + ПІБ + посада, кнопка **«Подати заявку»** (primary, завжди видима, відкриває модалку з будь-якої сторінки).
Топбар — глобальний пошук `⌘K`/`Ctrl+K` (співробітники, відділи, посади), дзвіночок з лічильником заявок «На погодженні» (MANAGER/HR), меню профілю.

---

## 4. Структура папок `src/`

```
prisma.config.ts                    # + migrations.seed: "tsx prisma/seed.ts"
prisma/
  schema.prisma
  migrations/
  seed.ts
  data/
    holidays.ts                     # масив свят по роках (редагується щороку)
    leave-types.ts                  # 14 типів відсутностей
    demo.ts                         # демо-персонал (SEED_DEMO=true)
src/
  proxy.ts                          # Next 16: колишній middleware.ts
  instrumentation.ts                # PRAGMA foreign_keys / journal_mode
  app/
    layout.tsx                      # <html lang="uk">, Inter(cyrillic), ToastProvider
    globals.css                     # @theme токени Tailwind v4
    forbidden/page.tsx
    not-found.tsx
    global-error.tsx
    (auth)/
      layout.tsx
      login/page.tsx
    (dashboard)/
      layout.tsx                    # requireSession() → Sidebar + Topbar
      loading.tsx  error.tsx
      page.tsx                      # Панель
      employees/
        page.tsx
        new/page.tsx
        [id]/page.tsx
        [id]/edit/page.tsx
      org-chart/page.tsx
      departments/
        page.tsx
        [id]/page.tsx
      positions/page.tsx
      leaves/
        page.tsx                    # редирект-хаб
        my/page.tsx
        new/page.tsx
        [id]/page.tsx
        [id]/edit/page.tsx
        approvals/page.tsx
        calendar/page.tsx
        balances/page.tsx
        balances/[employeeId]/page.tsx
      settings/
        page.tsx
        leave-types/page.tsx
        holidays/page.tsx
        leave-rules/page.tsx
        users/page.tsx
      profile/page.tsx
    api/
      auth/logout/route.ts
      search/route.ts               # GET ?q= для ⌘K і Combobox
      health/route.ts
      uploads/[...path]/route.ts    # роздача вкладень з ACL (не через public/)
  components/
    ui/                             # примітиви, без домену (див. §7.4)
      button.tsx  input.tsx  select.tsx  combobox.tsx  date-picker.tsx
      table.tsx  card.tsx  modal.tsx  sheet.tsx  badge.tsx  avatar.tsx
      empty-state.tsx  skeleton.tsx  tabs.tsx  toast.tsx  tooltip.tsx
      pagination.tsx  confirm-dialog.tsx  progress.tsx  field.tsx
    layout/
      sidebar.tsx  topbar.tsx  page-header.tsx  command-palette.tsx
    employees/
      employee-table.tsx  employee-row.tsx  employee-card.tsx
      employee-form.tsx  employee-filters.tsx  employee-picker.tsx
      status-badge.tsx  terminate-dialog.tsx
    org/
      org-chart-tree.tsx  org-chart-node.tsx  org-mode-switch.tsx
    leaves/
      leave-request-form.tsx   balance-strip.tsx      leave-balance-card.tsx
      leave-status-badge.tsx   leave-type-badge.tsx   day-breakdown-preview.tsx
      approval-queue-card.tsx  approval-timeline.tsx  absence-calendar-grid.tsx
      warning-list.tsx         absence-type-picker.tsx
    dashboard/
      stat-tile.tsx  today-absent.tsx  upcoming-birthdays.tsx  pending-approvals.tsx
  server/
    actions/                        # 'use server' — тонкі: auth → zod → service → revalidate
      auth.ts  employees.ts  departments.ts  positions.ts
      leaves.ts  approvals.ts  balances.ts  leave-types.ts  holidays.ts
      leave-rules.ts  users.ts
    queries/                        # читання для RSC
      employees.ts  org.ts  leaves.ts  balances.ts  calendar.ts  dashboard.ts
    services/                       # уся доменна логіка, тестується без БД
      leave-duration.ts             # calcDays, calcDaysByYear, dayLabels
      leave-balance.ts              # available, recomputeBalance, assertBalance,
                                    # bumpPending, runAccrual, runCarryOver
      leave-route.ts                # resolveRoute, buildRoute, nextStep
      leave-service.ts              # submit / cancel / decide / shorten
      org-tree.ts                   # buildOrgTree, getSubtreeIds, isDescendant,
                                    # collectDeptSubtree
      audit.ts                      # writeAudit(tx, ...)
  lib/
    prisma.ts                       # singleton + driver adapter (ВЖЕ Є)
    session.ts                      # jose: createSession/getSession/requireSession/requireRole
    password.ts                     # bcryptjs hash/compare (cost 10)
    permissions.ts                  # can(session, action, resource)
    date.ts                         # toDateOnly, isoDay, formatDate, formatPeriod
    format.ts                       # date-fns + locale uk, pluralUk
    search.ts                       # buildSearchKey, normalizeQuery
    labels.ts                       # УСІ українські підписи (Record<enum, string>)
    nav.ts                          # декларативне меню
    numbering.ts                    # generateRequestNumber
    errors.ts                       # DomainError, ActionResult
    constants.ts                    # ANNUAL_LEAVE_DAYS = 28, PAGE_SIZE = 25
    cn.ts                           # clsx + tailwind-merge (ВЖЕ Є в utils.ts)
    zod-uk.ts                       # z.config({ customError }) — укр. стандартні issue
  schemas/                          # zod — SSOT для контрактів
    common.ts  auth.ts  employee.ts  department.ts  position.ts
    leave.ts  leave-type.ts  holiday.ts  user.ts  filters.ts
  generated/prisma/                 # згенерований клієнт, у .gitignore
  types/
    dto.ts                          # toEmployeeDto, toCalendarDto, toRequestDto
```

**`prisma.config.ts` — додати `seed`:**
```ts
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

**ENV (`.env`, `.env.example` у git):**
```
DATABASE_URL="file:./dev.db"
AUTH_SECRET="<32+ байти, openssl rand -base64 32>"
SEED_DEMO=true
SEED_PASSWORD="Password123!"
```

---

## 5. Server Actions і Route Handlers

### 5.1 Правило вибору

**За замовчуванням — Server Action. Route Handler — виняток.**

| Route Handler виправданий | Приклад |
|---|---|
| Потрібен чистий HTTP-редирект + `Set-Cookie` поза React-деревом | `POST /api/auth/logout` |
| Клієнтський fetch з debounce | `GET /api/search?q=` (⌘K, Combobox) |
| Віддача бінарних/файлових даних з ACL | `GET /api/uploads/[...path]` |
| Health-check / майбутні інтеграції | `GET /api/health` |

### 5.2 Уніфікований контракт

```ts
// src/lib/errors.ts
export type Warning = { code: string; messageUk: string; blocking: false };

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string; warnings?: Warning[] }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]>; warnings?: Warning[] };

export class DomainError extends Error {
  constructor(public messageUk: string, public field?: string) { super(messageUk); }
}
```

**Обов'язковий скелет кожної дії:**
```ts
'use server';
export async function actionName(input: unknown): Promise<ActionResult<T>> {
  const session = await requireSession();                    // 1. автентифікація
  assertCan(session, 'leave:approve', resource);             // 2. авторизація — ЗАВЖДИ
  const parsed = Schema.safeParse(input);                    // 3. валідація
  if (!parsed.success) return { ok: false, message: 'Перевірте поля форми',
                                fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const data = await prisma.$transaction(async (tx) => { /* 4. домен + аудит */ });
  revalidatePath('/leaves/my');                              // 5. інвалідація
  return { ok: true, data, message: 'Заявку подано' };
}
```

### 5.3 Перелік із сигнатурами

#### `src/server/actions/auth.ts`
```ts
signIn(prev: ActionState, formData: FormData): Promise<ActionState>
  // bcrypt.compare → перевірка isActive && employee.status !== TERMINATED
  //   → SignJWT({ userId, employeeId, role, fullName, tokenVersion }) → cookie
  //   → AuditLog(LOGIN | LOGIN_FAILED) → redirect(searchParams.from ?? '/')
signOut(): Promise<never>                                    // делегує на /api/auth/logout
changeOwnPassword(input: ChangePasswordInput): Promise<ActionResult>
```

#### `src/server/actions/employees.ts`
```ts
createEmployee(input: EmployeeCreateInput): Promise<ActionResult<{ id: string }>>
  // ADMIN|HR → унікальність workEmail/personnelNumber → buildSearchKey
  //   → створює Employee (+ опційно User з bcrypt.hash(pwd,10), mustChangePassword=true)
  //   → створює LeaveBalance на поточний рік → AuditLog → redirect(`/employees/${id}`)

updateEmployee(input: EmployeeUpdateInput): Promise<ActionResult>
  // ADMIN|HR — повна схема; власник — selfUpdateSchema
  // перевірка managerId !== id && !isDescendant(managerId, id)
  // при зміні managerId: перепризначити PENDING-кроки MANAGER на нового керівника
  // перерахунок searchKey → AuditLog(diff)

terminateEmployee(input: TerminateInput): Promise<ActionResult>
  // status=TERMINATED, terminationDate/Reason
  // → User.isActive=false, tokenVersion++
  // → підлеглі переприв'язуються на terminated.managerId
  // → якщо був Department.head → headId=null
  // → PENDING-заявки → CANCELLED («Звільнення співробітника»)
  // → APPROVED-заявки з датами > terminationDate → CANCELLED + USAGE_REVERSAL
  // → показати «Невикористані дні: N» для дії compensateOnTermination

archiveEmployee(id: string): Promise<ActionResult>
restoreEmployee(id: string): Promise<ActionResult>
resetPassword(employeeId: string): Promise<ActionResult<{ tempPassword: string }>>  // ADMIN|HR
```

#### `src/server/actions/departments.ts` / `positions.ts`
```ts
createDepartment(input: DepartmentInput): Promise<ActionResult<{ id: string }>>
updateDepartment(input: DepartmentUpdateInput): Promise<ActionResult>   // + перевірка циклу parentId
setDepartmentHead(deptId: string, employeeId: string | null): Promise<ActionResult>
archiveDepartment(id: string): Promise<ActionResult>
  // БЛОК, якщо є неархівовані members або children:
  // «Неможливо архівувати: у відділі N співробітників»

createPosition(input: PositionInput): Promise<ActionResult<{ id: string }>>
updatePosition(input: PositionUpdateInput): Promise<ActionResult>
archivePosition(id: string): Promise<ActionResult>   // БЛОК за наявності активних носіїв
```

#### `src/server/actions/leaves.ts`
```ts
previewLeaveDays(input: PreviewInput): Promise<ActionResult<DayPreview>>
  // { days, unit, breakdown: DayCell[], byYear: Record<number, number>,
  //   balanceBefore, balanceAfter, warnings[] } — БЕЗ збереження, debounce 300 мс

saveDraft(input: LeaveRequestInput): Promise<ActionResult<{ id: string }>>
submitLeaveRequest(input: LeaveRequestInput): Promise<ActionResult<{ id: string; number: string }>>
  // повна транзакція: R1–R13 → buildRoute → daysCount → pendingDays += d → status=PENDING
updateLeaveRequest(id: string, input: LeaveRequestInput): Promise<ActionResult>
  // власник у DRAFT; HR у PENDING (з перерахунком pendingDays)
cancelLeaveRequest(id: string, reason: string): Promise<ActionResult>
deleteDraft(id: string): Promise<ActionResult>
duplicateRequest(id: string): Promise<ActionResult<{ id: string }>>   // з REJECTED/CANCELLED → новий DRAFT
```

#### `src/server/actions/approvals.ts`
```ts
decideApproval(input: ApprovalDecisionInput): Promise<ActionResult>
  // decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
  // REQUEST_CHANGES → status=DRAFT, pendingDays -= d, коментар обов'язковий
  // блок самопогодження (E18); HR-override дозволено (decidedById ≠ approverId)
decideBulk(ids: string[], decision: 'APPROVE' | 'REJECT', comment?: string)
  : Promise<ActionResult<{ succeeded: string[]; failed: { id: string; reason: string }[] }>>
  // максимум 20 за раз, послідовно, частковий результат
shortenApprovedLeave(id: string, newEndDate: string, reason: string): Promise<ActionResult>  // HR
```

#### `src/server/actions/balances.ts`
```ts
adjustBalance(input: BalanceAdjustmentInput): Promise<ActionResult>          // HR|ADMIN, + ADJUSTMENT
runAccrual(year: number, month?: number): Promise<ActionResult<{ created: number; skipped: number }>>
  // ідемпотентно: пропускає, якщо ACCRUAL за (employee, type, year, month) вже є
runCarryOver(fromYear: number): Promise<ActionResult<{ created: number }>>   // ADMIN
compensateOnTermination(employeeId: string): Promise<ActionResult>          // HR, COMPENSATION
recomputeAllBalances(year: number): Promise<ActionResult>                    // ADMIN, перебудова кешу з журналу
exportBalancesCsv(filters: BalanceFilters): Promise<ActionResult<{ csv: string }>>
  // UTF-8 BOM + ';' для Excel
```

#### `src/server/actions/leave-types.ts` / `holidays.ts` / `leave-rules.ts` / `users.ts`
```ts
upsertLeaveType(input: LeaveTypeInput): Promise<ActionResult>       // ADMIN|HR
deactivateLeaveType(id: string): Promise<ActionResult>              // isActive=false, не delete
upsertHoliday(input: HolidayInput): Promise<ActionResult>           // ADMIN|HR
deleteHoliday(id: string): Promise<ActionResult>
seedYearHolidays(year: number): Promise<ActionResult<{ created: number }>>
updateLeaveSettings(input: LeaveSettingsInput): Promise<ActionResult>
createUserAccount(employeeId: string, email: string, role: Role): Promise<ActionResult>  // ADMIN
changeUserRole(userId: string, role: Role): Promise<ActionResult>   // ADMIN, tokenVersion++
deactivateUser(userId: string): Promise<ActionResult>               // ADMIN, tokenVersion++
```

#### `src/server/queries/*` (читання для RSC, теж із `requireSession()`)
```ts
listEmployees(session, filters: EmployeeFilters): Promise<{ rows: EmployeeDto[]; total: number }>
getEmployee(session, id): Promise<EmployeeDto | null>          // поля вирізаються за правами
getOrgTree(session, mode: 'manager' | 'department'): Promise<OrgNode[]>
listMyRequests(session, year, filters): Promise<LeaveRequestDto[]>
listApprovalQueue(session, tab): Promise<ApprovalCardDto[]>
getCalendarData(session, month, deptId?): Promise<{ rows: CalendarRow[]; holidays: Holiday[] }>
getBalanceMatrix(session, year, filters): Promise<BalanceMatrixDto>
getDashboard(session): Promise<DashboardDto>
```

---

## 6. Логіка розрахунку днів і балансів

### 6.1 Інваріант дат — `src/lib/date.ts`

```ts
/** Єдина точка створення «дати-дня». Все інше в домені — заборонено ESLint-правилом. */
export const toDateOnly = (d: Date | string): Date =>
  new Date(`${typeof d === 'string' ? d.slice(0, 10) : format(d, 'yyyy-MM-dd')}T00:00:00.000Z`);

export const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
export const todayUtc = (): Date => toDateOnly(new Date());
```

### 6.2 Розрахунок кількості днів — `services/leave-duration.ts`

```
ТИП DayCell = { date: Date; label: 'WORKDAY'|'WEEKEND'|'HOLIDAY'; counted: 0|0.5|1; noteUk?: string }

ФУНКЦІЯ calcDays(input):
  input = { unit, excludeHolidays, allowHalfDay,   // з LeaveType
            start, end,                             // UTC-північ
            halfDayStart, halfDayEnd,               // NONE|FIRST|SECOND
            holidays: Map<isoDay, Holiday>,         // ОДИН запит на весь діапазон
            workingWeekdays: Set<number>,           // з LeaveSettings, date-fns getDay(): 0=нд
            holidaysSuspended: boolean }            // martialLawHolidaysSuspended

  1. ЯКЩО end < start → DomainError('Дата завершення не може бути раніше дати початку')

  2. cells = []
     ДЛЯ КОЖНОГО d У eachDayOfInterval({ start, end }):
         h = holidays.get(isoDay(d))

         // мітка дня
         ЯКЩО h?.kind == WORKING_SATURDAY        → label = 'WORKDAY'
         ІНАКШЕ ЯКЩО h?.kind IN (PUBLIC_HOLIDAY, NON_WORKING) І НЕ holidaysSuspended
                                                  → label = 'HOLIDAY'
         ІНАКШЕ ЯКЩО workingWeekdays.has(getDay(d)) → label = 'WORKDAY'
         ІНАКШЕ                                   → label = 'WEEKEND'
         // SHORTENED (передсвятковий) на облік днів НЕ впливає — лише бейдж у календарі

         // зарахування
         ЯКЩО unit == WORKING_DAYS:
             counted = (label == 'WORKDAY') ? 1 : 0
         ІНАКШЕ /* CALENDAR_DAYS */:
             counted = (label == 'HOLIDAY' І excludeHolidays І НЕ holidaysSuspended) ? 0 : 1
             // ст. 5 ЗУ «Про відпустки»: святкові та неробочі дні
             // не включаються в тривалість щорічної відпустки

         cells.push({ date: d, label, counted, noteUk: h?.nameUk })

  3. days = SUM(cells[].counted)

  4. // Півдні — ЛИШЕ для WORKING_DAYS і лише коли крайній день робочий
     ЯКЩО allowHalfDay І unit == WORKING_DAYS:
         ЯКЩО halfDayStart != NONE І cells[0].label == 'WORKDAY'   → days -= 0.5; cells[0].counted = 0.5
         ЯКЩО halfDayEnd   != NONE І cells[-1].label == 'WORKDAY'  → days -= 0.5; cells[-1].counted = 0.5
         // окремий випадок: start == end і FIRST+SECOND → нормалізувати в NONE/NONE (повний день)
     ІНАКШЕ:
         halfDayStart = halfDayEnd = NONE   // примусово, E13

  5. ПОВЕРНУТИ { days: round2(days), cells }


ФУНКЦІЯ calcDaysByYear(input) -> Map<year, days>:
  // Заявка через межу року (28.12–05.01) розщеплюється ДЛЯ БАЛАНСУ,
  // але лишається ОДНІЄЮ заявкою. Ledger отримає два записи з різним year.
  ГРУПУВАТИ cells ЗА getUTCFullYear(cell.date), СУМУЮЧИ counted
```

**Правила:** розрахунок виконується **тільки на сервері**. Свята вантажаться **одним** запитом `holiday.findMany({ where: { date: { gte: start, lte: end } } })`, ніколи по одному в циклі.

### 6.3 Баланс — `services/leave-balance.ts`

```
ФУНКЦІЯ available(balance) -> number:
  ПОВЕРНУТИ balance.entitledDays + balance.carriedOverDays + balance.adjustmentDays
            - balance.usedDays - balance.pendingDays
  // remainingDays НІКОЛИ не зберігається в БД — тільки обчислюється

ФУНКЦІЯ recomputeBalance(tx, employeeId, typeId, year):
  entries = tx.leaveLedgerEntry.findMany({ employeeId, typeId, year })
  entitled   = SUM(entries WHERE kind == ACCRUAL)
  carried    = SUM(entries WHERE kind == CARRY_OVER)
  adjustment = SUM(entries WHERE kind == ADJUSTMENT)
  used       = -SUM(entries WHERE kind IN (USAGE, COMPENSATION, EXPIRY))
               -SUM(entries WHERE kind == USAGE_REVERSAL)   // USAGE_REVERSAL додатний
  tx.leaveBalance.upsert({ where: { employeeId_leaveTypeId_year }, update: {...}, create: {...} })
  // pendingDays НЕ входить у журнал — це «заморозка», не рух днів

ФУНКЦІЯ bumpPending(tx, employeeId, typeId, year, delta):
  tx.leaveBalance.upsert(... pendingDays: { increment: delta } ...)

ФУНКЦІЯ assertBalance(tx, employeeId, type, year, needDays):
  ЯКЩО НЕ type.affectsBalance → ВИЙТИ
  b = tx.leaveBalance.findUnique(...) ?? {всі нулі}
  avail = available(b)

  // Правило 6 місяців (ст. 10 ЗУ «Про відпустки»)
  ЯКЩО settings.probationBlocksAnnual І type.code STARTS 'ANNUAL'
       І today < addMonths(employee.hireDate, 6):
      avail = MIN(avail, proRataToDate(type.defaultEntitlement, employee, today))
      ЯКЩО needDays > avail → БЛОК
        «Право на повну щорічну відпустку виникає після 6 місяців безперервної роботи.
         Доступно зараз: {avail} дн.»

  ЯКЩО avail - needDays < 0:
      ЯКЩО type.allowNegativeBalance → WARNING «Баланс піде в мінус на {N} дн.»
      ІНАКШЕ → БЛОК «Недостатньо днів: доступно {avail}, потрібно {needDays}»

  // Річний ліміт (R7)
  ЯКЩО type.maxPerYear:
      usedThisYear = b.usedDays + b.pendingDays
      ЯКЩО usedThisYear + needDays > type.maxPerYear → БЛОК
        «Перевищено річний ліміт для типу «{nameUk}»: використано {usedThisYear} з {maxPerYear} дн.»
```

**Життєвий цикл днів:**

| Подія | `LeaveLedgerEntry` | Кеш `LeaveBalance` |
|---|---|---|
| Подання (`DRAFT→PENDING`) | — | `pendingDays += d` |
| Погодження останнього кроку | `USAGE −d` | `pendingDays −= d; usedDays += d` |
| Відхилення | — | `pendingDays −= d` |
| Скасування `PENDING` | — | `pendingDays −= d` |
| Скасування `APPROVED` | `USAGE_REVERSAL +повернуті` | `usedDays −= повернуті` |
| Відкликання (`shorten`) | `USAGE_REVERSAL +різниця` | `usedDays −= різниця` |
| Корекція HR | `ADJUSTMENT ±d` | `adjustmentDays ±= d` |
| Нарахування | `ACCRUAL +d` (+`month`) | `entitledDays += d` |
| Перенесення | `CARRY_OVER +d` (у році N+1) | `carriedOverDays += d` |
| Компенсація при звільненні | `COMPENSATION −d` | `usedDays += d` |

**Усі три переходи статусу разом зі зміною балансу — всередині одного `prisma.$transaction`.**

### 6.4 Нарахування — `runAccrual`

```
ФУНКЦІЯ runAccrual(year, month?):
  settings = getSettings()
  types = leaveType.findMany({ isActive: true, affectsBalance: true, defaultEntitlement: { not: null } })
  employees = employee.findMany({ isArchived: false, status: { not: TERMINATED } })

  ДЛЯ КОЖНОГО (emp, type):
    // період зайнятості в межах року
    from = MAX(startOfYear(year), emp.hireDate)
    to   = MIN(endOfYear(year), emp.terminationDate ?? endOfYear(year))
    ЯКЩО from > to → ПРОПУСТИТИ

    yearlyEntitlement = round2(type.defaultEntitlement * emp.workRate
                               * (differenceInCalendarDays(to, from) + 1) / daysInYear(year))

    ЯКЩО settings.accrualMode == 'FULL_YEAR_UPFRONT':
        ІДЕМПОТЕНТНІСТЬ: ЯКЩО існує ACCRUAL(emp, type, year, month=null) → ПРОПУСТИТИ
        createLedger(ACCRUAL, +yearlyEntitlement, month=null,
                     reasonUk='Річне нарахування')
    ІНАКШЕ /* MONTHLY_PRORATA */:
        m = month ?? currentMonth
        ІДЕМПОТЕНТНІСТЬ: ЯКЩО існує ACCRUAL(emp, type, year, month=m) → ПРОПУСТИТИ (skipped++)
        ЯКЩО m == 12:  // грудень добирає залишок, щоб уникнути похибки округлення
            already = SUM(ACCRUAL за рік)
            amount = round2(yearlyEntitlement - already)
        ІНАКШЕ:
            amount = round2(yearlyEntitlement / 12)
        createLedger(ACCRUAL, +amount, month=m, reasonUk=`Нарахування за ${monthNameUk(m)}`)

    recomputeBalance(tx, emp.id, type.id, year)

  // Виключення зі стажу: дні у CHILD_CARE_3Y та UNPAID_STATUTORY понад норму
  // не входять у стаж для щорічної → мінус-запис ADJUSTMENT створюється
  // при погодженні відповідних заявок, не тут.
```

### 6.5 Перенесення залишку — `runCarryOver`

```
NON_CARRYABLE_CODES = ['UNPAID_AGREEMENT', 'DAY_OFF', 'SICK_SELF']

ФУНКЦІЯ runCarryOver(fromYear):
  ЯКЩО НЕ settings.carryOverEnabled → ВИЙТИ
  ДЛЯ КОЖНОГО (emp, type) з affectsBalance І type.carryOverAllowed
                            І type.code НЕ В NON_CARRYABLE_CODES:
      ІДЕМПОТЕНТНІСТЬ: ЯКЩО існує CARRY_OVER(emp, type, fromYear+1) → ПРОПУСТИТИ
      rest = available(balance(emp, type, fromYear))
      ЯКЩО rest <= 0 → ПРОПУСТИТИ
      cap  = type.carryOverMaxDays ?? settings.carryOverMaxDays ?? +∞
      createLedger(fromYear+1, CARRY_OVER, +MIN(rest, cap),
                   reasonUk=`Перенесення залишку з ${fromYear} року`)
      recomputeBalance(tx, emp.id, type.id, fromYear+1)
  // За КЗпП невикористана щорічна не «згорає» → ANNUAL_BASIC: carryOverMaxDays = null
```

### 6.6 Маршрут погодження — `services/leave-route.ts`

```
ФУНКЦІЯ resolveRoute(type, employee, session, settings) -> ApprovalStep[]:
  base = ЗА type.approvalRoute:
    MANAGER_THEN_HR → [{step:1, role:MANAGER}, {step:2, role:HR}]
    MANAGER_ONLY    → [{step:1, role:MANAGER}]
    HR_ONLY         → [{step:1, role:HR}]
    AUTO            → []

  1. ЯКЩО settings.simpleApproval → прибрати крок HR (лишити MANAGER;
                                     якщо керівника немає — лишити HR)
  2. ЯКЩО employee.managerId порожній (директор) → крок MANAGER стає HR
  3. ЯКЩО employee.managerId == employee.id АБО автор заявки є призначеним керівником
       → підняти на manager.managerId; якщо такого немає → крок стає HR
  4. ЯКЩО session.role IN (HR, ADMIN) І крок HR призначений самому автору
       → призначити ІНШОМУ HR; якщо в системі один HR → маршрут стає AUTO
         (+ LeaveEvent з причиною)
  5. Згорнути дублі: два підряд HR → один; одна людина не може бути погоджувачем
     двох кроків → другий SKIPPED
  6. Перенумерувати step = 1..N

  ПОВЕРНУТИ steps  // approverId для MANAGER = конкретний Employee.id
                   // approverId для HR = null (бере будь-який HR/ADMIN)

ФУНКЦІЯ nextStep(request):
  ПОВЕРНУТИ перший approval зі status == PENDING (за зростанням step)
  ЯКЩО такого немає → усі кроки пройдено → request.status = APPROVED
```

### 6.7 Валідація подання — R1…R13

Порядок перевірок у `submitLeaveRequest`, **усі всередині однієї транзакції**:

| # | Правило | Реакція |
|---|---|---|
| R1 | `endDate >= startDate` | БЛОК «Дата завершення не може бути раніше дати початку» |
| R2 | `daysCount > 0` | БЛОК «Період не містить жодного дня, що враховується (усі дні — вихідні або святкові)» |
| R3 | `startDate < today` і `!type.allowPastDates` | БЛОК «Не можна подавати заявку на минулі дати». Для `SICK_*`, `BLOOD_DONOR`: `allowPastDates=true`, `pastDatesGraceDays=14`; понад 14 днів — «Зверніться до HR» (HR створює за співробітника без обмеження) |
| R4 | `differenceInCalendarDays(startDate, today) < type.minNoticeDays` | **ПОПЕРЕДЖЕННЯ** з чекбоксом «Подаю з порушенням строку, погоджено усно». `ANNUAL_BASIC`: `minNoticeDays = 14` |
| R5 | Перетин з власними `PENDING`/`APPROVED` (`existing.start <= new.end AND existing.end >= new.start`, `id != current`) | БЛОК «Період перетинається із заявкою ЗВ-2026-000012 (Щорічна основна, 01.07–14.07)». **Виняток:** `SICK_*` дозволено накладати на `APPROVED` `ANNUAL_*` (E7). Півдні: конфлікту немає, якщо `SECOND_HALF` vs `FIRST_HALF` на одній даті |
| R6 | Недостатній баланс (по кожному зачепленому року окремо) | БЛОК або ПОПЕРЕДЖЕННЯ за `allowNegativeBalance` — див. `assertBalance` |
| R7 | `maxPerYear` | БЛОК з точним текстом |
| R8 | `maxConsecutiveDays` | БЛОК |
| R9 | `requiresDocument` без `documentNumber`/`attachmentPath` | **НЕ блокує подання.** Блокує на кроці HR: кнопка «Запросити документ» → коментар + повернення в `DRAFT` |
| R10 | Співробітник `TERMINATED` або `startDate > terminationDate` | БЛОК «Співробітника звільнено, заявку створити неможливо» |
| R11 | `substituteId == employeeId` | БЛОК «Заміщувати самого себе неможливо» |
| R12 | Перетин у команді (той самий `departmentId`) | **ПОПЕРЕДЖЕННЯ** «У ці дати вже відсутні: Петренко П. (02–10.07)». Видно і автору, і погоджувачу |
| R13 | Період > 365 днів | БЛОК (захист від помилки вводу), окрім `CHILDCARE_3Y` |

Блокери → `errors[]` (мапляться на поля через `setError`). Попередження → `warnings[]` (жовті картки, чекбокс «Ознайомлений» вмикає `acknowledgeWarnings`).

### 6.8 Машина станів

```
DRAFT ──submit──▶ PENDING ──approve(останній крок)──▶ APPROVED
  │                  ├──reject──────▶ REJECTED (термінальний)
  │                  ├──requestChanges──▶ DRAFT (pendingDays повертається)
  │                  └──cancel──────▶ CANCELLED
  ├──edit──▶ DRAFT
  └──delete──▶ (фізичне видалення, ЛИШЕ DRAFT)

APPROVED ──cancel (власник, якщо startDate > today)──▶ CANCELLED (повертається весь daysCount)
         ──cancel (HR, період почався)──────────────▶ CANCELLED (повертаються дні від завтра до endDate)
         ──shorten (HR, відкликання ст. 12)─────────▶ APPROVED з меншим endDate
```

```ts
const TRANSITIONS: Record<LeaveStatus, LeaveStatus[]> = {
  DRAFT:     ['PENDING', 'CANCELLED'],
  PENDING:   ['APPROVED', 'REJECTED', 'CANCELLED', 'DRAFT'],
  APPROVED:  ['CANCELLED'],
  REJECTED:  [],
  CANCELLED: [],
};
```
`REJECTED`/`CANCELLED` — термінальні; повтор — через «Дублювати заявку».

### 6.9 Оргдерево — `services/org-tree.ts`

```ts
type OrgNode = { id; fullName; positionTitle; departmentName; departmentColor;
                 avatarUrl; status; childrenCount; children: OrgNode[] };

buildOrgTree(employees): OrgNode[]        // ОДНА вибірка → Map<id,node> → прив'язка за managerId, O(n)
getSubtreeIds(rootId): string[]           // BFS по managerId; для прав MANAGER і фільтрів
isDescendant(candidateId, ofId): boolean  // захист від циклів, ліміт глибини 50
collectDeptSubtree(deptId): string[]      // те саме для дерева відділів
```

- Корені — `managerId === null`. **Кілька коренів допустимі** → рендеряться як кілька дерев під заголовком «Без керівника».
- Записи, чий `managerId` вказує на архівованого/звільненого → теж корені, з бейджем «Керівника не призначено».
- Кешується `unstable_cache` 60 с з тегом `org-tree`; інвалідується при будь-якій зміні `managerId`/`departmentId`.
- Adjacency list, дерево збирається в пам'яті на сервері — рекурсивні CTE Prisma не типізує, для MVP-масштабу зайве.

### 6.10 Пошук — `lib/search.ts`

```ts
export const normalizeQuery = (s: string) =>
  s.toLowerCase().replace(/[''ʼ`]/g, "'").replace(/\s+/g, ' ').trim();

export const buildSearchKey = (e: EmployeeLike) =>
  normalizeQuery([e.lastName, e.firstName, e.middleName, e.workEmail,
                  e.personalEmail, e.phone, e.personnelNumber].filter(Boolean).join(' '));

// фільтр: where.searchKey = { contains: normalizeQuery(q) }
```
Перераховується на **кожному** create/update Employee. Фільтр за відділом розгортається через `collectDeptSubtree(deptId)` → `where.departmentId = { in: ids }`.

### 6.11 Ключові edge-cases (короткий реєстр обов'язкових до реалізації)

| # | Ситуація | Обробка |
|---|---|---|
| E1 | Заявка через межу року | Дні розщеплюються по роках у ledger; баланс перевіряється окремо для кожного; якщо наступний рік не нараховано — попередження |
| E2 | Період лише з вихідних/свят | БЛОК R2 |
| E3 | Свято змінено після подання | `PENDING` → перерахунок при рішенні + попередження погоджувачу «було 10, стало 9». `APPROVED` → не чіпаємо; HR має дію «Перерахувати» з підтвердженням |
| E4 | Скасування погодженої відпустки, що триває | Тільки HR; повертаються **лише дні від завтра до `endDate`` |
| E5 | Відкликання з відпустки (ст. 12) | `shortenApprovedLeave` — різниця в баланс через `USAGE_REVERSAL` |
| E6 | Керівник у відпустці / звільнений | HR-override + бейдж «Прострочене погодження» після `approvalOverdueDays` |
| E7 | Захворів під час відпустки | `SICK_*` поверх `APPROVED ANNUAL_*` дозволено; HR отримує пропозицію «Скоротити щорічну на дні лікарняного». **Автоматично не робиться** |
| E8 | Дві заявки одночасно | Перевірка перетину і балансу — в транзакції; `pendingDays` не дає «продати» баланс двічі |
| E9 | Звільнення з невикористаними днями | Блок «Невикористані дні: N» + дія `compensateOnTermination` |
| E13 | Півдні на календарних типах | `allowHalfDay` ігнорується для `CALENDAR_DAYS`; у формі чекбокси не рендеряться, на сервері значення примусово `NONE` |
| E15 | Від'ємний баланс після корекції | Дозволено; число червоне з підписом «Перевитрата»; нові заявки блокуються (R6) |
| E16 | Таймзони / перехід на літній час | Усі дати UTC-північ; порівняння тільки по `yyyy-MM-dd`; native `<input type="date">` повертає рядок без TZ |
| E20 | Файл-додаток | `pdf/jpg/png`, ≤ 5 МБ, `/uploads/leave/{requestId}/{uuid}.{ext}`; роздача через `/api/uploads/[...path]` з ACL, **не** через `public/` |
| E22 | Double submit | Перевірка `status === 'DRAFT'` у транзакції + `useFormStatus().pending` на кнопці |

---

## 7. Дизайн-мова

### 7.1 Позиціонування

Світла тема, спокійна корпоративна, висока щільність даних, мінімум декору. **Тільки light theme в MVP** — токени описані так, щоб dark додався одним `@media`-блоком пізніше.

**Оболонка:** сайдбар 264 px (згортається до 72 px, іконки only) · топбар 64 px · контент `max-w-[1440px]`, падинг 24/32 px. На <1024 px сайдбар → off-canvas `Sheet`, топбар отримує бургер.

### 7.2 Палітра

| Роль | Токен | HEX | Застосування |
|---|---|---|---|
| Primary 600 | `--color-brand-600` | `#4F46E5` | кнопки, активний пункт меню, фокус |
| Primary 700 | `--color-brand-700` | `#4338CA` | hover primary |
| Primary 50 | `--color-brand-50` | `#EEF2FF` | тло активного пункту, чіпи |
| Accent | `--color-accent-500` | `#0EA5E9` | посилання, інфо-акценти |
| Success 600 / 50 | `--color-success-*` | `#16A34A` / `#F0FDF4` | «Погоджено» |
| Warning 600 / 50 | `--color-warning-*` | `#D97706` / `#FFFBEB` | «На погодженні», попередження |
| Danger 600 / 50 | `--color-danger-*` | `#DC2626` / `#FEF2F2` | «Відхилено», деструктив |
| Info 600 / 50 | `--color-info-*` | `#2563EB` / `#EFF6FF` | «Чернетка», підказки |
| Ink (Neutral 900) | `--color-ink` | `#0F172A` | основний текст |
| Muted (600) | `--color-muted` | `#475569` | вторинний текст |
| Subtle (400) | `--color-subtle` | `#94A3B8` | плейсхолдери, іконки |
| Border (200) | `--color-border` | `#E2E8F0` | межі, роздільники |
| Surface | `--color-surface` | `#FFFFFF` | картки, сайдбар |
| Surface alt (50) | `--color-surface-alt` | `#F8FAFC` | тло сторінки, зебра таблиці |

**Кольори типів відсутностей зберігаються в БД (`LeaveType.colorHex`) і рендеряться інлайн-стилем**, не Tailwind-класом — інакше purge їх викине.

### 7.3 Типографіка

Geist зі scaffold **не має кириличного subset — замінити на Inter**:

```ts
// src/app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['cyrillic', 'latin'], variable: '--font-inter', display: 'swap' });
// <html lang="uk" className={inter.variable}>
```

| Роль | Розмір / висота / вага |
|---|---|
| Display (заголовок сторінки) | 30 / 36 / 600 |
| H2 (секція) | 20 / 28 / 600 |
| H3 (картка) | 16 / 24 / 600 |
| Body | 14 / 20 / 400 |
| Body strong | 14 / 20 / 500 |
| Caption / label | 12 / 16 / 500, `--color-muted` |
| Overline | 11 / 16 / 600, `uppercase`, `letter-spacing:.06em` |

**Базовий розмір інтерфейсу — 14 px** (щільність даних, як у HR-SaaS), не 16. Числові колонки — `font-variant-numeric: tabular-nums`.

### 7.4 Радіуси, тіні, фокус

| Токен | Значення | Де |
|---|---|---|
| `--radius-sm` | 6 px | бейджі, чіпи |
| `--radius-md` | 10 px | інпути, кнопки |
| `--radius-lg` | 14 px | картки, модалки |
| `--radius-full` | 9999 px | аватари, пігулки |
| `--shadow-xs` | `0 1px 2px rgb(15 23 42 / .06)` | картки в спокої |
| `--shadow-md` | `0 4px 12px rgb(15 23 42 / .08)` | dropdown, hover |
| `--shadow-lg` | `0 16px 40px rgb(15 23 42 / .12)` | модалка |
| Spacing | крок 4 px; основні 8/12/16/24/32 | — |
| Focus ring | `outline: 2px solid var(--color-brand-600); outline-offset: 2px` | усі інтерактивні |

### 7.5 `src/app/globals.css` (замінити повністю)

```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;

  --color-brand-50:   #EEF2FF;
  --color-brand-600:  #4F46E5;
  --color-brand-700:  #4338CA;
  --color-accent-500: #0EA5E9;
  --color-success-600:#16A34A;
  --color-success-50: #F0FDF4;
  --color-warning-600:#D97706;
  --color-warning-50: #FFFBEB;
  --color-danger-600: #DC2626;
  --color-danger-50:  #FEF2F2;
  --color-info-600:   #2563EB;
  --color-info-50:    #EFF6FF;
  --color-ink:        #0F172A;
  --color-muted:      #475569;
  --color-subtle:     #94A3B8;
  --color-border:     #E2E8F0;
  --color-surface:    #FFFFFF;
  --color-surface-alt:#F8FAFC;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  --shadow-xs: 0 1px 2px rgb(15 23 42 / .06);
  --shadow-md: 0 4px 12px rgb(15 23 42 / .08);
  --shadow-lg: 0 16px 40px rgb(15 23 42 / .12);

  --text-base: 0.875rem;
}

@layer base {
  body { @apply bg-surface-alt text-ink font-sans text-base antialiased; }
  :focus-visible { outline: 2px solid var(--color-brand-600); outline-offset: 2px; }
  .tabular { font-variant-numeric: tabular-nums; }
}
```

`tailwind.config.js` **не створювати**.

### 7.6 Інвентар компонентів

**Примітиви `src/components/ui/`** (власні, на Tailwind + `cn()`, без UI-бібліотек):

| Компонент | API / варіанти |
|---|---|
| `Button` | `variant`: `primary\|secondary\|ghost\|danger\|link`; `size`: `sm\|md\|lg\|icon`; `loading`, `leftIcon` |
| `Input` / `Textarea` / `Field` | `error?`, `hint?`, обгортка з `<label>` |
| `Select` | нативний `<select>` зі стилізацією (MVP без комбобокса) |
| `Combobox` | клієнтський пошук по співробітниках/відділах через `/api/search` |
| `DatePicker` / `DateRangePicker` | native `<input type="date" lang="uk">` + пресети, без календарних бібліотек |
| `DataTable<T>` | `columns`, `emptyState`, `stickyHeader`, `onRowClick`; сортування через `searchParams` |
| `Card` | `Card / CardHeader / CardTitle / CardContent / CardFooter` |
| `Modal` | на `<dialog>`; `size`: `sm\|md\|lg` |
| `Sheet` | бічна панель (мобільний сайдбар, деталі заявки) |
| `StatusBadge` | `tone`: `neutral\|info\|success\|warning\|danger` + мапа статусів → tone + UA-підпис |
| `Avatar` / `AvatarGroup` | фото або кириличні ініціали (Прізвище+Ім'я), детермінований колір з хешу `id`, `+N` |
| `EmptyState` | іконка + заголовок + опис + CTA |
| `Skeleton` | `SkeletonTable`, `SkeletonCard` |
| `Tabs` | керуються `?tab=` searchParam (працюють як RSC) |
| `Toast` | клієнтський провайдер; результат Server Action → `toast.success('Заявку погоджено')` |
| `Tooltip` | CSS-only на `data-*` + `group-hover` |
| `Pagination` | `?page=&perPage=`, серверна |
| `ConfirmDialog` | «Ви впевнені?» для деструктиву, `variant="danger"` |
| `Progress` | смуга використання балансу днів |

**Доменні `src/components/`:** `StatTile`, `EmployeeCard`, `EmployeeRow`, `EmployeePicker`, `OrgChartTree`/`OrgChartNode`, `LeaveTypeBadge`, `LeaveBalanceCard`, `LeaveRequestForm`, `BalanceStrip`, `DayBreakdownPreview`, `ApprovalTimeline`, `ApprovalQueueCard`, `AbsenceCalendarGrid`, `WarningList`, `FiltersBar`, `PageHeader`, `TerminateDialog`.

**Оргчарт:** серверний компонент віддає JSON-дерево; клієнтський `OrgChartTree` — рекурсивний, згортання/розгортання на state, CSS-Grid + псевдоелементи для з'єднувальних ліній (**без зовнішніх бібліотек**), горизонтальний скрол в `overflow-x:auto`.

**Календар:** ліворуч липка колонка з ПІБ, дні в окремому `overflow-x:auto` контейнері; безперервні періоди зливаються в смугу; `PENDING` — напівпрозора штриховка; сьогодні — вертикальна лінія; легенда знизу.

### 7.7 Порожні стани

| Контекст | Заголовок | Текст | CTA |
|---|---|---|---|
| Немає жодного співробітника | Ще немає співробітників | Додайте першого співробітника, щоб почати вести довідник | «Додати співробітника» |
| Пошук без результатів | Нічого не знайдено | За запитом «{q}» немає збігів. Спробуйте змінити фільтри | «Скинути фільтри» |
| Фільтр без результатів | Немає співробітників за цими фільтрами | Змініть відділ, посаду або статус | «Скинути фільтри» |
| Вкладка «Підлеглі» | Немає підлеглих | Цей співробітник поки не є керівником | «Призначити підлеглих» |
| Відділи | Ще немає відділів | Створіть перший відділ, щоб побудувати оргструктуру | «Створити відділ» |
| Картка відділу порожня | У відділі немає співробітників | Призначте співробітників у цей відділ | «Перейти до довідника» |
| Посади | Ще немає посад | Додайте посади, щоб призначати їх співробітникам | «Додати посаду» |
| Оргчарт | Оргструктура ще не побудована | Додайте співробітників і призначте керівників | «Додати співробітника» |
| Оргчарт без коренів | Не вдалося побудувати дерево | Перевірте призначення керівників | «До довідника» |
| MANAGER без команди | У вас поки немає підлеглих | Коли вам призначать команду, вона з'явиться тут | — |
| Мої заявки | У вас поки немає заявок | Подайте першу заявку на відсутність | «Створити заявку» |
| Черга погоджень | Усе погоджено | Заявок на розгляді немає | — |
| Баланси | Баланси ще не нараховані | Запустіть нарахування за поточний рік | «Нарахувати» |

---

## 8. Український глосарій

### 8.1 Основний глосарій (обов'язковий до консистентного вживання)

| # | EN | **UA (в UI)** | Примітка |
|---|---|---|---|
| 1 | Employee | **Співробітник** | не «працівник», не «юзер» |
| 2 | Employees directory | **Довідник співробітників** | назва розділу |
| 3 | Department | **Відділ** | не «департамент» |
| 4 | Position / Job title | **Посада** | |
| 5 | Manager | **Керівник** | не «менеджер» |
| 6 | Direct reports | **Прямі підлеглі** / **Підлеглі** | |
| 7 | Team | **Команда** | «моя команда» = підлеглі рекурсивно |
| 8 | Org chart | **Оргструктура** | у тексті — «структура підпорядкування» |
| 9 | Headcount | **Штат** / **Чисельність штату** | плитка: «Штат: 87» |
| 10 | Hire date | **Дата прийняття** | не «дата найму» |
| 11 | Termination | **Звільнення** | статус: «Звільнено» |
| 12 | Probation | **Випробувальний термін** | статус: «На випробувальному» |
| 13 | Employment type | **Тип зайнятості** | |
| 14 | Work format | **Формат роботи** | Офіс / Віддалено / Гібрид |
| 15 | Onboarding | **Адаптація** | «Онбординг» лише як підзаголовок |
| 16 | Dashboard | **Панель** | не «дашборд» |
| 17 | Leave / Time off | **Відпустка** / **Відсутність** | «Відсутність» — родове (розділ), «Відпустка» — тип |
| 18 | Leave request | **Заявка на відсутність** | конкретно — «Заявка на відпустку» |
| 19 | Leave type | **Тип відсутності** | |
| 20 | Leave balance | **Баланс днів** | |
| 21 | Entitled days | **Нараховано днів** | |
| 22 | Used days | **Використано днів** | |
| 23 | Remaining / Available | **Залишок днів** / **Доступно** | |
| 24 | Pending days | **На погодженні** | «заморожені» дні |
| 25 | Carry-over | **Перенесено з минулого року** | |
| 26 | Sick leave | **Лікарняний** | не «відпустка через хворобу» |
| 27 | Approve | **Погодити** | primary; не «затвердити», не «схвалити» |
| 28 | Reject / Decline | **Відхилити** | danger |
| 29 | Cancel (request) | **Скасувати заявку** | ≠ «Відмінити» |
| 30 | Request changes | **Повернути на доопрацювання** | |
| 31 | Pending approval | **На погодженні** | tone `warning` |
| 32 | Approved | **Погоджено** | tone `success` |
| 33 | Rejected | **Відхилено** | tone `danger` |
| 34 | Draft | **Чернетка** | tone `neutral` |
| 35 | Cancelled | **Скасовано** | tone `neutral` |
| 36 | Approver / Approval chain | **Погоджувач** / **Ланцюжок погодження** | |
| 37 | Substitute | **Заміщує** | |
| 38 | Absence calendar | **Календар відсутностей** | |
| 39 | Working days | **Робочі дні** | |
| 40 | Calendar days | **Календарні дні** (к.дн.) | скорочення «к.дн.» у таблицях |
| 41 | Public holiday | **Державне свято** | |
| 42 | Non-working day | **Неробочий день** | |
| 43 | Work calendar | **Виробничий календар** | сторінка налаштувань |
| 44 | Role / Access role | **Роль** / **Роль доступу** | |
| 45 | Permissions | **Права доступу** | |
| 46 | Sign in / Sign out | **Увійти** / **Вийти** | |
| 47 | Profile | **Профіль** | «Мій профіль» |
| 48 | Employee card | **Картка співробітника** | |
| 49 | Full name | **ПІБ** | у формах — Прізвище / Ім'я / По батькові |
| 50 | Personnel number | **Табельний номер** | |
| 51 | Tax ID | **РНОКПП** | чутливе поле |
| 52 | Filters | **Фільтри** | «Скинути фільтри» |
| 53 | Search | **Пошук** | плейсхолдер: «Пошук за ПІБ, посадою, відділом» |
| 54 | Settings | **Налаштування** | |
| 55 | Save/Add/Edit/Delete | **Зберегти** / **Додати** / **Редагувати** / **Видалити** | єдині дієслова на всі CRUD |
| 56 | Comment | **Коментар** | |
| 57 | Period | **Період** | «з 12 черв. по 25 черв.» |
| 58 | Duration | **Тривалість** | «14 к.дн.» |
| 59 | Adjustment | **Коригування** | ручна корекція HR |
| 60 | Accrual | **Нарахування** | |

### 8.2 Enum → UA (`src/lib/labels.ts`)

```ts
export const ROLE_UK: Record<Role, string> = {
  ADMIN: 'Адміністратор', HR: 'HR-менеджер', MANAGER: 'Керівник', EMPLOYEE: 'Співробітник',
};
export const EMPLOYEE_STATUS_UK: Record<EmployeeStatus, string> = {
  PROBATION: 'На випробувальному', ACTIVE: 'Працює', ON_LEAVE: 'У відпустці',
  MATERNITY_LEAVE: 'У декреті', TERMINATED: 'Звільнено',
};
export const EMPLOYMENT_TYPE_UK: Record<EmploymentType, string> = {
  FULL_TIME: 'Повна зайнятість', PART_TIME: 'Часткова зайнятість',
  CONTRACT: 'Договір ЦПХ', GIG: 'ФОП / гіг-контракт', INTERN: 'Стажування',
};
export const WORK_FORMAT_UK: Record<WorkFormat, string> = {
  OFFICE: 'Офіс', REMOTE: 'Віддалено', HYBRID: 'Гібрид',
};
export const GENDER_UK: Record<Gender, string> = {
  MALE: 'Чоловіча', FEMALE: 'Жіноча', UNSPECIFIED: 'Не вказано',
};
export const LEAVE_STATUS_UK: Record<LeaveStatus, string> = {
  DRAFT: 'Чернетка', PENDING: 'На погодженні', APPROVED: 'Погоджено',
  REJECTED: 'Відхилено', CANCELLED: 'Скасовано',
};
export const LEAVE_STATUS_TONE: Record<LeaveStatus, BadgeTone> = {
  DRAFT: 'neutral', PENDING: 'warning', APPROVED: 'success',
  REJECTED: 'danger', CANCELLED: 'neutral',
};
export const UNIT_UK: Record<LeaveUnit, string> = {
  CALENDAR_DAYS: 'календарних днів', WORKING_DAYS: 'робочих днів',
};
export const PAY_KIND_UK: Record<PayKind, string> = {
  PAID: 'Оплачувана', UNPAID: 'Без збереження з/п', STATE_FUNDED: 'За рахунок ФСС',
};
export const APPROVER_UK: Record<ApproverRole, string> = { MANAGER: 'Керівник', HR: 'HR-відділ' };
export const LEDGER_UK: Record<LedgerKind, string> = {
  ACCRUAL: 'Нарахування', CARRY_OVER: 'Перенесення з минулого року', USAGE: 'Списання',
  USAGE_REVERSAL: 'Повернення днів', ADJUSTMENT: 'Коригування',
  COMPENSATION: 'Компенсація при звільненні', EXPIRY: 'Анулювання невикористаних днів',
};
export const HOLIDAY_KIND_UK: Record<HolidayKind, string> = {
  PUBLIC_HOLIDAY: 'Державне свято', NON_WORKING: 'Неробочий день',
  SHORTENED: 'Скорочений день', WORKING_SATURDAY: 'Перенесений робочий день',
};
```

### 8.3 Мікрокопі

| Ситуація | Текст |
|---|---|
| Успіх | «Співробітника додано» · «Зміни збережено» · «Заявку подано» · «Заявку погоджено» · «Заявку відхилено» · «Заявку скасовано» · «Співробітника звільнено» · «Запис архівовано» · «Запис відновлено» · «Пароль змінено» · «Баланс скориговано» |
| Помилка загальна | «Не вдалося зберегти. Спробуйте ще раз» |
| Помилки доступу | «Недостатньо прав для цієї дії» · «Недостатньо прав для перегляду цієї сторінки» |
| Помилки даних | «Співробітника не знайдено» · «Пошта вже використовується» · «Табельний номер уже існує» · «Така посада вже існує у цьому відділі» · «Невірна пошта або пароль» · «Обліковий запис деактивовано» |
| Помилки домену | «Циклічне підпорядкування заборонено» · «Співробітник не може бути власним керівником» · «Заміщувати самого себе неможливо» · «Неможливо погодити власну заявку» |
| Баланс / перетин | «Недостатньо днів: доступно 6, потрібно 10» · «На ці дати вже є заявка» · «Період перетинається із заявкою ЗВ-2026-000012» |
| Підтвердження | «Звільнити співробітника {ПІБ}? Обліковий запис буде деактивовано, а {N} підлеглих передано керівнику {ПІБ}.» · «Архівувати запис? Його буде приховано зі списків, але дані збережено.» · «Неможливо архівувати: у відділі {N} співробітників» |
| Формат дати | `d MMM yyyy` → «12 черв. 2026» (`locale: uk`) |
| Формат періоду | «з 12 черв. по 25 черв. 2026 · 14 к.дн.» |
| Плюралізація | `pluralUk(n, ['день','дні','днів'])` |

---

## 9. SEED-дані (`prisma/seed.ts`)

Ідемпотентно через `upsert` за природними ключами (`code`, `email`, `date`, `name`). Запуск: `npm run db:seed` або `npx prisma db seed`.

### 9.1 Порядок виконання

1. `LeaveSettings` (singleton `id="default"`) → 2. `LeaveType` (14) → 3. `Holiday` (2 роки) → 4. `Department` (6) → 5. `Position` (12) → 6. `Employee` + `User` (демо, лише `SEED_DEMO=true`) → 7. `LeaveBalance` + `LeaveLedgerEntry` (`ACCRUAL`) → 8. `LeaveRequest` (демо, різні статуси).

### 9.2 Відділи (`Department`, 6, з ієрархією)

| name | code | parent | head |
|---|---|---|---|
| Керівництво | `EXEC` | — | Ковальчук Андрій Петрович |
| HR-відділ | `HR` | Керівництво | Мельник Ольга Сергіївна |
| Розробка | `DEV` | Керівництво | Шевченко Ігор Васильович |
| ↳ Мобільна розробка | `DEV-MOB` | Розробка | Бондаренко Максим Юрійович |
| Маркетинг | `MKT` | Керівництво | Ткаченко Наталія Іванівна |
| Продажі | `SALES` | Керівництво | Кравченко Дмитро Олегович |
| Фінанси | `FIN` | Керівництво | Гончар Ірина Володимирівна |

### 9.3 Посади (`Position`, 12)

| title | department | grade |
|---|---|---|
| Генеральний директор | Керівництво | Head |
| HR-директор | HR-відділ | Head |
| HR-менеджер | HR-відділ | Middle |
| Рекрутер | HR-відділ | Junior |
| Керівник відділу розробки | Розробка | Head |
| Frontend-розробник | Розробка | Middle |
| Backend-розробник | Розробка | Senior |
| QA-інженер | Розробка | Middle |
| Mobile-розробник | Мобільна розробка | Middle |
| Маркетолог | Маркетинг | Middle |
| Менеджер з продажу | Продажі | Junior |
| Бухгалтер | Фінанси | Senior |

### 9.4 Типи відсутностей (`LeaveType`, 14) — **фінальний узгоджений список**

| `code` | `nameUk` | `unit` | `excl.Hol.` | `payKind` | `affects Balance` | `default Entitlement` | `maxPerYear` | `minNotice Days` | `allowPast Dates` (grace) | `allowHalf Day` | `requires Document` | `carryOver Allowed` | `approvalRoute` | `colorHex` | Підстава |
|---|---|---|:--:|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|---|---|
| `ANNUAL_BASIC` | Щорічна основна відпустка | CALENDAR | ✔ | PAID | ✔ | 28 | — | 14 | ✖ | ✖ | ✖ | ✔ (`max=null`) | MANAGER_THEN_HR | `#4F46E5` | ст. 6 ЗУ «Про відпустки» |
| `ANNUAL_ADDITIONAL_IRREGULAR` | Щорічна додаткова за ненормований робочий день | CALENDAR | ✔ | PAID | ✔ | 7 | — | 14 | ✖ | ✖ | ✖ | ✔ | MANAGER_THEN_HR | `#6366F1` | ст. 8 ЗУ «Про відпустки» |
| `SOCIAL_CHILDREN` | Додаткова відпустка працівникам, які мають дітей | CALENDAR | ✔ | PAID | ✔ | 10 | — | 7 | ✖ | ✖ | ✔ | ✖ | HR_ONLY | `#A855F7` | ст. 19 ЗУ «Про відпустки» |
| `SICK_PAID` | Лікарняний (тимчасова непрацездатність) | CALENDAR | ✖ | STATE_FUNDED | ✖ | — | — | 0 | ✔ (14) | ✖ | ✔ (№ е-лікарняного) | ✖ | HR_ONLY | `#EF4444` | ЗУ «Про загальнообов'язкове держ. соцстрахування» |
| `SICK_SELF` | Лікарняний без листка непрацездатності | CALENDAR | ✖ | UNPAID | ✔ | 5 | 5 | 0 | ✔ (14) | ✔ | ✖ | ✖ | MANAGER_ONLY | `#F97316` | політика компанії |
| `SICK_CHILD_CARE` | Догляд за хворою дитиною | CALENDAR | ✖ | STATE_FUNDED | ✖ | — | — | 0 | ✔ (14) | ✖ | ✔ | ✖ | HR_ONLY | `#FB7185` | ст. 25 ЗУ «Про відпустки» |
| `UNPAID_AGREEMENT` | Відпустка без збереження заробітної плати (за угодою сторін) | CALENDAR | ✔ | UNPAID | ✔ | 15 | 15 | 3 | ✖ | ✖ | ✖ | ✖ | MANAGER_THEN_HR | `#64748B` | ст. 26 ЗУ «Про відпустки» |
| `UNPAID_STATUTORY` | Відпустка без збереження з/п в обов'язковому порядку | CALENDAR | ✔ | UNPAID | ✖ | — | — | 0 | ✖ | ✖ | ✔ | ✖ | HR_ONLY | `#94A3B8` | ст. 25 ЗУ «Про відпустки» |
| `MATERNITY` | Відпустка у зв'язку з вагітністю та пологами | CALENDAR | ✖ | STATE_FUNDED | ✖ | 126 | — | 0 | ✔ (30) | ✖ | ✔ | ✖ | HR_ONLY | `#EC4899` | ст. 17 ЗУ «Про відпустки» |
| `CHILDCARE_3Y` | Відпустка для догляду за дитиною до 3 років | CALENDAR | ✖ | STATE_FUNDED | ✖ | — | — | 0 | ✖ | ✖ | ✔ | ✖ | HR_ONLY | `#D946EF` | ст. 18 ЗУ «Про відпустки» |
| `STUDY` | Навчальна відпустка | CALENDAR | ✔ | PAID | ✖ | — | — | 7 | ✖ | ✖ | ✔ (виклик) | ✖ | HR_ONLY | `#14B8A6` | ст. 13–15 ЗУ «Про відпустки» |
| `DAY_OFF` | Відгул за роботу у вихідний/святковий день | WORKING | — | PAID | ✔ | 0 | — | 1 | ✖ | ✔ | ✖ | ✖ | MANAGER_ONLY | `#84CC16` | ст. 72 КЗпП |
| `BLOOD_DONOR` | День донора | WORKING | — | PAID | ✖ | — | — | 0 | ✔ (14) | ✖ | ✔ | ✖ | HR_ONLY | `#DC2626` | ст. 124 КЗпП |
| `BUSINESS_TRIP` | Відрядження | WORKING | — | PAID | ✖ | — | — | 3 | ✖ | ✔ | ✖ | ✖ | MANAGER_THEN_HR | `#F59E0B` | не відпустка; лише для календаря відсутностей |

**Примітки:**
- `R13` (ліміт 365 днів) знімається для `CHILDCARE_3Y`.
- `SICK_*` дозволено накладати на `APPROVED ANNUAL_*` (E7). Константа `SICK_OVERLAP_ALLOWED = ['ANNUAL_BASIC','ANNUAL_ADDITIONAL_IRREGULAR']`.
- `NON_CARRYABLE_CODES = ['UNPAID_AGREEMENT','DAY_OFF','SICK_SELF']`.
- `isSystem: true` для всіх 14 — не можна видалити, лише `isActive: false`.
- Дані винесені в `prisma/data/leave-types.ts`.

### 9.5 Виробничий календар (`Holiday`)

Винесено в **`prisma/data/holidays.ts`** як звичайний масив, **не константа в коді** — з двох причин: (1) перелік ст. 73 КЗпП суттєво переглянуто реформою 2023 року і продовжує уточнюватися; (2) на період воєнного стану дія норм про святкові та неробочі дні призупинена ЗУ «Про організацію трудових відносин в умовах воєнного стану» — тому в `LeaveSettings` за замовчуванням `martialLawHolidaysSuspended: true`.

Базовий перелік для seed на поточний і наступний рік (`kind: PUBLIC_HOLIDAY`, **HR зобов'язаний звірити з чинною редакцією ст. 73 КЗпП перед впровадженням**):

| Дата | `nameUk` |
|---|---|
| 01.01 | Новий рік |
| 08.03 | Міжнародний жіночий день |
| 01.05 | День праці |
| 08.05 | День пам'яті та перемоги над нацизмом у Другій світовій війні 1939–1945 років |
| 28.06 | День Конституції України |
| 15.07 | День Української Державності |
| 24.08 | День Незалежності України |
| 01.10 | День захисників і захисниць України |
| 25.12 | Різдво Христове |

Рухомі релігійні свята та перенесені робочі суботи (`kind: WORKING_SATURDAY`) вносяться HR вручну через `/settings/holidays` — дата змінюється щороку, генерувати їх з пам'яті моделі заборонено.

### 9.6 Демо-персонал (`SEED_DEMO=true`)

- **~25 співробітників**, українські ПІБ, ієрархія `managerId` у **3 рівні**: Генеральний директор (`managerId = null`) → керівники 6 відділів → спеціалісти.
- Дати прийняття рознесені по 3 роках; кілька співробітників найнято в поточному році (перевірка пропорційного нарахування).
- Статуси: 18 `ACTIVE`, 4 `PROBATION`, 1 `MATERNITY_LEAVE`, 2 `TERMINATED` (перевірка фільтра «Показати архівованих»).
- `workRate`: 2 співробітники на 0.5 (перевірка E14).
- 1 співробітник без `departmentId` (перевірка групи «Поза відділами» в оргчарті).
- `personnelNumber` у форматі `HR-0001`…`HR-0025`.

### 9.7 Акаунти (`User`)

| email | role | employee | Примітка |
|---|---|---|---|
| `admin@hurma.local` | ADMIN | Ковальчук Андрій Петрович | |
| `hr@hurma.local` | HR | Мельник Ольга Сергіївна | |
| `manager@hurma.local` | MANAGER | Шевченко Ігор Васильович | має 5 підлеглих |
| `employee@hurma.local` | EMPLOYEE | Бондаренко Максим Юрійович | |

Пароль з `SEED_PASSWORD` (дефолт `Password123!`), хеш `bcrypt.hash(pwd, 10)`, `mustChangePassword: false` для демо. Решті демо-співробітників акаунти **не створюються** (перевірка сценарію «Employee без User»). Seed виводить у консоль таблицю створених логінів.

### 9.8 Баланси і заявки

- `LeaveBalance` + `LeaveLedgerEntry(ACCRUAL)` для кожного активного співробітника × кожен тип з `affectsBalance && defaultEntitlement != null` на поточний рік; `entitledDays` **пропорційно даті прийняття** для прийнятих у поточному році.
- **~30 `LeaveRequest`** у різних статусах, обов'язково включно з:
  - 4 `PENDING` на крок MANAGER (щоб `/leaves/approvals` не була порожня у `manager@hurma.local`);
  - 3 `PENDING` на крок HR;
  - 1 `PENDING` з простроченим погодженням (`submittedAt` > 3 робочих дні тому);
  - 8 `APPROVED` у поточному місяці (щоб календар був заповнений);
  - 1 заявка через межу року 28.12–05.01 (два `LeaveLedgerEntry` з різним `year`);
  - 1 `SICK_PAID` поверх `APPROVED ANNUAL_BASIC` (кейс E7);
  - по 2 `DRAFT`, `REJECTED`, `CANCELLED`.

---

## 10. Упорядкований план реалізації

Фази строго за залежностями. Кожна фаза завершується перевіркою, після якої можна переходити далі.

### Фаза 0 — Фундамент (0.5 дня)

| # | Задача | Файли |
|---|---|---|
| 0.1 | Вставити фінальну схему §2, видалити `Probe` | `prisma/schema.prisma` |
| 0.2 | Додати `migrations.seed: "tsx prisma/seed.ts"` | `prisma.config.ts` |
| 0.3 | `npx prisma migrate dev --name init` + `npx prisma generate` | — |
| 0.4 | Додати `"postinstall": "prisma generate"`, `"db:migrate": "prisma migrate dev"` | `package.json` |
| 0.5 | PRAGMA `foreign_keys=ON`, `journal_mode=WAL` | `src/instrumentation.ts` |
| 0.6 | `.env.example` (`DATABASE_URL`, `AUTH_SECRET`, `SEED_DEMO`, `SEED_PASSWORD`); згенерувати реальний `AUTH_SECRET` | `.env`, `.env.example` |
| 0.7 | `src/generated/**` у `.gitignore` (перевірити) | `.gitignore` |

**Готово, коли:** `prisma validate` valid, міграція застосована, `prisma studio` показує всі таблиці.

### Фаза 1 — Ядро інфраструктури (1 день)

| # | Задача | Файли |
|---|---|---|
| 1.1 | Хелпери дат — UTC-інваріант | `src/lib/date.ts` |
| 1.2 | Форматери, плюралізація, `locale: uk` | `src/lib/format.ts` |
| 1.3 | Українські повідомлення zod, спільні примітиви (`uaName`, `phoneUA`, `taxId`, `dateOnly`, `cuid`, `pagination`) | `src/lib/zod-uk.ts`, `src/schemas/common.ts` |
| 1.4 | Усі UA-підписи enum'ів (§8.2) | `src/lib/labels.ts` |
| 1.5 | Константи (`ANNUAL_LEAVE_DAYS=28`, `PAGE_SIZE=25`, `SICK_OVERLAP_ALLOWED`, `NON_CARRYABLE_CODES`) | `src/lib/constants.ts` |
| 1.6 | Контракт `ActionResult`, `DomainError` | `src/lib/errors.ts` |
| 1.7 | `buildSearchKey`, `normalizeQuery` | `src/lib/search.ts` |
| 1.8 | ESLint-правило `no-restricted-syntax` на `new Date(...)` поза `lib/date.ts` | `eslint.config.mjs` |

### Фаза 2 — Дизайн-система (1 день)

| # | Задача | Файли |
|---|---|---|
| 2.1 | Замінити `globals.css` на `@theme` §7.5 | `src/app/globals.css` |
| 2.2 | Замінити Geist → Inter (cyrillic), `<html lang="uk">`, metadata «HurmaStr» | `src/app/layout.tsx` |
| 2.3 | Примітиви: `Button`, `Input`, `Field`, `Select`, `Card`, `Badge`, `Avatar`, `EmptyState`, `Skeleton` | `src/components/ui/*` |
| 2.4 | Складніші: `DataTable`, `Modal`, `Sheet`, `Tabs`, `Toast`, `Pagination`, `ConfirmDialog`, `Progress`, `Tooltip` | `src/components/ui/*` |
| 2.5 | Сторінка-пісочниця для візуальної перевірки (тимчасова, видалити після Фази 4) | `src/app/(dashboard)/_kit/page.tsx` |

### Фаза 3 — Авторизація (1 день)

| # | Задача | Файли |
|---|---|---|
| 3.1 | `createSession/getSession/requireSession/requireRole/destroySession` (jose, `React.cache`) | `src/lib/session.ts` |
| 3.2 | `hash/compare` (bcryptjs, cost 10) | `src/lib/password.ts` |
| 3.3 | `can(session, action, resource)` — чисті функції, матриця §3.2 | `src/lib/permissions.ts` |
| 3.4 | `src/proxy.ts` + `config.matcher` (**не** `middleware.ts`) | `src/proxy.ts` |
| 3.5 | `signIn` Server Action + `AuditLog(LOGIN/LOGIN_FAILED)` | `src/server/actions/auth.ts` |
| 3.6 | `(auth)/layout.tsx` + `/login` з `useActionState` | `src/app/(auth)/*` |
| 3.7 | `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts` |
| 3.8 | `/forbidden`, `not-found`, `global-error` | `src/app/*` |

**Готово, коли:** неавтентифікований користувач редиректиться на `/login`; вхід із seed-акаунта веде на `/`; заблокований акаунт отримує «Обліковий запис деактивовано».

### Фаза 4 — Оболонка dashboard (0.5 дня)

| # | Задача | Файли |
|---|---|---|
| 4.1 | Декларативне меню з `roles[]` | `src/lib/nav.ts` |
| 4.2 | `(dashboard)/layout.tsx` — `requireSession()` → Sidebar + Topbar | `src/app/(dashboard)/layout.tsx` |
| 4.3 | `Sidebar` (згортання, off-canvas <1024 px), `Topbar`, `PageHeader` | `src/components/layout/*` |
| 4.4 | `loading.tsx` (skeleton), `error.tsx` | `src/app/(dashboard)/*` |

### Фаза 5 — Модуль 1: домен і довідник (2–3 дні)

| # | Задача | Файли |
|---|---|---|
| 5.1 | `buildOrgTree`, `getSubtreeIds`, `isDescendant`, `collectDeptSubtree` + **юніт-тести** | `src/server/services/org-tree.ts` |
| 5.2 | `writeAudit(tx, ...)` | `src/server/services/audit.ts` |
| 5.3 | zod-схеми: `employee`, `department`, `position`, `filters` (§5 Doc B) | `src/schemas/*` |
| 5.4 | DTO-мапери з вирізанням чутливих полів | `src/types/dto.ts` |
| 5.5 | `seed.ts` частина 1: відділи, посади, демо-персонал, акаунти | `prisma/seed.ts`, `prisma/data/demo.ts` |
| 5.6 | Queries: `listEmployees`, `getEmployee`, `getOrgTree` | `src/server/queries/*` |
| 5.7 | `/employees` — `DataTable` + `FiltersBar` (URL як SSOT, debounce 300 мс) + пагінація | |
| 5.8 | `/employees/[id]` — картка з вкладками `?tab=` | |
| 5.9 | `EmployeeForm` (RHF + `zodResolver`) → `/employees/new`, `/employees/[id]/edit` | |
| 5.10 | Actions: `createEmployee`, `updateEmployee` (з перевіркою циклів + перерахунком `searchKey`) | `src/server/actions/employees.ts` |
| 5.11 | `/departments`, `/departments/[id]`, actions + перевірка циклу `parentId` | |
| 5.12 | `/positions` + actions | |
| 5.13 | `/profile` (`selfUpdateSchema`), `changeOwnPassword` | |

**Готово, коли:** пошук «шевченко» знаходить «Шевченко»; MANAGER бачить лише свою команду; EMPLOYEE не бачить `taxId` чужих; спроба зациклити `managerId` дає «Циклічне підпорядкування заборонено».

### Фаза 6 — Модуль 1: оргчарт і життєвий цикл (1–1.5 дня)

| # | Задача |
|---|---|
| 6.1 | `/org-chart` — `OrgChartTree`/`OrgChartNode`, CSS-Grid лінії, згортання, `overflow-x:auto` |
| 6.2 | Перемикач «За керівниками / За відділами», група «Поза відділами», бейдж «Керівника не призначено» |
| 6.3 | Пошук над чартом з автопідсвіткою і розгортанням гілки |
| 6.4 | `terminateEmployee` + `TerminateDialog` («N підлеглих буде передано керівнику {ПІБ}») |
| 6.5 | `archiveEmployee` / `restoreEmployee` / `resetPassword` |
| 6.6 | `/settings/users` + `createUserAccount`, `changeUserRole`, `deactivateUser` (`tokenVersion++`) |
| 6.7 | Вкладка `?tab=audit` — рендер `AuditLog` |

**Готово, коли:** звільнення переприв'язує підлеглих, деактивує акаунт, знімає з `Department.head`; архівовані зникають зі списків і оргчарту.

### Фаза 7 — Модуль 2: домен відпусток (2 дні)

| # | Задача | Файли |
|---|---|---|
| 7.1 | `calcDays`, `calcDaysByYear`, `dayLabels` + **юніт-тести** (чиста функція, без БД) | `src/server/services/leave-duration.ts` |
| 7.2 | `available`, `recomputeBalance`, `assertBalance`, `bumpPending` | `src/server/services/leave-balance.ts` |
| 7.3 | `resolveRoute`, `buildRoute`, `nextStep` + **юніт-тести** (5 правил нормалізації) | `src/server/services/leave-route.ts` |
| 7.4 | `generateRequestNumber` (`ЗВ-2026-000042`) | `src/lib/numbering.ts` |
| 7.5 | zod-схеми: `leave`, `leave-type`, `holiday` | `src/schemas/*` |
| 7.6 | `seed.ts` частина 2: `LeaveSettings`, 14 `LeaveType`, `Holiday` × 2 роки | `prisma/data/leave-types.ts`, `prisma/data/holidays.ts` |
| 7.7 | `submitLeaveRequest` — повна транзакція з R1–R13 | `src/server/services/leave-service.ts` |
| 7.8 | `decideApproval`, `cancelLeaveRequest`, `shortenApprovedLeave` | там само |

**Готово, коли:** проходять пункти чек-листа §10 нижче (алгоритмічна частина).

### Фаза 8 — Модуль 2: екрани самообслуговування (1.5 дня)

| # | Задача |
|---|---|
| 8.1 | `previewLeaveDays` Server Action |
| 8.2 | `LeaveRequestForm` — тип, період, півдні, `DayBreakdownPreview`, `WarningList` з чекбоксом, прев'ю ланцюжка погодження |
| 8.3 | `/leaves/new`, `/leaves/[id]/edit` |
| 8.4 | `BalanceStrip`, `LeaveBalanceCard` + `Progress` |
| 8.5 | `/leaves/my` — таблиця + фільтри, розгортання в `ApprovalTimeline` |
| 8.6 | `/leaves/[id]` — деталі + таймлайн + кнопки за правами |
| 8.7 | `saveDraft`, `deleteDraft`, `duplicateRequest` |
| 8.8 | `/leaves` — редирект-хаб за роллю |

### Фаза 9 — Модуль 2: погодження і календар (1.5 дня)

| # | Задача |
|---|---|
| 9.1 | `/leaves/approvals` — 3 вкладки, `ApprovalQueueCard` з контекстним блоком (залишок після погодження, накладки колег, «Прострочене погодження») |
| 9.2 | Масові дії `decideBulk` (≤20, частковий результат) |
| 9.3 | HR-override (крок MANAGER вирішує HR, `decidedById ≠ approverId`) |
| 9.4 | `/leaves/calendar` — `AbsenceCalendarGrid`, режими «Місяць × Співробітники» / «Рік × Співробітник» |
| 9.5 | `toCalendarDto(request, viewer)` — приватність медичних даних (чужий відділ → «Відсутній») |
| 9.6 | Навігація по місяцях через `searchParams` + `<Link>` (без клієнтського стану) |
| 9.7 | Бічна панель `Sheet` з деталями заявки при кліку на смугу |

### Фаза 10 — Модуль 2: баланси й адміністрування (1 день)

| # | Задача |
|---|---|
| 10.1 | `/leaves/balances` — матриця, фільтри («є від'ємний баланс», «не нараховано») |
| 10.2 | `/leaves/balances/[employeeId]` — журнал `LeaveLedgerEntry` |
| 10.3 | `adjustBalance` (модалка з обов'язковою причиною) |
| 10.4 | `runAccrual` (ідемпотентно) + `runCarryOver` + `recomputeAllBalances` |
| 10.5 | `compensateOnTermination` + блок «Невикористані дні: N» на картці співробітника |
| 10.6 | `exportBalancesCsv` (UTF-8 BOM, `;`) |
| 10.7 | `/settings/leave-types`, `/settings/holidays` (+ «Заповнити типовими»), `/settings/leave-rules` |

### Фаза 11 — Панель, пошук, полірування (1 день)

| # | Задача |
|---|---|
| 11.1 | `/` — 4 `StatTile` + «Хто сьогодні відсутній» + «Найближчі дні народження» + «Мій баланс» + «Потребують погодження» |
| 11.2 | `GET /api/search?q=` + `CommandPalette` (⌘K) + `Combobox` |
| 11.3 | `GET /api/uploads/[...path]` з ACL; завантаження вкладень (pdf/jpg/png ≤5 МБ) |
| 11.4 | Дзвіночок сповіщень з лічильником у топбарі |
| 11.5 | `GET /api/health` |
| 11.6 | Усі порожні стани §7.7; усі тости; перевірка, що в JSX немає хардкод-рядків |
| 11.7 | Адаптив <1024 px: off-canvas сайдбар, горизонтальний скрол таблиць і календаря в окремих контейнерах |
| 11.8 | Прохід чек-листом §10.1 |

### 10.1 Чек-лист приймання

**Модуль 1**
- [ ] Пошук «шевченко» (нижній регістр) знаходить «Шевченко» — `searchKey` працює.
- [ ] Фільтр за відділом «Розробка» повертає і співробітників «Мобільної розробки» (підвідділи).
- [ ] MANAGER на `/employees` за замовчуванням бачить лише свою команду; чужих — без `taxId`/`address`.
- [ ] EMPLOYEE відкриває `/departments` → 403 (пункту немає в меню + `requireRole` на сторінці).
- [ ] Спроба призначити керівником власного підлеглого → «Циклічне підпорядкування заборонено».
- [ ] Звільнення керівника з 5 підлеглими: підлеглі перейшли на його керівника, акаунт деактивовано, `PENDING`-заявки скасовано, `Department.headId` очищено.
- [ ] Архівація відділу з людьми → «Неможливо архівувати: у відділі N співробітників».
- [ ] Оргчарт з двома коренями рендерить обидва під заголовком «Без керівника».

**Модуль 2**
- [ ] Заявка 01.07–14.07 `ANNUAL_BASIC` = 14 к.дн.; вона ж із 24.08 у періоді = 13 к.дн. (за `martialLawHolidaysSuspended = false`).
- [ ] `DAY_OFF` пн–пт із двома півднями = 4.0 робочих дні.
- [ ] Півдні на `ANNUAL_BASIC` (CALENDAR) ігноруються — чекбокси не рендеряться, сервер примусово ставить `NONE`.
- [ ] Подання при доступних 6 днях і запиті 10 → «Недостатньо днів: доступно 6, потрібно 10».
- [ ] Перетин із власною погодженою заявкою → блок з номером заявки; `SICK_PAID` поверх `ANNUAL_BASIC` → дозволено.
- [ ] Відхилення керівником: `pendingDays` повернувся, `usedDays` не змінився, `LeaveLedgerEntry` не створено.
- [ ] Двокроковий маршрут: після керівника заявка лишається `PENDING` зі `currentStep = 2`.
- [ ] Керівник подає заявку на себе → крок MANAGER підіймається на його керівника; директор → крок стає HR.
- [ ] Спроба погодити власну заявку → «Неможливо погодити власну заявку».
- [ ] EMPLOYEE відкриває `/leaves/approvals` → 403; у календарі чужий відділ показано як «Відсутній» без типу.
- [ ] Заявка 28.12–05.01 створює два `LeaveLedgerEntry` з різними `year`.
- [ ] `runAccrual(2026, 7)` двічі поспіль → баланс не подвоївся (`skipped` > 0).
- [ ] `runCarryOver(2026)` двічі → жодного дубля; `UNPAID_AGREEMENT` не перенесено.
- [ ] Скасування погодженої відпустки, що триває → повертаються лише дні від завтра; запис `USAGE_REVERSAL`.
- [ ] `recomputeAllBalances(2026)` не змінює жодного балансу (кеш збігається з журналом).
- [ ] Усі підписи в UI — українською; жодного `en`-рядка в JSX.

---

## Додаток. Команди

```bash
npx prisma migrate dev --name init     # застосувати схему
npx prisma generate                    # клієнт у src/generated/prisma
npm run db:seed                        # довідники + демо (SEED_DEMO=true)
npm run db:reset                       # повне перестворення
npm run db:studio
npm run dev
```