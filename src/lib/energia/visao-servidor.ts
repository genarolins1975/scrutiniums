/**
 * Leitura, no servidor, do que a Visão geral precisa dos módulos de origem para dizer o corte e a data de cada medida, e para escrever
 * a ressalva essencial junto do número: o DEC apurado e o que a regra exclui, o denominador das perdas, a cobertura da tarifa de
 * referência, a EAR sem arredondamento duplo, a referência sazonal do PLD, a capacidade de armazenamento, os cortes da carga e o saldo
 * líquido da rede.
 *
 * Cada valor é lido da gold ou da série publicada do módulo que o produz (qualidade, perdas, conta, pld, agua, carga, rede), e os
 * textos saem das funções puras de visao.ts. Nada é calculado por conta própria além do que a função pura documenta; arquivo ausente
 * ou ilegível vira `null` e a página mostra só o que tem. Só a página (servidor) importa este arquivo: ele usa `node:fs`.
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { lerCsvComAspas } from "./dados-servidor";
import { dataBR } from "./formato";
import { lerGold } from "./gold";
import type { CargaGold, GeracaoGold, HidrologiaGold, PldGold } from "./tipos";
import type { AguaDetalheGold } from "./tipos-agua";
import type { CargaDetalheGold } from "./tipos-carga";
import type { ContaGold } from "./tipos-conta";
import type { PerdasGold } from "./tipos-perdas";
import type { PldDetalheGold } from "./tipos-pld";
import type { QualidadeGold } from "./tipos-qualidade";
import type { GoldRedeDetalhe } from "./tipos-rede";
import type { SinteseVisaoGold } from "./tipos-visao";
import {
  coberturaTarifa,
  decDoAno,
  denominadorPerdas,
  horasContraOSaldo,
  serieEarSin,
  textoCapacidadeAgua,
  textoCargaNoModulo,
  textoDoisCriteriosPld,
  textoEarNoModulo,
  textoSaldoLiquidoRede,
  textoSazonalPld,
  type CoberturaTarifa,
  type ContextoSociedade,
  type DecDoAno,
  type DenominadorPerdas,
  type LinhaPerdasCsv,
  type PosicaoPldSazonal,
} from "./visao";

const SERIES = () => join(process.cwd(), "public", "energia", "series");

const cacheCsv = new Map<string, { mtime: number; dado: string[][] }>();

/** CSV publicado em public/energia/series (separador ";", BOM e aspas tratados), relido quando o arquivo muda; null se ausente. */
function lerCsvSerie(nome: string): string[][] | null {
  try {
    const caminho = join(SERIES(), nome);
    const mtime = statSync(caminho).mtimeMs;
    const c = cacheCsv.get(nome);
    if (c && c.mtime === mtime) return c.dado;
    const dado = lerCsvComAspas(readFileSync(caminho, "utf-8"));
    cacheCsv.set(nome, { mtime, dado });
    return dado;
  } catch {
    return null;
  }
}

function comoObjetos(linhas: string[][] | null): LinhaPerdasCsv[] | null {
  if (!linhas || linhas.length < 2) return null;
  const [cab, ...resto] = linhas;
  return resto.map((l) => Object.fromEntries(cab.map((c, i) => [c, l[i] ?? ""])));
}

