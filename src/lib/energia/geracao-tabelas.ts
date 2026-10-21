import type { TabelaInterativaProps } from "@/components/energia/TabelaInterativa";
import type { Idioma } from "@/lib/idioma";
import { formatos } from "@/lib/energia/formato";
import { idiomaEnergia, tx } from "@/lib/energia/idioma";
import { trechoPt, txEm } from "@/lib/energia/i18n/geracao";
import {
  colunasA11,
  colunasAnuais,
  colunasControles,
  colunasCvuCombustivel,
  colunasCvuUsinas,
  colunasDivergencias,
  colunasDozeMeses,
  colunasFontes,
  colunasLacuna,
  colunasMmgdApi,
  colunasNaturezaMensal,
  colunasOutrosCeg,
  colunasQuebras,
  colunasReconciliacaoFonte,
  colunasReconciliacaoMensal,
  colunasRecentes,
  colunasRotulos,
  colunasUniversoTermica,
  combustiveisCvu,
  curtoCombustivel,
  emPortugues,
  linhasA11,
  linhasAnuais,
  linhasControles,
  linhasCvuCombustivel,
  linhasCvuMensal,
  linhasCvuUsinas,
  linhasDivergencias,
  linhasDozeMeses,
  linhasFontes,
  linhasLacuna,
  linhasMmgdApi,
  linhasNaturezaMensal,
  linhasOutrosPorCeg,
  linhasQuebras,
  linhasReconciliacaoFonte,
  linhasReconciliacaoMensal,
  linhasRecentes,
  linhasRotulos,
  linhasUniversoTermica,
  notaAnual,
  paraTabela,
} from "@/lib/energia/geracao";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

/**
 * Definição das tabelas de Geração (P021) e da Térmica (P022) que o GeracaoTabelaSobDemanda monta no navegador a partir da
 * gold geracao_detalhe.json: título, colunas, linhas, fonte, nome do arquivo, ordem inicial e nota de cada uma, com as mesmas
 * funções puras que o servidor usava quando as tabelas viajavam no HTML. Nada aqui recalcula indicador; só escolhe linhas da gold.
 * `monta` recebe o idioma da página (o componente de cliente passa o de useIdioma()); sem ele, o da página em render.
 */
export const URL_GOLD_GERACAO_DETALHE = "/energia/gold/geracao_detalhe.json";

function fontes(idioma: Idioma) {
  const tx = txEm(idioma);
  return {
    usina: tx("ONS, Geração por Usina em Base Horária", "ONS, hourly generation by plant dataset"),
    balanco: tx("ONS, Balanço de Energia e Geração por Usina", "ONS, energy balance and generation by plant datasets"),
    cvu: tx("ONS, CVU das Usinas Térmicas", "ONS, thermal plant CVU dataset"),
  };
}

export type Montada = Omit<TabelaInterativaProps, "versao" | "chaveLinha" | "chaveUrl">;
export type DefinicaoTabelaGeracao = { chaveUrl: string; chaveLinha?: string; monta: (g: GoldGeracaoDetalhe, idioma?: Idioma) => Montada | null; versao?: (g: GoldGeracaoDetalhe) => string };

