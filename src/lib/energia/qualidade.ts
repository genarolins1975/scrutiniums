/**
 * Módulo Qualidade do serviço de distribuição (P051 a P054), lado da interface:
 * lógica pura, sem React, testada em node (src/tests/energia-qualidade.test.ts).
 *
 * O que fica aqui e por quê:
 *  - as respostas curtas e os textos de "o que mudou" de cada painel, montados por
 *    regra a partir dos números da gold (nenhuma frase traz número fixo; quando o
 *    número falta, a frase diz que falta e por quê);
 *  - as linhas que alimentam gráfico, tabela e exportação de cada painel: o gráfico,
 *    a tabela equivalente e o CSV saem da MESMA lista, então mostram as mesmas linhas;
 *  - a leitura dos arquivos de download (municípios e conjuntos), que a página só
 *    busca no navegador quando o mapa ou o explorador de conjuntos aparece (contrato,
 *    seção 5.1), e a conversão de horas decimais em horas e minutos.
 *
 * Nenhuma fórmula do indicador é refeita aqui: DEC, FEC, limites, razões, taxas e
 * compensações vêm prontos do pipeline (pipeline/energia/modulos/qualidade.py). As
 * únicas contas são de exibição: horas decimais em minutos (9,33 h são 9 h 20 min, nunca
 * 9 h 33 min), reais em milhões e classes de histograma de valores já publicados.
 */
import type { DistribuicaoHistograma } from "./distribuicao";
import { campo, tiposUrl, type Leitor } from "./estadoUrl";
import { dataBR, mesAno, num, pct } from "./formato";
import { LIMITE_COMPARACAO, type ColunaTabela, type LinhaTabela } from "./tabela";
import type {
  BrasilAnual,
  Conjuntos,
  Distribuidora,
  FaixaHistograma,
  GrupoParcela,
  ParcialAno,
  QualidadeGold,
  QualidadeSeriesDistribuidorasGold,
  Quantis,
  RelacaoMunicipio,
  TipoCompensacao,
} from "./tipos-qualidade";
import type { Proveniencia } from "./tipos";

/* ---------------------------------------------------------------- unidades */

/**
 * Horas decimais em horas e minutos: a ANEEL publica o DEC em horas e centésimos de
 * hora, então 9,33 h são 9 h e 0,33 × 60 = 19,8 min, arredondados para 20 min.
 * Ler "9,33" como 9 h 33 min é o erro que o critério de aceite do P051 proíbe.
 */
