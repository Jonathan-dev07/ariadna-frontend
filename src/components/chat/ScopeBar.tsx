"use client";

import { cn } from "@/lib/format";
import type { ProjectSources, QueryScope } from "@/lib/types";

interface Props {
  sources: ProjectSources | null;
  scope: QueryScope;
  onChange: (scope: QueryScope) => void;
}

/**
 * Dónde buscar la respuesta. El RAG acepta un solo alcance por pregunta:
 * todo el proyecto, algunas ramas, un documento o un commit.
 */
export function ScopeBar({ sources, scope, onChange }: Props) {
  const repos = sources?.repositories ?? [];
  const docs = sources?.documents ?? [];
  const branches = repos.flatMap((r) => r.branches.map((b) => ({ ...b, repo: r.name })));
  const commits = repos.flatMap((r) => r.commits.map((c) => ({ ...c, repo: r.name })));
  if (!branches.length && !docs.length && !commits.length) return null;

  const options: { type: QueryScope["type"]; label: string; available: boolean }[] = [
    { type: "project", label: "Todo el proyecto", available: true },
    { type: "branches", label: "Ramas", available: branches.length > 0 },
    { type: "document", label: "Un documento", available: docs.length > 0 },
    { type: "commit", label: "Un commit", available: commits.length > 0 },
  ];

  function pick(type: QueryScope["type"]) {
    if (type === "project") onChange({ type });
    if (type === "branches") onChange({ type, branches: [] });
    if (type === "document") onChange({ type, document: docs[0]?.name ?? "" });
    if (type === "commit") onChange({ type, commit: commits[0]?.sha ?? "", repository: commits[0]?.repo });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Buscar en">
        <span className="mr-1 text-sm text-muted">Buscar en</span>
        {options
          .filter((o) => o.available)
          .map((o) => (
            <button
              key={o.type}
              role="radio"
              aria-checked={scope.type === o.type}
              onClick={() => pick(o.type)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                scope.type === o.type
                  ? "border-ink bg-ink font-semibold text-white"
                  : "border-line-strong bg-white text-text hover:border-accent"
              )}
            >
              {o.label}
            </button>
          ))}
      </div>

      {scope.type === "branches" && (
        <div className="flex flex-wrap gap-1.5">
          {branches.map((b) => {
            const checked = scope.branches.includes(b.name);
            return (
              <label
                key={`${b.repo}:${b.name}`}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[13px]",
                  checked ? "border-accent bg-accent/10 text-ink" : "border-line bg-white text-muted"
                )}
              >
                <input
                  type="checkbox"
                  className="accent-[var(--color-accent)]"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      type: "branches",
                      branches: checked ? scope.branches.filter((x) => x !== b.name) : [...scope.branches, b.name],
                    })
                  }
                />
                {b.name}
                {repos.length > 1 && <span className="text-faint">· {b.repo}</span>}
              </label>
            );
          })}
          {!scope.branches.length && <span className="self-center text-sm text-gold">Marca al menos una rama.</span>}
        </div>
      )}

      {scope.type === "document" && (
        <select
          className="input max-w-md text-sm"
          value={scope.document}
          onChange={(e) => onChange({ type: "document", document: e.target.value })}
          aria-label="Documento"
        >
          {docs.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      )}

      {scope.type === "commit" && (
        <select
          className="input max-w-xl font-mono text-[13px]"
          value={`${scope.repository ?? ""}|${scope.commit}`}
          onChange={(e) => {
            const [repository, commit] = e.target.value.split("|");
            onChange({ type: "commit", commit, repository: repos.length > 1 ? repository : undefined });
          }}
          aria-label="Commit"
        >
          {commits.map((c) => (
            <option key={`${c.repo}|${c.sha}`} value={`${c.repo}|${c.sha}`}>
              {c.sha.slice(0, 7)} — {(c.message ?? "").slice(0, 60)}
              {repos.length > 1 ? ` (${c.repo})` : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
