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
  ResumoTarifas,
  Simulador,
  Subsidios,
  TarifaVigente,
  VigenciaB1,
} from "./tipos-conta";
import { campo, tiposUrl, type Leitor } from "./estadoUrl";
import { AUSENTE, dataBR, mesAno, num, pct, reais } from "./formato";
import { LIMITE_COMPARACAO, type ColunaTabela } from "./tabela";

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

/** Colunas da tabela do ranking (P047): a mesma matriz vai para a tela e para a exportação. */
export const COLUNAS_RANKING: ColunaTabela[] = [
  { id: "posicao", rotulo: "Posição (1 = menor)", tipo: "numero", casas: 0 },
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "nome", rotulo: "Razão social", tipo: "texto" },
  { id: "id", rotulo: "CNPJ", tipo: "texto" },
  { id: "te", rotulo: "TE", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "tusd", rotulo: "TUSD", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  {
    id: "total",
    rotulo: "TE + TUSD",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  {
    id: "custo_100",
    rotulo: "100 kWh",
    tipo: "numero",
    unidade: "R$/mês",
    casas: 2,
  },
  {
    id: "custo_200",
    rotulo: "200 kWh",
    tipo: "numero",
    unidade: "R$/mês",
    casas: 2,
  },
  {
    id: "custo_300",
    rotulo: "300 kWh",
    tipo: "numero",
    unidade: "R$/mês",
    casas: 2,
  },
  {
    id: "be_total",
    rotulo: "Base econômica (TE + TUSD)",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  { id: "inicio", rotulo: "Início da vigência", tipo: "data" },
  { id: "fim", rotulo: "Fim da vigência", tipo: "data" },
  { id: "ato", rotulo: "Ato da ANEEL", tipo: "texto" },
];

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
  return evolucao.slice(i0).map(([m, n, mediana, p25, p75, real]) => ({
    m,
    n,
    mediana,
    p25,
    p75,
    real,
  }));
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
export function linhasHistorico(evolucao: readonly LinhaEvolucao[], historicos: Record<string, readonly VigenciaB1[]>): (LinhaEvolucao & Record<string, number | string | null>)[] {
  return evolucao.map((p) => {
    const linha: LinhaEvolucao & Record<string, number | string | null> = {
      ...p,
    };
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
  total: number | null;
  cde: number | null;
} & Record<GrupoComponenteId, number | null>;

/**
 * Uma linha por distribuidora com composição, na unidade pedida: R$/MWh (os grupos
 * somam TE + TUSD) ou % da tarifa (participações publicadas). Ordem: a do ranking
 * da P047, ou decrescente pelo grupo escolhido (ausência no fim).
 */
export function linhasComposicao(
  comp: Composicao,
  vigentes: readonly Pick<TarifaVigente, "cnpj" | "posicao">[],
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

/** Identificador da barra da composição média no gráfico (não é distribuidora: não seleciona). */
export const ID_MEDIA = "media";

/**
 * Distribuidoras do gráfico de composição quando ninguém foi escolhido: a de
 * referência (tarifa mais próxima da mediana, a mesma da evidência), a de menor e a
 * de maior tarifa do ranking, só as que têm composição publicada.
 */
export function idsComposicaoPadrao(comp: Composicao, vigentes: readonly Pick<TarifaVigente, "cnpj" | "posicao">[], referencia: string | null): string[] {
  const com = new Set(comp.distribuidoras.map((d) => d.cnpj));
  const ord = [...vigentes].filter((v) => com.has(v.cnpj)).sort((a, b) => a.posicao - b.posicao);
  const ids = [referencia, ord[0]?.cnpj, ord[ord.length - 1]?.cnpj].filter((x): x is string => !!x && com.has(x));
  return Array.from(new Set(ids));
}

/**
 * Linhas do gráfico de composição: a média (que fecha com o total) e as
 * distribuidoras pedidas, cada uma igual à sua linha na tabela completa.
 */
export function linhasComposicaoGrafico(
  comp: Composicao,
  vigentes: readonly Pick<TarifaVigente, "cnpj" | "posicao">[],
  unidade: UnidadeComposicao,
  ids: readonly string[],
): LinhaComposicao[] {
  const todas = linhasComposicao(comp, vigentes, unidade);
  const porId = new Map(todas.map((l) => [l.id, l]));
  const out: LinhaComposicao[] = [];
  const m = comp.media;
  if (m) {
    const l = {
      id: ID_MEDIA,
      sigla: `Média de ${m.n}`,
      posicao: null,
      total: m.total_rs_mwh,
      cde: unidade === "rs" ? m.cde_rs_mwh : m.cde_pct,
    } as LinhaComposicao;
    for (const g of ORDEM_GRUPOS) l[g] = unidade === "rs" ? m.grupos_rs_mwh[g] : m.grupos_pct[g];
    out.push(l);
  }
  for (const id of ids) {
    const l = porId.get(id);
    if (l) out.push(l);
  }
  return out;
}

/** Colunas da tabela de composição (P048), na unidade exibida. */
export function colunasComposicao(rotulo: ReadonlyMap<string, string>, emPct: boolean): ColunaTabela[] {
  const tipo: ColunaTabela["tipo"] = emPct ? "percentual" : "numero";
  const unidade = emPct ? undefined : "R$/MWh";
  const casas = emPct ? 1 : 2;
  return [
    { id: "posicao", rotulo: "Posição no ranking", tipo: "numero", casas: 0 },
    { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
    { id: "id", rotulo: "CNPJ", tipo: "texto" },
    {
      id: "total",
      rotulo: "TE + TUSD",
      tipo: "numero",
      unidade: "R$/MWh",
      casas: 2,
    },
    ...ORDEM_GRUPOS.map((g) => ({
      id: g,
      rotulo: rotulo.get(g) ?? g,
      tipo,
      unidade,
      casas,
    })),
    {
      id: "cde",
      rotulo: "Componentes CDE (dentro dos encargos)",
      tipo,
      unidade,
      casas,
    },
  ];
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
  const d = cnpjDestaque ? (comp.distribuidoras.find((x) => x.cnpj === cnpjDestaque) ?? null) : null;
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

export type LinhaMemoria = {
  rotulo: string;
  kwh: number;
  rs_kwh: number;
  valor: number;
};

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

const NOMES_LIGACAO: Record<Ligacao, string> = {
  monofasico: "monofásica",
  bifasico: "bifásica",
  trifasico: "trifásica",
};
export function nomeLigacao(l: Ligacao): string {
  return NOMES_LIGACAO[l];
}

/**
 * Estimativa mensal SEM TRIBUTOS para uma unidade de baixa tensão, com as regras
 * publicadas em `simulador.regras` (espelho de `simular` do pipeline; mesma ordem de
 * linhas e as mesmas observações, com os limites de kWh lidos de `regras` em vez de
 * escritos no texto). R$/MWh ÷ 1000 = R$/kWh.
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
  if (minimo === undefined)
    return {
      disponivel: false,
      motivo: `tipo de ligação desconhecido: ${ligacao}`,
    };
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
    if (t === null)
      return {
        disponivel: false,
        motivo: "tarifa da classe não publicada para esta distribuidora na vigência",
      };
    fat = Math.max(kwh, minimo);
    linha("Energia faturada (TE + TUSD)", fat, t);
    if (fat > kwh) obs.push(`Consumo abaixo do custo de disponibilidade: faturados ${minimo} kWh (${nomeLig}).`);
    kwhBandeira = kwh;
  } else if (classe === "desconto_social") {
    const t1 = tarifaDaChave(tarifas, "ds1");
    const t2 = tarifaDaChave(tarifas, "ds2");
    if (t1 === null || t2 === null)
      return {
        disponivel: false,
        motivo: "tarifas do Desconto Social não publicadas para esta distribuidora na vigência",
      };
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
    if (t1 === null || t2 === null)
      return {
        disponivel: false,
        motivo: "tarifas da Tarifa Social não publicadas para esta distribuidora na vigência",
      };
    const lim = regras.tarifa_social_limite_kwh;
    const q1 = Math.min(kwh, lim);
    linha(`Faixa 01, até ${lim} kWh`, q1, t1);
    // desconto integral da faixa 01 (regra conferida em simulador.regras_texto); o limite vem da gold, nunca do código
    linha("Desconto integral na faixa 01 (custeado pela CDE)", q1, t1, -1);
    if (kwh > lim) linha(`Faixa 02, acima de ${lim} kWh, sem desconto`, kwh - lim, t2);
    obs.push(
      `Custo de disponibilidade não aplicado: gratuidade até ${lim} kWh inclusive em ligação trifásica (ANEEL); acima de ${lim} kWh a regra do mínimo não foi conferida.`,
    );
    fat = kwh;
    kwhBandeira = Math.max(kwh - lim, 0);
    if (kwhBandeira < kwh) obs.push(`Bandeira aplicada só sobre a parcela acima de ${lim} kWh (leitura da página oficial da ANEEL).`);
  } else {
    return {
      disponivel: false,
      motivo: `classe desconhecida: ${String(classe)}`,
    };
  }
  const energia = linhas.reduce((s, l) => s + l.valor, 0);
  const bandeira = (kwhBandeira * adic) / 1000;
  return {
    disponivel: true,
    motivo: null,
    linhas,
    energia,
    bandeira,
    kwh_bandeira: kwhBandeira,
    kwh_faturado: fat,
    total: energia + bandeira,
    observacoes: obs,
  };
}

/**
 * Caso que a evidência "Comprove este número" do simulador prova (tipos-conta:
 * "caso residencial de 150 kWh na distribuidora de referência com a bandeira do
 * mês", ligação monofásica). O teste confere que `simular` reproduz o valor da
 * evidência com estes parâmetros; se o pipeline mudar o caso, o teste falha.
 */
export const CASO_EVIDENCIA_SIMULADOR: {
  classe: ClasseSimuladorId;
  kwh: number;
  ligacao: Ligacao;
} = {
  classe: "residencial",
  kwh: 150,
  ligacao: "monofasico",
};

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
    out.push({
      kwh: String(q),
      total: r.disponivel ? r.total : null,
      energia: r.disponivel ? r.energia : null,
    });
  }
  return out;
}

/* ---------- P050: reajustes, bandeiras, subsídios e CDE ---------- */

/** Colunas da tabela de variação contra o IPCA (P050). */
export const COLUNAS_JANELA: ColunaTabela[] = [
  { id: "sigla", rotulo: "Distribuidora", tipo: "texto" },
  { id: "id", rotulo: "CNPJ", tipo: "texto" },
  {
    id: "variacao",
    rotulo: "Variação da tarifa B1",
    tipo: "percentual",
    casas: 2,
  },
  {
    id: "real",
    rotulo: "Variação real (descontado o IPCA)",
    tipo: "percentual",
    casas: 2,
  },
];

export type LinhaJanela = {
  id: string;
  sigla: string;
  variacao: number | null;
  real: number | null;
};

/** Distribuidoras da janela na ordem publicada (variação crescente). */
export function linhasJanela(j: JanelaInflacao): LinhaJanela[] {
  return j.distribuidoras.map(([cnpj, sigla, variacao, real]) => ({
    id: cnpj,
    sigla: rotuloDistribuidora(sigla, cnpj),
    variacao,
    real,
  }));
}

export type CelulaBandeira = {
  mes: string;
  bandeira: string | null;
  rs_mwh: number | null;
} | null;

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
  const extras = Array.from(new Set(s.anual.flatMap((a) => Object.keys(a.categorias))))
    .filter((c) => !doDicionario.includes(c))
    .sort();
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

const rsKwh = (rsMwh: number | null | undefined, casas = 4) => (rsMwh === null || rsMwh === undefined || !Number.isFinite(rsMwh) ? AUSENTE : `${reais(rsMwh / 1000, casas)}/kWh`);

/**
 * Minúscula para usar um rótulo no meio da frase sem estragar siglas: só a palavra
 * escrita como nome próprio ("Vermelha", "Residencial") vira minúscula; sigla e
 * código ("P1", "B1", "B", "CDE") ficam como estão.
 */
export function minuscula(s: string): string {
  return s.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (w) => (/^[A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ]+$/.test(w) ? w.toLowerCase() : w));
}

/** Variação com verbo: "subiu 11,18%", "caiu 2,10%", "ficou estável (0,00%)". */
export function verboVariacao(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "não tem variação calculável";
  const r = Number(v.toFixed(casas));
  if (r > 0) return `subiu ${pct(r, casas)}`;
  if (r < 0) return `caiu ${pct(Math.abs(r), casas)}`;
  return `ficou estável (${pct(0, casas)})`;
}

/** P047: quanto custa o perfil escolhido, do menor ao maior, e a mediana. */
export function respostaTarifa(dataReferencia: string, resumo: ResumoTarifas, vigentes: readonly TarifaVigente[], perfil: Perfil): string {
  const chave = String(perfil) as "100" | "200" | "300";
  const ord = [...vigentes].sort((a, b) => a.posicao - b.posicao);
  const menor = ord[0];
  const maior = ord[ord.length - 1];
  if (!menor || !maior || resumo.n === 0) return `Em ${dataBR(dataReferencia)}, nenhuma distribuidora tem tarifa B1 residencial vigente no arquivo da ANEEL.`;
  return (
    `Em ${dataBR(dataReferencia)}, ${perfil} kWh no mês custam, só pela tarifa B1 residencial homologada (TE + TUSD, sem tributos e sem bandeira), ` +
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
  const rot = new Map(comp.grupos.map((g) => [g.id, minuscula(g.rotulo)]));
  const positivos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) > 0).sort((a, b) => (m.grupos_pct[b] ?? 0) - (m.grupos_pct[a] ?? 0));
  const negativos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) < 0);
  const partes = positivos.map((g) => `${rot.get(g)} ${pct(m.grupos_pct[g], 1)}`);
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : (partes[0] ?? "");
  const reduz = negativos.length ? ` Itens com valor negativo reduzem a tarifa: ${negativos.map((g) => `${rot.get(g)} ${pct(m.grupos_pct[g], 1)}`).join(" e ")}.` : "";
  const cde = m.cde_pct !== null ? ` As componentes CDE somam ${pct(m.cde_pct, 1)} da tarifa e já estão dentro dos encargos.` : "";
  return `Na média simples das ${m.n} distribuidoras com componentes publicadas (tarifa média de ${reais(m.total_rs_mwh / 1000, 4)}/kWh), a tarifa B1 se divide em ${lista}.${reduz}${cde}`;
}

/**
 * P049: o resultado da simulação em uma frase, sempre com o rótulo de estimativa.
 * `bandeira` null quer dizer adicional não publicado: a frase diz que a bandeira
 * ficou fora, em vez de chamar a ausência de "sem acréscimo".
 */
export function respostaSimulacao(r: ResultadoSimulacao, sigla: string, rotuloClasse: string, kwh: number, bandeira: string | null, rotuloEstimativa: string): string {
  if (!r.disponivel) return `Simulação indisponível para ${sigla} (${rotuloClasse}): ${r.motivo}.`;
  const band =
    bandeira === null
      ? ", sem a bandeira, cujo adicional não está publicado para o mês"
      : r.bandeira > 0
        ? `, dos quais ${reais(r.bandeira)} de bandeira ${minuscula(bandeira)} sobre ${num(r.kwh_bandeira, 0)} kWh`
        : `, sem acréscimo de bandeira (${minuscula(bandeira)})`;
  return `Para ${num(kwh, 0)} kWh no mês na ${sigla}, classe ${minuscula(rotuloClasse)}, a estimativa é de ${reais(r.total)}${band}. ${rotuloEstimativa}`;
}

/** P050: variação da tarifa B1 na janela contra o IPCA do mesmo período. */
export function respostaReajustes(j: JanelaInflacao): string {
  if (j.mediana_pct === null || j.ipca_pct === null) return `Sem comparação com o IPCA na janela de ${j.meses} meses: falta índice ou tarifa nas duas datas.`;
  const fora = j.excluidas_sem_tarifa_nas_duas_datas + j.excluidas_mudanca_perimetro.length;
  const foraTxt = fora
    ? ` ${fora === 1 ? "Fica fora 1 distribuidora" : `Ficam fora ${fora} distribuidoras`} (sem tarifa numa das datas ou com área alterada por incorporação).`
    : "";
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
  const historico = inicio
    ? ` De ${mesAno(`${inicio}-01`)} a ${mesAno(`${b.acionamento[b.acionamento.length - 1].m}-01`)}, ${comAcrescimo} dos ${publicados.length} meses publicados tiveram bandeira diferente da verde.`
    : "";
  if (!v || !v.bandeira) return `O conjunto de bandeiras não traz acionamento publicado.${historico}`;
  const valor = v.bandeira === "Verde" ? "sem acréscimo" : `acréscimo de ${rsKwh(v.rs_mwh, 5)} consumido`;
  const aviso = v.aviso ? ` ${v.aviso}` : "";
  return `A bandeira de ${mesAno(`${v.mes}-01`)} é ${minuscula(v.bandeira)}: ${valor}, fora dos sistemas isolados.${historico}${aviso}`;
}

/** P050: subsídios do último ano completo e a maior categoria. */
export function respostaSubsidios(s: Subsidios): string {
  const ano = s.anual.find((a) => a.ano === s.ultimo_ano_completo);
  if (!ano || ano.soma_categorias === null) return "Sem ano completo de subsídios tarifários publicado.";
  const cats = Object.entries(ano.categorias)
    .filter((e): e is [string, number] => e[1] !== null)
    .sort((a, b) => b[1] - a[1]);
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

/* ---------- vereditos (r8): a resposta em palavras comuns, com os números da resposta completa ---------- */

/** Rótulo de grupo sem o parêntese técnico: "Distribuição (fio B)" vira "distribuição". */
const nomeGrupo = (rotulo: string) => minuscula(rotulo.replace(/\s*\([^)]*\)/g, ""));

/** Veredito do P047: o perfil escolhido do menor ao maior custo, só pela tarifa. A mediana fica na resposta completa e na linha do gráfico. */
export function vereditoTarifa(dataReferencia: string, resumo: ResumoTarifas, vigentes: readonly TarifaVigente[], perfil: Perfil): string {
  const chave = String(perfil) as "100" | "200" | "300";
  const ord = [...vigentes].sort((a, b) => a.posicao - b.posicao);
  const menor = ord[0];
  const maior = ord[ord.length - 1];
  if (!menor || !maior || resumo.n === 0) return `Em ${dataBR(dataReferencia)}, nenhuma distribuidora tem tarifa B1 residencial vigente no arquivo da ANEEL.`;
  return `Em ${dataBR(dataReferencia)}, ${perfil} kWh no mês custam de ${reais(menor.perfis[chave])} (${rotuloDistribuidora(menor.sigla, menor.cnpj)}) a ${reais(maior.perfis[chave])} (${rotuloDistribuidora(maior.sigla, maior.cnpj)}), conforme a distribuidora, só pela tarifa.`;
}

/** Veredito do P048: os dois maiores grupos da tarifa B1 na média das distribuidoras, em %. Os demais grupos, os itens negativos e a CDE ficam na resposta completa. */
export function vereditoComposicao(comp: Composicao): string {
  const m = comp.media;
  if (!m || m.total_rs_mwh === null) return "Sem composição publicada na data: o conjunto de componentes não cobre as tarifas vigentes.";
  const rot = new Map(comp.grupos.map((g) => [g.id, nomeGrupo(g.rotulo)]));
  const positivos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) > 0).sort((a, b) => (m.grupos_pct[b] ?? 0) - (m.grupos_pct[a] ?? 0));
  const [a, b] = positivos;
  if (!a) return "Sem grupo com valor positivo na composição média.";
  const dois = b ? `${rot.get(a)} (${pct(m.grupos_pct[a], 1)}) e ${rot.get(b)} (${pct(m.grupos_pct[b], 1)})` : `${rot.get(a)} (${pct(m.grupos_pct[a], 1)})`;
  return `Na média das ${m.n} distribuidoras, a tarifa B1 vai sobretudo para ${dois}.`;
}

