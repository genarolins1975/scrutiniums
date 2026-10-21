import { en } from "@/i18n/en";
import { formatadorNumero } from "@/lib/format";
import type { Idioma } from "@/lib/idioma";
import type { ContagemIndice, Vitrine } from "@/lib/vitrine";

const unidadesEn = {
  paginas_tematicas: en["home.indice.paginas_tematicas"].texto,
  secoes_publicadas: en["home.indice.secoes_publicadas"].texto,
  temas_publicados: en["home.indice.temas_publicados"].texto,
  capitulos_com_dados: en["home.indice.capitulos_com_dados"].texto,
  unidades_federacao: en["home.indice.unidades_federacao"].texto,
  paginas_por_pergunta: en["home.indice.paginas_por_pergunta"].texto,
} satisfies Record<ContagemIndice["unidade"], string>;

/** Localiza somente o índice; a contagem compartilhada com as seções permanece intacta. */
export function formatarContagemIndice(
  vitrine: Readonly<Pick<Vitrine, "contagem" | "contagemIndice">>,
  idioma: Idioma = "pt",
): Readonly<Vitrine["contagem"]> {
  if (idioma === "pt") return vitrine.contagem;

  const contagem = vitrine.contagemIndice;
  const fmt = formatadorNumero("en", {}).format;
  const valor = contagem.tipo === "simples"
    ? fmt(contagem.quantidade)
    : en["home.indice.contagem_parcial"].texto
      .replace("{publicados}", fmt(contagem.publicados))
      .replace("{total}", fmt(contagem.total));
  return { valor, unidade: unidadesEn[contagem.unidade] };
}
