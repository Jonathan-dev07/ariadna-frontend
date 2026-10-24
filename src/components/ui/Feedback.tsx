import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Spinner } from "./Spinner";

/** Pantalla vacía: dice qué falta y qué hacer, no solo "no hay nada". */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <p className="font-serif text-lg font-semibold text-ink">{title}</p>
      {children && <div className="mt-1.5 text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-lg border border-danger/50 bg-danger/[.06] px-3.5 py-2.5 text-[15px] text-danger", className)}>
      {children}
    </div>
  );
}

export function SuccessNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={cn("rounded-lg border border-success/40 bg-success/[.07] px-3.5 py-2.5 text-[15px] text-text", className)}>
      {children}
    </div>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-6 text-muted">
      <Spinner className="size-4" />
      {label}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "fail" | "gold" | "accent"; children: ReactNode }) {
  const tones = {
    neutral: "bg-line/60 text-muted",
    ok: "bg-success/12 text-success",
    fail: "bg-danger/10 text-danger",
    gold: "bg-gold/15 text-[#7d5f20]",
    accent: "bg-accent/12 text-accent",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
