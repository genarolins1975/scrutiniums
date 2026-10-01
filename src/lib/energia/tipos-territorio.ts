/**
 * Tipos da gold do módulo Território (public/energia/gold/territorio.json) e dos arquivos
 * sob demanda do mapa (public/energia/series/territorio_municipios.json e
 * territorio_usinas.json), espelho exato do que pipeline/energia/modulos/territorio.py
 * publica (painel P002, mapa geográfico transversal).
 *
 * Regra que estes tipos carregam: nenhum indicador é atribuído a um grão inferior ao de
 * origem. Indicador de distribuidora fica em `distribuidoras[].indicadores`, de submercado
 * em `submercados[].indicadores`, de conjunto em `ConjuntosTerritorio`, de município nas
 * colunas municipais e de usina no arquivo de usinas. O município guarda REFERÊNCIAS
 * (índice da distribuidora, ids de conjunto, código do submercado, CEG de usina), nunca
 * uma cópia do valor delas. Ausência é null (ou `disponivel: false` com motivo) e é
 * exibida como ausência. Nenhum número é recalculado na interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Natureza, Periodo, Proveniencia, Submercado } from "./tipos";

/* ---------- grãos, camadas e compatibilidade ---------- */

export type IdGraoTerritorio = "submercado" | "uf" | "distribuidora" | "conjunto" | "municipio" | "usina";

export type GraoTerritorio = {
  id: IdGraoTerritorio;
  rotulo: string;
  /** 6 = mais amplo (submercado), 1 = mais fino (usina); só ordena a explicação. */
  nivel: number;
  descricao: string;
  geometria: string;
  /** Como o valor deste grão é rotulado quando aparece no painel de um município. */
  rotulo_no_municipio: string;
};

export type IdCamadaTerritorio = "submercado" | "distribuidora" | "municipio" | "usinas";

export type CamadaTerritorio = {
  id: IdCamadaTerritorio;
  grao: IdGraoTerritorio;
  rotulo: string;
  /** Caminho da malha usada (null: pontos, sem polígono). */
  geometria: string | null;
  agrupamento: string | null;
  descricao: string;
  carregamento: string;
  /** Arquivo sob demanda da camada. */
  arquivo?: string;
  /** Marca sobreposta à camada (ex.: municípios fora do SIN por cima da cor da UF). */
  sobreposicao?: { arquivo: string; campo: string; valor: string };
};

export type CompatibilidadeTerritorio = {
  de: IdGraoTerritorio;
  para: IdGraoTerritorio;
  /** false: a seleção não passa de uma camada para a outra (e a página diz por quê). */
  valida: boolean;
  regra: string;
  condicao: string | null;
};

export type LinkModulo = { rotulo: string; href: string };

export type IndicadorTerritorio = {
  id: string;
  rotulo: string;
  grao: IdGraoTerritorio;
  unidade: string;
  natureza: Natureza;
  modulo: string;
  /** Onde o valor está: tabela do grão na gold ou coluna do arquivo sob demanda. */
  campo: string;
  rotulo_grao: string;
  rotulo_no_municipio: string;
  pagina: LinkModulo;
  /** Id no catálogo de métricas (metricas.json); null quando a definição está só na proveniência. */
  metrica: string | null;
};

/* ---------- blocos de indicador ---------- */

/** Indicador presente: valores do bloco mais o período de referência. */
export type Disponivel<T> = { disponivel: true; periodo: { inicio: string | null; fim: string | null } } & T;
/** Indicador que a fonte não publica para a entidade (motivo exibido, nunca zero). */
export type Indisponivel = { disponivel: false; motivo: string };
export type Bloco<T> = Disponivel<T> | Indisponivel;

/* ---------- submercados ---------- */

export type ConferenciaSubmercado = {
  dia: string;
  /** Médias do dia (MWmed). */
  submercado_mwmed: number;
  soma_areas_mwmed: number;
  residuo_mwmed: number;
  /** Resíduo por meia hora: mediana do valor absoluto (comparada à tolerância) e máximo absoluto. */
  mediana_abs_mwmed: number;
  max_abs_mwmed: number;
  meias_horas: number;
  tolerancia_mwmed: number;
  areas: string[];
  area_perdas: string;
};

