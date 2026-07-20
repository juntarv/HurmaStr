import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeBalances } from "@/server/services/balance";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { UserRound } from "lucide-react";
import { RequestForm, type LeaveTypeOption } from "./request-form";

export const metadata = { title: "Нова заявка — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function NewLeaveRequestPage() {
  const session = await requireSession();

  if (!session.employeeId) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <EmptyState
            icon={<UserRound className="size-5" />}
            title="Акаунт не пов'язаний з карткою співробітника"
            description="Заявки подаються від імені кадрової картки. Зверніться до адміністратора."
          />
        </Card>
      </div>
    );
  }

  const [types, balances] = await Promise.all([
    prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    getEmployeeBalances(session.employeeId),
  ]);

  const options: LeaveTypeOption[] = types.map((type) => {
    const b = balances.find((item) => item.type.id === type.id);
    return {
      id: type.id,
      nameUk: type.nameUk,
      icon: type.icon,
      colorHex: type.colorHex,
      unit: type.unit,
      affectsBalance: b?.tracks ?? type.affectsBalance,
      requiresDocument: type.requiresDocument,
      allowPastDates: type.allowPastDates,
      minNoticeDays: type.minNoticeDays,
      description: type.description,
      available: b?.available ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Нова заявка" subtitle="Відпустка, лікарняний або day off" />
      <RequestForm types={options} />
    </div>
  );
}
