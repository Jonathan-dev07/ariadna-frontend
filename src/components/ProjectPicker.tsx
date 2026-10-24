"use client";

import { useId } from "react";
import { useProjects } from "@/context/ProjectProvider";
import { cn } from "@/lib/format";

/** Selector del proyecto activo; es el mismo en todas las pantallas. */
export function ProjectPicker({ className, label = "Proyecto" }: { className?: string; label?: string }) {
  const { projects, selectedId, select, loading, error, reload } = useProjects();
  const id = useId();

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex gap-1.5">
        <select
          id={id}
          className="input font-semibold text-ink"
          value={selectedId ?? ""}
          onChange={(e) => select(e.target.value || null)}
          disabled={loading && !projects.length}
        >
          <option value="">{loading && !projects.length ? "Cargando proyectos…" : "Elige un proyecto"}</option>
          {projects.map((p) => (
            <option key={p.project_id} value={p.project_id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => reload()}
          className="shrink-0 rounded-lg border border-line-strong bg-white px-3 text-muted hover:border-accent hover:text-accent"
          title="Actualizar lista de proyectos"
          aria-label="Actualizar lista de proyectos"
        >
          ↻
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-danger">No se pudieron cargar los proyectos: {error}</p>}
      {!loading && !error && !projects.length && (
        <p className="mt-1 text-sm text-muted">Todavía no hay proyectos. Un administrador debe crear el primero.</p>
      )}
    </div>
  );
}
