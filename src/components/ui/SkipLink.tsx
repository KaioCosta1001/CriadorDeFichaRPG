/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PULAR PARA O CONTEÚDO                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * ───────────────────────────────────────────────────────────────────────────
 * O PROBLEMA QUE ELE RESOLVE
 *
 * A ficha abre com um cabeçalho inteiro ANTES dos blocos: voltar, título,
 * alternador de tema, botões de topo. Quem navega por teclado precisa passar
 * por todos eles — com `Tab` repetido — só para chegar ao primeiro atributo.
 * E o pior caso é o oposto: a pessoa desiste depois do quinto `Tab` sem
 * entender que a ficha inteira está logo abaixo.
 *
 * O WCAG 2.4.1 (Bypass Blocks, nível A) pede exatamente este mecanismo. É o
 * primeiro requisito de acessibilidade que a maioria dos projetos não cumpre.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM COMPONENTE E NÃO UM `<a>` SOLTO EM CADA TELA
 *
 * O comportamento depende de duas peças que precisam concordar: o `href`
 * aponta para um `id`, e esse `id` existe com `tabIndex={-1}` no destino. Se
 * uma tela declarar o link e esquecer o alvo, o foco não vai a lugar nenhum —
 * e isso não quebra em nenhum lugar visível. Um componente deixa o `id` ser
 * passado dos dois lados, e o teste garante que os dois existem.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE `tabIndex={-1}` NO DESTINO
 *
 * Sem ele o navegador pode focar o alvo, mas um `div` não é focável e o foco
 * é jogado no `body` — o usuário volta ao topo. Com `-1` o elemento fica
 * focável por programa, mas continua FORA da ordem do `Tab`: ou seja, o
 * pulador some da navegação normal depois de usado, como deve ser.
 */

export function SkipLink({
  targetId,
  label = "Pular para o conteúdo",
}: {
  targetId: string;
  label?: string;
}) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      {label}
    </a>
  );
}

/**
 * Os `id` dos alvos, morando AQUI e não nas telas.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE UM LADO SÓ
 *
 * Um pulador quebrado é o pior tipo de defeito acessível: o link existe, tem
 * o visual certo, e no clique não acontece NADA. Não há erro no console e
 * não há nada vermelho na tela — só a pessoa voltando ao topo sem entender.
 *
 * A causa quase sempre é a mesma: o `href` diz `lista-conteudo` e o `div` diz
 * `lista-conteudo-2`, por causa de um caractere que mudou de lado. Declarar os
 * dois nomes no MESMO arquivo e exportá-los tira essa classe de bug da
 * equação: os dois lados importam a mesma constante, então não há como
 * divergirem.
 *
 * São dois nomes porque são duas telas. Um só, compartilhado, faria as duas
 * telas disputarem o mesmo alvo se fossem montadas juntas.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** Alvo do pulador na tela da ficha aberta. */
export const SHEET_CONTENT_ID = "ficha-conteudo";

/** Alvo do pulador na tela de listagem. */
export const LIST_CONTENT_ID = "lista-conteudo";
