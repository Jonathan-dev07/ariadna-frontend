"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatMs } from "@/lib/format";
import { grafanaLink, type TraceEntry } from "@/lib/tracing";

const C = {
  browser: "var(--color-ink)",
  proxy: "var(--color-accent)",
  backend: "var(--color-success)",
  rag: "var(--color-gold)",
  mongo: "var(--color-muted)",
};

interface Segment {
  label: string;
  ms: number;
  color: string;
}

/** Tiempos de la llamada según el navegador, el puente (server.js) y el back (Server-Timing). */
function timesOf(t: TraceEntry) {
  const get = (n: string) => t.timings.find((x) => x.name === n)?.dur;
  return {
    total: t.totalMs,
    proxy: get("proxy"),
    backend: get("total") ?? get("app"),
    mongo: get("mongo") ?? 0,
    rag: get("rag") ?? 0,
  };
}

/** Partes de la barra compacta (tabla de Estado). */
export function buildSegments(t: TraceEntry): Segment[] {
  const { total, proxy, backend, mongo, rag } = timesOf(t);
  if (proxy == null) return [{ label: "Total", ms: total, color: C.proxy }];
  const segs: Segment[] = [{ label: "Red navegador ↔ front", ms: Math.max(0, total - proxy), color: C.browser }];
  if (backend == null) {
    segs.push({ label: "Servidor del front → back", ms: proxy, color: C.proxy });
    return segs;
  }
  segs.push({ label: "Red front ↔ back", ms: Math.max(0, proxy - backend), color: C.proxy });
  if (rag) segs.push({ label: "RAG", ms: rag, color: C.rag });
  if (mongo) segs.push({ label: "MongoDB", ms: mongo, color: C.mongo });
  segs.push({ label: "Backend", ms: Math.max(0, backend - rag - mongo), color: C.backend });
  return segs;
}

