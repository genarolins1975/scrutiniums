import { NOME_UF } from "./expansao";
import { num, pct } from "./formato";
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

/** Frase da ausência: quem fica fora dos dois gráficos e que a ausência não é zero. Sem UF ausente, não há frase. */
export function textoUfsSemJanela(g: MercadoGold): string | null {
  const nomes = ufsSemJanela(g).map((u) => NOME_UF[u] ?? u);
  if (!nomes.length) return null;
  const lista = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `${lista} ${nomes.length === 1 ? "fica" : "ficam"} de fora: a série da EPE por UF não tem a janela completa de 12 meses ${nomes.length === 1 ? "do estado" : "dos estados"}, e ausência de dado não é zero.`;
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
export function textoContrasteUf(g: MercadoGold): string | null {
  const c = contrasteUf(g);
  if (!c) return null;
  const { maiorParticipacao: a, maiorVolume: b } = c;
  const nome = (uf: string) => NOME_UF[uf] ?? uf;
  if (a.uf === b.uf) {
    return `Maior participação e maior volume livre: ${nome(a.uf)}, ${pct(a.pct, 1)} e ${num(a.livreGwh, 0)} GWh, entre as ${c.total} UFs com dado.`;
  }
  return (
    `Maior participação do livre: ${nome(a.uf)}, ${pct(a.pct, 1)}, que é o ${a.posicaoVolume}º em volume livre (${num(a.livreGwh, 0)} GWh). ` +
    `Maior volume livre: ${nome(b.uf)}, ${num(b.livreGwh, 0)} GWh, com participação de ${pct(b.pct, 1)}, a ${b.posicaoParticipacao}ª maior entre as ${c.total} UFs com dado.`
  );
}
