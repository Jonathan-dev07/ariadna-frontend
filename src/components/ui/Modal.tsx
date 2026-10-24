"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, description, children, footer, wide }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // Se guarda en un ref para que el efecto corra solo al abrir/cerrar,
  // y no robe el foco cada vez que el padre se vuelve a renderizar.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    // Enfoca el primer campo; si no hay, el panel.
    const first = panel.current?.querySelector<HTMLElement>("input, select, textarea, button[data-autofocus]");
    (first ?? panel.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 sm:items-center sm:p-5"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-t-4 border-accent bg-panel shadow-2xl outline-none sm:rounded-xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-muted">{description}</div>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar" className="-mr-2 text-lg">
            ×
          </Button>
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-panel-2 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Reemplaza al confirm() nativo del navegador. */
export function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading} data-autofocus>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[15px] text-text">{message}</div>
    </Modal>
  );
}
