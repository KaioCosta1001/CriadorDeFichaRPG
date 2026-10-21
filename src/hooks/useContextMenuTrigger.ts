"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DND_ACTIVATION_DISTANCE_PX, LONG_PRESS_MS } from "@/config/constants";

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  CLIQUE DIREITO / MENU DE ROLAGEM                                         ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * O adendo manda abrir o menu de rolagem com o botão direito. Botão direito,
 * porém, não existe em todo lugar: teclado e toque precisam de caminhos
 * EQUIVALENTES. Este hook é o ponto único onde os três convergem — assim,
 * Perícias e Atributos (e, na Fase 7, Armas) não têm que reimplementar a
 * mesma aritmética de eventos.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * OS TRÊS CAMINHOS
 *
 * | Entrada          | Gatilho                                         |
 * | ---------------- | ----------------------------------------------- |
 * | Mouse            | `contextmenu` (botão direito)                   |
 * | Teclado          | `Menu` ou `Shift+F10` com o bloco em foco       |
 * | Toque            | toque longo de `LONG_PRESS_MS` sem movimento    |
 *
 * ───────────────────────────────────────────────────────────────────────────
 * POR QUE O TOQUE LONGO NÃO CONFLITA COM O ARRASTE (item 5 do adendo)
 *
 * O `PointerSensor` do dnd-kit está configurado com ativação por DISTÂNCIA
 * (`DND_ACTIVATION_DISTANCE_PX`): ele só assume o ponteiro depois que o dedo
 * andou alguns pixels. Um toque longo PARADO não chega lá — então o arraste
 * nunca começa e o timer do menu vence.
 *
 * O cancelamento usa a MESMA constante de distância, por decisão: se as duas
 * usarem limiares diferentes, haverá uma faixa de movimento em que o menu
 * abre E o arraste começa, e o usuário vê os dois ao mesmo tempo. Uma
 * constante, dois comportamentos, sem faixa morta.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * POR QUE `preventDefault` SÓ QUANDO O MENU ABRE
 * Em modo Editar o menu é desligado e o evento passa direto: o menu nativo
 * do navegador continua disponível, como o adendo pede. O mesmo vale no
 * resto da página — este hook só é espalhado nos blocos de rolagem.
 */

export interface ContextMenuState {
  open: boolean;
  /** Posição do cursor. O MUI posiciona a partir daqui (`anchorPosition`). */
  position: { top: number; left: number };
}

export interface UseContextMenuTriggerOptions {
  /**
   * Quando `true`, o menu NÃO abre e o menu nativo do navegador aparece.
   *
   * É ligado em modo Editar (para não competir com mover/excluir) e durante
   * um arraste em andamento.
   */
  disabled: boolean;
  /**
   * Nome acessível do bloco focável — "Rolar Furtividade".
   *
   * Vai no `aria-label` do gatilho, porque é ele que o `Tab` alcança.
   */
  label: string;
}

export interface ContextMenuTrigger {
  /** `true` enquanto o menu está aberto. */
  open: boolean;

  position: { top: number; left: number };
  /**
   * Props para espalhar no elemento que recebe o clique direito e o toque.
   *
   * Incluem `tabIndex`, `role` e `aria-haspopup` de propósito: o botão de
   * rolar mora DENTRO do popup (decisão do autor), então o caminho de teclado
   * não pode passar por um botão no cartão — ele passa pelo próprio cartão,
   * que precisa ser alcançável por `Tab` e anunciar que abre um menu.
   */
  triggerProps: {
    onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
    tabIndex: number;
    role: string;
    "aria-haspopup": "menu";
    "aria-label": string;
  };
  /** Fecha o menu (chamado pelo `onClose` do MUI). */
  close: () => void;
}

const CLOSED: ContextMenuState = { open: false, position: { top: 0, left: 0 } };

