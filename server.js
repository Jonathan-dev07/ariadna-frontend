// si-frontend · servidor de producción (sin dependencias, Node 18+)
//
// 1) Sirve la app ya compilada (carpeta out/, generada con `npm run build`).
// 2) Hace de puente: /api/* y /healthz se reenvían al backend (BACKEND_URL).
//    El navegador solo habla con este servidor (mismo origen): no hay CORS ni
//    contenido mixto aunque el front se publique con https y el back sea http.
// 3) Trazas para Grafana (OpenTelemetry, OTLP/HTTP JSON): cada llamada continúa
//    la traza del navegador (encabezado traceparent) y el backend cuelga de ella.
//    Mismas variables que FILE_LAB, para usar la misma configuración de Grafana.
"use strict";
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = parseInt(process.env.PORT || "8080", 10);
const BACKEND_URL = (process.env.BACKEND_URL || "http://32.196.100.44:8000").replace(/\/+$/, "");
const PROXY_TIMEOUT_MS = parseInt(process.env.PROXY_TIMEOUT_MS || "200000", 10); // las ingestas tardan hasta ~3 min
const SERVICE = process.env.OTEL_SERVICE_NAME || "si-frontend";
const DEPLOY_ENV = process.env.DEPLOY_ENV || "produccion";

const target = new URL(BACKEND_URL);
const lib = target.protocol === "https:" ? https : http;
const agent = new lib.Agent({ keepAlive: true, maxSockets: 256 });
const ROOT = path.join(__dirname, "out");
const HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host"]);
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".map": "application/json",
};

function sendJson(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Content-Length": b.length, "Cache-Control": "no-store" });
  res.end(b);
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const chunks = [];
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) { reject(new Error("cuerpo demasiado grande")); req.destroy(); } else chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}

