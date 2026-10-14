/**
 * Contratos da gold do Observatório Brasileiro do Saneamento
 * (pipeline/observatorio_saneamento/gold.py → public/saneamento/gold/).
 *
 * Convenção de estados: número (zero incluído) é valor; null é ausência; o
 * motivo da ausência, quando a fonte o publica, vem em `motivos`. Nas fichas
 * por UF, chave ausente equivale a null (o pipeline remove nulos para reduzir
 * o arquivo).
 */

export type SituacaoAgua = "participou" | "nao_participou";
export type SituacaoEsgoto = "participou" | "delegacao_sem_atendimento" | "informacoes_sem_indicadores" | "nao_participou";

/** Linha da tabela municipal compacta (municipios.json). */
export type Municipio = {
  id: string;
  nome: string;
  uf: string;
  regiao: string;
  pop22: number | null;
  pop24: number | null;
  dfe0001: number | null;
  c22_ag_rede: number | null;
  c22_ag_lig_outra: number | null;
  c22_ag_sem: number | null;
  c22_es_rede: number | null;
  c22_es_rede_pluvial: number | null;
  c22_es_septica: number | null;
  c22_es_precario: number | null;
  c22_es_sem_banheiro: number | null;
  c10_mor: number | null;
  c10_ag_rede: number | null;
  c10_es_rede: number | null;
  s_ag: SituacaoAgua;
  s_es: SituacaoEsgoto;
  ag_pop_at: number | null;
  IAG0001: number | null;
  IAG2013: number | null;
  IAG3004: number | null;
  ag_paralisacoes: number | null;
  ag_interrupcoes: number | null;
  es_pop_at: number | null;
  IES0001: number | null;
  IES0004: number | null;
  IES0007: number | null;
  IES2003: number | null;
  IES2004: number | null;
  dom_est24: number | null;
  nr8_ag_num: number | null;
  iaa_rede: number | null;
  nr8_es_num: number | null;
  iae_rede: number | null;
  inv_ag: number | null;
  inv_es: number | null;
  n_prest_ag: number;
  n_prest_es: number;
  nat_ag: string | null;
  nat_es: string | null;
  gm_respondeu: string | null;
  plano: string | null;
  plano_ano: number | null;
  reg_ag: string | null;
  reg_es: string | null;
  /** Tarifa social de água declarada ao SINISA 2024: oferece, nao_oferece ou null (sem resposta). */
  ts_estado: "oferece" | "nao_oferece" | null;
  /** Economias residenciais com tarifa social (GFI1036, soma dos prestadores de água); 0 quando não oferece. */
  ts_economias: number | null;
  /** CadÚnico: famílias com renda per capita até meio salário-mínimo, dez/2024 e mês mais recente. */
  cad_fam_ms: number | null;
  cad_fam_ms_atual: number | null;
};

export type CampoMunicipio = keyof Municipio;

export type TabelaMunicipios = {
  campos: CampoMunicipio[];
  rotulos: Record<string, string>;
  linhas: unknown[][];
};

export type BlocoAgua2022 = {
  rede: number | null;
  lig_outra: number | null;
  sem_ligacao: number | null;
  total: number | null;
  sem_ligacao_fontes: Record<"poco_profundo" | "poco_raso" | "nascente" | "carro_pipa" | "chuva" | "rio" | "outra", number | null>;
};
export type BlocoEsgoto2022 = Record<
  "total" | "rede" | "rede_pluvial" | "fossa_ligada" | "septica" | "rudimentar" | "vala" | "corpo_dagua" | "outra" | "sem_banheiro" | "sem_rede_nem_septica",
  number | null
>;
export type Censo2022 = { agua: BlocoAgua2022; esgoto: BlocoEsgoto2022 };
export type Censo2010 = { moradores: number | null; agua_rede: number | null; esgoto_moradores: number | null; esgoto_rede_pluvial: number | null };

export type Investimento = {
  total?: number;
  estado_informado?: boolean;
  prestador?: number;
  estado?: number;
  prestador_fontes?: Partial<Record<"proprios" | "onerosos" | "nao_onerosos", number>>;
  estado_fontes?: Partial<Record<"proprios" | "onerosos" | "nao_onerosos", number>>;
  prestador_destino?: Record<string, number>;
  estado_destino?: Record<string, number>;
};

export type VinculoPrestador = {
  servico: "agua" | "esgoto";
  prestador: string;
  area?: string;
  forma?: string;
  atividades?: string;
  instrumento?: string;
  inicio?: string;
  termino?: string;
  populacao_atendida?: number;
  indicadores?: Record<string, number>;
  motivos?: Record<string, string>;
  investimento?: Investimento;
  tarifa?: Record<string, string | number>;
  cobranca?: Record<string, string>;
};

