/**
 * Seletores do comparador de companhias do Varejo (gold da CVM): a seleção de duas a quatro empresas e o exercício, a ponte de
 * R$ 100 de receita líquida até o lucro, com a reconciliação, o caminho do caixa (capital de giro, investimentos e o ajuste do
 * convênio de fornecedores), as diferenças que se repetem em todos os exercícios comparáveis e os avisos de comparabilidade
 * calculados do próprio dado. Nenhuma função ordena empresas por desempenho nem atribui nota: só mede e compara.
 */
import { hrefComRecorte } from "@/lib/painel/recorte";
import { mesCurto } from "./formato";
import { exerciciosDaGold, periodoDe, ROTA_COMPARADOR } from "./grupos";
import type { ContaDoCupom, PerfilCem } from "./dados";
import type { CuradoriaVarejo, Demonstracao, EmpresaGold, GoldEmpresas, LinhaConta, PeriodoEmpresa, Ponte100 } from "./tipos";

/* ------------------------------------------------------------------ seleção */

export const MIN_EMPRESAS = 2;
export const MAX_EMPRESAS = 4;

export type Par = { id: string; slugs: readonly [string, string]; rotulo: string; porque: string };

/** Os dois pares preparados, que abrem a página como atalhos. */
export const PARES: readonly Par[] = [
  { id: "atacarejo", slugs: ["assai", "grupo-mateus"], rotulo: "Assaí × Grupo Mateus", porque: "duas redes de atacarejo, uma nacional e uma regional com atacado e varejo" },
  { id: "eletro", slugs: ["magazine-luiza", "casas-bahia"], rotulo: "Magazine Luiza × Grupo Casas Bahia", porque: "duas redes de eletrodomésticos e móveis com marketplace e crédito próprio" },
];

export type EmpresaComparavel = {
  slug: string;
  nome: string;
  /** Segmentos da curadoria em que a companhia aparece (pode ser mais de um: Magazine Luiza está em departamento e em eletromóveis). */
  segmentos: string[];
  /** Slug da ficha do grupo, quando existe. */
  ficha: string | null;
};

/** As companhias da gold, cada uma com os segmentos da curadoria a que pertence (ranking e lista de concorrentes de cada segmento). */
export function empresasComparaveis(e: GoldEmpresas, c: CuradoriaVarejo): EmpresaComparavel[] {
  const fichaDe = new Map<string, string>();
  for (const [slug, f] of Object.entries(c.fichas)) if (f.empresa_gold) fichaDe.set(f.empresa_gold, slug);
  return Object.entries(e.empresas).map(([slug, emp]) => {
    const segs = new Set<string>();
    for (const g of c.ranking?.grupos ?? []) if ((g.empresa_gold ?? null) === slug && g.segmento) segs.add(g.segmento);
    const grupoDaFicha = fichaDe.get(slug);
    for (const s of c.segmentos?.segmentos ?? []) if ((s.concorrentes ?? []).some((x) => x.slug === slug || (grupoDaFicha && x.slug === grupoDaFicha))) segs.add(s.slug);
    return { slug, nome: emp.nome, segmentos: Array.from(segs), ficha: grupoDaFicha ?? null };
  });
}

/** As outras companhias que dividem algum segmento com a dada: os substitutos naturais de uma comparação. */
export function substitutos(todas: EmpresaComparavel[], slug: string): EmpresaComparavel[] {
  const alvo = todas.find((x) => x.slug === slug);
  if (!alvo) return [];
  return todas.filter((x) => x.slug !== slug && x.segmentos.some((s) => alvo.segmentos.includes(s)));
}

/** `?e=assai,grupo-mateus` (ou `e` repetido, que o formulário sem JavaScript envia): só slugs da gold, sem repetir, até quatro. */
export function selecaoDaUrl(e: GoldEmpresas, bruto: string | string[] | undefined): string[] {
  const pedidos = (Array.isArray(bruto) ? bruto : [bruto ?? ""]).flatMap((x) => x.split(",")).map((x) => x.trim().toLowerCase());
  const validos: string[] = [];
  for (const s of pedidos) if (s && Object.prototype.hasOwnProperty.call(e.empresas, s) && !validos.includes(s)) validos.push(s);
  return validos.slice(0, MAX_EMPRESAS);
}

