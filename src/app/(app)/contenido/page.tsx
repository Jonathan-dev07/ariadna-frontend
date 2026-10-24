"use client";

import { useEffect, useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { ProjectPicker } from "@/components/ProjectPicker";
import { EmptyState, ErrorNote, Loading, PageHeader } from "@/components/ui/Feedback";
import { useProjects } from "@/context/ProjectProvider";
import { useProjectSources } from "@/hooks/useProjectSources";
import { projectsApi } from "@/lib/api";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { ProjectFile } from "@/lib/types";

/** Qué se puede consultar en un proyecto: repos, ramas, commits y archivos subidos. */
export default function ContentPage() {
  const { selectedId, selected } = useProjects();
  const { sources, loading: srcLoading, error: srcError } = useProjectSources(selectedId);
  const [files, setFiles] = useState<ProjectFile[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [ext, setExt] = useState("");

  useEffect(() => {
    setFiles(null);
    setExt("");
    if (!selectedId) return;
    projectsApi
      .files(selectedId)
      .then((f) => {
        setFiles(f);
        setFilesError(null);
      })
      .catch((e) => setFilesError((e as Error).message));
  }, [selectedId]);

  const exts = useMemo(() => Array.from(new Set((files ?? []).map((f) => f.extension).filter(Boolean))).sort(), [files]);
  const shown = ext ? (files ?? []).filter((f) => f.extension === ext) : files ?? [];

  return (
    <Page>
      <PageHeader
        title="Contenido del proyecto"
        description="Todo lo que está indexado y se puede consultar: repositorios con sus ramas y commits, y documentos subidos."
      />
      <ProjectPicker className="mb-8 max-w-md" />

      {!selectedId ? (
        <EmptyState title="Elige un proyecto para ver su contenido" />
      ) : (
        <div className="space-y-10">
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold">Repositorios</h2>
              {sources && <span className="text-sm text-muted">{sources.total_chunks.toLocaleString("es-GT")} fragmentos indexados en total</span>}
            </div>
            {srcLoading ? (
              <Loading />
            ) : srcError ? (
              <ErrorNote>No se pudo consultar el índice: {srcError}</ErrorNote>
            ) : !sources?.repositories.length ? (
              <p className="text-muted">No hay repositorios indexados en {selected?.name ?? "este proyecto"}.</p>
            ) : (
              <div className="space-y-4">
                {sources.repositories.map((r) => (
                  <div key={r.name} className="rounded-xl border border-line bg-panel p-4">
                    <p className="font-mono text-[15px] font-medium break-all text-ink">{r.name}</p>
                    <p className="text-sm text-muted">{r.chunks.toLocaleString("es-GT")} fragmentos</p>
                    {r.branches.length > 0 && (
                      <>
                        <h3 className="mt-4 mb-1.5 font-sans text-sm font-semibold text-muted">Ramas</h3>
                        <ul className="flex flex-wrap gap-1.5">
                          {r.branches.map((b) => (
                            <li key={b.name} className="rounded-md border border-line bg-panel-2 px-2.5 py-1 font-mono text-[13px]">
                              {b.name}
                              {b.commit && <span className="text-faint"> @ {b.commit.slice(0, 7)}</span>}
                              <span className="text-faint"> · {b.chunks}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {r.commits.length > 0 && (
                      <>
                        <h3 className="mt-4 mb-1.5 font-sans text-sm font-semibold text-muted">Commits indexados</h3>
                        <ul className="space-y-1 text-sm">
                          {r.commits.map((c) => (
                            <li key={c.sha} className="flex gap-2">
                              <span className="font-mono text-accent">{c.sha.slice(0, 7)}</span>
                              <span className="truncate">{c.message}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Documentos {files && files.length > 0 && <span className="font-sans text-base font-normal text-muted">({files.length})</span>}</h2>
              {exts.length > 1 && (
                <select className="input w-auto text-sm" value={ext} onChange={(e) => setExt(e.target.value)} aria-label="Filtrar por tipo">
                  <option value="">Todos los tipos</option>
                  {exts.map((x) => (
                    <option key={x} value={x}>
                      .{x}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {filesError ? (
              <ErrorNote>{filesError}</ErrorNote>
            ) : files === null ? (
              <Loading />
            ) : !shown.length ? (
              <p className="text-muted">No hay documentos subidos en este proyecto.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full min-w-[560px] text-[15px]">
                  <thead className="bg-panel-2 text-left text-sm text-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Archivo</th>
                      <th className="px-4 py-2.5 font-semibold">Tamaño</th>
                      <th className="px-4 py-2.5 font-semibold">Versión</th>
                      <th className="px-4 py-2.5 font-semibold">Subido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shown.map((f) => (
                      <tr key={f.filename}>
                        <td className="px-4 py-2.5">
                          <span className="mr-2 rounded bg-accent/10 px-1.5 py-0.5 font-mono text-xs text-accent">{f.extension || "—"}</span>
                          <span className="break-all">{f.filename}</span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatBytes(f.size_bytes)}</td>
                        <td className="px-4 py-2.5 text-muted">v{f.version}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDateTime(f.uploaded_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
