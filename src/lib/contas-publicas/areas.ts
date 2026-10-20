/**
 * Despesa federal por área (classificação funcional do SIOP), para o painel /contas-publicas/por-area e para a
 * consulta aberta "Quanto de cada R$ 100 do governo federal vai para cada área?" (leva 2, desligada).
 *
 * Uso no servidor: a base por função, subfunção e identificador de resultado primário, de 2000 ao ano corrente,
 * não integra o bundle do cliente. Valores em R$ correntes (o pipeline não deflaciona a execução anual do SIOP);
 * para comparar anos, a medida é a parcela de cada R$ 100, que não depende da inflação.
 *
 * Regras:
 * - A função Encargos Especiais (28) não é uma área: reúne a dívida pública (subfunções 841 a 844), as
 *   transferências a estados, DF e municípios (845 e 847) e outros encargos (846 e demais). As três aparecem
 *   separadas e nunca somadas a saúde, educação ou previdência sem dizer.
 * - "Primária" exclui as linhas com identificador de resultado primário 0 (despesa financeira): juros,
 *   amortização e refinanciamento da dívida, e também concessão de empréstimos e financiamentos em outras funções.
 * - Estágio incompleto na fonte (2014, dotação atualizada) é null: a página diz "não informado", nunca zero.
 */
import fonte from './snapshots/funcoes.json';
import {dataFonte} from './dados';
import {dividirEmCem} from './formato';

export const ESTAGIOS_AREA = ['inicial', 'atualizada', 'empenhado', 'liquidado', 'pago'] as const;
export type EstagioArea = (typeof ESTAGIOS_AREA)[number];
export const NOME_ESTAGIO: Record<EstagioArea, string> = {
  inicial: 'Dotação inicial',
  atualizada: 'Autorizado',
  empenhado: 'Empenhado',
  liquidado: 'Liquidado',
  pago: 'Pago',
};
export const BASES = ['total', 'primaria'] as const;
export type Base = (typeof BASES)[number];
export const NOME_BASE: Record<Base, string> = {
  total: 'Todos os pagamentos, com a dívida',
  primaria: 'Só a despesa primária, sem a dívida',
};

type Registro = {ano: number; funcao: string; subfuncao: string; rp: string; v: Record<EstagioArea, number | null>};
const COL = Object.fromEntries(fonte.colunas.map((c, i) => [c, i])) as Record<string, number>;
const REGISTROS: Registro[] = (fonte.registros as (string | number | null)[][]).map((r) => ({
  ano: r[COL.ano] as number,
  funcao: r[COL.funcao] as string,
  subfuncao: r[COL.subfuncao] as string,
  rp: r[COL.rp] as string,
  v: Object.fromEntries(ESTAGIOS_AREA.map((e) => [e, r[COL[e]] as number | null])) as Record<EstagioArea, number | null>,
}));
const POR_ANO = new Map<number, Registro[]>();
for (const r of REGISTROS) {
  const l = POR_ANO.get(r.ano);
  if (l) l.push(r);
  else POR_ANO.set(r.ano, [r]);
}

export const EXERCICIOS = fonte.exercicios as {
  ano: number;
  atualizacao: string;
  captura: string;
  total: Record<EstagioArea, number | null>;
}[];
export const ANOS = EXERCICIOS.map((e) => e.ano);
export const FUNCOES = fonte.funcoes as Record<string, string>;
export const SUBFUNCOES = fonte.subfuncoes as Record<string, string>;
export const FONTE_AREAS = {
  url: fonte.fonte,
  documentacao: 'https://www1.siop.planejamento.gov.br/siopdoc/doku.php/acesso_publico:dados_abertos',
  perimetro: fonte.perimetro,
  unidade: fonte.unidade,
  classificacao: fonte.classificacao,
  primeiroAno: fonte.primeiroAno as number,
  ultimoAno: fonte.ultimoAno as number,
};

