import { ABAS_OBSERVATORIOS } from "@/components/observatorios/NavegacaoObservatorios";

/**
 * Destinos das abas do cabeçalho. Quem tem conta vai direto ao painel; o
 * visitante vai à seção do observatório na página inicial (pergunta, painéis,
 * fontes e o convite para entrar), em vez de cair na tela de login.
 */
export function navCabecalho(logado: boolean): { href: string; label: string }[] {
  return [
    ...ABAS_OBSERVATORIOS.map((a) => ({ href: logado ? a.href : `/#obs-${a.id}`, label: a.rotulo })),
    { href: "/imprensa", label: "Imprensa" },
  ];
}
