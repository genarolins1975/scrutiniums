import type { Municipio } from "./tipos";
import { razaoPct } from "./municipios";

/**
 * Catálogo das medidas municipais do Observatório do Saneamento: a única
 * definição de título, fonte, período, universo, numerador, denominador e
 * ressalva de cada medida que vai a mapa, tabela, comparação ou exportação.
 *
 * Regra de unidade: percentual e pessoas são variantes da mesma medida, com o
 * mesmo universo. Uma medida nunca mistura Censo 2022 (moradores) com SINISA
 * 2024 (população estimada) no mesmo numerador e denominador.
 */

export type Fonte = "censo2022" | "censo2010_2022" | "sinisa2024" | "nr8_sinisa2024";
export type Variante = "pct" | "pessoas";

export type Medida = {
  id: string;
  /** Rótulo curto para seletor e cabeçalho de tabela. */
  titulo: string;
  /** Pergunta a que responde, em linguagem do leitor. */
  pergunta: string;
  fonte: Fonte;
  periodo: string;
  /** Quem entra no denominador. */
  universo: string;
  /** Unidade do percentual (pct) e da contagem (pessoas); "pp" para variação. */
  unidadePct: string;
  unidadeContagem?: string;
  casas: number;
  /** Valor percentual (ou pp) e contagem, com null quando a medida não se aplica ao município. */
  pct: (m: Municipio) => number | null;
  contagem?: (m: Municipio) => number | null;
  /** Numerador e denominador para agregar pela soma (UF, região, Brasil, pares). */
  numerador?: (m: Municipio) => number | null;
  denominador?: (m: Municipio) => number | null;
  /** O que a medida permite observar e o que não permite concluir. */
  permite: string;
  naoPermite: string;
  /** Por que um município fica sem valor. */
  ausencia: string;
  /** Cortes fixos das classes do mapa (estáveis entre filtros) e paleta. */
  cortesPct: number[];
  cortesContagem?: number[];
  paleta?: "sequencial" | "divergente";
};

const pop22 = (m: Municipio) => m.pop22;
const somaSemRedeNemSeptica = (m: Municipio) =>
  m.c22_es_precario == null || m.c22_es_sem_banheiro == null ? null : m.c22_es_precario + m.c22_es_sem_banheiro;
const semRedeEsgoto = (m: Municipio) => (m.pop22 == null || m.c22_es_rede == null ? null : m.pop22 - m.c22_es_rede);
const naoAtendidaAgua = (m: Municipio) =>
  m.IAG0001 == null || m.dfe0001 == null || m.ag_pop_at == null ? null : Math.max(0, m.dfe0001 - m.ag_pop_at);
const naoAtendidaEsgoto = (m: Municipio) =>
  m.IES0001 == null || m.dfe0001 == null || m.es_pop_at == null ? null : Math.max(0, m.dfe0001 - m.es_pop_at);

export const FONTE_ROTULO: Record<Fonte, string> = {
  censo2022: "IBGE, Censo Demográfico 2022",
  censo2010_2022: "IBGE, Censos Demográficos 2010 e 2022",
  sinisa2024: "Ministério das Cidades, SINISA 2025 (ano de referência 2024)",
  nr8_sinisa2024: "SINISA 2025 (2024) e IBGE, pela ficha da NR ANA 8/2024",
};

