/**
 * Dados do panorama editorial: três capítulos (recursos, atendimento e resultados). O capítulo de recursos traz as três
 * escalas do gasto (total, por habitante e por matrícula) como abas; os de atendimento e resultados trazem uma medida
 * cada, com a referência nacional ao lado. Cada medida leva as capitais com dado comparável, os extremos (todas as
 * capitais empatadas), a referência do grupo e a referência externa quando válida. Montado no servidor com as mesmas
 * regras de elegibilidade das demais visões (`comparar`), de modo que o HTML inicial já traz a informação e o cliente
 * recebe só os pontos de cada medida, não a base inteira.
 */
import type { EtapaId } from "./tipos";
import {
  Indice,
  MEDIDA,
  anosDaMedida,
  comparar,
  componente,
  etapaDaMedida,
  formata,
  nacionalCalculada,
  ehDespesa,
  perimetroIntra,
  textoPerimetroIntra,
  nomeEtapa,
  referenciasExternas,
  unidade,
  type DadosPainel,
  type Disciplina,
  type MedidaId,
} from "./consulta";
import { fraseAmplitude, fraseCobertura, type ItemFrase } from "./frases";
import { inteiro } from "./formato";
import { DEFINICAO_CURTA, SEM_NACIONAL, universoDaMedida, type Tema } from "./visao";

export type PontoCapitulo = { id: string; cod: number; nome: string; uf: string; valor: number };

export type ReferenciaCapitulo = {
  mediana: number | null;
  media: number | null;
  minimo: number | null;
  maximo: number | null;
  q1: number | null;
  q3: number | null;
  quartisExibicao: boolean;
  n: number;
};

export type ReferenciaExternaCapitulo = {
  rotulo: string;
  valor: number;
  /** valor já formatado na unidade da medida */
  valorTexto: string;
  /** o que o valor é, em poucas palavras: "Mediana de 5.060 municípios" */
  descricao: string;
  /** de onde vem: fonte oficial ou cálculo do OBEE com as fontes que usou */
  origem: string;
  texto: string;
  escopo: string;
  classe: "oficial" | "calculada";
};

/** Extremo do grupo: o valor e todas as capitais que o têm (empate nunca esconde uma capital), em ordem alfabética. */
export type ExtremoPanorama = { valor: number; capitais: { nome: string; uf: string }[] };

export type ResumoMedida = {
  medida: MedidaId;
  /** nome curto da aba */
  rotulo: string;
  /** pergunta que abre a medida */
  pergunta: string;
  ano: number;
  etapa: EtapaId | null;
  disciplina: Disciplina;
  /** frase factual gerada dos dados elegíveis; é também a descrição acessível do gráfico */
  titulo: string;
  /** ao lado da pergunta: período e unidade, ou etapa, rede e período */
  contexto: string;
  /** subtítulo técnico: medida, unidade, período, universo e cobertura */
  subtitulo: string;
  cobertura: string;
  universo: number;
  /** título do eixo do gráfico */
  eixo: string;
  escala: "linear" | "log";
  /** o eixo parte de zero */
  zero: boolean;
  /** domínio natural da medida, quando existe (Ideb de 0 a 10) */
  dominioFixo: [number, number] | null;
  /** frase curta de definição, com a ressalva essencial do número */
  definicao: string;
  /** ressalva do perímetro da despesa (intraorçamentárias), junto do número; null nas demais medidas */
  perimetro: string | null;
  /** id do indicador, para a ficha "Sobre este dado" */
  indicador: string;
  pontos: PontoCapitulo[];
  semDado: { nome: string; uf: string; motivo: string }[];
  referencia: ReferenciaCapitulo | null;
  menor: ExtremoPanorama | null;
  maior: ExtremoPanorama | null;
  externas: ReferenciaExternaCapitulo[];
  /** por que não há referência nacional utilizável, quando não há */
  semNacional: string | null;
  /** caminho (sem a base) e parâmetros do aprofundamento */
  aprofunda: { caminho: string; params: Record<string, string>; rotulo: string };
};

export type CapituloPanorama = {
  id: Tema;
  numero: string;
  etiqueta: string;
  /** uma medida por aba (recursos) ou uma só */
  medidas: ResumoMedida[];
};

type Escolha = { medida: MedidaId; etapa: EtapaId; disc: Disciplina };

const ETAPA_PADRAO: EtapaId = "anos_iniciais";