// ---------------- Trazas (OTLP/HTTP JSON) ----------------
const OTLP_BASE = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "").trim().replace(/^["']+|["']+$/g, "").replace(/\/+$/, "");
const OTLP_URL = OTLP_BASE ? (OTLP_BASE.includes("/v1/traces") ? OTLP_BASE : OTLP_BASE + "/v1/traces") : "";
const OTLP_HEADERS = {};
// Se quitan comillas sobrantes por si se pegó la línea con ellas ("Authorization=Basic ...")
const unquote = (v) => v.trim().replace(/^["']+|["']+$/g, "").trim();
unquote(process.env.OTEL_EXPORTER_OTLP_HEADERS || "").split(",").forEach((kv) => {
  const i = kv.indexOf("=");
  if (i < 1) return;
  let v = unquote(kv.slice(i + 1));
  try { v = decodeURIComponent(v); } catch { /* tal cual */ }
  const k = unquote(kv.slice(0, i));
  if (/^[A-Za-z0-9-]+$/.test(k)) OTLP_HEADERS[k] = v;
});
const HAS_CREDENTIALS = Object.keys(OTLP_HEADERS).some((k) => k.toLowerCase() === "authorization");
const EXPORTING = !!OTLP_URL;
const GRAFANA_TRACE_URL = process.env.GRAFANA_TRACE_URL || "";
const TP_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;
const hex = (n) => crypto.randomBytes(n).toString("hex");
// No se trazan el sondeo de actividad ni la salud, para no llenar Grafana de ruido.
const isNoise = (p) => p === "/healthz" || p.startsWith("/api/v1/activity");

let queue = [];
let exported = 0;
let failed = 0;
let lastErrLog = 0;
let lastError = ""; // último motivo de rechazo de Grafana, visible en la pantalla Estado

function attr(k, v) {
  if (typeof v === "number") {
    return { key: k, value: Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v } };
  }
  return { key: k, value: { stringValue: String(v).slice(0, 200) } };
}
const toNs = (ms) => String(BigInt(Math.round(ms * 1000)) * 1000n);

function makeSpan(o) {
  return {
    traceId: o.traceId, spanId: o.spanId, parentSpanId: o.parentId || "", name: o.name, kind: o.kind,
    startTimeUnixNano: toNs(o.startMs), endTimeUnixNano: toNs(o.startMs + o.durMs),
    attributes: Object.entries(o.attrs || {}).map(([k, v]) => attr(k, v)),
    status: { code: o.error ? 2 : 1 },
  };
}

function addSpan(service, span) {
  if (!EXPORTING) return;
  queue.push({ service, span });
  if (queue.length >= 100) flush();
}

function flush() {
  if (!EXPORTING || !queue.length) return;
  const batch = queue;
  queue = [];
  const byService = {};
  batch.forEach(({ service, span }) => (byService[service] = byService[service] || []).push(span));
  const body = Buffer.from(JSON.stringify({
    resourceSpans: Object.entries(byService).map(([service, spans]) => ({
      resource: { attributes: [attr("service.name", service), attr("deployment.environment", DEPLOY_ENV)] },
      scopeSpans: [{ scope: { name: "si-frontend" }, spans }],
    })),
  }));
  const u = new URL(OTLP_URL);
  const l = u.protocol === "https:" ? https : http;
  const r = l.request(
    { hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80), path: u.pathname + u.search, method: "POST",
      headers: Object.assign({ "Content-Type": "application/json", "Content-Length": body.length }, OTLP_HEADERS) },
    (res) => {
      let text = "";
      res.on("data", (c) => { if (text.length < 500) text += c; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) { exported += batch.length; lastError = ""; }
        else exportError("HTTP " + res.statusCode + (text ? " — " + text.trim().slice(0, 300) : ""), batch.length);
      });
    }
  );
  r.setTimeout(10000, () => r.destroy(new Error("timeout")));
  r.on("error", (e) => exportError(e.message, batch.length));
  r.end(body);
}

function exportError(msg, n) {
  failed += n;
  lastError = msg;
  if (Date.now() - lastErrLog > 60000) {
    lastErrLog = Date.now();
    console.warn("No se pudieron enviar trazas a Grafana: " + msg);
  }
}
if (EXPORTING) setInterval(flush, 2000).unref();

// Límite de tramos que el navegador puede mandar por segundo
let spanBudget = 50;
setInterval(() => { spanBudget = 50; }, 1000).unref();

async function handleBrowserSpan(req, res) {
  let b;
  try { b = await readJson(req, 20000); } catch (e) { return sendJson(res, 400, { detail: e.message }); }
  const okHex = (v, n) => typeof v === "string" && new RegExp("^[0-9a-f]{" + n + "}$").test(v);
  if (!okHex(b.traceId, 32) || !okHex(b.spanId, 16) || (b.parentId && !okHex(b.parentId, 16))) {
    return sendJson(res, 400, { detail: "ids inválidos" });
  }
  if (spanBudget-- <= 0) return sendJson(res, 429, { detail: "demasiados tramos" });
  const start = Number(b.startMs);
  const dur = Math.max(0, Math.min(Number(b.durMs) || 0, 3600000));
  if (!isFinite(start) || Math.abs(Date.now() - start) > 86400000) return sendJson(res, 400, { detail: "hora inválida" });
  const attrs = {};
  Object.entries(b.attrs || {}).slice(0, 10).forEach(([k, v]) => {
    if (/^[a-z0-9_.]{1,40}$/.test(k) && (typeof v === "string" || typeof v === "number")) attrs[k] = v;
  });
  addSpan(SERVICE + "-browser", makeSpan({
    traceId: b.traceId, spanId: b.spanId, parentId: b.parentId, name: String(b.name || "interaccion").slice(0, 80),
    kind: 1, startMs: start, durMs: dur, attrs, error: !!b.error,
  }));
  res.writeHead(204);
  res.end();
}

// ---------------- Puente hacia el backend ----------------
function proxy(req, res) {
  const t0 = process.hrtime.bigint();
  const startMs = Date.now();
  const pathOnly = req.url.split("?")[0];
  const traced = !isNoise(pathOnly);

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k.toLowerCase())) headers[k] = v;
  headers["host"] = target.host;
  headers["x-forwarded-for"] = (req.headers["x-forwarded-for"] ? req.headers["x-forwarded-for"] + ", " : "") + (req.socket.remoteAddress || "");
  delete headers["origin"]; // para el back es una llamada servidor a servidor: no aplica CORS
  delete headers["referer"];

  const m = TP_RE.exec(String(req.headers["traceparent"] || ""));
  const traceId = m ? m[1] : hex(16);
  const parentId = m ? m[2] : "";
  const spanId = hex(8);
  if (traced) {
    headers["traceparent"] = "00-" + traceId + "-" + spanId + "-01";
    // Igual que FILE_LAB: le pide al back que devuelva su desglose (Server-Timing / x-route-trace)
    headers["x-lab-route"] = "1";
  } else {
    delete headers["traceparent"];
  }

  let status = 0;
  let broken = false;
  let connectMs = 0;
  const finishSpan = () => {
    if (!traced) return;
    addSpan(SERVICE, makeSpan({
      traceId, spanId, parentId, name: req.method + " " + pathOnly, kind: 3, startMs,
      durMs: Number(process.hrtime.bigint() - t0) / 1e6,
      attrs: { "http.method": req.method, "http.target": pathOnly, "http.status_code": status, "net.peer.name": target.host, "proxy.connect_ms": +connectMs.toFixed(1) },
      error: broken || status >= 500,
    }));
  };

  const upstream = lib.request(
    { hostname: target.hostname, port: target.port || (target.protocol === "https:" ? 443 : 80), method: req.method, path: req.url, headers, agent },
    (up) => {
      status = up.statusCode || 502;
      const out = {};
      for (const [k, v] of Object.entries(up.headers)) if (!HOP.has(k.toLowerCase())) out[k] = v;
      out["cache-control"] = "no-store";
      if (traced) {
        const total = Number(process.hrtime.bigint() - t0) / 1e6;
        out["server-timing"] = [up.headers["server-timing"], "proxy-connect;dur=" + connectMs.toFixed(1), "proxy;dur=" + total.toFixed(1)].filter(Boolean).join(", ");
        // Para saber si el back continuó la traza: lo que él respondió, sin rellenar
        out["x-backend-trace-id"] = String(up.headers["x-trace-id"] || "");
        if (!out["x-trace-id"]) out["x-trace-id"] = traceId;
      }
      res.writeHead(status, out);
      up.pipe(res);
      res.on("finish", finishSpan);
    }
  );
  upstream.on("socket", (s) => {
    if (!s.connecting) return;
    const t = process.hrtime.bigint();
    s.once("connect", () => { connectMs = Number(process.hrtime.bigint() - t) / 1e6; });
  });
  upstream.setTimeout(PROXY_TIMEOUT_MS, () => upstream.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })));
  upstream.on("error", (e) => {
    broken = true;
    if (res.headersSent) return res.destroy();
    const timeout = e.code === "ETIMEDOUT";
    status = timeout ? 504 : 502;
    if (traced) res.setHeader("X-Trace-Id", traceId);
    sendJson(res, status, {
      detail: timeout
        ? `El backend no respondió a tiempo (${Math.round(PROXY_TIMEOUT_MS / 1000)} s).`
        : `No se pudo contactar al backend (${target.host}): ${e.code || e.message}`,
    });
    finishSpan();
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
}

// ---------------- Archivos de la app (out/) ----------------
function serveStatic(req, res, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { rel = urlPath; }
  // Next exporta /chat/ como out/chat/index.html (trailingSlash: true)
  const candidates = rel.endsWith("/") ? [rel + "index.html"] : [rel, rel + "/index.html", rel + ".html"];
  const tryNext = (i) => {
    if (i >= candidates.length) return send404(res);
    const file = path.normalize(path.join(ROOT, candidates[i]));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return tryNext(i + 1);
      // Si piden /chat sin barra, se redirige a /chat/ para que las rutas relativas funcionen
      if (i === 1 && !rel.endsWith("/")) { res.writeHead(308, { Location: rel + "/" }); return res.end(); }
      const ext = path.extname(file);
      const immutable = rel.startsWith("/_next/static/");
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      fs.createReadStream(file).pipe(res);
    });
  };
  tryNext(0);
}

