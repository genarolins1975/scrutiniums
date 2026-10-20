import { mesExtenso, num } from "./formato";
import type { GoldPrevidencia, MunicipioGold } from "./tipos";

/** Folhas da tabela de tipos do BEPS: o número de tipos de benefício que o painel completo detalha. */
function tiposDetalhados(g: GoldPrevidencia): number {
  const pais = new Set(g.brasil_mes.tipos.map((t) => t.pai).filter(Boolean));
  return g.brasil_mes.tipos.filter((t) => !pais.has(t.id)).length;
}

/**
 * O que o painel completo mostra a mais (decisão do dono de 20/10/2026), na ordem das seções dele
 * (src/app/contas-publicas/previdencia/page.tsx), dimensionado pela própria gold.
 */
export function comConta(g: GoldPrevidencia, uf: string | null, municipio?: { m: MunicipioGold; anos: number[] }): string[] {
  const anos = g.anual.anos;
  // a série do município começa no primeiro ano em que ele aparece na base (município novo não tem os anos anteriores)
  const anosMun = municipio ? municipio.anos.filter((_, i) => municipio.m.q[i] != null) : anos;
  const serieMun =
    anosMun.length > 1
      ? `O seu município ano a ano, de dezembro de ${anosMun[0]} a dezembro de ${anosMun[anosMun.length - 1]}`
      : `O seu município em dezembro de ${anosMun[0] ?? anos[anos.length - 1]} (a base do INSS não traz anos anteriores para ele)`;
  const mes = mesExtenso(g.brasil_mes.referencia);
  const r = g.rgps;
  const serieMensal = g.serie.meses.find((m) => m.endsWith("-01"));
  const n = uf ? g.municipios.por_uf[uf] : null;
  return [
    `${serieMun}, separado em aposentadorias (por idade, por invalidez e por tempo de contribuição), pensões por morte, auxílios, outros previdenciários e assistenciais, com o valor médio de cada grupo`,
    n ? `O município ao lado do estado e do Brasil, e a posição dele entre os ${num(n)} municípios do estado` : `O município ao lado do estado e do Brasil, e a posição dele entre os municípios do estado (${num(g.municipios.total)} municípios no país)`,
    `Os ${tiposDetalhados(g)} tipos de benefício do INSS em ${mes}, das aposentadorias ao BPC da pessoa idosa e da pessoa com deficiência, com quantidade, valor médio e a divisão entre clientela urbana e rural`,
    `Como o Regime Geral fecha a conta: arrecadação, despesa com benefícios e necessidade de financiamento coberta pelo Tesouro, ano a ano de ${r.anos[0]} a ${r.anos[r.anos.length - 1]}, em reais e em % do PIB, com a divisão urbana e rural desde ${r.inicio_divisao_urbana_rural}`,
    `Os ${g.ufs_mes.ufs.length} estados lado a lado em ${mes}: benefícios do Regime Geral, valor médio urbano e rural e a parte da clientela rural; e os grupos de benefício de cada estado em dezembro de cada ano desde ${anos[0]}`,
    `Quantos benefícios o INSS paga mês a mês desde ${mesExtenso(serieMensal)}, e cada dezembro desde ${g.serie.meses[0].slice(0, 4)}, com o valor médio`,
    "Os arquivos para baixar (CSV): benefícios por município e por estado, o Brasil mês a mês e o resultado do Regime Geral",
  ];
}