export function horasEMinutos(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h) || h < 0) return "sem dado";
  const total = Math.round(h * 60);
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas.toLocaleString("pt-BR")} h`;
  return `${horas.toLocaleString("pt-BR")} h ${minutos} min`;
}

/** Reais em milhões, com uma casa ("R$ 1.007,2 milhões"); ausência é "sem dado". */
export function reaisMilhoes(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  return `R$ ${num(v / 1e6, casas)} milhões`;
}

/** Comparação de dois números na precisão exibida: "abaixo", "acima" ou "igual". */
export function comparaNaPrecisao(a: number, b: number, casas: number): "abaixo" | "acima" | "igual" {
  const f = 10 ** casas;
  const x = Math.round(a * f);
  const y = Math.round(b * f);
  return x < y ? "abaixo" : x > y ? "acima" : "igual";
}

/** "vez" abaixo de 2 e "vezes" a partir de 2 (0,86 vez o limite; 2,5 vezes o limite). */
export function vezes(x: number): string {
  return Math.abs(x) >= 2 ? "vezes" : "vez";
}

/**
 * Cobertura (fração de 0 a 1) em percentual sem arredondar para 100%: 0,9996 vira
 * "99,96%", nunca "100,0%", que diria que ninguém ficou de fora.
 */
export function pctCobertura(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  const x = v * 100;
  for (const casas of [1, 2, 3]) {
    const t = pct(x, casas);
    if (x >= 100 || Math.round(x * 10 ** casas) < 100 * 10 ** casas) return t;
  }
  return pct(x, 3);
}

/** Lista em português: "a", "a e b", "a, b e c". */
export function listaPt(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Nome exibido de uma distribuidora: sigla publicada pela ANEEL; sem sigla, o nome do IASC; sem os dois, o CNPJ. */
export function rotuloDistribuidora(d: { sigla: string | null; nome_comercial?: string | null; cnpj: string }): string {
  return d.sigla ?? d.nome_comercial ?? `CNPJ ${d.cnpj}`;
}

/* ---------------------------------------------------------------- estado na URL */

const leitorCnpj: Leitor<string> = { ler: (b) => (/^\d{14}$/.test(b) ? b : undefined), escrever: (v) => v };
const leitorMunicipio: Leitor<string> = { ler: (b) => (/^\d{7}$/.test(b) ? b : undefined), escrever: (v) => v };

/**
 * `?dist=` guarda até quatro distribuidoras (CNPJ), a primeira em destaque. Os painéis
 * leem o mesmo parâmetro: escolher um ponto no gráfico de limites marca a mesma linha
 * nas tabelas, abre o histórico dela e entra na comparação dos pequenos múltiplos; o
 * voltar do navegador desfaz a escolha.
 */
export const CAMPO_DIST = campo(tiposUrl.lista(leitorCnpj, { max: LIMITE_COMPARACAO }), [] as string[], { param: "dist" });
/** `?mun=`: município escolhido no mapa (código IBGE de 7 dígitos), o mesmo na tabela e no histórico. */
export const CAMPO_MUN = campo(leitorMunicipio, "", { param: "mun" });

export const MEDIDAS_MAPA = ["dec_max", "dec_min", "fec_max", "fec_min"] as const;
export type MedidaMapa = (typeof MEDIDAS_MAPA)[number];
/** `?med=`: medida colorida no mapa municipal. */
export const CAMPO_MEDIDA = campo(tiposUrl.opcao(MEDIDAS_MAPA), "dec_max" as MedidaMapa, { param: "med" });

export const INDICADORES = ["dec", "fec"] as const;
export type Indicador = (typeof INDICADORES)[number];
/** `?ind=`: DEC ou FEC no painel de limites. */
export const CAMPO_IND = campo(tiposUrl.opcao(INDICADORES), "dec" as Indicador, { param: "ind" });

export const CLASSES = ["concessionaria", "permissionaria"] as const;
export type ClasseDistribuidora = (typeof CLASSES)[number];
/** `?cls=`: grupo de distribuidoras no gráfico de pontos (concessionárias ou permissionárias). */
export const CAMPO_CLASSE = campo(tiposUrl.opcao(CLASSES), "concessionaria" as ClasseDistribuidora, { param: "cls" });

/** Põe a distribuidora em destaque (primeira da lista), sem repetir e sem passar de quatro. */
export function destacar(lista: readonly string[], id: string): string[] {
  return [id, ...lista.filter((x) => x !== id)].slice(0, LIMITE_COMPARACAO);
}

/* ---------------------------------------------------------------- atalhos da gold */

export function anoBrasil(g: QualidadeGold, ano: number): BrasilAnual | null {
  return g.brasil.anual.find((a) => a.ano === ano) ?? null;
}

const ROTULO_UNIDADE: Record<Indicador, string> = { dec: "h", fec: "interrupções" };
export function unidadeIndicador(ind: Indicador): string {
  return ROTULO_UNIDADE[ind];
}

/* ---------------------------------------------------------------- atualidade */

/**
 * Aviso de fonte defasada. Os indicadores de continuidade têm frequência mensal; a
 * ANEEL republica o conjunto inteiro a cada mês. Mais de 60 dias entre a última
 * publicação da fonte e o processamento quer dizer que pelo menos uma publicação
 * mensal esperada não aconteceu: o painel continua com a última versão validada e diz
 * isso. Sem data de publicação informada pela fonte, não há aviso (nunca se usa a data
 * de captura no lugar).
 */
export function avisoDefasagem(publicadoEm: string | null, processadoEm: string, limiteDias = 60): string | null {
  if (!publicadoEm) return null;
  const dias = Math.floor((Date.parse(processadoEm) - Date.parse(publicadoEm)) / 86_400_000);
  if (!Number.isFinite(dias) || dias <= limiteDias) return null;
  return `A última publicação da ANEEL usada aqui é de ${dataBR(publicadoEm.slice(0, 10))}, ${dias} dias antes deste processamento: a fonte mensal deixou de publicar ao menos uma atualização esperada, e o painel mostra a última versão validada.`;
}

/** Período e defasagem da série mensal: último mês publicado e último mês nacional completo. */
export function textoAtualidade(g: QualidadeGold): string {
  const ult = g.brasil.mensal.at(-1);
  const incompletos = g.brasil.mensal.filter((m) => !m.completo && m.m > g.ultimo_mes_completo).map((m) => mesAno(m.m));
  const partes = [`Ano completo mais recente: ${g.ano_referencia}.`, `Último mês nacional completo: ${mesAno(g.ultimo_mes_completo)}.`];
  if (ult && ult.m > g.ultimo_mes_completo && incompletos.length) {
    partes.push(
      `A ANEEL já publicou ${listaPt(incompletos)}, mas sem todas as distribuidoras: ${incompletos.length === 1 ? "esse mês fica" : "esses meses ficam"} fora de totais e comparações até completar.`,
    );
  }
  return partes.join(" ");
}

/* ---------------------------------------------------------------- P051: duração e frequência */

/** P051: DEC e FEC do Brasil no ano de referência, os dois universos e o acumulado do ano corrente. */
export function respostaP051(g: QualidadeGold): string {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  if (!a || a.dec === null || a.fec === null) return `Sem DEC e FEC nacionais para ${ref}: o ano não tem os 12 meses nacionais completos publicados.`;
  const ant = anoBrasil(g, ref - 1);
  let comparacao = "";
  if (ant && ant.dec !== null && ant.fec !== null) {
    const sd = comparaNaPrecisao(a.dec, ant.dec, 2);
    const sf = comparaNaPrecisao(a.fec, ant.fec, 2);
    const rel = (s: "abaixo" | "acima" | "igual") => (s === "igual" ? "iguais às" : s === "abaixo" ? "abaixo das" : "acima das");
    comparacao =
      sd === sf
        ? `, ${rel(sd)} ${num(ant.dec, 2)} h e ${num(ant.fec, 2)} interrupções de ${ref - 1}`
        : `; a duração ficou ${rel(sd)} ${num(ant.dec, 2)} h de ${ref - 1} e a frequência ${rel(sf)} ${num(ant.fec, 2)} interrupções`;
  }
  const conc =
    a.dec_concessionarias !== null && a.fec_concessionarias !== null
      ? ` Só as concessionárias, o universo do número que a ANEEL divulga: ${num(a.dec_concessionarias, 2)} h e ${num(a.fec_concessionarias, 2)} interrupções.`
      : "";
  return (
    `Em ${ref}, cada unidade consumidora ficou em média ${num(a.dec, 2)} horas sem energia (${horasEMinutos(a.dec)}) ` +
    `e teve ${num(a.fec, 2)} interrupções, considerando todas as distribuidoras${comparacao}.${conc}${respostaParcial(g.parcial)}`
  );
}

/**
 * Veredito do P051: o DEC e o FEC do Brasil no ano de referência, com a comparação ao ano anterior (a mesma precisão da
 * resposta completa) e o limite de leitura: o número não inclui as interrupções que a regra exclui do apurado.
 */
export function vereditoP051(g: QualidadeGold): string {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  if (!a || a.dec === null || a.fec === null) return `Sem DEC e FEC nacionais para ${ref}: o ano não tem os 12 meses nacionais completos publicados.`;
  const ant = anoBrasil(g, ref - 1);
  let comparacao = "";
  if (ant && ant.dec !== null && ant.fec !== null) {
    const sd = comparaNaPrecisao(a.dec, ant.dec, 2);
    const sf = comparaNaPrecisao(a.fec, ant.fec, 2);
    const rel = (x: "abaixo" | "acima" | "igual") => (x === "igual" ? "igual ao" : x === "abaixo" ? "menor que o" : "maior que o");
    comparacao = sd === sf ? (sd === "igual" ? `, o mesmo de ${ref - 1}` : `, ${sd === "abaixo" ? "menos" : "mais"} que em ${ref - 1}`) : `; a duração ficou ${rel(sd)} de ${ref - 1} e a frequência ficou ${rel(sf)} dele`;
  }
  return `Em ${ref}, cada unidade consumidora ficou em média ${num(a.dec, 2)} horas sem energia (${horasEMinutos(a.dec)}) e teve ${num(a.fec, 2)} interrupções${comparacao}.${a.dec_todas_parcelas !== null ? " O número não inclui as interrupções que a regra exclui do apurado." : ""}`;
}

/** Acumulado do ano corrente: só meses nacionais completos nos dois anos; nunca comparado a ano cheio. */
export function respostaParcial(p: ParcialAno | null): string {
  if (!p || p.dec === null || p.dec_mesmos_meses_ano_anterior === null) return "";
  const meses = listaPt(p.meses_incluidos.map((m) => mesAno(m).slice(0, 3)));
  const s = comparaNaPrecisao(p.dec, p.dec_mesmos_meses_ano_anterior, 2);
  const fora = p.meses_excluidos.length ? ` (${listaPt(p.meses_excluidos.map((m) => mesAno(m.m)))} fora, incompleto)` : "";
  return ` Em ${p.ano}, somando ${meses}${fora}, foram ${num(p.dec, 2)} h, ${s === "igual" ? "iguais às" : s === "abaixo" ? "abaixo das" : "acima das"} ${num(p.dec_mesmos_meses_ano_anterior, 2)} h dos mesmos meses de ${p.ano - 1}.`;
}

/** P051, "o que mudou": a série longa e a parte expurgada do ano de referência. */
export function mudancaP051(g: QualidadeGold): string {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  const completos = g.brasil.anual.filter((x) => x.completo && x.dec !== null);
  if (!a || a.dec === null || !completos.length) return "Sem série anual completa publicada.";
  const maior = completos.reduce((m, x) => ((x.dec ?? -1) > (m.dec ?? -1) ? x : m));
  const expurgo =
    a.dec_todas_parcelas !== null
      ? ` Somando as interrupções que a regra exclui do apurado (emergência, dia crítico, origem externa e cortes pedidos pelo ONS), cada unidade ficou ${num(a.dec_todas_parcelas, 2)} h sem energia em ${ref}.`
      : "";
  return `De ${completos[0].ano} a ${ref}, o maior DEC apurado nacional foi o de ${maior.ano} (${num(maior.dec, 2)} h); ${ref} fechou com ${num(a.dec, 2)} h.${expurgo}`;
}

/** Linhas anuais do Brasil (2001 em diante): gráfico, tabela e exportação usam esta lista. */
export function linhasBrasilAnual(g: QualidadeGold): LinhaTabela[] {
  return g.brasil.anual
    .filter((a) => a.completo)
    .map((a) => ({
      ano: String(a.ano),
      dec: a.dec,
      dec_limite: a.dec_limite,
      fec: a.fec,
      fec_limite: a.fec_limite,
      dec_concessionarias: a.dec_concessionarias,
      fec_concessionarias: a.fec_concessionarias,
      dec_todas_parcelas: a.dec_todas_parcelas,
      ucs_media: a.ucs_media,
      conjuntos: a.conjuntos,
    }));
}

/** Meses do Brasil: o mês publicado antes de todas as distribuidoras enviarem fica fora do gráfico, com marca na tabela. */
export function linhasBrasilMensal(g: QualidadeGold): LinhaTabela[] {
  return g.brasil.mensal.map((m) => ({
    m: m.m,
    dec: m.completo ? m.dec : null,
    fec: m.completo ? m.fec : null,
    dec_publicado: m.dec,
    fec_publicado: m.fec,
    ucs: m.ucs,
    conjuntos: m.conjuntos,
    situacao: m.completo ? "completo" : "incompleto (envio parcial das distribuidoras)",
  }));
}

export const ORDEM_PARCELAS: GrupoParcela[] = ["apurado", "emergencia", "dia_critico", "externa", "ons"];
export const COR_PARCELA: Record<GrupoParcela, string> = {
  apurado: "var(--cor-energia)",
  emergencia: "var(--serie-termica)",
  dia_critico: "var(--serie-solar)",
  externa: "var(--serie-sm-se)",
  ons: "var(--serie-referencia)",
};
export const ROTULO_PARCELA_CURTO: Record<GrupoParcela, string> = {
  apurado: "Apurado (interna, IP + IND)",
  emergencia: "Situação de emergência",
  dia_critico: "Dia crítico",
  externa: "Origem externa",
  ons: "Corte pedido pelo ONS",
};

/** Parcelas do DEC nacional por ano (2010 em diante, quando a fonte publica a desagregação atual). */
export function linhasParcelas(g: QualidadeGold): LinhaTabela[] {
  return g.brasil.anual
    .filter((a) => a.completo && a.parcelas_dec)
    .map((a) => ({ ano: String(a.ano), ...a.parcelas_dec!, total: a.dec_todas_parcelas }));
}

/** Distribuidoras do ano de referência para a tabela do P051 (duração, frequência e expurgos). */
export function linhasDistribuidorasP051(g: QualidadeGold): LinhaTabela[] {
  return g.distribuidoras.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d),
    cnpj: d.cnpj,
    classificacao: d.classificacao ?? "sem classificação publicada",
    meses: d.meses,
    ucs: d.ucs,
    conjuntos: d.conjuntos,
    dec: d.dec,
    fec: d.fec,
    dec_todas: d.dec_todas_parcelas,
    pct_expurgado: d.pct_dec_expurgado,
    emergencia: d.parcelas_dec.emergencia,
    dia_critico: d.parcelas_dec.dia_critico,
    quebra: d.quebras_perimetro.length ? d.quebras_perimetro.map((q) => String(q.ano)).join(", ") : "nenhuma",
  }));
}

export const COLUNAS_DIST_P051: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "classificacao", rotulo: "Classificação", tipo: "texto", categorica: true },
  { id: "ucs", rotulo: "UCs (média do ano)", tipo: "numero", casas: 0 },
  { id: "conjuntos", rotulo: "Conjuntos", tipo: "numero", casas: 0 },
  { id: "meses", rotulo: "Meses publicados", tipo: "numero", casas: 0 },
  { id: "dec", rotulo: "DEC apurado", tipo: "numero", unidade: "h", casas: 2 },
  { id: "fec", rotulo: "FEC apurado", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "dec_todas", rotulo: "DEC de todas as origens", tipo: "numero", unidade: "h", casas: 2 },
  { id: "pct_expurgado", rotulo: "Parte expurgada do DEC", tipo: "percentual", casas: 1 },
  { id: "emergencia", rotulo: "DEC em emergência", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dia_critico", rotulo: "DEC em dia crítico", tipo: "numero", unidade: "h", casas: 2 },
  { id: "quebra", rotulo: "Quebra de perímetro (ano)", tipo: "texto" },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
];

/** As maiores distribuidoras em unidades consumidoras: seleção inicial dos pequenos múltiplos. */
export function maioresDistribuidoras(g: QualidadeGold, n = LIMITE_COMPARACAO): string[] {
  return [...g.distribuidoras]
    .filter((d) => d.ucs !== null)
    .sort((a, b) => (b.ucs ?? 0) - (a.ucs ?? 0) || (a.cnpj < b.cnpj ? -1 : 1))
    .slice(0, n)
    .map((d) => d.cnpj);
}

/**
 * Pequenos múltiplos: uma linha por ano com o DEC (ou FEC) e o limite de cada
 * distribuidora escolhida, nas colunas `<ind>_<cnpj>` e `lim_<cnpj>`. Ano sem valor
 * fica nulo (lacuna), nunca zero.
 */
export function linhasSerieDistribuidoras(serie: QualidadeSeriesDistribuidorasGold, cnpjs: readonly string[], ind: Indicador): LinhaTabela[] {
  const anos = new Set<number>();
  for (const c of cnpjs) for (const a of serie.distribuidoras[c]?.anos ?? []) anos.add(a);
  return Array.from(anos)
    .sort((a, b) => a - b)
    .map((ano) => {
      const l: LinhaTabela = { ano: String(ano) };
      for (const c of cnpjs) {
        const s = serie.distribuidoras[c];
        const i = s ? s.anos.indexOf(ano) : -1;
        l[`${ind}_${c}`] = i >= 0 ? s![ind][i] : null;
        l[`lim_${c}`] = i >= 0 ? s![ind === "dec" ? "dec_limite" : "fec_limite"][i] : null;
      }
      return l;
    });
}

/* ---------------------------------------------------------------- mapa municipal */

export type MunicipioQualidade = {
  cod: string;
  nome: string;
  uf: string;
  conjuntos: string[];
  relacao: RelacaoMunicipio;
  dec_min: number | null;
  dec_max: number | null;
  fec_min: number | null;
  fec_max: number | null;
  cnpjs: string[];
};

/**
 * CSV com ";" como o pipeline escreve (aspas duplas só em campo com separador, aspas
 * ou quebra de linha; BOM opcional). Vazio é ausência e fica como texto vazio.
 */
export function lerCsv(texto: string): Record<string, string>[] {
  const linhas: string[][] = [];
  let campoAtual = "";
  let linha: string[] = [];
  let aspas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campoAtual += '"';
          i++;
        } else aspas = false;
      } else campoAtual += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      linha.push(campoAtual);
      campoAtual = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campoAtual);
      campoAtual = "";
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else campoAtual += c;
  }
  if (campoAtual !== "" || linha.length) {
    linha.push(campoAtual);
    linhas.push(linha);
  }
  const [cab, ...resto] = linhas;
  if (!cab) return [];
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ""])));
}

const numeroOuNulo = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};

const RELACOES: readonly RelacaoMunicipio[] = ["conjunto_exclusivo", "conjunto_compartilhado", "varios_conjuntos", "sem_conjunto_ativo", "sem_relacao_na_fonte"];

/**
 * Municípios do CSV de download (qualidade_municipios.csv): só os que existem no
 * cadastro do IBGE (no_ibge = 1). Os códigos da base da ANEEL fora do IBGE ficam fora do
 * mapa e são listados na gold (mapa.correspondencia.codigos_sem_ibge).
 */
export function municipiosDoCsv(texto: string): MunicipioQualidade[] {
  return lerCsv(texto)
    .filter((l) => l.no_ibge === "1")
    .map((l) => ({
      cod: l.cod_ibge,
      nome: l.municipio,
      uf: l.uf,
      conjuntos: l.conjuntos ? l.conjuntos.split(" ").filter(Boolean) : [],
      relacao: (RELACOES as readonly string[]).includes(l.relacao) ? (l.relacao as RelacaoMunicipio) : "sem_relacao_na_fonte",
      dec_min: numeroOuNulo(l.dec_min_h),
      dec_max: numeroOuNulo(l.dec_max_h),
      fec_min: numeroOuNulo(l.fec_min),
      fec_max: numeroOuNulo(l.fec_max),
      cnpjs: l.cnpjs ? l.cnpjs.split(" ").filter(Boolean) : [],
    }));
}

export const ROTULO_RELACAO: Record<RelacaoMunicipio, string> = {
  conjunto_exclusivo: "um conjunto, só deste município",
  conjunto_compartilhado: "um conjunto, compartilhado com outros municípios",
  varios_conjuntos: "vários conjuntos",
  sem_conjunto_ativo: "sem conjunto com DEC no ano",
  sem_relacao_na_fonte: "não citado na base da ANEEL",
};

export const ROTULO_MEDIDA: Record<MedidaMapa, { rotulo: string; unidade: string; curto: string }> = {
  dec_max: { rotulo: "Maior DEC entre os conjuntos que atendem o município", unidade: "h", curto: "DEC, maior conjunto" },
  dec_min: { rotulo: "Menor DEC entre os conjuntos que atendem o município", unidade: "h", curto: "DEC, menor conjunto" },
  fec_max: { rotulo: "Maior FEC entre os conjuntos que atendem o município", unidade: "interrupções", curto: "FEC, maior conjunto" },
  fec_min: { rotulo: "Menor FEC entre os conjuntos que atendem o município", unidade: "interrupções", curto: "FEC, menor conjunto" },
};

/**
 * Cortes fixos (não quantis) para o mapa: a mesma régua em qualquer recorte, para o
 * leitor comparar cores entre medidas de DEC (horas) e entre medidas de FEC.
 */
export const CORTES_MAPA: Record<Indicador, number[]> = { dec: [5, 10, 20, 40], fec: [3, 5, 10, 20] };
export const CORES_MAPA = ["var(--escala-seq-1)", "var(--escala-seq-2)", "var(--escala-seq-3)", "var(--escala-seq-4)", "var(--escala-seq-5)"];

/** Valores do mapa para a medida escolhida: ausência fica nula (hachura), nunca zero. */
export function valoresMapa(municipios: readonly MunicipioQualidade[], medida: MedidaMapa): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const m of municipios) out[m.cod] = m[medida];
  return out;
}

/** Linhas da tabela sincronizada com o mapa (as mesmas que viram CSV e XLSX). */
export function linhasMunicipios(municipios: readonly MunicipioQualidade[], rotuloCnpj: (c: string) => string): LinhaTabela[] {
  return municipios.map((m) => ({
    id: m.cod,
    municipio: m.nome,
    uf: m.uf,
    relacao: ROTULO_RELACAO[m.relacao],
    n_conjuntos: m.conjuntos.length,
    dec_min: m.dec_min,
    dec_max: m.dec_max,
    fec_min: m.fec_min,
    fec_max: m.fec_max,
    distribuidoras: m.cnpjs.map(rotuloCnpj).join(", "),
    cod_ibge: m.cod,
  }));
}

export const COLUNAS_MUNICIPIOS: ColunaTabela[] = [
  { id: "municipio", rotulo: "Município", tipo: "texto" },
  { id: "uf", rotulo: "UF", tipo: "texto", categorica: true },
  { id: "relacao", rotulo: "Relação com os conjuntos", tipo: "texto", categorica: true },
  { id: "n_conjuntos", rotulo: "Conjuntos citados", tipo: "numero", casas: 0 },
  { id: "dec_min", rotulo: "DEC do menor conjunto", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dec_max", rotulo: "DEC do maior conjunto", tipo: "numero", unidade: "h", casas: 2 },
  { id: "fec_min", rotulo: "FEC do menor conjunto", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "fec_max", rotulo: "FEC do maior conjunto", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "distribuidoras", rotulo: "Distribuidoras", tipo: "texto" },
  { id: "cod_ibge", rotulo: "Código IBGE", tipo: "texto", buscavel: true },
];

/** O município escolhido no mapa, em uma frase: intervalo dos conjuntos, nunca um DEC "do município". */
export function respostaMunicipio(m: MunicipioQualidade, ano: number): string {
  const lugar = `${m.nome} (${m.uf})`;
  const dec = (a: number | null, b: number | null) => (a === b ? `${num(a, 2)} h` : `de ${num(a, 2)} a ${num(b, 2)} h`);
  const fec = (a: number | null, b: number | null) => (a === b ? `${num(a, 2)} interrupções` : `de ${num(a, 2)} a ${num(b, 2)} interrupções`);
  switch (m.relacao) {
    case "sem_relacao_na_fonte":
      return `${lugar} não aparece na base IndQual Município da ANEEL: nenhum conjunto é atribuído a ele, e o mapa fica sem valor.`;
    case "sem_conjunto_ativo":
      return `${lugar} é citado na base da ANEEL, mas nenhum dos conjuntos ligados a ele publicou DEC com 12 meses em ${ano}: sem valor no mapa.`;
    case "conjunto_exclusivo":
      return `${lugar} é atendido por um conjunto que só atende este município (${m.conjuntos[0] ?? "código não publicado"}): DEC de ${num(m.dec_max, 2)} h (${horasEMinutos(m.dec_max)}) e FEC de ${num(m.fec_max, 2)} interrupções em ${ano}.`;
    case "conjunto_compartilhado":
      return `${lugar} é atendido por um conjunto (${m.conjuntos[0] ?? "código não publicado"}) que também atende outros municípios: DEC de ${num(m.dec_max, 2)} h e FEC de ${num(m.fec_max, 2)} interrupções em ${ano}, valores do conjunto inteiro, não medidos só no município.`;
    default:
      return `${lugar} é atendido por ${m.conjuntos.length} conjuntos. Em ${ano}, o DEC anual desses conjuntos vai ${dec(m.dec_min, m.dec_max)} e o FEC ${fec(m.fec_min, m.fec_max)}; a base não informa quantas unidades de cada conjunto ficam no município, então nenhuma média municipal é calculada.`;
  }
}

/* ---------------------------------------------------------------- P052: realizado e limites */

/** P052: conjuntos acima do limite, peso em UCs, Brasil diante do limite agregado e as caudas. */
export function respostaP052(g: QualidadeGold): string {
  const c = g.conjuntos;
  const a = anoBrasil(g, c.ano);
  const q = c.quantis_razao_dec;
  const ant = c.historico.find((h) => h.ano === c.ano - 1);
  const partes = [
    `Em ${c.ano}, ${num(c.acima_limite_dec, 0)} dos ${num(c.com_limite, 0)} conjuntos com limite (${pct(c.pct_acima_limite_dec, 1)}) ficaram acima do limite anual de DEC, com ${pct(c.pct_ucs_acima_limite_dec, 1)} das unidades consumidoras` +
      (ant ? `, contra ${pct(ant.pct_acima_limite_dec, 1)} dos conjuntos em ${ant.ano}` : "") +
      `; ${num(c.acima_limite_fec, 0)} passaram do limite de FEC.`,
  ];
  if (a && a.dec !== null && a.dec_limite !== null && a.razao_dec !== null) {
    const s = comparaNaPrecisao(a.dec, a.dec_limite, 2);
    partes.push(
      `No Brasil, o DEC apurado (${num(a.dec, 2)} h) ficou ${s === "igual" ? "igual ao" : s === "abaixo" ? "abaixo do" : "acima do"} limite agregado (${num(a.dec_limite, 2)} h), ${num(a.razao_dec, 3)} ${vezes(a.razao_dec)} o limite.`,
    );
  }
  if (q.p50 !== null && q.p90 !== null) {
    partes.push(
      `A média esconde as pontas: metade dos conjuntos ficou abaixo de ${num(q.p50, 2)} ${vezes(q.p50)} o próprio limite e um em cada dez ficou acima de ${num(q.p90, 2)} ${vezes(q.p90)}.`,
    );
  }
  return partes.join(" ");
}

/**
 * Veredito do P052: que fração dos conjuntos com limite passou do limite anual de DEC e como estava no ano anterior. Os
 * conjuntos em número, o peso em unidades consumidoras, o Brasil diante do limite agregado e as caudas ficam na resposta completa.
 */
export function vereditoP052(g: QualidadeGold): string {
  const c = g.conjuntos;
  const ant = c.historico.find((h) => h.ano === c.ano - 1);
  const contra = ant && ant.pct_acima_limite_dec !== null ? `, contra ${pct(ant.pct_acima_limite_dec, 1)} em ${ant.ano}` : "";
  const q = c.quantis_razao_dec;
  const pontas = q.p90 !== null && q.p90 > 1 ? " A média do Brasil esconde as pontas: há conjuntos bem acima do próprio limite." : "";
  return `Em ${c.ano}, ${pct(c.pct_acima_limite_dec, 1)} dos conjuntos com limite ficaram acima do limite anual de DEC${contra}.${pontas}`;
}

/** P052, "o que mudou": trajetória da fração de conjuntos acima do limite. */
export function mudancaP052(c: Conjuntos): string {
  const h = c.historico.filter((x) => x.pct_acima_limite_dec !== null);
  if (h.length < 2) return "Sem histórico suficiente de conjuntos com limite.";
  const maior = h.reduce((m, x) => ((x.pct_acima_limite_dec ?? -1) > (m.pct_acima_limite_dec ?? -1) ? x : m));
  const ult = h[h.length - 1];
  return `De ${h[0].ano} a ${ult.ano}, a fração de conjuntos acima do limite de DEC teve o máximo em ${maior.ano} (${pct(maior.pct_acima_limite_dec, 1)}) e fechou ${ult.ano} em ${pct(ult.pct_acima_limite_dec, 1)}. O limite de cada conjunto também muda de um ano para outro, então a fração acima dele mistura desempenho e meta.`;
}

/** Itens do gráfico de pontos realizado × limite (um por distribuidora, ano de referência). */
export function itensLimite(g: QualidadeGold, ind: Indicador): { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe?: string }[] {
  return g.distribuidoras.map((d) => {
    const valor = ind === "dec" ? d.dec : d.fec;
    const ref = ind === "dec" ? d.dec_limite : d.fec_limite;
    const notas = [
      d.meses < 12 ? `${d.meses} meses publicados: sem valor anual` : null,
      d.cobertura_limite !== null && d.cobertura_limite < 1 ? `limite cobre ${pct(d.cobertura_limite * 100, 0)} das UCs` : null,
      d.quebras_perimetro.some((q) => q.ano === g.ano_referencia) ? "perímetro mudou no ano (incorporação)" : null,
    ].filter(Boolean) as string[];
    return {
      id: d.cnpj,
      rotulo: rotuloDistribuidora(d),
      valor,
      referencia: ref,
      detalhe: notas.length ? notas.join("; ") : undefined,
    };
  });
}

/** Tabela do P052: realizado, limite, razão e DGC (calculado ao lado do publicado no ranking). */
export function linhasLimites(g: QualidadeGold): LinhaTabela[] {
  return g.distribuidoras.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d),
    classificacao: d.classificacao ?? "sem classificação publicada",
    dec: d.dec,
    dec_limite: d.dec_limite,
    razao_dec: d.razao_dec,
    fec: d.fec,
    fec_limite: d.fec_limite,
    razao_fec: d.razao_fec,
    situacao: situacaoLimite(d),
    dgc_calculado: d.dgc_calculado,
    dgc_publicado: d.dgc_publicado,
    posicao: d.posicao_ranking,
    porte: d.porte_ranking ?? "fora do ranking",
    cobertura_limite: d.cobertura_limite === null ? null : d.cobertura_limite * 100,
    cnpj: d.cnpj,
  }));
}

/** Situação diante dos dois limites agregados, decidida nas duas casas que a ANEEL publica. */
export function situacaoLimite(d: Pick<Distribuidora, "dec" | "fec" | "dec_limite" | "fec_limite">): string {
  if (d.dec === null || d.fec === null || d.dec_limite === null || d.fec_limite === null) return "sem valor anual ou sem limite";
  const sd = comparaNaPrecisao(d.dec, d.dec_limite, 2) === "acima";
  const sf = comparaNaPrecisao(d.fec, d.fec_limite, 2) === "acima";
  if (sd && sf) return "acima dos dois limites";
  if (sd) return "acima do limite de DEC";
  if (sf) return "acima do limite de FEC";
  return "dentro dos dois limites";
}

export const COLUNAS_LIMITES: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "dec", rotulo: "DEC apurado", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dec_limite", rotulo: "Limite de DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "razao_dec", rotulo: "DEC ÷ limite", tipo: "numero", casas: 3 },
  { id: "fec", rotulo: "FEC apurado", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "fec_limite", rotulo: "Limite de FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "razao_fec", rotulo: "FEC ÷ limite", tipo: "numero", casas: 3 },
  { id: "dgc_calculado", rotulo: "DGC calculado", tipo: "numero", casas: 3 },
  { id: "dgc_publicado", rotulo: "DGC no ranking da ANEEL", tipo: "numero", casas: 2 },
  { id: "posicao", rotulo: "Posição no ranking", tipo: "numero", casas: 0 },
  { id: "porte", rotulo: "Porte no ranking", tipo: "texto", categorica: true },
  { id: "classificacao", rotulo: "Classificação", tipo: "texto", categorica: true },
  { id: "cobertura_limite", rotulo: "UCs com limite", tipo: "percentual", casas: 0 },
  { id: "cnpj", rotulo: "CNPJ", tipo: "texto" },
];

/** Histórico de uma distribuidora (série sob demanda), em uma frase com o último ano e a quebra de perímetro. */
export function respostaHistoricoDistribuidora(
  rotulo: string,
  s: { anos: number[]; dec: (number | null)[]; fec: (number | null)[]; dec_limite: (number | null)[]; fec_limite: (number | null)[]; quebras: number[] } | undefined,
  ind: Indicador,
): string {
  if (!s || !s.anos.length) return `${rotulo}: sem série anual publicada.`;
  const v = s[ind];
  const l = s[ind === "dec" ? "dec_limite" : "fec_limite"];
  const nome = ind === "dec" ? "DEC" : "FEC";
  const un = ind === "dec" ? "h" : "interrupções";
  let acima = 0;
  let comparados = 0;
  for (let i = 0; i < s.anos.length; i++) {
    const x = v[i];
    const y = l[i];
    if (x === null || y === null) continue;
    comparados++;
    if (comparaNaPrecisao(x, y, 2) === "acima") acima++;
  }
  const i = s.anos.length - 1;
  const ult = v[i] !== null && l[i] !== null ? ` Em ${s.anos[i]}: ${num(v[i], 2)} ${un} para um limite de ${num(l[i], 2)} ${un}.` : "";
  const quebra = s.quebras.length ? ` O perímetro mudou em ${listaPt(s.quebras.map(String))} (incorporação): antes e depois não são a mesma área.` : "";
  return `${rotulo}: ${nome} acima do limite em ${acima} de ${comparados} anos com valor e limite, de ${s.anos[0]} a ${s.anos[i]}.${ult}${quebra}`;
}

/**
 * Histograma da razão apurado ÷ limite a partir das faixas publicadas na gold (os 3.146
 * conjuntos ficam no CSV). A última faixa é aberta na fonte ("3 ou mais"); ela fecha no
 * máximo publicado, para o desenho ter largura, e o rótulo diz o máximo. Os quantis são
 * os da gold, não recalculados.
 */
export function histogramaDeFaixas(faixas: readonly FaixaHistograma[], q: Quantis): DistribuicaoHistograma {
  const classes = faixas.map((f, i) => {
    const ultima = i === faixas.length - 1;
    const fim = f.ate ?? (q.max !== null && q.max > f.de ? q.max : f.de + (faixas[i - 1] ? f.de - faixas[i - 1].de : 1));
    return { inicio: f.de, fim, contagem: f.conjuntos, fechadaDireita: ultima };
  });
  const larguras = classes.map((c) => c.fim - c.inicio);
  const n = classes.reduce((s, c) => s + c.contagem, 0);
  return {
    classes,
    massas: [],
    resumo: { n, semDado: 0, min: q.min, p10: q.p10, p25: q.p25, mediana: q.p50, p75: q.p75, p90: q.p90, max: q.max },
    foraDasClasses: { abaixo: 0, acima: 0 },
    larguraReferencia: Math.min(...larguras),
    larguraUniforme: larguras.every((w) => Math.abs(w - larguras[0]) < 1e-9),
  };
}

/** Série histórica dos conjuntos acima do limite (gráfico e tabela). */
export function linhasHistoricoConjuntos(c: Conjuntos): LinhaTabela[] {
  return c.historico.map((h) => ({
    ano: String(h.ano),
    pct_acima: h.pct_acima_limite_dec,
    pct_ucs_acima: h.pct_ucs_acima_limite_dec,
    acima: h.acima_limite_dec,
    com_limite: h.com_limite,
    razao_p50: h.razao_p50,
    razao_p90: h.razao_p90,
    dec_p50: h.dec_p50,
    dec_p90: h.dec_p90,
  }));
}

/** Matriz faixa de limite × faixa da razão (contagem de conjuntos), para a tabela. */
export function linhasMatriz(c: Conjuntos): LinhaTabela[] {
  return c.matriz_limite_razao_dec.map((m) => ({
    id: `${m.limite_de}`,
    faixa: m.limite_ate === null ? `${num(m.limite_de, 0)} h ou mais` : `${num(m.limite_de, 0)} a menos de ${num(m.limite_ate, 0)} h`,
    r0: m["razao_0_0.5"],
    r1: m["razao_0.5_1.0"],
    r2: m["razao_1.0_1.5"],
    r3: m["razao_1.5_mais"],
    total: m["razao_0_0.5"] + m["razao_0.5_1.0"] + m["razao_1.0_1.5"] + m["razao_1.5_mais"],
  }));
}

export const COLUNAS_MATRIZ: ColunaTabela[] = [
  { id: "faixa", rotulo: "Limite de DEC do conjunto", tipo: "texto" },
  { id: "r0", rotulo: "Até metade do limite", tipo: "numero", casas: 0 },
  { id: "r1", rotulo: "Da metade até o limite", tipo: "numero", casas: 0 },
  { id: "r2", rotulo: "De 1 a 1,5 vez o limite", tipo: "numero", casas: 0 },
  { id: "r3", rotulo: "1,5 vez o limite ou mais", tipo: "numero", casas: 0 },
  { id: "total", rotulo: "Conjuntos", tipo: "numero", casas: 0 },
];

/** Caudas publicadas (25 maiores razões e 25 maiores DEC). */
export function linhasCauda(itens: Conjuntos["cauda_dec"]): LinhaTabela[] {
  return itens.map((x) => ({
    id: String(x.conjunto),
    conjunto: String(x.conjunto),
    nome: x.nome,
    sigla: x.sigla,
    dec: x.dec,
    dec_limite: x.dec_limite,
    razao_dec: x.razao_dec,
    fec: x.fec,
    fec_limite: x.fec_limite,
    ucs: x.ucs,
  }));
}

export const COLUNAS_CAUDA: ColunaTabela[] = [
  { id: "nome", rotulo: "Conjunto", tipo: "texto" },
  { id: "conjunto", rotulo: "Código", tipo: "texto" },
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto", categorica: true },
  { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dec_limite", rotulo: "Limite de DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "razao_dec", rotulo: "DEC ÷ limite", tipo: "numero", casas: 3 },
  { id: "fec", rotulo: "FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "fec_limite", rotulo: "Limite de FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "ucs", rotulo: "UCs (média do ano)", tipo: "numero", casas: 0 },
];

/* ---------------------------------------------------------------- explorador de conjuntos (CSV sob demanda) */

/** Linhas dos conjuntos de um ano, lidas do CSV anual por década (o mesmo arquivo de download). */
/**
 * O FEC de um conjunto diante do limite. A razão e a marca "acima do limite" só existem com os 12 meses de FEC publicados; com menos meses
 * (e FEC e limite publicados) o conjunto fica fora da contagem, e a frase diz se ele já passa do limite com os meses que existem.
 */
export function situacaoFecDoConjunto(l: { acima: string; fec: number | null; limite: number | null; razao: number | null; mesesFec?: number | null }): string {
  if (l.acima === "1") return "acima do limite";
  if (l.acima === "0") return "até o limite";
  if (l.fec !== null && l.limite !== null && l.razao === null) {
    const meses = l.mesesFec !== null && l.mesesFec !== undefined && l.mesesFec < 12 ? `${l.mesesFec} meses de FEC` : "menos de 12 meses de FEC";
    return comparaNaPrecisao(l.fec, l.limite, 2) === "acima" ? `${meses}, já acima do limite` : meses;
  }
  return "sem FEC ou sem limite de FEC";
}

export function conjuntosDoCsv(texto: string, ano: number): LinhaTabela[] {
  return lerCsv(texto)
    .filter((l) => Number(l.ano) === ano)
    .map((l) => {
      const acima = l.acima_limite_dec === "1" ? "acima do limite" : l.acima_limite_dec === "0" ? "até o limite" : "sem limite ou sem 12 meses";
      return {
        id: l.conjunto,
        conjunto: l.conjunto,
        nome: l.nome,
        sigla: l.sigla,
        meses: numeroOuNulo(l.meses),
        dec: numeroOuNulo(l.dec_h),
        dec_limite: numeroOuNulo(l.dec_limite_h),
        razao_dec: numeroOuNulo(l.razao_dec),
        fec: numeroOuNulo(l.fec_interrupcoes),
        fec_limite: numeroOuNulo(l.fec_limite_interrupcoes),
        razao_fec: numeroOuNulo(l.razao_fec),
        ucs: numeroOuNulo(l.ucs_media),
        situacao_dec: acima,
        situacao_fec: situacaoFecDoConjunto({
          acima: l.acima_limite_fec ?? "",
          fec: numeroOuNulo(l.fec_interrupcoes),
          limite: numeroOuNulo(l.fec_limite_interrupcoes),
          razao: numeroOuNulo(l.razao_fec),
          mesesFec: numeroOuNulo(l.meses_fec),
        }),
      };
    });
}

export const COLUNAS_CONJUNTOS: ColunaTabela[] = [
  { id: "nome", rotulo: "Conjunto", tipo: "texto" },
  { id: "conjunto", rotulo: "Código", tipo: "texto" },
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto", categorica: true },
  { id: "situacao_dec", rotulo: "DEC diante do limite", tipo: "texto", categorica: true },
  { id: "meses", rotulo: "Meses", tipo: "numero", casas: 0 },
  { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dec_limite", rotulo: "Limite de DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "razao_dec", rotulo: "DEC ÷ limite", tipo: "numero", casas: 3 },
  { id: "fec", rotulo: "FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "fec_limite", rotulo: "Limite de FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "razao_fec", rotulo: "FEC ÷ limite", tipo: "numero", casas: 3 },
  { id: "situacao_fec", rotulo: "FEC diante do limite", tipo: "texto", categorica: true },
  { id: "ucs", rotulo: "UCs (média do ano)", tipo: "numero", casas: 0 },
];

/** Arquivo anual por década que contém o ano (o pipeline publica 2000-2009, 2010-2019 e 2020-2029). */
export function arquivoConjuntosDoAno(ano: number): string {
  const d = Math.floor(ano / 10) * 10;
  return `/energia/series/qualidade_conjuntos_anual_${d}_${d + 9}.csv`;
}

/* ---------------------------------------------------------------- P053: compensações */

export const ORDEM_TIPOS: TipoCompensacao[] = ["mensal", "trimestral", "anual", "dicri", "dise"];
export const ROTULO_TIPO_CURTO: Record<TipoCompensacao, string> = { mensal: "mensal", trimestral: "trimestral", anual: "anual", dicri: "DICRI", dise: "DISE" };
/** Rótulo das barras por tipo: curto o bastante para caber no celular; a definição completa fica na tabela por tipo. */
const ROTULO_TIPO_BARRA: Record<TipoCompensacao, string> = {
  mensal: "Mensal (DIC, FIC, DMIC)",
  trimestral: "Trimestral (DIC, FIC)",
  anual: "Anual (DIC, FIC)",
  dicri: "DICRI (dia crítico)",
  dise: "DISE (emergência)",
};

/** P053: total pago a unidades consumidoras no ano de referência, unidades geradoras à parte e concentração. */
export function respostaP053(g: QualidadeGold): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  if (!a || a.valor_uc === null) return `Sem total de compensações para ${c.ano_referencia}: o ano não tem os 12 meses informados pelas distribuidoras.`;
  const ant = c.anual.find((x) => x.ano === c.ano_referencia - 1 && x.completo);
  let comp = "";
  if (ant && ant.valor_uc !== null) {
    const s = comparaNaPrecisao(a.valor_uc / 1e6, ant.valor_uc / 1e6, 1);
    comp = s === "igual" ? `, o mesmo de ${ant.ano}` : `, ${s === "abaixo" ? "menos" : "mais"} que os ${reaisMilhoes(ant.valor_uc)} de ${ant.ano}`;
  }
  const qt = a.quantidade_uc !== null ? ` em ${num(a.quantidade_uc / 1e6, 1)} milhões de compensações` : "";
  const ug = a.valor_ug !== null ? ` Unidades geradoras receberam ${reaisMilhoes(a.valor_ug, 2)} à parte.` : "";
  // a concentração é calculada sobre o valor de unidades consumidoras e geradoras somadas (o "valor" de cada distribuidora), não sobre o total só de UC
  const conc = c.concentracao_5_maiores_pct !== null ? ` As cinco distribuidoras que mais pagaram somam ${pct(c.concentracao_5_maiores_pct, 1)} do total do ano de unidades consumidoras e geradoras somadas.` : "";
  return `Em ${a.ano}, as distribuidoras informaram ${reaisMilhoes(a.valor_uc)} pagos a unidades consumidoras${qt}, por violação de limites individuais de continuidade (valores nominais da competência)${comp}.${ug}${conc}`;
}

/** Veredito do P053: o total pago a unidades consumidoras no ano de referência e a comparação ao ano anterior completo. */
export function vereditoP053(g: QualidadeGold): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  if (!a || a.valor_uc === null) return `Sem total de compensações para ${c.ano_referencia}: o ano não tem os 12 meses informados pelas distribuidoras.`;
  const ant = c.anual.find((x) => x.ano === c.ano_referencia - 1 && x.completo);
  let comp = "";
  if (ant && ant.valor_uc !== null) {
    const s = comparaNaPrecisao(a.valor_uc / 1e6, ant.valor_uc / 1e6, 1);
    comp = s === "igual" ? `, o mesmo de ${ant.ano}` : `, ${s === "abaixo" ? "menos" : "mais"} que os ${reaisMilhoes(ant.valor_uc)} de ${ant.ano}`;
  }
  return `Em ${a.ano}, as distribuidoras pagaram ${reaisMilhoes(a.valor_uc)} a unidades consumidoras que tiveram limites individuais de continuidade violados${comp}.`;
}

/** P053, "o que mudou": maior ano da série e o acumulado do ano corrente, marcado como parcial. */
export function mudancaP053(g: QualidadeGold): string {
  const c = g.compensacoes;
  const completos = c.anual.filter((x) => x.completo && x.valor_uc !== null);
  if (!completos.length) return "Sem anos completos de compensação publicados.";
  const maior = completos.reduce((m, x) => ((x.valor_uc ?? -1) > (m.valor_uc ?? -1) ? x : m));
  const parcial = c.anual.find((x) => !x.completo);
  const p = parcial && c.ultimo_mes_completo ? ` Em ${parcial.ano}, até ${mesAno(c.ultimo_mes_completo)}: ${reaisMilhoes(parcial.valor_uc)} a unidades consumidoras, soma parcial que não se compara a um ano cheio.` : "";
  return `Na série desde ${completos[0].ano}, o maior total pago a unidades consumidoras foi o de ${maior.ano} (${reaisMilhoes(maior.valor_uc)}), em reais de cada ano, sem correção pela inflação.${p}`;
}

/** Anos completos de compensação (gráfico, tabela e exportação): unidades consumidoras e geradoras separadas. */
export function linhasCompensacaoAnual(g: QualidadeGold): LinhaTabela[] {
  return g.compensacoes.anual.map((a) => ({
    ano: String(a.ano),
    situacao: a.completo ? "ano completo" : `parcial até ${g.compensacoes.ultimo_mes_completo ? mesAno(g.compensacoes.ultimo_mes_completo) : "mês não informado"}`,
    valor_uc_mi: a.completo && a.valor_uc !== null ? a.valor_uc / 1e6 : null,
    valor_uc: a.valor_uc,
    quantidade_uc: a.quantidade_uc,
    valor_ug: a.valor_ug,
    quantidade_ug: a.quantidade_ug,
    valor_por_uc: a.valor_por_uc,
  }));
}

export const COLUNAS_COMP_ANUAL: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "valor_uc", rotulo: "Valor a unidades consumidoras", tipo: "numero", unidade: "R$", casas: 2 },
  { id: "quantidade_uc", rotulo: "Compensações a unidades consumidoras", tipo: "numero", casas: 0 },
  { id: "valor_ug", rotulo: "Valor a unidades geradoras", tipo: "numero", unidade: "R$", casas: 2 },
  { id: "quantidade_ug", rotulo: "Compensações a unidades geradoras", tipo: "numero", casas: 0 },
  { id: "valor_por_uc", rotulo: "Valor (UC e UG) ÷ UCs (normalização)", tipo: "numero", unidade: "R$ por UC", casas: 2 },
];

/** Meses de compensação: mês ainda incompleto fica fora do gráfico (o valor publicado segue na tabela, marcado). */
export function linhasCompensacaoMensal(g: QualidadeGold): LinhaTabela[] {
  return g.compensacoes.mensal.map((m) => ({
    m: m.m,
    valor_mi: m.completo && m.valor !== null ? m.valor / 1e6 : null,
    quantidade_mil: m.completo && m.quantidade !== null ? m.quantidade / 1e3 : null,
    valor_publicado: m.valor,
    quantidade_publicada: m.quantidade,
    situacao: m.completo ? "completo" : "incompleto (nem todas as distribuidoras informaram)",
  }));
}

/**
 * Valor pago a unidades consumidoras por tipo de violação em cada ano. Só UC, o universo do
 * total que a ANEEL divulga: desde 2022 os tipos trimestral e anual de UC não são publicados e
 * os de unidades geradoras vêm com zero, então a soma UC + UG mostraria zero onde há ausência.
 * Tipo sem linha de UC no ano é ausência, nunca zero.
 */
export function linhasCompensacaoTipo(g: QualidadeGold): LinhaTabela[] {
  return g.compensacoes.anual.map((a) => {
    const l: LinhaTabela = { ano: String(a.ano), situacao: a.completo ? "ano completo" : "parcial" };
    for (const t of ORDEM_TIPOS) l[t] = a.por_tipo[t]?.valor_uc ?? null;
    l.valor_ug = a.valor_ug;
    return l;
  });
}

/**
 * Composição do ano de referência por tipo (barras), só unidades consumidoras. Entram os tipos
 * com alguma linha no ano; o que só tem linha de unidade geradora fica como barra ausente
 * (hachura), não como zero.
 */
export function linhasTipoAnoReferencia(g: QualidadeGold): LinhaTabela[] {
  const a = g.compensacoes.anual.find((x) => x.ano === g.compensacoes.ano_referencia);
  if (!a) return [];
  return ORDEM_TIPOS.filter((t) => a.por_tipo[t] !== undefined).map((t) => {
    const p = a.por_tipo[t]!;
    return {
      id: t,
      tipo: ROTULO_TIPO_BARRA[t],
      valor_mi: p.valor_uc === null ? null : p.valor_uc / 1e6,
      quantidade: p.quantidade_uc,
    };
  });
}

/** Trechos contínuos de anos: [2011, 2012, 2013, 2016] vira [[2011, 2013], [2016, 2016]]. */
function trechosDeAnos(anos: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const a of [...anos].sort((x, y) => x - y)) {
    const u = out[out.length - 1];
    if (u && a === u[1] + 1) u[1] = a;
    else out.push([a, a]);
  }
  return out;
}

/**
 * Em que anos cada tipo tem valor publicado para unidades consumidoras, dito a partir da
 * própria série (nenhum ano escrito à mão): "trimestral de 2011 a 2021; DISE desde 2026".
 */
export function notaTiposCompensacao(g: QualidadeGold): string {
  const anos = g.compensacoes.anual.map((a) => a.ano);
  if (!anos.length) return "Sem série de compensações por tipo.";
  const ultimo = Math.max(...anos);
  const partes = ORDEM_TIPOS.map((t) => {
    const com = g.compensacoes.anual.filter((a) => a.por_tipo[t]?.valor_uc !== null && a.por_tipo[t]?.valor_uc !== undefined).map((a) => a.ano);
    if (!com.length) return `${ROTULO_TIPO_CURTO[t]}: nenhum ano`;
    const txt = trechosDeAnos(com).map(([i, f]) => (f === ultimo && i !== f ? `desde ${i}` : i === f ? String(i) : `de ${i} a ${f}`));
    return `${ROTULO_TIPO_CURTO[t]} ${listaPt(txt)}`;
  });
  return `Valores pagos a unidades consumidoras. Tipo sem valor publicado no ano é ausência, não zero. Anos com valor por tipo: ${partes.join("; ")}. Unidades geradoras na última coluna, somadas.`;
}

/**
 * Tipos com linha no ano de referência mas sem valor para unidades consumidoras, em uma frase:
 * diz se a fonte trouxe o tipo só para unidades geradoras e com que valor (lido da gold). Vazio
 * quando todos os tipos do ano têm valor de UC.
 */
export function notaTiposSemUc(g: QualidadeGold): string {
  const ano = g.compensacoes.ano_referencia;
  const a = g.compensacoes.anual.find((x) => x.ano === ano);
  if (!a) return "";
  const sem = ORDEM_TIPOS.filter((t) => a.por_tipo[t] !== undefined && a.por_tipo[t]!.valor_uc === null);
  if (!sem.length) return "";
  const nomes = listaPt(sem.map((t) => ROTULO_TIPO_CURTO[t]));
  const ug = sem.map((t) => a.por_tipo[t]!.valor_ug);
  const origem = ug.every((v) => v === 0)
    ? "a fonte traz esses tipos só para unidades geradoras, com valor zero"
    : ug.every((v) => v !== null)
      ? `a fonte traz esses tipos só para unidades geradoras (${listaPt(sem.map((t, i) => `${ROTULO_TIPO_CURTO[t]}: ${reaisMilhoes(ug[i], 2)}`))})`
      : "a fonte não traz valor de unidade consumidora para esses tipos";
  return `${ano}: ${nomes} sem valor publicado para unidades consumidoras; a barra hachurada é ausência, não zero (${origem}).`;
}

/** Compensações por distribuidora no ano de referência (valor total, por tipo e normalizado por UC). */
export function linhasCompensacaoDistribuidoras(g: QualidadeGold): LinhaTabela[] {
  return g.distribuidoras
    .filter((d) => d.compensacao)
    .map((d) => {
      const c = d.compensacao!;
      const l: LinhaTabela = {
        id: d.cnpj,
        sigla: rotuloDistribuidora(d),
        classificacao: d.classificacao ?? "sem classificação publicada",
        valor: c.valor,
        quantidade: c.quantidade,
        valor_por_uc: c.valor_por_uc,
        ucs: d.ucs,
      };
      // por tipo, só unidades consumidoras (o "valor no ano" soma UC e UG)
      for (const t of ORDEM_TIPOS) l[t] = c.valor_uc_por_tipo[t] ?? null;
      return l;
    });
}

export function colunasCompensacaoDistribuidoras(rotulos: Record<TipoCompensacao, string>): ColunaTabela[] {
  return [
    { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
    { id: "classificacao", rotulo: "Classificação", tipo: "texto", categorica: true },
    { id: "valor", rotulo: "Valor no ano (UC e UG)", tipo: "numero", unidade: "R$", casas: 2 },
    { id: "quantidade", rotulo: "Compensações no ano (UC e UG)", tipo: "numero", casas: 0 },
    { id: "valor_por_uc", rotulo: "Valor (UC e UG) ÷ UCs (normalização)", tipo: "numero", unidade: "R$ por UC", casas: 2 },
    { id: "ucs", rotulo: "UCs (média do ano)", tipo: "numero", casas: 0 },
    ...ORDEM_TIPOS.map((t) => ({ id: t, rotulo: `${rotulos[t]}, só UC`, tipo: "numero" as const, unidade: "R$", casas: 2 })),
  ];
}

/* ---------------------------------------------------------------- P054: atendimento e resiliência */

/** P054: reclamações por exposição, Ouvidoria, IASC com a amostra e tempo de atendimento emergencial. */
export function respostaP054(g: QualidadeGold): string {
  const ref = g.ano_referencia;
  const at = g.atendimento;
  const rec = at.reclamacoes_distribuidora.find((x) => x.ano === ref);
  const ouv = at.ouvidoria_aneel.find((x) => x.ano === ref);
  const tmae = at.tmae.find((x) => x.ano === ref && x.completo);
  const partes: string[] = [];
  if (rec && rec.por_ucs !== null) {
    partes.push(
      `Em ${ref}, as distribuidoras registraram ${num(rec.por_ucs, 1)} reclamações por mil unidades consumidoras` +
        (rec.interrupcao_por_mil_uc !== null ? `, ${num(rec.interrupcao_por_mil_uc, 1)} delas sobre interrupção` : "") +
        ` (${rec.distribuidoras} distribuidoras com os 12 meses enviados, ${pctCobertura(rec.cobertura_ucs)} das UCs).`,
    );
  } else if (rec) partes.push(`Reclamações nas distribuidoras em ${ref}: sem taxa (${rec.motivo_ausencia ?? "universo vazio"}).`);
  if (ouv && ouv.por_ucs !== null) partes.push(`Na Ouvidoria Setorial da ANEEL, segunda instância, foram ${num(ouv.por_ucs, 1)} reclamações por 100 mil unidades consumidoras.`);
  if (at.iasc.ano !== null && at.iasc.quantis.p50 !== null) {
    partes.push(
      `Na pesquisa IASC de ${at.iasc.ano}, com ${num(at.iasc.entrevistas, 0)} entrevistas em ${at.iasc.distribuidoras} distribuidoras, o índice mediano foi ${num(at.iasc.quantis.p50, 1)} de 100.`,
    );
  }
  if (tmae && tmae.tmae_min !== null) partes.push(`O atendimento a uma ocorrência emergencial levou em média ${num(tmae.tmae_min, 0)} minutos (${horasEMinutos(tmae.tmae_min / 60)}) da reclamação ao restabelecimento.`);
  return partes.join(" ") || "Sem indicadores de atendimento publicados para o ano de referência.";
}

/** Veredito do P054: reclamações por mil unidades consumidoras nas distribuidoras e quantas foram sobre interrupção. */
export function vereditoP054(g: QualidadeGold): string {
  const ref = g.ano_referencia;
  const rec = g.atendimento.reclamacoes_distribuidora.find((x) => x.ano === ref);
  if (!rec || rec.por_ucs === null) return rec ? `Reclamações nas distribuidoras em ${ref}: sem taxa (${rec.motivo_ausencia ?? "universo vazio"}).` : "Sem indicadores de atendimento publicados para o ano de referência.";
  const interrupcao = rec.interrupcao_por_mil_uc !== null ? `, ${num(rec.interrupcao_por_mil_uc, 1)} delas sobre interrupção` : "";
  return `Em ${ref}, as distribuidoras registraram ${num(rec.por_ucs, 1)} reclamações por mil unidades consumidoras${interrupcao}.`;
}

/** P054, "o que mudou": evolução das taxas (anos completos) e o ano corrente sem taxa. */
export function mudancaP054(g: QualidadeGold): string {
  const at = g.atendimento;
  const anos = at.reclamacoes_distribuidora.filter((x) => x.por_ucs !== null);
  const partes: string[] = [];
  if (anos.length >= 2) {
    const a = anos[0];
    const b = anos[anos.length - 1];
    const s = comparaNaPrecisao(b.por_ucs!, a.por_ucs!, 1);
    partes.push(`Reclamações por mil UCs nas distribuidoras: ${num(a.por_ucs, 1)} em ${a.ano} e ${num(b.por_ucs, 1)} em ${b.ano} (${s === "igual" ? "estável" : s === "abaixo" ? "queda" : "alta"}).`);
  }
  const semTaxa = at.reclamacoes_distribuidora.find((x) => x.por_ucs === null && x.motivo_ausencia);
  if (semTaxa) partes.push(`${semTaxa.ano}: sem taxa, ${semTaxa.motivo_ausencia}.`);
  // anos cheios se comparam entre si; o ano corrente aparece à parte, com o número de meses
  const tm = at.tmae.filter((x) => x.tmae_min !== null && x.completo);
  const tmParcial = at.tmae.find((x) => x.tmae_min !== null && !x.completo);
  if (tm.length >= 2) {
    const a = tm[0];
    const b = tm[tm.length - 1];
    partes.push(
      `Tempo médio de atendimento emergencial: ${num(a.tmae_min, 0)} min em ${a.ano} e ${num(b.tmae_min, 0)} min em ${b.ano}` +
        (tmParcial ? `; ${tmParcial.ano} tem só ${tmParcial.meses} meses (${num(tmParcial.tmae_min, 0)} min), sem comparação com ano cheio.` : "."),
    );
  }
  return partes.join(" ") || "Sem série de atendimento com mais de um ano.";
}

/** Indicadores nacionais de atendimento, cada um com o seu escopo e a sua unidade (nunca somados entre si). */
export function linhasEscopos(g: QualidadeGold): LinhaTabela[] {
  const at = g.atendimento;
  const out: LinhaTabela[] = [];
  for (const r of at.reclamacoes_distribuidora) {
    out.push({
      id: `rec-${r.ano}`,
      indicador: "Reclamações na distribuidora (1º nível)",
      escopo: "todas as reclamações registradas pelas distribuidoras com os 12 meses enviados",
      ano: String(r.ano),
      valor: r.por_ucs,
      unidade: "por mil UCs",
      base: r.total,
      motivo: r.motivo_ausencia ?? (r.completo ? "" : "ano parcial"),
    });
    out.push({
      id: `rec-int-${r.ano}`,
      indicador: "Reclamações de interrupção (1º nível)",
      escopo: "tipologia de interrupção do fornecimento (REN 1.000/2021)",
      ano: String(r.ano),
      valor: r.interrupcao_por_mil_uc,
      unidade: "por mil UCs",
      base: r.interrupcao,
      motivo: r.motivo_ausencia ?? (r.completo ? "" : "ano parcial"),
    });
  }
  for (const o of at.ouvidoria_aneel) {
    out.push({
      id: `ouv-${o.ano}`,
      indicador: "Reclamações na Ouvidoria Setorial da ANEEL",
      escopo: "segunda instância: depois do atendimento na distribuidora",
      ano: String(o.ano),
      valor: o.por_ucs,
      unidade: "por 100 mil UCs",
      base: o.total,
      motivo: o.motivo_ausencia ?? (o.completo ? "" : `ano parcial (${o.meses_max !== null ? `até ${o.meses_max} meses` : "meses não informados"}): sem taxa anual`),
    });
  }
  for (const t of at.tmae) {
    out.push({
      id: `tmae-${t.ano}`,
      indicador: "Tempo médio de atendimento emergencial (TMAE)",
      escopo: "ocorrências emergenciais com os três tempos informados (preparação, deslocamento e execução)",
      ano: String(t.ano),
      valor: t.tmae_min,
      unidade: "minutos",
      base: t.ocorrencias,
      motivo: t.completo ? "" : `parcial: ${t.meses} meses${t.periodo ? ` (${mesAno(t.periodo.inicio)} a ${mesAno(t.periodo.fim)})` : ""}`,
    });
  }
  return out;
}

export const COLUNAS_ESCOPOS: ColunaTabela[] = [
  { id: "indicador", rotulo: "Indicador", tipo: "texto", categorica: true },
  { id: "ano", rotulo: "Ano", tipo: "texto", categorica: true },
  { id: "valor", rotulo: "Valor", tipo: "numero", casas: 1 },
  { id: "unidade", rotulo: "Unidade", tipo: "texto" },
  { id: "base", rotulo: "Contagem na base", tipo: "numero", casas: 0 },
  { id: "escopo", rotulo: "Escopo", tipo: "texto" },
  { id: "motivo", rotulo: "Ausência ou parcial", tipo: "texto" },
];

/** Taxas nacionais de reclamação por ano para as barras (ano parcial fica sem barra: taxa ausente, com motivo). */
export function linhasReclamacoesNacional(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.reclamacoes_distribuidora.map((r) => ({
    ano: String(r.ano),
    total: r.por_ucs,
    interrupcao: r.interrupcao_por_mil_uc,
    n2: r.n2_por_mil_uc,
  }));
}

export function linhasOuvidoriaNacional(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.ouvidoria_aneel.map((o) => ({ ano: String(o.ano), total: o.por_ucs, procedentes: o.procedentes_por_100mil_uc }));
}

/** Atendimento telefônico: % dos distribuidora-meses dentro de cada padrão (INS e IAb não se agregam). */
export function linhasTelefonico(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.telefonico.anual.map((t) => ({
    ano: String(t.ano),
    ins: t.pct_meses_ins_ok,
    iab: t.pct_meses_iab_ok,
    ico: t.pct_meses_ico_ok,
    meses: t.meses,
    distribuidoras: t.distribuidoras,
    ico_nacional: t.ico_pct,
    situacao: t.completo ? "ano completo" : `parcial, ${t.meses} meses`,
  }));
}

/** Parcelas de emergência e dia crítico (resiliência) por ano, 2010 em diante. */
export function linhasResiliencia(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.resiliencia_parcelas
    .filter((r) => r.dec_emergencia !== null || r.dec_dia_critico !== null)
    .map((r) => ({ ano: String(r.ano), emergencia: r.dec_emergencia, dia_critico: r.dec_dia_critico, apurado: r.dec_apurado, todas: r.dec_todas_parcelas }));
}

/** Eventos em situação de emergência com maior CHI (consumidores × horas interrompidas). */
export function linhasEventos(g: QualidadeGold): LinhaTabela[] {
  return g.atendimento.eventos_emergencia.maiores_chi.map((e) => ({
    id: `${e.cnpj ?? ""}|${e.codigo}|${e.competencia}`,
    sigla: e.sigla ?? (e.cnpj ? `CNPJ ${e.cnpj}` : "sem distribuidora identificada"),
    codigo: e.codigo,
    competencia: e.competencia,
    inicio: e.inicio,
    fim: e.fim,
    duracao_h: e.duracao_h,
    chi_evento: e.chi_evento,
    chi_limite: e.chi_limite,
    razao_chi: e.razao_chi,
    origem: e.origem,
  }));
}

export const COLUNAS_EVENTOS: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto", categorica: true },
  { id: "codigo", rotulo: "Código do evento", tipo: "texto" },
  { id: "competencia", rotulo: "Competência", tipo: "texto" },
  { id: "inicio", rotulo: "Início", tipo: "texto" },
  { id: "fim", rotulo: "Fim", tipo: "texto" },
  { id: "duracao_h", rotulo: "Duração", tipo: "numero", unidade: "h", casas: 1 },
  { id: "chi_evento", rotulo: "CHI do evento", tipo: "numero", unidade: "consumidor × hora", casas: 0 },
  { id: "chi_limite", rotulo: "CHI limite", tipo: "numero", unidade: "consumidor × hora", casas: 0 },
  { id: "razao_chi", rotulo: "CHI ÷ limite", tipo: "numero", casas: 2 },
  { id: "origem", rotulo: "Origem declarada", tipo: "texto", categorica: true },
];

/** Atendimento por distribuidora (ano de referência), cada medida com a sua exposição. */
export function linhasAtendimentoDistribuidoras(g: QualidadeGold): LinhaTabela[] {
  return g.distribuidoras.map((d) => ({
    id: d.cnpj,
    sigla: rotuloDistribuidora(d),
    classificacao: d.classificacao ?? "sem classificação publicada",
    ucs: d.ucs,
    iasc: d.iasc?.valor ?? null,
    iasc_amostra: d.iasc?.amostra ?? null,
    iasc_categoria: d.iasc?.categoria ?? "fora da pesquisa no ano",
    rec_mil: d.reclamacoes?.n1_por_mil_uc ?? null,
    rec_int_mil: d.reclamacoes?.interrupcao_n1_por_mil_uc ?? null,
    rec_n2_mil: d.reclamacoes?.n2_por_mil_uc ?? null,
    ouv_100mil: d.reclamacoes?.ouvidoria_aneel_por_100mil_uc ?? null,
    tmae: d.tmae_min,
    tel_ins_min: d.telefonico?.ins_min_pct ?? null,
    tel_meses_ins: d.telefonico ? `${d.telefonico.meses_ins_ok} de ${d.telefonico.meses}` : "não obrigada",
    tel_oferecidas_mil: d.telefonico?.oferecidas_por_mil_uc ?? null,
    eventos_2026: d.eventos_emergencia_2026,
  }));
}

export const COLUNAS_ATENDIMENTO: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "classificacao", rotulo: "Classificação", tipo: "texto", categorica: true },
  { id: "ucs", rotulo: "UCs (média do ano)", tipo: "numero", casas: 0 },
  { id: "iasc", rotulo: "IASC", tipo: "numero", unidade: "0 a 100", casas: 2 },
  { id: "iasc_amostra", rotulo: "Entrevistas do IASC", tipo: "numero", casas: 0 },
  { id: "iasc_categoria", rotulo: "Categoria do IASC", tipo: "texto", categorica: true },
  { id: "rec_mil", rotulo: "Reclamações na distribuidora", tipo: "numero", unidade: "por mil UCs", casas: 1 },
  { id: "rec_int_mil", rotulo: "Reclamações de interrupção", tipo: "numero", unidade: "por mil UCs", casas: 1 },
  { id: "rec_n2_mil", rotulo: "Reclamações no 2º nível", tipo: "numero", unidade: "por mil UCs", casas: 2 },
  { id: "ouv_100mil", rotulo: "Ouvidoria da ANEEL", tipo: "numero", unidade: "por 100 mil UCs", casas: 1 },
  { id: "tmae", rotulo: "TMAE", tipo: "numero", unidade: "min", casas: 0 },
  { id: "tel_ins_min", rotulo: "Pior INS mensal", tipo: "percentual", casas: 1 },
  { id: "tel_meses_ins", rotulo: "Meses com INS no padrão", tipo: "texto" },
  { id: "tel_oferecidas_mil", rotulo: "Chamadas oferecidas", tipo: "numero", unidade: "por mil UCs", casas: 0 },
  { id: "eventos_2026", rotulo: "Eventos de emergência declarados", tipo: "numero", casas: 0 },
];

/**
 * Colunas da tabela de atendimento por distribuidora: o rótulo da contagem de eventos diz o
 * período da base publicada (datas da gold), não um ano escrito à mão.
 */
export function colunasAtendimento(g: QualidadeGold): ColunaTabela[] {
  const e = g.atendimento.eventos_emergencia;
  const periodo = e.inicio_min && e.inicio_max ? `, início de ${dataBR(e.inicio_min.slice(0, 10))} a ${dataBR(e.inicio_max.slice(0, 10))}` : "";
  return COLUNAS_ATENDIMENTO.map((c) => (c.id === "eventos_2026" ? { ...c, rotulo: `Eventos de emergência declarados${periodo}` } : c));
}

/* ---------------------------------------------------------------- carga sob demanda no navegador */

const cache = new Map<string, Promise<unknown>>();

/**
 * Busca um arquivo publicado uma única vez por visita (todas as instâncias da página
 * compartilham a mesma promessa). Falha não fica em cache: a próxima tentativa refaz.
 */
export function carregarUmaVez<T>(url: string, ler: (r: Response) => Promise<T>): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined;
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} ao buscar ${url}`);
      return ler(r);
    });
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

