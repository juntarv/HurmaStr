"use client";

import { useActionState, useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import {
  cancelRequestAction,
  decideApprovalAction,
  type LeaveActionResult,
} from "@/server/actions/leaves";
import { Button, Textarea } from "@/components/ui";

/** Кнопки «Погодити» / «Відхилити» для активного кроку погодження. */
export function DecisionButtons({ approvalId }: { approvalId: string }) {
  const [state, formAction, pending] = useActionState<LeaveActionResult | null, FormData>(
    decideApprovalAction,
    null,
  );
  const [showComment, setShowComment] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="approvalId" value={approvalId} />

      {showComment ? (
        <Textarea name="comment" rows={2} placeholder="Коментар до рішення (не обов'язково)" />
      ) : (
        <button
          type="button"
          onClick={() => setShowComment(true)}
          className="self-start text-xs text-brand hover:underline"
        >
          Додати коментар
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="APPROVE" disabled={pending}>
          <Check className="size-4" aria-hidden />
          Погодити
        </Button>
        <Button
          type="submit"
          name="decision"
          value="REJECT"
          variant="danger"
          disabled={pending}
        >
          <X className="size-4" aria-hidden />
          Відхилити
        </Button>
      </div>

      {state && !state.ok ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg border border-success-line bg-success-soft px-3 py-2 text-sm text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** Скасування власної (або будь-якої — для HR) заявки. */
export function CancelRequestForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<LeaveActionResult | null, FormData>(
    cancelRequestAction,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming(true)}>
        Скасувати заявку
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Textarea name="cancelReason" rows={2} placeholder="Причина скасування (не обов'язково)" />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          {pending ? "Скасовуємо…" : "Так, скасувати"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Ні, залишити
        </Button>
      </div>

      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
