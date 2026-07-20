import { LogoBadge } from "@/components/logo";
import { ui } from "@/lib/labels";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <LogoBadge className="size-12" />
          <div className="text-center">
            <p className="text-lg font-semibold tracking-tight text-ink">{ui.appName}</p>
            <p className="text-sm text-ink-muted">{ui.appTagline}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