/** Veredito do P049: a estimativa mensal, sem tributos, para o consumo e a distribuidora escolhidos. A parcela da bandeira e os rótulos de estimativa ficam na resposta completa. */
export function vereditoSimulacao(r: ResultadoSimulacao, sigla: string, kwh: number): string {
  if (!r.disponivel) return `Simulação indisponível para ${sigla}: ${r.motivo}.`;
  return `Para ${num(kwh, 0)} kWh no mês na ${sigla}, a estimativa é de ${reais(r.total)}, sem tributos e sem iluminação pública.`;
}

/**
 * Veredito do P050 (reajustes): em quantas distribuidoras a tarifa B1 subiu mais que o IPCA do mesmo período, com o limite
 * de leitura: é a variação entre duas datas, não o efeito do processo tarifário.
 */
export function vereditoReajustes(j: JanelaInflacao): string {
  if (j.mediana_pct === null || j.ipca_pct === null) return `Sem comparação com o IPCA na janela de ${j.meses} meses: falta índice ou tarifa nas duas datas.`;
  return `Em ${j.meses} meses até ${dataBR(j.ate)}, a tarifa B1 residencial subiu mais que o IPCA (${pct(j.ipca_pct, 2)}) em ${j.acima_ipca} de ${j.n} distribuidoras. É a variação entre duas datas, não o efeito do processo tarifário.`;
}

