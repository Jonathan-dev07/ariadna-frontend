"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authApi, setSessionEndedHandler, usersApi } from "@/lib/api";
import { session } from "@/lib/session";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  /** false mientras se revisa si hay una sesión guardada */
  ready: boolean;
  /** Mensaje para la pantalla de acceso (ej. sesión expirada) */
  notice: string | null;
  clearNotice: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Si el back responde 401 (o cuenta inactiva) en cualquier pantalla, se cierra la sesión aquí.
  useEffect(() => {
    setSessionEndedHandler((message) => {
      session.clear();
      setUser(null);
      setNotice(message || "Tu sesión terminó. Inicia sesión de nuevo.");
      router.replace("/login/");
    });
    return () => setSessionEndedHandler(null);
  }, [router]);

  // Al abrir la app: si hay token guardado, se confirma con GET /users/me.
  useEffect(() => {
    const token = session.getToken();
    if (!token) {
      setReady(true);
      return;
    }
    setUser(session.getUser());
    usersApi
      .me()
      .then((me) => {
        setUser(me);
        session.saveUser(me);
      })
      .catch(() => {
        session.clear();
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    session.save(data.access_token, data.user);
    setUser(data.user);
    setNotice(null);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await usersApi.register(name, email, password);
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* aunque falle, se cierra localmente */
    }
    session.clear();
    setUser(null);
    router.replace("/login/");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAdmin: user?.role === "admin",
      ready,
      notice,
      clearNotice: () => setNotice(null),
      login,
      register,
      logout,
    }),
    [user, ready, notice, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
