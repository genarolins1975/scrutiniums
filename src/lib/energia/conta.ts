/**
 * Lógica pura da página Conta de luz (/setor-eletrico/conta-de-luz), sem React e
 * testável em node (src/tests/energia-conta.test.ts).
 *
 * Por que um arquivo próprio: os componentes "use client" só podem exportar
 * componentes, e as mesmas linhas precisam alimentar o gráfico, a tabela
 * equivalente e a exportação (seção 11.7 da especificação: "equivalência entre
 * gráfico, tabela e exportação"). Cada função `linhas*` monta UMA matriz que o
 * gráfico e a tabela recebem iguais; o teste confere essa matriz contra o CSV
 * publicado pelo pipeline.
 *
 * O que fica aqui:
 *  - a reaplicação do simulador (`simular`), única conta refeita na interface,
 *    espelho de `simular` em pipeline/energia/modulos/conta.py, conferida contra
 *    `simulador.casos_referencia` da gold;
 *  - a montagem das linhas dos gráficos e tabelas, que só seleciona, ordena e
 *    converte unidade (R$ para R$ bilhões) de números publicados na gold;
 *  - as respostas curtas de cada painel, geradas por regra determinística a
 *    partir dos números publicados (seção 7.4: texto automático testável). Nenhuma
 *    frase traz número fixo: todo número vem do argumento.
 *
 * Ausência continua ausência: null nunca vira zero, e a resposta diz "sem dado"
 * quando o número falta.
 */
import type {
  Bandeiras,
  ChaveTarifa,
  ClasseSimuladorId,
  Composicao,
  ContaGold,
  EventoB1,
  FinanciamentoCde,
  GrupoCdeId,
  GrupoComponenteId,
  JanelaInflacao,
  Ligacao,
  PontoEvolucao,
  Simulador,
  Subsidios,
  TarifaVigente,
  VigenciaB1,
} from "./tipos-conta";
import { campo, tiposUrl, type Leitor } from "./estadoUrl";
import { AUSENTE, dataBR, mesAno, num, pct, reais } from "./formato";
import { LIMITE_COMPARACAO } from "./tabela";

/* ---------- identidade visual (só tokens; cor nunca é o único portador) ---------- */

/** Ordem de empilhamento dos grupos: custos positivos primeiro, itens que reduzem a tarifa por último. */
export const ORDEM_GRUPOS: GrupoComponenteId[] = ["energia", "transmissao", "distribuicao", "perdas", "encargos", "outros", "creditos"];

/**
 * Cores dos grupos da composição. Validadas com o verificador de paleta (pares
 * vizinhos na pilha separáveis para daltonismo): energia, transmissão,
 * distribuição, perdas e encargos ficam do lado positivo; outros (cinza, o
 * "demais itens" usual) e créditos (carvão) do lado negativo.
 */
export const COR_GRUPO: Record<GrupoComponenteId, string> = {
  energia: "var(--serie-comp-1)",
  transmissao: "var(--serie-solar)",
  distribuicao: "var(--serie-sm-n)",
  perdas: "var(--serie-termica)",
  encargos: "var(--cor-energia)",
  outros: "var(--serie-referencia)",
  creditos: "var(--serie-1)",
};

/** Bandeiras: as cores lembram o nome oficial, e a sigla escrita na célula carrega a identidade. */
export const COR_BANDEIRA: Record<string, string> = {
  Verde: "var(--serie-eolica)",
  Amarela: "var(--serie-solar)",
  "Vermelha P1": "var(--serie-termica)",
  "Vermelha P2": "var(--cor-erro)",
  "Escassez Hídrica": "var(--serie-1)",
};

export const SIGLA_BANDEIRA: Record<string, string> = {
  Verde: "V",
  Amarela: "A",
  "Vermelha P1": "P1",
  "Vermelha P2": "P2",
  "Escassez Hídrica": "EH",
};

/**
 * Cor fixa por categoria de subsídio (a cor segue a categoria, nunca a posição no
 * ranking do ano: uma publicação nova não repinta as categorias). Categoria nova
 * sem cor declarada cai no cinza e continua nomeada na legenda e na tabela.
 */
