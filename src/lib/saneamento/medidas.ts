import DESIGUALDADES from "./dados/desigualdades.json";
import type { Municipio } from "./tipos";
import { razaoPct } from "./municipios";
import { numero, sinal } from "./formato";

/**
 * Catálogo das medidas municipais do Observatório do Saneamento: a única
 * definição de título, fonte, período, universo, numerador, denominador e
 * ressalva de cada medida que vai a mapa, tabela, comparação ou exportação.
 *
 * Regra de unidade: percentual e pessoas são variantes da mesma medida, com o
 * mesmo universo. Uma medida nunca mistura Censo 2022 (moradores) com SINISA
 * 2024 (população estimada) no mesmo numerador e denominador.
 */

export type Fonte = "censo2022" | "censo2010_2022" | "sinisa2024" | "nr8_sinisa2024" | "sinisa_cadunico2024" | "sisagua" | "sih_sim";
export type Variante = "pct" | "pessoas";

export type Medida = {
  id: string;
  /** Rótulo curto para seletor e cabeçalho de tabela. */
  titulo: string;
  /** Pergunta a que responde, em linguagem do leitor. */
  pergunta: string;
  fonte: Fonte;
  periodo: string;
  /** Quem entra no denominador. */
  universo: string;
  /** Unidade do percentual (pct) e da contagem (pessoas); "pp" para variação. */
  unidadePct: string;
  unidadeContagem?: string;
  casas: number;
  /** Valor percentual (ou pp) e contagem, com null quando a medida não se aplica ao município. */
  pct: (m: Municipio) => number | null;
  contagem?: (m: Municipio) => number | null;
  /** Numerador e denominador para agregar pela soma (UF, região, Brasil, pares). */
  numerador?: (m: Municipio) => number | null;
  denominador?: (m: Municipio) => number | null;
  /** O que a medida permite observar e o que não permite concluir. */
  permite: string;
  naoPermite: string;
  /** Por que um município fica sem valor. */
  ausencia: string;
  /** Cortes fixos das classes do mapa (estáveis entre filtros) e paleta. */
  cortesPct: number[];
  cortesContagem?: number[];
  paleta?: "sequencial" | "divergente";
  /** Multiplicador da razão agregada Σnumerador/Σdenominador (100 para percentual, 1 para valor por habitante). */
  fator?: number;
  /** Limites das classes do histograma quando a medida não é percentual de 0 a 100. */
  limitesHistograma?: number[];
};

const pop22 = (m: Municipio) => m.pop22;
const somaSemRedeNemSeptica = (m: Municipio) =>
  m.c22_es_precario == null || m.c22_es_sem_banheiro == null ? null : m.c22_es_precario + m.c22_es_sem_banheiro;
const semRedeEsgoto = (m: Municipio) => (m.pop22 == null || m.c22_es_rede == null ? null : m.pop22 - m.c22_es_rede);
const naoAtendidaAgua = (m: Municipio) =>
  m.IAG0001 == null || m.dfe0001 == null || m.ag_pop_at == null ? null : Math.max(0, m.dfe0001 - m.ag_pop_at);
const naoAtendidaEsgoto = (m: Municipio) =>
  m.IES0001 == null || m.dfe0001 == null || m.es_pop_at == null ? null : Math.max(0, m.dfe0001 - m.es_pop_at);

export const FONTE_ROTULO: Record<Fonte, string> = {
  censo2022: "IBGE, Censo Demográfico 2022",
  censo2010_2022: "IBGE, Censos Demográficos 2010 e 2022",
  sinisa2024: "Ministério das Cidades, SINISA 2025 (ano de referência 2024)",
  nr8_sinisa2024: "SINISA 2025 (2024) e IBGE, pela ficha da NR ANA 8/2024",
  sinisa_cadunico2024: "SINISA 2025 (2024) e MDS, CadÚnico de dezembro de 2024",
  sisagua: "Ministério da Saúde, SISAGUA (dados abertos)",
  sih_sim: "Ministério da Saúde, DATASUS: SIH/SUS e SIM, por local de residência, 2022 a 2024 (TabNet), e IBGE, Censo 2022",
};

/** Rótulo curto da fonte no seletor de medidas. */
export const FONTE_CURTA: Record<Fonte, string> = {
  censo2022: "Censo 2022",
  censo2010_2022: "Censos 2010 e 2022",
  sinisa2024: "SINISA 2024",
  nr8_sinisa2024: "NR 8 / SINISA 2024",
  sinisa_cadunico2024: "SINISA e CadÚnico 2024",
  sisagua: "SISAGUA",
  sih_sim: "SIH, SIM e Censo 2022",
};

/** Anos do SISAGUA publicados: 2024 casa com o SINISA; 2025 é o ano completo mais recente. */
export const ANOS_SISAGUA = [2024, 2025] as const;

type EspecQualidade = Pick<Medida, "permite" | "naoPermite" | "ausencia" | "cortesPct" | "limitesHistograma"> & {
  campo: string;
  titulo: string;
  pergunta: string;
  universo: string;
  unidadeContagem: string;
};

