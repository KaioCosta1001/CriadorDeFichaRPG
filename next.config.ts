import type { NextConfig } from "next";

/**
 * NOTA SOBRE A CSP
 *
 * A CSP **estrit** n��o mora mais aqui: vive em `src/proxy.ts`, que gera um
 * `nonce` por requisição e o injeta nos scripts do App Router.
 *
 * A consequência prática desta mudança: `script-src` deixou de ter
 * `'unsafe-inline'`. Com isso, um `<script>` injetado por qualquer falha de
 * escaping **n��o executa** — a prote��ão contra XSS deixa de ser nominal.
 *
 * O que continua aqui s��o os cabeçalhos que n��o dependem de requisição.
 */
const nextConfig: NextConfig = {
  // Não anuncia a versão do Next.js nos headers HTTP.
  poweredByHeader: false,

  // O Tailwind v4 é processado pelo loader nativo do Turbopack (não PostCSS).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────
  // `cacheComponents` e `partialPrefetching` foram desligados de propósito.
  // O app é 100% client-side (dados no localStorage, sem fetch no servidor):
  // cache de renderização do servidor não agrega nada e apenas introduz
  // erros de build do tipo "dados não cacheados fora de <Suspense>".
  // Decision registrada na Fase 1.
  // ─────────────────────────────────────────────────────────────────────

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede que o navegador "adivinhe" o tipo de um arquivo e o
          // interprete (ex.: texto como JavaScript).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Não vaza a URL completa da ficha para sites de terceiros.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Controle de framing (redundante com frame-ancestors, mas cobre
          // navegadores antigos que ignoram a diretiva).
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
