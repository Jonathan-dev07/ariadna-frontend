import { cn } from "@/lib/format";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-5 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullPageSpinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center gap-3 text-muted">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