/* ---------------------------------------------------------------- tabelas abertas sob demanda */

/**
 * Tabelas de análise e auditoria que a página não manda prontas no HTML (contrato,
 * seção 5.1: o peso da página). Cada uma é montada no navegador, quando a pessoa a abre,
 * a partir da própria gold publicada (/energia/gold/qualidade.json) e destas mesmas
 * funções: o que a tabela mostra e exporta é o que o teste confere contra os CSV.
 */
export const TABELAS_SOB_DEMANDA = [
  "dist-p051",
  "limites",
  "mensal",
  "identidade",
  "matriz",
  "cauda-razao",
  "cauda-dec",
  "dgc",
  "comp-tipo",
  "comp-dist",
  "divulgado",
  "escopos",
  "eventos",
  "atendimento",
  "validacao",
  "arquivos",
] as const;
export type IdTabela = (typeof TABELAS_SOB_DEMANDA)[number];

export type DefinicaoTabela = {
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  colunaRotulo?: string;
  fonte: string;
  versao: string;
  nomeArquivo: string;
  ordemInicial?: { coluna: string; direcao: "asc" | "desc" };
  dicaBusca?: string;
  nota?: string;
};

export const FONTE_CONTINUIDADE = "ANEEL, Indicadores Coletivos de Continuidade (DEC e FEC)";
const FONTE_COMPENSACOES = "ANEEL, compensações por violação de limites de continuidade";
const FONTE_ATENDIMENTO = "ANEEL: manifestações, Ouvidoria, IASC, atendimento emergencial e telefônico";

