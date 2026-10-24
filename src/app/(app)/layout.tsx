"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { FullPageSpinner } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthProvider";
import { ProjectProvider } from "@/context/ProjectProvider";

/** Todas las pantallas dentro de (app) requieren sesión. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login/");
  }, [ready, user, router]);

  if (!ready || !user) return <FullPageSpinner />;

  return (
    <ProjectProvider>
      <AppShell>{children}</AppShell>
    </ProjectProvider>
  );
}
