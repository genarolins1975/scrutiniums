import type { TabelaInterativaProps } from "@/components/energia/TabelaInterativa";
import { dataBR, mesAno, num } from "@/lib/energia/formato";
import {
  COLUNAS_A11,
  COLUNAS_CONTROLES,
  COLUNAS_CVU_COMBUSTIVEL,
  COLUNAS_CVU_USINAS,
  COLUNAS_DIVERGENCIAS,
  COLUNAS_FONTES,
  COLUNAS_MMGD_API,
  COLUNAS_NATUREZA_MENSAL,
  COLUNAS_OUTROS_CEG,
  COLUNAS_QUEBRAS,
  COLUNAS_RECONCILIACAO_FONTE,
  COLUNAS_RECONCILIACAO_MENSAL,
  COLUNAS_ROTULOS,
  COLUNAS_UNIVERSO_TERMICA,
  CURTO_COMBUSTIVEL,
  colunasAnuais,
  colunasDozeMeses,
  colunasLacuna,
  colunasRecentes,
  combustiveisCvu,
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
  paraTabela,
} from "@/lib/energia/geracao";
import type { GoldGeracaoDetalhe } from "@/lib/energia/tipos-geracao";

/**
 * Definição das tabelas de Geração (P021) e da Térmica (P022) que o GeracaoTabelaSobDemanda monta no navegador a partir da
 * gold geracao_detalhe.json: título, colunas, linhas, fonte, nome do arquivo, ordem inicial e nota de cada uma, com as mesmas
 * funções puras que o servidor usava quando as tabelas viajavam no HTML. Nada aqui recalcula indicador; só escolhe linhas da gold.
 */
export const URL_GOLD_GERACAO_DETALHE = "/energia/gold/geracao_detalhe.json";

const FONTE = "ONS, Geração por Usina em Base Horária";
const FONTE_BALANCO = "ONS, Balanço de Energia e Geração por Usina";
const FONTE_CVU = "ONS, CVU das Usinas Térmicas";

export type Montada = Omit<TabelaInterativaProps, "versao" | "chaveLinha" | "chaveUrl">;
export type DefinicaoTabelaGeracao = { chaveUrl: string; chaveLinha?: string; monta: (g: GoldGeracaoDetalhe) => Montada | null; versao?: (g: GoldGeracaoDetalhe) => string };

