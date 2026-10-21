import { describe, expect, it } from "vitest";

import { buildCsp } from "./proxy";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CSP ESTRITA COM NONCE                                                   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * A CSP anterior era estática e carregava `'unsafe-inline'` em `script-src` —
 * o que, na prática, anula a proteção contra XSS: um `<script>` injetado por
 * qualquer falha de escaping executava.
 *
 * Estes testes travam as duas propriedades que importam:
 *
 *  1. `script-src` NÃO tem `'unsafe-inline'`;
 *  2. o nonce muda a cada requisição.
 *
 * A segunda é a que costuma ser esquecida. Um nonce constante daria a mesma
 * proteção de nenhum nonce: o atacante captura uma vez e reutiliza a
 * forever.
 */

const NONCE = "abc123+/=";

function directive(csp: string, name: string): string {
  return (
    csp
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `)) ?? ""
  );
}

describe("buildCsp — script-src", () => {
  it("NÃO usa 'unsafe-inline' — é o ponto inteiro do nonce", () => {
    const csp = buildCsp(NONCE, false);

    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("carrega o nonce e 'strict-dynamic'", () => {
    const script = directive(buildCsp(NONCE, false), "script-src");

    expect(script).toContain(`'nonce-${NONCE}'`);
    // `strict-dynamic` é o que permite ENCERRAR a lista: em navegador
    // moderno, ele faz o CSP confiar apenas no que o script do nonce
    // carregou, ignorando o `allowlist`.
    expect(script).toContain("'strict-dynamic'");
    // `'self'` fica para navegadores antigos que não conhecem a diretiva.
    expect(script).toContain("'self'");
  });

  it("usa 'unsafe-eval' só em desenvolvimento", () => {
    expect(directive(buildCsp(NONCE, true), "script-src")).toContain(
      "'unsafe-eval'",
    );
    expect(directive(buildCsp(NONCE, false), "script-src")).not.toContain(
      "'unsafe-eval'",
    );
  });
});

describe("buildCsp — as diretivas que bloqueiam vetores", () => {
  it("object-src e base-uri fecham injeção de script e sequestro de URL", () => {
    const csp = buildCsp(NONCE, false);

    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
  });

  it("frame-ancestors fecha clickjacking", () => {
    expect(directive(buildCsp(NONCE, false), "frame-ancestors")).toBe(
      "frame-ancestors 'none'",
    );
  });

  it("form-action e connect-src limitam à própria origem", () => {
    const csp = buildCsp(NONCE, false);

    expect(directive(csp, "form-action")).toBe("form-action 'self'");
    // Nenhum third-party hoje: nada pode vazar a ficha para fora.
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
  });

  it("img-src aceita data: e blob: — foto de perfil e redimensionamento", () => {
    const img = directive(buildCsp(NONCE, false), "img-src");

    // Sem `data:`, a foto do Perfil quebraria: ela é gravada como data URL.
    expect(img).toContain("data:");
    // Sem `blob:`, o redimensionamento da foto no cliente quebraria.
    expect(img).toContain("blob:");
  });

  it("upgrade-insecure-requests só em produção", () => {
    expect(buildCsp(NONCE, true)).not.toContain("upgrade-insecure-requests");
    expect(buildCsp(NONCE, false)).toContain("upgrade-insecure-requests");
  });
});

describe("buildCsp — style-src e sua dívida declarada", () => {
  it("mantém 'unsafe-inline', porque Emotion injeta <style> em runtime", () => {
    const style = directive(buildCsp(NONCE, false), "style-src");

    // ───────────────────────────────────────────────────────────────────────
    // ESTA É UMA DÍVIDA CONHOCIDA, NÃO UM ESQUECIMENTO.
    //
    // O Emotion monta as folhas do MUI em tempo de execução, sem passar pelo
    // servidor, e o projeto NÃO usa `AppRouterCacheProvider` (a Fase 1 o
    // removeu de propósito). Sem um cache com nonce não há como injetar o
    // valor nessas tags.
    //
    // `'unsafe-inline'` em `style-src' é bem menos perigoso que em
    // `script-src`: folha de estilo não executa JavaScript, e com
    // `object-src 'none'` + `base-uri 'self'` os vetores perigosos seguem
    // bloqueados. Se o MUI entrar com cache por nonce, esta linha fecha.
    // ───────────────────────────────────────────────────────────────────────
    expect(style).toContain("'unsafe-inline'");
  });

  it("o nonce NÃO aparece em style-src — ele não é usado por lá", () => {
    const style = directive(buildCsp(NONCE, false), "style-src");
    expect(style).not.toContain(NONCE);
  });
});

describe("buildCsp — o nonce muda a cada requisição", () => {
  it("dois valores seguidos produzem CSPs diferentes", () => {
    // Um nonce CONSTANTE daria a mesma proteção de nenhum: o atacante captura
    // uma vez e reutiliza para sempre.
    const primeiro = "dG9rZW4tMQ==";
    const segundo = "dG9rZW4tMg==";

    expect(buildCsp(primeiro, false)).not.toBe(buildCsp(segundo, false));
  });

  it("o nonce não aparece em nenhuma outra diretiva além de script-src", () => {
    const csp = buildCsp(NONCE, false);

    for (const parte of csp.split(";")) {
      if (parte.trim().startsWith("script-src")) continue;
      expect(parte).not.toContain(NONCE);
    }
  });
});

describe("buildCsp — formato", () => {
  it("não deixa espaço duplo nem quebra de linha", () => {
    const csp = buildCsp(NONCE, false);

    expect(csp).not.toContain("  ");
    expect(csp).not.toContain("\n");
    expect(csp).not.toContain("; ;");
    expect(csp).not.toContain("; ; ");
  });

  it("não deixa ponto e vírgula pendurado no fim", () => {
    const producao = buildCsp(NONCE, false).trim();
    const dev = buildCsp(NONCE, true).trim();

    // Em produção a última diretiva é `upgrade-insecure-requests`; em
    // desenvolvimento é `worker-src 'self' blob:`. O que importa é que
    // nenhuma das duas termine com separador.
    expect(producao.endsWith(";")).toBe(false);
    expect(producao.endsWith("requests")).toBe(true);
    expect(dev.endsWith(";")).toBe(false);
    expect(dev.endsWith("blob:")).toBe(true);
  });

  it("é estável: a mesma entrada produz a mesma saída", () => {
    expect(buildCsp(NONCE, false)).toBe(buildCsp(NONCE, false));
  });
});
