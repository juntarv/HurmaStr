import {
  Armchair,
  Bandage,
  Book,
  Building2,
  Calendar,
  Cpu,
  Crown,
  Gift,
  Headset,
  HeartPulse,
  House,
  IdCard,
  Laptop,
  Monitor,
  Mouse,
  Package,
  Palette,
  Palmtree,
  Plane,
  Smartphone,
  Sprout,
  Star,
  Tablet,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AssetCategory } from "@/generated/prisma/enums";

/** Ключ іконки з LeaveType.icon → компонент. */
const leaveIcons: Record<string, LucideIcon> = {
  palm: Palmtree,
  heart: HeartPulse,
  bandage: Bandage,
  home: House,
  plane: Plane,
  book: Book,
  calendar: Calendar,
};

export const LEAVE_ICON_KEYS = Object.keys(leaveIcons);

/**
 * colorHex приходить із довідника, який редагує HR.
 * Рендеримо його інлайн-стилем, тому пропускаємо лише справжній hex —
 * інакше в style можна було б протягнути сторонній CSS.
 */
export function safeColor(value: string | null | undefined, fallback = "#64748B"): string {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

export function LeaveTypeIcon({
  icon,
  color,
  className = "size-4",
}: {
  icon: string;
  color?: string | null;
  className?: string;
}) {
  const Icon = leaveIcons[icon] ?? Calendar;
  return <Icon className={className} style={{ color: safeColor(color) }} aria-hidden />;
}

const assetIcons: Record<AssetCategory, LucideIcon> = {
  LAPTOP: Laptop,
  MONITOR: Monitor,
  PHONE: Smartphone,
  TABLET: Tablet,
  PERIPHERAL: Mouse,
  FURNITURE: Armchair,
  ACCESS_CARD: IdCard,
  OTHER: Package,
};

export function AssetCategoryIcon({
  category,
  className = "size-4",
}: {
  category: AssetCategory;
  className?: string;
}) {
  const Icon = assetIcons[category] ?? Package;
  return <Icon className={className} aria-hidden />;
}

const departmentIcons: Record<string, LucideIcon> = {
  crown: Crown,
  smartphone: Smartphone,
  palette: Palette,
  headset: Headset,
  cpu: Cpu,
  sprout: Sprout,
  wallet: Wallet,
  users: Users,
  building: Building2,
};

export function DepartmentIcon({
  icon,
  className = "size-4",
}: {
  icon: string;
  className?: string;
}) {
  const Icon = departmentIcons[icon] ?? Building2;
  return <Icon className={className} aria-hidden />;
}

/** Іконка особистої події: день народження або річниця роботи. */
export function EventIcon({
  kind,
  className = "size-4",
}: {
  kind: "birthday" | "anniversary";
  className?: string;
}) {
  return kind === "birthday" ? (
    <Gift className={className} style={{ color: "#DB2777" }} aria-hidden />
  ) : (
    <Star className={className} style={{ color: "#2563EB" }} aria-hidden />
  );
}