/** Veredito do P050 (bandeiras): a bandeira do mês e quantos meses publicados tiveram acréscimo. */
export function vereditoBandeira(b: Bandeiras): string {
  const v = b.vigente;
  const publicados = b.acionamento.filter((a) => a.bandeira !== null);
  const comAcrescimo = publicados.filter((a) => a.bandeira !== "Verde").length;
  const inicio = b.acionamento[0]?.m;
  const historico = inicio ? ` Em ${comAcrescimo} dos ${publicados.length} meses publicados desde ${mesAno(`${inicio}-01`)}, a bandeira não foi verde.` : "";
  if (!v || !v.bandeira) return `O conjunto de bandeiras não traz acionamento publicado.${historico}`;
  const valor = v.bandeira === "Verde" ? "sem acréscimo" : `acréscimo de ${rsKwh(v.rs_mwh, 5)} consumido`;
  return `A bandeira de ${mesAno(`${v.mes}-01`)} é ${minuscula(v.bandeira)}: ${valor}.${historico}`;
}

/** Veredito do P050 (subsídios): quanto a CDE repassou no último ano completo e que não são transferências a famílias. O orçamento e a maior categoria ficam na resposta completa. */
export function vereditoSubsidios(s: Subsidios): string {
  const ano = s.anual.find((a) => a.ano === s.ultimo_ano_completo);
  if (!ano || ano.soma_categorias === null) return "Sem ano completo de subsídios tarifários publicado.";
  return `Em ${ano.ano}, a CDE repassou ${reais(ano.soma_categorias / BI, 2)} bilhões às distribuidoras para cobrir descontos a categorias de usuários. Não são transferências a famílias.`;
}