export const COR_SUBSIDIO: Record<string, string> = {
  "Consumidor Fonte Incentivada": "var(--serie-comp-1)",
  SCEE: "var(--serie-solar)",
  "Irrigação e Aquicultura": "var(--serie-sm-n)",
  "Geração Fonte Incentivada": "var(--serie-termica)",
  Distribuidora: "var(--cor-energia)",
  "Lei 14.299/2022": "var(--serie-eolica)",
  Rural: "var(--serie-1)",
  "Água-esgoto-saneamento": "var(--serie-referencia)",
};
const COR_SEM_DECLARACAO = "var(--serie-2)";

export function corSubsidio(categoria: string): string {
  return COR_SUBSIDIO[categoria] ?? COR_SEM_DECLARACAO;
}

export const COR_GRUPO_CDE: Record<GrupoCdeId, string> = {
  tarifa_social: "var(--cor-energia)",
  descontos_tarifarios: "var(--serie-solar)",
  ccc_luz_para_todos: "var(--serie-comp-1)",
  outras_despesas: "var(--serie-referencia)",
  quotas_tarifa: "var(--serie-sm-n)",
  outras_receitas: "var(--serie-referencia)",
};

/* ---------- estado na URL compartilhado entre os painéis ---------- */

/** CNPJ de 14 dígitos (chave canônica da distribuidora); qualquer outra coisa no link é descartada. */
const leitorCnpj: Leitor<string> = {
  ler: (b) => (/^\d{14}$/.test(b) ? b : undefined),
  escrever: (v) => v,
};

/**
 * `?dist=` guarda até quatro distribuidoras (CNPJ), a primeira em destaque. Os
 * painéis da página leem o mesmo parâmetro: escolher uma barra no ranking marca a
 * mesma linha na tabela, no histórico, na composição, no simulador e nos
 * reajustes, e o voltar do navegador desfaz a escolha.
 */
export const CAMPO_DIST = campo(tiposUrl.lista(leitorCnpj, { max: LIMITE_COMPARACAO }), [] as string[], { param: "dist" });

/** Põe a distribuidora em destaque (primeira da lista), sem repetir e sem passar de quatro. */
export function destacar(lista: readonly string[], id: string): string[] {
  return [id, ...lista.filter((x) => x !== id)].slice(0, LIMITE_COMPARACAO);
}

/** Tira a distribuidora da lista (clique de novo na barra já em destaque). */
export function remover(lista: readonly string[], id: string): string[] {
  return lista.filter((x) => x !== id);
}

/* ---------- P047: ranking, evolução e histórico ---------- */

export type Perfil = 100 | 200 | 300;

export type LinhaRanking = {
  id: string;
  sigla: string;
  nome: string | null;
  posicao: number;
  te: number | null;
  tusd: number | null;
  total: number;
  be_total: number | null;
  custo_100: number | null;
  custo_200: number | null;
  custo_300: number | null;
  /** Custo do perfil escolhido (R$/mês), o mesmo número de custo_<perfil>. */
  custo: number | null;
  inicio: string;
  fim: string;
  ato: string;
};

/** Sigla exibida; o CNPJ entra quando a fonte não publica sigla (nunca uma sigla inventada). */
export function rotuloDistribuidora(sigla: string | null | undefined, cnpj: string): string {
  return sigla && sigla.trim() ? sigla : `CNPJ ${cnpj}`;
}

/** Linhas do ranking na ordem publicada (posição 1 = menor tarifa), com o custo do perfil escolhido. */
export function linhasRanking(vigentes: readonly TarifaVigente[], perfil: Perfil): LinhaRanking[] {
  return [...vigentes]
    .sort((a, b) => a.posicao - b.posicao)
    .map((v) => ({
      id: v.cnpj,
      sigla: rotuloDistribuidora(v.sigla, v.cnpj),
      nome: v.nome,
      posicao: v.posicao,
      te: v.te,
      tusd: v.tusd,
      total: v.total,
      be_total: v.be_total,
      custo_100: v.perfis["100"],
      custo_200: v.perfis["200"],
      custo_300: v.perfis["300"],
      custo: v.perfis[String(perfil) as "100" | "200" | "300"],
      inicio: v.inicio,
      fim: v.fim,
      ato: v.ato,
    }));
}

export type LinhaEvolucao = {
  m: string;
  n: number;
  mediana: number | null;
  p25: number | null;
  p75: number | null;
  real: number | null;
};

