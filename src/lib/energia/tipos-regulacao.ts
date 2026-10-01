/**
 * Tipos da gold do módulo Regulação (public/energia/gold/regulacao.json), espelho exato do
 * que pipeline/energia/modulos/regulacao.py publica (painéis P044 a P046).
 *
 * Limites do PLD em R$/MWh nominais, como escritos nos atos. Data de publicação (Diário
 * Oficial) e início de vigência são campos distintos; publicação desconhecida é null, nunca
 * a data de captura. Teto horário e teto estrutural ficam em campos separados.
 *
 * Única regra reaplicada na interface: a situação das consultas públicas, que depende da
 * data do build. `situacaoConsulta` repete, sem alteração, `situacao()` de
 * pipeline/energia/fontes/aneel_regulacao.py; a gold traz a situação calculada na data de
 * referência (`consultas.data_referencia`) e a página a recalcula na data do build, para
 * que nenhuma consulta vencida continue aparecendo como aberta.
 */
import type { Evidencia } from "./evidencia";
import type { Cabecalho, Download, Proveniencia } from "./tipos";

/* ---------------------------------------------------------------- P044: limites do PLD */

export type CampoLimite = "pld_min" | "pld_max_horario" | "pld_max_estrutural";

export type ResultadoConferencia = "aprovado" | "ressalva" | "reprovado" | "nao_executada";

export type TipoConferencia =
  | "trecho_no_pdf"
  | "publicacao_no_extrato"
  | "deliberacao_na_ata"
  | "valor_na_ata"
  | "piso_teo"
  /** Teto publicado no ano anterior encadeado pela variação do IPCA de novembro (prática dos atos). */
  | "regra_ipca"
  /** Aplicação literal do art. 23, § 1º, da REN nº 1.032/2022 (base de setembro de 2019): informativa, sempre "ressalva". */
  | "art23_literal";

export type ConferenciaAto = {
  conferencia: TipoConferencia;
  /** Campo conferido: um dos limites, "trecho", "data_publicacao" ou "numero_e_data". */
  campo: string;
  resultado: ResultadoConferencia;
  detalhe: string;
};

export type ConferenciaDetalhe = ConferenciaAto & {
  ano: number | null;
  ato: string | null;
  valor_ato: number | null;
  valor_esperado: number | null;
  diferenca: number | null;
  /** Texto com unidade (ex.: "R$ 0,011/MWh (dois arredondamentos a centavos)"). */
  tolerancia: string;
};

export type NivelConferenciaLimite = "texto_do_ato" | "documento_oficial_do_processo";

/** Um ato de limites como está em pipeline/energia/regulatorio/limites_pld.json, mais as conferências. */
export type AtoLimite = {
  ano: number;
  ato: string;
  /** Data no Diário Oficial; null quando não conferida. */
  data_publicacao: string | null;
  vigencia_inicio: string;
  vigencia_fim: string;
  /** null = o ato não fixa este limite (vale o de outro ato do mesmo ano). */
  pld_min: number | null;
  pld_max_horario: number | null;
  pld_max_estrutural: number | null;
  unidade: "R$/MWh";
  dispositivo: string;
  url: string;
  /** Passagens literais do documento, separadas por " […] ". */
  trecho: string;
  altera_ou_revoga: string | null;
  nivel_conferencia: NivelConferenciaLimite | null;
  data_do_ato: string | null;
  /** Linha do DOU impressa pela ANEEL no extrato ("D.O. de 23.12.2025, seção 1, ..."). */
  dou: string | null;
  documento: string | null;
  documento_titulo: string | null;
  url_oficial: string | null;
  /** Cópia pública (Internet Archive, bytes originais) de onde o PDF foi obtido. */
  copia_publica: string | null;
  sha256: string | null;
  /** Página do PDF em que começa o trecho; null se não localizada. */
  pagina: number | null;
  /** true = todas as passagens encontradas no PDF; null = conferência não executada. */
  trecho_confere: boolean | null;
  /** Reunião da Diretoria que deliberou o ato (só resoluções homologatórias). */
  deliberacao: { data: string; reuniao: string; processo: string | null } | null;
  teo: number | null;
  teo_itaipu: number | null;
  observacoes: string[];
  conferencias: ConferenciaAto[];
};

