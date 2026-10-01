/**
 * Tipos da gold do módulo Empresas (public/energia/gold/empresas.json), espelho exato do que
 * pipeline/energia/modulos/empresas.py publica, e dos arquivos lidos sob demanda em
 * public/energia/series/ (empresas_ativos.json, empresas_cadeia.json, empresas_financas.json,
 * empresas_evidencias.json).
 *
 * Identidade: CNPJ de 14 dígitos publicado pela fonte oficial; nenhum vínculo por nome.
 * Potência em MW (não é energia); valores financeiros em R$ nominais (no JSON de séries, em R$
 * milhões). Capacidade proporcional e capacidade sob controle são medidas distintas e nunca
 * somadas entre si; consolidado e individual da CVM são séries separadas e nada é somado entre
 * companhias. Ausência é null; zero só aparece quando a fonte publicou zero. Nenhuma conta é
 * refeita na interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia } from "./tipos";

/* ---------------------------------------------------------------- vocabulário */

/** Estado do vínculo de propriedade de uma usina no SIGA. */
export type EstadoVinculo = "vinculado" | "inclui_sem_documento" | "soma_divergente" | "sem_proprietario" | "nao_lido";

/** Regime de exploração no SIGA: produção independente, autoprodução, serviço público, registro. */
export type Regime = "PIE" | "APE" | "SP" | "REG";

/** Por que a cadeia de controladores termina num CNPJ (ver MOTIVOS_TOPO no pipeline). */
export type MotivoParada =
  | "sem_declaracao"
  | "ambigua"
  | "sem_controlador"
  | "compartilhado"
  | "pessoa_fisica"
  | "sem_cnpj"
  | "ciclo";

/** Faixa descritiva do HHI (diretrizes de concentração horizontal de 2010): < 1.500, 1.500 a 2.500, > 2.500. */
export type FaixaHhi = "nao_concentrado" | "moderado" | "alto";

export type EscopoCvm = "con" | "ind";

export type ContaCvm =
  | "receita"
  | "ebit"
  | "lucro_liquido"
  | "lucro_controladores"
  | "ativo_total"
  | "caixa"
  | "emprestimos_cp"
  | "emprestimos_lp"
  | "patrimonio_liquido"
  | "caixa_operacional"
  | "caixa_investimento"
  | "divida_bruta";

/** Contas publicadas por companhia na gold (as demais ficam no CSV e no JSON de séries). */
export type ContaDestaque =
  | "receita"
  | "ebit"
  | "lucro_liquido"
  | "divida_bruta"
  | "patrimonio_liquido"
  | "ativo_total"
  | "caixa_investimento";

/* ---------------------------------------------------------------- P036: cadastro e ativos */

export type Datas = {
  /** Data de geração do arquivo diário do SIGA (AAAA-MM-DD). */
  siga: string | null;
  /** Data de geração do conjunto Agentes de Geração (conferência). */
  agentes_geracao: string | null;
  cadastro_agentes: string | null;
  /** Trimestre de referência do grafo societário (ex.: "2026T2"). */
  polimero_referencia: string | null;
  cvm_cadastro_capturado_em: string | null;
};

export type Definicoes = {
  vinculo: string;
  capacidade_proporcional: string;
  capacidade_controle_direto: string;
  grupo: string;
  capacidade_controle_grupo: string;
  capacidade_proporcional_grupo: string;
  hhi: string;
};

export type ResumoAgentes = {
  data: string | null;
  total: number;
  ativos: number;
  /** Agentes ativos com o ramo declarado no cadastro (autodeclarado; não define distribuidora). */
  ramos: { geracao: number; distribuicao: number; transmissao: number; comercializacao: number };
};

export type FaseResumo = { fase: string; usinas: number; mw_outorgado: number | null; mw_fiscalizado: number | null };

export type EstadoResumo = {
  estado: EstadoVinculo;
  rotulo: string;
  usinas: number;
  usinas_operacao: number;
  mw_operacao: number | null;
  pct_usinas: number | null;
  pct_mw_operacao: number | null;
};

export type RegimeResumo = { regime: Regime | string; rotulo: string; parcelas: number; mw_proporcional: number | null };