/**
 * Evolução mensal da mediana a partir do primeiro mês com mediana publicada (antes
 * disso o arquivo tem poucas distribuidoras e a gold deixa a mediana nula, pela
 * regra de cobertura mínima). Meses posteriores sem mediana continuam como lacuna.
 */
export function linhasEvolucao(evolucao: readonly PontoEvolucao[]): LinhaEvolucao[] {
  const i0 = evolucao.findIndex((p) => p[2] !== null);
  if (i0 < 0) return [];
  return evolucao.slice(i0).map(([m, n, mediana, p25, p75, real]) => ({ m, n, mediana, p25, p75, real }));
}

/**
 * Tarifa B1 (TE + TUSD) vigente numa data, lida da linha do tempo resolvida da
 * distribuidora (início e fim inclusivos). É busca, não cálculo: a mesma regra do
 * pipeline para a evolução ("tarifa vigente no dia 1º de cada mês"). Sem vigência
 * na data, null (lacuna; nunca a vigência anterior repetida).
 */
export function tarifaNaData(vigencias: readonly VigenciaB1[], dia: string): number | null {
  for (const v of vigencias) if (v[0] <= dia && dia <= v[1]) return v[5];
  return null;
}

/** Série mensal (dia 1º) de cada distribuidora escolhida, nos mesmos meses da evolução. */
export function linhasHistorico(
  evolucao: readonly LinhaEvolucao[],
  historicos: Record<string, readonly VigenciaB1[]>,
): (LinhaEvolucao & Record<string, number | string | null>)[] {
  return evolucao.map((p) => {
    const linha: LinhaEvolucao & Record<string, number | string | null> = { ...p };
    for (const [cnpj, vig] of Object.entries(historicos)) linha[cnpj] = tarifaNaData(vig, `${p.m}-01`);
    return linha;
  });
}

export type LinhaEvento = {
  id: string;
  data: string;
  ato: string;
  antes: number | null;
  depois: number | null;
  variacao: number | null;
  variacao_te: number | null;
  variacao_tusd: number | null;
  ipca: number | null;
  meses_ipca: string;
  perimetro: string | null;
};

/** Eventos da tarifa B1 de uma distribuidora (histórico sob demanda), do mais recente ao mais antigo. */
export function linhasEventos(eventos: readonly EventoB1[]): LinhaEvento[] {
  return [...eventos]
    .sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
    .map((e) => ({
      id: `${e[0]}|${e[1]}`,
      data: e[0],
      ato: e[1],
      antes: e[3],
      depois: e[4],
      variacao: e[5],
      variacao_te: e[6],
      variacao_tusd: e[7],
      ipca: e[8],
      meses_ipca: `${mesAno(`${e[9]}-01`)} a ${mesAno(`${e[10]}-01`)}`,
      perimetro: e[11],
    }));
}

/* ---------- P048: composição ---------- */

export type UnidadeComposicao = "rs" | "pct";

export type LinhaComposicao = {
  id: string;
  sigla: string;
  posicao: number | null;
  total: number;
  cde: number | null;
} & Record<GrupoComponenteId, number | null>;

/**
 * Uma linha por distribuidora com composição, na unidade pedida: R$/MWh (os grupos
 * somam TE + TUSD) ou % da tarifa (participações publicadas). Ordem: a do ranking
 * da P047, ou decrescente pelo grupo escolhido (ausência no fim).
 */
export function linhasComposicao(
  comp: Composicao,
  vigentes: readonly TarifaVigente[],
  unidade: UnidadeComposicao,
  ordem: "posicao" | GrupoComponenteId = "posicao",
): LinhaComposicao[] {
  const pos = new Map(vigentes.map((v) => [v.cnpj, v.posicao]));
  const linhas: LinhaComposicao[] = comp.distribuidoras.map((d) => {
    const fonte = unidade === "rs" ? d.grupos : d.pct;
    const l = {
      id: d.cnpj,
      sigla: rotuloDistribuidora(d.sigla, d.cnpj),
      posicao: pos.get(d.cnpj) ?? null,
      total: d.total,
      cde: unidade === "rs" ? d.cde : d.cde_pct,
    } as LinhaComposicao;
    for (const g of ORDEM_GRUPOS) l[g] = fonte[g];
    return l;
  });
  const chave = (l: LinhaComposicao): number | null => (ordem === "posicao" ? l.posicao : l[ordem]);
  return linhas.sort((a, b) => {
    const x = chave(a);
    const y = chave(b);
    if (x === null && y === null) return a.sigla.localeCompare(b.sigla, "pt-BR");
    if (x === null) return 1;
    if (y === null) return -1;
    const d = ordem === "posicao" ? x - y : y - x;
    return d !== 0 ? d : a.sigla.localeCompare(b.sigla, "pt-BR");
  });
}

