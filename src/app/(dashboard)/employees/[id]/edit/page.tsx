import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { canManageEmployees } from "@/lib/permissions";
import { getEmployeeById, getEmployeeFormOptions } from "@/server/queries/employees";
import { updateEmployeeAction } from "@/server/actions/employees";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "../../employee-form";
import { forbidden } from "@/components/forbidden";

export const metadata = { title: "Редагування картки — HurmaStr" };

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!canManageEmployees(session)) return forbidden();

  const { id } = await params;
  const [employee, options] = await Promise.all([
    getEmployeeById(id),
    getEmployeeFormOptions(id),
  ]);
  if (!employee) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`${employee.lastName} ${employee.firstName}`}
        subtitle="Редагування кадрової картки"
      />
      <EmployeeForm
        action={updateEmployeeAction}
        options={options}
        values={employee}
        submitLabel="Зберегти зміни"
      />
    </div>
  );
}