function send404(res) {
  const file = path.join(ROOT, "404.html");
  fs.readFile(file, (err, data) => {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(err ? "No encontrado" : data);
  });
}

// ---------------- Rutas ----------------
const server = http.createServer(async (req, res) => {
  const u = req.url.split("?")[0];
  try {
    if (u === "/_otel/health") return sendJson(res, 200, { ok: true });
    if (u === "/_otel/config") {
      return sendJson(res, 200, { proxy: true, backend: target.host, tracing: { export: EXPORTING, grafanaTraceUrl: GRAFANA_TRACE_URL, exported, failed, lastError, credentials: HAS_CREDENTIALS } });
    }
    if (u === "/_otel/span" && req.method === "POST") return await handleBrowserSpan(req, res);
    if (u === "/healthz" || u.startsWith("/api/")) return proxy(req, res);
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, u);
  } catch {
    if (!res.headersSent) sendJson(res, 500, { detail: "Error interno del servidor del frontend." });
    else res.destroy();
  }
});
server.keepAliveTimeout = 65000;
server.requestTimeout = 0; // las ingestas pueden tardar varios minutos

if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("No existe out/index.html. Ejecuta primero: npm run build");
  process.exit(1);
}
server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `si-frontend en http://localhost:${PORT} → backend ${BACKEND_URL}` +
      (EXPORTING ? ` · trazas → ${new URL(OTLP_URL).host} (credencial: ${HAS_CREDENTIALS ? "sí" : "NO, falta OTEL_EXPORTER_OTLP_HEADERS"})` : " · trazas a Grafana desactivadas (falta OTEL_EXPORTER_OTLP_ENDPOINT)")
  );
});