export type LinhaGrupo = {
  id: GrupoComponenteId;
  grupo: string;
  media_rs: number | null;
  media_pct: number | null;
  mediana_rs: number | null;
  dist_rs: number | null;
  dist_pct: number | null;
};

/** Tabela de decomposição: média (fecha com o total), mediana (não fecha) e a distribuidora em destaque. */
export function linhasGrupos(comp: Composicao, cnpjDestaque: string | null): LinhaGrupo[] {
  const d = cnpjDestaque ? comp.distribuidoras.find((x) => x.cnpj === cnpjDestaque) ?? null : null;
  const rotulo = new Map(comp.grupos.map((g) => [g.id, g.rotulo]));
  return ORDEM_GRUPOS.map((g) => ({
    id: g,
    grupo: rotulo.get(g) ?? g,
    media_rs: comp.media?.grupos_rs_mwh[g] ?? null,
    media_pct: comp.media?.grupos_pct[g] ?? null,
    mediana_rs: comp.mediana.grupos_rs_mwh[g],
    dist_rs: d ? d.grupos[g] : null,
    dist_pct: d ? d.pct[g] : null,
  }));
}

/* ---------- P049: simulador (reaplica a fórmula publicada) ---------- */

export type LinhaMemoria = { rotulo: string; kwh: number; rs_kwh: number; valor: number };

export type ResultadoSimulacao =
  | { disponivel: false; motivo: string }
  | {
      disponivel: true;
      motivo: null;
      linhas: LinhaMemoria[];
      energia: number;
      bandeira: number;
      kwh_bandeira: number;
      kwh_faturado: number;
      total: number;
      observacoes: string[];
    };

type TarifasSim = Partial<Record<ChaveTarifa, readonly [number | null, number | null] | null>>;

/** TE + TUSD da chave; null sem vigência, com parcela ausente ou com zero publicado nas duas (não homologada). */
export function tarifaDaChave(tarifas: TarifasSim, chave: ChaveTarifa): number | null {
  const t = tarifas[chave];
  if (!t) return null;
  const [te, tusd] = t;
  if (te === null || tusd === null || (te === 0 && tusd === 0)) return null;
  return te + tusd;
}

const NOMES_LIGACAO: Record<Ligacao, string> = { monofasico: "monofásica", bifasico: "bifásica", trifasico: "trifásica" };
export function nomeLigacao(l: Ligacao): string {
  return NOMES_LIGACAO[l];
}

/**
 * Estimativa mensal SEM TRIBUTOS para uma unidade de baixa tensão, com as regras
 * publicadas em `simulador.regras` (espelho de `simular` do pipeline; mesma ordem de
 * linhas e mesmos textos de observação). R$/MWh ÷ 1000 = R$/kWh.
 */
