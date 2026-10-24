"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn, formatMs, sourceDetail, sourceLabel, sourceLink } from "@/lib/format";
import type { Source } from "@/lib/types";

/** Respuesta del RAG: markdown (listas, tablas, bloques de código). */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

const VISIBLE = 4;

/** Fuentes citadas: archivo, rama/commit, líneas. Si son de GitHub, abren el archivo en esas líneas. */
export function SourceList({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources.length) return null;
  const sorted = [...sources].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const shown = expanded ? sorted : sorted.slice(0, VISIBLE);

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm font-semibold text-muted">
        {sources.length === 1 ? "1 fuente" : `${sources.length} fuentes`}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {shown.map((s, i) => {
          const href = sourceLink(s);
          const detail = sourceDetail(s);
          const body = (
            <>
              <span className="block truncate font-mono text-[13px] text-ink" title={sourceLabel(s)}>
                {sourceLabel(s)}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                {detail && <span className="truncate font-mono">{detail}</span>}
                {typeof s.score === "number" && (
                  <span className="ml-auto flex shrink-0 items-center gap-1.5" title={`Relevancia ${s.score.toFixed(2)}`}>
                    <span className="h-1 w-10 overflow-hidden rounded-full bg-line">
                      <span className="block h-full bg-gold" style={{ width: `${Math.max(6, Math.min(100, s.score * 100))}%` }} />
                    </span>
                    {s.score.toFixed(2)}
                  </span>
                )}
              </span>
            </>
          );
          const cls = "block rounded-md border border-line bg-white px-3 py-2";
          return (
            <li key={i} className="min-w-0">
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className={cn(cls, "hover:border-accent")}>
                  {body}
                </a>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {sources.length > VISIBLE && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-semibold text-accent hover:underline">
          {expanded ? "Mostrar menos" : `Ver las ${sources.length} fuentes`}
        </button>
      )}
    </div>
  );
}

export function AnswerMeta({ model, ms, chunks }: { model?: string | null; ms?: number | null; chunks?: number | null }) {
  const parts = [model, ms != null ? formatMs(ms) : null, chunks != null ? `${chunks} fragmentos de contexto` : null].filter(Boolean);
  if (!parts.length) return null;
  return <p className="mt-3 text-xs text-faint">{parts.join(" · ")}</p>;
}
