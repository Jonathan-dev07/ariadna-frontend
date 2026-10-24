"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AnswerMeta, Markdown, SourceList } from "@/components/chat/Answer";
import { RouteView } from "@/components/chat/RouteView";
import { ScopeBar } from "@/components/chat/ScopeBar";
import { ProjectPicker } from "@/components/ProjectPicker";
import { Button } from "@/components/ui/Button";
import { EmptyState, Loading } from "@/components/ui/Feedback";
import { useAuth } from "@/context/AuthProvider";
import { useProjects } from "@/context/ProjectProvider";
import { useProjectSources } from "@/hooks/useProjectSources";
import { chatApi } from "@/lib/api";
import { getTitle, rememberTitle } from "@/lib/conversationTitles";
import { cn, formatDateTime, timeAgo } from "@/lib/format";
import type { Conversation, Message, QueryRequest, QueryScope } from "@/lib/types";

type Turn = Message & { pending?: boolean; error?: string };

const STARTERS = [
  "¿Cómo está organizado el proyecto y qué hace cada carpeta?",
  "¿Dónde se maneja la autenticación de usuarios?",
  "¿Qué dependencias externas usa y para qué?",
];

export default function ChatPage() {
  const { isAdmin } = useAuth();
  const { selectedId, selected } = useProjects();
  const { sources } = useProjectSources(selectedId);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [scope, setScope] = useState<QueryScope>({ type: "project" });
  const [railOpen, setRailOpen] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    if (!selectedId) return setConversations([]);
    setConvLoading(true);
    try {
      setConversations(await chatApi.conversations(selectedId));
    } catch {
      setConversations([]);
    } finally {
      setConvLoading(false);
    }
  }, [selectedId]);

  // Cambio de proyecto: se empieza una conversación nueva.
  useEffect(() => {
    setConversationId(null);
    setTurns([]);
    setScope({ type: "project" });
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function openConversation(id: string) {
    setRailOpen(false);
    if (id === conversationId) return;
    setConversationId(id);
    setTurns([]);
    setMsgLoading(true);
    try {
      const msgs = await chatApi.messages(id);
      setTurns(msgs);
      if (msgs[0]) rememberTitle(id, msgs[0].question);
    } catch {
      setTurns([]);
    } finally {
      setMsgLoading(false);
    }
  }

  function newConversation() {
    setRailOpen(false);
    setConversationId(null);
    setTurns([]);
    input.current?.focus();
  }

  const scopeIncomplete =
    (scope.type === "branches" && !scope.branches.length) ||
    (scope.type === "document" && !scope.document) ||
    (scope.type === "commit" && !scope.commit);

  async function send(text = question) {
    const q = text.trim();
    if (!q || !selectedId || sending || scopeIncomplete) return;
    setQuestion("");
    setSending(true);
    const pending: Turn = { question: q, answer: "", sources: [], created_at: new Date().toISOString(), pending: true };
    setTurns((t) => [...t, pending]);

    const body: QueryRequest = { project_id: selectedId, question: q, conversation_id: conversationId };
    if (scope.type === "branches") body.branches = scope.branches;
    if (scope.type === "document") body.document = scope.document;
    if (scope.type === "commit") {
      body.commit = scope.commit;
      if (scope.repository) body.repository = scope.repository;
    }

    try {
      const res = await chatApi.query(body);
      rememberTitle(res.conversation_id, q);
      setTurns((t) => [
        ...t.slice(0, -1),
        {
          question: q,
          answer: res.answer,
          sources: res.sources,
          created_at: new Date().toISOString(),
          model: res.model,
          response_time_ms: res.response_time_ms,
          context_chunks_used: res.context_chunks_used,
          trace: res.trace,
        },
      ]);
      if (res.conversation_id !== conversationId) {
        setConversationId(res.conversation_id);
      }
      loadConversations();
    } catch (e) {
      setTurns((t) => [...t.slice(0, -1), { ...pending, pending: false, error: (e as Error).message }]);
    } finally {
      setSending(false);
      input.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  // Ajusta la altura del cuadro de texto al contenido (hasta un máximo).
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [question]);

  const rail = (
    <div className="flex h-full flex-col">
      <div className="space-y-4 border-b border-line p-4">
        <ProjectPicker />
        <Button variant="primary" className="w-full" onClick={newConversation} disabled={!selectedId}>
          Nueva conversación
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-2 pt-2 pb-1.5 text-sm font-semibold text-muted">Tus conversaciones</p>
        {!selectedId ? (
          <p className="px-2 text-sm text-faint">Elige un proyecto para ver tus conversaciones.</p>
        ) : convLoading && !conversations.length ? (
          <p className="px-2 text-sm text-faint">Cargando…</p>
        ) : !conversations.length ? (
          <p className="px-2 text-sm text-faint">Todavía no has preguntado nada en este proyecto.</p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => {
              const title = getTitle(c.conversation_id);
              const active = c.conversation_id === conversationId;
              return (
                <li key={c.conversation_id}>
                  <button
                    onClick={() => openConversation(c.conversation_id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left transition-colors",
                      active ? "border-accent bg-white shadow-[inset_3px_0_0_var(--color-accent)]" : "border-transparent hover:bg-white"
                    )}
                  >
                    <span className="line-clamp-2 text-[15px] leading-snug text-text">
                      {title ?? `Conversación del ${formatDateTime(c.created_at)}`}
                    </span>
                    <span className="mt-0.5 block text-xs text-faint">{timeAgo(c.updated_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full">
      {/* Panel lateral: fijo en escritorio, cajón en celular */}
      <aside className="hidden w-[300px] shrink-0 border-r border-line bg-panel-2 lg:block">{rail}</aside>
      {railOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setRailOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-panel-2 shadow-2xl">{rail}</aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2.5 lg:hidden">
          <Button size="sm" onClick={() => setRailOpen(true)}>
            Conversaciones
          </Button>
          <span className="truncate font-semibold text-ink">{selected?.name ?? "Sin proyecto"}</span>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            {!selectedId ? (
              <EmptyState title="Elige un proyecto para empezar">
                Cada proyecto tiene su propio código y documentación indexados. Selecciónalo en el panel de la izquierda.
              </EmptyState>
            ) : msgLoading ? (
              <Loading label="Cargando conversación…" />
            ) : !turns.length ? (
              <Welcome
                projectName={selected?.name ?? selectedId}
                description={selected?.description}
                empty={sources !== null && sources.total_chunks === 0}
                isAdmin={isAdmin}
                onPick={(q) => send(q)}
              />
            ) : (
              <ol className="space-y-10">
                {turns.map((t, i) => (
                  <li key={i}>
                    <TurnView turn={t} onRetry={() => setQuestion(t.question)} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-panel">
          <div className="mx-auto max-w-3xl space-y-3 px-4 py-3 sm:px-6">
            {selectedId && <ScopeBar sources={sources} scope={scope} onChange={setScope} />}
            <div className="flex items-end gap-2">
              <label htmlFor="question" className="sr-only">
                Tu pregunta
              </label>
              <textarea
                id="question"
                ref={input}
                rows={1}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={!selectedId}
                placeholder={selectedId ? "Pregunta sobre el código o la documentación…" : "Elige un proyecto primero"}
                className="input min-h-[46px] resize-none py-2.5"
              />
              <Button
                variant="primary"
                className="min-h-[46px]"
                onClick={() => send()}
                loading={sending}
                disabled={!selectedId || !question.trim() || scopeIncomplete}
              >
                Preguntar
              </Button>
            </div>
            <p className="hidden text-xs text-faint sm:block">Enter para enviar · Shift + Enter para una línea nueva</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function TurnView({ turn, onRetry }: { turn: Turn; onRetry: () => void }) {
  return (
    <article>
      <div className="mb-3 flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 whitespace-pre-wrap text-white">{turn.question}</p>
      </div>
      <div className="border-l-[3px] border-accent pl-4">
        {turn.pending ? (
          <p className="flex items-center gap-2 text-muted" aria-live="polite">
            Buscando en el proyecto
            <span aria-hidden className="flex gap-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 rounded-full bg-accent animate-[thinking_1.2s_infinite]" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
            </span>
          </p>
        ) : turn.error ? (
          <div className="text-danger">
            <p>No se obtuvo respuesta: {turn.error}</p>
            <button onClick={onRetry} className="mt-1 text-sm font-semibold text-accent hover:underline">
              Volver a escribir la pregunta
            </button>
          </div>
        ) : (
          <>
            <Markdown text={turn.answer} />
            <SourceList sources={turn.sources} />
            <AnswerMeta model={turn.model} ms={turn.response_time_ms} chunks={turn.context_chunks_used} />
            {turn.trace && <RouteView trace={turn.trace} />}
          </>
        )}
      </div>
    </article>
  );
}

function Welcome({
  projectName,
  description,
  empty,
  isAdmin,
  onPick,
}: {
  projectName: string;
  description?: string | null;
  empty: boolean;
  isAdmin: boolean;
  onPick: (q: string) => void;
}) {
  if (empty) {
    return (
      <EmptyState
        title={`"${projectName}" todavía no tiene contenido indexado`}
        action={
          isAdmin ? (
            <Link href="/admin/indexar/" className="font-semibold text-accent underline">
              Indexar un repositorio o documentos
            </Link>
          ) : undefined
        }
      >
        {isAdmin
          ? "Carga su repositorio o documentos para poder hacer preguntas."
          : "Un administrador debe cargar su repositorio o documentos antes de que puedas preguntar."}
      </EmptyState>
    );
  }
  return (
    <div className="pt-6">
      <h1 className="text-[30px] leading-tight font-bold">{projectName}</h1>
      {description && <p className="mt-2 max-w-xl text-muted">{description}</p>}
      <p className="mt-6 mb-3 text-muted">Puedes empezar con una de estas preguntas:</p>
      <div className="flex flex-col items-start gap-2">
        {STARTERS.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-lg border border-line-strong bg-white px-4 py-2.5 text-left hover:border-accent hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