export function simular(
  tarifas: TarifasSim,
  classe: ClasseSimuladorId,
  kwh: number,
  ligacao: Ligacao,
  adicionalRsMwh: number | null,
  regras: Simulador["regras"],
): ResultadoSimulacao {
  if (!Number.isFinite(kwh) || kwh < 0) return { disponivel: false, motivo: "consumo inválido" };
  const minimo = regras.custo_disponibilidade_kwh[ligacao];
  if (minimo === undefined) return { disponivel: false, motivo: `tipo de ligação desconhecido: ${ligacao}` };
  const adic = adicionalRsMwh ?? 0;
  const linhas: LinhaMemoria[] = [];
  const obs: string[] = [];
  const linha = (rotulo: string, q: number, t: number, s = 1) => {
    const v = (s * q * t) / 1000;
    linhas.push({ rotulo, kwh: q, rs_kwh: t / 1000, valor: v });
    return v;
  };
  let fat: number;
  let kwhBandeira: number;
  const nomeLig = `ligação ${NOMES_LIGACAO[ligacao]}`;
  if (classe === "residencial" || classe === "rural" || classe === "demais") {
    const t = tarifaDaChave(tarifas, classe);
    if (t === null) return { disponivel: false, motivo: "tarifa da classe não publicada para esta distribuidora na vigência" };
    fat = Math.max(kwh, minimo);
    linha("Energia faturada (TE + TUSD)", fat, t);
    if (fat > kwh) obs.push(`Consumo abaixo do custo de disponibilidade: faturados ${minimo} kWh (${nomeLig}).`);
    kwhBandeira = kwh;
  } else if (classe === "desconto_social") {
    const t1 = tarifaDaChave(tarifas, "ds1");
    const t2 = tarifaDaChave(tarifas, "ds2");
    if (t1 === null || t2 === null) return { disponivel: false, motivo: "tarifas do Desconto Social não publicadas para esta distribuidora na vigência" };
    const lim = regras.desconto_social_limite_kwh;
    fat = Math.max(kwh, minimo);
    linha(`Faixa 01, até ${lim} kWh, sem quotas da CDE`, Math.min(fat, lim), t1);
    if (fat > lim) linha(`Faixa 02, acima de ${lim} kWh`, fat - lim, t2);
    if (fat > kwh) obs.push(`Consumo abaixo do custo de disponibilidade: faturados ${minimo} kWh (${nomeLig}).`);
    obs.push("Leitura por parcela das faixas homologadas; regra da REN não conferida (acervo da ANEEL bloqueado).");
    kwhBandeira = kwh;
  } else if (classe === "tarifa_social") {
    const t1 = tarifaDaChave(tarifas, "ts1");
    const t2 = tarifaDaChave(tarifas, "ts2");
    if (t1 === null || t2 === null) return { disponivel: false, motivo: "tarifas da Tarifa Social não publicadas para esta distribuidora na vigência" };
    const lim = regras.tarifa_social_limite_kwh;
    const q1 = Math.min(kwh, lim);
    linha(`Faixa 01, até ${lim} kWh`, q1, t1);
    linha("Desconto de 100% na faixa 01 (custeado pela CDE)", q1, t1, -1);
    if (kwh > lim) linha(`Faixa 02, acima de ${lim} kWh, sem desconto`, kwh - lim, t2);
    obs.push("Custo de disponibilidade não aplicado: gratuidade até 80 kWh inclusive em ligação trifásica (ANEEL); acima de 80 kWh a regra do mínimo não foi conferida.");
    fat = kwh;
    kwhBandeira = Math.max(kwh - lim, 0);
    if (kwhBandeira < kwh) obs.push("Bandeira aplicada só sobre a parcela acima de 80 kWh (leitura da página oficial da ANEEL).");
  } else {
    return { disponivel: false, motivo: `classe desconhecida: ${String(classe)}` };
  }
  const energia = linhas.reduce((s, l) => s + l.valor, 0);
  const bandeira = (kwhBandeira * adic) / 1000;
  return { disponivel: true, motivo: null, linhas, energia, bandeira, kwh_bandeira: kwhBandeira, kwh_faturado: fat, total: energia + bandeira, observacoes: obs };
}

/** Curva do custo estimado contra o consumo (0 a `ate` kWh, passo `passo`) para o gráfico do simulador. */
export function curvaSimulacao(
  tarifas: TarifasSim,
  classe: ClasseSimuladorId,
  ligacao: Ligacao,
  adicionalRsMwh: number | null,
  regras: Simulador["regras"],
  ate = 500,
  passo = 10,
): { kwh: string; total: number | null; energia: number | null }[] {
  const out: { kwh: string; total: number | null; energia: number | null }[] = [];
  for (let q = 0; q <= ate; q += passo) {
    const r = simular(tarifas, classe, q, ligacao, adicionalRsMwh, regras);
    out.push({ kwh: String(q), total: r.disponivel ? r.total : null, energia: r.disponivel ? r.energia : null });
  }
  return out;
}

/* ---------- P050: reajustes, bandeiras, subsídios e CDE ---------- */

export type LinhaJanela = { id: string; sigla: string; variacao: number | null; real: number | null };

/** Distribuidoras da janela na ordem publicada (variação crescente). */
export function linhasJanela(j: JanelaInflacao): LinhaJanela[] {
  return j.distribuidoras.map(([cnpj, sigla, variacao, real]) => ({ id: cnpj, sigla: rotuloDistribuidora(sigla, cnpj), variacao, real }));
}

