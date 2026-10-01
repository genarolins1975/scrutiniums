/**
 * Tipos da gold do módulo Inclusão energética (public/energia/gold/inclusao.json),
 * espelho exato do que pipeline/energia/modulos/inclusao.py publica (painéis P059 a
 * P062). Ausência é null e é exibida como ausência; nenhum número é recalculado na
 * interface.
 *
 * Unidades nunca se misturam: unidade consumidora (UC, SCS), fatura (Beneficiários da
 * CDE), família (Cadastro Único e POF), domicílio (PNAD Contínua e Luz para Todos),
 * pessoa (população dos sistemas isolados) e real corrente. Cada campo diz a sua.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia } from "./tipos";

/** "BR", região com prefixo ("RG-N", "RG-NE", "RG-SE", "RG-S", "RG-CO") ou sigla da UF. */
export type Territorio = string;
export type RegiaoId = "RG-N" | "RG-NE" | "RG-SE" | "RG-S" | "RG-CO";
export type ModalidadeTsee = "baixa_renda" | "indigena" | "quilombola" | "bpc" | "multifamiliar";

/* ---------------------------------------------------------------- P059: Tarifa Social */

export type KpiComEvidencia = { valor: number | null; unidade: string; mes: string; evidencia: Evidencia };
export type KpiSimples = { valor: number | null; unidade: string; mes: string };

export type KpisTarifaSocial = {
  /** UC com Tarifa Social no mês de referência do SCS (soma das 5 modalidades). */
  uc_tsee: KpiComEvidencia;
  /** % das UC residenciais das distribuidoras com total residencial consistente. */
  participacao_pct: KpiComEvidencia;
  /** Diferença Mensal de Receita do mês, R$ correntes. */
  dmr_mes_reais: KpiComEvidencia;
  /** Soma da DMR nos 12 meses até o mês de referência; `meses_incompletos` avisa meses sem todas as distribuidoras. */
  dmr_12m_reais: { valor: number | null; unidade: string; inicio: string; fim: string; meses_incompletos: number };
  /** Variação das UC contra 12 meses antes; `comparavel` = mês base completo. */
  variacao_12m_pct: { valor: number | null; unidade: string; mes: string; mes_base: string; comparavel: boolean };
  kwh_por_uc: KpiSimples;
  dmr_por_uc_reais: KpiSimples;
  /** Faturas com desconto no arquivo de Beneficiários da CDE do mês do mapa (faturas, não UC). */
  faturas_cde_mapa?: KpiComEvidencia;
};

export type PontoSerieTsee = {
  m: string;
  distribuidoras: number;
  /** Nenhuma distribuidora esperada faltando e pelo menos 90 informantes (regra em `regras.mes_completo`). */
  completo: boolean;
  distribuidoras_faltantes: number;
  /** UC com Tarifa Social que as faltantes tinham no último mês informado (materialidade da falta). */
  uc_tsee_faltantes_ultimo_informe: number | null;
  uc_tsee: number | null;
  participacao_pct: number | null;
  excluidas_participacao: number;
  dmr_reais: number | null;
  mwh_tsee: number | null;
};

export type FaixaConsumo = { faixa: string; rotulo: string; uc_tsee: number; uc_residencial: number; pct_das_uc_tsee: number | null };

export type ConferenciaDistribuidora = {
  uc_scs: number | null;
  faturas_cde: number | null;
  diferenca_pct: number | null;
  dmr_scs_reais: number | null;
  desconto_cde_reais: number | null;
};

export type DistribuidoraTsee = {
  cnpj: string;
  sigla: string | null;
  uc_tsee: number | null;
  uc_baixa_renda: number | null;
  uc_indigena: number | null;
  uc_quilombola: number | null;
  uc_bpc: number | null;
  uc_multifamiliar: number | null;
  uc_residencial: number | null;
  residencial_inconsistente: boolean;
  /** null quando o total residencial do mês é inconsistente. */
  participacao_pct: number | null;
  dmr_reais: number | null;
  dmr_por_uc_reais: number | null;
  kwh_por_uc: number | null;
  variacao_12m_pct: number | null;
  despacho: string | null;
  /** UF das faturas da distribuidora no mês do mapa (% das faturas). */
  ufs_mapa: { uf: string; pct: number }[];
  conferencia_cde: ConferenciaDistribuidora | null | undefined;
};

