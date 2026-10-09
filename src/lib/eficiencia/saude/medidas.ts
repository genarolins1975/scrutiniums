/**
 * Medidas selecionáveis do módulo Saúde: o que cada seletor oferece, em que indicador e componente se apoia, com que unidade e formato.
 * Uma medida é uma visão de um indicador do catálogo (sau.*); o cálculo fica no pipeline e esta tabela só descreve a exibição.
 */
import { decimal, inteiro, percentual, reaisCurto, reaisExtenso, reaisInteiro } from "../formato";

export type MedidaSaudeId =
  | "despesa"
  | "despesa_hab"
  | "asps_pct"
  | "ubs_10mil"
  | "esf_10mil"
  | "eap_10mil"
  | "cobertura_aps"
  | "icsap_taxa"
  | "icsap_n"
  | "icsap_part";

export type TemaSaude = "gastos" | "rede" | "resultados";
export type Moeda = "nominal" | "real";
export type PeriodoTipo = "exercicio" | "dezembro" | "processamento";

export type MedidaSaude = {
  id: MedidaSaudeId;
  tema: TemaSaude;
  rotulo: string;
  rotuloCurto: string;
  indicador: string;
  /** componente do indicador; função da moeda quando a medida admite reais constantes */
  componente: (moeda: Moeda, denominador: "ripsa" | "obee") => string | null;
  moeda: boolean;
  denominador: boolean;
  unidade: (moeda: Moeda) => string;
  periodo: PeriodoTipo;
  zero: boolean;
  universo: string;
  /** o que o número é, em uma frase, para a primeira leitura */
  definicao: string;
  naoE: string;
  pergunta: string;
  formata: (v: number, curto?: boolean) => string;
  formataEixo: (v: number) => string;
  /** a razão agregada tem sentido (numerador e denominador publicados) */
  razaoAgregada: boolean;
  /** escala: total que depende do porte; razao: valor por população (a diferença relativa tem sentido); percentual: parcela em % (a diferença é em pontos percentuais) */
  tipo: "escala" | "razao" | "percentual";
  /** diferença absoluta entre dois valores, com a unidade: nunca um percentual de outro percentual */
  difAbsoluta: (v: number) => string;
};

const un = (txt: string) => () => txt;

