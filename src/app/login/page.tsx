"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Feedback";
import { useAuth } from "@/context/AuthProvider";

export default function LoginPage() {
  const { login, user, ready, notice, clearNotice } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/chat/");
  }, [ready, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    clearNotice();
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/chat/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout mode="login">
      <h2 className="mb-5 text-[26px] font-bold">Iniciar sesión</h2>
      {(error || notice) && <ErrorNote className="mb-4">{error || notice}</ErrorNote>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Correo
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          Entrar
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">La sesión se cierra sola después de 20 minutos sin actividad.</p>
    </AuthLayout>
  );
}