export type UsinaSemVinculo = {
  nucleo: string;
  ceg: string | null;
  nome: string | null;
  tipo: string | null;
  uf: string | null;
  mw: number | null;
  estado: EstadoVinculo;
  soma_pct: number | null;
  proprietarios_cnpj: string[];
  /** Soma divergente com CNPJs da mesma raiz (matriz e filial): mesma pessoa jurídica, sem consolidação. */
  mesma_raiz: boolean;
};

export type ConferenciaAgentes = {
  comparadas: number;
  iguais: number;
  cnpj_diferentes: number;
  percentual_diferente: number;
  so_no_siga: number;
  so_em_agentes: number;
  data: string | null;
  exemplos: {
    nucleo: string;
    motivo: "cnpj" | "percentual";
    siga: string[] | Record<string, number>;
    agentes: string[] | Record<string, number>;
  }[];
};

export type Ativos = {
  data: string | null;
  usinas: number;
  por_fase: FaseResumo[];
  operacao: { usinas: number; mw_fiscalizado: number | null };
  estados: EstadoResumo[];
  pct_mw_operacao_vinculado: number | null;
  pct_usinas_vinculadas: number | null;
  proprietarios_cnpj: number;
  proprietarios_no_cadastro: number;
  proprietarios_fora_do_cadastro: number;
  por_regime: RegimeResumo[];
  /** As 25 maiores usinas em operação sem vínculo completo; a lista inteira está no CSV de ativos. */
  sem_vinculo: UsinaSemVinculo[];
  sem_vinculo_total: number;
  conferencia_agentes_geracao: ConferenciaAgentes | null;
  evidencia: Evidencia;
};

export type Proprietario = {
  cnpj: string;
  nome: string | null;
  sigla: string | null;
  usinas: number;
  usinas_operacao: number;
  mw_proporcional: number | null;
  mw_controle_direto: number | null;
  usinas_controle_direto: number;
  no_cadastro_agentes: boolean;
  regimes: string[];
  /** Topo da cadeia de controle quando acima do próprio proprietário; null quando ele é o topo. */
  grupo: string | null;
  grupo_nome: string | null;
};

export type Cadastro = {
  agentes: ResumoAgentes;
  ativos: Ativos;
  /** Os 50 maiores proprietários diretos por capacidade proporcional. */
  proprietarios: Proprietario[];
};

/* ---------------------------------------------------------------- P037: distribuidoras */

export type FonteSigla = "tarifas" | "continuidade" | "samp" | "cadastro_agentes";

export type ReferenciaPerdas = {
  ano: number | null;
  taxa_total_pct: number | null;
  pnt_bt_pct: number | null;
  perdas_totais_mwh: number | null;
  completo: boolean | null;
  ultima_competencia: string | null;
};

export type ReferenciaQualidade = {
  ano: number | null;
  /** Horas por unidade consumidora no ano. */
  dec: number | null;
  /** Interrupções por unidade consumidora no ano. */
  fec: number | null;
  dec_limite: number | null;
  fec_limite: number | null;
  ucs: number | null;
  posicao_ranking: number | null;
  porte: string | null;
};

/** Tarifa B1 residencial convencional (R$/MWh, sem tributos) vigente, ou o motivo da falta. */
export type ReferenciaTarifa =
  | {
      vigente: true;
      total: number | null;
      te: number | null;
      tusd: number | null;
      inicio: string | null;
      fim: string | null;
      ato: string | null;
      posicao: number | null;
    }
  | {
      vigente: false;
      motivo: string | null;
      ultima_vigencia: { inicio: string; fim: string; ato: string } | null;
    };

export type ControleDistribuidora = {
  /** Topo da cadeia de controladores únicos; null quando a própria distribuidora é o topo. */
  topo: string | null;
  topo_nome: string | null;
  /** CNPJs da distribuidora até o topo, em ordem. */
  cadeia: string[];
  cadeia_nomes: (string | null)[];
  motivo_parada: MotivoParada;
  /** Controlador não identificável acima do topo (empresa estrangeira sem CNPJ); pessoa física nunca é nomeada. */
  acima: string | null;
};