/**
 * Soma das parcelas já arredondadas contra o total arredondado, em reais: a nota que explica a diferença de R$ 0,01 quando existe
 * (cada valor é arredondado depois de calculado), ou null quando as parcelas fecham com o total.
 */
export function notaArredondamentoSimulacao(parcelas: readonly number[], total: number): string | null {
  const centavos = (v: number) => Math.round(v * 100);
  const soma = parcelas.reduce((acc, v) => acc + centavos(v), 0);
  const t = centavos(total);
  if (soma === t) return null;
  return `As parcelas somam ${reais(soma / 100)} e o total é ${reais(t / 100)}: cada valor é arredondado depois de calculado, e a soma dos valores arredondados pode diferir do total em R$ 0,01.`;
}

/** Separa, numa frase de regra, o que fala de acesso a norma que o observatório não conseguiu ler (detalhe para Analisar) do resto. */
export function separaBloqueioDeNorma(texto: string): { leitor: string; tecnico: string } {
  const frases = texto.split(/(?<=\.)\s+/);
  const ehBloqueio = (f: string) => /não pôde ser lid[oa]|bloque(?:io|ou)/i.test(f);
  return { leitor: frases.filter((f) => !ehBloqueio(f)).join(" ").trim(), tecnico: frases.filter(ehBloqueio).join(" ").trim() };
}

