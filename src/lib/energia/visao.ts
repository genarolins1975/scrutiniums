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
import { dataBR, mesAno, nomeMes, num, plural } from "./formato";
import { PADRAO_SIGLA, SIGLAS } from "./siglas";
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia, tx } from "./idioma";
import { fronteiraEn, goldEmString, listaEn, traduzModeloDaGold, trechoEn } from "./i18n/entrada-visao";
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
 * "ccee_pld_horario (captura de 30/09/2026 02:20 UTC)" ("captured on Sep 30, 2026, 02:20 UTC" em inglês). Sem "@" e data,
 * devolve o texto como veio.
 */
export function snapshotLegivel(id: string, idioma: Idioma = idiomaEnergia()): string {
  return id.replace(/@(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z?/g, (_, a: string, m: string, d: string, h: string, mi: string) =>
    tx(` (captura de ${d}/${m}/${a} ${h}:${mi} UTC)`, ` (captured on ${dataBR(`${a}-${m}-${d}`, "en")}, ${h}:${mi} UTC)`, idioma),
  );
}

/** Texto da gold dentro de uma frase da página: a forma inglesa na página inglesa (tabela ou modelo), o texto como veio na portuguesa. */
function gold(texto: string, idioma: Idioma): string {
  return goldEmString(texto, idioma);
}

/** Lista "a, b e c" no idioma ("a, b and c"). */
export function listaNoIdioma(xs: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? listaEn(xs) : listaEmPortugues(xs);
}

/** Natureza do dado (OBSERVADO, CALCULADO, ESTIMADO, PREVISTO, CENARIO) em palavra inglesa, como o glossário a escreve. */
const NATUREZA_EN: Readonly<Record<string, string>> = { OBSERVADO: "observed", CALCULADO: "calculated", ESTIMADO: "estimated", PREVISTO: "forecast", CENARIO: "scenario" };

/* ---------------------------------------------------------------- painéis */

export type IdPainelVisao = "sistema" | "determinantes" | "sociedade" | "observar";

/** Perguntas do Anexo A da especificação (P004 a P007), na ordem da página, no idioma pedido. */
export function paineisVisao(idioma: Idioma = idiomaEnergia()): readonly { id: IdPainelVisao; codigo: string; rotulo: string; pergunta: string }[] {
  return [
    { id: "sistema", codigo: "P004", rotulo: tx("O sistema em 60 segundos", "The system in 60 seconds", idioma), pergunta: tx("O que mudou e merece atenção?", "What changed and deserves attention?", idioma) },
    {
      id: "determinantes",
      codigo: "P005",
      rotulo: tx("Preço, água, geração, carga e rede", "Price, water, generation, load and grid", idioma),
      pergunta: tx("Como estão os principais determinantes?", "How are the main determinants doing?", idioma),
    },
    { id: "sociedade", codigo: "P006", rotulo: tx("Energia e sociedade", "Energy and society", idioma), pergunta: tx("Como custo e qualidade chegam ao consumidor?", "How do cost and quality reach the consumer?", idioma) },
    { id: "observar", codigo: "P007", rotulo: tx("O que observar", "What to watch", idioma), pergunta: tx("Quais alterações são relevantes?", "Which changes are relevant?", idioma) },
  ];
}

/** As perguntas em português (a forma de referência dos testes e dos códigos P004 a P007). */
export const PAINEIS_VISAO = paineisVisao("pt");

export function painelVisao(id: IdPainelVisao, idioma: Idioma = idiomaEnergia()) {
  return paineisVisao(idioma).find((p) => p.id === id)!;
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

/** Número com a unidade, na forma da página: R$ antes, percentual colado, demais com espaço. A unidade da gold sai no idioma da página. */
export function comUnidade(v: number | null | undefined, unidade: string, casas: number, idioma: Idioma = idiomaEnergia()): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return tx("sem dado", "no data", idioma);
  if (unidade === "R$/MWh") return `R$ ${num(v, casas, idioma)}/MWh`; // i18n: dado
  const u = gold(unidade, idioma);
  if (unidade.startsWith("%")) return `${num(v, casas, idioma)}${u}`;
  return `${num(v, casas, idioma)} ${u}`;
}

/* ---------------------------------------------------------------- P004: o sistema em 60 segundos */

function rotulosFrase(idioma: Idioma): Record<IdFrase, string> {
  return tx(
    { reservatorios: "Reservatórios", afluencias: "Afluências", carga: "Carga", termica: "Térmicas", pld: "PLD", rede: "Rede" },
    { reservatorios: "Reservoirs", afluencias: "Inflows", carga: "Load", termica: "Thermal plants", pld: "PLD", rede: "Grid" },
    idioma,
  );
}

/** Rótulo de cada frase em português (a forma de referência); `rotuloFrase` dá o rótulo no idioma da página. */
export const ROTULO_FRASE: Record<IdFrase, string> = rotulosFrase("pt");

export function rotuloFrase(id: IdFrase, idioma: Idioma = idiomaEnergia()): string {
  return rotulosFrase(idioma)[id];
}

function rotulosAtualidade(idioma: Idioma): Record<string, string> {
  return tx(
    { "EM DIA": "em dia", ATRASADO: "atrasada", "SEM SLA": "sem prazo declarado pela fonte", "SEM DADO": "sem registro de atualidade" },
    { "EM DIA": "up to date", ATRASADO: "late", "SEM SLA": "with no deadline declared by the source", "SEM DADO": "with no timeliness record" },
    idioma,
  );
}

export const ROTULO_ATUALIDADE: Record<string, string> = rotulosAtualidade("pt");

/** Cadência como a gold a grava (sem acento) e como a página a escreve. */
function rotulosCadencia(idioma: Idioma): Record<string, string> {
  return tx(
    { diaria: "diária", semanal: "semanal", quinzenal: "quinzenal", mensal: "mensal", trimestral: "trimestral", anual: "anual" },
    { diaria: "daily", semanal: "weekly", quinzenal: "fortnightly", mensal: "monthly", trimestral: "quarterly", anual: "annual" },
    idioma,
  );
}

export const ROTULO_CADENCIA: Record<string, string> = rotulosCadencia("pt");

/** Menor e maior data de referência entre as frases (cada frase tem a sua). */
export function referenciasFrases(frases: readonly FraseVisao[]): { min: string; max: string } | null {
  if (!frases.length) return null;
  const refs = frases.map((f) => f.ref).sort();
  return { min: refs[0], max: refs[refs.length - 1] };
}

/** Texto curto de atualidade e defasagem de uma frase, a partir da qualidade publicada. */
export function textoAtualidadeFrase(f: FraseVisao, idioma: Idioma = idiomaEnergia()): string {
  const a = f.qualidade.atualidade;
  const sit = a?.situacao ? (rotulosAtualidade(idioma)[a.situacao] ?? a.situacao.toLowerCase()) : null;
  const cad = a?.cadencia ? (rotulosCadencia(idioma)[a.cadencia] ?? a.cadencia) : null;
  const atraso = a?.dias_atraso
    ? tx(`, ${plural(a.dias_atraso, "dia", "dias", "pt")} além do prazo`, `, ${plural(a.dias_atraso, "day", "days", "en")} past the deadline`, idioma)
    : "";
  if (!sit) return tx("Sem registro de atualidade da fonte.", "No timeliness record for the source.", idioma);
  return tx(`Fonte ${sit}${cad ? ` pela cadência ${cad}` : ""}${atraso}.`, `Source ${sit}${cad ? ` by its ${cad} update frequency` : ""}${atraso}.`, idioma);
}

/** Componentes que não são medição, como a gold de origem declara (PREVISTO, ESTIMADO). */
export function textoComponentesFrase(f: FraseVisao, idioma: Idioma = idiomaEnergia()): string | null {
  const cs = f.qualidade.componentes_natureza;
  if (!cs.length) return null;
  return cs
    .map((c) =>
      tx(
        `${String(c.natureza).toLowerCase()} desde ${dataBR(c.desde, "pt")}: ${minuscula(c.descricao)}`,
        `${NATUREZA_EN[String(c.natureza)] ?? String(c.natureza).toLowerCase()} since ${dataBR(c.desde, "en")}: ${minuscula(gold(c.descricao, "en"))}`,
        idioma,
      ),
    )
    .join("; ");
}

/**
 * Resposta do P004: quantos fatos, de que datas, o que a caixa de destaques diz e quais
 * regras sobre os próprios dados estão em alerta. Tudo lido da gold; nenhuma frase fixa com número.
 */
export function respostaSistema(g: Pick<SinteseVisaoGold, "frases" | "frases_ausentes" | "destaques" | "observar">, idioma: Idioma = idiomaEnergia()): string {
  const partes: string[] = [];
  const refs = referenciasFrases(g.frases);
  const titulo = (t: string) => minuscula(gold(t, idioma));
  if (refs) {
    const n = g.frases.length;
    partes.push(
      tx(
        refs.min === refs.max
          ? `${n === 1 ? "Um fato" : `${num(n, 0, "pt")} fatos`} do sistema, com referência em ${dataBR(refs.min, "pt")}.`
          : `${n === 1 ? "Um fato" : `${num(n, 0, "pt")} fatos`} do sistema, cada um com a sua data de referência, de ${dataBR(refs.min, "pt")} a ${dataBR(refs.max, "pt")}.`,
        refs.min === refs.max
          ? `${n === 1 ? "One fact" : `${num(n, 0, "en")} facts`} about the system, with reference date ${dataBR(refs.min, "en")}.`
          : `${n === 1 ? "One fact" : `${num(n, 0, "en")} facts`} about the system, each with its own reference date, from ${dataBR(refs.min, "en")} to ${dataBR(refs.max, "en")}.`,
        idioma,
      ),
    );
  } else {
    partes.push(tx("Nenhum fato do sistema pôde ser escrito nesta publicação: faltam os dados de origem.", "No fact about the system could be written in this publication: the source data is missing.", idioma));
  }
  if (g.destaques.itens.length) {
    const t = g.destaques.itens.map((d) => titulo(d.titulo));
    const n = g.destaques.itens.length;
    partes.push(
      tx(
        `${n === 1 ? "Um destaque" : `${num(n, 0, "pt")} destaques`} de regra sobre o sistema: ${t.join("; ")}.`,
        `${n === 1 ? "One rule highlight" : `${num(n, 0, "en")} rule highlights`} about the system: ${t.join("; ")}.`,
        idioma,
      ),
    );
  } else if (g.destaques.vazio) {
    partes.push(gold(g.destaques.vazio, idioma));
  }
  const observacao = regrasEmObservacao(g.observar);
  if (observacao.length)
    partes.push(
      tx(
        `Em observação, com a condição presente e ainda sem a duração mínima para virar alerta: ${observacao.map((o) => titulo(o.titulo)).join("; ")}.`,
        `Under observation, with the condition present and still without the minimum duration to become an alert: ${observacao.map((o) => titulo(o.titulo)).join("; ")}.`,
        idioma,
      ),
    );
  const dados = g.observar.filter((o) => o.assunto === "dados" && o.tipo !== "evento" && o.ativo);
  if (dados.length)
    partes.push(tx(`Em alerta sobre os próprios dados: ${dados.map((o) => titulo(o.titulo)).join("; ")}.`, `In alert about the data itself: ${dados.map((o) => titulo(o.titulo)).join("; ")}.`, idioma));
  if (g.frases_ausentes.length) {
    const ids = g.frases_ausentes.map((id) => minuscula(rotuloFrase(id, idioma))).join(", ");
    partes.push(tx(`Sem frase nesta publicação: ${ids}.`, `No sentence in this publication: ${ids}.`, idioma));
  }
  return partes.join(" ");
}

/**
 * As regras sobre os próprios dados, em palavras comuns. O título da gold ("Revisão material de dado já publicado") e a
 * condição técnica ficam na lista do P007 e em Analisar; o veredito diz só o que o leitor precisa saber.
 */
function dadosEmPalavras(idioma: Idioma): Partial<Record<IdRegra, string>> {
  return tx<Partial<Record<IdRegra, string>>>(
    { revisao_material: "um dado publicado foi revisado", atualidade_fontes: "uma fonte desta página está atrasada", pld_defasagem: "a série do PLD está sem atualização recente" },
    { revisao_material: "a published figure was revised", atualidade_fontes: "a source of this page is late", pld_defasagem: "the PLD series has no recent update" },
    idioma,
  );
}

/** Nomes de regras no veredito: até duas por extenso; mais que isso, só a contagem, para a frase não virar lista. */
function nomesNoVeredito(regras: readonly RegraObservar[], palavras: boolean, idioma: Idioma): string | null {
  if (regras.length === 0 || regras.length > 2) return null;
  const titulo = (o: RegraObservar) => minuscula(gold(o.titulo, idioma));
  return listaNoIdioma(regras.map((o) => (palavras ? (dadosEmPalavras(idioma)[o.id] ?? titulo(o)) : titulo(o))), idioma);
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
export function vereditoSistema(g: Pick<SinteseVisaoGold, "frases" | "observar">, idioma: Idioma = idiomaEnergia()): string {
  // o veredito cabe em LIMITE_PALAVRAS_VEREDITO: com muitas regras ativas, os nomes saem primeiro dos dados, depois das regras em
  // observação e por fim das regras em alerta (a contagem fica, e os nomes continuam na resposta completa e na lista abaixo)
  const niveis: [boolean, boolean, boolean][] = [[true, true, true], [true, true, false], [true, false, false], [false, false, false]];
  let v = "";
  for (const [sis, obs, dad] of niveis) {
    v = textoVereditoSistema(g, idioma, sis, obs, dad);
    if (contaPalavras(v) <= LIMITE_PALAVRAS_VEREDITO) break;
  }
  return v;
}

/** Limite de palavras do veredito à vista (o roteiro da Visão geral). */
export const LIMITE_PALAVRAS_VEREDITO = 40;

const contaPalavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

function textoVereditoSistema(g: Pick<SinteseVisaoGold, "frases" | "observar">, idioma: Idioma, comNomesSistema: boolean, comNomesObs: boolean, comNomesDados: boolean): string {
  const regras = g.observar.filter((o) => o.tipo !== "evento");
  const sistema = regras.filter((o) => o.assunto === "sistema" && o.ativo);
  const observacao = regrasEmObservacao(regras);
  const dados = regras.filter((o) => o.assunto === "dados" && o.ativo);
  const partes: string[] = [];
  const nomesObs = observacao.length && comNomesObs ? nomesNoVeredito(observacao, false, idioma) : null;
  const sufixoObs = nomesObs ? `: ${nomesObs}` : "";
  const n = (x: number) => num(x, 0, idioma);
  if (sistema.length) {
    const nomes = comNomesSistema ? nomesNoVeredito(sistema, false, idioma) : null;
    partes.push(
      tx(
        `${sistema.length === 1 ? "Uma regra sobre o sistema está" : `${n(sistema.length)} regras sobre o sistema estão`} em alerta${nomes ? `: ${nomes}` : ""}.`,
        `${sistema.length === 1 ? "One rule about the system is" : `${n(sistema.length)} rules about the system are`} in alert${nomes ? `: ${nomes}` : ""}.`,
        idioma,
      ),
    );
    if (observacao.length)
      partes.push(
        tx(
          `${observacao.length === 1 ? "Uma regra está" : `${n(observacao.length)} regras estão`} em observação${sufixoObs}.`,
          `${observacao.length === 1 ? "One rule is" : `${n(observacao.length)} rules are`} under observation${sufixoObs}.`,
          idioma,
        ),
      );
  } else {
    const obs = observacao.length
      ? tx(
          `; ${observacao.length === 1 ? "uma está" : `${n(observacao.length)} estão`} em observação${sufixoObs}`,
          `; ${observacao.length === 1 ? "one is" : `${n(observacao.length)} are`} under observation${sufixoObs}`,
          idioma,
        )
      : "";
    partes.push(tx(`Nenhuma regra sobre o sistema está em alerta${obs}.`, `No rule about the system is in alert${obs}.`, idioma));
  }
  if (dados.length) {
    const nomes = comNomesDados ? nomesNoVeredito(dados, true, idioma) : null;
    partes.push(
      tx(
        `Sobre os próprios dados, ${dados.length === 1 ? "1 regra está" : `${n(dados.length)} regras estão`} em alerta${nomes ? `: ${nomes}` : ""}.`,
        `About the data itself, ${dados.length === 1 ? "1 rule is" : `${n(dados.length)} rules are`} in alert${nomes ? `: ${nomes}` : ""}.`,
        idioma,
      ),
    );
  }
  return partes.join(" ");
}

export function colunasFrases(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "indicador", rotulo: tx("Indicador", "Indicator", idioma), tipo: "texto" },
    { id: "texto", rotulo: tx("Frase publicada", "Published sentence", idioma), tipo: "texto" },
    { id: "referencia", rotulo: tx("Referência", "Reference", idioma), tipo: "data" },
    { id: "defasagem", rotulo: tx("Defasagem até o processamento", "Lag until processing", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
    { id: "atualidade", rotulo: tx("Atualidade da fonte", "Source timeliness", idioma), tipo: "texto", categorica: true },
    { id: "natureza", rotulo: tx("Natureza", "Nature", idioma), tipo: "texto", categorica: true },
    { id: "componentes", rotulo: tx("Componentes que não são medição", "Components that are not measurements", idioma), tipo: "texto" },
    { id: "revisadas", rotulo: tx("Referências revisadas na janela", "References revised in the window", idioma), tipo: "numero", casas: 0 },
    { id: "gold", rotulo: tx("Gold de origem", "Source gold", idioma), tipo: "texto", categorica: true },
  ];
}

export const COLUNAS_FRASES: ColunaTabela[] = colunasFrases("pt");

/** Tabela equivalente da síntese: uma linha por frase exibida, na ordem da lista. */
export function linhasFrases(frases: readonly FraseVisao[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return frases.map((f) => ({
    id: f.id,
    indicador: rotuloFrase(f.id, idioma),
    texto: idioma === "en" ? (textoFraseEn(f) ?? f.texto) : f.texto,
    referencia: f.ref,
    defasagem: f.qualidade.defasagem_dias,
    atualidade: f.qualidade.atualidade?.situacao ? enumLegivel(f.qualidade.atualidade.situacao, idioma) : null,
    natureza: idioma === "en" ? (NATUREZA_EN[f.natureza] ?? f.natureza) : f.natureza,
    componentes:
      f.qualidade.componentes_natureza
        .map((c) => tx(`${c.natureza} desde ${dataBR(c.desde, "pt")}`, `${NATUREZA_EN[String(c.natureza)] ?? c.natureza} since ${dataBR(c.desde, "en")}`, idioma))
        .join("; ") || null,
    revisadas: f.qualidade.revisoes.referencias_revisadas_na_janela,
    gold: f.versoes.gold,
  }));
}

export function colunasValoresFrases(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "frase", rotulo: tx("Frase", "Sentence", idioma), tipo: "texto", categorica: true },
    { id: "chave", rotulo: tx("Valor", "Value", idioma), tipo: "texto" },
    { id: "numero", rotulo: tx("Número", "Number", idioma), tipo: "numero", casas: 4 },
    { id: "texto", rotulo: tx("Texto ou data", "Text or date", idioma), tipo: "texto" },
    { id: "unidade", rotulo: tx("Unidade", "Unit", idioma), tipo: "texto" },
    { id: "caminho", rotulo: tx("Caminho na base publicada de origem", "Path in the published source base", idioma), tipo: "texto" },
  ];
}

export const COLUNAS_VALORES_FRASES: ColunaTabela[] = colunasValoresFrases("pt");

/** Cada valor usado numa frase, com o caminho na gold de origem (reprodução da frase). */
export function linhasValoresFrases(frases: readonly FraseVisao[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return frases.flatMap((f) =>
    Object.entries(f.valores).map(([k, v]) => ({
      id: `${f.id}:${k}`,
      frase: rotuloFrase(f.id, idioma),
      chave: k,
      numero: typeof v.valor === "number" ? v.valor : null,
      texto: typeof v.valor === "string" ? v.valor : null,
      unidade: v.unidade ? gold(v.unidade, idioma) : null,
      caminho: v.caminho,
    })),
  );
}

export function colunasVersoes(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "frase", rotulo: tx("Frase", "Sentence", idioma), tipo: "texto" },
    { id: "gold", rotulo: tx("Gold", "Gold", idioma), tipo: "texto" },
    { id: "gerado_em", rotulo: tx("Gerada em (UTC)", "Generated on (UTC)", idioma), tipo: "texto" },
    { id: "versao_codigo", rotulo: tx("Versão do código", "Code version", idioma), tipo: "texto" },
    { id: "dataset", rotulo: tx("Conjunto", "Dataset", idioma), tipo: "texto" },
    { id: "snapshot", rotulo: tx("Snapshot", "Snapshot", idioma), tipo: "texto" },
    { id: "sha256", rotulo: tx("sha256 do snapshot", "Snapshot sha256", idioma), tipo: "texto" },
  ];
}

