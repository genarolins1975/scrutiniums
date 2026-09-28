/**
 * "Exemplo real" de cada verbete: números do sistema lidos da gold no build.
 * Cada número traz o próprio selo de natureza (um valor publicado pela fonte é
 * OBSERVADO; média, soma, participação ou estatística da Scrutiniums é CALCULADO).
 * Sem dado, o verbete diz que o exemplo não está disponível.
 */
import { gold, integra } from "../gold";
import { dataBR, num, pct, reais } from "../formato";
import type { Natureza } from "../tipos";

export type TrechoExemplo = { texto: string; natureza?: Natureza };
export type Exemplo = { partes: TrechoExemplo[]; href: string } | null;

const t = (texto: string, natureza?: Natureza): TrechoExemplo => ({ texto, natureza });

export function exemploDe(slug: string): Exemplo {
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const carga = gold.carga();
  const ger = gold.geracao();
  const rede = gold.rede();
  const cmo = gold.cmo();
  switch (slug) {
    case "pld": {
      if (!integra(pld)) return null;
      const se = pld.cartoes.find((c) => c.sm === "SE")!;
      return {
        partes: [
          t(`Em ${dataBR(pld.dia_referencia)}, o PLD horário do Sudeste/Centro-Oeste variou de `),
          t(`${reais(se.min_hora)} a ${reais(se.max_hora)}/MWh`, "OBSERVADO"),
          t(" ao longo do dia; a média simples das 24 horas foi "),
          t(`${reais(se.media_dia)}/MWh`, "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/pld#hoje",
      };
    }
    case "mcp": {
      if (!integra(pld)) return null;
      const se = pld.cartoes.find((c) => c.sm === "SE" && c.max_hora !== null);
      if (!se) return null;
      return {
        partes: [
          t(`Na hora mais cara de ${dataBR(pld.dia_referencia)} no Sudeste/Centro-Oeste (${se.quando_max.slice(11, 13)}h), o PLD foi `),
          t(`${reais(se.max_hora)}/MWh`, "OBSERVADO"),
          t(": segundo a CCEE, esse é o preço do Mercado de Curto Prazo naquela hora e submercado. Os balanços e resultados do mercado, que a CCEE publica em outros conjuntos, ainda não estão integrados a este observatório."),
        ],
        href: "/setor-eletrico/pld#o-que-e",
      };
    }
    case "sin": {
      if (!integra(hid)) return null;
      const s = hid.subsistemas.find((x) => x.sm === "SIN");
      if (!s || s.ear.valor === null) return null;
      return {
        partes: [
          t(`Em ${dataBR(s.ear.dia)}, a EAR do SIN, calculada pela soma das EAR dos quatro subsistemas dividida pela soma das EAR máximas, era `),
          t(`${pct(s.ear.valor)} da EAR máxima`, "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/agua-e-clima#ear",
      };
    }
    case "submercado": {
      if (!integra(pld)) return null;
      return {
        partes: [
          t(`Em ${dataBR(pld.dia_referencia)}, a média diária do PLD foi `),
          t(pld.cartoes.map((c) => `${reais(c.media_dia)} no ${c.nome}`).join(", "), "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/pld#submercados",
      };
    }
    case "cmo":
    case "decomp": {
      if (!integra(cmo)) return null;
      const se = cmo.ultima_semana.find((x) => x.sm === "SE")!;
      return {
        partes: [
          t(`Para a semana operativa identificada pelo ONS com a data ${dataBR(cmo.semana_referencia)}, o CMO publicado para o Sudeste/Centro-Oeste foi `),
          t(`${reais(se.semanal)}/MWh (patamares leve ${reais(se.leve)}, médio ${reais(se.media)} e pesado ${reais(se.pesada)})`, "OBSERVADO"),
          t("."),
        ],
        href: "/setor-eletrico/pld#cmo",
      };
    }
    case "ear":
    case "armazenamento": {
      if (!integra(hid)) return null;
      const s = hid.subsistemas.find((x) => x.sm === "SE")!;
      return {
        partes: [
          t(`Em ${dataBR(s.ear.dia)}, os reservatórios do Sudeste/Centro-Oeste estavam com `),
          t(`${pct(s.ear.valor)} da EAR máxima`, "OBSERVADO"),
          t("; a mediana para a data, nos anos completos desde 2001, é "),
          t(pct(s.ear.mediana_historica), "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/agua-e-clima#ear",
      };
    }
    case "ena":
    case "mlt": {
      if (!integra(hid)) return null;
      const s = hid.subsistemas.find((x) => x.sm === "S")!;
      return {
        partes: [
          t(`Em ${dataBR(s.ena.dia)}, a ENA bruta do Sul foi `),
          t(`${pct(s.ena.pct_mlt_dia, 1)} da MLT`, "OBSERVADO"),
          t("; no acumulado de 30 dias (soma da ENA sobre soma da MLT), "),
          t(pct(s.ena.pct_mlt_30d, 1), "CALCULADO"),
          t("."),
        ],
        href: "/setor-eletrico/agua-e-clima#ena",
      };
    }
    case "carga": {
      if (!integra(carga)) return null;
      const s = carga.subsistemas.find((x) => x.sm === "SIN")!;
      return {
        partes: [t(`Em ${dataBR(carga.dia_referencia)}, a carga do SIN, soma dos quatro subsistemas, foi de `), t(`${num(s.dia, 0)} MWmed`, "CALCULADO"), t(".")],
        href: "/setor-eletrico/carga",
      };
    }
    case "geracao-centralizada": {
      if (!integra(ger)) return null;
      const m = ger.regioes.find((r) => r.rg === "SIN")?.["7d"];
      if (!m) return null;
      return {
        partes: [
          t(`Nos 7 dias até ${dataBR(m.fim)}, a geração verificada do SIN foi de `),
          t(
            `${num(m.total_mwmed, 0)} MWmed em média: ${pct(m.participacao.hidraulica)} hidráulica, ${pct(m.participacao.termica)} térmica, ${pct(m.participacao.eolica)} eólica e ${pct(m.participacao.solar)} solar`,
            "CALCULADO",
          ),
          t("."),
        ],
        href: "/setor-eletrico/geracao",
      };
    }
    case "intercambio": {
      if (!integra(rede)) return null;
      const f = rede.fronteiras.find((x) => x.par === "NE_SE");
      if (!f || f.fluxo_dia === null) return null;
      return {
        partes: [t(`Em ${dataBR(rede.dia_referencia)}, o fluxo médio diário do Nordeste para o Sudeste/Centro-Oeste foi de `), t(`${num(f.fluxo_dia, 0)} MWmed`, "CALCULADO"), t(".")],
        href: "/setor-eletrico/rede",
      };
    }
    default:
      return null;
  }
}