export const PAR_PADRAO = PARES[0].slugs;

/** O exercício pedido, quando a gold o cobre; senão o mais recente. */
export function anoDaUrl(e: GoldEmpresas, bruto: string | null): number {
  const anos = exerciciosDaGold(e);
  const pedido = Number(bruto);
  return anos.includes(pedido) ? pedido : anos[anos.length - 1];
}

export function hrefComparador(e: GoldEmpresas, slugs: readonly string[], ano: number): string {
  const anos = exerciciosDaGold(e);
  const padrao = slugs.length === PAR_PADRAO.length && slugs.every((s, i) => s === PAR_PADRAO[i]);
  return hrefComRecorte(ROTA_COMPARADOR, { e: padrao ? null : slugs.join(","), ano: ano === anos[anos.length - 1] ? null : String(ano) });
}

/** O par preparado que a seleção forma, em qualquer ordem; null quando a seleção não é um deles. */
export const parDaSelecao = (slugs: readonly string[]): Par | null => PARES.find((p) => slugs.length === 2 && p.slugs.every((s) => slugs.includes(s))) ?? null;

/* ------------------------------------------------------------------ ponte de R$ 100 */

export type IdParte = "custo" | "despesas" | "financeiro" | "impostos" | "outros" | "lucro";

export type Parte = {
  id: IdParte;
  rotulo: string;
  /** Como a gold publica: negativo tira dos R$ 100, positivo soma (crédito de imposto, resultado financeiro positivo). */
  valor: number;
};

export const PARTES: { id: IdParte; rotulo: string; campo: keyof Ponte100; explica: string }[] = [
  { id: "custo", rotulo: "Custo da mercadoria vendida", campo: "custo", explica: "O que a empresa pagou pelas mercadorias que vendeu." },
  { id: "despesas", rotulo: "Despesas operacionais", campo: "despesas_operacionais", explica: "Salários, aluguéis, entrega, propaganda, administração e perdas com crédito, menos outras receitas da operação." },
  { id: "financeiro", rotulo: "Resultado financeiro", campo: "resultado_financeiro", explica: "Juros da dívida, dos aluguéis de longo prazo e da antecipação de recebíveis, menos o que o caixa rendeu." },
  { id: "impostos", rotulo: "Imposto sobre o lucro", campo: "ir_csll", explica: "Imposto de renda e contribuição social. Positivo quando o ano gerou crédito de imposto em vez de despesa." },
  { id: "outros", rotulo: "Operações descontinuadas e outros", campo: "descontinuadas_e_outros", explica: "Resultado de negócios encerrados ou vendidos e o arredondamento que fecha a conta no lucro consolidado." },
  { id: "lucro", rotulo: "Lucro líquido", campo: "lucro_liquido", explica: "O que sobra (ou falta, quando negativo) depois de tudo." },
];

export const partesDaPonte = (b: Ponte100): Parte[] => PARTES.map((p) => ({ id: p.id, rotulo: p.id === "lucro" && b.lucro_liquido < 0 ? "Prejuízo líquido" : p.rotulo, valor: b[p.campo] }));

export const TOLERANCIA_PONTE = 0.05;

/**
 * A conta que fecha a ponte: R$ 100 mais cada parcela (com o sinal da gold) tem de dar o lucro por R$ 100, e este tem de ser o
 * lucro líquido divulgado dividido pela receita líquida. `fecha` exige as duas igualdades dentro da tolerância.
 */