export const REGISTRO_TABELAS_GERACAO = {
  doze: {
    chaveUrl: "dz",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const m = g.matriz;
      if (!m.comparacao_12m) return null;
      return {
        titulo: tx("Tabela equivalente: 365 dias contra os 365 anteriores, com a variação publicada", "Equivalent table: 365 days against the previous 365, with the published variation"),
        colunas: colunasDozeMeses(m.comparacao_12m, m.universo, idioma),
        linhas: paraTabela(linhasDozeMeses(m.comparacao_12m, m.janelas.SIN["12m"], m.universo, idioma), idioma),
        colunaRotulo: "rotulo",
        fonte: fontes(idioma).usina,
        nomeArquivo: "geracao-365-dias",
        nota: tx(
          "Categorias com variação suprimida ficam fora do gráfico de pontos: o número de usinas com dado na fonte mudou dentro das janelas, e a diferença não mede mudança na geração. A última coluna mostra, para as demais, a geração das usinas que ficaram sem dado no último mês, como ordem de grandeza da lacuna.",
          "Categories with a suppressed variation are left out of the dot chart: the number of plants with data in the source changed within the windows, and the difference does not measure a change in generation. For the others, the last column shows the generation of the plants that had no data in the latest month, as an order of magnitude of the gap.",
        ),
      };
    },
  },
  diaria: {
    chaveUrl: "dd",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const s = g.matriz.diario_sin_recente;
      return {
        titulo: tx("Tabela equivalente: geração diária por categoria, últimos 60 dias", "Equivalent table: daily generation by category, last 60 days"),
        colunas: colunasRecentes(s.categorias, tx("Dia", "Day"), "data", idioma),
        linhas: paraTabela(linhasRecentes(s.dias, s), idioma),
        colunaRotulo: "x",
        fonte: fontes(idioma).usina,
        nomeArquivo: "geracao-diaria-60-dias",
        ordemInicial: { coluna: "x", direcao: "desc" },
      };
    },
  },
  horaria: {
    chaveUrl: "hh",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const s = g.matriz.horario_sin_recente;
      return {
        titulo: tx("Tabela equivalente: geração horária por categoria, últimas 72 horas", "Equivalent table: hourly generation by category, last 72 hours"),
        colunas: colunasRecentes(s.categorias, tx("Hora (início do intervalo)", "Hour (start of the interval)"), "texto", idioma),
        linhas: paraTabela(linhasRecentes(s.horas, s), idioma),
        colunaRotulo: "x",
        fonte: fontes(idioma).usina,
        nomeArquivo: "geracao-horaria-72-horas",
        ordemInicial: { coluna: "x", direcao: "desc" },
        nota: tx(
          "Horário de Brasília; cada hora é o início do intervalo. À noite a solar centralizada publica valores próximos de zero, nem sempre nulos, e a MMGD estimada publica zero: são valores publicados, não ausência. Os últimos 365 dias horários estão no arquivo para download.",
          "Brasília time; each hour is the start of the interval. At night, centralized solar publishes values close to zero, not always null, and the estimated MMGD publishes zero: these are published values, not missing data. The last 365 days of hourly data are in the download file.",
        ),
      };
    },
  },
  natureza: {
    chaveUrl: "nt",
    monta: (g, idioma = idiomaEnergia()) => ({
      titulo: tx("Tabela equivalente: parcela da geração por natureza, mês a mês", "Equivalent table: share of generation by data nature, month by month", idioma),
      colunas: colunasNaturezaMensal(idioma),
      linhas: paraTabela(linhasNaturezaMensal(g.matriz.natureza_mensal_sin, idioma), idioma),
      colunaRotulo: "mes",
      fonte: fontes(idioma).usina,
      nomeArquivo: "geracao-natureza-mensal",
    }),
  },
  anual: {
    chaveUrl: "an",
    monta: (g, idioma = idiomaEnergia()) => ({
      titulo: tx("Participação anual do SIN por categoria (sem MMGD) e a MMGD estimada à parte", "Annual SIN share by category (without MMGD), with the estimated MMGD shown separately", idioma),
      colunas: colunasAnuais(g.matriz.anual_sin, idioma),
      linhas: paraTabela(linhasAnuais(g.matriz.anual_sin, idioma), idioma),
      colunaRotulo: "ano", // i18n: dado
      fonte: fontes(idioma).usina,
      nomeArquivo: "geracao-anual",
      nota: notaAnual(g.matriz.anual_sin, g.a11.primeiro_dia_mmgd, idioma),
    }),
  },
  a11: {
    chaveUrl: "a11",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const f = formatos(idioma);
      return {
        titulo: tx("Solar do Balanço e soma das usinas fotovoltaicas, dia a dia, na janela da quebra", "Solar in the Energy Balance and the sum of photovoltaic plants, day by day, in the break window"),
        colunas: colunasA11(idioma),
        linhas: paraTabela(linhasA11(g.a11), idioma),
        colunaRotulo: "d",
        fonte: tx("ONS, Balanço de Energia nos Subsistemas e Geração por Usina em Base Horária", "ONS, subsystem energy balance and hourly generation by plant datasets"),
        nomeArquivo: "geracao-a11-janela",
        nota: tx(
          "Antes de 29/04/2023 a coluna da MMGD fica vazia: a modalidade não existia na fonte (ausência, não zero).",
          `Before ${f.dataBR("2023-04-29")} the MMGD column is empty: the modality did not exist in the source (missing, not zero).`,
        ),
      };
    },
  },
  "mmgd-api": {
    chaveUrl: "api",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const f = formatos(idioma);
      const a11 = g.a11;
      const r = a11.razao_usina_api;
      return {
        titulo: tx("Tabela equivalente: MMGD nas duas publicações do ONS, por mês", "Equivalent table: MMGD in the two ONS publications, by month"),
        colunas: colunasMmgdApi(idioma),
        linhas: paraTabela(linhasMmgdApi(a11, idioma), idioma),
        colunaRotulo: "mes",
        fonte: tx("ONS, Geração por Usina e API de carga verificada (como publicado pelo módulo Transição)", "ONS, generation by plant dataset and verified load API (as published by the Transition module)"),
        nomeArquivo: "geracao-mmgd-duas-publicacoes",
        nota: r
          ? tx(
              `As duas são estimativas de processos diferentes do ONS: a razão mensal vai de ${f.num(r.min, 2)} a ${f.num(r.max, 2)} (mediana ${f.num(r.p50, 2)}) em ${f.num(r.n, 0)} meses. Nenhuma mede a energia das unidades cadastradas na ANEEL.`,
              `Both are estimates from different ONS processes: the monthly ratio ranges from ${f.num(r.min, 2)} to ${f.num(r.max, 2)} (median ${f.num(r.p50, 2)}) over ${f.num(r.n, 0)} months. Neither measures the energy of the units registered with ANEEL.`,
            )
          : tx("Sem meses em comum entre as duas publicações.", "No months in common between the two publications."),
      };
    },
  },
  "rec-fonte": {
    chaveUrl: "rf",
    monta: (g, idioma = idiomaEnergia()) => ({
      titulo: tx("Dias conciliados por fonte, em todo o histórico", "Reconciled days by source, across the whole history", idioma),
      colunas: colunasReconciliacaoFonte(idioma),
      linhas: paraTabela(linhasReconciliacaoFonte(g.matriz.reconciliacao_balanco, idioma), idioma),
      colunaRotulo: "fonte", // i18n: dado
      fonte: fontes(idioma).balanco,
      nomeArquivo: "geracao-reconciliacao-fontes",
    }),
  },
  "rec-mensal": {
    chaveUrl: "rm",
    monta: (g, idioma = idiomaEnergia()) => ({
      titulo: tx("Os últimos 6 meses, por fonte", "The last 6 months, by source", idioma),
      colunas: colunasReconciliacaoMensal(idioma),
      linhas: paraTabela(linhasReconciliacaoMensal(g.matriz.reconciliacao_balanco, idioma), idioma),
      colunaRotulo: "mes",
      fonte: fontes(idioma).balanco,
      nomeArquivo: "geracao-reconciliacao-mensal",
    }),
  },
  divergencias: {
    chaveUrl: "dv",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      return {
        titulo: tx("As maiores divergências por subsistema e dia", "The largest divergences by subsystem and day"),
        colunas: colunasDivergencias(idioma),
        linhas: paraTabela(linhasDivergencias(g.matriz.reconciliacao_balanco, idioma), idioma),
        colunaRotulo: "d",
        fonte: fontes(idioma).balanco,
        nomeArquivo: "geracao-maiores-divergencias",
        nota: tx(
          "Divergência entre duas publicações do ONS, sem causa atribuída; parte delas é diferença de alocação entre subsistemas que some no SIN.",
          "Divergence between two ONS publications, with no cause attributed; part of it is a difference in allocation between subsystems that disappears at the SIN level.",
        ),
      };
    },
  },
  lacuna: {
    chaveUrl: "lc",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const f = formatos(idioma);
      const u = g.matriz.universo;
      const lac = u.lacuna_ultimo_mes;
      if (!lac) return null;
      return {
        titulo: tx(`Usinas sem dado em ${f.mesAno(lac.mes)}, por categoria`, `Plants without data in ${f.mesAno(lac.mes)}, by category`),
        colunas: colunasLacuna(u, idioma),
        linhas: paraTabela(linhasLacuna(u, idioma), idioma),
        colunaRotulo: "categoria",
        fonte: fontes(idioma).usina,
        nomeArquivo: "geracao-universo-lacuna",
        nota: trechoPt(emPortugues(lac.nota), "geracao-lacuna-nota", idioma),
      };
    },
  },
  quebras: {
    chaveUrl: "qb",
    monta: (g, idioma = idiomaEnergia()) => ({
      titulo: tx("Mudanças de universo e de rótulo na fonte", "Changes of universe and label in the source", idioma),
      colunas: colunasQuebras(idioma),
      linhas: paraTabela(linhasQuebras(g.quebras, idioma), idioma),
      colunaRotulo: "data",
      fonte: fontes(idioma).usina,
      nomeArquivo: "geracao-quebras",
      ordemInicial: { coluna: "data", direcao: "desc" },
    }),
  },
  rotulos: {
    chaveUrl: "rt",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const m = g.matriz;
      const n = m.nao_mapeadas.length;
      const mapeados = n === 0 ? tx("Nenhum rótulo sem categoria nesta publicação.", "No label without a category in this release.") : tx(`${n} rótulos sem categoria, visíveis como não mapeados.`, `${n} ${n === 1 ? "label" : "labels"} without a category, shown as unmapped.`);
      return {
        titulo: tx("Rótulos da fonte (tipo, combustível e modalidade) e a categoria de cada um", "Source labels (type, fuel and modality) and the category of each"),
        colunas: colunasRotulos(idioma),
        linhas: paraTabela(linhasRotulos(m.rotulos, idioma), idioma),
        colunaRotulo: "combustivel",
        fonte: fontes(idioma).usina,
        nomeArquivo: "geracao-rotulos-fonte",
        ordemInicial: { coluna: "gwh_12m", direcao: "desc" },
        nota: tx(`${mapeados} Energia em 12 meses vazia: rótulo sem linha no período.`, `${mapeados} Empty energy in 12 months: label with no row in the period.`),
      };
    },
  },
  "outros-ceg": {
    chaveUrl: "oc",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const f = formatos(idioma);
      const o = g.matriz.outros_por_ceg;
      if (!o) return null;
      return {
        titulo: tx(`Outras térmicas decompostas pelo código de combustível do CEG, ${f.mesAno(o.inicio)} a ${f.mesAno(o.fim)}`, `Other thermal broken down by the CEG fuel code, ${f.mesAno(o.inicio)} to ${f.mesAno(o.fim)}`),
        colunas: colunasOutrosCeg(idioma),
        linhas: paraTabela(linhasOutrosPorCeg(o, idioma), idioma),
        colunaRotulo: "codigo",
        fonte: fontes(idioma).usina,
        nomeArquivo: "geracao-outros-por-ceg",
        nota: trechoPt(emPortugues(o.regra), "geracao-outros-ceg-regra", idioma),
      };
    },
  },
  controles: {
    chaveUrl: "ct",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      return {
        titulo: tx("Controles executados antes da publicação", "Checks run before publication"),
        colunas: colunasControles(idioma),
        linhas: paraTabela(linhasControles(g.controles, idioma), idioma),
        colunaRotulo: "nome",
        fonte: tx("Controles do observatório sobre os conjuntos do ONS", "Observatory checks on the ONS datasets"),
        nomeArquivo: "geracao-controles",
      };
    },
  },
  fontes: {
    chaveUrl: "ft",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      return {
        titulo: tx("Conjuntos integrados neste módulo", "Datasets integrated into this module"),
        colunas: colunasFontes(idioma),
        linhas: paraTabela(linhasFontes(g.fontes), idioma),
        colunaRotulo: "conjunto",
        fonte: tx("Portal de dados abertos do ONS e da ANEEL", "ONS and ANEEL open data portals"),
        nomeArquivo: "geracao-fontes",
      };
    },
  },
  "cvu-combustivel": {
    chaveUrl: "cvc",
    versao: (g) => g.termica?.cvu?.semana.inicio ?? "",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const cvu = g.termica?.cvu;
      if (!cvu) return null;
      return {
        titulo: tx("CVU por combustível na semana vigente: mínimo, quartis e máximo das parcelas", "CVU by fuel in the current week: minimum, quartiles and maximum of the portions"),
        colunas: colunasCvuCombustivel(idioma),
        linhas: paraTabela(linhasCvuCombustivel(cvu, idioma), idioma),
        colunaRotulo: "combustivel",
        fonte: fontes(idioma).cvu,
        nomeArquivo: "geracao-cvu-combustivel",
        nota: tx(
          "Custo declarado considerado no Programa Mensal da Operação, não custo realizado nem preço. Uma usina com várias parcelas tem um CVU por parcela.",
          "Declared cost considered in the Monthly Operation Program (PMO), not realized cost or price. A plant with several portions has one CVU per portion.",
        ),
      };
    },
  },
  "cvu-mensal": {
    chaveUrl: "cvm",
    versao: (g) => g.termica?.cvu?.semana.inicio ?? "",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const cvu = g.termica?.cvu;
      if (!cvu) return null;
      const cats = combustiveisCvu(cvu);
      const cc = curtoCombustivel(idioma);
      return {
        titulo: tx("Tabela equivalente: mediana mensal do CVU por combustível", "Equivalent table: monthly median CVU by fuel"),
        colunas: [{ id: "m", rotulo: tx("Mês", "Month"), tipo: "texto" }, ...cats.map((c) => ({ id: c, rotulo: cc[c], tipo: "numero" as const, unidade: "R$/MWh", casas: 2 }))],
        linhas: paraTabela(linhasCvuMensal(cvu, cats), idioma),
        colunaRotulo: "m",
        fonte: fontes(idioma).cvu,
        nomeArquivo: "geracao-cvu-mediana-mensal",
        ordemInicial: { coluna: "m", direcao: "desc" },
        nota: tx(
          "Mediana das parcelas com CVU em cada mês (moeda corrente, sem correção). Mês sem parcela do combustível fica vazio.",
          "Median of the portions with a CVU in each month (current currency, not adjusted). A month with no portion of the fuel is left empty.",
        ),
      };
    },
  },
  "cvu-usinas": {
    chaveUrl: "cvu",
    versao: (g) => g.termica?.cvu?.semana.inicio ?? "",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const f = formatos(idioma);
      const cvu = g.termica?.cvu;
      if (!cvu) return null;
      const amb = cvu.cobertura.codigos_ambiguos.length;
      const rep = f.num(cvu.controles.linhas_repetidas_identicas, 0);
      return {
        titulo: tx(`CVU de cada usina na semana de ${f.dataBR(cvu.semana.inicio)} a ${f.dataBR(cvu.semana.fim)}`, `CVU of each plant in the week from ${f.dataBR(cvu.semana.inicio)} to ${f.dataBR(cvu.semana.fim)}`),
        colunas: colunasCvuUsinas(idioma),
        linhas: paraTabela(linhasCvuUsinas(cvu, idioma), idioma),
        colunaRotulo: "nome",
        fonte: fontes(idioma).cvu,
        nomeArquivo: "geracao-cvu-usinas-semana",
        ordemInicial: { coluna: "cvu", direcao: "desc" },
        dicaBusca: tx("Nome ou código do ONS", "Name or ONS code"),
        nota: tx(
          `Código do ONS ligado à usina da térmica por motivo pela união dos códigos de todas as suas parcelas; código ligado a mais de uma usina fica sem par (${amb} nesta semana). Linhas repetidas idênticas na fonte: ${rep}, contadas uma vez.`,
          `ONS code linked to the plant in thermal by dispatch reason through the union of the codes of all its portions; a code linked to more than one plant is left unmatched (${amb} this week). Identical repeated rows in the source: ${rep}, counted once.`,
        ),
      };
    },
  },
  "universo-termica": {
    chaveUrl: "ut",
    monta: (g, idioma = idiomaEnergia()) => {
      const tx = txEm(idioma);
      const t = g.termica;
      if (!t) return null;
      return {
        titulo: tx("Mês a mês, as mesmas usinas nos dois conjuntos do ONS", "Month by month, the same plants in the two ONS datasets"),
        colunas: colunasUniversoTermica(idioma),
        linhas: paraTabela(linhasUniversoTermica({ universo: t.universo }, idioma), idioma),
        colunaRotulo: "mes",
        fonte: tx("ONS, Geração Térmica por Motivo de Despacho e Geração por Usina", "ONS, thermal generation by dispatch reason and generation by plant datasets"),
        nomeArquivo: "geracao-termica-universo",
      };
    },
  },
} satisfies Record<string, DefinicaoTabelaGeracao>;


export type TabelaGeracao = keyof typeof REGISTRO_TABELAS_GERACAO;