export function exercicio(ano: number) {
  return EXERCICIOS.find((e) => e.ano === ano) ?? null;
}
/** Exercício encerrado: a base do SIOP foi atualizada depois de 31 de dezembro do próprio ano. */
export function encerrado(ano: number): boolean {
  const e = exercicio(ano);
  return !!e && e.atualizacao.slice(0, 10) > `${ano}-12-31`;
}
export function ultimoEncerrado(): number | null {
  const anos = ANOS.filter(encerrado);
  return anos.length ? Math.max(...anos) : null;
}
export const ANO_CORRENTE = Math.max(...ANOS);
/** Datas do exercício em dd/mm/aaaa: atualização da base do SIOP e captura pela Scrutiniums. */
export function datasDoExercicio(ano: number) {
  const e = exercicio(ano);
  return e ? {atualizacao: dataFonte(e.atualizacao), captura: dataFonte(e.captura)} : null;
}

// ------------------------------------------------------------------ parcelas

export const DIVIDA_REFIN = ['841', '842'];
export const DIVIDA_SERVICO = ['843', '844'];
export const TRANSFERENCIAS = ['845', '847'];
export type TipoParcela = 'divida' | 'encargos' | 'area';
export type IdParcela = 'divida-refinanciamento' | 'divida-servico' | 'transferencias' | 'outros-encargos' | `f${string}`;

export const PARCELAS_ENCARGOS: {id: IdParcela; nome: string; tipo: TipoParcela; explica: string}[] = [
  {id: 'divida-refinanciamento', nome: 'Dívida: refinanciamento', tipo: 'divida', explica: 'Títulos que vencem pagos com títulos novos (subfunções 841 e 842). Troca dívida velha por nova.'},
  {id: 'divida-servico', nome: 'Dívida: juros e amortização', tipo: 'divida', explica: 'Juros e parte do principal pagos com outros recursos (subfunções 843 e 844).'},
  {id: 'transferencias', nome: 'Transferências a estados, DF e municípios', tipo: 'encargos', explica: 'Repartição de receitas (FPM, FPE, royalties), complementação do Fundeb e salário-educação, Fundo Constitucional do DF (subfunções 845 e 847).'},
  {id: 'outros-encargos', nome: 'Outros encargos especiais', tipo: 'encargos', explica: 'Precatórios e sentenças judiciais, cobertura do resultado negativo do Banco Central, financiamentos a setores produtivos e outros (subfunção 846).'},
];

export function parcelaDe(funcao: string, subfuncao: string): IdParcela {
  if (funcao !== '28') return `f${funcao}`;
  if (DIVIDA_REFIN.includes(subfuncao)) return 'divida-refinanciamento';
  if (DIVIDA_SERVICO.includes(subfuncao)) return 'divida-servico';
  if (TRANSFERENCIAS.includes(subfuncao)) return 'transferencias';
  return 'outros-encargos';
}
export function nomeParcela(id: IdParcela): string {
  const e = PARCELAS_ENCARGOS.find((p) => p.id === id);
  if (e) return e.nome;
  return FUNCOES[id.slice(1)] ?? `Função ${id.slice(1)}`;
}
export function tipoParcela(id: IdParcela): TipoParcela {
  return PARCELAS_ENCARGOS.find((p) => p.id === id)?.tipo ?? 'area';
}

const naBase = (r: Registro, base: Base) => base === 'total' || r.rp !== '0';

export type Parcela = {id: IdParcela; nome: string; tipo: TipoParcela; valor: number; financeiro: number};
export type Composicao = {ano: number; estagio: EstagioArea; base: Base; total: number; parcelas: Parcela[]};

/**
 * Composição do exercício por parcela, no estágio e na base pedidos. Ordem: dívida, encargos e as áreas da maior
 * para a menor. null quando o exercício não existe ou o estágio está incompleto na fonte.
 */