/** Mesmo texto para o leitor de tela e para o rótulo do período no painel. */
export function periodoReferencia(g: Pick<ContaGold, "data_referencia" | "gerado_pela_fonte_em">): string {
  return `vigente em ${dataBR(g.data_referencia)} (arquivo gerado pela ANEEL em ${dataBR(g.gerado_pela_fonte_em)})`;
}

/**
 * P047, "o que mudou": a mediana da data contra a do dia 1º do último mês da
 * evolução, com o motivo da diferença de cobertura (distribuidoras fora do ranking).
 */
export function mudancaTarifa(dataReferencia: string, resumo: ResumoTarifas, evolucao: readonly LinhaEvolucao[]): string {
  const ult = [...evolucao].reverse().find((p) => p.mediana !== null);
  const hoje = `Em ${dataBR(dataReferencia)}, a mediana é ${num(resumo.mediana, 2)} R$/MWh entre ${resumo.n} distribuidoras com tarifa vigente.`;
  const antes = ult ? ` No dia 1º de ${mesAno(`${ult.m}-01`)}, era ${num(ult.mediana, 2)} R$/MWh entre ${ult.n}.` : "";
  const fora = resumo.fora_vigencia_recente + resumo.fora_sem_tarifa_ha_mais_de_90_dias;
  const motivo = fora
    ? ` Ficam fora do ranking ${resumo.fora_vigencia_recente} com a vigência encerrada há até 90 dias (a tarifa seguinte ainda não está no arquivo) e ${resumo.fora_sem_tarifa_ha_mais_de_90_dias} sem tarifa há mais de 90 dias; por isso as duas medianas não comparam o mesmo conjunto.`
    : "";
  return `${hoje}${antes}${motivo}`;
}

