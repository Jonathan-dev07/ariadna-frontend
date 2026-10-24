"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { DEFAULT_API_URL, USES_PROXY, session } from "@/lib/session";
import { cn } from "@/lib/format";

/** Marco común de "Iniciar sesión" y "Crear cuenta". */
export function AuthLayout({ mode, children }: { mode: "login" | "register"; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(400px,44%)_1fr]">
      <aside className="relative hidden flex-col justify-center gap-7 bg-ink px-14 py-14 text-white lg:flex">
        <span
          aria-hidden
          className="absolute inset-y-0 right-0 w-1.5 bg-[linear-gradient(var(--color-seal)_0_50%,var(--color-gold)_50%_100%)]"
        />
        <img src="/sello.png" alt="Sello de la Universidad Mariano Gálvez" width={150} height={150} />
        <div>
          <p className="font-serif text-lg text-[#c5d6e3]">Universidad Mariano Gálvez de Guatemala</p>
          <h1 className="mt-2 font-serif text-[52px] leading-[1.05] font-bold text-white">Ariadna</h1>
          <p className="mt-1 font-serif text-xl text-[#e3c27a]">Asistente de Software Intelligence</p>
        </div>
        <p className="max-w-[36ch] text-lg text-[#c5d6e3]">
          Pregúntale a tus proyectos: el código de cada rama, sus commits y su documentación, con la fuente de cada
          respuesta.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 text-center lg:hidden">
            <img src="/sello.png" alt="" width={80} height={80} className="mx-auto mb-3" />
            <p className="font-serif text-2xl font-bold text-ink">Ariadna</p>
            <p className="font-serif text-muted">Asistente de Software Intelligence · UMG</p>
          </div>

          <div className="mb-6 flex rounded-lg bg-[#e4ebf1] p-1" role="tablist">
            {(
              [
                ["login", "Iniciar sesión", "/login/"],
                ["register", "Crear cuenta", "/registro/"],
              ] as const
            ).map(([key, label, href]) => (
              <Link
                key={key}
                href={href}
                role="tab"
                aria-selected={mode === key}
                className={cn(
                  "flex-1 rounded-md py-2 text-center font-semibold transition-colors",
                  mode === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                )}
              >
                {label}
              </Link>
            ))}
          </div>

          {children}
          {/* Con server.js el back se configura en el servidor (BACKEND_URL), no aquí */}
          {!USES_PROXY && <ServerSetting />}
        </div>
      </main>
    </div>
  );
}

/** Permite apuntar a otro backend (local, staging) sin recompilar, como en el frontend de pruebas. */
function ServerSetting() {
  const [value, setValue] = useState(DEFAULT_API_URL);
  // Se lee después de montar: la página se pre-genera sin acceso a sessionStorage.
  useEffect(() => setValue(session.getApiBase()), []);
  const custom = value.replace(/\/$/, "") !== DEFAULT_API_URL;

  return (
    <details className="mt-8 text-sm text-muted">
      <summary className="cursor-pointer select-none">
        Servidor{custom && <span className="ml-1 text-gold">(personalizado)</span>}
      </summary>
      <label htmlFor="api-base" className="label mt-3">
        URL del backend
      </label>
      <input
        id="api-base"
        className="input font-mono text-[13px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => session.setApiBase(value)}
        spellCheck={false}
      />
      <p className="mt-1.5">Para probar contra el back en tu máquina usa http://localhost:8000.</p>
    </details>
  );
}
