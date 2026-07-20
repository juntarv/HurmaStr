import { requireSession } from "@/lib/auth";
import { canManageEmployees } from "@/lib/permissions";
import { getEmployeeFormOptions } from "@/server/queries/employees";
import { createEmployeeAction } from "@/server/actions/employees";
import { PageHeader } from "@/components/ui";
import { EmployeeForm } from "../employee-form";
import { forbidden } from "@/components/forbidden";

export const metadata = { title: "Новий співробітник — HurmaStr" };

export default async function NewEmployeePage() {
  const session = await requireSession();
  if (!canManageEmployees(session)) return forbidden();

  const options = await getEmployeeFormOptions();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Новий співробітник"
        subtitle="Заповніть картку. Запрошення в систему можна надіслати після збереження."
      />
      <EmployeeForm action={createEmployeeAction} options={options} submitLabel="Створити картку" />
    </div>
  );
}
