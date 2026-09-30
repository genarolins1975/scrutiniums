/**
 * Catálogo de métricas do domínio Energia (fonte única de definição). A definição
 * é escrita no pipeline (pipeline/energia/metricas/*.py), validada lá e publicada em
 * public/energia/gold/metricas.json; a interface só lê. Nenhuma fórmula é
 * reimplementada em componente: o valor exibido vem calculado da gold.
 */
import { lerGold } from "./gold";
import type { Cabecalho, Natureza } from "./tipos";

export type DefinicaoMetrica = {
  id: string;
  titulo: string;
  pergunta: string;
  definicao: string;
  unidade: string;
  grao_geografico: string;
  grao_temporal: string;
  fontes: string[];
  numerador?: string;
  denominador?: string;
  formula?: string;
  regra_agregacao: string;
  versao_formula: string;
  natureza_fonte: string;
  natureza_transformacao: Natureza;
  dimensoes: string[];
  regras_comparabilidade: string[];
  regra_cobertura: string;
  politica_ausencia: string;
  validacoes: string[];
  limitacoes: string[];
  gold: string;
  paginas: string[];
  arquivo: string;
};

export type MetricasGold = Cabecalho & { metricas: DefinicaoMetrica[] };

export function metricas(): DefinicaoMetrica[] {
  return lerGold<MetricasGold>("metricas.json")?.metricas ?? [];
}

export function metrica(id: string): DefinicaoMetrica | undefined {
  return metricas().find((m) => m.id === id);
}
