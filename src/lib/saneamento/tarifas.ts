import { apresentarEdicaoSinisa } from "./edicao";
import dados from "./dados/tarifas.json";

/**
 * Tarifas residenciais verificadas em atos oficiais, geradas por
 * pipeline/observatorio_saneamento/tarifas.py (que confere os exemplos de 10 e
 * 20 m³ antes de publicar). O simulador só ativa tabelas desta lista.
 */
export type Faixa = { de: number; ate: number | null; preco: number };
/**
 * Preço-base elevado a um expoente que depende da faixa de consumo (Corsan: PB × C^n). Abaixo de `minimoM3` fatura-se o mínimo
 * (0 quando a ligação medida não tem consumo mínimo).
 * `degraus` traz o primeiro consumo de cada faixa e o expoente dela; vale o último degrau cujo início não passa do consumo.
 */
export type Exponencial = { preco: number; minimoM3: number; degraus: { de: number; n: number }[] };
export type TabelaServico = { fixo?: number; minimo?: { m3: number; valor: number }; faixas: Faixa[]; exponencial?: Exponencial };
export type Esgoto = TabelaServico | { percentual: number };
/** consumoMaximo: m³ por mês até onde o ato define preço para a categoria; acima disso a conta não é calculada. */
export type Categoria = {
  rotulo: string;
  agua: TabelaServico;
  esgoto?: Esgoto;
  esgotoNaoVerificado?: string;
  consumoMaximo?: number;
  /** O prestador despreza a fração de metro cúbico (leitura e faturamento em m³ inteiros). */
  consumoInteiro?: boolean;
};
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
  /** Recorte da tabela dentro do prestador (município ou grupo com tabela própria), para os rótulos curtos. */
  recorte?: string;
  /** Tabela própria de um município ou grupo cujo prestador já tem outra tabela: entra no seletor, nas barras e no CSV, não no gráfico de curvas. */
  variante?: boolean;
  /** Regra de cobrança que o ato não diz por extenso e que a simulação assume; aparece junto da conta simulada. */
  metodoNaoVerificado?: string;
  observacoes: string[];
  exemplos: Record<string, Record<string, number>>;
  /** Contas calculadas pela planilha ou simulador oficial do prestador ou do regulador, recalculadas na coleta. */
  exemplosOficiais?: Record<string, Record<string, number>>;
  municipios: string[];
  acessado: string;
};

// Onda S1, 25/10/2026: corrigir o nome da edição na apresentação sem regravar a fonte tarifária.
export const TARIFAS = (dados as unknown as { tarifas: TarifaVerificada[] }).tarifas.map((t) => ({
  ...t,
  observacoes: t.observacoes.map(apresentarEdicaoSinisa),
}));
export const ACESSO_TARIFAS = (dados as { acessado: string }).acessado;

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/** Intervalo em que as tabelas foram consultadas, para o recorte das páginas. */
export function periodoConsultaTarifas(): string {
  const datas = TARIFAS.map((t) => t.acessado).sort();
  const ini = dataBr(datas[0]);
  const fim = dataBr(datas[datas.length - 1]);
  return ini === fim ? ini : `${ini} a ${fim}`;
}

export function tarifa(id: string): TarifaVerificada | undefined {
  return TARIFAS.find((t) => t.id === id);
}

/** Tarifa verificada aplicável ao município, quando houver. */
export function prestadorComTarifa(municipioId: string): string | null {
  return TARIFAS.find((t) => t.municipios.includes(municipioId))?.id ?? null;
}
