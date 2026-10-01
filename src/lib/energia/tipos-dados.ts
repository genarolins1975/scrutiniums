/**
 * Tipos das golds do módulo Dados e metodologia (P067 a P070), espelho exato do que
 * pipeline/energia/modulos/dados.py e pipeline/energia/catalogo.py publicam:
 *
 * - public/energia/gold/publicacao.json: saúde, revisões e validação de cada conjunto
 *   integrado, relatório do validador genérico, eixos natureza × validação, afirmações
 *   de integração e instruções de reprodução;
 * - public/energia/gold/catalogo.json: catálogo de todos os conjuntos (listagens do
 *   ONS, da ANEEL e da CCEE, package_show versionados, REGISTRO dos módulos e cadastro
 *   manual), com o estado de cada um e o estado recurso a recurso;
 * - public/energia/gold/manifesto.json: sha256 e tamanho de cada arquivo publicado e o
 *   id da publicação.
 *
 * Para caber no limite de ~400 KB por gold, as duas primeiras omitem chaves vazias:
 * campo opcional ausente quer dizer "não se aplica" ou "não informado", nunca zero.
 * As regras de compactação do catálogo estão no próprio arquivo (campo `compactacao`).
 * Nenhum número é recalculado na interface.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Natureza, Proveniencia } from "./tipos";

/* ---------------------------------------------------------------- vocabulário */

/** Escada do catálogo: cada estado exige a evidência da etapa e de todas as anteriores. */
export type EstadoDados = "CATALOGADO" | "RECURSO VERIFICADO" | "INTEGRADO" | "VALIDADO" | "PUBLICADO";
export type EtapaId = "catalogado" | "recurso_verificado" | "integrado" | "validado" | "publicado";
/** Uso declarado (eixo separado do estado). */
export type Papel = "indicador" | "modelo" | "conferencia" | "contexto" | "historico";
export type ResultadoChecagem = "aprovado" | "ressalva" | "reprovado" | "nao_aplicavel";
export type Veredito = ResultadoChecagem;
export type Cadencia = "diaria" | "semanal" | "quinzenal" | "mensal" | "trimestral" | "anual";
export type SituacaoAtualidade = "EM DIA" | "ATRASADO" | "SEM SLA" | "SEM DADO";
/**
 * Caso da regra de SLA (regras.sla_texto): A grão = cadência; B lotes; C cadência mais curta que o grão quando a
 * declaração é a rotina do portal (ONS); D sem série regular; E cadência mais curta que o grão fora da rotina do
 * portal, medida pela data de publicação da fonte.
 */
export type CasoSla = "A" | "B" | "C" | "D" | "E";
export type SituacaoValidacao = "reconciliacao_aprovada" | "controles_aprovados" | "ressalva" | "divergencia" | "pendencia";
/** Formato da referência temporal observada no silver. */
export type FormatoRef = "horaria" | "diaria" | "mensal" | "trimestral" | "anual" | "intervalo" | "vigencia" | "nao_temporal" | "misto";
export type EstadoModelo = "PESQUISA" | "VALIDACAO" | "PRODUCAO" | "APOSENTADO";
export type OrigemCatalogo = "listagem" | "package_show" | "registro" | "manual";

/* ---------------------------------------------------------------- etapas */

export type EtapaCatalogado = {
  ok: boolean;
  origem: OrigemCatalogo;
  /** Captura da listagem ou do package_show (UTC); ausente na listagem (ver portais.<órgão>.colhido_em). */
  em?: string;
  /** package_show versionado no repositório. */
  arquivo?: string;
  sha256?: string;
  /** Módulo cujo REGISTRO declara URL e licença. */
  modulo?: string;
};

export type EtapaRecursoVerificado = {
  ok: boolean;
  /** captura com sha256 (ausente nos conjuntos de publicacao.json, onde é sempre captura). */
  via?: "captura" | "requisicao_parcial" | "captura_outro_dataset";
  /** Primeira captura (UTC) ou instante da verificação parcial. */
  em?: string;
  capturas?: number;
  arquivos?: number;
  recurso?: string;
  formato?: string;
  colunas?: number;
  detalhe?: string;
};

