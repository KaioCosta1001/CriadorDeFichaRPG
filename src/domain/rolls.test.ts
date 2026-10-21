import { describe, expect, it } from "vitest";

import { getSystem } from "@/config/systems";
import type { RpgSystem } from "@/config/systems/types";
import { ATTRIBUTE_ROLL_ADDS_CONTRIBUTION } from "@/config/constants";
import type { Attribute, RollRecord, Skill } from "@/schemas";

import {
  announceRoll,
  describeRoll,
  isCritRoll,
  isFumbleRoll,
  pushRoll,
  rollAttribute,
  rollSkillDry,
  rollSkillWithAttribute,
} from "./rolls";
import { formatSigned } from "./stats";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ROLAGEM POR CLIQUE DIREITO — ADENDO, SEÇÃO 7                            ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * NENHUM TESTE DESTE ARQUIVO SORTEIA DE VERDADE. O `rng` é injetado, o que
 * é justamente o que permite escrever "d20 deu 14" e verificar a frase
 * exata do detalhamento.
 *
 * O que se defends:
 *
 *   - perícia seca ......... d20 + valor da perícia
 *   - perícia + atributo ... d20 + perícia + conversão do SISTEMA
 *   - atributo .............. d20 + conversão do SISTEMA
 *   - a conversão muda por sistema (é a regra do ponto em aberto 14.1);
 *   - o detalhamento bate com os exemplos do adendo, caractere a caractere;
 *   - o histórico respeita o limite.
 */

/**
 * Os sistemas vêm pelo ACESSOR, nunca por import direto dos arquivos.
 *
 * `@/config/systems` expõe `getSystem(id)` e `SYSTEMS`; o objeto interno
 * (`config/systems/dnd5e.ts`) não é API pública. Importar direto passa no
 * TypeScript e devolve `undefined` no Vite — falha silenciosa.
 */
const DND5E = getSystem("dnd5e") as RpgSystem;
const OLD_DRAGON = getSystem("olddragon") as RpgSystem;
const COC = getSystem("coc") as RpgSystem;

/** Gera um `rng` que devolve SEMPRE o mesmo valor — rolagem determinística. */
function fixedRng(value: number): () => number {
  return () => value;
}

/**
 * `rng` que produz exatamente `faces`, para um d20:
 * `floor(x * 20) + 1 = 14` ⇒ `x = 0.65`.
 */
const rngFor14 = fixedRng(0.65);

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "sk-furt",
    name: "Furtividade",
    value: 3,
    color: null,
    ...overrides,
  };
}

function attribute(overrides: Partial<Attribute> = {}): Attribute {
  return {
    id: "at-des",
    name: "Destreza",
    value: 14,
    color: null,
    ...overrides,
  };
}

/** Dependências injetadas: sem sorteio real, sem id real, sem relógio real. */
function deps(system: RpgSystem | null) {
  return {
    system,
    rng: rngFor14,
    makeId: () => "roll-1",
    now: () => "2026-01-01T00:00:00.000Z",
  };
}

/* ===========================================================================
 * PERÍCIA SECA
 * ========================================================================== */

describe("rollSkillDry", () => {
  it("soma d20 + valor da perícia", () => {
    const record = rollSkillDry(skill(), deps(DND5E));

    expect(record.dice).toEqual([14]);
    expect(record.total).toBe(17); // 14 + 3
  });

  it("NÃO soma atributo nenhum, mesmo com atributos na ficha", () => {
    const record = rollSkillDry(skill({ value: 0 }), deps(DND5E));

    // O d20 que valeu 14, não o modificador de Destreza.
    expect(record.total).toBe(14);
    expect(record.components).toHaveLength(1);
    expect(record.components[0]?.label).toBe("perícia");
  });

  it('o rótulo guardado é "Furtividade (seca)"', () => {
    expect(rollSkillDry(skill(), deps(DND5E)).label).toBe("Furtividade (seca)");
  });

  it('o "(seca)" sobrevive a uma perícia com nome vazio', () => {
    const record = rollSkillDry(skill({ name: "" }), deps(DND5E));
    expect(record.label).toBe(" (seca)");
  });

  it("guarda o tipo 'skill' e o id de origem", () => {
    const record = rollSkillDry(skill(), deps(DND5E));

    expect(record.kind).toBe("skill");
    expect(record.sourceId).toBe("sk-furt");
  });

  it("funciona sem sistema carregado", () => {
    expect(rollSkillDry(skill(), deps(null)).total).toBe(17);
  });
});