export type CelulaBandeira = { mes: string; bandeira: string | null; rs_mwh: number | null } | null;

/** Grade ano × mês do acionamento publicado; mês não publicado fica null (nunca preenchido). */
export function gradeBandeiras(acionamento: Bandeiras["acionamento"]): { ano: string; meses: CelulaBandeira[] }[] {
  const porMes = new Map(acionamento.map((a) => [a.m, a]));
  const anos = Array.from(new Set(acionamento.map((a) => a.m.slice(0, 4)))).sort();
  return anos.map((ano) => ({
    ano,
    meses: Array.from({ length: 12 }, (_, i) => {
      const m = `${ano}-${String(i + 1).padStart(2, "0")}`;
      const a = porMes.get(m);
      return a ? { mes: m, bandeira: a.bandeira, rs_mwh: a.rs_mwh } : null;
    }),
  }));
}

const BI = 1e9;
const emBilhoes = (v: number | null | undefined): number | null => (v === null || v === undefined || !Number.isFinite(v) ? null : v / BI);

/** Categorias na ordem de exibição: a do dicionário publicado na gold. */
export function categoriasSubsidio(s: Subsidios): string[] {
  const doDicionario = s.categorias.map((c) => c.categoria);
  const extras = Array.from(new Set(s.anual.flatMap((a) => Object.keys(a.categorias)))).filter((c) => !doDicionario.includes(c)).sort();
  return [...doDicionario, ...extras];
}

/** Uma linha por ano, valores em R$ bilhões (conversão de unidade); ano parcial identificado no rótulo. */
export function linhasSubsidios(s: Subsidios): Record<string, string | number | null>[] {
  const cats = categoriasSubsidio(s);
  return s.anual.map((a) => {
    const l: Record<string, string | number | null> = {
      ano: a.ano,
      rotulo: a.parcial ? `${a.ano} (${a.meses} ${a.meses === 1 ? "mês" : "meses"}, parcial)` : a.ano,
      meses: a.meses,
      soma: emBilhoes(a.soma_categorias),
      total_publicado: emBilhoes(a.total_publicado),
    };
    for (const c of cats) l[c] = emBilhoes(a.categorias[c] ?? null);
    return l;
  });
}

export const GRUPOS_DESPESA_CDE: GrupoCdeId[] = ["tarifa_social", "descontos_tarifarios", "ccc_luz_para_todos", "outras_despesas"];
export const GRUPOS_RECEITA_CDE: GrupoCdeId[] = ["quotas_tarifa", "outras_receitas"];

/** Orçamento da CDE por ano e grupo, em R$ bilhões. */
export function linhasCde(f: FinanciamentoCde): Record<string, string | number | null>[] {
  return f.totais.map((t) => {
    const l: Record<string, string | number | null> = {
      ano: t.ano,
      despesa: emBilhoes(t.despesa),
      receita: emBilhoes(t.receita),
      quotas_pct: t.quotas_pct,
      tarifa_social_pct: t.tarifa_social_pct,
    };
    for (const g of [...GRUPOS_DESPESA_CDE, ...GRUPOS_RECEITA_CDE]) l[g] = emBilhoes(t.grupos[g]);
    return l;
  });
}

/* ---------- respostas curtas (regras determinísticas) ---------- */

const rsKwh = (rsMwh: number | null | undefined, casas = 4) =>
  rsMwh === null || rsMwh === undefined || !Number.isFinite(rsMwh) ? AUSENTE : `${reais(rsMwh / 1000, casas)}/kWh`;

/** Variação com verbo: "subiu 11,18%", "caiu 2,10%", "ficou estável (0,00%)". */
export function verboVariacao(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "não tem variação calculável";
  const r = Number(v.toFixed(casas));
  if (r > 0) return `subiu ${pct(r, casas)}`;
  if (r < 0) return `caiu ${pct(Math.abs(r), casas)}`;
  return `ficou estável (${pct(0, casas)})`;
}