/** documento: original guardado para citação; leitura_do_original: sem tabela no silver, lido do bronze por gold que cita o snapshot. */
export type EtapaIntegrado = { ok: boolean; observacoes?: number; registros?: number; documento?: true; leitura_do_original?: true };

/** Contagem de checagens; ressalvas e reprovadas ausentes = nenhuma. */
export type EtapaValidado = {
  ok: boolean;
  resultado?: Veredito;
  aprovadas?: number;
  ressalvas?: number;
  reprovadas?: number;
};

export type EtapaPublicado = {
  ok: boolean;
  /** Golds íntegras que consomem o conjunto; ausente = todas as golds do conjunto. */
  golds?: string[];
  /** Golds íntegras que citam o conjunto no snapshot de uma proveniência. */
  citado_por?: string[];
  problemas?: string[];
};

export type Etapas = {
  catalogado?: EtapaCatalogado;
  recurso_verificado?: EtapaRecursoVerificado;
  integrado?: EtapaIntegrado;
  validado?: EtapaValidado;
  publicado?: EtapaPublicado;
};

/* ---------------------------------------------------------------- conjunto integrado (publicacao.json) */

export type Frequencia = {
  /** Texto declarado pela fonte, como publicado. */
  declarada?: string;
  /** Campo de onde o texto foi lido (periodicidade do SIDRA, REGISTRO); o do portal está em dados_conjuntos.csv. */
  campo?: string;
  origem?: "portal" | "metadados" | "registro";
  referencia_publicacao?: string;
  url_metadados?: string;
  /** Último período publicado segundo os metadados da fonte (SIDRA). */
  ultimo_periodo_fonte?: string;
  modulo?: string;
  cadencias: Cadencia[];
  /** A fonte declara atualização sem cadência (sob demanda, eventual). */
  sem_sla?: true;
};

export type Atualidade = {
  situacao: SituacaoAtualidade;
  caso?: CasoSla;
  base?: "periodo_de_referencia" | "publicacao_da_fonte";
  /** Tolerância em dias: PublicacaoGold.regras.sla[cadencia]. */
  cadencia?: Cadencia;
  /** Maior referência disponível até hoje (nunca a data da captura). */
  ultimo_periodo?: string;
  fim_ultimo_periodo?: string;
  /** O último período ainda não terminou (ano ou mês corrente): não alonga o prazo, que parte do último período completo. */
  periodo_parcial?: true;
  /** Data até a qual o período seguinte deve chegar. */
  prazo_proximo?: string;
  dias_atraso?: number;
  causa?: string;
  motivo_sem_sla?: string;
  /** A data de modificação informada pela fonte é anterior ao período mais recente do próprio arquivo. */
  publicacao_nao_acompanha_conteudo?: true;
};

export type DadoConjunto = {
  granularidade: string;
  formato?: FormatoRef;
  ref_min?: string;
  ref_max?: string;
  series?: number;
  /** Fração 0 a 1: referências presentes ÷ esperadas entre a primeira e a última de cada série. */
  completude_interna?: number;
  series_com_lacuna?: number;
  /** Séries com valor em atualidade.ultimo_periodo (último período disponível até hoje, nunca uma referência futura). */
  series_no_ultimo?: number;
  /** Séries com valor no período anterior a atualidade.ultimo_periodo (pelo passo da série). */
  series_no_anterior?: number;
  /** Cadastros: menor fração de chaves com um campo preenchido. */
  preenchimento_minimo?: number;
};

export type EventoRevisao = {
  serie: string;
  ref: string;
  de: number;
  para: number;
  diferenca: number;
  /** null quando o valor anterior é zero. */
  relativa_pct: number | null;
  capturado_de: string;
  capturado_para: string;
  recurso: string;
};

