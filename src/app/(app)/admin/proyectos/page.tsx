"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorNote, Loading, PageHeader } from "@/components/ui/Feedback";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useProjects } from "@/context/ProjectProvider";
import { useToast } from "@/context/ToastProvider";
import { projectsApi } from "@/lib/api";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import type { Ingestion, Project, ProjectFile } from "@/lib/types";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function AdminProjectsPage() {
  const { projects, loading, error, reload, select, selectedId, markActivitySeen } = useProjects();
  const toast = useToast();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "clear"; project: Project } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const sorted = [...projects].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  async function runConfirm() {
    if (!confirm) return;
    const { kind, project } = confirm;
    setConfirmBusy(true);
    try {
      if (kind === "delete") {
        await projectsApi.remove(project.project_id);
        if (selectedId === project.project_id) select(null);
        toast(`Proyecto "${project.name}" eliminado.`);
        await reload();
      } else {
        const res = await projectsApi.clearIndex(project.project_id);
        toast(`Índice de "${project.name}" vaciado: ${res.deleted_chunks} fragmentos eliminados.`);
      }
      setConfirm(null);
    } catch (e) {
      toast(`No se pudo completar: ${(e as Error).message}`, "err");
    } finally {
      setConfirmBusy(false);
    }
  }

  function goIndex(p: Project) {
    select(p.project_id);
    router.push("/admin/indexar/");
  }

  return (
    <Page wide>
      <PageHeader
        title="Proyectos"
        description="Cada proyecto agrupa los repositorios y documentos que se pueden consultar. Todos los usuarios ven la lista; solo los administradores la modifican."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nuevo proyecto
          </Button>
        }
      />

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {loading && !projects.length ? (
        <Loading />
      ) : !projects.length ? (
        <EmptyState title="Todavía no hay proyectos" action={<Button variant="primary" onClick={() => setCreating(true)}>Crear el primero</Button>}>
          Crea un proyecto y luego indexa su repositorio o sus documentos.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sorted.map((p) => (
            <ProjectRow
              key={p.project_id}
              project={p}
              onEdit={() => setEditing(p)}
              onIndex={() => goIndex(p)}
              onClear={() => setConfirm({ kind: "clear", project: p })}
              onDelete={() => setConfirm({ kind: "delete", project: p })}
            />
          ))}
        </ul>
      )}

      <ProjectForm
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={async (p) => {
          markActivitySeen();
          setCreating(false);
          toast(`Proyecto "${p.name}" creado.`);
          await reload();
          select(p.project_id);
        }}
      />
      <ProjectForm
        open={!!editing}
        project={editing}
        onClose={() => setEditing(null)}
        onSaved={async (p) => {
          setEditing(null);
          toast(`Proyecto "${p.name}" actualizado.`);
          await reload();
        }}
      />

      <ConfirmDialog
        open={!!confirm}
        danger
        loading={confirmBusy}
        title={confirm?.kind === "delete" ? "Eliminar proyecto" : "Vaciar índice"}
        confirmLabel={confirm?.kind === "delete" ? "Eliminar proyecto" : "Vaciar índice"}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
        message={
          confirm?.kind === "delete" ? (
            <>
              Se borrará <strong>{confirm.project.name}</strong> del catálogo, junto con su índice, su historial de
              ingestas y sus archivos registrados. Las conversaciones dejarán de tener contexto. No se puede deshacer.
            </>
          ) : (
            <>
              Se borrarán todos los fragmentos indexados de <strong>{confirm?.project.name}</strong>, pero el proyecto
              seguirá existiendo. Úsalo para volver a indexar desde cero.
            </>
          )
        }
      />
    </Page>
  );
}

function ProjectRow({
  project: p,
  onEdit,
  onIndex,
  onClear,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onIndex: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 p-4">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-lg font-semibold text-ink">{p.name}</p>
          <p className="font-mono text-[13px] text-muted">{p.project_id}</p>
          {p.description && <p className="mt-1.5 max-w-2xl text-[15px] text-text">{p.description}</p>}
          <p className="mt-1.5 text-sm text-faint">Creado el {formatDate(p.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={onIndex}>
            Indexar contenido
          </Button>
          <Button size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Ocultar historial" : "Ver historial"}
          </Button>
          <Button size="sm" onClick={onEdit}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear}>
            Vaciar índice
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete}>
            Eliminar
          </Button>
        </div>
      </div>
      {open && <ProjectHistory projectId={p.project_id} />}
    </li>
  );
}

