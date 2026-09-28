import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gold, integra } from "@/lib/energia/gold";
import { dataBR, mesAno, num, pct, reais } from "@/lib/energia/formato";
import { PAGINAS_MAPA } from "@/lib/energia/mapa";

/**
 * Amostras vivas dos dois observatórios para a home e para a tela de escolha:
 * poucos números reais, cada um com fonte e data de referência, lidos das
 * golds publicadas. Sem gold, a amostra fica vazia e a interface diz isso.
 */
export type Amostra = { rotulo: string; valor: string; nota: string };

export type MiniaturaEnergiaDados = {
  ear: number | null;
  hes: number | null;
  fluxoNeSe: number | null;
  carga: number | null;
  pld: number | null;
  serieEar: (number | null)[];
  seriePld: (number | null)[];
  datas: { ear: string | null; geracao: string | null; rede: string | null; carga: string | null; pld: string | null };
};

export function miniaturaEnergia(): MiniaturaEnergiaDados {
  const hid = gold.hidrologia();
  const ger = gold.geracao();
  const rede = gold.rede();
  const carga = gold.carga();
  const pld = gold.pld();
  const sinH = integra(hid) ? hid.subsistemas.find((s) => s.sm === "SIN") : undefined;
  const sinG = integra(ger) ? ger.regioes.find((r) => r.rg === "SIN")?.["7d"] : undefined;
  const sinC = integra(carga) ? carga.subsistemas.find((s) => s.sm === "SIN") : undefined;
  const ne = integra(rede) ? rede.fronteiras.find((f) => f.par === "NE_SE") : undefined;
  const se = integra(pld) ? pld.cartoes.find((c) => c.sm === "SE") : undefined;
  return {
    ear: sinH?.ear.valor ?? null,
    hes: sinG?.hes ?? null,
    fluxoNeSe: ne?.fluxo_dia ?? null,
    carga: sinC?.dia ?? null,
    pld: se?.media_dia ?? null,
    serieEar: integra(hid) ? hid.serie_ear.slice(-90).map((p) => p.SIN ?? null) : [],
    seriePld: integra(pld) ? pld.diario.slice(-90).map((p) => p.SE) : [],
    datas: {
      ear: integra(hid) ? hid.dia_referencia_ear : null,
      geracao: integra(ger) ? ger.dia_referencia : null,
      rede: integra(rede) ? rede.dia_referencia : null,
      carga: integra(carga) ? carga.dia_referencia : null,
      pld: integra(pld) ? pld.dia_referencia : null,
    },
  };
}

export function amostrasEnergia(): Amostra[] {
  const m = miniaturaEnergia();
  const out: Amostra[] = [];
  if (m.pld !== null && m.datas.pld) out.push({ rotulo: "PLD médio, Sudeste/Centro-Oeste", valor: `${reais(m.pld)}/MWh`, nota: `CCEE · ${dataBR(m.datas.pld)} · calculado` });
  if (m.ear !== null && m.datas.ear) out.push({ rotulo: "Reservatórios do SIN", valor: pct(m.ear), nota: `da EAR máxima · ONS · ${dataBR(m.datas.ear)} · calculado` });
  if (m.hes !== null && m.datas.geracao) out.push({ rotulo: "Hidráulica, eólica e solar", valor: pct(m.hes), nota: `da geração verificada em 7 dias · ONS · até ${dataBR(m.datas.geracao)}` });
  return out;
}

/** Perguntas que o portal do Setor Elétrico responde, com o link de cada uma (as mesmas dos títulos das páginas). */
export const PERGUNTAS_ENERGIA = (["visao-geral", "pld-o-que-e", "agua-e-clima", "geracao", "carga", "rede"] as const).map((id) => ({
  texto: PAGINAS_MAPA[id].pergunta,
  href: PAGINAS_MAPA[id].href,
}));

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura das golds do Crédito, sem tipos gerados */
function lerCredito(nome: string): any {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "public", "obs", "data", "gold", `${nome}.json`), "utf-8"));
  } catch {
    return null;
  }
}

export type MiniaturaCreditoDados = {
  serieInad: { p: string; v: number }[];
  ufs: { uf: string; inad: number }[];
  dataBase: string | null;
};

export function miniaturaCredito(): MiniaturaCreditoDados {
  const p = lerCredito("panorama");
  if (!p?.disponivel) return { serieInad: [], ufs: [], dataBase: null };
  const serieInad = (p.serie_br ?? []).filter((x: any) => typeof x.inad === "number").map((x: any) => ({ p: String(x.p), v: Number(x.inad) }));
  const ufs = (p.mapa ?? [])
    .filter((x: any) => typeof x.inad === "number")
    .map((x: any) => ({ uf: String(x.uf), inad: Number(x.inad) }))
    .sort((a: { inad: number }, b: { inad: number }) => a.inad - b.inad);
  return { serieInad, ufs, dataBase: p.data_base ? String(p.data_base) : null };
}

export function amostrasCredito(): Amostra[] {
  const out: Amostra[] = [];
  const p = lerCredito("panorama");
  const pix = lerCredito("pix");
  if (p?.disponivel && p.kpis?.saldo?.v) {
    out.push({ rotulo: "Carteira de crédito do país", valor: `R$ ${num(p.kpis.saldo.v / 1e12, 2)} tri`, nota: `SCR.data · data-base ${mesAno(String(p.data_base))}` });
    if (typeof p.kpis?.inad?.v === "number") out.push({ rotulo: "Inadimplência (conceito SCR)", valor: pct(p.kpis.inad.v, 2), nota: `27 estados · ${mesAno(String(p.data_base))} · calculado` });
  }
  if (pix?.disponivel && typeof pix.kpis?.qtd?.v === "number") {
    out.push({ rotulo: "Transações Pix no mês", valor: `${num(pix.kpis.qtd.v / 1e9, 1)} bi`, nota: `Banco Central · ${pix.mes ? mesAno(String(pix.mes)) : "mês não informado"}` });
  }
  return out;
}

/** As mesmas perguntas do catálogo didático da vitrine do Crédito, com a aba que responde cada uma. */
export const PERGUNTAS_CREDITO = [
  { texto: "Onde está o crédito no Brasil e quem são os tomadores?", href: "/observatorio/credit-panorama" },
  { texto: "Qual a situação de cada banco, e como se comparam?", href: "/observatorio/institutions" },
  { texto: "Quanto custa cada produto, em cada instituição?", href: "/observatorio/products" },
  { texto: "Como o Pix mudou os pagamentos brasileiros?", href: "/observatorio/pix" },
  { texto: "Há estresse de crédito se formando agora?", href: "/observatorio/leading-signals" },
  { texto: "Quanto valem os bancos listados e de onde vem o lucro?", href: "/observatorio/market" },
];
