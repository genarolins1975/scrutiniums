/**
 * Leituras em linguagem humana geradas por regra a partir da gold. Nenhum texto
 * aqui afirma algo que o dado não sustenta: sem dado, a função devolve null e
 * a página mostra a ausência.
 */
import type { CargaGold, GeracaoGold, HidrologiaGold, PldCartao, PldGold } from "./tipos";
import { dataBR, nomeSubmercado, num, pct, reais, sinal } from "./formato";
import { tx } from "./idioma";

/** Faixa do PLD médio diário no histórico desde 2021, no idioma da página. */
export function rotuloFaixaPld(faixa: string): string | undefined {
  switch (faixa) {
    case "baixa":
      return tx("faixa baixa (abaixo do 25º percentil)", "low band (below the 25th percentile)");
    case "central":
      return tx("faixa central (entre o 25º e o 75º percentil)", "central band (between the 25th and 75th percentiles)");
    case "alta":
      return tx("faixa alta (acima do 75º percentil)", "high band (above the 75th percentile)");
  }
  return undefined;
}

/** Posição em relação à faixa usual para a data, no idioma da página. */
export function rotuloFaixaUsual(faixa: string): string | undefined {
  switch (faixa) {
    case "abaixo":
      return tx("abaixo da faixa usual para a data", "below the usual range for the date");
    case "dentro":
      return tx("dentro da faixa usual para a data", "within the usual range for the date");
    case "acima":
      return tx("acima da faixa usual para a data", "above the usual range for the date");
  }
  return undefined;
}

export function leituraCartaoPld(c: PldCartao): string {
  const partes = [tx(`PLD médio de ${reais(c.media_dia)}/MWh`, `average PLD of ${reais(c.media_dia)}/MWh`)];
  if (c.posicao.faixa) partes.push(tx(`na ${rotuloFaixaPld(c.posicao.faixa)} desde 2021`, `in the ${rotuloFaixaPld(c.posicao.faixa)} since 2021`));
  return partes.join(", ");
}

export function sin<T extends { sm: string }>(xs: T[]): T | undefined {
  return xs.find((x) => x.sm === "SIN");
}

export function estadoEar(h: HidrologiaGold | null): string | null {
  if (!h?.disponivel) return null;
  const s = sin(h.subsistemas);
  if (!s || s.ear.valor === null) return null;
  const acima = (s.ear.desvio_mediana_pp ?? 0) >= 0;
  return tx(
    `SIN com ${pct(s.ear.valor)} da energia armazenável máxima em ${dataBR(s.ear.dia)}, ${num(Math.abs(s.ear.desvio_mediana_pp ?? 0))} p.p. ${acima ? "acima" : "abaixo"} da mediana histórica para a data (${s.ear.anos_na_base} anos de base).`,
    `SIN at ${pct(s.ear.valor)} of maximum storable energy on ${dataBR(s.ear.dia)}, ${num(Math.abs(s.ear.desvio_mediana_pp ?? 0))} percentage points ${acima ? "above" : "below"} the historical median for the date (${s.ear.anos_na_base} years of data).`,
  );
}

export function estadoEna(h: HidrologiaGold | null): string | null {
  if (!h?.disponivel) return null;
  const s = sin(h.subsistemas);
  if (!s || s.ena.pct_mlt_30d === null) return null;
  return tx(
    `ENA bruta do SIN nos 30 dias até ${dataBR(s.ena.dia)}: ${pct(s.ena.pct_mlt_30d, 0)} da MLT${s.ena.faixa_30d ? `, ${rotuloFaixaUsual(s.ena.faixa_30d)}` : ""}.`,
    `Gross natural inflow energy (ENA) of the SIN in the 30 days to ${dataBR(s.ena.dia)}: ${pct(s.ena.pct_mlt_30d, 0)} of the long-term average (MLT)${s.ena.faixa_30d ? `, ${rotuloFaixaUsual(s.ena.faixa_30d)}` : ""}.`,
  );
}

export function estadoCarga(c: CargaGold | null): string | null {
  if (!c?.disponivel) return null;
  const s = sin(c.subsistemas);
  if (!s?.ult7) return null;
  const v = s.ult7.variacao_pct;
  return tx(
    `Carga média do SIN nos 7 dias até ${dataBR(s.ult7.fim)}: ${num(s.ult7.media, 0)} MWmed${v !== null ? ` (${sinal(v)}% sobre os mesmos dias de ${s.ult7.fim_anterior.slice(0, 4)})` : ""}.`,
    `Average SIN load in the 7 days to ${dataBR(s.ult7.fim)}: ${num(s.ult7.media, 0)} MWavg${v !== null ? ` (${sinal(v)}% versus the same days of ${s.ult7.fim_anterior.slice(0, 4)})` : ""}.`,
  );
}

export function estadoRenovaveis(g: GeracaoGold | null): string | null {
  if (!g?.disponivel) return null;
  const m = g.regioes.find((r) => r.rg === "SIN")?.["7d"];
  if (!m) return null;
  return tx(
    `Nos 7 dias até ${dataBR(m.fim)}, eólica respondeu por ${pct(m.participacao.eolica)} e solar por ${pct(m.participacao.solar)} da geração verificada do SIN.`,
    `In the 7 days to ${dataBR(m.fim)}, wind accounted for ${pct(m.participacao.eolica)} and solar for ${pct(m.participacao.solar)} of verified SIN generation.`,
  );
}

export function estadoTermicas(g: GeracaoGold | null): string | null {
  if (!g?.disponivel) return null;
  const t = g.termica_contexto;
  if (t.participacao_7d === null) return null;
  return tx(
    `Térmicas com ${pct(t.participacao_7d)} da geração verificada nos 7 dias até ${dataBR(g.dia_referencia)}; mediana dos 12 meses anteriores: ${pct(t.mediana_365d)}. O CVU por usina está catalogado e ainda não integrado.`,
    `Thermal plants with ${pct(t.participacao_7d)} of verified generation in the 7 days to ${dataBR(g.dia_referencia)}; median of the previous 12 months: ${pct(t.mediana_365d)}. The variable unit cost (CVU) by plant is cataloged and not yet integrated.`,
  );
}

export function estadoPld(p: PldGold | null): string | null {
  if (!p?.disponivel) return null;
  const se = p.cartoes.find((c) => c.sm === "SE");
  if (!se) return null;
  return tx(
    `Em ${dataBR(p.dia_referencia)}: ${leituraCartaoPld(se)} no Sudeste/Centro-Oeste; valores horários de ${reais(se.min_hora)} a ${reais(se.max_hora)}.`,
    `On ${dataBR(p.dia_referencia)}: ${leituraCartaoPld(se)} in the ${nomeSubmercado("SE")}; hourly values from ${reais(se.min_hora)} to ${reais(se.max_hora)}.`,
  );
}
