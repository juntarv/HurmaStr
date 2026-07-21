import Link from "next/link";
import { UserRound } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Avatar, Button, Card, CardHeader, Divider, EmptyState, PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { ChangePasswordForm } from "./change-password";
import { roleLabels } from "@/lib/labels";
import { formatDateUk, tenureUk } from "@/lib/dates";

export const metadata = { title: "Мій профіль — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();

  if (!session.employeeId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <EmptyState
            icon={<UserRound className="size-5" />}
            title="Акаунт не пов'язаний з карткою співробітника"
            description="Зверніться до адміністратора, щоб прив'язати вашу кадрову картку."
          />
        </Card>
      </div>
    );
  }

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: session.employeeId },
    include: {
      position: { select: { title: true } },
      department: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Мій профіль" subtitle="Контактні дані ви можете оновити самостійно" />

      <Card className="mb-5 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar
            firstName={employee.firstName}
            lastName={employee.lastName}
            avatarUrl={employee.avatarUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-ink">
              {employee.lastName} {employee.firstName} {employee.middleName ?? ""}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {employee.position?.title ?? "Посада не вказана"}
              {employee.department ? ` · ${employee.department.name}` : ""}
            </p>
            <p className="mt-1 text-xs text-ink-faint">
              {roleLabels[session.role]} · у компанії {tenureUk(employee.hireDate)} (з{" "}
              {formatDateUk(employee.hireDate)})
            </p>
          </div>
          <Link href={`/employees/${employee.id}`}>
            <Button variant="secondary" size="sm">
              Моя картка
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="mb-5">
        <CardHeader title="Контактні дані" />
        <Divider />
        <ProfileForm values={employee} />
        <p className="px-5 pb-5 text-xs text-ink-muted">
          Посаду, відділ, керівника та дати змінює HR — зверніться до нього, якщо там помилка.
        </p>
      </Card>

      <Card>
        <CardHeader title="Зміна пароля" />
        <Divider />
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
