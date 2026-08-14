"use client";

import { useActionState, useState } from "react";
import { FileText, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  deleteEmployeeDocumentAction,
  uploadEmployeeDocumentAction,
  type DocumentResult,
} from "@/server/actions/documents";
import { Button, Divider, EmptyState, Input } from "@/components/ui";
import { formatDateUk } from "@/lib/dates";

export type EmployeeDoc = {
  id: string;
  title: string;
  kind: "OFFER" | "JOB_DESCRIPTION" | null;
  fileName: string;
  size: number;
  updatedAt: Date;
};

// Назви для легасі-записів першої версії (два фіксовані слоти без title).
const legacyKindLabels: Record<string, string> = {
  OFFER: "Офер",
  JOB_DESCRIPTION: "Посадова інструкція",
};

function docTitle(doc: EmployeeDoc): string {
  return doc.title || (doc.kind ? legacyKindLabels[doc.kind] : "") || doc.fileName;
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function DocumentRow({ doc, canManage }: { doc: EmployeeDoc; canManage: boolean }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await deleteEmployeeDocumentAction(doc.id);
    setBusy(false);
  }

  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-soft">
        <FileText className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={`/api/employee-documents/${doc.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-medium text-ink hover:text-brand"
        >
          {docTitle(doc)}
        </a>
        <p className="truncate text-xs text-ink-muted">
          {doc.fileName} · {sizeLabel(doc.size)} · {formatDateUk(doc.updatedAt)}
        </p>
      </div>
      {canManage ? (
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
    </li>
  );
}

/**
 * Панель кадрових документів — довільна кількість файлів.
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
  const [state, formAction, pending] = useActionState<DocumentResult | null, FormData>(
    uploadEmployeeDocumentAction,
    null,
  );

  return (
    <div>
      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="Документів ще немає"
          description={canManage ? "Завантажте офер, посадову інструкцію чи будь-який інший документ." : "Документи додає HR або адміністратор."}
        />
      ) : (
        <ul className="divide-y divide-line">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} canManage={canManage} />
          ))}
        </ul>
      )}

      {canManage ? (
        <>
          <Divider />
          <form action={formAction} className="flex flex-wrap items-center gap-2 p-4">
            <Input
              name="title"
              placeholder="Назва (напр. Офер, NDA) — або лишиться ім'я файлу"
              className="min-w-44 flex-1"
              maxLength={120}
            />
            <input type="hidden" name="employeeId" value={employeeId} />
            <input
              type="file"
              name="file"
              required
              accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
              className="max-w-52 text-xs text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-brand-soft file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand hover:file:bg-brand-line"
            />
            <Button type="submit" size="sm" disabled={pending}>
              <Plus className="size-3.5" aria-hidden />
              {pending ? "…" : "Додати"}
            </Button>

            {state && !state.ok ? (
              <p role="alert" className="w-full flex items-center gap-2 text-sm text-danger">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                {state.error}
              </p>
            ) : null}
          </form>
        </>
      ) : null}
    </div>
  );
}
