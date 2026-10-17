import { NOME_UF } from "./expansao";
import type { Idioma } from "@/lib/idioma";
import { num, pct } from "./formato";
import { idiomaEnergia, tx } from "./idioma";
import type { EpeAbertura12m, MercadoGold } from "./tipos-mercado";

/**
 * Participação e volume do mercado livre por UF (P032, seção "Onde o mercado livre pesa mais?"): derivações puras do que a gold já traz em
 * `livre_regulado.epe_uf_12m` (EPE, soma de 12 meses por UF). Nada é recalculado: a participação é a publicada (soma do livre sobre a soma do
 * consumo na rede, nunca média de percentuais) e o volume é a energia publicada, convertida de MWh para GWh. As duas medidas usam a mesma
 * janela e as mesmas UFs, para a pessoa alternar entre elas sem mudar de universo.
 *
 * Por que um arquivo próprio: o texto precisa do nome por extenso da UF (`NOME_UF`, de expansao.ts) e `mercado.ts` chega ao navegador por
 * componentes de cliente; aqui só importam a página (servidor) e os testes.
 */

/** UF com a janela de 12 meses completa na gold: as três medidas publicadas existem. Ausência nunca vira zero. */
export function ufComJanela(u: EpeAbertura12m): boolean {
  return u.livre_pct !== null && u.livre_mwh !== null && u.cativo_mwh !== null;
}

/**
 * Consumo na rede dos últimos 12 meses por UF, em GWh, do maior para o menor volume livre. Livre e cativo são as duas partes do consumo na
 * rede da UF (EPE) e somam o total. Empate pela sigla, para a ordem não depender da ordem da gold.
 */
export function barrasUfVolume(g: MercadoGold) {
  return g.livre_regulado.epe_uf_12m
    .filter(ufComJanela)
    .map((u) => ({ uf: u.chave, livre: u.livre_mwh! / 1e3, cativo: u.cativo_mwh! / 1e3 }))
    .sort((a, b) => b.livre - a.livre || a.uf.localeCompare(b.uf));
}

/** UFs da abertura de 12 meses sem janela completa na gold, na ordem da gold. */
export function ufsSemJanela(g: MercadoGold): string[] {
  return g.livre_regulado.epe_uf_12m.filter((u) => !ufComJanela(u)).map((u) => u.chave);
}

/** Trecho de frase: texto corrido ou o nome de uma UF (a página inglesa marca o nome próprio com <Nome>). */
export type ParteTexto = string | { uf: string };

/** Junta as partes num texto só, com o nome por extenso de cada UF. */
export function juntarPartes(partes: ParteTexto[]): string {
  return partes.map((p) => (typeof p === "string" ? p : NOME_UF[p.uf] ?? p.uf)).join("");
}

function listaUfs(ufs: string[], idioma: Idioma): ParteTexto[] {
  if (ufs.length === 1) return [{ uf: ufs[0] }];
  const partes: ParteTexto[] = [];
  ufs.forEach((uf, i) => {
    if (i > 0) partes.push(i === ufs.length - 1 ? tx(" e ", " and ", idioma) : ", ");
    partes.push({ uf });
  });
  return partes;
}

/** Frase da ausência em partes, no idioma pedido. Sem UF ausente, não há frase. */
export function partesUfsSemJanela(g: MercadoGold, idioma: Idioma = idiomaEnergia()): ParteTexto[] | null {
  const ufs = ufsSemJanela(g);
  if (!ufs.length) return null;
  const um = ufs.length === 1;
  return [
    ...listaUfs(ufs, idioma),
    tx(
      ` ${um ? "fica" : "ficam"} de fora: a série da EPE por UF não tem a janela completa de 12 meses ${um ? "do estado" : "dos estados"}, e ausência de dado não é zero.`,
      ` ${um ? "is" : "are"} excluded: the EPE series by state does not have the complete 12-month window for ${um ? "that state" : "those states"}, and missing data is not zero.`,
      idioma,
    ),
  ];
}

/** Frase da ausência: quem fica fora dos dois gráficos e que a ausência não é zero. Sem UF ausente, não há frase. */
export function textoUfsSemJanela(g: MercadoGold): string | null {
  const p = partesUfsSemJanela(g, "pt");
  return p && juntarPartes(p);
}

