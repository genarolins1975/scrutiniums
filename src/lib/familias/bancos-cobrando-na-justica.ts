/**
 * Leitura da gold de cobrança judicial de crédito (public/obs/data/gold/cobranca.json) para o painel "Bancos cobrando na
 * Justiça" do Observatório das Famílias. Só servidor. A página nova mostra os mesmos valores da vista antiga
 * (renderCobranca, em public/obs/app.js): janelas de 12 meses, variações, razões por habitante e por carteira e posições
 * vêm prontas da gold; aqui só se escolhe o recorte (classe e medida por UF) e se ordena, como a vista antiga fazia.
 *
 * Dois recortes que nunca se somam: assunto bancário e qualquer credor. Os meses que a gold marca como parciais ficam fora
 * dos números e dos gráficos e seguem no arquivo CSV, com a marca.
 */
import { lerPublico, mesAno } from "@/lib/perguntas/leitura";
import { datasLegiveis } from "@/lib/painel/formato";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

export const ROTA_BANCOS_COBRANDO = "/divida-das-familias/bancos-cobrando-na-justica";
export const TITULO_BANCOS_COBRANDO = "Bancos cobrando na Justiça";
export const PERGUNTA_BANCOS_COBRANDO = "Quantas ações de cobrança de crédito chegam à Justiça?";
export const DESCRICAO_BANCOS_COBRANDO =
  "Execuções de título, busca e apreensão em alienação fiduciária, monitórias e execuções hipotecárias ajuizadas mês a mês nos tribunais estaduais (CNJ, DataJud), no recorte bancário e com qualquer credor, por via e por estado.";
export const SECAO_BANCOS_COBRANDO = "familias:bancos-cobrando-na-justica";

export type IdGrupo = "execucao" | "busca_apreensao" | "monitoria" | "exec_hipotecaria";
export type Janela = { casos_12m: number; casos_12m_anterior: number; var_12m_pct: number | null; registros_12m: number };
export type PontoGrupo = { mes: string; todos: number; bancario: number; parcial: boolean };
export type Grupo = { id: IdGrupo; nome: string; classes_tpu: number[]; todos: Janela; bancario: Janela; bancario_share: number | null; serie: PontoGrupo[] };
export type PontoSerie = { mes: string; parcial: boolean; todos: number; bancario: number } & Record<IdGrupo, number>;
export type MedidaUf = "por_mil_hab" | "por_bi_carteira" | "casos_12m" | "var_12m_pct";
export type Uf = {
  uf: string;
  nome: string;
  regiao: string;
  tribunal: string;
  casos_12m: number;
  casos_12m_anterior: number;
  var_12m_pct: number | null;
  casos_12m_todos: number;
  bancario_share: number | null;
  por_mil_hab: number | null;
  por_bi_carteira: number | null;
  inad_scr: number | null;
  data_scr: string | null;
  grupos: Record<IdGrupo, number>;
  posicoes?: Partial<Record<MedidaUf, number>>;
};

export type GoldCobranca = {
  disponivel: true;
  tipo: string;
  fonte: { nome: string; url: string; catalogo: string; licenca: string; nivel: string };
  mes: string;
  meses_parciais: string[];
  janela_12m: { inicio: string; fim: string };
  cobertura: { tribunais: number; ufs: string[]; faltam: string[]; coletado_em: string; populacao_coberta_pct: number | null };
  brasil: {
    casos_12m: number;
    casos_12m_anterior: number;
    var_12m_pct: number | null;
    casos_12m_todos: number;
    var_12m_todos_pct: number | null;
    bancario_share: number | null;
    por_mil_hab: number | null;
    por_bi_carteira: number | null;
  };
  grupos: Grupo[];
  serie: PontoSerie[];
  ufs: Uf[];
  assuntos_bancarios: { codigo: number; nome: string }[];
  sintese: string;
  metodo: string;
  limitacoes: string;
  cautelas: string[];
  catalogo: { nome: string; definicao: string; unidade: string; fonte: string; limitacoes: string }[];
};

export type Indisponivel = { disponivel: false; motivo: string };

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
/** A gold inteira, ou a indisponibilidade que ela declara (o builder grava o motivo quando a base não fecha). */
export function goldCobranca(): GoldCobranca | Indisponivel {
  let g: any;
  try {
    g = lerPublico("obs", "data", "gold", "cobranca.json");
  } catch {
    return { disponivel: false, motivo: "A base de cobrança judicial não está nesta publicação do site." };
  }
  if (!g || !g.disponivel) return { disponivel: false, motivo: prosa(String(g?.motivo ?? g?.error ?? "A fonte não publicou a base nesta execução.")) };
  return g as GoldCobranca;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Texto da gold na forma da página: travessão de pontuação vira ponto e vírgula e mês ISO solto ("2026-08") vira "ago/2026". */
export function prosa(texto: string): string {
  return datasLegiveis(texto.replace(/\s+—\s+/g, "; ").replace(/\bISO-8601\b/g, "ISO 8601"), "pt");
}

/** Nome de fonte da gold ("CNJ — DataJud, API pública (...)") com vírgula no lugar do travessão. */
export function nomeFonte(texto: string): string {
  return texto.replace(/\s+—\s+/g, ", ");
}

/** "2026-11-05T19:02:47+00:00" → "05/11/2026" (o dia em Brasília). */
export function diaBr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10).split("-").reverse().join("/");
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

export type Classe = "todas" | IdGrupo;

/** Classes aceitas em ?classe=: todas e os grupos que a gold publica, na ordem dela. */
export function classes(g: GoldCobranca): Classe[] {
  return ["todas", ...g.grupos.map((x) => x.id)];
}

export type PontoMes = { mes: string; bancario: number; todos: number };

