"use client";

import { useCallback, useEffect, useState } from "react";
import { Page } from "@/components/AppShell";
import { TracePanel } from "@/components/TracePanel";
import { Button } from "@/components/ui/Button";
import { Badge, ErrorNote, Loading, PageHeader } from "@/components/ui/Feedback";
import { systemApi } from "@/lib/api";
import { formatMs } from "@/lib/format";
import type { StatusResponse } from "@/lib/types";

const isUp = (v?: string | null) => !!v && /^(ok|up|healthy|connected|ready|available)$/i.test(v);

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await systemApi.status());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rag = data?.rag;
  const metrics = data?.rag_metrics;
  const services: [string, string | null | undefined, string | null | undefined][] = rag
    ? [
        ["Servicio RAG", rag.status, null],
        ["Base de datos", rag.database, null],
        ["Índice vectorial", rag.vector_store, null],
        ["Embeddings", rag.embedding_service, [rag.embedding_provider, rag.embedding_model].filter(Boolean).join(" · ")],
        ["Modelo de lenguaje", rag.llm_service, [rag.llm_provider, rag.llm_model].filter(Boolean).join(" · ")],
      ]
    : [];

  return (
    <Page>
      <PageHeader
        title="Estado del sistema"
        description="Si una respuesta tarda o falla, aquí ves si el problema está en el servicio RAG."
        actions={
          <Button onClick={load} loading={loading} size="sm">
            Actualizar
          </Button>
        }
      />
      {error && <ErrorNote className="mb-6">{error}</ErrorNote>}
      {loading && !data && <Loading />}

      {data && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-xl font-bold">Servicios</h2>
            {data.rag_error ? (
              <ErrorNote>El servicio RAG no respondió: {data.rag_error}</ErrorNote>
            ) : (
              <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                {services.map(([name, value, detail]) => (
                  <li key={name} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="min-w-40 font-semibold text-ink">{name}</span>
                    {detail && <span className="font-mono text-[13px] text-muted">{detail}</span>}
                    <span className="ml-auto">
                      <Badge tone={isUp(value) ? "ok" : value ? "gold" : "neutral"}>{value ?? "sin dato"}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">Uso</h2>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
              <Stat label="Usuarios" value={data.backend.total_users} />
              <Stat label="Proyectos" value={data.backend.total_projects} />
              <Stat label="Conversaciones" value={data.backend.total_conversations} />
              <Stat label="Preguntas" value={data.backend.total_queries} />
            </dl>
            <p className="mt-3 text-sm text-muted">
              Tiempo promedio de respuesta: <strong className="text-ink">{formatMs(data.backend.average_response_time_ms)}</strong>
              {metrics && metrics.failed_queries != null && (
                <>
                  {" "}· Consultas fallidas en el RAG: <strong className="text-ink">{metrics.failed_queries}</strong> de{" "}
                  {metrics.total_queries ?? "—"}
                </>
              )}
            </p>
            {data.rag_metrics_error && <p className="mt-1 text-sm text-gold">Métricas del RAG no disponibles: {data.rag_metrics_error}</p>}
          </section>
        </div>
      )}

      <div className="mt-10">
        <TracePanel />
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white px-4 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-[30px] leading-none font-bold text-ink">{value.toLocaleString("es-GT")}</dd>
    </div>
  );
}