export type Revisoes = {
  eventos?: number;
  /** Pares (série, referência) revisados entre capturas do mesmo arquivo. */
  observacoes?: number;
  /** Referências (períodos) distintas revisadas, em qualquer série. */
  referencias?: number;
  series?: number;
  ref_min?: string;
  ref_max?: string;
  a_partir_de_zero?: number;
  maior_abs?: EventoRevisao | null;
  maior_rel?: EventoRevisao | null;
  /** Dia da captura (UTC) → eventos de revisão (observações revisadas) trazidos pela captura. */
  por_captura?: Record<string, number>;
  /** Mesma (série, referência) com valores diferentes em arquivos diferentes: não é revisão da fonte. */
  conflitos_entre_recursos?: {
    referencias: number;
    exemplos: { serie: string; ref: string; valores: Record<string, number> }[];
  };
  /**
   * Cadastros e atos (campos textuais). Mudança = campo da mesma chave com valor novo entre capturas consecutivas do
   * MESMO arquivo; valor diferente entre arquivos do conjunto é conflito entre recursos; campos que descrevem o
   * arquivo (data de geração, de processamento) ficam em metadado_do_arquivo.
   */
  registros?: {
    mudancas?: number;
    chaves?: number;
    campos?: Record<string, number>;
    apagados_pela_fonte?: number;
    por_captura?: Record<string, number>;
    metadado_do_arquivo?: number;
    conflitos_entre_recursos?: {
      /** Pares (chave, campo) com valores diferentes entre arquivos. */
      campos: number;
      chaves: number;
      por_campo: Record<string, number>;
      exemplos: { chave: string; campo: string; valores: Record<string, string> }[];
    };
  };
};

export type ItemValidacao = { tipo: string; resultado: ResultadoChecagem; detalhe: string };

export type ConjuntoIntegrado = {
  /** "família/dataset do silver"; a entrada do catálogo é "<órgão em minúsculas>:<nome>". */
  id: string;
  orgao: string;
  nome: string;
  slug: string | null;
  /** Mais de um slug declarado para o mesmo dataset. */
  slugs?: string[];
  titulo: string;
  modulos: string[];
  golds: string[];
  estado: EstadoDados;
  etapas: Required<Etapas>;
  ressalvas: string[];
  uso: { papeis: Papel[]; modelos?: { codigo: string; estado: EstadoModelo | null }[] };
  /** Ausente = não descontinuado. */
  descontinuado?: true;
  descontinuacao?: { motivo: string; evidencia: string };
  frequencia: Frequencia;
  atualidade: Atualidade;
  dado: DadoConjunto | null;
  capturas: {
    ultima?: string;
    /** last_modified informado pela fonte; ausente quando a fonte não informa. */
    ultima_publicacao_fonte?: string;
    anteriores_preservadas?: number;
    origens?: Record<string, number>;
    /** A fonte modificou arquivos depois da última captura (atraso do pipeline, não da fonte). */
    fonte_mais_nova?: { recursos: number; exemplos: { recurso: string; modificado_na_fonte: string; ultima_captura: string }[] };
  };
  coleta: {
    tentativas: number;
    falhas: number;
    ultimo_ok?: string;
    ultima_falha?: { recurso: string; tentado_em: string; detalhe: string } | null;
    /** Ausente = nenhuma falha seguida. */
    falhas_consecutivas?: number;
  };
  revisoes: Revisoes | null;
  bronze: {
    presentes?: number;
    ausentes?: number;
    sha256_conferidos?: number;
    sha256_divergentes?: number;
    drift?: number;
    esquema_diferente_entre_recursos?: number;
  } | null;
  /** Só quando há checagem com ressalva ou reprovada (contagens em etapas.validado). */
  validacao?: { itens: ItemValidacao[] };
};

/* ---------------------------------------------------------------- relatório do validador */

export type GoldValidada = {
  gold: string;
  disponivel: boolean;
  gerado_em: string | null;
  bytes: number;
  veredito: Veredito;
  /** Checagens aprovadas (contagem); ausente nas publicações anteriores a 01/10/2026 08h UTC. */
  aprovadas?: number;
  /** Tipo de checagem → resultado, só das NÃO aprovadas (ressalva, reprovado, não aplicável); as aprovadas estão em `aprovadas`. */
  checagens: Record<string, ResultadoChecagem>;
  problemas: ItemValidacao[];
};