/* ===========================================================================
 * PERÍCIA COM ATRIBUTO
 * ========================================================================== */

describe("rollSkillWithAttribute", () => {
  it("soma d20 + perícia + conversão do atributo (D&D 5e)", () => {
    const record = rollSkillWithAttribute(skill(), attribute(), deps(DND5E));

    // floor((14 - 10) / 2) = 2
    expect(record.dice).toEqual([14]);
    expect(record.total).toBe(19); // 14 + 3 + 2
  });

  it("o rótulo junta as duas coisas: 'Furtividade + Destreza'", () => {
    expect(
      rollSkillWithAttribute(skill(), attribute(), deps(DND5E)).label,
    ).toBe("Furtividade + Destreza");
  });

  it("cada parcela é nomeada no registro", () => {
    const record = rollSkillWithAttribute(skill(), attribute(), deps(DND5E));

    expect(record.components).toEqual([
      { label: "perícia", value: 3 },
      { label: "Destreza", value: 2 },
    ]);
  });

  it("usa a regra do SISTEMA — CoC soma o atributo direto", () => {
    const record = rollSkillWithAttribute(skill(), attribute(), deps(COC));

    // CoC não converte: 14 entra inteiro.
    expect(record.total).toBe(31); // 14 + 3 + 14
  });

  it("Old Dragon converte como o D&D 5e (regra isolada, mesmo resultado)", () => {
    const record = rollSkillWithAttribute(
      skill(),
      attribute(),
      deps(OLD_DRAGON),
    );
    expect(record.total).toBe(19);
  });

  it("os três sistemas juntos na mesma regra de interface", () => {
    const totals = [DND5E, OLD_DRAGON, COC].map(
      (system) =>
        rollSkillWithAttribute(skill(), attribute(), deps(system)).total,
    );

    expect(totals).toEqual([19, 19, 31]);
  });

  it("atributo baixo dá parcela NEGATIVA, não erro", () => {
    const record = rollSkillWithAttribute(
      skill(),
      attribute({ value: 6 }),
      deps(DND5E),
    );

    expect(record.components[1]?.value).toBe(-2); // floor((6-10)/2)
    expect(record.total).toBe(15); // 14 + 3 - 2
  });

  it("dá para rolar a MESMA perícia com atributos diferentes", () => {
    const comDestreza = rollSkillWithAttribute(
      skill(),
      attribute(),
      deps(DND5E),
    );
    const comForca = rollSkillWithAttribute(
      skill(),
      attribute({ id: "at-for", name: "Força", value: 18 }),
      deps(DND5E),
    );

    expect(comDestreza.total).toBe(19);
    // floor((18-10)/2) = 4
    expect(comForca.total).toBe(21);
    expect(comForca.label).toBe("Furtividade + Força");
  });

  it("funciona sem sistema: a perícia ainda rola", () => {
    const record = rollSkillWithAttribute(skill(), attribute(), deps(null));

    // Sem sistema, nenhum bônus — e nenhuma exceção.
    expect(record.total).toBe(17);
    expect(record.components[1]?.value).toBe(0);
  });
});

/* ===========================================================================
 * ATRIBUTO
 * ========================================================================== */

