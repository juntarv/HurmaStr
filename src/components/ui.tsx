import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Базові презентаційні компоненти. Без хуків — придатні і для RSC, і для клієнта. */

// ================================ Кнопка =====================================

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover border-transparent",
  secondary: "bg-surface text-ink border-line hover:bg-surface-muted",
  outline: "bg-transparent text-brand border-brand-line hover:bg-brand-soft",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-95 border-transparent",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-medium transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

// ================================ Картка =====================================

export function Card({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("bg-surface border border-line rounded-card shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-5 py-4", className)}>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}

// ================================ Бейдж ======================================

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-soft border-line",
  brand: "bg-brand-soft text-brand border-brand-line",
  success: "bg-success-soft text-success border-success-line",
  warning: "bg-warning-soft text-warning border-warning-line",
  danger: "bg-danger-soft text-danger border-danger-line",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}

// ================================ Аватар =====================================

const avatarPalette = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

/** Стабільний колір за іменем — та сама людина завжди того самого кольору. */
function paletteFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return avatarPalette[hash % avatarPalette.length];
}

const avatarSizes = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
} as const;

export function Avatar({
  firstName,
  lastName,
  avatarUrl,
  size = "md",
  className,
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  const initials = `${lastName.charAt(0)}${firstName.charAt(0)}`.toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- аватари приходять із довільних URL
      <img
        src={avatarUrl}
        alt={`${lastName} ${firstName}`}
        className={cn("rounded-full object-cover", avatarSizes[size], className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0",
        avatarSizes[size],
        paletteFor(lastName + firstName),
        className,
      )}
    >
      {initials}
    </span>
  );
}

// ============================== Порожній стан ================================

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "neutral",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? (
        <div
          className={cn(
            "mb-1 flex size-11 items-center justify-center rounded-full",
            tone === "error" ? "bg-danger-soft text-danger" : "bg-surface-muted text-ink-faint",
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

// ============================ Заголовок сторінки =============================

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

// ============================== Поля форми ===================================

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-soft">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink-faint focus:border-brand focus:outline-none " +
  "disabled:bg-surface-muted disabled:text-ink-muted";

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn(controlClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-20 resize-y", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cn(controlClass, "h-10 pr-8", className)} {...props} />;
}

// ============================== Плитка метрики ===============================

export function StatTile({
  icon,
  value,
  label,
  tone = "neutral",
}: {
  icon?: ReactNode;
  value: ReactNode;
  label: string;
  tone?: Tone;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", toneStyles[tone])}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-lg font-semibold leading-none">{value}</span>
      </div>
      <p className="mt-1 text-xs opacity-80">{label}</p>
    </div>
  );
}

// ================================ Роздільник =================================

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-line", className)} />;
}
