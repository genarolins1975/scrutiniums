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

/** Faixa descritiva do HHI (Guia para Análise de Atos de Concentração Horizontal do CADE, 2016): < 1.500, 1.500 a 2.500, > 2.500. */
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
  /** Trimestres cujas declarações formam o grafo vigente (a última de cada agente na janela). */
  polimero_janela: string[];
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
  /** Universo de `ramos`: agentes ativos (situação A no cadastro) por ramo declarado. */
  ramos_universo: string;
  /** Agentes ativos com o ramo declarado no cadastro (autodeclarado; não define distribuidora). */
  ramos: RamosAgentes;
  /** Os mesmos ramos contando também os agentes inativos. */
  ramos_incluindo_inativos: RamosAgentes;
};

export type RamosAgentes = { geracao: number; distribuicao: number; transmissao: number; comercializacao: number };

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
  /** O que se sabe sobre as divergências (a causa não é verificada). */
  nota: string;
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
  /** Potência em operação com todos os proprietários identificados por CNPJ (% da potência fiscalizada em operação). */
  pct_mw_operacao_vinculado: number | null;
  /** Usinas em operação vinculadas ÷ usinas em operação (mesmo universo do percentual de potência). */
  pct_usinas_operacao_vinculadas: number | null;
  /** Usinas vinculadas ÷ usinas de TODAS as fases (universo em universo_pct_usinas_vinculadas). */
  pct_usinas_vinculadas: number | null;
  universo_pct_usinas_vinculadas: string;
  proprietarios_cnpj: number;
  proprietarios_no_cadastro: number;
  proprietarios_fora_do_cadastro: number;
  por_regime: RegimeResumo[];
  /** As 20 maiores usinas em operação sem vínculo completo; a lista inteira está no CSV de ativos. */
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

/* ---------------------------------------------------------------- P036: transmissão (SIGET) */

/** Concessionária de transmissão: módulo → contrato proprietário (IdeCcdProprietario) → CNPJ do recurso "SIGET - Contrato Agente". */
export type TransmissaoAgente = {
  cnpj: string;
  nome: string | null;
  contratos: number;
  modulos: number;
  circuitos_operacao: number;
  /** km de circuito (linha de circuito duplo conta duas vezes) dos módulos de linha ativos em operação. */
  km_circuito_operacao: number | null;
  /** % do km de circuito em operação do SIGET inteiro. */
  pct_km: number | null;
  /** Subestações distintas com módulo de equipamento em operação do CNPJ (não somar entre CNPJ). */
  subestacoes: number;
  /** MVA dos transformadores de potência principais em operação (reserva fora). */
  mva_transformacao_operacao: number | null;
  ufs: string[];
  /** Topo da cadeia de controle declarada ao Polímero quando acima do próprio CNPJ. */
  grupo: string | null;
  grupo_nome: string | null;
};

export type TransmissaoGrupo = {
  cnpj: string;
  nome: string | null;
  empresas: number;
  circuitos_operacao: number;
  km_circuito_operacao: number | null;
  pct_km: number | null;
  /** União das subestações das empresas do grupo. */
  subestacoes: number;
  mva_transformacao_operacao: number | null;
};

export type Transmissao = {
  /** Data de geração dos arquivos do SIGET. */
  data: string | null;
  regra_vinculo: string;
  definicoes: { km_circuito: string; subestacoes: string; mva: string };
  resumo: {
    contratos: number;
    contratos_sem_cnpj: number;
    /** Contratos com NumCNPJ de menos de 14 dígitos na fonte, completados com zeros à esquerda. */
    cnpj_completados_com_zeros: number;
    cnpjs: number;
    cnpjs_com_modulos: number;
    modulos: number;
    modulos_com_cnpj: number;
    pct_modulos_com_cnpj: number | null;
    /** LT linha, ME equipamento, MM manobra, MG módulo geral. */
    modulos_por_tipo: Record<string, number>;
    circuitos_operacao: number;
    km_circuito_operacao: number | null;
    subestacoes_distintas: number;
  };
  cobertura: {
    modulos_lt: number;
    modulos_lt_com_linha: number;
    modulos_me: number;
    modulos_me_com_equipamento: number;
    modulos_sem_contrato: number;
    modulos_contrato_sem_cnpj: number;
  };
  conferencia_cadastro_agentes: {
    cnpjs_com_modulos: number;
    no_cadastro: number;
    com_ramo_transmissao: number;
    ativos_com_ramo_sem_modulo_no_siget: number;
  };
  /** As 10 maiores por km de circuito em operação (todas no CSV de transmissão). */
  maiores: TransmissaoAgente[];
  /** Os 8 maiores grupos por km de circuito em operação. */
  grupos: TransmissaoGrupo[];
  evidencia: Evidencia;
};

