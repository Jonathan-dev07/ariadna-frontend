import type { User } from "./types";

// Mismo esquema que el frontend de pruebas del back: el token y el usuario viven
// en sessionStorage (se borran al cerrar la pestaña) y viajan en el header
// Authorization. El back cierra la sesión tras 20 min sin actividad.

const TOKEN_KEY = "si_token";
const USER_KEY = "si_user";
const API_KEY = "si_api_base";
const PROJECT_KEY = "si_project";

// "/" (lo pone next.config.ts al compilar) = mismo origen: las llamadas pasan por server.js, que las
// reenvía al back y genera las trazas para Grafana. Queda como cadena vacía.
export const DEFAULT_API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://32.196.100.44:8000"
).replace(/\/$/, "");

export const USES_PROXY = DEFAULT_API_URL === "";

const hasWindow = () => typeof window !== "undefined";

function read(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  if (!hasWindow()) return;
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* almacenamiento bloqueado: la sesión dura solo mientras la página esté abierta */
  }
}

export const session = {
  getToken: () => read(TOKEN_KEY),
  getUser: (): User | null => {
    const raw = read(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  save(token: string, user: User) {
    write(TOKEN_KEY, token);
    write(USER_KEY, JSON.stringify(user));
  },
  saveUser(user: User) {
    write(USER_KEY, JSON.stringify(user));
  },
  clear() {
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
  },

  /** URL del back; se puede cambiar desde la pantalla de acceso (útil para probar local). */
  getApiBase: () => read(API_KEY) ?? DEFAULT_API_URL,
  setApiBase(url: string) {
    const clean = url.trim().replace(/\/$/, "");
    write(API_KEY, clean && clean !== DEFAULT_API_URL ? clean : null);
  },

  getProject: () => read(PROJECT_KEY),
  setProject: (id: string | null) => write(PROJECT_KEY, id),
};
