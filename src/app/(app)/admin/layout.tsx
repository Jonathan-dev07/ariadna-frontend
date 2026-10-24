"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Page } from "@/components/AppShell";
import { EmptyState } from "@/components/ui/Feedback";
import { useAuth } from "@/context/AuthProvider";

/** La interfaz oculta estas pantallas; el back además rechaza las llamadas con 403. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <Page>
        <EmptyState
          title="Esta sección es solo para administradores"
          action={
            <Link href="/chat/" className="font-semibold text-accent underline">
              Volver a preguntar
            </Link>
          }
        >
          Si necesitas cargar contenido o crear un proyecto, pídeselo a un administrador.
        </EmptyState>
      </Page>
    );
  }
  return <>{children}</>;
}
