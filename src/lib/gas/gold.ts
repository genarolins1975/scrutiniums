/**
 * Leitura da gold do Observatório de Gás Natural (public/gas/gold, escrita por pipeline/gas/gold.py).
 *
 * As páginas são estáticas (force-static): a leitura acontece no build, no servidor. Ausência é null
 * nas séries e nos indicadores; nada aqui completa, interpola ou arredonda valor.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Natureza = "OBSERVADO" | "CALCULADO";

export type Indicador = {
  rotulo: string;
  unidade: string;
  natureza: Natureza;
  fontes: string[];
  periodo: string;
  valor: number | string | null;
  formula?: string;
  nota?: string;
  recorte?: string;
};

type Cabecalho = {
  dominio: "gas";
  gold: string;
  versao_pipeline: string;
  versao_codigo: string;
  dados_capturados_em: string | null;
  fontes: string[];
};

export type Ponto = Record<string, string | number | null>;

export type ProducaoGold = Cabecalho & {
  ultimo_mes: string;
  indicadores: Record<string, Indicador>;
  serie: { mes: string; total: number | null; mar: number | null; terra: number | null }[];
  anual: { ano: string; bilhoes_m3: number; mar_pct: number }[];
  por_uf: { uf: string; codigo: string; nome: string; regiao: string; mmd_12m: number; participacao_pct: number; mar_pct: number; variacao_12m_pct: number | null }[];
  ufs_serie: string[];
  serie_uf: Ponto[];
  notas: string[];
};

export type AproveitamentoGold = Cabecalho & {
  ultimo_mes: string;
  indicadores: Record<string, Indicador>;
  serie: (Ponto & { mes: string; situacao: "ok" | "inconsistente" })[];
  anual: Ponto[];
  por_uf: { uf: string; nome: string; producao_mmd_12m: number; reinjecao_pct: number; queima_pct: number; consumo_proprio_pct: number; disponivel_pct: number }[];
  meses_inconsistentes: { mes: string; diferenca_pct: number; motivo: string }[];
};

export type ImportacaoGold = Cabecalho & {
  ultimo_mes: string;
  ultimo_mes_comex: string;
  indicadores: Record<string, Indicador>;
  serie: { mes: string; importado: number | null; dispendio_musd: number | null; preco_implicito_usd_mil_m3: number | null; participacao_pct: number | null }[];
  comex_anual: { ano: string; meses: number; gasoso_mil_t: number; gnl_mil_t: number; gasoso_musd: number; gnl_musd: number; paises: number }[];
  origem_12m: { pais: string; gasoso_mil_t: number; gnl_mil_t: number; musd: number; participacao_massa_pct: number }[];
  periodo_origem: string;
};

export type PrecosGold = Cabecalho & {
  ultimo_mes: string;
  ultimo_mes_internacional: string | null;
  indicadores: Record<string, Indicador>;
  serie: Ponto[];
  regioes: { id: string; mercado: string; regiao: string }[];
  internacional: { mes: string; henry_hub: number | null; ttf: number | null; gnl_japao: number | null; brasil_nao_termico_usd: number | null; ptax: number | null }[];
  produtores: Ponto[];
  bacias: string[];
  comercializadores: { mes: string; preco: number | null; volume: number | null }[];
  atualizado_banco_mundial: string | null;
};

export type PrecoUf = {
  uf: string; codigo: string; nome: string; regiao: string; medio: number; minimo: number | null; maximo: number | null; postos: number | null;
  medio_ano_anterior: number | null; variacao_12m_pct: number | null;
};

export type IpcaBloco = {
  ultimo_mes: string;
  indicadores: Record<string, Indicador>;
  doze_meses: { mes: string; geral: number | null; botijao: number | null; encanado: number | null; veicular: number | null }[];
  indice: { mes: string; geral: number | null; botijao: number | null; encanado: number | null; veicular: number | null }[];
};

export type PrecoConsumidorGold = Cabecalho & {
  ultimo_mes: string;
  mes_base_real: string;
  indicadores: Record<string, Indicador>;
  serie: { mes: string; medio: number | null; minimo: number | null; maximo: number | null; postos: number | null; medio_real: number | null }[];
  por_uf: PrecoUf[];
  serie_uf: Ponto[];
  ipca: IpcaBloco;
  vendas?: {
    ultimo_mes: string;
    serie: { mes: string; ate_p13: number; outros: number }[];
    por_uf: { uf: string; nome: string; ate_p13_mil_m3_12m: number; p13_pct: number }[];
    indicadores: Record<string, Indicador>;
  };
};

export type MercadoGold = Cabecalho & {
  ultimo_mes: string;
  indicadores: Record<string, Indicador>;
  carregadores: (Ponto & { mes: string; ativos: number | null; ativos_registrados: number; cobertura: "completa" | "incompleta" })[];
  transportadoras: string[];
  transportadoras_nome: Record<string, string>;
  secundario: { mes: string; comercializadores: number | null; produtores: number | null }[];
};

export type InfraestruturaGold = Cabecalho & {
  ultimo_mes: string;
  indicadores: Record<string, Indicador>;
  entregas: (Ponto & { mes: string; cobertura: "completa" | "incompleta" })[];
  transportadoras: string[];
  transportadoras_nome: Record<string, string>;
  quebras: { mes: string; transportadora: string; razao: number }[];
  autorizacoes_por_ano: Ponto[];
  grupos_autorizacao: string[];
  terminais_gnl: { terminal: string; local: string; empresa: string; instalacao: string; ato: string; tipo: string; data: string; capacidade_informada: string | null }[];
  meses_incompletos: { mes: string; motivo: string[] }[];
};

export type FonteGas = {
  id: string; orgao: string; conjunto: string; pagina: string; url: string | null; licenca: string; frequencia: string; unidade: string;
  nota: string | null; recorte: string | null; capturado_em: string | null; sha256_original: string | null; bytes_original: number | null;
  seed: string; arquivos_origem: number | null;
};

export type MetaGold = Omit<Cabecalho, "fontes"> & {
  fontes: FonteGas[];
  ultimos_meses: Record<string, string | undefined>;
  series: { id: string; arquivo: string; descricao: string; fontes: string[]; linhas: number }[];
};

const PASTA = join(process.cwd(), "public", "gas", "gold");
const cache = new Map<string, unknown>();

function ler<T>(nome: string): T {
  if (!cache.has(nome)) cache.set(nome, JSON.parse(readFileSync(join(PASTA, `${nome}.json`), "utf-8")));
  return cache.get(nome) as T;
}

export const goldGas = {
  producao: () => ler<ProducaoGold>("producao"),
  aproveitamento: () => ler<AproveitamentoGold>("aproveitamento"),
  importacao: () => ler<ImportacaoGold>("importacao"),
  precos: () => ler<PrecosGold>("precos"),
  glp: () => ler<PrecoConsumidorGold>("gas-de-cozinha"),
  gnv: () => ler<PrecoConsumidorGold>("gnv-e-gas-encanado"),
  mercado: () => ler<MercadoGold>("mercado"),
  infraestrutura: () => ler<InfraestruturaGold>("infraestrutura"),
  meta: () => ler<MetaGold>("meta"),
};

/** Fontes da meta pelo id, na ordem pedida. */
export function fontesPorId(ids: string[]): FonteGas[] {
  const todas = goldGas.meta().fontes;
  return ids.map((id) => todas.find((f) => f.id === id)).filter((f): f is FonteGas => Boolean(f));
}
