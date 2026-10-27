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
  ComposicaoDistribuidora,
  ContaGold,
  EventoB1,
  FinanciamentoCde,
  GrupoCdeId,
  GrupoComponenteId,
  HistoricoB1,
  JanelaInflacao,
  Ligacao,
  PontoEvolucao,
  PorGrupo,
  ResumoTarifas,
  SemVigente,
  Simulador,
  Subsidios,
  TarifaVigente,
  UltimoEvento,
  VigenciaB1,
} from "./tipos-conta";
import type { Evidencia } from "./evidencia";
import { campo, tiposUrl, type Leitor } from "./estadoUrl";
import { AUSENTE, formatos, valorExibidoNoIdioma } from "./formato";
import { idiomaEnergia } from "./idioma";
import { LIMITE_COMPARACAO, type ColunaTabela } from "./tabela";
import { bandeiraNoIdioma, dadoTexto, txEm } from "./i18n/conta-inclusao";
import { fraseBandeira, situacaoBandeira } from "./bandeira-do-mes";
import type { Idioma } from "@/lib/idioma";

/* ---------- identidade visual (só tokens; cor nunca é o único portador) ---------- */

/** Ordem de empilhamento dos grupos: custos positivos primeiro, itens que reduzem a tarifa por último. */
export const ORDEM_GRUPOS: GrupoComponenteId[] = ["energia", "transmissao", "distribuicao", "perdas", "encargos", "outros", "creditos"]; // i18n: dado

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
  encargos: "var(--cor-energia)", // i18n: dado
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
  Distribuidora: "var(--cor-energia)", // i18n: dado
  "Lei 14.299/2022": "var(--serie-eolica)",
  Rural: "var(--serie-1)",
  "Água-esgoto-saneamento": "var(--serie-referencia)",
};
const COR_SEM_DECLARACAO = "var(--serie-2)";

export function corSubsidio(categoria: string): string {
  return COR_SUBSIDIO[categoria] ?? COR_SEM_DECLARACAO;
}

export const COR_GRUPO_CDE: Record<GrupoCdeId, string> = {
  tarifa_social: "var(--cor-energia)", // i18n: dado
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
/** 27/10/2026: município explícito do recorte, comum às versões pública e autenticada. */
export const CAMPO_MUNICIPIO_CONTA = campo(tiposUrl.texto({ max: 120 }), "", { param: "conta_municipio" });

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
  /** UF da área (uma ou mais, "PR, SC"), tipo e consumidores da distribuidora: das golds de Território e de Qualidade; null sem dado. */
  uf: string | null;
  tipo: string | null;
  ucs: number | null;
  /** Posição pela base econômica (1 = menor base TE + TUSD), a outra régua; null sem base. */
  posicao_base: number | null;
  /** Quanto a tarifa de aplicação fica acima (+) ou abaixo (−) da base econômica, em %; null sem base. */
  dif_base_pct: number | null;
};

/** Diferença, em %, a partir da qual a tarifa de aplicação e a base econômica contam histórias diferentes (marca † no ranking). */
export const LIMITE_DIFERENCA_BASE = 20;

/** A tarifa de aplicação difere da base econômica em mais de `LIMITE_DIFERENCA_BASE` %: a ordem do ranking muda conforme a régua. */
export function marcaBase(l: Pick<LinhaRanking, "dif_base_pct">): boolean {
  return l.dif_base_pct !== null && Math.abs(l.dif_base_pct) > LIMITE_DIFERENCA_BASE;
}

/** Tipo de distribuidora no idioma (o português é o da gold de Qualidade; o inglês segue a terminologia do observatório). */
export function rotuloTipo(tipo: TipoDistribuidora, idioma: Idioma = idiomaEnergia()): string {
  return idioma === "en" ? ROTULO_TIPO_EN[tipo] : ROTULO_TIPO[tipo];
}

/** Sigla exibida; o CNPJ entra quando a fonte não publica sigla (nunca uma sigla inventada). */
export function rotuloDistribuidora(sigla: string | null | undefined, cnpj: string): string {
  return sigla && sigla.trim() ? sigla : `CNPJ ${cnpj}`;
}

/**
 * Linhas do ranking na ordem publicada (posição 1 = menor tarifa), com o custo do perfil escolhido. `info` traz UF, tipo e UCs de cada
 * distribuidora (`infoDistribuidoras`); sem ele, as três colunas ficam sem dado.
 */
export function linhasRanking(vigentes: readonly TarifaVigente[], perfil: Perfil, info: Readonly<Record<string, InfoDistribuidora>> = {}, idioma: Idioma = idiomaEnergia()): LinhaRanking[] {
  // a outra régua: posição pela base econômica (a tarifa sem os componentes financeiros do processo tarifário), empate pela posição da aplicação
  const pelaBase = [...vigentes]
    .filter((v) => v.be_total !== null && v.be_total !== undefined)
    .sort((a, b) => (a.be_total as number) - (b.be_total as number) || a.posicao - b.posicao);
  const posicaoBase = new Map(pelaBase.map((v, k) => [v.cnpj, k + 1]));
  return [...vigentes]
    .sort((a, b) => a.posicao - b.posicao)
    .map((v) => {
      const i = info[v.cnpj];
      const dif = v.be_total ? (v.total / v.be_total - 1) * 100 : null;
      return {
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
        uf: i?.uf ?? null,
        tipo: i?.tipo ? rotuloTipo(i.tipo, idioma) : null,
        ucs: i?.ucs ?? null,
        posicao_base: posicaoBase.get(v.cnpj) ?? null,
        dif_base_pct: dif === null ? null : Math.round(dif * 100) / 100,
      };
    });
}