export function reconciliacao(p: Pick<Demonstracao, "ponte_100" | "lucro_liquido" | "receita_liquida">): { soma: number; lucroPor100: number; lucroDivulgadoPor100: number | null; diferenca: number; fecha: boolean } | null {
  const b = p.ponte_100;
  if (!b) return null;
  const soma = 100 + b.custo + b.despesas_operacionais + b.resultado_financeiro + b.ir_csll + b.descontinuadas_e_outros;
  const divulgado = p.lucro_liquido !== null && p.receita_liquida ? (100 * p.lucro_liquido) / p.receita_liquida : null;
  const diferenca = Math.max(Math.abs(soma - b.lucro_liquido), divulgado === null ? 0 : Math.abs(divulgado - b.lucro_liquido));
  return { soma, lucroPor100: b.lucro_liquido, lucroDivulgadoPor100: divulgado, diferenca, fecha: diferenca <= TOLERANCIA_PONTE };
}

/** Uma linha de abertura (despesas ou financeiro) em reais e em R$ por 100 de receita líquida. */
export function abertura(linhas: LinhaConta[] | undefined, receita: number | null): { descricao: string; valor: number; por100: number | null }[] {
  return (linhas ?? [])
    .filter((l): l is { conta?: string; descricao: string; valor: number } => typeof l.valor === "number" && l.valor !== 0 && typeof l.descricao === "string")
    .map((l) => ({ descricao: l.descricao, valor: l.valor, por100: receita ? (100 * l.valor) / receita : null }));
}

/* ------------------------------------------------------------------ caixa */

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export type Caixa = {
  operacional: number | null;
  estoques: number | null;
  fornecedores: number | null;
  recebiveis: number | null;
  /** Investimento em imobilizado e intangível, como saída (negativo). */
  investimentos: number | null;
  /** Pagamentos a fornecedores por convênio (risco sacado) apresentados no fluxo de financiamento; null quando a companhia não apresenta a linha. */
  convenio: number | null;
  aposConvenio: number | null;
};

export function caixaDe(p: Demonstracao | null): Caixa {
  return {
    operacional: n(p?.caixa_operacional), estoques: n(p?.var_estoques), fornecedores: n(p?.var_fornecedores), recebiveis: n(p?.var_recebiveis),
    investimentos: n(p?.capex), convenio: n(p?.convenio_fornecedores_no_financiamento), aposConvenio: n(p?.caixa_operacional_apos_convenio),
  };
}

/* ------------------------------------------------------------------ o que se repete nos exercícios */

export type Medida = {
  id: string;
  rotulo: string;
  unidade: string;
  casas: number;
  valor: (p: Demonstracao) => number | null;
  /** O que a medida diz, em palavras simples. */
  explica: string;
};

const sobreReceita = (v: number | null, p: Demonstracao) => (v === null || !p.receita_liquida ? null : (100 * v) / p.receita_liquida);

/** Medidas relativas (por receita, por custo), que permitem comparar empresas de tamanhos diferentes. */
export const MEDIDAS_COMPARADAS: Medida[] = [
  { id: "margem-bruta", rotulo: "Margem bruta", unidade: "% da receita líquida", casas: 1, valor: (p) => n(p.margem_bruta_pct), explica: "Quanto sobra da venda depois do custo da mercadoria." },
  { id: "despesas", rotulo: "Despesas operacionais", unidade: "% da receita líquida", casas: 1, valor: (p) => (p.ponte_100 ? -p.ponte_100.despesas_operacionais : null), explica: "Quanto da venda a operação consome." },
  { id: "margem-operacional", rotulo: "Margem operacional", unidade: "% da receita líquida", casas: 1, valor: (p) => n(p.margem_operacional_pct), explica: "O resultado antes dos juros e do imposto." },
  { id: "financeiro", rotulo: "Despesa financeira líquida", unidade: "% da receita líquida", casas: 1, valor: (p) => (p.ponte_100 ? -p.ponte_100.resultado_financeiro : null), explica: "Quanto da venda vai para juros, já descontado o rendimento do caixa." },
  { id: "margem-liquida", rotulo: "Margem líquida", unidade: "% da receita líquida", casas: 1, valor: (p) => n(p.margem_liquida_pct), explica: "O lucro de cada R$ 100 de receita líquida." },
  {
    id: "dias-estoque", rotulo: "Estoque", unidade: "dias de custo", casas: 0,
    valor: (p) => (n(p.estoques) === null || !p.custo ? null : (365 * (n(p.estoques) as number)) / Math.abs(p.custo)),
    explica: "Por quantos dias de venda, ao custo, o estoque do fim do exercício daria.",
  },
  {
    id: "dias-fornecedores", rotulo: "Fornecedores", unidade: "dias de custo", casas: 0,
    valor: (p) => (n(p.fornecedores) === null || !p.custo ? null : (365 * (n(p.fornecedores) as number)) / Math.abs(p.custo)),
    explica: "Quantos dias de compra, ao custo, a empresa devia a fornecedores no fim do exercício (sem o saldo de convênio, que fica em outra conta).",
  },
  {
    id: "caixa", rotulo: "Caixa operacional, depois do convênio quando houver", unidade: "% da receita líquida", casas: 1,
    valor: (p) => sobreReceita(n(p.caixa_operacional_apos_convenio) ?? n(p.caixa_operacional), p),
    explica: "O dinheiro que a operação gerou; quando a companhia apresenta pagamentos de convênio no financiamento, eles são descontados.",
  },
  { id: "investimentos", rotulo: "Investimentos", unidade: "% da receita líquida", casas: 1, valor: (p) => (n(p.capex) === null ? null : sobreReceita(Math.abs(n(p.capex) as number), p)), explica: "Quanto da venda foi para lojas, centros de distribuição e sistemas." },
];

