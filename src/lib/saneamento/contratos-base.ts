/**
 * Tipos e funções puras do capítulo 15 do Saneamento (contratado desde o novo marco), sem acesso a arquivo: usados no
 * servidor (contratos.ts, que lê a gold) e nos componentes de cliente (Contratado.tsx).
 */

export type Tipo = "concessao" | "ppp" | "privatizacao" | "alienacao_de_acoes";
export type Resultado = "adjudicado" | "sem_propostas" | "suspenso" | "anulado";
export type Grau = "V" | "S";
export type TipoFonte = "documento_oficial" | "noticia_oficial" | "imprensa";
export type Indicador = "ICA" | "ICE" | "IEC" | "IPL";

export type FonteLinha = { url: string; titulo: string; data: string; grau: Grau; tipo_fonte: TipoFonte; acessado_em: string };

export type Leilao = {
  id: string;
  uf: string;
  poder_concedente: string;
  objeto: string;
  data_leilao: string;
  tipo: Tipo;
  resultado: Resultado;
  vencedor: string | null;
  outorga_rs_mi: number | null;
  contraprestacao_rs_mi: number | null;
  investimento_previsto_rs_mi: number | null;
  municipios: number | null;
  populacao_mi: number | null;
  prazo_anos: number | null;
  servicos: "agua_esgoto" | "agua" | "esgoto";
  fonte: FonteLinha;
  observacoes: string | null;
};

export type SomaNatureza = { soma: number; linhas_que_informam: number; linhas_sem_dado: number };

export type Totais = {
  criterio: string;
  leiloes_registrados: number;
  contratos_de_servico_adjudicados: number;
  nos_totais: number;
  fora_dos_totais: { id: string; motivo: string }[];
  outorga_rs_mi: SomaNatureza;
  contraprestacao_rs_mi: SomaNatureza;
  investimento_previsto_rs_mi: SomaNatureza;
  municipios: SomaNatureza;
  populacao_mi: SomaNatureza;
};

/** Meta de contrato: ano civil quando o documento fixa o calendário; ano de contrato (0 = início) quando só conta anos do contrato. */
export type Meta = { indicador: Indicador; ano: number | null; ano_contrato: number | null; valor: number };
export type Calendario = "civil" | "contratual";
export type NivelMetas = "contrato" | "por_municipio" | "por_area";
export type FaixaInicial = {
  chave: "ano" | "ano_contrato";
  primeiro: number;
  min: number;
  max: number;
  entidades: number;
  ultimo: number;
  min_ultimo: number;
  max_ultimo: number;
  rotulo_primeiro: string | null;
  rotulo_ultimo: string | null;
};

export type Contrato = {
  id: string;
  nome: string;
  uf: string;
  concessionaria: string;
  documento: { titulo: string; url: string; sha256: string; capturado_em: string; paginas_metas?: string | null } | null;
  clausula: string | null;
  versao_documento: string | null;
  calendario: Calendario | null;
  nivel: NivelMetas | null;
  inicio_contagem: string | null;
  fim_contrato: number | null;
  metas: Meta[];
  observacoes: string | null;
  situacao: "transcrito" | "documento_nao_localizado" | "documento_sem_metas_por_ano";
  blocos: string[];
  ultimo_ano_meta: number | null;
  ultimo_ano_contrato: number | null;
  /** Municípios ou áreas com curva própria no documento (arquivo metas_municipios.csv). */
  entidades_com_metas: number;
  faixa_inicial: Partial<Record<Indicador, FaixaInicial>>;
};

export type NaoLido = { id: string; nome: string; motivo: string; tentativas?: string[] };

export type Bloco = {
  id: string;
  rotulo: string;
  contrato: string;
  inicio: string;
  fim: string | null;
  fonte: { url: string; titulo?: string; grau: "oficial" | "secundaria"; acessado_em: string };
  declarado_municipios: number | null;
  observacoes?: string | null;
  municipios: { ibge: string; nome: string; uf: string; parcial: string | null }[];
};

export type Ponderado = { valor: number | null; municipios_com_dado: number; populacao: number };

export type Posicao = {
  bloco: string;
  rotulo: string;
  contrato: string;
  municipios: number;
  municipios_divididos_por_zona: string[];
  pop24: number;
  pop22: number;
  sinisa_2024: { IAG0001: Ponderado; IES0001: Ponderado; IES0007: Ponderado };
  censo: { agua_rede_2010: number | null; agua_rede_2022: number | null; esgoto_rede_2010: number | null; esgoto_rede_2022: number | null };
  meta_contratual_ate_2024: Partial<Record<Indicador, number>>;
  ressalva: string;
};

export type Estimativa = {
  id: string;
  natureza: "custo_universalizacao" | "contratado";
  autor: string;
  titulo: string;
  valor_rs_bi: number;
  base_preco: string;
  horizonte: string;
  perimetro: string;
  metodo?: string;
  parte_interessada?: boolean;
  fonte: { url: string; titulo?: string; data: string; grau: Grau; acessado_em?: string };
  observacoes?: string | null;
};