/** Limites efetivos num trecho de vigência, campo a campo, com o ato de origem de cada campo. */
export type LimitesVigentes = {
  pld_min: number | null;
  ato_pld_min: string | null;
  pld_max_horario: number | null;
  ato_pld_max_horario: string | null;
  pld_max_estrutural: number | null;
  ato_pld_max_estrutural: string | null;
};

export type VigenciaLimites = LimitesVigentes & { ano: number; inicio: string; fim: string };

export type ContagemConferencias = Record<ResultadoConferencia, number>;

export type Pendencia = { ano: number; item: string; situacao: string; evidencia: string; efeito: string };
export type Bloqueio = { fonte: string; verificado_em: string; resposta: string; conduta: string };

export type LimitesPld = {
  conferido_em: string;
  atos: AtoLimite[];
  vigencias: VigenciaLimites[];
  vigente_hoje: LimitesVigentes & { data: string };
  conferencias: Partial<Record<TipoConferencia, ContagemConferencias>>;
  /** Conferências numéricas (encadeamento pelo IPCA, aplicação literal do art. 23, piso = TEO, valor na ata). */
  conferencias_detalhe: ConferenciaDetalhe[];
  pendencias: Pendencia[];
  bloqueios: Bloqueio[];
  metodo: string | null;
};

export type AtividadeResumo = { codigo: string; atividade: string; ano_previsto: number };

export type RegrasLimites = {
  ato: string;
  dispositivo: string;
  resumo: string;
  trecho: string;
  vigencia_inicio: string;
  documento: string;
  url_oficial: string | null;
} | null;

export type VigenciaBandeira = {
  ato: string | null;
  patamar: "Amarela" | "Vermelha P1" | "Vermelha P2" | "Escassez Hídrica" | string;
  vigencia_inicio: string;
  /** null = valor sem término na fonte (patamar ainda acionado e sem valor posterior). */
  vigencia_fim: string | null;
  /**
   * valor_seguinte = véspera do valor seguinte do mesmo patamar; ultimo_acionamento = patamar
   * extinto, fim no último dia do último mês com acionamento (grão mensal); null = sem fim.
   */
  vigencia_fim_origem: "valor_seguinte" | "ultimo_acionamento" | null;
  /** Último mês com o patamar no recurso Acionamento (só patamar extinto). */
  ultimo_acionamento: { competencia: string; rs_mwh: number | null } | null;
  /** Primeira resolução posterior do recurso Adicional que fixou os patamares sem este. */
  resolucao_seguinte_sem_patamar: { ato: string | null; vigencia_inicio: string } | null;
  /** Conferência do fim com a vigência escrita no dicionário do recurso Acionamento. */
  conferencia_fim: { resultado: "aprovado" | "reprovado" | "nao_executada"; detalhe: string } | null;
  rs_mwh: number | null;
};

export type Bandeiras = {
  vigencias: VigenciaBandeira[];
  gerado_pela_fonte_em: string | null;
  acionamento_gerado_pela_fonte_em: string | null;
  acionamento_meses: number;
  acionamento_periodo: { inicio: string; fim: string } | null;
};

export type ConferenciaProcedimento = "confirmada_por_ato_integrado" | "sem_conferencia_externa" | "pagina_possivelmente_desatualizada";

export type AtoProcedimento = {
  ato: string | null;
  /** Data da deliberação (ata) ou do ato (anexo de Resolução Normativa lida). */
  data: string;
  /** "ata da reunião pública da Diretoria" ou "texto do ato (<documento>, sha256 ...)". */
  fonte: string;
  trecho: string;
  /** Versão escrita na decisão ("aprovar a versão 2.7 do Submódulo 7.3"), quando houver. */
  versao_aprovada: string | null;
};