export type ParquetPublicado = {
  csv: string | null;
  parquet: string;
  status: string;
  bytes_csv?: number;
  bytes_parquet?: number;
  linhas?: number | null;
  equivalente?: boolean;
  csv_sha256?: string;
};

export type IdentidadeValidada = {
  id: string;
  alvo: string;
  resultado: ResultadoChecagem;
  detalhe: string;
  verificados: number | null;
  problemas: number;
};

export type DiaCalendario = {
  /** Dia UTC. */
  dia: string;
  capturas_novas: number;
  recapturas_sem_mudanca: number;
  falhas: number;
  /** Eventos de revisão (pares série e referência que mudaram) trazidos pela captura do dia. */
  observacoes_revisadas: number;
  publicacoes_fonte: number;
  conjuntos_com_evento: number;
};

export type Afirmacao = {
  id: string;
  tema: string;
  conjuntos: { id: string; estado: EstadoDados; titulo: string | null; paginas: { rotulo: string; href: string }[] }[];
  ausentes_no_catalogo: string[];
  achado?: { id: string; gold: string; status: string | null; conclusao: string | null; correcao_metodologia: string | null } | null;
  afirmacao_anterior?: string;
  correcao_metodologia?: string;
  /** Texto gerado do estado real do catálogo e do achado. */
  texto: string;
};

export type Eixos = {
  naturezas: Record<Natureza, string>;
  situacoes: Record<SituacaoValidacao, string>;
  /** natureza (ou SEM_VINCULO) → situação → fichas. */
  matriz: Record<string, Partial<Record<SituacaoValidacao, number>>>;
  por_gold: Record<string, {
    naturezas: Partial<Record<Natureza, number>>;
    situacoes: Partial<Record<SituacaoValidacao, number>>;
    fichas: number;
    proveniencias: number;
  }>;
  fichas: number;
  fichas_sem_natureza_vinculada: number;
  regra_vinculo: string;
  /** ESTIMADO não separa estimado pela fonte de estimado pelo observatório (seção 11.3): limitação declarada. */
  limitacao_natureza: string;
};

export type ResumoRecursos = {
  por_estado: Partial<Record<EstadoDados, number>>;
  total: number;
  removidos: number;
  download: string;
};

export type Portal = {
  colhido_em: string | null;
  conjuntos: number;
  erro: string | null;
  origem: string;
  url?: string;
  url_conjunto?: string;
  recursos?: number;
  /** Licença mais frequente no portal (entrada sem licença no catálogo = esta). */
  licenca?: string | null;
  seed_capturado_em?: string[];
};

