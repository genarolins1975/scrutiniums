/**
 * Lógica pura da Visão geral (/setor-eletrico/visao-geral, painéis P004 a P007): respostas
 * curtas derivadas da gold, linhas das tabelas equivalentes (as mesmas que os gráficos e as
 * listas mostram, e as mesmas que a exportação grava), séries dos pequenos múltiplos, posição
 * de cada determinante frente à sua referência, linha de estado das regras em trechos e a
 * escala de tempo do painel de energia e sociedade.
 *
 * Nada aqui recalcula indicador: os números vêm de public/energia/gold/sintese.json, montada
 * por pipeline/energia/modulos/visao.py a partir das golds de origem. As funções só escolhem,
 * comparam com a referência publicada e escrevem a frase por regra fixa (seção 7.4). Ausência
 * é null e vira "sem dado", nunca zero. Testadas em src/tests/energia-visao.test.ts.
 */
import { resumo } from "./distribuicao";
import { dataBR, mesAno, num, plural } from "./formato";
import { PADRAO_SIGLA, SIGLAS } from "./siglas";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import type { BrasilAnual, Conjuntos } from "./tipos-qualidade";
import type {
  EstadoRegra,
  FraseVisao,
  IdFrase,
  IdPainelMultiplo,
  IdRegra,
  IdSociedade,
  ItemSociedade,
  LinhaMultiplos,
  MultiplosVisao,
  PainelDeterminante,
  ReferenciaPainel,
  RegraObservar,
  SinteseVisaoGold,
  SociedadeVisao,
} from "./tipos-visao";

export const ROTA_VISAO = "/setor-eletrico/visao-geral";
/** A própria gold, lida no navegador sob demanda (fichas de prova e tabelas de auditoria), nunca nas props. */
export const URL_GOLD_VISAO = "/energia/gold/sintese.json";

/** Datas ISO soltas num texto: a conversão fica em formato.ts, para a tabela interativa usá-la sem puxar este módulo. */
export { datasLegiveis } from "./formato";

/**
 * Identificador de snapshot ("ccee_pld_horario@2026-09-30T02:20:14Z") com a captura escrita como na página:
 * "ccee_pld_horario (captura de 30/09/2026 02:20 UTC)". Sem "@" e data, devolve o texto como veio.
 */
export function snapshotLegivel(id: string): string {
  return id.replace(/@(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z?/g, (_, a: string, m: string, d: string, h: string, mi: string) => ` (captura de ${d}/${m}/${a} ${h}:${mi} UTC)`);
}

/* ---------------------------------------------------------------- painéis */

export type IdPainelVisao = "sistema" | "determinantes" | "sociedade" | "observar";

/** Perguntas do Anexo A da especificação (P004 a P007), na ordem da página. */
export const PAINEIS_VISAO: readonly { id: IdPainelVisao; codigo: string; rotulo: string; pergunta: string }[] = [
  { id: "sistema", codigo: "P004", rotulo: "O sistema em 60 segundos", pergunta: "O que mudou e merece atenção?" },
  { id: "determinantes", codigo: "P005", rotulo: "Preço, água, geração, carga e rede", pergunta: "Como estão os principais determinantes?" },
  { id: "sociedade", codigo: "P006", rotulo: "Energia e sociedade", pergunta: "Como custo e qualidade chegam ao consumidor?" },
  { id: "observar", codigo: "P007", rotulo: "O que observar", pergunta: "Quais alterações são relevantes?" },
];

export function painelVisao(id: IdPainelVisao) {
  return PAINEIS_VISAO.find((p) => p.id === id)!;
}

/* ---------------------------------------------------------------- utilidades */

/** Dias entre duas datas ISO (AAAA-MM-DD), b − a, no calendário (sem fuso). */
export function diasEntre(a: string, b: string): number {
  const ms = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}

/** Soma dias a uma data ISO. */
export function somaDias(iso: string, dias: number): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + dias));
  return d.toISOString().slice(0, 10);
}