export type ContrasteUf = {
  /** UFs com janela completa. */
  total: number;
  maiorParticipacao: { uf: string; pct: number; livreGwh: number; posicaoVolume: number };
  maiorVolume: { uf: string; pct: number; livreGwh: number; posicaoParticipacao: number };
};

/** A UF de maior participação, a de maior volume livre e a posição de cada uma na outra medida (1 é a maior). */
export function contrasteUf(g: MercadoGold): ContrasteUf | null {
  const ufs = g.livre_regulado.epe_uf_12m.filter(ufComJanela);
  if (ufs.length < 2) return null;
  const porParticipacao = [...ufs].sort((a, b) => b.livre_pct! - a.livre_pct! || a.chave.localeCompare(b.chave));
  const porVolume = [...ufs].sort((a, b) => b.livre_mwh! - a.livre_mwh! || a.chave.localeCompare(b.chave));
  const posicao = (lista: EpeAbertura12m[], chave: string) => lista.findIndex((u) => u.chave === chave) + 1;
  const a = porParticipacao[0];
  const b = porVolume[0];
  return {
    total: ufs.length,
    maiorParticipacao: { uf: a.chave, pct: a.livre_pct!, livreGwh: a.livre_mwh! / 1e3, posicaoVolume: posicao(porVolume, a.chave) },
    maiorVolume: { uf: b.chave, pct: b.livre_pct!, livreGwh: b.livre_mwh! / 1e3, posicaoParticipacao: posicao(porParticipacao, b.chave) },
  };
}

/**
 * O que a participação esconde e o volume mostra, em duas frases com todo número vindo da gold: a UF de maior participação e onde ela fica em
 * volume, e a UF de maior volume e onde ela fica em participação. Sem artigo antes do nome da UF (o Pará, a Bahia, Goiás), para a frase valer
 * para qualquer UF sem regra de gênero.
 */
export function partesContrasteUf(g: MercadoGold, idioma: Idioma = idiomaEnergia()): ParteTexto[] | null {
  const c = contrasteUf(g);
  if (!c) return null;
  const { maiorParticipacao: a, maiorVolume: b } = c;
  if (a.uf === b.uf) {
    return [
      tx("Maior participação e maior volume livre: ", "Largest share and largest free-market volume: ", idioma),
      { uf: a.uf },
      tx(
        `, ${pct(a.pct, 1, idioma)} e ${num(a.livreGwh, 0, idioma)} GWh, entre as ${c.total} UFs com dado.`,
        `, ${pct(a.pct, 1, idioma)} and ${num(a.livreGwh, 0, idioma)} GWh, among the ${c.total} states with data.`,
        idioma,
      ),
    ];
  }
  return [
    tx("Maior participação do livre: ", "Largest free-market share: ", idioma),
    { uf: a.uf },
    tx(
      `, ${pct(a.pct, 1, idioma)}, que é o ${a.posicaoVolume}º em volume livre (${num(a.livreGwh, 0, idioma)} GWh). Maior volume livre: `,
      `, ${pct(a.pct, 1, idioma)}, which ranks ${ordinalEn(a.posicaoVolume)} in free-market volume (${num(a.livreGwh, 0, idioma)} GWh). Largest free-market volume: `,
      idioma,
    ),
    { uf: b.uf },
    tx(
      `, ${num(b.livreGwh, 0, idioma)} GWh, com participação de ${pct(b.pct, 1, idioma)}, a ${b.posicaoParticipacao}ª maior entre as ${c.total} UFs com dado.`,
      `, ${num(b.livreGwh, 0, idioma)} GWh, with a share of ${pct(b.pct, 1, idioma)}, the ${ordinalEn(b.posicaoParticipacao)} largest among the ${c.total} states with data.`,
      idioma,
    ),
  ];
}

function ordinalEn(n: number): string {
  const r100 = n % 100;
  const r10 = n % 10;
  const suf = r100 >= 11 && r100 <= 13 ? "th" : r10 === 1 ? "st" : r10 === 2 ? "nd" : r10 === 3 ? "rd" : "th";
  return `${n}${suf}`;
}

export function textoContrasteUf(g: MercadoGold): string | null {
  const p = partesContrasteUf(g, "pt");
  return p && juntarPartes(p);
}
