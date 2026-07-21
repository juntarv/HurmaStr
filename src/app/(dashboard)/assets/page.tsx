import Link from "next/link";
import { Boxes, Package, Search, Wrench } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { isHrOrAdmin } from "@/lib/permissions";
import {
  getAssetStats,
  getAssignableEmployees,
  listAssets,
} from "@/server/queries/assets";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StatTile,
} from "@/components/ui";
import { AssetCategoryIcon } from "@/components/icons";
import { AssetRowControls, CreateAssetForm } from "./asset-controls";
import { forbidden } from "@/components/forbidden";
import {
  assetCategoryLabels,
  assetStatusLabels,
  assetStatusTone,
  ui,
} from "@/lib/labels";
import { formatDateUk } from "@/lib/dates";
import type { AssetCategory, AssetStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Майно — HurmaStr" };
export const dynamic = "force-dynamic";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}) {
  const session = await requireSession();
  if (!isHrOrAdmin(session)) return forbidden("Розділ «Майно» доступний HR та адміністраторам.");

  const params = await searchParams;
  const category = (params.category || undefined) as AssetCategory | undefined;
  const status = (params.status || undefined) as AssetStatus | undefined;

  const [assets, stats, employees] = await Promise.all([
    listAssets({ q: params.q, category, status }),
    getAssetStats(),
    getAssignableEmployees(),
  ]);

  const hasFilters = Boolean(params.q || params.category || params.status);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Майно" subtitle="Облік обладнання та його видача співробітникам" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<Boxes className="size-4" />} value={stats.total} label="Усього одиниць" tone="brand" />
        <StatTile icon={<Package className="size-4" />} value={stats.inUse} label="Видано" tone="brand" />
        <StatTile value={stats.inStock} label="На складі" tone="success" />
        <StatTile icon={<Wrench className="size-4" />} value={stats.repair} label="У ремонті" tone="warning" />
      </div>

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input name="q" defaultValue={params.q ?? ""} placeholder="Назва, інвентарний або серійний номер" className="pl-9" />
        </div>
        <Select name="category" defaultValue={params.category ?? ""} className="w-auto min-w-40">
          <option value="">Усі категорії</option>
          {(Object.keys(assetCategoryLabels) as AssetCategory[]).map((key) => (
            <option key={key} value={key}>{assetCategoryLabels[key]}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={params.status ?? ""} className="w-auto min-w-40">
          <option value="">Усі статуси</option>
          {(Object.keys(assetStatusLabels) as AssetStatus[]).map((key) => (
            <option key={key} value={key}>{assetStatusLabels[key]}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">Знайти</Button>
        {hasFilters ? (
          <Link href="/assets">
            <Button type="button" variant="ghost">{ui.resetFilters}</Button>
          </Link>
        ) : null}
      </form>

      {assets.length === 0 ? (
        <Card className="mb-5">
          <EmptyState
            icon={<Package className="size-5" />}
            title={hasFilters ? ui.nothingFound : "Майна ще немає"}
            description={hasFilters ? "Змініть фільтри або скиньте їх." : "Додайте першу одиницю обладнання нижче."}
          />
        </Card>
      ) : (
        <ul className="mb-5 flex flex-col gap-2">
          {assets.map((asset) => (
            <li key={asset.id}>
              <Card interactive className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-surface-muted text-ink-soft">
                  <AssetCategoryIcon category={asset.category} className="size-5" />
                </span>

                <div className="min-w-44 flex-1">
                  <p className="text-sm font-medium text-ink">{asset.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {assetCategoryLabels[asset.category]}
                    {asset.inventoryNumber ? ` · ${asset.inventoryNumber}` : ""}
                    {asset.purchaseDate ? ` · від ${formatDateUk(asset.purchaseDate)}` : ""}
                  </p>
                </div>

                {asset.assignedTo ? (
                  <Link
                    href={`/employees/${asset.assignedTo.id}`}
                    className="flex items-center gap-2 text-xs text-ink-soft hover:text-brand"
                  >
                    <Avatar
                      firstName={asset.assignedTo.firstName}
                      lastName={asset.assignedTo.lastName}
                      avatarUrl={asset.assignedTo.avatarUrl}
                      size="sm"
                    />
                    {asset.assignedTo.lastName} {asset.assignedTo.firstName}
                  </Link>
                ) : null}

                <Badge tone={assetStatusTone[asset.status]}>{assetStatusLabels[asset.status]}</Badge>

                <div className="w-full sm:w-auto">
                  <AssetRowControls
                    assetId={asset.id}
                    assignedToId={asset.assignedTo?.id ?? null}
                    status={asset.status}
                    employees={employees}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card>
        <CardHeader title="Додати майно" />
        <Divider />
        <CreateAssetForm />
      </Card>
    </div>
  );
}
