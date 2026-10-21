import { useSyncExternalStore } from "react";

/**
 * Assinatura que nunca emite nada.
 *
 * O valor que `useMounted` devolve muda apenas uma vez na vida do componente:
 * de `false` (snapshot do servidor) para `true` (snapshot do cliente), quando
 * o React hidrata. Não existe "evento" para assinar — a troca acontece
 * porque o servidor não tem `window`.
 */
function subscribeToNothing(): () => void {
  return () => undefined;
}

/** Snapshot do cliente: depois de hidratar, estamos sempre montados. */
function getClientSnapshot(): boolean {
  return true;
}

/** Snapshot do servidor: nunca estamos "montados" no HTML estático. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * `true` somente depois que o componente foi hidratado no cliente.
 *
 * POR QUE EXISTE: o servidor não sabe o tema escolhido pelo usuário, nem o
 * modo de cor do sistema, nem o que está no `localStorage`. Renderizar esse
 * estado antes da hidratação provoca o erro "Text content does not match
 * server-rendered HTML". O padrão é renderizar um placeholder neutro e só
 * então mostrar o valor real.
 *
 * POR QUE `useSyncExternalStore` E NÃO `useState` + `useEffect`:
 * a forma com `setState` dentro de efeito provoca um segundo render
 * ("cascading render") e é oficialmente desaconselhada pelo React
 * (`react.dev/learn/you-might-not-need-an-effect`). `useSyncExternalStore`
 * entrega exatamente a mesma garantia — snapshot diferente no servidor e no
 * cliente — sem render extra.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot,
  );
}
