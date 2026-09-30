/**
 * Tipos da gold do módulo Transição e ambiente (public/energia/gold/transicao.json),
 * espelho exato do que pipeline/energia/modulos/transicao.py publica (painéis P063 e P064).
 *
 * Três grandezas que não se misturam:
 * - capacidade de MMGD cadastrada na ANEEL (unidades, kW e MW): não é energia gerada;
 * - energia de MMGD estimada pelo ONS (MWmed): estimativa operacional, só SIN;
 * - fatores de emissão do MCTI (tCO2/MWh, só CO2): fator médio e fatores de margem do
 *   MDL em séries separadas.
 * Ausência é null e é exibida como ausência. Nenhum número é recalculado na interface.
 */
import type { Cabecalho, Download, Natureza, Proveniencia } from "./tipos";

/* ---------- Evidência ("Comprove este número") ---------- */

/**
 * Espelho do objeto montado por pipeline/energia/evidencia.py (`construir`, campos na
 * ordem de `CAMPOS`). Quando src/lib/energia/evidencia.ts existir com o tipo
 * `Evidencia`, este tipo deve ser equivalente a ele.
 */
export type ArquivoEvidenciaTransicao = {
  recurso: string | null;
  arquivo: string | null;
  sha256: string | null;
  capturado_em: string | null;
  publicado_em: string | null;
};

export type FonteEvidenciaTransicao = {
  orgao: string;
  conjunto: string;
  recurso: string | null;
  url: string;
  /** Caminho da cópia no bronze (ou nome do arquivo publicado pela fonte). */
  arquivo: string | null;
  sha256: string | null;
  capturado_em: string | null;
  /** Data informada pela fonte; null quando a fonte não informa (nunca inventada). */
  publicado_em: string | null;
  /** Número que usa mais de um arquivo (ex.: um arquivo por submercado do ONS). */
  arquivos?: ArquivoEvidenciaTransicao[];
};

export type TesteEvidencia = { nome: string; resultado: "aprovado" | "ressalva" | "reprovado"; detalhe: string };

export type EvidenciaTransicao = {
  indicador: string;
  /** Texto exibido (formato brasileiro); "sem dado" quando valor_calculo é null. */
  valor_exibido: string;
  /** Valor antes do arredondamento. */
  valor_calculo: number | null;
  unidade: string;
  periodo: { inicio: string; fim: string };
  entidade: string;
  universo: string;
  filtros: string[];
  fonte: FonteEvidenciaTransicao;
  extracao_pdf: { documento: string; edicao: string; pagina: string; conferencia: string } | null;
  chaves_origem: string[];
  chaves_total: number | null;
  consulta: string | null;
  manifesto: { rotulo: string; url: string } | null;
  formula: string;
  numerador: { descricao: string; valor: number | null } | null;
  denominador: { descricao: string; valor: number | null } | null;
  pesos: string | null;
  exclusoes: string[];
  cobertura: string;
  tratamento_ausencia: string;
  versao: { pipeline: string; codigo: string | null; publicacao: string };
  revisoes: string;
  testes: TesteEvidencia[];
  reconciliacao: { descricao: string; resultado: "aprovado" | "ressalva" | "reprovado"; tolerancia: string } | null;
  download: Download[];
  reproducao: string;
  citacao: string;
};

/* ---------- MMGD (ANEEL) ---------- */

export type FonteMmgd = "solar" | "termica" | "hidraulica" | "eolica" | "outra" | "nao_informada";

export type MmgdResumo = {
  unidades: number;
  potencia_mw: number;
  potencia_kw: number;
  municipios_com_mmgd: number;
  municipios_no_cadastro_ibge: number;
  /** Soma de QtdUCRecebeCredito: unidades consumidoras que recebem créditos. */
  ucs_recebem_credito: number;
  participacao_solar_potencia_pct: number | null;
  populacao_brasil: number | null;
  w_por_habitante_brasil: number | null;
  /** Registros com data sentinela: no estoque, sem ano de conexão. */
  unidades_sem_data: number;
  potencia_mw_ano_referencia: number | null;
  unidades_ano_referencia: number | null;
};

export type MmgdFonte = {
  fonte: FonteMmgd;
  rotulo: string;
  unidades: number;
  potencia_mw: number;
  participacao_potencia_pct: number | null;
};

export type MmgdFonteDetalhe = { tipo: string; descricao: string; unidades: number; potencia_kw: number };

export type MmgdAno = {
  ano: number;
  unidades: number;
  potencia_mw: number;
  por_fonte: Partial<Record<FonteMmgd, { unidades: number; potencia_mw: number }>>;
  acumulado_unidades: number;
  acumulado_mw: number;
  /** Ano da data do cadastro (ou posterior): incompleto, fora de comparação. */
  parcial: boolean;
};