/** P047: quanto custa o perfil escolhido, do menor ao maior, e a mediana. */
export function respostaTarifa(g: Pick<ContaGold, "data_referencia" | "tarifas">, perfil: Perfil): string {
  const { resumo, vigentes } = g.tarifas;
  const chave = String(perfil) as "100" | "200" | "300";
  const ord = [...vigentes].sort((a, b) => a.posicao - b.posicao);
  const menor = ord[0];
  const maior = ord[ord.length - 1];
  if (!menor || !maior || resumo.n === 0) return `Em ${dataBR(g.data_referencia)}, nenhuma distribuidora tem tarifa B1 residencial vigente no arquivo da ANEEL.`;
  return (
    `Em ${dataBR(g.data_referencia)}, ${perfil} kWh no mês custam, só pela tarifa B1 residencial homologada (TE + TUSD, sem tributos e sem bandeira), ` +
    `de ${reais(menor.perfis[chave])} (${rotuloDistribuidora(menor.sigla, menor.cnpj)}) a ${reais(maior.perfis[chave])} (${rotuloDistribuidora(maior.sigla, maior.cnpj)}); ` +
    `a mediana entre ${resumo.n} distribuidoras é ${reais(resumo.perfis_mediana[chave])}, ou ${rsKwh(resumo.mediana)}.`
  );
}

/** P047, histórico: quantas mudanças e a última, para a distribuidora em destaque. */
export function respostaHistorico(sigla: string, eventos: readonly EventoB1[], vigencias: readonly VigenciaB1[]): string {
  if (!vigencias.length) return `${sigla}: o arquivo não traz vigência da tarifa B1 residencial.`;
  const ult = [...eventos].sort((a, b) => (a[0] < b[0] ? -1 : 1)).at(-1);
  const base = `${sigla}: tarifa B1 publicada de ${dataBR(vigencias[0][0])} a ${dataBR(vigencias[vigencias.length - 1][1])}, com ${eventos.length} ${eventos.length === 1 ? "mudança" : "mudanças"} de valor ou de ato.`;
  if (!ult) return base;
  const perimetro = ult[11] ? ` Essa mudança é de perímetro (incorporação, ${ult[11]}): compara áreas diferentes.` : "";
  return `${base} Na última, em ${dataBR(ult[0])} (${ult[1]}), a tarifa ${verboVariacao(ult[5])}; o IPCA desde a mudança anterior foi ${pct(ult[8], 2)}.${perimetro}`;
}

/** P048: participação de cada grupo na composição média (a que fecha com o total). */
export function respostaComposicao(comp: Composicao): string {
  const m = comp.media;
  if (!m || m.total_rs_mwh === null) return "Sem composição publicada na data: o conjunto de componentes não cobre as tarifas vigentes.";
  const rot = new Map(comp.grupos.map((g) => [g.id, g.rotulo.toLowerCase()]));
  const positivos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) > 0).sort((a, b) => (m.grupos_pct[b] ?? 0) - (m.grupos_pct[a] ?? 0));
  const negativos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) < 0);
  const partes = positivos.map((g) => `${rot.get(g)} ${pct(m.grupos_pct[g], 1)}`);
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0] ?? "";
  const reduz = negativos.length
    ? ` Itens com valor negativo reduzem a tarifa: ${negativos.map((g) => `${rot.get(g)} ${pct(m.grupos_pct[g], 1)}`).join(" e ")}.`
    : "";
  const cde = m.cde_pct !== null ? ` As componentes CDE somam ${pct(m.cde_pct, 1)} da tarifa e já estão dentro dos encargos.` : "";
  return `Na média simples das ${m.n} distribuidoras com componentes publicadas (tarifa média de ${reais(m.total_rs_mwh / 1000, 4)}/kWh), a tarifa B1 se divide em ${lista}.${reduz}${cde}`;
}

/** P049: o resultado da simulação em uma frase, sempre com o rótulo de estimativa. */
export function respostaSimulacao(r: ResultadoSimulacao, sigla: string, rotuloClasse: string, kwh: number, bandeira: string, rotuloEstimativa: string): string {
  if (!r.disponivel) return `Simulação indisponível para ${sigla} (${rotuloClasse}): ${r.motivo}.`;
  const band = r.bandeira > 0 ? `, dos quais ${reais(r.bandeira)} de bandeira ${bandeira.toLowerCase()} sobre ${num(r.kwh_bandeira, 0)} kWh` : `, sem acréscimo de bandeira (${bandeira.toLowerCase()})`;
  return `Para ${num(kwh, 0)} kWh no mês na ${sigla}, classe ${rotuloClasse.toLowerCase()}, a estimativa é de ${reais(r.total)}${band}. ${rotuloEstimativa}`;
}

