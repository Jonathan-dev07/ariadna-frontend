"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { buildSegments, RouteDetails } from "@/components/chat/RouteView";
import { Modal } from "@/components/ui/Modal";
import { cn, formatMs } from "@/lib/format";
import {
  clearTraceLog,
  getTraceLog,
  refreshOtelConfig,
  subscribeTraceLog,
  type OtelConfig,
  type TraceEntry,
} from "@/lib/tracing";

const EMPTY: TraceEntry[] = [];
let snapshot: TraceEntry[] = EMPTY;
const subscribe = (fn: () => void) =>
  subscribeTraceLog(() => {
    snapshot = getTraceLog();
    fn();
  });

/** Observabilidad: si las trazas llegan a Grafana y el registro de llamadas de esta pestaña. */
export function TracePanel() {
  const [cfg, setCfg] = useState<OtelConfig | null | undefined>(undefined);
  const log = useSyncExternalStore(subscribe, () => snapshot, () => EMPTY);
  const [selected, setSelected] = useState<TraceEntry | null>(null);

  useEffect(() => {
    snapshot = getTraceLog();
    refreshOtelConfig().then(setCfg);
  }, []);

  function download() {
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trazas-si-frontend-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const grafanaTpl = cfg?.tracing.grafanaTraceUrl;

  return (
    <section>
      <h2 className="mb-1 text-xl font-bold">Trazas y Grafana</h2>
      <p className="mb-4 max-w-2xl text-muted">
        Cada llamada lleva un ID de traza (estándar W3C). El servidor del front la continúa hacia el back, y en Grafana
        se ve el recorrido completo: navegador → front → backend → Mongo y RAG.
      </p>

      <div className="mb-4 rounded-xl border border-line bg-white px-4 py-3">
        {cfg === undefined ? (
          <p className="text-muted">Revisando configuración…</p>
        ) : cfg === null ? (
          <p className="text-[15px]">
            <Badge tone="neutral">Sin servidor</Badge>{" "}
            <span className="text-muted">
              Estás usando <code className="font-mono text-[13px]">npm run dev</code>, que llama directo al back. Las trazas solo
              se generan con el servidor de producción (<code className="font-mono text-[13px]">npm run serve</code> o Docker).
            </span>
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
            <span className="flex items-center gap-2">
              Envío a Grafana
              <Badge tone={cfg.tracing.export ? "ok" : "gold"}>{cfg.tracing.export ? "Activo" : "Desactivado"}</Badge>
            </span>
            <span className="text-muted">
              Backend <span className="font-mono text-[13px] text-ink">{cfg.backend}</span>
            </span>
            {cfg.tracing.export && (
              <span className="text-muted">
                {cfg.tracing.exported} tramos enviados{cfg.tracing.failed > 0 && <span className="text-danger"> · {cfg.tracing.failed} fallidos</span>}
              </span>
            )}
            {cfg.tracing.export && cfg.tracing.credentials === false && (
              <span className="basis-full text-sm text-gold">
                No se encontró la credencial: define <code className="font-mono">OTEL_EXPORTER_OTLP_HEADERS</code> en la misma
                terminal antes de iniciar el servidor.
              </span>
            )}
            {cfg.tracing.lastError && (
              <span className="basis-full rounded-md bg-danger/[.06] px-3 py-2 font-mono text-[13px] break-all text-danger">
                Grafana respondió: {cfg.tracing.lastError}
              </span>
            )}
            {!cfg.tracing.export && (
              <span className="basis-full text-sm text-muted">
                Falta definir <code className="font-mono">OTEL_EXPORTER_OTLP_ENDPOINT</code> y{" "}
                <code className="font-mono">OTEL_EXPORTER_OTLP_HEADERS</code> en el contenedor del front.
              </span>
            )}
          </div>
        )}
      </div>

      {cfg && (
        <button onClick={() => refreshOtelConfig().then(setCfg)} className="mb-4 text-sm font-semibold text-accent hover:underline">
          Actualizar estado del envío
        </button>
      )}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-sans text-base font-semibold text-ink">Llamadas de esta pestaña ({log.length})</h3>
        <div className="flex gap-2">
          <Button size="sm" onClick={clearTraceLog} disabled={!log.length}>
            Limpiar registro
          </Button>
          <Button size="sm" onClick={download} disabled={!log.length}>
            Descargar JSON
          </Button>
        </div>
      </div>
      {!log.length ? (
        <p className="text-sm text-muted">
          {cfg ? "Navega por la app o haz una pregunta; las llamadas aparecerán aquí." : "No hay llamadas trazadas."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-panel-2 text-left text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Hora</th>
                <th className="px-3 py-2 font-semibold">Llamada</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold">Tiempo</th>
                <th className="px-3 py-2 font-semibold">Desglose</th>
                <th className="px-3 py-2 font-semibold">Traza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {log.slice(0, 40).map((e) => {
                const segs = buildSegments(e);
                const tot = Math.max(1, segs.reduce((s, x) => s + x.ms, 0));
                return (
                  <tr
                    key={e.spanId}
                    onClick={() => setSelected(e)}
                    onKeyDown={(ev) => ev.key === "Enter" && setSelected(e)}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-panel-2 focus-visible:bg-panel-2"
                    title="Ver la ruta de esta llamada"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{new Date(e.startedAt).toLocaleTimeString("es-GT")}</td>
                    <td className="max-w-[280px] truncate px-3 py-2 font-mono text-[12.5px]" title={`${e.method} ${e.path}`}>
                      <span className="text-muted">{e.method}</span> {e.path}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("font-mono font-semibold", e.ok ? "text-success" : "text-danger")}>{e.status || "ERR"}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">{formatMs(e.totalMs)}</td>
                    <td className="px-3 py-2">
                      <div className="flex h-2 w-28 overflow-hidden rounded-full bg-line">
                        {segs.map((s) => (
                          <span key={s.label} style={{ width: `${(s.ms / tot) * 100}%`, background: s.color }} title={`${s.label}: ${formatMs(s.ms)}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px]">
                      {grafanaTpl ? (
                        <a href={grafanaTpl.replace("{traceId}", e.traceId)} target="_blank" rel="noreferrer" className="text-accent hover:underline" onClick={(ev) => ev.stopPropagation()}>
                          {e.traceId.slice(0, 10)}…
                        </a>
                      ) : (
                        <span className="text-muted" title={e.traceId}>
                          {e.traceId.slice(0, 10)}…
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {log.length > 0 && (
        <p className="mt-2 text-xs text-faint">
          Desglose: <Legend color="var(--color-ink)" label="navegador ↔ front" /> <Legend color="var(--color-accent)" label="front → back" />{" "}
          <Legend color="var(--color-gold)" label="RAG" /> <Legend color="var(--color-muted)" label="Mongo" />{" "}
          <Legend color="var(--color-success)" label="backend" />
        </p>
      )}
      {log.length > 0 && <p className="mt-1 text-xs text-faint">Toca una fila para ver su ruta completa.</p>}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        wide
        title="Ruta de la interacción"
        description={
          selected && (
            <span className="font-mono text-[13px]">
              {selected.method} {selected.path} · estado {selected.status || "ERR"} · {formatMs(selected.totalMs)}
            </span>
          )
        }
      >
        {selected && <RouteDetails trace={selected} />}
      </Modal>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="mr-2 inline-flex items-center gap-1">
      <span className="inline-block size-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