export type Procedimento = {
  conjunto: "PRODIST" | "PRORET";
  modulo: string;
  titulo: string | null;
  /** Versão e ato lidos do nome do arquivo que a página oficial publica como versão vigente. */
  versao_na_pagina: string | null;
  ato_na_pagina: string | null;
  ano_ato: number | null;
  numero_ato: number | null;
  /** Data da deliberação do ato da página (atas) ou do ato lido; null quando desconhecida. */
  data_ato_na_pagina: string | null;
  conferencia: ConferenciaProcedimento;
  /** null quando há ato posterior que aprova nova versão: a versão vigente não é conhecida. */
  ato_vigente: string | null;
  atos_posteriores: AtoProcedimento[];
  confirmacoes: AtoProcedimento[];
  url_vigente: string | null;
  url_versoes: string | null;
  observacao: string | null;
};

export type Procedimentos = {
  itens: Procedimento[];
  verificado_em: { prodist: string | null; proret: string | null };
  paginas: { PRODIST: string; PRORET: string };
  contagem_conferencia: Record<ConferenciaProcedimento, number>;
  regra_conferencia: string;
};

/* ---------------------------------------------------------------- P045: linha do tempo */

export type NivelConferenciaEvento =
  | "texto_do_ato"
  | "documento_oficial_do_processo"
  | "documento_oficial_que_cita_o_ato"
  | "ata_da_diretoria"
  | "registro_em_conjunto_de_dados_oficial";

export type PainelLink = { rotulo: string; href: string };

export type EventoRegulatorio = {
  id: string;
  titulo: string;
  orgao: string;
  ato: string | null;
  tipo_ato: string;
  data_ato: string | null;
  data_publicacao: string | null;
  vigencia_inicio: string;
  /** Literal do ato (ou, nos eventos de bandeiras, a regra do conjunto de dados). */
  vigencia_regra: string;
  /** true = vigência calculada pela LC nº 95/1998, art. 8º, § 1º. */
  vigencia_calculada: boolean;
  dispositivo: string;
  /** Resumo editorial do observatório, conferido no texto. */
  resumo: string;
  /** O que o próprio ato declara (literal); null nos eventos derivados de conjunto de dados. */
  efeito_declarado: string | null;
  /** Sempre null: o observatório não estima efeito de norma nesta linha do tempo. */
  impacto_estimado: null;
  temas: string[];
  paineis: PainelLink[];
  documento: string | null;
  trecho: string;
  nivel_conferencia: NivelConferenciaEvento;
  observacoes: string[];
  origem: "curadoria" | "conjunto_de_dados";
  trecho_confere: boolean | null;
  conferencia_detalhe: string;
  url_oficial: string | null;
  copia_publica: string | null;
  sha256: string | null;
  deliberacao: { data: string; reuniao: string } | null;
};

export type LinhaDoTempo = {
  conferido_em: string;
  nota: string;
  /** Ordenados por início de vigência, do mais recente ao mais antigo. */
  eventos: EventoRegulatorio[];
  temas: string[];
  paineis: PainelLink[];
};

/* ---------------------------------------------------------------- P046: consultas e agenda */

export type SituacaoConsulta =
  | "aberta"
  | "a_abrir"
  | "encerrada_aguardando"
  | "resultado_em_pauta"
  | "decidida"
  /** A ata informa só a duração, sem início nem fim. */
  | "prazo_nao_datado"
  /** Audiência com data de sessão e sem período de contribuições na ata. */
  | "sessao_sem_periodo"
  /** A ata não informa período, duração nem sessão. */
  | "sem_periodo_na_ata";

/** datas_explicitas = as duas datas escritas na ata; inicio_e_duracao = fim calculado. */
export type OrigemJanela = "datas_explicitas" | "inicio_e_duracao";

export type FaseConsulta = {
  fase: "abertura" | "2ª fase" | "3ª fase" | "reabertura" | "prorrogação";
  data_deliberacao: string;
  reuniao: string;
  inicio: string | null;
  fim: string | null;
  janela_origem: OrigemJanela | null;
  /** true = fim calculado do início e da duração escritos na ata, contando o dia do início. */
  fim_calculado: boolean;
  /** Duração declarada na decisão, quando houver (com ou sem datas). */
  duracao_dias: number | null;
  /** Data de sessão presencial ou virtual de audiência, quando informada. */
  sessao: string | null;
  /** Expressão da decisão de onde o período foi lido. */
  trecho_periodo: string | null;
};

