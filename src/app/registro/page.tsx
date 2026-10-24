"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/Feedback";
import { useAuth } from "@/context/AuthProvider";

export default function RegisterPage() {
  const { register, user, ready } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/chat/");
  }, [ready, user, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Mismas reglas que UserCreate en el back
    if (name.trim().length < 2) return setError("Escribe tu nombre (mínimo 2 caracteres).");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/chat/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout mode="register">
      <h2 className="mb-5 text-[26px] font-bold">Crear cuenta</h2>
      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Nombre completo
          </label>
          <input id="name" autoComplete="name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="password" className="label">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="label">
              Repítela
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <p className="text-sm text-muted">Mínimo 8 caracteres.</p>
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          Crear cuenta
        </Button>
      </form>
    </AuthLayout>
  );
}