export const MEDIDAS_SAUDE: Record<MedidaSaudeId, MedidaSaude> = {
  despesa: {
    tipo: "escala", difAbsoluta: (v) => reaisExtenso(v),
    id: "despesa", tema: "gastos", rotulo: "Despesa liquidada na função Saúde (total)", rotuloCurto: "Total", indicador: "sau.despesa.funcao_saude",
    componente: (m) => (m === "real" ? "real_2025" : "nominal"), moeda: true, denominador: false,
    unidade: (m) => (m === "real" ? "R$ de 2025 por ano" : "R$ correntes por ano"), periodo: "exercicio", zero: true,
    universo: "orçamento do município, função Saúde, exceto intraorçamentárias",
    definicao: "Despesa que o município liquidou na função Saúde no exercício, segundo a DCA. Escala orçamentária: depende do tamanho da cidade.",
    naoE: "Não é o gasto total com saúde no território: despesas da União e do estado e serviços privados e filantrópicos pagos por outras fontes não entram.",
    pergunta: "Quanto o município liquidou na função Saúde?", formata: (v, c) => (c ? reaisCurto(v) : reaisExtenso(v)), formataEixo: reaisCurto, razaoAgregada: false,
  },
  despesa_hab: {
    tipo: "razao", difAbsoluta: (v) => `${reaisInteiro(v)} por habitante`,
    id: "despesa_hab", tema: "gastos", rotulo: "Despesa liquidada em Saúde por habitante", rotuloCurto: "Por habitante", indicador: "sau.despesa.por_habitante",
    componente: (m) => (m === "real" ? "real_2025" : "nominal"), moeda: true, denominador: false,
    unidade: (m) => (m === "real" ? "R$ de 2025 por habitante por ano" : "R$ correntes por habitante por ano"), periodo: "exercicio", zero: true,
    universo: "orçamento do município ÷ população residente",
    definicao: "Despesa liquidada na função Saúde dividida pela população residente do mesmo ano.",
    naoE: "Não é custo por usuário do SUS nem por atendimento: o denominador é a população do território, inclusive quem usa saúde suplementar.",
    pergunta: "Quanto o município liquidou em Saúde por habitante?", formata: (v) => reaisInteiro(v), formataEixo: (v) => reaisInteiro(v), razaoAgregada: true,
  },
  asps_pct: {
    tipo: "percentual", difAbsoluta: (v) => `${decimal(v, 1)} pontos percentuais`,
    id: "asps_pct", tema: "gastos", rotulo: "Percentual da receita de impostos e transferências aplicado em ASPS", rotuloCurto: "Aplicado em ASPS (%)", indicador: "sau.asps.percentual_aplicado",
    componente: () => null, moeda: false, denominador: false, unidade: un("% da receita de impostos e transferências"), periodo: "exercicio", zero: true,
    universo: "declaração do município no SIOPS (Anexo 12 do RREO)",
    definicao: "Percentual da receita de impostos e transferências constitucionais e legais que o município informa ter aplicado em ações e serviços públicos de saúde, pela despesa empenhada (regra do último bimestre do demonstrativo). O mínimo de 15% é referência normativa, não meta.",
    naoE: "Não é o gasto total com saúde nem mede qualidade; é informado pelo município e homologado no SIOPS, e o OBEE não refaz o que conta como ASPS. O estágio empenhado difere do liquidado da despesa total: em alguns exercícios o valor aplicado supera a despesa liquidada na função Saúde.",
    pergunta: "Que percentual da receita o município informa ter aplicado em ASPS?", formata: (v) => percentual(v, 1), formataEixo: (v) => `${decimal(v, 0)}%`, razaoAgregada: true,
  },
  ubs_10mil: {
    tipo: "razao", difAbsoluta: (v) => `${decimal(v, 2)} UBS por 10 mil habitantes`,
    id: "ubs_10mil", tema: "rede", rotulo: "UBS públicas ativas por 10 mil habitantes", rotuloCurto: "UBS por 10 mil", indicador: "sau.rede.ubs_publicas_por_10mil",
    componente: () => "publicas", moeda: false, denominador: false, unidade: un("estabelecimentos por 10 mil habitantes"), periodo: "dezembro", zero: true,
    universo: "estabelecimentos tipos 01 e 02, ativos, natureza pública, no território ÷ população",
    definicao: "Postos de saúde e unidades básicas de natureza jurídica pública, ativos no CNES em dezembro, por 10 mil habitantes. É cadastro.",
    naoE: "Não prova funcionamento, acesso nem capacidade, e não é rede municipal: a gestão pode ser estadual ou dupla, e a gestão não equivale a propriedade. Fica de fora a UBS de gestão municipal operada por entidade de natureza não pública; a contagem dessas UBS está no retrato do CNES da página Rede e atenção primária.",
    pergunta: "Quantas UBS públicas ativas há por 10 mil habitantes?", formata: (v) => decimal(v, 2), formataEixo: (v) => decimal(v, 1), razaoAgregada: true,
  },
  esf_10mil: {
    tipo: "razao", difAbsoluta: (v) => `${decimal(v, 2)} equipes por 10 mil habitantes`,
    id: "esf_10mil", tema: "rede", rotulo: "Equipes de Saúde da Família (eSF) por 10 mil habitantes", rotuloCurto: "eSF por 10 mil", indicador: "sau.aps.equipes_por_10mil",
    componente: () => "esf", moeda: false, denominador: false, unidade: un("equipes por 10 mil habitantes"), periodo: "dezembro", zero: true,
    universo: "equipes financiadas, públicas e validadas ÷ população residente do exercício",
    definicao: "Equipes de Saúde da Família registradas pelo Ministério da Saúde em dezembro, por 10 mil habitantes. Não é cobertura efetiva nem pessoas atendidas.",
    naoE: "Não soma tipos de equipe diferentes e usa a população do exercício do OBEE, não a população de referência do Ministério.",
    pergunta: "Quantas equipes de Saúde da Família há por 10 mil habitantes?", formata: (v) => decimal(v, 2), formataEixo: (v) => decimal(v, 1), razaoAgregada: true,
  },
  eap_10mil: {
    tipo: "razao", difAbsoluta: (v) => `${decimal(v, 2)} equipes por 10 mil habitantes`,
    id: "eap_10mil", tema: "rede", rotulo: "Equipes de Atenção Primária (eAP, 20 h e 30 h) por 10 mil habitantes", rotuloCurto: "eAP por 10 mil", indicador: "sau.aps.equipes_por_10mil",
    componente: () => "eap", moeda: false, denominador: false, unidade: un("equipes por 10 mil habitantes"), periodo: "dezembro", zero: true,
    universo: "equipes financiadas, públicas e validadas ÷ população residente do exercício",
    definicao: "Equipes de Atenção Primária de 20 e de 30 horas registradas em dezembro, somadas, por 10 mil habitantes. Em muitas capitais o valor é zero porque a capital não registra esse tipo de equipe.",
    naoE: "Não é cobertura nem soma de tipos diferentes de equipe: eSF e eAP são separadas.",
    pergunta: "Quantas equipes de Atenção Primária há por 10 mil habitantes?", formata: (v) => decimal(v, 2), formataEixo: (v) => decimal(v, 1), razaoAgregada: true,
  },
  cobertura_aps: {
    tipo: "percentual", difAbsoluta: (v) => `${decimal(v, 1)} pontos percentuais`,
    id: "cobertura_aps", tema: "rede", rotulo: "Cobertura potencial estimada da atenção primária", rotuloCurto: "Cobertura potencial da APS", indicador: "sau.aps.cobertura_potencial",
    componente: () => null, moeda: false, denominador: false, unidade: un("% da população de referência do Ministério"), periodo: "dezembro", zero: true,
    universo: "capacidade das equipes ÷ população de referência do Ministério da Saúde",
    definicao: "Capacidade teórica das equipes de atenção primária registradas, em percentual da população de referência do Ministério. Sem teto de 100%.",
    naoE: "Não é cadastro, atendimento nem pessoas atendidas, e não se compara com a cobertura de outro método (AB até 2020, Previne Brasil até 2024).",
    pergunta: "Que parcela da população as equipes registradas poderiam cobrir?", formata: (v) => percentual(v, 1), formataEixo: (v) => `${decimal(v, 0)}%`, razaoAgregada: true,
  },
  icsap_taxa: {
    tipo: "razao", difAbsoluta: (v) => `${inteiro(Math.round(v))} internações por 100 mil habitantes`,
    id: "icsap_taxa", tema: "resultados", rotulo: "Internações ICSAP por 100 mil habitantes", rotuloCurto: "Taxa de ICSAP", indicador: "sau.icsap.taxa",
    componente: (_, d) => (d === "obee" ? "populacao_ibge_obee" : "ripsa"), moeda: false, denominador: true, unidade: un("internações por 100 mil habitantes"), periodo: "processamento", zero: true,
    universo: "internações SUS de residentes ÷ população estimada",
    definicao: "Internações pagas pelo SUS, de residentes da capital, por condições sensíveis à atenção primária, por 100 mil habitantes. É taxa bruta, sem ajuste por idade.",
    naoE: "Não inclui internações pagas por planos privados e não mede o desempenho da atenção primária nem da prefeitura: depende de oferta de leitos e critérios de internação.",
    pergunta: "Quantas internações por condições sensíveis à atenção primária ocorrem por 100 mil habitantes?", formata: (v) => inteiro(Math.round(v)), formataEixo: (v) => inteiro(Math.round(v)), razaoAgregada: true,
  },
  icsap_n: {
    tipo: "escala", difAbsoluta: (v) => `${inteiro(Math.round(v))} internações`,
    id: "icsap_n", tema: "resultados", rotulo: "Internações ICSAP (número)", rotuloCurto: "Internações ICSAP", indicador: "sau.icsap.internacoes",
    componente: () => null, moeda: false, denominador: false, unidade: un("internações por ano"), periodo: "processamento", zero: true,
    universo: "internações SUS de residentes da capital, AIH tipo 1, sem hospital dia",
    definicao: "Número de internações pagas pelo SUS, de residentes da capital, com diagnóstico principal na Lista Brasileira de ICSAP. A AIH é a unidade, não a pessoa.",
    naoE: "Depende do porte da capital e não é número de pessoas.", pergunta: "Quantas internações ICSAP de residentes foram pagas pelo SUS?",
    formata: (v) => inteiro(Math.round(v)), formataEixo: (v) => inteiro(Math.round(v)), razaoAgregada: false,
  },
  icsap_part: {
    tipo: "percentual", difAbsoluta: (v) => `${decimal(v, 1)} pontos percentuais`,
    id: "icsap_part", tema: "resultados", rotulo: "ICSAP nas internações SUS de residentes (%)", rotuloCurto: "ICSAP nas internações", indicador: "sau.icsap.participacao",
    componente: () => null, moeda: false, denominador: false, unidade: un("% das internações SUS por residência"), periodo: "processamento", zero: true,
    universo: "internações ICSAP ÷ internações SUS de residentes",
    definicao: "Parcela das internações SUS de residentes classificadas como ICSAP. Descreve a composição das internações, não o desempenho.",
    naoE: "Depende do que o restante das internações contém (obstetrícia, cirurgias, oferta hospitalar).", pergunta: "Que parcela das internações SUS é ICSAP?",
    formata: (v) => percentual(v, 1), formataEixo: (v) => `${decimal(v, 0)}%`, razaoAgregada: true,
  },
};