export type ResultadoConsulta = {
  data: string;
  reuniao: string;
  ato: string | null;
  resultado_julgamento: string;
  decidido: boolean;
  decisao: string;
  /** numero_citado = a ata cita "nº N/AAAA"; processo = mesmo número de processo do SEI. */
  vinculo: "numero_citado" | "processo";
};

export type Consulta = {
  id: string;
  /** Tipo do aviso na ata (a decisão pode instaurar consulta com audiência). */
  modalidade: "Consulta Pública" | "Audiência Pública";
  /** Número do rótulo: o da ata ou, quando suspeito, o único outro número que o processo cita. */
  numero: number;
  /** NumAtoAdministrativo da linha de abertura, como a fonte registra. */
  numero_na_ata: number;
  ano: number;
  rotulo: string;
  /** Vezes em que outra linha do mesmo processo cita "nº N/AAAA" (confirma o número). */
  numero_citado: number;
  /** O mesmo número e ano aparecem em outro processo; as aberturas ficam separadas. */
  numero_em_conflito: boolean;
  /** Acima do total anual publicado (ano completo) ou não citado pelo próprio processo, que cita outro. */
  numero_suspeito: boolean;
  motivo_numero_suspeito: string | null;
  numero_citado_no_processo: number | null;
  tema: string;
  processos: string[];
  relator: string | null;
  deliberacao_abertura: { data: string; reuniao: string; decisao: string };
  fases: FaseConsulta[];
  fase_atual: FaseConsulta["fase"] | null;
  /** Janela da fase deliberada por último; null quando a ata não a data. */
  inicio: string | null;
  fim: string | null;
  janela_origem: OrigemJanela | null;
  fim_calculado: boolean;
  duracao_dias: number | null;
  /** Data de sessão da audiência na fase atual, quando informada. */
  sessao: string | null;
  /** Situação na data de referência da gold (recalcular com `situacaoConsulta`). */
  situacao: SituacaoConsulta;
  situacao_rotulo: string;
  resultado: ResultadoConsulta | null;
  agenda_codigos: string[];
};

export type CoberturaConsultas = {
  ano: number;
  nas_atas: number;
  total_anual_aneel: number;
  audiencias_nas_atas: number;
  audiencias_total_anual_aneel: number | null;
  /** Ano em curso no momento em que a fonte gerou as contagens anuais. */
  parcial: boolean;
  gerado_em: string | null;
};

export type FaixaCobertura = { de: number; ate: number; min_pct: number; max_pct: number } | null;

export type Consultas = {
  disponivel: boolean;
  motivo?: string;
  data_referencia: string;
  /** Data da última reunião registrada nas atas integradas. */
  atas_ate?: string | null;
  atas_geradas_em?: string | null;
  janela_dias?: number;
  itens: Consulta[];
  total_historico?: number;
  contagem_por_situacao: Partial<Record<SituacaoConsulta, number>>;
  cobertura: CoberturaConsultas[];
  /** Menor e maior cobertura anual (%) por modalidade entre 2020 e 2025. */
  cobertura_faixa?: { consultas: FaixaCobertura; audiencias: FaixaCobertura };
  numeros_suspeitos?: number;
  /** Atas com as duas datas e a duração: quantas contam o dia do início (inclusiva) e quantas não. */
  convencao_contagem_prazo?: { inclusiva: number; exclusiva: number; outra: number; casos: number };
  situacoes: Record<SituacaoConsulta, string>;
  regra_situacao?: string;
};

export type AtividadeAgenda = AtividadeResumo & {
  /** Regra por palavra-chave do texto da atividade (não é inferência de efeito). */
  paineis: PainelLink[];
  /** Consultas cujas atas citam o código exato da atividade. */
  consultas: string[];
};

export type RevisaoAgenda = {
  aprovada_por: string | null;
  atualizada_por: string | null;
  trecho: string | null;
  pagina: string;
};

