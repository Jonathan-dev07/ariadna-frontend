"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { projectsApi, systemApi } from "@/lib/api";
import { session } from "@/lib/session";
import type { ActivityEvent, Project } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  selected: Project | null;
  select: (id: string | null) => void;
  reload: () => Promise<void>;
  /** Llamarlo después de una acción propia, para no recibir el aviso de lo que uno mismo hizo */
  markActivitySeen: () => void;
}

const ProjectContext = createContext<ProjectState | null>(null);

export function useProjects() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects debe usarse dentro de <ProjectProvider>");
  return ctx;
}

const POLL_MS = 20_000;

function activityLabel(e: ActivityEvent) {
  // Un usuario normal recibe el evento sin detalle (el back oculta proyecto y fuente).
  if (!e.project_name) {
    return e.type === "project_created" ? "Se creó un proyecto nuevo." : "Se cargó contenido nuevo en un proyecto.";
  }
  switch (e.type) {
    case "project_created":
      return `Nuevo proyecto: ${e.project_name}`;
    case "repository":
      return `Repositorio indexado en "${e.project_name}"`;
    case "commit":
      return `Commits indexados en "${e.project_name}"`;
    default:
      return `Documento indexado en "${e.project_name}"`;
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => session.getProject());
  const lastCheck = useRef(new Date().toISOString());

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.list();
      setProjects(data);
      setError(null);
      // Si el proyecto elegido ya no existe (lo borró un admin), se deselecciona.
      setSelectedId((cur) => (cur && !data.some((p) => p.project_id === cur) ? null : cur));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  useEffect(() => {
    session.setProject(selectedId);
  }, [selectedId]);

  // Sondeo de actividad (no hay websockets en el back): avisa de proyectos o contenido nuevo.
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const events = await systemApi.activity(lastCheck.current);
        lastCheck.current = new Date().toISOString();
        events.forEach((e) => toast(activityLabel(e), "info"));
        if (events.some((e) => e.type === "project_created")) reload();
      } catch {
        /* un sondeo fallido no debe molestar al usuario */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [user, reload, toast]);

  const value = useMemo<ProjectState>(
    () => ({
      projects,
      loading,
      error,
      selectedId,
      selected: projects.find((p) => p.project_id === selectedId) ?? null,
      select: setSelectedId,
      reload,
      markActivitySeen: () => {
        lastCheck.current = new Date().toISOString();
      },
    }),
    [projects, loading, error, selectedId, reload]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