export type Persistencia = {
  medida: Medida;
  a: number | null;
  b: number | null;
  /** A menos B no exercício escolhido, na unidade da medida (pontos percentuais ou dias). */
  diferenca: number | null;
  /** Exercícios em que as duas têm o valor. */
  comparaveis: number;
  /** Em quantos deles A ficou acima de B. */
  aAcima: number;
  /** A diferença manteve o mesmo sinal em todos os exercícios comparáveis (e houve mais de um). */
  repete: boolean;
  menor: number | null;
  maior: number | null;
};

/**
 * Para duas companhias: cada medida no exercício escolhido e em quantos dos exercícios comparáveis a diferença teve o mesmo
 * sinal. Uma diferença que se repete em todos os anos não depende do ano escolhido; uma que troca de sinal depende.
 */
export function persistencias(e: GoldEmpresas, a: EmpresaGold, b: EmpresaGold, ano: number): Persistencia[] {
  const anos = exerciciosDaGold(e);
  return MEDIDAS_COMPARADAS.map((medida) => {
    const dif = (x: number): number | null => {
      const pa = periodoDe(a, x);
      const pb = periodoDe(b, x);
      const va = pa ? medida.valor(pa) : null;
      const vb = pb ? medida.valor(pb) : null;
      return va === null || vb === null ? null : va - vb;
    };
    const difs = anos.map(dif).filter((x): x is number => x !== null);
    const pa = periodoDe(a, ano);
    const pb = periodoDe(b, ano);
    const aAcima = difs.filter((d) => d > 0).length;
    return {
      medida, a: pa ? medida.valor(pa) : null, b: pb ? medida.valor(pb) : null, diferenca: dif(ano), comparaveis: difs.length, aAcima,
      repete: difs.length > 1 && (aAcima === difs.length || difs.every((d) => d < 0)),
      menor: difs.length ? Math.min(...difs) : null, maior: difs.length ? Math.max(...difs) : null,
    };
  });
}

/* ------------------------------------------------------------------ avisos de comparabilidade */

export type Aviso = { id: string; titulo: string; texto: string };

const LIMITE_EXTRAORDINARIO = 10;

/**
 * Avisos calculados da gold para a seleção e o exercício: exercício ausente, base individual contra consolidada, reapresentação,
 * resultado financeiro positivo, operações descontinuadas relevantes e último trimestre em datas diferentes. Só aparece o que
 * é material no recorte; os avisos que valem para qualquer comparação (arrendamentos, resultado ajustado) a página escreve sempre.
 */
