import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// La app se exporta como sitio estático (carpeta out/) y la sirve server.js, que además
// reenvía /api/* al back y manda las trazas a Grafana.
//
// - `npm run dev`: el navegador llama directo al back (NEXT_PUBLIC_API_URL o la IP de AWS).
// - `npm run build` (y Docker): NEXT_PUBLIC_API_URL = "/" → las llamadas van al mismo
//   servidor (server.js). Se puede forzar otro valor definiendo la variable al compilar.
export default function config(phase: string): NextConfig {
  const isBuild = phase === PHASE_PRODUCTION_BUILD;
  return {
    output: "export",
    trailingSlash: true,
    images: { unoptimized: true },
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (isBuild ? "/" : ""),
    },
  };
}