/** P050: variação da tarifa B1 na janela contra o IPCA do mesmo período. */
export function respostaReajustes(j: JanelaInflacao): string {
  if (j.mediana_pct === null || j.ipca_pct === null) return `Sem comparação com o IPCA na janela de ${j.meses} meses: falta índice ou tarifa nas duas datas.`;
  const fora = j.excluidas_sem_tarifa_nas_duas_datas + j.excluidas_mudanca_perimetro.length;
  const foraTxt = fora ? ` Ficam fora ${fora} distribuidoras (sem tarifa numa das datas ou com área alterada por incorporação).` : "";
  return (
    `De ${dataBR(j.de)} a ${dataBR(j.ate)} (${j.meses} meses), a tarifa B1 residencial ${verboVariacao(j.mediana_pct)} na mediana de ${j.n} distribuidoras, ` +
    `contra IPCA de ${pct(j.ipca_pct, 2)}: ${j.acima_ipca} ficaram acima da inflação e ${j.abaixo_ou_igual_ipca} abaixo ou igual.${foraTxt}`
  );
}

/** P050: bandeira do mês e quantos meses publicados tiveram acréscimo. */
export function respostaBandeira(b: Bandeiras): string {
  const v = b.vigente;
  const publicados = b.acionamento.filter((a) => a.bandeira !== null);
  const comAcrescimo = publicados.filter((a) => a.bandeira !== "Verde").length;
  const inicio = b.acionamento[0]?.m;
  const historico = inicio ? ` De ${mesAno(`${inicio}-01`)} a ${mesAno(`${b.acionamento[b.acionamento.length - 1].m}-01`)}, ${comAcrescimo} dos ${publicados.length} meses publicados tiveram bandeira diferente da verde.` : "";
  if (!v || !v.bandeira) return `O conjunto de bandeiras não traz acionamento publicado.${historico}`;
  const valor = v.bandeira === "Verde" ? "sem acréscimo" : `acréscimo de ${rsKwh(v.rs_mwh, 5)} consumido`;
  const aviso = v.aviso ? ` ${v.aviso}` : "";
  return `A bandeira de ${mesAno(`${v.mes}-01`)} é ${v.bandeira.toLowerCase()}: ${valor}, fora dos sistemas isolados.${historico}${aviso}`;
}

/** P050: subsídios do último ano completo e a maior categoria. */
export function respostaSubsidios(s: Subsidios): string {
  const ano = s.anual.find((a) => a.ano === s.ultimo_ano_completo);
  if (!ano || ano.soma_categorias === null) return "Sem ano completo de subsídios tarifários publicado.";
  const cats = Object.entries(ano.categorias).filter((e): e is [string, number] => e[1] !== null).sort((a, b) => b[1] - a[1]);
  const maior = cats[0];
  const maiorTxt = maior ? `; a maior categoria foi ${maior[0]} (${reais(maior[1] / BI, 2)} bilhões)` : "";
  return `Em ${ano.ano}, os repasses homologados da CDE às distribuidoras para cobrir descontos a categorias de usuários somaram ${reais(ano.soma_categorias / BI, 2)} bilhões${maiorTxt}. Não são transferências a famílias.`;
}

/** P050: orçamento da CDE do último ano, peso das quotas e da Tarifa Social. */
export function respostaCde(f: FinanciamentoCde | null): string {
  if (!f) return "O orçamento da CDE não foi publicado nesta gold.";
  const t = f.totais.find((x) => x.ano === f.ultimo_ano);
  if (!t || t.despesa === null) return `Sem orçamento da CDE publicado para ${f.ultimo_ano}.`;
  return (
    `O orçamento aprovado ou previsto da CDE para ${t.ano} é de ${reais(t.despesa / BI, 2)} bilhões: ${pct(t.quotas_pct, 1)} das receitas vêm das quotas cobradas nas tarifas ` +
    `de todos os consumidores, e a Tarifa Social responde por ${pct(t.tarifa_social_pct, 1)} das despesas.`
  );
}

/** Mesmo texto para o leitor de tela e para o rótulo do período no painel. */
export function periodoReferencia(g: Pick<ContaGold, "data_referencia" | "gerado_pela_fonte_em">): string {
  return `vigente em ${dataBR(g.data_referencia)} (arquivo gerado pela ANEEL em ${dataBR(g.gerado_pela_fonte_em)})`;
}
