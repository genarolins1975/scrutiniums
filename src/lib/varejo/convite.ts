import { atividadesDoUniverso, mesesSelecionaveis } from "./dados";
import { mesExtenso, num } from "./formato";
import { paginaVarejo } from "./paginas";
import type { CuradoriaVarejo, GoldEmpresas, GoldSetor } from "./tipos";

/**
 * O que a coleção completa mostra a mais que a versão aberta (decisão do dono de 20/10/2026), na ordem das páginas com
 * conta e dimensionado pelas próprias golds. Só promete o que está no ar: grupos e comparador entram na lista com as páginas
 * publicadas (src/lib/varejo/paginas.ts) e, no caso dos grupos, com a curadoria do ranking no lugar.
 */
export function comConta(g: GoldSetor, e: GoldEmpresas, c: CuradoriaVarejo): string[] {
  const meses = mesesSelecionaveis(g);
  const nAtividades = atividadesDoUniverso(g, "ampliado").length;
  const nUfs = Object.keys(g.pmc.ufs).length;
  const nEmpresas = Object.keys(e.empresas).length;
  const itens = [
    `As séries mês a mês de ${mesExtenso(meses[0])} a ${mesExtenso(meses[meses.length - 1])}: volume contra receita nominal, no varejo restrito e no ampliado, em três medidas de variação`,
    "A diferença entre receita e volume em pontos percentuais, que aproxima o efeito dos preços, e quantas atividades subiram e caíram em cada mês",
    `As ${num(nAtividades)} atividades da pesquisa lado a lado: crescimento real, crescimento nominal e a trajetória recente de cada uma`,
    `Os ${num(nUfs)} estados no mapa e em lista ordenada, e a trajetória de cada estado contra a do Brasil`,
    `O tamanho do mercado em reais na pesquisa anual de ${g.pac.ano}: receita por tipo de comércio, empresas, pessoas ocupadas, porte e o peso da internet nas vendas`,
    `Como R$ 100 de venda se dividem em custo, despesas, juros, impostos e lucro em companhias abertas (${num(nEmpresas)} na base, pelas demonstrações enviadas à CVM)`,
    "A renda, a inflação de alimentos e os juros do crédito às famílias ao lado das vendas, cada um no seu gráfico",
  ];
  const nFichas = Object.keys(c.fichas).length;
  if (paginaVarejo("grupos").publicada && c.ranking?.grupos?.length) {
    itens.push(`Os ${num(c.ranking.grupos.length)} maiores grupos do varejo, com a busca que diz de quem é cada marca${nFichas ? `, e ${num(nFichas)} fichas com bandeiras, canais, indicadores de loja, eventos e fontes` : ""}`);
  }
  if (paginaVarejo("comparador").publicada) itens.push(`O comparador de companhias abertas (${num(nEmpresas)} na base): de R$ 100 de receita ao lucro e para onde foi o caixa, lado a lado`);
  itens.push("Os arquivos para baixar (CSV): a série do Brasil, as atividades e os estados");
  return itens;
}