export function avisosDaSelecao(empresas: { slug: string; emp: EmpresaGold }[], ano: number): Aviso[] {
  const avisos: Aviso[] = [];
  const com = empresas.map((x) => ({ ...x, p: periodoDe(x.emp, ano) }));
  const sem = com.filter((x) => !x.p);
  if (sem.length) {
    avisos.push({
      id: "ausente", titulo: `Sem demonstração de ${ano}`,
      texto: `${sem.map((x) => `${x.emp.nome} (exercícios na base: ${x.emp.anuais.map((a) => a.exercicio).join(", ") || "nenhum"})`).join("; ")}. A coluna fica marcada como sem demonstração; nenhum outro exercício entra no lugar.`,
    });
  }
  const bases = new Set(com.filter((x) => x.p).map((x) => x.p!.base ?? "não informada"));
  if (bases.size > 1) {
    avisos.push({
      id: "base", titulo: "Demonstrações individuais ao lado de consolidadas",
      texto: `${com.filter((x) => x.p).map((x) => `${x.emp.nome}: ${x.p!.base === "individual" ? "individual (a companhia não tem controladas a consolidar)" : x.p!.base ?? "base não informada"}`).join("; ")}. A consolidada soma as controladas; a individual é só a companhia.`,
    });
  }
  for (const x of com) {
    const r = x.p?.reapresentado_no_exercicio_seguinte;
    if (x.p && r && (r.receita_liquida !== x.p.receita_liquida || r.lucro_liquido !== x.p.lucro_liquido)) {
      avisos.push({
        id: `reapresentado-${x.slug}`, titulo: `${x.emp.nome}: ${ano} foi reapresentado no exercício seguinte`,
        texto: "A comparação usa os valores publicados na demonstração do próprio exercício. Os valores reapresentados, quando a companhia mudou o perímetro ou corrigiu o resultado, estão na ficha do grupo.",
      });
    }
    const b = x.p?.ponte_100;
    if (b && b.resultado_financeiro > 0) {
      avisos.push({
        id: `financeiro-${x.slug}`, titulo: `${x.emp.nome}: resultado financeiro positivo em ${ano}`,
        texto: `O resultado financeiro somou R$ ${b.resultado_financeiro.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a cada R$ 100 de receita líquida, em vez de tirar. A base não diz de onde veio o ganho: a composição está na parcela "resultado financeiro" abaixo e os eventos do exercício, quando documentados, estão na ficha do grupo.`,
      });
    }
    if (b && Math.abs(b.descontinuadas_e_outros) >= LIMITE_EXTRAORDINARIO / 2) {
      avisos.push({
        id: `descontinuadas-${x.slug}`, titulo: `${x.emp.nome}: operações descontinuadas pesam no lucro de ${ano}`,
        texto: `Negócios encerrados ou vendidos ${b.descontinuadas_e_outros < 0 ? "tiraram" : "somaram"} R$ ${Math.abs(b.descontinuadas_e_outros).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a cada R$ 100 de receita líquida das operações que continuam. Custo, despesas e margens são só das operações continuadas; o lucro líquido inclui as descontinuadas.`,
      });
    }
  }
  const datas = new Set(empresas.map((x) => x.emp.ultimo_trimestre?.data_base ?? ""));
  if (datas.size > 1) {
    avisos.push({
      id: "trimestre", titulo: "Último trimestre em datas diferentes",
      texto: `${empresas.map((x) => `${x.emp.nome}: ${x.emp.ultimo_trimestre?.data_base ? mesCurto(x.emp.ultimo_trimestre.data_base.slice(0, 7)) : "sem trimestre na base"}`).join("; ")}. Os acumulados do ano em curso não cobrem o mesmo período e por isso não entram nesta comparação, que é de exercícios fechados.`,
    });
  }
  return avisos;
}

/**
 * Variação percentual da receita líquida de um exercício contra o anterior; null sem os dois. Quando a demonstração do exercício
 * reapresentou o anterior (mudança de perímetro), a base é o valor reapresentado, que tem o mesmo perímetro do exercício.
 */
