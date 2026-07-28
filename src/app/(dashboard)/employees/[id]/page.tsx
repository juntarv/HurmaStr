import Link from "next/link";
import { notFound } from "next/navigation";
import { Cake, Mail, MapPin, Package, Pencil, Phone, Send, Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { canManageEmployees, canViewPayroll, canViewSensitive, isAdmin } from "@/lib/permissions";
import { getEmployeeById } from "@/server/queries/employees";
import { getEmployeeBalances } from "@/server/services/balance";
import { getAssetsForEmployee } from "@/server/queries/assets";
import { Avatar, Badge, Button, Card, CardHeader, Divider, EmptyState } from "@/components/ui";
import { AssetCategoryIcon, LeaveTypeIcon } from "@/components/icons";
import { CredentialsPanel } from "./credentials-panel";
import { AdjustBalancePanel } from "./adjust-balance";
import {
  assetCategoryLabels,
  assetStatusLabels,
  assetStatusTone,
  employeeStatusLabels,
  employeeStatusTone,
  employmentTypeLabels,
  genderLabels,
  paymentTypeLabels,
  roleLabels,
  ui,
} from "@/lib/labels";
import { ageFrom, formatDateUk, tenureUk } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await getEmployeeById(id);
  return { title: employee ? `${employee.lastName} ${employee.firstName} — HurmaStr` : "Картка" };
}