const COLUNAS_MENSAL: ColunaTabela[] = [
  { id: "m", rotulo: "Mês", tipo: "texto" },
  { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
  { id: "dec_publicado", rotulo: "DEC publicado", tipo: "numero", unidade: "h", casas: 2 },
  { id: "fec_publicado", rotulo: "FEC publicado", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "ucs", rotulo: "UCs com DEC", tipo: "numero", casas: 0 },
  { id: "conjuntos", rotulo: "Conjuntos", tipo: "numero", casas: 0 },
];

const COLUNAS_IDENTIDADE: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "conjunto_meses", rotulo: "Conjunto-meses", tipo: "numero", casas: 0 },
  { id: "pct_dec", rotulo: "DEC = IP + IND", tipo: "percentual", casas: 2 },
  { id: "pct_fec", rotulo: "FEC = IP + IND", tipo: "percentual", casas: 2 },
];

const COLUNAS_DGC: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "comparados", rotulo: "Distribuidoras comparadas", tipo: "numero", casas: 0 },
  { id: "ate_1_centesimo", rotulo: "Até 0,01 de diferença", tipo: "numero", casas: 0 },
  { id: "exatos", rotulo: "Iguais em duas casas", tipo: "numero", casas: 0 },
  { id: "maior", rotulo: "Maior diferença", tipo: "numero", casas: 3 },
  { id: "divergentes", rotulo: "Divergentes (publicado × calculado)", tipo: "texto" },
];