export type UfTsee = {
  uf: string;
  nome: string;
  regiao: RegiaoId;
  faturas_tsee: number;
  desconto_reais: number | null;
  desconto_medio_por_fatura_reais: number | null;
  municipios_com_faturas: number;
};

/**
 * Um arquivo mensal de Beneficiários da CDE. Contagens e valores só existem quando o
 * original está no bronze (`original_no_bronze`); o mês sondado e rejeitado pela
 * cobertura publica só a cobertura e `motivo_sem_valores`.
 */
export type MesCde = {
  mes: string;
  distribuidoras: number | null;
  /** % das UC do SCS de referência em distribuidoras presentes no arquivo. */
  cobertura_scs_pct: number | null;
  /** Distribuidoras do SCS de referência sem fatura no arquivo, com as UC que tinham no SCS (maiores primeiro). */
  distribuidoras_ausentes: { cnpj: string; sigla: string | null; uc_scs_referencia: number }[];
  /** Cobertura de pelo menos 99,5%: mês comparável na série nacional e por UF. */
  completo: boolean;
  original_no_bronze: boolean;
  uso: string[];
  sha256: string | null;
  recurso: string | null;
  /** Faturas de faturamento (tipo 1) com desconto nas subclasses 3.2 a 3.6. */
  faturas_tsee: number | null;
  faturas_outras_subclasses: number | null;
  desconto_faturas_reais: number | null;
  desconto_medio_por_fatura_reais: number | null;
  /** Subclasses 3.2 a 3.6, tipos de faturamento 1 a 4 (cancelamentos e refaturamentos com o sinal da fonte). */
  desconto_liquido_reais: number | null;
  /** Diagnóstico: linhas SubsBaixaRenda de outras subclasses (fora do líquido). */
  desconto_fora_das_subclasses_reais: number | null;
  /** Faturas fora do mapa: formato inválido mais código inexistente na lista do IBGE. */
  faturas_municipio_invalido: number | null;
  faturas_municipio_inexistente: number | null;
  codigos_inexistentes: { codigo: string; faturas: number }[];
  motivo_sem_valores: string | null;
};

/** JSON sob demanda (`serie_cde_uf_json`): faturas e desconto por UF e mês (meses com original no bronze); listas na ordem de `ufs` × `meses`. */
export type SerieCdeUf = {
  gerado_em: string;
  fonte: string;
  unidades: { faturas_tsee: string; desconto_faturas_reais: string };
  meses: string[];
  ufs: string[];
  completo: boolean[];
  faturas_tsee: (number | null)[][];
  desconto_faturas_reais: (number | null)[][];
};

export type Incorporacao = {
  /** Primeiro mês em que a sucessora informa as UC da incorporada. */
  mes_ruptura: string;
  sucessora: string;
  incorporadas: string[];
  /** UC residenciais das incorporadas no último mês informado. */
  total_incorporadas: number;
  salto_sucessora: number;
  patamar_antes: number;
  patamar_depois: number;
  sigla_sucessora: string | null;
  siglas_incorporadas: (string | null)[];
};

export type ConferenciaScsCde = {
  mes: string;
  uc_scs: number;
  faturas_cde: number;
  diferenca_pct: number | null;
  dmr_scs_reais: number | null;
  desconto_cde_reais: number | null;
  diferenca_valor_pct: number | null;
  distribuidoras_comparadas: number;
  distribuidoras_ate_2pct: number;
  tolerancia: string;
  /** Corte declarado: `maiores_diferencas` só traz distribuidoras com pelo menos estas UC no SCS. */
  uc_minima_maiores_diferencas: number;
  maiores_diferencas: (ConferenciaDistribuidora & { cnpj: string; sigla: string | null })[];
  /** Distribuidoras abaixo do corte com diferença acima de ±2% (ex.: CERES, 436 UC e 1.740 faturas). */
  diferencas_distribuidoras_pequenas: (ConferenciaDistribuidora & { cnpj: string; sigla: string | null })[];
  so_no_scs: string[];
  so_na_cde: string[];
};

