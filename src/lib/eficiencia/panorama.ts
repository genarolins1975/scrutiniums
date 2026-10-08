/**
 * Dados do panorama editorial: três capítulos (gasto, atendimento, resultados), cada um com uma pergunta, uma medida
 * normalizada, as capitais com dado comparável, a referência do grupo e a referência externa quando válida. Montado no
 * servidor com as mesmas regras de elegibilidade das demais visões (`comparar`), de modo que o HTML inicial já traz a
 * informação e o cliente recebe só os pontos de cada capítulo, não a base inteira.
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
  nomeEtapa,
  referenciasExternas,
  unidade,
  type DadosPainel,
  type Disciplina,
  type MedidaId,
} from "./consulta";
import { fraseAmplitude, fraseCobertura, type ItemFrase } from "./frases";
import { inteiro } from "./formato";
import { DEFINICAO_TEMA, type Tema } from "./visao";

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

export type ReferenciaExternaCapitulo = { rotulo: string; valor: number; texto: string; escopo: string; classe: "oficial" | "calculada" };

export type CapituloPanorama = {
  id: Tema;
  pergunta: string;
  medida: MedidaId;
  ano: number;
  etapa: EtapaId | null;
  disciplina: Disciplina;
  /** título comunicativo, gerado dos dados elegíveis */
  titulo: string;
  /** subtítulo técnico: medida, unidade, período, universo e cobertura */
  subtitulo: string;
  cobertura: string;
  universo: number;
  pontos: PontoCapitulo[];
  semDado: { nome: string; uf: string; motivo: string }[];
  referencia: ReferenciaCapitulo | null;
  externas: ReferenciaExternaCapitulo[];
  /** caminho (sem a base) e parâmetros do aprofundamento */
  aprofunda: { caminho: string; params: Record<string, string>; rotulo: string };
};

type Escolha = { tema: Tema; medida: MedidaId; etapa: EtapaId; disc: Disciplina };

const CAPITULOS: Escolha[] = [
  { tema: "gastos", medida: "despesa_hab", etapa: "anos_iniciais", disc: "matematica" },
  { tema: "atendimento", medida: "atu", etapa: "anos_iniciais", disc: "matematica" },
  { tema: "resultados", medida: "ideb", etapa: "anos_iniciais", disc: "matematica" },
];

/** Ano mais recente da medida em que ao menos metade das capitais tem dado comparável; senão o mais recente com algum. */
function anoDoCapitulo(ix: Indice, c: Escolha): number {
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

export function montaPanorama(d: DadosPainel, ix: Indice = new Indice(d)): CapituloPanorama[] {
  return CAPITULOS.map((c) => {
    const def = DEFINICAO_TEMA[c.tema];
    const ano = anoDoCapitulo(ix, c);
    const etapa = etapaDaMedida(c.medida, c.etapa);
    const comp = comparar(ix, c.medida, ano, c.etapa, "nominal", c.disc, "todas", d.capitais[0], "alfabetica");
    const pontos: PontoCapitulo[] = comp.incluidas.map((i) => ({ id: i.cap.id, cod: i.cap.cod, nome: i.cap.nome, uf: i.cap.uf, valor: i.valor }));
    const itens: ItemFrase[] = pontos.map((p) => ({ nome: p.nome, uf: p.uf, valor: p.valor }));
    const titulo = fraseAmplitude(itens, { medida: c.medida, ano, etapa });
    const md = MEDIDA[c.medida];
    const periodo = md.anos === "ideb" ? `edição ${ano}` : md.anos === "censo" ? `Censo Escolar ${ano}` : `exercício ${ano}`;
    const subtitulo = [
      md.rotulo,
      unidade(c.medida, "nominal"),
      etapa ? nomeEtapa(d, etapa) : null,
      periodo,
      "rede municipal das capitais estaduais",
    ]
      .filter(Boolean)
      .join(" · ");
    const r = comp.ref;
    const externas: ReferenciaExternaCapitulo[] = referenciasExternas(d, c.medida, ano, c.etapa, componente(c.medida, "nominal", c.disc))
      .filter((e) => e.tipo === "nacional_mesmo_universo")
      .map((e) => ({ rotulo: e.rotulo, valor: e.valor, texto: `${e.rotulo}: ${formata(c.medida, e.valor)}`, escopo: e.escopoTexto, classe: "oficial" as const }));
    const calc = nacionalCalculada(d, c.medida, ano);
    const g = calc?.grupos.find((x) => x.id === "elegiveis");
    if (calc && g && g.mediana !== null) {
      externas.push({
        rotulo: calc.rotulo_origem,
        valor: g.mediana,
        texto: `Mediana de ${inteiro(g.n_municipios)} municípios com dados elegíveis: ${formata(c.medida, g.mediana)} (${calc.rotulo_origem})`,
        escopo: "Todos os portes e responsabilidades educacionais; não é um grupo homogêneo de pares das capitais.",
        classe: "calculada",
      });
    }
    return {
      id: c.tema,
      pergunta: def.pergunta,
      medida: c.medida,
      ano,
      etapa,
      disciplina: c.disc,
      titulo,
      subtitulo,
      cobertura: fraseCobertura(comp.incluidas.length, comp.universo.length),
      universo: comp.universo.length,
      pontos,
      semDado: comp.excluidas.map((x) => ({ nome: x.cap.nome, uf: x.cap.uf, motivo: x.motivo })),
      referencia: r && {
        mediana: r.mediana,
        media: r.media,
        minimo: r.minimo,
        maximo: r.maximo,
        q1: r.q1,
        q3: r.q3,
        quartisExibicao: r.quartisExibicao,
        n: r.n,
      },
      externas,
      aprofunda: {
        caminho: `/${c.tema}`,
        params: { med: c.medida, ano: String(ano), ...(etapa ? { etapa } : {}) },
        rotulo: c.tema === "gastos" ? "Ver gastos: total, por habitante e por matrícula" : c.tema === "atendimento" ? "Ver o atendimento por etapa" : "Ver os resultados por etapa",
      },
    };
  });
}