export type PublicacaoGold = Cabecalho & {
  /** janela_calendario_dias: o calendário cobre de hoje − janela até hoje (ausente nas publicações anteriores a 01/10/2026 08h UTC). */
  referencia: { hoje: string; fuso: string; executado_em: string; janela_calendario_dias?: number };
  regras: {
    estados: Record<EstadoDados, string>;
    criterios_estado: Record<EstadoDados, string>;
    uso: string;
    captura_atras_da_fonte: string;
    sla: Record<Cadencia, { tolerancia_dias: number; periodo_dias_aprox: number }>;
    sla_texto: string;
    falha: string;
    completude: string;
    revisao: string;
    validacao: string;
    /** dataset → razão de referência legitimamente posterior à captura. */
    horizonte: Record<string, string>;
    tempo: Record<string, string>;
  };
  resumo: {
    integracoes: number;
    por_estado: Partial<Record<EstadoDados, number>>;
    por_situacao: Partial<Record<SituacaoAtualidade, number>>;
    com_revisao: number;
    /** Pares (série, referência) revisados, somados nos conjuntos. */
    observacoes_revisadas: number;
    /** Referências distintas revisadas, somadas por conjunto. */
    referencias_revisadas: number;
    /** Conjuntos com mudança de cadastro entre capturas do mesmo arquivo. */
    com_mudanca_em_registros: number;
    com_falha_recente: number;
    captura_atras_da_fonte: number;
    descontinuados: number;
    validacao: Record<ResultadoChecagem, number> & { checagens: number };
    golds: { total: number; integras: number; por_veredito: Partial<Record<Veredito, number>> };
    csv: { total: number; por_veredito: Partial<Record<Veredito, number>> };
    parquet: { arquivos: number; equivalentes: number; bytes: number };
    duracao_s: number | null;
    tempos_s?: Record<string, number>;
  };
  conjuntos: ConjuntoIntegrado[];
  golds: GoldValidada[];
  arquivos: {
    csv_com_problema: { arquivo: string; veredito: Veredito; problemas: ItemValidacao[] }[];
    parquet: ParquetPublicado[];
    limiar_parquet_bytes: number;
  };
  identidades: IdentidadeValidada[];
  calendario: DiaCalendario[];
  silver_nao_declarados: { familia: string; dataset: string; vintages: number; observacoes: boolean; registros: boolean }[];
  eixos: Eixos;
  /** Avaliação dos painéis (P071): só existe depois da inspeção final; sem arquivo, nenhuma nota. */
  avaliacao: { arquivo: string | null; caminho_previsto: string; existe: boolean; nota: string };
  reproducao: {
    repositorio: string;
    /** Substitua {commit} pelo commit do build e {caminho} pelo caminho público (/energia/...). */
    url_versao_modelo: string;
    historico_arquivo_modelo: string;
    commit: string;
    passos: string[];
    pacote_por_consulta: string;
    silver: string;
  };
  /** Dicionário dos arquivos das golds de operação (os dos módulos estão em arquivos.json). */
  dicionario_operacao: Record<string, string>;
  downloads: Download[];
  catalogo: {
    total: number;
    contagem: Record<EstadoDados, number>;
    descontinuados: number;
    portais: Record<string, Portal>;
    recursos: Record<string, ResumoRecursos>;
    ccee: {
      conjuntos: number;
      por_estado: Partial<Record<EstadoDados, number>>;
      recursos?: ResumoRecursos;
      integrados: { id: string; titulo: string; estado: EstadoDados; recursos: ResumoRecursosEntrada | null; modulos: string[] }[];
    };
    descontinuados_lista: { id: string; titulo: string; motivo: string | null; evidencia: string | null; estado: EstadoDados }[];
    recursos_removidos: { orgao: string; conjunto: string; recurso: string | null; publicado_em: string | null }[];
  };
  afirmacoes: Afirmacao[];
  proveniencia: { catalogo: Proveniencia; saude: Proveniencia; revisoes: Proveniencia; validacao: Proveniencia; reproducao?: Proveniencia };
  /** Fichas "Comprove este número": P067 (publicados), P068 (atrasados, maior revisão), P069 (Parquet) e P070 (afirmações, reprovadas). */
  evidencias: Partial<
    Record<
      "conjuntos_publicados" | "conjuntos_atrasados" | "maior_revisao_relativa" | "parquet_equivalentes" | "afirmacoes_conferidas" | "checagens_reprovadas",
      Evidencia
    >
  >;
};

/* ---------------------------------------------------------------- catálogo (catalogo.json) */

export type ResumoRecursosEntrada = {
  total: number;
  /** Só nas entradas com integração. */
  por_estado?: Partial<Record<EstadoDados, number>>;
  /** Recursos baixados com sha256 ou lidos por requisição parcial; ausente = nenhum. */
  acessados?: number;
  removidos?: number;
  ultimo_publicado?: string;
};

export type RecursoCcee = {
  nome: string | null;
  formato?: string;
  publicado_em?: string;
  estado: EstadoDados;
  capturas?: number;
  removido?: true;
};