export const COLUNAS_VERSOES: ColunaTabela[] = colunasVersoes("pt");

export function linhasVersoes(frases: readonly FraseVisao[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return frases.map((f) => ({
    id: f.id,
    frase: rotuloFrase(f.id, idioma),

    gold: f.versoes.gold,
    gerado_em: f.versoes.gerado_em,
    versao_codigo: f.versoes.versao_codigo,
    dataset: f.versoes.dataset,
    snapshot: f.versoes.snapshot_id,
    sha256: f.versoes.snapshot_sha256,
  }));
}

/* ---------------------------------------------------------------- as frases do P004 em inglês */

/** Um trecho de frase como a gold o publica: o texto e, quando o trecho é um número, o painel que o publica e o caminho dele. */
export type TrechoFrase = FraseVisao["trechos"][number];

const NUM = String.raw`[\d.,]+`;
const DIA = String.raw`\d{2}\/\d{2}\/\d{4}`;
const LADO: Readonly<Record<string, string>> = { acima: "above", abaixo: "below" };
const FAIXA_PLD: Readonly<Record<string, string>> = { central: "central", baixa: "low", alta: "high" };
const dataPt = (d: string) => dataBR(`${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`, "en");
const numPt = (x: string) => x.replace(/\./g, "\u0000").replace(/,/g, ".").replace(/\u0000/g, ",");

/**
 * Modelo inglês de cada frase do P004: um padrão por trecho da frase publicada (o mesmo número de trechos e os mesmos links), que
 * reconhece o texto português do modelo fixo do pipeline e o reescreve em inglês com os mesmos números, unidades e datas. Trecho que
 * não segue o modelo anula a frase inteira (a página mostra então a frase portuguesa marcada), para nunca misturar os dois idiomas.
 */
const MODELOS_FRASE_EN: Readonly<Record<IdFrase, readonly [RegExp, (m: RegExpExecArray) => string][]>> = {
  reservatorios: [
    [/^Os reservatórios do SIN guardam $/, () => "The SIN reservoirs hold "],
    [new RegExp(`^(${NUM}%) da energia armazenável máxima$`), (m) => `${numPt(m[1])} of maximum storable energy`],
    [/^, $/, () => ", "],
    [new RegExp(`^(${NUM}) p\\.p\\. (acima|abaixo) da mediana histórica para (${DIA})$`), (m) => `${numPt(m[1])} p.p. ${LADO[m[2]]} the historical median for ${dataPt(m[3])}`],
    [/^\.$/, () => "."],
  ],
  afluencias: [
    [
      new RegExp(`^Nos 30 dias até (${DIA}), a energia natural afluente \\(vazões naturais aos reservatórios, em energia\\) equivaleu a $`),
      (m) => `In the 30 days through ${dataPt(m[1])}, natural inflow energy (natural flows into the reservoirs, expressed as energy) was equivalent to `,
    ],
    [new RegExp(`^(${NUM}%) da média de longo termo$`), (m) => `${numPt(m[1])} of the long-term average (MLT)`],
    [/^\.$/, () => "."],
  ],
  carga: [
    [new RegExp(`^A carga do SIN nos 7 dias até (${DIA}) ficou $`), (m) => `SIN load in the 7 days through ${dataPt(m[1])} was `],
    [new RegExp(`^(${NUM}%) (acima|abaixo) dos mesmos dias de (\\d{4})$`), (m) => `${numPt(m[1])} ${LADO[m[2]]} the same days of ${m[3]}`],
    [/^\.$/, () => "."],
  ],
  termica: [
    [/^As térmicas responderam por $/, () => "Thermal plants accounted for "],
    [new RegExp(`^(${NUM}%) da geração do balanço do ONS nos 7 dias até (${DIA})$`), (m) => `${numPt(m[1])} of the generation in the ONS balance in the 7 days through ${dataPt(m[2])}`],
    [
      /^ \(a solar desse total inclui a micro e minigeração distribuída estimada pelo ONS\); nos 12 meses anteriores, a mediana dessa participação foi $/,
      // i18n: dado (texto inglês do modelo)
      () => " (the solar portion of that total includes the distributed micro and mini generation estimated by ONS); in the previous 12 months, the median of that share was ",
    ],
    [new RegExp(`^(${NUM}%)$`), (m) => numPt(m[1])],
    [/^\.$/, () => "."],
  ],
  pld: [
    [new RegExp(`^Em (${DIA}), o PLD médio do (.+?) foi $`), (m) => `On ${dataPt(m[1])}, the average PLD in the ${fronteiraEn(m[2])} was `],
    [new RegExp(`^R\\$ (${NUM})\\/MWh$`), (m) => `R$ ${numPt(m[1])}/MWh`],
    [/^, $/, () => ", "],
    [
      new RegExp(`^na faixa (central|baixa|alta) da distribuição desde (\\d{4}) \\(percentil (${NUM})\\)$`),
      (m) => `in the ${FAIXA_PLD[m[1]]} range of the distribution since ${m[2]} (percentile ${numPt(m[3])})`,
    ],
    [/^, com diferença de $/, () => ", with a difference of "],
    [new RegExp(`^R\\$ (${NUM})\\/MWh entre o maior e o menor submercado$`), (m) => `R$ ${numPt(m[1])}/MWh between the highest and the lowest submarket`],
    [/^\.$/, () => "."],
  ],
  rede: [
    [new RegExp(`^Nos 30 dias até (${DIA}), o maior fluxo médio entre subsistemas foi $`), (m) => `In the 30 days through ${dataPt(m[1])}, the largest average flow between subsystems was `],
    [new RegExp(`^(.+?), com (${NUM}) MWmed$`), (m) => `${fronteiraEn(m[1])}, with ${numPt(m[2])} MWavg`],
    [/^\.$/, () => "."],
  ],
};

/** Os trechos da frase em inglês, com os mesmos links e caminhos da gold; null quando a frase publicada não segue o modelo conhecido. */
export function trechosFraseEn(f: Pick<FraseVisao, "id" | "trechos">): TrechoFrase[] | null {
  const modelo = MODELOS_FRASE_EN[f.id];
  if (!modelo || modelo.length !== f.trechos.length) return null;
  const saida: TrechoFrase[] = [];
  for (let i = 0; i < modelo.length; i++) {
    const [re, en] = modelo[i];
    const t = f.trechos[i];
    const m = re.exec(t.texto);
    if (!m) return null;
    saida.push({ ...t, texto: en(m) });
  }
  return saida;
}

/** A frase inteira em inglês, ou null quando ela não segue o modelo. */
export function textoFraseEn(f: Pick<FraseVisao, "id" | "trechos">): string | null {
  const t = trechosFraseEn(f);
  return t ? t.map((x) => x.texto).join("") : null;
}

/**
 * As revisões entre capturas de uma frase em inglês, escritas a partir dos campos que a gold publica (contagem, pares, maior variação),
 * com os mesmos números; null quando os campos não bastam (a página mostra então o texto português marcado).
 */
export function textoRevisoesFraseEn(r: FraseVisao["qualidade"]["revisoes"]): string | null {
  const n = r.referencias_revisadas_na_janela;
  if (typeof n !== "number" || typeof r.total_no_conjunto !== "number") return null;
  if (n === 0)
    // i18n: dado (texto inglês do modelo)
    return `No reference of the series used in this sentence was revised between the integrated captures; the dataset has ${num(r.total_no_conjunto, 0, "en")} revised ${r.total_no_conjunto === 1 ? "observation" : "observations"} in total, across all series.`;

  const m = r.maior;
  if (!m || m.relativa_pct === null || typeof r.pares_serie_referencia !== "number") return null;
  const horaria = m.ref.length > 10;
  const quando = horaria ? `${dataBR(m.ref, "en")} at ${m.ref.slice(11, 16)}` : dataBR(m.ref, "en");
  return `${num(n, 0, "en")} ${horaria ? "hourly" : "daily"} ${n === 1 ? "reference" : "references"} of the series used in this sentence ${n === 1 ? "was" : "were"} revised by the source between captures (${num(r.pares_serie_referencia, 0, "en")} series and reference pairs); largest change of ${num(m.relativa_pct, 2, "en")}% over the previous value, in ${m.serie} on ${quando}; the value displayed is that of the most recent capture.`;
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
  carga_SIN: "var(--cor-energia)", // i18n: dado
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
      // quando os preços dos submercados coincidem, uma linha cobre a outra: a última (Norte) é tracejada para a principal continuar visível; na rede, as fronteiras alternam o traço
      ...((c.id === "preco_N" || (p.id === "rede" && i % 2 === 1)) && { tracejada: true }),
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
export function valorAtualTexto(p: PainelDeterminante, idioma: Idioma = idiomaEnergia()): string {
  return comUnidade(p.valor_atual.valor, p.unidade, p.casas, idioma);
}

/**
 * Os determinantes com os textos da gold no idioma da página (títulos, perguntas, colunas, referências, notas, unidades e o aviso
 * de datas), pela tabela de tradução: o que a tabela não reconhece fica como veio. Números, datas e ids não mudam, e as comparações
 * entre rótulos (a coluna do valor do painel) continuam valendo, porque os dois lados passam pela mesma tradução.
 */
export function multiplosNoIdioma(m: MultiplosVisao, idioma: Idioma = idiomaEnergia()): MultiplosVisao {
  if (idioma !== "en") return m;
  const t = (x: string) => traduzModeloDaGold(x) ?? x;
  return {
    ...m,
    aviso_datas: t(m.aviso_datas),
    regra: t(m.regra),
    paineis: m.paineis.map((p) => ({
      ...p,
      titulo: t(p.titulo),
      pergunta: t(p.pergunta),
      unidade: t(p.unidade),
      nota: t(p.nota),
      texto_defasagem: t(p.texto_defasagem),
      colunas: p.colunas.map((c) => ({ ...c, rotulo: t(c.rotulo) })),
      referencia: { ...p.referencia, rotulo: t(p.referencia.rotulo) },
      valor_atual: { ...p.valor_atual, rotulo: p.valor_atual.rotulo ? t(p.valor_atual.rotulo) : p.valor_atual.rotulo },
    })),
  };
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

/**
 * Leitura de um determinante em uma frase: valor, data, posição frente à referência e o que ele não diz. Os rótulos vêm do painel como
 * ele chega (na página inglesa, os determinantes passam antes por multiplosNoIdioma).
 */
export function leituraDeterminante(p: PainelDeterminante, m: MultiplosVisao, idioma: Idioma = idiomaEnergia()): string {
  const pos = posicaoDeterminante(p, m);
  const quem = p.valor_atual.rotulo ? ` (${p.valor_atual.rotulo})` : "";
  const data = dataBR(p.data_referencia, idioma);
  const quando = p.id === "geracao" ? tx(`nos 7 dias até ${data}`, `in the 7 days through ${data}`, idioma) : tx(`em ${data}`, `on ${data}`, idioma);
  if (pos.situacao === "sem_dado") return tx(`${p.titulo}: sem dado na data de referência (${data}).`, `${p.titulo}: no data on the reference date (${data}).`, idioma);
  const valor = valorAtualTexto(p, idioma);
  const fmt = (x: number | null) => comUnidade(x, p.unidade, p.casas, idioma);
  const ref = p.referencia;
  // o rótulo da referência já traz parênteses (anos da base, regime metodológico): dentro da leitura eles viram vírgulas
  const rotulo = minuscula(ref.rotulo).replace(/\s*\(([^()]*)\)/g, ", $1");
  if (ref.tipo === "faixa_constante" || ref.tipo === "faixa_por_data") {
    if (pos.situacao === "sem_referencia")
      return tx(`${p.titulo}: ${valor}${quem} ${quando}; sem faixa de referência publicada para a data.`, `${p.titulo}: ${valor}${quem} ${quando}; no reference range published for the date.`, idioma);
    const onde = tx(pos.situacao === "dentro" ? "dentro da" : pos.situacao === "acima" ? "acima da" : "abaixo da", pos.situacao === "dentro" ? "within the" : pos.situacao === "acima" ? "above the" : "below the", idioma);
    return tx(
      `${p.titulo}: ${valor}${quem} ${quando}, ${onde} faixa de referência (${rotulo}: ${fmt(pos.inferior)} a ${fmt(pos.superior)}).`,
      `${p.titulo}: ${valor}${quem} ${quando}, ${onde} reference range (${rotulo}: ${fmt(pos.inferior)} to ${fmt(pos.superior)}).`,
      idioma,
    );
  }
  if (ref.tipo === "serie") {
    if (pos.situacao === "sem_referencia")
      return tx(
        `${p.titulo}: ${valor}${quem} ${quando}; sem referência comparável (${rotulo}): o dia do ano anterior não tem valor ou está em outro regime metodológico.`,
        `${p.titulo}: ${valor}${quem} ${quando}; no comparable reference (${rotulo}): the day of the previous year has no value or is in another methodological regime.`,
        idioma,
      );
    const pctTxt = pos.variacao_pct === null ? "" : `${num(Math.abs(pos.variacao_pct), 1, idioma)}% `;
    const onde = pos.situacao === "acima" ? "acima" : pos.situacao === "abaixo" ? "abaixo" : "igual";
    return tx(
      `${p.titulo}: ${valor}${quem} ${quando}, ${onde === "igual" ? "igual à" : `${pctTxt}${onde} da`} referência (${rotulo}: ${fmt(pos.referencia)}).`,
      `${p.titulo}: ${valor}${quem} ${quando}, ${onde === "igual" ? "equal to the" : `${pctTxt}${LADO[onde]} the`} reference (${rotulo}: ${fmt(pos.referencia)}).`,
      idioma,
    );
  }
  // rede: o sinal dá o sentido; não há referência de capacidade
  const v = pos.valor ?? 0;
  const [de, para] = (p.valor_atual.rotulo ?? "").split(" → ");
  const sentido = de && para ? tx(v >= 0 ? `de ${de} para ${para}` : `de ${para} para ${de}`, v >= 0 ? `from ${de} to ${para}` : `from ${para} to ${de}`, idioma) : "";
  return tx(
    `${p.titulo}: ${comUnidade(Math.abs(v), p.unidade, p.casas, idioma)}${sentido ? ` ${sentido}` : ""} ${quando} (saldo líquido do dia, a média das 24 horas do fluxo verificado, sem comparação com limites de intercâmbio).`,
    `${p.titulo}: ${comUnidade(Math.abs(v), p.unidade, p.casas, idioma)}${sentido ? ` ${sentido}` : ""} ${quando} (net balance of the day, the average of the 24 hours of verified flow, with no comparison with interchange limits).`,
    idioma,
  );
}

/** Resposta do P005: uma leitura por painel, na ordem publicada. */
export function respostaDeterminantes(m: MultiplosVisao, idioma: Idioma = idiomaEnergia()): string[] {
  return m.paineis.map((p) => leituraDeterminante(p, m, idioma));
}

/**
 * Veredito do P005 ("Como estão os principais determinantes?"): quais painéis estão dentro da faixa de referência que o
 * próprio painel publica, qual está fora e a comparação da carga com o ano anterior. A rede só tem o sentido do fluxo.
 * Os mesmos campos e a mesma posição de leituraDeterminante; os valores e as datas de cada painel ficam na resposta completa.
 */
export function vereditoDeterminantes(m: MultiplosVisao, idioma: Idioma = idiomaEnergia()): string {
  // com vários painéis fora da faixa, a forma curta mantém cada painel e a sua posição dentro do limite de palavras
  const longo = textoVereditoDeterminantes(m, idioma, false);
  return contaPalavras(longo) <= LIMITE_PALAVRAS_VEREDITO ? longo : textoVereditoDeterminantes(m, idioma, true);
}

function textoVereditoDeterminantes(m: MultiplosVisao, idioma: Idioma, curto: boolean): string {
  const dentro: string[] = [];
  const fora: string[] = [];
  const semDado: string[] = [];
  const sentido: string[] = [];
  m.paineis.forEach((p) => {
    const pos = posicaoDeterminante(p, m);
    const nome = p.titulo;
    if (pos.situacao === "sem_dado") semDado.push(nome);
    else if (pos.situacao === "sentido") sentido.push(nome);
    else if (pos.situacao === "sem_referencia") semDado.push(tx(`${nome} (sem referência)`, `${nome} (no reference)`, idioma));
    else if (p.referencia.tipo === "serie") {
      const ref = p.referencia.rotulo.split(",")[0];
      const pct = pos.variacao_pct === null ? "" : `${num(Math.abs(pos.variacao_pct), 1, idioma)}% `;
      fora.push(
        tx(
          pos.situacao === "dentro" ? `${nome}: igual ao ${minuscula(ref)}` : `${nome}: ${pct}${pos.situacao === "acima" ? "acima" : "abaixo"} do ${minuscula(ref)}`,
          pos.situacao === "dentro" ? `${nome}: equal to the ${minuscula(ref)}` : `${nome}: ${pct}${pos.situacao === "acima" ? "above" : "below"} the ${minuscula(ref)}`,
          idioma,
        ),
      );
    } else if (pos.situacao === "dentro") dentro.push(nome);
    else
      fora.push(
        tx(`${nome}: ${pos.situacao === "acima" ? "acima" : "abaixo"} da faixa de referência`, `${nome}: ${pos.situacao === "acima" ? "above" : "below"} the reference range`, idioma),
      );
  });
  const partes: string[] = [];
  if (dentro.length) {
    const lista = listaNoIdioma(dentro.map((x, i) => (i === 0 ? x : minuscula(x))), idioma);
    partes.push(
      tx(
        curto ? `${lista}: dentro da faixa de referência.` : `${lista} ${dentro.length === 1 ? "está" : "estão"} dentro da faixa de referência ${dentro.length === 1 ? "do painel" : "de cada painel"}.`,
        curto ? `${lista}: within the reference range.` : `${lista} ${dentro.length === 1 ? "is" : "are"} within the reference range of ${dentro.length === 1 ? "the panel" : "each panel"}.`,
        idioma,
      ),
    );
  }
  for (const f of fora) partes.push(`${f}.`);
  if (sentido.length)
    partes.push(
      tx(
        curto ? `${sentido.join(", ")}: só o sentido do fluxo, sem comparação com limites de intercâmbio.` : `${sentido.join(", ")}: o painel mostra só o sentido do fluxo, sem comparação com limites de intercâmbio.`,
        curto ? `${sentido.join(", ")}: only the direction of the flow, with no comparison with interchange limits.` : `${sentido.join(", ")}: the panel shows only the direction of the flow, with no comparison with interchange limits.`,
        idioma,
      ),
    );
  if (semDado.length) {
    const lista = listaNoIdioma(semDado.map((x) => minuscula(x)), idioma);
    partes.push(tx(`Sem dado: ${lista}.`, `No data: ${lista}.`, idioma));
  }
  return partes.join(" ");
}

/**
 * A janela da faixa de referência da participação térmica: 365 janelas de 7 dias, todas anteriores à atual e sem sobreposição com ela. A primeira termina 7
 * dias antes do dia de referência e a 365ª, 371 dias antes; "dos 365 dias anteriores" é o número de janelas, não o intervalo que elas cobrem.
 */
export function textoJanelaTermica(t: { p10: number | null; p90: number | null; n?: number }, diaReferencia: string | null, idioma: Idioma = idiomaEnergia()): string {
  if (t.p10 === null || t.p90 === null) return "";
  const n = t.n ?? 365;
  const ini = diaReferencia ? dataBR(somaDias(diaReferencia, -(6 + n)), idioma) : "";
  const fim = diaReferencia ? dataBR(somaDias(diaReferencia, -7), idioma) : "";
  const entre = diaReferencia ? tx(`, entre ${ini} e ${fim}`, `, between ${ini} and ${fim}`, idioma) : "";
  return tx(
    `Faixa de ${num(t.p10, 1, idioma)}% a ${num(t.p90, 1, idioma)}%, do 10º ao 90º percentil de ${num(n, 0, idioma)} janelas de 7 dias que terminam de 7 a ${num(6 + n, 0, idioma)} dias antes do dia de referência${entre}, sem sobreposição com a janela de 7 dias que termina no dia de referência.`,
    `Range of ${num(t.p10, 1, idioma)}% to ${num(t.p90, 1, idioma)}%, from the 10th to the 90th percentile of ${num(n, 0, idioma)} 7-day windows ending 7 to ${num(6 + n, 0, idioma)} days before the reference day${entre}, with no overlap with the 7-day window ending on the reference day.`,
    idioma,
  );
}

/** "O que mudou" dos determinantes sem repetir o veredito: o período dos cinco gráficos e a data de referência de cada painel. */
export function textoMudouDeterminantes(m: MultiplosVisao, idioma: Idioma = idiomaEnergia()): string {
  const dias = [...m.dados].map((l) => l.d).sort();
  const datas = m.paineis.map((p) => `${minuscula(p.titulo)} ${dataBR(p.data_referencia, idioma)}`);
  const ini = dias.length ? dataBR(dias[0], idioma) : "";
  const fim = dias.length ? dataBR(dias[dias.length - 1], idioma) : "";
  const periodo = dias.length
    ? tx(
        `Os gráficos cobrem ${plural(dias.length, "dia", "dias", "pt")} publicados, de ${ini} a ${fim}.`,
        `The charts cover ${plural(dias.length, "published day", "published days", "en")}, from ${ini} to ${fim}.`,
        idioma,
      )
    : tx("Nenhum dia publicado nesta execução.", "No day published in this run.", idioma);
  return tx(`${periodo} A data de referência de cada painel é a da sua fonte: ${datas.join("; ")}.`, `${periodo} The reference date of each panel is that of its source: ${datas.join("; ")}.`, idioma);
}

/** Colunas da tabela equivalente aos pequenos múltiplos: a data e todas as colunas publicadas no recorte. */
export function colunasMultiplos(m: MultiplosVisao, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const cols: ColunaTabela[] = [{ id: "d", rotulo: tx("Data", "Date", idioma), tipo: "data" }];
  for (const p of m.paineis) {
    for (const c of p.colunas) cols.push({ id: c.id, rotulo: `${p.titulo}: ${c.rotulo}`, tipo: "numero", unidade: p.unidade, casas: p.casas });
    const r = p.referencia;
    if (r.tipo === "faixa_por_data") {
      cols.push({ id: r.inferior, rotulo: tx(`${p.titulo}: limite inferior da referência`, `${p.titulo}: lower limit of the reference`, idioma), tipo: "numero", unidade: p.unidade, casas: p.casas });
      cols.push({ id: r.superior, rotulo: tx(`${p.titulo}: limite superior da referência`, `${p.titulo}: upper limit of the reference`, idioma), tipo: "numero", unidade: p.unidade, casas: p.casas });
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
export function periodoCurto(it: Pick<ItemSociedade, "periodo">, idioma: Idioma = idiomaEnergia()): string {
  const { tipo, inicio, fim } = it.periodo;
  const a = tx(" a ", " to ", idioma);
  if (tipo === "vigencia") return tx(`vigente em ${dataBR(fim, "pt")}`, `in force on ${dataBR(fim, "en")}`, idioma);
  if (tipo === "anual")
    return inicio.slice(0, 4) === fim.slice(0, 4) && inicio.endsWith("-01") && fim.endsWith("-12")
      ? tx(`ano de ${inicio.slice(0, 4)}`, `year ${inicio.slice(0, 4)}`, idioma)
      : `${mesAno(inicio.slice(0, 7), idioma)}${a}${mesAno(fim.slice(0, 7), idioma)}`;
  return inicio === fim ? mesAno(inicio.slice(0, 7), idioma) : `${mesAno(inicio.slice(0, 7), idioma)}${a}${mesAno(fim.slice(0, 7), idioma)}`;
}

/** Valor do indicador com a unidade, quando o texto publicado é só o número (os números do texto publicado saem na forma do idioma). */
export function valorSociedade(it: Pick<ItemSociedade, "valor_exibido" | "unidade" | "equivalente">, idioma: Idioma = idiomaEnergia()): string {
  const soNumero = /^[\d.,−-]+$/.test(it.valor_exibido.trim());
  const valor = idioma === "en" ? trechoEn(it.valor_exibido) : it.valor_exibido;
  return `${valor}${soNumero ? ` ${gold(it.unidade, idioma)}` : ""}${it.equivalente ? ` (${it.equivalente})` : ""}`;
}

/** Texto de um complemento: número único ou par (faixa entre percentis ou atual e comparação). */
export function textoComplemento(
  c: { rotulo: string; valor: number | (number | null)[] | null; unidade: string | null; valor_exibido?: string },
  idioma: Idioma = idiomaEnergia(),
): string {
  if (c.valor_exibido) return idioma === "en" ? trechoEn(c.valor_exibido) : c.valor_exibido;
  const semDado = tx("sem dado", "no data", idioma);
  if (c.valor === null) return semDado;
  // entre os percentis é uma faixa ("a"); nos outros pares, o valor atual e a comparação ("e")
  const liga = /percentil/i.test(c.rotulo) ? tx("a", "to", idioma) : tx("e", "and", idioma);
  // tarifa: o cartão mostra o valor em R$/kWh (R$/MWh ÷ 1000, como o verbete TE e TUSD explica), então a faixa também
  if (c.unidade === "R$/MWh") {
    const kwh = (x: number | null) => (x === null ? semDado : `R$ ${num(x / 1000, 4, idioma)}/kWh`);
    return Array.isArray(c.valor) ? `${kwh(c.valor[0])} ${liga} ${kwh(c.valor[1])}` : kwh(c.valor);
  }
  if (c.unidade === "R$/mês" && typeof c.valor === "number") return tx(`R$ ${num(c.valor, 2, "pt")} por mês`, `R$ ${num(c.valor, 2, "en")} per month`, idioma);
  // percentual colado ao número, como no resto da página ("61,6%", e não "61,6 %")
  const unidade = c.unidade ? gold(c.unidade, idioma) : "";
  const u = c.unidade ? (c.unidade.startsWith("%") ? unidade : ` ${unidade}`) : "";
  if (Array.isArray(c.valor)) {
    const [a, b] = c.valor;
    const f = (x: number | null) => (x === null ? semDado : num(x, casasDe(x), idioma));
    return `${f(a)} ${liga} ${f(b)}${u}`;
  }
  return `${num(c.valor, casasDe(c.valor), idioma)}${u}`;
}


/* ---------------------------------------------------------------- ressalvas essenciais dos indicadores de sociedade */

/** Horas decimais como horas e minutos ("17,20" vira "17 h 12 min"), na forma do resto do observatório. */
export function horasMinutos(h: number, idioma: Idioma = idiomaEnergia()): string {
  const total = Math.round(h * 60);
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  if (horas === 0) return `${minutos} min`;
  return minutos === 0 ? `${num(horas, 0, idioma)} h` : `${num(horas, 0, idioma)} h ${minutos} min`;
}

/** Parcelas do DEC que a regra exclui do apurado, na ordem em que a página as lista. */
export const PARCELAS_EXCLUIDAS_DEC = [
  { chave: "emergencia", rotulo: "situação de emergência" }, // i18n: dado (a forma inglesa está em PARCELA_EN)
  { chave: "dia_critico", rotulo: "dia crítico" }, // i18n: dado
  { chave: "externa", rotulo: "origem externa ao sistema de distribuição" }, // i18n: dado
  { chave: "ons", rotulo: "racionamento ou alívio de carga pelo ONS" }, // i18n: dado
] as const;

/** As parcelas excluídas do DEC em inglês, pela chave. */
const PARCELA_EN: Readonly<Record<(typeof PARCELAS_EXCLUIDAS_DEC)[number]["chave"], string>> = {
  emergencia: "emergency situation",
  dia_critico: "critical day",
  externa: "origin external to the distribution system",
  ons: "rationing or load relief by ONS",
};

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
  /** Quem enviou DEC no ano: todas as distribuidoras, as que têm os 12 meses (entram no DEC anual) e as de ano parcial, com os conjuntos de cada grupo. */
  universo: { distribuidoras: number; anuais: number; parciais: { sigla: string; meses: number }[]; conjuntosAnuais: number; conjuntosParciais: number } | null;
};

export function decDoAno(
  q: { brasil: { anual: readonly BrasilAnual[] }; conjuntos: Conjuntos; distribuidoras?: readonly { sigla: string | null; ano: number; meses: number; conjuntos: number | null }[] } | null | undefined,
  ano: number,
): DecDoAno | null {
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
    universo: universoDec(q.distribuidoras, ano),
  };
}

function universoDec(ds: readonly { sigla: string | null; ano: number; meses: number; conjuntos: number | null }[] | undefined, ano: number): DecDoAno["universo"] {
  const doAno = (ds ?? []).filter((d) => d.ano === ano);
  if (!doAno.length) return null;
  const anuais = doAno.filter((d) => d.meses >= 12);
  const parciais = doAno.filter((d) => d.meses < 12);
  const soma = (xs: typeof doAno) => xs.reduce((a, d) => a + (d.conjuntos ?? 0), 0);
  return { distribuidoras: doAno.length, anuais: anuais.length, parciais: parciais.map((d) => ({ sigla: d.sigla ?? tx("sem sigla", "no acronym"), meses: d.meses })), conjuntosAnuais: soma(anuais), conjuntosParciais: soma(parciais) };
}

/**
 * Quem entra no DEC anual, conciliado: a fonte mostra "3150 conjuntos de 98 distribuidoras", e a contagem dos conjuntos acima do limite usa 3.146. Os dois
 * números são do mesmo universo: das distribuidoras que enviaram DEC no ano, as que têm os 12 meses somam os 3.146 conjuntos com limite, e as de ano parcial,
 * que ficam fora do DEC anual, somam os outros.
 */
export function textoUniversoDec(d: DecDoAno, idioma: Idioma = idiomaEnergia()): string {
  const u = d.universo;
  if (!u || !u.parciais.length) return "";
  const n = (x: number) => num(x, 0, idioma);
  const nomes = listaNoIdioma(
    u.parciais.map((x) => tx(`${x.sigla} (${x.meses} meses)`, `${x.sigla} (${x.meses} ${x.meses === 1 ? "month" : "months"})`, idioma)),
    idioma,
  );
  const outros = u.conjuntosParciais;
  return tx(
    `Universo do DEC de ${d.ano}: ${n(u.distribuidoras)} distribuidoras enviaram DEC; ${n(u.anuais)} têm os 12 meses e entram no DEC anual, com ${n(u.conjuntosAnuais)} conjuntos (a contagem de conjuntos acima do limite usa esses). ${plural(u.parciais.length, "distribuidora enviou", "distribuidoras enviaram", "pt")} só parte do ano e ${u.parciais.length === 1 ? "fica" : "ficam"} fora do DEC anual: ${nomes}${outros ? `, com ${n(outros)} ${outros === 1 ? "conjunto" : "conjuntos"}` : ""}.`,
    `Universe of the ${d.ano} DEC: ${n(u.distribuidoras)} distribution utilities submitted DEC; ${n(u.anuais)} have all 12 months and enter the annual DEC, with ${n(u.conjuntosAnuais)} sets (the count of sets above the limit uses these). ${plural(u.parciais.length, "distribution utility", "distribution utilities", "en")} submitted only part of the year and ${u.parciais.length === 1 ? "is" : "are"} left out of the annual DEC: ${nomes}${outros ? `, with ${n(outros)} ${outros === 1 ? "set" : "sets"}` : ""}.`,
    idioma,
  );
}

/** A ressalva essencial do DEC, junto do número: o que "apurado" quer dizer, o que a regra deixa de fora e o total de todas as origens. */
export function textoDecApurado(d: DecDoAno, idioma: Idioma = idiomaEnergia()): string {
  const rot = (x: DecDoAno["parcelas"][number]) => (idioma === "en" ? PARCELA_EN[x.chave] : x.rotulo);
  const lista = d.parcelas.map((x) => (x.horas === null ? rot(x) : `${rot(x)} (${num(x.horas, 2, idioma)} h)`));
  const exclusoes = listaNoIdioma(lista, idioma);
  const h = (x: number) => num(x, 2, idioma);
  if (d.excluido === null || d.todasOrigens === null)
    return tx(
      `O DEC apurado de ${d.ano}, ${h(d.apurado)} h por unidade consumidora, não conta as interrupções que a regra exclui do apurado: ${exclusoes}. A fonte não publica todas essas parcelas para o ano.`,
      `The assessed DEC for ${d.ano}, ${h(d.apurado)} h per consumer unit, does not count the interruptions that the rule excludes from the assessment: ${exclusoes}. The source does not publish all of these components for the year.`,
      idioma,
    );
  return tx(
    `O DEC apurado de ${d.ano}, ${h(d.apurado)} h por unidade consumidora, não conta as interrupções que a regra exclui do apurado: ${exclusoes}, que somam ${h(d.excluido)} h. ` +
      `Com todas as origens, o DEC de ${d.ano} foi de ${h(d.todasOrigens)} h (${horasMinutos(d.todasOrigens, idioma)}).`,
    `The assessed DEC for ${d.ano}, ${h(d.apurado)} h per consumer unit, does not count the interruptions that the rule excludes from the assessment: ${exclusoes}, which add up to ${h(d.excluido)} h. ` +
      `With all origins, the ${d.ano} DEC was ${h(d.todasOrigens)} h (${horasMinutos(d.todasOrigens, idioma)}).`,
    idioma,
  );
}

/** Versão de uma linha da ressalva do DEC, para a nota que fica sob o número. */
export function textoDecApuradoCurto(d: DecDoAno, idioma: Idioma = idiomaEnergia()): string {
  if (d.excluido === null || d.todasOrigens === null) return tx("Apurado: não conta as interrupções que a regra exclui.", "Assessed: it does not count the interruptions that the rule excludes.", idioma);
  return tx(
    `Apurado: não conta ${num(d.excluido, 2, idioma)} h que a regra exclui; todas as origens somam ${num(d.todasOrigens, 2, idioma)} h.`,
    `Assessed: it does not count ${num(d.excluido, 2, idioma)} h that the rule excludes; all origins add up to ${num(d.todasOrigens, 2, idioma)} h.`,
    idioma,
  );
}

/** O que o limite agregado é e o que ele não é, com a parcela de conjuntos acima do próprio limite. */
export function textoLimiteAgregado(d: DecDoAno, idioma: Idioma = idiomaEnergia()): string {
  if (d.limite === null) return "";
  const base = tx(
    `Não existe limite nacional de DEC. O limite agregado de ${num(d.limite, 2, idioma)} h é a média dos limites de cada conjunto elétrico, ponderada pelas unidades consumidoras médias do ano, calculada pelo observatório.`,
    `There is no national DEC limit. The aggregate limit of ${num(d.limite, 2, idioma)} h is the average of the limits of each consumer set, weighted by the average consumer units of the year, calculated by the observatory.`,
    idioma,
  );
  const c = d.conjuntos;
  if (!c || c.pct === null) return base;
  const uc = c.pctUc === null ? "" : tx(`, que reúnem ${num(c.pctUc, 1, idioma)}% das unidades consumidoras`, `, which hold ${num(c.pctUc, 1, idioma)}% of the consumer units`, idioma);
  const universo = textoUniversoDec(d, idioma);
  return tx(
    `${base} Em ${d.ano}, ${num(c.acima, 0, idioma)} de ${num(c.total, 0, idioma)} conjuntos (${num(c.pct, 1, idioma)}%${uc}) ficaram acima do próprio limite.${universo ? ` ${universo}` : ""}`,
    `${base} In ${d.ano}, ${num(c.acima, 0, idioma)} of ${num(c.total, 0, idioma)} sets (${num(c.pct, 1, idioma)}%${uc}) were above their own limit.${universo ? ` ${universo}` : ""}`,
    idioma,
  );
}

/** Dispersão do DEC apurado entre os conjuntos elétricos: a média nacional não mostra que o valor varia de conjunto para conjunto. */
export function textoDispersaoDec(d: DecDoAno, idioma: Idioma = idiomaEnergia()): string {
  const q = d.quantis;
  if (!q || q.min === null || q.max === null || q.p25 === null || q.p50 === null || q.p75 === null) return "";
  const h = (x: number) => num(x, 2, idioma);
  return tx(
    `O DEC apurado de cada conjunto elétrico em ${d.ano} vai de ${h(q.min)} h a ${h(q.max)} h; metade dos conjuntos ficou entre ${h(q.p25)} h e ${h(q.p75)} h, com mediana de ${h(q.p50)} h.`,
    `The assessed DEC of each consumer set in ${d.ano} ranges from ${h(q.min)} h to ${h(q.max)} h; half of the sets were between ${h(q.p25)} h and ${h(q.p75)} h, with a median of ${h(q.p50)} h.`,
    idioma,
  );
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

export function textoDenominadorPerdas(d: DenominadorPerdas, idioma: Idioma = idiomaEnergia()): string {
  const n = (x: number, c: number) => num(x, c, idioma);
  return tx(
    `A taxa tem como denominador a energia injetada de referência (${n(d.referenciaTwh, 2)} TWh). Em ${n(d.requeridaOuMista, 0)} das ${n(d.concessionarias, 0)} concessionárias, ela é a energia requerida ` +
      `(fornecida mais irregular mais perdas, leiaute de 2024 da ANEEL) ou uma mistura dos dois leiautes, e não a linha de energia injetada publicada. ` +
      `Com a injetada publicada (${n(d.publicadaTwh, 2)} TWh), a mesma perda de ${n(d.perdasTwh, 2)} TWh daria ${n(d.taxaPublicadaPct, 1)}%, e não ${n(d.taxaReferenciaPct, 1)}%.`,
    `The rate's denominator is the reference injected energy (${n(d.referenciaTwh, 2)} TWh). In ${n(d.requeridaOuMista, 0)} of the ${n(d.concessionarias, 0)} concession holders, it is the required energy ` +
      `(supplied plus irregular plus losses, ANEEL's 2024 layout) or a mix of the two layouts, and not the published injected energy line. ` +
      `With the published injected energy (${n(d.publicadaTwh, 2)} TWh), the same loss of ${n(d.perdasTwh, 2)} TWh would give ${n(d.taxaPublicadaPct, 1)}%, not ${n(d.taxaReferenciaPct, 1)}%.`,
    idioma,
  );
}

/** Dispersão da taxa entre as concessionárias: a taxa nacional não mostra que ela varia muito de uma distribuidora para outra. */
export function textoDispersaoPerdas(d: DenominadorPerdas, idioma: Idioma = idiomaEnergia()): string {
  const q = d.dispersao;
  if (!q) return "";
  const p = (x: number) => num(x, 1, idioma);
  return tx(
    `A taxa de cada uma das ${num(d.concessionarias, 0, idioma)} concessionárias em ${d.ano} vai de ${p(q.min)}% a ${p(q.max)}%; metade ficou entre ${p(q.p25)}% e ${p(q.p75)}%, com mediana de ${p(q.mediana)}%.`,
    `The rate of each of the ${num(d.concessionarias, 0, idioma)} concession holders in ${d.ano} ranges from ${p(q.min)}% to ${p(q.max)}%; half were between ${p(q.p25)}% and ${p(q.p75)}%, with a median of ${p(q.mediana)}%.`,
    idioma,
  );
}

export function textoDenominadorPerdasCurto(d: DenominadorPerdas, idioma: Idioma = idiomaEnergia()): string {
  return tx(
    `Denominador: energia injetada de referência, que em ${num(d.requeridaOuMista, 0, idioma)} das ${num(d.concessionarias, 0, idioma)} concessionárias é a requerida; com a injetada publicada, ${num(d.taxaPublicadaPct, 1, idioma)}%.`,
    `Denominator: reference injected energy, which in ${num(d.requeridaOuMista, 0, idioma)} of the ${num(d.concessionarias, 0, idioma)} concession holders is the required energy; with the published injected energy, ${num(d.taxaPublicadaPct, 1, idioma)}%.`,
    idioma,
  );
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

/** O que a mediana simples é: cada distribuidora pesa o mesmo, e o resultado muda com o conjunto que o arquivo da ANEEL tem na data. */
const notaMedianaSimples = (idioma: Idioma) =>
  tx(
    " A mediana é simples (cada distribuidora pesa o mesmo, qualquer que seja o número de consumidores) e muda se a ANEEL acrescentar distribuidoras ao arquivo; a tabela de quartis de Minha região traz também a mediana pesada pelas unidades consumidoras.",
    " The median is simple (each distribution utility has the same weight, whatever its number of consumers) and changes if ANEEL adds distribution utilities to the file; the quartile table in My region also has the median weighted by consumer units.",
    idioma,
  );

export function textoCoberturaTarifa(c: CoberturaTarifa, idioma: Idioma = idiomaEnergia()): string {
  const n = (x: number) => num(x, 0, idioma);
  const data = dataBR(c.data, idioma);
  if (c.fora === 0)
    return tx(
      `Mediana das ${n(c.comTarifa)} distribuidoras com tarifa B1 residencial vigente em ${data}, todas as que constam no conjunto de dados.${notaMedianaSimples(idioma)}`,
      `Median of the ${n(c.comTarifa)} distribution utilities with a B1 residential tariff in force on ${data}, all of those in the dataset.${notaMedianaSimples(idioma)}`,
      idioma,
    );
  const vespera = dataBR(somaDias(c.data, -1), idioma);
  const recentes =
    c.foraRecente > 0
      ? tx(
          `${n(c.foraRecente)} ${c.foraRecente === 1 ? "teve" : "tiveram"} a vigência encerrada nos 90 dias anteriores e a tarifa seguinte ainda não constava no arquivo da ANEEL gerado em ${data}${c.naVespera > 0 ? ` (${n(c.naVespera)} delas com a vigência encerrada em ${vespera})` : ""}`,
          `${n(c.foraRecente)} ${c.foraRecente === 1 ? "had its" : "had their"} validity period end in the previous 90 days and the next tariff was not yet in the ANEEL file generated on ${data}${c.naVespera > 0 ? ` (${n(c.naVespera)} of them with the validity period ending on ${vespera})` : ""}`,
          idioma,
        )
      : "";
  const antigas =
    c.foraAntigas > 0
      ? tx(
          `${n(c.foraAntigas)} ${c.foraAntigas === 1 ? "está" : "estão"} sem tarifa há mais de 90 dias${c.incorporadas > 0 ? ` (${n(c.incorporadas)} incorporadas por outra distribuidora)` : ""}`,
          `${n(c.foraAntigas)} ${c.foraAntigas === 1 ? "has had" : "have had"} no tariff for more than 90 days${c.incorporadas > 0 ? ` (${n(c.incorporadas)} merged into another distribution utility)` : ""}`,
          idioma,
        )
      : "";
  return tx(
    `A tarifa de referência é a mediana de ${n(c.comTarifa)} distribuidoras com tarifa B1 residencial vigente em ${data}, de ${n(c.cnpjs)} com tarifa no conjunto de dados. ` +
      `Ficaram fora ${n(c.fora)}: ${[recentes, antigas].filter(Boolean).join("; ")}.${notaMedianaSimples(idioma)}`,
    `The reference tariff is the median of ${n(c.comTarifa)} distribution utilities with a B1 residential tariff in force on ${data}, out of ${n(c.cnpjs)} with a tariff in the dataset. ` +
      `${n(c.fora)} were left out: ${[recentes, antigas].filter(Boolean).join("; ")}.${notaMedianaSimples(idioma)}`,
    idioma,
  );
}

export function textoCoberturaTarifaCurto(c: CoberturaTarifa, idioma: Idioma = idiomaEnergia()): string {
  const n = (x: number) => num(x, 0, idioma);
  return tx(
    `Mediana de ${n(c.comTarifa)} de ${n(c.cnpjs)} distribuidoras: ${n(c.fora)} ficaram fora (${n(c.foraRecente)} com a tarifa seguinte ainda ausente do arquivo da ANEEL).`,
    `Median of ${n(c.comTarifa)} of ${n(c.cnpjs)} distribution utilities: ${n(c.fora)} were left out (${n(c.foraRecente)} with the next tariff still missing from the ANEEL file).`,
    idioma,
  );
}

/** O que cada indicador de sociedade precisa dizer junto do número; ausente quando a gold de origem não está disponível. */
export type ContextoSociedade = { dec?: DecDoAno | null; perdas?: DenominadorPerdas | null; tarifa?: CoberturaTarifa | null };

/** Título de um indicador como a página o escreve: o DEC leva a palavra "apurado", que carrega a ressalva essencial. */
export function tituloSociedade(it: Pick<ItemSociedade, "id" | "titulo">, idioma: Idioma = idiomaEnergia()): string {
  const titulo = gold(it.titulo, idioma);
  return it.id === "continuidade" ? tx(`${titulo} (DEC apurado)`, `${titulo} (assessed DEC)`, idioma) : titulo;
}

/** Título do cartão: o indicador mensal leva o mês no cabeçalho (a Tarifa Social de maio de 2025 não é a de outro mês). */
export function tituloCartaoSociedade(it: Pick<ItemSociedade, "id" | "titulo" | "periodo">, idioma: Idioma = idiomaEnergia()): string {
  const t = tituloSociedade(it, idioma);
  return it.periodo.tipo === "mensal" ? `${t}, ${periodoCurto(it, idioma)}` : t;
}

/** A tarifa em R$/MWh, a unidade do conjunto de dados e da página Conta de luz, para quem compara com o cartão em R$/kWh. */
export function textoUnidadeTarifa(valorMwh: number, idioma: Idioma = idiomaEnergia()): string {
  return tx(
    `O cartão mostra a tarifa em R$/kWh; em R$/MWh, a unidade da página Conta de luz, é o mesmo valor multiplicado por 1.000: R$ ${num(valorMwh, 2, "pt")}/MWh.`,
    `The card shows the tariff in R$/kWh; in R$/MWh, the unit of the Electricity bill page, it is the same value multiplied by 1,000: R$ ${num(valorMwh, 2, "en")}/MWh.`,
    idioma,
  );
}

/** Pergunta de cada indicador como a página a escreve; a do DEC diz que só as interrupções apuradas entram. */
export function perguntaSociedade(id: IdSociedade, idioma: Idioma = idiomaEnergia()): string | undefined {
  if (id === "continuidade")
    return tx(
      "Quanto tempo e quantas vezes, em média, cada consumidor ficou sem energia no ano, contadas só as interrupções que a regra apura?",
      "How long and how many times, on average, was each consumer without power in the year, counting only the interruptions that the rule assesses?",
      idioma,
    );
  return undefined;
}

export const PERGUNTA_SOCIEDADE: Partial<Record<IdSociedade, string>> = { continuidade: perguntaSociedade("continuidade", "pt") };

/** Nome inglês das siglas que a Visão geral expande no primeiro uso (o dicionário do observatório só tem o português). */
const SIGLAS_EN: Readonly<Record<string, string>> = {
  MMGD: "distributed micro and mini generation",
  DEC: "equivalent interruption duration per consumer unit",
  SCS: "ANEEL's control system for subsidies and social programs",
  CDE: "Energy Development Account",
};

/**
 * Sigla com o nome por extenso no primeiro uso: "SCS" vira "SCS (Sistema de Controle de Subvenções e Programas Sociais)". Só a primeira
 * ocorrência de cada sigla da lista, e só se o texto ainda não a expande. O nome vem do dicionário de siglas do observatório (em
 * inglês, da tabela acima).
 */
export function expandeSiglas(texto: string, siglas: readonly string[], idioma: Idioma = idiomaEnergia()): string {
  let out = texto;
  for (const sigla of siglas) {
    const nome = idioma === "en" ? SIGLAS_EN[sigla] : SIGLAS[sigla];
    if (!nome || out.includes(`${sigla} (${nome}`)) continue;
    out = out.replace(PADRAO_SIGLA(sigla), `${sigla} (${nome})`);
  }
  return out;
}

/** Valor de enumeração da gold ("ATRASADO", "EM DIA") escrito como palavra comum no texto corrido. */
export function enumLegivel(texto: string, idioma: Idioma = idiomaEnergia()): string {
  if (idioma === "en") return texto.replace(/\bEM DIA\b/g, "up to date").replace(/\bATRASADO\b/g, "late").replace(/\bSEM SLA\b/g, "no declared deadline").replace(/\bSEM DADO\b/g, "no record");
  return texto
    .replace(/\bEM DIA\b/g, "em dia") // i18n: dado
    .replace(/\bATRASADO\b/g, "atrasado") // i18n: dado
    .replace(/\bSEM SLA\b/g, tx("sem prazo declarado", "no declared deadline", idioma))
    .replace(/\bSEM DADO\b/g, tx("sem registro", "no record", idioma));
}

/** Resposta do P006: cada indicador com o seu período; nenhum descreve o dia. */
export function respostaSociedade(s: SociedadeVisao, ctx: ContextoSociedade = {}, idioma: Idioma = idiomaEnergia()): string {
  if (!s.itens.length) return tx("Nenhum indicador de energia e sociedade disponível nesta publicação.", "No energy and society indicator available in this publication.", idioma);
  const partes = s.itens.map((it) => {
    const atrasado = it.atualidade?.situacao === "ATRASADO" ? tx("; conjunto atrasado no painel de saúde dos dados", "; dataset late in the data health panel", idioma) : "";
    if (it.id === "continuidade" && ctx.dec) {
      const limite = textoLimiteAgregado(ctx.dec, idioma);
      return `${tituloSociedade(it, idioma)}: ${valorSociedade(it, idioma)}, ${periodoCurto(it, idioma)}${atrasado}. ${textoDecApurado(ctx.dec, idioma)}${limite ? ` ${limite}` : ""}`;
    }
    const titulo = tituloSociedade(it, idioma);
    const extra =
      it.id === "perdas" && ctx.perdas ? ` ${textoDenominadorPerdas(ctx.perdas, idioma)}` : it.id === "tarifa" && ctx.tarifa ? ` ${textoCoberturaTarifa(ctx.tarifa, idioma)}` : "";
    return `${titulo}: ${valorSociedade(it, idioma)}, ${periodoCurto(it, idioma)}${atrasado}.${extra}`;
  });
  const ids = s.ausentes.map((a) => a.id).join(", ");
  const aus = s.ausentes.length ? tx(` Sem dado: ${ids}.`, ` No data: ${ids}.`, idioma) : "";
  return tx(`Cada número tem o seu período, e nenhum descreve o dia. ${partes.join(" ")}${aus}`, `Each number has its own period, and none describes the day. ${partes.join(" ")}${aus}`, idioma);
}

/** Valor com a unidade quando o texto publicado é só o número (sem o equivalente em horas e minutos do DEC). */
function valorComUnidade(it: Pick<ItemSociedade, "valor_exibido" | "unidade">, idioma: Idioma): string {
  const valor = idioma === "en" ? trechoEn(it.valor_exibido) : it.valor_exibido;
  return /^[\d.,−-]+$/.test(it.valor_exibido.trim()) ? `${valor} ${gold(it.unidade, idioma)}` : valor;
}

/**
 * Veredito do P006 ("Como custo e qualidade chegam ao consumidor?"): a tarifa de referência e o tempo sem energia, cada um
 * com o seu período, e o limite de leitura (nenhum descreve o dia). Os mesmos itens e campos de respostaSociedade; perdas e
 * Tarifa Social ficam nos cartões.
 */
export function vereditoSociedade(s: SociedadeVisao, ctx: ContextoSociedade = {}, idioma: Idioma = idiomaEnergia()): string {
  const por = new Map(s.itens.map((i) => [i.id, i]));
  const partes: string[] = [];
  const t = por.get("tarifa");
  if (t) {
    // o aviso da gold é português: a comparação é com ele, e a página escreve "sem tributos" no idioma
    const semTributos = /sem tributos/i.test(t.aviso);
    partes.push(
      tx(
        `A tarifa residencial de referência é ${valorComUnidade(t, idioma)}${semTributos ? ", sem tributos" : ""}, ${periodoCurto(t, idioma)}.`,
        `The reference residential tariff is ${valorComUnidade(t, idioma)}${semTributos ? ", before taxes" : ""}, ${periodoCurto(t, idioma)}.`,
        idioma,
      ),
    );
  }
  const c = por.get("continuidade");
  if (c) {
    // o número é o DEC apurado: o veredito diz o que a regra deixa de fora, para ninguém ler 9,33 h como todo o tempo sem energia
    const d = ctx.dec;
    const v = valorComUnidade(c, idioma);
    const p = periodoCurto(c, idioma);
    partes.push(
      d && d.excluido !== null && d.todasOrigens !== null
        ? tx(
            `O DEC apurado (${p}) foi de ${v}, sem ${num(d.excluido, 2, idioma)} h que a regra exclui (todas as origens: ${num(d.todasOrigens, 2, idioma)} h).`,
            `The assessed DEC (${p}) was ${v}, without ${num(d.excluido, 2, idioma)} h that the rule excludes (all origins: ${num(d.todasOrigens, 2, idioma)} h).`,
            idioma,
          )
        : tx(`O DEC apurado (${p}) foi de ${v}, sem as interrupções que a regra exclui.`, `The assessed DEC (${p}) was ${v}, without the interruptions that the rule excludes.`, idioma),
    );
  }
  if (!partes.length) {
    const outros = s.itens.slice(0, 2).map((it) => `${gold(it.titulo, idioma)}: ${valorComUnidade(it, idioma)} (${periodoCurto(it, idioma)})`);
    if (!outros.length) return "";
    partes.push(`${outros.join("; ")}.`);
  }
  partes.push(tx("Nenhum número descreve o dia.", "No number describes the day.", idioma));
  return partes.join(" ");
}

export function colunasSociedade(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "indicador", rotulo: tx("Indicador", "Indicator", idioma), tipo: "texto" },
    { id: "valor", rotulo: tx("Valor", "Value", idioma), tipo: "numero", casas: 2 }, // i18n: dado (o id da coluna)
    { id: "unidade", rotulo: tx("Unidade", "Unit", idioma), tipo: "texto" },
    { id: "valor_exibido", rotulo: tx("Como o módulo de origem exibe", "How the source module displays it", idioma), tipo: "texto" },
    { id: "tipo_periodo", rotulo: tx("Tipo de período", "Period type", idioma), tipo: "texto", categorica: true },
    { id: "inicio", rotulo: tx("Início do período", "Start of period", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Fim do período", "End of period", idioma), tipo: "data" },
    { id: "defasagem", rotulo: tx("Defasagem", "Lag", idioma), tipo: "texto" },
    { id: "atualidade", rotulo: tx("Atualidade do conjunto", "Dataset timeliness", idioma), tipo: "texto", categorica: true },
    { id: "cobertura", rotulo: tx("Cobertura", "Coverage", idioma), tipo: "texto" },
    { id: "gold", rotulo: tx("Módulo de origem", "Source module", idioma), tipo: "texto" },
  ];
}

export const COLUNAS_SOCIEDADE: ColunaTabela[] = colunasSociedade("pt");

function rotulosTipoPeriodo(idioma: Idioma): Record<string, string> {
  return tx({ vigencia: "vigência", anual: "anual", mensal: "mensal" }, { vigencia: "validity period", anual: "annual", mensal: "monthly" }, idioma);
}

export const ROTULO_TIPO_PERIODO: Record<string, string> = rotulosTipoPeriodo("pt");

/** Tabela equivalente do P006: uma linha por indicador, com período e defasagem. */
export function linhasSociedade(s: SociedadeVisao, idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return s.itens.map((it) => ({
    id: it.id,
    indicador: gold(it.titulo, idioma),
    valor: it.valor,
    unidade: gold(it.unidade, idioma),
    valor_exibido: idioma === "en" ? trechoEn(it.valor_exibido) : it.valor_exibido,
    tipo_periodo: rotulosTipoPeriodo(idioma)[it.periodo.tipo] ?? it.periodo.tipo,
    inicio: inicioDoPeriodo(it.periodo.inicio),
    fim: fimDoPeriodo(it.periodo.fim),
    defasagem: idioma === "en" ? (traduzModeloDaGold(it.defasagem.texto) ?? enumLegivel(it.defasagem.texto, idioma)) : enumLegivel(it.defasagem.texto, idioma),
    atualidade: it.atualidade?.situacao ? enumLegivel(it.atualidade.situacao, idioma) : null,
    cobertura: gold(it.cobertura, idioma),
    gold: it.gold,
  }));
}

export type FaixaTempo = { id: string; rotulo: string; inicio: string; fim: string; defasagemDias: number; texto: string };

/** Período de referência de cada indicador contra a data de processamento (dias corridos até ela). */
export function faixasTempo(s: SociedadeVisao, dataProcessamento: string, idioma: Idioma = idiomaEnergia()): FaixaTempo[] {
  return s.itens.map((it) => {
    const inicio = inicioDoPeriodo(it.periodo.inicio);
    const fim = fimDoPeriodo(it.periodo.fim);
    return { id: it.id, rotulo: gold(it.titulo, idioma), inicio, fim, defasagemDias: diasEntre(fim, dataProcessamento), texto: periodoCurto(it, idioma) };
  });
}


/** Domínio comum da linha do tempo: do início mais antigo à data de processamento. */
export function dominioTempo(faixas: readonly FaixaTempo[], dataProcessamento: string): { inicio: string; fim: string; dias: number } {
  const inicio = faixas.reduce((a, f) => (f.inicio < a ? f.inicio : a), dataProcessamento);
  return { inicio, fim: dataProcessamento, dias: Math.max(1, diasEntre(inicio, dataProcessamento)) };
}

/* ---------------------------------------------------------------- P007: o que observar */

function rotulosEstado(idioma: Idioma): Record<EstadoRegra, string> {
  return tx<Record<EstadoRegra, string>>(
    { ativo: "Em alerta", em_retorno: "Em alerta, em retorno", em_observacao: "Em observação", normal: "Normal", sem_dado: "Sem dado", evento: "Evento" },
    { ativo: "In alert", em_retorno: "In alert, returning", em_observacao: "Under observation", normal: "Normal", sem_dado: "No data", evento: "Event" },
    idioma,
  );
}

export const ROTULO_ESTADO: Record<EstadoRegra, string> = rotulosEstado("pt");

export function rotuloEstado(estado: EstadoRegra, idioma: Idioma = idiomaEnergia()): string {
  return rotulosEstado(idioma)[estado] ?? estado;
}

// i18n: dado (os ids dos filtros, gravados na URL)
export const FILTROS_P007 = ["todas", "atencao", "sistema", "dados"] as const;
export type FiltroP007 = (typeof FILTROS_P007)[number];

export function rotulosFiltroP007(idioma: Idioma = idiomaEnergia()): Record<FiltroP007, string> {
  return tx<Record<FiltroP007, string>>(
    { todas: "Todas", atencao: "Em alerta ou observação", sistema: "Sobre o sistema", dados: "Sobre os dados" },
    { todas: "All", atencao: "In alert or under observation", sistema: "About the system", dados: "About the data" },
    idioma,
  );
}

export const ROTULO_FILTRO_P007: Record<FiltroP007, string> = rotulosFiltroP007("pt");

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
export function respostaObservar(observar: readonly RegraObservar[], idioma: Idioma = idiomaEnergia()): string {
  const regras = observar.filter((o) => o.tipo !== "evento");
  const alerta = regras.filter((o) => o.ativo);
  const obs = regras.filter((o) => o.estado === "em_observacao");
  const sistema = alerta.filter((o) => o.assunto === "sistema");
  const dados = alerta.filter((o) => o.assunto === "dados");
  const nomes = (xs: RegraObservar[]) => xs.map((o) => minuscula(gold(o.titulo, idioma))).join("; ");
  const n = (x: number) => num(x, 0, idioma);
  const partes: string[] = [];
  partes.push(
    alerta.length
      ? tx(
          `Das ${n(regras.length)} regras, ${alerta.length === 1 ? "1 está" : `${n(alerta.length)} estão`} em alerta` +
            (sistema.length ? `; sobre o sistema: ${nomes(sistema)}` : "; nenhuma sobre o sistema") +
            (dados.length ? `; sobre os próprios dados: ${nomes(dados)}` : "") +
            ".",
          `Of the ${n(regras.length)} rules, ${alerta.length === 1 ? "1 is" : `${n(alerta.length)} are`} in alert` +
            (sistema.length ? `; about the system: ${nomes(sistema)}` : "; none about the system") +
            (dados.length ? `; about the data itself: ${nomes(dados)}` : "") +
            ".",
          idioma,
        )
      : tx(`Nenhuma das ${n(regras.length)} regras está em alerta.`, `None of the ${n(regras.length)} rules is in alert.`, idioma),
  );
  if (obs.length)
    partes.push(
      tx(
        `${obs.length === 1 ? "Uma regra está" : `${n(obs.length)} regras estão`} em observação (condição presente, ainda sem a duração mínima): ${nomes(obs)}.`,
        `${obs.length === 1 ? "One rule is" : `${n(obs.length)} rules are`} under observation (condition present, still without the minimum duration): ${nomes(obs)}.`,
        idioma,
      ),
    );
  const sd = regras.filter((o) => o.estado === "sem_dado");
  if (sd.length) partes.push(tx(`Sem dado para avaliar: ${nomes(sd)}.`, `No data to assess: ${nomes(sd)}.`, idioma));
  const ev = observar.filter((o) => o.tipo === "evento");
  if (ev.length) partes.push(tx(`No calendário: ${nomes(ev)}.`, `On the calendar: ${nomes(ev)}.`, idioma));
  return partes.join(" ");
}

/**
 * Veredito do P007 ("Quais alterações são relevantes?"): se alguma regra sobre o sistema está em alerta, quais estão em
 * observação (condição presente, ainda sem a duração mínima) e quantas regras sobre os dados estão em alerta. Os mesmos campos
 * de respostaObservar.
 */
export function vereditoObservar(observar: readonly RegraObservar[], idioma: Idioma = idiomaEnergia()): string {
  // mesmo limite do veredito do P004: os nomes das regras em observação saem antes dos das regras em alerta
  const niveis: [boolean, boolean][] = [[true, true], [true, false], [false, false]];
  let v = "";
  for (const [sis, obs] of niveis) {
    v = textoVereditoObservar(observar, idioma, sis, obs);
    if (contaPalavras(v) <= LIMITE_PALAVRAS_VEREDITO) break;
  }
  return v;
}

function textoVereditoObservar(observar: readonly RegraObservar[], idioma: Idioma, comNomesSistema: boolean, comNomesObs: boolean): string {
  const regras = observar.filter((o) => o.tipo !== "evento");
  const alerta = regras.filter((o) => o.ativo);
  const sistema = alerta.filter((o) => o.assunto === "sistema");
  const dados = alerta.filter((o) => o.assunto === "dados");
  const obs = regras.filter((o) => o.estado === "em_observacao");
  const n = (x: number) => num(x, 0, idioma);
  const partes: string[] = [];
  if (sistema.length) {
    const nomes = comNomesSistema ? nomesNoVeredito(sistema, false, idioma) : null;
    partes.push(
      tx(
        `${sistema.length === 1 ? "Uma regra sobre o sistema está" : `${n(sistema.length)} regras sobre o sistema estão`} em alerta${nomes ? `: ${nomes}` : ""}.`,
        `${sistema.length === 1 ? "One rule about the system is" : `${n(sistema.length)} rules about the system are`} in alert${nomes ? `: ${nomes}` : ""}.`,
        idioma,
      ),
    );
  } else partes.push(tx("Nenhuma regra sobre o sistema está em alerta.", "No rule about the system is in alert.", idioma));
  if (obs.length) {
    const nomes = comNomesObs ? nomesNoVeredito(obs, false, idioma) : null;
    partes.push(
      tx(
        `${obs.length === 1 ? "Uma regra está" : `${n(obs.length)} regras estão`} em observação, ainda sem a duração mínima para virar alerta${nomes ? `: ${nomes}` : ""}.`,
        `${obs.length === 1 ? "One rule is" : `${n(obs.length)} rules are`} under observation, still without the minimum duration to become an alert${nomes ? `: ${nomes}` : ""}.`,
        idioma,
      ),
    );
  }
  if (dados.length)
    partes.push(
      tx(
        `Sobre os próprios dados, ${dados.length === 1 ? "1 regra está" : `${n(dados.length)} regras estão`} em alerta.`,
        `About the data itself, ${dados.length === 1 ? "1 rule is" : `${n(dados.length)} rules are`} in alert.`,
        idioma,
      ),
    );
  return partes.join(" ");
}

/**
 * Regras cujo alerta é uma igualdade com o limiar, e não uma passagem por ele: o piso do PLD dispara com as 24 horas do dia no
 * mínimo vigente, e "acima de 24 horas" não existe num dia de 24 horas.
 */
const ALERTA_COM_O_LIMIAR: ReadonlySet<IdRegra> = new Set<IdRegra>(["pld_piso"]);

/** Texto do valor avaliado de uma regra com os limiares, na unidade da regra. */
export function textoValorRegra(o: Pick<RegraObservar, "valor" | "unidade"> & { id?: IdRegra }, idioma: Idioma = idiomaEnergia()): string | null {
  const v = o.valor;
  if (!v) return null;
  const c = casasUnidade(o.unidade);
  const f = (x: number | null) => comUnidade(x, o.unidade, c, idioma);
  const igual = o.id !== undefined && ALERTA_COM_O_LIMIAR.has(o.id);
  const lim =
    v.limiar_inferior !== null && v.limiar_superior !== null
      ? tx(`alerta abaixo de ${f(v.limiar_inferior)} ou acima de ${f(v.limiar_superior)}`, `alert below ${f(v.limiar_inferior)} or above ${f(v.limiar_superior)}`, idioma)
      : v.limiar_superior !== null
        ? igual
          ? tx(`alerta com ${f(v.limiar_superior)}`, `alert at ${f(v.limiar_superior)}`, idioma)
          : tx(`alerta acima de ${f(v.limiar_superior)}`, `alert above ${f(v.limiar_superior)}`, idioma)
        : v.limiar_inferior !== null
          ? tx(`alerta abaixo de ${f(v.limiar_inferior)}`, `alert below ${f(v.limiar_inferior)}`, idioma)
          : tx("sem limiar numérico", "no numeric threshold", idioma);
  return `${f(v.valor)} (${lim})`;
}

export function colunasRegras(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const dias = tx("dias", "days", idioma);
  return [
    { id: "titulo", rotulo: tx("Regra", "Rule", idioma), tipo: "texto" },
    { id: "assunto", rotulo: tx("Assunto", "Subject", idioma), tipo: "texto", categorica: true },
    { id: "estado", rotulo: tx("Estado", "State", idioma), tipo: "texto", categorica: true },
    { id: "referencia", rotulo: tx("Referência", "Reference", idioma), tipo: "data" },
    { id: "valor", rotulo: tx("Valor avaliado", "Value assessed", idioma), tipo: "numero", casas: 2 }, // i18n: dado (o id da coluna)
    { id: "limiar_inferior", rotulo: tx("Limiar inferior", "Lower threshold", idioma), tipo: "numero", casas: 2 },
    { id: "limiar_superior", rotulo: tx("Limiar superior", "Upper threshold", idioma), tipo: "numero", casas: 2 },
    { id: "unidade", rotulo: tx("Unidade", "Unit", idioma), tipo: "texto" },
    { id: "duracao", rotulo: tx("Duração mínima", "Minimum duration", idioma), tipo: "numero", unidade: dias, casas: 0 },
    { id: "retorno", rotulo: tx("Retorno", "Return", idioma), tipo: "numero", unidade: dias, casas: 0 },
    { id: "desde", rotulo: tx("Avaliável desde", "Assessable since", idioma), tipo: "data" }, // i18n: dado (o id da coluna)
    { id: "dias_avaliados", rotulo: tx("Dias avaliados", "Days assessed", idioma), tipo: "numero", casas: 0 },
    { id: "pct_condicao", rotulo: tx("Dias com a condição", "Days with the condition", idioma), tipo: "percentual", casas: 1 },
    { id: "pct_alerta", rotulo: tx("Dias em alerta", "Days in alert", idioma), tipo: "percentual", casas: 1 },
    { id: "episodios", rotulo: tx("Episódios", "Episodes", idioma), tipo: "numero", casas: 0 },
    { id: "por_ano", rotulo: tx("Episódios por ano", "Episodes per year", idioma), tipo: "numero", casas: 1 },
    { id: "descartados", rotulo: tx("Acionamentos curtos descartados", "Short triggers discarded", idioma), tipo: "numero", casas: 0 },
  ];
}

export const COLUNAS_REGRAS: ColunaTabela[] = colunasRegras("pt");

/** Assunto de uma regra na tabela: o evento de calendário, a regra sobre o sistema ou sobre os dados. */
function assuntoRegra(o: Pick<RegraObservar, "tipo" | "assunto">, idioma: Idioma): string {
  if (o.tipo === "evento") return tx("evento", "event", idioma);
  return o.assunto === "sistema" ? tx("sistema", "system", idioma) : tx("dados", "data", idioma);
}

/** Tabela equivalente da lista de regras: estado do dia, limiares e frequência de disparo. */
export function linhasRegras(observar: readonly RegraObservar[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return observar.map((o) => ({
    id: o.id,
    titulo: gold(o.titulo, idioma),
    assunto: assuntoRegra(o, idioma),
    estado: rotuloEstado(o.estado, idioma),
    referencia: o.referencia,
    valor: o.valor?.valor ?? null,
    limiar_inferior: o.valor?.limiar_inferior ?? null,
    limiar_superior: o.valor?.limiar_superior ?? null,
    unidade: gold(o.unidade, idioma),
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

export function colunasSensibilidade(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "regra", rotulo: tx("Regra", "Rule", idioma), tipo: "texto", categorica: true },
    { id: "duracao", rotulo: tx("Duração mínima", "Minimum duration", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
    { id: "adotada", rotulo: tx("Adotada", "Adopted", idioma), tipo: "texto", categorica: true },
    { id: "episodios", rotulo: tx("Episódios", "Episodes", idioma), tipo: "numero", casas: 0 },
    { id: "dias", rotulo: tx("Dias em alerta", "Days in alert", idioma), tipo: "numero", casas: 0 }, // i18n: dado (o id da coluna)
    { id: "pct", rotulo: tx("Dias em alerta", "Days in alert", idioma), tipo: "percentual", casas: 1 },
    { id: "por_ano", rotulo: tx("Episódios por ano", "Episodes per year", idioma), tipo: "numero", casas: 1 },
  ];
}

export const COLUNAS_SENSIBILIDADE: ColunaTabela[] = colunasSensibilidade("pt");

/** Sensibilidade de cada regra a durações mínimas de 1, 3, 7 e 14 dias. */
export function linhasSensibilidade(observar: readonly RegraObservar[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return observar.flatMap((o) =>
    (o.historico?.sensibilidade_duracao ?? []).map((s) => ({
      id: `${o.id}:${s.duracao_minima_dias}`,
      regra: gold(o.titulo, idioma),
      duracao: s.duracao_minima_dias,
      adotada: s.duracao_minima_dias === o.duracao_minima_dias ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
      episodios: s.episodios,
      dias: s.dias_exibidos,
      pct: s.pct_dias_exibidos,
      por_ano: s.por_ano,
    })),
  );
}

export function colunasEpisodios(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "regra", rotulo: tx("Regra", "Rule", idioma), tipo: "texto", categorica: true },
    { id: "inicio", rotulo: tx("Início da condição", "Start of the condition", idioma), tipo: "data" },
    { id: "confirmado_em", rotulo: tx("Alerta confirmado em", "Alert confirmed on", idioma), tipo: "data" },
    { id: "fim", rotulo: tx("Último dia com a condição", "Last day with the condition", idioma), tipo: "data" },
    { id: "normalizado_em", rotulo: tx("Normalizado em", "Back to normal on", idioma), tipo: "data" },
    { id: "dias_condicao", rotulo: tx("Dias com a condição", "Days with the condition", idioma), tipo: "numero", casas: 0 },
    { id: "duracao", rotulo: tx("Duração", "Duration", idioma), tipo: "numero", unidade: tx("dias", "days", idioma), casas: 0 },
    { id: "em_curso", rotulo: tx("Em curso", "Ongoing", idioma), tipo: "texto", categorica: true },
  ];
}

export const COLUNAS_EPISODIOS: ColunaTabela[] = colunasEpisodios("pt");

/** Últimos episódios publicados de cada regra. */
export function linhasEpisodios(observar: readonly RegraObservar[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return observar.flatMap((o) =>
    (o.historico?.ultimos_episodios ?? []).map((e) => ({
      id: `${o.id}:${e.inicio}`,
      regra: gold(o.titulo, idioma),
      inicio: e.inicio,
      confirmado_em: e.confirmado_em,
      fim: e.fim,
      normalizado_em: e.normalizado_em,
      dias_condicao: e.dias_condicao,
      duracao: e.duracao_dias,
      em_curso: e.em_curso ? tx("sim", "yes", idioma) : tx("não", "no", idioma),
    })),
  );
}

export function colunasAlternativas(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  return [
    { id: "regra", rotulo: tx("Regra", "Rule", idioma), tipo: "texto", categorica: true },
    { id: "condicao", rotulo: tx("Variante avaliada", "Variant assessed", idioma), tipo: "texto" },
    { id: "pct", rotulo: tx("Dias em alerta", "Days in alert", idioma), tipo: "percentual", casas: 1 },
    { id: "episodios", rotulo: tx("Episódios", "Episodes", idioma), tipo: "numero", casas: 0 },
    { id: "desde", rotulo: tx("Avaliável desde", "Assessable since", idioma), tipo: "data" }, // i18n: dado (o id da coluna)
    { id: "motivo", rotulo: tx("Por que não foi adotada", "Why it was not adopted", idioma), tipo: "texto" },
  ];
}

export const COLUNAS_ALTERNATIVAS: ColunaTabela[] = colunasAlternativas("pt");

/** Variantes rejeitadas de cada regra, com a frequência que teriam. */
export function linhasAlternativas(observar: readonly RegraObservar[], idioma: Idioma = idiomaEnergia()): LinhaTabela[] {
  return observar.flatMap((o) =>
    (o.alternativas_avaliadas ?? [])
      .filter((a) => !a.adotada)
      .map((a) => ({
        id: `${o.id}:${a.id}`,
        regra: gold(o.titulo, idioma),
        condicao: gold(a.condicao, idioma),
        pct: a.pct_dias_exibidos,
        episodios: a.episodios,
        desde: a.primeiro_dia_avaliado,
        motivo: a.motivo ? gold(a.motivo, idioma) : a.motivo,
      })),
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
export function textoLinhaEstado(o: Pick<RegraObservar, "linha_estado">, idioma: Idioma = idiomaEnergia()): string | null {
  const le = o.linha_estado;
  if (!le?.inicio || !le.estados) return null;
  const c = contagemEstados(le);
  const fim = somaDias(le.inicio, le.estados.length - 1);
  const partes = tx(
    [
      c["A"] ? `${plural(c["A"], "dia", "dias", "pt")} com alerta exibido` : "nenhum dia com alerta exibido",
      c["o"] ? `${plural(c["o"], "dia", "dias", "pt")} com a condição sem a duração mínima` : null,
      c["."] ? `${plural(c["."], "dia normal", "dias normais", "pt")}` : null,
      c["-"] ? `${plural(c["-"], "dia", "dias", "pt")} sem dado` : null,
    ],
    [
      c["A"] ? `${plural(c["A"], "day", "days", "en")} with an alert displayed` : "no day with an alert displayed",
      c["o"] ? `${plural(c["o"], "day", "days", "en")} with the condition but without the minimum duration` : null,
      c["."] ? `${plural(c["."], "normal day", "normal days", "en")}` : null,
      c["-"] ? `${plural(c["-"], "day", "days", "en")} with no data` : null,
    ],
    idioma,
  ).filter(Boolean);
  return tx(
    `De ${dataBR(le.inicio, "pt")} a ${dataBR(fim, "pt")}: ${partes.join(", ")}.`,
    `From ${dataBR(le.inicio, "en")} to ${dataBR(fim, "en")}: ${partes.join(", ")}.`,
    idioma,
  );
}

/** Frequência conjunta da caixa de destaques em uma frase, com a meta de materialidade. */
export function textoFrequenciaConjunta(g: Pick<SinteseVisaoGold, "destaques">, idioma: Idioma = idiomaEnergia()): string | null {
  const f = g.destaques.frequencia_conjunta;
  if (!f) return null;
  const pc = f.periodo_comum;
  const ini = dataBR(pc.inicio, idioma);
  const fim = dataBR(pc.fim, idioma);
  return tx(
    `No período em que todas as regras sobre o sistema são avaliáveis (${ini} a ${fim}), a caixa de destaques teria ficado ocupada em ` +
      `${num(pc.dias_com_destaque, 0, "pt")} de ${num(pc.dias, 0, "pt")} dias (${num(pc.pct_dias_com_destaque, 1, "pt")}%); a meta é no máximo ${num(f.meta_pct, 1, "pt")}%` +
      `${f.atende_meta ? ", cumprida" : ", não cumprida"}. O limite de novidade é de ${plural(f.novidade_dias, "dia", "dias", "pt")} depois da confirmação.`,
    `In the period in which all rules about the system are assessable (${ini} to ${fim}), the highlights box would have been filled on ` +
      `${num(pc.dias_com_destaque, 0, "en")} of ${num(pc.dias, 0, "en")} days (${num(pc.pct_dias_com_destaque, 1, "en")}%); the target is at most ${num(f.meta_pct, 1, "en")}%` +
      `${f.atende_meta ? ", met" : ", not met"}. The novelty limit is ${plural(f.novidade_dias, "day", "days", "en")} after confirmation.`,
    idioma,
  );
}

/* ---------------------------------------------------------------- conciliações no ponto de uso (r8) */

const sinal = (v: number, idioma: Idioma) => (v >= 0 ? tx("acima", "above", idioma) : tx("abaixo", "below", idioma));

/**
 * Carga contra o ano anterior em duas janelas: a frase do P004 compara a média dos 7 dias com as mesmas datas do ano
 * anterior; o painel de determinantes compara o dia com o mesmo dia da semana, 364 dias antes. Lê os dois números da gold
 * (frase `carga` e painel `carga`) e as datas de cada janela; não recalcula nenhum percentual.
 */
export function notaCarga(g: Pick<SinteseVisaoGold, "frases" | "multiplos">, idioma: Idioma = idiomaEnergia()): string | null {
  const f = g.frases.find((x) => x.id === "carga");
  const m = g.multiplos;
  const p = m?.paineis.find((x) => x.id === "carga");
  const v7 = f?.valores.variacao_pct?.valor;
  const [atual, anterior] = f?.qualidade.janelas ?? [];
  if (!f || !m || !p || typeof v7 !== "number" || !atual || !anterior) return null;
  const pos = posicaoDeterminante(p, m);
  if (pos.variacao_pct === null) return null;
  const dia = p.data_referencia;
  const d = (x: string) => dataBR(x, idioma);
  const v = (x: number) => `${num(Math.abs(x), 1, idioma)}% ${sinal(x, idioma)}`;
  return tx(
    `A carga aparece contra o ano anterior de duas formas: a média dos 7 dias de ${d(atual.inicio)} a ${d(atual.fim)}, contra ${d(anterior.inicio)} a ${d(anterior.fim)}, ficou ${v(v7)}; ` +
      `o dia ${d(dia)}, contra o mesmo dia da semana (${d(somaDias(dia, -364))}), ficou ${v(pos.variacao_pct)}. ` +
      `A janela e o dia de comparação são diferentes, e por isso os dois percentuais não precisam coincidir.`,
    `Load appears against the previous year in two ways: the 7-day average from ${d(atual.inicio)} to ${d(atual.fim)}, versus ${d(anterior.inicio)} to ${d(anterior.fim)}, was ${v(v7)}; ` +
      `the day ${d(dia)}, versus the same weekday (${d(somaDias(dia, -364))}), was ${v(pos.variacao_pct)}. ` +
      `The comparison window and day are different, so the two percentages need not match.`,
    idioma,
  );
}

/**
 * Rede: a frase do P004 traz a média de 30 dias da fronteira de maior fluxo; o painel de determinantes, o fluxo médio de um
 * dia. Só escreve a nota quando as duas leituras são da mesma fronteira (o par da frase está no caminho do valor do painel).
 */
export function notaRede(g: Pick<SinteseVisaoGold, "frases" | "multiplos">, idioma: Idioma = idiomaEnergia()): string | null {
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
  const d = (x: string) => dataBR(x, idioma);
  return tx(
    `Na fronteira ${nome}, a frase de Rede traz a média dos 30 dias de ${d(ini)} a ${d(fim)} (${comUnidade(media, "MWmed", 0, idioma)}) e o gráfico de Rede traz o fluxo médio do dia ${d(p.data_referencia)} (${comUnidade(dia, "MWmed", 0, idioma)}). ` +
      `Média de 30 dias e valor de um dia não precisam coincidir.`,
    `On the ${fronteiraEn(nome)} border, the Grid sentence has the 30-day average from ${d(ini)} to ${d(fim)} (${comUnidade(media, "MWmed", 0, idioma)}) and the Grid chart has the average flow of the day ${d(p.data_referencia)} (${comUnidade(dia, "MWmed", 0, idioma)}). ` +
      `A 30-day average and a single day's value need not match.`,
    idioma,
  );
}

/** Mês de uma série mensal do módulo de Inclusão (inclusao.json, tarifa_social.serie_mensal), com a completude que o módulo publica. */
export type MesSerieTarifaSocial = { m: string; completo: boolean; distribuidoras?: number; distribuidoras_faltantes?: number };

/**
 * Tarifa Social: o cartão usa o último mês completo do arquivo do SCS e a regra de atualidade usa o último mês do arquivo,
 * que pode estar incompleto. Escreve a ponte entre os dois meses; sem divergência, devolve null.
 */
export function notaTarifaSocial(it: Pick<ItemSociedade, "periodo" | "atualidade">, serie: readonly MesSerieTarifaSocial[] | null | undefined, idioma: Idioma = idiomaEnergia()): string | null {
  const ultimo = it.atualidade?.ultimo_periodo;
  const ref = it.periodo.fim.slice(0, 7);
  if (!ultimo || ultimo.slice(0, 7) === ref) return null;
  const mes = (serie ?? []).find((x) => x.m === ultimo.slice(0, 7));
  const base = tx(
    `O número é de ${mesAno(ref, "pt")}, o último mês completo do arquivo da ANEEL; o conjunto chega a ${mesAno(ultimo.slice(0, 7), "pt")}, e é esse último mês que a regra de atualidade usa para dizer que a fonte está atrasada.`,
    `The number is for ${mesAno(ref, "en")}, the latest complete month in the ANEEL file; the dataset reaches ${mesAno(ultimo.slice(0, 7), "en")}, and it is this latest month that the timeliness rule uses to say that the source is late.`,
    idioma,
  );
  if (mes && !mes.completo && typeof mes.distribuidoras_faltantes === "number")
    return tx(
      `${base} ${mesAno(mes.m, "pt")} não entra no número porque está incompleto: ${plural(mes.distribuidoras_faltantes, "distribuidora esperada não informou", "distribuidoras esperadas não informaram", "pt")} nesse mês.`,
      `${base} ${mesAno(mes.m, "en")} is not part of the number because it is incomplete: ${plural(mes.distribuidoras_faltantes, "expected distribution utility did not report", "expected distribution utilities did not report", "en")} in that month.`,
      idioma,
    );
  return base;
}

/** Semana do CMO semanal do ONS por subsistema (cmo.json, serie). */
export type SemanaCmo = { s: string; SE: number; S: number; NE: number; N: number };

/**
 * CMO semanal: o Norte difere de cada um dos outros três subsistemas na semana de referência. Lê a série publicada e conta há
 * quantas semanas seguidas isso acontece, para o leitor ver que não é um valor isolado nem de outra semana. A causa não está
 * no dado: a nota diz isso.
 */
export function notaCmoNorte(serie: readonly SemanaCmo[] | null | undefined, referencia: string, idioma: Idioma = idiomaEnergia()): string | null {
  const ate = (serie ?? []).filter((x) => x.s <= referencia);
  const ult = ate[ate.length - 1];
  if (!ult || ult.s !== referencia) return null;
  const difere = (x: SemanaCmo) => [x.SE, x.S, x.NE].every((v) => Math.abs(x.N - v) > 0.005);
  if (!difere(ult)) return null;
  let n = 0;
  for (let i = ate.length - 1; i >= 0 && difere(ate[i]); i--) n++;
  const outros = listaNoIdioma(
    Array.from(new Set([ult.SE, ult.S, ult.NE])).map((v) => comUnidade(v, "R$/MWh", 2, idioma)),
    idioma,
  );
  const desde = n < 2 ? "" : dataBR(ate[ate.length - n].s, idioma);
  const quando =
    n < 2
      ? ""
      : tx(
          `, e a série semanal do ONS mostra essa diferença em ${plural(n, "semana seguida", "semanas seguidas", "pt")}, desde a semana de ${desde}`,
          `, and the ONS weekly series shows this difference for ${plural(n, "consecutive week", "consecutive weeks", "en")}, since the week of ${desde}`,
          idioma,
        );
  return tx(
    `Na semana de ${dataBR(ult.s, "pt")}, o Norte (${comUnidade(ult.N, "R$/MWh", 2, idioma)}) difere de cada um dos outros três subsistemas (${outros})${quando}. O dado do ONS não informa o motivo, e o observatório não o atribui.`,
    `In the week of ${dataBR(ult.s, "en")}, the North (${comUnidade(ult.N, "R$/MWh", 2, idioma)}) differs from each of the other three subsystems (${outros})${quando}. The ONS data does not state the reason, and the observatory does not attribute one.`,
    idioma,
  );
}

/**
 * Aviso de um complemento sem o bastidor de coleta: o parêntese com o nome de campo da fonte (NumCon) sai do texto do
 * leitor e fica inteiro no detalhe, que a página põe em Analisar. O leitor lê a mesma exclusão em palavras comuns.
 */
export function avisoSemBastidor(aviso: string, idioma: Idioma = idiomaEnergia()): { leitor: string; detalhe: string } {
  const m = /\s*\(([^()]*NumCon[^()]*)\)/.exec(aviso);
  if (!m) return { leitor: aviso, detalhe: "" };
  // o aviso chega em português da gold ou já na forma inglesa (traduzModeloDaGold): o nome da distribuidora sai de qualquer um dos dois
  const quem = (/NumCon implausível de ([^;)]+)/.exec(m[1]) ?? /implausible NumCon from ([^;)]+)/.exec(m[1]))?.[1]?.trim();
  const leitor = aviso.replace(
    m[0],
    tx(
      ` (o número de unidades consumidoras informado${quem ? ` por ${quem}` : ""} não é plausível)`,
      ` (the number of consumer units reported${quem ? ` by ${quem}` : ""} is not plausible)`,
      idioma,
    ),
  );
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
export function corteEpisodios(
  observar: readonly Pick<RegraObservar, "historico">[],
  inicioHistorico: string,
  idioma: Idioma = idiomaEnergia(),
): { listados: number; total: number; porRegra: number; texto: string } {
  const comHistorico = observar.filter((o) => o.historico);
  const listados = comHistorico.reduce((s, o) => s + (o.historico?.ultimos_episodios.length ?? 0), 0);
  const total = comHistorico.reduce((s, o) => s + (o.historico?.episodios ?? 0), 0);
  const porRegra = comHistorico.reduce((m, o) => Math.max(m, o.historico?.ultimos_episodios.length ?? 0), 0);
  const n = (x: number) => num(x, 0, idioma);
  const desde = dataBR(inicioHistorico, idioma);
  const texto =
    listados >= total
      ? tx(`A tabela lista todos os ${n(total)} episódios registrados desde ${desde}.`, `The table lists all ${n(total)} episodes recorded since ${desde}.`, idioma)
      : tx(
          `A tabela lista os últimos ${n(porRegra)} episódios de cada regra: ${n(listados)} dos ${n(total)} registrados desde ${desde}. A lista completa está no arquivo de episódios das regras (CSV).`,
          `The table lists the last ${n(porRegra)} episodes of each rule: ${n(listados)} of the ${n(total)} recorded since ${desde}. The full list is in the rule episodes file (CSV).`,
          idioma,
        );
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
export function periodoDaJanela(linhas: readonly Pick<LinhaMultiplos, "d">[], idioma: Idioma = idiomaEnergia()): string {
  if (!linhas.length) return tx("sem dia na janela", "no day in the window", idioma);
  const ini = dataBR(linhas[0].d, idioma);
  const fim = dataBR(linhas[linhas.length - 1].d, idioma);
  return tx(
    `${ini} a ${fim} (${plural(linhas.length, "dia", "dias", "pt")} alinhados pelo calendário); cada gráfico termina na data de referência da sua fonte`,
    `${ini} to ${fim} (${plural(linhas.length, "day", "days", "en")} aligned by calendar); each chart ends on the reference date of its source`,
    idioma,
  );
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

const reaisMwh = (v: number, idioma: Idioma) => `R$ ${num(v, 2, idioma)}/MWh`;

/** O mesmo mês nos anos anteriores: a referência sazonal do PLD (pld_detalhe.json, historico.posicao_referencia). */
export type PosicaoPldSazonal = { mes: number; percentil: number | null; n_dias: number; p50: number | null; anos: readonly number[] };

/**
 * "percentil 38,7 entre as 150 médias diárias de setembro de 2021 a 2025 (mediana R$ 247,81/MWh)"; null sem percentil. Em inglês,
 * "of September 2021 to 2025": o mês colado ao ano, como no português, para os dois idiomas contarem os mesmos números.
 */
export function textoSazonalPld(s: PosicaoPldSazonal, idioma: Idioma = idiomaEnergia()): string | null {
  if (s.percentil === null) return null;
  const mes = s.mes >= 1 && s.mes <= 12 ? nomeMes(s.mes, idioma, true) : undefined;
  const anos =
    s.anos.length > 1
      ? tx(` de ${s.anos[0]} a ${s.anos[s.anos.length - 1]}`, ` ${s.anos[0]} to ${s.anos[s.anos.length - 1]}`, idioma)
      : s.anos.length === 1
        ? tx(` de ${s.anos[0]}`, ` ${s.anos[0]}`, idioma)
        : "";
  const mediana = s.p50 === null ? "" : tx(`, mediana ${reaisMwh(s.p50, idioma)}`, `, median ${reaisMwh(s.p50, idioma)}`, idioma);
  return tx(
    `percentil ${num(s.percentil, 1, idioma)} entre as ${num(s.n_dias, 0, idioma)} médias diárias de ${mes}${anos}${mediana}`,
    `percentile ${num(s.percentil, 1, idioma)} among the ${num(s.n_dias, 0, idioma)} daily averages of ${mes}${anos}${mediana}`,
    idioma,
  );
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
}, idioma: Idioma = idiomaEnergia()): string | null {
  const sazonal = a.sazonal ? textoSazonalPld(a.sazonal, idioma) : null;
  if (a.percentilTodos === null) return null;
  const pisoMin = a.pisos.length ? num(Math.min(...a.pisos), 2, idioma) : "";
  const pisoMax = a.pisos.length ? reaisMwh(Math.max(...a.pisos), idioma) : "";
  const piso = a.pisos.length
    ? tx(
        ` Os dois critérios juntam anos com limites regulatórios diferentes: o piso foi de R$ ${pisoMin} a ${pisoMax} entre ${a.anoInicial} e ${a.anoFinal}.`,
        ` Both criteria combine years with different regulatory limits: the floor ranged from R$ ${pisoMin} to ${pisoMax} between ${a.anoInicial} and ${a.anoFinal}.`,
        idioma,
      )
    : "";
  return tx(
    `Dois critérios para a mesma média de ${reaisMwh(a.media, idioma)}: a frase compara com as ${num(a.diasTodos, 0, idioma)} médias diárias nominais desde 2021, de todos os meses, e dá percentil ${num(a.percentilTodos, 1, idioma)}` +
      `${sazonal ? `; a referência sazonal da página de PLD compara com o mesmo mês dos anos anteriores e dá ${sazonal}` : ""}.${piso}`,
    `Two criteria for the same average of ${reaisMwh(a.media, idioma)}: the sentence compares it with the ${num(a.diasTodos, 0, idioma)} nominal daily averages since 2021, of all months, and gives percentile ${num(a.percentilTodos, 1, idioma)}` +
      `${sazonal ? `; the seasonal reference of the PLD page compares it with the same month of previous years and gives ${sazonal}` : ""}.${piso}`,
    idioma,
  );
}

/** EAR do SIN e capacidade: a faixa do mesmo dia está em % da EAR máxima de cada ano, e a EAR máxima mudou ao longo da base. */
export function textoCapacidadeAgua(a: { periodoBase: string | null; minMwmes: number | null; maxMwmes: number | null; mudou: boolean }, idioma: Idioma = idiomaEnergia()): string | null {
  if (!a.mudou || a.minMwmes === null || a.maxMwmes === null || a.maxMwmes <= 0) return null;
  const queda = (100 * (a.maxMwmes - a.minMwmes)) / a.maxMwmes;
  const base = a.periodoBase ? tx(` de ${a.periodoBase.replace("-", " a ")}`, ` from ${a.periodoBase.replace("-", " to ")}`, idioma) : "";
  return tx(
    `A faixa e a mediana comparam anos${base} em % da EAR máxima de cada época, e a EAR máxima do SIN variou de ${num(a.minMwmes, 0, idioma)} a ${num(a.maxMwmes, 0, idioma)} MWmês nesse período (a menor ${num(queda, 1, idioma)}% abaixo da maior): o mesmo percentual em épocas diferentes não é a mesma energia.`,
    `The range and the median compare years${base} as % of the maximum EAR of each period, and the SIN maximum EAR ranged from ${num(a.minMwmes, 0, idioma)} to ${num(a.maxMwmes, 0, idioma)} MWmonth over that period (the smallest ${num(queda, 1, idioma)}% below the largest): the same percentage in different periods is not the same energy.`,
    idioma,
  );
}

/** A EAR que o módulo Água e clima mostra, quando o dia dele não é o da Visão geral: cada página diz o dia que usa. */
export function textoEarNoModulo(a: { diaVisao: string; diaModulo: string | null; pctModulo: number | null }, idioma: Idioma = idiomaEnergia()): string | null {
  if (a.diaModulo === null || a.pctModulo === null || a.diaModulo === a.diaVisao) return null;
  return tx(
    `A página Água e clima, de outra captura do ONS, traz ${num(a.pctModulo, 1, idioma)}% em ${dataBR(a.diaModulo, idioma)}.`,
    `The Water and climate page, from another ONS capture, shows ${num(a.pctModulo, 1, idioma)}% on ${dataBR(a.diaModulo, idioma)}.`,
    idioma,
  );
}

/** A carga nos dois cortes: o que esta página usa na frase e o padrão da página Carga, com os dois percentuais na mesma casa. */
export function textoCargaNoModulo(
  a: { mesmasDatasPct: number | null; mesmosDiasDaSemanaPct: number | null; mesmosDiasDaSemanaInicio: string | null; mesmosDiasDaSemanaFim: string | null },
  idioma: Idioma = idiomaEnergia(),
): string | null {
  if (a.mesmasDatasPct === null || a.mesmosDiasDaSemanaPct === null) return null;
  const ini = a.mesmosDiasDaSemanaInicio ? dataBR(a.mesmosDiasDaSemanaInicio, idioma) : "";
  const fim = a.mesmosDiasDaSemanaFim ? dataBR(a.mesmosDiasDaSemanaFim, idioma) : "";
  const periodo = a.mesmosDiasDaSemanaInicio && a.mesmosDiasDaSemanaFim ? tx(` (${ini} a ${fim})`, ` (${ini} to ${fim})`, idioma) : "";
  const direcao = (v: number) => (v >= 0 ? tx("alta", "an increase", idioma) : tx("queda", "a decrease", idioma));
  const p = (v: number) => num(Math.abs(v), 2, idioma);
  return tx(
    `Na página Carga, a comparação padrão é com os mesmos dias da semana, 52 semanas antes${periodo}: ${direcao(a.mesmosDiasDaSemanaPct)} de ${p(a.mesmosDiasDaSemanaPct)}%. Esta página usa as mesmas datas do ano anterior, que na Carga dão ${direcao(a.mesmasDatasPct)} de ${p(a.mesmasDatasPct)}%.`,
    `On the Load page, the default comparison is with the same weekdays, 52 weeks earlier${periodo}: ${direcao(a.mesmosDiasDaSemanaPct)} of ${p(a.mesmosDiasDaSemanaPct)}%. This page uses the same dates of the previous year, which on the Load page give ${direcao(a.mesmasDatasPct)} of ${p(a.mesmasDatasPct)}%.`,
    idioma,
  );
}

/** Horas do dia em que o fluxo da fronteira foi contra o sentido do saldo líquido (o saldo as compensa). */
export function horasContraOSaldo(c: { liquido_mwh: readonly (number | null)[]; horas: readonly (number | null)[]; horas_inverso: readonly (number | null)[] }, i: number): number | null {
  const liq = c.liquido_mwh[i];
  const h = c.horas[i];
  const inv = c.horas_inverso[i];
  if (liq === null || liq === undefined || h === null || h === undefined || inv === null || inv === undefined) return null;
  return liq >= 0 ? inv : h - inv;
}

/**
 * Dia cujo saldo líquido a Visão geral mostra. O módulo Rede só detalha hora a hora os dias com as 24 horas verificadas
 * (`dias`, em ordem crescente). Se o dia apontado pela Visão geral está detalhado, é ele. Se a Visão geral já aponta um dia
 * posterior ao último detalhado (21/10/2026: gold retida com o saldo vazio), o saldo é o do último dia detalhado, dito com as
 * duas datas pelo chamador. Se o dia apontado é anterior ao último detalhado e não está na lista (síntese retida mais antiga
 * que a janela do módulo), não há saldo honesto a mostrar: o retorno é nulo, nunca o saldo de um dia posterior ao cartão.
 */
export function diaDoSaldoRede(diaVisao: string | null, dias: readonly string[]): string | null {
  if (!diaVisao || dias.length === 0) return null;
  if (dias.includes(diaVisao)) return diaVisao;
  const ultimo = dias[dias.length - 1];
  return diaVisao > ultimo ? ultimo : null;
}

/** Saldo líquido do dia e as horas contra o saldo em cada fronteira, com a ligação para a página Rede escrita pelo componente. */
export function textoSaldoLiquidoRede(
  a: { dia: string; fronteiras: readonly { rotulo: string; horasContra: number | null; horas: number }[]; diaModulo: string | null; diaVisao?: string | null },
  idioma: Idioma = idiomaEnergia(),
): string {
  const listadas = a.fronteiras
    .filter((f) => f.horasContra !== null)
    .map((f) =>
      tx(
        `${f.rotulo}, ${num(f.horasContra as number, 0, "pt")} de ${num(f.horas, 0, "pt")}`,
        `${fronteiraEn(f.rotulo)}, ${num(f.horasContra as number, 0, "en")} of ${num(f.horas, 0, "en")}`,
        idioma,
      ),
    );
  const horas = listadas.length
    ? tx(` Horas do dia em que o fluxo foi contra o sentido do saldo: ${listadas.join("; ")}.`, ` Hours of the day in which the flow ran against the direction of the balance: ${listadas.join("; ")}.`, idioma)
    : "";
  const outroDia = a.diaModulo ? dataBR(a.diaModulo, idioma) : "";
  const modulo = a.diaModulo && a.diaModulo !== a.dia ? tx(` A página Rede traz também ${outroDia}.`, ` The Grid page also shows ${outroDia}.`, idioma) : "";
  // a Visão geral já aponta um dia que o módulo Rede ainda não detalha hora a hora: o saldo é do último dia detalhado, e isso fica dito
  const visao = a.diaVisao
    ? tx(
        ` O cartão desta página aponta ${dataBR(a.diaVisao, "pt")}, dia que a página Rede ainda não detalha hora a hora; o saldo acima é o do último dia detalhado.`,
        ` The card on this page points to ${dataBR(a.diaVisao, "en")}, a day the Grid page does not yet detail hour by hour; the balance above is for the last detailed day.`,
        idioma,
      )
    : "";
  return tx(
    `Saldo líquido do dia ${dataBR(a.dia, "pt")}: a média das 24 horas do fluxo verificado em cada fronteira, positiva da primeira para a segunda ponta; as horas em sentido contrário ficam compensadas no saldo.${horas}${modulo}${visao}`,
    `Net balance of the day ${dataBR(a.dia, "en")}: the average of the 24 hours of verified flow on each border, positive from the first to the second end; the hours in the opposite direction are offset in the balance.${horas}${modulo}${visao}`,
    idioma,
  );
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
  idioma: Idioma = idiomaEnergia(),
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
  const colunasTabela = colunasMultiplos(exato, idioma);
  const base = periodoMediana ? ` (${periodoMediana})` : "";
  const extras: Partial<Record<IdPainelMultiplo, SerieExtra[]>> = temMediana ? { agua: [{ id: "agua_p50", rotulo: tx(`Mediana da data${base}`, `Median for the date${base}`, idioma) }] } : {};
  if (temMediana) {
    const i = colunasTabela.findIndex((c) => c.id === "agua_p10");
    const agua = paineis.find((p) => p.id === "agua");
    const col: ColunaTabela = {
      id: "agua_p50",
      rotulo: tx(`Água: mediana da data${base}`, `${agua?.titulo ?? "Water"}: median for the date${base}`, idioma),
      tipo: "numero",
      unidade: agua?.unidade,
      casas: agua?.casas ?? 1,
    };
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
    valorTexto: valorAtualTexto(p, idioma),
    rotuloValor: p.valor_atual.rotulo,
    leitura: leituraDeterminante(p, exato, idioma),
    defasagem: p.texto_defasagem,
    // sigla no primeiro uso: a nota do pipeline cita a MMGD sem dizer o que é
    nota: expandeSiglas(p.nota, ["MMGD"], idioma),

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