/** Рядок «підпис — значення» в блоці деталей. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-2.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm text-ink">{children}</span>
    </div>
  );
}

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const employee = await getEmployeeById(id);
  if (!employee) notFound();

  const canManage = canManageEmployees(session);
  const canSeePrivate = canViewSensitive(session, {
    id: employee.id,
    managerId: employee.managerId,
  });
  const canSeePayroll = canViewPayroll(session, { id: employee.id });
  const hasPayroll =
    employee.paymentType || employee.payoutAmount != null || employee.walletAddress;

  const year = new Date().getUTCFullYear();
  const [balances, assets] = await Promise.all([
    getEmployeeBalances(employee.id),
    getAssetsForEmployee(employee.id),
  ]);
  // Типи, що ведуть облік днів — для панелі ручного коригування.
  const trackedTypes = balances.filter((b) => b.tracks).map((b) => ({ id: b.type.id, nameUk: b.type.nameUk }));

  return (
    <div className="mx-auto max-w-5xl">
      {/* ------------------------------ Шапка ------------------------------- */}
      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar
            firstName={employee.firstName}
            lastName={employee.lastName}
            avatarUrl={employee.avatarUrl}
            size="xl"
          />
          <div className="min-w-48 flex-1">
            <h1 className="text-xl font-semibold text-ink">
              {employee.lastName} {employee.firstName} {employee.middleName ?? ""}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {employee.position?.title ?? ui.notSpecified}
              {employee.department ? ` · ${employee.department.name}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={employeeStatusTone[employee.status]}>
                {employeeStatusLabels[employee.status]}
              </Badge>
              {employee.isArchived ? <Badge>Архів</Badge> : null}
              {employee.account ? (
                <Badge tone="brand">{roleLabels[employee.account.role]}</Badge>
              ) : (
                <Badge>Без акаунта</Badge>
              )}
              <span className="text-xs text-ink-muted">
                у компанії {tenureUk(employee.hireDate)}
              </span>
            </div>
          </div>

          {canManage ? (
            <Link href={`/employees/${employee.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil className="size-4" aria-hidden />
                {ui.edit}
              </Button>
            </Link>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ----------------------------- Контакти ---------------------------- */}
        <Card>
          <CardHeader title="Контакти" />
          <Divider />
          <div className="divide-y divide-line">
            <Row label="Робоча пошта">
              {employee.workEmail ? (
                <a href={`mailto:${employee.workEmail}`} className="flex items-center gap-1.5 hover:text-brand">
                  <Mail className="size-3.5" aria-hidden />
                  {employee.workEmail}
                </a>
              ) : (
                <span className="text-ink-faint">{ui.notSpecified}</span>
              )}
            </Row>
            <Row label="Телефон">
              {employee.phone ? (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" aria-hidden />
                  {employee.phone}
                </span>
              ) : (
                <span className="text-ink-faint">{ui.notSpecified}</span>
              )}
            </Row>
            <Row label="Telegram">
              {employee.telegram ? (
                <span className="flex items-center gap-1.5">
                  <Send className="size-3.5" aria-hidden />
                  {employee.telegram}
                </span>
              ) : (
                <span className="text-ink-faint">{ui.notSpecified}</span>
              )}
            </Row>
            <Row label="Місто">
              {employee.city ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden />
                  {employee.city}
                </span>
              ) : (
                <span className="text-ink-faint">{ui.notSpecified}</span>
              )}
            </Row>
            <Row label="День народження">
              {employee.birthDate ? (
                <span className="flex items-center gap-1.5">
                  <Cake className="size-3.5" aria-hidden />
                  {formatDateUk(employee.birthDate)}
                  {canSeePrivate ? ` · ${ageFrom(employee.birthDate)} р.` : ""}
                </span>
              ) : (
                <span className="text-ink-faint">{ui.notSpecified}</span>
              )}
            </Row>

            {/* Приватні поля — лише самому співробітнику, його керівнику та HR. */}
            {canSeePrivate ? (
              <>
                <Row label="Особиста пошта">
                  {employee.personalEmail ?? <span className="text-ink-faint">{ui.notSpecified}</span>}
                </Row>
                <Row label="Екстрений контакт">
                  {employee.emergencyContactName ? (
                    <>
                      {employee.emergencyContactName}
                      {employee.emergencyContactPhone ? ` · ${employee.emergencyContactPhone}` : ""}
                    </>
                  ) : (
                    <span className="text-ink-faint">{ui.notSpecified}</span>
                  )}
                </Row>
              </>
            ) : null}
          </div>
        </Card>

        {/* ------------------------------ Робота ----------------------------- */}
        <Card>
          <CardHeader title="Робота" />
          <Divider />
          <div className="divide-y divide-line">
            <Row label="Дата найму">{formatDateUk(employee.hireDate)}</Row>
            <Row label="Стаж у компанії">{tenureUk(employee.hireDate)}</Row>
            {employee.probationEndDate ? (
              <Row label="Випробувальний до">{formatDateUk(employee.probationEndDate)}</Row>
            ) : null}
            <Row label="Тип зайнятості">{employmentTypeLabels[employee.employmentType]}</Row>
            <Row label="Стать">{genderLabels[employee.gender]}</Row>
            <Row label="Керівник">
              {employee.manager ? (
                <Link href={`/employees/${employee.manager.id}`} className="hover:text-brand">
                  {employee.manager.lastName} {employee.manager.firstName}
                </Link>
              ) : (
                <span className="text-ink-faint">{ui.notSpecified}</span>
              )}
            </Row>
            {employee.terminationDate ? (
              <Row label="Дата звільнення">{formatDateUk(employee.terminationDate)}</Row>
            ) : null}
          </div>
        </Card>

        {/* ------------------------------ Виплати ---------------------------- */}
        {canSeePayroll ? (
          <Card>
            <CardHeader title="Виплати" />
            <Divider />
            {hasPayroll ? (
              <div className="divide-y divide-line">
                <Row label="Тип оплати">
                  {employee.paymentType ? (
                    paymentTypeLabels[employee.paymentType]
                  ) : (
                    <span className="text-ink-faint">{ui.notSpecified}</span>
                  )}
                </Row>
                <Row label="Сума">
                  {employee.payoutAmount != null ? (
                    <span className="font-semibold">
                      {employee.payoutAmount} {employee.payoutCurrency ?? ""}
                    </span>
                  ) : (
                    <span className="text-ink-faint">{ui.notSpecified}</span>
                  )}
                </Row>
                <Row label="Гаманець / реквізити">
                  {employee.walletAddress ? (
                    <span className="break-all font-mono text-xs">{employee.walletAddress}</span>
                  ) : (
                    <span className="text-ink-faint">{ui.notSpecified}</span>
                  )}
                </Row>
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-ink-muted">Платіжні дані не заповнені.</p>
            )}
          </Card>
        ) : null}

        {/* ------------------------------ Баланси ---------------------------- */}
        <Card>
          <CardHeader title={`Баланс днів за ${year}`} />
          <Divider />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
            {balances.map((b) => (
              <div key={b.type.id} className="rounded-lg border border-line bg-surface-muted px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <LeaveTypeIcon icon={b.type.icon} color={b.type.colorHex} />
                  <span className="text-lg font-semibold leading-none text-ink">
                    {b.tracks ? b.available : b.used}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-tight text-ink-muted">{b.type.nameUk}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {b.tracks
                    ? `нараховано ${b.entitled}${b.adjustment !== 0 ? `, коригування ${b.adjustment > 0 ? "+" : ""}${b.adjustment}` : ""}, використано ${b.used}`
                    : "взято цьогоріч"}
                </p>
              </div>
            ))}
          </div>
          {canManage && trackedTypes.length > 0 ? (
            <AdjustBalancePanel employeeId={employee.id} types={trackedTypes} />
          ) : null}
        </Card>

        {/* ------------------------------- Майно ----------------------------- */}
        {isAdmin(session) ? (
        <Card>
          <CardHeader
            title={`Майно — ${assets.length}`}
            action={
              <Link href="/assets" className="text-xs text-brand hover:underline">
                Керувати
              </Link>
            }
          />
          <Divider />
          {assets.length === 0 ? (
            <EmptyState
              icon={<Package className="size-5" />}
              title="Майна не закріплено"
              description="Обладнання видається у розділі «Майно»."
            />
          ) : (
            <ul className="divide-y divide-line">
              {assets.map((asset) => (
                <li key={asset.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface-muted text-ink-soft">
                    <AssetCategoryIcon category={asset.category} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{asset.name}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {assetCategoryLabels[asset.category]}
                      {asset.inventoryNumber ? ` · ${asset.inventoryNumber}` : ""}
                    </p>
                  </div>
                  <Badge tone={assetStatusTone[asset.status]}>
                    {assetStatusLabels[asset.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        ) : null}

        {/* ----------------------------- Підлеглі ---------------------------- */}
        <Card>
          <CardHeader title={`Підлеглі — ${employee.subordinates.length}`} />
          <Divider />
          {employee.subordinates.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="Підлеглих немає"
              description="Керівник призначається в картці підлеглого."
            />
          ) : (
            <ul className="divide-y divide-line">
              {employee.subordinates.map((person) => (
                <li key={person.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar
                    firstName={person.firstName}
                    lastName={person.lastName}
                    avatarUrl={person.avatarUrl}
                    size="sm"
                  />
                  <Link
                    href={`/employees/${person.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-brand"
                  >
                    {person.lastName} {person.firstName}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {person.position?.title ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ----------------------------- Доступ ------------------------------ */}
        {canManage ? (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Доступ до системи"
              action={
                employee.account ? (
                  employee.account.isActive ? (
                    <Badge tone="success">Активний</Badge>
                  ) : (
                    <Badge tone="warning">Вимкнено</Badge>
                  )
                ) : (
                  <Badge>Без доступу</Badge>
                )
              }
            />
            <Divider />
            {employee.account?.lastLoginAt ? (
              <p className="px-5 pt-4 text-xs text-ink-muted">
                Останній вхід: {formatDateUk(employee.account.lastLoginAt)}
              </p>
            ) : null}
            <CredentialsPanel
              employeeId={employee.id}
              defaultEmail={employee.workEmail ?? ""}
              currentEmail={employee.account?.email ?? null}
              currentRole={employee.account?.role ?? null}
              hasAccount={!!employee.account}
              isActive={employee.account?.isActive ?? false}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
