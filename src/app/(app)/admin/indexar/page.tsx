"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Page } from "@/components/AppShell";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, PageHeader, SuccessNote } from "@/components/ui/Feedback";
import { useProjects } from "@/context/ProjectProvider";
import { useToast } from "@/context/ToastProvider";
import { useElapsed } from "@/hooks/useElapsed";
import { ingestApi } from "@/lib/api";
import { cn, formatBytes, formatDate, formatElapsed, normalizeRepoUrl } from "@/lib/format";
import type { Commit } from "@/lib/types";

type Tab = "repo" | "commits" | "docs";
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "repo", label: "Repositorio", hint: "Indexa el código de una o varias ramas." },
  { id: "commits", label: "Commits", hint: "Indexa los cambios de commits puntuales (máximo 10)." },
  { id: "docs", label: "Documentos", hint: "Sube PDF, Word, Excel, Markdown u otros archivos." },
];

export default function IndexPage() {
  const { selectedId, selected } = useProjects();
  const [tab, setTab] = useState<Tab>("repo");

  return (
    <Page>
      <PageHeader
        title="Indexar contenido"
        description="Lo que indexes aquí queda disponible para que cualquier usuario haga preguntas en el proyecto."
      />
      <ProjectPicker className="mb-6 max-w-md" label="Proyecto de destino" />

      {!selectedId ? (
        <EmptyState title="Elige el proyecto donde se guardará el contenido">
          Si todavía no existe, créalo primero en Proyectos.
        </EmptyState>
      ) : (
        <>
          <div role="tablist" aria-label="Tipo de contenido" className="mb-0 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px border-b-[3px] px-4 py-2.5 font-semibold transition-colors",
                  tab === t.id ? "border-seal text-ink" : "border-transparent text-muted hover:text-ink"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="rounded-b-xl border border-t-0 border-line bg-panel p-5">
            <p className="mb-5 text-muted">
              {TABS.find((t) => t.id === tab)?.hint} Destino: <strong className="text-ink">{selected?.name}</strong>
            </p>
            {/* key: al cambiar de proyecto se reinicia el formulario */}
            {tab === "repo" && <RepoForm key={selectedId} projectId={selectedId} />}
            {tab === "commits" && <CommitsForm key={selectedId} projectId={selectedId} />}
            {tab === "docs" && <DocsForm key={selectedId} projectId={selectedId} />}
          </div>
        </>
      )}
    </Page>
  );
}

/** Aviso mientras corre una ingesta: el back espera al RAG hasta 2–3 minutos. */
function Working({ running, label }: { running: boolean; label: string }) {
  const elapsed = useElapsed(running);
  if (!running) return null;
  return (
    <p className="text-sm text-muted" aria-live="polite">
      {label} {formatElapsed(elapsed)} — puede tardar hasta 3 minutos, no cierres la página.
    </p>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="mb-2 font-semibold text-ink">{title}</p>
        {children}
      </div>
    </div>
  );
}