export type SubmercadoTerritorio = {
  sm: Submercado;
  nome: string;
  ufs: string[];
  ufs_com_area_sem_carga: string[];
  conferencia: ConferenciaSubmercado[];
  indicadores: {
    pld_dia: Bloco<{ valor: number | null }>;
    pld_mes: Bloco<{ valor: number | null; dias: number | null }>;
    ear: Bloco<{ pct: number | null; mwmes: number | null; max_mwmes: number | null }>;
    mmgd_ons: Bloco<{ mwmed: number | null }>;
  };
};

/* ---------- UFs ---------- */

export type EstadoSubmercadoUf = "provado" | "provado_com_area_sem_carga" | "nao_provado";
/**
 * No município, a localidade isolada sobrepõe o estado da UF: "fora_do_sin" (sede isolada ou
 * ao menos metade da população em localidades isoladas; submercado nulo, não se aplica) ou
 * "com_localidade_isolada" (submercado da UF com aviso).
 */
export type EstadoSubmercadoMunicipio = EstadoSubmercadoUf | "com_localidade_isolada" | "fora_do_sin";

export type AreaCargaUf = {
  codigo: string;
  nome: string;
  veredito: "provada" | "indeterminada" | "ambigua" | "reprovada";
  submercado_hipotese: Submercado | null;
};

export type UfTerritorio = {
  uf: string;
  codigo: string | null;
  nome: string | null;
  municipios: number;
  subsistema: Submercado | null;
  estado_subsistema: EstadoSubmercadoUf;
  areas_carga: AreaCargaUf[];
  municipios_com_localidade_isolada: number;
  municipios_fora_do_sin: number;
  indicadores: {
    capacidade: Bloco<{ usinas: number | null; mw_fiscalizado: number | null; por_origem_mw: Record<string, number> | null }>;
    tsee: Bloco<{ faturas: number | null; desconto_reais: number | null }>;
    isolados: Bloco<{ localidades: number | null; populacao: number | null }>;
  };
};

/* ---------- distribuidoras ---------- */

export type DistribuidoraTerritorio = {
  /** Índice usado pelas referências do arquivo municipal (`dist`). */
  i: number;
  cnpj: string;
  cnpj_formatado: string | null;
  sigla: string;
  nome: string | null;
  ativa: boolean | null;
  area: {
    municipios: number;
    confirmados: number;
    so_mmgd: number;
    nao_confirmados: number;
    exclusivos: number;
    compartilhados: number;
    ufs: string[];
    /** Municípios de vínculo 1 ou 2 fora do SIN (não entram em `submercados`). */
    fora_do_sin: number;
    com_localidade_isolada: number;
  };
  /** Só municípios de vínculo válido no SIN. */
  submercados: { sm: Submercado | null; municipios: number }[];
  /** Preenchido só quando todos os municípios válidos no SIN estão num único submercado provado. */
  submercado_unico: Submercado | null;
  /** true: há município da área fora do SIN (a seleção do submercado leva aviso). */
  parte_fora_do_sin: boolean;
  indicadores: {
    perdas: Bloco<{
      ano: number | null;
      meses: number | null;
      completo: boolean | null;
      /** Ano sem os 12 meses: taxa de ano parcial, não comparável (ressalva exibida). */
      parcial: boolean;
      taxa_total_pct: number | null;
      perdas_totais_mwh: number | null;
      injetada_mwh: number | null;
      pnt_bt_pct: number | null;
      alertas: string[];
      /** Ressalvas visíveis: ano parcial, taxa fora da faixa física de 0% a 100%. */
      ressalvas: string[];
    }>;
    qualidade: Bloco<{
      ano: number | null;
      meses: number | null;
      parcial: boolean;
      dec_h: number | null;
      fec: number | null;
      dec_limite_h: number | null;
      fec_limite: number | null;
      ucs: number | null;
      conjuntos: number | null;
    }>;
    tarifa: Bloco<{
      total_rs_mwh: number | null;
      te_rs_mwh: number | null;
      tusd_rs_mwh: number | null;
      ato: string | null;
      vigencia_inicio: string | null;
      vigencia_fim: string | null;
    }>;
    mmgd: Bloco<{ unidades: number | null; potencia_mw: number | null }>;
    tsee: Bloco<{ uc_tsee: number | null; uc_residencial: number | null; participacao_pct: number | null }>;
  };
};

/* ---------- resumo, áreas de carga, controles ---------- */