const ESPEC_QUALIDADE: EspecQualidade[] = [
  {
    campo: "ctrl_ecoli",
    titulo: "Controle: presença de E. coli",
    pergunta: "Em que proporção das análises de E. coli informadas pelo prestador a bactéria apareceu na rede ou no ponto de consumo?",
    universo: "Análises de E. coli do controle mensal do prestador no sistema de distribuição e no ponto de consumo de SAA e SAC",
    unidadeContagem: "análises com presença",
    permite:
      "Localizar onde o próprio prestador registrou indicador de contaminação fecal na água distribuída. Pela Portaria GM/MS 888/2021, Anexo 1, a E. coli deve estar ausente em 100 mL.",
    naoPermite:
      "Concluir que a água é segura onde a proporção é zero: o número de análises varia muito entre municípios, recoletas entram no total e o resultado é declarado pelo prestador. Não se compara com a vigilância.",
    ausencia: "Município sem registro de controle no SISAGUA no ano ou sem análise de E. coli na rede e no consumo. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [0.1, 0.5, 1, 3],
    limitesHistograma: [0, 0.5, 1, 2, 5, 10, 25],
  },
  {
    campo: "ctrl_colif",
    titulo: "Controle: presença de coliformes totais",
    pergunta: "Em que proporção das análises de coliformes totais informadas pelo prestador houve presença na rede ou no ponto de consumo?",
    universo: "Análises de coliformes totais do controle mensal do prestador no sistema de distribuição e no ponto de consumo de SAA e SAC",
    unidadeContagem: "análises com presença",
    permite:
      "Observar o indicador de integridade da rede (Portaria GM/MS 888/2021, Anexo 1) nas análises do próprio prestador, município a município.",
    naoPermite:
      "Ler como taxa de desconformidade: a norma tolera presença em parte das amostras mensais, conforme a população abastecida, e exige recoleta. Coliformes totais não indicam, sozinhos, contaminação fecal.",
    ausencia: "Município sem registro de controle no SISAGUA no ano ou sem análise de coliformes totais na rede e no consumo. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [0.5, 2, 5, 10],
    limitesHistograma: [0, 1, 2, 5, 10, 25, 50],
  },
  {
    campo: "ctrl_cloro",
    titulo: "Controle: cloro residual livre abaixo de 0,2 mg/L",
    pergunta: "Em que proporção das análises de cloro residual livre do prestador o desinfetante ficou abaixo do mínimo na rede ou no consumo?",
    universo: "Análises de cloro residual livre do controle mensal do prestador no sistema de distribuição e no ponto de consumo de SAA e SAC",
    unidadeContagem: "análises abaixo do mínimo",
    permite:
      "Localizar onde o prestador registrou desinfetante abaixo do mínimo de 0,2 mg/L exigido em toda a rede e nos pontos de consumo (Portaria GM/MS 888/2021, Art. 32).",
    naoPermite:
      "Avaliar sistemas que desinfetam com cloro combinado ou dióxido de cloro, que informam outro parâmetro e ficam fora, nem concluir que houve contaminação.",
    ausencia: "Município sem registro de controle no SISAGUA no ano ou sem análise de cloro residual livre na rede e no consumo. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [1, 5, 10, 25],
    limitesHistograma: [0, 1, 5, 10, 25, 50, 100],
  },
  {
    campo: "ctrl_turb",
    titulo: "Controle: turbidez acima de 5,0 uT",
    pergunta: "Em que proporção das análises de turbidez do prestador o valor passou do máximo permitido na rede ou no consumo?",
    universo: "Análises de turbidez do controle mensal do prestador no sistema de distribuição e no ponto de consumo de SAA e SAC",
    unidadeContagem: "análises acima do máximo",
    permite:
      "Localizar onde o prestador registrou turbidez acima do valor máximo de 5,0 uT na rede e nos pontos de consumo (Portaria GM/MS 888/2021, Art. 28, § 2º).",
    naoPermite: "Avaliar a filtração na estação de tratamento, que tem limites próprios (Anexo 2) e não entra nesta medida.",
    ausencia: "Município sem registro de controle no SISAGUA no ano ou sem análise de turbidez na rede e no consumo. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [0.5, 2, 5, 10],
    limitesHistograma: [0, 1, 2, 5, 10, 25, 50],
  },
  {
    campo: "ctrl_cor",
    titulo: "Controle: cor aparente acima de 15 uH",
    pergunta: "Em que proporção das análises de cor do prestador a água passou do máximo permitido na rede ou no consumo?",
    universo: "Análises de cor aparente do controle mensal do prestador no sistema de distribuição e no ponto de consumo de SAA e SAC",
    unidadeContagem: "análises acima do máximo",
    permite: "Localizar onde o prestador registrou cor acima de 15 uH, valor máximo do padrão organoléptico (Portaria GM/MS 888/2021, Anexo 11).",
    naoPermite: "Concluir risco à saúde: cor é padrão de aceitação (aparência), não indicador microbiológico ou químico.",
    ausencia: "Município sem registro de controle no SISAGUA no ano ou sem análise de cor na rede e no consumo. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [1, 3, 10, 25],
    limitesHistograma: [0, 1, 3, 5, 10, 25, 50],
  },
  {
    campo: "ctrl_fluor",
    titulo: "Controle: fluoreto acima de 1,5 mg/L",
    pergunta: "Em que proporção das análises de fluoreto do prestador o valor passou do máximo permitido na rede ou no consumo?",
    universo: "Análises de fluoreto do controle mensal do prestador no sistema de distribuição e no ponto de consumo de SAA e SAC",
    unidadeContagem: "análises acima do máximo",
    permite: "Localizar onde o prestador registrou fluoreto acima de 1,5 mg/L, valor máximo por risco à saúde (Portaria GM/MS 888/2021, Anexo 9).",
    naoPermite:
      "Avaliar a fluoretação: o teor recomendado para prevenir cárie (Anexo XXI da Portaria de Consolidação 5/2017) é outra faixa, e fluoreto baixo não entra nesta medida. Muitos sistemas medem fluoreto só na saída do tratamento.",
    ausencia: "Município sem registro de controle no SISAGUA no ano ou sem análise de fluoreto na rede e no consumo. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [0.5, 2, 5, 10],
    limitesHistograma: [0, 1, 2, 5, 10, 25, 50],
  },
  {
    campo: "vig_ecoli",
    titulo: "Vigilância: presença de E. coli",
    pergunta: "Em que proporção das análises de rotina da vigilância em saúde a E. coli apareceu na água distribuída?",
    universo: "Análises de rotina da vigilância em saúde na rede de SAA e no ponto de consumo de SAC",
    unidadeContagem: "análises com presença",
    permite:
      "Ver o resultado das coletas feitas pela autoridade de saúde, independentes do prestador, na rede de sistemas e no ponto de consumo de soluções coletivas.",
    naoPermite:
      "Comparar com o controle do prestador como se medissem a mesma coisa: coletores, pontos, frequência e laboratórios são outros. Amostras de denúncia, surto e desastre e coletas dentro dos domicílios ficam fora.",
    ausencia: "Município sem amostra de rotina de E. coli da vigilância na rede de SAA ou no ponto de consumo de SAC no ano. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [1, 3, 10, 25],
    limitesHistograma: [0, 2, 5, 10, 25, 50, 100],
  },
  {
    campo: "vig_cloro",
    titulo: "Vigilância: cloro residual livre abaixo de 0,2 mg/L",
    pergunta: "Em que proporção das análises de rotina da vigilância o cloro residual livre ficou abaixo do mínimo?",
    universo: "Análises de rotina da vigilância em saúde na rede de SAA e no ponto de consumo de SAC, com resultado numérico ou abaixo de limite conclusivo",
    unidadeContagem: "análises abaixo do mínimo",
    permite: "Ver, nas coletas da autoridade de saúde, onde o desinfetante ficou abaixo do mínimo de 0,2 mg/L (Portaria GM/MS 888/2021, Art. 32).",
    naoPermite:
      "Comparar com o controle do prestador como se medissem a mesma coisa. Resultado abaixo do limite de quantificação só conta quando esse limite é de até 0,2 mg/L; os demais ficam fora e são contados.",
    ausencia: "Município sem amostra de rotina de cloro residual livre da vigilância na rede de SAA ou no ponto de consumo de SAC no ano. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [5, 10, 25, 50],
    limitesHistograma: [0, 5, 10, 25, 50, 75, 100],
  },
  {
    campo: "vig_fluor",
    titulo: "Vigilância: fluoreto acima de 1,5 mg/L",
    pergunta: "Em que proporção das análises de rotina da vigilância o fluoreto passou do máximo permitido?",
    universo: "Análises de rotina da vigilância em saúde na rede de SAA e no ponto de consumo de SAC, com resultado numérico ou abaixo de limite conclusivo",
    unidadeContagem: "análises acima do máximo",
    permite: "Ver, nas coletas da autoridade de saúde, onde o fluoreto passou de 1,5 mg/L (Portaria GM/MS 888/2021, Anexo 9).",
    naoPermite: "Avaliar a fluoretação, que tem faixa recomendada própria, nem comparar com o controle do prestador como se medissem a mesma coisa.",
    ausencia: "Município sem amostra de rotina de fluoreto da vigilância na rede de SAA ou no ponto de consumo de SAC no ano. Ausência de registro não indica água de boa qualidade.",
    cortesPct: [0.5, 2, 5, 10],
    limitesHistograma: [0, 1, 2, 5, 10, 25, 50],
  },
  {
    campo: "ctrl_agro",
    titulo: "Controle semestral: agrotóxicos acima do VMP",
    pergunta: "Em que proporção das análises de agrotóxicos do prestador na água tratada o resultado passou do valor máximo permitido?",
    universo:
      "Análises de agrotóxicos e metabólitos do controle semestral do prestador na saída do tratamento, na rede e no ponto de consumo (água bruta fora)",
    unidadeContagem: "análises acima do VMP",
    permite:
      "Localizar onde o prestador registrou agrotóxico acima do VMP do Anexo 9 da Portaria GM/MS 888/2021, parâmetro a parâmetro, sempre com o VMP da Portaria vigente.",
    naoPermite:
      "Somar agrotóxicos diferentes ou concluir que a água tem agrotóxico onde nada passou do VMP: resultado abaixo do limite de quantificação não é zero, e cada análise é de um único parâmetro.",
    ausencia: "Município sem análise de agrotóxicos em água tratada no controle semestral do ano. Ausência de registro não indica água sem agrotóxico.",
    cortesPct: [0.05, 0.25, 1, 3],
    limitesHistograma: [0, 0.1, 0.5, 1, 2, 5, 10],
  },
  {
    campo: "ctrl_quim",
    titulo: "Controle semestral: substâncias de risco à saúde acima do VMP",
    pergunta: "Em que proporção das análises de substâncias inorgânicas, orgânicas e subprodutos da desinfecção o resultado passou do VMP?",
    universo:
      "Análises de substâncias inorgânicas, orgânicas e subprodutos da desinfecção (Anexo 9) do controle semestral, na água tratada",
    unidadeContagem: "análises acima do VMP",
    permite: "Localizar onde o prestador registrou metal, nitrato, solvente ou subproduto da desinfecção acima do VMP da Portaria 888.",
    naoPermite:
      "Afirmar descumprimento: para subprodutos da desinfecção (trihalometanos e ácidos haloacéticos), a norma verifica a média móvel de 12 meses (Art. 40), e nitrato e nitrito seguem a soma das razões (Art. 39).",
    ausencia: "Município sem análise desses grupos em água tratada no controle semestral do ano. Ausência de registro não indica água sem a substância.",
    cortesPct: [0.25, 1, 3, 10],
    limitesHistograma: [0, 0.5, 1, 2, 5, 10, 25],
  },
  {
    campo: "ctrl_organol",
    titulo: "Controle semestral: padrão organoléptico acima do VMP",
    pergunta: "Em que proporção das análises de aceitação (gosto, odor, ferro, alumínio, dureza e outros) o resultado passou do VMP?",
    universo: "Análises do padrão organoléptico (Anexo 11) do controle semestral, na água tratada",
    unidadeContagem: "análises acima do VMP",
    permite: "Localizar onde o prestador registrou água fora do padrão de aceitação para consumo da Portaria 888 (Anexo 11).",
    naoPermite: "Concluir risco à saúde: o padrão organoléptico trata de aparência, gosto e odor.",
    ausencia: "Município sem análise organoléptica em água tratada no controle semestral do ano.",
    cortesPct: [0.5, 2, 5, 15],
    limitesHistograma: [0, 1, 2, 5, 10, 25, 50],
  },
  {
    campo: "vig_quim",
    titulo: "Vigilância: substâncias químicas acima do VMP",
    pergunta: "Em que proporção das análises químicas de rotina da vigilância na água tratada o resultado passou do VMP?",
    universo:
      "Análises de rotina da vigilância de agrotóxicos, substâncias inorgânicas, orgânicas e subprodutos da desinfecção (Anexo 9), na rede e na saída do tratamento de SAA e no ponto de consumo de SAC",
    unidadeContagem: "análises acima do VMP",
    permite: "Ver, nas coletas da autoridade de saúde, onde alguma substância química de risco à saúde passou do VMP da Portaria 888.",
    naoPermite:
      "Comparar com o controle do prestador como se medissem a mesma coisa, nem concluir sobre municípios sem análise: a vigilância química alcança poucos municípios.",
    ausencia: "Município sem análise química de rotina da vigilância em água tratada no ano. Ausência de registro não indica água sem a substância.",
    cortesPct: [0.25, 1, 3, 10],
    limitesHistograma: [0, 0.5, 1, 2, 5, 10, 25],
  },
  {
    campo: "plano",
    titulo: "Plano de amostragem: análises exigidas cobertas",
    pergunta: "Das análises de coliformes totais que a norma exige na rede de cada sistema, quantas aparecem no controle informado?",
    universo:
      "Análises de coliformes totais exigidas no sistema de distribuição de cada SAA pelo plano de amostragem do SISAGUA (Portaria GM/MS 888/2021, Anexo 14)",
    unidadeContagem: "análises cobertas",
    permite:
      "Ver quanto do mínimo de análises bacteriológicas exigido para a rede de cada SAA aparece no controle mensal. A cobertura é limitada a 100% por sistema: o excesso em um não compensa a falta em outro.",
    naoPermite:
      "Afirmar descumprimento da norma: análises podem ter sido feitas e não informadas, um SAA que atende vários municípios pode registrar as análises em outro município, e recoletas entram nas realizadas. Não cobre SAC.",
    ausencia: "Município sem SAA com plano de amostragem no SISAGUA no ano.",
    cortesPct: [25, 50, 75, 95],
  },
  {
    campo: "plano_sac",
    titulo: "Plano de amostragem SAC: análises exigidas cobertas",
    pergunta: "Das análises de coliformes totais que a norma exige em cada solução alternativa coletiva, quantas aparecem no controle informado?",
    universo:
      "Análises de coliformes totais exigidas para cada SAC pelo plano de amostragem do SISAGUA (Portaria GM/MS 888/2021, Anexo 15), comparadas às do ponto de consumo no controle",
    unidadeContagem: "análises cobertas",
    permite:
      "Ver quanto do mínimo exigido para as soluções coletivas (poços comunitários, chafarizes, redes locais) aparece no controle mensal, limitado a 100% por solução.",
    naoPermite:
      "Afirmar descumprimento: o plano registra a exigência como distribuição e o controle registra as análises no ponto de consumo; o Observatório trata os dois como o mesmo ponto da solução, mas a correspondência não é declarada pelo Ministério.",
    ausencia: "Município sem SAC com plano de amostragem no SISAGUA no ano.",
    cortesPct: [25, 50, 75, 95],
  },
  {
    campo: "pop_saa",
    titulo: "Cadastro SAA: população sob sistemas com controle informado",
    pergunta: "Da população que o cadastro do SISAGUA atribui a sistemas de abastecimento, quanto vive sob sistemas que informaram controle no ano?",
    universo: "População estimada das formas de abastecimento do tipo SAA no cadastro do SISAGUA, no mesmo ano",
    unidadeContagem: "pessoas",
    permite:
      "Dimensionar, em pessoas, o alcance do controle informado: um sistema conta quando tem algum registro de controle no ano, em qualquer município que atenda.",
    naoPermite:
      "Comparar com o Censo ou com o SINISA: a população é a estimada no cadastro de cada sistema, e a completude do cadastro muda de um ano para outro. Ter registro não significa cumprir o plano de amostragem.",
    ausencia: "Município sem SAA cadastrado no SISAGUA no ano ou com população não informada.",
    cortesPct: [25, 50, 75, 95],
  },
  {
    campo: "pop_sac",
    titulo: "Cadastro SAC: população sob soluções com controle informado",
    pergunta: "Da população que o cadastro atribui a soluções alternativas coletivas, quanto vive sob soluções que informaram controle no ano?",
    universo: "População estimada das formas de abastecimento do tipo SAC no cadastro do SISAGUA, no mesmo ano",
    unidadeContagem: "pessoas",
    permite: "Dimensionar, em pessoas, o alcance do controle informado nas soluções coletivas.",
    naoPermite:
      "Somar com a população de SAA: quem recebe água de sistema e de solução coletiva aparece nas duas. A população é a estimada no cadastro, não a do Censo.",
    ausencia: "Município sem SAC cadastrada no SISAGUA no ano ou com população não informada.",
    cortesPct: [25, 50, 75, 95],
  },
];