export const REGISTRO_TABELAS_GERACAO = {
  doze: {
    chaveUrl: "dz",
    monta: (g) => {
      const m = g.matriz;
      if (!m.comparacao_12m) return null;
      return {
        titulo: "Tabela equivalente: 365 dias contra os 365 anteriores, com a variação publicada",
        colunas: colunasDozeMeses(m.comparacao_12m),
        linhas: paraTabela(linhasDozeMeses(m.comparacao_12m, m.janelas.SIN["12m"])),
        colunaRotulo: "rotulo",
        fonte: FONTE,
        nomeArquivo: "geracao-365-dias",
        nota: "Categorias com variação suprimida ficam fora do gráfico de pontos: o número de usinas com dado na fonte mudou dentro das janelas, e a diferença não mede mudança na geração.",
      };
    },
  },
  diaria: {
    chaveUrl: "dd",
    monta: (g) => {
      const s = g.matriz.diario_sin_recente;
      return {
        titulo: "Tabela equivalente: geração diária por categoria, últimos 60 dias",
        colunas: colunasRecentes(s.categorias, "Dia", "data"),
        linhas: paraTabela(linhasRecentes(s.dias, s)),
        colunaRotulo: "x",
        fonte: FONTE,
        nomeArquivo: "geracao-diaria-60-dias",
        ordemInicial: { coluna: "x", direcao: "desc" },
      };
    },
  },
  horaria: {
    chaveUrl: "hh",
    monta: (g) => {
      const s = g.matriz.horario_sin_recente;
      return {
        titulo: "Tabela equivalente: geração horária por categoria, últimas 72 horas",
        colunas: colunasRecentes(s.categorias, "Hora (início do intervalo)", "texto"),
        linhas: paraTabela(linhasRecentes(s.horas, s)),
        colunaRotulo: "x",
        fonte: FONTE,
        nomeArquivo: "geracao-horaria-72-horas",
        ordemInicial: { coluna: "x", direcao: "desc" },
        nota: "Horário de Brasília; cada hora é o início do intervalo. A solar fica em zero à noite, um valor publicado, não ausência. Os últimos 366 dias horários estão no arquivo para download.",
      };
    },
  },
  natureza: {
    chaveUrl: "nt",
    monta: (g) => ({
      titulo: "Tabela equivalente: parcela da geração por natureza, mês a mês",
      colunas: COLUNAS_NATUREZA_MENSAL,
      linhas: paraTabela(linhasNaturezaMensal(g.matriz.natureza_mensal_sin)),
      colunaRotulo: "mes",
      fonte: FONTE,
      nomeArquivo: "geracao-natureza-mensal",
    }),
  },
  anual: {
    chaveUrl: "an",
    monta: (g) => ({
      titulo: "Participação anual do SIN por categoria (sem MMGD) e a MMGD estimada à parte",
      colunas: colunasAnuais(g.matriz.anual_sin),
      linhas: paraTabela(linhasAnuais(g.matriz.anual_sin)),
      colunaRotulo: "ano",
      fonte: FONTE,
      nomeArquivo: "geracao-anual",
      nota: "O ano em curso é parcial e não se compara com anos completos sem esse aviso. A MMGD não entra na participação anual: só existe a partir de 29/04/2023; ela aparece em MWmed, na coluna própria.",
    }),
  },
  a11: {
    chaveUrl: "a11",
    monta: (g) => ({
      titulo: "Solar do Balanço e soma das usinas fotovoltaicas, dia a dia, na janela da quebra",
      colunas: COLUNAS_A11,
      linhas: paraTabela(linhasA11(g.a11)),
      colunaRotulo: "d",
      fonte: "ONS, Balanço de Energia nos Subsistemas e Geração por Usina em Base Horária",
      nomeArquivo: "geracao-a11-janela",
      nota: "Antes de 29/04/2023 a coluna da MMGD fica vazia: a modalidade não existia na fonte (ausência, não zero).",
    }),
  },
  "mmgd-api": {
    chaveUrl: "api",
    monta: (g) => {
      const a11 = g.a11;
      return {
        titulo: "Tabela equivalente: MMGD nas duas publicações do ONS, por mês",
        colunas: COLUNAS_MMGD_API,
        linhas: paraTabela(linhasMmgdApi(a11)),
        colunaRotulo: "mes",
        fonte: "ONS, Geração por Usina e API de carga verificada (como publicado pelo módulo Transição)",
        nomeArquivo: "geracao-mmgd-duas-publicacoes",
        nota: a11.razao_usina_api
          ? `As duas são estimativas de processos diferentes do ONS: a razão mensal vai de ${num(a11.razao_usina_api.min, 2)} a ${num(a11.razao_usina_api.max, 2)} (mediana ${num(a11.razao_usina_api.p50, 2)}) em ${num(a11.razao_usina_api.n, 0)} meses. Nenhuma mede a energia das unidades cadastradas na ANEEL.`
          : "Sem meses em comum entre as duas publicações.",
      };
    },
  },
  "rec-fonte": {
    chaveUrl: "rf",
    monta: (g) => ({
      titulo: "Dias conciliados por fonte, em todo o histórico",
      colunas: COLUNAS_RECONCILIACAO_FONTE,
      linhas: paraTabela(linhasReconciliacaoFonte(g.matriz.reconciliacao_balanco)),
      colunaRotulo: "fonte",
      fonte: FONTE_BALANCO,
      nomeArquivo: "geracao-reconciliacao-fontes",
    }),
  },
  "rec-mensal": {
    chaveUrl: "rm",
    monta: (g) => ({
      titulo: "Os últimos 6 meses, por fonte",
      colunas: COLUNAS_RECONCILIACAO_MENSAL,
      linhas: paraTabela(linhasReconciliacaoMensal(g.matriz.reconciliacao_balanco)),
      colunaRotulo: "mes",
      fonte: FONTE_BALANCO,
      nomeArquivo: "geracao-reconciliacao-mensal",
    }),
  },
  divergencias: {
    chaveUrl: "dv",
    monta: (g) => ({
      titulo: "As maiores divergências por subsistema e dia",
      colunas: COLUNAS_DIVERGENCIAS,
      linhas: paraTabela(linhasDivergencias(g.matriz.reconciliacao_balanco)),
      colunaRotulo: "d",
      fonte: FONTE_BALANCO,
      nomeArquivo: "geracao-maiores-divergencias",
      nota: "Divergência entre duas publicações do ONS, sem causa atribuída; parte delas é diferença de alocação entre subsistemas que some no SIN.",
    }),
  },
  lacuna: {
    chaveUrl: "lc",
    monta: (g) => {
      const u = g.matriz.universo;
      const lac = u.lacuna_ultimo_mes;
      if (!lac) return null;
      return {
        titulo: `Usinas sem dado em ${mesAno(lac.mes)}, por categoria`,
        colunas: colunasLacuna(u),
        linhas: paraTabela(linhasLacuna(u)),
        colunaRotulo: "categoria",
        fonte: FONTE,
        nomeArquivo: "geracao-universo-lacuna",
        nota: lac.nota,
      };
    },
  },
  quebras: {
    chaveUrl: "qb",
    monta: (g) => ({
      titulo: "Mudanças de universo e de rótulo na fonte",
      colunas: COLUNAS_QUEBRAS,
      linhas: paraTabela(linhasQuebras(g.quebras)),
      colunaRotulo: "data",
      fonte: FONTE,
      nomeArquivo: "geracao-quebras",
      ordemInicial: { coluna: "data", direcao: "desc" },
    }),
  },
  rotulos: {
    chaveUrl: "rt",
    monta: (g) => {
      const m = g.matriz;
      return {
        titulo: "Rótulos da fonte (tipo, combustível e modalidade) e a categoria de cada um",
        colunas: COLUNAS_ROTULOS,
        linhas: paraTabela(linhasRotulos(m.rotulos)),
        colunaRotulo: "combustivel",
        fonte: FONTE,
        nomeArquivo: "geracao-rotulos-fonte",
        ordemInicial: { coluna: "gwh_12m", direcao: "desc" },
        nota: `${m.nao_mapeadas.length === 0 ? "Nenhum rótulo sem categoria nesta publicação." : `${m.nao_mapeadas.length} rótulos sem categoria, visíveis como não mapeados.`} Energia em 12 meses vazia: rótulo sem linha no período.`,
      };
    },
  },
  "outros-ceg": {
    chaveUrl: "oc",
    monta: (g) => {
      const o = g.matriz.outros_por_ceg;
      if (!o) return null;
      return {
        titulo: `Outras térmicas decompostas pelo código de combustível do CEG, ${mesAno(o.inicio)} a ${mesAno(o.fim)}`,
        colunas: COLUNAS_OUTROS_CEG,
        linhas: paraTabela(linhasOutrosPorCeg(o)),
        colunaRotulo: "codigo",
        fonte: FONTE,
        nomeArquivo: "geracao-outros-por-ceg",
        nota: o.regra,
      };
    },
  },
  controles: {
    chaveUrl: "ct",
    monta: (g) => ({
      titulo: "Controles executados antes da publicação",
      colunas: COLUNAS_CONTROLES,
      linhas: paraTabela(linhasControles(g.controles)),
      colunaRotulo: "nome",
      fonte: "Controles do observatório sobre os conjuntos do ONS",
      nomeArquivo: "geracao-controles",
    }),
  },
  fontes: {
    chaveUrl: "ft",
    monta: (g) => ({
      titulo: "Conjuntos integrados neste módulo",
      colunas: COLUNAS_FONTES,
      linhas: paraTabela(linhasFontes(g.fontes)),
      colunaRotulo: "conjunto",
      fonte: "Portal de dados abertos do ONS e da ANEEL",
      nomeArquivo: "geracao-fontes",
    }),
  },
  "cvu-combustivel": {
    chaveUrl: "cvc",
    versao: (g) => g.termica?.cvu?.semana.inicio ?? "",
    monta: (g) => {
      const cvu = g.termica?.cvu;
      if (!cvu) return null;
      return {
        titulo: "CVU por combustível na semana vigente: mínimo, quartis e máximo das parcelas",
        colunas: COLUNAS_CVU_COMBUSTIVEL,
        linhas: paraTabela(linhasCvuCombustivel(cvu)),
        colunaRotulo: "combustivel",
        fonte: FONTE_CVU,
        nomeArquivo: "geracao-cvu-combustivel",
        nota: "Custo declarado considerado no Programa Mensal da Operação, não custo realizado nem preço. Uma usina com várias parcelas tem um CVU por parcela.",
      };
    },
  },
  "cvu-mensal": {
    chaveUrl: "cvm",
    versao: (g) => g.termica?.cvu?.semana.inicio ?? "",
    monta: (g) => {
      const cvu = g.termica?.cvu;
      if (!cvu) return null;
      const cats = combustiveisCvu(cvu);
      return {
        titulo: "Tabela equivalente: mediana mensal do CVU por combustível",
        colunas: [{ id: "m", rotulo: "Mês", tipo: "texto" }, ...cats.map((c) => ({ id: c, rotulo: CURTO_COMBUSTIVEL[c], tipo: "numero" as const, unidade: "R$/MWh", casas: 2 }))],
        linhas: paraTabela(linhasCvuMensal(cvu, cats)),
        colunaRotulo: "m",
        fonte: FONTE_CVU,
        nomeArquivo: "geracao-cvu-mediana-mensal",
        ordemInicial: { coluna: "m", direcao: "desc" },
        nota: "Mediana das parcelas com CVU em cada mês (moeda corrente, sem correção). Mês sem parcela do combustível fica vazio.",
      };
    },
  },
  "cvu-usinas": {
    chaveUrl: "cvu",
    versao: (g) => g.termica?.cvu?.semana.inicio ?? "",
    monta: (g) => {
      const cvu = g.termica?.cvu;
      if (!cvu) return null;
      return {
        titulo: `CVU de cada usina na semana de ${dataBR(cvu.semana.inicio)} a ${dataBR(cvu.semana.fim)}`,
        colunas: COLUNAS_CVU_USINAS,
        linhas: paraTabela(linhasCvuUsinas(cvu)),
        colunaRotulo: "nome",
        fonte: FONTE_CVU,
        nomeArquivo: "geracao-cvu-usinas-semana",
        ordemInicial: { coluna: "cvu", direcao: "desc" },
        dicaBusca: "Nome ou código do ONS",
        nota: `Código do ONS ligado à usina da térmica por motivo pela união dos códigos de todas as suas parcelas; código ligado a mais de uma usina fica sem par (${cvu.cobertura.codigos_ambiguos.length} nesta semana). Linhas repetidas idênticas na fonte: ${num(cvu.controles.linhas_repetidas_identicas, 0)}, contadas uma vez.`,
      };
    },
  },
  "universo-termica": {
    chaveUrl: "ut",
    monta: (g) => {
      const t = g.termica;
      if (!t) return null;
      return {
        titulo: "Mês a mês, as mesmas usinas nos dois conjuntos do ONS",
        colunas: COLUNAS_UNIVERSO_TERMICA,
        linhas: paraTabela(linhasUniversoTermica({ universo: t.universo })),
        colunaRotulo: "mes",
        fonte: "ONS, Geração Térmica por Motivo de Despacho e Geração por Usina",
        nomeArquivo: "geracao-termica-universo",
      };
    },
  },
} satisfies Record<string, DefinicaoTabelaGeracao>;


export type TabelaGeracao = keyof typeof REGISTRO_TABELAS_GERACAO;
