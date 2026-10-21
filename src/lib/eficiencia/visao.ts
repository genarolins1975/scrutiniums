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


/** Nome curto e uma frase de definição de cada medida, para cartões, abas e legendas (a ressalva essencial acompanha o número). */
export const DEFINICAO_CURTA: Record<MedidaId, { titulo: string; texto: string }> = {
  despesa: { titulo: "Total", texto: "Escala orçamentária: volume da despesa liquidada na função Educação. Depende do tamanho da cidade." },
  despesa_hab: { titulo: "Por habitante", texto: "Relação com a população do território: despesa liquidada ÷ população residente. Não é gasto por aluno." },
  despesa_mat: { titulo: "Por matrícula", texto: "Despesa de aplicação direta ÷ matrículas da rede municipal. Razão orçamentária, não custo do aluno: o denominador não inclui as escolas privadas conveniadas, e o numerador inclui a aplicação direta com beneficiário indeterminado (serviços de terceiros, auxílios)." },
  matriculas: { titulo: "Matrículas na rede", texto: "Matrículas nas escolas municipais, por etapa. Uma matrícula não é uma pessoa." },
  conveniadas: { titulo: "Em escolas conveniadas", texto: "Matrículas em escolas privadas conveniadas só com o município; contadas à parte da rede." },
  atu: { titulo: "Alunos por turma", texto: "Tamanho médio das turmas na rede municipal, por etapa." },
  aprovacao: { titulo: "Taxa de aprovação", texto: "Parcela dos estudantes aprovados ao fim do ano letivo, por etapa." },
  ideb: { titulo: "Ideb", texto: "Índice de Desenvolvimento da Educação Básica, de 0 a 10: combina a nota no Saeb (Sistema de Avaliação da Educação Básica) e o fluxo escolar; edições bienais." },
  saeb: { titulo: "Proficiência no Saeb", texto: "Proficiência média em prova nacional, em escala própria por disciplina; edições bienais." },
};


/** Aviso de leitura das referências do grupo, próprio de cada tipo de medida (gasto, atendimento, resultado). */
export function avisoDoGrupo(m: MedidaId): string {
  const base = "A mediana e a média simples descrevem o grupo de capitais; não são meta nem padrão.";
  if (m === "despesa" || m === "despesa_hab" || m === "despesa_mat") return `${base} Menor gasto não demonstra eficiência, e gasto maior não demonstra qualidade.`;
  if (m === "matriculas" || m === "conveniadas" || m === "atu")
    return `${base} Uma rede maior ou turmas menores não demonstram, por si, mais ou menos qualidade: dependem da demanda, da população em idade escolar e da política de cada município.`;
  return `${base} O resultado observado não mede o efeito da gestão municipal: reflete também o perfil socioeconômico dos estudantes e a trajetória de cada rede. Aprovação, Ideb e Saeb têm periodicidade própria e não coincidem com o ano da despesa.`;
}

/** O que o painel de cada tema não mostra: ausências que limitam a leitura e que uma decisão exigiria complementar. */
export const NAO_MOSTRA: Record<Tema, string> = {
  gastos:
    "Não mostra o gasto por escola nem por etapa de ensino (só a composição por subfunção, no detalhe), despesas de outras funções orçamentárias que apoiam a educação, despesas das redes estadual, federal e privada no mesmo território, nem o custo do aluno. Antes de decidir, falta saber o que cada município classifica na função Educação e o que mantém fora dela.",
  atendimento:
    "Não mostra a demanda por vaga, a cobertura sobre a população em idade escolar nem diferenças por renda, raça, deficiência ou localização do estudante. Conta matrículas e turmas da rede municipal (as escolas conveniadas, à parte); as redes estadual, federal e privada ficam fora.",
  resultados:
    "Não mostra resultados por grupo de estudantes (renda, raça, deficiência, localização), por escola nem do conjunto das redes do município. Aprovação, Ideb e Saeb são da rede municipal, em etapas e edições próprias, e não demonstram o efeito de uma política ou de uma gestão.",
};

/** Por que uma medida não tem referência nacional utilizável: dito em vez de calar. */
export const SEM_NACIONAL: Record<MedidaId, string> = {
  despesa: "A despesa total é volume e depende do tamanho da cidade: não há referência nacional comparável.",
  despesa_hab: "Não há indicador oficial de despesa municipal em Educação por habitante, e o cálculo do OBEE com dados do Siconfi/STN e do IBGE não está disponível para este exercício.",
  despesa_mat: "Há o investimento público direto por estudante do INEP (todas as redes públicas e esferas), publicado só até 2021, de outro universo.",
  matriculas: "A matrícula absoluta depende do tamanho da rede: não há referência nacional comparável.",
  conveniadas: "A matrícula em escolas conveniadas depende do tamanho da rede e da política de parceria de cada município: não há referência nacional comparável.",
  atu: "A referência nacional da rede municipal do INEP existe para creche, pré-escola e anos iniciais e finais.",
  aprovacao: "A referência nacional da rede municipal do INEP existe para anos iniciais e anos finais.",
  ideb: "A referência nacional da rede municipal do INEP existe para anos iniciais e anos finais, nas edições bienais.",
  saeb: "A referência nacional da rede municipal do INEP existe para anos iniciais e anos finais, nas edições bienais.",
};

/** Universo a que a medida se refere: o gasto total e por habitante é do orçamento do município, não só da rede de escolas. */
export function universoDaMedida(m: MedidaId): string {
  return m === "despesa" || m === "despesa_hab" ? "orçamento do município, função Educação" : "rede municipal";
}

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