export type Agenda = {
  disponivel: boolean;
  motivo?: string;
  versao?: string;
  portaria?: string;
  data_publicacao?: string;
  url_oficial?: string | null;
  copia_publica?: string | null;
  sha256?: string | null;
  revisao: RevisaoAgenda;
  itens: AtividadeAgenda[];
  por_ano?: Record<string, number>;
  regra_paineis?: string;
};

/* ---------------------------------------------------------------- gold */

export type ResumoRegulacao = {
  limites_hoje: LimitesVigentes & { data: string };
  ano_limites: number;
  atos_limites: number;
  anos_cobertos: number[];
  eventos_linha_do_tempo: number;
  consultas_abertas: number;
  consultas_na_janela: number;
  atividades_agenda: number;
};

export type GoldRegulacao = Cabecalho & {
  modulo: "regulacao";
  data_referencia: string;
  paineis: ["P044", "P045", "P046"];
  resumo: ResumoRegulacao;
  limites_pld: LimitesPld;
  /** Atividades da Agenda Regulatória que podem mudar os limites do PLD. */
  limites_em_revisao: AtividadeResumo[];
  regras_limites: RegrasLimites;
  bandeiras: Bandeiras;
  procedimentos: Procedimentos;
  linha_do_tempo: LinhaDoTempo;
  consultas: Consultas;
  agenda: Agenda;
  evidencias: {
    limites: Partial<Record<CampoLimite, Evidencia>>;
    consultas_abertas: Evidencia | null;
  };
  proveniencia: {
    limites: Proveniencia;
    bandeiras: Proveniencia;
    procedimentos: Proveniencia;
    linha_do_tempo: Proveniencia;
    consultas: Proveniencia;
    agenda: Proveniencia;
  };
  curadoria: {
    snapshot: { id: string | null; sha256: string | null };
    arquivos: { arquivo: string; sha256: string; registrado_em: string }[];
  };
  downloads: Download[];
  limitacoes: string[];
};

/* ---------------------------------------------------------------- regra de situação */

/** Fase deliberada por último (mesma ordenação de fase_atual() no Python). */
export function faseAtual(c: Pick<Consulta, "fases">): FaseConsulta | null {
  let melhor: FaseConsulta | null = null;
  for (const f of c.fases) {
    // chave (data_deliberacao, fim); em empate fica a primeira, como max() do Python
    if (
      !melhor ||
      f.data_deliberacao > melhor.data_deliberacao ||
      (f.data_deliberacao === melhor.data_deliberacao && (f.fim ?? "") > (melhor.fim ?? ""))
    ) {
      melhor = f;
    }
  }
  return melhor;
}

/**
 * Situação de uma consulta na data `hoje` (AAAA-MM-DD, horário de Brasília):
 * 1. resultado deliberado → decidida;
 * 2. resultado levado à reunião, sem decisão, depois da deliberação da fase atual → resultado_em_pauta;
 * 3. fase atual sem janela: só duração → prazo_nao_datado; só sessão → sessao_sem_periodo;
 *    nada → sem_periodo_na_ata (nunca "aberta");
 * 4. antes do início → a_abrir; entre início e fim, inclusive → aberta;
 * 5. depois do fim → encerrada_aguardando.
 */
export function situacaoConsulta(c: Pick<Consulta, "fases" | "resultado">, hoje: string): SituacaoConsulta {
  if (c.resultado?.decidido) return "decidida";
  const f = faseAtual(c);
  if (c.resultado && f && c.resultado.data > f.data_deliberacao) return "resultado_em_pauta";
  if (!f || !f.inicio || !f.fim) {
    if (f?.duracao_dias) return "prazo_nao_datado";
    if (f?.sessao) return "sessao_sem_periodo";
    return "sem_periodo_na_ata";
  }
  if (hoje < f.inicio) return "a_abrir";
  if (hoje <= f.fim) return "aberta";
  return "encerrada_aguardando";
}

/** Data de hoje no horário de Brasília (UTC−3 fixo desde 2019, sem horário de verão). */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}