export type GoldContratado = {
  versao: number;
  capturado_em: string;
  marco: { lei: string; ano: number; meta_legal: { agua: number; esgoto: number; ano: number } };
  leiloes: Leilao[];
  totais: Totais;
  proxy_sinisa: { instrumento: string; desde: number; vinculos_por_ano: Record<string, number>; municipios: number };
  contratos: Contrato[];
  nao_lidos: NaoLido[];
  abrangencia: Bloco[];
  posicao_2024: Posicao[];
  /** Blocos cuja composição municipal não foi localizada em documento público, ou sem contrato adjudicado: fora da posição. */
  abrangencia_nao_localizada: { id: string; contrato: string; declarado_municipios: number | null; motivo: string; fonte: { url: string; titulo?: string | null; grau: "oficial" | "secundaria"; acessado_em: string } }[];
  /** Projetos em estruturação, ainda sem leilão: só registro, nunca contados. */
  em_estruturacao: { nome: string; uf: string | null; investimento_previsto_rs_mi: number | null; situacao: string | null; fonte: { url?: string; titulo?: string; data?: string; grau?: string } | null; observacoes: string | null }[];
  custos: Estimativa[];
  custos_nao_localizados: { id: string; autor: string; titulo: string; motivo: string; observacoes?: string | null }[];
  hash_dados: string;
};

export type ResumoContratado = {
  capturado_em: string;
  leiloes_registrados: number;
  contratos_de_servico_adjudicados: number;
  nos_totais: number;
  investimento_previsto_rs_mi: number;
  investimento_linhas: number;
  contratos_com_metas: number;
  contratos_calendario_civil: number;
  entidades_com_metas: number;
  indicadores_transcritos: Indicador[];
  blocos_com_abrangencia: number;
  municipios_proxy_sinisa: number;
  estimativas_de_custo: number;
  hash_dados: string;
};

/** A linha conta nos totais: concessão ou PPP, adjudicada, com fonte conferida (mesma regra de fontes.py). */
export function nosTotais(l: Leilao): boolean {
  return (l.tipo === "concessao" || l.tipo === "ppp") && l.resultado === "adjudicado" && l.fonte.grau === "V";
}

export const ROTULO_TIPO: Record<Tipo, string> = {
  concessao: "Concessão",
  ppp: "PPP",
  privatizacao: "Privatização",
  alienacao_de_acoes: "Venda de ações",
};

export const ROTULO_RESULTADO: Record<Resultado, string> = {
  adjudicado: "Adjudicado",
  sem_propostas: "Sem propostas",
  suspenso: "Suspenso",
  anulado: "Anulado",
};

export const ROTULO_GRAU: Record<Grau, string> = {
  V: "Conferido na fonte",
  S: "Só fonte secundária",
};

export const ROTULO_TIPO_FONTE: Record<TipoFonte, string> = {
  documento_oficial: "Documento oficial",
  noticia_oficial: "Notícia oficial",
  imprensa: "Imprensa",
};

export const ROTULO_INDICADOR: Record<Indicador, string> = {
  ICA: "Cobertura de água (ICA)",
  ICE: "Cobertura de esgoto (ICE)",
  IEC: "Tratamento do esgoto coletado (IEC)",
  IPL: "Perdas de água (IPL)",
};

export const ROTULO_SERVICOS: Record<Leilao["servicos"], string> = {
  agua_esgoto: "Água e esgoto",
  agua: "Água",
  esgoto: "Esgoto",
};

/** R$ milhões da fonte em texto: bilhões com uma casa quando passa de mil milhões. */
export function reaisMi(v: number | null | undefined): string {
  if (v == null) return "sem dado";
  const f = (x: number, casas: number) => x.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return v >= 1000 ? `R$ ${f(v / 1000, 1)} bi` : `R$ ${f(v, 0)} mi`;
}

/** Chave de tempo das metas do contrato: ano civil ou ano de contrato. */
export function chaveTempo(c: Pick<Contrato, "calendario">): "ano" | "ano_contrato" {
  return c.calendario === "contratual" ? "ano_contrato" : "ano";
}

/** Valor da meta num ano civil: a última meta do indicador com ano menor ou igual ao pedido ("vale de cada ano em diante"). Só
 * para contratos de calendário civil; os de calendário contratual devolvem null, porque não se situam em ano civil sem inferência. */
export function metaNoAno(c: Pick<Contrato, "metas" | "calendario">, indicador: Indicador, ano: number): number | null {
  if (c.calendario === "contratual") return null;
  const serie = c.metas.filter((m) => m.indicador === indicador && m.ano != null && m.ano <= ano).sort((a, b) => a.ano! - b.ano!);
  return serie.length ? serie[serie.length - 1].valor : null;
}

/** Série de um indicador, no tempo do contrato (ano civil ou ano de contrato), com os anos sem linha preenchidos pela regra "vale em diante". */
export function serieAnual(c: Pick<Contrato, "metas" | "calendario">, indicador: Indicador, ate: number): { ano: number; valor: number | null }[] {
  const chave = chaveTempo(c);
  const pontos = c.metas.filter((m) => m.indicador === indicador && m[chave] != null).map((m) => ({ t: m[chave] as number, v: m.valor })).sort((a, b) => a.t - b.t);
  if (!pontos.length) return [];
  const inicio = pontos[0].t;
  const fim = Math.max(ate, pontos[pontos.length - 1].t);
  const out: { ano: number; valor: number | null }[] = [];
  for (let a = inicio; a <= fim; a++) {
    const ate_a = pontos.filter((p) => p.t <= a);
    out.push({ ano: a, valor: ate_a.length ? ate_a[ate_a.length - 1].v : null });
  }
  return out;
}

/** Rótulo de um instante no tempo do contrato: "2033" ou "Ano 12". */
export function rotuloTempo(c: Pick<Contrato, "calendario">, t: number): string {
  return c.calendario === "contratual" ? `Ano ${t}` : String(t);
}