export function useContextMenuTrigger({
  disabled,
  label,
}: UseContextMenuTriggerOptions): ContextMenuTrigger {
  const [state, setState] = useState<ContextMenuState>(CLOSED);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPoint = useRef({ top: 0, left: 0 });
  /** `true` quando o toque longo JÁ abriu o menu. */
  const longPressFired = useRef(false);

  const cancelTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    cancelTimer();
    setState(CLOSED);
  }, [cancelTimer]);

  // Se o menu ficar aberto e o bloco for desligado no meio (o usuário ligou
  // o Editar Geral com o menu na tela), ele tem que sumir — senão o menu
  // nativo volta a valer e os dois ficam abertos ao mesmo tempo.
  //
  // ───────────────────────────────────────────────────────────────────────────
  // POR QUE ISTO É DERIVADO E NÃO UM `useEffect`
  // Fechar dentro de um efeito chamaria `setState` de forma SÍNCRONA no corpo
  // do efeito, que a regra `react-hooks/set-state-in-effect` (React Compiler)
  // proíbe — e com razão: força um segundo render para mostrar algo que já se
  // sabia no render anterior. Derivar (`aberto E NÃO desligado`) dá o mesmo
  // resultado em um render só.
  //
  // O timer pendente não é problema: `handlePointerDown` já retorna antes de
  // agendar quando `disabled`; e se ele disparar mesmo assim, `open`
  // continua falso, porque a mesma condição é reavaliada.
  // ───────────────────────────────────────────────────────────────────────────
  const open = state.open && !disabled;

  useEffect(() => cancelTimer, [cancelTimer]);

  const openAtPointer = useCallback(() => {
    setState({ open: true, position: { ...lastPoint.current } });
  }, []);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      // O toque longo já abriu o nosso menu; o `contextmenu` nativo que vem
      // logo depois (alguns navegadores disparam em ~500 ms) deve ser
      // ignorado, senão o menu pisca.
      if (longPressFired.current) {
        longPressFired.current = false;
        event.preventDefault();
        return;
      }

      // Desligado: deixa o menu nativo do navegador aparecer (§5 do adendo).
      if (disabled) return;

      event.preventDefault();
      cancelTimer();
      lastPoint.current = { top: event.clientY, left: event.clientX };
      setState({ open: true, position: { ...lastPoint.current } });
    },
    [cancelTimer, disabled],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (disabled) return;

      const isMenuKey =
        event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");

      if (!isMenuKey) return;

      event.preventDefault();
      cancelTimer();

      // Sem cursor, o ancorar precisa vir do elemento focado. Lemos
      // `document.activeElement` AQUI, dentro do handler — nunca durante o
      // render, que a regra `react-hooks/refs` proíbe.
      const element = document.activeElement as HTMLElement | null;
      const rect = element?.getBoundingClientRect();

      if (!rect || (rect.width === 0 && rect.height === 0)) {
        openAtPointer();
        return;
      }

      setState({
        open: true,
        position: { top: rect.top + rect.height / 2, left: rect.left },
      });
    },
    [cancelTimer, disabled, openAtPointer],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;

      cancelTimer();
      longPressFired.current = false;

      // Mouse já tem o botão direito; o toque longo é só para toque.
      if (event.pointerType !== "touch") return;

      lastPoint.current = { top: event.clientY, left: event.clientX };

      timer.current = setTimeout(() => {
        timer.current = null;
        longPressFired.current = true;
        setState({ open: true, position: { ...lastPoint.current } });
      }, LONG_PRESS_MS);
    },
    [cancelTimer, disabled],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (timer.current === null) return;

      const moved = Math.hypot(
        event.clientX - lastPoint.current.left,
        event.clientY - lastPoint.current.top,
      );

      // Passou do limiar do dnd-kit: isto é um arraste, não um toque longo.
      if (moved >= DND_ACTIVATION_DISTANCE_PX) cancelTimer();
    },
    [cancelTimer],
  );

  const handlePointerUp = useCallback(() => {
    cancelTimer();
  }, [cancelTimer]);

  return {
    open,
    position: state.position,
    triggerProps: {
      onContextMenu: handleContextMenu,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onKeyDown: handleKeyDown,
      tabIndex: 0,
      role: "button",
      "aria-haspopup": "menu",
      "aria-label": label,
    },
    close,
  };
}
