import { cn } from "@/lib/utils";

/**
 * Знак у стилістиці Sator — квадратна «S»-дужка з амбер-градієнтом.
 * Векторний, тож масштабується без втрат і працює в обох темах.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="90 95 296 296" className={className} role="img" aria-label="HurmaStr">
      <defs>
        <linearGradient id="hurmaLogoGrad" x1="100" y1="105" x2="376" y2="378" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-accent-from)" />
          <stop offset="1" stopColor="var(--color-accent-to)" />
        </linearGradient>
      </defs>
      <g fill="url(#hurmaLogoGrad)">
        <path d="M100,253.1V111.7c0-5.3,4.3-9.6,9.6-9.6h187.9l-32.9,46h-118.6l-.2,68.9h30.2l-21.6,45.8h-44.8c-5.3,0-9.6-4.3-9.6-9.6Z" />
        <path d="M375.8,226.9v141.5c0,5.3-4.3,9.6-9.6,9.6h-187.9s32.9-46,32.9-46h118.6s.2-68.9.2-68.9h-30.2s21.6-45.8,21.6-45.8h44.8c5.3,0,9.6,4.3,9.6,9.6Z" />
        <polygon points="351.8 126.1 246.9 252.9 123.9 354 228.9 227.2 351.8 126.1" />
        <polygon points="296.3 296.4 236.2 256.5 179.5 183.6 239.6 223.5 296.3 296.4" />
      </g>
    </svg>
  );
}

/** Знак у кольоровій плашці — для сайдбару та екрана входу. */
export function LogoBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-[#2a2a2e] to-[#111114] p-1.5",
        className,
      )}
    >
      <LogoMark className="size-full" />
    </span>
  );
}