export type MmgdMes = {
  m: string;
  unidades: number;
  potencia_mw: number;
  acumulado_mw: number;
  /** Mês posterior a `corte_provisorio`: registro tardio ainda esperado. */
  provisorio: boolean;
};

export type MmgdUf = {
  uf: string;
  nome: string;
  unidades: number;
  potencia_mw: number;
  participacao_potencia_pct: number | null;
  populacao: number | null;
  w_por_habitante: number | null;
  unidades_por_mil_habitantes: number | null;
  potencia_mw_ano_referencia: number;
  crescimento_estoque_ano_referencia_pct: number | null;
  ucs_recebem_credito: number;
};

export type MmgdUfAno = { uf: string; ano: number; unidades: number; potencia_mw: number };

export type MmgdDistribuidora = {
  /** Chave canônica (14 dígitos). */
  cnpj: string;
  sigla: string | null;
  nome: string | null;
  siglas_publicadas: string[];
  unidades: number;
  potencia_mw: number;
  unidades_ano_referencia: number;
  potencia_mw_ano_referencia: number;
  municipios: number;
  uf_principal: string;
  unidades_fora_uf_principal: number;
  ufs: { uf: string; unidades: number }[];
};

export type MmgdPerfilLinha = {
  categoria: string;
  unidades: number;
  potencia_mw: number;
  participacao_unidades_pct: number;
  unidades_ano_referencia: number;
  potencia_mw_ano_referencia: number;
};

export type MmgdMunicipioCurto = {
  ibge: string;
  nome: string | null;
  uf: string | null;
  unidades: number;
  potencia_kw: number;
  populacao: number | null;
  w_por_habitante: number | null;
  potencia_kw_ano_referencia: number;
  crescimento_estoque_pct: number | null;
};

export type MmgdControles = {
  linhas_do_arquivo: number;
  codigos_distintos: number;
  codigos_repetidos: number;
  identidade_agregacao: { unidades: number; diferenca_kw_municipio_uf: number; resultado: string };
  datas_sentinela: number;
  datas_ausentes: number;
  potencia_sem_data_kw: number;
  anteriores_cobertura_declarada: number;
  datas_posteriores_ao_conjunto: number;
  potencia_zero: number;
  potencia_ausente: number;
  potencia_negativa: number;
  fonte_nao_informada: number;
  municipio_codigo_6_digitos_completado: number;
  municipio_fora_cadastro_ibge: number;
  municipio_invalido: number;
  uf_publicada_ausente: number;
  uf_publicada_diverge_do_municipio: number;
  uf_do_codigo_empreendimento_diverge: number;
  sigla_distribuidora_ausente: number;
  duplicidade_candidata: {
    grupos: number;
    linhas_extras: number;
    potencia_kw_extras: number | null;
    maior_grupo: number;
    participacao_unidades_pct: number | null;
    tratamento: string;
  };
  data_de_conexao: {
    ufv_na_relacao: number | null;
    pareados_por_codigo: number | null;
    datas_iguais: number | null;
    potencias_iguais: number | null;
    resultado: "aprovada" | "pendente" | "sem captura do recurso técnico";
    descricao: string;
  };
};

export type MmgdRevisoes = {
  capturas_comparadas: number;
  primeira_captura?: string;
  ultima_captura?: string;
  nota?: string;
  meses: {
    m: string;
    unidades_primeira: number;
    unidades_ultima: number;
    potencia_mw_primeira: number;
    potencia_mw_ultima: number;
  }[];
};

export type BlocoMmgd = {
  /** Data de geração do arquivo da ANEEL (DatGeracaoConjuntoDados). */
  data_cadastro: string;
  /** Último ano completo antes da data do cadastro. */
  ano_referencia: number;
  ano_populacao: number | null;
  resumo: MmgdResumo;
  evidencias: { unidades: EvidenciaTransicao; potencia: EvidenciaTransicao };
  fontes: MmgdFonte[];
  fontes_detalhe: MmgdFonteDetalhe[];
  anual: MmgdAno[];
  mensal: MmgdMes[];
  corte_provisorio: string;
  ufs: MmgdUf[];
  uf_anual: MmgdUfAno[];
  distribuidoras: MmgdDistribuidora[];
  perfis: { classe: MmgdPerfilLinha[]; modalidade: MmgdPerfilLinha[]; porte: MmgdPerfilLinha[]; tipo_consumidor: MmgdPerfilLinha[] };
  municipios_destaque: {
    maior_potencia: MmgdMunicipioCurto[];
    maior_w_por_habitante: MmgdMunicipioCurto[];
    menor_w_por_habitante: MmgdMunicipioCurto[];
    maior_crescimento_estoque: MmgdMunicipioCurto[];
    populacao_minima_ranking: number;
  };
  distribuicao_municipal: {
    quantis_w_por_habitante: { p10: number | null; p25: number | null; p50: number | null; p75: number | null; p90: number | null };
    municipios_com_populacao: number;
    municipios_sem_mmgd: number;
    municipios_no_cadastro_ibge: number;
  };
  controles: MmgdControles;
  revisoes: MmgdRevisoes;
  proveniencia: { cadastro: Proveniencia; por_habitante: Proveniencia };
};

