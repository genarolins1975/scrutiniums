import { frequenciaSerie, mesExtenso, num } from "./formato";
import type { GoldConectividade, MunicipioGold } from "./tipos";

/**
 * O que o painel completo mostra a mais (decisão do dono de 20/10/2026), na ordem das seções dele
 * (src/components/conectividade/PainelConectividade.tsx), dimensionado pela própria gold.
 */
export function comConta(g: GoldConectividade, uf: string | null, m?: MunicipioGold): string[] {
  const n = uf ? g.ufs.find((u) => u.uf === uf)?.ranqueados.fixa_densidade ?? null : null;   // universo do ranking de acessos fixos
  const tri = g.trimestres_cobertura;
  const serieFixa = frequenciaSerie(g.brasil.fixa.acessos_mensal.meses);
  const serieMovel = frequenciaSerie(g.brasil.movel.acessos_mensal.meses);
  const ops = g.operadoras.length;
  // município publicado sem a banda larga fixa (validar_cruzado aceita até três diferenças entre as bases): o convite diz
  // a ausência em vez de prometer velocidade, meio, prestadoras e posições que o painel mostra como "Sem dado"
  const semFixa = !!m && !m.fixa;
  const prest = m?.fixa ? `as ${num(m.fixa.prestadoras)} prestadoras de banda larga fixa da cidade` : "quantas prestadoras de banda larga fixa atendem a cidade";
  // a Anatel só nomeia os grandes grupos: na maioria dos municípios a maior parte é a soma dos provedores regionais ("OUTROS")
  const lider = !m?.fixa ? "e se um grande grupo lidera ou se os provedores regionais, somados, ficam com a maior parte"
    : m.fixa.maior_grupo === "OUTROS" ? "e a parte somada dos provedores regionais e locais, que ali é a maior"
    : "e a parte da maior delas";
  // só o que o cartão do município mostra: posição no estado e no país nos acessos fixos por 100 habitantes, posição no
  // estado na cobertura 4G, faixa entre os municípios do país na fibra e no 5G
  const posicoes = semFixa
    ? `A Anatel não registra acessos de banda larga fixa neste município, então as posições em acessos fixos e em fibra ficam sem dado${m && !m.cobertura ? "" : "; o painel mostra a colocação estadual em cobertura 4G e a faixa nacional em cobertura 5G"}`
    : `${n ? `A posição do município entre os ${num(n)} do estado e os ${num(g.destaques.ranqueados.fixa_densidade)} do país com acessos fixos` : `A posição do município entre os do estado e os ${num(g.destaques.ranqueados.fixa_densidade)} do país com acessos fixos`} em acessos fixos por 100 habitantes e a faixa em que ele cai, entre os municípios do país, em fibra${m && !m.cobertura ? "" : ", a colocação estadual em cobertura 4G e a faixa nacional em cobertura 5G"}`;
  // município publicado sem uma das fontes (Boa Esperança do Norte, instalado depois do Censo 2022, não tem telefonia
  // móvel nem cobertura): o convite diz a ausência em vez de prometer o que o painel não mostra
  const semMovel = !!m && !m.movel;
  const semCobertura = !!m && !m.cobertura;
  const movelTexto = semMovel ? "as linhas móveis por geração nos municípios que a Anatel registra (este não tem telefonia móvel na base)" : "as linhas móveis por geração (2G a 5G), pré e pós-pago";
  const coberturaTexto = semCobertura ? `a cobertura de cada uma das ${num(ops)} operadoras onde a Anatel a publica (este município ainda não tem cobertura publicada)` : `a cobertura de cada uma das ${num(ops)} operadoras`;
  const serieTexto = semCobertura
    ? `Como a cobertura 4G e 5G mudou trimestre a trimestre, de ${mesExtenso(tri[0])} a ${mesExtenso(tri[tri.length - 1])}, no Brasil e nos municípios com cobertura publicada`
    : `Como a cobertura 4G e 5G da cidade mudou trimestre a trimestre, de ${mesExtenso(tri[0])} a ${mesExtenso(tri[tri.length - 1])}`;
  return [
    semFixa
      ? `O retrato completo do seu município: a Anatel não registra acessos de banda larga fixa nele (sem velocidade, meio de acesso nem prestadoras), e o painel mostra ${movelTexto} e ${coberturaTexto}`
      : `O retrato completo do seu município: velocidade contratada por faixa, cabo, rádio e satélite além da fibra, ${prest} ${lider}, ${movelTexto} e ${coberturaTexto}`,
    posicoes,
    serieTexto,
    `Onde a fibra ainda não chegou: os ${num(g.destaques.sem_fibra)} municípios sem acesso por fibra${g.destaques.uma_prestadora ? ` e os ${num(g.destaques.uma_prestadora)} atendidos por uma única prestadora` : ""}, estado a estado`,
    `Os ${num(g.ufs.length)} estados lado a lado: acessos por 100 habitantes, fibra, 100 Mbps ou mais, prestadoras, 5G nas linhas e moradores cobertos por 4G e 5G`,
    `Como a internet cresceu no Brasil: acessos de banda larga fixa (${serieFixa}) e acessos móveis (${serieMovel}), e a cobertura 4G e 5G trimestre a trimestre`,
    "Os arquivos para baixar (CSV): conectividade por município, por estado e a série do Brasil (acessos fixos e móveis, nos meses que a Anatel publica)",
  ];
}