export type ResumoTerritorio = {
  municipios: number;
  municipios_com_distribuidora: number;
  municipios_compartilhados: number;
  municipios_so_vinculo_nao_confirmado: string[];
  municipios_sem_vinculo: { codigo: string; nome: string; uf: string }[];
  codigos_da_relacao_fora_da_malha: { codigo: string; valido: boolean | null; distribuidoras: string[] }[];
  municipios_por_estado_submercado: Partial<Record<EstadoSubmercadoMunicipio, number>>;
  municipios_com_conjunto: number;
  conjuntos_referenciados: number;
  conjuntos_com_valor: number;
  conjuntos_sem_valor_no_ano: number;
  municipios_com_mmgd_publicada: number;
  municipios_com_tsee_publicada: number;
  codigos_tsee_sem_municipio_unico: string[];
  municipios_com_lpt: number;
  lpt_ligados_por_nome_domicilios: Partial<Record<"nome_atual" | "grafia_antiga", number>>;
  lpt_sem_codigo_ibge: { uf: string; municipio: string; domicilios: number | null }[];
  municipios_com_localidade_isolada: number;
  municipios_fora_do_sin: {
    total: number;
    sede_isolada: number;
    so_pela_populacao: number;
    limiar_populacao: number;
    regra: string;
  };
  /** Municípios em que a relação do módulo Perdas e os conjuntos do módulo Qualidade listam distribuidoras diferentes. */
  distribuidoras_por_municipio_perdas_x_qualidade: { codigo: string; nome: string; uf: string; perdas: string[]; qualidade: string[] }[];
  localidades_isoladas_sem_municipio: { sigla: string; municipio: string; uf: string }[];
  usinas: {
    total: number;
    com_coordenada: number;
    todos_municipios_reconhecidos: number;
    parcialmente_reconhecidos: number;
    sem_municipio_reconhecido: number;
    via_grafia_antiga: number;
    multimunicipio: number;
    coordenada_no_municipio_declarado: number;
    coordenada_fora_do_municipio_declarado: number;
    coordenada_fora_da_malha: number;
    operacao_sem_potencia_fiscalizada: number;
    /** Registros do SIGA de até 10 kW em operação (coluna própria no município). */
    registros_ate_10kw: number;
    registros_ate_10kw_multimunicipio: number;
    limite_registro_kw: number;
    /** Comparação com a malha simplificada do mapa (null quando a conferência já usou a simplificada). */
    coordenada_fora_na_malha_simplificada: number | null;
    simplificada_fora_maxima_dentro: number | null;
    simplificada_dentro_maxima_fora: number | null;
    nomes_nao_reconhecidos: { uf: string | null; nome: string; citacoes: number }[];
    /** `origem` é a chave curta ("DTB 2010"); o texto completo está em `grafias_antigas_fontes`. */
    grafias_antigas: { uf: string; nome_fonte: string; codigo: string; origem: string }[];
    grafias_antigas_fontes: Record<string, string>;
    conferencia_coordenada: {
      conferencia: "maxima" | "simplificada";
      faltam: string[];
      arquivos: { uf: string; arquivo: string; sha256: string; capturado_em: string }[];
    };
  };
};

/** Alternativa de pertença testada (mover uma área ou trocar duas), com as duas estatísticas. */
export type AlternativaAreaCarga = {
  descricao: string;
  envolvidas: string[];
  /** Estatística da prova: maior mediana do resíduo absoluto por meia hora entre os submercados alterados. */
  mediana_abs_mwmed: number | null;
  /** Para comparação: maior resíduo absoluto pelas médias do dia. */
  residuo_medias_dia_mwmed: number | null;
};

export type ConferenciaAreasDia = {
  dia: string;
  completo: boolean;
  fecha: boolean | null;
  tolerancia_mwmed: number | null;
  /** Maior mediana do resíduo entre os submercados com a hipótese conferida. */
  ruido_mwmed: number | null;
  /** Maior resíduo absoluto pelas médias do dia, com a hipótese. */
  ruido_medias_dia_mwmed: number | null;
  /** Alternativa (mover ou trocar áreas) que mais se aproxima de fechar pela mediana por meia hora. */
  menor_alternativa: AlternativaAreaCarga | null;
  /** A que mais se aproxima de fechar pelo resíduo das médias do dia. */
  menor_alternativa_pelas_medias: AlternativaAreaCarga | null;
  alternativas_avaliadas: number | null;
  /** Alternativas que caberiam na tolerância se a prova usasse as médias do dia. */
  alternativas_que_fechariam_pelas_medias: string[];
  areas_ambiguas: string[];
  intervalos_incompletos: string[];
  areas_indeterminadas: string[];
  areas_reprovadas: string[];
  faltam: string[];
};

