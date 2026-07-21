"use client";

import { usePathname } from "next/navigation";

/**
 * Делікатна поява контенту при зміні маршруту.
 * key за шляхом змушує React перемонтувати обгортку — і анімація
 * `animate-page` програється щоразу при навігації.
 */
export function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page">
      {children}
    </div>
  );
}
