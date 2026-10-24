"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Page } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge, ErrorNote, Loading, PageHeader } from "@/components/ui/Feedback";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthProvider";
import { useToast } from "@/context/ToastProvider";
import { usersApi } from "@/lib/api";
import { cn, formatDate } from "@/lib/format";
import type { Role, User } from "@/lib/types";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [deactivate, setDeactivate] = useState<User | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers(await usersApi.list());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function replace(u: User) {
    setUsers((all) => all?.map((x) => (x.id === u.id ? u : x)) ?? null);
  }

  async function changeRole(u: User, role: Role) {
    setBusyId(u.id);
    try {
      replace(await usersApi.update(u.id, { role }));
      toast(`${u.name} ahora es ${role === "admin" ? "administrador" : "usuario"}.`);
    } catch (e) {
      toast(`No se pudo cambiar el rol: ${(e as Error).message}`, "err");
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(u: User, active: boolean) {
    setBusyId(u.id);
    try {
      replace(await usersApi.update(u.id, { active }));
      toast(active ? `${u.name} reactivado.` : `${u.name} desactivado. Su sesión se cerró.`);
      setDeactivate(null);
    } catch (e) {
      toast(`No se pudo actualizar: ${(e as Error).message}`, "err");
    } finally {
      setBusyId(null);
    }
  }

  const q = filter.trim().toLowerCase();
  const shown = (users ?? []).filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  const admins = users?.filter((u) => u.role === "admin").length ?? 0;

  return (
    <Page wide>
      <PageHeader
        title="Usuarios"
        description={users ? `${users.length} cuentas · ${admins} ${admins === 1 ? "administrador" : "administradores"}` : undefined}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            Nuevo usuario
          </Button>
        }
      />

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {!users && !error && <Loading />}

      {users && (
        <>
          <input
            className="input mb-4 max-w-sm"
            placeholder="Buscar por nombre o correo"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Buscar usuarios"
          />
          <div className="overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full min-w-[760px] text-[15px]">
              <thead className="bg-panel-2 text-left text-sm text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Nombre</th>
                  <th className="px-4 py-2.5 font-semibold">Rol</th>
                  <th className="px-4 py-2.5 font-semibold">Estado</th>
                  <th className="px-4 py-2.5 font-semibold">Alta</th>
                  <th className="px-4 py-2.5 font-semibold">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((u) => {
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className={cn(!u.active && "bg-panel-2 text-muted")}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">
                          {u.name} {isMe && <span className="font-normal text-faint">(tú)</span>}
                        </p>
                        <p className="text-sm text-muted">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="input w-auto min-h-9 py-1 text-sm"
                          value={u.role}
                          disabled={isMe || busyId === u.id}
                          title={isMe ? "No puedes quitarte el rol de administrador a ti mismo" : undefined}
                          onChange={(e) => changeRole(u, e.target.value as Role)}
                          aria-label={`Rol de ${u.name}`}
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={u.active ? "ok" : "fail"}>{u.active ? "Activo" : "Inactivo"}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => setResetFor(u)}>
                            Cambiar contraseña
                          </Button>
                          {u.active ? (
                            <Button size="sm" variant="danger" disabled={isMe || busyId === u.id} onClick={() => setDeactivate(u)}>
                              Desactivar
                            </Button>
                          ) : (
                            <Button size="sm" loading={busyId === u.id} onClick={() => setActive(u, true)}>
                              Reactivar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted">
                      Ningún usuario coincide con “{filter}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(u) => {
          setCreating(false);
          toast(`Cuenta de ${u.name} creada.`);
          load();
        }}
      />
      <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} onDone={(u) => {
        setResetFor(null);
        toast(`Contraseña de ${u.name} cambiada. Su sesión actual se cerró.`);
      }} />
      <ConfirmDialog
        open={!!deactivate}
        danger
        title="Desactivar usuario"
        confirmLabel="Desactivar"
        loading={!!deactivate && busyId === deactivate.id}
        onCancel={() => setDeactivate(null)}
        onConfirm={() => deactivate && setActive(deactivate, false)}
        message={
          <>
            <strong>{deactivate?.name}</strong> ({deactivate?.email}) no podrá iniciar sesión hasta que lo reactives, y su
            sesión actual se cerrará.
          </>
        }
      />
    </Page>
  );
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (u: User) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("user");
      setError(null);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setBusy(true);
    setError(null);
    try {
      // El back crea siempre con rol "user" (es el registro público); si se pidió
      // administrador, se sube el rol en un segundo paso.
      let user = await usersApi.register(name.trim(), email.trim(), password);
      if (role === "admin") {
        try {
          user = await usersApi.update(user.id, { role: "admin" });
        } catch (err) {
          setError(`La cuenta se creó, pero no se pudo hacer administrador: ${(err as Error).message}`);
          return;
        }
      }
      onCreated(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo usuario"
      description="Comparte la contraseña con la persona por un medio seguro; podrá usarla de inmediato."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="user-form" loading={busy}>
            Crear cuenta
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div>
          <label htmlFor="u-name" className="label">
            Nombre
          </label>
          <input id="u-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div>
          <label htmlFor="u-email" className="label">
            Correo
          </label>
          <input id="u-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField id="u-pass" label="Contraseña inicial" value={password} onChange={setPassword} />
          <div>
            <label htmlFor="u-role" className="label">
              Rol
            </label>
            <select id="u-role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }: { user: User | null; onClose: () => void; onDone: (u: User) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassword("");
    setError(null);
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setBusy(true);
    try {
      await usersApi.resetPassword(user.id, password);
      onDone(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title="Cambiar contraseña"
      description={user && <>Para <strong className="text-ink">{user.name}</strong> ({user.email}). Su sesión actual se cerrará.</>}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="reset-form" loading={busy}>
            Cambiar contraseña
          </Button>
        </>
      }
    >
      <form id="reset-form" onSubmit={onSubmit} className="space-y-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <PasswordField id="r-pass" label="Nueva contraseña" value={password} onChange={setPassword} />
      </form>
    </Modal>
  );
}

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          className="input pr-20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={8}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-2 my-auto h-8 rounded px-2 text-sm font-semibold text-accent hover:bg-accent/10"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Mínimo 8 caracteres.</p>
    </div>
  );
}