export type AreasCargaTerritorio = {
  fonte: { orgao: string; conjunto: string; url: string; dicionario: string; dicionario_versao: string; dicionario_sha256: string };
  regra: string;
  hipotese_de: string;
  dias: string[];
  conflitos_na_hipotese: string[];
  conferencias: ConferenciaAreasDia[];
  /** Camada 24 do WebMap da EPE: correspondência oficial UF → subsistema. */
  mapeamento_epe: Record<string, Submercado>;
  epe: {
    camada: string;
    url_consulta: string;
    arquivo: string | null;
    sha256: string | null;
    capturado_em: string | null;
    ligacoes_pelo_nome: { UF_fonte: string; Nome_fonte: string; uf: string; via: string }[];
    sem_uf: { UF: string | null; Nome: string; subsistee: string | null }[];
    erro: string | null;
  } | null;
  mapeamento_agua: Record<string, Submercado>;
  mapeamento_carga: Record<string, Submercado>;
  download: string;
  download_alternativas: string;
};

export type ControleTerritorio = {
  nome: string;
  resultado: "aprovado" | "ressalva" | "reprovado";
  critico: boolean;
  detalhe: string;
};

export type InsumoTerritorio = {
  chave: string;
  modulo: string;
  arquivo: string;
  url: string;
  sha256: string;
  bytes: number;
  gerado_em: string | null;
};

export type BloqueioTerritorio = { item: string; tentativas: string[]; evidencia: string; dependencia: string };

/* ---------- gold ---------- */

export type GoldTerritorio = Cabecalho & {
  pergunta: string;
  data_referencia: string;
  referencias: {
    relacao_distribuidoras_ano: number | null;
    perdas_ano: number | null;
    qualidade_ano: number | null;
    tarifa_data: string | null;
    mmgd_data_cadastro: string | null;
    siga_data: string | null;
    tsee_mes_cde: string | null;
    cadunico_mes: string | null;
    lpt_periodo: Periodo | null;
    isolados_ciclo: string | null;
    pld_dia: string | null;
    ear_dia: string | null;
    areas_carga_dias: string[];
    populacao_ano: number | null;
    subsistema_uf_epe_capturado_em: string | null;
  };
  regra_granularidade: string;
  graos: GraoTerritorio[];
  camadas: CamadaTerritorio[];
  compatibilidade: CompatibilidadeTerritorio[];
  links: Record<"distribuidora" | "municipio" | "submercado" | "uf" | "usina", LinkModulo[]>;
  indicadores: IndicadorTerritorio[];
  submercados: SubmercadoTerritorio[];
  ufs: UfTerritorio[];
  distribuidoras: DistribuidoraTerritorio[];
  resumo: ResumoTerritorio;
  areas_carga: AreasCargaTerritorio;
  controles: ControleTerritorio[];
  ressalvas: string[];
  insumos: InsumoTerritorio[];
  limitacoes: string[];
  bloqueios: BloqueioTerritorio[];
  proveniencia: Partial<
    Record<
      | "indice"
      | "areas_carga"
      | "subsistema_uf"
      | "distribuidora_perdas"
      | "distribuidora_qualidade"
      | "conjuntos"
      | "distribuidora_tarifa"
      | "mmgd"
      | "mmgd_ons"
      | "populacao"
      | "tarifa_social"
      | "luz_para_todos"
      | "isolados"
      | "usinas"
      | "pld_dia"
      | "pld_mes"
      | "ear",
      Proveniencia
    >
  >;
  evidencias: Partial<Record<"municipios_compartilhados" | "municipios_com_submercado" | "usinas_municipio_reconhecido", Evidencia>>;
  downloads: Download[];
  series: { municipios: string; usinas: string };
  geometria: {
    municipios: string;
    uf: string;
    malha: { revisao: number; nota_liberacao: string; data_nota: string; documentacao: string; qualidade: string; formato_original: string } | null;
    fonte: string | null;
    capturado_em: string | null;
    sha256: string | null;
  };
  processamento_s: number;
};

/* ---------- arquivos sob demanda ---------- */

/** Estado do vínculo publicado pelo módulo Perdas: 1 confirmado, 0 sem confirmação, 2 só pelo cadastro de MMGD. */
export type EstadoVinculo = 0 | 1 | 2;

