"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

type ToastKind = "ok" | "err" | "info";
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "ok") => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 7000 : 4500);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "err" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg bg-ink px-4 py-2.5 text-[15px] text-white shadow-lg",
              "animate-[toast-in_.18s_ease-out]"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-[7px] size-2 shrink-0 rounded-full",
                t.kind === "err" ? "bg-[#ff8a8a]" : t.kind === "info" ? "bg-[#e3c27a]" : "bg-[#5bd6a0]"
              )}
            />
            <span>{t.message}</span>
            <button
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="-mr-1 ml-1 rounded px-1 text-white/60 hover:text-white"
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