export type Regulador = { existe?: string; cnpj?: string; nome?: string; sigla?: string; abrangencia?: string };
export type PrestadorDeclarado = { existe?: string; cnpj?: string; natureza?: string; nome?: string; sigla?: string; servicos?: string };

export type GestaoMunicipal = {
  respondeu: string;
  linha: number;
  domicilios_ogm4006?: number;
  politica?: { existe?: string; data?: string };
  plano?: {
    existe?: string;
    instrumento?: string;
    numero?: string | number;
    data?: string;
    componentes?: string;
    conteudo?: string;
    area?: string;
    link?: string;
    em_elaboracao?: string;
  };
  evtef?: { existe?: string; componentes?: string };
  conselho?: { especifico?: string; afim?: string };
  consorcio?: { participa?: string; nome?: string; sigla?: string };
  ouvidoria?: string;
  regulacao_declarada?: { agua?: string; esgoto?: string };
  reguladores?: { agua: Regulador[]; esgoto: Regulador[] };
  prestadores?: { agua: PrestadorDeclarado[]; esgoto: PrestadorDeclarado[] };
  solucoes_alternativas?: Record<string, { usa?: string; populacao?: number; domicilios?: number; domicilios_sem_rede?: number }>;
};

export type Ete = {
  codigo?: string;
  nome?: string;
  em_operacao?: string;
  nivel?: string;
  capacidade_nominal_ls?: number;
  volume_tratado_mil_m3?: number;
  utilizacao_pct?: number;
  eficiencia_dbo_pct?: number;
};

export type CadunicoMes = {
  familias_ate_meio_sm: number | null;
  familias_atualizadas_ate_meio_sm: number | null;
  pessoas_ate_meio_sm: number | null;
  familias_cadastradas: number | null;
};

export type TarifaSocialMunicipio = {
  estado: "oferece" | "nao_oferece" | null;
  economias: number | null;
  cadunico: Record<string, CadunicoMes>;
};

export type FichaMunicipio = {
  id: string;
  nome: string;
  uf: string;
  regiao: string;
  censo2022?: { moradores?: Censo2022; domicilios?: Censo2022 };
  censo2010?: Censo2010;
  pop24?: number;
  sinisa: {
    agua: {
      situacao: SituacaoAgua;
      dfe0001?: number;
      linha?: { tecnica?: number; indicadores?: number };
      indicadores?: Record<string, number>;
      motivos?: Record<string, string>;
      tecnica?: Record<string, number>;
      motivo_interrupcoes?: string;
      investimento?: Investimento;
    };
    esgoto: {
      situacao: SituacaoEsgoto;
      dfe0001?: number;
      linha?: { tecnica?: number; indicadores?: number };
      indicadores?: Record<string, number>;
      motivos?: Record<string, string>;
      tecnica?: Record<string, number>;
      investimento?: Investimento;
      etes?: Ete[];
    };
    prestadores?: VinculoPrestador[];
  };
  gestao_municipal?: GestaoMunicipal;
  tarifa_social?: TarifaSocialMunicipio;
};

export type Agregado = {
  id: string;
  nome: string;
  tipo: "Brasil" | "Região" | "UF";
  censo2022: { moradores: Censo2022 | null; domicilios: Censo2022 | null };
  censo2010: Censo2010 | null;
  pop24: number | null;
  municipios: number;
  factiveis: Record<"agua" | "esgoto", { imoveis: number | null; municipios_informantes: number }>;
  continuidade: {
    municipios_participantes: number;
    paralisacoes: number | null;
    municipios_informaram_paralisacoes: number;
    economias_atingidas_paralisacoes: number | null;
    horas_paralisacoes: number | null;
    interrupcoes_sistematicas: number | null;
    municipios_informaram_interrupcoes: number;
    municipios_com_interrupcoes: number;
    economias_atingidas_interrupcoes: number | null;
    horas_interrupcoes: number | null;
    dias_colapso: number | null;
    municipios_informaram_colapso: number;
    municipios_com_colapso: number;
    motivos_interrupcoes: Record<string, number>;
  };
  gestao: {
    respondentes: number;
    nao_respondentes: number;
    plano_sim: number;
    plano_nao: number;
    plano_em_elaboracao: number;
    plano_com_link: number;
    plano_anos: Record<string, number>;
    plano_sem_ano: number;
    politica_sim: number;
    regulacao_agua_sim: number;
    regulacao_esgoto_sim: number;
    conselho_especifico_sim: number;
    ouvidoria_sim: number;
    consorcio_sim: number;
  };
  tarifa_social: {
    municipios_oferece: number;
    municipios_nao_oferece: number;
    municipios_sem_resposta: number;
    economias: number | null;
    familias_mesmo_universo: number | null;
    municipios_mesmo_universo: number;
  };
  /** Famílias do CadÚnico com renda per capita até meio salário-mínimo, por mês (aaaamm). */
  cadunico: Record<string, number | null>;
  cobertura_sinisa: {
    agua_participantes: number;
    esgoto_participantes: number;
    esgoto_delegacao_sem_atendimento: number;
    agua_dfe0001: number | null;
    esgoto_dfe0001: number | null;
  };
  sinisa: {
    agua: { indicadores: Record<string, number | null>; pop_atendida: number | null; investimento: Investimento | null; linha_indicadores: number | null };
    esgoto: { indicadores: Record<string, number | null>; pop_atendida: number | null; investimento: Investimento | null; linha_indicadores: number | null };
  };
};