export function composicao(ano: number, estagio: EstagioArea = 'pago', base: Base = 'total'): Composicao | null {
  const linhas = POR_ANO.get(ano);
  const ex = exercicio(ano);
  if (!linhas || !ex || ex.total[estagio] === null) return null;
  const soma = new Map<IdParcela, {valor: number; financeiro: number}>();
  for (const r of linhas) {
    if (!naBase(r, base)) continue;
    const v = r.v[estagio];
    if (v === null) return null;
    const id = parcelaDe(r.funcao, r.subfuncao);
    const s = soma.get(id) ?? {valor: 0, financeiro: 0};
    s.valor += v;
    if (r.rp === '0') s.financeiro += v;
    soma.set(id, s);
  }
  const ordem = (p: Parcela) => (p.tipo === 'divida' ? 0 : p.tipo === 'encargos' ? 1 : 2);
  const enc = PARCELAS_ENCARGOS.map((p) => p.id);
  const parcelas = [...soma.entries()]
    .map(([id, s]) => ({id, nome: nomeParcela(id), tipo: tipoParcela(id), valor: s.valor, financeiro: s.financeiro}))
    // parcela vazia na base (a dívida na despesa primária) sai da lista; zero calculado de uma área continua
    .filter((p) => !(p.tipo !== 'area' && p.valor === 0 && base === 'primaria'))
    .sort((a, b) => ordem(a) - ordem(b) || (a.tipo === 'area' ? b.valor - a.valor : enc.indexOf(a.id) - enc.indexOf(b.id)) || a.id.localeCompare(b.id));
  const total = parcelas.reduce((s, p) => s + p.valor, 0);
  return {ano, estagio, base, total, parcelas};
}

/** Cada parcela em reais de cada R$ 100, por maiores restos (fecha em R$ 100,0). Total não positivo: null. */
export function emCem(c: Composicao): (Parcela & {cem: number})[] | null {
  if (!(c.total > 0) || c.parcelas.some((p) => p.valor < 0)) return null;
  const cem = dividirEmCem(c.parcelas.map((p) => p.valor));
  return c.parcelas.map((p, i) => ({...p, cem: cem[i]}));
}

// ------------------------------------------------------------------ série

export type PontoSerie = {ano: number; valor: number | null; total: number | null; parcela: number | null; parcial: boolean};

/** A parcela (ou a função inteira, com `f28`) em todos os exercícios: valor corrente e parte de cada R$ 100. */
export function serie(id: IdParcela | 'f28', estagio: EstagioArea = 'pago', base: Base = 'total'): PontoSerie[] {
  return ANOS.map((ano) => {
    const c = composicao(ano, estagio, base);
    if (!c) return {ano, valor: null, total: null, parcela: null, parcial: !encerrado(ano)};
    const valor = id === 'f28' ? c.parcelas.filter((p) => p.tipo !== 'area').reduce((s, p) => s + p.valor, 0) : (c.parcelas.find((p) => p.id === id)?.valor ?? 0);
    return {ano, valor, total: c.total, parcela: c.total > 0 ? (100 * valor) / c.total : null, parcial: !encerrado(ano)};
  });
}

// ------------------------------------------------------------------ subfunções

export type LinhaSubfuncao = {
  codigo: string;
  nome: string;
  valores: Record<EstagioArea, number | null>;
  financeiroPago: number | null;
  /** Anos da série em que a subfunção aparece combinada com esta função. */
  anos: number[];
};

/** Subfunções de uma função no exercício, com os cinco estágios. Matricialidade: a subfunção pode ser de outra área. */
export function subfuncoes(funcao: string, ano: number): LinhaSubfuncao[] {
  const linhas = (POR_ANO.get(ano) ?? []).filter((r) => r.funcao === funcao);
  const mapa = new Map<string, LinhaSubfuncao>();
  for (const r of linhas) {
    const l = mapa.get(r.subfuncao) ?? {codigo: r.subfuncao, nome: SUBFUNCOES[r.subfuncao] ?? r.subfuncao, valores: {inicial: 0, atualizada: 0, empenhado: 0, liquidado: 0, pago: 0}, financeiroPago: 0, anos: anosDaCombinacao(funcao, r.subfuncao)};
    for (const e of ESTAGIOS_AREA) {
      const v = r.v[e];
      l.valores[e] = v === null || l.valores[e] === null ? null : (l.valores[e] as number) + v;
    }
    if (r.rp === '0') l.financeiroPago = l.financeiroPago === null || r.v.pago === null ? null : l.financeiroPago + r.v.pago;
    mapa.set(r.subfuncao, l);
  }
  return [...mapa.values()].sort((a, b) => (b.valores.pago ?? 0) - (a.valores.pago ?? 0) || a.codigo.localeCompare(b.codigo));
}

