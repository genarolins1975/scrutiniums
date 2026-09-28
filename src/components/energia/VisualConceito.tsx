import type { ReactNode } from "react";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, pct, reais } from "@/lib/energia/formato";
import { BarrasMix } from "@/components/energia/BarrasMix";
import { MapaBrasil } from "@/components/energia/MapaBrasil";
import { Sparkline } from "@/components/energia/Sparkline";

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
  const spark = (valores: (number | null)[], cor: string, referencia?: number | null, faixa?: { inferior: (number | null)[]; superior: (number | null)[] }) => (
    <Sparkline valores={valores} cor={cor} referencia={referencia} faixa={faixa} largura={360} altura={96} rotulo="Forma da série recente" />
  );
  switch (slug) {
    case "pld":
    case "mcp": {
      if (!integra(pld)) return null;
      return { figura: spark(pld.diario.slice(-90).map((p) => p.SE), "var(--serie-pld)"), legenda: `PLD médio diário do Sudeste/Centro-Oeste nos últimos 90 dias, até ${dataBR(pld.dia_referencia)} (R$/MWh nominais).` };
    }
    case "submercado": {
      if (!integra(pld)) return null;
      return {
        figura: (
          <MapaBrasil titulo={`PLD médio de ${dataBR(pld.dia_referencia)} por submercado`} tom="preco" valores={Object.fromEntries(pld.cartoes.map((c) => [c.sm, { valor: reais(c.media_dia), sub: "R$/MWh", intensidade: c.posicao.percentil !== null ? c.posicao.percentil / 100 : null }]))} lista="abaixo" nota={null} />
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
      return { figura: spark(cmo.serie.slice(-52).map((s) => s.SE), "var(--serie-pld)"), legenda: `CMO semanal do Sudeste/Centro-Oeste nas últimas 52 semanas operativas (R$/MWh), estimado pelo DECOMP e publicado pelo ONS.` };
    }
    case "ear":
    case "armazenamento": {
      if (!integra(hid)) return null;
      const bandas = new Map(hid.bandas_ear.map((b) => [b.md as string, b as Record<string, number | null>]));
      const serie = hid.serie_ear.slice(-365);
      const md = (d: string) => (d.slice(5, 10) === "02-29" ? "02-28" : d.slice(5, 10));
      return {
        figura: spark(
          serie.map((p) => p.SIN ?? null),
          "var(--serie-hidraulica)",
          null,
          { inferior: serie.map((p) => bandas.get(md(p.d))?.SIN_p10 ?? null), superior: serie.map((p) => bandas.get(md(p.d))?.SIN_p90 ?? null) },
        ),
        legenda: `EAR do SIN nos últimos 12 meses (% da EAR máxima), sobre a faixa do 10º ao 90º percentil do mesmo dia nos anos desde 2001.`,
      };
    }
    case "ena":
    case "mlt": {
      if (!integra(hid)) return null;
      return { figura: spark(hid.serie_ena.slice(-120).map((p) => p.SIN ?? null), "var(--serie-hidraulica)", 100), legenda: `ENA bruta do SIN nos últimos 120 dias, em % da MLT; a linha tracejada é 100% da média de longo termo.` };
    }
    case "carga": {
      if (!integra(carga)) return null;
      return { figura: spark(carga.serie.slice(-365).map((p) => p.SIN ?? null), "var(--cor-energia)"), legenda: `Carga diária do SIN nos últimos 12 meses (MWmed), até ${dataBR(carga.dia_referencia)}.` };
    }
    case "geracao-centralizada": {
      if (!integra(ger)) return null;
      const s = ger.regioes.find((r) => r.rg === "SIN");
      if (!s) return null;
      return { figura: <BarrasMix linhas={[{ rotulo: "7 dias", mix: s["7d"], destaque: true }, { rotulo: "12 meses", mix: s["12m"] }]} />, legenda: `Composição da geração verificada do SIN por fonte, últimos 7 dias e 12 meses, até ${dataBR(ger.dia_referencia)}.` };
    }
    case "intercambio": {
      if (!integra(rede)) return null;
      return { figura: spark(rede.serie_fluxos.slice(-365).map((p) => (typeof p.NE_SE === "number" ? (p.NE_SE as number) : null)), "var(--cor-energia)", 0), legenda: `Intercâmbio médio diário do Nordeste para o Sudeste/Centro-Oeste nos últimos 12 meses (MWmed); abaixo da linha de zero, sentido inverso.` };
    }
    default:
      return null;
  }
}