/** public/energia/series/transicao_municipios.json (carregado sob demanda pelo mapa). */
export type MunicipiosMmgdArquivo = {
  gerado_em: string;
  data_cadastro: string;
  ano_referencia: number;
  ano_populacao: number | null;
  campos: [
    "ibge", "nome", "uf", "unidades", "potencia_kw", "populacao", "w_por_habitante", "unidades_por_mil_habitantes",
    "unidades_ano_referencia", "potencia_kw_ano_referencia", "potencia_kw_estoque_ano_anterior", "crescimento_estoque_pct",
    "fonte_principal",
  ];
  linhas: [
    string, string | null, string | null, number, number, number | null, number | null, number | null,
    number, number, number, number | null, FonteMmgd | null,
  ][];
};

/* ---------- MMGD estimada pelo ONS ---------- */

export type OnsMmgdMes = {
  m: string;
  dias_no_mes: number;
  /** MWmed de MMGD estimada por submercado e no SIN; null quando não há dia completo. */
  SE: number | null;
  S: number | null;
  NE: number | null;
  N: number | null;
  SIN: number | null;
  dias_completos_sin: number;
  completo: boolean;
  participacao_carga_global_sin_pct: number | null;
  carga_global_sin_mwmed: number | null;
  /** Capacidade cadastrada na ANEEL (Brasil): média do estoque no início e no fim do mês. */
  capacidade_aneel_mw: number | null;
  /** Mês posterior ao corte provisório do cadastro: o estoque ainda cresce com registro tardio. */
  capacidade_aneel_provisoria: boolean;
  /**
   * 100 × MWmed estimado (SIN) ÷ capacidade cadastrada; só em mês completo do ONS e não
   * provisório no cadastro (null nos demais). Não é fator de capacidade.
   */
  razao_estimativa_ons_capacidade_pct: number | null;
};

export type OnsMmgdAno = {
  ano: number;
  mmgd_sin_mwmed: number | null;
  mmgd_sin_twh: number | null;
  participacao_carga_global_pct: number | null;
  dias_completos: number;
  completo: boolean;
};

export type DocumentoFonte = { orgao: string; titulo: string; url: string; consultado_em: string; trecho: string };

export type ConferenciaQuebra2023 = {
  janela: { inicio: string; fim: string };
  dias: { d: string; solar_balanco_sin_mwmed: number | null; mmgd_ons_sin_mwmed: number | null }[];
  degrau_solar_mwmed: number | null;
  mmgd_ons_no_dia_mwmed: number | null;
  solar_media_7d_antes: number | null;
  solar_media_depois: number | null;
  diferenca_medias_solar: number | null;
  mmgd_ons_media_depois: number | null;
  documento: DocumentoFonte;
  leitura: string;
};

export type BlocoOnsMmgd = {
  inicio_serie: string;
  fim_serie: string;
  ultimo_mes_completo: OnsMmgdMes | null;
  mensal: OnsMmgdMes[];
  anual: OnsMmgdAno[];
  conferencia_quebra_2023: ConferenciaQuebra2023;
  documentos: DocumentoFonte[];
  proveniencia: { estimativa: Proveniencia; razao: Proveniencia };
  /** Último mês completo no SIN; null quando nenhum mês está completo. */
  evidencia: EvidenciaTransicao | null;
};

/* ---------- Emissões (MCTI) ---------- */

export type FatorMes = { m: string; valor: number };
export type FatorAno = { ano: number; valor: number };

export type QuebraMcti = {
  data: string;
  origem: "FONTE";
  series: string[];
  descricao: string;
  documento: DocumentoFonte;
  /** A mesma quebra vista no dado da fonte (energia despachada do método simples ajustado). */
  no_dado?: { descricao: string; energia_2024_mwh: number; energia_2025_mwh: number; variacao_pct: number };
};