const COLUNAS_DIVULGADO: ColunaTabela[] = [
  { id: "ano", rotulo: "Ano", tipo: "texto" },
  { id: "valor_uc", rotulo: "Valor a UCs (soma dos dados abertos)", tipo: "numero", unidade: "R$", casas: 2 },
  { id: "divulgado_valor", rotulo: "Divulgado pela ANEEL", tipo: "numero", unidade: "R$", casas: 0 },
  { id: "dentro_valor", rotulo: "Dentro da precisão divulgada (R$ 0,5 milhão)", tipo: "texto", categorica: true },
  { id: "quantidade_uc", rotulo: "Compensações a UCs (soma dos dados abertos)", tipo: "numero", casas: 0 },
  { id: "divulgado_qt", rotulo: "Divulgado pela ANEEL (quantidade)", tipo: "numero", casas: 0 },
  { id: "dentro_qt", rotulo: "Dentro da precisão divulgada (50 mil)", tipo: "texto", categorica: true },
];

const COLUNAS_VALIDACAO: ColunaTabela[] = [
  { id: "nome", rotulo: "Controle", tipo: "texto" },
  { id: "resultado", rotulo: "Resultado", tipo: "texto", categorica: true },
  { id: "critico", rotulo: "Crítico", tipo: "texto", categorica: true },
  { id: "detalhe", rotulo: "Detalhe", tipo: "texto" },
];

const COLUNAS_ARQUIVOS: ColunaTabela[] = [
  { id: "dataset", rotulo: "Conjunto", tipo: "texto", categorica: true },
  { id: "recurso", rotulo: "Recurso", tipo: "texto" },
  { id: "publicado_em", rotulo: "Publicado pela fonte", tipo: "texto" },
  { id: "capturado_em", rotulo: "Capturado", tipo: "texto" },
  { id: "versao", rotulo: "Regra de importação", tipo: "texto" },
  { id: "sha256", rotulo: "sha256", tipo: "texto" },
];

const simNao = (v: boolean | null) => (v === null ? "sem divulgação" : v ? "sim" : "não");

/**
 * Definição (colunas, linhas, fonte, arquivo) de cada tabela aberta sob demanda. `avisos` traz a marca de cobertura parcial do FEC
 * (a página manda a versão com os meses lidos do CSV mensal; sem ela, a regra é refeita aqui só com a gold).
 */
export function tabelaQualidade(id: IdTabela, g: QualidadeGold, avisos: AvisosFec = avisosFec(g)): DefinicaoTabela {
  const ref = String(g.ano_referencia);
  const c = g.conjuntos;
  const comp = g.compensacoes;
  const dist = new Map(g.distribuidoras.map((d) => [d.cnpj, d]));
  const comFec = (l: LinhaTabela): LinhaTabela => {
    const d = dist.get(String(l.id));
    return d ? { ...l, ...camposFecDaDistribuidora(d, avisos) } : l;
  };
  switch (id) {
    case "dist-p051":
      return {
        colunas: comColunasFec(COLUNAS_DIST_P051),
        linhas: linhasDistribuidorasP051(g).map(comFec),
        colunaRotulo: "sigla",
        fonte: FONTE_CONTINUIDADE,
        versao: ref,
        nomeArquivo: "qualidade-distribuidoras",
        ordemInicial: { coluna: "dec", direcao: "desc" },
        dicaBusca: "Sigla ou CNPJ",
        nota: `Distribuidora com menos de 12 meses publicados fica sem valor anual (ausência, nunca soma de meses). ${notaFecCobertura(avisos)}`,
      };
    case "limites":
      return {
        colunas: comColunasFec(COLUNAS_LIMITES),
        linhas: linhasLimites(g).map(comFec),
        colunaRotulo: "sigla",
        fonte: FONTE_CONTINUIDADE,
        versao: ref,
        nomeArquivo: "qualidade-limites-distribuidoras",
        ordemInicial: { coluna: "razao_dec", direcao: "desc" },
        dicaBusca: "Sigla ou CNPJ",
        nota: `DGC (desempenho global de continuidade) = média simples de DEC ÷ limite e FEC ÷ limite, como no ranking da ANEEL; o publicado tem duas casas. Posição, porte e DGC publicado são do ranking da ANEEL; as demais colunas são calculadas aqui. ${notaFecCobertura(avisos)}`,
      };
    case "mensal":
      return {
        colunas: COLUNAS_MENSAL,
        linhas: linhasBrasilMensal(g).map((m) => ({ ...m, id: String(m.m) })),
        colunaRotulo: "m",
        fonte: FONTE_CONTINUIDADE,
        versao: g.ultimo_mes_completo,
        nomeArquivo: "qualidade-brasil-mensal",
        ordemInicial: { coluna: "m", direcao: "desc" },
      };
    case "identidade":
      return {
        colunas: COLUNAS_IDENTIDADE,
        linhas: g.brasil.identidade_apurado.map((x) => ({
          id: String(x.ano),
          ano: String(x.ano),
          conjunto_meses: x.conjunto_meses,
          pct_dec: x.pct_dec_igual_ip_mais_ind,
          pct_fec: x.pct_fec_igual_ip_mais_ind,
        })),
        fonte: FONTE_CONTINUIDADE,
        versao: ref,
        nomeArquivo: "qualidade-identidade-apurado",
      };
    case "matriz":
      return { colunas: COLUNAS_MATRIZ, linhas: linhasMatriz(c), colunaRotulo: "faixa", fonte: FONTE_CONTINUIDADE, versao: String(c.ano), nomeArquivo: "qualidade-matriz-limite-razao" };
    case "cauda-razao":
      return {
        colunas: COLUNAS_CAUDA,
        linhas: linhasCauda(c.cauda_razao_dec),
        colunaRotulo: "nome",
        fonte: FONTE_CONTINUIDADE,
        versao: String(c.ano),
        nomeArquivo: "qualidade-cauda-razao",
        ordemInicial: { coluna: "razao_dec", direcao: "desc" },
      };
    case "cauda-dec":
      return {
        colunas: COLUNAS_CAUDA,
        linhas: linhasCauda(c.cauda_dec),
        colunaRotulo: "nome",
        fonte: FONTE_CONTINUIDADE,
        versao: String(c.ano),
        nomeArquivo: "qualidade-cauda-dec",
        ordemInicial: { coluna: "dec", direcao: "desc" },
      };
    case "dgc":
      return {
        colunas: COLUNAS_DGC,
        linhas: g.reconciliacao.dgc.map((r) => ({
          id: String(r.ano),
          ano: String(r.ano),
          comparados: r.comparados,
          ate_1_centesimo: r.ate_1_centesimo,
          exatos: r.exatos_2_casas,
          maior: r.maior_diferenca,
          divergentes: r.divergentes.map((d) => `${d.sigla_ranking ?? d.empresa}: ${num(d.dgc_publicado, 2)} × ${num(d.dgc_calculado, 3)}`).join("; ") || "nenhuma",
        })),
        fonte: "ANEEL, ranking da continuidade; cálculo do observatório",
        versao: ref,
        nomeArquivo: "qualidade-reconciliacao-dgc",
      };
    case "comp-tipo":
      return {
        colunas: [
          { id: "ano", rotulo: "Ano", tipo: "texto" },
          { id: "situacao", rotulo: "Situação", tipo: "texto", categorica: true },
          ...ORDEM_TIPOS.map((t) => ({ id: t, rotulo: `${comp.rotulos_tipo[t]}, só UC`, tipo: "numero" as const, unidade: "R$", casas: 2 })),
          { id: "valor_ug", rotulo: "Unidades geradoras, todos os tipos", tipo: "numero" as const, unidade: "R$", casas: 2 },
        ],
        linhas: linhasCompensacaoTipo(g).map((l) => ({ ...l, id: String(l.ano) })),
        colunaRotulo: "ano",
        fonte: FONTE_COMPENSACOES,
        versao: String(comp.ano_referencia),
        nomeArquivo: "qualidade-compensacoes-tipo",
        ordemInicial: { coluna: "ano", direcao: "desc" },
        nota: notaTiposCompensacao(g),
      };
    case "comp-dist":
      return {
        colunas: colunasCompensacaoDistribuidoras(comp.rotulos_tipo),
        linhas: linhasCompensacaoDistribuidoras(g),
        colunaRotulo: "sigla",
        fonte: FONTE_COMPENSACOES,
        versao: String(comp.ano_referencia),
        nomeArquivo: "qualidade-compensacoes-distribuidoras",
        ordemInicial: { coluna: "valor", direcao: "desc" },
        dicaBusca: "Sigla ou CNPJ",
      };
    case "divulgado":
      return {
        colunas: COLUNAS_DIVULGADO,
        linhas: comp.anual
          .filter((x) => x.divulgado_aneel)
          .map((x) => ({
            id: String(x.ano),
            ano: String(x.ano),
            valor_uc: x.valor_uc,
            divulgado_valor: x.divulgado_aneel!.valor,
            dentro_valor: simNao(x.divulgado_aneel!.dentro_da_precisao_valor),
            quantidade_uc: x.quantidade_uc,
            divulgado_qt: x.divulgado_aneel!.quantidade,
            dentro_qt: simNao(x.divulgado_aneel!.dentro_da_precisao_quantidade),
          })),
        fonte: "ANEEL, compensações (dados abertos) e notícia anual do ranking",
        versao: String(comp.ano_referencia),
        nomeArquivo: "qualidade-compensacoes-divulgado",
      };
    case "escopos":
      return {
        colunas: COLUNAS_ESCOPOS,
        linhas: linhasEscopos(g),
        colunaRotulo: "indicador",
        fonte: "ANEEL: manifestações, Ouvidoria Setorial e atendimento emergencial",
        versao: ref,
        nomeArquivo: "qualidade-atendimento-nacional",
      };
    case "eventos":
      return {
        colunas: COLUNAS_EVENTOS,
        linhas: linhasEventos(g),
        colunaRotulo: "sigla",
        fonte: "ANEEL, Evento Situação de Emergência",
        versao: g.atendimento.eventos_emergencia.inicio_max?.slice(0, 10) ?? ref,
        nomeArquivo: "qualidade-eventos-emergencia",
        ordemInicial: { coluna: "chi_evento", direcao: "desc" },
        nota: "CHI: consumidores × horas interrompidas. Evento que atravessa o mês aparece em mais de uma competência; nada é somado entre registros.",
      };
    case "atendimento":
      return {
        colunas: colunasAtendimento(g),
        linhas: linhasAtendimentoDistribuidoras(g),
        colunaRotulo: "sigla",
        fonte: FONTE_ATENDIMENTO,
        versao: ref,
        nomeArquivo: "qualidade-atendimento-distribuidoras",
        ordemInicial: { coluna: "rec_mil", direcao: "desc" },
        dicaBusca: "Sigla ou categoria do IASC",
        nota: "Reclamações por mil UCs só com os 12 meses enviados pela distribuidora; Ouvidoria por 100 mil UCs; IASC com a amostra ao lado.",
      };
    case "validacao":
      return {
        colunas: COLUNAS_VALIDACAO,
        linhas: g.validacao.map((x, i) => ({ id: String(i), nome: paraLeitor(x.nome), resultado: x.resultado, critico: x.critico ? "sim" : "não", detalhe: paraLeitor(x.detalhe) })),
        colunaRotulo: "nome",
        fonte: "Pipeline do observatório (pipeline/energia/modulos/qualidade.py)",
        versao: g.gerado_em.slice(0, 10),
        nomeArquivo: "qualidade-validacao",
      };
    case "arquivos":
      return {
        colunas: COLUNAS_ARQUIVOS,
        linhas: g.controles.map((x, i) => ({
          id: String(i),
          dataset: x.dataset,
          recurso: x.recurso,
          publicado_em: x.publicado_em ?? "não informado pela fonte",
          capturado_em: x.capturado_em,
          versao: x.versao_importacao ?? "não registrada",
          sha256: x.sha256,
        })),
        colunaRotulo: "recurso",
        fonte: "ANEEL e IBGE (arquivos originais)",
        versao: g.gerado_em.slice(0, 10),
        nomeArquivo: "qualidade-arquivos",
      };
  }
}