export type SerieAntiga = {
  status: "descontinuado";
  titulo_no_portal: string | null;
  nota_do_portal: string | null;
  teste_do_recurso: { status_http: string | null; location: string | null; conclusao: string | null; testado_em: string | null };
  copia_usada: string;
  linhas_por_regiao: number;
  /** `repete_trimestre`: o arquivo original repete a contagem desse trimestre (fica fora da estatística de concordância). */
  comparacao_scs: { m: string; uc_baixa_renda_antiga: number; uc_residencial_antiga: number; uc_tsee_scs: number | null; diferenca_pct: number | null; repete_trimestre: string | null }[];
  valores_repetidos: { m: string; repete: string }[];
  proveniencia: Proveniencia;
};

export type LinhaCusteio = {
  ano: string;
  despesa_total_reais: number | null;
  tarifa_social_reais: number | null;
  tarifa_social_pct_despesa: number | null;
  luz_para_todos_reais: number | null;
  luz_para_todos_pct_despesa: number | null;
  ccc_sistemas_isolados_reais: number | null;
  ccc_sistemas_isolados_pct_despesa: number | null;
};

export type DiagnosticoScs = {
  linhas: number;
  linhas_sem_competencia: number;
  cabecalho_faltando: string[];
  data_geracao: string[];
  pares: number;
  pares_com_mais_de_um_despacho: number;
  pares_com_despachos_divergentes: number;
  pares_com_faixas_incompletas: number;
  pares_com_dmr_variando_entre_faixas: number;
};

export type TarifaSocial = {
  pergunta: string;
  mes_referencia: string;
  mes_mapa: string | null;
  kpis: KpisTarifaSocial;
  /** Desde jan/2014; detalhe por modalidade em inclusao_tsee_mensal.csv. */
  serie_mensal: PontoSerieTsee[];
  modalidades_referencia: { mes: string } & Record<ModalidadeTsee, number | null>;
  faixas_consumo: { mes: string; linhas: FaixaConsumo[]; mes_anterior: string; linhas_anterior: FaixaConsumo[] };
  distribuidoras: DistribuidoraTsee[];
  /** Faturas do mês do mapa por UF (faturas, não UC). */
  ufs: UfTsee[];
  cde_meses: MesCde[];
  /** Endereço do JSON com a série por UF (SerieCdeUf), lido sob demanda. */
  serie_cde_uf_json: string;
  conferencia_scs_cde: ConferenciaScsCde | null;
  mudancas_de_sigla: { cnpj: string; mes: string; de: string; para: string }[];
  /** CNPJ cuja sigla no SCS é "Não Informado": sigla tomada de outra fonte, com a origem. */
  siglas_de_outra_fonte: { cnpj: string; sigla: string; origem: string }[];
  incorporacoes: Incorporacao[];
  /** Meses que a regra sem incorporação tiraria da participação e que a incorporação explica. */
  participacao_mantida_por_incorporacao: { mes: string; cnpj: string; sigla: string | null }[];
  diagnostico_scs: DiagnosticoScs | null;
  serie_antiga: SerieAntiga | null;
  custeio_cde: { linhas: LinhaCusteio[]; ano_corrente: string | null; proveniencia: Proveniencia } | null;
  eventos: { data: string; rotulo: string; fonte: string; detalhe: string }[];
  regras: {
    mes_completo: string;
    residencial_inconsistente: string;
    incorporacao: string;
    maiores_diferencas: string;
    desconto_liquido: string;
    despacho_vigente: string;
    mes_mapa: string;
    mes_cde_sem_original: string;
    municipio_valido: string;
  };
  proveniencia: { scs: Proveniencia; participacao: Proveniencia; cde: Proveniencia; antiga?: Proveniencia; custeio?: Proveniencia };
};

/* ---------------------------------------------------------------- P060: cobertura potencial (PROXY) */

export type RegraElegibilidade = {
  fonte: string;
  consultado_em: string;
  base_legal: string;
  criterios: { id: string; texto: string; no_denominador: boolean }[];
  requisitos: string[];
  vigencia: string;
  por_que_proxy: string[];
};

/** Numerador do SCS (meses completos) contra o total nacional do Cadastro Único (PROXY). */
export type PontoCoberturaMensal = {
  m: string;
  uc_tsee: number;
  familias_atualizadas: number | null;
  familias_cadastradas: number | null;
  razao_atualizadas_pct: number | null;
  razao_cadastradas_pct: number | null;
};

