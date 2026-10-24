import type { Source } from "./types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const dateTime = new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" });

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateTime.format(d);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateOnly.format(d);
}

/** "hace 5 min", "ayer"… para listas donde la fecha exacta importa menos. */
export function timeAgo(value: string) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ayer";
  return formatDate(value);
}

export function formatBytes(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function formatMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Si pegan "github.com/user/repo" sin esquema, git lo rechaza: se agrega https://. */
export function normalizeRepoUrl(raw: string) {
  const url = raw.trim();
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** "owner/repo" a partir de una URL de GitHub o de un nombre ya en ese formato. */
export function githubSlug(repo: string | null | undefined): string | null {
  if (!repo) return null;
  const fromUrl = repo.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i);
  if (fromUrl) return fromUrl[1];
  if (/^[\w.-]+\/[\w.-]+$/.test(repo)) return repo;
  return null;
}

/** Enlace directo al archivo y líneas en GitHub, cuando la fuente trae lo necesario. */
export function sourceLink(s: Source): string | null {
  const slug = githubSlug(s.repository);
  const ref = s.commit || s.branch;
  if (!slug || !ref || !s.file_path) return null;
  const path = s.file_path.replace(/^\/+/, "");
  let url = `https://github.com/${slug}/blob/${encodeURIComponent(ref)}/${path}`;
  if (s.line_start) url += `#L${s.line_start}${s.line_end && s.line_end !== s.line_start ? `-L${s.line_end}` : ""}`;
  return url;
}

export function sourceLabel(s: Source) {
  return s.file_path || s.document || s.source || "Fuente";
}

export function sourceDetail(s: Source) {
  const parts: string[] = [];
  if (s.branch) parts.push(s.branch);
  else if (s.commit) parts.push(s.commit.slice(0, 7));
  if (s.line_start) parts.push(`L${s.line_start}${s.line_end && s.line_end !== s.line_start ? `–${s.line_end}` : ""}`);
  if (s.page) parts.push(`pág. ${s.page}`);
  if (s.tab) parts.push(s.tab);
  return parts.join(" · ");
}