/** Medidas do SISAGUA (capítulo 3): exigem a tabela própria qualidade_municipios.json. */
/** Acima disto, economias com tarifa social excedem o universo de famílias elegíveis: o valor declarado fica sinalizado e fora das classes do mapa. */
export const LIMITE_RAZAO_TARIFA_SOCIAL = 100;

/** Economias com tarifa social por 100 famílias elegíveis, sem o corte de plausibilidade (a ficha mostra o valor declarado). */
export function razaoTarifaSocial(m: Pick<Municipio, "ts_economias" | "cad_fam_ms">): number | null {
  return m.ts_economias == null || m.cad_fam_ms == null || !(m.cad_fam_ms > 0) ? null : (m.ts_economias / m.cad_fam_ms) * 100;
}

export const MEDIDAS_QUALIDADE: Medida[] = ANOS_SISAGUA.flatMap((ano) =>
  ESPEC_QUALIDADE.map((e) => {
    const num = (m: Municipio) => m[`qa_${e.campo}_${ano}_num`] ?? null;
    const den = (m: Municipio) => m[`qa_${e.campo}_${ano}_den`] ?? null;
    const [grupo, resto] = e.titulo.split(": ");
    return {
      id: `qa-${e.campo.replace("_", "-")}-${ano}`,
      titulo: `${grupo} ${ano}: ${resto}`,
      pergunta: e.pergunta,
      fonte: "sisagua" as const,
      periodo: String(ano),
      universo: e.universo,
      unidadePct: "%",
      unidadeContagem: e.unidadeContagem,
      casas: e.campo === "ctrl_ecoli" || e.campo === "ctrl_agro" ? 2 : 1,
      pct: (m: Municipio) => razaoPct(num(m), den(m)),
      contagem: num,
      numerador: num,
      denominador: den,
      permite: e.permite,
      naoPermite: e.naoPermite,
      ausencia: e.ausencia,
      cortesPct: e.cortesPct,
      limitesHistograma: e.limitesHistograma,
    };
  }),
);

