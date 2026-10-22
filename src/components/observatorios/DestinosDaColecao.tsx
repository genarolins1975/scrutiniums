import type { ReactNode } from "react";
import { DestinosColecao, type DestinoEntrada } from "@/components/observatorios/EntradaColecao";
import { indiceDeBusca } from "@/lib/busca/indice";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import type { NumeroPorta } from "@/lib/perguntas/tipos";

const semAncora = (href: string) => href.split(/[?#]/)[0] || "/";

/**
 * Fatia "Destinos" de uma entrada de coleção (EntradaColecao): os destinos de primeiro nível da navegação da coleção
 * (navegacaoDaColecao, Iniciativa 2), cada um com o que ele responde, lido do índice da busca (os resumos dos catálogos), e,
 * quando a página passa, o número lido da mesma base do destino. Nada é escrito à mão aqui: entra destino novo pelo catálogo.
 * Destino sem página leva o selo "em preparação" e nunca é link. Sem destino além da própria página, devolve null.
 */
export function destinosDaColecao(
  colecao: string,
  {
    excluir = [],
    numeros = {},
    titulo,
    descricao,
    proprio,
  }: {
    excluir?: string[];
    numeros?: Record<string, NumeroPorta>;
    titulo?: string;
    descricao?: ReactNode;
    /** A página que mostra os destinos, quando não é a entrada da coleção (um painel que é porta de tema dentro da coleção). */
    proprio?: string;
  } = {},
): ReactNode {
  const nav = navegacaoDaColecao(colecao);
  const indice = indiceDeBusca();
  const resumo = (href: string) => {
    const e = indice.entradas.find((x) => x.href === href) ?? indice.entradas.find((x) => x.href && semAncora(x.href) === semAncora(href));
    return e?.resumo || undefined;
  };
  const fora = new Set([...excluir, proprio ?? nav.itens[0]?.href].filter(Boolean).map((h) => semAncora(h as string)));
  const itens: DestinoEntrada[] = nav.itens
    // a própria página e as âncoras dela ficam de fora: as seções da página estão nos caminhos e nos blocos recolhidos
    .filter((i) => !fora.has(semAncora(i.href)))
    .map((i) => ({
      titulo: i.rotulo,
      href: i.href,
      pergunta: resumo(i.href),
      numero: numeros[i.href],
      prontidao: i.publicado ? undefined : "preparacao",
    }));
  if (itens.length === 0) return null;
  return <DestinosColecao itens={itens} titulo={titulo} descricao={descricao} />;
}
