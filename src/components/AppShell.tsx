"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { cn } from "@/lib/format";

interface NavItem {
  href: string;
  label: string;
  admin?: boolean;
}

const NAV: NavItem[] = [
  { href: "/chat/", label: "Preguntar" },
  { href: "/comparar/", label: "Comparar ramas" },
  { href: "/contenido/", label: "Contenido" },
  { href: "/estado/", label: "Estado" },
  { href: "/admin/proyectos/", label: "Proyectos", admin: true },
  { href: "/admin/indexar/", label: "Indexar", admin: true },
  { href: "/admin/usuarios/", label: "Usuarios", admin: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userOpen) return;
    const close = (e: MouseEvent) => !userRef.current?.contains(e.target as Node) && setUserOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [userOpen]);

  const items = NAV.filter((n) => !n.admin || isAdmin);
  const isActive = (href: string) => pathname === href || pathname === href.replace(/\/$/, "");

  return (
    <div className="flex h-dvh flex-col">
      <header className="relative z-30 shrink-0 border-b-[3px] border-seal bg-ink text-white">
        <div className="flex h-16 items-center gap-4 px-4 sm:px-5">
          <Link href="/chat/" className="flex shrink-0 items-center gap-3">
            <img src="/sello.png" alt="" width={40} height={40} />
            <span className="leading-tight">
              <span className="block font-serif text-[20px] font-bold">Ariadna</span>
              <span className="hidden text-[12.5px] text-[#b9ccdb] sm:block">Asistente de Software Intelligence</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 xl:flex" aria-label="Principal">
            {items.map((n, i) => (
              <span key={n.href} className="flex items-center">
                {n.admin && !items[i - 1]?.admin && <span aria-hidden className="mx-2 h-5 w-px bg-white/25" />}
                <Link
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[15px] transition-colors",
                    isActive(n.href) ? "bg-white/15 font-semibold text-white" : "text-[#c5d6e3] hover:bg-white/10 hover:text-white"
                  )}
                >
                  {n.label}
                </Link>
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div ref={userRef} className="relative">
              <button
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/10"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-white/15 font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-[160px] truncate text-[15px] sm:inline">{user?.name}</span>
                {isAdmin && (
                  <span className="hidden rounded-full bg-gold px-2 py-px text-xs font-semibold sm:inline">admin</span>
                )}
              </button>
              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-line bg-white text-text shadow-xl"
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="truncate font-semibold text-ink">{user?.name}</p>
                    <p className="truncate text-sm text-muted">{user?.email}</p>
                  </div>
                  <Link role="menuitem" href="/accesos/" className="block px-4 py-2.5 hover:bg-panel-2">
                    Historial de accesos
                  </Link>
                  <button role="menuitem" onClick={logout} className="block w-full px-4 py-2.5 text-left text-danger hover:bg-panel-2">
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
            <button
              className="rounded-md border border-white/30 px-3 py-1.5 xl:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
            >
              Menú
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="mobile-nav" className="border-t border-white/15 px-3 pt-2 pb-3 xl:hidden" aria-label="Principal">
            {items.map((n, i) => (
              <div key={n.href}>
                {n.admin && !items[i - 1]?.admin && (
                  <p className="px-3 pt-3 pb-1 text-sm text-[#c5d6e3]">Administración</p>
                )}
                <Link
                  href={n.href}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-2.5",
                    isActive(n.href) ? "bg-white/15 font-semibold" : "text-[#dbe6ee] hover:bg-white/10"
                  )}
                >
                  {n.label}
                </Link>
              </div>
            ))}
          </nav>
        )}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

/** Contenedor estándar para pantallas con scroll (todas menos el chat). */
export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cn("mx-auto px-4 py-8 sm:px-6", wide ? "max-w-6xl" : "max-w-4xl")}>{children}</div>
    </div>
  );
}