/** Janela do capítulo 13 (SIH e SIM): os três últimos anos com dados finais do SIM na extração. */
export const ANOS_SAUDE = [2022, 2023, 2024] as const;

type EspecSaude = {
  grupo: string;
  rotuloGrupo: string;
  cid: string;
  sistema: "sih" | "sim";
  medida: "int" | "obt";
  casas: number;
  cortesPct: number[];
  limitesHistograma: number[];
};

const ESPEC_SAUDE: EspecSaude[] = [
  { grupo: "intestinais", rotuloGrupo: "Infecções intestinais", cid: "A00 a A09", sistema: "sih", medida: "int", casas: 1, cortesPct: [25, 75, 150, 300], limitesHistograma: [0, 25, 50, 100, 200, 400, 800, 1600] },
  { grupo: "intestinais", rotuloGrupo: "Infecções intestinais", cid: "A00 a A09", sistema: "sim", medida: "obt", casas: 1, cortesPct: [0.1, 2, 4, 8], limitesHistograma: [0, 0.1, 1, 2, 4, 8, 16, 32, 64] },
  { grupo: "leptospirose", rotuloGrupo: "Leptospirose", cid: "A27", sistema: "sih", medida: "int", casas: 2, cortesPct: [0.1, 1, 3, 10], limitesHistograma: [0, 0.1, 1, 2, 5, 10, 20, 40, 80] },
  { grupo: "leptospirose", rotuloGrupo: "Leptospirose", cid: "A27", sistema: "sim", medida: "obt", casas: 2, cortesPct: [0.1, 0.5, 1, 2.5], limitesHistograma: [0, 0.1, 0.5, 1, 2.5, 5, 10, 20] },
  { grupo: "esquistossomose", rotuloGrupo: "Esquistossomose", cid: "B65", sistema: "sih", medida: "int", casas: 2, cortesPct: [0.1, 0.5, 1, 2.5], limitesHistograma: [0, 0.1, 0.5, 1, 2.5, 5, 10, 20] },
  { grupo: "esquistossomose", rotuloGrupo: "Esquistossomose", cid: "B65", sistema: "sim", medida: "obt", casas: 2, cortesPct: [0.1, 0.5, 1, 3], limitesHistograma: [0, 0.1, 0.5, 1, 3, 6, 12] },
];