export const MEDIDAS_ORDEM: MedidaSaudeId[] = ["despesa", "despesa_hab", "asps_pct", "ubs_10mil", "esf_10mil", "eap_10mil", "cobertura_aps", "icsap_taxa", "icsap_n", "icsap_part"];

export const TEMAS_SAUDE: Record<TemaSaude, { titulo: string; medidas: MedidaSaudeId[]; medidaInicial: MedidaSaudeId }> = {
  gastos: { titulo: "Gastos", medidas: ["despesa", "despesa_hab", "asps_pct"], medidaInicial: "despesa_hab" },
  rede: { titulo: "Rede e atenção primária", medidas: ["ubs_10mil", "esf_10mil", "eap_10mil", "cobertura_aps"], medidaInicial: "esf_10mil" },
  resultados: { titulo: "Atendimento e resultados", medidas: ["icsap_taxa", "icsap_n", "icsap_part"], medidaInicial: "icsap_taxa" },
};

export const ROTULO_PERIODO: Record<PeriodoTipo, (ano: number) => string> = {
  exercicio: (a) => `Exercício ${a}`,
  dezembro: (a) => `Dezembro de ${a}`,
  processamento: (a) => `Ano de processamento ${a}`,
};

/** Rótulo curto do ano, para seletores e frases: "2024". */
export const periodoCurto = (m: MedidaSaude, ano: number) => (m.periodo === "dezembro" ? `dez. ${ano}` : String(ano));
