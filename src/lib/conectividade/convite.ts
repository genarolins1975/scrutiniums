import { mesExtenso, num } from "./formato";
import type { GoldConectividade, MunicipioGold } from "./tipos";

/**
 * O que o painel completo mostra a mais (decisão do dono de 20/10/2026), na ordem das seções dele
 * (src/components/conectividade/PainelConectividade.tsx), dimensionado pela própria gold.
 */
export function comConta(g: GoldConectividade, uf: string | null, m?: MunicipioGold): string[] {
  const n = uf ? g.ufs.find((u) => u.uf === uf)?.municipios ?? null : null;
  const tri = g.trimestres_cobertura;
  const mensalFixa = g.brasil.fixa.acessos_mensal.meses[0];
  const mensalMovel = g.brasil.movel.acessos_mensal.meses[0];
  const ops = g.operadoras.length;
  const prest = m?.fixa ? `as ${num(m.fixa.prestadoras)} prestadoras de banda larga fixa da cidade` : "quantas prestadoras de banda larga fixa atendem a cidade";
  // a Anatel só nomeia os grandes grupos: na maioria dos municípios a maior parte é a soma dos provedores regionais ("OUTROS")
  const lider = !m?.fixa ? "e se um grande grupo lidera ou se os provedores regionais, somados, ficam com a maior parte"
    : m.fixa.maior_grupo === "OUTROS" ? "e a parte somada dos provedores regionais e locais, que ali é a maior"
    : "e a parte da maior delas";
  // só o que o cartão do município mostra: posição no estado e no país nos acessos fixos por 100 habitantes, posição no
  // estado na cobertura 4G, faixa entre os municípios do país na fibra e no 5G
  const posicoes = `${n ? `A posição do município entre os ${num(n)} do estado e os ${num(g.destaques.municipios)} do país` : `A posição do município entre os do estado e os ${num(g.destaques.municipios)} do país`} em acessos fixos por 100 habitantes, a colocação estadual em cobertura 4G e a faixa em que ele cai, entre os municípios do país, em fibra e em cobertura 5G`;
  return [
    `O retrato completo do seu município: velocidade contratada por faixa, cabo, rádio e satélite além da fibra, ${prest} ${lider}, as linhas móveis por geração (2G a 5G), pré e pós-pago e a cobertura de cada uma das ${num(ops)} operadoras`,
    posicoes,
    `Como a cobertura 4G e 5G da cidade mudou trimestre a trimestre, de ${mesExtenso(tri[0])} a ${mesExtenso(tri[tri.length - 1])}`,
    `Onde a fibra ainda não chegou: os ${num(g.destaques.sem_fibra)} municípios sem acesso por fibra${g.destaques.uma_prestadora ? ` e os ${num(g.destaques.uma_prestadora)} atendidos por uma única prestadora` : ""}, estado a estado`,
    `Os ${num(g.ufs.length)} estados lado a lado: acessos por 100 habitantes, fibra, 100 Mbps ou mais, prestadoras, 5G nas linhas e moradores cobertos por 4G e 5G`,
    `Como a internet cresceu no Brasil: acessos de banda larga fixa mês a mês desde ${mesExtenso(mensalFixa)} e linhas móveis desde ${mesExtenso(mensalMovel)}, e a cobertura 4G e 5G trimestre a trimestre`,
    "Os arquivos para baixar (CSV): conectividade por município, por estado e o Brasil mês a mês",
  ];
}