export const MEDIDAS: Medida[] = [
  {
    id: "c22-agua-sem-ligacao",
    titulo: "Sem ligação à rede geral de água",
    pergunta: "Quantos moradores vivem em domicílios sem ligação à rede geral de água?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(m.c22_ag_sem, m.pop22),
    contagem: (m) => m.c22_ag_sem,
    numerador: (m) => m.c22_ag_sem,
    denominador: pop22,
    permite: "Localizar onde a rede geral não chega ao domicílio, em número de pessoas e em proporção dos moradores.",
    naoPermite:
      "Concluir que não há água adequada: parte desses moradores usa poço profundo, nascente ou cisterna. O Censo não mede potabilidade nem regularidade.",
    ausencia: "Município sem resultado no Censo 2022 (criado depois da coleta).",
    cortesPct: [5, 15, 30, 50],
    cortesContagem: [500, 2_000, 10_000, 50_000],
  },
  {
    id: "c22-agua-ligacao-outra-fonte",
    titulo: "Ligados à rede, mas usam outra fonte como principal",
    pergunta: "Quantos moradores têm ligação à rede, mas dependem principalmente de outra fonte?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(m.c22_ag_lig_outra, m.pop22),
    contagem: (m) => m.c22_ag_lig_outra,
    numerador: (m) => m.c22_ag_lig_outra,
    denominador: pop22,
    permite: "Distinguir ligação física e uso efetivo da rede como fonte principal.",
    naoPermite: "Atribuir a causa (intermitência, preço, qualidade percebida ou hábito): o Censo não pergunta o motivo.",
    ausencia: "Município sem resultado no Censo 2022.",
    cortesPct: [1, 3, 10, 25],
    cortesContagem: [100, 500, 2_000, 10_000],
  },
  {
    id: "c22-esgoto-sem-rede",
    titulo: "Sem rede geral, pluvial ou fossa ligada à rede",
    pergunta: "Quantos moradores não estão ligados a uma rede de esgoto ou pluvial?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(semRedeEsgoto(m), m.pop22),
    contagem: semRedeEsgoto,
    numerador: semRedeEsgoto,
    denominador: pop22,
    permite: "Medir a ausência de ligação a uma rede coletora, inclusive a pluvial.",
    naoPermite:
      "Separar soluções individuais adequadas: inclui quem usa fossa séptica não ligada à rede. Ligação à rede não garante tratamento do esgoto.",
    ausencia: "Município sem resultado no Censo 2022.",
    cortesPct: [25, 50, 75, 90],
    cortesContagem: [2_000, 10_000, 30_000, 100_000],
  },
  {
    id: "c22-esgoto-sem-rede-nem-septica",
    titulo: "Sem rede nem fossa séptica",
    pergunta: "Quantos moradores dependem de fossa rudimentar, vala, rio, lago ou mar, ou não têm banheiro?",
    fonte: "censo2022",
    periodo: "2022",
    universo: "Moradores em domicílios particulares permanentes ocupados",
    unidadePct: "%",
    unidadeContagem: "moradores",
    casas: 1,
    pct: (m) => razaoPct(somaSemRedeNemSeptica(m), m.pop22),
    contagem: somaSemRedeNemSeptica,
    numerador: somaSemRedeNemSeptica,
    denominador: pop22,
    permite: "Identificar onde predominam fossa rudimentar, vala, despejo em corpo d'água, outra forma ou ausência de banheiro.",
    naoPermite:
      "Verificar o funcionamento da fossa séptica declarada, que entra fora desta contagem; nem a qualidade da construção de cada solução.",
    ausencia: "Município sem resultado no Censo 2022.",
    cortesPct: [10, 25, 50, 75],
    cortesContagem: [1_000, 5_000, 20_000, 80_000],
  },
  {
    id: "sinisa-agua-nao-atendida",
    titulo: "Não atendidos por rede de água (prestador)",
    pergunta: "Segundo o prestador, quantos residentes não são atendidos pela rede de água?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "População residente estimada pelo IBGE para 2024 (DFE0001), municípios participantes",
    unidadePct: "%",
    unidadeContagem: "pessoas",
    casas: 1,
    pct: (m) => (m.IAG0001 == null ? null : Math.max(0, 100 - m.IAG0001)),
    contagem: naoAtendidaAgua,
    numerador: naoAtendidaAgua,
    denominador: (m) => (m.IAG0001 == null ? null : m.dfe0001),
    permite: "Comparar a população não atendida declarada pelo prestador com a estimativa de população do município.",
    naoPermite:
      "Somar com o Censo: a população e o ano são outros. A população atendida é declarada, não verificada no domicílio; soluções alternativas ficam fora.",
    ausencia: "Município não participou do módulo de água ou o indicador não foi calculado pela regra oficial.",
    cortesPct: [5, 15, 30, 50],
    cortesContagem: [500, 2_000, 10_000, 50_000],
  },
  {
    id: "sinisa-esgoto-nao-atendida",
    titulo: "Não atendidos por rede de esgoto (prestador)",
    pergunta: "Segundo o prestador, quantos residentes não são atendidos pela rede coletora?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "População residente estimada pelo IBGE para 2024 (DFE0001), municípios com indicadores de esgoto",
    unidadePct: "%",
    unidadeContagem: "pessoas",
    casas: 1,
    pct: (m) => (m.IES0001 == null ? null : Math.max(0, 100 - m.IES0001)),
    contagem: naoAtendidaEsgoto,
    numerador: naoAtendidaEsgoto,
    denominador: (m) => (m.IES0001 == null ? null : m.dfe0001),
    permite: "Medir o alcance da rede coletora declarada pelo prestador.",
    naoPermite:
      "Inferir tratamento: atendimento por rede coletora não assegura tratamento. Municípios com delegação sem atendimento não têm indicador calculado.",
    ausencia: "Município sem indicador de esgoto (não participou ou delegação sem atendimento).",
    cortesPct: [25, 50, 75, 90],
    cortesContagem: [2_000, 10_000, 30_000, 100_000],
  },
  {
    id: "evolucao-agua-rede",
    titulo: "Rede geral de água como fonte principal: variação 2010–2022",
    pergunta: "A parcela de moradores abastecidos principalmente pela rede geral subiu ou caiu entre os Censos?",
    fonte: "censo2010_2022",
    periodo: "2010 e 2022",
    universo: "Moradores em domicílios particulares permanentes (ocupados, em 2022)",
    unidadePct: "p.p.",
    casas: 1,
    pct: (m) => {
      const a = razaoPct(m.c22_ag_rede, m.pop22);
      const b = razaoPct(m.c10_ag_rede, m.c10_mor);
      return a == null || b == null ? null : a - b;
    },
    permite: "Comparar a mesma categoria (rede geral como forma principal) nos dois Censos.",
    naoPermite:
      "Atribuir a variação a uma política ou prestador. Limites municipais e domicílios ocupados podem ter mudado; municípios criados depois de 2010 ficam sem valor.",
    ausencia: "Município sem resultado em um dos Censos.",
    cortesPct: [-5, -1, 1, 5],
    paleta: "divergente",
  },
  {
    id: "evolucao-esgoto-rede",
    titulo: "Rede geral de esgoto ou pluvial: variação 2010–2022",
    pergunta: "A parcela de moradores ligados à rede geral de esgoto ou pluvial mudou entre os Censos?",
    fonte: "censo2010_2022",
    periodo: "2010 e 2022",
    universo: "Moradores em domicílios particulares permanentes (ocupados, em 2022)",
    unidadePct: "p.p.",
    casas: 1,
    pct: (m) => {
      const a = razaoPct(m.c22_es_rede_pluvial, m.pop22);
      const b = razaoPct(m.c10_es_rede, m.c10_mor);
      return a == null || b == null ? null : a - b;
    },
    permite: "Comparar a categoria rede geral ou pluvial, que existe nos dois questionários.",
    naoPermite:
      "Somar a fossa ligada à rede, separada só em 2022. A comparação é aproximada: em 2010 parte dessas ligações pode ter sido declarada como rede geral.",
    ausencia: "Município sem resultado em um dos Censos.",
    cortesPct: [-5, -1, 1, 5],
    paleta: "divergente",
  },
  {
    id: "sinisa-esgoto-tratado-coletado",
    titulo: "Esgoto tratado sobre coletado (IES2004)",
    pergunta: "Do volume coletado, quanto é tratado?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "Volume de esgoto coletado mais importado, municípios com indicador calculado",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.IES2004,
    permite: "Ver o destino do esgoto que a rede já coleta.",
    naoPermite: "Medir pessoas atendidas nem carga poluidora removida: é razão de volumes e ignora o que não é coletado.",
    ausencia: "Município sem indicador calculado pela regra oficial.",
    cortesPct: [25, 50, 75, 95],
  },
  {
    id: "sinisa-esgoto-tratado-consumido",
    titulo: "Esgoto tratado sobre água consumida (IES2003)",
    pergunta: "Quanto do volume equivalente à água consumida volta tratado?",
    fonte: "sinisa2024",
    periodo: "2024",
    universo: "Volume de água consumida, municípios atendidos com água pelo mesmo prestador",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.IES2003,
    permite: "Aproximar o tratamento do esgoto gerado, usando o consumo de água como referência.",
    naoPermite: "Tratar o consumo como medida exata da geração de esgoto, nem converter o percentual em pessoas.",
    ausencia: "Município sem indicador calculado pela regra oficial.",
    cortesPct: [25, 50, 75, 95],
  },
  {
    id: "nr8-iaa-rede",
    titulo: "IAA da NR 8, parcela de rede pública",
    pergunta: "Pela fórmula da ANA, que fração dos domicílios ocupados tem economia residencial ativa de água?",
    fonte: "nr8_sinisa2024",
    periodo: "2024",
    universo: "Domicílios ocupados estimados para 2024 (população estimada ÷ moradores por domicílio do Censo 2022)",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.iaa_rede,
    numerador: (m) => (m.iaa_rede == null ? null : m.nr8_ag_num),
    denominador: (m) => (m.iaa_rede == null ? null : m.dom_est24),
    permite: "Aproximar o indicador de atendimento da norma da ANA com dados públicos, sem soluções alternativas.",
    naoPermite:
      "Declarar cumprimento de meta: a ANA exige também o ICA, e soluções alternativas aceitas pelo regulador não estão no SINISA. Valores acima de 100% indicam economias ativas acima da estimativa de domicílios ocupados.",
    ausencia: "Município fora do módulo de água ou sem estimativa de domicílios.",
    cortesPct: [50, 75, 90, 99],
  },
  {
    id: "nr8-iae-rede",
    titulo: "IAE da NR 8, parcela de rede com tratamento",
    pergunta: "Pela fórmula da ANA, que fração dos domicílios ocupados tem economia residencial ativa com tratamento de esgoto?",
    fonte: "nr8_sinisa2024",
    periodo: "2024",
    universo: "Domicílios ocupados estimados para 2024 (população estimada ÷ moradores por domicílio do Censo 2022)",
    unidadePct: "%",
    casas: 1,
    pct: (m) => m.iae_rede,
    numerador: (m) => (m.iae_rede == null ? null : m.nr8_es_num),
    denominador: (m) => (m.iae_rede == null ? null : m.dom_est24),
    permite: "Aproximar o indicador de atendimento com coleta e tratamento da norma da ANA, sem soluções alternativas.",
    naoPermite:
      "Declarar cumprimento de meta: falta o ICE e as soluções individuais aceitas pelo regulador. Valores acima de 100% indicam economias acima da estimativa de domicílios ocupados.",
    ausencia: "Município sem informação de economias com tratamento no SINISA.",
    cortesPct: [25, 50, 75, 90],
  },
];