export type Cadastro = {
  agentes: ResumoAgentes;
  ativos: Ativos;
  /** Os 30 maiores proprietários diretos por capacidade proporcional (todos no CSV de proprietários). */
  proprietarios: Proprietario[];
  /** Ativos de transmissão por CNPJ (SIGET); null quando o SIGET falta no silver. */
  transmissao: Transmissao | null;
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
  /** CNPJs da distribuidora até o topo, em ordem (nomes em empresas_cadeia.json, nos[cnpj][0]). */
  cadeia: string[];
  motivo_parada: MotivoParada;
  /** Controlador sem CNPJ acima do topo, só quando é pessoa jurídica estrangeira declarada pela fonte ou rótulo
   * coletivo; pessoa física e sócio declarado sem documento nunca são nomeados (null). */
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
  /** Presença em cada base: perdas (SAMP), qualidade (continuidade) e tarifa (tarifas) não nulos. */
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
  /** Evolução própria: "primeiro/último" ano (perdas, qualidade) ou data de vigência (tarifa) da série da gold de
   * origem para este CNPJ; módulo sem série para o CNPJ fica ausente. Ler em Distribuidoras.series_evolucao. */
  evolucao: Partial<Record<ModuloEvolucao, string>>;
};

export type ModuloEvolucao = "perdas" | "qualidade" | "tarifa";

/** Arquivo de série histórica por distribuidora publicado pela gold de origem, indexado pelo CNPJ. */
export type SerieEvolucao = { url: string; chave: string; campos: string[]; unidade: string | Record<string, string> };

export type Distribuidoras = {
  regra_universo: string;
  golds_origem: Record<"perdas.json" | "qualidade.json" | "conta.json", { gerado_em: string | null; disponivel: boolean }>;
  /** Onde ler a evolução própria de cada distribuidora (null quando a gold de origem não publica a série). */
  series_evolucao: Record<ModuloEvolucao, SerieEvolucao | null>;
  /** Regra de pares para comparação. */
  pares: string;
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
    com_evolucao: Record<ModuloEvolucao, number>;
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
  /** Categoria de registro e controle acionário ficam só em empresas_companhias_cvm.csv. */
  distribuidora_slug: string | null;
  /** Primeiro e último exercício com DFP; null sem DFP. */
  anos: [number, number] | null;
  ultimo_exercicio: number | null;
  /** Escopo dos valores exibidos: no último exercício (entre os dois escopos), consolidado quando apresentado, senão individual. */
  escopo_exibido: EscopoCvm | null;
  /** Último exercício, em R$ inteiros; null sem DFP. Nunca somar entre companhias. */
  valores: Record<ContaDestaque, number | null> | null;
  /** Avisos sobre o exercício exibido (vazio quando não há). */
  alertas: AlertaCompanhia[];
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
    /** Documentos com mais de uma versão distinta no índice da CVM. */
    documentos_com_mais_de_uma_versao: number;
    /** Reapresentações depois da correção de escala. */
    valores_reapresentados: number;
    /** Pares exercício × comparativo que só diferiam pela marca de escala (deixaram de contar como reapresentação). */
    inversoes_de_escala_resolvidas: number;
    observacoes_revisadas_entre_capturas: number;
    regra: string;
  };
  /** O que saiu das séries financeiras e por quê. */
  exclusoes: ExclusoesFinancas;
  companhias: Companhia[];
};

/** consolidado_nao_apresentado: o consolidado do exercício veio com ativo total zero (ou não preenchido) e o individual é exibido;
 * inicio_inconsistente_na_fonte: DT_INI_EXERC mal preenchida num exercício inteiro (valor aceito, data na nota do CSV);
 * escala_corrigida: algum valor exibido teve a escala convertida (a marca MIL/UNIDADE do documento diverge de outro documento);
 * fluxos_nao_preenchidos: DRE e DFC do exercício provadamente não preenchidas (ausentes);
 * dre_zerada_na_fonte: receita, resultado e lucro iguais a zero com balanço positivo, sem prova de não preenchimento no arquivo. */
