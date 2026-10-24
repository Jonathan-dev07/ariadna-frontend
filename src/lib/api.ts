import { session } from "./session";
import { isNoisyPath, newTraceparent, parseServerTiming, recordTrace, type TraceEntry } from "./tracing";
import type {
  ActivityEvent,
  BranchesResponse,
  CommitsIngestResponse,
  CommitsResponse,
  CompareRequest,
  CompareResponse,
  Conversation,
  DocumentsIngestResponse,
  Ingestion,
  LoginHistoryEntry,
  Message,
  Project,
  ProjectCreate,
  ProjectFile,
  ProjectSources,
  ProjectUpdate,
  QueryRequest,
  QueryResponse,
  RepoIngestResponse,
  Role,
  StatusResponse,
  TokenResponse,
  User,
} from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

// Lo registra AuthProvider: cuando el back dice que la sesión ya no sirve,
// se limpia todo y se manda al usuario a la pantalla de acceso.
let onSessionEnded: ((message: string) => void) | null = null;
export function setSessionEndedHandler(fn: ((message: string) => void) | null) {
  onSessionEnded = fn;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  return (await requestTraced<T>(path, opts)).data;
}

/** Igual que request, pero también devuelve el ID de traza (para "Ver ruta" y Grafana). */
async function requestTraced<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; trace: TraceEntry | null }> {
  const { method = "GET", body, formData, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (!formData) headers["Content-Type"] = "application/json";
  const token = session.getToken();
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  const pathOnly = path.split("?")[0];
  const base = session.getApiBase();
  // Las trazas viajan solo por el puente (server.js, mismo origen). Llamando directo al
  // back (npm run dev) no se agrega el encabezado, para no depender de su configuración CORS.
  const traced = base === "" && !isNoisyPath(pathOnly);
  const tp = newTraceparent();
  if (traced) headers["traceparent"] = tp.header;
  const startedAt = Date.now();
  const t0 = performance.now();

  let res: Response;
  try {
    res = await fetch(base + path, {
      method,
      headers,
      body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    if (traced) {
      recordTrace({ traceId: tp.traceId, spanId: tp.spanId, method, path: pathOnly, status: 0, ok: false, startedAt,
        totalMs: performance.now() - t0, timings: [], backendTraceId: "" });
    }
    throw new ApiError("No se pudo contactar al servidor. Revisa tu conexión o la URL del backend.", 0);
  }

  let data: unknown = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      /* respuesta sin cuerpo JSON */
    }
  }

  let trace: TraceEntry | null = null;
  if (traced) {
    trace = {
      traceId: tp.traceId,
      spanId: tp.spanId,
      method,
      path: pathOnly,
      status: res.status,
      ok: res.ok,
      startedAt,
      totalMs: performance.now() - t0,
      timings: parseServerTiming(res.headers.get("server-timing")),
      backendTraceId: res.headers.get("x-backend-trace-id") ?? res.headers.get("x-trace-id") ?? "",
    };
    recordTrace(trace);
  }

  if (res.status === 204) return { data: undefined as T, trace };

  if (!res.ok) {
    const message = extractDetail(data) ?? `Error ${res.status}`;
    // 401: token inválido o sesión expirada por inactividad.
    // 403 "cuenta inactiva": el back ya borró la sesión.
    const accountDisabled = res.status === 403 && /inactiva/i.test(message);
    if (auth && (res.status === 401 || accountDisabled)) onSessionEnded?.(message);
    throw new ApiError(message, res.status);
  }
  return { data: data as T, trace };
}

function extractDetail(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("detail" in data)) return null;
  const detail = (data as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  // Errores de validación de FastAPI: [{ loc, msg, type }, ...]
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : ""))
      .filter(Boolean)
      .join(", ");
  }
  return null;
}

const enc = encodeURIComponent;
const V1 = "/api/v1";

// ---------- Endpoints, agrupados como los routers del back ----------