/* ---------------------------------------------------------------- redesenho: painéis, abertura e arquivos */

/**
 * Os quatro painéis da página: âncora do bloco, nome curto, título do painel e a pergunta que cada um responde (a descrição dos
 * capítulos e a "próxima pergunta" de cada rodapé saem daqui, o mesmo texto nos dois lugares).
 */
export const PAINEIS_QUALIDADE = [
  {
    id: "p051",
    ancora: "duracao",
    rotulo: "Duração e frequência",
    titulo: "Duração e frequência das interrupções no Brasil, ano a ano",
    descricao: "Por quanto tempo e quantas vezes falta energia, no Brasil, nas distribuidoras e nos conjuntos?",
  },
  {
    id: "p052",
    ancora: "limites",
    rotulo: "Limites",
    titulo: "Cada distribuidora e cada conjunto diante do próprio limite",
    descricao: "Quantos conjuntos passam do limite de DEC e como cada distribuidora fica diante do próprio limite?",
  },
  {
    id: "p053",
    ancora: "compensacoes",
    rotulo: "Compensações",
    titulo: "Quais compensações foram pagas?",
    descricao: "Quanto foi pago a quem teve um limite individual de continuidade violado?",
  },
  {
    id: "p054",
    ancora: "atendimento",
    rotulo: "Atendimento",
    titulo: "Como o consumidor é atendido e como a rede se recupera?",
    descricao: "Como o consumidor é atendido, o que ele responde na pesquisa de satisfação e como a rede se recupera?",
  },
] as const;
export type PainelQualidade = (typeof PAINEIS_QUALIDADE)[number]["id"];
export const painelQualidade = (id: PainelQualidade) => PAINEIS_QUALIDADE.find((p) => p.id === id)!;

/**
 * Valores da faixa de métricas da abertura. São os mesmos que a resposta, o gráfico e a tabela do P051 e do P052 leem (o ano de
 * referência da gold e o anterior); a faixa não calcula nada, só escolhe e converte a unidade de exibição (horas e minutos).
 */
export type MetricasAbertura = {
  ano: number;
  anoAnterior: number | null;
  dec: number | null;
  decAnterior: number | null;
  /** O DEC em horas e minutos (9,33 h são 9 h 20 min), nunca por leitura literal dos centésimos. */
  decHorasMinutos: string;
  fec: number | null;
  fecAnterior: number | null;
  /** DEC de todas as origens publicadas: o apurado mais as parcelas expurgadas. */
  decTodasOrigens: number | null;
  decTodasOrigensHorasMinutos: string;
  conjuntos: {
    ano: number;
    acima: number;
    comLimite: number;
    pct: number | null;
    anoAnterior: number | null;
    pctAnterior: number | null;
  };
};

export function metricasAbertura(g: QualidadeGold): MetricasAbertura {
  const ref = g.ano_referencia;
  const a = anoBrasil(g, ref);
  const ant = anoBrasil(g, ref - 1);
  const anterior = ant && ant.dec !== null && ant.fec !== null ? ant : null;
  const c = g.conjuntos;
  const antC = c.historico.find((h) => h.ano === c.ano - 1) ?? null;
  return {
    ano: ref,
    anoAnterior: anterior ? anterior.ano : null,
    dec: a?.dec ?? null,
    decAnterior: anterior?.dec ?? null,
    decHorasMinutos: horasEMinutos(a?.dec),
    fec: a?.fec ?? null,
    fecAnterior: anterior?.fec ?? null,
    decTodasOrigens: a?.dec_todas_parcelas ?? null,
    decTodasOrigensHorasMinutos: horasEMinutos(a?.dec_todas_parcelas),
    conjuntos: {
      ano: c.ano,
      acima: c.acima_limite_dec,
      comLimite: c.com_limite,
      pct: c.pct_acima_limite_dec,
      anoAnterior: antC && antC.pct_acima_limite_dec !== null ? antC.ano : null,
      pctAnterior: antC?.pct_acima_limite_dec ?? null,
    },
  };
}

/** Universo do DEC e do FEC nacionais, para o recorte: quantas distribuidoras e conjuntos entram e o recorte das concessionárias. */
export function textoUniversoBrasil(g: QualidadeGold): string {
  const a = anoBrasil(g, g.ano_referencia);
  if (!a) return "Sem ano nacional completo publicado.";
  const distribuidoras = g.distribuidoras.filter((d) => d.dec !== null).length;
  const base = `Todas as distribuidoras com indicadores publicados, inclusive permissionárias: ${num(distribuidoras, 0)} distribuidoras e ${num(a.conjuntos, 0)} conjuntos em ${a.ano}.`;
  if (a.dec_concessionarias === null || a.fec_concessionarias === null || a.concessionarias === null) return base;
  return `${base} Só as ${num(a.concessionarias, 0)} concessionárias, o universo do número que a ANEEL divulga: ${num(a.dec_concessionarias, 2)} h e ${num(a.fec_concessionarias, 2)} interrupções.`;
}

const FRASE_PARCELA: Record<GrupoParcela, string> = {
  apurado: "no apurado, a parte comparada ao limite",
  emergencia: "em situação de emergência",
  dia_critico: "em dia crítico",
  externa: "de origem externa ao sistema de distribuição",
  ons: "de racionamento ou alívio de carga pelo ONS",
};

/**
 * As parcelas do DEC do ano de referência por extenso: o que entra no apurado e o que a regra expurga, com a soma de todas as origens.
 * O que a fonte não publica (parcela nula) é dito como ausência, nunca como zero. Vazio sem parcelas publicadas.
 */
export function textoParcelasAno(g: QualidadeGold): string {
  const a = anoBrasil(g, g.ano_referencia);
  const p = a?.parcelas_dec ?? null;
  if (!a || !p || a.dec_todas_parcelas === null) return "";
  const itens = ORDEM_PARCELAS.map((k) => (p[k] === null ? `sem valor publicado ${FRASE_PARCELA[k]}` : `${num(p[k], 2)} h ${FRASE_PARCELA[k]}`));
  return `Em ${a.ano}, o DEC de todas as origens foi de ${num(a.dec_todas_parcelas, 2)} h (${horasEMinutos(a.dec_todas_parcelas)}): ${listaPt(itens)}. As quatro últimas parcelas são expurgadas do apurado.`;
}

/**
 * Primeiro ano a partir do qual o DEC e o FEC apurados são, em todos os conjunto-meses, a soma das parcelas internas programada e não
 * programada (IP + IND): antes disso o apurado de parte dos conjuntos incluía também as externas não críticas. Lido da tabela de
 * identidade do apurado, nunca escrito à mão; null quando a identidade vale desde o primeiro ano publicado ou nunca fecha.
 */
export function anoApuradoUniforme(g: QualidadeGold): number | null {
  const id = g.brasil.identidade_apurado;
  let ano: number | null = null;
  for (let i = id.length - 1; i >= 0; i--) {
    const x = id[i];
    if (x.pct_dec_igual_ip_mais_ind === 100 && x.pct_fec_igual_ip_mais_ind === 100) ano = x.ano;
    else break;
  }
  return ano !== null && ano > (id[0]?.ano ?? ano) ? ano : null;
}

/**
 * Marco do eixo dos anos nos gráficos de DEC e FEC: o ano a partir do qual o apurado passa a ser só IP + IND (antes, o apurado de parte
 * dos conjuntos incluía as externas não críticas). É a quebra que importa para comparar um ano com outro; o ano vem da identidade do
 * apurado, nunca de número escrito à mão. O início das parcelas em separado aparece no gráfico das parcelas, que começa nele.
 */
export function marcosHistoriaApurado(g: QualidadeGold): { x: string; rotulo: string }[] {
  const uniforme = anoApuradoUniforme(g);
  return uniforme === null ? [] : [{ x: String(uniforme), rotulo: `${uniforme}: muda o que entra no apurado` }];
}

/** Compensações do ano de referência para a faixa do P053: totais em milhões, unidades consumidoras e geradoras sempre separadas. */
export function metricasCompensacao(g: QualidadeGold) {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia) ?? null;
  const ant = c.anual.find((x) => x.ano === c.ano_referencia - 1 && x.completo) ?? null;
  const milhoes = (v: number | null | undefined) => (v === null || v === undefined ? null : v / 1e6);
  return {
    ano: c.ano_referencia,
    valorUcMilhoes: milhoes(a?.valor_uc),
    valorUcAnteriorMilhoes: milhoes(ant?.valor_uc),
    anoAnterior: ant && ant.valor_uc !== null ? ant.ano : null,
    quantidadeUcMilhoes: milhoes(a?.quantidade_uc),
    valorUgMilhoes: milhoes(a?.valor_ug),
  };
}

/**
 * O total que a ANEEL divulga para o ano de referência, quando a soma dos dados abertos difere dele além da precisão divulgada
 * (a conferência fica marcada e a diferença não foi explicada). Vazio quando não há divulgação ou quando ela confere.
 */
export function textoDivulgadoAno(g: QualidadeGold): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  const d = a?.divulgado_aneel ?? null;
  if (!a || !d || d.valor === null || a.valor_uc === null || d.dentro_da_precisao_valor !== false) return "";
  return `A ANEEL divulga ${reaisMilhoes(d.valor, 0)} para ${a.ano}, e a soma dos dados abertos é ${reaisMilhoes(a.valor_uc)}: a diferença passa da precisão divulgada e não foi explicada (a conferência está em Auditar).`;
}

/* ---- arquivos para baixar: nome legível para o leitor, o nome do arquivo só em Auditar */

const ROTULO_ARQUIVO: Record<string, string> = {
  "qualidade_brasil.csv": "DEC e FEC do Brasil, por ano e por mês",
  "qualidade_distribuidoras_anual.csv": "DEC, FEC e limites de cada distribuidora, por ano",
  "qualidade_distribuidoras_mensal.csv": "DEC e FEC de cada distribuidora, por mês",
  "qualidade_conjuntos_mensal.csv": "DEC e FEC de cada conjunto, por mês",
  "qualidade_municipios.csv": "Conjuntos que atendem cada município, com o DEC e o FEC deles",
  "qualidade_mapa.json": "Mapa por município (JSON)",
  "qualidade_distribuidoras_serie.json": "Série anual de cada distribuidora (JSON)",
  "qualidade_reconciliacao_dgc.csv": "DGC calculado e DGC publicado no ranking da ANEEL",
  "qualidade_compensacoes.csv": "Compensações por distribuidora, mês e tipo de violação",
  "qualidade_atendimento.csv": "Reclamações, Ouvidoria, IASC e atendimento emergencial por distribuidora",
  "qualidade_atendimento_telefonico.csv": "Atendimento telefônico por distribuidora e mês",
  "qualidade_eventos_emergencia.csv": "Eventos em situação de emergência",
};

/** Nome legível do arquivo publicado (o conjunto anual por década diz o seu período, lido do nome do arquivo). */
export function rotuloArquivo(url: string): string {
  const nome = url.split("/").at(-1) ?? url;
  const decada = /^qualidade_conjuntos_anual_(\d{4})_(\d{4})\.csv$/.exec(nome);
  if (decada) return `DEC, FEC e limites de cada conjunto, por ano, de ${decada[1]} a ${decada[2]}`;
  return ROTULO_ARQUIVO[nome] ?? "Arquivo de dados";
}

const ARQUIVOS_DO_PAINEL: Record<PainelQualidade, (string | RegExp)[]> = {
  p051: ["qualidade_brasil.csv", "qualidade_distribuidoras_anual.csv", "qualidade_distribuidoras_mensal.csv", "qualidade_conjuntos_mensal.csv", "qualidade_municipios.csv"],
  p052: ["qualidade_distribuidoras_anual.csv", /^qualidade_conjuntos_anual_\d{4}_\d{4}\.csv$/, "qualidade_reconciliacao_dgc.csv"],
  p053: ["qualidade_compensacoes.csv"],
  p054: ["qualidade_atendimento.csv", "qualidade_atendimento_telefonico.csv", "qualidade_eventos_emergencia.csv"],
};

