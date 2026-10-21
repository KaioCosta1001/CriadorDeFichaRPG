import type { Metadata } from "next";

import { SheetScreen } from "@/components/sheets/SheetScreen";

export const metadata: Metadata = {
  title: "Ficha",
};

/**
 * Rota de uma ficha.
 *
 * O `id` chega como prop já resolvido — nenhum acesso a storage no servidor.
 * O componente cliente carrega a ficha depois de montar (hidratação segura).
 *
 * NOTA: a regra de "só Editar Geral" (seção 8.1) vale para o NOME do
 * personagem; por isso esta tela só mostra o título da lista e deixa o
 * nome para o bloco de Perfil na Fase 5.
 */
export default async function SheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SheetScreen sheetId={id} />;
}
