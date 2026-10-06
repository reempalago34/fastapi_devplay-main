import type { NextConfig } from "next";

// Headers de seguridad 🛡️ (tarea 33: blindaje anti-bots/hackers)
// Nota: NO usamos X-Frame-Options: DENY porque el preview panel embebe la app
// en un iframe; en su lugar CSP frame-ancestors con allowlist.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next inyecta scripts inline y en dev necesita eval; React/framer-motion usan estilos inline
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // connect-src necesita la API de FastAPI (dev en 8000, prod via /api)
      "connect-src 'self' http://localhost:8000 ws://localhost:8000 https://*.supabase.co wss:",
      "frame-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // Preview panel de space-z.ai + mismo origen
      "frame-ancestors 'self' https://*.space-z.ai https://*.z.ai",
    ].join("; "),
  },
];

// Proxy del chat en tiempo real para desarrollo/preview:
// en producción Caddy enruta ?XTransformPort=3003, pero en dev no hay Caddy.
// En Docker (Coolify) el web apunta al servicio `realtime` por la red de compose:
// se configura con REALTIME_PROXY_URL=http://realtime:3003 (ver docker-compose.yml).
// Socket.io (engine.io) manda siempre el query param EIO — lo reenviamos al
// mini-servicio de tiempo real. Si el upgrade de websocket no atraviesa el
// proxy, el cliente hace fallback a polling automáticamente.
//
// OJO: si REALTIME_PROXY_URL no está definido NO hay proxy. Sin ese servicio el
// rewrite mandaba cada intento de socket a un puerto muerto y llenaba la consola
// de 500. El chat sigue funcionando por REST (GET/POST /api/v1/chat).
const realtimeProxy: string | undefined = process.env.REALTIME_PROXY_URL;

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Fijamos la raiz de Turbopack: sin esto Next detecta varios lockfiles
  // (bun.lock en la raiz de devplay/ y package-lock.json aqui) y se confunde
  // resolviendo modulos de `next` contra dos instalaciones distintas.
  turbopack: {
    root: process.cwd(),
  },
  // Permitir origins del preview panel
  allowedDevOrigins: ["*.space-z.ai", "*.z.ai"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    // Sin servicio de tiempo real no hay proxy. Antes mandabamos cada intento de
    // socket a localhost:3003 (puerto muerto) y llenabamos la consola de 500.
    if (!realtimeProxy) return { beforeFiles: [], afterFiles: [], fallback: [] };
    return {
      beforeFiles: [
        {
          source: "/:path*",
          has: [{ type: "query", key: "EIO", value: ".*" }],
          destination: `${realtimeProxy}/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