export type Distribuidora = {
  cnpj: string;
  sigla: string;
  siglas: { sigla: string; fonte: FonteSigla }[];
  nome: string | null;
  classificacao: string | null;
  grupo: "concessionaria" | "permissionaria" | null;
  conflito_classificacao: boolean;
  ufs: string[];
  ativa: boolean;
  fontes: { samp: boolean; tarifas: boolean; continuidade: boolean };
  perdas: ReferenciaPerdas | null;
  qualidade: ReferenciaQualidade | null;
  tarifa: ReferenciaTarifa | null;
  controle: ControleDistribuidora;
  cvm: { cd_cvm: string | null; situacao: string | null; setor: string | null } | null;
  geracao: { usinas: number; mw_proporcional: number | null } | null;
  /** Slug estável para /setor-eletrico/empresas/[entidade]. */
  slug: string;
  /** Slugs de outras siglas publicadas pelas fontes (sem colisão), para gerar rotas de apoio. */
  slugs_alternativos: string[];
};

export type Distribuidoras = {
  regra_universo: string;
  golds_origem: Record<"perdas.json" | "qualidade.json" | "conta.json", { gerado_em: string | null; disponivel: boolean }>;
  resumo: {
    distribuidoras: number;
    ativas: number;
    concessionarias: number;
    permissionarias: number;
    com_perdas: number;
    com_qualidade: number;
    com_tarifa_vigente: number;
    com_controlador_acima: number;
    companhias_abertas: number;
    conflitos_classificacao: number;
    sem_uf: number;
  };
  indice: Distribuidora[];
};

/* ---------------------------------------------------------------- P038: finanças */

export type DefinicaoConta = {
  id: ContaCvm;
  demonstracao: "DRE" | "BPA" | "BPP" | "DFC";
  codigo: string;
  tipo: "fluxo" | "saldo";
  rotulo: string;
  definicao: string;
};

export type Companhia = {
  cnpj: string;
  cd_cvm: string | null;
  nome: string | null;
  situacao: string | null;
  setor: string | null;
  categoria: string | null;
  controle_acionario: string | null;
  distribuidora_slug: string | null;
  /** Primeiro e último exercício com DFP; null sem DFP. */
  anos: [number, number] | null;
  ultimo_exercicio: number | null;
  /** Escopo dos valores exibidos: consolidado quando a companhia o publica, senão individual. */
  escopo_exibido: EscopoCvm | null;
  /** Último exercício, em R$; null sem DFP. Nunca somar entre companhias. */
  valores: Record<ContaDestaque, number | null> | null;
  ultimo_trimestre: string | null;
  /** Primeira companhia aberta na cadeia de controle declarada à ANEEL (ela consolida esta). */
  controladora_aberta: { cnpj: string; nome: string | null } | null;
  controla_abertas: string[];
  valores_reapresentados: number;
};

export type Financas = {
  universo: {
    regra: string;
    companhias: number;
    ativas: number;
    canceladas: number;
    com_dfp: number;
    com_itr: number;
    por_setor: Record<string, number>;
    distribuidoras_abertas: number;
    nota_cobertura: string;
  };
  contas: DefinicaoConta[];
  periodos: {
    exercicios: number[];
    /** Últimos 24 fins de trimestre com ITR. */
    trimestres: string[];
    ultimo_exercicio: number | null;
    ultimo_trimestre: string | null;
  };
  revisoes: {
    documentos_com_mais_de_uma_versao: number;
    valores_reapresentados: number;
    observacoes_revisadas_entre_capturas: number;
    regra: string;
  };
  companhias: Companhia[];
};

/* ---------------------------------------------------------------- P039: controle e concentração */

export type ResumoPolimero = {
  trimestre_referencia: string | null;
  janela: string[];
  declarantes: number | null;
  fora_janela: number | null;
  nos: number;
  nos_ambiguos: number;
  limiar_concordancia: number;
  periodos: { trimestre: string; declarantes: number }[];
  linhas: number;
  arvores: number;
  percentual_ausente: number;
  agentes_com_mudanca_relevante_declarada: number;
};

export type Fronteira = {
  descricao: string;
  data: string | null;
  mw: number | null;
  usinas: number;
  mw_operacao_total: number | null;
  mw_fora: number | null;
  mw_sem_documento: number | null;
  mw_sem_controlador_majoritario: number | null;
  usinas_sem_controlador_majoritario: number;
};

export type Concentracao = {
  hhi: number | null;
  faixa: FaixaHhi | null;
  cr4: number | null;
  cr10: number | null;
  participantes: number;
  maiores: { cnpj: string; nome: string | null; pct: number | null }[];
};

export type ConcentracaoTipo = {
  tipo: string;
  mw: number | null;
  hhi_grupo: number | null;
  faixa: FaixaHhi | null;
  cr4_grupo: number | null;
  participantes: number;
  maior: { cnpj: string; nome: string | null; pct: number | null } | null;
};

