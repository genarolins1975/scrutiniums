import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { rotaPorta } from "@/lib/perguntas/rotas";
import { TEXTOS_LAYOUT } from "@/i18n/paginas/layout";
import { hrefNoIdioma } from "@/lib/i18n-href";
import type { Idioma } from "@/lib/idioma";

/**
 * Destinos das abas do cabeçalho público: os seis observatórios
 * (src/lib/observatorios/registro.ts) e a imprensa. Cada aba leva à página
 * aberta do observatório, que mostra a amostra do tema e, abaixo, as coleções
 * e os painéis; o mesmo destino serve a quem tem conta e a quem não tem, e os
 * painéis abrem direto para quem já entrou.
 */
export function navCabecalho(idioma: Idioma = "pt"): { href: string; label: string }[] {
  // nomes dos observatórios são nomes de produto e ficam em português nos dois idiomas
  return [
    ...OBSERVATORIOS.map((o) => ({ href: hrefNoIdioma(rotaPorta(o.id), idioma), label: o.nomeCurto })),
    { href: hrefNoIdioma("/imprensa", idioma), label: TEXTOS_LAYOUT[idioma].imprensa },
  ];
}

/** Quantidade de abas que são observatório (o seletor do celular deixa a imprensa de fora). */
export const N_ABAS_OBSERVATORIOS = OBSERVATORIOS.length;