export const authApi = {
  login: (email: string, password: string) =>
    request<TokenResponse>(`${V1}/auth/login`, { method: "POST", body: { email, password }, auth: false }),
  logout: () => request<void>(`${V1}/auth/logout`, { method: "POST" }),
  loginHistory: (limit = 50) => request<LoginHistoryEntry[]>(`${V1}/auth/login-history?limit=${limit}`),
};

export const usersApi = {
  register: (name: string, email: string, password: string) =>
    request<User>(`${V1}/users`, { method: "POST", body: { name, email, password }, auth: false }),
  me: () => request<User>(`${V1}/users/me`),
  list: () => request<User[]>(`${V1}/users`),
  update: (id: string, changes: { role?: Role; active?: boolean }) =>
    request<User>(`${V1}/users/${enc(id)}`, { method: "PATCH", body: changes }),
  resetPassword: (id: string, newPassword: string) =>
    request<void>(`${V1}/users/${enc(id)}/reset-password`, {
      method: "POST",
      body: { new_password: newPassword },
    }),
};

export const projectsApi = {
  list: () => request<Project[]>(`${V1}/projects`),
  create: (payload: ProjectCreate) => request<Project>(`${V1}/projects`, { method: "POST", body: payload }),
  update: (id: string, payload: ProjectUpdate) =>
    request<Project>(`${V1}/projects/${enc(id)}`, { method: "PATCH", body: payload }),
  remove: (id: string) => request<void>(`${V1}/projects/${enc(id)}`, { method: "DELETE" }),
  clearIndex: (id: string) =>
    request<{ project_id: string; deleted_chunks: number }>(`${V1}/projects/${enc(id)}/index`, {
      method: "DELETE",
    }),
  sources: (id: string) => request<ProjectSources>(`${V1}/projects/${enc(id)}/sources`),
  files: (id: string) => request<ProjectFile[]>(`${V1}/projects/${enc(id)}/files`),
  ingestions: (id: string) => request<Ingestion[]>(`${V1}/projects/${enc(id)}/ingestions`),
};

export const chatApi = {
  query: async (payload: QueryRequest) => {
    const { data, trace } = await requestTraced<QueryResponse>(`${V1}/query`, { method: "POST", body: payload });
    return { ...data, trace };
  },
  compare: async (payload: CompareRequest) => {
    const { data, trace } = await requestTraced<CompareResponse>(`${V1}/compare`, { method: "POST", body: payload });
    return { ...data, trace };
  },
  conversations: (projectId: string) =>
    request<Conversation[]>(`${V1}/conversations?project_id=${enc(projectId)}`),
  messages: (conversationId: string) =>
    request<Message[]>(`${V1}/conversations/${enc(conversationId)}/messages`),
};

export const ingestApi = {
  documents: (projectId: string, files: File[]) => {
    const fd = new FormData();
    fd.append("project_id", projectId);
    files.forEach((f) => fd.append("files", f));
    return request<DocumentsIngestResponse>(`${V1}/documents/ingest`, { method: "POST", formData: fd });
  },
  branches: (repositoryUrl: string) =>
    request<BranchesResponse>(`${V1}/repositories/branches`, {
      method: "POST",
      body: { repository_url: repositoryUrl },
    }),
  repository: (projectId: string, repositoryUrl: string, branches: string[]) =>
    request<RepoIngestResponse>(`${V1}/repositories/ingest`, {
      method: "POST",
      body: { project_id: projectId, repository_url: repositoryUrl, branches },
    }),
  commits: (repositoryUrl: string, branch?: string, limit = 20) =>
    request<CommitsResponse>(`${V1}/repositories/commits`, {
      method: "POST",
      body: { repository_url: repositoryUrl, limit, ...(branch ? { branch } : {}) },
    }),
  ingestCommits: (projectId: string, repositoryUrl: string, commits: string[]) =>
    request<CommitsIngestResponse>(`${V1}/repositories/commits/ingest`, {
      method: "POST",
      body: { project_id: projectId, repository_url: repositoryUrl, commits },
    }),
};

export const systemApi = {
  status: () => request<StatusResponse>(`${V1}/status`),
  activity: (since?: string) =>
    request<ActivityEvent[]>(`${V1}/activity${since ? `?since=${enc(since)}` : ""}`),
};