/** Arquivos de um painel, com nome legível, entre os que a gold publica (um arquivo que a publicação não traz não aparece). */
export function downloadsDoPainel(g: QualidadeGold, painel: PainelQualidade): { rotulo: string; url: string }[] {
  const quer = ARQUIVOS_DO_PAINEL[painel];
  return g.downloads
    .filter((d) => {
      const nome = d.url.split("/").at(-1) ?? "";
      return quer.some((q) => (typeof q === "string" ? q === nome : q.test(nome)));
    })
    .map((d) => ({ rotulo: rotuloArquivo(d.url), url: d.url }));
}

/* ================================================================ ressalvas das avaliações independentes, no ponto de uso */

/*
 * O que há abaixo nasceu das avaliações técnica e de produto da versão anterior: cada seletor devolve texto ou valor derivado dos
 * campos da gold (e dos CSV publicados com ela), nunca um número escrito à mão, e nenhum deles refaz um indicador. Quando a gold
 * é reconstruída, as frases se refazem sozinhas; quando o dado de que a frase depende falta, a função devolve vazio ou a frase sem
 * aquele trecho.
 */

/* ---------------------------------------------------------------- FEC de cobertura parcial */

/**
 * Diferença, em centésimos de interrupção, entre o FEC anual de uma distribuidora e a soma das parcelas internas (FECIP + FECIND, o grupo
 * "apurado" das parcelas) acima da qual o FEC do ano é marcado como de cobertura parcial. Desde o ano em que o apurado é uniforme (IP + IND
 * em todos os conjunto-meses) as duas contas têm de fechar; quando não fecham, algum mês entrou no anual com parte das unidades consumidoras
 * sem FEC publicado.
 */
export const LIMITE_FEC_PARCIAL_CENTESIMOS = 2;
/** Fração das UCs com número de unidades que o FEC de um mês precisa cobrir (a mesma regra de 99% do mês completo do DEC). */
export const COBERTURA_MINIMA_FEC_MES = 0.99;

/** Mês cujo FEC cobre menos que o mínimo das unidades consumidoras (colunas ucs_fec e ucs_total do CSV mensal por distribuidora). */
export type MesFecParcial = { mes: string; ucsFec: number; ucsTotal: number; cobertura: number };

export type AvisoFec = {
  cnpj: string;
  rotulo: string;
  ano: number;
  fec: number;
  /** FEC anual pela soma das parcelas internas (FECIP + FECIND); null quando a gold não traz as parcelas. */
  fecPelasParcelas: number | null;
  /** FEC apurado menos FEC pelas parcelas, em interrupções. */
  diferenca: number | null;
  /** Meses do ano com cobertura abaixo do mínimo, lidos do CSV mensal; vazio quando o arquivo não foi lido. */
  meses: MesFecParcial[];
  /** A frase completa, no ponto de uso do valor. */
  frase: string;
  /** A marca curta, para célula de tabela. */
  marca: string;
};
export type AvisosFec = Record<string, AvisoFec>;

const centesimos = (x: number) => Math.round(x * 100);

/** Campos que a gold pode passar a trazer por distribuidora e ano (próxima coleta): lidos quando existem, nunca exigidos. */
type CamposCoberturaFec = { meses_fec?: number | null; cobertura_fec?: number | null };

function fraseAvisoFec(rotulo: string, ano: number, fec: number, parcelas: number | null, meses: MesFecParcial[]): { frase: string; marca: string } {
  const cobertura = (m: MesFecParcial) => pct(m.cobertura * 100, 2);
  const refeito = parcelas !== null ? `; pela soma das parcelas internas, programada e não programada (FECIP + FECIND), o anual é ${num(parcelas, 2)}, contra ${num(fec, 2)} apurado` : "";
  let frase: string;
  let marca: string;
  if (meses.length === 1) {
    frase = `O FEC de ${mesAno(meses[0].mes)} cobre ${cobertura(meses[0])} das UCs${refeito}.`;
    marca = `parcial: ${mesAno(meses[0].mes)} cobre ${cobertura(meses[0])} das UCs`;
  } else if (meses.length > 1) {
    frase = `O FEC cobre menos de ${pct(COBERTURA_MINIMA_FEC_MES * 100, 0)} das UCs em ${listaPt(meses.map((m) => `${mesAno(m.mes)} (${cobertura(m)})`))}${refeito}.`;
    marca = `parcial: ${meses.length} meses com menos de ${pct(COBERTURA_MINIMA_FEC_MES * 100, 0)} das UCs`;
  } else if (parcelas !== null) {
    frase = `O FEC apurado (${num(fec, 2)}) difere da soma das parcelas internas, programada e não programada (FECIP + FECIND), ${num(parcelas, 2)}.`;
    marca = `parcial: difere em ${num(Math.abs(fec - parcelas), 2)} das parcelas internas`;
  } else {
    frase = `O FEC apurado (${num(fec, 2)}) não cobre todas as unidades consumidoras em todos os meses do ano.`;
    marca = "parcial: nem todas as UCs em todos os meses";
  }
  return { frase: `${rotulo}, cobertura parcial do FEC em ${ano}. ${frase}`, marca };
}

/**
 * Distribuidoras cujo FEC anual do ano de referência é de cobertura parcial: o FEC difere da soma das parcelas internas em mais de
 * LIMITE_FEC_PARCIAL_CENTESIMOS (só em ano de apurado uniforme, onde as duas contas têm de fechar) ou a gold passa a dizer, em campo
 * próprio (`meses_fec` ou `cobertura_fec`), que o FEC do ano não cobre os 12 meses. O valor do anual na gold não muda: a marca e o valor
 * pelas parcelas vão ao lado dele. `mesesPorCnpj` (opcional) traz os meses de cobertura baixa, lidos do CSV mensal.
 */