export type EntradaDados = {
  /** "<órgão em minúsculas>:<nome>". */
  id: string;
  orgao: string;
  /** Ausente quando é o trecho do id depois de "órgão:"; null no cadastro manual sem nome. */
  nome?: string | null;
  titulo: string;
  /** Ausente quando é portais.<órgão>.url_conjunto seguido do nome. */
  url?: string;
  /** Ausente quando é a licença do portal (portais.<órgão>.licenca). */
  licenca?: string | null;
  tema: string;
  formatos: string[];
  estado: EstadoDados;
  metadados_verificados: boolean;
  descontinuado?: true;
  descontinuacao?: { motivo: string; evidencia: string };
  modificado_na_fonte?: string | null;
  frequencia_declarada?: string;
  /** Só nos conjuntos integrados (a íntegra de todos está em dados_catalogo.csv). */
  descricao?: string;
  /** Entradas com integração: etapa ausente = não alcançada; a evidência completa está em publicacao.json. */
  etapas?: Etapas;
  /** Entradas sem integração: origem do cadastro (ausente = listagem do portal). */
  catalogado?: { origem?: OrigemCatalogo; ok?: false };
  /** Entradas sem integração: acesso ao arquivo (ok ausente = êxito; via ausente = requisição parcial). */
  verificacao?: Omit<EtapaRecursoVerificado, "ok"> & { ok?: false };
  recursos_resumo?: ResumoRecursosEntrada;
  /** CCEE recurso a recurso nas entradas com algum arquivo integrado (tabela completa em dados_recursos_ccee.csv). */
  recursos?: RecursoCcee[];
  /** package_show da CCEE versionados no repositório: quantas versões e a mais recente. */
  metadados_versionados?: { versoes: number; ultima: { arquivo: string; sha256: string; capturado_em: string | null } };
  integracoes?: { id: string; estado: EstadoDados | null }[];
  modulos?: string[];
  ressalvas?: string[];
  papeis?: Papel[];
  /** Golds que consomem o conjunto (vazio fora das integrações). */
  usado_em: string[];
  /** Códigos de modelo (estado em CatalogoDados.modelos). */
  modelos?: string[];
  quebras: { data: string; descricao: string; origem?: "FONTE" | "PLATAFORMA" }[];
  slug?: string;
  interno?: string;
  familia?: string;
  paginas?: { rotulo: string; href: string }[];
  downloads?: string[];
  endereco_verificado?: { http_status: string | null; resultado: string; verificado_em: string; detalhe: string | null } | null;
};

export type CatalogoDados = {
  dominio: "energia";
  gold: "catalogo.json";
  gerado_em: string;
  versao_pipeline: string;
  disponivel: boolean;
  estados: EstadoDados[];
  definicoes_estado: Record<EstadoDados, string>;
  criterios_estado: Record<EstadoDados, string>;
  eixos: { estado: string; uso: string };
  regra_recurso: string;
  compactacao: string;
  modelos: Record<string, EstadoModelo | null>;
  portais: Record<string, Portal>;
  contagem: Record<EstadoDados, number>;
  total: number;
  descontinuados: number;
  recursos: Record<string, ResumoRecursos>;
  entradas: EntradaDados[];
};

/* ---------------------------------------------------------------- manifesto (manifesto.json) */

export type ItemManifesto = {
  /** Caminho público (/energia/...). */
  caminho: string;
  tipo: "gold" | "serie" | "parquet" | "geometria";
  bytes: number;
  sha256: string;
  gerado_em?: string | null;
  disponivel?: boolean | null;
  legivel?: false;
  /** CSV: cabeçalho, linhas de dados, se há dicionário publicado e o Parquet equivalente. */
  colunas?: string[];
  linhas?: number;
  dicionario?: boolean;
  parquet?: string | null;
};

export type ManifestoGold = Cabecalho & {
  /** sha256 da lista [caminho, bytes, sha256] em ordem de caminho (regra_id). */
  id_publicacao: string;
  regra_id: string;
  /** false: os arquivos de fora_do_manifesto são reescritos depois pelo orquestrador. */
  completo: boolean;
  fora_do_manifesto: { caminho: string; motivo: string }[];
  repositorio: string;
  totais: { arquivos: number; bytes: number } & Partial<Record<"golds" | "series" | "parquets" | "geometrias", number>>;
  arquivos: ItemManifesto[];
};