export function medida(id: string): Medida {
  const m = MEDIDAS.find((x) => x.id === id);
  if (!m) throw new Error(`medida desconhecida: ${id}`);
  return m;
}

/** Valor da variante pedida; "pessoas" só existe quando a medida tem contagem. */
export function valorMedida(med: Medida, m: Municipio, variante: Variante): number | null {
  if (variante === "pessoas") return med.contagem ? med.contagem(m) : null;
  return med.pct(m);
}

/** Agregação pela soma: pct = Σnumerador/Σdenominador; nunca média de percentuais municipais. */
export function agregarMedida(
  med: Medida,
  lista: readonly Municipio[],
): { pct: number | null; contagem: number | null; municipios: number; universo: number } {
  if (!med.numerador || !med.denominador) {
    return { pct: null, contagem: null, municipios: lista.filter((m) => med.pct(m) != null).length, universo: 0 };
  }
  let num = 0;
  let den = 0;
  let n = 0;
  for (const m of lista) {
    const a = med.numerador(m);
    const b = med.denominador(m);
    if (a == null || b == null || !(b > 0)) continue;
    num += a;
    den += b;
    n += 1;
  }
  return { pct: den > 0 ? (num / den) * 100 : null, contagem: n ? num : null, municipios: n, universo: den };
}