export type BlocoEmissoes = {
  unidade: "tCO2/MWh";
  gas: string;
  /** Fator médio para inventários: não é fator marginal. */
  medio_mensal: FatorMes[];
  medio_anual: FatorAno[];
  /** Fatores do MDL: uso exclusivo em projetos de MDL. */
  margem_operacao_despacho_mensal: FatorMes[];
  margem_construcao_anual: FatorAno[];
  margem_operacao_simples_ajustado_anual: FatorAno[];
  energia_despachada_mwh: { ano: number; mwh: number }[];
  ultimo_ano: { ano: number; valor: number; arquivo: string } | null;
  ultimo_mes: { m: string; valor: number; arquivo: string } | null;
  quebras: QuebraMcti[];
  /** Controle de leitura: anual publicado × média simples dos 12 meses (tolerância 0,0001). */
  anual_x_media_mensal: {
    ano: number;
    anual_publicado: number;
    media_simples_meses: number;
    diferenca: number;
    dentro_da_tolerancia: boolean;
  }[];
  revisoes_declaradas_pela_fonte: {
    serie: "margem_operacao_mensal" | "margem_construcao";
    periodo: string;
    anterior: number;
    atual: number | null;
    arquivo: string;
  }[];
  /** Mesmo período com valor diferente na página vigente e no site institucional anterior. */
  divergencias_entre_publicacoes: {
    serie: string;
    rotulo: string;
    periodo: string;
    valor_vigente: number;
    arquivo_vigente: string;
    valor_site_anterior: number;
    arquivo_site_anterior: string;
  }[];
  /** Arquivos da mesma origem com valores diferentes para o mesmo período (vale o mais recente). */
  conflitos_entre_arquivos: {
    serie: string;
    rotulo: string;
    periodo: string;
    familia: "atual" | "seed" | "antigo";
    valores: { recurso: string; valor: number }[];
    recurso_vigente: string;
  }[];
  notas_da_fonte: { texto: string; arquivo: string }[];
  notas_margem_construcao: { texto: string; arquivo: string }[];
  descartes: { data: string; valor: number; motivo: string; arquivo: string }[];
  problemas_de_leitura: { texto: string; arquivo: string }[];
  consistencia_diaria_mensal: {
    meses_comparados: number;
    maior_diferenca_absoluta: number | null;
    mes_da_maior_diferenca: string | null;
    descricao: string;
  };
  acesso: {
    url: string;
    situacao: "acessivel" | "bloqueada" | null;
    tentado_em: string | null;
    detalhe: string | null;
    ultimo_acesso_ok: string | null;
    bloqueios_registrados: { tentado_em: string; detalhe: string }[];
    /** Origens dos valores publicados: "atual" (página vigente), "seed" (captura depositada), "antigo" (site anterior). */
    familias_usadas: ("atual" | "seed" | "antigo")[];
    alternativa: string;
    capturas_depositadas: number;
  };
  /** Planilhas visíveis na página vigente do MCTI, com o título da linha (anota correções). */
  pagina_vigente: {
    url: string;
    listagem_capturada_em: string | null;
    planilhas: { titulo: string | null; arquivo: string; url: string }[];
    links_ocultos_ignorados: string[];
  } | null;
  arquivos: string[];
  /** Trechos da fonte que definem o uso de cada fator e a quebra de 2025. */
  documentos: DocumentoFonte[];
  estimativa_propria: { publicada: boolean; motivo: string };
  proveniencia: { medio: Proveniencia; mdl: Proveniencia };
  /** Fator médio anual do último ano completo. */
  evidencia: EvidenciaTransicao | null;
  /** Fator médio mensal do último mês publicado. */
  evidencia_mensal: EvidenciaTransicao | null;
};

/* ---------- Gold ---------- */

export type RegrasTransicao = {
  capacidade_nao_e_energia: string;
  cadastro_x_estimativa: string;
  ano_de_conexao: string;
  provisorio: string;
  ano_referencia: string;
  por_habitante: string;
  fator_medio_nao_marginal: string;
  co2_nao_co2e: string;
  sem_intensidade_local: string;
};

export type GoldTransicao = Cabecalho & {
  paineis: ["P063", "P064"];
  /** Blocos ausentes nesta publicação (vazio quando tudo foi montado). */
  pendencias: string[];
  regras: RegrasTransicao;
  mmgd: BlocoMmgd;
  ons_mmgd: BlocoOnsMmgd | null;
  emissoes: BlocoEmissoes | null;
  downloads: Download[];
  /** Caminho do JSON municipal (MunicipiosMmgdArquivo). */
  mapa_municipios: string;
};

/** Natureza de cada bloco, para o selo do painel. */
export const NATUREZA_BLOCO: Record<"cadastro" | "por_habitante" | "estimativa_ons" | "razao" | "fator_mcti", Natureza> = {
  cadastro: "OBSERVADO",
  por_habitante: "CALCULADO",
  estimativa_ons: "ESTIMADO",
  razao: "CALCULADO",
  fator_mcti: "OBSERVADO",
};
