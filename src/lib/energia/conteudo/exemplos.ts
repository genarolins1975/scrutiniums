/**
 * "Exemplo real" de cada verbete: um número do sistema lido da gold no build,
 * com natureza e data. Sem dado, o verbete diz que o exemplo não está disponível.
 */
import { gold, integra } from "../gold";
import { dataBR, num, pct, reais } from "../formato";
import type { Natureza } from "../tipos";

export type Exemplo = { texto: string; natureza: Natureza; href: string } | null;

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
      return { texto: `Em ${dataBR(pld.dia_referencia)}, o PLD do Sudeste/Centro-Oeste variou de ${reais(se.min_hora)} a ${reais(se.max_hora)}/MWh ao longo do dia, com média de ${reais(se.media_dia)}/MWh.`, natureza: "OBSERVADO", href: "/setor-eletrico/pld#hoje" };
    }
    case "submercado": {
      if (!integra(pld)) return null;
      return { texto: `Em ${dataBR(pld.dia_referencia)}, o PLD médio foi ${pld.cartoes.map((c) => `${reais(c.media_dia)} no ${c.nome}`).join(", ")}.`, natureza: "CALCULADO", href: "/setor-eletrico/pld#submercados" };
    }
    case "cmo":
    case "decomp": {
      if (!integra(cmo)) return null;
      const se = cmo.ultima_semana.find((x) => x.sm === "SE")!;
      return { texto: `Para a semana operativa de ${dataBR(cmo.semana_referencia)}, o ONS publicou CMO de ${reais(se.semanal)}/MWh no Sudeste/Centro-Oeste (patamares leve ${reais(se.leve)}, médio ${reais(se.media)} e pesado ${reais(se.pesada)}).`, natureza: "OBSERVADO", href: "/setor-eletrico/pld#cmo" };
    }
    case "ear":
    case "armazenamento": {
      if (!integra(hid)) return null;
      const s = hid.subsistemas.find((x) => x.sm === "SE")!;
      return { texto: `Em ${dataBR(s.ear.dia)}, os reservatórios do Sudeste/Centro-Oeste estavam com ${pct(s.ear.valor)} da EAR máxima; a mediana para a data, desde 2001, é ${pct(s.ear.mediana_historica)}.`, natureza: "OBSERVADO", href: "/setor-eletrico/agua-e-clima#ear" };
    }
    case "ena":
    case "mlt": {
      if (!integra(hid)) return null;
      const s = hid.subsistemas.find((x) => x.sm === "S")!;
      return { texto: `Em ${dataBR(s.ena.dia)}, a ENA bruta do Sul foi ${pct(s.ena.pct_mlt_dia, 0)} da MLT; no acumulado de 30 dias, ${pct(s.ena.pct_mlt_30d, 0)}.`, natureza: "OBSERVADO", href: "/setor-eletrico/agua-e-clima#ena" };
    }
    case "carga": {
      if (!integra(carga)) return null;
      const s = carga.subsistemas.find((x) => x.sm === "SIN")!;
      return { texto: `Em ${dataBR(carga.dia_referencia)}, a carga do SIN foi de ${num(s.dia, 0)} MWmed (soma dos quatro subsistemas).`, natureza: "CALCULADO", href: "/setor-eletrico/carga" };
    }
    case "geracao-centralizada": {
      if (!integra(ger)) return null;
      const m = ger.regioes.find((r) => r.rg === "SIN")?.["7d"];
      if (!m) return null;
      return { texto: `Nos 7 dias até ${dataBR(m.fim)}, a geração verificada do SIN foi de ${num(m.total_mwmed, 0)} MWmed em média: ${pct(m.participacao.hidraulica)} hidráulica, ${pct(m.participacao.termica)} térmica, ${pct(m.participacao.eolica)} eólica e ${pct(m.participacao.solar)} solar.`, natureza: "CALCULADO", href: "/setor-eletrico/geracao" };
    }
    case "intercambio": {
      if (!integra(rede)) return null;
      const f = rede.fronteiras.find((x) => x.par === "NE_SE");
      if (!f || f.fluxo_dia === null) return null;
      return { texto: `Em ${dataBR(rede.dia_referencia)}, o fluxo médio do Nordeste para o Sudeste/Centro-Oeste foi de ${num(f.fluxo_dia, 0)} MWmed.`, natureza: "CALCULADO", href: "/setor-eletrico/rede" };
    }
    default:
      return null;
  }
}
