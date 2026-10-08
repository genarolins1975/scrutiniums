/**
 * Arquitetura de navegação do painel: panorama, três temas de exploração, comparador e métodos. Lógica pura (sem React),
 * usada pelo servidor, pelo cliente e pelos testes. Cada visão é uma rota estática; o recorte (capital, ano, medida,
 * moeda, etapa, disciplina, visualização) vive nos parâmetros de consulta, para que um link reabra o mesmo recorte e o
 * voltar/avançar do navegador percorra as escolhas.
 */
import type { EtapaId } from "./tipos";
import { MEDIDA, anosDaMedida, etapaValida, type DadosPainel, type MedidaId } from "./consulta";

export const ROTA_BASE = "/eficiencia-estatal/educacao-municipal-capitais";

export type Tema = "gastos" | "atendimento" | "resultados";
export const TEMAS: Tema[] = ["gastos", "atendimento", "resultados"];

export type DefinicaoTema = {
  id: Tema;
  rotulo: string;
  /** pergunta que organiza a visão */
  pergunta: string;
  /** uma frase, no máximo, para a abertura do tema */
  abertura: string;
  medidas: MedidaId[];
  medidaInicial: MedidaId;
  etapaInicial: EtapaId;
};

export const DEFINICAO_TEMA: Record<Tema, DefinicaoTema> = {
  gastos: {
    id: "gastos",
    rotulo: "Gastos",
    pergunta: "Quanto se gasta?",
    abertura: "Despesa liquidada em Educação em três escalas: o total, a relação com a população e a relação com as matrículas da rede.",
    medidas: ["despesa", "despesa_hab", "despesa_mat"],
    medidaInicial: "despesa_hab",
    etapaInicial: "anos_iniciais",
  },
  atendimento: {
    id: "atendimento",
    rotulo: "Atendimento",
    pergunta: "Quem é atendido?",
    abertura: "Matrículas na rede municipal, em escolas conveniadas e o tamanho médio das turmas, por etapa de ensino.",
    medidas: ["matriculas", "conveniadas", "atu"],
    medidaInicial: "atu",
    etapaInicial: "anos_iniciais",
  },
  resultados: {
    id: "resultados",
    rotulo: "Resultados",
    pergunta: "Quais resultados são observados?",
    abertura: "Taxa de aprovação, Ideb e proficiência no Saeb da rede municipal, nos anos iniciais e finais.",
    medidas: ["aprovacao", "ideb", "saeb"],
    medidaInicial: "ideb",
    etapaInicial: "anos_iniciais",
  },
};

export const ROTULO_NAVEGACAO: { id: "panorama" | Tema; rotulo: string; caminho: string }[] = [
  { id: "panorama", rotulo: "Panorama", caminho: "" },
  { id: "gastos", rotulo: "Gastos", caminho: "/gastos" },
  { id: "atendimento", rotulo: "Atendimento", caminho: "/atendimento" },
  { id: "resultados", rotulo: "Resultados", caminho: "/resultados" },
];

export const CAMINHO_COMPARAR = "/comparar";
export const CAMINHO_METODOS = "/metodos";

export type Parametros = Record<string, string | number | undefined | null>;

/** Endereço de uma visão, com os parâmetros que não valem o padrão. Valores vazios não entram. */
export function href(caminho: string, params: Parametros = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return `${ROTA_BASE}${caminho}${s ? `?${s}` : ""}`;
}

export const hrefTema = (t: Tema, params: Parametros = {}) => href(`/${t}`, params);

/** Tema a que pertence uma medida. */
export function temaDaMedida(m: MedidaId): Tema {
  const f = MEDIDA[m].familia;
  return f === "recursos" ? "gastos" : f === "atendimento" ? "atendimento" : "resultados";
}

/**
 * Ano efetivo de uma medida: o pedido, se a medida tem esse ano; senão o mais recente anterior; senão o primeiro. O Ideb e
 * o Saeb são bienais, e o ano exibido é sempre a edição, nunca um ano sem edição disfarçado.
 */
export function anoValido(d: DadosPainel, m: MedidaId, ano: number): number {
  const anos = anosDaMedida(d, m);
  if (anos.includes(ano)) return ano;
  const antes = anos.filter((a) => a <= ano);
  return antes.length ? antes[antes.length - 1] : anos[0];
}

/** Etapa efetiva: a pedida, se a medida a tem; senão a etapa inicial do tema, se a tem; senão a primeira da medida. */
export function etapaEfetiva(m: MedidaId, pedida: EtapaId, padrao: EtapaId): EtapaId {
  if (etapaValida(m, pedida)) return pedida;
  if (etapaValida(m, padrao)) return padrao;
  return MEDIDA[m].etapas?.[0] ?? padrao;
}

/** A etapa só altera o indicador onde a medida é desagregada por etapa. */
export const temEtapa = (m: MedidaId) => MEDIDA[m].etapas !== null;
