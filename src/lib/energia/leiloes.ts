/**
 * Lógica pura das páginas de Leilões (ACR e transmissão): linhas de gráfico e tabela, frases citáveis derivadas da gold,
 * o modelo do laboratório de leilão descendente e a escolha do logotipo de um grupo a partir do manifesto de logos.
 * A conta dos números publicados roda no pipeline (pipeline/energia/modulos/leiloes.py); aqui só se arruma o que a gold traz.
 */
import { dataBR, mesAno, num, pct, reais } from "./formato";
import type { IdCategoria, IdEntrada, IdSituacao, LeiloesGold } from "./tipos-leiloes";

export const ROTA_LEILOES = "/setor-eletrico/leiloes";
export const ROTA_LEILOES_TRANSMISSAO = `${ROTA_LEILOES}/transmissao`;
export const FONTE_LEILOES = "ANEEL, Resultado de Leilões de Geração";
export const FONTE_TRANSMISSAO = "ANEEL, Resultado de Leilões de Transmissão";

export const PAGINAS_LEILOES = [
  { id: "acr", href: ROTA_LEILOES, rotulo: "Geração no ACR", descricao: "O que o mercado regulado comprou, de quem, a que preço, e o que já opera?" },
  { id: "transmissao", href: ROTA_LEILOES_TRANSMISSAO, rotulo: "Transmissão", descricao: "Quanto de receita anual os leilões de linhas contrataram, corrigida pelo IPCA, e com que deságio?" },
] as const;

export const ORDEM_CATEGORIAS: readonly IdCategoria[] = ["uhe", "pch", "eolica", "solar", "biomassa", "gas", "oleo", "carvao"];

/** Cor por categoria de fonte: a mesma identidade das fontes no observatório (Geração e Expansão). */
export const COR_CATEGORIA_LEILAO: Record<IdCategoria, string> = {
  uhe: "var(--serie-hidraulica)",
  pch: "var(--serie-comp-1)",
  eolica: "var(--serie-eolica)",
  solar: "var(--serie-solar)",
  biomassa: "var(--cor-sucesso)",
  gas: "var(--serie-termica)",
  oleo: "var(--serie-6)",
  carvao: "var(--serie-1)",
};
/** Nome curto da categoria para eixo e legenda; o nome completo vem da gold. */
export const CURTO_CATEGORIA: Record<IdCategoria, string> = {
  uhe: "Hidrelétrica",
  pch: "PCH e CGH",
  eolica: "Eólica",
  solar: "Solar",
  biomassa: "Biomassa",
  gas: "Gás natural",
  oleo: "Óleo",
  carvao: "Carvão",
};

export const ORDEM_SITUACOES: readonly IdSituacao[] = ["operacao", "construcao", "nao_iniciada", "encerrada", "sem_registro", "sem_ceg"];
export const COR_SITUACAO: Record<IdSituacao, string> = {
  operacao: "var(--cor-energia)",
  construcao: "var(--escala-seq-3)",
  nao_iniciada: "var(--escala-seq-2)",
  encerrada: "var(--escala-div-neg-1)",
  sem_registro: "var(--cor-mineral-soft)",
  sem_ceg: "var(--serie-referencia)",
};
export const CURTO_SITUACAO: Record<IdSituacao, string> = {
  operacao: "Em operação",
  construcao: "Em construção",
  nao_iniciada: "Obra não iniciada",
  encerrada: "Outorga encerrada",
  sem_registro: "Sem situação identificada",
  sem_ceg: "Sem código da usina",
};
export const ROTULO_ENTRADA: Record<IdEntrada, string> = {
  antes_do_leilao: "Já operava antes do leilão (ampliação ou usina existente)",
  ate_ano_a: "Entrou em operação até o fim do ano A",
  depois_ano_a: "Entrou em operação depois do ano A",
  sem_data: "Sem data de entrada no SIGA",
};
export const COR_ENTRADA: Record<IdEntrada, string> = {
  antes_do_leilao: "var(--cor-mineral-soft)",
  ate_ano_a: "var(--cor-energia)",
  depois_ano_a: "var(--escala-div-neg-1)",
  sem_data: "var(--serie-referencia)",
};

