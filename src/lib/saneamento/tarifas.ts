import dados from "./dados/tarifas.json";

/**
 * Tarifas residenciais verificadas em atos oficiais, geradas por
 * pipeline/observatorio_saneamento/tarifas.py (que confere os exemplos de 10 e
 * 20 m³ antes de publicar). O simulador só ativa tabelas desta lista.
 */
export type Faixa = { de: number; ate: number | null; preco: number };
export type TabelaServico = { fixo?: number; minimo?: { m3: number; valor: number }; faixas: Faixa[] };
export type Esgoto = TabelaServico | { percentual: number };
export type Categoria = { rotulo: string; agua: TabelaServico; esgoto?: Esgoto; esgotoNaoVerificado?: string };
export type FonteTarifa = { rotulo: string; url: string; sha256: string; localizador: string };
export type TarifaVerificada = {
  id: string;
  prestador: string;
  prestadorSinisa: string;
  uf: string;
  regulador: string;
  modelo: string;
  ato: string;
  vigencia: string;
  ultimoReajuste: string;
  area: string;
  fontes: FonteTarifa[];
  unidade: string;
  categorias: Record<string, Categoria>;
  adicionais?: { id: string; rotulo: string; percentual: number; nota: string }[];
  observacoes: string[];
  exemplos: Record<string, Record<string, number>>;
  municipios: string[];
  acessado: string;
};

export const TARIFAS = (dados as unknown as { tarifas: TarifaVerificada[] }).tarifas;
export const ACESSO_TARIFAS = (dados as { acessado: string }).acessado;

export function tarifa(id: string): TarifaVerificada | undefined {
  return TARIFAS.find((t) => t.id === id);
}

/** Tarifa verificada aplicável ao município, quando houver. */
export function prestadorComTarifa(municipioId: string): string | null {
  return TARIFAS.find((t) => t.municipios.includes(municipioId))?.id ?? null;
}