/** Primeiro e último dia de um período da gold ("AAAA-MM-DD" ou "AAAA-MM"). */
export function inicioDoPeriodo(p: string): string {
  return p.length === 7 ? `${p}-01` : p.slice(0, 10);
}
export function fimDoPeriodo(p: string): string {
  if (p.length !== 7) return p.slice(0, 10);
  const [a, m] = [Number(p.slice(0, 4)), Number(p.slice(5, 7))];
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Primeira letra em minúscula no meio de uma frase, menos quando a primeira palavra é sigla ("CMO publicado", e não "cMO"). */
export function minuscula(s: string): string {
  return /^[A-ZÀ-Þ][a-zß-ÿ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** "a", "a e b", "a, b e c". */
export function listaEmPortugues(xs: readonly string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
}

/** Casas decimais de um número publicado (no máximo 2), para complementos sem texto pronto. */
export function casasDe(v: number): number {
  if (Math.abs(v - Math.round(v)) < 1e-9) return 0;
  if (Math.abs(v * 10 - Math.round(v * 10)) < 1e-9) return 1;
  return 2;
}

/** Casas exibidas para o valor de uma regra, pela unidade da regra. */
export function casasUnidade(unidade: string): number {
  if (unidade === "R$/MWh") return 2;
  if (unidade.startsWith("%")) return 1;
  return 0;
}

/** Número com a unidade, na forma da página: R$ antes, percentual colado, demais com espaço. */
export function comUnidade(v: number | null | undefined, unidade: string, casas: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  if (unidade === "R$/MWh") return `R$ ${num(v, casas)}/MWh`;
  if (unidade.startsWith("%")) return `${num(v, casas)}${unidade}`;
  return `${num(v, casas)} ${unidade}`;
}

/* ---------------------------------------------------------------- P004: o sistema em 60 segundos */

export const ROTULO_FRASE: Record<IdFrase, string> = {
  reservatorios: "Reservatórios",
  afluencias: "Afluências",
  carga: "Carga",
  termica: "Térmicas",
  pld: "PLD",
  rede: "Rede",
};

export const ROTULO_ATUALIDADE: Record<string, string> = {
  "EM DIA": "em dia",
  ATRASADO: "atrasada",
  "SEM SLA": "sem prazo declarado pela fonte",
  "SEM DADO": "sem registro de atualidade",
};

/** Cadência como a gold a grava (sem acento) e como a página a escreve. */
export const ROTULO_CADENCIA: Record<string, string> = {
  diaria: "diária",
  semanal: "semanal",
  quinzenal: "quinzenal",
  mensal: "mensal",
  trimestral: "trimestral",
  anual: "anual",
};

/** Menor e maior data de referência entre as frases (cada frase tem a sua). */
export function referenciasFrases(frases: readonly FraseVisao[]): { min: string; max: string } | null {
  if (!frases.length) return null;
  const refs = frases.map((f) => f.ref).sort();
  return { min: refs[0], max: refs[refs.length - 1] };
}

/** Texto curto de atualidade e defasagem de uma frase, a partir da qualidade publicada. */
export function textoAtualidadeFrase(f: FraseVisao): string {
  const a = f.qualidade.atualidade;
  const sit = a?.situacao ? (ROTULO_ATUALIDADE[a.situacao] ?? a.situacao.toLowerCase()) : null;
  const atraso = a?.dias_atraso ? `, ${plural(a.dias_atraso, "dia", "dias")} além do prazo` : "";
  return sit ? `Fonte ${sit}${a?.cadencia ? ` pela cadência ${ROTULO_CADENCIA[a.cadencia] ?? a.cadencia}` : ""}${atraso}.` : "Sem registro de atualidade da fonte.";
}

/** Componentes que não são medição, como a gold de origem declara (PREVISTO, ESTIMADO). */
export function textoComponentesFrase(f: FraseVisao): string | null {
  const cs = f.qualidade.componentes_natureza;
  if (!cs.length) return null;
  return cs.map((c) => `${String(c.natureza).toLowerCase()} desde ${dataBR(c.desde)}: ${minuscula(c.descricao)}`).join("; ");
}

/**
 * Resposta do P004: quantos fatos, de que datas, o que a caixa de destaques diz e quais
 * regras sobre os próprios dados estão em alerta. Tudo lido da gold; nenhuma frase fixa com número.
 */
export function respostaSistema(g: Pick<SinteseVisaoGold, "frases" | "frases_ausentes" | "destaques" | "observar">): string {
  const partes: string[] = [];
  const refs = referenciasFrases(g.frases);
  if (refs) {
    const n = g.frases.length;
    partes.push(
      refs.min === refs.max
        ? `${n === 1 ? "Um fato" : `${num(n, 0)} fatos`} do sistema, com referência em ${dataBR(refs.min)}.`
        : `${n === 1 ? "Um fato" : `${num(n, 0)} fatos`} do sistema, cada um com a sua data de referência, de ${dataBR(refs.min)} a ${dataBR(refs.max)}.`,
    );
  } else {
    partes.push("Nenhum fato do sistema pôde ser escrito nesta publicação: faltam os dados de origem.");
  }
  if (g.destaques.itens.length) {
    const t = g.destaques.itens.map((d) => minuscula(d.titulo));
    partes.push(`${g.destaques.itens.length === 1 ? "Um destaque" : `${num(g.destaques.itens.length, 0)} destaques`} de regra sobre o sistema: ${t.join("; ")}.`);
  } else if (g.destaques.vazio) {
    partes.push(g.destaques.vazio);
  }
  const observacao = regrasEmObservacao(g.observar);
  if (observacao.length) partes.push(`Em observação, com a condição presente e ainda sem a duração mínima para virar alerta: ${observacao.map((o) => minuscula(o.titulo)).join("; ")}.`);
  const dados = g.observar.filter((o) => o.assunto === "dados" && o.tipo !== "evento" && o.ativo);
  if (dados.length) partes.push(`Em alerta sobre os próprios dados: ${dados.map((o) => minuscula(o.titulo)).join("; ")}.`);
  if (g.frases_ausentes.length) partes.push(`Sem frase nesta publicação: ${g.frases_ausentes.map((id) => minuscula(ROTULO_FRASE[id])).join(", ")}.`);
  return partes.join(" ");
}

/**
 * As regras sobre os próprios dados, em palavras comuns. O título da gold ("Revisão material de dado já publicado") e a
 * condição técnica ficam na lista do P007 e em Analisar; o veredito diz só o que o leitor precisa saber.
 */
const DADOS_EM_PALAVRAS: Partial<Record<IdRegra, string>> = {
  revisao_material: "um dado publicado foi revisado",
  atualidade_fontes: "uma fonte desta página está atrasada",
  pld_defasagem: "a série do PLD está sem atualização recente",
};

/** Nomes de regras no veredito: até duas por extenso; mais que isso, só a contagem, para a frase não virar lista. */
function nomesNoVeredito(regras: readonly RegraObservar[], palavras: boolean): string | null {
  if (regras.length === 0 || regras.length > 2) return null;
  return listaEmPortugues(regras.map((o) => (palavras ? (DADOS_EM_PALAVRAS[o.id] ?? minuscula(o.titulo)) : minuscula(o.titulo))));
}

/** Regras sobre o sistema em observação: a condição está presente, mas ainda sem a duração mínima que a confirma como alerta. */
export function regrasEmObservacao<T extends Pick<RegraObservar, "tipo" | "assunto" | "estado">>(observar: readonly T[]): T[] {
  return observar.filter((o) => o.tipo !== "evento" && o.assunto === "sistema" && o.estado === "em_observacao");
}

/**
 * Veredito do P004 ("O que mudou e merece atenção?"): se alguma regra sobre o sistema está em alerta ou em observação e o que se
 * avisa sobre os próprios dados. Lê os mesmos campos de respostaSistema (observar e frases); os fatos e as datas ficam abaixo.
 * A regra em observação aparece aqui porque o leitor que só lê o topo não pode concluir que "nada merece atenção" quando uma
 * condição já está presente e só falta a duração mínima para virar alerta.
 */
export function vereditoSistema(g: Pick<SinteseVisaoGold, "frases" | "observar">): string {
  const regras = g.observar.filter((o) => o.tipo !== "evento");
  const sistema = regras.filter((o) => o.assunto === "sistema" && o.ativo);
  const observacao = regrasEmObservacao(regras);
  const dados = regras.filter((o) => o.assunto === "dados" && o.ativo);
  const partes: string[] = [];
  const nomesObs = observacao.length ? nomesNoVeredito(observacao, false) : null;
  const sufixoObs = nomesObs ? `: ${nomesObs}` : "";
  if (sistema.length) {
    const nomes = nomesNoVeredito(sistema, false);
    partes.push(`${sistema.length === 1 ? "Uma regra sobre o sistema está" : `${num(sistema.length, 0)} regras sobre o sistema estão`} em alerta${nomes ? `: ${nomes}` : ""}.`);
    if (observacao.length) partes.push(`${observacao.length === 1 ? "Uma regra está" : `${num(observacao.length, 0)} regras estão`} em observação${sufixoObs}.`);
  } else {
    const obs = observacao.length ? `; ${observacao.length === 1 ? "uma está" : `${num(observacao.length, 0)} estão`} em observação${sufixoObs}` : "";
    partes.push(`Nenhuma regra sobre o sistema está em alerta${obs}.`);
  }
  if (dados.length) {
    const nomes = nomesNoVeredito(dados, true);
    partes.push(`Sobre os próprios dados, ${dados.length === 1 ? "1 regra está" : `${num(dados.length, 0)} regras estão`} em alerta${nomes ? `: ${nomes}` : ""}.`);
  }
  return partes.join(" ");
}

export const COLUNAS_FRASES: ColunaTabela[] = [
  { id: "indicador", rotulo: "Indicador", tipo: "texto" },
  { id: "texto", rotulo: "Frase publicada", tipo: "texto" },
  { id: "referencia", rotulo: "Referência", tipo: "data" },
  { id: "defasagem", rotulo: "Defasagem até o processamento", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "atualidade", rotulo: "Atualidade da fonte", tipo: "texto", categorica: true },
  { id: "natureza", rotulo: "Natureza", tipo: "texto", categorica: true },
  { id: "componentes", rotulo: "Componentes que não são medição", tipo: "texto" },
  { id: "revisadas", rotulo: "Referências revisadas na janela", tipo: "numero", casas: 0 },
  { id: "gold", rotulo: "Gold de origem", tipo: "texto", categorica: true },
];

/** Tabela equivalente da síntese: uma linha por frase exibida, na ordem da lista. */
export function linhasFrases(frases: readonly FraseVisao[]): LinhaTabela[] {
  return frases.map((f) => ({
    id: f.id,
    indicador: ROTULO_FRASE[f.id],
    texto: f.texto,
    referencia: f.ref,
    defasagem: f.qualidade.defasagem_dias,
    atualidade: f.qualidade.atualidade?.situacao ? enumLegivel(f.qualidade.atualidade.situacao) : null,
    natureza: f.natureza,
    componentes: f.qualidade.componentes_natureza.map((c) => `${c.natureza} desde ${dataBR(c.desde)}`).join("; ") || null,
    revisadas: f.qualidade.revisoes.referencias_revisadas_na_janela,
    gold: f.versoes.gold,
  }));
}

export const COLUNAS_VALORES_FRASES: ColunaTabela[] = [
  { id: "frase", rotulo: "Frase", tipo: "texto", categorica: true },
  { id: "chave", rotulo: "Valor", tipo: "texto" },
  { id: "numero", rotulo: "Número", tipo: "numero", casas: 4 },
  { id: "texto", rotulo: "Texto ou data", tipo: "texto" },
  { id: "unidade", rotulo: "Unidade", tipo: "texto" },
  { id: "caminho", rotulo: "Caminho na base publicada de origem", tipo: "texto" },
];

/** Cada valor usado numa frase, com o caminho na gold de origem (reprodução da frase). */
export function linhasValoresFrases(frases: readonly FraseVisao[]): LinhaTabela[] {
  return frases.flatMap((f) =>
    Object.entries(f.valores).map(([k, v]) => ({
      id: `${f.id}:${k}`,
      frase: ROTULO_FRASE[f.id],
      chave: k,
      numero: typeof v.valor === "number" ? v.valor : null,
      texto: typeof v.valor === "string" ? v.valor : null,
      unidade: v.unidade ?? null,
      caminho: v.caminho,
    })),
  );
}

export const COLUNAS_VERSOES: ColunaTabela[] = [
  { id: "frase", rotulo: "Frase", tipo: "texto" },
  { id: "gold", rotulo: "Gold", tipo: "texto" },
  { id: "gerado_em", rotulo: "Gerada em (UTC)", tipo: "texto" },
  { id: "versao_codigo", rotulo: "Versão do código", tipo: "texto" },
  { id: "dataset", rotulo: "Conjunto", tipo: "texto" },
  { id: "snapshot", rotulo: "Snapshot", tipo: "texto" },
  { id: "sha256", rotulo: "sha256 do snapshot", tipo: "texto" },
];

export function linhasVersoes(frases: readonly FraseVisao[]): LinhaTabela[] {
  return frases.map((f) => ({
    id: f.id,
    frase: ROTULO_FRASE[f.id],
    gold: f.versoes.gold,
    gerado_em: f.versoes.gerado_em,
    versao_codigo: f.versoes.versao_codigo,
    dataset: f.versoes.dataset,
    snapshot: f.versoes.snapshot_id,
    sha256: f.versoes.snapshot_sha256,
  }));
}

/* ---------------------------------------------------------------- P005: determinantes */

export const JANELAS_P005 = ["30", "60", "90"] as const;
export type JanelaP005 = (typeof JANELAS_P005)[number];

/** Últimos `dias` dias do recorte alinhado (o calendário é o mesmo para os cinco painéis). */
export function recorteMultiplos(m: MultiplosVisao, dias: number): LinhaMultiplos[] {
  const ordenado = [...m.dados].sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return ordenado.slice(-Math.max(1, Math.min(dias, ordenado.length)));
}

/** Cor de cada coluna dos pequenos múltiplos (só tokens; a identidade dos submercados é a do PLD). */
const COR_COLUNA: Record<string, string> = {
  preco_SE: "var(--serie-sm-se)",
  preco_S: "var(--serie-sm-s)",
  preco_NE: "var(--serie-sm-ne)",
  preco_N: "var(--serie-sm-n)",
  agua_SIN: "var(--serie-hidraulica)",
  geracao_termica_7d: "var(--serie-termica)",
  carga_SIN: "var(--cor-energia)",
};
/** Fronteiras da rede em tons neutros: a cor de cada submercado do preço (roxo, laranja, verde, azul) não é reaproveitada para outra entidade na mesma página. */
const COR_FRONTEIRA = ["var(--serie-1)", "var(--serie-3)", "var(--serie-4)", "var(--serie-2)"];
const SIGLA_SM: Record<string, string> = { SE: "SE/CO", S: "S", NE: "NE", N: "N" };

export type SerieDeterminante = { id: string; rotulo: string; sigla?: string; cor: string; tracejada?: boolean; espessura?: number };

/** Referência de um painel sem o caminho na gold de origem (o que o gráfico e o cliente precisam). */
export type ReferenciaLeve =
  | { tipo: "faixa_constante"; rotulo: string; inferior: number; superior: number }
  | { tipo: "faixa_por_data"; rotulo: string; inferior: string; superior: string }
  | { tipo: "serie"; rotulo: string; coluna: string }
  | { tipo: "zero"; rotulo: string };

/** O mínimo de um painel para desenhar o gráfico: serve ao painel completo da gold e ao painel leve que o cliente recebe. */
export type PainelGrafico = { id: IdPainelMultiplo; colunas: { id: string; rotulo: string }[]; referencia: ReferenciaLeve };

/** Uma série a mais desenhada no gráfico de um painel (por exemplo a mediana da data da água), com a coluna que a alimenta. */
export type SerieExtra = { id: string; rotulo: string };

/** Séries do gráfico de um painel: as colunas publicadas, a referência do ano anterior tracejada (carga) e as séries extras tracejadas. */
export function seriesDeterminante(p: PainelGrafico, extras: readonly SerieExtra[] = []): SerieDeterminante[] {
  const s: SerieDeterminante[] = p.colunas.map((c, i) => {
    const sm = c.id.startsWith("preco_") ? c.id.slice(6) : null;
    return {
      id: c.id,
      rotulo: c.rotulo,
      sigla: sm ? SIGLA_SM[sm] : p.id === "rede" ? c.id.replace(/^rede_/, "").replace("_", "→") : undefined,
      cor: COR_COLUNA[c.id] ?? COR_FRONTEIRA[i % COR_FRONTEIRA.length],
    };
  });
  if (p.referencia.tipo === "serie") s.push({ id: p.referencia.coluna, rotulo: p.referencia.rotulo, cor: "var(--serie-referencia)", tracejada: true, espessura: 1.5 });
  for (const e of extras) s.push({ id: e.id, rotulo: e.rotulo, cor: "var(--serie-referencia)", tracejada: true, espessura: 1.5 });
  return s;
}

/** Faixa de referência desenhada como banda (colunas da gold ou colunas constantes). */
export function bandaDeterminante(p: PainelGrafico): { inferior: string; superior: string; rotulo: string } | undefined {
  if (p.referencia.tipo === "faixa_por_data") return { inferior: p.referencia.inferior, superior: p.referencia.superior, rotulo: p.referencia.rotulo };
  if (p.referencia.tipo === "faixa_constante") return { inferior: `${p.id}_ref_inf`, superior: `${p.id}_ref_sup`, rotulo: p.referencia.rotulo };
  return undefined;
}

/**
 * Linhas do gráfico de um painel: a data, as colunas do painel e as da referência, copiadas
 * do recorte sem alteração; a faixa constante entra como duas colunas com os limites
 * publicados (a mesma faixa em todas as datas, como a gold a define).
 */
export function dadosDeterminante(p: PainelGrafico, linhas: readonly LinhaMultiplos[], extras: readonly SerieExtra[] = []): Record<string, string | number | null>[] {
  const cols = p.colunas.map((c) => c.id);
  for (const e of extras) cols.push(e.id);
  const ref = p.referencia;
  if (ref.tipo === "faixa_por_data") cols.push(ref.inferior, ref.superior);
  if (ref.tipo === "serie") cols.push(ref.coluna);
  return linhas.map((l) => {
    const o: Record<string, string | number | null> = { d: l.d };
    for (const c of cols) o[c] = (l[c] as number | null | undefined) ?? null;
    if (ref.tipo === "faixa_constante") {
      o[`${p.id}_ref_inf`] = ref.inferior;
      o[`${p.id}_ref_sup`] = ref.superior;
    }
    return o;
  });
}

/** Valor atual de um painel como a página escreve (o mesmo texto da evidência do pipeline). */
export function valorAtualTexto(p: PainelDeterminante): string {
  return comUnidade(p.valor_atual.valor, p.unidade, p.casas);
}

export type PosicaoDeterminante = {
  situacao: "abaixo" | "dentro" | "acima" | "sem_referencia" | "sem_dado" | "sentido";
  valor: number | null;
  inferior: number | null;
  superior: number | null;
  /** Referência pontual (série do ano anterior). */
  referencia: number | null;
  /** valor − referência (na série) ou null. */
  diferenca: number | null;
  /** 100 × (valor ÷ referência − 1) na série, ou null. */
  variacao_pct: number | null;
};

function linhaDoDia(m: MultiplosVisao, d: string): LinhaMultiplos | undefined {
  return m.dados.find((l) => l.d === d);
}

/** Posição do valor atual frente à referência publicada do painel, na data de referência do painel. */
export function posicaoDeterminante(p: PainelDeterminante, m: MultiplosVisao): PosicaoDeterminante {
  const v = p.valor_atual.valor;
  const vazio = { inferior: null, superior: null, referencia: null, diferenca: null, variacao_pct: null };
  if (v === null || !Number.isFinite(v)) return { situacao: "sem_dado", valor: null, ...vazio };
  const ref = p.referencia;
  const lado = (inf: number | null, sup: number | null) =>
    inf === null || sup === null ? "sem_referencia" : v < inf ? "abaixo" : v > sup ? "acima" : "dentro";
  if (ref.tipo === "faixa_constante") return { ...vazio, situacao: lado(ref.inferior, ref.superior), valor: v, inferior: ref.inferior, superior: ref.superior };
  const linha = linhaDoDia(m, p.data_referencia);
  if (ref.tipo === "faixa_por_data") {
    const inf = (linha?.[ref.inferior] as number | null | undefined) ?? null;
    const sup = (linha?.[ref.superior] as number | null | undefined) ?? null;
    return { ...vazio, situacao: lado(inf, sup), valor: v, inferior: inf, superior: sup };
  }
  if (ref.tipo === "serie") {
    const r = (linha?.[ref.coluna] as number | null | undefined) ?? null;
    if (r === null) return { ...vazio, situacao: "sem_referencia", valor: v };
    return { ...vazio, situacao: v > r ? "acima" : v < r ? "abaixo" : "dentro", valor: v, referencia: r, diferenca: v - r, variacao_pct: r !== 0 ? 100 * (v / r - 1) : null };
  }
  return { ...vazio, situacao: "sentido", valor: v };
}

/** Leitura de um determinante em uma frase: valor, data, posição frente à referência e o que ele não diz. */
export function leituraDeterminante(p: PainelDeterminante, m: MultiplosVisao): string {
  const pos = posicaoDeterminante(p, m);
  const quem = p.valor_atual.rotulo ? ` (${p.valor_atual.rotulo})` : "";
  const quando = p.id === "geracao" ? `nos 7 dias até ${dataBR(p.data_referencia)}` : `em ${dataBR(p.data_referencia)}`;
  if (pos.situacao === "sem_dado") return `${p.titulo}: sem dado na data de referência (${dataBR(p.data_referencia)}).`;
  const valor = valorAtualTexto(p);
  const fmt = (x: number | null) => comUnidade(x, p.unidade, p.casas);
  const ref = p.referencia;
  // o rótulo da referência já traz parênteses (anos da base, regime metodológico): dentro da leitura eles viram vírgulas
  const rotulo = minuscula(ref.rotulo).replace(/\s*\(([^()]*)\)/g, ", $1");
  if (ref.tipo === "faixa_constante" || ref.tipo === "faixa_por_data") {
    if (pos.situacao === "sem_referencia") return `${p.titulo}: ${valor}${quem} ${quando}; sem faixa de referência publicada para a data.`;
    const onde = pos.situacao === "dentro" ? "dentro da" : pos.situacao === "acima" ? "acima da" : "abaixo da";
    return `${p.titulo}: ${valor}${quem} ${quando}, ${onde} faixa de referência (${rotulo}: ${fmt(pos.inferior)} a ${fmt(pos.superior)}).`;
  }
  if (ref.tipo === "serie") {
    if (pos.situacao === "sem_referencia")
      return `${p.titulo}: ${valor}${quem} ${quando}; sem referência comparável (${rotulo}): o dia do ano anterior não tem valor ou está em outro regime metodológico.`;
    const pctTxt = pos.variacao_pct === null ? "" : `${num(Math.abs(pos.variacao_pct), 1)}% `;
    const onde = pos.situacao === "acima" ? "acima" : pos.situacao === "abaixo" ? "abaixo" : "igual";
    return `${p.titulo}: ${valor}${quem} ${quando}, ${onde === "igual" ? "igual à" : `${pctTxt}${onde} da`} referência (${rotulo}: ${fmt(pos.referencia)}).`;
  }
  // rede: o sinal dá o sentido; não há referência de capacidade
  const v = pos.valor ?? 0;
  const [de, para] = (p.valor_atual.rotulo ?? "").split(" → ");
  const sentido = de && para ? (v >= 0 ? `de ${de} para ${para}` : `de ${para} para ${de}`) : "";
  return `${p.titulo}: ${comUnidade(Math.abs(v), p.unidade, p.casas)}${sentido ? ` ${sentido}` : ""} ${quando} (saldo líquido do dia, a média das 24 horas do fluxo verificado, sem comparação com limites de intercâmbio).`;
}

/** Resposta do P005: uma leitura por painel, na ordem publicada. */
export function respostaDeterminantes(m: MultiplosVisao): string[] {
  return m.paineis.map((p) => leituraDeterminante(p, m));
}

/**
 * Veredito do P005 ("Como estão os principais determinantes?"): quais painéis estão dentro da faixa de referência que o
 * próprio painel publica, qual está fora e a comparação da carga com o ano anterior. A rede só tem o sentido do fluxo.
 * Os mesmos campos e a mesma posição de leituraDeterminante; os valores e as datas de cada painel ficam na resposta completa.
 */
export function vereditoDeterminantes(m: MultiplosVisao): string {
  const dentro: string[] = [];
  const fora: string[] = [];
  const semDado: string[] = [];
  const sentido: string[] = [];
  m.paineis.forEach((p) => {
    const pos = posicaoDeterminante(p, m);
    const nome = p.titulo;
    if (pos.situacao === "sem_dado") semDado.push(nome);
    else if (pos.situacao === "sentido") sentido.push(nome);
    else if (pos.situacao === "sem_referencia") semDado.push(`${nome} (sem referência)`);
    else if (p.referencia.tipo === "serie") {
      const ref = p.referencia.rotulo.split(",")[0];
      const pct = pos.variacao_pct === null ? "" : `${num(Math.abs(pos.variacao_pct), 1)}% `;
      fora.push(pos.situacao === "dentro" ? `${nome}: igual ao ${minuscula(ref)}` : `${nome}: ${pct}${pos.situacao === "acima" ? "acima" : "abaixo"} do ${minuscula(ref)}`);
    } else if (pos.situacao === "dentro") dentro.push(nome);
    else fora.push(`${nome}: ${pos.situacao === "acima" ? "acima" : "abaixo"} da faixa de referência`);
  });
  const partes: string[] = [];
  if (dentro.length) partes.push(`${listaEmPortugues(dentro.map((x, i) => (i === 0 ? x : minuscula(x))))} ${dentro.length === 1 ? "está" : "estão"} dentro da faixa de referência ${dentro.length === 1 ? "do painel" : "de cada painel"}.`);
  for (const f of fora) partes.push(`${f}.`);
  if (sentido.length) partes.push(`${sentido.join(", ")}: o painel mostra só o sentido do fluxo, sem comparação com limites de intercâmbio.`);
  if (semDado.length) partes.push(`Sem dado: ${listaEmPortugues(semDado.map((x) => minuscula(x)))}.`);
  return partes.join(" ");
}

/** Colunas da tabela equivalente aos pequenos múltiplos: a data e todas as colunas publicadas no recorte. */
export function colunasMultiplos(m: MultiplosVisao): ColunaTabela[] {
  const cols: ColunaTabela[] = [{ id: "d", rotulo: "Data", tipo: "data" }];
  for (const p of m.paineis) {
    for (const c of p.colunas) cols.push({ id: c.id, rotulo: `${p.titulo}: ${c.rotulo}`, tipo: "numero", unidade: p.unidade, casas: p.casas });
    const r = p.referencia;
    if (r.tipo === "faixa_por_data") {
      cols.push({ id: r.inferior, rotulo: `${p.titulo}: limite inferior da referência`, tipo: "numero", unidade: p.unidade, casas: p.casas });
      cols.push({ id: r.superior, rotulo: `${p.titulo}: limite superior da referência`, tipo: "numero", unidade: p.unidade, casas: p.casas });
    }
    if (r.tipo === "serie") cols.push({ id: r.coluna, rotulo: `${p.titulo}: ${minuscula(r.rotulo)}`, tipo: "numero", unidade: p.unidade, casas: p.casas });
  }
  return cols;
}

/** Linhas da tabela equivalente: as do recorte exibido, com os valores da gold sem alteração. */
export function linhasMultiplos(linhas: readonly LinhaMultiplos[]): LinhaTabela[] {
  return linhas.map((l) => ({ ...l, id: l.d }));
}

/** Ordem dos painéis na página e âncoras antigas (página inicial anterior) de cada um. */
export const ORDEM_DETERMINANTES: readonly IdPainelMultiplo[] = ["preco", "agua", "geracao", "carga", "rede"];

/**
 * Âncoras antigas da página inicial (mapa.ts, ANCORAS_VISAO_GERAL) que caem em cada
 * cartão dos determinantes: a seção e o painel de evidência de antes. "sistema" e
 * "observar" são blocos da própria página; os demais ficam nos cartões.
 */
export const ANCORAS_DETERMINANTES: Readonly<Record<IdPainelMultiplo, { id: string; painel: string }>> = {
  preco: { id: "preco", painel: "preco-painel" },
  agua: { id: "agua", painel: "agua-painel" },
  geracao: { id: "geracao", painel: "geracao-painel" },
  carga: { id: "consumo", painel: "carga-painel" },
  rede: { id: "rede", painel: "rede-painel" },
};

/* ---------------------------------------------------------------- P006: energia e sociedade */

/** Período de um indicador em poucas palavras (vigência, ano ou mês), sem sugerir que é o dia. */
export function periodoCurto(it: Pick<ItemSociedade, "periodo">): string {
  const { tipo, inicio, fim } = it.periodo;
  if (tipo === "vigencia") return `vigente em ${dataBR(fim)}`;
  if (tipo === "anual") return inicio.slice(0, 4) === fim.slice(0, 4) && inicio.endsWith("-01") && fim.endsWith("-12") ? `ano de ${inicio.slice(0, 4)}` : `${mesAno(inicio.slice(0, 7))} a ${mesAno(fim.slice(0, 7))}`;
  return inicio === fim ? mesAno(inicio.slice(0, 7)) : `${mesAno(inicio.slice(0, 7))} a ${mesAno(fim.slice(0, 7))}`;
}

/** Valor do indicador com a unidade, quando o texto publicado é só o número. */
export function valorSociedade(it: Pick<ItemSociedade, "valor_exibido" | "unidade" | "equivalente">): string {
  const soNumero = /^[\d.,−-]+$/.test(it.valor_exibido.trim());
  return `${it.valor_exibido}${soNumero ? ` ${it.unidade}` : ""}${it.equivalente ? ` (${it.equivalente})` : ""}`;
}

/** Texto de um complemento: número único ou par (faixa entre percentis ou atual e comparação). */
export function textoComplemento(c: { rotulo: string; valor: number | (number | null)[] | null; unidade: string | null; valor_exibido?: string }): string {
  if (c.valor_exibido) return c.valor_exibido;
  if (c.valor === null) return "sem dado";
  // tarifa: o cartão mostra o valor em R$/kWh (R$/MWh ÷ 1000, como o verbete TE e TUSD explica), então a faixa também
  if (c.unidade === "R$/MWh") {
    const kwh = (x: number | null) => (x === null ? "sem dado" : `R$ ${num(x / 1000, 4)}/kWh`);
    return Array.isArray(c.valor) ? `${kwh(c.valor[0])} ${/percentil/i.test(c.rotulo) ? "a" : "e"} ${kwh(c.valor[1])}` : kwh(c.valor);
  }
  if (c.unidade === "R$/mês" && typeof c.valor === "number") return `R$ ${num(c.valor, 2)} por mês`;
  // percentual colado ao número, como no resto da página ("61,6%", e não "61,6 %")
  const u = c.unidade ? (c.unidade.startsWith("%") ? c.unidade : ` ${c.unidade}`) : "";
  if (Array.isArray(c.valor)) {
    const [a, b] = c.valor;
    const f = (x: number | null) => (x === null ? "sem dado" : num(x, casasDe(x)));
    return `${f(a)} ${/percentil/i.test(c.rotulo) ? "a" : "e"} ${f(b)}${u}`;
  }
  return `${num(c.valor, casasDe(c.valor))}${u}`;
}

/* ---------------------------------------------------------------- ressalvas essenciais dos indicadores de sociedade */

/** Horas decimais como horas e minutos ("17,20" vira "17 h 12 min"), na forma do resto do observatório. */
export function horasMinutos(h: number): string {
  const total = Math.round(h * 60);
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  if (horas === 0) return `${minutos} min`;
  return minutos === 0 ? `${num(horas, 0)} h` : `${num(horas, 0)} h ${minutos} min`;
}

/** Parcelas do DEC que a regra exclui do apurado, na ordem em que a página as lista. */
export const PARCELAS_EXCLUIDAS_DEC = [
  { chave: "emergencia", rotulo: "situação de emergência" },
  { chave: "dia_critico", rotulo: "dia crítico" },
  { chave: "externa", rotulo: "origem externa ao sistema de distribuição" },
  { chave: "ons", rotulo: "racionamento ou alívio de carga pelo ONS" },
] as const;

/**
 * O DEC apurado de um ano com o que a regra deixa de fora dele (parcelas expurgadas e total de todas as origens) e a posição dos
 * conjuntos elétricos frente ao próprio limite. Tudo lido de qualidade.json, o mesmo conjunto de dados da página Qualidade:
 * a Visão geral não escreve nenhuma dessas horas, só as relê.
 */
export type DecDoAno = {
  ano: number;
  apurado: number;
  todasOrigens: number | null;
  /** Soma das parcelas excluídas, como publicadas; null quando alguma delas não foi publicada. */
  excluido: number | null;
  parcelas: { chave: (typeof PARCELAS_EXCLUIDAS_DEC)[number]["chave"]; rotulo: string; horas: number | null }[];
  /** Média dos limites dos conjuntos ponderada pelas unidades consumidoras médias: o projeto a calcula, não existe limite nacional. */
  limite: number | null;
  conjuntos: { total: number; acima: number; pct: number | null; pctUc: number | null } | null;
  quantis: { min: number | null; p25: number | null; p50: number | null; p75: number | null; max: number | null } | null;
};

export function decDoAno(q: { brasil: { anual: readonly BrasilAnual[] }; conjuntos: Conjuntos } | null | undefined, ano: number): DecDoAno | null {
  const a = q?.brasil.anual.find((x) => x.ano === ano);
  if (!q || !a || a.dec === null) return null;
  const p = a.parcelas_dec;
  const parcelas = PARCELAS_EXCLUIDAS_DEC.map((e) => ({ chave: e.chave, rotulo: e.rotulo, horas: p ? (p[e.chave] ?? null) : null }));
  const completas = parcelas.every((x) => x.horas !== null);
  const c = q.conjuntos;
  const doAno = c.ano === ano;
  return {
    ano,
    apurado: a.dec,
    todasOrigens: a.dec_todas_parcelas,
    excluido: completas ? parcelas.reduce((s, x) => s + (x.horas as number), 0) : null,
    parcelas,
    limite: a.dec_limite,
    conjuntos: doAno ? { total: c.com_limite, acima: c.acima_limite_dec, pct: c.pct_acima_limite_dec, pctUc: c.pct_ucs_acima_limite_dec } : null,
    quantis: doAno ? { min: c.quantis_dec.min ?? null, p25: c.quantis_dec.p25 ?? null, p50: c.quantis_dec.p50 ?? null, p75: c.quantis_dec.p75 ?? null, max: c.quantis_dec.max ?? null } : null,
  };
}

/** A ressalva essencial do DEC, junto do número: o que "apurado" quer dizer, o que a regra deixa de fora e o total de todas as origens. */
export function textoDecApurado(d: DecDoAno): string {
  const lista = d.parcelas.map((x) => (x.horas === null ? x.rotulo : `${x.rotulo} (${num(x.horas, 2)} h)`));
  const exclusoes = listaEmPortugues(lista);
  if (d.excluido === null || d.todasOrigens === null)
    return `O DEC apurado de ${d.ano}, ${num(d.apurado, 2)} h por unidade consumidora, não conta as interrupções que a regra exclui do apurado: ${exclusoes}. A fonte não publica todas essas parcelas para o ano.`;
  return (
    `O DEC apurado de ${d.ano}, ${num(d.apurado, 2)} h por unidade consumidora, não conta as interrupções que a regra exclui do apurado: ${exclusoes}, que somam ${num(d.excluido, 2)} h. ` +
    `Com todas as origens, o DEC de ${d.ano} foi de ${num(d.todasOrigens, 2)} h (${horasMinutos(d.todasOrigens)}).`
  );
}

/** Versão de uma linha da ressalva do DEC, para a nota que fica sob o número. */
export function textoDecApuradoCurto(d: DecDoAno): string {
  if (d.excluido === null || d.todasOrigens === null) return "Apurado: não conta as interrupções que a regra exclui.";
  return `Apurado: não conta ${num(d.excluido, 2)} h que a regra exclui; todas as origens somam ${num(d.todasOrigens, 2)} h.`;
}

/** O que o limite agregado é e o que ele não é, com a parcela de conjuntos acima do próprio limite. */
export function textoLimiteAgregado(d: DecDoAno): string {
  if (d.limite === null) return "";
  const base = `Não existe limite nacional de DEC. O limite agregado de ${num(d.limite, 2)} h é a média dos limites de cada conjunto elétrico, ponderada pelas unidades consumidoras médias do ano, calculada pelo observatório.`;
  const c = d.conjuntos;
  if (!c || c.pct === null) return base;
  const uc = c.pctUc === null ? "" : `, que reúnem ${num(c.pctUc, 1)}% das unidades consumidoras`;
  return `${base} Em ${d.ano}, ${num(c.acima, 0)} de ${num(c.total, 0)} conjuntos (${num(c.pct, 1)}%${uc}) ficaram acima do próprio limite.`;
}

/** Dispersão do DEC apurado entre os conjuntos elétricos: a média nacional não mostra que o valor varia de conjunto para conjunto. */
export function textoDispersaoDec(d: DecDoAno): string {
  const q = d.quantis;
  if (!q || q.min === null || q.max === null || q.p25 === null || q.p50 === null || q.p75 === null) return "";
  return `O DEC apurado de cada conjunto elétrico em ${d.ano} vai de ${num(q.min, 2)} h a ${num(q.max, 2)} h; metade dos conjuntos ficou entre ${num(q.p25, 2)} h e ${num(q.p75, 2)} h, com mediana de ${num(q.p50, 2)} h.`;
}

/**
 * Denominador da taxa de perdas: a energia injetada de referência das concessionárias do ano, quantas usam a energia requerida
 * (fornecida mais irregular mais perdas, leiaute de 2024 da ANEEL) ou uma mistura dos dois leiautes em vez da injetada publicada,
 * e a taxa que sairia com a injetada publicada. Lido de perdas_distribuidoras.csv e conferido contra a linha nacional da gold.
 */
export type DenominadorPerdas = {
  ano: number;
  concessionarias: number;
  requeridaOuMista: number;
  publicada: number;
  referenciaTwh: number;
  publicadaTwh: number;
  perdasTwh: number;
  taxaReferenciaPct: number;
  taxaPublicadaPct: number;
  /** Taxa publicada de cada concessionária do universo (perdas ÷ injetada de referência): menor, quartis e maior. */
  dispersao: { min: number; p25: number; mediana: number; p75: number; max: number } | null;
};

/** Linha da série `perdas_distribuidoras.csv` (campos do arquivo, como texto). */
export type LinhaPerdasCsv = Record<string, string>;

/**
 * As concessionárias do ano completo e sem alerta físico são as mesmas da linha nacional (`nacional`): se a conta não reproduz a
 * contagem e a energia injetada de referência da gold, devolve null em vez de afirmar um denominador que não bate.
 */
export function denominadorPerdas(
  linhas: readonly LinhaPerdasCsv[] | null | undefined,
  ano: number,
  nacional: { n_distribuidoras: number; injetada_mwh: number; perdas_totais_mwh: number } | null | undefined,
): DenominadorPerdas | null {
  if (!linhas || !nacional) return null;
  const doAno = linhas.filter((l) => l.ano === String(ano) && l.classificacao === "Concessionária" && l.completo === "1" && !(l.alertas ?? ""));
  if (doAno.length !== nacional.n_distribuidoras) return null;
  const soma = (k: string) => doAno.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const referencia = soma("injetada_referencia_mwh");
  const publicada = soma("injetada_publicada_mwh");
  const perdas = soma("perdas_totais_mwh");
  if (Math.abs(referencia - nacional.injetada_mwh) > 2 || Math.abs(perdas - nacional.perdas_totais_mwh) > 2 || publicada <= 0 || referencia <= 0) return null;
  const mista = doAno.filter((l) => l.origem_injetada === "requerida" || l.origem_injetada === "mista").length;
  const r = resumo(doAno.map((l) => (l.taxa_total_pct === "" || l.taxa_total_pct === undefined ? null : Number(l.taxa_total_pct))));
  const dispersao = r.n === doAno.length && r.min !== null && r.p25 !== null && r.mediana !== null && r.p75 !== null && r.max !== null ? { min: r.min, p25: r.p25, mediana: r.mediana, p75: r.p75, max: r.max } : null;
  return {
    ano,
    concessionarias: doAno.length,
    requeridaOuMista: mista,
    publicada: doAno.filter((l) => l.origem_injetada === "publicada").length,
    referenciaTwh: referencia / 1e6,
    publicadaTwh: publicada / 1e6,
    perdasTwh: perdas / 1e6,
    taxaReferenciaPct: (100 * perdas) / referencia,
    taxaPublicadaPct: (100 * perdas) / publicada,
    dispersao,
  };
}

export function textoDenominadorPerdas(d: DenominadorPerdas): string {
  return (
    `A taxa tem como denominador a energia injetada de referência (${num(d.referenciaTwh, 2)} TWh). Em ${num(d.requeridaOuMista, 0)} das ${num(d.concessionarias, 0)} concessionárias, ela é a energia requerida ` +
    `(fornecida mais irregular mais perdas, leiaute de 2024 da ANEEL) ou uma mistura dos dois leiautes, e não a linha de energia injetada publicada. ` +
    `Com a injetada publicada (${num(d.publicadaTwh, 2)} TWh), a mesma perda de ${num(d.perdasTwh, 2)} TWh daria ${num(d.taxaPublicadaPct, 1)}%, e não ${num(d.taxaReferenciaPct, 1)}%.`
  );
}

/** Dispersão da taxa entre as concessionárias: a taxa nacional não mostra que ela varia muito de uma distribuidora para outra. */
export function textoDispersaoPerdas(d: DenominadorPerdas): string {
  const q = d.dispersao;
  if (!q) return "";
  return `A taxa de cada uma das ${num(d.concessionarias, 0)} concessionárias em ${d.ano} vai de ${num(q.min, 1)}% a ${num(q.max, 1)}%; metade ficou entre ${num(q.p25, 1)}% e ${num(q.p75, 1)}%, com mediana de ${num(q.mediana, 1)}%.`;
}

export function textoDenominadorPerdasCurto(d: DenominadorPerdas): string {
  return `Denominador: energia injetada de referência, que em ${num(d.requeridaOuMista, 0)} das ${num(d.concessionarias, 0)} concessionárias é a requerida; com a injetada publicada, ${num(d.taxaPublicadaPct, 1)}%.`;
}

/**
 * Cobertura da tarifa de referência: a mediana é das distribuidoras com tarifa B1 residencial vigente na data; as demais ficaram
 * fora, e a página diz quantas e por quê. Lido de conta.json (tarifas.sem_vigente), o mesmo conjunto do módulo Conta de luz.
 */
export type CoberturaTarifa = {
  data: string;
  comTarifa: number;
  cnpjs: number;
  fora: number;
  /** Vigência anterior encerrada há 90 dias ou menos, com a seguinte ainda ausente do arquivo capturado. */
  foraRecente: number;
  /** Dessas, as que tiveram a vigência encerrada na véspera da data de referência. */
  naVespera: number;
  /** Sem tarifa há mais de 90 dias. */
  foraAntigas: number;
  incorporadas: number;
};

export function coberturaTarifa(
  conta: { tarifas: { resumo: { n: number }; sem_vigente: readonly { dias_sem_tarifa: number | null; incorporada_por: string | null; ultima_vigencia: { fim: string } | null }[] } } | null | undefined,
  data: string,
): CoberturaTarifa | null {
  if (!conta) return null;
  const sem = conta.tarifas.sem_vigente;
  const vespera = somaDias(data, -1);
  const recente = sem.filter((x) => x.dias_sem_tarifa !== null && x.dias_sem_tarifa <= 90);
  const antigas = sem.filter((x) => x.dias_sem_tarifa === null || x.dias_sem_tarifa > 90);
  return {
    data,
    comTarifa: conta.tarifas.resumo.n,
    cnpjs: conta.tarifas.resumo.n + sem.length,
    fora: sem.length,
    foraRecente: recente.length,
    naVespera: recente.filter((x) => x.ultima_vigencia?.fim === vespera).length,
    foraAntigas: antigas.length,
    incorporadas: antigas.filter((x) => x.incorporada_por !== null).length,
  };
}

export function textoCoberturaTarifa(c: CoberturaTarifa): string {
  if (c.fora === 0) return `Mediana das ${num(c.comTarifa, 0)} distribuidoras com tarifa B1 residencial vigente em ${dataBR(c.data)}, todas as que constam no conjunto de dados.`;
  const recentes =
    c.foraRecente > 0
      ? `${num(c.foraRecente, 0)} tiveram a vigência encerrada nos 90 dias anteriores e a tarifa seguinte ainda não constava no arquivo da ANEEL gerado em ${dataBR(c.data)}${c.naVespera > 0 ? ` (${num(c.naVespera, 0)} delas com a vigência encerrada em ${dataBR(somaDias(c.data, -1))})` : ""}`
      : "";
  const antigas =
    c.foraAntigas > 0
      ? `${num(c.foraAntigas, 0)} estão sem tarifa há mais de 90 dias${c.incorporadas > 0 ? ` (${num(c.incorporadas, 0)} incorporadas por outra distribuidora)` : ""}`
      : "";
  return (
    `A tarifa de referência é a mediana de ${num(c.comTarifa, 0)} distribuidoras com tarifa B1 residencial vigente em ${dataBR(c.data)}, de ${num(c.cnpjs, 0)} com tarifa no conjunto de dados. ` +
    `Ficaram fora ${num(c.fora, 0)}: ${[recentes, antigas].filter(Boolean).join("; ")}.`
  );
}

export function textoCoberturaTarifaCurto(c: CoberturaTarifa): string {
  return `Mediana de ${num(c.comTarifa, 0)} de ${num(c.cnpjs, 0)} distribuidoras: ${num(c.fora, 0)} ficaram fora (${num(c.foraRecente, 0)} com a tarifa seguinte ainda ausente do arquivo da ANEEL).`;
}

/** O que cada indicador de sociedade precisa dizer junto do número; ausente quando a gold de origem não está disponível. */
export type ContextoSociedade = { dec?: DecDoAno | null; perdas?: DenominadorPerdas | null; tarifa?: CoberturaTarifa | null };

/** Título de um indicador como a página o escreve: o DEC leva a palavra "apurado", que carrega a ressalva essencial. */
export function tituloSociedade(it: Pick<ItemSociedade, "id" | "titulo">): string {
  return it.id === "continuidade" ? `${it.titulo} (DEC apurado)` : it.titulo;
}

/** Título do cartão: o indicador mensal leva o mês no cabeçalho (a Tarifa Social de maio de 2025 não é a de outro mês). */
export function tituloCartaoSociedade(it: Pick<ItemSociedade, "id" | "titulo" | "periodo">): string {
  const t = tituloSociedade(it);
  return it.periodo.tipo === "mensal" ? `${t}, ${periodoCurto(it)}` : t;
}

/** A tarifa em R$/MWh, a unidade do conjunto de dados e da página Conta de luz, para quem compara com o cartão em R$/kWh. */
export function textoUnidadeTarifa(valorMwh: number): string {
  return `O cartão mostra a tarifa em R$/kWh; em R$/MWh, a unidade da página Conta de luz, é o mesmo valor multiplicado por 1.000: R$ ${num(valorMwh, 2)}/MWh.`;
}

/** Pergunta de cada indicador como a página a escreve; a do DEC diz que só as interrupções apuradas entram. */
export const PERGUNTA_SOCIEDADE: Partial<Record<IdSociedade, string>> = {
  continuidade: "Quanto tempo e quantas vezes, em média, cada consumidor ficou sem energia no ano, contadas só as interrupções que a regra apura?",
};

/**
 * Sigla com o nome por extenso no primeiro uso: "SCS" vira "SCS (Sistema de Controle de Subvenções e Programas Sociais)". Só a primeira
 * ocorrência de cada sigla da lista, e só se o texto ainda não a expande. O nome vem do dicionário de siglas do observatório.
 */
export function expandeSiglas(texto: string, siglas: readonly string[]): string {
  let out = texto;
  for (const sigla of siglas) {
    const nome = SIGLAS[sigla];
    if (!nome || out.includes(`${sigla} (${nome}`)) continue;
    out = out.replace(PADRAO_SIGLA(sigla), `${sigla} (${nome})`);
  }
  return out;
}

/** Valor de enumeração da gold ("ATRASADO", "EM DIA") escrito como palavra comum no texto corrido. */
export function enumLegivel(texto: string): string {
  return texto.replace(/\bEM DIA\b/g, "em dia").replace(/\bATRASADO\b/g, "atrasado").replace(/\bSEM SLA\b/g, "sem prazo declarado").replace(/\bSEM DADO\b/g, "sem registro");
}

/** Resposta do P006: cada indicador com o seu período; nenhum descreve o dia. */
export function respostaSociedade(s: SociedadeVisao, ctx: ContextoSociedade = {}): string {
  if (!s.itens.length) return "Nenhum indicador de energia e sociedade disponível nesta publicação.";
  const partes = s.itens.map((it) => {
    const atrasado = it.atualidade?.situacao === "ATRASADO" ? "; conjunto atrasado no painel de saúde dos dados" : "";
    if (it.id === "continuidade" && ctx.dec) {
      const limite = textoLimiteAgregado(ctx.dec);
      return `${tituloSociedade(it)}: ${valorSociedade(it)}, ${periodoCurto(it)}${atrasado}. ${textoDecApurado(ctx.dec)}${limite ? ` ${limite}` : ""}`;
    }
    const titulo = tituloSociedade(it);
    const extra = it.id === "perdas" && ctx.perdas ? ` ${textoDenominadorPerdas(ctx.perdas)}` : it.id === "tarifa" && ctx.tarifa ? ` ${textoCoberturaTarifa(ctx.tarifa)}` : "";
    return `${titulo}: ${valorSociedade(it)}, ${periodoCurto(it)}${atrasado}.${extra}`;
  });
  const aus = s.ausentes.length ? ` Sem dado: ${s.ausentes.map((a) => a.id).join(", ")}.` : "";
  return `Cada número tem o seu período, e nenhum descreve o dia. ${partes.join(" ")}${aus}`;
}

/** Valor com a unidade quando o texto publicado é só o número (sem o equivalente em horas e minutos do DEC). */
function valorComUnidade(it: Pick<ItemSociedade, "valor_exibido" | "unidade">): string {
  return /^[\d.,−-]+$/.test(it.valor_exibido.trim()) ? `${it.valor_exibido} ${it.unidade}` : it.valor_exibido;
}

/**
 * Veredito do P006 ("Como custo e qualidade chegam ao consumidor?"): a tarifa de referência e o tempo sem energia, cada um
 * com o seu período, e o limite de leitura (nenhum descreve o dia). Os mesmos itens e campos de respostaSociedade; perdas e
 * Tarifa Social ficam nos cartões.
 */
export function vereditoSociedade(s: SociedadeVisao, ctx: ContextoSociedade = {}): string {
  const por = new Map(s.itens.map((i) => [i.id, i]));
  const partes: string[] = [];
  const t = por.get("tarifa");
  if (t) partes.push(`A tarifa residencial de referência é ${valorComUnidade(t)}${/sem tributos/i.test(t.aviso) ? ", sem tributos" : ""}, ${periodoCurto(t)}.`);
  const c = por.get("continuidade");
  if (c) {
    // o número é o DEC apurado: o veredito diz o que a regra deixa de fora, para ninguém ler 9,33 h como todo o tempo sem energia
    const d = ctx.dec;
    partes.push(
      d && d.excluido !== null && d.todasOrigens !== null
        ? `O DEC apurado (${periodoCurto(c)}) foi de ${valorComUnidade(c)}, sem ${num(d.excluido, 2)} h que a regra exclui (todas as origens: ${num(d.todasOrigens, 2)} h).`
        : `O DEC apurado (${periodoCurto(c)}) foi de ${valorComUnidade(c)}, sem as interrupções que a regra exclui.`,
    );
  }
  if (!partes.length) {
    const outros = s.itens.slice(0, 2).map((it) => `${it.titulo}: ${valorComUnidade(it)} (${periodoCurto(it)})`);
    if (!outros.length) return "";
    partes.push(`${outros.join("; ")}.`);
  }
  partes.push("Nenhum número descreve o dia.");
  return partes.join(" ");
}

export const COLUNAS_SOCIEDADE: ColunaTabela[] = [
  { id: "indicador", rotulo: "Indicador", tipo: "texto" },
  { id: "valor", rotulo: "Valor", tipo: "numero", casas: 2 },
  { id: "unidade", rotulo: "Unidade", tipo: "texto" },
  { id: "valor_exibido", rotulo: "Como o módulo de origem exibe", tipo: "texto" },
  { id: "tipo_periodo", rotulo: "Tipo de período", tipo: "texto", categorica: true },
  { id: "inicio", rotulo: "Início do período", tipo: "data" },
  { id: "fim", rotulo: "Fim do período", tipo: "data" },
  { id: "defasagem", rotulo: "Defasagem", tipo: "texto" },
  { id: "atualidade", rotulo: "Atualidade do conjunto", tipo: "texto", categorica: true },
  { id: "cobertura", rotulo: "Cobertura", tipo: "texto" },
  { id: "gold", rotulo: "Módulo de origem", tipo: "texto" },
];

export const ROTULO_TIPO_PERIODO: Record<string, string> = { vigencia: "vigência", anual: "anual", mensal: "mensal" };

/** Tabela equivalente do P006: uma linha por indicador, com período e defasagem. */
export function linhasSociedade(s: SociedadeVisao): LinhaTabela[] {
  return s.itens.map((it) => ({
    id: it.id,
    indicador: it.titulo,
    valor: it.valor,
    unidade: it.unidade,
    valor_exibido: it.valor_exibido,
    tipo_periodo: ROTULO_TIPO_PERIODO[it.periodo.tipo] ?? it.periodo.tipo,
    inicio: inicioDoPeriodo(it.periodo.inicio),
    fim: fimDoPeriodo(it.periodo.fim),
    defasagem: enumLegivel(it.defasagem.texto),
    atualidade: it.atualidade?.situacao ? enumLegivel(it.atualidade.situacao) : null,
    cobertura: it.cobertura,
    gold: it.gold,
  }));
}

export type FaixaTempo = { id: string; rotulo: string; inicio: string; fim: string; defasagemDias: number; texto: string };

/** Período de referência de cada indicador contra a data de processamento (dias corridos até ela). */
export function faixasTempo(s: SociedadeVisao, dataProcessamento: string): FaixaTempo[] {
  return s.itens.map((it) => {
    const inicio = inicioDoPeriodo(it.periodo.inicio);
    const fim = fimDoPeriodo(it.periodo.fim);
    return { id: it.id, rotulo: it.titulo, inicio, fim, defasagemDias: diasEntre(fim, dataProcessamento), texto: periodoCurto(it) };
  });
}

/** Domínio comum da linha do tempo: do início mais antigo à data de processamento. */
export function dominioTempo(faixas: readonly FaixaTempo[], dataProcessamento: string): { inicio: string; fim: string; dias: number } {
  const inicio = faixas.reduce((a, f) => (f.inicio < a ? f.inicio : a), dataProcessamento);
  return { inicio, fim: dataProcessamento, dias: Math.max(1, diasEntre(inicio, dataProcessamento)) };
}

/* ---------------------------------------------------------------- P007: o que observar */

export const ROTULO_ESTADO: Record<EstadoRegra, string> = {
  ativo: "Em alerta",
  em_retorno: "Em alerta, em retorno",
  em_observacao: "Em observação",
  normal: "Normal",
  sem_dado: "Sem dado",
  evento: "Evento",
};

export const FILTROS_P007 = ["todas", "atencao", "sistema", "dados"] as const;
export type FiltroP007 = (typeof FILTROS_P007)[number];
export const ROTULO_FILTRO_P007: Record<FiltroP007, string> = {
  todas: "Todas",
  atencao: "Em alerta ou observação",
  sistema: "Sobre o sistema",
  dados: "Sobre os dados",
};

/** Regra que pede atenção hoje: em alerta (inclui em retorno) ou em observação; evento não conta. */
export function pedeAtencao(o: Pick<RegraObservar, "tipo" | "estado">): boolean {
  return o.tipo !== "evento" && (o.estado === "ativo" || o.estado === "em_retorno" || o.estado === "em_observacao");
}

/** Regras que passam no filtro, na ordem publicada. */
export function filtraRegras<T extends Pick<RegraObservar, "tipo" | "estado" | "assunto">>(regras: readonly T[], f: FiltroP007): T[] {
  if (f === "atencao") return regras.filter(pedeAtencao);
  if (f === "sistema") return regras.filter((o) => o.assunto === "sistema");
  if (f === "dados") return regras.filter((o) => o.assunto === "dados");
  return [...regras];
}

/** Resposta do P007: quantas regras estão em alerta e em observação, sobre o sistema e sobre os dados. */
export function respostaObservar(observar: readonly RegraObservar[]): string {
  const regras = observar.filter((o) => o.tipo !== "evento");
  const alerta = regras.filter((o) => o.ativo);
  const obs = regras.filter((o) => o.estado === "em_observacao");
  const sistema = alerta.filter((o) => o.assunto === "sistema");
  const dados = alerta.filter((o) => o.assunto === "dados");
  const nomes = (xs: RegraObservar[]) => xs.map((o) => minuscula(o.titulo)).join("; ");
  const partes: string[] = [];
  partes.push(
    alerta.length
      ? `Das ${num(regras.length, 0)} regras, ${alerta.length === 1 ? "1 está" : `${num(alerta.length, 0)} estão`} em alerta`
        + (sistema.length ? `; sobre o sistema: ${nomes(sistema)}` : "; nenhuma sobre o sistema")
        + (dados.length ? `; sobre os próprios dados: ${nomes(dados)}` : "")
        + "."
      : `Nenhuma das ${num(regras.length, 0)} regras está em alerta.`,
  );
  if (obs.length) partes.push(`${obs.length === 1 ? "Uma regra está" : `${num(obs.length, 0)} regras estão`} em observação (condição presente, ainda sem a duração mínima): ${nomes(obs)}.`);
  const sd = regras.filter((o) => o.estado === "sem_dado");
  if (sd.length) partes.push(`Sem dado para avaliar: ${nomes(sd)}.`);
  const ev = observar.filter((o) => o.tipo === "evento");
  if (ev.length) partes.push(`No calendário: ${nomes(ev)}.`);
  return partes.join(" ");
}

/**
 * Veredito do P007 ("Quais alterações são relevantes?"): se alguma regra sobre o sistema está em alerta, quais estão em
 * observação (condição presente, ainda sem a duração mínima) e quantas regras sobre os dados estão em alerta. Os mesmos campos
 * de respostaObservar.
 */
export function vereditoObservar(observar: readonly RegraObservar[]): string {
  const regras = observar.filter((o) => o.tipo !== "evento");
  const alerta = regras.filter((o) => o.ativo);
  const sistema = alerta.filter((o) => o.assunto === "sistema");
  const dados = alerta.filter((o) => o.assunto === "dados");
  const obs = regras.filter((o) => o.estado === "em_observacao");
  const partes: string[] = [];
  if (sistema.length) {
    const nomes = nomesNoVeredito(sistema, false);
    partes.push(`${sistema.length === 1 ? "Uma regra sobre o sistema está" : `${num(sistema.length, 0)} regras sobre o sistema estão`} em alerta${nomes ? `: ${nomes}` : ""}.`);
  } else partes.push("Nenhuma regra sobre o sistema está em alerta.");
  if (obs.length) {
    const nomes = nomesNoVeredito(obs, false);
    partes.push(`${obs.length === 1 ? "Uma regra está" : `${num(obs.length, 0)} regras estão`} em observação, ainda sem a duração mínima para virar alerta${nomes ? `: ${nomes}` : ""}.`);
  }
  if (dados.length) partes.push(`Sobre os próprios dados, ${dados.length === 1 ? "1 regra está" : `${num(dados.length, 0)} regras estão`} em alerta.`);
  return partes.join(" ");
}

/**
 * Regras cujo alerta é uma igualdade com o limiar, e não uma passagem por ele: o piso do PLD dispara com as 24 horas do dia no
 * mínimo vigente, e "acima de 24 horas" não existe num dia de 24 horas.
 */
const ALERTA_COM_O_LIMIAR: ReadonlySet<IdRegra> = new Set<IdRegra>(["pld_piso"]);

/** Texto do valor avaliado de uma regra com os limiares, na unidade da regra. */
export function textoValorRegra(o: Pick<RegraObservar, "valor" | "unidade"> & { id?: IdRegra }): string | null {
  const v = o.valor;
  if (!v) return null;
  const c = casasUnidade(o.unidade);
  const f = (x: number | null) => comUnidade(x, o.unidade, c);
  const igual = o.id !== undefined && ALERTA_COM_O_LIMIAR.has(o.id);
  const lim =
    v.limiar_inferior !== null && v.limiar_superior !== null
      ? `alerta abaixo de ${f(v.limiar_inferior)} ou acima de ${f(v.limiar_superior)}`
      : v.limiar_superior !== null
        ? igual
          ? `alerta com ${f(v.limiar_superior)}`
          : `alerta acima de ${f(v.limiar_superior)}`
        : v.limiar_inferior !== null
          ? `alerta abaixo de ${f(v.limiar_inferior)}`
          : "sem limiar numérico";
  return `${f(v.valor)} (${lim})`;
}

export const COLUNAS_REGRAS: ColunaTabela[] = [
  { id: "titulo", rotulo: "Regra", tipo: "texto" },
  { id: "assunto", rotulo: "Assunto", tipo: "texto", categorica: true },
  { id: "estado", rotulo: "Estado", tipo: "texto", categorica: true },
  { id: "referencia", rotulo: "Referência", tipo: "data" },
  { id: "valor", rotulo: "Valor avaliado", tipo: "numero", casas: 2 },
  { id: "limiar_inferior", rotulo: "Limiar inferior", tipo: "numero", casas: 2 },
  { id: "limiar_superior", rotulo: "Limiar superior", tipo: "numero", casas: 2 },
  { id: "unidade", rotulo: "Unidade", tipo: "texto" },
  { id: "duracao", rotulo: "Duração mínima", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "retorno", rotulo: "Retorno", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "desde", rotulo: "Avaliável desde", tipo: "data" },
  { id: "dias_avaliados", rotulo: "Dias avaliados", tipo: "numero", casas: 0 },
  { id: "pct_condicao", rotulo: "Dias com a condição", tipo: "percentual", casas: 1 },
  { id: "pct_alerta", rotulo: "Dias em alerta", tipo: "percentual", casas: 1 },
  { id: "episodios", rotulo: "Episódios", tipo: "numero", casas: 0 },
  { id: "por_ano", rotulo: "Episódios por ano", tipo: "numero", casas: 1 },
  { id: "descartados", rotulo: "Acionamentos curtos descartados", tipo: "numero", casas: 0 },
];

/** Tabela equivalente da lista de regras: estado do dia, limiares e frequência de disparo. */
export function linhasRegras(observar: readonly RegraObservar[]): LinhaTabela[] {
  return observar.map((o) => ({
    id: o.id,
    titulo: o.titulo,
    assunto: o.tipo === "evento" ? "evento" : o.assunto,
    estado: ROTULO_ESTADO[o.estado] ?? o.estado,
    referencia: o.referencia,
    valor: o.valor?.valor ?? null,
    limiar_inferior: o.valor?.limiar_inferior ?? null,
    limiar_superior: o.valor?.limiar_superior ?? null,
    unidade: o.unidade,
    duracao: o.duracao_minima_dias,
    retorno: o.retorno_dias,
    desde: o.historico?.primeiro_dia_avaliado ?? null,
    dias_avaliados: o.historico?.dias_avaliados ?? null,
    pct_condicao: o.historico?.pct_dias_com_condicao ?? null,
    pct_alerta: o.historico?.pct_dias_exibidos ?? null,
    episodios: o.historico?.episodios ?? null,
    por_ano: o.historico?.episodios_por_ano ?? null,
    descartados: o.historico?.acionamentos_curtos_descartados ?? null,
  }));
}

export const COLUNAS_SENSIBILIDADE: ColunaTabela[] = [
  { id: "regra", rotulo: "Regra", tipo: "texto", categorica: true },
  { id: "duracao", rotulo: "Duração mínima", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "adotada", rotulo: "Adotada", tipo: "texto", categorica: true },
  { id: "episodios", rotulo: "Episódios", tipo: "numero", casas: 0 },
  { id: "dias", rotulo: "Dias em alerta", tipo: "numero", casas: 0 },
  { id: "pct", rotulo: "Dias em alerta", tipo: "percentual", casas: 1 },
  { id: "por_ano", rotulo: "Episódios por ano", tipo: "numero", casas: 1 },
];

/** Sensibilidade de cada regra a durações mínimas de 1, 3, 7 e 14 dias. */
export function linhasSensibilidade(observar: readonly RegraObservar[]): LinhaTabela[] {
  return observar.flatMap((o) =>
    (o.historico?.sensibilidade_duracao ?? []).map((s) => ({
      id: `${o.id}:${s.duracao_minima_dias}`,
      regra: o.titulo,
      duracao: s.duracao_minima_dias,
      adotada: s.duracao_minima_dias === o.duracao_minima_dias ? "sim" : "não",
      episodios: s.episodios,
      dias: s.dias_exibidos,
      pct: s.pct_dias_exibidos,
      por_ano: s.por_ano,
    })),
  );
}

export const COLUNAS_EPISODIOS: ColunaTabela[] = [
  { id: "regra", rotulo: "Regra", tipo: "texto", categorica: true },
  { id: "inicio", rotulo: "Início da condição", tipo: "data" },
  { id: "confirmado_em", rotulo: "Alerta confirmado em", tipo: "data" },
  { id: "fim", rotulo: "Último dia com a condição", tipo: "data" },
  { id: "normalizado_em", rotulo: "Normalizado em", tipo: "data" },
  { id: "dias_condicao", rotulo: "Dias com a condição", tipo: "numero", casas: 0 },
  { id: "duracao", rotulo: "Duração", tipo: "numero", unidade: "dias", casas: 0 },
  { id: "em_curso", rotulo: "Em curso", tipo: "texto", categorica: true },
];

/** Últimos episódios publicados de cada regra. */
export function linhasEpisodios(observar: readonly RegraObservar[]): LinhaTabela[] {
  return observar.flatMap((o) =>
    (o.historico?.ultimos_episodios ?? []).map((e) => ({
      id: `${o.id}:${e.inicio}`,
      regra: o.titulo,
      inicio: e.inicio,
      confirmado_em: e.confirmado_em,
      fim: e.fim,
      normalizado_em: e.normalizado_em,
      dias_condicao: e.dias_condicao,
      duracao: e.duracao_dias,
      em_curso: e.em_curso ? "sim" : "não",
    })),
  );
}

export const COLUNAS_ALTERNATIVAS: ColunaTabela[] = [
  { id: "regra", rotulo: "Regra", tipo: "texto", categorica: true },
  { id: "condicao", rotulo: "Variante avaliada", tipo: "texto" },
  { id: "pct", rotulo: "Dias em alerta", tipo: "percentual", casas: 1 },
  { id: "episodios", rotulo: "Episódios", tipo: "numero", casas: 0 },
  { id: "desde", rotulo: "Avaliável desde", tipo: "data" },
  { id: "motivo", rotulo: "Por que não foi adotada", tipo: "texto" },
];

/** Variantes rejeitadas de cada regra, com a frequência que teriam. */
export function linhasAlternativas(observar: readonly RegraObservar[]): LinhaTabela[] {
  return observar.flatMap((o) =>
    (o.alternativas_avaliadas ?? [])
      .filter((a) => !a.adotada)
      .map((a) => ({ id: `${o.id}:${a.id}`, regra: o.titulo, condicao: a.condicao, pct: a.pct_dias_exibidos, episodios: a.episodios, desde: a.primeiro_dia_avaliado, motivo: a.motivo })),
  );
}

/** Trecho da linha de estado: dias seguidos no mesmo estado (A alerta, o observação, . normal, - sem dado). */
export type TrechoEstado = { estado: string; inicio: string; fim: string; dias: number };

/** Linha de estado (um caractere por dia a partir de `inicio`) em trechos contínuos. */
export function trechosEstado(le: { inicio: string | null; estados: string } | undefined): TrechoEstado[] {
  if (!le?.inicio || !le.estados) return [];
  const out: TrechoEstado[] = [];
  let i = 0;
  while (i < le.estados.length) {
    const c = le.estados[i];
    let j = i;
    while (j + 1 < le.estados.length && le.estados[j + 1] === c) j++;
    out.push({ estado: c, inicio: somaDias(le.inicio, i), fim: somaDias(le.inicio, j), dias: j - i + 1 });
    i = j + 1;
  }
  return out;
}

/** Contagem de dias por estado na linha publicada. */
export function contagemEstados(le: { estados: string } | undefined): Record<string, number> {
  const c: Record<string, number> = {};
  for (const ch of le?.estados ?? "") c[ch] = (c[ch] ?? 0) + 1;
  return c;
}

/** Domínio comum (primeiro e último dia) das linhas de estado de várias regras, para alinhar a comparação. */
export function dominioEstados(regras: readonly Pick<RegraObservar, "linha_estado">[]): { inicio: string; fim: string } | null {
  let ini: string | null = null;
  let fim: string | null = null;
  for (const r of regras) {
    const le = r.linha_estado;
    if (!le?.inicio || !le.estados) continue;
    const f = somaDias(le.inicio, le.estados.length - 1);
    if (!ini || le.inicio < ini) ini = le.inicio;
    if (!fim || f > fim) fim = f;
  }
  return ini && fim ? { inicio: ini, fim } : null;
}

/** Texto da linha de estado em palavras (alternativa ao desenho). */
export function textoLinhaEstado(o: Pick<RegraObservar, "linha_estado">): string | null {
  const le = o.linha_estado;
  if (!le?.inicio || !le.estados) return null;
  const c = contagemEstados(le);
  const fim = somaDias(le.inicio, le.estados.length - 1);
  const partes = [
    c["A"] ? `${plural(c["A"], "dia", "dias")} com alerta exibido` : "nenhum dia com alerta exibido",
    c["o"] ? `${plural(c["o"], "dia", "dias")} com a condição sem a duração mínima` : null,
    c["."] ? `${plural(c["."], "dia normal", "dias normais")}` : null,
    c["-"] ? `${plural(c["-"], "dia", "dias")} sem dado` : null,
  ].filter(Boolean);
  return `De ${dataBR(le.inicio)} a ${dataBR(fim)}: ${partes.join(", ")}.`;
}

/** Frequência conjunta da caixa de destaques em uma frase, com a meta de materialidade. */
export function textoFrequenciaConjunta(g: Pick<SinteseVisaoGold, "destaques">): string | null {
  const f = g.destaques.frequencia_conjunta;
  if (!f) return null;
  const pc = f.periodo_comum;
  return (
    `No período em que todas as regras sobre o sistema são avaliáveis (${dataBR(pc.inicio)} a ${dataBR(pc.fim)}), a caixa de destaques teria ficado ocupada em `
    + `${num(pc.dias_com_destaque, 0)} de ${num(pc.dias, 0)} dias (${num(pc.pct_dias_com_destaque, 1)}%); a meta é no máximo ${num(f.meta_pct, 1)}%`
    + `${f.atende_meta ? ", cumprida" : ", não cumprida"}. O limite de novidade é de ${plural(f.novidade_dias, "dia", "dias")} depois da confirmação.`
  );
}

/* ---------------------------------------------------------------- conciliações no ponto de uso (r8) */

const sinal = (v: number) => (v >= 0 ? "acima" : "abaixo");

/**
 * Carga contra o ano anterior em duas janelas: a frase do P004 compara a média dos 7 dias com as mesmas datas do ano
 * anterior; o painel de determinantes compara o dia com o mesmo dia da semana, 364 dias antes. Lê os dois números da gold
 * (frase `carga` e painel `carga`) e as datas de cada janela; não recalcula nenhum percentual.
 */
export function notaCarga(g: Pick<SinteseVisaoGold, "frases" | "multiplos">): string | null {
  const f = g.frases.find((x) => x.id === "carga");
  const m = g.multiplos;
  const p = m?.paineis.find((x) => x.id === "carga");
  const v7 = f?.valores.variacao_pct?.valor;
  const [atual, anterior] = f?.qualidade.janelas ?? [];
  if (!f || !m || !p || typeof v7 !== "number" || !atual || !anterior) return null;
  const pos = posicaoDeterminante(p, m);
  if (pos.variacao_pct === null) return null;
  const dia = p.data_referencia;
  return (
    `A carga aparece contra o ano anterior de duas formas: a média dos 7 dias de ${dataBR(atual.inicio)} a ${dataBR(atual.fim)}, contra ${dataBR(anterior.inicio)} a ${dataBR(anterior.fim)}, ficou ${num(Math.abs(v7), 1)}% ${sinal(v7)}; ` +
    `o dia ${dataBR(dia)}, contra o mesmo dia da semana (${dataBR(somaDias(dia, -364))}), ficou ${num(Math.abs(pos.variacao_pct), 1)}% ${sinal(pos.variacao_pct)}. ` +
    `A janela e o dia de comparação são diferentes, e por isso os dois percentuais não precisam coincidir.`
  );
}

/**
 * Rede: a frase do P004 traz a média de 30 dias da fronteira de maior fluxo; o painel de determinantes, o fluxo médio de um
 * dia. Só escreve a nota quando as duas leituras são da mesma fronteira (o par da frase está no caminho do valor do painel).
 */
export function notaRede(g: Pick<SinteseVisaoGold, "frases" | "multiplos">): string | null {
  const f = g.frases.find((x) => x.id === "rede");
  const p = g.multiplos?.paineis.find((x) => x.id === "rede");
  const media = f?.valores.fluxo_mwmed?.valor;
  const par = f?.valores.par?.valor;
  const ini = f?.valores.inicio?.valor;
  const fim = f?.valores.fim?.valor;
  const dia = p?.valor_atual.valor;
  if (!f || !p || typeof media !== "number" || typeof par !== "string" || typeof ini !== "string" || typeof fim !== "string" || typeof dia !== "number") return null;
  if (!p.valor_atual.caminho?.includes(`[${par}]`)) return null;
  const nome = p.valor_atual.rotulo ?? par;
  return (
    `Na fronteira ${nome}, a frase de Rede traz a média dos 30 dias de ${dataBR(ini)} a ${dataBR(fim)} (${comUnidade(media, "MWmed", 0)}) e o gráfico de Rede traz o fluxo médio do dia ${dataBR(p.data_referencia)} (${comUnidade(dia, "MWmed", 0)}). ` +
    `Média de 30 dias e valor de um dia não precisam coincidir.`
  );
}

/** Mês de uma série mensal do módulo de Inclusão (inclusao.json, tarifa_social.serie_mensal), com a completude que o módulo publica. */
export type MesSerieTarifaSocial = { m: string; completo: boolean; distribuidoras?: number; distribuidoras_faltantes?: number };

/**
 * Tarifa Social: o cartão usa o último mês completo do arquivo do SCS e a regra de atualidade usa o último mês do arquivo,
 * que pode estar incompleto. Escreve a ponte entre os dois meses; sem divergência, devolve null.
 */
export function notaTarifaSocial(it: Pick<ItemSociedade, "periodo" | "atualidade">, serie: readonly MesSerieTarifaSocial[] | null | undefined): string | null {
  const ultimo = it.atualidade?.ultimo_periodo;
  const ref = it.periodo.fim.slice(0, 7);
  if (!ultimo || ultimo.slice(0, 7) === ref) return null;
  const mes = (serie ?? []).find((x) => x.m === ultimo.slice(0, 7));
  const base = `O número é de ${mesAno(ref)}, o último mês completo do arquivo da ANEEL; o conjunto chega a ${mesAno(ultimo.slice(0, 7))}, e é esse último mês que a regra de atualidade usa para dizer que a fonte está atrasada.`;
  if (mes && !mes.completo && typeof mes.distribuidoras_faltantes === "number")
    return `${base} ${mesAno(mes.m)} não entra no número porque está incompleto: ${plural(mes.distribuidoras_faltantes, "distribuidora esperada não informou", "distribuidoras esperadas não informaram")} nesse mês.`;
  return base;
}

/** Semana do CMO semanal do ONS por subsistema (cmo.json, serie). */
export type SemanaCmo = { s: string; SE: number; S: number; NE: number; N: number };

/**
 * CMO semanal: o Norte difere de cada um dos outros três subsistemas na semana de referência. Lê a série publicada e conta há
 * quantas semanas seguidas isso acontece, para o leitor ver que não é um valor isolado nem de outra semana. A causa não está
 * no dado: a nota diz isso.
 */
export function notaCmoNorte(serie: readonly SemanaCmo[] | null | undefined, referencia: string): string | null {
  const ate = (serie ?? []).filter((x) => x.s <= referencia);
  const ult = ate[ate.length - 1];
  if (!ult || ult.s !== referencia) return null;
  const difere = (x: SemanaCmo) => [x.SE, x.S, x.NE].every((v) => Math.abs(x.N - v) > 0.005);
  if (!difere(ult)) return null;
  let n = 0;
  for (let i = ate.length - 1; i >= 0 && difere(ate[i]); i--) n++;
  const outros = listaEmPortugues(Array.from(new Set([ult.SE, ult.S, ult.NE])).map((v) => comUnidade(v, "R$/MWh", 2)));
  const quando = n < 2 ? "" : `, e a série semanal do ONS mostra essa diferença em ${plural(n, "semana seguida", "semanas seguidas")}, desde a semana de ${dataBR(ate[ate.length - n].s)}`;
  return `Na semana de ${dataBR(ult.s)}, o Norte (${comUnidade(ult.N, "R$/MWh", 2)}) difere de cada um dos outros três subsistemas (${outros})${quando}. O dado do ONS não informa o motivo, e o observatório não o atribui.`;
}

/**
 * Aviso de um complemento sem o bastidor de coleta: o parêntese com o nome de campo da fonte (NumCon) sai do texto do
 * leitor e fica inteiro no detalhe, que a página põe em Analisar. O leitor lê a mesma exclusão em palavras comuns.
 */
export function avisoSemBastidor(aviso: string): { leitor: string; detalhe: string } {
  const m = /\s*\(([^()]*NumCon[^()]*)\)/.exec(aviso);
  if (!m) return { leitor: aviso, detalhe: "" };
  const quem = /NumCon implausível de ([^;)]+)/.exec(m[1])?.[1]?.trim();
  const leitor = aviso.replace(m[0], ` (o número de unidades consumidoras informado${quem ? ` por ${quem}` : ""} não é plausível)`);
  return { leitor, detalhe: m[1] };
}

/**
 * Identificadores de conjunto ("aneel_scs", "ear_subsistema_di") no texto de uma regra trocados pelo título do conjunto no
 * painel de saúde dos dados (publicacao.json). Os identificadores trocados voltam em `ids`, para a página mostrá-los em Analisar.
 */
export function conjuntosLegiveis(texto: string, titulos: Readonly<Record<string, string>>): { texto: string; ids: string[] } {
  const ids: string[] = [];
  const out = texto.replace(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g, (id) => {
    if (!titulos[id]) return id;
    if (!ids.includes(id)) ids.push(id);
    return titulos[id];
  });
  return { texto: out, ids };
}

/* ---------------------------------------------------------------- r10: episódios, EAR sem arredondamento duplo e janela dos determinantes */

/**
 * O corte da tabela de episódios: a gold guarda os últimos episódios de cada regra (até cinco), e o arquivo para baixar traz todos. A
 * tabela diz quantos lista e quantos existem, em vez de se apresentar como a lista inteira.
 */
export function corteEpisodios(observar: readonly Pick<RegraObservar, "historico">[], inicioHistorico: string): { listados: number; total: number; porRegra: number; texto: string } {
  const comHistorico = observar.filter((o) => o.historico);
  const listados = comHistorico.reduce((s, o) => s + (o.historico?.ultimos_episodios.length ?? 0), 0);
  const total = comHistorico.reduce((s, o) => s + (o.historico?.episodios ?? 0), 0);
  const porRegra = comHistorico.reduce((m, o) => Math.max(m, o.historico?.ultimos_episodios.length ?? 0), 0);
  const texto =
    listados >= total
      ? `A tabela lista todos os ${num(total, 0)} episódios registrados desde ${dataBR(inicioHistorico)}.`
      : `A tabela lista os últimos ${num(porRegra, 0)} episódios de cada regra: ${num(listados, 0)} dos ${num(total, 0)} registrados desde ${dataBR(inicioHistorico)}. A lista completa está no arquivo de episódios das regras (CSV).`;
  return { listados, total, porRegra, texto };
}

/** EAR do SIN em % da EAR máxima com quatro casas (ear_diario.csv, coluna SIN_calculado), por data. Linhas no formato de lerCsvComAspas. */
export function serieEarSin(linhas: readonly (readonly string[])[]): Map<string, number> {
  const [cab, ...resto] = linhas;
  const out = new Map<string, number>();
  if (!cab) return out;
  const iData = cab.indexOf("data");
  const iSin = cab.indexOf("SIN_calculado");
  if (iData < 0 || iSin < 0) return out;
  for (const l of resto) {
    const v = Number(l[iSin]);
    if (l[iSin] !== "" && l[iSin] !== undefined && Number.isFinite(v)) out.set(l[iData], v);
  }
  return out;
}

/**
 * A EAR do SIN dos determinantes com o valor da série publicada, sem o arredondamento a duas casas que a gold da síntese aplica antes
 * de o gráfico e a tabela arredondarem de novo a uma casa (61,6473 vira 61,65 e depois 61,7). O gráfico, a tabela, o anúncio por teclado e o
 * arquivo exportado passam a arredondar uma só vez, a partir do mesmo valor do cartão. Só troca o valor quando ele é o mesmo da gold
 * na precisão em que a gold o publica; nunca preenche dia sem valor nem usa outra grandeza.
 */
export function comEarPrecisa(dados: readonly LinhaMultiplos[], ear: ReadonlyMap<string, number>): LinhaMultiplos[] {
  return dados.map((l) => {
    const v = ear.get(l.d);
    const antes = l.agua_SIN;
    if (v === undefined || typeof antes !== "number") return l;
    return Math.abs(v - antes) <= 0.0051 ? { ...l, agua_SIN: v } : l;
  });
}

/** Mediana da data da EAR do SIN (hidrologia.json, bandas_ear, SIN_p50) copiada para cada dia, pela mesma regra do dia do calendário das faixas. */
export function comMedianaAgua(dados: readonly LinhaMultiplos[], bandas: readonly { md: string; SIN_p50?: number | null }[]): LinhaMultiplos[] {
  const porMd = new Map(bandas.map((b) => [b.md, b.SIN_p50 ?? null]));
  return dados.map((l) => {
    const md = l.d.slice(5, 10) === "02-29" ? "02-28" : l.d.slice(5, 10);
    const p50 = porMd.get(md);
    return p50 === undefined || p50 === null ? l : { ...l, agua_p50: p50 };
  });
}

/** Texto do campo "Período" dos determinantes para a janela escolhida: o recorte exibido, não o recorte publicado. */
export function periodoDaJanela(linhas: readonly Pick<LinhaMultiplos, "d">[]): string {
  if (!linhas.length) return "sem dia na janela";
  return `${dataBR(linhas[0].d)} a ${dataBR(linhas[linhas.length - 1].d)} (${plural(linhas.length, "dia", "dias")} alinhados pelo calendário); cada gráfico termina na data de referência da sua fonte`;
}

/**
 * Valor do painel no dia de referência lido da própria série exibida (a mesma célula do gráfico e da tabela). A coluna é a do rótulo do
 * valor do painel (na rede, a fronteira de maior fluxo; no preço, o Sudeste/Centro-Oeste) ou, sem rótulo igual, a primeira. A série só
 * substitui o valor da gold quando os dois coincidem na casa em que a gold o publica (a gold guarda a EAR do cartão com uma casa e a da
 * série com duas ou quatro); diferença maior mantém o valor da gold, e dia sem valor continua sem valor.
 */
export function valorDoDiaNaSerie(p: Pick<PainelDeterminante, "colunas" | "data_referencia" | "valor_atual" | "casas">, linhas: readonly LinhaMultiplos[]): number | null {
  const gold = p.valor_atual.valor;
  const col = (p.colunas.find((c) => c.rotulo === p.valor_atual.rotulo) ?? p.colunas[0])?.id;
  const x = col ? linhas.find((l) => l.d === p.data_referencia)?.[col] : undefined;
  if (typeof x !== "number" || gold === null) return gold;
  return Math.abs(x - gold) <= 0.5 * 10 ** -p.casas + 1e-9 ? x : gold;
}

/* ---------------------------------------------------------------- r10: regras de cada frase */

/**
 * Regras do "O que observar" que avaliam o mesmo indicador de cada frase: a frase leva a marca da regra quando ela está em alerta ou em
 * observação, para o leitor do topo não ver 168,6% da média de longo termo sem saber que a regra de afluência já está em observação.
 */
export const REGRAS_DA_FRASE: Readonly<Record<IdFrase, readonly IdRegra[]>> = {
  reservatorios: ["ear_faixa"],
  afluencias: ["ena_faixa"],
  carga: ["carga_extrema"],
  termica: ["termica"],
  pld: ["pld_piso", "pld_teto", "descolamento"],
  rede: [],
};

export function regrasDaFrase<T extends Pick<RegraObservar, "id" | "tipo" | "estado">>(id: IdFrase, observar: readonly T[]): T[] {
  const ids = REGRAS_DA_FRASE[id];
  return observar.filter((o) => o.tipo !== "evento" && ids.includes(o.id) && (o.estado === "ativo" || o.estado === "em_retorno" || o.estado === "em_observacao"));
}

/* ---------------------------------------------------------------- r10: cada medida diz o corte e a data que usa, e o que o módulo de origem mostra */

const MES_POR_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const reaisMwh = (v: number) => `R$ ${num(v, 2)}/MWh`;

/** O mesmo mês nos anos anteriores: a referência sazonal do PLD (pld_detalhe.json, historico.posicao_referencia). */
export type PosicaoPldSazonal = { mes: number; percentil: number | null; n_dias: number; p50: number | null; anos: readonly number[] };

/** "percentil 38,7 entre as 150 médias diárias de setembro de 2021 a 2025 (mediana R$ 247,81/MWh)"; null sem percentil. */
export function textoSazonalPld(s: PosicaoPldSazonal): string | null {
  if (s.percentil === null) return null;
  const anos = s.anos.length > 1 ? ` de ${s.anos[0]} a ${s.anos[s.anos.length - 1]}` : s.anos.length === 1 ? ` de ${s.anos[0]}` : "";
  const mediana = s.p50 === null ? "" : `, mediana ${reaisMwh(s.p50)}`;
  return `percentil ${num(s.percentil, 1)} entre as ${num(s.n_dias, 0)} médias diárias de ${MES_POR_EXTENSO[s.mes - 1]}${anos}${mediana}`;
}

/**
 * Os dois critérios que a página usa para dizer onde está o PLD do dia, lado a lado com a ponte: a frase compara com todas as
 * médias diárias nominais desde 2021 (todos os meses, anos com pisos e tetos diferentes) e a página de PLD compara com o mesmo mês
 * dos anos anteriores. Cada número vem da gold de PLD, e os limites vêm dos regimes anuais publicados.
 */
export function textoDoisCriteriosPld(a: {
  media: number;
  percentilTodos: number | null;
  diasTodos: number;
  sazonal: PosicaoPldSazonal | null;
  pisos: readonly number[];
  anoInicial: string;
  anoFinal: string;
}): string | null {
  const sazonal = a.sazonal ? textoSazonalPld(a.sazonal) : null;
  if (a.percentilTodos === null) return null;
  const piso = a.pisos.length ? ` Os dois critérios juntam anos com limites regulatórios diferentes: o piso foi de R$ ${num(Math.min(...a.pisos), 2)} a ${reaisMwh(Math.max(...a.pisos))} entre ${a.anoInicial} e ${a.anoFinal}.` : "";
  return (
    `Dois critérios para a mesma média de ${reaisMwh(a.media)}: a frase compara com as ${num(a.diasTodos, 0)} médias diárias nominais desde 2021, de todos os meses, e dá percentil ${num(a.percentilTodos, 1)}` +
    `${sazonal ? `; a referência sazonal da página de PLD compara com o mesmo mês dos anos anteriores e dá ${sazonal}` : ""}.${piso}`
  );
}

/** EAR do SIN e capacidade: a faixa do mesmo dia está em % da EAR máxima de cada ano, e a EAR máxima mudou ao longo da base. */
export function textoCapacidadeAgua(a: { periodoBase: string | null; minMwmes: number | null; maxMwmes: number | null; mudou: boolean }): string | null {
  if (!a.mudou || a.minMwmes === null || a.maxMwmes === null || a.maxMwmes <= 0) return null;
  const queda = (100 * (a.maxMwmes - a.minMwmes)) / a.maxMwmes;
  const base = a.periodoBase ? ` de ${a.periodoBase.replace("-", " a ")}` : "";
  return `A faixa e a mediana comparam anos${base} em % da EAR máxima de cada época, e a EAR máxima do SIN variou de ${num(a.minMwmes, 0)} a ${num(a.maxMwmes, 0)} MWmês nesse período (a menor ${num(queda, 1)}% abaixo da maior): o mesmo percentual em épocas diferentes não é a mesma energia.`;
}

/** A EAR que o módulo Água e clima mostra, quando o dia dele não é o da Visão geral: cada página diz o dia que usa. */
export function textoEarNoModulo(a: { diaVisao: string; diaModulo: string | null; pctModulo: number | null }): string | null {
  if (a.diaModulo === null || a.pctModulo === null || a.diaModulo === a.diaVisao) return null;
  return `A página Água e clima, de outra captura do ONS, traz ${num(a.pctModulo, 1)}% em ${dataBR(a.diaModulo)}.`;
}

/** A carga nos dois cortes: o que esta página usa na frase e o padrão da página Carga, com os dois percentuais na mesma casa. */
export function textoCargaNoModulo(a: { mesmasDatasPct: number | null; mesmosDiasDaSemanaPct: number | null; mesmosDiasDaSemanaInicio: string | null; mesmosDiasDaSemanaFim: string | null }): string | null {
  if (a.mesmasDatasPct === null || a.mesmosDiasDaSemanaPct === null) return null;
  const periodo = a.mesmosDiasDaSemanaInicio && a.mesmosDiasDaSemanaFim ? ` (${dataBR(a.mesmosDiasDaSemanaInicio)} a ${dataBR(a.mesmosDiasDaSemanaFim)})` : "";
  const direcao = (v: number) => (v >= 0 ? "alta" : "queda");
  return `Na página Carga, a comparação padrão é com os mesmos dias da semana, 52 semanas antes${periodo}: ${direcao(a.mesmosDiasDaSemanaPct)} de ${num(Math.abs(a.mesmosDiasDaSemanaPct), 2)}%. Esta página usa as mesmas datas do ano anterior, que na Carga dão ${direcao(a.mesmasDatasPct)} de ${num(Math.abs(a.mesmasDatasPct), 2)}%.`;
}

/** Horas do dia em que o fluxo da fronteira foi contra o sentido do saldo líquido (o saldo as compensa). */
export function horasContraOSaldo(c: { liquido_mwh: readonly (number | null)[]; horas: readonly (number | null)[]; horas_inverso: readonly (number | null)[] }, i: number): number | null {
  const liq = c.liquido_mwh[i];
  const h = c.horas[i];
  const inv = c.horas_inverso[i];
  if (liq === null || liq === undefined || h === null || h === undefined || inv === null || inv === undefined) return null;
  return liq >= 0 ? inv : h - inv;
}

/** Saldo líquido do dia e as horas contra o saldo em cada fronteira, com a ligação para a página Rede escrita pelo componente. */
export function textoSaldoLiquidoRede(a: { dia: string; fronteiras: readonly { rotulo: string; horasContra: number | null; horas: number }[]; diaModulo: string | null }): string {
  const listadas = a.fronteiras.filter((f) => f.horasContra !== null).map((f) => `${f.rotulo}, ${num(f.horasContra as number, 0)} de ${num(f.horas, 0)}`);
  const horas = listadas.length ? ` Horas do dia em que o fluxo foi contra o sentido do saldo: ${listadas.join("; ")}.` : "";
  const modulo = a.diaModulo && a.diaModulo !== a.dia ? ` A página Rede traz também ${dataBR(a.diaModulo)}.` : "";
  return `Saldo líquido do dia ${dataBR(a.dia)}: a média das 24 horas do fluxo verificado em cada fronteira, positiva da primeira para a segunda ponta; as horas em sentido contrário ficam compensadas no saldo.${horas}${modulo}`;
}

/* ---------------------------------------------------------------- r10: determinantes com poucas props para o cliente */

/** Um painel dos determinantes com só o que o cartão mostra: textos prontos no servidor e nenhuma evidência no HTML. */
export type PainelLeve = {
  id: IdPainelMultiplo;
  titulo: string;
  pergunta: string;
  unidade: string;
  casas: number;
  colunas: { id: string; rotulo: string }[];
  referencia: ReferenciaLeve;
  dataReferencia: string;
  /** Valor do dia de referência lido da mesma célula do gráfico e da tabela, escrito com uma só passagem de arredondamento. */
  valorTexto: string;
  rotuloValor: string | null;
  leitura: string;
  defasagem: string;
  nota: string;
  href: string;
  /** Ficha "Comprove este número" lida sob demanda da gold (caminho dentro de sintese.json). */
  comprove: { caminho: string; indicador: string; valorExibido: string } | null;
  /** Por que a ficha não existe nesta execução, quando não existe. */
  semEvidencia: string | null;
};

/** A referência do painel sem o caminho na gold e sem o campo `valor` do zero. */
function referenciaLeve(r: ReferenciaPainel): ReferenciaLeve {
  if (r.tipo === "faixa_constante") return { tipo: r.tipo, rotulo: r.rotulo, inferior: r.inferior, superior: r.superior };
  if (r.tipo === "faixa_por_data") return { tipo: r.tipo, rotulo: r.rotulo, inferior: r.inferior, superior: r.superior };
  if (r.tipo === "serie") return { tipo: r.tipo, rotulo: r.rotulo, coluna: r.coluna };
  return { tipo: "zero", rotulo: r.rotulo };
}

/** Determinantes como o cliente os recebe: linhas em colunas (sem repetir o nome de cada campo 90 vezes) e painéis leves. */
export type DeterminantesLeves = {
  janela: MultiplosVisao["janela"];
  avisoDatas: string;
  regra: string;
  campos: string[];
  linhas: (string | number | null)[][];
  colunasTabela: ColunaTabela[];
  /** Séries a mais desenhadas em alguns painéis (a mediana da data na água), com a coluna que as alimenta. */
  extras: Partial<Record<IdPainelMultiplo, SerieExtra[]>>;
  paineis: PainelLeve[];
};

/**
 * Os determinantes da página: as linhas com a EAR da série publicada e a mediana da data, e a leitura de cada painel feita sobre essas
 * mesmas linhas. O valor do cartão, o gráfico, a tabela, o anúncio por teclado e o arquivo exportado leem a mesma célula e a arredondam uma vez.
 */
export function determinantesDaPagina(
  m: MultiplosVisao,
  ear: ReadonlyMap<string, number>,
  bandas: readonly { md: string; SIN_p50?: number | null }[],
  periodoMediana: string | null,
): { m: MultiplosVisao; leves: DeterminantesLeves } {
  const dados = comMedianaAgua(comEarPrecisa(m.dados, ear), bandas).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const temMediana = dados.some((l) => typeof l.agua_p50 === "number");
  const paineis = m.paineis.map((p) => {
    const v = valorDoDiaNaSerie(p, dados);
    const base = v === p.valor_atual.valor ? p : { ...p, valor_atual: { ...p.valor_atual, valor: v } };
    return base;
  });
  const exato: MultiplosVisao = { ...m, dados, paineis };
  const campos = Array.from(new Set(dados.flatMap((l) => Object.keys(l))));
  campos.sort((a, b) => (a === "d" ? -1 : b === "d" ? 1 : 0));
  const colunasTabela = colunasMultiplos(exato);
  const extras: Partial<Record<IdPainelMultiplo, SerieExtra[]>> = temMediana ? { agua: [{ id: "agua_p50", rotulo: `Mediana da data${periodoMediana ? ` (${periodoMediana})` : ""}` }] } : {};
  if (temMediana) {
    const i = colunasTabela.findIndex((c) => c.id === "agua_p10");
    const agua = paineis.find((p) => p.id === "agua");
    const col: ColunaTabela = { id: "agua_p50", rotulo: `Água: mediana da data${periodoMediana ? ` (${periodoMediana})` : ""}`, tipo: "numero", unidade: agua?.unidade, casas: agua?.casas ?? 1 };
    colunasTabela.splice(i >= 0 ? i : colunasTabela.length, 0, col);
  }
  const leves: PainelLeve[] = paineis.map((p, k) => ({
    id: p.id,
    titulo: p.titulo,
    pergunta: p.pergunta,
    unidade: p.unidade,
    casas: p.casas,
    colunas: p.colunas,
    referencia: referenciaLeve(p.referencia),
    dataReferencia: p.data_referencia,
    valorTexto: valorAtualTexto(p),
    rotuloValor: p.valor_atual.rotulo,
    leitura: leituraDeterminante(p, exato),
    defasagem: p.texto_defasagem,
    // sigla no primeiro uso: a nota do pipeline cita a MMGD sem dizer o que é
    nota: expandeSiglas(p.nota, ["MMGD"]),
    href: p.href,
    comprove: p.evidencia
      ? { caminho: `multiplos.paineis[${k}].evidencia`, indicador: p.valor_atual.rotulo ? `${p.titulo} (${p.valor_atual.rotulo})` : p.titulo, valorExibido: p.evidencia.valor_exibido }
      : null,
    semEvidencia: p.evidencia ? null : (p.evidencia_problemas?.join("; ") ?? ""),
  }));
  return {
    m: exato,
    leves: {
      janela: m.janela,
      avisoDatas: m.aviso_datas,
      regra: m.regra,
      campos,
      linhas: dados.map((l) => campos.map((c) => (l[c] as string | number | null | undefined) ?? null)),
      colunasTabela,
      extras,
      paineis: leves,
    },
  };
}

/** Linhas em colunas de volta a objetos (a mesma forma de `LinhaMultiplos`), no cliente. */
export function linhasDeColunas(campos: readonly string[], linhas: readonly (readonly (string | number | null)[])[]): LinhaMultiplos[] {
  return linhas.map((l) => Object.fromEntries(campos.map((c, i) => [c, l[i] ?? null])) as LinhaMultiplos);
}
