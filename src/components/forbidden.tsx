import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";

/** Єдиний вигляд для «недостатньо прав» — щоб повідомлення не розповзалися. */
export function forbidden(message = "У вас немає доступу до цього розділу.") {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <EmptyState
          tone="error"
          icon={<ShieldAlert className="size-5" />}
          title="Недостатньо прав"
          description={message}
          action={
            <Link href="/">
              <Button variant="secondary">На панель</Button>
            </Link>
          }
        />
      </Card>
    </div>
  );
}
