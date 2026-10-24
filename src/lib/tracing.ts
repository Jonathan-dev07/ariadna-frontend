// Trazas del navegador (estándar W3C traceparent), compatibles con lo que hace FILE_LAB.
//
// Cada llamada al back lleva un traceparent. Si la app corre con server.js (producción),
// ese servidor continúa la traza hacia el back y manda todo a Grafana; además expone
// /_otel/config para saber si el envío está activo y cómo abrir una traza en Grafana.
// Con `npm run dev` no hay server.js: se manda el traceparent igual, pero no se exporta.

export interface TraceTiming {
  name: string;
  dur: number;
  desc?: string;
}

export interface TraceEntry {
  traceId: string;
  spanId: string;
  method: string;
  path: string;
  status: number;
  ok: boolean;
  startedAt: number; // epoch ms
  totalMs: number;
  /** Tramos que reporta el puente y el back en Server-Timing (proxy, total, mongo, rag…) */
  timings: TraceTiming[];
  /** Traza con la que respondió el back; si no coincide, el back no recibió el traceparent */
  backendTraceId: string;
}

export interface OtelConfig {
  proxy: boolean;
  backend: string;
  tracing: { export: boolean; grafanaTraceUrl: string; exported: number; failed: number; lastError?: string; credentials?: boolean };
}

const hexId = (bytes: number) => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

export function newTraceparent() {
  const traceId = hexId(16);
  const spanId = hexId(8);
  return { traceId, spanId, header: `00-${traceId}-${spanId}-01` };
}

export const isNoisyPath = (path: string) => path.startsWith("/api/v1/activity") || path === "/healthz";

export function parseServerTiming(header: string | null): TraceTiming[] {
  if (!header) return [];
  const out: TraceTiming[] = [];
  const re = /([A-Za-z0-9_-]+)(?:;desc="([^"]*)")?;dur=([\d.]+)(?:;desc="([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header))) out.push({ name: m[1], dur: parseFloat(m[3]), desc: m[2] || m[4] });
  return out;
}

// ---------- Configuración del servidor (solo existe con server.js) ----------
let configPromise: Promise<OtelConfig | null> | null = null;

export function getOtelConfig(): Promise<OtelConfig | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!configPromise) {
    configPromise = fetch("/_otel/config", { cache: "no-store" })
      .then((r) => (r.ok && r.headers.get("content-type")?.includes("json") ? (r.json() as Promise<OtelConfig>) : null))
      .catch(() => null);
  }
  return configPromise;
}

export function refreshOtelConfig() {
  configPromise = null;
  return getOtelConfig();
}

export async function grafanaLink(traceId: string): Promise<string | null> {
  const cfg = await getOtelConfig();
  const tpl = cfg?.tracing.grafanaTraceUrl;
  return tpl ? tpl.replace("{traceId}", traceId) : null;
}

/** Envía el tramo del navegador al servidor, que lo reenvía a Grafana. */
export async function reportBrowserSpan(e: TraceEntry) {
  const cfg = await getOtelConfig();
  if (!cfg?.tracing.export) return;
  fetch("/_otel/span", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      traceId: e.traceId,
      spanId: e.spanId,
      name: `${e.method} ${e.path}`,
      startMs: e.startedAt,
      durMs: e.totalMs,
      error: !e.ok,
      attrs: { "http.method": e.method, "http.target": e.path, "http.status_code": e.status },
    }),
  }).catch(() => {});
}

// ---------- Registro de llamadas (en memoria, para la pantalla Estado) ----------
const MAX_LOG = 100;
const log: TraceEntry[] = [];
const listeners = new Set<() => void>();

export function recordTrace(e: TraceEntry) {
  log.unshift(e);
  if (log.length > MAX_LOG) log.pop();
  listeners.forEach((fn) => fn());
  reportBrowserSpan(e);
}

export function getTraceLog() {
  return log.slice();
}

export function clearTraceLog() {
  log.length = 0;
  listeners.forEach((fn) => fn());
}

export function subscribeTraceLog(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
