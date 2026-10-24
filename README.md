# Ariadna · Asistente de Software Intelligence

Repositorio: `si-frontend`.

Ariadna es el frontend de la plataforma RAG **Software Intelligence** (UMG), hecho con
**Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4**.
Consume la API de [`si-backend`](../si-backend-main) y reemplaza al frontend de
pruebas `FILE_MON` (un solo `index.html`).

## Requisitos

- Node.js 20 o superior (`node -v`)
- El back corriendo: el oficial en AWS (`http://32.196.100.44:8000`) o uno local en `http://localhost:8000`

## Correrlo en tu máquina

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Por defecto apunta al back oficial en AWS (`http://32.196.100.44:8000`).
Para usar otro back, tienes dos opciones:

- Copia `.env.example` como `.env.local` y cambia `NEXT_PUBLIC_API_URL` (reinicia `npm run dev`).
- O en la pantalla de acceso abre **Servidor** y escribe la URL (solo en `npm run dev`; se guarda en esa pestaña).

> El back solo acepta orígenes listados en `CORS_ORIGINS` de su `.env`.
> `http://localhost:3000` ya viene por defecto; para producción hay que agregar el dominio del frontend.

## Estructura

```
src/
├── app/                      Rutas (cada carpeta es una URL)
│   ├── login/  registro/     Acceso
│   └── (app)/                Todo lo que requiere sesión
│       ├── chat/             Preguntar al RAG (conversaciones, alcance, fuentes)
│       ├── comparar/         Comparar dos ramas  → POST /compare
│       ├── contenido/        Qué está indexado   → /projects/{id}/sources y /files
│       ├── estado/           Salud del RAG y métricas → /status
│       ├── accesos/          Historial de inicios de sesión
│       └── admin/            Solo admin: proyectos, indexar, usuarios
├── components/               AppShell (barra superior), ProjectPicker, chat/, ui/
├── context/                  AuthProvider (sesión), ProjectProvider (proyecto activo + avisos), ToastProvider
├── hooks/                    useProjectSources, useElapsed
└── lib/
    ├── api.ts                Todas las llamadas al back, agrupadas como sus routers
    ├── types.ts              Tipos copiados de app/schemas.py del back
    ├── session.ts            Token y usuario en sessionStorage
    ├── format.ts             Fechas, tamaños, enlaces a GitHub de las fuentes
    └── tracing.ts            traceparent, Server-Timing y envío de tramos a Grafana
server.js                     Servidor de producción: app + puente al back + trazas
```

Si el back cambia un endpoint, normalmente solo hay que tocar `lib/types.ts` y `lib/api.ts`.

## Cómo funciona en producción (server.js)

```
navegador ──► server.js (contenedor del front) ──► si-backend (AWS) ──► Mongo / RAG
                 │
                 └──► Grafana (trazas OpenTelemetry)
```

- `npm run dev` llama **directo** al back (útil para programar). No genera trazas.
- `npm run build` (ver `next.config.ts`) compila con `NEXT_PUBLIC_API_URL=/`: la app llama a `/api/...` del
  mismo servidor, y `server.js` lo reenvía al back. Así no hay CORS ni problemas de `https` → `http`.
- Cada llamada lleva un `traceparent` (W3C). `server.js` continúa la traza hacia el back y envía
  los tramos a Grafana; con el mismo ID se ve el recorrido completo en **Explore → Tempo**.
- En la app: botón **Ver ruta** bajo cada respuesta y sección **Trazas y Grafana** en Estado.

Variables del contenedor (las mismas que FILE_LAB):

| Variable | Ejemplo | Para qué |
|---|---|---|
| `BACKEND_URL` | `http://32.196.100.44:8000` | Back de destino (ya viene por defecto) |
| `PORT` | `8080` | Puerto del servidor |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | el de Grafana | Activa el envío de trazas |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Basic …` | Credencial de Grafana (secreto: no subir a Git) |
| `GRAFANA_TRACE_URL` | URL de Explore con `{traceId}` | Para los enlaces "Abrir en Grafana" |

Probarlo igual que en producción, en tu máquina:

```bash
npm run serve        # compila y levanta server.js en http://localhost:8080
```

## Publicarlo con Docker (AWS)

```bash
docker build -t si-frontend .
docker run -d --name si-frontend --restart unless-stopped -p 3000:8080 \
  -e OTEL_EXPORTER_OTLP_ENDPOINT="https://..." \
  -e OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic ..." \
  -e GRAFANA_TRACE_URL="https://.../explore?...{traceId}..." \
  si-frontend
```

Queda en `http://<ip-del-servidor>:3000`. El puerto debe estar abierto en el Security Group.

## Sesión

El token JWT se guarda en `sessionStorage` y se manda en `Authorization: Bearer …`. El back
cierra la sesión tras 20 minutos sin actividad; cuando responde 401, la app vuelve sola a la
pantalla de acceso con el aviso.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo con recarga en caliente (llama directo al back) |
| `npm run build` | Compila la app en `out/` |
| `npm run start` | Levanta `server.js` (requiere `npm run build` antes) |
| `npm run serve` | `build` + `start`: igual que producción |
| `npm run typecheck` | Revisa los tipos de TypeScript |