export const COR_TIPO_LEILAO: Record<string, string> = {
  "A-3": "var(--escala-seq-2)",
  "A-4": "var(--escala-seq-3)",
  "A-5": "var(--escala-seq-4)",
  "A-6": "var(--escala-seq-5)",
  "A-7": "var(--cor-energia-dark)",
  LER: "var(--serie-comp-2)",
  FA: "var(--serie-comp-3)",
  Estruturante: "var(--serie-comp-1)",
};

/** "MWmédio" com separador de milhar e uma casa. */
export const mwmed = (v: number | null | undefined, casas = 1) => (v == null ? "sem dado" : `${num(v, casas)} MWmédio`);
export const rsMwh = (v: number | null | undefined, casas = 2) => (v == null ? "sem dado" : `${reais(v, casas)}/MWh`);

/** Anos do primeiro ao último leilão, inclusive os anos sem leilão na base (que viram ausência, nunca zero). */
/**
 * Número do leilão na forma em que a ANEEL o designa nos editais ("Leilão nº 10/2013"). O conjunto aberto grava "AAAA/N"
 * (NumLeilao = "2013/10"), que na prosa se confunde com ano e mês; a página exibe "10/2013" e os downloads mantêm o campo da fonte.
 */
export function numeroAneel(bruto: string | null | undefined): string {
  const m = /^(\d{4})\/(\d{1,3})$/.exec(String(bruto ?? "").trim());
  return m ? `${Number(m[2])}/${m[1]}` : String(bruto ?? "");
}