export type AlertaCompanhia =
  | "consolidado_nao_apresentado"
  | "inicio_inconsistente_na_fonte"
  | "escala_corrigida"
  | "fluxos_nao_preenchidos"
  | "dre_zerada_na_fonte";

export type ExclusoesFinancas = {
  regra_nao_apresentada: string;
  colunas_nao_apresentadas: {
    /** Colunas (CNPJ, escopo, ordem do exercício, data) com ativo total ≤ 0, inclusive comparativos. */
    documentos: number;
    valores: number;
    /** Só as colunas do exercício ou do trimestre corrente do documento. */
    exercicio_ou_trimestre: {
      cnpj: string;
      escopo: EscopoCvm;
      data: string;
      documento: "DFP" | "ITR";
      motivo: "escopo_nao_apresentado" | "demonstracao_zerada";
    }[];
  };
  regra_inicio: string;
  inicio_inconsistente: { cnpj: string; ano: number; dt_ini_publicada: string }[];
  exercicios_irregulares: { valores: number; companhias: number; recorte_csv: "exercicio_irregular" };
  periodos_irregulares_itr: { valores: number; companhias: number; recorte_csv: "periodo_irregular" };
  regra_nao_preenchida: string;
  colunas_nao_preenchidas: {
    colunas: number;
    valores: number;
    por_motivo: Partial<Record<"coluna_nao_preenchida" | "fluxos_nao_preenchidos", number>>;
    /** "CNPJ escopo DOCUMENTO demonstração período: motivo", só do exercício ou trimestre corrente (lista inteira no CSV de ajustes). */
    exercicio_ou_trimestre: string[];
  };
  escala: {
    regra: string;
    documentos_corrigidos: number;
    valores_corrigidos: number;
    companhias: number;
    /** Texto por companhia e escopo; documento a documento em empresas_financas_ajustes.csv. */
    por_companhia: string[];
    componentes_contraditorios: { cnpj: string; escopo: EscopoCvm; documentos: number }[];
  };
  saltos_ativo: {
    regra: string;
    casos: { cnpj: string; escopo: EscopoCvm; de: number; para: number; razao: number | null }[];
  };
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
  /** Companhia aberta com registro ATIVO no cadastro inteiro da CVM (qualquer setor de atividade). */
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
  /** Os 30 maiores grupos por capacidade proporcional (todos no CSV de grupos). */
  grupos: Grupo[];
};

/* ---------------------------------------------------------------- gold */

export type Bloqueio = { id: string; painel: string; descricao: string; evidencia: string; alternativa: string };

/** Escolha de método (o insumo existe; a medida não é publicada nesta fase, com o motivo). */
export type DecisaoMetodo = {
  id: string;
  painel: string;
  decisao: string;
  insumo_disponivel: string;
  motivo: string;
  como_mudar: string;
};

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
  decisoes_metodo: DecisaoMetodo[];
  proveniencia: {
    cadastro_agentes: Proveniencia;
    ativos: Proveniencia;
    controle: Proveniencia;
    concentracao: Proveniencia;
    transmissao: Proveniencia | null;
    /** Identidade do índice (OBSERVADO); os números copiados têm proveniência própria, com a natureza herdada da origem. */
    distribuidoras: Proveniencia;
    distribuidoras_perdas: Proveniencia | null;
    distribuidoras_pnt: Proveniencia | null;
    distribuidoras_qualidade: Proveniencia | null;
    distribuidoras_tarifa: Proveniencia | null;
    financas: Proveniencia;
    /** Valores com a escala convertida pelo observatório (natureza ESTIMADO). */
    financas_escala: Proveniencia;
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
    /** Nome só com CNPJ, pessoa jurídica estrangeira declarada pela fonte ou rótulo coletivo; senão "pessoa física" ou "sócio sem documento". */
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
      /** Chave "conta:recorte": DRE em trimestre, balanço em saldo, DFC em acumulado_no_ano (desde o 1º trimestre). */
      trimestral: Partial<Record<EscopoCvm, Record<string, [string, number | null][]>>>;
      /** Documentos com a escala convertida ("DFP 2021-12-31 individual: x1000"); ausente quando não há. */
      escala_corrigida?: string[];
    }
  >;
};

/** public/energia/series/empresas_evidencias.json: receita do último exercício por companhia. */
export type EvidenciasEmpresas = { gerado_em: string; evidencias: Record<string, Evidencia> };