const COMBINACOES = new Map<string, Set<number>>();
for (const r of REGISTROS) {
  const k = `${r.funcao}.${r.subfuncao}`;
  const s = COMBINACOES.get(k) ?? new Set<number>();
  s.add(r.ano);
  COMBINACOES.set(k, s);
}
function anosDaCombinacao(funcao: string, subfuncao: string): number[] {
  return [...(COMBINACOES.get(`${funcao}.${subfuncao}`) ?? [])].sort((a, b) => a - b);
}

/** Funções que podem ser escolhidas no detalhe: as que têm valor no exercício, em ordem de código. */
export function funcoesDoAno(ano: number): {codigo: string; nome: string}[] {
  const cods = new Set((POR_ANO.get(ano) ?? []).map((r) => r.funcao));
  return [...cods].sort().map((codigo) => ({codigo, nome: FUNCOES[codigo] ?? codigo}));
}

// ------------------------------------------------------------------ quebras e ressalvas

/** Exercícios em que o liquidado registrado é igual ao empenhado (diferença menor que 0,05% do empenhado). */
export function liquidadoIgualEmpenhado(ano: number): boolean {
  const t = exercicio(ano)?.total;
  if (!t || t.empenhado === null || t.liquidado === null || t.empenhado <= 0) return false;
  return Math.abs(t.empenhado - t.liquidado) / t.empenhado < 0.0005;
}
export const ANOS_LIQUIDADO_IGUAL = ANOS.filter(liquidadoIgualEmpenhado);
export const ESTAGIOS_INCOMPLETOS = EXERCICIOS.flatMap((e) => ESTAGIOS_AREA.filter((s) => e.total[s] === null).map((s) => ({ano: e.ano, estagio: s})));

/** Subfunções que não atravessam a série inteira: criadas depois de 2000 ou fora de uso antes do ano corrente. */
export function subfuncoesComQuebra(): {codigo: string; nome: string; de: number; ate: number}[] {
  const anosPorSub = new Map<string, number[]>();
  for (const r of REGISTROS) {
    const l = anosPorSub.get(r.subfuncao) ?? [];
    if (!l.includes(r.ano)) l.push(r.ano);
    anosPorSub.set(r.subfuncao, l);
  }
  const primeiro = ANOS[0], ultimo = ANO_CORRENTE;
  return [...anosPorSub.entries()]
    .map(([codigo, anos]) => ({codigo, nome: SUBFUNCOES[codigo] ?? codigo, de: Math.min(...anos), ate: Math.max(...anos)}))
    .filter((s) => s.de > primeiro || s.ate < ultimo)
    .sort((a, b) => a.de - b.de || a.codigo.localeCompare(b.codigo));
}

/** Rótulos que mudaram na série (só mudanças de texto, não espaços). */
export function rotulosAlterados(): {tipo: 'funcao' | 'subfuncao'; codigo: string; antes: string; depois: string; desde: number}[] {
  const out: {tipo: 'funcao' | 'subfuncao'; codigo: string; antes: string; depois: string; desde: number}[] = [];
  const vig = fonte.vigencia as Record<'funcoes' | 'subfuncoes', Record<string, {de: number; ate: number; rotulo: string}[]>>;
  for (const [tipo, chave] of [['funcao', 'funcoes'], ['subfuncao', 'subfuncoes']] as const) {
    for (const [codigo, hist] of Object.entries(vig[chave])) {
      for (let i = 1; i < hist.length; i++) {
        if (hist[i].rotulo.toLowerCase() !== hist[i - 1].rotulo.toLowerCase()) out.push({tipo, codigo, antes: hist[i - 1].rotulo, depois: hist[i].rotulo, desde: hist[i].de});
      }
    }
  }
  return out.sort((a, b) => a.desde - b.desde);
}