export function anosContinuos(g: Pick<LeiloesGold, "cobertura">): string[] {
  if (!g.cobertura.anos) return [];
  const [a, b] = g.cobertura.anos;
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

/** Energia contratada por ano, empilhada por categoria ou por tipo; ano sem leilão na base sai com todas as colunas nulas. */
export function linhasEnergiaPorAno(g: Pick<LeiloesGold, "cobertura" | "por_ano">, por: "categoria" | "tipo"): Record<string, string | number | null>[] {
  const idx = new Map(g.por_ano.map((a) => [a.ano, a]));
  return anosContinuos(g).map((ano) => {
    const a = idx.get(ano);
    const linha: Record<string, string | number | null> = { ano };
    const chaves = por === "categoria" ? ORDEM_CATEGORIAS : g.cobertura.tipos_presentes.map((t) => t.id);
    for (const k of chaves) {
      const v = a ? (por === "categoria" ? a.por_categoria[k as IdCategoria] : a.por_tipo[k]) : null;
      linha[k] = a ? (v ?? 0) : null;
    }
    return linha;
  });
}

/** Preço médio por categoria e ano (uma coluna por categoria); ano sem venda da categoria é ausência (lacuna na linha). */
export function linhasPrecoPorAno(g: Pick<LeiloesGold, "cobertura" | "preco_ano_categoria">, real: boolean): Record<string, string | number | null>[] {
  const m = new Map<string, number | null>();
  for (const x of g.preco_ano_categoria) m.set(`${x.ano}|${x.categoria}`, real ? x.preco_medio_real : x.preco_medio);
  return anosContinuos(g).map((ano) => {
    const linha: Record<string, string | number | null> = { ano };
    for (const k of ORDEM_CATEGORIAS) linha[k] = m.get(`${ano}|${k}`) ?? null;
    return linha;
  });
}

/** Categorias com ao menos um preço na série (as demais não viram linha vazia na legenda). */
export function categoriasComPreco(g: Pick<LeiloesGold, "preco_ano_categoria">): IdCategoria[] {
  const presentes = new Set(g.preco_ano_categoria.filter((x) => x.preco_medio != null).map((x) => x.categoria));
  return ORDEM_CATEGORIAS.filter((k) => presentes.has(k));
}

/** Energia contratada por ano do leilão, empilhada pela situação atual. */
export function linhasEntregaPorAno(g: Pick<LeiloesGold, "cobertura" | "entrega">): Record<string, string | number | null>[] {
  const idx = new Map(g.entrega.por_ano.map((a) => [a.ano, a.situacao]));
  return anosContinuos(g).map((ano) => {
    const s = idx.get(ano);
    const linha: Record<string, string | number | null> = { ano };
    for (const k of ORDEM_SITUACOES) linha[k] = s ? s[k].energia_mwmed : null;
    return linha;
  });
}

/** Participação de uma situação na energia contratada (0 a 100); null sem energia. */
export function participacao(g: Pick<LeiloesGold, "entrega" | "totais">, s: IdSituacao): number | null {
  const t = g.totais.energia_mwmed;
  return t ? (100 * g.entrega.total[s].energia_mwmed) / t : null;
}

/** Nome de exibição de um leilão: "39º LEN (A-5)". */
export function nomeLeilao(l: { nome: string | null; tipo: string; leilao: string }): string {
  return `${l.nome ?? `Leilão ${numeroAneel(l.leilao)}`} (${l.tipo})`;
}

export type FraseCitavel = { id: string; texto: string; referencia: string };

/**
 * Frases para citação, todas calculadas da gold com período e fonte. Regras: só fatos medidos, sem adjetivo; a categoria
 * entra só quando tem preço no primeiro e no último ano de venda; o grupo é dito como "controla a usina" na data do cadastro, nunca como vencedor.
 */
export function frasesCitaveis(g: LeiloesGold): FraseCitavel[] {
  const out: FraseCitavel[] = [];
  const ref = g.referencias;
  const base = `${FONTE_LEILOES} (arquivo gerado em ${dataBR(ref.arquivo_gerado_em ?? ref.ultimo_leilao)})`;
  const t = g.totais;
  out.push({
    id: "total",
    texto: `Entre ${dataBR(ref.primeiro_leilao)} e ${dataBR(ref.ultimo_leilao)}, os ${num(g.cobertura.leiloes, 0)} leilões de geração do ACR na base aberta da ANEEL contrataram ${mwmed(t.energia_mwmed)} de ${num(t.empreendimentos, 0)} empreendimentos vencedores.`,
    referencia: `${base}. Não inclui leilões de energia existente, de ajuste, de reserva de capacidade e de sistemas isolados.`,
  });
  const op = participacao(g, "operacao");
  const enc = participacao(g, "encerrada");
  const sem = participacao(g, "sem_registro");
  if (op != null && ref.siga) {
    out.push({
      id: "entrega",
      texto: `${pct(op, 1)} da energia contratada nesses leilões vem de usinas que estavam em operação no cadastro da ANEEL em ${dataBR(ref.siga)}; ${pct(enc, 1)} vem de usinas com outorga revogada ou extinta desde 2015 e ${pct(sem, 1)} de usinas fora do cadastro sem ato de encerramento identificado.`,
      referencia: `${base}; ANEEL, SIGA de ${dataBR(ref.siga)} e atos de outorga até ${dataBR(ref.atos)}. Situação da usina, não cumprimento do contrato.`,
    });
  }
  const u = g.ultimo_leilao;
  if (u.preco_medio != null) {
    out.push({
      id: "ultimo",
      texto: `O leilão mais recente da base, o ${nomeLeilao(u)}, de ${dataBR(u.data)}, contratou ${mwmed(u.energia_mwmed)} a ${rsMwh(u.preco_medio)} em média (ponderada pela energia), com deságio agregado de ${pct(u.desagio_agregado_pct, 2)} sobre o preço teto.`,
      referencia: base,
    });
  }
  for (const k of ["eolica", "solar"] as const) {
    const c = g.por_categoria.find((x) => x.id === k);
    if (!c?.primeiro_ano || !c.ultimo_ano || c.primeiro_ano.ano === c.ultimo_ano.ano) continue;
    if (c.primeiro_ano.preco_medio_real == null || c.ultimo_ano.preco_medio_real == null) continue;
    out.push({
      id: `preco-${k}`,
      texto: `Em reais de ${mesAno(ref.ipca_ate)}, a energia ${k === "eolica" ? "eólica" : "solar"} foi contratada a ${rsMwh(c.primeiro_ano.preco_medio_real)} em ${c.primeiro_ano.ano} e a ${rsMwh(c.ultimo_ano.preco_medio_real)} em ${c.ultimo_ano.ano} (médias ponderadas pela energia vendida no ano; em valores da época, ${rsMwh(c.primeiro_ano.preco_medio)} e ${rsMwh(c.ultimo_ano.preco_medio)}).`,
      referencia: `${base}; IBGE, IPCA (tabela 1737) até ${mesAno(ref.ipca_ate)}. O preço corrigido é régua de comparação, não o preço vigente do contrato.`,
    });
  }
  const q = g.desagio.geral;
  if (q.mediana != null) {
    out.push({
      id: "desagio",
      texto: `Metade dos ${num(q.n, 0)} empreendimentos com preço teve deságio de até ${pct(q.mediana, 2)} sobre o preço teto; um quarto teve deságio acima de ${pct(q.p75, 2)}.`,
      referencia: `${base}. Deságio mede a distância ao teto do edital; o número de proponentes não está no arquivo.`,
    });
  }
  const gc = g.grupos_controle?.maiores[0];
  if (gc && ref.siga) {
    out.push({
      id: "grupo",
      texto: `Pelo controle das usinas em ${dataBR(ref.siga)}, o grupo ${gc.nome ?? "sem nome publicado"} reúne a maior parcela da energia contratada nesses leilões: ${mwmed(gc.energia_mwmed)} em ${num(gc.empreendimentos, 0)} contratos. Esse grupo não é necessariamente o vencedor na data do leilão.`,
      referencia: `${base}; ANEEL, SIGA e Composição Societária, como publicados no módulo Empresas.`,
    });
  }
  return out;
}

/** Frases citáveis da página de transmissão, do último ano com leilão no arquivo. */
export function frasesTransmissao(g: LeiloesGold): FraseCitavel[] {
  const t = g.transmissao;
  const u = t.por_ano.at(-1);
  if (!u) return [];
  const base = `${FONTE_TRANSMISSAO}, até ${dataBR(t.periodo.fim)}; IBGE, IPCA até ${mesAno(g.referencias.ipca_ate)}`;
  const out: FraseCitavel[] = [
    {
      id: "ultimo-ano",
      texto: `Os leilões de transmissão de ${u.ano} contrataram ${num(u.lotes_contratados, 0)} lotes com receita anual permitida (RAP) de R$ ${num(u.rap_vencedora_rs_mi, 1)} milhões em valores da época, ou R$ ${num(u.rap_vencedora_real_rs_mi, 1)} milhões em reais de ${mesAno(g.referencias.ipca_ate)}, com deságio agregado de ${pct(u.desagio_agregado_pct, 2)} sobre a RAP do edital.`,
      referencia: base,
    },
  ];
  if (t.desagio_lotes.mediana != null) {
    out.push({
      id: "desagio-lotes",
      texto: `Nos ${num(t.desagio_lotes.n, 0)} lotes contratados desde ${t.periodo.inicio?.slice(0, 4) ?? "o início do arquivo"}, o deságio mediano foi de ${pct(t.desagio_lotes.mediana, 2)}; ${num(t.lotes_desagio_zero, 0)} lotes saíram sem deságio.`,
      referencia: base,
    });
  }
  return out;
}

/* ===================================================================== produtos A-x */

export type LinhaProduto = {
  tipo: string;
  anoLeilao: number;
  /** Ano A de início do suprimento; null quando o nome do produto não fixa (reserva, fontes alternativas, estruturante). */
  anoA: number | null;
  /** Anos do eixo, do leilão ao ano A mais dois (ou cinco anos, sem ano A). */
  anos: number[];
};

export function linhaProduto(tipo: string, anoLeilao: number): LinhaProduto {
  const m = /^A-(\d)$/.exec(tipo);
  const anoA = m ? anoLeilao + Number(m[1]) : null;
  const fim = (anoA ?? anoLeilao + 5) + 2;
  return { tipo, anoLeilao, anoA, anos: Array.from({ length: fim - anoLeilao + 1 }, (_, i) => anoLeilao + i) };
}

/* ===================================================================== laboratório */

export type ParametrosLeilao = {
  /** Preço teto do produto (R$/MWh). */
  teto: number;
  /** Demanda declarada pelas distribuidoras (MWmédio). */
  demanda: number;
  /** Número de proponentes, cada um com um lote do mesmo tamanho. */
  proponentes: number;
  /** Energia oferecida por proponente (MWmédio). */
  lote: number;
  /** Menor e maior custo entre os proponentes (R$/MWh), espalhados de modo uniforme. */
  custoMin: number;
  custoMax: number;
  /** Quanto o preço cai a cada rodada (R$/MWh). */
  passo: number;
};

export type Rodada = { rodada: number; preco: number; proponentes: number; oferta: number };

export type ResultadoLeilao = {
  custos: number[];
  rodadas: Rodada[];
  /** Preço de fechamento (R$/MWh): o da rodada em que a oferta coube na demanda; null se ninguém ofertou no teto. */
  preco: number | null;
  desagioPct: number | null;
  vencedores: number;
  contratada: number;
  /** Demanda que ficou sem contratar (MWmédio). */
  faltou: number;
  /** Margem média dos vencedores sobre o próprio custo (R$/MWh). */
  margemMedia: number | null;
};

export const PARAMETROS_LEILAO_INICIAIS: ParametrosLeilao = { teto: 400, demanda: 600, proponentes: 10, lote: 100, custoMin: 180, custoMax: 380, passo: 5 };

/**
 * Leilão de preço descendente, simplificado: a cada rodada o preço cai `passo`; quem tem custo acima do preço sai; o leilão
 * para quando a oferta restante cabe na demanda. Todos os vencedores recebem o preço de fechamento. Fora do modelo: lances
 * por produto, fase discriminatória, sobra de oferta, garantias, margem de transmissão e custo de capital.
 */
export function leilaoDescendente(p: ParametrosLeilao): ResultadoLeilao {
  const n = Math.max(1, Math.round(p.proponentes));
  const custos = Array.from({ length: n }, (_, i) => (n === 1 ? p.custoMin : p.custoMin + ((p.custoMax - p.custoMin) * i) / (n - 1)));
  const rodadas: Rodada[] = [];
  const ativos = (preco: number) => custos.filter((c) => c <= preco + 1e-9).length;
  let preco = p.teto;
  let k = ativos(preco);
  rodadas.push({ rodada: 1, preco, proponentes: k, oferta: k * p.lote });
  if (k === 0) return { custos, rodadas, preco: null, desagioPct: null, vencedores: 0, contratada: 0, faltou: p.demanda, margemMedia: null };
  const passo = Math.max(0.5, p.passo);
  while (k * p.lote > p.demanda && preco - passo >= 0) {
    const proximo = preco - passo;
    const kp = ativos(proximo);
    // a rodada seguinte esvaziaria o leilão: fecha no preço atual com os que ainda cabem na demanda
    if (kp === 0) break;
    preco = proximo;
    k = kp;
    rodadas.push({ rodada: rodadas.length + 1, preco, proponentes: k, oferta: k * p.lote });
  }
  const cabem = Math.min(k, Math.floor(p.demanda / p.lote));
  const vencedoresCustos = custos.filter((c) => c <= preco + 1e-9).slice(0, cabem);
  const contratada = vencedoresCustos.length * p.lote;
  return {
    custos,
    rodadas,
    preco,
    desagioPct: p.teto ? 100 * (1 - preco / p.teto) : null,
    vencedores: vencedoresCustos.length,
    contratada,
    faltou: Math.max(0, p.demanda - contratada),
    margemMedia: vencedoresCustos.length ? vencedoresCustos.reduce((s, c) => s + (preco - c), 0) / vencedoresCustos.length : null,
  };
}

/* ===================================================================== logos */

/** Tom do fundo para o qual a companhia desenhou o arquivo (manifesto): a placa do logo segue esse tom. */
export type FundoLogo = "claro" | "escuro" | null;
export type LogoGrupo = { src: string; nome: string; cnpj: string; origem: string | null; data: string | null; noTopo: boolean; papel: string | null; fundo: FundoLogo; largura: number | null; altura: number | null };
export type EntradaLogo = { arquivo: string; nome: string; cnpjs: string[]; origem: string | null; data: string | null; papel: string | null; fundo: FundoLogo; largura: number | null; altura: number | null };

const so14 = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d : null;
};