/** Série mensal do recorte, só com os meses fechados (os parciais ficam fora de número e de gráfico, como na vista antiga). */
export function serieDaClasse(g: GoldCobranca, classe: Classe): PontoMes[] {
  const grupo = g.grupos.find((x) => x.id === classe);
  const origem: { mes: string; parcial: boolean; todos: number; bancario: number }[] = grupo ? grupo.serie : g.serie;
  return origem.filter((p) => !p.parcial).map((p) => ({ mes: p.mes, bancario: p.bancario, todos: p.todos }));
}

/** Série mensal por via, recorte bancário, só com os meses fechados. */
export function seriePorVia(g: GoldCobranca): ({ mes: string } & Record<IdGrupo, number>)[] {
  return g.serie.filter((p) => !p.parcial).map((p) => ({ mes: p.mes, execucao: p.execucao, busca_apreensao: p.busca_apreensao, monitoria: p.monitoria, exec_hipotecaria: p.exec_hipotecaria }));
}

export const MEDIDAS_UF: readonly MedidaUf[] = ["por_mil_hab", "por_bi_carteira", "casos_12m", "var_12m_pct"];
export const MEDIDA_UF: Record<MedidaUf, { rotulo: string; unidade: string; casas: number; titulo: string }> = {
  por_mil_hab: { rotulo: "Por mil habitantes", unidade: "casos por mil habitantes", casas: 2, titulo: "Ações de cobrança bancária por mil habitantes" },
  por_bi_carteira: { rotulo: "Por R$ bilhão de carteira", unidade: "casos por R$ bilhão de carteira", casas: 1, titulo: "Ações de cobrança bancária por R$ bilhão de carteira de crédito" },
  casos_12m: { rotulo: "Casos", unidade: "casos", casas: 0, titulo: "Ações de cobrança bancária em 12 meses" },
  var_12m_pct: { rotulo: "Variação em 12 meses", unidade: "%", casas: 1, titulo: "Variação das ações de cobrança bancária contra os 12 meses anteriores" },
};

/** UFs da maior para a menor na medida escolhida; UF sem a medida vai para o fim (a mesma ordem da vista antiga), nunca vira zero. */
export function ufsOrdenadas(g: GoldCobranca, medida: MedidaUf): Uf[] {
  const v = (u: Uf) => u[medida];
  return [...(g.ufs ?? [])].sort((a, b) => {
    const x = v(a);
    const y = v(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return y - x;
  });
}

/** A via com mais casos bancários em 12 meses (a "via mais usada" do placar antigo). */
export function viaMaisUsada(g: GoldCobranca): Grupo | null {
  return g.grupos.length ? [...g.grupos].sort((a, b) => b.bancario.casos_12m - a.bancario.casos_12m)[0] : null;
}

export function periodoSerie(g: GoldCobranca): { inicio: string; fim: string } {
  return { inicio: g.serie.length ? g.serie[0].mes : g.mes, fim: g.mes };
}

/** "set/2025 a ago/2026". */
export function janelaTexto(j: { inicio: string; fim: string }): string {
  return `${mesAno(j.inicio)} a ${mesAno(j.fim)}`;
}

/** Proveniência das figuras, montada do que a gold registra (fonte, licença, nível, período e coleta); sem hash, que a gold não guarda. */
export function provenienciaCobranca(
  g: GoldCobranca,
  o: { indicador: string; natureza: Natureza; unidade: string; inicio?: string; fim?: string; formula?: string | null; extra?: string[] },
): Proveniencia {
  const p = periodoSerie(g);
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: "CNJ",
    dataset: "DataJud, API pública",
    recurso: "Agregação por classe, assunto e mês de ajuizamento nos tribunais estaduais",
    url: g.fonte.catalogo,
    urlPrimaria: g.fonte.url,
    licenca: g.fonte.licenca,
    unidade: o.unidade,
    frequencia: "mensal",
    inicio: o.inicio ?? p.inicio,
    fim: o.fim ?? p.fim,
    coberturaInicio: p.inicio,
    coberturaFim: p.fim,
    capturadoEm: g.cobertura.coletado_em,
    validadoEm: g.cobertura.coletado_em,
    transformacoes: [prosa(g.metodo)],
    formula: o.formula ?? null,
    limitacoes: [prosa(g.limitacoes), ...g.cautelas.map(prosa), ...(o.extra ?? []), "A gold não registra o hash dos arquivos de origem."],
    versaoPipeline: "pipeline/cobranca.py",
    notas: `${nomeFonte(g.fonte.nome)}. Nível da fonte: ${g.fonte.nivel.replace(/\s+—\s+/, ", ")}.`,
  });
}

const csvCampo = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV da série mensal, com as colunas e o separador do arquivo da vista antiga (cbCSV) e os meses parciais marcados. No lugar da hora
 * da exportação, que a vista antiga escrevia no navegador, o cabeçalho leva a data da coleta que a gold declara.
 */
export function csvSerie(g: GoldCobranca): string {
  const cols = ["mes", "parcial", "bancario", "todos", "execucao", "busca_apreensao", "monitoria", "exec_hipotecaria"] as const;
  const cabecalho =
    "# Scrutiniums, cobrança judicial de crédito, ajuizamentos mensais (CNJ/DataJud, agregação, casos únicos)\n" +
    "# bancario = assunto bancário nas quatro classes; todos = qualquer credor; colunas por classe são do recorte bancário; parcial = mês ainda incompleto no DataJud\n" +
    `# tribunais cobertos: ${g.cobertura.ufs.join(", ")} · coletado em: ${diaBr(g.cobertura.coletado_em)}\n`;
  return cabecalho + cols.join(";") + "\n" + g.serie.map((p) => cols.map((c) => csvCampo(p[c])).join(";")).join("\n");
}