const POR_100_MIL = 100_000;

/**
 * Doenças com ligação documentada ao saneamento, por município de residência: taxa anual por 100 mil moradores
 * (soma de 2022 a 2024 ÷ três vezes os moradores do Censo 2022). Denominador fixo, não população do ano.
 */
export const MEDIDAS_SAUDE: Medida[] = ESPEC_SAUDE.map((e) => {
  const campo = `sd_${e.grupo}_${e.sistema}_${e.medida}` as const;
  const casos = (m: Municipio) => m[campo] ?? null;
  const exposicao = (m: Municipio) => (m.pop22 == null || !(m.pop22 > 0) ? null : ANOS_SAUDE.length * m.pop22);
  const internacao = e.sistema === "sih";
  const evento = internacao ? "internações" : "óbitos";
  return {
    id: `sd-${e.grupo}-${e.sistema}-${e.medida}`,
    titulo: `${e.rotuloGrupo}: ${evento} (${internacao ? "SIH" : "SIM"})`,
    pergunta: internacao
      ? `Quantos moradores do município foram internados pelo SUS por ${e.rotuloGrupo.toLowerCase()} (CID-10 ${e.cid}), por 100 mil habitantes ao ano?`
      : `Quantos moradores do município morreram de ${e.rotuloGrupo.toLowerCase()} (CID-10 ${e.cid}) como causa básica, por 100 mil habitantes ao ano?`,
    fonte: "sih_sim" as const,
    periodo: `${ANOS_SAUDE[0]} a ${ANOS_SAUDE[ANOS_SAUDE.length - 1]}`,
    universo: "Moradores do Censo 2022 do município de residência, três anos de exposição (denominador fixo)",
    unidadePct: "por 100 mil hab. ao ano",
    unidadeContagem: `${evento} em ${ANOS_SAUDE[0]} a ${ANOS_SAUDE[ANOS_SAUDE.length - 1]}`,
    casas: e.casas,
    pct: (m: Municipio) => {
      const n = casos(m);
      const d = exposicao(m);
      return n == null || d == null ? null : (n / d) * POR_100_MIL;
    },
    contagem: casos,
    numerador: (m: Municipio) => (exposicao(m) == null ? null : casos(m)),
    denominador: exposicao,
    fator: POR_100_MIL,
    permite: internacao
      ? "Ver onde moradores do município foram internados pelo SUS com a doença, em taxa por 100 mil habitantes ao ano, e comparar com a UF e o Brasil na mesma janela."
      : "Ver onde moradores do município morreram com a doença como causa básica, em taxa por 100 mil habitantes ao ano, com dados finais do SIM.",
    naoPermite: internacao
      ? "Atribuir a internação ao saneamento: a fonte traz o diagnóstico, não a causa do contágio. Só entram internações pagas pelo SUS, pelo município de residência informado na AIH, e poucos casos mudam muito a taxa de um município pequeno."
      : "Atribuir o óbito ao saneamento: a fonte traz a causa básica da declaração de óbito, não a origem do contágio. Poucos óbitos mudam muito a taxa de um município pequeno, e as doenças raras têm zero na maior parte dos municípios.",
    ausencia: "Município sem moradores no Censo 2022 (instalado depois) ou sem linha na fonte. Zero é zero: nenhum caso registrado na janela.",
    cortesPct: e.cortesPct,
    limitesHistograma: e.limitesHistograma,
  };
});