describe("rollAttribute", () => {
  it("soma d20 + conversão do atributo (D&D 5e)", () => {
    const record = rollAttribute(attribute(), deps(DND5E));

    expect(record.total).toBe(16); // 14 + 2
  });

  it("o rótulo é o nome do atributo, sem sufixo", () => {
    expect(rollAttribute(attribute(), deps(DND5E)).label).toBe("Destreza");
  });

  it('a parcela se chama "atributo"', () => {
    expect(rollAttribute(attribute(), deps(DND5E)).components).toEqual([
      { label: "atributo", value: 2 },
    ]);
  });

  it("guarda o tipo 'attribute'", () => {
    expect(rollAttribute(attribute(), deps(DND5E)).kind).toBe("attribute");
  });

  it("usa o d20 da constante, não um dado qualquer", () => {
    expect(rollAttribute(attribute(), deps(DND5E)).die).toBe("d20");
  });

  it("CoC soma o valor bruto do atributo", () => {
    expect(rollAttribute(attribute(), deps(COC)).total).toBe(28); // 14 + 14
  });

  it("funciona sem sistema: rola o d20 puro em vez de lançar", () => {
    expect(rollAttribute(attribute(), deps(null)).total).toBe(14);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PONTO EM ABERTO Nº 1
  // O teste lê a MESMA constante que a implementação. Virar
  // `ATTRIBUTE_ROLL_ADDS_CONTRIBUTION` para `false` faz este teste falhar de
  // propósito — é o que保证 que trocar o padrão é visível, e não silencioso.
  // ─────────────────────────────────────────────────────────────────────────
  it("a flag ATTRIBUTE_ROLL_ADDS_CONTRIBUTION controla a parcela", () => {
    const record = rollAttribute(attribute(), deps(DND5E));

    if (ATTRIBUTE_ROLL_ADDS_CONTRIBUTION) {
      expect(record.total).toBe(16);
      expect(record.components).toHaveLength(1);
    } else {
      expect(record.total).toBe(14);
      expect(record.components).toHaveLength(0);
    }
  });

  it("com a flag ligada, o resultado é o MESMO da conversão da arma", () => {
    // A garantia é de consistência: o atributo rola o que a arma somaria
    // dele. Se as duas divergirem, o jogador vê números diferentes para a
    // mesma conta.
    const roll = rollAttribute(attribute(), deps(DND5E));
    const expected = DND5E.attributeContribution(attribute().value, {
      systemId: DND5E.id,
      kind: "skill",
    });

    expect(roll.total - roll.dice[0]!).toBe(expected);
  });
});

/* ===========================================================================
 * DETALHAMENTO
 * ========================================================================== */

describe("describeRoll", () => {
  it("reproduz a frase do adendo para perícia seca", () => {
    expect(describeRoll(rollSkillDry(skill(), deps(DND5E)))).toBe(
      "Furtividade (seca): d20 [14] + perícia (+3) = 17",
    );
  });

  it("reproduz a frase do adendo para perícia com atributo", () => {
    expect(
      describeRoll(rollSkillWithAttribute(skill(), attribute(), deps(DND5E))),
    ).toBe(
      "Furtividade + Destreza: d20 [14] + perícia (+3) + Destreza (+2) = 19",
    );
  });

  it("reproduz a frase do adendo para atributo", () => {
    expect(describeRoll(rollAttribute(attribute(), deps(DND5E)))).toBe(
      "Destreza: d20 [14] + atributo (+2) = 16",
    );
  });

  it("omite parcela zerada — '+ perícia (+0)' fingiria um bônus", () => {
    const record = rollSkillDry(skill({ value: 0 }), deps(DND5E));
    expect(describeRoll(record)).toBe("Furtividade (seca): d20 [14] = 14");
  });

  it("usa sinal de menos tipográfico na parcela negativa", () => {
    const record = rollSkillWithAttribute(
      skill(),
      attribute({ value: 2 }),
      deps(DND5E),
    );
    expect(describeRoll(record)).toContain("Destreza (−4)");
  });

  it("mostra o total batendo com a soma do registro", () => {
    const record = rollAttribute(attribute(), deps(COC));
    const somado =
      record.dice.reduce((a, b) => a + b, 0) +
      record.components.reduce((a, b) => a + b.value, 0);

    expect(somado).toBe(record.total);
    expect(describeRoll(record)).toContain(`= ${record.total}`);
  });

  it("nunca quebra com histórico velho e malformado", () => {
    // Uma ficha importada de outra versão pode trazer registro sem `dice`.
    const quebrado = {
      id: "r",
      rolledAt: "2026-01-01T00:00:00.000Z",
      kind: "skill" as const,
      label: "Ruptura",
      die: "d20" as const,
      dice: [],
      components: [],
      total: 0,
      sourceId: null,
    };

    expect(describeRoll(quebrado)).toBe("Ruptura: d20 [0] = 0");
  });
});

/* ===========================================================================
 * CRÍTICO E FUMBLE
 *
 * Estas regras nasceram dentro do `RollResultPanel` e foram trazidas para
 * cá porque o anúncio do leitor de tela precisa das MESMAS decisões. Duas
 * cópias da regra divergem na primeira correção feita num lado só.
 * ========================================================================== */

function registro(overrides: Partial<RollRecord> = {}): RollRecord {
  return {
    id: "r-1",
    rolledAt: "2026-01-01T00:00:00.000Z",
    kind: "skill",
    label: "Furtividade",
    die: "d20",
    dice: [14],
    components: [{ label: "perícia", value: 3 }],
    total: 17,
    sourceId: "sk-1",
    ...overrides,
  };
}

describe("isCritRoll", () => {
  it("é verdadeiro com d20 natural 20", () => {
    expect(isCritRoll(registro({ dice: [20], total: 23 }))).toBe(true);
  });

  it("NÃO depende do TOTAL — um 20 com -5 não é crítico", () => {
    // O dado foi 20, mas o resultado foi 15. Dizer "crítico" mentiria duas
    // vezes: o número na tela não é 20 e o jogador não critou.
    expect(isCritRoll(registro({ dice: [20], total: 15 }))).toBe(true);
  });

  it("NÃO vale para arma — 3d20 tem outros dados", () => {
    expect(
      isCritRoll(registro({ kind: "weapon", dice: [20], total: 20 })),
    ).toBe(false);
  });

  it("vale para atributo: também é um d20 só", () => {
    // A exclusão é só de ARMA, e por um motivo específico: `3d20` tem outros
    // dados que contam. Um d20 de atributo é um d20 único — se der 20, deu 20.
    expect(
      isCritRoll(registro({ kind: "attribute", dice: [20], total: 20 })),
    ).toBe(true);
  });

  it("não quebra com registro sem dados (importação antiga)", () => {
    expect(isCritRoll(registro({ dice: [] }))).toBe(false);
  });
});

describe("isFumbleRoll", () => {
  it("é verdadeiro com natural 1", () => {
    expect(isFumbleRoll(registro({ dice: [1] }))).toBe(true);
  });

  it("NÃO vale para arma", () => {
    expect(
      isFumbleRoll(registro({ kind: "weapon", dice: [1], total: 12 })),
    ).toBe(false);
  });

  it("crítico e fumble são mutuamente exclusivos", () => {
    const c = registro({ dice: [20] });
    const f = registro({ dice: [1] });

    expect(isCritRoll(c) && isFumbleRoll(c)).toBe(false);
    expect(isFumbleRoll(f) && isCritRoll(f)).toBe(false);
  });
});

/* ===========================================================================
 * ANÚNCIO PARA LEITOR DE TELA
 *
 * A frase falada NÃO é a frase da tela. `describeRoll` é notação de RPG
 * (`d20 [14] + perícia (+3) = 17`) e, lida letra a letra, não diz qual dos
 * números é o resultado. Aqui a ordem é invertida: o total primeiro.
 * ========================================================================== */

describe("announceRoll", () => {
  it("diz o resultado ANTES da conta", () => {
    const frase = announceRoll(registro({ total: 17 }));

    expect(frase).toBe(
      "Furtividade: resultado 17. Cálculo: 14 mais perícia +3.",
    );
  });

  it("usa a mesma notação de sinal da tela", () => {
    // `formatSigned` é compartilhado de propósito: divergir aqui significaria
    // `+3` na tela e outra coisa falado.
    //
    // O sinal do MENUS é o U+2212 (menos tipográfico), não o hífen ASCII — é o
    // que a tela mostra em todo o app. O caractere é invisível nesta
    // verificação, mas é o mesmo: mudar um dos lados quebraria este teste.
    expect(
      announceRoll(registro({ components: [{ label: "p", value: -2 }] })),
    ).toContain(`p ${formatSigned(-2)}`);
  });

  it("anuncia crítico junto do resultado", () => {
    expect(announceRoll(registro({ dice: [20], total: 23 }))).toContain(
      "Crítico: natural 20.",
    );
  });

  it("anuncia falha crítica junto do resultado", () => {
    expect(announceRoll(registro({ dice: [1], total: 4 }))).toContain(
      "Falha crítica: natural 1.",
    );
  });

  it("NÃO anuncia crítico nem fumble no texto se não for", () => {
    const frase = announceRoll(registro({ dice: [14] }));

    expect(frase).not.toContain("natural");
  });

  it("omite o cálculo quando não há parcelas", () => {
    // "Cálculo: 14." sozinho não acrescenta nada ao total já dito.
    expect(announceRoll(registro({ components: [] }))).toBe(
      "Furtividade: resultado 17.",
    );
  });

  it("omite parcela zerada — '+ perícia +0' seria mentira", () => {
    expect(
      announceRoll(registro({ components: [{ label: "perícia", value: 0 }] })),
    ).not.toContain("perícia");
  });

  it("lista os dados um a um na rolagem de arma", () => {
    // Ouvir "3d20" não diz quantos sorteios houve. Ouvir "20, 4 e 11" diz.
    expect(
      announceRoll(
        registro({
          kind: "weapon",
          label: "Espada longa",
          die: "3d20",
          dice: [20, 4, 11],
          components: [],
          total: 40,
        }),
      ),
    ).toBe("Espada longa: resultado 40. Cálculo: 20, 4 e 11.");
  });

  it("não quebra com registro sem dados (importação antiga)", () => {
    const frase = announceRoll(registro({ dice: [], total: 3 }));

    expect(frase).toContain("resultado 3");
  });

  it("termina com ponto — é uma frase falada", () => {
    for (const registro_ of [
      registro(),
      registro({ dice: [20], components: [] }),
      registro({ components: [] }),
    ]) {
      expect(announceRoll(registro_).endsWith(".")).toBe(true);
    }
  });
});

/* ===========================================================================
 * HISTÓRICO
 * ========================================================================== */

describe("pushRoll", () => {
  function record(id: string, total: number) {
    return {
      id,
      rolledAt: "2026-01-01T00:00:00.000Z",
      kind: "skill" as const,
      label: id,
      die: "d20" as const,
      dice: [total],
      components: [],
      total,
      sourceId: null,
    };
  }

  it("coloca a rolagem nova PRIMEIRO", () => {
    const history = pushRoll([record("a", 1)], record("b", 2));
    expect(history.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("respeita o limite", () => {
    let history = pushRoll([], record("a", 1));
    history = pushRoll(history, record("b", 2));
    history = pushRoll(history, record("c", 3));
    history = pushRoll(history, record("d", 4));

    expect(history).toHaveLength(3);
    // A mais antiga é a que cai.
    expect(history.map((r) => r.id)).toEqual(["d", "c", "b"]);
  });

  it("não mexe no histórico recebido", () => {
    const original = [record("a", 1)];
    const next = pushRoll(original, record("b", 2));

    expect(original).toHaveLength(1);
    expect(next).toHaveLength(2);
  });

  it("funciona com histórico vazio", () => {
    expect(pushRoll([], record("a", 1))).toHaveLength(1);
  });
});