/** P050, "o que mudou" nos subsídios: categoria com a maior variação absoluta entre os dois últimos anos completos. */
export function mudancaSubsidios(s: Subsidios): string {
  const completos = s.anual.filter((a) => !a.parcial);
  if (completos.length < 2) return "Menos de dois anos completos publicados: sem comparação anual.";
  const [a0, a1] = completos.slice(-2);
  let maior: { cat: string; de: number; para: number } | null = null;
  for (const cat of categoriasSubsidio(s)) {
    const de = a0.categorias[cat];
    const para = a1.categorias[cat];
    if (de === null || de === undefined || para === null || para === undefined) continue;
    if (!maior || Math.abs(para - de) > Math.abs(maior.para - maior.de)) maior = { cat, de, para };
  }
  const total =
    a0.soma_categorias !== null && a1.soma_categorias !== null
      ? ` O total passou de ${reais(a0.soma_categorias / BI, 2)} bilhões para ${reais(a1.soma_categorias / BI, 2)} bilhões.`
      : "";
  if (!maior) return `Sem categoria com valor nos dois anos (${a0.ano} e ${a1.ano}).${total}`;
  return `De ${a0.ano} para ${a1.ano}, a maior mudança foi em ${maior.cat}: de ${reais(maior.de / BI, 2)} bilhões para ${reais(maior.para / BI, 2)} bilhões.${total}`;
}

/**
 * P048, "o que mudou": distribuidoras com valor negativo em componente de custo
 * (lido como crédito) na vigência atual, contra a faixa histórica do código.
 */
export function mudancaComposicao(comp: Composicao): string {
  return textoCreditos(comp, "atual");
}

/**
 * Mesmo texto de `mudancaComposicao`, com a vigência dita pela data de referência da página ("na vigência de 30/09/2026") no
 * lugar de "atual": o dado tem a própria data, e o texto de Entender não usa palavra de tempo relativo.
 */
export function mudancaComposicaoEm(comp: Composicao, dataReferencia: string): string {
  return textoCreditos(comp, `de ${dataBR(dataReferencia)}`);
}

function textoCreditos(comp: Composicao, vigencia: string): string {
  const cr = comp.creditos;
  const valores = cr.distribuidoras.map((d) => d.valor).filter((v): v is number => v !== null && Number.isFinite(v));
  if (!cr.distribuidoras.length) return `Nenhum valor negativo em componente de custo na vigência ${vigencia}.`;
  const faixa = cr.faixa_historica;
  const historico = faixa
    ? `, quando a faixa histórica do código, em ${faixa.n} vigências iniciadas até ${dataBR(faixa.vigencias_iniciadas_ate)}, ia de ${num(faixa.minimo, 2)} a ${num(faixa.maximo, 2)} R$/MWh`
    : "";
  const intervalo = valores.length ? ` (de ${num(Math.min(...valores), 2)} a ${num(Math.max(...valores), 2)} R$/MWh)` : "";
  // a componente aparece pela descrição do dicionário da fonte, não pelo código; sem descrição, o texto diz só "componente de custo"
  const descricoes = new Map(comp.grupos.flatMap((g) => g.componentes.map((c) => [c.codigo, c.descricao] as const)));
  const nomes = cr.codigos.map((c) => descricoes.get(c) ?? "componente de custo");
  return `${cr.distribuidoras.length} distribuidoras têm valor negativo na componente «${nomes.join(", ")}» na vigência ${vigencia}${intervalo}${historico}. O valor fica no grupo créditos, lido como crédito tarifário (leitura do observatório).`;
}