export const MEDIDAS_DESIGUALDADES: Medida[] = DESIGUALDADES.map((s) => {
  const num = (m: Municipio) => m[`des_${s.id}_num`] ?? null;
  const den = (m: Municipio) => m[`des_${s.id}_den`] ?? null;
  const titulo = s.medida === "agua" ? "Sem ligação à rede geral de água" : "Sem rede nem fossa séptica";
  return {
    id: `des-${s.id}`, titulo: `${s.rotulo}: ${titulo.toLowerCase()}`,
    pergunta: `${titulo}: qual a proporção entre ${s.universo.toLowerCase()}?`,
    fonte: "censo2022", periodo: "2022", universo: s.universo,
    unidadePct: "%", unidadeContagem: s.unidade, casas: 1,
    pct: (m) => razaoPct(num(m), den(m)), contagem: num, numerador: num, denominador: den,
    permite: `Comparar a carência no mesmo grupo e universo entre territórios. IBGE, SIDRA ${s.tabela}, Censo 2022.`,
    naoPermite: "Inferir renda individual, qualidade da água, tratamento do esgoto ou causa das diferenças. Grupos se sobrepõem; domicílios e moradores não se somam nem se comparam como o mesmo universo.",
    ausencia: "Sem tabulação, informação suprimida ou universo igual a zero. Ausência não significa ausência de carência.",
    cortesPct: [5, 15, 30, 50], cortesContagem: [100, 1000, 10000, 100000],
  };
});

