"use client";

import { useActionState, useState } from "react";
import { FileText, Trash2, TriangleAlert, Upload } from "lucide-react";
import {
  deleteEmployeeDocumentAction,
  uploadEmployeeDocumentAction,
  type DocumentResult,
} from "@/server/actions/documents";
import { Button, Divider } from "@/components/ui";
import { formatDateUk } from "@/lib/dates";

export type EmployeeDoc = {
  id: string;
  kind: "OFFER" | "JOB_DESCRIPTION";
  fileName: string;
  size: number;
  updatedAt: Date;
};

const kindLabels: Record<EmployeeDoc["kind"], string> = {
  OFFER: "Офер",
  JOB_DESCRIPTION: "Посадова інструкція",
};

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function DocumentSlot({
  employeeId,
  kind,
  doc,
  canManage,
}: {
  employeeId: string;
  kind: EmployeeDoc["kind"];
  doc: EmployeeDoc | undefined;
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState<DocumentResult | null, FormData>(
    uploadEmployeeDocumentAction,
    null,
  );
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!doc) return;
    setBusy(true);
    await deleteEmployeeDocumentAction(doc.id);
    setBusy(false);
  }

  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-soft">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-40 flex-1">
          <p className="text-sm font-medium text-ink">{kindLabels[kind]}</p>
          {doc ? (
            <a
              href={`/api/employee-documents/${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-brand hover:underline"
            >
              {doc.fileName} · {sizeLabel(doc.size)} · {formatDateUk(doc.updatedAt)}
            </a>
          ) : (
            <p className="text-xs text-ink-faint">Не завантажено</p>
          )}
        </div>

        {canManage ? (
          <div className="flex items-center gap-2">
            <form action={formAction} className="flex items-center gap-2">
              <input type="hidden" name="employeeId" value={employeeId} />
              <input type="hidden" name="kind" value={kind} />
              <input
                type="file"
                name="file"
                required
                accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                className="max-w-44 text-xs text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-brand-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand hover:file:bg-brand-line"
              />
              <Button type="submit" size="sm" variant="secondary" disabled={pending}>
                <Upload className="size-3.5" aria-hidden />
                {pending ? "…" : doc ? "Замінити" : "Завантажити"}
              </Button>
            </form>
            {doc ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={remove}
                disabled={busy}
                title="Видалити документ"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {state && !state.ok ? (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-danger">
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Панель кадрових документів (офер + посадова інструкція).
 * Показується лише керівництву; завантаження/видалення — лише HR/адмін.
 */
export function DocumentsPanel({
  employeeId,
  documents,
  canManage,
}: {
  employeeId: string;
  documents: EmployeeDoc[];
  canManage: boolean;
}) {
  const byKind = new Map(documents.map((d) => [d.kind, d]));
  return (
    <div>
      <DocumentSlot
        employeeId={employeeId}
        kind="OFFER"
        doc={byKind.get("OFFER")}
        canManage={canManage}
      />
      <Divider />
      <DocumentSlot
        employeeId={employeeId}
        kind="JOB_DESCRIPTION"
        doc={byKind.get("JOB_DESCRIPTION")}
        canManage={canManage}
      />
    </div>
  );
}