export function variacaoDaReceita(emp: EmpresaGold, ano: number): number | null {
  const atual = periodoDe(emp, ano)?.receita_liquida ?? null;
  const anterior = periodoDe(emp, ano - 1);
  const antes = anterior?.reapresentado_no_exercicio_seguinte?.receita_liquida ?? anterior?.receita_liquida ?? null;
  return atual === null || antes === null || antes === 0 ? null : (100 * atual) / antes - 100;
}

/* ------------------------------------------------------------------ figuras do redesenho do comparador (24/11/2026) */

/** O exercício de uma companhia como perfil do cupom de R$ 100 (o mesmo formato de perfisDoModelo, em dados.ts); null sem a ponte. */
export function perfilDoExercicio(slug: string, emp: EmpresaGold, p: PeriodoEmpresa | null, perfil: string): PerfilCem | null {
  const b = p?.ponte_100;
  if (!p || !b) return null;
  return {
    slug, perfil, empresa: emp.nome, exercicio: p.exercicio, documento: p.documento?.link ?? null,
    partes: [
      { id: "custo", rotulo: "Custo da mercadoria vendida", valor: -b.custo },
      { id: "despesas", rotulo: "Despesas de operação", valor: -b.despesas_operacionais },
      { id: "financeiro", rotulo: "Juros e resultado financeiro", valor: -b.resultado_financeiro },
      { id: "impostos", rotulo: "Imposto sobre o lucro", valor: -b.ir_csll },
      { id: "outros", rotulo: "Operações descontinuadas e outros", valor: -b.descontinuadas_e_outros },
      { id: "lucro", rotulo: "Lucro ou prejuízo", valor: b.lucro_liquido },
    ],
  };
}

export type LinhaDoCupom = {
  id: IdParte;
  /** Uma célula por empresa, na ordem da seleção: quanto a parcela tirou de cada R$ 100 (positivo tira; negativo devolve); null sem demonstração. */
  valores: (number | null)[];
  /** Índices da empresa com o maior e com o menor valor, entre as que têm o dado; null com menos de duas. */
  maior: number | null;
  menor: number | null;
  /** Maior menos menor, em R$ por R$ 100. */
  amplitude: number | null;
};

/**
 * Os cupons linha a linha: para cada parcela da ponte, o valor de cada empresa e a distância entre a que mais e a que menos gasta.
 * O lucro vem com o sinal dele (prejuízo negativo). Diferença menor que um centavo não aponta maior nem menor.
 */
export function linhasDosCupons(pontes: readonly (Ponte100 | null | undefined)[]): LinhaDoCupom[] {
  return PARTES.map((parte) => {
    const valores = pontes.map((b) => (b ? (parte.id === "lucro" ? b[parte.campo] : -b[parte.campo]) : null));
    const com = valores.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null);
    if (com.length < 2) return { id: parte.id, valores, maior: null, menor: null, amplitude: null };
    const maior = com.reduce((a, b) => (b.v > a.v ? b : a));
    const menor = com.reduce((a, b) => (b.v < a.v ? b : a));
    const amplitude = maior.v - menor.v;
    return amplitude < 0.005 ? { id: parte.id, valores, maior: null, menor: null, amplitude: 0 } : { id: parte.id, valores, maior: maior.i, menor: menor.i, amplitude };
  });
}

export type PassoDaCascata = {
  id: "antes-do-giro" | "estoques" | "fornecedores" | "recebiveis" | "operacional" | "convenio" | "apos-convenio" | "investimentos" | "apos-investimentos";
  rotulo: string;
  /** "total": um patamar do caixa (barra a partir do zero); "passo": o que somou ou tirou entre dois patamares. */
  tipo: "total" | "passo";
  /** R$ por R$ 100 de receita líquida; null quando a companhia não apresenta a linha. */
  por100: number | null;
  /** O mesmo valor em reais. */
  reais: number | null;
  /** Onde o passo começa e termina, em R$ por R$ 100 (patamar: de zero ao valor). */
  de: number | null;
  ate: number | null;
};