export const MEDIDAS: Medida[] = [
  {
    id: "c22-agua-sem-ligacao",
    titulo: "Sem ligação à rede geral de água",
    pergunta: "Quantos moradores vivem em domicílios sem ligação à rede geral de água?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(m.c22_ag_sem, m.pop22),
    contagem: (m) => m.c22_ag_sem,
    numerador: (m) => m.c22_ag_sem,
    denominador: pop22,
    permite: "Localizar onde a rede geral não chega ao domicílio, em número de pessoas e em proporção dos moradores.",
    naoPermite:
      "Concluir que não há água adequada: parte desses moradores usa poço profundo, nascente ou cisterna. O Censo não mede potabilidade nem regularidade.",
    ausencia: "Município sem resultado no Censo 2022 (criado depois da coleta).",
    cortesPct: [5, 15, 30, 50],
    cortesContagem: [500, 2_000, 10_000, 50_000],
  },
  {
    id: "c22-agua-ligacao-outra-fonte",
    titulo: "Ligados à rede, mas usam outra fonte como principal",
    pergunta: "Quantos moradores têm ligação à rede, mas dependem principalmente de outra fonte?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(m.c22_ag_lig_outra, m.pop22),
    contagem: (m) => m.c22_ag_lig_outra,
    numerador: (m) => m.c22_ag_lig_outra,
    denominador: pop22,
    permite: "Distinguir ligação física e uso efetivo da rede como fonte principal.",
    naoPermite: "Atribuir a causa (intermitência, preço, qualidade percebida ou hábito): o Censo não pergunta o motivo.",
    ausencia: "Município sem resultado no Censo 2022.",
    cortesPct: [1, 3, 10, 25],
    cortesContagem: [100, 500, 2_000, 10_000],
  },
  {
    id: "c22-esgoto-sem-rede",
    titulo: "Sem rede geral, pluvial ou fossa ligada à rede",
    pergunta: "Quantos moradores não estão ligados a uma rede de esgoto ou pluvial?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(semRedeEsgoto(m), m.pop22),
    contagem: semRedeEsgoto,
    numerador: semRedeEsgoto,
    denominador: pop22,
    permite: "Medir a ausência de ligação a uma rede coletora, inclusive a pluvial.",
    naoPermite:
      "Separar soluções individuais adequadas: inclui quem usa fossa séptica não ligada à rede. Ligação à rede não garante tratamento do esgoto.",
    ausencia: "Município sem resultado no Censo 2022.",
    cortesPct: [25, 50, 75, 90],
    cortesContagem: [2_000, 10_000, 30_000, 100_000],
  },
  {
    id: "c22-esgoto-sem-rede-nem-septica",
    titulo: "Sem rede nem fossa séptica",
    pergunta: "Quantos moradores dependem de fossa rudimentar, vala, rio, lago ou mar, ou não têm banheiro?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(somaSemRedeNemSeptica(m), m.pop22),
    contagem: somaSemRedeNemSeptica,
    numerador: somaSemRedeNemSeptica,
    denominador: pop22,
    permite: "Identificar onde predominam fossa rudimentar, vala, despejo em corpo d'água, outra forma ou ausência de banheiro.",
    naoPermite:
      "Verificar o funcionamento da fossa séptica declarada, que entra fora desta contagem; nem a qualidade da construção de cada solução.",
    ausencia: "Município sem resultado no Censo 2022.",
    cortesPct: [10, 25, 50, 75],
    cortesContagem: [1_000, 5_000, 20_000, 80_000],
  },
  {
    id: "sinisa-agua-nao-atendida",
    titulo: "Não atendidos por rede de água (prestador)",
    pergunta: "Segundo o prestador, quantos residentes não são atendidos pela rede de água?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "População residente estimada pelo IBGE para 2024 (DFE0001), municípios participantes",
    unidadePct: "%",
    unidadeContagem: "pessoas",
    casas: 1,
    pct: (m) => (m.IAG0001 == null ? null : Math.max(0, 100 - m.IAG0001)),
    contagem: naoAtendidaAgua,
    numerador: naoAtendidaAgua,
    denominador: (m) => (m.IAG0001 == null ? null : m.dfe0001),
    permite: "Comparar a população não atendida declarada pelo prestador com a estimativa de população do município.",
    naoPermite:
      "Somar com o Censo: a população e o ano são outros. A população atendida é declarada, não verificada no domicílio; soluções alternativas ficam fora.",
    ausencia: "Município não participou do módulo de água ou o indicador não foi calculado pela regra oficial.",
    cortesPct: [5, 15, 30, 50],
    cortesContagem: [500, 2_000, 10_000, 50_000],
  },
  {
    id: "sinisa-esgoto-nao-atendida",
    titulo: "Não atendidos por rede de esgoto (prestador)",
    pergunta: "Segundo o prestador, quantos residentes não são atendidos pela rede coletora?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "População residente estimada pelo IBGE para 2024 (DFE0001), municípios com indicadores de esgoto",
    unidadePct: "%",
    unidadeContagem: "pessoas",
    casas: 1,
    pct: (m) => (m.IES0001 == null ? null : Math.max(0, 100 - m.IES0001)),
    contagem: naoAtendidaEsgoto,
    numerador: naoAtendidaEsgoto,
    denominador: (m) => (m.IES0001 == null ? null : m.dfe0001),
    permite: "Medir o alcance da rede coletora declarada pelo prestador.",
    naoPermite:
      "Inferir tratamento: atendimento por rede coletora não assegura tratamento. Municípios com delegação sem atendimento não têm indicador calculado.",
    ausencia: "Município sem indicador de esgoto (não participou ou delegação sem atendimento).",
    cortesPct: [25, 50, 75, 90],
    cortesContagem: [2_000, 10_000, 30_000, 100_000],
  },
  {
    id: "evolucao-agua-rede",
    titulo: "Rede geral de água como fonte principal: variação de 2010 a 2022",
    pergunta: "A parcela de moradores abastecidos principalmente pela rede geral subiu ou caiu entre os Censos?",
    fonte: "censo2010_2022",
    periodo: "2010 e 2022",
    universo: "Moradores em domicílios particulares permanentes (ocupados, em 2022)",
    unidadePct: "p.p.",
    casas: 1,
    pct: (m) => {
      const a = razaoPct(m.c22_ag_rede, m.pop22);
      const b = razaoPct(m.c10_ag_rede, m.c10_mor);
      return a == null || b == null ? null : a - b;
    },
    permite: "Comparar a mesma categoria (rede geral como forma principal) nos dois Censos.",
    naoPermite:
      "Atribuir a variação a uma política ou prestador. Limites municipais e domicílios ocupados podem ter mudado; municípios criados depois de 2010 ficam sem valor.",
    ausencia: "Município sem resultado em um dos Censos.",
    cortesPct: [-5, -1, 1, 5],
    paleta: "divergente",
  },
  {
    id: "evolucao-esgoto-rede",
    titulo: "Rede geral de esgoto ou pluvial: variação de 2010 a 2022",
    pergunta: "A parcela de moradores ligados à rede geral de esgoto ou pluvial mudou entre os Censos?",
    fonte: "censo2010_2022",
    periodo: "2010 e 2022",
    universo: "Moradores em domicílios particulares permanentes (ocupados, em 2022)",
    unidadePct: "p.p.",
    casas: 1,
    pct: (m) => {
      const a = razaoPct(m.c22_es_rede_pluvial, m.pop22);
      const b = razaoPct(m.c10_es_rede, m.c10_mor);
      return a == null || b == null ? null : a - b;
    },
    permite: "Comparar a categoria rede geral ou pluvial, que existe nos dois questionários.",
    naoPermite:
      "Somar a fossa ligada à rede, separada só em 2022. A comparação é aproximada: em 2010 parte dessas ligações pode ter sido declarada como rede geral.",
    ausencia: "Município sem resultado em um dos Censos.",
    cortesPct: [-5, -1, 1, 5],
    paleta: "divergente",
  },
  {
    id: "sinisa-esgoto-tratado-coletado",
    titulo: "Esgoto tratado sobre coletado (IES2004)",
    pergunta: "Do volume coletado, quanto é tratado?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "Volume de esgoto coletado mais importado, municípios com indicador calculado",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.IES2004,
    permite: "Ver o destino do esgoto que a rede já coleta.",
    naoPermite: "Medir pessoas atendidas nem carga poluidora removida: é razão de volumes e ignora o que não é coletado.",
    ausencia: "Município sem indicador calculado pela regra oficial.",
    cortesPct: [25, 50, 75, 95],
  },
  {
    id: "sinisa-esgoto-tratado-consumido",
    titulo: "Esgoto tratado sobre água consumida (IES2003)",
    pergunta: "Quanto do volume equivalente à água consumida volta tratado?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "Volume de água consumida, municípios atendidos com água pelo mesmo prestador",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.IES2003,
    permite: "Aproximar o tratamento do esgoto gerado, usando o consumo de água como referência.",
    naoPermite: "Tratar o consumo como medida exata da geração de esgoto, nem converter o percentual em pessoas.",
    ausencia: "Município sem indicador calculado pela regra oficial.",
    cortesPct: [25, 50, 75, 95],
  },
  {
    id: "nr8-iaa-rede",
    titulo: "IAA da NR 8, parcela de rede pública",
    pergunta: "Pela fórmula da ANA, que fração dos domicílios ocupados tem economia residencial ativa de água?",
    fonte: "nr8_sinisa2024",
    periodo: "2024",
    universo: "Domicílios ocupados estimados para 2024 (população estimada ÷ moradores por domicílio do Censo 2022)",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.iaa_rede,
    numerador: (m) => (m.iaa_rede == null ? null : m.nr8_ag_num),
    denominador: (m) => (m.iaa_rede == null ? null : m.dom_est24),
    permite: "Aproximar o indicador de atendimento da norma da ANA com dados públicos, sem soluções alternativas.",
    naoPermite:
      "Declarar cumprimento de meta: a ANA exige também o ICA, e soluções alternativas aceitas pelo regulador não estão no SINISA. Valores acima de 100% indicam economias ativas acima da estimativa de domicílios ocupados.",
    ausencia: "Município fora do módulo de água ou sem estimativa de domicílios.",
    cortesPct: [50, 75, 90, 99],
  },
  {
    id: "nr8-iae-rede",
    titulo: "IAE da NR 8, parcela de rede com tratamento",
    pergunta: "Pela fórmula da ANA, que fração dos domicílios ocupados tem economia residencial ativa com tratamento de esgoto?",
    fonte: "nr8_sinisa2024",
    periodo: "2024",
    universo: "Domicílios ocupados estimados para 2024 (população estimada ÷ moradores por domicílio do Censo 2022)",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.iae_rede,
    numerador: (m) => (m.iae_rede == null ? null : m.nr8_es_num),
    denominador: (m) => (m.iae_rede == null ? null : m.dom_est24),
    permite: "Aproximar o indicador de atendimento com coleta e tratamento da norma da ANA, sem soluções alternativas.",
    naoPermite:
      "Declarar cumprimento de meta: falta o ICE e as soluções individuais aceitas pelo regulador. Valores acima de 100% indicam economias acima da estimativa de domicílios ocupados.",
    ausencia: "Município sem informação de economias com tratamento no SINISA.",
    cortesPct: [25, 50, 75, 90],
  },
  {
    id: "sinisa-investimento-por-habitante",
    titulo: "Investimento em água e esgoto por habitante",
    pergunta: "Quanto foi investido em 2024 em água e esgoto, por habitante do município?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "População estimada pelo IBGE para 2024 (DFE0001), municípios que declararam ao menos um dos serviços",
    unidadePct: "R$/hab.",
    casas: 0,
    pct: (m) => {
      if (m.dfe0001 == null || !(m.dfe0001 > 0) || (m.inv_ag == null && m.inv_es == null)) return null;
      return ((m.inv_ag ?? 0) + (m.inv_es ?? 0)) / m.dfe0001;
    },
    numerador: (m) => (m.dfe0001 == null || (m.inv_ag == null && m.inv_es == null) ? null : (m.inv_ag ?? 0) + (m.inv_es ?? 0)),
    denominador: (m) => (m.inv_ag == null && m.inv_es == null ? null : m.dfe0001),
    fator: 1,
    permite: "Ver onde o investimento declarado de 2024 se concentrou, por habitante, somando prestador e Estado.",
    naoPermite:
      "Avaliar suficiência ou eficiência: um ano isolado oscila com o ciclo de obras, e investimento regional pode ser lançado num município que serve outros.",
    ausencia: "Município sem declaração de água nem de esgoto ao SINISA 2024. Zero declarado aparece como zero.",
    cortesPct: [10, 50, 100, 250],
    limitesHistograma: [0, 10, 25, 50, 100, 250, 500, 1000],
  },
  {
    id: "tarifa-social-por-familia-elegivel",
    titulo: "Economias com tarifa social por 100 famílias elegíveis",
    pergunta: "Para cada 100 famílias que a lei torna elegíveis, quantas economias tinham tarifa social de água?",
    fonte: "sinisa_cadunico2024",
    periodo: "2024",
    universo:
      "Famílias do CadÚnico com renda per capita até meio salário-mínimo em dez/2024, nos municípios cujo prestador respondeu sobre tarifa social",
    unidadePct: "por 100 famílias",
    casas: 1,
    pct: (m) => {
      const r = razaoTarifaSocial(m);
      return r == null || r > LIMITE_RAZAO_TARIFA_SOCIAL ? null : r;
    },
    contagem: (m) => (m.ts_economias == null || m.cad_fam_ms == null ? null : m.cad_fam_ms),
    unidadeContagem: "famílias elegíveis",
    numerador: (m) => (m.ts_economias == null || m.cad_fam_ms == null ? null : m.ts_economias),
    denominador: (m) => (m.ts_economias == null || m.cad_fam_ms == null ? null : m.cad_fam_ms),
    permite: "Ver onde a tarifa social declarada pelo prestador alcança mais e menos economias em relação ao número de famílias elegíveis.",
    naoPermite:
      "Ler como percentual de famílias atendidas: economia não é família (uma ligação pode abrigar mais de uma família), parte das elegíveis não tem ligação à rede ou não é titular da conta, e critérios locais podem incluir quem não está no CadÚnico. Razão acima de 100 é tratada como declaração a verificar e fica fora das classes do mapa: o prestador declara mais economias com tarifa social do que o universo de famílias elegíveis, o que o texto acima não explica por si só.",
    ausencia:
      "Prestador sem resposta sobre tarifa social, município sem dado do CadÚnico ou razão acima de 100 por 100 famílias (declaração a verificar, fora das classes; o valor declarado continua na ficha do município). Prestador que declara não oferecer conta como zero.",
    cortesPct: [5, 15, 30, 60],
    limitesHistograma: [0, 5, 10, 15, 20, 30, 40, 60, 80, 100],
  },
  ...MEDIDAS_DESIGUALDADES,
  ...MEDIDAS_QUALIDADE,
  ...MEDIDAS_SAUDE,
];