const CAPITULOS: { id: Tema; numero: string; etiqueta: string; escolhas: Escolha[] }[] = [
  {
    id: "gastos",
    numero: "01",
    etiqueta: "Recursos",
    escolhas: [
      { medida: "despesa", etapa: ETAPA_PADRAO, disc: "matematica" },
      { medida: "despesa_hab", etapa: ETAPA_PADRAO, disc: "matematica" },
      { medida: "despesa_mat", etapa: ETAPA_PADRAO, disc: "matematica" },
    ],
  },
  { id: "atendimento", numero: "02", etiqueta: "Atendimento", escolhas: [{ medida: "atu", etapa: ETAPA_PADRAO, disc: "matematica" }] },
  { id: "resultados", numero: "03", etiqueta: "Resultados", escolhas: [{ medida: "ideb", etapa: ETAPA_PADRAO, disc: "matematica" }] },
];

const PERGUNTA: Partial<Record<MedidaId, string>> = {
  despesa: "Quanto se gasta no total?",
  despesa_hab: "Quanto se gasta por habitante?",
  despesa_mat: "Quanto se gasta por matrícula?",
  atu: "Quantos alunos por turma?",
  ideb: "Qual é o Ideb?",
};

const ROTULO_ABA: Partial<Record<MedidaId, string>> = { despesa: "Total", despesa_hab: "Por habitante", despesa_mat: "Por matrícula" };

const EIXO: Partial<Record<MedidaId, string>> = {
  despesa: "Despesa total (R$, escala logarítmica)",
  despesa_hab: "Despesa em Educação por habitante (R$)",
  despesa_mat: "Despesa de aplicação direta por matrícula (R$)",
  atu: "Alunos por turma",
  ideb: "Ideb (índice de 0 a 10)",
};

const ETAPA_CURTA: Record<EtapaId, string> = {
  total: "Toda a educação básica",
  creche: "Creche",
  pre_escola: "Pré-escola",
  anos_iniciais: "Anos iniciais",
  anos_finais: "Anos finais",
  ensino_medio: "Ensino médio",
  eja: "Educação de jovens e adultos",
  profissional: "Educação profissional",
};

const ROTULO_APROFUNDA: Record<Tema, string> = { gastos: "Explorar gastos", atendimento: "Explorar atendimento", resultados: "Explorar resultados" };

/** Ano mais recente da medida em que ao menos metade das capitais tem dado comparável; senão o mais recente com algum. */
function anoDaMedida(ix: Indice, c: Escolha): number {
  const d = ix.d;
  const anos = [...anosDaMedida(d, c.medida)].reverse();
  let algum: number | null = null;
  for (const ano of anos) {
    const comp = comparar(ix, c.medida, ano, c.etapa, "nominal", c.disc, "todas", d.capitais[0], "alfabetica");
    if (comp.incluidas.length >= d.capitais.length / 2) return ano;
    if (algum === null && comp.incluidas.length > 0) algum = ano;
  }
  return algum ?? anos[0];
}

const porNome = (a: { nome: string; uf: string }, b: { nome: string; uf: string }) => `${a.nome} (${a.uf})`.localeCompare(`${b.nome} (${b.uf})`, "pt-BR");

/** Extremo do conjunto, com todas as capitais que têm o valor: o menor ou o maior. */
function extremo(pontos: PontoCapitulo[], qual: "menor" | "maior"): ExtremoPanorama | null {
  if (!pontos.length) return null;
  const valor = qual === "menor" ? Math.min(...pontos.map((p) => p.valor)) : Math.max(...pontos.map((p) => p.valor));
  return { valor, capitais: pontos.filter((p) => p.valor === valor).map((p) => ({ nome: p.nome, uf: p.uf })).sort(porNome) };
}