/** JSON sob demanda `serie_mensal_json`. */
export type SerieCoberturaMensal = {
  gerado_em: string;
  natureza_da_medida: "PROXY";
  unidade: string;
  campos: string[];
  serie: PontoCoberturaMensal[];
};

export type CoberturaUf = {
  uf: string;
  nome: string;
  regiao: RegiaoId;
  faturas_tsee: number;
  familias_atualizadas: number;
  familias_cadastradas: number;
  razao_atualizadas_pct: number | null;
  razao_cadastradas_pct: number | null;
  municipios: number;
  municipios_sem_fatura_no_arquivo: number;
};

export type Cobertura = {
  pergunta: string;
  natureza_da_medida: "PROXY";
  regra_elegibilidade: RegraElegibilidade;
  brasil: {
    mes: string;
    faturas_tsee: number | null;
    familias_atualizadas: number | null;
    familias_cadastradas: number | null;
    /** UC (faturas) com Tarifa Social por 100 famílias elegíveis pela renda com cadastro atualizado. */
    razao_atualizadas_pct: number | null;
    /** Mesma razão com todas as famílias cadastradas nessa renda (limite inferior da faixa de sensibilidade). */
    razao_cadastradas_pct: number | null;
    proxy: true;
    evidencia: Evidencia;
  } | null;
  ufs: CoberturaUf[];
  distribuicao_municipal: {
    municipios: number;
    quantis: { p10: number | null; p25: number | null; p50: number | null; p75: number | null; p90: number | null };
    acima_de_100: number;
    histograma: { de: number; ate: number | null; municipios: number }[];
    base_pequena_excluidos: number;
    sem_fatura_no_arquivo: number;
    faturas_sem_cadastro_mds: number;
  } | null;
  /** Endereço do JSON (SerieCoberturaMensal) com a série mensal nacional, lido sob demanda. */
  serie_mensal_json: string;
  /** Último ponto da série e número de meses, para o texto do painel sem carregar o JSON. */
  serie_mensal_ultimo: PontoCoberturaMensal | null;
  serie_mensal_meses: number;
  faixa_de_sensibilidade: string;
  proveniencia: { cobertura: Proveniencia };
};

/* ---------------------------------------------------------------- P061: peso no orçamento (POF 2017-2018) */

export type EstadoPrecisao = "publicado" | "cautela" | "suprimido" | "sem_erro_padrao" | "zero_na_amostra" | "ausente";

/** [valor (null quando suprimido), coeficiente de variação em %, estado]. */
export type EstimativaPof = [number | null, number | null, EstadoPrecisao];

export type MedidaPof =
  | "energia_media" | "despesa_media" | "razao_medias_pct" | "media_razoes_desp_pct" | "media_razoes_renda_pct"
  | "mediana_desp_pct" | "mediana_renda_pct" | "sem_despesa_energia_pct"
  | "acima_3_renda_pct" | "acima_3_desp_pct" | "acima_5_renda_pct" | "acima_5_desp_pct"
  | "acima_10_renda_pct" | "acima_10_desp_pct";

export type LinhaPof = {
  territorio: Territorio;
  nome: string;
  /** Código SIDRA da classe de rendimento; "7999" = total. */
  classe: string;
  classe_rotulo: string;
  n_amostra: number | null;
  /** Soma dos pesos (famílias representadas). */
  familias: number | null;
  /** Valores publicados na tabela 6715 (R$ de 15/01/2018 e %); CV publicado só para o Brasil. */
  sidra: { energia_media: number | null; despesa_media: number | null; distribuicao_pct: number | null; cv_energia_ibge_pct: number | null };
  /** Estimativas dos microdados com o plano amostral; as UF trazem só `medidas_uf`. */
  microdados: Partial<Record<MedidaPof, EstimativaPof>>;
};

export type ComparacaoPof = {
  territorio: Territorio;
  classe: string;
  energia_sidra: number;
  energia_micro: number;
  despesa_sidra: number | null;
  despesa_micro: number;
  distribuicao_sidra: number | null;
  razao_medias_micro: number | null;
  cv_ibge: number | null;
  cv_micro: number | null;
};

