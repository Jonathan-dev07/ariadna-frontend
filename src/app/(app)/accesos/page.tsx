"use client";

import { useEffect, useState } from "react";
import { Page } from "@/components/AppShell";
import { Badge, ErrorNote, Loading, PageHeader } from "@/components/ui/Feedback";
import { authApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { LoginHistoryEntry } from "@/lib/types";

/** Resume el user-agent en algo legible: "Chrome en Windows". */
function describeAgent(ua: string | null) {
  if (!ua) return "—";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /python|curl|httpx/i.test(ua) ? "Script" : "Otro";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} en ${os}` : browser;
}

export default function AccessHistoryPage() {
  const [rows, setRows] = useState<LoginHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .loginHistory(50)
      .then(setRows)
      .catch((e) => setError((e as Error).message));
  }, []);

  const failures = rows?.filter((r) => !r.success).length ?? 0;

  return (
    <Page>
      <PageHeader
        title="Historial de accesos"
        description="Los últimos inicios de sesión con tu cuenta. Si ves uno que no reconoces, pide a un administrador que cambie tu contraseña."
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!rows && !error && <Loading />}
      {rows && (
        <>
          {failures > 0 && (
            <p className="mb-3 text-sm text-gold">
              {failures === 1 ? "Hay 1 intento fallido" : `Hay ${failures} intentos fallidos`} en esta lista.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[560px] text-[15px]">
              <thead className="bg-panel-2 text-left text-sm text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Fecha</th>
                  <th className="px-4 py-2.5 font-semibold">Resultado</th>
                  <th className="px-4 py-2.5 font-semibold">IP</th>
                  <th className="px-4 py-2.5 font-semibold">Dispositivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDateTime(r.timestamp)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.success ? "ok" : "fail"}>{r.success ? "Correcto" : "Fallido"}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[13px] text-muted">{r.ip_address ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted" title={r.user_agent ?? undefined}>
                      {describeAgent(r.user_agent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Page>
  );
}
