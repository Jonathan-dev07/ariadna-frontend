"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Markdown, SourceList, AnswerMeta } from "@/components/chat/Answer";
import { Page } from "@/components/AppShell";
import { RouteView } from "@/components/chat/RouteView";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorNote, PageHeader } from "@/components/ui/Feedback";
import { useProjects } from "@/context/ProjectProvider";
import { useProjectSources } from "@/hooks/useProjectSources";
import { useElapsed } from "@/hooks/useElapsed";
import { chatApi } from "@/lib/api";
import { rememberTitle } from "@/lib/conversationTitles";
import { formatElapsed, githubSlug, normalizeRepoUrl } from "@/lib/format";
import type { CompareResponse } from "@/lib/types";
import type { TraceEntry } from "@/lib/tracing";

const DEFAULT_QUESTION = "¿Qué diferencias relevantes existen entre estas dos ramas?";

const STATUS: Record<string, { label: string; tone: "ok" | "fail" | "gold" | "accent" }> = {
  A: { label: "Agregado", tone: "ok" },
  added: { label: "Agregado", tone: "ok" },
  M: { label: "Modificado", tone: "accent" },
  modified: { label: "Modificado", tone: "accent" },
  D: { label: "Eliminado", tone: "fail" },
  deleted: { label: "Eliminado", tone: "fail" },
  R: { label: "Renombrado", tone: "gold" },
  renamed: { label: "Renombrado", tone: "gold" },
};

export default function ComparePage() {
  const { selectedId } = useProjects();
  const { sources } = useProjectSources(selectedId);
  const repos = useMemo(() => sources?.repositories ?? [], [sources]);

  const [repoUrl, setRepoUrl] = useState("");
  const [branchA, setBranchA] = useState("");
  const [branchB, setBranchB] = useState("");
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [result, setResult] = useState<(CompareResponse & { trace?: TraceEntry | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const elapsed = useElapsed(busy);

  // Sugerencias a partir de lo indexado: el back pide la URL del repo y dos ramas.
  const repo = repos.find((r) => normalizeRepoUrl(r.name) === normalizeRepoUrl(repoUrl) || r.name === repoUrl) ?? repos[0];
  const branchNames = repo?.branches.map((b) => b.name) ?? [];

  useEffect(() => {
    setResult(null);
    setError(null);
    const first = repos[0];
    if (!first) return setRepoUrl("");
    const slug = githubSlug(first.name);
    setRepoUrl(slug ? `https://github.com/${slug}` : first.name);
    setBranchA(first.branches[0]?.name ?? "");
    setBranchB(first.branches[1]?.name ?? "");
  }, [repos]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    if (branchA.trim() === branchB.trim()) return setError("Elige dos ramas distintas.");
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await chatApi.compare({
        project_id: selectedId,
        repository_url: normalizeRepoUrl(repoUrl),
        branch_a: branchA.trim(),
        branch_b: branchB.trim(),
        question: question.trim() || DEFAULT_QUESTION,
      });
      rememberTitle(res.conversation_id, `Comparar ${res.branch_a} y ${res.branch_b}`);
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageHeader
        title="Comparar ramas"
        description="Revisa qué archivos cambian entre dos ramas y pide una explicación de las diferencias. La comparación queda guardada en tus conversaciones."
      />

      <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-line bg-panel p-5">
        <ProjectPicker className="max-w-md" />
        {selectedId && (
          <>
            <div>
              <label htmlFor="repo" className="label">
                URL del repositorio
              </label>
              <input
                id="repo"
                className="input font-mono text-[14px]"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/usuario/repositorio"
                list="repo-options"
                required
              />
              <datalist id="repo-options">
                {repos.map((r) => (
                  <option key={r.name} value={githubSlug(r.name) ? `https://github.com/${githubSlug(r.name)}` : r.name} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <BranchField id="a" label="Rama base" value={branchA} onChange={setBranchA} options={branchNames} />
              <BranchField id="b" label="Rama a comparar" value={branchB} onChange={setBranchB} options={branchNames} />
            </div>
            <div>
              <label htmlFor="q" className="label">
                Qué quieres saber
              </label>
              <textarea id="q" rows={2} className="input resize-y" value={question} onChange={(e) => setQuestion(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="primary" loading={busy} disabled={!repoUrl.trim() || !branchA.trim() || !branchB.trim()}>
                Comparar
              </Button>
              {busy && <span className="text-sm text-muted">Clonando y comparando… {formatElapsed(elapsed)}</span>}
            </div>
          </>
        )}
      </form>

      {error && <ErrorNote className="mt-5">{error}</ErrorNote>}

      {!selectedId && <EmptyState title="Elige un proyecto">La comparación usa el repositorio indexado en ese proyecto.</EmptyState>}

      {result && (
        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <h2 className="mb-3 text-xl font-bold">
              <span className="font-mono text-[17px]">{result.branch_a}</span> frente a{" "}
              <span className="font-mono text-[17px]">{result.branch_b}</span>
            </h2>
            <Markdown text={result.answer} />
            <SourceList sources={result.sources} />
            <AnswerMeta model={result.model} ms={result.response_time_ms} chunks={result.context_chunks_used} />
            {result.trace && <RouteView trace={result.trace} />}
          </div>
          <aside>
            <h3 className="mb-2 text-base font-bold">
              {result.changes.length} {result.changes.length === 1 ? "archivo cambiado" : "archivos cambiados"}
            </h3>
            {result.changes.length ? (
              <ul className="divide-y divide-line rounded-lg border border-line bg-white">
                {result.changes.map((c, i) => {
                  const st = STATUS[c.status ?? ""] ?? { label: c.status ?? "—", tone: "accent" as const };
                  return (
                    <li key={i} className="px-3 py-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <p className="mt-1 font-mono text-[12.5px] break-all text-ink">{c.path}</p>
                      {c.previous_path && <p className="font-mono text-xs break-all text-faint">antes: {c.previous_path}</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No hay archivos distintos entre las dos ramas.</p>
            )}
          </aside>
        </section>
      )}
    </Page>
  );
}

function BranchField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label htmlFor={`branch-${id}`} className="label">
        {label}
      </label>
      <input
        id={`branch-${id}`}
        className="input font-mono text-[14px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={`branches-${id}`}
        placeholder="main"
        required
      />
      <datalist id={`branches-${id}`}>
        {options.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </div>
  );
}
