// Tipos tomados de si-backend-main/app/schemas.py.
// Si el back cambia un schema, este es el único archivo que hay que ajustar.

import type { TraceEntry } from "./tracing";

export type Role = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  user: User;
}

export interface LoginHistoryEntry {
  success: boolean;
  timestamp: string;
  ip_address: string | null;
  user_agent: string | null;
}

// ---------- Proyectos ----------
export interface Project {
  project_id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface ProjectCreate {
  name: string;
  project_id?: string;
  description?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string | null;
}

export interface ProjectFile {
  filename: string;
  extension: string;
  size_bytes: number | null;
  content_type: string | null;
  version: number;
  uploaded_by: string | null;
  uploaded_at: string;
  first_uploaded_at: string | null;
}

export interface Ingestion {
  type: "document" | "repository" | "commit" | string;
  source: string;
  branches: string[] | null;
  commits: string[] | null;
  files_processed: number | null;
  chunks_created: number | null;
  created_by: string;
  created_at: string;
}

export interface ProjectSources {
  project_id: string;
  repositories: {
    name: string;
    chunks: number;
    branches: { name: string; commit: string | null; chunks: number }[];
    commits: { sha: string; message: string | null; chunks: number }[];
  }[];
  documents: { name: string; artifact_type: string | null; chunks: number }[];
  total_chunks: number;
}

// ---------- Consultas ----------
export interface Source {
  chunk_id?: number | null;
  source_type?: string | null;
  source?: string | null;
  repository?: string | null;
  document?: string | null;
  branch?: string | null;
  commit?: string | null;
  file_path?: string | null;
  line_start?: number | null;
  line_end?: number | null;
  page?: number | null;
  tab?: string | null;
  artifact_type?: string | null;
  score?: number | null;
}

/** Un solo alcance a la vez: el RAG no acepta combinaciones. */
export type QueryScope =
  | { type: "project" }
  | { type: "branches"; branches: string[] }
  | { type: "document"; document: string }
  | { type: "commit"; commit: string; repository?: string };

export interface QueryRequest {
  project_id: string;
  question: string;
  conversation_id?: string | null;
  branches?: string[];
  document?: string;
  commit?: string;
  repository?: string;
}

export interface QueryResponse {
  conversation_id: string;
  project_id: string;
  question: string;
  answer: string;
  sources: Source[];
  context_chunks_used?: number | null;
  provider?: string | null;
  model?: string | null;
  response_time_ms?: number | null;
}

export interface Message {
  question: string;
  answer: string;
  sources: Source[];
  created_at: string;
  // Solo vienen en la respuesta inmediata de /query, no en el historial
  model?: string | null;
  response_time_ms?: number | null;
  context_chunks_used?: number | null;
  /** Traza de la llamada (solo con server.js): para "Ver ruta" y Grafana */
  trace?: TraceEntry | null;
}

export interface Conversation {
  conversation_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

export interface CompareRequest {
  project_id: string;
  repository_url: string;
  branch_a: string;
  branch_b: string;
  question: string;
}

export interface CompareResponse extends Omit<QueryResponse, never> {
  repository: string | null;
  branch_a: string;
  branch_b: string;
  changes: { status: string | null; path: string | null; previous_path: string | null }[];
}

// ---------- Repositorios y documentos ----------
export interface BranchesResponse {
  repository: string;
  default_branch?: string | null;
  branches: { name: string }[];
}

export interface RepoIngestResponse {
  branches?: { name: string; files_processed: number; chunks_created: number }[];
  total_files?: number;
  total_chunks?: number;
}

export interface Commit {
  sha: string;
  message: string;
  authored_at: string;
}

export interface CommitsResponse {
  repository: string;
  branch: string | null;
  commits: Commit[];
}

export interface CommitsIngestResponse {
  project_id: string;
  repository: string;
  commits: { sha: string; message: string; files_processed: number; chunks_created: number }[];
  total_files: number;
  total_chunks: number;
}

export interface DocumentsIngestResponse {
  documents?: { name: string; chunks_created: number; artifact_type: string | null }[];
  total_chunks?: number;
}

// ---------- Estado y actividad ----------
export interface StatusResponse {
  rag: {
    status?: string | null;
    database?: string | null;
    vector_store?: string | null;
    embedding_service?: string | null;
    embedding_provider?: string | null;
    embedding_model?: string | null;
    llm_service?: string | null;
    llm_provider?: string | null;
    llm_model?: string | null;
  } | null;
  rag_error: string | null;
  rag_metrics: {
    total_queries?: number | null;
    successful_queries?: number | null;
    failed_queries?: number | null;
    average_response_time_ms?: number | null;
  } | null;
  rag_metrics_error: string | null;
  backend: {
    total_users: number;
    total_projects: number;
    total_conversations: number;
    total_queries: number;
    average_response_time_ms: number | null;
  };
}

export interface ActivityEvent {
  type: "project_created" | "document" | "repository" | "commit" | string;
  project_id: string | null;
  project_name: string | null;
  source: string | null;
  created_at: string;
}
