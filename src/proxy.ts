import { NextResponse, type NextRequest } from "next/server";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CSP ESTRITA COM NONCE — o que faltava na Fase 1                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A CSP que vivia em `next.config.ts` era estática, e por isso carregava
 * `'unsafe-inline'` em `script-src`. Isso é exatamente o que enfraquece a
 * proteção contra XSS: com `'unsafe-inline'`, um `<script>` injetado por
 * qualquer falha de escaping passa a executar.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM NONCE RESOLVE
 *
 * Um nonce é uma string aleatória, nova a cada requisição. Só os scripts que
 * a carregam executam. Um atacante teria que adivinhar o valor — e ele muda a
 * cada resposta, então o que ele roubou de uma requisição não serve na
 * seguinte.
 *
 * `'strict-dynamic'` vai junto, e é o que permite a lista ENCERRAR:
 *
 *   - navegadores modernos ignoram `allowlist` quando encontram `strict-dynamic`
 *     e passam a confiar apenas no que o script do nonce carregou;
 *   - `'self'` continua na lista para navegadores antigos que não conhecem a
 *     diretiva.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE `style-src` AINDA USA `'unsafe-inline'`
 *
 * A resposta honesta: **Emotion** injeta tags `<style>` em tempo de execução,
 * sem passar pelo servidor, e o projeto não usa `AppRouterCacheProvider`
 * (a Fase 1 o removeu de propósito). Sem um cache com nonce, não há como
 * injetar o valor nesses `<style>`.
 *
 * `'unsafe-inline'` em `style-src` é bem menos perigoso que em `script-src`:
 * a folha de estilo não executa JavaScript. Com `object-src 'none'` e
 * `base-uri 'self'`, os vetores mais perigosos (injeção de script, sequestro
 * de base URL) continuam bloqueados.
 *
 * Fica registrado como dívida: se um dia o MUI entrar com cache por nonce, o
 * `style-src` fecha também. O motivo está aqui para não virar mito.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Nome do cabeçalho em que o nonce viaja para o servidor. */
export const NONCE_HEADER = "x-nonce";

function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

/**
 * Monta o valor da CSP.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UMA FUNÇÃO E NÃO UMA CONSTANTE
 *
 * O nonce muda a cada requisição. Uma constante daria o mesmo valor para
 * todas as respostas — o que anula a proteção: o atacante captura uma vez e
 * reutiliza. Por isso a montagem é feita por requisição, e é TESTÁVEL: os
 * testes da Fase 9 verificam que dois valores seguidos são diferentes.
 * ───────────────────────────────────────────────────────────────────────────
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    // `'unsafe-eval'` é exigido pelo React em desenvolvimento (stack traces
    // melhorados). Em produção, nem React nem Next usam `eval`.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDev ? " 'unsafe-eval'" : ""
    }`,
    // Ver o bloco acima: Emoção injeta <style> em tempo de execução.
    "style-src 'self' 'unsafe-inline'",
    // `data:` para a foto de perfil (data URL) e SVG inline; `blob:` para o
    // redimensionamento no cliente.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Nenhum third-party: só a própria origem.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ]
    .join("; ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp(nonce, isDev);

  // O nonce precisa chegar ao renderizador do servidor para ser colocado nos
  // `<script>` do RSC. Vai no CABEÇALHO DA REQUISIÇÃO, e é lido com
  // `headers()` — a única forma de levar um valor por requisição até um
  // componente.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export const config = {
  matcher: [
    {
      /*
       * Tudo, menos arquivos estáticos e prefetch.
       *
       * - `_next/static` e `_next/image` são assets imutáveis: a CSP neles é
       *   desperdício (e o navegador nem aplica a um sub-recurso servido sem
       *   documento).
       * - prefetch não renderiza HTML: pular evita gerar nonce à toa.
       */
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