/** O que a Visão geral mostra de uma medida que o módulo de origem também mostra, para a página dizer onde os dois diferem. */
export type ContextoVisao = {
  sociedade: ContextoSociedade;
  dec: DecDoAno | null;
  perdas: DenominadorPerdas | null;
  tarifa: CoberturaTarifa | null;
  /** EAR do SIN por dia com quatro casas (ear_diario.csv); vazio quando o arquivo não está publicado. */
  earSin: ReadonlyMap<string, number>;
  /** Mediana da data da EAR do SIN por dia do calendário (hidrologia.json, bandas_ear). */
  bandasAgua: { md: string; SIN_p50?: number | null }[];
  /** Mediana da data no dia de referência e o ano da base, para a faixa de métricas. */
  medianaAgua: { valor: number | null; base: string | null };
  /** Referência sazonal do PLD em uma linha, para a faixa de métricas. */
  sazonalPld: string | null;
  /** Os dois percentis do PLD do dia (todas as médias desde 2021 e o mesmo mês dos anos anteriores), para a linha de contexto. */
  pldReferencia: { percentilTodos: number | null; diasTodos: number; percentilMes: number | null; mes: number | null } | null;
  /** Carga em 7 dias: o percentual desta página (mesmas datas do ano anterior) e o da página Carga (mesmos dias da semana). */
  cargaModulo: { mesmasDatasPct: number | null; mesmosDiasDaSemanaPct: number | null } | null;
  /** Os dois critérios do PLD, com a ponte, para ler junto da frase. */
  doisCriteriosPld: string | null;
  capacidadeAgua: string | null;
  earNoModulo: string | null;
  /** A EAR do SIN na página Água e clima quando o dia dela difere do da Visão geral, para a linha de contexto da medida. */
  aguaModulo: { dia: string; pct: number } | null;
  cargaNoModulo: string | null;
  saldoRede: string | null;
  /** Carga do SIN em 7 dias como a frase a usa (carga.json): média, comparação e janelas. */
  carga7d: { media: number | null; mediaAnterior: number | null; variacaoPct: number | null; inicio: string; fim: string; inicioAnterior: string; fimAnterior: string } | null;
  /** Participação térmica de 7 dias e a faixa dos 365 dias anteriores (geracao.json). */
  termica: { participacao: number | null; mediana: number | null; p10: number | null; p90: number | null; inicio: string | null; fim: string | null } | null;
  /** Dia de referência de cada módulo de origem, quando difere do que a Visão geral usa. */
  diasDosModulos: { agua: string | null; rede: string | null };
};

const FRONTEIRAS: { par: "N_NE" | "N_SE" | "NE_SE" | "S_SE"; rotulo: string }[] = [
  { par: "N_NE", rotulo: "Norte → Nordeste" },
  { par: "N_SE", rotulo: "Norte → Sudeste/Centro-Oeste" },
  { par: "NE_SE", rotulo: "Nordeste → Sudeste/Centro-Oeste" },
  { par: "S_SE", rotulo: "Sul → Sudeste/Centro-Oeste" },
];