/** Medidas que dependem só de municipios.json, sem os recortes do capítulo 2 e do SISAGUA (que exigem tabela própria). */
export const MEDIDAS_GERAIS: Medida[] = MEDIDAS.filter((m) => !MEDIDAS_DESIGUALDADES.includes(m) && !MEDIDAS_QUALIDADE.includes(m) && !MEDIDAS_SAUDE.includes(m));

/** Texto do valor principal da medida, com a unidade certa (percentual, pontos percentuais ou valor por habitante). */
export function formatarValor(med: Medida, x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "sem dado";
  if (med.paleta === "divergente") return `${sinal(x, 1)} p.p.`;
  if (med.unidadePct === "%") return `${numero(x, med.casas)}%`;
  return `${numero(x, med.casas)} ${med.unidadePct}`;
}

export function medida(id: string): Medida {
  const m = MEDIDAS.find((x) => x.id === id);
  if (!m) throw new Error(`medida desconhecida: ${id}`);
  return m;
}

/** Valor da variante pedida; "pessoas" só existe quando a medida tem contagem. */
export function valorMedida(med: Medida, m: Municipio, variante: Variante): number | null {
  if (variante === "pessoas") return med.contagem ? med.contagem(m) : null;
  return med.pct(m);
}

/**
 * Agregação pela soma: pct = Σnumerador/Σdenominador; nunca média de percentuais municipais.
 * A contagem agregada soma a contagem da própria medida (a unidade exibida), que pode
 * diferir do numerador: na tarifa social o numerador é economias e a contagem, famílias.
 */
export function agregarMedida(
  med: Medida,
  lista: readonly Municipio[],
): { pct: number | null; contagem: number | null; municipios: number; universo: number } {
  if (!med.numerador || !med.denominador) {
    return { pct: null, contagem: null, municipios: lista.filter((m) => med.pct(m) != null).length, universo: 0 };
  }
  let num = 0;
  let den = 0;
  let cont = 0;
  let n = 0;
  for (const m of lista) {
    const a = med.numerador(m);
    const b = med.denominador(m);
    if (a == null || b == null || !(b > 0)) continue;
    num += a;
    den += b;
    cont += med.contagem ? med.contagem(m) ?? 0 : a;
    n += 1;
  }
  return { pct: den > 0 ? (num / den) * (med.fator ?? 100) : null, contagem: n ? cont : null, municipios: n, universo: den };
}