/** Colunas da tabela do ranking (P047): a mesma matriz vai para a tela e para a exportação. */
export function colunasRanking(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
  { id: "posicao", rotulo: tx("Posição (1 = menor)", "Position (1 = lowest)"), tipo: "numero", casas: 0 },
  { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
  { id: "uf", rotulo: tx("UF", "State"), tipo: "texto" },
  { id: "tipo", rotulo: tx("Tipo", "Type"), tipo: "texto" },
  { id: "ucs", rotulo: tx("Consumidores (UCs)", "Consumers (consumer units)"), tipo: "numero", casas: 0 },
  { id: "nome", rotulo: tx("Razão social", "Legal name"), tipo: "texto", idiomaTexto: "nome" },
  { id: "id", rotulo: "CNPJ", tipo: "texto" },
  { id: "te", rotulo: "TE", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  { id: "tusd", rotulo: "TUSD", tipo: "numero", unidade: "R$/MWh", casas: 2 },
  {
    id: "total", // i18n: dado
    rotulo: "TE + TUSD",
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  {
    id: "custo_100",
    rotulo: "100 kWh",
    tipo: "numero",
    unidade: tx("R$/mês", "R$/month"),
    casas: 2,
  },
  {
    id: "custo_200",
    rotulo: "200 kWh",
    tipo: "numero",
    unidade: tx("R$/mês", "R$/month"),
    casas: 2,
  },
  {
    id: "custo_300",
    rotulo: "300 kWh",
    tipo: "numero",
    unidade: tx("R$/mês", "R$/month"),
    casas: 2,
  },
  {
    id: "be_total",
    rotulo: tx("Base econômica (TE + TUSD)", "Economic base (TE + TUSD)"),
    tipo: "numero",
    unidade: "R$/MWh",
    casas: 2,
  },
  { id: "posicao_base", rotulo: tx("Posição pela base econômica", "Position by economic base"), tipo: "numero", casas: 0 },
  { id: "dif_base_pct", rotulo: tx("Aplicação contra a base", "Applied tariff vs. base"), tipo: "percentual", casas: 1 },
  { id: "inicio", rotulo: tx("Início da vigência", "Validity start"), tipo: "data" },
  { id: "fim", rotulo: tx("Fim da vigência", "Validity end"), tipo: "data" },
  { id: "ato", rotulo: tx("Ato da ANEEL", "ANEEL act"), tipo: "texto", idiomaTexto: "nome" },
  ];
}
export const COLUNAS_RANKING: ColunaTabela[] = colunasRanking("pt");

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
export function linhasEventos(eventos: readonly EventoB1[], idioma: Idioma = idiomaEnergia()): LinhaEvento[] {
  const f = formatos(idioma);
  const tx = txEm(idioma);
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
      meses_ipca: tx(`${f.mesAno(`${e[9]}-01`)} a ${f.mesAno(`${e[10]}-01`)}`, `${f.mesAno(`${e[9]}-01`)} to ${f.mesAno(`${e[10]}-01`)}`),
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
  /**
   * Diferença entre o total publicado (a tarifa, ou 100 em %) e a soma das partes, cada uma arredondada em separado (±0,01 a 0,02
   * R$/MWh, ±0,01 ponto percentual): o gráfico a desenha como a última parte da pilha, para que a pilha termine no total publicado,
   * o mesmo da tabela e do arquivo, em vez de num total refeito por soma de partes arredondadas. null quando falta alguma parte.
   */
  ajuste: number | null;
} & Record<GrupoComponenteId, number | null>;

/** Série do ajuste de arredondamento no gráfico de composição: cinza neutro, sem o significado de nenhum grupo. */
export const ID_AJUSTE = "ajuste";
export function rotuloAjuste(idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  return tx("Ajuste de arredondamento (não é componente)", "Rounding adjustment (not a component)");
}
export const ROTULO_AJUSTE = rotuloAjuste("pt");
export const COR_AJUSTE = "var(--serie-5)";

/** Ajuste de uma linha: o alvo (tarifa em R$/MWh ou 100 em %) menos a soma das partes; zero quando a diferença não aparece nas duas casas. */
export function ajusteDeArredondamento(partes: readonly (number | null)[], alvo: number | null): number | null {
  if (alvo === null || partes.some((p) => p === null)) return null;
  const a = arredondar(alvo - (partes as number[]).reduce((x, y) => x + y, 0), 2);
  return Math.abs(a) < 0.005 ? 0 : a;
}

/** Maior diferença, em módulo, entre as linhas (para a nota de arredondamento); 0 quando nenhuma linha tem diferença. */
export function maiorAjuste(linhas: readonly Pick<LinhaComposicao, "ajuste">[]): number {
  return linhas.reduce((m, l) => (l.ajuste === null ? m : Math.max(m, Math.abs(l.ajuste))), 0);
}

/**
 * Uma linha por distribuidora com composição, na unidade pedida: R$/MWh (os grupos
 * somam TE + TUSD) ou % da tarifa (participações publicadas). Ordem: a do ranking
 * da P047, ou decrescente pelo grupo escolhido (ausência no fim).
 */
export function linhasComposicao(
  comp: Pick<ComposicaoDaTela, "distribuidoras">,
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
    l.ajuste = ajusteDeArredondamento(ORDEM_GRUPOS.map((g) => fonte[g]), unidade === "rs" ? d.total : 100);
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
export function idsComposicaoPadrao(comp: Pick<ComposicaoDaTela, "distribuidoras">, vigentes: readonly Pick<TarifaVigente, "cnpj" | "posicao">[], referencia: string | null): string[] {
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
  comp: Pick<ComposicaoDaTela, "distribuidoras" | "media">,
  vigentes: readonly Pick<TarifaVigente, "cnpj" | "posicao">[],
  unidade: UnidadeComposicao,
  ids: readonly string[],
  idioma: Idioma = idiomaEnergia(),
): LinhaComposicao[] {
  const tx = txEm(idioma);
  const todas = linhasComposicao(comp, vigentes, unidade);
  const porId = new Map(todas.map((l) => [l.id, l]));
  const out: LinhaComposicao[] = [];
  const m = comp.media;
  if (m) {
    const l = {
      id: ID_MEDIA,
      sigla: tx(`Média de ${m.n}`, `Average of ${m.n}`),
      posicao: null,
      total: m.total_rs_mwh,
      cde: unidade === "rs" ? m.cde_rs_mwh : m.cde_pct,
    } as LinhaComposicao;
    for (const g of ORDEM_GRUPOS) l[g] = unidade === "rs" ? m.grupos_rs_mwh[g] : m.grupos_pct[g];
    l.ajuste = ajusteDeArredondamento(ORDEM_GRUPOS.map((g) => l[g]), unidade === "rs" ? m.total_rs_mwh : 100);
    out.push(l);
  }
  for (const id of ids) {
    const l = porId.get(id);
    if (l) out.push(l);
  }
  return out;
}

/** Colunas da tabela de composição (P048), na unidade exibida. */
export function colunasComposicao(rotulo: ReadonlyMap<string, string>, emPct: boolean, idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  const tipo: ColunaTabela["tipo"] = emPct ? "percentual" : "numero";
  const unidade = emPct ? undefined : "R$/MWh";
  // as partes são publicadas com duas casas nas duas unidades: mostrar menos casas arredondaria de novo o que já foi arredondado
  const casas = 2;
  return [
    { id: "posicao", rotulo: tx("Posição no ranking", "Position in the ranking"), tipo: "numero", casas: 0 },
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
    { id: "id", rotulo: "CNPJ", tipo: "texto" },
    {
      id: "total", // i18n: dado
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
      rotulo: tx("Componentes CDE (dentro dos encargos)", "CDE components (within sector charges)"),
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
export function linhasGrupos(comp: Pick<ComposicaoDaTela, "grupos" | "distribuidoras" | "media" | "mediana">, cnpjDestaque: string | null): LinhaGrupo[] {
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

export function nomeLigacao(l: Ligacao, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const nomes: Record<Ligacao, string> = {
    monofasico: tx("monofásica", "single-phase"),
    bifasico: tx("bifásica", "two-phase"),
    trifasico: tx("trifásica", "three-phase"),
  };
  return nomes[l];
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
  idioma: Idioma = idiomaEnergia(),
): ResultadoSimulacao {
  const tx = txEm(idioma);
  if (!Number.isFinite(kwh) || kwh < 0) return { disponivel: false, motivo: tx("consumo inválido", "invalid consumption") };
  const minimo = regras.custo_disponibilidade_kwh[ligacao];
  if (minimo === undefined)
    return {
      disponivel: false,
      motivo: tx(`tipo de ligação desconhecido: ${ligacao}`, `unknown connection type: ${ligacao}`),
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
  const nomeLig = tx(`ligação ${nomeLigacao(ligacao, idioma)}`, `${nomeLigacao(ligacao, idioma)} connection`);
  const abaixoDoMinimo = tx(`Consumo abaixo do custo de disponibilidade: faturados ${minimo} kWh (${nomeLig}).`, `Consumption below the availability cost: ${minimo} kWh billed (${nomeLig}).`);
  if (classe === "residencial" || classe === "rural" || classe === "demais") {
    const t = tarifaDaChave(tarifas, classe);
    if (t === null)
      return {
        disponivel: false,
        motivo: tx("tarifa da classe não publicada para esta distribuidora na vigência", "class tariff not published for this distribution utility in the validity period"),
      };
    fat = Math.max(kwh, minimo);
    linha(tx("Energia faturada (TE + TUSD)", "Billed energy (TE + TUSD)"), fat, t);
    if (fat > kwh) obs.push(abaixoDoMinimo);
    kwhBandeira = kwh;
  } else if (classe === "desconto_social") {
    const t1 = tarifaDaChave(tarifas, "ds1");
    const t2 = tarifaDaChave(tarifas, "ds2");
    if (t1 === null || t2 === null)
      return {
        disponivel: false,
        motivo: tx("tarifas do Desconto Social não publicadas para esta distribuidora na vigência", "Desconto Social tariffs not published for this distribution utility in the validity period"),
      };
    const lim = regras.desconto_social_limite_kwh;
    fat = Math.max(kwh, minimo);
    linha(tx(`Faixa 01, até ${lim} kWh, sem quotas da CDE`, `Band 01, up to ${lim} kWh, without CDE quotas`), Math.min(fat, lim), t1);
    if (fat > lim) linha(tx(`Faixa 02, acima de ${lim} kWh`, `Band 02, above ${lim} kWh`), fat - lim, t2);
    if (fat > kwh) obs.push(abaixoDoMinimo);
    obs.push(tx("Leitura por parcela das faixas homologadas; regra da REN não conferida (acervo da ANEEL bloqueado).", "Band-by-band reading of the ratified bands; REN rule not checked (ANEEL archive blocked)."));
    kwhBandeira = kwh;
  } else if (classe === "tarifa_social") {
    const t1 = tarifaDaChave(tarifas, "ts1");
    const t2 = tarifaDaChave(tarifas, "ts2");
    if (t1 === null || t2 === null)
      return {
        disponivel: false,
        motivo: tx("tarifas da Tarifa Social não publicadas para esta distribuidora na vigência", "Tarifa Social tariffs not published for this distribution utility in the validity period"),
      };
    const lim = regras.tarifa_social_limite_kwh;
    const q1 = Math.min(kwh, lim);
    linha(tx(`Faixa 01, até ${lim} kWh`, `Band 01, up to ${lim} kWh`), q1, t1);
    // desconto integral da faixa 01 (regra conferida em simulador.regras_texto); o limite vem da gold, nunca do código
    linha(tx("Desconto integral na faixa 01 (custeado pela CDE)", "Full discount in band 01 (funded by the CDE)"), q1, t1, -1);
    if (kwh > lim) linha(tx(`Faixa 02, acima de ${lim} kWh, sem desconto`, `Band 02, above ${lim} kWh, no discount`), kwh - lim, t2);
    obs.push(
      tx(
        `Custo de disponibilidade não aplicado: gratuidade até ${lim} kWh inclusive em ligação trifásica (ANEEL); acima de ${lim} kWh a regra do mínimo não foi conferida.`,
        `Availability cost not applied: free of charge up to ${lim} kWh, including on three-phase connections (ANEEL); above ${lim} kWh the minimum rule was not checked.`,
      ),
    );
    fat = kwh;
    kwhBandeira = Math.max(kwh - lim, 0);
    if (kwhBandeira < kwh) obs.push(tx(`Bandeira aplicada só sobre a parcela acima de ${lim} kWh (leitura da página oficial da ANEEL).`, `Tariff flag applied only to the portion above ${lim} kWh (reading of ANEEL's official page).`));
  } else {
    return {
      disponivel: false,
      motivo: tx(`classe desconhecida: ${String(classe)}`, `unknown class: ${String(classe)}`),
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
  idioma: Idioma = idiomaEnergia(),
): { kwh: string; total: number | null; energia: number | null }[] {
  const out: { kwh: string; total: number | null; energia: number | null }[] = [];
  for (let q = 0; q <= ate; q += passo) {
    const r = simular(tarifas, classe, q, ligacao, adicionalRsMwh, regras, idioma);
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
export function colunasJanela(idioma: Idioma = idiomaEnergia()): ColunaTabela[] {
  const tx = txEm(idioma);
  return [
    { id: "sigla", rotulo: tx("Distribuidora", "Distribution utility"), tipo: "texto", idiomaTexto: "nome" },
    { id: "id", rotulo: "CNPJ", tipo: "texto" },
    {
      id: "variacao",
      rotulo: tx("Variação da tarifa B1", "Change in the B1 tariff"),
      tipo: "percentual",
      casas: 2,
    },
    {
      id: "real",
      rotulo: tx("Variação real (descontado o IPCA)", "Real change (IPCA discounted)"),
      tipo: "percentual",
      casas: 2,
    },
  ];
}
export const COLUNAS_JANELA: ColunaTabela[] = colunasJanela("pt");

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
export function linhasSubsidios(s: Subsidios, idioma: Idioma = idiomaEnergia()): Record<string, string | number | null>[] {
  const tx = txEm(idioma);
  const cats = categoriasSubsidio(s);
  return s.anual.map((a) => {
    const l: Record<string, string | number | null> = {
      ano: a.ano,
      rotulo: a.parcial ? tx(`${a.ano} (${a.meses} ${a.meses === 1 ? "mês" : "meses"}, parcial)`, `${a.ano} (${a.meses} ${a.meses === 1 ? "month" : "months"}, partial)`) : a.ano,
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

const rsKwh = (rsMwh: number | null | undefined, casas = 4, idioma: Idioma = idiomaEnergia()) =>
  rsMwh === null || rsMwh === undefined || !Number.isFinite(rsMwh) ? AUSENTE : `${formatos(idioma).reais(rsMwh / 1000, casas)}/kWh`;

/** Ordinal inglês ("1st", "2nd", "23rd", "11th"), para as posições do ranking na página inglesa. */
function ordinalEn(n: number): string {
  const r100 = n % 100;
  const r10 = n % 10;
  const suf = r100 >= 11 && r100 <= 13 ? "th" : r10 === 1 ? "st" : r10 === 2 ? "nd" : r10 === 3 ? "rd" : "th";
  return `${n}${suf}`;
}

/** Lista com vírgulas e "e" ("and" em inglês) antes do último item. */
function listaE(xs: readonly string[], idioma: Idioma, sep = ", "): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(sep)} ${txEm(idioma)("e", "and")} ${xs[xs.length - 1]}`;
}

/**
 * Minúscula para usar um rótulo no meio da frase sem estragar siglas: só a palavra
 * escrita como nome próprio ("Vermelha", "Residencial") vira minúscula; sigla e
 * código ("P1", "B1", "B", "CDE") ficam como estão.
 */
export function minuscula(s: string): string {
  return s.replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (w) => (/^[A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ]+$/.test(w) ? w.toLowerCase() : w));
}

/** Variação com verbo: "subiu 11,18%", "caiu 2,10%", "ficou estável (0,00%)". */
export function verboVariacao(v: number | null | undefined, casas = 2, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  if (v === null || v === undefined || !Number.isFinite(v)) return tx("não tem variação calculável", "has no computable change");
  const r = Number(v.toFixed(casas));
  if (r > 0) return tx(`subiu ${f.pct(r, casas)}`, `rose ${f.pct(r, casas)}`);
  if (r < 0) return tx(`caiu ${f.pct(Math.abs(r), casas)}`, `fell ${f.pct(Math.abs(r), casas)}`);
  return tx(`ficou estável (${f.pct(0, casas)})`, `remained stable (${f.pct(0, casas)})`);
}

/** P047: quanto custa o perfil escolhido, do menor ao maior, e a mediana. */
export function respostaTarifa(dataReferencia: string, resumo: ResumoTarifas, vigentes: readonly TarifaVigente[], perfil: Perfil, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { dataBR, reais } = formatos(idioma);
  const chave = String(perfil) as "100" | "200" | "300";
  const ord = [...vigentes].sort((a, b) => a.posicao - b.posicao);
  const menor = ord[0];
  const maior = ord[ord.length - 1];
  if (!menor || !maior || resumo.n === 0)
    return tx(
      `Em ${dataBR(dataReferencia)}, nenhuma distribuidora tem tarifa B1 residencial vigente no arquivo da ANEEL.`,
      `On ${dataBR(dataReferencia)}, no distribution utility has a residential B1 tariff in force in ANEEL's file.`,
    );
  const a = `${reais(menor.perfis[chave])} (${rotuloDistribuidora(menor.sigla, menor.cnpj)})`;
  const b = `${reais(maior.perfis[chave])} (${rotuloDistribuidora(maior.sigla, maior.cnpj)})`;
  return tx(
    `Em ${dataBR(dataReferencia)}, ${perfil} kWh no mês custam, só pela tarifa B1 residencial homologada (TE + TUSD, sem tributos e sem bandeira), ` +
      `de ${a} a ${b} entre as ${resumo.n} distribuidoras com tarifa vigente no arquivo; ` +
      `a mediana dessas ${resumo.n} é ${reais(resumo.perfis_mediana[chave])}, ou ${rsKwh(resumo.mediana, 4, idioma)}.`,
    `On ${dataBR(dataReferencia)}, ${perfil} kWh a month cost, on the ratified residential B1 tariff alone (TE + TUSD, without taxes and without the tariff flag), ` +
      `from ${a} to ${b} among the ${resumo.n} distribution utilities with a tariff in force in the file; ` +
      `the median of these ${resumo.n} is ${reais(resumo.perfis_mediana[chave])}, or ${rsKwh(resumo.mediana, 4, idioma)}.`,
  );
}

/** P047, histórico: quantas mudanças e a última, para a distribuidora em destaque. */
export function respostaHistorico(sigla: string, eventos: readonly EventoB1[], vigencias: readonly VigenciaB1[], idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { dataBR, pct } = formatos(idioma);
  if (!vigencias.length) return tx(`${sigla}: o arquivo não traz vigência da tarifa B1 residencial.`, `${sigla}: the file has no validity period for the residential B1 tariff.`);
  const ult = [...eventos].sort((a, b) => (a[0] < b[0] ? -1 : 1)).at(-1);
  const d0 = dataBR(vigencias[0][0]);
  const d1 = dataBR(vigencias[vigencias.length - 1][1]);
  const base = tx(
    `${sigla}: tarifa B1 publicada de ${d0} a ${d1}, com ${eventos.length} ${eventos.length === 1 ? "mudança" : "mudanças"} de valor ou de ato.`,
    `${sigla}: B1 tariff published from ${d0} to ${d1}, with ${eventos.length} ${eventos.length === 1 ? "change" : "changes"} in value or act.`,
  );
  if (!ult) return base;
  const perimetro = ult[11] ? tx(` Essa mudança é de perímetro (incorporação, ${ult[11]}): compara áreas diferentes.`, ` This is a perimeter change (merger, ${ult[11]}): it compares different areas.`) : "";
  return tx(
    `${base} Na última, em ${dataBR(ult[0])} (${ult[1]}), a tarifa ${verboVariacao(ult[5], 2, idioma)}; o IPCA desde a mudança anterior foi ${pct(ult[8], 2)}.${perimetro}`,
    `${base} In the latest, on ${dataBR(ult[0])} (${ult[1]}), the tariff ${verboVariacao(ult[5], 2, idioma)}; the IPCA since the previous change was ${pct(ult[8], 2)}.${perimetro}`,
  );
}

/** P048: participação de cada grupo na composição média (a que fecha com o total). */
export function respostaComposicao(comp: Composicao, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { pct, reais } = formatos(idioma);
  const m = comp.media;
  if (!m || m.total_rs_mwh === null)
    return tx("Sem composição publicada na data: o conjunto de componentes não cobre as tarifas vigentes.", "No composition published on the date: the component dataset does not cover the tariffs in force.");
  const rot = new Map(comp.grupos.map((g) => [g.id, minuscula(dadoTexto(g.rotulo, idioma))]));
  const positivos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) > 0).sort((a, b) => (m.grupos_pct[b] ?? 0) - (m.grupos_pct[a] ?? 0));
  const negativos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) < 0);
  const partes = positivos.map((g) => `${rot.get(g)} ${pct(m.grupos_pct[g], 1)}`);
  const lista = listaE(partes, idioma);
  const negs = negativos.map((g) => `${rot.get(g)} ${pct(m.grupos_pct[g], 1)}`).join(tx(" e ", " and "));
  const reduz = negativos.length ? tx(` Itens com valor negativo reduzem a tarifa: ${negs}.`, ` Items with a negative value reduce the tariff: ${negs}.`) : "";
  const cde =
    m.cde_pct !== null
      ? tx(` As componentes CDE somam ${pct(m.cde_pct, 1)} da tarifa e já estão dentro dos encargos.`, ` CDE components add up to ${pct(m.cde_pct, 1)} of the tariff and are already within sector charges.`)
      : "";
  return tx(
    `Na média simples das ${m.n} distribuidoras com componentes publicadas (tarifa média de ${reais(m.total_rs_mwh / 1000, 4)}/kWh), a tarifa B1 se divide em ${lista}.${reduz}${cde}`,
    `In the simple average of the ${m.n} distribution utilities with published components (average tariff of ${reais(m.total_rs_mwh / 1000, 4)}/kWh), the B1 tariff splits into ${lista}.${reduz}${cde}`,
  );
}

/**
 * P049: o resultado da simulação em uma frase, sempre com o rótulo de estimativa.
 * `bandeira` null quer dizer adicional não publicado: a frase diz que a bandeira
 * ficou fora, em vez de chamar a ausência de "sem acréscimo".
 */
export function respostaSimulacao(
  r: ResultadoSimulacao,
  sigla: string,
  rotuloClasse: string,
  kwh: number,
  bandeira: string | null,
  rotuloEstimativa: string,
  idioma: Idioma = idiomaEnergia(),
): string {
  const tx = txEm(idioma);
  const { reais, num } = formatos(idioma);
  if (!r.disponivel) return tx(`Simulação indisponível para ${sigla} (${rotuloClasse}): ${r.motivo}.`, `Simulation unavailable for ${sigla} (${rotuloClasse}): ${r.motivo}.`);
  const b = bandeira === null ? "" : minuscula(bandeiraNoIdioma(bandeira, idioma));
  const band =
    bandeira === null
      ? tx(", sem a bandeira, cujo adicional não está publicado para o mês", ", without the tariff flag, whose surcharge is not published for the month")
      : r.bandeira > 0
        ? tx(`, dos quais ${reais(r.bandeira)} de bandeira ${b} sobre ${num(r.kwh_bandeira, 0)} kWh`, `, of which ${reais(r.bandeira)} from the ${b} tariff flag on ${num(r.kwh_bandeira, 0)} kWh`)
        : tx(`, sem acréscimo de bandeira (${b})`, `, with no tariff flag surcharge (${b})`);
  return tx(
    `Para ${num(kwh, 0)} kWh no mês na ${sigla}, classe ${minuscula(rotuloClasse)}, a estimativa é de ${reais(r.total)}${band}. ${rotuloEstimativa}`,
    `For ${num(kwh, 0)} kWh a month at ${sigla}, ${minuscula(rotuloClasse)} class, the estimate is ${reais(r.total)}${band}. ${rotuloEstimativa}`,
  );
}

/** P050: variação da tarifa B1 na janela contra o IPCA do mesmo período. */
export function respostaReajustes(j: JanelaInflacao, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { dataBR, pct } = formatos(idioma);
  if (j.mediana_pct === null || j.ipca_pct === null)
    return tx(
      `Sem comparação com o IPCA na janela de ${j.meses} meses: falta índice ou tarifa nas duas datas.`,
      `No comparison with the IPCA in the ${j.meses}-month window: the index or the tariff is missing on the two dates.`,
    );
  const fora = j.excluidas_sem_tarifa_nas_duas_datas + j.excluidas_mudanca_perimetro.length;
  const foraTxt = fora
    ? tx(
        ` ${fora === 1 ? "Fica fora 1 distribuidora" : `Ficam fora ${fora} distribuidoras`} (sem tarifa numa das datas ou com área alterada por incorporação).`,
        ` ${fora === 1 ? "1 distribution utility is left out" : `${fora} distribution utilities are left out`} (no tariff on one of the dates or area changed by a merger).`,
      )
    : "";
  const v = verboVariacao(j.mediana_pct, 2, idioma);
  return tx(
    `De ${dataBR(j.de)} a ${dataBR(j.ate)} (${j.meses} meses), a tarifa B1 residencial ${v} na mediana de ${j.n} distribuidoras, ` +
      `contra IPCA de ${pct(j.ipca_pct, 2)}: ${j.acima_ipca} ficaram acima da inflação e ${j.abaixo_ou_igual_ipca} abaixo ou igual.${foraTxt} ` +
      "É a variação da tarifa homologada entre as duas datas, não o efeito médio do processo tarifário de cada distribuidora.",
    `From ${dataBR(j.de)} to ${dataBR(j.ate)} (${j.meses} months), the residential B1 tariff ${v} at the median of ${j.n} distribution utilities, ` +
      `against IPCA of ${pct(j.ipca_pct, 2)}: ${j.acima_ipca} were above inflation and ${j.abaixo_ou_igual_ipca} at or below it.${foraTxt} ` +
      "It is the change in the ratified tariff between the two dates, not the average effect of each utility's tariff process.",
  );
}

/** P050: bandeira do mês e quantos meses publicados tiveram acréscimo. */
/**
 * Resposta do P050 (bandeiras). `mesCorrente` ('AAAA-MM') é o mês em que a página foi gerada; sem ele, vale o mês de referência da gold.
 * Quando o mês corrente ainda não está no arquivo, a resposta diz isso e qual é a última registrada (nunca chama a anterior de vigente).
 */
export function respostaBandeira(b: Bandeiras, idioma: Idioma = idiomaEnergia(), mesCorrente?: string): string {
  const tx = txEm(idioma);
  const { mesAno } = formatos(idioma);
  const v = b.vigente;
  const publicados = b.acionamento.filter((a) => a.bandeira !== null);
  const comAcrescimo = publicados.filter((a) => a.bandeira !== "Verde").length; // i18n: dado
  const inicio = b.acionamento[0]?.m;
  const m0 = inicio ? mesAno(`${inicio}-01`) : "";
  const m1 = inicio ? mesAno(`${b.acionamento[b.acionamento.length - 1].m}-01`) : "";
  const historico = inicio
    ? tx(
        ` De ${m0} a ${m1}, ${comAcrescimo} dos ${publicados.length} meses publicados tiveram bandeira diferente da verde.`,
        ` From ${m0} to ${m1}, ${comAcrescimo} of the ${publicados.length} published months had a tariff flag other than green.`,
      )
    : "";
  if (!v || !v.bandeira) return tx(`O conjunto de bandeiras não traz acionamento publicado.${historico}`, `The tariff flag dataset has no published activation.${historico}`);
  const valor = v.bandeira === "Verde" ? tx("sem acréscimo", "no surcharge") : tx(`acréscimo de ${rsKwh(v.rs_mwh, 5, idioma)} consumido`, `a surcharge of ${rsKwh(v.rs_mwh, 5, idioma)} consumed`); // i18n: dado
  const situacao = situacaoBandeira(v, mesCorrente ?? v.mes_referencia ?? v.mes);
  const aviso = situacao.estado === "corrente" ? "" : ` ${fraseBandeira(situacao, idioma)}`;
  const nome = minuscula(bandeiraNoIdioma(v.bandeira, idioma));
  return tx(
    `A bandeira de ${mesAno(`${v.mes}-01`)} é ${nome}: ${valor}, fora dos sistemas isolados.${historico}${aviso}`,
    `The tariff flag for ${mesAno(`${v.mes}-01`)} is ${nome}: ${valor}, outside the isolated systems.${historico}${aviso}`,
  );
}

/**
 * Valores nominais (a moeda da época, como a fonte publica) ou em reais do mês-base do IPCA: a escolha do leitor (?valores=) vale para o
 * painel inteiro, então toda frase, número de destaque, tabela e exportação que traz dinheiro do painel de subsídios e da CDE passa por
 * aqui e diz em que moeda está. `fatores` traz o fator de cada ano (`fatoresReaisPorAno`); ano sem fator não tem valor em reais, e o
 * nominal nunca passa por real.
 */
export type ModoValores = "nominal" | "real";
export const CAMPO_VALORES = campo(tiposUrl.opcao(["nominal", "real"] as const), "nominal", { param: "valores" });
export type ValoresDoPainel = { modo: ModoValores; base: string | null; fatores: Readonly<Record<string, FatorReal | null>> };
export const VALORES_NOMINAIS: ValoresDoPainel = { modo: "nominal", base: null, fatores: {} };

/** O valor (em R$) do ano na moeda escolhida: o nominal, ou o nominal vezes o fator do ano; null sem valor ou, em reais, sem fator do ano. */
export function valorNoModo(rs: number | null | undefined, ano: string, v: ValoresDoPainel): number | null {
  if (rs === null || rs === undefined || !Number.isFinite(rs)) return null;
  if (v.modo === "nominal") return rs;
  const f = v.fatores[ano] ?? null;
  return f ? rs * f.fator : null;
}

/** "em reais de ago/2026" ou "nominais"; a frase de moeda que acompanha todo número do painel. */
export function rotuloMoeda(v: ValoresDoPainel, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  return v.modo === "real" && v.base ? tx(`em reais de ${v.base}`, `in ${v.base} reais`) : tx("nominais, na moeda da época", "nominal, in the currency of the time");
}

/** P050: subsídios do último ano completo e a maior categoria. */
export function respostaSubsidios(s: Subsidios, v: ValoresDoPainel = VALORES_NOMINAIS, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { reais } = formatos(idioma);
  const ano = s.anual.find((a) => a.ano === s.ultimo_ano_completo);
  if (!ano || ano.soma_categorias === null) return tx("Sem ano completo de subsídios tarifários publicado.", "No complete year of tariff subsidies published.");
  const total = valorNoModo(ano.soma_categorias, ano.ano, v);
  const nominal = reais(ano.soma_categorias / BI, 2);
  if (total === null) {
    return tx(
      `Em ${ano.ano}, o valor em reais de ${v.base ?? "mês-base"} não pode ser calculado: o IPCA não cobre o ano. O valor nominal, na moeda da época, é ${nominal} bilhões.`,
      `In ${ano.ano}, the value in ${v.base ?? "base-month"} reais cannot be calculated: the IPCA does not cover the year. The nominal value, in the currency of the time, is ${nominal} billion.`,
    );
  }
  const cats = Object.entries(ano.categorias)
    .filter((e): e is [string, number] => e[1] !== null)
    .sort((a, b) => b[1] - a[1]);
  const maior = cats[0];
  const valorMaior = maior ? reais((valorNoModo(maior[1], ano.ano, v) as number) / BI, 2) : "";
  const maiorTxt = maior
    ? tx(`; a maior categoria foi ${maior[0]} (${valorMaior} bilhões)`, `; the largest category was ${dadoTexto(maior[0], idioma)} (${valorMaior} billion)`)
    : "";
  const moeda =
    v.modo === "real"
      ? tx(
          ` Valores ${rotuloMoeda(v, idioma)}, corrigidos pelo IPCA; o valor nominal, na moeda da época, é ${nominal} bilhões.`,
          ` Values are ${rotuloMoeda(v, idioma)}, adjusted by the IPCA; the nominal value, in the currency of the time, is ${nominal} billion.`,
        )
      : tx(` Valores ${rotuloMoeda(v, idioma)}.`, ` Values are ${rotuloMoeda(v, idioma)}.`);
  return tx(
    `Em ${ano.ano}, foram homologados ${reais(total / BI, 2)} bilhões para repasse da Conta de Desenvolvimento Energético (CDE) às distribuidoras, ` +
      `para cobrir descontos a categorias de usuários${maiorTxt}. É o valor homologado, não o desembolso realizado, e não são transferências a famílias.${moeda}`,
    `In ${ano.ano}, ${reais(total / BI, 2)} billion was ratified for transfer from the Energy Development Account (CDE) to distribution utilities, ` +
      `to cover discounts to user categories${maiorTxt}. It is the ratified amount, not the actual disbursement, and these are not transfers to families.${moeda}`,
  );
}

/** P050: orçamento da CDE do último ano, peso das quotas e da Tarifa Social. */
export function respostaCde(f: FinanciamentoCde | null, v: ValoresDoPainel = VALORES_NOMINAIS, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { reais, pct } = formatos(idioma);
  if (!f) return tx("O orçamento da CDE não foi publicado nesta gold.", "The CDE budget was not published in this release.");
  const t = f.totais.find((x) => x.ano === f.ultimo_ano);
  if (!t || t.despesa === null) return tx(`Sem orçamento da CDE publicado para ${f.ultimo_ano}.`, `No CDE budget published for ${f.ultimo_ano}.`);
  const despesa = valorNoModo(t.despesa, t.ano, v);
  const nominal = reais(t.despesa / BI, 2);
  const moeda = rotuloMoeda(v, idioma);
  const valor =
    despesa === null
      ? tx(`${nominal} bilhões nominais (o IPCA não cobre o ano, e sem ele não há valor em reais)`, `${nominal} billion nominal (the IPCA does not cover the year, and without it there is no value in reais)`)
      : v.modo === "real"
        ? tx(`${reais(despesa / BI, 2)} bilhões ${moeda} (${nominal} bilhões nominais)`, `${reais(despesa / BI, 2)} billion ${moeda} (${nominal} billion nominal)`)
        : tx(`${reais(despesa / BI, 2)} bilhões ${moeda}`, `${reais(despesa / BI, 2)} billion ${moeda}`);
  return tx(
    `O orçamento aprovado ou previsto da CDE para ${t.ano} é de ${valor}: ${pct(t.quotas_pct, 1)} das receitas vêm das quotas cobradas nas tarifas ` +
      `de todos os consumidores, e a Tarifa Social responde por ${pct(t.tarifa_social_pct, 1)} das despesas.`,
    `The approved or forecast CDE budget for ${t.ano} is ${valor}: ${pct(t.quotas_pct, 1)} of revenue comes from the quotas charged in the tariffs ` +
      `of all consumers, and the Tarifa Social accounts for ${pct(t.tarifa_social_pct, 1)} of expenses.`,
  );
}

/* ---------- vereditos (r8): a resposta em palavras comuns, com os números da resposta completa ---------- */

/** Rótulo de grupo sem o parêntese técnico: "Distribuição (fio B)" vira "distribuição". */
const nomeGrupo = (rotulo: string, idioma: Idioma = idiomaEnergia()) => minuscula(dadoTexto(rotulo, idioma).replace(/\s*\([^)]*\)/g, ""));

/** Veredito do P047: o perfil escolhido do menor ao maior custo, só pela tarifa. A mediana fica na resposta completa e na linha do gráfico. */
export function vereditoTarifa(dataReferencia: string, resumo: ResumoTarifas, vigentes: readonly TarifaVigente[], perfil: Perfil, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { dataBR, reais } = formatos(idioma);
  const chave = String(perfil) as "100" | "200" | "300";
  const ord = [...vigentes].sort((a, b) => a.posicao - b.posicao);
  const menor = ord[0];
  const maior = ord[ord.length - 1];
  if (!menor || !maior || resumo.n === 0)
    return tx(
      `Em ${dataBR(dataReferencia)}, nenhuma distribuidora tem tarifa B1 residencial vigente no arquivo da ANEEL.`,
      `On ${dataBR(dataReferencia)}, no distribution utility has a residential B1 tariff in force in ANEEL's file.`,
    );
  const a = `${reais(menor.perfis[chave])} (${rotuloDistribuidora(menor.sigla, menor.cnpj)})`;
  const b = `${reais(maior.perfis[chave])} (${rotuloDistribuidora(maior.sigla, maior.cnpj)})`;
  return tx(
    `Em ${dataBR(dataReferencia)}, entre as ${resumo.n} distribuidoras com tarifa vigente no arquivo, ${perfil} kWh no mês custam de ${a} a ${b}, conforme a distribuidora, só pela tarifa.`,
    `On ${dataBR(dataReferencia)}, among the ${resumo.n} distribution utilities with a tariff in force in the file, ${perfil} kWh a month cost from ${a} to ${b}, depending on the distribution utility, on the tariff alone.`,
  );
}

/** Veredito do P048: os dois maiores grupos da tarifa B1 na média das distribuidoras, em %. Os demais grupos, os itens negativos e a CDE ficam na resposta completa. */
export function vereditoComposicao(comp: Composicao, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { pct } = formatos(idioma);
  const m = comp.media;
  if (!m || m.total_rs_mwh === null)
    return tx("Sem composição publicada na data: o conjunto de componentes não cobre as tarifas vigentes.", "No composition published on the date: the component dataset does not cover the tariffs in force.");
  const rot = new Map(comp.grupos.map((g) => [g.id, nomeGrupo(g.rotulo, idioma)]));
  const positivos = ORDEM_GRUPOS.filter((g) => (m.grupos_pct[g] ?? 0) > 0).sort((a, b) => (m.grupos_pct[b] ?? 0) - (m.grupos_pct[a] ?? 0));
  const [a, b] = positivos;
  if (!a) return tx("Sem grupo com valor positivo na composição média.", "No group with a positive value in the average composition.");
  const pa = `${rot.get(a)} (${pct(m.grupos_pct[a], 1)})`;
  const dois = b ? `${pa} ${tx("e", "and")} ${rot.get(b)} (${pct(m.grupos_pct[b], 1)})` : pa;
  return tx(`Na média das ${m.n} distribuidoras, a tarifa B1 vai sobretudo para ${dois}.`, `In the average of the ${m.n} distribution utilities, the B1 tariff goes mainly to ${dois}.`);
}

/** Veredito do P049: a estimativa mensal, sem tributos, para o consumo e a distribuidora escolhidos. A parcela da bandeira e os rótulos de estimativa ficam na resposta completa. */
export function vereditoSimulacao(r: ResultadoSimulacao, sigla: string, kwh: number, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { num, reais } = formatos(idioma);
  if (!r.disponivel) return tx(`Simulação indisponível para ${sigla}: ${r.motivo}.`, `Simulation unavailable for ${sigla}: ${r.motivo}.`);
  return tx(
    `Para ${num(kwh, 0)} kWh no mês na ${sigla}, a estimativa é de ${reais(r.total)}, sem tributos e sem iluminação pública.`,
    `For ${num(kwh, 0)} kWh a month at ${sigla}, the estimate is ${reais(r.total)}, without taxes and without public lighting.`,
  );
}

/**
 * Veredito do P050 (reajustes): em quantas distribuidoras a tarifa B1 subiu mais que o IPCA do mesmo período, com o limite
 * de leitura: é a variação entre duas datas, não o efeito do processo tarifário.
 */
export function vereditoReajustes(j: JanelaInflacao, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { dataBR, pct } = formatos(idioma);
  if (j.mediana_pct === null || j.ipca_pct === null)
    return tx(
      `Sem comparação com o IPCA na janela de ${j.meses} meses: falta índice ou tarifa nas duas datas.`,
      `No comparison with the IPCA in the ${j.meses}-month window: the index or the tariff is missing on the two dates.`,
    );
  return tx(
    `Em ${j.meses} meses até ${dataBR(j.ate)}, a tarifa B1 residencial subiu mais que o IPCA (${pct(j.ipca_pct, 2)}) em ${j.acima_ipca} de ${j.n} distribuidoras. É a variação entre duas datas, não o efeito do processo tarifário.`,
    `Over the ${j.meses} months to ${dataBR(j.ate)}, the residential B1 tariff rose more than the IPCA (${pct(j.ipca_pct, 2)}) at ${j.acima_ipca} of ${j.n} distribution utilities. It is the change between two dates, not the effect of the tariff process.`,
  );
}

/** Veredito do P050 (bandeiras): a bandeira do mês e quantos meses publicados tiveram acréscimo. */
export function vereditoBandeira(b: Bandeiras, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { mesAno } = formatos(idioma);
  const v = b.vigente;
  const publicados = b.acionamento.filter((a) => a.bandeira !== null);
  const comAcrescimo = publicados.filter((a) => a.bandeira !== "Verde").length; // i18n: dado
  const inicio = b.acionamento[0]?.m;
  const m0 = inicio ? mesAno(`${inicio}-01`) : "";
  const historico = inicio
    ? tx(
        ` Em ${comAcrescimo} dos ${publicados.length} meses publicados desde ${m0}, a bandeira não foi verde.`,
        ` In ${comAcrescimo} of the ${publicados.length} months published since ${m0}, the tariff flag was not green.`,
      )
    : "";
  if (!v || !v.bandeira) return tx(`O conjunto de bandeiras não traz acionamento publicado.${historico}`, `The tariff flag dataset has no published activation.${historico}`);
  const valor = v.bandeira === "Verde" ? tx("sem acréscimo", "no surcharge") : tx(`acréscimo de ${rsKwh(v.rs_mwh, 5, idioma)} consumido`, `a surcharge of ${rsKwh(v.rs_mwh, 5, idioma)} consumed`); // i18n: dado
  const nome = minuscula(bandeiraNoIdioma(v.bandeira, idioma));
  return tx(`A bandeira de ${mesAno(`${v.mes}-01`)} é ${nome}: ${valor}.${historico}`, `The tariff flag for ${mesAno(`${v.mes}-01`)} is ${nome}: ${valor}.${historico}`);
}

/** Veredito do P050 (subsídios): quanto foi homologado para repasse da CDE no último ano completo, com a ressalva de que não é desembolso nem transferência a famílias. O orçamento e a maior categoria ficam na resposta completa. */
export function vereditoSubsidios(s: Subsidios, v: ValoresDoPainel = VALORES_NOMINAIS, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { reais } = formatos(idioma);
  const ano = s.anual.find((a) => a.ano === s.ultimo_ano_completo);
  if (!ano || ano.soma_categorias === null) return tx("Sem ano completo de subsídios tarifários publicado.", "No complete year of tariff subsidies published.");
  const total = valorNoModo(ano.soma_categorias, ano.ano, v);
  if (total === null)
    return tx(
      `Em ${ano.ano}, o valor em reais de ${v.base ?? "mês-base"} não pode ser calculado: o IPCA não cobre o ano.`,
      `In ${ano.ano}, the value in ${v.base ?? "base-month"} reais cannot be calculated: the IPCA does not cover the year.`,
    );
  return tx(
    `Em ${ano.ano}, foram homologados ${reais(total / BI, 2)} bilhões para repasse da Conta de Desenvolvimento Energético (CDE) às distribuidoras, ` +
      `para cobrir descontos a categorias de usuários (valores ${rotuloMoeda(v, idioma)}). Não são desembolso realizado nem transferências a famílias.`,
    `In ${ano.ano}, ${reais(total / BI, 2)} billion was ratified for transfer from the Energy Development Account (CDE) to distribution utilities, ` +
      `to cover discounts to user categories (values ${rotuloMoeda(v, idioma)}). These are neither actual disbursements nor transfers to families.`,
  );
}

/**
 * Soma das parcelas já arredondadas contra o total arredondado, em reais: a nota que explica a diferença de R$ 0,01 quando existe
 * (cada valor é arredondado depois de calculado), ou null quando as parcelas fecham com o total.
 */
export function notaArredondamentoSimulacao(parcelas: readonly number[], total: number, idioma: Idioma = idiomaEnergia()): string | null {
  const tx = txEm(idioma);
  const { reais } = formatos(idioma);
  const centavos = (v: number) => Math.round(v * 100);
  const soma = parcelas.reduce((acc, v) => acc + centavos(v), 0);
  const t = centavos(total);
  if (soma === t) return null;
  return tx(
    `As parcelas somam ${reais(soma / 100)} e o total é ${reais(t / 100)}: cada valor é arredondado depois de calculado, e a soma dos valores arredondados pode diferir do total em R$ 0,01.`,
    `The items add up to ${reais(soma / 100)} and the total is ${reais(t / 100)}: each value is rounded after it is calculated, and the sum of the rounded values may differ from the total by R$ 0.01.`,
  );
}

/** Separa, numa frase de regra, o que fala de acesso a norma que o observatório não conseguiu ler (detalhe para Analisar) do resto. */
export function separaBloqueioDeNorma(texto: string): { leitor: string; tecnico: string } {
  const frases = texto.split(/(?<=\.)\s+/);
  const ehBloqueio = (f: string) => /não pôde ser lid[oa]|bloque(?:io|ou)/i.test(f);
  return { leitor: frases.filter((f) => !ehBloqueio(f)).join(" ").trim(), tecnico: frases.filter(ehBloqueio).join(" ").trim() };
}

/** Mesmo texto para o leitor de tela e para o rótulo do período no painel. */
export function periodoReferencia(g: Pick<ContaGold, "data_referencia" | "gerado_pela_fonte_em">, idioma: Idioma = idiomaEnergia()): string {
  const { dataBR } = formatos(idioma);
  const tx = txEm(idioma);
  return tx(
    `vigente em ${dataBR(g.data_referencia)} (arquivo gerado pela ANEEL em ${dataBR(g.gerado_pela_fonte_em)})`,
    `in force on ${dataBR(g.data_referencia)} (file generated by ANEEL on ${dataBR(g.gerado_pela_fonte_em)})`,
  );
}

/**
 * P047, "o que mudou": a mediana da data contra a do dia 1º do último mês da
 * evolução, com o motivo da diferença de cobertura (distribuidoras fora do ranking).
 */
export function mudancaTarifa(
  dataReferencia: string,
  resumo: ResumoTarifas,
  evolucao: readonly LinhaEvolucao[],
  comparacao: ComparacaoMesmoConjunto | null = null,
  idioma: Idioma = idiomaEnergia(),
): string {
  const tx = txEm(idioma);
  const { dataBR, num, mesAno } = formatos(idioma);
  const ult = [...evolucao].reverse().find((p) => p.mediana !== null);
  const hoje = tx(
    `Em ${dataBR(dataReferencia)}, a mediana é ${num(resumo.mediana, 2)} R$/MWh entre ${resumo.n} distribuidoras com tarifa vigente.`,
    `On ${dataBR(dataReferencia)}, the median is ${num(resumo.mediana, 2)} R$/MWh among ${resumo.n} distribution utilities with a tariff in force.`,
  );
  const fora = resumo.fora_vigencia_recente + resumo.fora_sem_tarifa_ha_mais_de_90_dias;
  const foraDoRanking = tx(
    `Ficam fora do ranking ${resumo.fora_vigencia_recente} com a vigência encerrada há até 90 dias (a tarifa seguinte ainda não está no arquivo) e ${resumo.fora_sem_tarifa_ha_mais_de_90_dias} sem tarifa há mais de 90 dias.`,
    `Left out of the ranking are ${resumo.fora_vigencia_recente} whose validity ended up to 90 days ago (the next tariff is not yet in the file) and ${resumo.fora_sem_tarifa_ha_mais_de_90_dias} without a tariff for more than 90 days.`,
  );
  // com a comparação no mesmo conjunto, a variação sai das distribuidoras que têm tarifa nas duas datas, e o texto diz quem saiu
  if (comparacao) return `${hoje}${fora ? ` ${foraDoRanking}` : ""} ${textoComparacaoMesmoConjunto(comparacao, idioma)}`;
  const antes = ult
    ? tx(` No dia 1º de ${mesAno(`${ult.m}-01`)}, era ${num(ult.mediana, 2)} R$/MWh entre ${ult.n}.`, ` On the 1st of ${mesAno(`${ult.m}-01`)}, it was ${num(ult.mediana, 2)} R$/MWh among ${ult.n}.`)
    : "";
  const motivo = fora
    ? tx(
        ` ${foraDoRanking.replace(/\.$/, "")}; por isso as duas medianas não comparam o mesmo conjunto.`,
        ` ${foraDoRanking.replace(/\.$/, "")}; that is why the two medians do not compare the same set.`,
      )
    : "";
  return `${hoje}${antes}${motivo}`;
}

/**
 * A última mudança da tarifa B1 de uma distribuidora, em uma frase: a data, o ato, a variação com o verbo e o IPCA desde a mudança anterior.
 * É o dado que quem acompanha o reajuste procura (quando foi e quanto), ao lado da variação entre duas datas da janela.
 */
export function textoUltimaMudanca(u: UltimoEvento, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { dataBR, mesAno, pct } = formatos(idioma);
  const nome = rotuloDistribuidora(u[1], u[0]);
  const perimetro = u[8] ? tx(` É mudança de perímetro (${u[8]}): compara áreas diferentes.`, ` It is a perimeter change (${u[8]}): it compares different areas.`) : "";
  const v = verboVariacao(u[4], 2, idioma);
  const m0 = mesAno(`${u[6]}-01`);
  const m1 = mesAno(`${u[7]}-01`);
  return tx(
    `${nome}: a última mudança da tarifa B1 foi em ${dataBR(u[2])} (${u[3]}), quando a tarifa ${v}; o IPCA desde a mudança anterior (${m0} a ${m1}) foi ${pct(u[5], 2)}.${perimetro}`,
    `${nome}: the latest change in the B1 tariff was on ${dataBR(u[2])} (${u[3]}), when the tariff ${v}; the IPCA since the previous change (${m0} to ${m1}) was ${pct(u[5], 2)}.${perimetro}`,
  );
}

/** P050, "o que mudou" nos subsídios: categoria com a maior variação absoluta entre os dois últimos anos completos. */
export function mudancaSubsidios(s: Subsidios, v: ValoresDoPainel = VALORES_NOMINAIS, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { reais } = formatos(idioma);
  const completos = s.anual.filter((a) => !a.parcial);
  if (completos.length < 2) return tx("Menos de dois anos completos publicados: sem comparação anual.", "Fewer than two complete years published: no annual comparison.");
  const [a0, a1] = completos.slice(-2);
  // cada ano na sua moeda: em reais, o fator do ano; a maior mudança é a da moeda escolhida
  const de0 = (x: number | null | undefined) => valorNoModo(x, a0.ano, v);
  const para1 = (x: number | null | undefined) => valorNoModo(x, a1.ano, v);
  const moeda = tx(` Valores ${rotuloMoeda(v, idioma)}.`, ` Values are ${rotuloMoeda(v, idioma)}.`);
  let maior: { cat: string; de: number; para: number } | null = null;
  for (const cat of categoriasSubsidio(s)) {
    const de = de0(a0.categorias[cat]);
    const para = para1(a1.categorias[cat]);
    if (de === null || para === null) continue;
    if (!maior || Math.abs(para - de) > Math.abs(maior.para - maior.de)) maior = { cat, de, para };
  }
  const t0 = de0(a0.soma_categorias);
  const t1 = para1(a1.soma_categorias);
  const total =
    t0 !== null && t1 !== null
      ? tx(` O total passou de ${reais(t0 / BI, 2)} bilhões para ${reais(t1 / BI, 2)} bilhões.`, ` The total went from ${reais(t0 / BI, 2)} billion to ${reais(t1 / BI, 2)} billion.`)
      : "";
  if (!maior) return tx(`Sem categoria com valor nos dois anos (${a0.ano} e ${a1.ano}).${total}${moeda}`, `No category with a value in both years (${a0.ano} and ${a1.ano}).${total}${moeda}`);
  return tx(
    `De ${a0.ano} para ${a1.ano}, a maior mudança foi em ${maior.cat}: de ${reais(maior.de / BI, 2)} bilhões para ${reais(maior.para / BI, 2)} bilhões.${total}${moeda}`,
    `From ${a0.ano} to ${a1.ano}, the largest change was in ${dadoTexto(maior.cat, idioma)}: from ${reais(maior.de / BI, 2)} billion to ${reais(maior.para / BI, 2)} billion.${total}${moeda}`,
  );
}

/**
 * P048, "o que mudou": distribuidoras com valor negativo em componente de custo
 * (lido como crédito) na vigência atual, contra a faixa histórica do código.
 */
export function mudancaComposicao(comp: Composicao, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  return textoCreditos(comp, tx("na vigência atual", "in the current validity period"), idioma);
}

/**
 * Mesmo texto de `mudancaComposicao`, com a vigência dita pela data de referência da página ("na vigência de 30/09/2026") no
 * lugar de "atual": o dado tem a própria data, e o texto de Entender não usa palavra de tempo relativo.
 */
export function mudancaComposicaoEm(comp: Composicao, dataReferencia: string, idioma: Idioma = idiomaEnergia()): string {
  const d = formatos(idioma).dataBR(dataReferencia);
  const tx = txEm(idioma);
  return textoCreditos(comp, tx(`na vigência de ${d}`, `in the validity period of ${d}`), idioma);
}

/** `vigencia` é a expressão inteira ("na vigência de 30/09/2026", "in the validity period of Sep 30, 2026"). */
function textoCreditos(comp: Composicao, vigencia: string, idioma: Idioma): string {
  const tx = txEm(idioma);
  const { dataBR, num } = formatos(idioma);
  const cr = comp.creditos;
  const valores = cr.distribuidoras.map((d) => d.valor).filter((v): v is number => v !== null && Number.isFinite(v));
  if (!cr.distribuidoras.length) return tx(`Nenhum valor negativo em componente de custo ${vigencia}.`, `No negative value in a cost component ${vigencia}.`);
  const faixa = cr.faixa_historica;
  const historico = faixa
    ? tx(
        `, quando a faixa histórica do código, em ${faixa.n} vigências iniciadas até ${dataBR(faixa.vigencias_iniciadas_ate)}, ia de ${num(faixa.minimo, 2)} a ${num(faixa.maximo, 2)} R$/MWh`,
        `, when the code's historical range, over ${faixa.n} validity periods started up to ${dataBR(faixa.vigencias_iniciadas_ate)}, went from ${num(faixa.minimo, 2)} to ${num(faixa.maximo, 2)} R$/MWh`,
      )
    : "";
  const intervalo = valores.length
    ? tx(` (de ${num(Math.min(...valores), 2)} a ${num(Math.max(...valores), 2)} R$/MWh)`, ` (from ${num(Math.min(...valores), 2)} to ${num(Math.max(...valores), 2)} R$/MWh)`)
    : "";
  // a componente aparece pela descrição do dicionário da fonte, não pelo código; sem descrição, o texto diz só "componente de custo"
  const descricoes = new Map(comp.grupos.flatMap((g) => g.componentes.map((c) => [c.codigo, c.descricao] as const)));
  const nomes = cr.codigos.map((c) => {
    const d = descricoes.get(c);
    return d ? dadoTexto(d, idioma) : tx("componente de custo", "cost component");
  });
  return tx(
    `${cr.distribuidoras.length} distribuidoras têm valor negativo na componente «${nomes.join(", ")}» ${vigencia}${intervalo}${historico}. O valor fica no grupo créditos, lido como crédito tarifário (leitura do observatório).`,
    `${cr.distribuidoras.length} distribution utilities have a negative value in the component «${nomes.join(", ")}» ${vigencia}${intervalo}${historico}. The value goes to the credits group, read as a tariff credit (observatory's reading).`,
  );
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
export function textoDestaquePerfil(d: DestaquePerfil, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { reais } = formatos(idioma);
  const dif =
    d.diferenca === null
      ? ""
      : d.diferenca === 0
        ? tx("; igual à mediana", "; equal to the median")
        : tx(`; ${reais(Math.abs(d.diferenca))} ${d.diferenca > 0 ? "acima" : "abaixo"} da mediana`, `; ${reais(Math.abs(d.diferenca))} ${d.diferenca > 0 ? "above" : "below"} the median`);
  return tx(`${d.sigla}: ${reais(d.valor)}, posição ${d.posicao} de ${d.n} (1 é a menor tarifa)${dif}.`, `${d.sigla}: ${reais(d.valor)}, position ${d.posicao} of ${d.n} (1 is the lowest tariff)${dif}.`);
}

/** Leitura da figura das referências em uma frase (nome acessível do gráfico). */
export function textoReferenciasPerfil(r: ReferenciasPerfil, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { reais } = formatos(idioma);
  if (!r.menor || !r.maior || r.mediana === null) return tx(`Sem referências do custo de ${r.perfil} kWh por mês nesta publicação.`, `No references for the cost of ${r.perfil} kWh a month in this publication.`);
  const meio =
    r.p25 !== null && r.p75 !== null
      ? tx(`; a metade central das distribuidoras fica entre ${reais(r.p25)} e ${reais(r.p75)}`, `; the middle half of the distribution utilities is between ${reais(r.p25)} and ${reais(r.p75)}`)
      : "";
  return tx(
    `Custo de ${r.perfil} kWh por mês, só pela tarifa B1 residencial: menor ${reais(r.menor.valor)} (${r.menor.sigla}), mediana ${reais(r.mediana)} e maior ${reais(r.maior.valor)} (${r.maior.sigla}), entre ${r.n} distribuidoras${meio}.`,
    `Cost of ${r.perfil} kWh a month, on the residential B1 tariff alone: lowest ${reais(r.menor.valor)} (${r.menor.sigla}), median ${reais(r.mediana)} and highest ${reais(r.maior.valor)} (${r.maior.sigla}), among ${r.n} distribution utilities${meio}.`,
  );
}

/**
 * Ressalva que acompanha a faixa de métricas da abertura: o peso em consumidores da mediana, a cobertura do ranking (distribuidoras e UCs,
 * piso de 99% das UCs) e o que mudaria nos extremos com a última tarifa das que faltam, e quantas saíram do conjunto desde o dia 1º. O que
 * a tarifa não inclui (tributos, iluminação, bandeira) fica no limite da abertura, uma vez só. O universo (quantas distribuidoras) é o `n`
 * do mesmo resumo que alimenta o ranking e a mediana.
 */
export function notaFaixaTarifa(
  resumo: ResumoTarifas,
  comparacao: ComparacaoMesmoConjunto | null = null,
  mais: {
    perfil: Perfil;
    /** Mediana do custo do perfil ponderada pelas UCs (`medianaPonderadaDoPerfil`); null sem UCs. */
    ponderada: number | null;
    /** Distribuidoras do ranking que ficaram fora da ponderada por não terem UCs publicadas (`medianaPonderadaDoPerfil`). */
    semUcs?: number;
    cobertura: CoberturaRanking | null;
    /** Menor e maior custo do perfil no ranking (e quem são), para dizer o que mudaria. */
    extremos: { menor: number | null; maior: number | null; siglaMenor?: string | null; siglaMaior?: string | null };
  } | null = null,
  idioma: Idioma = idiomaEnergia(),
): string {
  const tx = txEm(idioma);
  const { reais, dataBR } = formatos(idioma);
  const chave = mais ? (String(mais.perfil) as "100" | "200" | "300") : null;
  const simples = mais && chave ? resumo.perfis_mediana[chave] : null;
  const pond =
    mais && mais.ponderada !== null
      ? tx(
          `Ponderada pelas UCs de cada distribuidora, a mediana de ${mais.perfil} kWh é ${reais(mais.ponderada)}${simples !== null ? ` (a simples é ${reais(simples)})` : ""}.` +
            (mais.semUcs
              ? ` A ponderada deixa de fora ${mais.semUcs === 1 ? "1 distribuidora sem UCs publicadas" : `${mais.semUcs} distribuidoras sem UCs publicadas`} na Qualidade.`
              : ""),
          `Weighted by each distribution utility's consumer units, the median for ${mais.perfil} kWh is ${reais(mais.ponderada)}${simples !== null ? ` (the simple median is ${reais(simples)})` : ""}.` +
            (mais.semUcs
              ? ` The weighted median leaves out ${mais.semUcs === 1 ? "1 distribution utility without published consumer units" : `${mais.semUcs} distribution utilities without published consumer units`} in the Quality data.`
              : ""),
        )
      : tx(
          `Mediana simples das ${resumo.n} distribuidoras com tarifa vigente: cada uma conta uma vez, sem ponderar por consumidores.`,
          `Simple median of the ${resumo.n} distribution utilities with a tariff in force: each counts once, without weighting by consumers.`,
        );
  const cobertura = mais?.cobertura ? ` ${textoCobertura(mais.cobertura, mais.perfil, mais.extremos, idioma)}` : "";
  // o ranking de 30/09 não é o conjunto de 1º/09: quantas saíram fica dito junto da mediana
  const saiu =
    comparacao && comparacao.saidas.n > 0
      ? tx(` Em ${dataBR(comparacao.de)} eram ${comparacao.nDe}: ${comparacao.saidas.n} saíram do conjunto.`, ` On ${dataBR(comparacao.de)} there were ${comparacao.nDe}: ${comparacao.saidas.n} left the set.`)
      : "";
  return `${pond}${cobertura}${saiu}`;
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
export function textoSerieReal(r: ResumoSerieReal | null, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const f = formatos(idioma);
  if (!r) return tx("Sem mediana mensal publicada nesta publicação.", "No monthly median in this publication.");
  const rs = (v: number) => `${f.num(v, 2)} R$/MWh`;
  const mes = (m: string) => f.mesAno(`${m}-01`);
  const base = r.base ? mes(r.base) : null;
  const m0 = mes(r.primeira.m);
  const inicio =
    r.primeira.real !== null && base
      ? tx(
          `Em ${m0}, a mediana era de ${rs(r.primeira.nominal)} nos valores da época e de ${rs(r.primeira.real)} em reais de ${base}`,
          `In ${m0}, the median was ${rs(r.primeira.nominal)} at the prices of the time and ${rs(r.primeira.real)} in ${base} reais`,
        )
      : tx(`Em ${m0}, a mediana era de ${rs(r.primeira.nominal)} nos valores da época`, `In ${m0}, the median was ${rs(r.primeira.nominal)} at the prices of the time`);
  // no mês-base os dois valores são o mesmo: dizer duas vezes o mesmo número soaria como dois resultados
  const u = r.ultimaComReal;
  const fim = u
    ? u.nominal === u.real
      ? tx(`; em ${mes(u.m)}, de ${rs(u.nominal)} nas duas formas`, `; in ${mes(u.m)}, ${rs(u.nominal)} in both forms`)
      : tx(`; em ${mes(u.m)}, de ${rs(u.nominal)} e de ${rs(u.real)}`, `; in ${mes(u.m)}, ${rs(u.nominal)} and ${rs(u.real)}`)
    : "";
  const meses = r.semReal.map(mes).join(", ");
  const sem = r.semReal.length
    ? tx(
        ` ${meses} ${r.semReal.length === 1 ? "fica" : "ficam"} sem valor em reais (IPCA do mês ainda não publicado).`,
        ` ${meses} ${r.semReal.length === 1 ? "has" : "have"} no value in reais (IPCA for the month not yet published).`,
      )
    : "";
  return `${inicio}${fim}.${sem}`;
}

/* ============================================================================================================================
 * Segunda passada (avaliações iniciais de 09/10/2026): comparação no mesmo conjunto, UF, tipo e UCs, grupos de pares, busca por
 * município, valores reais de subsídios e da CDE, janelas no mesmo conjunto, cartão do simulador e ficha com procedimento externo.
 * Tudo aqui é seletor sobre números já publicados (gold e séries): nada refaz cálculo do pipeline, e cada mediana nova tem teste que a
 * reproduz sobre o conjunto inteiro contra a mediana que a gold publica.
 * ========================================================================================================================== */

/* ---------- aritmética simples ---------- */

/**
 * Arredondamento decimal, meio para cima e simétrico no zero, sobre a representação decimal do número (795,965 vira 795,97, o que
 * `Math.round(v * 100) / 100` não faz por causa do resíduo binário). É a regra do pipeline para as medianas publicadas.
 */
export function arredondar(v: number, casas = 2): number {
  if (!Number.isFinite(v)) return v;
  const a = Math.abs(v);
  const txt = String(a);
  const r = txt.includes("e") ? Math.round(a * 10 ** casas) / 10 ** casas : Number(`${Math.round(Number(`${txt}e${casas}`))}e-${casas}`);
  return v < 0 && r !== 0 ? -r : r;
}

/** Mediana simples (média dos dois valores centrais quando o número de valores é par); null sem valores. */
export function mediana(valores: readonly number[]): number | null {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/* ---------- o mesmo conjunto de distribuidoras nas duas datas ---------- */

export type SaidaDoConjunto = {
  /** Distribuidoras com tarifa no dia de partida e sem tarifa vigente na data do ranking. */
  n: number;
  mediana: number | null;
  /** Quantas dessas têm "cooperativa" na razão social. */
  cooperativas: number;
  /** Fim da vigência, quando é o mesmo para todas (AAAA-MM-DD); null quando variam. */
  fimDaVigencia: string | null;
};

export type ComparacaoMesmoConjunto = {
  /** Dia 1º do último mês da evolução mensal (AAAA-MM-DD) e a data de referência do ranking. */
  de: string;
  ate: string;
  /** Distribuidoras com tarifa em `de`, com tarifa vigente em `ate` e nas duas datas. */
  nDe: number;
  nAte: number;
  nComum: number;
  /** Mediana de `de` entre todas (a da evolução mensal publicada) e entre as comuns; mediana de `ate` entre as comuns. */
  medianaDeTodas: number | null;
  medianaDeComum: number | null;
  medianaAteComum: number | null;
  /** Variação % entre as duas medianas do conjunto comum, calculada antes de arredondar. */
  variacaoPct: number | null;
  saidas: SaidaDoConjunto;
};

/**
 * Compara a mediana do ranking com a do dia 1º do último mês da evolução NO MESMO CONJUNTO de distribuidoras: as que têm tarifa nas duas
 * datas. A mediana de todas em `de` é a que a evolução mensal publica; a das comuns e a das que saíram vêm da linha do tempo resolvida
 * de cada distribuidora (`tarifaNaData`, a mesma regra do pipeline para "a tarifa vigente no dia 1º"). Sem mês com mediana, null.
 */
export function compararMesmoConjunto(a: {
  vigentes: readonly Pick<TarifaVigente, "cnpj" | "total">[];
  semVigente: readonly Pick<SemVigente, "cnpj" | "nome" | "ultima_vigencia">[];
  historico: Readonly<Record<string, { nome: string | null; vigencias: readonly VigenciaB1[] }>>;
  evolucao: readonly LinhaEvolucao[];
  dataReferencia: string;
}): ComparacaoMesmoConjunto | null {
  const ult = [...a.evolucao].reverse().find((p) => p.mediana !== null);
  if (!ult) return null;
  const de = `${ult.m}-01`;
  const noRanking = new Map(a.vigentes.map((v) => [v.cnpj, v.total]));
  const emDe = new Map<string, number>();
  for (const [cnpj, h] of Object.entries(a.historico)) {
    const t = tarifaNaData(h.vigencias, de);
    if (t !== null) emDe.set(cnpj, t);
  }
  const comuns = Array.from(noRanking.keys()).filter((c) => emDe.has(c));
  const saidos = Array.from(emDe.keys()).filter((c) => !noRanking.has(c));
  const semVig = new Map(a.semVigente.map((s) => [s.cnpj, s]));
  const nomeDe = (c: string) => semVig.get(c)?.nome ?? a.historico[c]?.nome ?? "";
  const fins = new Set(saidos.map((c) => semVig.get(c)?.ultima_vigencia.fim ?? null));
  const medDe = mediana(comuns.map((c) => emDe.get(c) as number));
  const medAte = mediana(comuns.map((c) => noRanking.get(c) as number));
  return {
    de,
    ate: a.dataReferencia,
    nDe: emDe.size,
    nAte: noRanking.size,
    nComum: comuns.length,
    medianaDeTodas: ult.mediana,
    medianaDeComum: medDe === null ? null : arredondar(medDe, 2),
    medianaAteComum: medAte === null ? null : arredondar(medAte, 2),
    variacaoPct: medDe === null || medAte === null || medDe === 0 ? null : arredondar((medAte / medDe - 1) * 100, 2),
    saidas: {
      n: saidos.length,
      mediana: (() => {
        const m = mediana(saidos.map((c) => emDe.get(c) as number));
        return m === null ? null : arredondar(m, 2);
      })(),
      cooperativas: saidos.filter((c) => /cooperativa/i.test(nomeDe(c))).length,
      fimDaVigencia: fins.size === 1 && !fins.has(null) ? (Array.from(fins)[0] as string) : null,
    },
  };
}

/**
 * A comparação em três frases: a variação nas mesmas distribuidoras, quem saiu do ranking e com que mediana, e o limite de leitura
 * (não comparar o ranking com o conjunto maior da data de partida). Sem número fixo: tudo vem da comparação.
 */
export function textoComparacaoMesmoConjunto(c: ComparacaoMesmoConjunto, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { num, dataBR } = formatos(idioma);
  const rs = (v: number | null) => `${num(v, 2)} R$/MWh`;
  const v = verboVariacao(c.variacaoPct, 2, idioma);
  const de = dataBR(c.de);
  const mesmas = tx(
    `Nas mesmas ${c.nComum} distribuidoras, a mediana ${v}, de ${rs(c.medianaDeComum)} em ${de} para ${rs(c.medianaAteComum)} em ${dataBR(c.ate)}.`,
    `In the same ${c.nComum} distribution utilities, the median ${v}, from ${rs(c.medianaDeComum)} on ${de} to ${rs(c.medianaAteComum)} on ${dataBR(c.ate)}.`,
  );
  if (c.saidas.n === 0) return mesmas;
  const coop =
    c.saidas.cooperativas === 0 ? "" : c.saidas.cooperativas === c.saidas.n ? tx("todas cooperativas", "all cooperatives") : tx(`${c.saidas.cooperativas} cooperativas`, `${c.saidas.cooperativas} cooperatives`);
  const fim = c.saidas.fimDaVigencia ? dataBR(c.saidas.fimDaVigencia) : null;
  const detalhe = [
    fim ? tx(`vigência encerrada em ${fim}`, `validity ended on ${fim}`) : "",
    coop,
    fim ? tx("a tarifa seguinte ainda não está no arquivo da ANEEL", "the next tariff is not yet in ANEEL's file") : "",
  ]
    .filter(Boolean)
    .join("; ");
  const det = detalhe ? ` (${detalhe})` : "";
  const saiu = tx(
    `Em ${de} eram ${c.nDe} distribuidoras, com mediana de ${rs(c.medianaDeTodas)}; as ${c.saidas.n} que ficaram fora do ranking${det} tinham mediana de ${rs(c.saidas.mediana)}.`,
    `On ${de} there were ${c.nDe} distribution utilities, with a median of ${rs(c.medianaDeTodas)}; the ${c.saidas.n} left out of the ranking${det} had a median of ${rs(c.saidas.mediana)}.`,
  );
  const limite = tx(
    `Comparar a mediana do ranking com a das ${c.nDe} de ${de} mistura conjuntos diferentes; a comparação válida é a das mesmas ${c.nComum}.`,
    `Comparing the ranking median with that of the ${c.nDe} on ${de} mixes different sets; the valid comparison is that of the same ${c.nComum}.`,
  );
  return `${mesmas} ${saiu} ${limite}`;
}

/**
 * Três valores típicos convivem na página: a média simples das distribuidoras com componentes, a mediana dessas mesmas e a mediana do
 * ranking. Uma frase diz o que cada um é e em que diferem (o cálculo e o conjunto). null sem composição média.
 */
export function textoTresValoresTipicos(comp: Pick<Composicao, "media" | "mediana">, resumo: Pick<ResumoTarifas, "n" | "mediana">, idioma: Idioma = idiomaEnergia()): string | null {
  const tx = txEm(idioma);
  const { num } = formatos(idioma);
  const m = comp.media;
  if (!m || m.total_rs_mwh === null || comp.mediana.mediana_do_total_rs_mwh === null || resumo.mediana === null) return null;
  const rs = (v: number) => num(v, 2);
  const conjuntos =
    resumo.n === m.n
      ? tx(`as duas medianas usam o mesmo conjunto de ${m.n}`, `both medians use the same set of ${m.n}`)
      : tx(`${m.n} distribuidoras têm componentes publicadas e ${resumo.n} têm tarifa vigente`, `${m.n} distribution utilities have published components and ${resumo.n} have a tariff in force`);
  return tx(
    `Três valores típicos convivem nesta página: a média simples das ${m.n} distribuidoras com componentes (${rs(m.total_rs_mwh)} R$/MWh), a mediana dessas mesmas ${m.n} ` +
      `(${rs(comp.mediana.mediana_do_total_rs_mwh)}) e a mediana das ${resumo.n} do ranking (${rs(resumo.mediana)}). Diferem no cálculo, média ou mediana, e no conjunto: ${conjuntos}.`,
    `Three typical values coexist on this page: the simple average of the ${m.n} distribution utilities with components (${rs(m.total_rs_mwh)} R$/MWh), the median of the same ${m.n} ` +
      `(${rs(comp.mediana.mediana_do_total_rs_mwh)}) and the median of the ${resumo.n} in the ranking (${rs(resumo.mediana)}). They differ in the calculation, average or median, and in the set: ${conjuntos}.`,
  );
}

/* ---------- UF, tipo e UCs de cada distribuidora ---------- */

export type TipoDistribuidora = "concessionaria" | "permissionaria";
export const ROTULO_TIPO: Record<TipoDistribuidora, string> = { concessionaria: "Concessionária", permissionaria: "Permissionária" }; // i18n: dado
export const ROTULO_TIPO_EN: Record<TipoDistribuidora, string> = { concessionaria: "Concession holder", permissionaria: "Permit holder" };

export type InfoDistribuidora = {
  /** UF da área de atuação (ordem alfabética, "PR, SC"); null sem dado. */
  uf: string | null;
  tipo: TipoDistribuidora | null;
  /** Unidades consumidoras (média do ano) e o ano. */
  ucs: number | null;
  anoUcs: number | null;
};

export type FonteQualidade = { cnpj: string; classificacao?: string | null; ucs?: number | null; ano?: number | null };
export type FonteTerritorio = { cnpj: string; area?: { ufs?: readonly string[] | null } | null };
/** Cadastro do SAMP publicado na gold de Perdas: o grupo (concessionária ou permissionária) de cada CNPJ com balanço em algum ano. */
export type FonteCadastro = { cnpj: string; grupo?: string | null };

/**
 * UF, tipo e UCs de cada CNPJ do ranking, lidos das golds de Território (UFs da área de atuação, pela relação oficial da ANEEL) e de
 * Qualidade (classificação e UCs médias do ano). A distribuidora que não está na Qualidade (sem conjuntos de DEC publicados, como a
 * CODESAM em out/2026) recebe o tipo do cadastro do SAMP (gold de Perdas), que é a mesma classificação da ANEEL; as UCs continuam
 * vindo só da Qualidade. A ausência fica null: nunca se completa com palpite.
 */
export function infoDistribuidoras(
  cnpjs: readonly string[],
  qualidade: readonly FonteQualidade[] | null,
  territorio: readonly FonteTerritorio[] | null,
  cadastro: readonly FonteCadastro[] | null = null,
): Record<string, InfoDistribuidora> {
  const q = new Map((qualidade ?? []).map((x) => [x.cnpj, x]));
  const t = new Map((territorio ?? []).map((x) => [x.cnpj, x]));
  const c = new Map((cadastro ?? []).map((x) => [x.cnpj, x.grupo ?? null]));
  const out: Record<string, InfoDistribuidora> = {};
  for (const cnpj of cnpjs) {
    const ufs = [...(t.get(cnpj)?.area?.ufs ?? [])].sort();
    const qd = q.get(cnpj);
    const doCadastro = c.get(cnpj);
    const tipo: TipoDistribuidora | null =
      qd?.classificacao === "Concessionária"
        ? "concessionaria"
        : qd?.classificacao === "Permissionária"
          ? "permissionaria"
          : !qd && (doCadastro === "concessionaria" || doCadastro === "permissionaria")
            ? doCadastro
            : null;
    const ucs = typeof qd?.ucs === "number" && Number.isFinite(qd.ucs) ? qd.ucs : null;
    out[cnpj] = { uf: ufs.length ? ufs.join(", ") : null, tipo, ucs, anoUcs: ucs === null ? null : (qd?.ano ?? null) };
  }
  return out;
}

/* ---------- grupos de pares: tipo e UF ---------- */

export type GrupoRanking = "todas" | TipoDistribuidora;
export const CAMPO_GRUPO = campo(tiposUrl.opcao(["todas", "concessionaria", "permissionaria"] as const), "todas", { param: "grupo" }); // i18n: dado
/** UF do filtro (duas letras, ou vazio para todas); o valor que não é UF do ranking é ignorado por `filtrarRanking`. */
export const CAMPO_UF = campo(tiposUrl.texto({ max: 2 }), "", { param: "uf" });

const ufsDaLinha = (l: Pick<LinhaRanking, "uf">) => (l.uf ? l.uf.split(", ") : []);

/** UFs presentes no ranking, em ordem alfabética, com quantas distribuidoras cada uma tem. */
export function ufsDoRanking(linhas: readonly Pick<LinhaRanking, "uf">[]): { uf: string; n: number }[] {
  const n = new Map<string, number>();
  for (const l of linhas) for (const u of ufsDaLinha(l)) n.set(u, (n.get(u) ?? 0) + 1);
  return Array.from(n.entries()).map(([uf, k]) => ({ uf, n: k })).sort((a, b) => a.uf.localeCompare(b.uf, "pt-BR"));
}

/** Distribuidoras do grupo escolhido (tipo e UF), na ordem do ranking. UF que não existe no ranking não filtra. */
export function filtrarRanking(linhas: readonly LinhaRanking[], grupo: GrupoRanking, uf: string): LinhaRanking[] {
  const ufs = new Set(ufsDoRanking(linhas).map((x) => x.uf));
  // a linha traz o tipo no idioma da página (linhasRanking): vale o rótulo português ou o inglês
  return linhas.filter((l) => (grupo === "todas" || l.tipo === ROTULO_TIPO[grupo] || l.tipo === ROTULO_TIPO_EN[grupo]) && (!uf || !ufs.has(uf) || ufsDaLinha(l).includes(uf)));
}

export type ResumoDoRanking = {
  n: number;
  menor: LinhaRanking | null;
  maior: LinhaRanking | null;
  /** Mediana simples do custo do perfil e da tarifa TE + TUSD entre as linhas. */
  mediana: number | null;
  medianaTarifa: number | null;
  /** Mediana dos consumidores (UCs) das distribuidoras com UCs conhecidas; null sem nenhuma. */
  ucsMediana: number | null;
};

/** Menor, maior e mediana do custo do perfil entre as linhas dadas (o ranking inteiro ou um grupo de pares). */
export function resumoDoRanking(linhas: readonly LinhaRanking[]): ResumoDoRanking {
  const ord = [...linhas].filter((l) => l.custo !== null).sort((a, b) => (a.custo as number) - (b.custo as number) || a.posicao - b.posicao);
  const m = mediana(ord.map((l) => l.custo as number));
  const mt = mediana(linhas.map((l) => l.total));
  const mu = mediana(linhas.map((l) => l.ucs).filter((x): x is number => x !== null));
  return {
    n: linhas.length,
    menor: ord[0] ?? null,
    maior: ord[ord.length - 1] ?? null,
    mediana: m === null ? null : arredondar(m, 2),
    medianaTarifa: mt === null ? null : arredondar(mt, 2),
    ucsMediana: mu === null ? null : Math.round(mu),
  };
}

export function rotuloGrupo(grupo: GrupoRanking, uf: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const tipo =
    grupo === "todas"
      ? tx("distribuidoras", "distribution utilities")
      : grupo === "concessionaria"
        ? tx("concessionárias", "concession holders")
        : tx("permissionárias", "permit holders");
  return uf ? tx(`${tipo} com área em ${uf}`, `${tipo} with an area in ${uf}`) : tipo;
}

/** Frase do grupo de pares escolhido: menor, maior e mediana do custo do perfil entre as distribuidoras do grupo. */
export function textoResumoDoRanking(r: ResumoDoRanking, perfil: Perfil, grupo: GrupoRanking, uf: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { num, reais } = formatos(idioma);
  const nome = rotuloGrupo(grupo, uf, idioma);
  if (!r.n || !r.menor || !r.maior || r.mediana === null) return tx(`Nenhuma das ${nome} tem tarifa B1 residencial vigente na data.`, `None of the ${nome} has a residential B1 tariff in force on the date.`);
  const ucs =
    r.ucsMediana === null
      ? ""
      : tx(` A mediana é de ${num(r.ucsMediana, 0)} consumidores (UCs) por distribuidora.`, ` The median is ${num(r.ucsMediana, 0)} consumers (consumer units) per distribution utility.`);
  const a = `${reais(r.menor.custo)} (${r.menor.sigla})`;
  const b = `${reais(r.maior.custo)} (${r.maior.sigla})`;
  return tx(
    `Entre as ${r.n} ${nome}, ${perfil} kWh no mês custam de ${a} a ${b}; a mediana simples do grupo é ${reais(r.mediana)}.${ucs}`,
    `Among the ${r.n} ${nome}, ${perfil} kWh a month cost from ${a} to ${b}; the simple median of the group is ${reais(r.mediana)}.${ucs}`,
  );
}

/* ---------- régua do ranking, peso em consumidores, cobertura e distribuidoras fora do ranking ---------- */

/**
 * Mediana ponderada: o menor valor em que a soma dos pesos, do menor valor para cima, chega à metade do peso total. Par sem peso (ou com
 * peso zero) fica de fora; sem nenhum par com peso, não há mediana.
 */
export function medianaPonderada(pares: readonly (readonly [number, number | null | undefined])[]): number | null {
  const v = pares.filter((p): p is readonly [number, number] => Number.isFinite(p[0]) && typeof p[1] === "number" && p[1] > 0).sort((a, b) => a[0] - b[0]);
  const total = v.reduce((soma, p) => soma + p[1], 0);
  if (!v.length || total <= 0) return null;
  let acumulado = 0;
  for (const [x, w] of v) {
    acumulado += w;
    if (acumulado * 2 >= total) return x;
  }
  return v[v.length - 1][0];
}

/** A mediana do custo do perfil entre as distribuidoras do ranking, ponderada pelas UCs de cada uma; `semUcs` conta as que ficaram sem peso. */
export function medianaPonderadaDoPerfil(
  vigentes: readonly Pick<TarifaVigente, "cnpj" | "perfis">[],
  info: Readonly<Record<string, Pick<InfoDistribuidora, "ucs">>>,
  perfil: Perfil,
): { valor: number | null; semUcs: number } {
  const chave = String(perfil) as "100" | "200" | "300";
  const pares = vigentes.flatMap((v) => (v.perfis[chave] === null || v.perfis[chave] === undefined ? [] : [[v.perfis[chave] as number, info[v.cnpj]?.ucs ?? null] as const]));
  return { valor: medianaPonderada(pares), semUcs: pares.filter((p) => !(typeof p[1] === "number" && p[1] > 0)).length };
}

/** "88,8 mil UCs", "5.835 UCs": o peso da distribuidora em consumidores, para ler o extremo ao lado do valor. */
export function textoUcs(ucs: number | null | undefined, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { num } = formatos(idioma);
  if (ucs === null || ucs === undefined || !Number.isFinite(ucs)) return tx("UCs não informadas", "consumer units not reported");
  if (ucs < 1000) return tx(`${num(ucs, 0)} UCs`, `${num(ucs, 0)} consumer units`);
  const k = num(ucs / 1000, ucs >= 100000 ? 0 : 1);
  return tx(`${k} mil UCs`, `${k} thousand consumer units`);
}

export type ReguaDoRanking = {
  /** Distribuidoras em que a tarifa de aplicação difere da base econômica em mais de `LIMITE_DIFERENCA_BASE` %. */
  marcadas: number;
  /** A de maior diferença entre as duas posições, dita como exemplo. */
  exemplo: { sigla: string; posicao: number; posicaoBase: number; difPct: number } | null;
};

/** Quantas distribuidoras mudam de lugar conforme a régua (aplicação ou base econômica) e o caso de maior mudança. */
export function reguaDoRanking(linhas: readonly Pick<LinhaRanking, "sigla" | "posicao" | "posicao_base" | "dif_base_pct">[]): ReguaDoRanking {
  const marcadas = linhas.filter((l) => marcaBase(l));
  const exemplo = marcadas
    .filter((l) => l.posicao_base !== null && l.dif_base_pct !== null)
    .reduce<(typeof marcadas)[number] | null>((m, l) => (m === null || Math.abs(l.posicao - (l.posicao_base as number)) > Math.abs(m.posicao - (m.posicao_base as number)) ? l : m), null);
  return {
    marcadas: marcadas.length,
    exemplo: exemplo ? { sigla: exemplo.sigla, posicao: exemplo.posicao, posicaoBase: exemplo.posicao_base as number, difPct: exemplo.dif_base_pct as number } : null,
  };
}

/** Diz qual régua ordena o ranking, onde está a outra e quantas distribuidoras mudam de lugar (marcadas com †). */
export function textoReguaDoRanking(r: ReguaDoRanking, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { pct } = formatos(idioma);
  const base = tx(
    "O ranking ordena pela tarifa de aplicação (TE + TUSD homologadas), a que a distribuidora cobra. A base econômica, que tira os componentes financeiros do processo tarifário, é a outra régua: aparece na tabela e na dica de cada ponto marcado.",
    "The ranking is ordered by the applied tariff (ratified TE + TUSD), the one the distribution utility charges. The economic base, which removes the financial components of the tariff process, is the other yardstick: it appears in the table and in the tooltip of each marked point.",
  );
  if (!r.marcadas)
    return tx(`${base} As duas diferem em menos de ${LIMITE_DIFERENCA_BASE}% em todas as distribuidoras.`, `${base} The two differ by less than ${LIMITE_DIFERENCA_BASE}% at every distribution utility.`);
  const e = r.exemplo;
  const ex = e
    ? tx(
        ` Por exemplo, ${e.sigla} é a ${e.posicao}ª pela aplicação e a ${e.posicaoBase}ª pela base, com a aplicação ${pct(Math.abs(e.difPct), 1)} ${e.difPct < 0 ? "abaixo" : "acima"} da base.`,
        ` For example, ${e.sigla} is ${ordinalEn(e.posicao)} by the applied tariff and ${ordinalEn(e.posicaoBase)} by the base, with the applied tariff ${pct(Math.abs(e.difPct), 1)} ${e.difPct < 0 ? "below" : "above"} the base.`,
      )
    : "";
  return tx(
    `${base} Em ${r.marcadas} distribuidoras, marcadas com †, as duas diferem em mais de ${LIMITE_DIFERENCA_BASE}%.${ex}`,
    `${base} At ${r.marcadas} distribution utilities, marked with †, the two differ by more than ${LIMITE_DIFERENCA_BASE}%.${ex}`,
  );
}

/** Dica de um ponto marcado: as duas posições e a diferença, em uma frase curta para o título do ponto. */
export function dicaDaRegua(l: Pick<LinhaRanking, "posicao" | "posicao_base" | "dif_base_pct">, idioma: Idioma = idiomaEnergia()): string | undefined {
  if (!marcaBase(l) || l.posicao_base === null || l.dif_base_pct === null) return undefined;
  const { pct } = formatos(idioma);
  const tx = txEm(idioma);
  return tx(
    `${l.posicao}ª pela aplicação, ${l.posicao_base}ª pela base econômica (aplicação ${pct(Math.abs(l.dif_base_pct), 1)} ${l.dif_base_pct < 0 ? "abaixo" : "acima"} da base)`,
    `${ordinalEn(l.posicao)} by the applied tariff, ${ordinalEn(l.posicao_base)} by the economic base (applied tariff ${pct(Math.abs(l.dif_base_pct), 1)} ${l.dif_base_pct < 0 ? "below" : "above"} the base)`,
  );
}

export type SituacaoForaDoRanking = "encerrada" | "incorporada" | "sem-tarifa";

export type ForaDoRanking = {
  id: string;
  sigla: string;
  situacao: SituacaoForaDoRanking;
  /** O motivo escrito pela gold, com a data. */
  motivo: string;
  dias: number;
  /** Fim da última vigência (AAAA-MM-DD). */
  fim: string;
  /** Custo de 100, 200 e 300 kWh pela última tarifa que a distribuidora teve (a última vigência do arquivo); null sem histórico. */
  custos: [number | null, number | null, number | null] | null;
};

/** As distribuidoras do conjunto sem tarifa vigente na data: o motivo de cada uma e o custo pela última tarifa que tiveram. */
export function foraDoRanking(semVigente: readonly SemVigente[], historico: HistoricoB1["distribuidoras"] | null): ForaDoRanking[] {
  return semVigente.map((s) => {
    const vigs = historico?.[s.cnpj]?.vigencias ?? [];
    const v = vigs.find((x) => x[0] === s.ultima_vigencia.inicio) ?? vigs[vigs.length - 1] ?? null;
    return {
      id: s.cnpj,
      sigla: rotuloDistribuidora(s.sigla, s.cnpj),
      situacao: s.incorporada_por ? "incorporada" : s.dias_sem_tarifa <= 90 ? "encerrada" : "sem-tarifa",
      motivo: s.motivo,
      dias: s.dias_sem_tarifa,
      fim: s.ultima_vigencia.fim,
      custos: v ? [custoDoPerfil(v[5], 100), custoDoPerfil(v[5], 200), custoDoPerfil(v[5], 300)] : null,
    };
  });
}

const CODIGO_SITUACAO: SituacaoForaDoRanking[] = ["encerrada", "incorporada", "sem-tarifa"];

/** [CNPJ, sigla, situação (0 vigência encerrada há até 90 dias, 1 incorporada, 2 sem tarifa há mais tempo), fim da última vigência, custo de 100, 200 e 300 kWh pela última tarifa]. */
export type ForaCompacto = [string, string, 0 | 1 | 2, string, number | null, number | null, number | null];

export function compactarFora(f: readonly ForaDoRanking[]): ForaCompacto[] {
  return f.map((x) => [x.id, x.sigla, CODIGO_SITUACAO.indexOf(x.situacao) as 0 | 1 | 2, x.fim, x.custos?.[0] ?? null, x.custos?.[1] ?? null, x.custos?.[2] ?? null]);
}

export type ForaDoRankingDaTela = { id: string; sigla: string; situacao: SituacaoForaDoRanking; fim: string; custos: [number | null, number | null, number | null] | null };

export function expandirFora(c: readonly ForaCompacto[]): ForaDoRankingDaTela[] {
  return c.map((x) => ({ id: x[0], sigla: x[1], situacao: CODIGO_SITUACAO[x[2]], fim: x[3], custos: x[4] === null && x[5] === null && x[6] === null ? null : [x[4], x[5], x[6]] }));
}

/** O que a página diz de uma distribuidora escolhida que não está no ranking: o motivo, com a data, e o custo pela última tarifa que ela teve. */
export function textoForaDoRanking(f: ForaDoRankingDaTela, perfil: Perfil, dataReferencia: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { dataBR, reais } = formatos(idioma);
  const custo = f.custos?.[perfil === 100 ? 0 : perfil === 200 ? 1 : 2] ?? null;
  const motivo =
    f.situacao === "encerrada"
      ? tx(
          `a vigência da tarifa B1 terminou em ${dataBR(f.fim)} e a tarifa seguinte ainda não consta no arquivo de ${dataBR(dataReferencia)}`,
          `the validity of the B1 tariff ended on ${dataBR(f.fim)} and the next tariff is not yet in the file of ${dataBR(dataReferencia)}`,
        )
      : f.situacao === "incorporada"
        ? tx(`a distribuidora foi incorporada por outra, e a tarifa dela deixou de ser publicada separada`, `the distribution utility was merged into another, and its tariff is no longer published separately`)
        : tx(`a última tarifa B1 terminou em ${dataBR(f.fim)}, há mais de 90 dias, e o arquivo não traz outra`, `the last B1 tariff ended on ${dataBR(f.fim)}, more than 90 days ago, and the file has no other`);
  const ultimo =
    custo === null
      ? ""
      : tx(
          ` Pela última tarifa que teve, ${perfil} kWh custavam ${reais(custo)}; esse valor não entra no ranking nem na mediana.`,
          ` At the last tariff it had, ${perfil} kWh cost ${reais(custo)}; this value is not part of the ranking or the median.`,
        );
  return tx(`${f.sigla} não está no ranking: ${motivo}.${ultimo}`, `${f.sigla} is not in the ranking: ${motivo}.${ultimo}`);
}

/** Contagem por situação das que ficaram fora do ranking, para a linha de Entender; a data é a do fim da vigência que a maioria das encerradas tem. */
export function resumoForaDoRanking(fora: readonly Pick<ForaDoRanking, "situacao" | "fim">[]): { total: number; encerradas: number; incorporadas: number; semTarifa: number; dataEncerramento: string | null } {
  const encerradas = fora.filter((f) => f.situacao === "encerrada");
  const freq = new Map<string, number>();
  for (const f of encerradas) freq.set(f.fim, (freq.get(f.fim) ?? 0) + 1);
  const dataEncerramento = Array.from(freq.entries()).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0]?.[0] ?? null;
  return { total: fora.length, encerradas: encerradas.length, incorporadas: fora.filter((f) => f.situacao === "incorporada").length, semTarifa: fora.filter((f) => f.situacao === "sem-tarifa").length, dataEncerramento };
}

/** A linha de Entender sobre quem ficou fora do ranking: a contagem e o motivo de cada grupo. A lista completa está em Auditar. */
export function textoForaDoRankingLinha(r: ReturnType<typeof resumoForaDoRanking>, idioma: Idioma = idiomaEnergia()): string | null {
  if (!r.total) return null;
  const tx = txEm(idioma);
  const { num, dataBR } = formatos(idioma);
  const plural = (n: number, um: string, varios: string) => `${num(n, 0)} ${n === 1 ? um : varios}`;
  const quando = r.dataEncerramento ? tx(` em ${dataBR(r.dataEncerramento)}`, ` on ${dataBR(r.dataEncerramento)}`) : tx(" há até 90 dias", " up to 90 days ago");
  const partes = [
    r.encerradas
      ? tx(
          `${plural(r.encerradas, "teve", "tiveram")} a vigência encerrada${quando} e a tarifa seguinte ainda não está no arquivo`,
          `${plural(r.encerradas, "had its", "had their")} validity ended${quando} and the next tariff is not yet in the file`,
        )
      : "",
    r.incorporadas ? tx(`${plural(r.incorporadas, "foi incorporada", "foram incorporadas")} por outra distribuidora`, `${plural(r.incorporadas, "was merged", "were merged")} into another distribution utility`) : "",
    r.semTarifa ? tx(`${plural(r.semTarifa, "está sem tarifa", "estão sem tarifa")} há mais de 90 dias`, `${plural(r.semTarifa, "has had", "have had")} no tariff for more than 90 days`) : "",
  ].filter(Boolean);
  return tx(
    `Fora do ranking: ${plural(r.total, "distribuidora", "distribuidoras")}. ${partes.join("; ")}.`,
    `Out of the ranking: ${plural(r.total, "distribution utility", "distribution utilities")}. ${partes.join("; ")}.`,
  );
}

/** Piso de cobertura em UCs da regra de completude (a mesma de Qualidade: 99% das UCs). */
export const PISO_COBERTURA_UCS = 0.99;

export type CoberturaRanking = {
  /** Distribuidoras com tarifa vigente (as do ranking) e o universo: elas mais as que acabaram de ter a vigência encerrada e ainda não têm a seguinte. */
  n: number;
  universo: number;
  pctDistribuidoras: number;
  /** UCs das do ranking, do universo e a razão; null quando a gold de Qualidade não traz as UCs. */
  ucs: number | null;
  ucsUniverso: number | null;
  pctUcs: number | null;
  semUcs: number;
  piso: number;
  /** A cobertura em UCs chega ao piso; null sem UCs para medir. */
  atingePiso: boolean | null;
  /** As que ficaram de fora do universo medido: quantas, UCs somadas e a maior delas. */
  nFora: number;
  pctUcsFora: number | null;
  maiorFora: { sigla: string; ucs: number } | null;
  /** O menor e o maior custo de cada perfil entre as de fora, pela última tarifa que tiveram: o que mudaria nos extremos se ela seguisse valendo. */
  seMantidas: Record<"100" | "200" | "300", { menor: { sigla: string; valor: number } | null; maior: { sigla: string; valor: number } | null }>;
};

/**
 * Regra de completude do ranking: o universo é o das distribuidoras com tarifa vigente mais as que tiveram a vigência encerrada há até 90 dias
 * (a tarifa seguinte ainda não consta no arquivo); as incorporadas e as sem tarifa há mais tempo não contam. A cobertura é medida em
 * distribuidoras e em UCs (Qualidade usa o piso de 99% das UCs). Abaixo do piso, a página não esconde o ranking: diz que o menor e o maior
 * valem só para as que têm tarifa e que podem mudar. Acima, diz a cobertura e o que mudaria nos extremos com a última tarifa das que faltam.
 */
export function coberturaDoRanking(a: {
  vigentes: readonly Pick<TarifaVigente, "cnpj">[];
  fora: readonly ForaDoRanking[];
  info: Readonly<Record<string, Pick<InfoDistribuidora, "ucs">>>;
}): CoberturaRanking {
  const encerradas = a.fora.filter((f) => f.situacao === "encerrada");
  const ucsDe = (id: string) => {
    const u = a.info[id]?.ucs;
    return typeof u === "number" && u > 0 ? u : null;
  };
  const universo = a.vigentes.length + encerradas.length;
  const ucs = a.vigentes.reduce((s, v) => s + (ucsDe(v.cnpj) ?? 0), 0);
  const ucsFora = encerradas.reduce((s, f) => s + (ucsDe(f.id) ?? 0), 0);
  const semUcs = a.vigentes.filter((v) => ucsDe(v.cnpj) === null).length + encerradas.filter((f) => ucsDe(f.id) === null).length;
  const mediu = ucs > 0;
  const pctUcs = mediu ? (ucs / (ucs + ucsFora)) * 100 : null;
  const maior = encerradas.reduce<{ sigla: string; ucs: number } | null>((m, f) => {
    const u = ucsDe(f.id);
    return u !== null && (m === null || u > m.ucs) ? { sigla: f.sigla, ucs: u } : m;
  }, null);
  const extremos = (i: 0 | 1 | 2) => {
    const com = encerradas.flatMap((f) => (f.custos && f.custos[i] !== null ? [{ sigla: f.sigla, valor: f.custos[i] as number }] : []));
    return {
      menor: com.length ? com.reduce((m, x) => (x.valor < m.valor ? x : m)) : null,
      maior: com.length ? com.reduce((m, x) => (x.valor > m.valor ? x : m)) : null,
    };
  };
  return {
    n: a.vigentes.length,
    universo,
    pctDistribuidoras: universo ? (a.vigentes.length / universo) * 100 : 100,
    ucs: mediu ? ucs : null,
    ucsUniverso: mediu ? ucs + ucsFora : null,
    pctUcs,
    semUcs,
    piso: PISO_COBERTURA_UCS,
    atingePiso: pctUcs === null ? null : pctUcs >= PISO_COBERTURA_UCS * 100,
    nFora: encerradas.length,
    pctUcsFora: pctUcs === null ? null : 100 - pctUcs,
    maiorFora: maior,
    seMantidas: { "100": extremos(0), "200": extremos(1), "300": extremos(2) },
  };
}

/**
 * A frase da cobertura para a nota da faixa de métricas: quantas distribuidoras e que parte das UCs o ranking cobre, o piso, e o que
 * mudaria no menor e no maior com a última tarifa das que faltam. Abaixo do piso, a frase vira o aviso de que os extremos valem só
 * para as que têm tarifa.
 */
export function textoCobertura(
  c: CoberturaRanking,
  perfil: Perfil,
  extremos: { menor: number | null; maior: number | null; siglaMenor?: string | null; siglaMaior?: string | null },
  idioma: Idioma = idiomaEnergia(),
): string {
  const tx = txEm(idioma);
  const { num, reais } = formatos(idioma);
  const dist = tx(`${c.n} de ${c.universo} distribuidoras (${num(c.pctDistribuidoras, 1)}%)`, `${c.n} of ${c.universo} distribution utilities (${num(c.pctDistribuidoras, 1)}%)`);
  if (c.pctUcs === null)
    return tx(
      `Cobertura: ${dist}; sem as UCs não há como medir o peso das que ficaram de fora, e o menor e o maior podem mudar quando elas publicarem a tarifa seguinte.`,
      `Coverage: ${dist}; without consumer units there is no way to measure the weight of those left out, and the lowest and highest may change when they publish their next tariff.`,
    );
  const base = tx(`${dist} e ${num(c.pctUcs, 2)}% das UCs`, `${dist} and ${num(c.pctUcs, 2)}% of consumer units`);
  const maiorFora = c.maiorFora ? tx(`, a maior, ${c.maiorFora.sigla}, com ${textoUcs(c.maiorFora.ucs, idioma)}`, `, the largest, ${c.maiorFora.sigla}, with ${textoUcs(c.maiorFora.ucs, idioma)}`) : "";
  const pctFora = num(c.pctUcsFora ?? 0, 2);
  const fora = tx(
    `As ${c.nFora} que ficaram de fora, sem a tarifa seguinte no arquivo, somam ${pctFora}% das UCs${maiorFora}.`,
    `The ${c.nFora} left out, without the next tariff in the file, account for ${pctFora}% of consumer units${maiorFora}.`,
  );
  const se = c.seMantidas[String(perfil) as "100" | "200" | "300"];
  const muda: string[] = [];
  if (se.menor && extremos.menor !== null && se.menor.valor < extremos.menor) {
    const s = extremos.siglaMenor ? ` (${extremos.siglaMenor})` : "";
    muda.push(
      tx(
        `o menor custo de ${perfil} kWh seria ${reais(se.menor.valor)} (${se.menor.sigla}), e não ${reais(extremos.menor)}${s}`,
        `the lowest cost of ${perfil} kWh would be ${reais(se.menor.valor)} (${se.menor.sigla}), not ${reais(extremos.menor)}${s}`,
      ),
    );
  }
  if (se.maior && extremos.maior !== null && se.maior.valor > extremos.maior) {
    const s = extremos.siglaMaior ? ` (${extremos.siglaMaior})` : "";
    muda.push(tx(`o maior seria ${reais(se.maior.valor)} (${se.maior.sigla}), e não ${reais(extremos.maior)}${s}`, `the highest would be ${reais(se.maior.valor)} (${se.maior.sigla}), not ${reais(extremos.maior)}${s}`));
  }
  const efeito = muda.length
    ? tx(`Com a última tarifa delas, ${muda.join("; ")}.`, `With their last tariff, ${muda.join("; ")}.`)
    : tx("Com a última tarifa delas, o menor e o maior custo não mudariam.", "With their last tariff, the lowest and highest cost would not change.");
  const piso = num(c.piso * 100, 0);
  if (c.atingePiso)
    return tx(
      `Cobertura: ${base}, acima do piso de ${piso}% das UCs que Qualidade usa. ${fora} ${efeito}`,
      `Coverage: ${base}, above the ${piso}% consumer-unit floor that Quality of supply uses. ${fora} ${efeito}`,
    );
  return tx(
    `Cobertura abaixo do piso de ${piso}% das UCs que Qualidade usa: ${base}. O menor e o maior valem só para as ${c.n} com tarifa e podem mudar quando as demais publicarem. ${fora} ${efeito}`,
    `Coverage below the ${piso}% consumer-unit floor that Quality of supply uses: ${base}. The lowest and highest apply only to the ${c.n} with a tariff and may change when the others publish. ${fora} ${efeito}`,
  );
}

/**
 * O que a busca por município achou: a(s) distribuidora(s) que a relação oficial liga ao município, onde cada uma está no ranking e o
 * custo do perfil, e as que não têm tarifa B1 vigente na data. Município com mais de uma distribuidora diz que a da casa está na fatura.
 */
export function textoMunicipioEncontrado(m: MunicipioEncontrado, linhas: readonly LinhaRanking[], perfil: Perfil, dataReferencia: string, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { reais, dataBR } = formatos(idioma);
  const usados = distribuidorasDoMunicipio(m);
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const semConfirmacao = tx(", vínculo sem confirmação na relação da ANEEL", ", link not confirmed in ANEEL's list");
  const partes = usados.map((v) => {
    const l = porId.get(v.cnpj);
    const sem = v.estado === 0 ? semConfirmacao : "";
    const nome = v.sigla || `CNPJ ${v.cnpj}`;
    return l
      ? tx(`${l.sigla} (posição ${l.posicao} de ${linhas.length}; ${reais(l.custo)} para ${perfil} kWh${sem})`, `${l.sigla} (position ${l.posicao} of ${linhas.length}; ${reais(l.custo)} for ${perfil} kWh${sem})`)
      : tx(`${nome} (sem tarifa B1 vigente em ${dataBR(dataReferencia)}, fora do ranking${sem})`, `${nome} (no B1 tariff in force on ${dataBR(dataReferencia)}, out of the ranking${sem})`);
  });
  if (!partes.length) return tx(`${m.nome} (${m.uf}): a relação da ANEEL não liga o município a uma distribuidora.`, `${m.nome} (${m.uf}): ANEEL's list does not link the municipality to a distribution utility.`);
  const lista = listaE(partes, idioma, "; ");
  const varias =
    usados.length > 1
      ? tx(" O município tem mais de uma distribuidora; a da sua casa está no alto da fatura.", " The municipality has more than one distribution utility; the one serving your home is at the top of the bill.")
      : "";
  return tx(`${m.nome} (${m.uf}): atendido por ${lista}.${varias}`, `${m.nome} (${m.uf}): served by ${lista}.${varias}`);
}

/* ---------- busca por município ---------- */

/**
 * Índice compacto município → distribuidoras, montado a partir de `territorio_municipios.csv` (relação oficial da ANEEL):
 * `d` são as distribuidoras ([CNPJ, sigla]) e cada município é [nome, UF, vínculos], com vínculo = índice × 3 + estado
 * (1 confirmado, 2 só pelo cadastro de MMGD, 0 sem confirmação).
 */
export type IndiceMunicipios = { d: [string, string][]; m: [string, string, number[]][] };

function linhaCsv(l: string): string[] {
  const out: string[] = [];
  let c = "";
  let aspas = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (aspas) {
      if (ch === '"' && l[i + 1] === '"') {
        c += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else c += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === ";") {
      out.push(c);
      c = "";
    } else c += ch;
  }
  out.push(c);
  return out;
}

export function criarIndiceMunicipios(csv: string): IndiceMunicipios {
  const linhas = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.length);
  const cab = linhaCsv(linhas[0] ?? "");
  const iNome = cab.indexOf("municipio");
  const iUf = cab.indexOf("uf");
  const iDist = cab.indexOf("distribuidoras");
  const d: [string, string][] = [];
  const posicao = new Map<string, number>();
  const m: [string, string, number[]][] = [];
  if (iNome < 0 || iUf < 0 || iDist < 0) return { d, m };
  for (const l of linhas.slice(1)) {
    const c = linhaCsv(l);
    const vinculos: number[] = [];
    for (const par of (c[iDist] ?? "").split("|")) {
      const partes = par.split(":");
      if (partes.length < 3) continue;
      const estado = Number(partes[partes.length - 1]);
      const cnpj = partes[partes.length - 2];
      const sigla = partes.slice(0, -2).join(":");
      if (!/^\d{14}$/.test(cnpj) || ![0, 1, 2].includes(estado)) continue;
      let i = posicao.get(cnpj);
      if (i === undefined) {
        i = d.length;
        posicao.set(cnpj, i);
        d.push([cnpj, sigla]);
      }
      vinculos.push(i * 3 + estado);
    }
    m.push([c[iNome] ?? "", c[iUf] ?? "", vinculos]);
  }
  return { d, m };
}

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’´`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type MunicipioEncontrado = { nome: string; uf: string; vinculos: { cnpj: string; sigla: string; estado: 0 | 1 | 2 }[] };

/**
 * As distribuidoras que a relação oficial liga ao município, pela regra de vínculo da busca: as de vínculo confirmado (ou só pelo
 * cadastro de MMGD); a de vínculo sem confirmação só entra quando o município não tem outra.
 */
export function distribuidorasDoMunicipio(m: MunicipioEncontrado): MunicipioEncontrado["vinculos"] {
  const validos = m.vinculos.filter((v) => v.estado !== 0);
  return validos.length ? validos : m.vinculos;
}

/** Nomes sem acento nem caixa, para buscar sem recalcular a cada tecla. */
export function prepararBuscaMunicipios(indice: IndiceMunicipios): string[] {
  return indice.m.map(([nome, uf]) => `${semAcento(nome)}|${uf.toLowerCase()}`);
}

/**
 * Municípios cujo nome começa por todas as palavras digitadas (sem acento nem caixa); uma palavra que é UF restringe ao estado.
 * Ordem: nome igual, nome que começa pelo texto, palavra que começa, e o resto; empate pelo nome.
 */
export function buscarMunicipios(indice: IndiceMunicipios, preparado: readonly string[], termo: string, max = 8): MunicipioEncontrado[] {
  const t = semAcento(termo);
  if (t.length < 2) return [];
  const ufs = new Set(indice.m.map((x) => x[1].toLowerCase()));
  const palavras = t.split(" ");
  const ufPedida = palavras.length > 1 && ufs.has(palavras[palavras.length - 1]) ? palavras[palavras.length - 1] : null;
  const consulta = (ufPedida ? palavras.slice(0, -1) : palavras).join(" ");
  const partes = consulta.split(" ");
  const achados: { i: number; peso: number }[] = [];
  for (let i = 0; i < preparado.length; i++) {
    const [nome, uf] = preparado[i].split("|");
    if (ufPedida && uf !== ufPedida) continue;
    const palavrasDoNome = nome.split(" ");
    if (!partes.every((p) => palavrasDoNome.some((w) => w.startsWith(p)))) continue;
    achados.push({ i, peso: nome === consulta ? 0 : nome.startsWith(consulta) ? 1 : 2 });
  }
  achados.sort((a, b) => a.peso - b.peso || indice.m[a.i][0].length - indice.m[b.i][0].length || indice.m[a.i][0].localeCompare(indice.m[b.i][0], "pt-BR"));
  return achados.slice(0, max).map(({ i }) => {
    const [nome, uf, v] = indice.m[i];
    return { nome, uf, vinculos: v.map((x) => ({ cnpj: indice.d[Math.floor(x / 3)][0], sigla: indice.d[Math.floor(x / 3)][1], estado: (x % 3) as 0 | 1 | 2 })) };
  });
}

/**
 * O que a busca por município achou na comparação com o IPCA: a variação da tarifa B1 de cada distribuidora do município na janela
 * escolhida, ou a razão de ela não ter variação na janela. Mesma regra de vínculo do ranking (o sem confirmação só entra sem outro).
 */
export function textoMunicipioReajuste(m: MunicipioEncontrado, linhas: readonly LinhaJanela[], janela: Pick<JanelaInflacao, "meses" | "ipca_pct">, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { pct } = formatos(idioma);
  const usados = distribuidorasDoMunicipio(m);
  const porId = new Map(linhas.map((l) => [l.id, l]));
  const partes = usados.map((v) => {
    const l = porId.get(v.cnpj);
    const nome = v.sigla || `CNPJ ${v.cnpj}`;
    return l && l.variacao !== null
      ? tx(
          `${l.sigla} (tarifa B1 ${verboVariacao(l.variacao, 2, idioma)} em ${janela.meses} meses, contra IPCA de ${pct(janela.ipca_pct, 2)})`,
          `${l.sigla} (B1 tariff ${verboVariacao(l.variacao, 2, idioma)} over ${janela.meses} months, against IPCA of ${pct(janela.ipca_pct, 2)})`,
        )
      : tx(
          `${nome} (sem variação nesta janela: sem tarifa B1 nas duas datas ou com a área alterada por incorporação)`,
          `${nome} (no change in this window: no B1 tariff on both dates or area changed by a merger)`,
        );
  });
  if (!partes.length) return tx(`${m.nome} (${m.uf}): a relação da ANEEL não liga o município a uma distribuidora.`, `${m.nome} (${m.uf}): ANEEL's list does not link the municipality to a distribution utility.`);
  const lista = listaE(partes, idioma, "; ");
  const varias =
    usados.length > 1
      ? tx(" O município tem mais de uma distribuidora; a da sua casa está no alto da fatura.", " The municipality has more than one distribution utility; the one serving your home is at the top of the bill.")
      : "";
  return tx(`${m.nome} (${m.uf}): atendido por ${lista}.${varias}`, `${m.nome} (${m.uf}): served by ${lista}.${varias}`);
}

/* ---------- valores nominais e em reais constantes (subsídios e orçamento da CDE) ---------- */

export type FatorReal = { fator: number; meses: number };

/**
 * Fator que leva um valor nominal do ano para reais do mês-base: índice do IPCA do mês-base ÷ média dos índices mensais do ano. O ano
 * do mês-base usa só os meses com índice (parcial, e o fator diz quantos); ano depois do mês-base ou sem índice fica null. A série do
 * IPCA é a de `conta_ipca.csv`, a mesma que a gold usa na mediana em reais.
 */
export function fatoresReaisPorAno(ipca: readonly { mes: string; indice: number }[], anos: readonly string[], base: string): Record<string, FatorReal | null> {
  const indiceBase = ipca.find((x) => x.mes === base)?.indice ?? null;
  const out: Record<string, FatorReal | null> = {};
  for (const ano of anos) {
    const doAno = ipca.filter((x) => x.mes.startsWith(`${ano}-`) && x.mes <= base && x.indice > 0);
    out[ano] = indiceBase === null || !doAno.length ? null : { fator: indiceBase / (doAno.reduce((s, x) => s + x.indice, 0) / doAno.length), meses: doAno.length };
  }
  return out;
}

/** CSV do IPCA publicado (`mes;indice;variacao_12m_pct_publicada`) como série de índices; mês sem índice fica de fora. */
export function lerIpcaCsv(csv: string): { mes: string; indice: number }[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(";"))
    .filter((c) => /^\d{4}-\d{2}$/.test(c[0] ?? "") && Number.isFinite(Number(c[1])) && c[1] !== "")
    .map((c) => ({ mes: c[0], indice: Number(c[1]) }));
}

/** As mesmas linhas com as chaves de valor em reais do mês-base (cada ano pelo seu fator); ano sem fator vira null, nunca o nominal. */
export function emReaisDoMesBase<L extends Record<string, string | number | null>>(linhas: readonly L[], chaves: readonly string[], fatores: Readonly<Record<string, FatorReal | null>>, chaveAno = "ano"): L[] { // i18n: dado
  return linhas.map((l) => {
    const f = fatores[String(l[chaveAno])] ?? null;
    const out: Record<string, string | number | null> = { ...l };
    for (const c of chaves) {
      const v = l[c];
      out[c] = typeof v === "number" && f ? v * f.fator : null;
    }
    return out as L;
  });
}

export type ReaisDaTabela = {
  /** Colunas de dinheiro (R$ bilhões nominais nas linhas recebidas). */
  chaves: string[];
  /** Mês-base do IPCA, "ago/2026". */
  base: string | null;
  /** Fator de cada ano, para tabela com uma linha por ano (coluna `chaveAno`). */
  fatores?: Record<string, FatorReal | null>;
  chaveAno?: string;
  /** Um fator só, para tabela de um ano (subsídios por distribuidora do último ano completo). */
  fatorUnico?: FatorReal | null;
};

/** A tabela tem versão em reais: há mês-base e ao menos um fator. */
export function tabelaTemReal(r: ReaisDaTabela | undefined): boolean {
  return !!r && r.base !== null && (r.fatorUnico != null || Object.values(r.fatores ?? {}).some((f) => f !== null));
}

/** As linhas de uma tabela de dinheiro em reais do mês-base: cada valor pelo fator do ano (ou o fator único); sem fator, null (nunca o nominal). */
export function linhasEmReais<L extends Record<string, string | number | null | undefined>>(linhas: readonly L[], r: ReaisDaTabela): L[] {
  return linhas.map((l) => {
    const f = r.fatorUnico !== undefined ? r.fatorUnico : (r.fatores?.[String(l[r.chaveAno ?? "ano"])] ?? null); // i18n: dado
    const out: Record<string, string | number | null | undefined> = { ...l };
    for (const c of r.chaves) {
      const v = l[c];
      out[c] = typeof v === "number" && f ? v * f.fator : null;
    }
    return out as L;
  });
}

/* ---------- quotas da CDE: série e leitura do residual ---------- */

export type PontoQuotas = { ano: string; pct: number | null };

/** Participação das quotas nas receitas do orçamento, ano a ano (a mesma que a tabela do orçamento mostra). */
export function serieQuotas(f: FinanciamentoCde): PontoQuotas[] {
  return f.totais.map((t) => ({ ano: t.ano, pct: t.quotas_pct }));
}

export type ReceitaQueZerou = { fonte: string; anterior: number; ano: string; anoAnterior: string };

/** Rubricas de receita (fora as quotas) com valor no ano anterior e zero no último ano do orçamento. */
export function receitasQueZeraram(f: FinanciamentoCde): ReceitaQueZerou[] {
  const i = f.anos.indexOf(f.ultimo_ano);
  if (i < 1) return [];
  return f.rubricas
    .filter((r) => r.tipo === "Receita" && r.grupo !== "quotas_tarifa")
    .flatMap((r) => {
      const atual = r.valores[i];
      const antes = r.valores[i - 1];
      return atual === 0 && typeof antes === "number" && antes > 0 ? [{ fonte: r.fonte, anterior: antes, ano: f.ultimo_ano, anoAnterior: f.anos[i - 1] }] : [];
    });
}

export type CategoriaQueZerou = {
  categoria: string;
  /** Maior valor da série de anos completos (R$ nominais) e o ano dele. */
  pico: number;
  anoDoPico: string;
  /** Valor do último ano completo (R$ nominais) e o primeiro ano da sequência que termina nele com valor até a fração do pico. */
  ultimo: number;
  anoUltimo: string;
  desde: string;
};

/**
 * Categorias de subsídio que caem a quase zero: nos anos completos, o valor do último ano é no máximo `fracao` do maior valor da
 * série (que passou de `piso`, R$ nominais), e `desde` é o primeiro ano da sequência, até o último, em que o valor ficou nessa faixa
 * (valores negativos entram). O controle existe para a queda não passar despercebida: a fonte publica o número e não diz o que mudou.
 */
export function categoriasQueZeraram(s: Subsidios, piso = 1e8, fracao = 0.05): CategoriaQueZerou[] {
  const completos = s.anual.filter((a) => !a.parcial);
  if (completos.length < 3) return [];
  const ultimoAno = completos[completos.length - 1];
  const achadas: CategoriaQueZerou[] = [];
  for (const categoria of categoriasSubsidio(s)) {
    const serie = completos.map((a) => ({ ano: a.ano, v: a.categorias[categoria] ?? null }));
    const com = serie.filter((x): x is { ano: string; v: number } => x.v !== null);
    if (!com.length) continue;
    const pico = com.reduce((m, x) => (x.v > m.v ? x : m), com[0]);
    const ultimo = serie[serie.length - 1].v;
    if (ultimo === null || pico.v < piso || ultimo > pico.v * fracao) continue;
    let i = serie.length - 1;
    while (i > 0 && serie[i - 1].v !== null && (serie[i - 1].v as number) <= pico.v * fracao) i--;
    achadas.push({ categoria, pico: pico.v, anoDoPico: pico.ano, ultimo, anoUltimo: ultimoAno.ano, desde: serie[i].ano });
  }
  return achadas;
}

/**
 * A frase do controle: quais categorias caíram a quase zero e desde quando, com o maior valor da série e o último, na moeda escolhida,
 * e o que a fonte diz (nada) sobre a mudança. null quando nenhuma categoria cai. Não afirma causa regulatória: o arquivo não traz.
 */
export function textoCategoriasQueZeraram(lista: readonly CategoriaQueZerou[], v: ValoresDoPainel = VALORES_NOMINAIS, idioma: Idioma = idiomaEnergia()): string | null {
  if (!lista.length) return null;
  const tx = txEm(idioma);
  const { reais } = formatos(idioma);
  const nomes = lista.map((c) => dadoTexto(c.categoria, idioma));
  const juntos = listaE(nomes, idioma);
  const unidade = (x: number) => tx(Math.abs(x) >= 2 ? "bilhões" : "bilhão", "billion");
  const bi = (rs: number, ano: string) => {
    const x = valorNoModo(rs, ano, v);
    return x === null ? `${reais(rs / BI, 2)} ${unidade(rs / BI)} ${tx("nominais", "nominal")}` : `${reais(x / BI, 2)} ${unidade(x / BI)}`;
  };
  const detalhe = lista
    .map((c) =>
      tx(
        `${c.categoria}, de ${bi(c.pico, c.anoDoPico)} em ${c.anoDoPico} a ${bi(c.ultimo, c.anoUltimo)} em ${c.anoUltimo}`,
        `${dadoTexto(c.categoria, idioma)}, from ${bi(c.pico, c.anoDoPico)} in ${c.anoDoPico} to ${bi(c.ultimo, c.anoUltimo)} in ${c.anoUltimo}`,
      ),
    )
    .join("; ");
  const desde = Array.from(new Set(lista.map((c) => c.desde))).join(tx(" e ", " and "));
  return tx(
    `${juntos} ${lista.length > 1 ? "ficam" : "fica"} em quase zero (até 5% do maior valor da série) desde ${desde}: ${detalhe}. ` +
      `O arquivo da ANEEL traz esses valores, positivos, zero ou negativos, e não explica a mudança. Não é falta de dado, e o observatório não confirmou a causa regulatória. Valores ${rotuloMoeda(v, idioma)}.`,
    `${juntos} ${lista.length > 1 ? "have stayed" : "has stayed"} near zero (up to 5% of the largest value in the series) since ${desde}: ${detalhe}. ` +
      `ANEEL's file carries these values, positive, zero or negative, and does not explain the change. It is not missing data, and the observatory has not confirmed the regulatory cause. Values are ${rotuloMoeda(v, idioma)}.`,
  );
}

/**
 * Nota curta do destaque das quotas (ao lado do número): que o valor é orçamento (aprovado ou previsto, nunca execução), a ressalva das
 * receitas do último ano que ainda não têm valor, os dois anos anteriores e a quota como residual. null sem orçamento ou sem a
 * participação do último ano.
 */
export function notaQuotas(f: FinanciamentoCde | null, anosAntes = 2, idioma: Idioma = idiomaEnergia()): string | null {
  if (!f) return null;
  const tx = txEm(idioma);
  const { pct } = formatos(idioma);
  const serie = serieQuotas(f);
  const i = serie.findIndex((p) => p.ano === f.ultimo_ano);
  if (i < 0 || serie[i].pct === null) return null;
  const anteriores = serie.slice(Math.max(0, i - anosAntes), i).filter((p) => p.pct !== null);
  const lista = anteriores.map((p) => tx(`${pct(p.pct, 1)} em ${p.ano}`, `${pct(p.pct, 1)} in ${p.ano}`)).join(tx(" e ", " and "));
  const historico = anteriores.length ? tx(` Antes: ${lista}, também orçamento.`, ` Before: ${lista}, also budget.`) : "";
  const semValor = f.totais.find((t) => t.ano === f.ultimo_ano)?.rubricas_sem_valor ?? [];
  const incompleta = receitasQueZeraram(f).length > 0 || semValor.length > 0;
  const ressalva = incompleta
    ? tx(
        ` Em ${f.ultimo_ano} há receitas ainda sem valor ou em zero: a participação de ${f.ultimo_ano} não é comparável à dos anos anteriores até elas entrarem.`,
        ` In ${f.ultimo_ano} some revenues still have no value or are at zero: the ${f.ultimo_ano} share is not comparable to that of previous years until they come in.`,
      )
    : "";
  return tx(
    `Orçamento aprovado ou previsto pela ANEEL, não execução.${historico}${ressalva} A quota é o residual do orçamento: cobre o que as demais receitas não cobrem.`,
    `Budget approved or forecast by ANEEL, not execution.${historico}${ressalva} The quota is the budget residual: it covers what the other revenues do not.`,
  );
}

/**
 * A leitura do destaque das quotas: série dos anos anteriores, a quota como residual do orçamento e o que mudou nas outras receitas
 * do último ano. Tudo do orçamento publicado; o residual é a regra que a nota da gold cita (a quota cobre a diferença).
 */
export function textoResidualQuotas(f: FinanciamentoCde | null, anosAntes = 2, v: ValoresDoPainel = VALORES_NOMINAIS, idioma: Idioma = idiomaEnergia()): string | null {
  if (!f) return null;
  const tx = txEm(idioma);
  const { pct, num } = formatos(idioma);
  const serie = serieQuotas(f);
  const i = serie.findIndex((p) => p.ano === f.ultimo_ano);
  if (i < 0 || serie[i].pct === null) return null;
  const anteriores = serie.slice(Math.max(0, i - anosAntes), i).filter((p) => p.pct !== null);
  const antes = anteriores.map((p) => tx(`${pct(p.pct, 1)} em ${p.ano}`, `${pct(p.pct, 1)} in ${p.ano}`)).join(tx(" e ", " and "));
  const historico = anteriores.length ? tx(`${antes}, contra `, `${antes}, against `) : "";
  const zeraram = receitasQueZeraram(f);
  const semValor = f.totais.find((t) => t.ano === f.ultimo_ano)?.rubricas_sem_valor ?? [];
  const lista = (xs: string[]) => listaE(xs, idioma);
  const valorAnterior = (z: ReceitaQueZerou) => {
    const x = valorNoModo(z.anterior, z.anoAnterior, v);
    if (x === null) return tx(`R$ ${num(z.anterior / BI, 2)} bi nominais`, `R$ ${num(z.anterior / BI, 2)} billion nominal`);
    const moeda = v.modo === "real" ? ` (${rotuloMoeda(v, idioma)})` : "";
    return tx(`R$ ${num(x / BI, 2)} bi${moeda}`, `R$ ${num(x / BI, 2)} billion${moeda}`);
  };
  const fontes = zeraram.length ? lista(zeraram.map((z) => dadoTexto(z.fonte, idioma))) : "";
  const valores = zeraram.length ? lista(zeraram.map(valorAnterior)) : "";
  const partes = [
    zeraram.length
      ? tx(
          `${fontes} ${zeraram.length > 1 ? "aparecem" : "aparece"} como zero (em ${zeraram[0].anoAnterior}: ${valores})`,
          `${fontes} ${zeraram.length > 1 ? "appear" : "appears"} as zero (in ${zeraram[0].anoAnterior}: ${valores})`,
        )
      : "",
    semValor.length
      ? tx(
          `${semValor.length} ${semValor.length === 1 ? "rubrica está sem valor publicado" : "rubricas estão sem valor publicado"}`,
          `${semValor.length} ${semValor.length === 1 ? "budget line has no published value" : "budget lines have no published value"}`,
        )
      : "",
  ]
    .filter(Boolean)
    .join(tx(" e ", " and "));
  const outras = zeraram.length || semValor.length ? tx(` Em ${f.ultimo_ano}, ${partes}.`, ` In ${f.ultimo_ano}, ${partes}.`) : "";
  return tx(
    `A quota é o residual do orçamento: a despesa do ano é fixada e a quota cobre o que as demais receitas não cobrem. Participação das quotas: ${historico}${pct(serie[i].pct, 1)} em ${f.ultimo_ano}.${outras}`,
    `The quota is the budget residual: the year's expense is set and the quota covers what the other revenues do not. Share of quotas: ${historico}${pct(serie[i].pct, 1)} in ${f.ultimo_ano}.${outras}`,
  );
}

/* ---------- janelas de comparação com o IPCA no mesmo conjunto ---------- */

export type JanelasNoMesmoConjunto = {
  /** Distribuidoras com variação nas três janelas. */
  n: number;
  itens: { meses: number; nDaJanela: number; medianaPct: number | null; medianaRealPct: number | null; ipcaPct: number | null; acima: number }[];
};

/**
 * Mediana da variação em cada janela só entre as distribuidoras que têm variação em TODAS elas. Cada janela tem o seu universo
 * (as de 60 e 120 meses perdem distribuidoras sem tarifa ou com área alterada nas datas antigas), então as medianas publicadas de
 * janelas diferentes não são comparáveis entre si; no mesmo conjunto são.
 */
export function janelasNoMesmoConjunto(janelas: readonly JanelaInflacao[]): JanelasNoMesmoConjunto | null {
  if (janelas.length < 2) return null;
  const porJanela = janelas.map((j) => new Map(j.distribuidoras.filter((d) => d[2] !== null).map((d) => [d[0], d] as [string, JanelaInflacao["distribuidoras"][number]])));
  const comuns = Array.from(porJanela[0].keys()).filter((c) => porJanela.every((m) => m.has(c)));
  if (!comuns.length) return null;
  return {
    n: comuns.length,
    itens: janelas.map((j, k) => {
      const linhas = comuns.map((c) => porJanela[k].get(c) as JanelaInflacao["distribuidoras"][number]);
      const m = mediana(linhas.map((l) => l[2] as number));
      const r = mediana(linhas.map((l) => l[3]).filter((x): x is number => x !== null));
      return {
        meses: j.meses,
        nDaJanela: j.n,
        medianaPct: m === null ? null : arredondar(m, 2),
        medianaRealPct: r === null ? null : arredondar(r, 2),
        ipcaPct: j.ipca_pct,
        acima: j.ipca_pct === null ? 0 : linhas.filter((l) => (l[2] as number) > (j.ipca_pct as number)).length,
      };
    }),
  };
}

/** Frase das janelas no mesmo conjunto: a mediana da variação em cada janela entre as distribuidoras comuns às três, contra o IPCA do período. */
export function textoJanelasNoMesmoConjunto(c: JanelasNoMesmoConjunto, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  const { pct } = formatos(idioma);
  const partes = c.itens.map((i) => tx(`${pct(i.medianaPct, 2)} em ${i.meses} meses (IPCA de ${pct(i.ipcaPct, 2)})`, `${pct(i.medianaPct, 2)} over ${i.meses} months (IPCA of ${pct(i.ipcaPct, 2)})`));
  const lista = listaE(partes, idioma);
  return tx(
    `Nas ${c.n} distribuidoras com variação nas três janelas, a mediana da variação da tarifa B1 é de ${lista}.`,
    `In the ${c.n} distribution utilities with a change in all three windows, the median change in the B1 tariff is ${lista}.`,
  );
}

/* ---------- simulador: tarifa usada, classes iguais à residencial e leituras não conferidas ---------- */

/** Regras que valem para cada classe (ids de `simulador.regras_texto`). */
export const REGRAS_DA_CLASSE: Record<ClasseSimuladorId, string[]> = {
  residencial: ["custo_disponibilidade", "bandeira", "exclusoes"],
  rural: ["custo_disponibilidade", "bandeira", "exclusoes"],
  demais: ["custo_disponibilidade", "bandeira", "exclusoes"],
  tarifa_social: ["tarifa_social", "custo_disponibilidade", "bandeira", "exclusoes"],
  desconto_social: ["desconto_social", "custo_disponibilidade", "bandeira", "exclusoes"],
};

/**
 * Leituras do observatório, ainda não conferidas no texto oficial, de que o resultado da classe depende: as partes não conferidas da
 * regra própria da classe (Tarifa Social, Desconto Social) e, nas regras comuns, as que falam da classe pelo nome. Classe sem leitura
 * pendente devolve lista vazia.
 */
export function leiturasNaoConferidas(classe: ClasseSimuladorId, regras: readonly { id: string; partes: readonly { texto: string; estado: string }[] }[]): string[] {
  const nome = classe === "tarifa_social" ? /tarifa social/i : classe === "desconto_social" ? /desconto social/i : null;
  const out: string[] = [];
  for (const id of REGRAS_DA_CLASSE[classe]) {
    const r = regras.find((x) => x.id === id);
    if (!r) continue;
    for (const p of r.partes) {
      if (p.estado === "CONFERIDA") continue;
      if ((id === classe || (nome && nome.test(p.texto))) && !out.includes(p.texto)) out.push(p.texto);
    }
  }
  return out;
}

/** Em quantas distribuidoras a tarifa (TE e TUSD) da classe é igual à da Residencial na vigência. Só conta onde as duas existem. */
export function igualdadeComResidencial(distribuidoras: readonly { tarifas: Partial<Record<ChaveTarifa, readonly [number | null, number | null] | null>> }[], chave: ChaveTarifa): { iguais: number; total: number } {
  let iguais = 0;
  let total = 0;
  for (const d of distribuidoras) {
    const a = d.tarifas.residencial;
    const b = d.tarifas[chave];
    if (!a || !b) continue;
    total++;
    if (a[0] === b[0] && a[1] === b[1]) iguais++;
  }
  return { iguais, total };
}

/** "subgrupo B2, sem subclasse na fonte": a linha da fonte de que a tarifa vem. */
export function descricaoDaTarifa(c: { subgrupo: string; subclasse: string }, idioma: Idioma = idiomaEnergia()): string {
  const tx = txEm(idioma);
  // i18n: dado ("Não se aplica" é o valor que a fonte publica quando não há subclasse)
  const temSubclasse = c.subclasse && c.subclasse !== "Não se aplica";
  return tx(
    `subgrupo ${c.subgrupo}${temSubclasse ? `, subclasse ${c.subclasse}` : ", sem subclasse na fonte"}`,
    `subgroup ${c.subgrupo}${temSubclasse ? `, subclass ${dadoTexto(c.subclasse, idioma)}` : ", no subclass in the source"}`,
  );
}

/* ---------- ficha "Comprove este número" com procedimento externo ---------- */

/**
 * A ficha da gold indica como refazer o número por um comando interno do pipeline. Para o leitor de fora, o passo "Execute" vira o
 * procedimento sobre o arquivo da fonte: filtros, fórmula, conferência com o valor exibido e a data de corte da captura. Só reescreve
 * o texto da reprodução; todos os outros campos da ficha seguem como a gold os publica.
 */
export function comProcedimentoExterno(ev: Evidencia | null, idioma: Idioma = idiomaEnergia()): Evidencia | null {
  if (!ev) return ev;
  const tx = txEm(idioma);
  const corte = ev.fonte.capturado_em ? formatos(idioma).dataBR(ev.fonte.capturado_em.slice(0, 10)) : null;
  const filtros = ev.filtros.join("; ");
  const passos = [
    tx(
      "Sem o código do observatório: abra o arquivo da fonte indicado acima (o endereço é o da ANEEL; o sha256 identifica a cópia que foi usada).",
      "Without the observatory's code: open the source file indicated above (the address is ANEEL's; the sha256 identifies the copy that was used).",
    ),
    ev.filtros.length ? tx(`Mantenha só as linhas que cumprem: ${filtros}.`, `Keep only the rows that meet: ${filtros}.`) : "",
    tx(`Aplique a fórmula: ${ev.formula}.`, `Apply the formula: ${ev.formula}.`),
    tx(`Confira o resultado com o valor exibido (${ev.valor_exibido}).`, `Check the result against the displayed value (${valorExibidoNoIdioma(ev.valor_exibido, idioma)}).`),
    corte
      ? tx(
          `Data de corte: arquivo capturado em ${corte}. A fonte é atualizada depois dessa data; linhas novas mudam o resultado, e a cópia capturada fica identificada pelo sha256.`,
          `Cut-off date: file captured on ${corte}. The source is updated after that date; new rows change the result, and the captured copy is identified by the sha256.`,
        )
      : tx("Data de corte: a captura não informa a data; use a versão da fonte indicada acima.", "Cut-off date: the capture does not report the date; use the source version indicated above."),
  ];
  return { ...ev, reproducao: passos.filter(Boolean).join("\n") };
}

/* ---------- pontos de uma faixa (cada distribuidora um ponto, sem sobrepor) ---------- */

/**
 * Posição vertical de cada ponto de uma faixa horizontal: linha 0 no centro, depois +1, −1, +2, −2 …, o primeiro lugar em que o
 * ponto não encosta no anterior da mesma linha (`raio` de cada ponto e `folga` entre eles, em px). Determinístico: a mesma lista
 * dá o mesmo desenho no servidor e no navegador.
 */
export function empilharPontos(pontos: readonly { id: string; x: number }[], raio: number, folga = 1): { id: string; x: number; linha: number }[] {
  const ordem = [...pontos].sort((a, b) => a.x - b.x || (a.id < b.id ? -1 : 1));
  const ultimo = new Map<number, number>();
  const passo = 2 * raio + folga;
  return ordem.map((p) => {
    for (let k = 0; ; k++) {
      const linha = k === 0 ? 0 : k % 2 === 1 ? (k + 1) / 2 : -(k / 2);
      const x0 = ultimo.get(linha);
      if (x0 === undefined || p.x - x0 >= passo) {
        ultimo.set(linha, p.x);
        return { id: p.id, x: p.x, linha };
      }
    }
  });
}

/* ---------- props compactas: o que a página entrega aos componentes de cliente ---------- */

/**
 * O HTML de cada página leva, além do que desenha, as props dos componentes de cliente (o fluxo do servidor). Objetos com 14 chaves
 * repetidas em cada uma das 81 distribuidoras pesavam mais que os valores. Aqui as listas grandes viajam como tuplas e voltam a objetos no
 * navegador, sem perder nenhum campo que o componente usa (o teste confere a ida e a volta); os campos que o cliente nunca lê (as
 * componentes de cada grupo, as bases econômicas de TE e TUSD, as conferências internas) não viajam.
 */

/** [CNPJ, sigla, razão social, início, fim, ato, TE, TUSD, total, base econômica total, custo de 100, 200 e 300 kWh, posição]. */
export type VigenteCompacto = [string, string | null, string | null, string, string, string, number | null, number | null, number, number | null, number | null, number | null, number | null, number];

export function compactarVigentes(v: readonly TarifaVigente[]): VigenteCompacto[] {
  return v.map((x) => [x.cnpj, x.sigla, x.nome, x.inicio, x.fim, x.ato, x.te, x.tusd, x.total, x.be_total, x.perfis["100"], x.perfis["200"], x.perfis["300"], x.posicao]);
}

/** Volta ao objeto da gold; `be_te` e `be_tusd` (que nenhum componente de cliente lê) voltam como null. */
export function expandirVigentes(c: readonly VigenteCompacto[]): TarifaVigente[] {
  return c.map(([cnpj, sigla, nome, inicio, fim, ato, te, tusd, total, be_total, p100, p200, p300, posicao]) => ({
    cnpj,
    sigla,
    nome,
    inicio,
    fim,
    ato,
    te,
    tusd,
    total,
    be_te: null,
    be_tusd: null,
    be_total,
    perfis: { "100": p100, "200": p200, "300": p300 },
    posicao,
  }));
}

/** A distribuidora da composição como a tela a usa: o total, as sete partes em R$/MWh e em %, a parte CDE e o que foi reclassificado. */
export type DistribuidoraDaComposicao = Pick<ComposicaoDistribuidora, "cnpj" | "sigla" | "total" | "grupos" | "pct" | "cde" | "cde_pct"> & {
  reclassificadas?: readonly { codigo: string; valor: number | null }[];
};

/** A composição como a tela a usa: um subconjunto da `Composicao` da gold (a gold inteira também serve). */
export type ComposicaoDaTela = {
  grupos: readonly { id: GrupoComponenteId; rotulo: string }[];
  distribuidoras: readonly DistribuidoraDaComposicao[];
  media: Composicao["media"];
  mediana: Pick<Composicao["mediana"], "grupos_rs_mwh" | "mediana_do_total_rs_mwh" | "soma_das_medianas_rs_mwh">;
  cde: Pick<Composicao["cde"], "mediana_rs_mwh" | "razao_de_somas_pct">;
};

/** [CNPJ, sigla, total, sete partes em R$/MWh, sete partes em %, CDE em R$/MWh, CDE em %, reclassificadas (só quando há)]. */
export type DistribuidoraCompacta = [string, string | null, number, ...(number | null)[]];
export type ComposicaoCompacta = Omit<ComposicaoDaTela, "distribuidoras"> & { distribuidoras: DistribuidoraCompacta[] };

export function compactarComposicao(c: ComposicaoDaTela): ComposicaoCompacta {
  return {
    grupos: c.grupos.map((g) => ({ id: g.id, rotulo: g.rotulo })),
    media: c.media,
    mediana: { grupos_rs_mwh: c.mediana.grupos_rs_mwh, mediana_do_total_rs_mwh: c.mediana.mediana_do_total_rs_mwh, soma_das_medianas_rs_mwh: c.mediana.soma_das_medianas_rs_mwh },
    cde: { mediana_rs_mwh: c.cde.mediana_rs_mwh, razao_de_somas_pct: c.cde.razao_de_somas_pct },
    distribuidoras: c.distribuidoras.map((d) => {
      const t: DistribuidoraCompacta = [d.cnpj, d.sigla, d.total, ...ORDEM_GRUPOS.map((g) => d.grupos[g]), ...ORDEM_GRUPOS.map((g) => d.pct[g]), d.cde, d.cde_pct];
      if (d.reclassificadas?.length) (t as unknown[]).push(d.reclassificadas.map((r) => [r.codigo, r.valor]));
      return t;
    }),
  };
}

export function expandirComposicao(c: ComposicaoCompacta): ComposicaoDaTela {
  const n = ORDEM_GRUPOS.length;
  return {
    grupos: c.grupos,
    media: c.media,
    mediana: c.mediana,
    cde: c.cde,
    distribuidoras: c.distribuidoras.map((t) => {
      const parte = (i: number) => t[i] as number | null;
      const grupos = {} as PorGrupo<number | null>;
      const pct = {} as PorGrupo<number | null>;
      ORDEM_GRUPOS.forEach((g, k) => {
        grupos[g] = parte(3 + k);
        pct[g] = parte(3 + n + k);
      });
      const extra = t[3 + 2 * n + 2] as unknown as [string, number | null][] | undefined;
      return {
        cnpj: t[0],
        sigla: t[1],
        total: t[2],
        grupos,
        pct,
        cde: parte(3 + 2 * n),
        cde_pct: parte(4 + 2 * n),
        ...(extra ? { reclassificadas: extra.map(([codigo, valor]) => ({ codigo, valor })) } : {}),
      };
    }),
  };
}

/** Ordem das tarifas de cada distribuidora no simulador (o mesmo `ChaveTarifa` que a gold usa como chave). */
export const ORDEM_CHAVES_TARIFA: ChaveTarifa[] = ["residencial", "ts1", "ts2", "ds1", "ds2", "rural", "demais"];

/** [CNPJ, sigla, início, ato, [TE, TUSD] de cada tarifa na ordem de ORDEM_CHAVES_TARIFA, ou null quando a subclasse não tem vigência]. */
export type DistribuidoraSimCompacta = [string, string | null, string, string, ([number | null, number | null] | null)[]];

export function compactarDistribuidorasSim(d: Simulador["distribuidoras"]): DistribuidoraSimCompacta[] {
  return d.map((x) => [x.cnpj, x.sigla, x.inicio, x.ato, ORDEM_CHAVES_TARIFA.map((k) => x.tarifas[k])]);
}

export function expandirDistribuidorasSim(c: readonly DistribuidoraSimCompacta[]): Simulador["distribuidoras"] {
  return c.map(([cnpj, sigla, inicio, ato, t]) => ({
    cnpj,
    sigla,
    inicio,
    ato,
    tarifas: Object.fromEntries(ORDEM_CHAVES_TARIFA.map((k, i) => [k, t[i] ?? null])) as Simulador["distribuidoras"][number]["tarifas"],
  }));
}

/** [CNPJ, sigla, razão social, 1 quando tem tarifa vigente]: a lista de distribuidoras que o comparador do histórico busca. */
export type EntidadeCompacta = [string, string | null, string | null, 0 | 1];

export function compactarEntidades(vigentes: readonly Pick<TarifaVigente, "cnpj" | "sigla" | "nome">[], semVigente: readonly Pick<SemVigente, "cnpj" | "sigla" | "nome">[]): EntidadeCompacta[] {
  return [...vigentes.map((v): EntidadeCompacta => [v.cnpj, v.sigla, v.nome, 1]), ...semVigente.map((v): EntidadeCompacta => [v.cnpj, v.sigla, v.nome, 0])];
}

export function expandirEntidades(c: readonly EntidadeCompacta[], idioma: Idioma = idiomaEnergia()): { id: string; rotulo: string; detalhe?: string; sinonimos: string[] }[] {
  const tx = txEm(idioma);
  const sem = tx("(sem tarifa vigente)", "(no tariff in force)");
  return c.map(([cnpj, sigla, nome, vigente]) => ({
    id: cnpj,
    rotulo: rotuloDistribuidora(sigla, cnpj),
    detalhe: vigente ? (nome ?? undefined) : `${nome ?? ""} ${sem}`.trim(),
    sinonimos: [cnpj],
  }));
}

/** Uma linha de tabela em tupla: [id, valor de cada coluna na ordem das colunas]. */
export type LinhaCompactaTabela = (string | number | null)[];

/** As linhas da tabela como tuplas: só o identificador e o valor de cada coluna, sem repetir o nome da coluna em cada linha. */
export function compactarLinhasTabela<C extends { id: string }>(colunas: readonly C[], linhas: readonly Record<string, string | number | null | undefined>[]): LinhaCompactaTabela[] {
  return linhas.map((l) => [String(l.id ?? ""), ...colunas.map((c) => l[c.id] ?? null)]);
}

/** Volta às linhas com as chaves de cada coluna (a ausência continua null, nunca zero). */
export function expandirLinhasTabela<C extends { id: string }>(colunas: readonly C[], linhas: readonly LinhaCompactaTabela[]): Record<string, string | number | null>[] {
  return linhas.map((t) => {
    const l: Record<string, string | number | null> = { id: t[0] };
    colunas.forEach((c, i) => {
      l[c.id] = t[i + 1] ?? null;
    });
    return l;
  });
}

/** [CNPJ, UF, tipo (0 sem dado, 1 concessionária, 2 permissionária), UCs, ano das UCs só quando difere do ano comum]. */
export type InfoCompacta = { ano: number | null; d: [string, string | null, 0 | 1 | 2, number | null, number?][] };

export function compactarInfo(info: Readonly<Record<string, InfoDistribuidora>>): InfoCompacta {
  const anos = Object.values(info).map((i) => i.anoUcs).filter((a): a is number => a !== null);
  const ano = anos.length ? anos.sort((a, b) => anos.filter((x) => x === b).length - anos.filter((x) => x === a).length)[0] : null;
  return {
    ano,
    d: Object.entries(info).map(([cnpj, i]) => {
      const t: InfoCompacta["d"][number] = [cnpj, i.uf, i.tipo === "concessionaria" ? 1 : i.tipo === "permissionaria" ? 2 : 0, i.ucs];
      if (i.anoUcs !== null && i.anoUcs !== ano) t.push(i.anoUcs);
      return t;
    }),
  };
}

export function expandirInfo(c: InfoCompacta): Record<string, InfoDistribuidora> {
  return Object.fromEntries(
    c.d.map(([cnpj, uf, tipo, ucs, anoProprio]) => [
      cnpj,
      { uf, tipo: tipo === 1 ? "concessionaria" : tipo === 2 ? "permissionaria" : null, ucs, anoUcs: ucs === null ? null : (anoProprio ?? c.ano) },
    ]),
  ) as Record<string, InfoDistribuidora>;
}
