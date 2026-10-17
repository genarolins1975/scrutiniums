/**
 * Tipos da gold do módulo Listadas (public/energia/gold/listadas.json), espelho do que
 * pipeline/energia/modulos/listadas.py publica, e do manifesto de logotipos
 * (public/energia/logos/manifesto.json, escrito por pipeline/energia/logos_listadas.py).
 *
 * Universo: a carteira do dia do Índice de Energia Elétrica (IEE) da B3. Potência em MW (não é
 * energia); finanças em R$ milhões nominais, consolidado; retornos em % no período. Ausência é
 * null. Nada é somado entre companhias: uma pode controlar parte da outra.
 */
import type { Evidencia } from "./evidencia";
import type { MotivoParada } from "./tipos-empresas";
import type { Cabecalho, Download, Proveniencia } from "./tipos";

export type UsinaListada = {
  nucleo: string;
  nome: string;
  tipo: string;
  fonte: string | null;
  fase: string;
  uf: string;
  mw: number | null;
  dono_cnpj: string;
  dono_nome: string | null;
  pct_dono: number | null;
  /** Degraus de controle entre a companhia listada e o dono direto (0 = a própria companhia). */
  nivel: number;
};

export type GeracaoListada = {
  usinas_controle: number;
  mw_controle: number;
  mw_proporcional: number;
  usinas_em_implantacao: number;
  mw_em_implantacao: number;
  por_tipo: { tipo: string; mw_controle: number; usinas: number; mw_proporcional: number }[];
  por_uf: { uf: string; mw_controle: number }[];
  /** Potência sob controle pelo número de degraus entre a companhia e o dono direto (0 = a própria companhia). */
  por_nivel: { nivel: number; mw_controle: number; usinas: number }[];
  maiores: UsinaListada[];
  em_implantacao: UsinaListada[];
  reconciliacao_grupo: {
    mw_controle_empresas: number | null;
    mw_proporcional_empresas: number | null;
    dif_controle: number | null;
    dif_proporcional: number | null;
  } | null;
};

export type TransmissaoListada = {
  concessionarias: number;
  km_circuito_operacao: number;
  km_circuito_implantacao: number;
  subestacoes_soma: number;
  mva_transformacao_operacao: number;
  ufs: string[];
  maiores: { cnpj: string; nome: string; km: number | null; mva: number | null; nivel: number }[];
};

export type DistribuidoraListada = {
  slug: string;
  sigla: string;
  nome: string | null;
  ufs: string[];
  ucs: number | null;
  ano: number | null;
  nivel: number;
};

export type Acionista = {
  nome: string;
  tipo: "PJ" | "coletivo" | string | null;
  rotulo_coletivo: "tesouraria" | "outros" | null;
  cnpj: string | null;
  pct_on: number | null;
  pct_pn: number | null;
  pct_total: number | null;
  acoes_total: number | null;
  controlador: boolean;
  acordo: boolean;
  nacionalidade: string | null;
  ultima_alteracao: string | null;
};

export type PessoasFisicas = { quantidade: number; controladores: number; pct_on: number; pct_pn: number; pct_total: number };

export type MudancaAcionaria = {
  acionista: string;
  cnpj: string | null;
  tipo: "entrada" | "saida" | "variacao";
  antes: number | null;
  depois: number | null;
};

export type ControleListada = {
  especie_fca: string | null;
  cadeia_acima: { cnpj: string; nome: string | null; pct: number | null }[];
  topo_cnpj: string;
  topo_nome: string | null;
  motivo_parada: MotivoParada;
  acima_sem_cnpj: string | null;
  empresas_sob_controle: number;
  fre: {
    data_referencia: string;
    versao: number;
    ano_formulario: number;
    acionistas: Acionista[];
    pessoas_fisicas: PessoasFisicas | null;
  } | null;
  mudancas: MudancaAcionaria[];
  mudancas_desde: { ano_formulario: number; data_referencia: string; versao: number } | null;
};

export type LinhaFinancas = {
  exercicio: number;
  receita: number | null;
  ebit: number | null;
  lucro_liquido: number | null;
  lucro_controladores: number | null;
  divida_bruta: number | null;
  patrimonio_liquido: number | null;
  ativo_total: number | null;
  caixa: number | null;
  caixa_operacional: number | null;
  caixa_investimento: number | null;
  margem_ebit_pct: number | null;
  divida_bruta_sobre_pl: number | null;
  lucro_sobre_pl_pct: number | null;
};

export type FinancasListada = {
  escopo: "consolidado";
  unidade: string;
  serie: LinhaFinancas[];
  ultimo_exercicio: number | null;
  alertas: string[];
  valores_reapresentados: number | null;
};

export type Retorno = { de: string; ate: string; preco_pct: number | null; total_pct: number | null };