/**
 * A cascata do caixa por R$ 100 de receita líquida: o que a operação gerou antes de estoques, fornecedores e contas a receber (conta
 * desta página: o caixa operacional declarado menos as três variações), as três variações, o caixa operacional declarado, os
 * pagamentos de convênio que a companhia apresenta no financiamento, o caixa depois deles e, por fim, os investimentos. Cada patamar
 * é a soma do anterior com os passos entre eles; sem convênio, o passo e o patamar seguinte ficam ausentes e a cascata segue do
 * declarado. Sem receita ou sem o caixa operacional, não há cascata (null).
 */
export function cascataDoCaixa(p: Demonstracao | null): PassoDaCascata[] | null {
  const cx = caixaDe(p);
  const receita = p?.receita_liquida ?? null;
  if (!p || !receita || cx.operacional === null) return null;
  const r = (v: number | null) => (v === null ? null : (100 * v) / receita);
  const giro = [cx.estoques, cx.fornecedores, cx.recebiveis];
  const antes = cx.operacional - giro.reduce<number>((s, v) => s + (v ?? 0), 0);
  const passos: PassoDaCascata[] = [];
  let nivel = 0;
  const total = (id: PassoDaCascata["id"], rotulo: string, valor: number | null) => {
    passos.push({ id, rotulo, tipo: "total", por100: r(valor), reais: valor, de: valor === null ? null : 0, ate: r(valor) });
    if (valor !== null) nivel = (100 * valor) / receita;
  };
  const passo = (id: PassoDaCascata["id"], rotulo: string, valor: number | null) => {
    const d = r(valor);
    passos.push({ id, rotulo, tipo: "passo", por100: d, reais: valor, de: d === null ? null : nivel, ate: d === null ? null : nivel + d });
    if (d !== null) nivel += d;
  };
  total("antes-do-giro", "Gerado pela operação, antes do capital de giro", antes);
  passo("estoques", "Estoques", cx.estoques);
  passo("fornecedores", "Fornecedores", cx.fornecedores);
  passo("recebiveis", "Contas a receber", cx.recebiveis);
  total("operacional", "Caixa operacional declarado", cx.operacional);
  passo("convenio", "Pagamentos de convênio a fornecedores", cx.convenio);
  total("apos-convenio", "Caixa operacional depois do convênio", cx.convenio === null ? null : cx.aposConvenio);
  passo("investimentos", "Investimentos", cx.investimentos);
  total("apos-investimentos", "O que sobra depois dos investimentos", cx.investimentos === null ? null : (cx.aposConvenio ?? cx.operacional) + cx.investimentos);
  return passos;
}

export type SinalDoExercicio = { exercicio: number; /** 1: A acima de B; -1: B acima; 0: iguais; null: uma das duas sem o valor. */ sinal: 1 | -1 | 0 | null };

/** Para duas companhias e uma medida: em cada exercício da base, qual das duas ficou acima. É a persistência desenhada ano a ano. */
export function sinaisPorExercicio(e: GoldEmpresas, a: EmpresaGold, b: EmpresaGold, medida: Medida): SinalDoExercicio[] {
  return exerciciosDaGold(e).map((exercicio) => {
    const pa = periodoDe(a, exercicio);
    const pb = periodoDe(b, exercicio);
    const va = pa ? medida.valor(pa) : null;
    const vb = pb ? medida.valor(pb) : null;
    return { exercicio, sinal: va === null || vb === null ? null : va > vb ? 1 : va < vb ? -1 : 0 };
  });
}

export type MedidaEmPontos = { medida: Medida; /** Um valor por empresa, na ordem da seleção; null sem o dado. */ valores: (number | null)[] };

/** As medidas relativas de cada empresa selecionada no exercício, para o gráfico de pontos conectados (de duas a quatro empresas). */
export function medidasEmPontos(periodos: readonly (PeriodoEmpresa | null)[]): MedidaEmPontos[] {
  return MEDIDAS_COMPARADAS.map((medida) => ({ medida, valores: periodos.map((p) => (p ? medida.valor(p) : null)) }));
}

export type { ContaDoCupom, PeriodoEmpresa };
