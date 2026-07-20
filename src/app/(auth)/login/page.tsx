import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Вхід — HurmaStr" };

export default async function LoginPage() {
  // Уже авторизований — нема сенсу показувати форму.
  if (await getSession()) redirect("/");

  return (
    <Card className="p-6">
      <h1 className="mb-1 text-base font-semibold text-ink">Вхід у систему</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Увійдіть за робочою поштою, на яку ви отримали запрошення.
      </p>
      <LoginForm />
    </Card>
  );
}