/* ---------- abertura (redesenho): referências do perfil, faixa de métricas e série em reais ---------- */

/**
 * Perfil de consumo (kWh/mês) na URL. A faixa de métricas da abertura e o painel de tarifas leem o mesmo parâmetro: escolher 100, 200
 * ou 300 kWh muda ao mesmo tempo a faixa, a figura das referências, o ranking, a frase e a tabela.
 */
export const CAMPO_PERFIL = campo(tiposUrl.opcao(["100", "200", "300"] as const), "200", { param: "perfil" });

/**
 * Custo do perfil (R$/mês) de uma tarifa TE + TUSD (R$/MWh): kWh × tarifa ÷ 1000, em centavos. A conta é feita em inteiros (tarifa em
 * centavos de R$/MWh) e o meio centavo exato sobe, como numa calculadora; a gold publica o custo de cada distribuidora e a mediana, e
 * esta função só serve às medidas que ela não publica (o 1º e o 3º quartil do perfil).
 */
export function custoDoPerfil(totalRsMwh: number | null | undefined, kwh: number): number | null {
  if (totalRsMwh === null || totalRsMwh === undefined || !Number.isFinite(totalRsMwh)) return null;
  const centavosPorMwh = Math.round(totalRsMwh * 100);
  return Math.round((centavosPorMwh * kwh) / 1000) / 100;
}

export type ExtremoPerfil = { cnpj: string; sigla: string; valor: number; tarifa: number; posicao: number };

export type ReferenciasPerfil = {
  perfil: Perfil;
  /** Distribuidoras com tarifa vigente na data: as do ranking e as da mediana (a mesma contagem do `resumo`). */
  n: number;
  menor: ExtremoPerfil | null;
  maior: ExtremoPerfil | null;
  mediana: number | null;
  p25: number | null;
  p75: number | null;
  /** Tarifa TE + TUSD (R$/MWh) de cada referência, como a gold publica, para a tabela equivalente da figura. */
  tarifa: { menor: number | null; p25: number | null; mediana: number | null; p75: number | null; maior: number | null };
};

/**
 * Menor, mediana e maior custo do perfil entre as distribuidoras com tarifa vigente, e o 1º e o 3º quartil. Menor e maior vêm da
 * linha de cada distribuidora (a primeira e a última posição do ranking), a mediana é a publicada em `resumo.perfis_mediana`: a
 * faixa de métricas, a figura, a frase e a tabela leem estes mesmos valores.
 */
export function referenciasDoPerfil(vigentes: readonly TarifaVigente[], resumo: ResumoTarifas, perfil: Perfil): ReferenciasPerfil {
  const chave = String(perfil) as "100" | "200" | "300";
  const ord = [...vigentes].sort((a, b) => a.posicao - b.posicao);
  const extremo = (v: TarifaVigente | undefined): ExtremoPerfil | null => {
    const valor = v?.perfis[chave];
    return v && valor !== null && valor !== undefined ? { cnpj: v.cnpj, sigla: rotuloDistribuidora(v.sigla, v.cnpj), valor, tarifa: v.total, posicao: v.posicao } : null;
  };
  const menor = extremo(ord[0]);
  const maior = extremo(ord[ord.length - 1]);
  return {
    perfil,
    n: resumo.n,
    menor,
    maior,
    mediana: resumo.perfis_mediana[chave],
    p25: custoDoPerfil(resumo.p25, perfil),
    p75: custoDoPerfil(resumo.p75, perfil),
    tarifa: { menor: menor?.tarifa ?? null, p25: resumo.p25, mediana: resumo.mediana, p75: resumo.p75, maior: maior?.tarifa ?? null },
  };
}

export type DestaquePerfil = { cnpj: string; sigla: string; valor: number; tarifa: number; posicao: number; n: number; diferenca: number | null };

/** As distribuidoras em destaque (?dist=) que estão no ranking, com o custo do perfil, a posição e a diferença para a mediana. */
export function destaquesDoPerfil(vigentes: readonly TarifaVigente[], resumo: ResumoTarifas, perfil: Perfil, cnpjs: readonly string[]): DestaquePerfil[] {
  const chave = String(perfil) as "100" | "200" | "300";
  const porCnpj = new Map(vigentes.map((v) => [v.cnpj, v]));
  const mediana = resumo.perfis_mediana[chave];
  return cnpjs.flatMap((cnpj) => {
    const v = porCnpj.get(cnpj);
    const valor = v?.perfis[chave];
    if (!v || valor === null || valor === undefined) return [];
    return [
      {
        cnpj,
        sigla: rotuloDistribuidora(v.sigla, v.cnpj),
        valor,
        tarifa: v.total,
        posicao: v.posicao,
        n: resumo.n,
        diferenca: mediana === null ? null : Math.round((valor - mediana) * 100) / 100,
      },
    ];
  });
}