function resumo(d: DadosPainel, ix: Indice, tema: Tema, c: Escolha): ResumoMedida {
  const ano = anoDaMedida(ix, c);
  const etapa = etapaDaMedida(c.medida, c.etapa);
  const comp = comparar(ix, c.medida, ano, c.etapa, "nominal", c.disc, "todas", d.capitais[0], "alfabetica");
  const pontos: PontoCapitulo[] = comp.incluidas.map((i) => ({ id: i.cap.id, cod: i.cap.cod, nome: i.cap.nome, uf: i.cap.uf, valor: i.valor }));
  const itens: ItemFrase[] = pontos.map((p) => ({ nome: p.nome, uf: p.uf, valor: p.valor }));
  const titulo = fraseAmplitude(itens, { medida: c.medida, ano, etapa });
  const md = MEDIDA[c.medida];
  const periodo = md.anos === "ideb" ? `edição ${ano}` : md.anos === "censo" ? `Censo Escolar ${ano}` : `exercício ${ano}`;
  const subtitulo = [md.rotulo, unidade(c.medida, "nominal"), etapa ? nomeEtapa(d, etapa) : null, periodo, `capitais estaduais, ${universoDaMedida(c.medida)}`].filter(Boolean).join(" · ");
  const contexto =
    tema === "gastos"
      ? `${ano} · R$ correntes`
      : `${etapa ? ETAPA_CURTA[etapa] : ""} · rede municipal · ${md.anos === "ideb" ? `edição ${ano}` : ano}`.replace(/^ · /, "");
  const r = comp.ref;
  const externas: ReferenciaExternaCapitulo[] = referenciasExternas(d, c.medida, ano, c.etapa, componente(c.medida, "nominal", c.disc))
    .filter((e) => e.tipo === "nacional_mesmo_universo")
    .map((e) => ({
      rotulo: e.rotulo,
      valor: e.valor,
      valorTexto: formata(c.medida, e.valor),
      descricao: e.rotulo,
      origem: e.rotulo,
      texto: `${e.rotulo}: ${formata(c.medida, e.valor)}`,
      escopo: e.escopoTexto,
      classe: "oficial" as const,
    }));
  const calc = nacionalCalculada(d, c.medida, ano);
  const g = calc?.grupos.find((x) => x.id === "elegiveis");
  if (calc && g && g.mediana !== null) {
    externas.push({
      rotulo: calc.rotulo_origem,
      valor: g.mediana,
      valorTexto: formata(c.medida, g.mediana),
      descricao: `Mediana de ${inteiro(g.n_municipios)} municípios`,
      origem: calc.rotulo_origem,
      texto: `Mediana de ${inteiro(g.n_municipios)} municípios com dados elegíveis: ${formata(c.medida, g.mediana)} (${calc.rotulo_origem})`,
      escopo: "Todos os portes e responsabilidades educacionais; não é um grupo homogêneo de pares das capitais.",
      classe: "calculada",
    });
  }
  return {
    medida: c.medida,
    rotulo: ROTULO_ABA[c.medida] ?? DEFINICAO_CURTA[c.medida].titulo,
    pergunta: PERGUNTA[c.medida] ?? `${md.rotulo}?`,
    ano,
    etapa,
    disciplina: c.disc,
    titulo,
    contexto,
    subtitulo,
    cobertura: fraseCobertura(comp.incluidas.length, comp.universo.length),
    universo: comp.universo.length,
    eixo: EIXO[c.medida] ?? md.rotulo,
    escala: c.medida === "despesa" ? "log" : "linear",
    zero: c.medida === "despesa_hab" || c.medida === "despesa_mat",
    dominioFixo: c.medida === "ideb" ? [0, 10] : null,
    definicao: DEFINICAO_CURTA[c.medida].texto,
    perimetro: ehDespesa(c.medida) ? textoPerimetroIntra(perimetroIntra(d, ano), ano, c.medida) : null,
    indicador: md.indicador,
    pontos,
    semDado: comp.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, motivo: x.motivo })),
    referencia: r && { mediana: r.mediana, media: r.media, minimo: r.minimo, maximo: r.maximo, q1: r.q1, q3: r.q3, quartisExibicao: r.quartisExibicao, n: r.n },
    menor: extremo(pontos, "menor"),
    maior: extremo(pontos, "maior"),
    externas,
    semNacional: externas.length === 0 ? SEM_NACIONAL[c.medida] : null,
    aprofunda: {
      caminho: `/${tema}`,
      params: { med: c.medida, ano: String(ano), ...(etapa ? { etapa } : {}) },
      rotulo: ROTULO_APROFUNDA[tema],
    },
  };
}

export function montaPanorama(d: DadosPainel, ix: Indice = new Indice(d)): CapituloPanorama[] {
  return CAPITULOS.map((c) => ({
    id: c.id,
    numero: c.numero,
    etiqueta: c.etiqueta,
    medidas: c.escolhas.map((e) => resumo(d, ix, c.id, e)),
  }));
}