export type Grupo = {
  cnpj: string;
  nome: string | null;
  mw_proporcional: number | null;
  participacao_pct: number | null;
  mw_controle: number | null;
  usinas_controle: number;
  empresas_com_usinas: number;
  motivo_parada: MotivoParada;
  acima: string | null;
  listada_cvm: boolean;
};

export type Controle = {
  polimero: ResumoPolimero | null;
  fronteira: Fronteira;
  concentracao: {
    proprietario_direto: Concentracao | null;
    grupo_proporcional: Concentracao | null;
    grupo_controle: Concentracao | null;
    por_tipo: ConcentracaoTipo[];
    evidencia: Evidencia;
  };
  cobertura: {
    proprietarios: number;
    proprietarios_com_grupo_acima: number;
    mw_consolidado_em_grupo: number | null;
    pct_mw_consolidado_em_grupo: number | null;
    motivos_parada: { motivo: MotivoParada; rotulo: string; proprietarios: number }[];
  };
  /** Os 40 maiores grupos por capacidade proporcional. */
  grupos: Grupo[];
};

/* ---------------------------------------------------------------- gold */

export type Bloqueio = { id: string; painel: string; descricao: string; evidencia: string; alternativa: string };

export type EmpresasGold = Cabecalho & {
  datas: Datas;
  definicoes: Definicoes;
  cadastro: Cadastro;
  distribuidoras: Distribuidoras;
  financas: Financas;
  controle: Controle;
  validacao: {
    criticas: string[];
    ressalvas: string[];
    identidades: { particao_grupos: boolean; particao_fronteira: boolean };
  };
  bloqueios: Bloqueio[];
  proveniencia: {
    cadastro_agentes: Proveniencia;
    ativos: Proveniencia;
    controle: Proveniencia;
    concentracao: Proveniencia;
    distribuidoras: Proveniencia;
    financas: Proveniencia;
  };
  downloads: Download[];
  series: { ativos: string; cadeia: string; financas: string; evidencias: string };
};

/* ---------------------------------------------------------------- arquivos sob demanda */

/** public/energia/series/empresas_ativos.json (colunar; mesma ordem em todas as listas). */
export type AtivosMapa = {
  gerado_em: string;
  estados: EstadoVinculo[];
  /** Índice → [CNPJ, nome] dos 200 maiores grupos. */
  grupos: [string, string | null][];
  nucleo: string[];
  nome: (string | null)[];
  tipo: (string | null)[];
  fase: string[];
  uf: (string | null)[];
  /** Potência fiscalizada em operação; outorgada nas demais fases. */
  mw: (number | null)[];
  lat: number[];
  lon: number[];
  /** Índice em `estados`. */
  estado: number[];
  /** Índice em `grupos` do grupo do proprietário majoritário; -1 sem grupo entre os 200. */
  grupo: number[];
};

/** public/energia/series/empresas_cadeia.json. */
export type CadeiaSocietaria = {
  gerado_em: string;
  /** CNPJ → [nome, controlador direto (CNPJ) ou null, motivo de parada ou null]. */
  nos: Record<string, [string | null, string | null, MotivoParada | null]>;
  arestas: {
    pai: string[];
    /** null = sócio sem CNPJ (pessoa física, fundo, ações pulverizadas). */
    socio: (string | null)[];
    nome: (string | null)[];
    controlador: (0 | 1)[];
    /** Participação direta do sócio no pai (%); null quando só há o percentual relativo ao declarante. */
    pct_direto: (number | null)[];
  };
};

/** public/energia/series/empresas_financas.json: valores em R$ milhões (3 casas). */
export type SeriesFinanceiras = {
  gerado_em: string;
  unidade: "R$ milhões";
  series: Record<
    string,
    {
      anual: Partial<Record<EscopoCvm, Partial<Record<ContaCvm, [number, number | null][]>>>>;
      /** Chave "conta:recorte", recorte = trimestre | saldo | acumulado_no_ano. */
      trimestral: Partial<Record<EscopoCvm, Record<string, [string, number | null][]>>>;
    }
  >;
};

/** public/energia/series/empresas_evidencias.json: receita do último exercício por companhia. */
export type EvidenciasEmpresas = { gerado_em: string; evidencias: Record<string, Evidencia> };