/** Frase da distribuidora em destaque: custo do perfil, posição no ranking e diferença para a mediana, só descrição. */
export function textoDestaquePerfil(d: DestaquePerfil): string {
  const dif = d.diferenca === null ? "" : d.diferenca === 0 ? "; igual à mediana" : `; ${reais(Math.abs(d.diferenca))} ${d.diferenca > 0 ? "acima" : "abaixo"} da mediana`;
  return `${d.sigla}: ${reais(d.valor)}, posição ${d.posicao} de ${d.n} (1 é a menor tarifa)${dif}.`;
}

/** Leitura da figura das referências em uma frase (nome acessível do gráfico). */
export function textoReferenciasPerfil(r: ReferenciasPerfil): string {
  if (!r.menor || !r.maior || r.mediana === null) return `Sem referências do custo de ${r.perfil} kWh por mês nesta publicação.`;
  const meio = r.p25 !== null && r.p75 !== null ? `; a metade central das distribuidoras fica entre ${reais(r.p25)} e ${reais(r.p75)}` : "";
  return `Custo de ${r.perfil} kWh por mês, só pela tarifa B1 residencial: menor ${reais(r.menor.valor)} (${r.menor.sigla}), mediana ${reais(r.mediana)} e maior ${reais(r.maior.valor)} (${r.maior.sigla}), entre ${r.n} distribuidoras${meio}.`;
}

/**
 * Ressalva que acompanha a faixa de métricas da abertura: o que a tarifa não inclui e como a mediana é feita. O universo (quantas
 * distribuidoras) é o `n` do mesmo resumo que alimenta o ranking e a mediana.
 */
export function notaFaixaTarifa(resumo: ResumoTarifas): string {
  return (
    `Tarifa homologada de aplicação (TE + TUSD): não inclui tributos (ICMS, PIS/Pasep e Cofins), contribuição de iluminação pública nem bandeira, então não é o valor da fatura. ` +
    `A mediana é simples entre as ${resumo.n} distribuidoras com tarifa vigente na data, cada uma com o mesmo peso; não é o custo médio do país nem é ponderada por consumidores.`
  );
}

export type ResumoSerieReal = {
  /** Primeiro e último mês com mediana publicada (AAAA-MM). */
  inicio: string;
  fim: string;
  /** Mês do IPCA em que a série em reais está expressa (o último com índice publicado), AAAA-MM; null sem IPCA. */
  base: string | null;
  /** Menor e maior número de distribuidoras com tarifa no dia 1º entre os meses da série. */
  nMin: number;
  nMax: number;
  primeira: { m: string; nominal: number; real: number | null };
  ultimaComReal: { m: string; nominal: number; real: number } | null;
  /** Meses com mediana e sem valor real (IPCA ainda não publicado). */
  semReal: string[];
};

/** Resumo da mediana mensal em valores da época e em reais do mês-base do IPCA, lido das mesmas linhas do gráfico. */
export function resumoSerieReal(evolucao: readonly LinhaEvolucao[], ultimoIpca: string | null): ResumoSerieReal | null {
  const com = evolucao.filter((p): p is LinhaEvolucao & { mediana: number } => p.mediana !== null);
  if (!com.length) return null;
  const primeira = com[0];
  const fim = com[com.length - 1];
  const comReal = [...com].reverse().find((p) => p.real !== null);
  return {
    inicio: primeira.m,
    fim: fim.m,
    base: ultimoIpca,
    nMin: Math.min(...com.map((p) => p.n)),
    nMax: Math.max(...com.map((p) => p.n)),
    primeira: { m: primeira.m, nominal: primeira.mediana, real: primeira.real },
    ultimaComReal: comReal && comReal.real !== null ? { m: comReal.m, nominal: comReal.mediana, real: comReal.real } : null,
    semReal: com.filter((p) => p.real === null).map((p) => p.m),
  };
}

/** Frase da série em reais: primeiro e último mês com valor nas duas formas, e os meses sem IPCA publicado. */
export function textoSerieReal(r: ResumoSerieReal | null): string {
  if (!r) return "Sem mediana mensal publicada nesta publicação.";
  const rs = (v: number) => `${num(v, 2)} R$/MWh`;
  const mes = (m: string) => mesAno(`${m}-01`);
  const base = r.base ? mes(r.base) : null;
  const inicio =
    r.primeira.real !== null && base
      ? `Em ${mes(r.primeira.m)}, a mediana era de ${rs(r.primeira.nominal)} nos valores da época e de ${rs(r.primeira.real)} em reais de ${base}`
      : `Em ${mes(r.primeira.m)}, a mediana era de ${rs(r.primeira.nominal)} nos valores da época`;
  const fim = r.ultimaComReal ? `; em ${mes(r.ultimaComReal.m)}, de ${rs(r.ultimaComReal.nominal)} e de ${rs(r.ultimaComReal.real)}` : "";
  const sem = r.semReal.length ? ` ${r.semReal.map(mes).join(", ")} ${r.semReal.length === 1 ? "fica" : "ficam"} sem valor em reais (IPCA do mês ainda não publicado).` : "";
  return `${inicio}${fim}.${sem}`;
}