export type BolsaListada = {
  papel: string;
  isin: string | null;
  primeiro_pregao: string;
  ultimo_pregao: string;
  pregoes: number;
  codigo_ultimo_pregao: string;
  fechamento: number;
  retorno_12m: Retorno | null;
  retorno_desde_2020: Retorno | null;
  retorno_no_ano: Retorno | null;
  /** Do primeiro pregão da série (estreia, ou recomeço depois de evento em ações sem fator publicado) ao último. */
  retorno_desde_inicio: Retorno | null;
  /** Data em que a série recomeça por evento em ações sem fator publicado pela B3; null quando não recomeça. */
  serie_reiniciada_em: string | null;
  volume_medio_diario_3m: number | null;
  pregoes_3m: number;
  /** [AAAA-MM, fechamento do último pregão do mês, índice de preço, índice de retorno total] (base 1 no primeiro pregão). */
  mensal: [string, number, number, number][];
  emendas: {
    codigo_anterior: string;
    isin_anterior: string;
    ultimo_pregao_anterior: string;
    primeiro_pregao: string;
    codigo: string;
    isin: string;
    razao_preco: number | null;
  }[];
  eventos_acoes: { data_com: string; data_ex: string; multiplicador: number }[];
  proventos_12m: number | null;
  proventos_eventos: number;
  bonificacoes_outra_classe: {
    data_com: string;
    valor: number;
    isin_emitido: string;
    fechamento_usado: number;
    data_fechamento: string;
    fator: number;
  }[];
  notas: string[];
  saltos: { data: string; variacao_pct: number }[];
  motivo?: string;
};

export type FatoRelevante = { data_entrega: string; assunto: string | null; link: string | null; protocolo: string | null };

export type CompanhiaListada = {
  papel: string;
  slug: string;
  emissor: string;
  cnpj: string | null;
  codigo_cvm: string | null;
  nome: string | null;
  nome_pregao: string;
  nome_anterior: string | null;
  data_nome: string | null;
  descricao_atividade: string | null;
  setor_cvm: string | null;
  pagina_web: string | null;
  fca: { data_referencia: string | null; versao: number | null };
  iee: { peso_pct: number; tipo: string; classe: string; segmento: string | null; segmento_nome: string | null; qtd_teorica: number | null };
  conferencia_cnpj: ConferenciaCnpj;
  atuacao: { geracao: boolean; transmissao: boolean; distribuicao: boolean; comercializacao_declarada: boolean; empresas_comercializacao: number };
  geracao: GeracaoListada;
  transmissao: TransmissaoListada | null;
  distribuicao: { distribuidoras: DistribuidoraListada[]; unidades_consumidoras: number | null; anos: number[] } | null;
  controle: ControleListada;
  financas: FinancasListada | null;
  bolsa: BolsaListada | null;
  movimentos: { fatos_relevantes_24m: number; desde: string; por_ano: Record<string, number>; recentes: FatoRelevante[] };
};

export type ConferenciaCnpj = {
  codigo_cvm_b3: string | null;
  cnpj_pelo_codigo_cvm: string | null;
  cnpjs_que_declaram_o_codigo: string[];
  resultado: "igual" | "divergente" | "parcial";
};

export type ListadasGold = Cabecalho & {
  datas: {
    carteira_iee: string;
    carteira_capturada_em: string;
    siga: string | null;
    siget: string | null;
    polimero_trimestre: string | null;
    ultimo_pregao: string | null;
    fre_anos: number[];
    ipe_desde: string;
    financas_ultimo_exercicio: number | null;
  };
  universo: { regra: string; papeis: number; companhias: number; soma_pesos_pct: number; nota: string };
  definicoes: Record<string, string>;
  companhias: CompanhiaListada[];
  ressalvas: string[];
  /** Arquivos lidos no build: evidências "Comprove este número" por papel. */
  series: { evidencias: string };
  proveniencia: {
    carteira: Proveniencia;
    ativos: Proveniencia;
    controle: Proveniencia;
    financas: Proveniencia | null;
    bolsa: Proveniencia;
    movimentos: Proveniencia;
  };
  downloads: Download[];
};

export type LogoListada = {
  papel: string;
  nome_exibicao: string;
  cnpj_holding: string;
  grupo_cnpj: string;
  topo_igual_holding: boolean;
  arquivo: string | null;
  formato: "svg" | "png" | null;
  fundo: "claro" | "escuro" | null;
  largura: number | null;
  altura: number | null;
  url_origem: string | null;
  pagina_origem: string | null;
  capturado_em: string | null;
  sha256: string | null;
  bytes: number | null;
  ausencia: { motivo: string } | null;
};

export type EvidenciasListadas = { gerado_em: string; evidencias: Record<string, { mw_controle?: Evidencia; retorno_total_12m?: Evidencia }> };

export type ManifestoLogos = { gerado_em: string; regras: string; logos: LogoListada[] };
