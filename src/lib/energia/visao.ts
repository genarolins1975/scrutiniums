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
import { dataBR, mesAno, num, plural } from "./formato";
import type { ColunaTabela, LinhaTabela } from "./tabela";
import type {
  EstadoRegra,
  FraseVisao,
  IdFrase,
  IdPainelMultiplo,
  ItemSociedade,
  LinhaMultiplos,
  MultiplosVisao,
  PainelDeterminante,
  RegraObservar,
  SinteseVisaoGold,
  SociedadeVisao,
} from "./tipos-visao";

export const ROTA_VISAO = "/setor-eletrico/visao-geral";
/** A própria gold, lida no navegador sob demanda (fichas de prova e tabelas de auditoria), nunca nas props. */
export const URL_GOLD_VISAO = "/energia/gold/sintese.json";

/**
 * Datas ISO soltas num texto do pipeline (AAAA-MM-DD ou AAAA-MM) na forma da página
 * (dd/mm/aaaa ou mês/ano); identificadores com "@" ou "_" coladas ficam como estão.
 */
export function datasLegiveis(texto: string): string {
  return texto.replace(/(^|[^\w@_-])(20\d\d)-(\d\d)(?:-(\d\d))?(?![\w@_-])/g, (_, antes: string, a: string, m: string, d?: string) =>
    `${antes}${d ? `${d}/${m}/${a}` : mesAno(`${a}-${m}`)}`,
  );
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

function minuscula(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
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
  return sit ? `Fonte ${sit}${a?.cadencia ? ` pela cadência ${a.cadencia}` : ""}${atraso}.` : "Sem registro de atualidade da fonte.";
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
  const dados = g.observar.filter((o) => o.assunto === "dados" && o.tipo !== "evento" && o.ativo);
  if (dados.length) partes.push(`Em alerta sobre os próprios dados: ${dados.map((o) => minuscula(o.titulo)).join("; ")}.`);
  if (g.frases_ausentes.length) partes.push(`Sem frase nesta publicação: ${g.frases_ausentes.map((id) => minuscula(ROTULO_FRASE[id])).join(", ")}.`);
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
    atualidade: f.qualidade.atualidade?.situacao ?? null,
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
  { id: "caminho", rotulo: "Caminho na gold de origem", tipo: "texto" },
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
const COR_FRONTEIRA = ["var(--serie-comp-1)", "var(--serie-comp-2)", "var(--serie-comp-3)", "var(--serie-comp-4)"];
const SIGLA_SM: Record<string, string> = { SE: "SE/CO", S: "S", NE: "NE", N: "N" };

export type SerieDeterminante = { id: string; rotulo: string; sigla?: string; cor: string; tracejada?: boolean; espessura?: number };

/** Séries do gráfico de um painel: as colunas publicadas e, na carga, a referência do ano anterior tracejada. */
export function seriesDeterminante(p: PainelDeterminante): SerieDeterminante[] {
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
  return s;
}

/** Faixa de referência desenhada como banda (colunas da gold ou colunas constantes). */
export function bandaDeterminante(p: PainelDeterminante): { inferior: string; superior: string; rotulo: string } | undefined {
  if (p.referencia.tipo === "faixa_por_data") return { inferior: p.referencia.inferior, superior: p.referencia.superior, rotulo: p.referencia.rotulo };
  if (p.referencia.tipo === "faixa_constante") return { inferior: `${p.id}_ref_inf`, superior: `${p.id}_ref_sup`, rotulo: p.referencia.rotulo };
  return undefined;
}

/**
 * Linhas do gráfico de um painel: a data, as colunas do painel e as da referência, copiadas
 * do recorte sem alteração; a faixa constante entra como duas colunas com os limites
 * publicados (a mesma faixa em todas as datas, como a gold a define).
 */
export function dadosDeterminante(p: PainelDeterminante, linhas: readonly LinhaMultiplos[]): Record<string, string | number | null>[] {
  const cols = p.colunas.map((c) => c.id);
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
  if (ref.tipo === "faixa_constante" || ref.tipo === "faixa_por_data") {
    if (pos.situacao === "sem_referencia") return `${p.titulo}: ${valor}${quem} ${quando}; sem faixa de referência publicada para a data.`;
    const onde = pos.situacao === "dentro" ? "dentro da" : pos.situacao === "acima" ? "acima da" : "abaixo da";
    return `${p.titulo}: ${valor}${quem} ${quando}, ${onde} faixa de referência (${minuscula(ref.rotulo)}: ${fmt(pos.inferior)} a ${fmt(pos.superior)}).`;
  }
  if (ref.tipo === "serie") {
    if (pos.situacao === "sem_referencia")
      return `${p.titulo}: ${valor}${quem} ${quando}; sem referência comparável (${minuscula(ref.rotulo)}): o dia do ano anterior não tem valor ou está em outro regime metodológico.`;
    const pctTxt = pos.variacao_pct === null ? "" : `${num(Math.abs(pos.variacao_pct), 1)}% `;
    const onde = pos.situacao === "acima" ? "acima" : pos.situacao === "abaixo" ? "abaixo" : "igual";
    return `${p.titulo}: ${valor}${quem} ${quando}, ${onde === "igual" ? "igual à" : `${pctTxt}${onde} da`} referência (${minuscula(ref.rotulo)}: ${fmt(pos.referencia)}).`;
  }
  // rede: o sinal dá o sentido; não há referência de capacidade
  const v = pos.valor ?? 0;
  const [de, para] = (p.valor_atual.rotulo ?? "").split(" → ");
  const sentido = de && para ? (v >= 0 ? `de ${de} para ${para}` : `de ${para} para ${de}`) : "";
  return `${p.titulo}: ${comUnidade(Math.abs(v), p.unidade, p.casas)}${sentido ? ` ${sentido}` : ""} ${quando} (fluxo médio verificado do dia, sem comparação com limites de intercâmbio).`;
}

/** Resposta do P005: uma leitura por painel, na ordem publicada. */
export function respostaDeterminantes(m: MultiplosVisao): string[] {
  return m.paineis.map((p) => leituraDeterminante(p, m));
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
  const u = c.unidade ? ` ${c.unidade}` : "";
  if (c.valor === null) return "sem dado";
  if (Array.isArray(c.valor)) {
    const [a, b] = c.valor;
    const f = (x: number | null) => (x === null ? "sem dado" : num(x, casasDe(x)));
    return `${f(a)} ${/percentil/i.test(c.rotulo) ? "a" : "e"} ${f(b)}${u}`;
  }
  return `${num(c.valor, casasDe(c.valor))}${u}`;
}

/** Resposta do P006: cada indicador com o seu período; nenhum descreve o dia. */
export function respostaSociedade(s: SociedadeVisao): string {
  if (!s.itens.length) return "Nenhum indicador de energia e sociedade disponível nesta publicação.";
  const partes = s.itens.map((it) => {
    const atrasado = it.atualidade?.situacao === "ATRASADO" ? "; conjunto atrasado no painel de saúde dos dados" : "";
    return `${it.titulo}: ${valorSociedade(it)}, ${periodoCurto(it)}${atrasado}.`;
  });
  const aus = s.ausentes.length ? ` Sem dado: ${s.ausentes.map((a) => a.id).join(", ")}.` : "";
  return `Cada número tem o seu período, e nenhum descreve o dia. ${partes.join(" ")}${aus}`;
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
    defasagem: it.defasagem.texto,
    atualidade: it.atualidade?.situacao ?? null,
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

/** Texto do valor avaliado de uma regra com os limiares, na unidade da regra. */
export function textoValorRegra(o: Pick<RegraObservar, "valor" | "unidade">): string | null {
  const v = o.valor;
  if (!v) return null;
  const c = casasUnidade(o.unidade);
  const f = (x: number | null) => comUnidade(x, o.unidade, c);
  const lim =
    v.limiar_inferior !== null && v.limiar_superior !== null
      ? `alerta abaixo de ${f(v.limiar_inferior)} ou acima de ${f(v.limiar_superior)}`
      : v.limiar_superior !== null
        ? `alerta acima de ${f(v.limiar_superior)}`
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
    c["."] ? `${plural(c["."], "dia", "dias")} normais` : null,
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