export function contextoVisao(g: SinteseVisaoGold): ContextoVisao {
  const qualidade = lerGold<QualidadeGold>("qualidade.json");
  const perdasGold = lerGold<PerdasGold>("perdas.json");
  const conta = lerGold<ContaGold>("conta.json");
  const hid = lerGold<HidrologiaGold>("hidrologia.json");
  const pld = lerGold<PldGold>("pld.json");
  const pldDet = lerGold<PldDetalheGold>("pld_detalhe.json");
  const agua = lerGold<AguaDetalheGold>("agua_detalhe.json");
  const carga = lerGold<CargaGold>("carga.json");
  const cargaDet = lerGold<CargaDetalheGold>("carga_detalhe.json");
  const geracao = lerGold<GeracaoGold>("geracao.json");
  const redeDet = lerGold<GoldRedeDetalhe>("rede_detalhe.json");

  const m = g.multiplos;
  const painel = (id: string) => m?.paineis.find((p) => p.id === id) ?? null;

  /* sociedade: DEC apurado, denominador das perdas e cobertura da tarifa */
  const continuidade = g.sociedade.itens.find((i) => i.id === "continuidade");
  const anoDec = continuidade ? Number(continuidade.periodo.fim.slice(0, 4)) : null;
  const dec = anoDec !== null && qualidade && qualidade.disponivel !== false ? decDoAno(qualidade, anoDec) : null;
  const perdasItem = g.sociedade.itens.find((i) => i.id === "perdas");
  const anoPerdas = perdasItem ? Number(perdasItem.periodo.fim.slice(0, 4)) : null;
  const nacional = anoPerdas !== null ? perdasGold?.nacional?.find((x) => x.ano === anoPerdas && x.universo === "concessionarias") : undefined;
  const perdas =
    nacional && anoPerdas !== null && nacional.injetada_mwh !== null && nacional.perdas_totais_mwh !== null
      ? denominadorPerdas(comoObjetos(lerCsvSerie("perdas_distribuidoras.csv")), anoPerdas, {
          n_distribuidoras: nacional.n_distribuidoras,
          injetada_mwh: nacional.injetada_mwh,
          perdas_totais_mwh: nacional.perdas_totais_mwh,
        })
      : null;
  const tarifaItem = g.sociedade.itens.find((i) => i.id === "tarifa");
  const tarifa = tarifaItem ? coberturaTarifa(conta, tarifaItem.periodo.fim) : null;

  /* água: EAR com a série publicada, mediana da data, capacidade e o dia do módulo Água e clima */
  const earSin = serieEarSin(lerCsvSerie("ear_diario.csv") ?? []);
  const bandasAgua = (hid?.bandas_ear ?? []).map((b) => ({ md: String(b.md), SIN_p50: typeof b.SIN_p50 === "number" ? b.SIN_p50 : null }));
  const hidSin = hid?.subsistemas.find((s) => s.sm === "SIN");
  const diaAgua = painel("agua")?.data_referencia ?? hid?.dia_referencia_ear ?? null;
  const anoBase = diaAgua ? Number(diaAgua.slice(0, 4)) - 1 : null;
  const base = hidSin && anoBase !== null && hidSin.ear.anos_na_base === anoBase - 2001 + 1 ? `2001 a ${anoBase}` : null;
  const aguaSin = agua?.armazenamento.subsistemas.find((s) => s.sm === "SIN");
  const capacidadeAgua = aguaSin
    ? textoCapacidadeAgua({ periodoBase: aguaSin.periodo_base, minMwmes: aguaSin.ear_max_base_min_mwmes, maxMwmes: aguaSin.ear_max_base_max_mwmes, mudou: aguaSin.capacidade_mudou_na_base })
    : null;
  const earNoModulo = diaAgua ? textoEarNoModulo({ diaVisao: diaAgua, diaModulo: aguaSin?.dia ?? null, pctModulo: aguaSin?.ear_pct ?? null }) : null;

  /* PLD: percentil dos dois critérios */
  const cartaoSe = pld?.cartoes.find((c) => c.sm === "SE");
  const posicao = pldDet?.historico.posicao_referencia.find((p) => p.sm === "SE");
  const anosDoMes = posicao ? Array.from(new Set(pldDet?.historico.sazonal_mes.find((s) => s.sm === "SE" && s.mes === posicao.mesmo_mes.mes)?.anos ?? [])) : [];
  const sazonal: PosicaoPldSazonal | null = posicao
    ? { mes: posicao.mesmo_mes.mes, percentil: posicao.mesmo_mes.percentil, n_dias: posicao.mesmo_mes.n_dias, p50: posicao.mesmo_mes.p50, anos: anosDoMes }
    : null;
  const regimes = pldDet?.limites.disponivel ? pldDet.limites.regimes : [];
  const pisos = regimes.map((r) => r.pld_min).filter((x): x is number => typeof x === "number");
  const doisCriteriosPld =
    cartaoSe && cartaoSe.media_dia !== null
      ? textoDoisCriteriosPld({
          media: cartaoSe.media_dia,
          percentilTodos: cartaoSe.posicao.percentil,
          diasTodos: cartaoSe.posicao.n_dias,
          sazonal,
          pisos,
          anoInicial: regimes[0]?.inicio.slice(0, 4) ?? "2021",
          anoFinal: regimes[regimes.length - 1]?.fim.slice(0, 4) ?? "",
        })
      : null;

  /* carga: o corte desta página e o padrão do módulo */
  const sinCarga = carga?.subsistemas.find((s) => s.sm === "SIN");
  const ult7 = sinCarga?.ult7 ?? null;
  const carga7d = ult7
    ? { media: ult7.media, mediaAnterior: ult7.media_ano_anterior, variacaoPct: ult7.variacao_pct, inicio: ult7.inicio, fim: ult7.fim, inicioAnterior: ult7.inicio_anterior, fimAnterior: ult7.fim_anterior }
    : null;
  const sinDet = cargaDet?.p025.comparacoes.subsistemas.find((s) => s.sm === "SIN");
  const j7 = sinDet?.janelas["7d"];
  const cargaNoModulo = textoCargaNoModulo({
    mesmasDatasPct: j7?.mesmas_datas?.variacao_pct ?? null,
    mesmosDiasDaSemanaPct: j7?.equivalente?.variacao_pct ?? null,
    mesmosDiasDaSemanaInicio: j7?.equivalente?.inicio_ant ?? null,
    mesmosDiasDaSemanaFim: j7?.equivalente?.fim_ant ?? null,
  });

  /* geração térmica */
  const tc = geracao?.termica_contexto;
  const frase = g.frases.find((f) => f.id === "termica");
  const janelaTermica = frase?.qualidade.janelas[0];
  const termica = tc ? { participacao: tc.participacao_7d, mediana: tc.mediana_365d, p10: tc.p10_365d, p90: tc.p90_365d, inicio: janelaTermica?.inicio ?? null, fim: janelaTermica?.fim ?? null } : null;

  /* rede: horas contra o saldo no dia de referência da Visão geral */
  const diaRede = painel("rede")?.data_referencia ?? null;
  const dias = redeDet?.circulacao.diario.dias ?? [];
  const i = diaRede ? dias.indexOf(diaRede) : -1;
  const saldoRede =
    diaRede && redeDet && i >= 0
      ? textoSaldoLiquidoRede({
          dia: diaRede,
          fronteiras: FRONTEIRAS.map((f) => {
            const c = redeDet.circulacao.diario.por_par[f.par];
            return { rotulo: f.rotulo, horasContra: horasContraOSaldo(c, i), horas: c.horas[i] ?? 24 };
          }),
          diaModulo: redeDet.referencia.dia,
        })
      : null;

  return {
    sociedade: { dec, perdas, tarifa },
    dec,
    perdas,
    tarifa,
    earSin,
    bandasAgua,
    medianaAgua: { valor: hidSin?.ear.mediana_historica ?? null, base },
    sazonalPld: sazonal ? textoSazonalPld(sazonal) : null,
    pldReferencia: cartaoSe ? { percentilTodos: cartaoSe.posicao.percentil, diasTodos: cartaoSe.posicao.n_dias, percentilMes: sazonal?.percentil ?? null, mes: sazonal?.mes ?? null } : null,
    cargaModulo: sinDet ? { mesmasDatasPct: j7?.mesmas_datas?.variacao_pct ?? null, mesmosDiasDaSemanaPct: j7?.equivalente?.variacao_pct ?? null } : null,
    doisCriteriosPld,
    capacidadeAgua,
    earNoModulo,
    aguaModulo: diaAgua && aguaSin && aguaSin.dia && aguaSin.dia !== diaAgua && typeof aguaSin.ear_pct === "number" ? { dia: aguaSin.dia, pct: aguaSin.ear_pct } : null,
    cargaNoModulo,
    saldoRede,
    carga7d,
    termica,
    diasDosModulos: { agua: aguaSin?.dia ?? null, rede: redeDet?.referencia.dia ?? null },
  };
}

/** Data de uma medida para a linha de contexto: um dia ou o intervalo, na forma da página. */
export function periodoDaMedida(inicio: string | null, fim: string | null): string | undefined {
  if (!fim) return undefined;
  return !inicio || inicio === fim ? dataBR(fim) : `${dataBR(inicio)} a ${dataBR(fim)}`;
}