/** Detalle completo de la ruta: ID de traza, diagrama y cascada de tiempos. */
export function RouteDetails({ trace }: { trace: TraceEntry }) {
  const [grafana, setGrafana] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    grafanaLink(trace.traceId).then(setGrafana);
  }, [trace.traceId]);

  const { total, proxy, backend, mongo, rag } = timesOf(trace);
  const continued = trace.backendTraceId === trace.traceId;
  const otherTrace = !!trace.backendTraceId && !continued;

  // Cascada: la red se reparte por igual entre ida y vuelta (es una estimación).
  const proxyStart = proxy != null ? Math.max(0, (total - proxy) / 2) : 0;
  const backStart = proxy != null && backend != null ? proxyStart + Math.max(0, (proxy - backend) / 2) : 0;
  const rows: { label: string; sub: string; start: number; dur: number; color: string; indent?: boolean }[] = [
    { label: "Navegador", sub: "total", start: 0, dur: total, color: C.browser },
  ];
  if (proxy != null) rows.push({ label: "Servidor del front", sub: "puente", start: proxyStart, dur: proxy, color: C.proxy });
  if (backend != null) {
    rows.push({ label: "Backend", sub: "AWS · FastAPI", start: backStart, dur: backend, color: C.backend });
    if (mongo) rows.push({ label: "MongoDB", sub: "", start: backStart, dur: mongo, color: C.mongo, indent: true });
    if (rag) rows.push({ label: "Servicio RAG", sub: "", start: backStart + mongo, dur: rag, color: C.rag, indent: true });
  }

  // La escala abarca el tramo que termine más tarde (por si los relojes no coinciden)
  const T = Math.max(1, ...rows.map((r) => r.start + r.dur));

  const nodes = [
    { title: "Navegador", sub: "Tu pantalla", ms: total, color: C.browser },
    { title: "Servidor del front", sub: "Puente (server.js)", ms: proxy, color: C.proxy },
    { title: "Backend", sub: "AWS · FastAPI", ms: backend, color: C.backend },
  ];
  const links = [proxy != null ? total - proxy : null, proxy != null && backend != null ? proxy - backend : null];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">ID de traza</span>
        <code className="rounded-md border border-line bg-panel-2 px-2 py-1 font-mono text-[12.5px] break-all text-ink">{trace.traceId}</code>
        <button
          className="rounded-md border border-line-strong bg-white px-2.5 py-1 text-[13px] font-semibold hover:border-accent"
          onClick={() =>
            navigator.clipboard?.writeText(trace.traceId).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
        {grafana && (
          <a href={grafana} target="_blank" rel="noreferrer" className="rounded-md bg-accent px-2.5 py-1 text-[13px] font-semibold text-white hover:bg-accent-hover">
            Abrir en Grafana
          </a>
        )}
      </div>

      <div className="space-y-1.5 text-[13.5px]">
        {continued && (
          <p className="rounded-md border border-success/30 bg-success/[.07] px-3 py-2 text-text">
            El backend continuó esta misma traza: en Grafana verás todo el recorrido bajo este ID.
          </p>
        )}
        {otherTrace && (
          <p className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-text">
            El backend respondió con otra traza ({trace.backendTraceId.slice(0, 12)}…): no está leyendo el encabezado traceparent.
          </p>
        )}
        {proxy == null && (
          <p className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-text">
            Esta llamada no pasó por el servidor del front (modo desarrollo): solo se mide el tiempo total.
          </p>
        )}
        {proxy != null && backend == null && (
          <p className="rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-text">
            El backend no envió su detalle interno (Mongo y RAG). Para verlo necesita el módulo de trazas (tracing.py). Abajo
            se ven los tramos del navegador y del servidor del front.
          </p>
        )}
      </div>

      {/* Diagrama */}
      <div className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center">
        {nodes.map((n, i) => (
          <div key={n.title} className="contents">
            <div className="flex-1 rounded-lg border border-line bg-white px-3 py-2.5" style={{ borderTop: `3px solid ${n.color}` }}>
              <p className="text-sm font-semibold text-ink">{n.title}</p>
              <p className="text-xs text-muted">{n.sub}</p>
              <p className="mt-1 font-mono text-[15px] font-semibold text-ink">{n.ms != null ? formatMs(n.ms) : "—"}</p>
            </div>
            {i < links.length && (
              <div className="flex shrink-0 flex-col items-center px-1 text-center text-[11px] leading-tight text-faint sm:w-16">
                <span aria-hidden className="text-base text-muted">
                  <span className="hidden sm:inline">→</span>
                  <span className="sm:hidden">↓</span>
                </span>
                {links[i] != null && <span>red ≈ {formatMs(Math.max(0, links[i]!))}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Cascada de tiempos */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Cascada de tiempos</p>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[130px_1fr_64px] items-center gap-2 text-[13px] sm:grid-cols-[170px_1fr_70px]">
              <span className={cn("truncate text-text", r.indent && "pl-3 text-muted")}>
                {r.label}
                {r.sub && <span className="text-faint"> · {r.sub}</span>}
              </span>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-panel-2">
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{ left: `${(r.start / T) * 100}%`, width: `${Math.min(100 - (r.start / T) * 100, Math.max(0.8, (r.dur / T) * 100))}%`, background: r.color }}
                />
              </div>
              <span className="text-right font-mono text-muted">{formatMs(r.dur)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[130px_1fr_64px] gap-2 text-[11px] text-faint sm:grid-cols-[170px_1fr_70px]">
            <span />
            <div className="flex justify-between font-mono">
              <span>0</span>
              <span>{formatMs(T / 2)}</span>
              <span>{formatMs(T)}</span>
            </div>
            <span />
          </div>
        </div>
      </div>
      <p className="text-xs text-faint">
        Medido: tiempo del navegador, del servidor del front, del backend, de Mongo y del RAG. Estimado: cuánto de la red
        corresponde a ida y cuánto a vuelta (se reparte por igual).
      </p>
    </div>
  );
}

/** Botón "Ver ruta" bajo una respuesta del chat. */
export function RouteView({ trace }: { trace: TraceEntry }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [open]);

  return (
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-sm font-semibold text-accent hover:underline">
        {open ? "Ocultar ruta" : "Ver ruta"}
      </button>
      {open && (
        <div ref={panel} className="mt-2 rounded-lg border border-line bg-panel-2/60 p-4">
          <p className="mb-3 text-sm text-muted">
            Ruta de la interacción · <span className="font-mono">{trace.method} {trace.path}</span> · estado {trace.status} ·{" "}
            <strong className="text-ink">{formatMs(trace.totalMs)}</strong>
          </p>
          <RouteDetails trace={trace} />
        </div>
      )}
    </div>
  );
}