const TYPE_LABEL: Record<string, { label: string; tone: "accent" | "ok" | "gold" }> = {
  document: { label: "Documentos", tone: "accent" },
  repository: { label: "Repositorio", tone: "ok" },
  commit: { label: "Commits", tone: "gold" },
};

function ProjectHistory({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{ ingestions: Ingestion[]; files: ProjectFile[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([projectsApi.ingestions(projectId), projectsApi.files(projectId)])
      .then(([ingestions, files]) => alive && setData({ ingestions, files }))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [projectId]);

  return (
    <div className="border-t border-line bg-panel-2 px-4 py-4">
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : !data ? (
        <Loading />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold text-muted">Ingestas ({data.ingestions.length})</h3>
            {!data.ingestions.length ? (
              <p className="text-sm text-muted">Nada indexado todavía.</p>
            ) : (
              <ul className="space-y-2">
                {data.ingestions.map((ing, i) => {
                  const t = TYPE_LABEL[ing.type] ?? { label: ing.type, tone: "accent" as const };
                  const extra =
                    ing.type === "repository"
                      ? (ing.branches ?? []).join(", ")
                      : ing.type === "commit"
                        ? (ing.commits ?? []).map((s) => s.slice(0, 7)).join(", ")
                        : "";
                  return (
                    <li key={i} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={t.tone}>{t.label}</Badge>
                        <span className="ml-auto text-xs text-faint">{formatDateTime(ing.created_at)}</span>
                      </div>
                      <p className="mt-1 font-mono text-[12.5px] break-all text-ink">{ing.source}</p>
                      <p className="text-muted">
                        {extra && <span className="font-mono">{extra} · </span>}
                        {ing.files_processed ?? "—"} archivos · {ing.chunks_created ?? "—"} fragmentos
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 font-sans text-sm font-semibold text-muted">Documentos registrados ({data.files.length})</h3>
            {!data.files.length ? (
              <p className="text-sm text-muted">Ningún documento subido.</p>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-white text-sm">
                {data.files.map((f) => (
                  <li key={f.filename} className="flex flex-wrap gap-x-3 px-3 py-2">
                    <span className="min-w-0 flex-1 break-all">{f.filename}</span>
                    <span className="text-muted">
                      {formatBytes(f.size_bytes)} · v{f.version}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectForm({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const isEdit = !!project;
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [idTouched, setIdTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Rellena el formulario cada vez que se abre
  const key = open ? project?.project_id ?? "new" : null;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setName(project?.name ?? "");
    setProjectId(project?.project_id ?? "");
    setDescription(project?.description ?? "");
    setIdTouched(false);
    setError(null);
  }

  const suggestedId = idTouched ? projectId : slugify(name);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("El nombre debe tener al menos 2 caracteres.");
    setBusy(true);
    try {
      const saved = isEdit
        ? await projectsApi.update(project!.project_id, { name: name.trim(), description: description.trim() || null })
        : await projectsApi.create({
            name: name.trim(),
            ...(suggestedId ? { project_id: suggestedId } : {}),
            ...(description.trim() ? { description: description.trim() } : {}),
          });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar proyecto" : "Nuevo proyecto"}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="project-form" loading={busy}>
            {isEdit ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div>
          <label htmlFor="p-name" className="label">
            Nombre
          </label>
          <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
        </div>
        <div>
          <label htmlFor="p-id" className="label">
            Identificador
          </label>
          <input
            id="p-id"
            className="input font-mono text-[14px]"
            value={isEdit ? projectId : suggestedId}
            onChange={(e) => {
              setIdTouched(true);
              setProjectId(slugify(e.target.value) || e.target.value.toLowerCase());
            }}
            disabled={isEdit}
            maxLength={80}
          />
          <p className="mt-1 text-sm text-muted">
            {isEdit ? "El identificador no se puede cambiar." : "Se genera a partir del nombre; puedes ajustarlo antes de crear."}
          </p>
        </div>
        <div>
          <label htmlFor="p-desc" className="label">
            Descripción <span className="font-normal text-faint">(opcional)</span>
          </label>
          <textarea
            id="p-desc"
            rows={3}
            className="input resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
      </form>
    </Modal>
  );
}
