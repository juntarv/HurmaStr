import { prisma } from "@/lib/prisma";
import type { AssetCategory, AssetStatus } from "@/generated/prisma/enums";

export type AssetFilters = {
  q?: string;
  category?: AssetCategory;
  status?: AssetStatus;
};

const assetSelect = {
  id: true,
  name: true,
  category: true,
  inventoryNumber: true,
  serialNumber: true,
  status: true,
  assignedAt: true,
  purchaseDate: true,
  note: true,
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
} as const;

export async function listAssets(filters: AssetFilters = {}) {
  const query = filters.q?.trim().toLowerCase();

  return prisma.asset.findMany({
    where: {
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { inventoryNumber: { contains: query } },
              { serialNumber: { contains: query } },
            ],
          }
        : {}),
    },
    select: assetSelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function getAssetsForEmployee(employeeId: string) {
  return prisma.asset.findMany({
    where: { assignedToId: employeeId, status: { not: "WRITTEN_OFF" } },
    select: assetSelect,
    orderBy: { name: "asc" },
  });
}

export async function getAssetStats() {
  const grouped = await prisma.asset.groupBy({ by: ["status"], _count: true });
  const count = (status: AssetStatus) =>
    grouped.find((g) => g.status === status)?._count ?? 0;

  return {
    total: grouped.reduce((acc, g) => acc + g._count, 0),
    inUse: count("IN_USE"),
    inStock: count("IN_STOCK"),
    repair: count("REPAIR"),
    writtenOff: count("WRITTEN_OFF"),
  };
}

/** Активні співробітники для випадайки видачі майна. */
export async function getAssignableEmployees() {
  return prisma.employee.findMany({
    where: { isArchived: false, status: { not: "TERMINATED" } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }],
  });
}
