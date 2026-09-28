/**
 * Leituras em linguagem humana geradas por regra a partir da gold. Nenhum texto
 * aqui afirma algo que o dado não sustenta: sem dado, a função devolve null e
 * a página mostra a ausência.
 */
import type { CargaGold, GeracaoGold, HidrologiaGold, PldCartao, PldGold } from "./tipos";
import { dataBR, num, pct, reais, sinal } from "./formato";

export const ROTULO_FAIXA_PLD: Record<string, string> = {
  baixa: "faixa baixa (abaixo do 25º percentil)",
  central: "faixa central (entre o 25º e o 75º percentil)",
  alta: "faixa alta (acima do 75º percentil)",
};

export const ROTULO_FAIXA_USUAL: Record<string, string> = {
  abaixo: "abaixo da faixa usual para a data",
  dentro: "dentro da faixa usual para a data",
  acima: "acima da faixa usual para a data",
};

export function leituraCartaoPld(c: PldCartao): string {
  const partes = [`PLD médio de ${reais(c.media_dia)}/MWh`];
  if (c.posicao.faixa) partes.push(`na ${ROTULO_FAIXA_PLD[c.posicao.faixa]} desde 2021`);
  return partes.join(", ");
}

export function sin<T extends { sm: string }>(xs: T[]): T | undefined {
  return xs.find((x) => x.sm === "SIN");
}

export function estadoEar(h: HidrologiaGold | null): string | null {
  if (!h?.disponivel) return null;
  const s = sin(h.subsistemas);
  if (!s || s.ear.valor === null) return null;
  const lado = (s.ear.desvio_mediana_pp ?? 0) >= 0 ? "acima" : "abaixo";
  return `SIN com ${pct(s.ear.valor)} da energia armazenável máxima em ${dataBR(s.ear.dia)}, ${num(Math.abs(s.ear.desvio_mediana_pp ?? 0))} p.p. ${lado} da mediana histórica para a data (${s.ear.anos_na_base} anos de base).`;
}

export function estadoEna(h: HidrologiaGold | null): string | null {
  if (!h?.disponivel) return null;
  const s = sin(h.subsistemas);
  if (!s || s.ena.pct_mlt_30d === null) return null;
  return `ENA bruta do SIN nos 30 dias até ${dataBR(s.ena.dia)}: ${pct(s.ena.pct_mlt_30d, 0)} da MLT${s.ena.faixa_30d ? `, ${ROTULO_FAIXA_USUAL[s.ena.faixa_30d]}` : ""}.`;
}

export function estadoCarga(c: CargaGold | null): string | null {
  if (!c?.disponivel) return null;
  const s = sin(c.subsistemas);
  if (!s?.ult7) return null;
  const v = s.ult7.variacao_pct;
  return `Carga média do SIN nos 7 dias até ${dataBR(s.ult7.fim)}: ${num(s.ult7.media, 0)} MWmed${v !== null ? ` (${sinal(v)}% sobre os mesmos dias de ${s.ult7.fim_anterior.slice(0, 4)})` : ""}.`;
}

export function estadoRenovaveis(g: GeracaoGold | null): string | null {
  if (!g?.disponivel) return null;
  const m = g.regioes.find((r) => r.rg === "SIN")?.["7d"];
  if (!m) return null;
  return `Nos 7 dias até ${dataBR(m.fim)}, eólica respondeu por ${pct(m.participacao.eolica)} e solar por ${pct(m.participacao.solar)} da geração verificada do SIN.`;
}

export function estadoTermicas(g: GeracaoGold | null): string | null {
  if (!g?.disponivel) return null;
  const t = g.termica_contexto;
  if (t.participacao_7d === null) return null;
  return `Térmicas com ${pct(t.participacao_7d)} da geração verificada nos 7 dias até ${dataBR(g.dia_referencia)}; mediana dos 12 meses anteriores: ${pct(t.mediana_365d)}. O CVU por usina está catalogado e ainda não integrado.`;
}

export function estadoPld(p: PldGold | null): string | null {
  if (!p?.disponivel) return null;
  const se = p.cartoes.find((c) => c.sm === "SE");
  if (!se) return null;
  return `Em ${dataBR(p.dia_referencia)}: ${leituraCartaoPld(se)} no Sudeste/Centro-Oeste; valores horários de ${reais(se.min_hora)} a ${reais(se.max_hora)}.`;
}