export type Orcamento = {
  pergunta: string;
  referencia: string;
  classes: { codigo: string; rotulo: string; inferior: number | null; superior: number | null }[];
  medidas: { id: MedidaPof; rotulo: string }[];
  formato_microdados: string;
  medidas_uf: MedidaPof[];
  /** Limiares de comprometimento (% da renda ou da despesa) para análise de sensibilidade. */
  limiares_pct: number[];
  regra_precisao: { cautela_cv_pct: number; suprime_cv_pct: number };
  linhas: LinhaPof[];
  conferencia: {
    comparacoes: number;
    energia_max_diferenca_reais: number | null;
    energia_ate_1_centavo: number;
    despesa_max_diferenca_reais: number | null;
    despesa_ate_1_centavo: number;
    distribuicao_max_diferenca_pp: number | null;
    distribuicao_ate_arredondamento: number;
    cv_max_diferenca_pp: number | null;
    tolerancias: { medias: string; distribuicao: string; cv: string };
    comparacoes_brasil: ComparacaoPof[];
  };
  diagnostico_microdados: {
    familias: number;
    registros: Record<string, { linhas_usadas: number; codigos_fora_do_tradutor: number; sem_familia: number }>;
  } | null;
  evidencias: {
    media_razoes_renda_classe_baixa: Evidencia;
    media_razoes_desp_brasil: Evidencia;
    razao_medias_brasil: Evidencia;
  };
  /** Brasil por classe (código SIDRA): média das participações na renda ao lado da mediana e sem as famílias com energia acima da renda. */
  sensibilidade_media_razoes_renda: Record<string, {
    media_razoes_renda_pct: number | null;
    mediana_renda_pct: number | null;
    media_sem_energia_acima_da_renda_pct: number | null;
    familias_amostra_energia_acima_da_renda: number | null;
    peso_energia_acima_da_renda_pct: number | null;
    tres_maiores_contribuicoes_pp: number | null;
  }>;
  proveniencia: { sidra: Proveniencia; microdados: Proveniencia };
};

/* ---------------------------------------------------------------- P062: acesso e sistemas isolados */

export type LinhaPnad = {
  territorio: Territorio;
  ano: string;
  situacao: "total" | "urbana" | "rural";
  /** % dos domicílios com energia elétrica de qualquer fonte (rede geral ou alternativa). */
  pct_com_energia: number | null;
  cv_pct_com_energia: number | null;
  pct_sem_energia: number | null;
  pct_rede_geral: number | null;
  cv_pct_rede_geral: number | null;
  /** % dos domicílios LIGADOS À REDE GERAL com fornecimento em tempo integral (não de todos os domicílios). */
  pct_integral_entre_rede: number | null;
  cv_pct_integral: number | null;
  domicilios_mil: number | null;
  domicilios_com_energia_mil: number | null;
  /** Diferença de duas estimativas publicadas; sem erro-padrão. null com estado "menos_de_1_mil" quando as duas coincidem em milhares. */
  domicilios_sem_energia_mil: number | null;
  domicilios_sem_energia_estado: "calculado" | "menos_de_1_mil" | "ausente";
};

export type LocalidadeIsolada = {
  sigla: string;
  nome: string | null;
  uf: string | null;
  municipio: string | null;
  distribuidora: string | null;
  /** Pessoas, informadas pela distribuidora no planejamento (não é contagem censitária). */
  populacao: number | null;
  previsao_interligacao: string | null;
  previsao_interconexao: string | null;
  programa: string | null;
  latitude: number | null;
  longitude: number | null;
};

/** População: soma só das informadas; null quando nenhuma localidade do grupo informa. */
export type PopulacaoAgregada = { populacao: number | null; localidades_sem_populacao: number };

export type CicloPasi = PopulacaoAgregada & {
  ciclo: string;
  localidades: number;
  com_previsao_interligacao: number;
  programas: Record<string, number>;
  sairam_da_lista?: number;
  entraram_na_lista?: number;
};

export type ConferenciaCaderno = {
  documento: string;
  url: string;
  arquivo: string | null;
  sha256: string | null;
  capturado_em: string | null;
  pagina: number | null;
  extracao: string;
  localidades_pdf: number | null;
  localidades_ciclo_anterior_pdf: number | null;
  populacao_milhoes_pdf: number | null;
  localidades_xlsx: number;
  localidades_ciclo_anterior_xlsx: number | null;
  populacao_xlsx: number;
  resultado: "aprovado" | "reprovado";
  tolerancia: string;
};