/** Colunas de `territorio_municipios.json`, na ordem de `campos`. */
export const CAMPOS_MUNICIPIO_TERRITORIO = [
  "ibge", "nome", "uf", "sm", "sm_estado", "dist", "conj", "usi_multi",
  "pop", "mmgd_un", "mmgd_kw", "mmgd_w_hab",
  "tsee_faturas", "tsee_desconto", "tsee_proxy_pct", "tsee_base_pequena",
  "lpt_dom",
  "usi_op_n", "usi_op_mw", "usi_cart_n", "usi_cart_mw",
  "usi_reg_n", "usi_reg_kw",
  "isol_n", "isol_pop", "isol_sede",
] as const;

export type LinhaMunicipioTerritorio = [
  ibge: string,
  nome: string,
  uf: string,
  /** null quando não provado ou quando o município está fora do SIN (sm_estado "fora_do_sin": não se aplica). */
  sm: Submercado | null,
  sm_estado: EstadoSubmercadoMunicipio | null,
  /** [índice em `distribuidoras` da gold, estado do vínculo] */
  dist: [number, EstadoVinculo][],
  /** Ids de conjunto elétrico (valores em `conjuntos.linhas`). */
  conj: number[],
  /** CEG das usinas declaradas neste e em outros municípios (potência não somada aqui). */
  usi_multi: string[],
  pop: number | null,
  mmgd_un: number | null,
  mmgd_kw: number | null,
  mmgd_w_hab: number | null,
  tsee_faturas: number | null,
  tsee_desconto: number | null,
  tsee_proxy_pct: number | null,
  tsee_base_pequena: number | null,
  lpt_dom: number | null,
  /** Usinas em operação declaradas só no município, sem os registros de até 10 kW. */
  usi_op_n: number,
  usi_op_mw: number,
  usi_cart_n: number,
  usi_cart_mw: number,
  /** Registros do SIGA de até 10 kW em operação declarados só no município (kW, não MW). */
  usi_reg_n: number,
  usi_reg_kw: number,
  isol_n: number,
  isol_pop: number | null,
  /** 1 = a sede é localidade isolada do PASI; 0 = há localidade isolada, mas não a sede; null = sem localidade isolada. */
  isol_sede: 0 | 1 | null,
];

/** Colunas de `conjuntos.linhas`: [nome, índice da distribuidora, ano, meses, DEC, FEC, limite DEC, limite FEC, UCs, municípios]. */
export type LinhaConjuntoTerritorio = [
  nome: string,
  dist: number | null,
  ano: number,
  meses: number | null,
  dec_h: number | null,
  fec: number | null,
  dec_lim_h: number | null,
  fec_lim: number | null,
  ucs: number | null,
  n_mun: number,
];

export type ConjuntosTerritorio = {
  ano: number | null;
  campos: string[];
  graos: Record<string, "ref" | "conjunto">;
  linhas: Record<string, LinhaConjuntoTerritorio>;
  sem_valor_no_ano: number[];
};

export type MunicipiosTerritorio = {
  gerado_em: string;
  versao: number;
  regra: string;
  campos: string[];
  graos: Record<string, "ref" | "municipio">;
  /** [cnpj, sigla], na ordem do índice `i` da gold. */
  distribuidoras: [string, string][];
  estados_vinculo: Record<string, string>;
  conjuntos: ConjuntosTerritorio;
  linhas: LinhaMunicipioTerritorio[];
};

/** Colunas de `territorio_usinas.json`. x e y na grade da malha publicada (Albers, 100 m). */
export type LinhaUsinaTerritorio = [
  ceg: string,
  nome: string,
  tipo: string,
  estagio: "operacao" | "construcao" | "construcao_nao_iniciada" | string,
  uf: string | null,
  mw_fiscalizado: number | null,
  mw_outorgado: number | null,
  x: number | null,
  y: number | null,
  municipios: string[],
  /** Municípios que o SIGA declara (reconhecidos ou não); só usina com 1 entra na soma municipal. */
  n_declarados: number,
  /** 1 = coordenada num município declarado; 0 = fora; null = sem coordenada ou sem município reconhecido. */
  coord_no_declarado: 0 | 1 | null,
  /** Tipo de outorga como o SIGA publica (Concessão, Autorização, Registro). */
  outorga: string | null,
];

export type UsinasTerritorio = {
  gerado_em: string;
  versao: number;
  campos: string[];
  graos: Record<string, "ref" | "usina">;
  grade: { origem_m: [number, number]; metros_por_unidade: number; projecao: string };
  /** Malha usada em coord_no_declarado: "maxima" (IBGE, sem simplificação) ou "simplificada" (aproximada). */
  conferencia_coordenada: "maxima" | "simplificada";
  linhas: LinhaUsinaTerritorio[];
};
