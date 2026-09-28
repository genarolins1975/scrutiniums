import type { ReactNode } from "react";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, pct, reais } from "@/lib/energia/formato";
import { BarrasMix } from "@/components/energia/BarrasMix";
import { MapaBrasil } from "@/components/energia/MapaBrasil";
import { intensidadeFaixa } from "@/lib/energia/geo";
import { GraficoLinhas } from "@/components/energia/GraficoLinhas";

/**
 * "Veja": o mini visual de cada microaula, ligado ao dado real do conceito.
 * Sem dado integrado, devolve null e a microaula diz isso. Renderizado no
 * servidor; o mapa recebe só dados.
 */
export function VisualConceito({ slug }: { slug: string }): { figura: ReactNode; legenda: string } | null {
  const pld = gold.pld();
  const hid = gold.hidrologia();
  const carga = gold.carga();
  const ger = gold.geracao();
  const rede = gold.rede();
  const cmo = gold.cmo();
  /** Gráfico compacto com régua: eixo, datas, último valor e, quando há, referência tracejada ou faixa histórica. */
  const linha = (
    titulo: string,
    pontos: { d: string; v: number | null; ref?: number | null; p10?: number | null; p90?: number | null }[],
    cor: string,
    unidade: string,
    casas: number,
    opcoes: { referencia?: string; banda?: string; zeroNoEixo?: boolean } = {},
  ) => (
    <GraficoLinhas
      titulo={titulo}
      dados={pontos}
      chaveX="d"
      series={[
        { id: "v", rotulo: titulo, sigla: "hoje", cor, espessura: 2 },
        ...(opcoes.referencia ? [{ id: "ref", rotulo: opcoes.referencia, cor: "var(--serie-referencia)", tracejada: true }] : []),
      ]}
      banda={opcoes.banda ? { inferior: "p10", superior: "p90", rotulo: opcoes.banda } : undefined}
      unidade={unidade}
      casas={casas}
      altura={190}
      zeroNoEixo={opcoes.zeroNoEixo}
    />
  );
  switch (slug) {
    case "pld":
    case "mcp": {
      if (!integra(pld)) return null;
      return { figura: linha("PLD médio diário, Sudeste/Centro-Oeste, últimos 90 dias", pld.diario.slice(-90).map((p) => ({ d: p.d, v: p.SE })), "var(--serie-pld)", "R$/MWh", 2), legenda: `PLD médio diário do Sudeste/Centro-Oeste nos últimos 90 dias, até ${dataBR(pld.dia_referencia)} (R$/MWh nominais).` };
    }
    case "submercado": {
      if (!integra(pld)) return null;
      return {
        figura: (
          <MapaBrasil titulo={`PLD médio de ${dataBR(pld.dia_referencia)} por submercado`} tom="preco" valores={Object.fromEntries(pld.cartoes.map((c) => [c.sm, { valor: reais(c.media_dia), sub: "R$/MWh", intensidade: intensidadeFaixa(c.posicao.percentil) }]))} lista="abaixo" nota={null} />
        ),
        legenda: `Os quatro submercados com o PLD médio de ${dataBR(pld.dia_referencia)}. Mapa esquemático, sem escala.`,
      };
    }
    case "sin": {
      if (!integra(hid)) return null;
      return {
        figura: (
          <MapaBrasil titulo={`EAR por subsistema em ${dataBR(hid.dia_referencia_ear)}`} tom="agua" valores={Object.fromEntries(hid.subsistemas.filter((s) => s.sm !== "SIN").map((s) => [s.sm, { valor: pct(s.ear.valor), sub: "da EAR máxima", intensidade: s.ear.valor !== null ? s.ear.valor / 100 : null }]))} lista="abaixo" nota={null} />
        ),
        legenda: `Os quatro subsistemas do ONS que formam o SIN, com a EAR de ${dataBR(hid.dia_referencia_ear)}. Mapa esquemático, sem escala.`,
      };
    }
    case "cmo":
    case "decomp":
    case "dessem":
    case "newave": {
      if (!integra(cmo)) return null;
      return { figura: linha("CMO semanal, Sudeste/Centro-Oeste, últimas 52 semanas", cmo.serie.slice(-52).map((s) => ({ d: s.s, v: s.SE })), "var(--serie-pld)", "R$/MWh", 2), legenda: `CMO semanal do Sudeste/Centro-Oeste nas últimas 52 semanas operativas (R$/MWh), estimado pelo DECOMP e publicado pelo ONS.` };
    }
    case "ear":
    case "armazenamento": {
      if (!integra(hid)) return null;
      const bandas = new Map(hid.bandas_ear.map((b) => [b.md as string, b as Record<string, number | null>]));
      const serie = hid.serie_ear.slice(-365);
      const md = (d: string) => (d.slice(5, 10) === "02-29" ? "02-28" : d.slice(5, 10));
      return {
        figura: linha(
          "EAR do SIN, últimos 12 meses, sobre a faixa histórica do dia",
          serie.map((p) => ({ d: p.d, v: p.SIN ?? null, p10: bandas.get(md(p.d))?.SIN_p10 ?? null, p90: bandas.get(md(p.d))?.SIN_p90 ?? null })),
          "var(--serie-hidraulica)",
          "%",
          1,
          { banda: "10º a 90º percentil do mesmo dia (desde 2001)" },
        ),
        legenda: `EAR do SIN nos últimos 12 meses (% da EAR máxima), sobre a faixa do 10º ao 90º percentil do mesmo dia nos anos desde 2001.`,
      };
    }
    case "ena":
    case "mlt": {
      if (!integra(hid)) return null;
      return { figura: linha("ENA bruta do SIN, últimos 120 dias", hid.serie_ena.slice(-120).map((p) => ({ d: p.d, v: p.SIN ?? null, ref: 100 })), "var(--serie-hidraulica)", "% da MLT", 0, { referencia: "100% da MLT" }), legenda: `ENA bruta do SIN nos últimos 120 dias, em % da MLT; a linha tracejada é 100% da média de longo termo.` };
    }
    case "carga": {
      if (!integra(carga)) return null;
      return { figura: linha("Carga diária do SIN, últimos 12 meses", carga.serie.slice(-365).map((p) => ({ d: p.d, v: p.SIN ?? null })), "var(--cor-energia)", "MWmed", 0), legenda: `Carga diária do SIN nos últimos 12 meses (MWmed), até ${dataBR(carga.dia_referencia)}.` };
    }
    case "geracao-centralizada": {
      if (!integra(ger)) return null;
      const s = ger.regioes.find((r) => r.rg === "SIN");
      if (!s) return null;
      return { figura: <BarrasMix linhas={[{ rotulo: "7 dias", mix: s["7d"], destaque: true }, { rotulo: "12 meses", mix: s["12m"] }]} />, legenda: `Composição da geração verificada do SIN por fonte, últimos 7 dias e 12 meses, até ${dataBR(ger.dia_referencia)}.` };
    }
    case "intercambio": {
      if (!integra(rede)) return null;
      return { figura: linha("Intercâmbio Nordeste para Sudeste/Centro-Oeste, últimos 12 meses", rede.serie_fluxos.slice(-365).map((p) => ({ d: p.d, v: typeof p.NE_SE === "number" ? (p.NE_SE as number) : null })), "var(--cor-energia)", "MWmed", 0, { zeroNoEixo: true }), legenda: `Intercâmbio médio diário do Nordeste para o Sudeste/Centro-Oeste nos últimos 12 meses (MWmed); abaixo da linha de zero, sentido inverso.` };
    }
    default:
      return null;
  }
}