export type SistemasIsolados = {
  ciclo: string;
  ciclos: CicloPasi[];
  por_uf: ({ uf: string; nome: string | null; localidades: number } & PopulacaoAgregada)[];
  por_distribuidora: ({ distribuidora: string; localidades: number } & PopulacaoAgregada)[];
  localidades_mais_populosas: LocalidadeIsolada[];
  /** Todas as localidades do ciclo, sob demanda: { ciclo, campos, localidades: listas na ordem de `campos` }. */
  pontos_json: string;
  conferencia_pdf: ConferenciaCaderno | null;
  /** "Comprove este número" da população do ciclo mais recente (soma das informadas; reconciliada com o caderno em PDF). */
  evidencia_populacao: Evidencia | null;
  proveniencia: Proveniencia;
};

export type ProgramaLpt = "rural" | "regioes_remotas" | "recurso_distribuidora";

export type LuzParaTodos = {
  /** Último mês de atendimento no arquivo do MME. */
  ultimo_mes: string;
  ano_parcial: string;
  programas: { id: ProgramaLpt; rotulo: string }[];
  /** Domicílios atendidos por ano do atendimento; null = nenhuma linha do programa no ano; 0 = linhas com quantidade zero na fonte. */
  serie_anual: ({ ano: string; total: number; parcial: boolean } & Record<ProgramaLpt, number | null>)[];
  por_uf: ({ uf: string; nome: string | null; regiao: RegiaoId | null; total: number; desde_2023: number | null } & Record<ProgramaLpt, number | null>)[];
  municipios_mais_atendidos_desde_2023: { cod: string | null; municipio: string | null; uf: string; domicilios: number }[];
  municipios: {
    total: number;
    com_codigo_ibge: number;
    sem_codigo_ibge: number;
    domicilios_sem_codigo: number;
    maiores_sem_codigo: { uf: string; municipio: string | null; domicilios: number }[];
  };
  /** R$ correntes por UF e fonte; contratado e pago nunca se somam. */
  recursos_por_uf: ({ uf: string; nome: string | null; contratos: number } & Record<string, number | string | null>)[];
  diagnostico: {
    linhas: number;
    linhas_usadas: number;
    quantidade_invalida: number;
    data_invalida: number;
    estado_desconhecido: Record<string, number>;
    programa_desconhecido: Record<string, number>;
    cabecalho_faltando: string[];
    domicilios: number;
    homologacao_mais_recente: string | null;
  } | Record<string, never>;
  evidencia_total: Evidencia;
  proveniencia: Proveniencia;
};

export type Universalizacao = {
  luz_para_todos: LuzParaTodos | null;
  /** Valores anuais da CDE para o programa (custeio; grandeza diferente dos recursos por contrato). */
  luz_para_todos_cde: { ano: string; valor_reais: number | null }[];
  ccc_cde: { ano: string; valor_reais: number | null }[];
  ano_corrente_orcado: string | null;
  limitacao: string;
  fontes_tentadas: string[];
};

export type Acesso = {
  pergunta: string;
  ano_referencia: string;
  /** Brasil e regiões em todos os anos; UF no primeiro e no último ano (série inteira no CSV). */
  pnad_serie: LinhaPnad[];
  /** Último ano: urbana e rural para Brasil e regiões; só rural para as UF. */
  pnad_situacao: LinhaPnad[];
  evidencia_sem_energia: Evidencia | null;
  sistemas_isolados: SistemasIsolados | null;
  universalizacao: Universalizacao;
  proveniencia: { pnad: Proveniencia; isolados?: Proveniencia; luz_para_todos?: Proveniencia };
};

/* ---------------------------------------------------------------- gold */

export type InclusaoGold = Cabecalho & {
  referencias: {
    scs_mes_referencia: string;
    scs_ultimo_mes_no_arquivo: string;
    cde_mes_mapa: string | null;
    cde_mes_conferencia: string | null;
    cde_mes_mais_recente: string | null;
  };
  tarifa_social: TarifaSocial;
  cobertura: Cobertura;
  orcamento: Orcamento;
  acesso: Acesso;
  validacao: { executada_em: string; criticos: string[]; ressalvas: string[] };
  downloads: Download[];
};