/** Linhas planas para o download (CSV), na ordem da fonte. */
export function linhasDownload() {
  return REGISTROS.map((r) => ({
    ano: r.ano,
    funcao: r.funcao,
    nomeFuncao: FUNCOES[r.funcao] ?? '',
    subfuncao: r.subfuncao,
    nomeSubfuncao: SUBFUNCOES[r.subfuncao] ?? '',
    rp: r.rp,
    natureza: r.rp === '0' ? 'financeira' : 'primária',
    parcela: nomeParcela(parcelaDe(r.funcao, r.subfuncao)),
    ...r.v,
  }));
}

// ------------------------------------------------------------------ recorte na URL

export const ROTA_AREAS = '/contas-publicas/por-area';
export type Recorte = {ano: number; estagio: EstagioArea; base: Base; area: IdParcela};
export const AREA_PADRAO: IdParcela = 'f10';

/** Parcelas que o leitor pode escolher: as quatro de Encargos Especiais e as funções com valor em algum exercício. */
export function parcelasEscolhiveis(): {id: IdParcela; nome: string; tipo: TipoParcela}[] {
  const funcoes = Object.keys(FUNCOES).filter((c) => c !== '28' && c !== '98').sort();
  return [
    ...PARCELAS_ENCARGOS.map((p) => ({id: p.id, nome: p.nome, tipo: p.tipo})),
    ...funcoes.map((c) => ({id: `f${c}` as IdParcela, nome: FUNCOES[c], tipo: 'area' as const})),
  ];
}

/** Lê o recorte dos parâmetros da URL; valor fora da lista volta ao padrão (último exercício encerrado, pago, todos). */
export function lerRecorte(q: Record<string, string | string[] | undefined>): Recorte {
  const um = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined)) ?? '';
  const anoPadrao = ultimoEncerrado() ?? ANO_CORRENTE;
  const ano = /^\d{4}$/.test(um('ano')) && ANOS.includes(Number(um('ano'))) ? Number(um('ano')) : anoPadrao;
  const estagio = (ESTAGIOS_AREA as readonly string[]).includes(um('estagio')) ? (um('estagio') as EstagioArea) : 'pago';
  const base = (BASES as readonly string[]).includes(um('base')) ? (um('base') as Base) : 'total';
  const area = parcelasEscolhiveis().some((p) => p.id === um('area')) ? (um('area') as IdParcela) : AREA_PADRAO;
  return {ano, estagio, base, area};
}

/** Endereço do recorte com uma mudança; parâmetros no padrão saem da URL. */
export function hrefRecorte(r: Recorte, mudanca: Partial<Recorte> = {}, ancora = ''): string {
  const n = {...r, ...mudanca};
  const padrao: Recorte = {ano: ultimoEncerrado() ?? ANO_CORRENTE, estagio: 'pago', base: 'total', area: AREA_PADRAO};
  const q = new URLSearchParams();
  for (const k of ['ano', 'estagio', 'base', 'area'] as const) if (String(n[k]) !== String(padrao[k])) q.set(k, String(n[k]));
  const s = q.toString();
  return `${ROTA_AREAS}${s ? `?${s}` : ''}${ancora ? `#${ancora}` : ''}`;
}

/** Subfunções da parcela escolhida: a função inteira, ou só as subfunções de Encargos Especiais daquela parcela. */
export function subfuncoesDaParcela(id: IdParcela, ano: number): LinhaSubfuncao[] {
  if (id.startsWith('f')) return subfuncoes(id.slice(1), ano);
  return subfuncoes('28', ano).filter((l) => parcelaDe('28', l.codigo) === id);
}