export type BalancoPrestador = {
  planilha: "agua" | "esgoto";
  tipo_servico: string | null;
  ativo_total: number | null;
  patrimonio_liquido: number | null;
  passivo_circulante: number | null;
  passivo_nao_circulante: number | null;
  receita_bruta: number | null;
  receita_liquida: number | null;
  resultado_operacional_com_depreciacao: number | null;
  lucro_liquido_com_depreciacao: number | null;
  linha: number;
};

export type Prestador = {
  id: string;
  nome: string | null;
  sigla: string | null;
  natureza: string | null;
  abrangencia: string | null;
  ufs: string[];
  municipios_agua: string[];
  municipios_esgoto: string[];
  populacao_atendida_agua: number | null;
  populacao_atendida_esgoto: number | null;
  ligacoes_agua: number | null;
  ligacoes_esgoto: number | null;
  volumes_mil_m3: Record<string, number | null>;
  perdas_distribuicao_pct: number | null;
  receita_direta_usuarios_agua: number | null;
  despesa_exploracao_agua: number | null;
  receita_por_m3_faturado_agua: number | null;
  investimento_agua: number | null;
  investimento_esgoto: number | null;
  investimento_agua_prestador: number | null;
  investimento_esgoto_prestador: number | null;
  pessoal_agua: number | null;
  balanco: BalancoPrestador[];
  etes: number;
};

export type ReguladorCatalogo = {
  cnpj: string;
  nome: string;
  sigla: string | null;
  abrangencia: string | null;
  variantes_nome: string[];
  ufs: string[];
  municipios_agua: string[];
  municipios_esgoto: string[];
};

export type EteCatalogo = Ete & { municipio: string; uf: string; prestador: string; corpo_receptor?: string | null; linha: number };

export type Conferencia = { id: string; descricao: string; valores: Record<string, number | null>; conclusao: string };

export type MetaSaneamento = {
  observatorio: string;
  gerado_de: string;
  sinisa: {
    edicao: string;
    ano_referencia: number;
    publicacao: string;
    retificacao_agua_municipal: string;
    capturado_em: string;
    pagina: string;
    zips: Record<string, { url: string; arquivo: string; sha256: string; bytes: number }>;
    planilhas: Record<string, { arquivo: string; zip: string; sha256: string; data_no_zip: string; aba: string; registros: number }>;
    gestao_municipal: { url: string; sha256: string; capturado_em: string };
  };
  censo: {
    capturado_em: string;
    tabelas: Record<string, { tabela: number; titulo: string; ano: number; consultas: number; sha256_consultas: string[] }>;
    populacao_2024: { tabela: number; ano: number };
    municipios: { url: string; sha256: string; total: number };
  };
  cadunico: {
    fonte: string;
    url: string;
    capturado_em: string;
    criterio: string;
    mes_referencia: string;
    mes_mais_recente: string;
    meses: Record<string, { url: string; sha256: string; registros: number }>;
  };
  metas: { agua: number; esgoto: number; data: string; base_legal: string };
  cobertura: {
    municipios_ibge: number;
    municipios_censo_2022: number;
    municipios_censo_2010: number;
    agua_participantes: number;
    esgoto_participantes: number;
    esgoto_delegacao_sem_atendimento: number;
    esgoto_informacoes_sem_indicadores: number;
    prestadores: number;
    etes: number;
    gestao_municipal_respondentes: number;
    reguladores_cnpj: number;
  };
  conferencias: Conferencia[];
};