/**
 * Lê o manifesto de logos (public/energia/logos/manifesto.json) de forma tolerante: aceita `{ logos: [...] }`, `{ itens: [...] }`
 * ou uma lista; em cada item, os CNPJs em `cnpj_holding`, `cnpj_grupo`, `cnpj`, `holding_cnpj`, `grupo_cnpj` ou `cnpjs`; o arquivo
 * em `arquivo`, `src` ou `url` (relativo a /energia/logos/ quando não começa por "/"). Item sem arquivo ou sem CNPJ válido sai.
 */
export function normalizaManifestoLogos(bruto: unknown): EntradaLogo[] {
  const lista = Array.isArray(bruto)
    ? bruto
    : bruto && typeof bruto === "object"
      ? ((bruto as Record<string, unknown>).logos ?? (bruto as Record<string, unknown>).itens ?? [])
      : [];
  if (!Array.isArray(lista)) return [];
  const out: EntradaLogo[] = [];
  for (const it of lista) {
    if (!it || typeof it !== "object") continue;
    const x = it as Record<string, unknown>;
    const arq = String(x.arquivo ?? x.src ?? x.url ?? "").trim();
    if (!arq || /^[a-z]+:/i.test(arq) || arq.includes("..") || arq.startsWith("//")) continue;
    const src = arq.startsWith("/") ? arq : `/energia/logos/${arq.replace(/^\.?\/+/, "")}`;
    const cnpjs = [x.cnpj_holding, x.cnpj_grupo, x.cnpj, x.holding_cnpj, x.grupo_cnpj, ...(Array.isArray(x.cnpjs) ? x.cnpjs : [])]
      .map(so14)
      .filter((c): c is string => !!c);
    if (!cnpjs.length) continue;
    out.push({
      arquivo: src,
      nome: String(x.nome_exibicao ?? x.nome ?? x.empresa ?? x.rotulo ?? "").trim() || "logotipo",
      cnpjs: Array.from(new Set(cnpjs)),
      origem: x.url_origem != null ? String(x.url_origem) : x.origem != null ? String(x.origem) : x.fonte != null ? String(x.fonte) : null,
      data: x.data != null ? String(x.data) : x.capturado_em != null ? String(x.capturado_em) : null,
      papel: x.papel != null ? String(x.papel) : null,
      fundo: x.fundo === "escuro" ? "escuro" : x.fundo === "claro" ? "claro" : null,
      largura: typeof x.largura === "number" ? x.largura : null,
      altura: typeof x.altura === "number" ? x.altura : null,
    });
  }
  return out;
}

/**
 * Logotipo de um grupo: primeiro o do próprio grupo (topo da cadeia); senão, o da holding mais alta da cadeia de controle que tenha
 * logotipo no manifesto (a gold publica a cadeia do topo para baixo). Sem correspondência por CNPJ, null (a página mostra só o nome). Nunca por semelhança de nome.
 */
export function logoDoGrupo(manifesto: readonly EntradaLogo[], grupo: { cnpj: string; cadeia_cnpjs: readonly string[] }): LogoGrupo | null {
  if (!manifesto.length) return null;
  const por = new Map<string, EntradaLogo>();
  for (const e of manifesto) for (const c of e.cnpjs) if (!por.has(c)) por.set(c, e);
  const candidatos = [grupo.cnpj, ...grupo.cadeia_cnpjs];
  for (const c of candidatos) {
    const e = por.get(c);
    if (e) return { src: e.arquivo, nome: e.nome, cnpj: c, origem: e.origem, data: e.data, noTopo: c === grupo.cnpj, papel: e.papel, fundo: e.fundo, largura: e.largura, altura: e.altura };
  }
  return null;
}