export function fecComCoberturaParcial(g: QualidadeGold, mesesPorCnpj: Readonly<Record<string, readonly MesFecParcial[]>> = {}): AvisoFec[] {
  const uniforme = anoApuradoUniforme(g);
  const out: AvisoFec[] = [];
  for (const d of g.distribuidoras) {
    if (d.fec === null) continue;
    const parcelas = d.parcelas_fec?.apurado ?? null;
    const diverge = uniforme !== null && d.ano >= uniforme && parcelas !== null && Math.abs(centesimos(d.fec) - centesimos(parcelas)) > LIMITE_FEC_PARCIAL_CENTESIMOS;
    const extra = d as Distribuidora & CamposCoberturaFec;
    const porCampo = (typeof extra.meses_fec === "number" && extra.meses_fec < d.meses) || (typeof extra.cobertura_fec === "number" && extra.cobertura_fec < COBERTURA_MINIMA_FEC_MES);
    if (!diverge && !porCampo) continue;
    const meses = [...(mesesPorCnpj[d.cnpj] ?? [])].sort((a, b) => a.mes.localeCompare(b.mes));
    const rotulo = rotuloDistribuidora(d);
    const { frase, marca } = fraseAvisoFec(rotulo, d.ano, d.fec, parcelas, meses);
    out.push({
      cnpj: d.cnpj,
      rotulo,
      ano: d.ano,
      fec: d.fec,
      fecPelasParcelas: parcelas,
      diferenca: parcelas === null ? null : (centesimos(d.fec) - centesimos(parcelas)) / 100,
      meses,
      frase,
      marca,
    });
  }
  return out.sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

/** O mesmo, indexado pelo CNPJ (o que os gráficos, as tabelas e os pequenos múltiplos consultam). */
export function avisosFec(g: QualidadeGold, mesesPorCnpj: Readonly<Record<string, readonly MesFecParcial[]>> = {}): AvisosFec {
  return Object.fromEntries(fecComCoberturaParcial(g, mesesPorCnpj).map((a) => [a.cnpj, a]));
}

/**
 * Meses de um ano em que o FEC de cada distribuidora pedida cobre menos que COBERTURA_MINIMA_FEC_MES das unidades consumidoras, lidos
 * do CSV mensal por distribuidora (colunas cnpj, mes, ucs_fec e ucs_total). Só as linhas das distribuidoras pedidas são lidas.
 */
export function mesesComFecParcial(csv: string, cnpjs: readonly string[], ano: number): Record<string, MesFecParcial[]> {
  const out: Record<string, MesFecParcial[]> = {};
  if (!cnpjs.length || !csv) return out;
  const linhas = csv.replace(/^﻿/, "").split(/\r?\n/);
  const querem = cnpjs.map((c) => `${c};`);
  const escolhidas = [linhas[0] ?? "", ...linhas.slice(1).filter((l) => querem.some((q) => l.startsWith(q)))];
  for (const l of lerCsv(escolhidas.join("\n"))) {
    const ucsFec = numeroOuNulo(l.ucs_fec);
    const ucsTotal = numeroOuNulo(l.ucs_total);
    if (ucsFec === null || ucsTotal === null || ucsTotal <= 0 || !l.mes?.startsWith(`${ano}-`)) continue;
    const cobertura = ucsFec / ucsTotal;
    if (cobertura < COBERTURA_MINIMA_FEC_MES) (out[l.cnpj] ??= []).push({ mes: l.mes, ucsFec, ucsTotal, cobertura });
  }
  return out;
}

/** Colunas que a marca acrescenta às tabelas por distribuidora: a cobertura e o FEC refeito pelas parcelas, ao lado do FEC apurado. */
export const COLUNAS_FEC_COBERTURA: ColunaTabela[] = [
  { id: "fec_cobertura", rotulo: "Cobertura do FEC no ano", tipo: "texto", categorica: true },
  { id: "fec_parcelas", rotulo: "FEC pelas parcelas internas (FECIP + FECIND)", tipo: "numero", unidade: "interrupções", casas: 2 },
];

/** Valores das duas colunas para uma distribuidora: a marca, quando há; senão, se o FEC confere com as parcelas ou se falta o que conferir. */
export function camposFecDaDistribuidora(d: Distribuidora, avisos: AvisosFec): { fec_cobertura: string; fec_parcelas: number | null } {
  const aviso = avisos[d.cnpj];
  const parcelas = d.parcelas_fec?.apurado ?? null;
  return {
    fec_cobertura: aviso ? aviso.marca : parcelas === null || d.fec === null ? "sem parcelas para conferir" : "confere com as parcelas internas",
    fec_parcelas: parcelas,
  };
}

/** Insere as colunas da cobertura do FEC logo depois da coluna do FEC apurado (junto do valor que elas qualificam). */
export function comColunasFec(colunas: readonly ColunaTabela[]): ColunaTabela[] {
  const i = colunas.findIndex((c) => c.id === "fec");
  return i < 0 ? [...colunas, ...COLUNAS_FEC_COBERTURA] : [...colunas.slice(0, i + 1), ...COLUNAS_FEC_COBERTURA, ...colunas.slice(i + 1)];
}

/** Nota de rodapé das tabelas por distribuidora: o que a marca quer dizer e quais distribuidoras a têm. */
export function notaFecCobertura(avisos: AvisosFec): string {
  const lista = Object.values(avisos);
  const regra = `A cobertura parcial do FEC vale também para a razão de FEC e para o DGC calculado da distribuidora; o valor da tabela segue como está na base, e o FEC pelas parcelas internas vai ao lado. Marca: FEC do ano que difere em mais de ${num(LIMITE_FEC_PARCIAL_CENTESIMOS / 100, 2)} da soma das parcelas internas.`;
  return lista.length ? `${lista.map((a) => a.frase).join(" ")} ${regra}` : regra;
}

/**
 * Uma distribuidora para o painel de limites, com DEC e FEC e os dois limites do ano de referência. É o que viaja ao navegador: uma lista só
 * (em vez de uma por indicador, cada uma repetindo CNPJ e nome), com a classe em uma letra e as notas só onde existem.
 */
export type ItemLimites = {
  id: string;
  rotulo: string;
  /** c: concessionária; p: permissionária; s: sem classificação publicada. */
  classe: "c" | "p" | "s";
  dec: number | null;
  decLim: number | null;
  fec: number | null;
  fecLim: number | null;
  /** Notas do ano (meses publicados, cobertura do limite, perímetro). */
  det?: string;
  /** DGC calculado que difere do publicado pela ANEEL no ano de referência. */
  dgc?: string;
};

export function itensLimites(g: QualidadeGold): ItemLimites[] {
  const fec = new Map(itensLimite(g, "fec").map((i) => [i.id, i]));
  const dgc = detalheDgcDoAno(g);
  const classe = new Map(g.distribuidoras.map((d) => [d.cnpj, d.classificacao === "Concessionária" ? "c" : d.classificacao === "Permissionária" ? "p" : "s"] as const));
  return itensLimite(g, "dec").map((i) => {
    const f = fec.get(i.id);
    const item: ItemLimites = { id: i.id, rotulo: i.rotulo, classe: classe.get(i.id) ?? "s", dec: i.valor, decLim: i.referencia, fec: f?.valor ?? null, fecLim: f?.referencia ?? null };
    if (i.detalhe) item.det = i.detalhe;
    if (dgc[i.id]) item.dgc = dgc[i.id];
    return item;
  });
}

/**
 * Pares realizado × limite de um indicador para o gráfico de pontos, com as ressalvas da avaliação: no FEC, a distribuidora de cobertura
 * parcial leva um asterisco no nome e a frase na dica; nos dois indicadores, a distribuidora cujo DGC calculado difere do publicado no
 * ano de referência leva a diferença na dica. O valor de cada ponto é o da gold.
 */
export function paresLimites(itens: readonly ItemLimites[], ind: Indicador, avisos: AvisosFec): { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe?: string }[] {
  return itens.map((i) => {
    const aviso = ind === "fec" ? avisos[i.id] : undefined;
    const notas = [i.det, aviso ? aviso.frase.replace(/\.$/, "") : null, i.dgc].filter((x): x is string => !!x);
    const par: { id: string; rotulo: string; valor: number | null; referencia: number | null; detalhe?: string } = {
      id: i.id,
      rotulo: aviso ? `${i.rotulo} *` : i.rotulo,
      valor: ind === "dec" ? i.dec : i.fec,
      referencia: ind === "dec" ? i.decLim : i.fecLim,
    };
    if (notas.length) par.detalhe = notas.join("; ");
    return par;
  });
}

/** Só as colunas pedidas de cada linha (o que um gráfico lê): o resto não viaja ao navegador. Ausência continua nula. */
export function recorteColunas(linhas: readonly LinhaTabela[], ids: readonly string[]): LinhaTabela[] {
  return linhas.map((l) => Object.fromEntries(ids.map((k) => [k, l[k] ?? null])));
}

/* ---- conjuntos acima do limite de FEC: a contagem é um mínimo */

export type ResumoSemRazaoFec = {
  ano: number;
  /** Conjuntos com FEC e limite de FEC publicados, mas sem razão (menos de 12 meses de FEC): ficam fora da contagem. */
  total: number;
  porDistribuidora: { sigla: string; n: number }[];
  /** Os que já passam do limite com os meses publicados, comparados em centésimos. */
  acima: { conjunto: string; nome: string; sigla: string; fec: number; limite: number }[];
};

/** Resumo dos conjuntos do ano sem razão de FEC, a partir das linhas do CSV anual (conjuntosDoCsv). */
export function resumoSemRazaoFec(linhas: readonly LinhaTabela[], ano: number): ResumoSemRazaoFec {
  const sem = linhas.filter((l) => typeof l.fec === "number" && typeof l.fec_limite === "number" && (l.razao_fec === null || l.razao_fec === undefined));
  const por = new Map<string, number>();
  for (const l of sem) {
    const sigla = String(l.sigla || "distribuidora sem sigla");
    por.set(sigla, (por.get(sigla) ?? 0) + 1);
  }
  return {
    ano,
    total: sem.length,
    porDistribuidora: Array.from(por, ([sigla, n]) => ({ sigla, n })).sort((a, b) => b.n - a.n || a.sigla.localeCompare(b.sigla, "pt-BR")),
    acima: sem
      .filter((l) => comparaNaPrecisao(l.fec as number, l.fec_limite as number, 2) === "acima")
      .map((l) => ({ conjunto: String(l.conjunto), nome: String(l.nome), sigla: String(l.sigla), fec: l.fec as number, limite: l.fec_limite as number })),
  };
}

/**
 * A contagem de conjuntos acima do limite de FEC (da gold) só inclui conjuntos com os 12 meses de FEC publicados: é um mínimo. Com o resumo dos
 * conjuntos sem razão, a frase diz quantos ficam fora, de quem são e quais já passam do limite com os meses publicados.
 */
export function textoContagemFec(g: QualidadeGold, resumo: ResumoSemRazaoFec | null): string {
  const n = g.conjuntos.acima_limite_fec;
  const base = `A contagem de FEC é de pelo menos ${num(n, 0)}: só entram os conjuntos com os 12 meses de FEC publicados.`;
  if (!resumo || resumo.total === 0 || !resumo.porDistribuidora.length) return base;
  const [maior] = resumo.porDistribuidora;
  const outros = resumo.total - maior.n;
  const quem = `${num(maior.n, 0)} da ${maior.sigla}${outros > 0 ? ` e ${num(outros, 0)} de ${outros === 1 ? "outra distribuidora" : "outras distribuidoras"}` : ""}`;
  const acima = resumo.acima.length
    ? ` ${resumo.acima.length === 1 ? "Um deles já passa" : `${num(resumo.acima.length, 0)} deles já passam`} do limite com os meses publicados: ${listaPt(resumo.acima.map((x) => `${x.nome}, conjunto ${x.conjunto} (FEC ${num(x.fec, 2)} contra limite de ${num(x.limite, 2)})`))}.`
    : "";
  return `${base} ${num(resumo.total, 0)} ${resumo.total === 1 ? "conjunto com limite de FEC tem menos meses e fica" : "conjuntos com limite de FEC têm menos meses e ficam"} fora (${quem}).${acima}`;
}

/* ---------------------------------------------------------------- fração de conjuntos: o universo muda */

/**
 * O número de conjuntos com limite muda ao longo da série (e o limite de cada um também): a fração de conjuntos acima do limite mistura
 * desempenho, meta e mudança de universo. A frase diz os números (primeiro ano, o menor, o último) e aponta a fração das unidades
 * consumidoras, que pesa cada conjunto pelo tamanho, como a leitura principal.
 */
export function textoUniversosConjuntos(g: QualidadeGold): string {
  const h = g.conjuntos.historico.filter((x) => x.com_limite > 0);
  if (h.length < 2) return "";
  const primeiro = h[0];
  const ultimo = h[h.length - 1];
  const menor = h.reduce((m, x) => (x.com_limite < m.com_limite ? x : m));
  const itens = [`${num(primeiro.com_limite, 0)} em ${primeiro.ano}`];
  if (menor.ano !== primeiro.ano && menor.ano !== ultimo.ano) itens.push(`${num(menor.com_limite, 0)} em ${menor.ano}`);
  itens.push(`${num(ultimo.com_limite, 0)} em ${ultimo.ano}`);
  return `O número de conjuntos com limite foi de ${listaPt(itens)}, e o limite de cada um também muda: a fração de conjuntos mistura desempenho, meta e mudança de universo. A fração das unidades consumidoras que estão em conjuntos acima do limite pesa cada conjunto pelo seu tamanho e é a leitura principal.`;
}

/* ---------------------------------------------------------------- o maior DEC apurado cruza regras do apurado */

export type ComparacaoApurado = {
  /** Primeiro ano com a parcela apurada (IP + IND) publicada. */
  desde: number;
  /** Primeiro ano em que o apurado publicado é, em todos os conjunto-meses, só IP + IND. */
  uniforme: number | null;
  maiorPublicado: { ano: number; dec: number };
  maiorMesmaDefinicao: { anos: number[]; dec: number };
  referencia: { ano: number; publicado: number; mesmaDefinicao: number };
};

/**
 * Compara o DEC apurado publicado com a parcela apurada refeita pela regra única de hoje (IP + IND, o grupo "apurado" das parcelas), que a
 * gold traz desde o primeiro ano com parcelas. Nulo quando faltam as parcelas.
 */
export function comparacaoApurado(g: QualidadeGold): ComparacaoApurado | null {
  const todos = g.brasil.anual.filter((x) => x.completo && x.dec !== null);
  const comParcela = todos.filter((x) => x.parcelas_dec && x.parcelas_dec.apurado !== null);
  const ref = comParcela.find((x) => x.ano === g.ano_referencia);
  if (comParcela.length < 2 || !ref || ref.dec === null) return null;
  const maiorPub = todos.reduce((m, x) => ((x.dec ?? -1) > (m.dec ?? -1) ? x : m));
  const maxIp = Math.max(...comParcela.map((x) => x.parcelas_dec!.apurado!));
  return {
    desde: comParcela[0].ano,
    uniforme: anoApuradoUniforme(g),
    maiorPublicado: { ano: maiorPub.ano, dec: maiorPub.dec! },
    maiorMesmaDefinicao: { anos: comParcela.filter((x) => centesimos(x.parcelas_dec!.apurado!) === centesimos(maxIp)).map((x) => x.ano), dec: maxIp },
    referencia: { ano: ref.ano, publicado: ref.dec, mesmaDefinicao: ref.parcelas_dec!.apurado! },
  };
}

/**
 * Aviso de quebra para a frase "o maior DEC apurado foi o de ...": o apurado publicado mudou de regra ao longo da série, e a comparação com
 * o ano de referência feita pela mesma definição (a parcela apurada, desde o primeiro ano com parcelas) vai na frase. Vazio sem parcelas.
 */
export function textoQuebraApurado(g: QualidadeGold): string {
  const c = comparacaoApurado(g);
  if (!c) return "";
  const regras =
    c.uniforme !== null
      ? `Antes de ${c.desde} a fonte usa outra desagregação; de ${c.desde} a ${c.uniforme - 1}, o apurado de parte dos conjuntos incluía também interrupções de origem externa ao sistema de distribuição; desde ${c.uniforme}, inclui só as internas.`
      : `Antes de ${c.desde} a fonte usa outra desagregação.`;
  const anos = listaPt(c.maiorMesmaDefinicao.anos.map(String));
  return `O maior valor publicado, o de ${c.maiorPublicado.ano}, cruza regras diferentes do apurado. ${regras} Pela regra de ${c.uniforme ?? c.referencia.ano} aplicada desde ${c.desde} (a parcela apurada do gráfico de parcelas, abaixo), o maior DEC foi o de ${anos} (${num(c.maiorMesmaDefinicao.dec, 2)} h), e ${c.referencia.ano} fechou com ${num(c.referencia.mesmaDefinicao, 2)} h.`;
}

/* ---------------------------------------------------------------- DGC: divergências com o ranking da ANEEL */

export type DivergenciaDgc = { ano: number; rotulo: string; cnpj: string | null; publicado: number | null; calculado: number | null; diferenca: number | null };

/** Comparações em que o DGC calculado difere do publicado além da tolerância, de todos os anos da reconciliação. */
export function divergenciasDgc(g: QualidadeGold): DivergenciaDgc[] {
  return g.reconciliacao.dgc.flatMap((r) =>
    r.divergentes.map((d) => ({ ano: r.ano, rotulo: d.sigla_ranking ?? d.empresa, cnpj: d.cnpj, publicado: d.dgc_publicado, calculado: d.dgc_calculado, diferenca: d.diferenca })),
  );
}

/** A reconciliação do DGC em uma frase: quantas comparações, quantas divergem e quais, sem explicar o que a base não explica. */
export function textoDivergenciasDgc(g: QualidadeGold): string {
  const r = g.reconciliacao.dgc;
  if (!r.length) return "";
  const comparados = r.reduce((s, x) => s + x.comparados, 0);
  const d = divergenciasDgc(g);
  const periodo = `${r[0].ano} a ${r[r.length - 1].ano}`;
  if (!d.length) return `De ${periodo}, ${num(comparados, 0)} comparações entre o DGC publicado pela ANEEL e o calculado aqui ficaram dentro da tolerância de 0,01.`;
  const lista = listaPt(d.map((x) => `${x.rotulo} em ${x.ano} (publicado ${num(x.publicado, 2)}, calculado ${num(x.calculado, 2)})`));
  return `De ${periodo}, ${num(d.length, 0)} de ${num(comparados, 0)} comparações entre o DGC publicado pela ANEEL e o calculado aqui diferem em mais de 0,01: ${lista}. Nesses casos o limite agregado calculado não coincide com o da ANEEL; a causa não está nos dados publicados, e revisão posterior dos indicadores, decisão judicial ou limite diferente na nota técnica são hipóteses não verificadas.`;
}

/** Dica do gráfico de pontos: a distribuidora cujo DGC calculado difere do publicado no ano de referência (por CNPJ). */
export function detalheDgcDoAno(g: QualidadeGold): Record<string, string> {
  const out: Record<string, string> = {};
  for (const x of divergenciasDgc(g)) {
    if (x.ano !== g.ano_referencia || !x.cnpj || x.publicado === null || x.calculado === null) continue;
    out[x.cnpj] = `DGC calculado ${num(x.calculado, 3)} difere do publicado pela ANEEL, ${num(x.publicado, 2)}`;
  }
  return out;
}

/* ---------------------------------------------------------------- abertura: perímetro e divulgado */

/**
 * Nota do cartão do DEC e do FEC sobre o perímetro: o número da abertura é de todas as distribuidoras, e a ANEEL divulga o das concessionárias.
 * Vazio quando o ano não tem o recorte das concessionárias.
 */
export function notaPerimetroAbertura(g: QualidadeGold, ind: Indicador): string {
  const a = anoBrasil(g, g.ano_referencia);
  const v = ind === "dec" ? a?.dec_concessionarias : a?.fec_concessionarias;
  if (!a || v === null || v === undefined) return "";
  const un = ind === "dec" ? " h" : "";
  return `Só as concessionárias, o universo do número que a ANEEL divulga: ${num(v, 2)}${un}.`;
}

/** Nota curta do cartão de compensações: o total divulgado pela ANEEL, quando a soma dos dados abertos difere além da precisão divulgada. */
export function notaDivulgadoCartao(g: QualidadeGold): string {
  const c = g.compensacoes;
  const a = c.anual.find((x) => x.ano === c.ano_referencia);
  const d = a?.divulgado_aneel ?? null;
  if (!a || !d || d.valor === null || d.dentro_da_precisao_valor !== false) return "";
  return `A ANEEL divulga ${reaisMilhoes(d.valor, 0)}: a diferença passa da precisão divulgada e não foi explicada.`;
}

/* ---------------------------------------------------------------- reclamações: duas bases */

/** Taxa por mil UCs escrita na base de 100 mil UCs da Ouvidoria (só a base de exibição muda; a taxa da gold é a mesma). */
export function taxaNaBaseDaOuvidoria(porMilUcs: number | null | undefined): number | null {
  return porMilUcs === null || porMilUcs === undefined || !Number.isFinite(porMilUcs) ? null : porMilUcs * 100;
}

/* ---------------------------------------------------------------- definições no ponto de uso (texto visível) */

export const DEFINICAO_CONJUNTO = "Conjunto elétrico é uma subdivisão da área de uma distribuidora para a qual a ANEEL fixa limites de DEC e de FEC.";
export const DEFINICAO_LIMITES_INDIVIDUAIS =
  "Os limites individuais valem para cada unidade consumidora: DIC (duração de interrupção individual), FIC (frequência de interrupção individual), DMIC (duração máxima de interrupção contínua), DICRI (duração da interrupção individual ocorrida em dia crítico) e DISE (duração da interrupção individual ocorrida em situação de emergência).";

/* ---------------------------------------------------------------- texto para o leitor: sem marcação crua nem nome interno */

/** Nomes de campo e termos internos que não são palavras do leitor, e o que vai no lugar. */
const TERMOS_INTERNOS: [RegExp, string][] = [
  // "(dec, fec)" e "(dec_concessionarias, fec_concessionarias)": só nomes de campo entre parênteses
  [/\s*\(\s*(?:(?:dec|fec)(?:_[a-z]+)?)(?:\s*,\s*(?:dec|fec)(?:_[a-z]+)?)*\s*\)/g, ""],
  [/\s*\((?:Nie|NumOcorr)\)/g, ""],
  [/vai em dec_concessionarias e fec_concessionarias/g, "aparece à parte"],
  [/\bdec_concessionarias\b/g, "DEC das concessionárias"],
  [/\bfec_concessionarias\b/g, "FEC das concessionárias"],
  [/\bNumCon\b/g, "número de UCs informado"],
  [/\bNumOcorr\b/g, "total de ocorrências"],
  [/\bNie\b/g, "ocorrências com interrupção"],
  [/\bo silver\b/g, "a base tratada"],
  [/\bsilver\b/g, "base tratada"],
  [/\bbronze\b/g, "arquivo original"],
  [/\bhoje (\d{4}-\d{2}-\d{2})/g, "processamento em $1"],
];

/**
 * Texto de uma fonte ou de uma regra escrito para o leitor: tira a marcação copiada da fonte (__negrito__, _itálico_, itens com asterisco e
 * quebras de linha) e troca nomes de campo e termos internos (silver, bronze, NumCon, dec_concessionarias) por palavras comuns. Idempotente.
 */
export function paraLeitor(texto: string): string {
  let t = texto;
  t = t.replace(/__([^_\n]+?)__/g, "$1").replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,;:]|$)/g, "$1$2");
  t = t.replace(/\s*\n\s*\*\s+/g, (m, pos: number, todo: string) => (/[;:,]\s*$/.test(todo.slice(0, pos)) ? " " : "; "));
  t = t.replace(/\s*\n+\s*/g, " ");
  for (const [de, para] of TERMOS_INTERNOS) t = t.replace(de, para);
  return t.replace(/\s{2,}/g, " ").trim();
}

/** Corta um texto longo no fim de uma frase, com o aviso de que ele foi resumido (a descrição completa fica na página da fonte). */
export function resumirTexto(texto: string, max = 700): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const fim = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("; "));
  const base = fim >= max * 0.4 ? corte.slice(0, fim + 1) : corte.slice(0, corte.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "…";
  return `${base} (texto resumido; a descrição completa está na página da fonte)`;
}

/** Ficha de origem com os textos escritos para o leitor (sem marcação crua nem termo interno) e a descrição longa da fonte resumida. */
export function limpaProveniencia<T extends Proveniencia>(p: T): T {
  return {
    ...p,
    notas_fonte: p.notas_fonte ? resumirTexto(paraLeitor(p.notas_fonte)) : p.notas_fonte,
    limitacoes: p.limitacoes.map(paraLeitor),
    transformacoes: p.transformacoes.map(paraLeitor),
    formula: p.formula ? paraLeitor(p.formula) : p.formula,
  };
}

/* ---------------------------------------------------------------- conjuntos do município (ficha do mapa) */

/** Colunas da tabela dos conjuntos que atendem o município escolhido: DEC, FEC, o limite de cada um e a razão. */
export const COLUNAS_CONJUNTOS_MUNICIPIO: ColunaTabela[] = [
  { id: "nome", rotulo: "Conjunto", tipo: "texto" },
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto", categorica: true },
  { id: "situacao_dec", rotulo: "DEC diante do limite", tipo: "texto", categorica: true },
  { id: "dec", rotulo: "DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "dec_limite", rotulo: "Limite de DEC", tipo: "numero", unidade: "h", casas: 2 },
  { id: "razao_dec", rotulo: "DEC ÷ limite", tipo: "numero", casas: 3 },
  { id: "fec", rotulo: "FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "fec_limite", rotulo: "Limite de FEC", tipo: "numero", unidade: "interrupções", casas: 2 },
  { id: "razao_fec", rotulo: "FEC ÷ limite", tipo: "numero", casas: 3 },
  { id: "situacao_fec", rotulo: "FEC diante do limite", tipo: "texto", categorica: true },
  { id: "conjunto", rotulo: "Código", tipo: "texto" },
];

/**
 * Linhas do ano (conjuntosDoCsv) dos conjuntos citados para o município, na ordem em que a base os cita, e os códigos que a base cita
 * mas que não têm valor anual nesse ano (nunca preenchidos com zero).
 */
export function conjuntosDoMunicipio(linhasAno: readonly LinhaTabela[], codigos: readonly string[]): { linhas: LinhaTabela[]; semValor: string[] } {
  const porCodigo = new Map(linhasAno.map((l) => [String(l.conjunto), l]));
  const linhas: LinhaTabela[] = [];
  const semValor: string[] = [];
  for (const c of codigos) {
    const l = porCodigo.get(c);
    if (l) linhas.push(l);
    else semValor.push(c);
  }
  return { linhas, semValor };
}

/** O que o mapa pinta num município com vários conjuntos: o maior ou o menor deles, com o número de conjuntos que a base cita. */
export function textoCorDoMapa(m: MunicipioQualidade, medida: MedidaMapa): string {
  const maior = medida.endsWith("max");
  const valor = m[medida];
  if (valor === null || !m.conjuntos.length) return "";
  const un = medida.startsWith("dec") ? `${num(valor, 2)} h` : `${num(valor, 2)} interrupções`;
  if (m.conjuntos.length === 1) return `Cor do mapa: o valor do único conjunto citado, ${un}.`;
  return `Cor do mapa: ${maior ? "o maior" : "o menor"} valor entre os ${num(m.conjuntos.length, 0)} conjuntos citados, ${un}.`;
}

/**
 * O efeito da cobertura parcial do FEC no número nacional: o FEC do ano de referência e a soma das parcelas internas, comparados nas duas
 * casas publicadas. Vazio sem as duas.
 */
export function textoFecBrasilConfere(g: QualidadeGold): string {
  const a = anoBrasil(g, g.ano_referencia);
  const parcelas = a?.parcelas_fec?.apurado ?? null;
  if (!a || a.fec === null || parcelas === null) return "";
  return centesimos(a.fec) === centesimos(parcelas)
    ? `No Brasil, o FEC de ${a.ano} (${num(a.fec, 2)}) e a soma das parcelas internas coincidem nas duas casas: a ressalva não muda o número nacional.`
    : `No Brasil, o FEC de ${a.ano} (${num(a.fec, 2)}) difere da soma das parcelas internas (${num(parcelas, 2)}).`;
}
