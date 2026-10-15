import { ABAS_OBSERVATORIOS } from "@/components/observatorios/NavegacaoObservatorios";
import { TEXTOS_LAYOUT } from "@/i18n/paginas/layout";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";

/**
 * Destinos das abas do cabeçalho. Quem tem conta vai direto ao painel; o
 * visitante vai à seção do observatório na página inicial (pergunta, painéis,
 * fontes e o convite para entrar), em vez de cair na tela de login.
 */
export function navCabecalho(logado: boolean, idioma: Idioma = "pt"): { href: string; label: string }[] {
  // nomes dos observatórios são nomes de produto e ficam em português nos dois idiomas
  return [
    ...ABAS_OBSERVATORIOS.map((a) => ({ href: logado ? a.href : hrefNoIdioma(`/#obs-${a.id}`, idioma), label: a.rotulo })),
    { href: hrefNoIdioma("/imprensa", idioma), label: TEXTOS_LAYOUT[idioma].imprensa },
  ];
}