function RepoForm({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { markActivitySeen } = useProjects();
  const [url, setUrl] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [repoName, setRepoName] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReactNode>(null);

  async function fetchBranches() {
    const clean = normalizeRepoUrl(url);
    if (!clean) return;
    setUrl(clean);
    setError(null);
    setDone(null);
    setFetching(true);
    try {
      const res = await ingestApi.branches(clean);
      const names = res.branches.map((b) => b.name);
      setBranches(names);
      setRepoName(res.repository);
      setChecked(res.default_branch && names.includes(res.default_branch) ? [res.default_branch] : names.slice(0, 1));
    } catch (e) {
      setBranches([]);
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }

  async function ingest() {
    setError(null);
    setIngesting(true);
    try {
      const res = await ingestApi.repository(projectId, normalizeRepoUrl(url), checked);
      markActivitySeen();
      toast(`Repositorio indexado: ${res.total_chunks ?? 0} fragmentos.`);
      setDone(
        <>
          <p className="font-semibold">
            Listo: {res.total_files ?? 0} archivos y {res.total_chunks ?? 0} fragmentos indexados.
          </p>
          <ul className="mt-1 font-mono text-[13px] text-muted">
            {(res.branches ?? []).map((b) => (
              <li key={b.name}>
                {b.name}: {b.files_processed} archivos, {b.chunks_created} fragmentos
              </li>
            ))}
          </ul>
        </>
      );
      setUrl("");
      setBranches([]);
      setChecked([]);
      setRepoName(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Step n={1} title="Pega la URL del repositorio">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input font-mono text-[14px]"
            placeholder="https://github.com/usuario/repositorio"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchBranches()}
            aria-label="URL del repositorio"
            disabled={ingesting}
          />
          <Button onClick={fetchBranches} loading={fetching} disabled={!url.trim() || ingesting}>
            Buscar ramas
          </Button>
        </div>
      </Step>

      {branches.length > 0 && (
        <Step n={2} title={`Elige las ramas de ${repoName ?? "este repositorio"}`}>
          <div className="flex flex-wrap gap-1.5">
            {branches.map((b) => {
              const on = checked.includes(b);
              return (
                <label
                  key={b}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[13px]",
                    on ? "border-accent bg-accent/10 text-ink" : "border-line bg-white text-muted"
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-[var(--color-accent)]"
                    checked={on}
                    disabled={ingesting}
                    onChange={() => setChecked(on ? checked.filter((x) => x !== b) : [...checked, b])}
                  />
                  {b}
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={ingest} loading={ingesting} disabled={!checked.length}>
              Indexar {checked.length === 1 ? "1 rama" : `${checked.length} ramas`}
            </Button>
            <Working running={ingesting} label="Clonando e indexando…" />
          </div>
        </Step>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {done && <SuccessNote>{done}</SuccessNote>}
    </div>
  );
}

function CommitsForm({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { markActivitySeen } = useProjects();
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReactNode>(null);
  const MAX = 10;

  async function fetchCommits() {
    const clean = normalizeRepoUrl(url);
    if (!clean) return;
    setUrl(clean);
    setError(null);
    setDone(null);
    setFetching(true);
    try {
      const res = await ingestApi.commits(clean, branch.trim() || undefined, 30);
      setCommits(res.commits);
      setChecked([]);
      if (!branch && res.branch) setBranch(res.branch);
    } catch (e) {
      setCommits([]);
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }

  async function ingest() {
    setError(null);
    setIngesting(true);
    try {
      const res = await ingestApi.ingestCommits(projectId, normalizeRepoUrl(url), checked);
      markActivitySeen();
      toast(`Commits indexados: ${res.total_chunks} fragmentos.`);
      setDone(
        <>
          <p className="font-semibold">
            Listo: {res.total_files} archivos y {res.total_chunks} fragmentos indexados.
          </p>
          <ul className="mt-1 font-mono text-[13px] text-muted">
            {res.commits.map((c) => (
              <li key={c.sha}>
                {c.sha.slice(0, 7)}: {c.files_processed} archivos, {c.chunks_created} fragmentos
              </li>
            ))}
          </ul>
        </>
      );
      setCommits([]);
      setChecked([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Step n={1} title="Indica el repositorio y, si quieres, la rama">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <input
            className="input font-mono text-[14px]"
            placeholder="https://github.com/usuario/repositorio"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-label="URL del repositorio"
            disabled={ingesting}
          />
          <input
            className="input font-mono text-[14px]"
            placeholder="rama (opcional)"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="Rama"
            disabled={ingesting}
          />
          <Button onClick={fetchCommits} loading={fetching} disabled={!url.trim() || ingesting}>
            Ver commits
          </Button>
        </div>
      </Step>

      {commits.length > 0 && (
        <Step n={2} title={`Marca hasta ${MAX} commits`}>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-white">
            {commits.map((c) => {
              const on = checked.includes(c.sha);
              const full = !on && checked.length >= MAX;
              return (
                <li key={c.sha}>
                  <label className={cn("flex cursor-pointer items-start gap-3 px-3 py-2", full && "cursor-not-allowed opacity-50", on && "bg-accent/[.06]")}>
                    <input
                      type="checkbox"
                      className="mt-1 accent-[var(--color-accent)]"
                      checked={on}
                      disabled={full || ingesting}
                      onChange={() => setChecked(on ? checked.filter((x) => x !== c.sha) : [...checked, c.sha])}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.message}</span>
                      <span className="font-mono text-xs text-muted">
                        {c.sha.slice(0, 7)} · {formatDate(c.authored_at)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={ingest} loading={ingesting} disabled={!checked.length}>
              Indexar {checked.length === 1 ? "1 commit" : `${checked.length} commits`}
            </Button>
            <span className="text-sm text-muted">
              {checked.length}/{MAX} seleccionados
            </span>
            <Working running={ingesting} label="Clonando el historial e indexando…" />
          </div>
        </Step>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {done && <SuccessNote>{done}</SuccessNote>}
    </div>
  );
}

function DocsForm({ projectId }: { projectId: string }) {
  const toast = useToast();
  const { markActivitySeen } = useProjects();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReactNode>(null);
  const picker = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list) return;
    setDone(null);
    setFiles((cur) => {
      const names = new Set(cur.map((f) => f.name));
      return [...cur, ...Array.from(list).filter((f) => !names.has(f.name))];
    });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    add(e.dataTransfer.files);
  }

  async function upload() {
    setError(null);
    setBusy(true);
    try {
      const res = await ingestApi.documents(projectId, files);
      markActivitySeen();
      toast(`Documentos indexados: ${res.total_chunks ?? 0} fragmentos.`);
      setDone(
        <>
          <p className="font-semibold">Listo: {res.total_chunks ?? 0} fragmentos indexados.</p>
          <ul className="mt-1 text-[14px] text-muted">
            {(res.documents ?? []).map((d) => (
              <li key={d.name}>
                {d.name}: {d.chunks_created} fragmentos{d.artifact_type ? ` (${d.artifact_type})` : ""}
              </li>
            ))}
          </ul>
        </>
      );
      setFiles([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-accent bg-accent/[.06]" : "border-line-strong bg-panel-2"
        )}
      >
        <p className="text-ink">Arrastra los archivos aquí</p>
        <p className="my-2 text-sm text-muted">o</p>
        <Button onClick={() => picker.current?.click()} disabled={busy}>
          Elegir archivos
        </Button>
        <input ref={picker} type="file" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
      </div>

      {files.length > 0 && (
        <div>
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {files.map((f) => (
              <li key={f.name} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-sm text-muted">{formatBytes(f.size)}</span>
                <button
                  onClick={() => setFiles(files.filter((x) => x !== f))}
                  disabled={busy}
                  className="rounded px-1.5 text-muted hover:text-danger"
                  aria-label={`Quitar ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={upload} loading={busy}>
              Subir e indexar {files.length === 1 ? "1 archivo" : `${files.length} archivos`}
            </Button>
            <span className="text-sm text-muted">{formatBytes(total)} en total</span>
            <Working running={busy} label="Indexando…" />
          </div>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
      {done && <SuccessNote>{done}</SuccessNote>}
    </div>
  );
}
