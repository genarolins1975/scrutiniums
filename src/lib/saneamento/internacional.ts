import type { Agregado, EstimativaJmp, PaisJmp } from "./tipos";

/**
 * Comparação internacional: estimativas do JMP (OMS e UNICEF) por país, 2000 a 2024. O JMP mede outra coisa que o Censo e o SINISA, com definições
 * próprias; aqui só há leitura, posição entre países e a conciliação lado a lado com as fontes brasileiras, sem juntar números de fontes diferentes.
 */

export type IndicadorJmp = {
  id: string;
  rotulo: string;
  servico: "agua" | "esgoto";
  campo: "gerenciada" | "basica" | "ruim";
  /** Em "ruim" (defecação a céu aberto), valor menor é melhor; nos demais, maior. */
  melhorQuando: "maior" | "menor";
};

export const INDICADORES_JMP: IndicadorJmp[] = [
  { id: "agua-gerenciada", rotulo: "Água gerenciada com segurança", servico: "agua", campo: "gerenciada", melhorQuando: "maior" },
  { id: "agua-basica", rotulo: "Água, pelo menos básica", servico: "agua", campo: "basica", melhorQuando: "maior" },
  { id: "esgoto-gerenciado", rotulo: "Esgotamento gerenciado com segurança", servico: "esgoto", campo: "gerenciada", melhorQuando: "maior" },
  { id: "esgoto-basico", rotulo: "Esgotamento, pelo menos básico", servico: "esgoto", campo: "basica", melhorQuando: "maior" },
  { id: "ceu-aberto", rotulo: "Defecação a céu aberto", servico: "esgoto", campo: "ruim", melhorQuando: "menor" },
];

export function indicadorJmp(id: string): IndicadorJmp {
  const i = INDICADORES_JMP.find((x) => x.id === id);
  if (!i) throw new Error(`indicador do JMP desconhecido: ${id}`);
  return i;
}

/** Valor do indicador para o total da população (urbana e rural somadas), como o JMP publica. */
export function valorJmp(p: EstimativaJmp, ind: IndicadorJmp): number | null {
  return p[ind.servico]?.t[ind.campo] ?? null;
}

/** Comparação ao décimo de ponto percentual: diferenças de ponto flutuante abaixo disso não separam países. */
export const decimo = (v: number): number => Math.round(v * 10) / 10;

export type Posicao = { comEstimativa: number; melhores: number; iguais: number; piores: number };

/** Quantas áreas com estimativa estão melhor, igual ou pior que o valor dado, ao décimo de ponto. A própria área do valor conta como igual. */
export function posicao(paises: PaisJmp[], ind: IndicadorJmp, valor: number): Posicao {
  const v = decimo(valor);
  const r: Posicao = { comEstimativa: 0, melhores: 0, iguais: 0, piores: 0 };
  for (const p of paises) {
    const x = valorJmp(p, ind);
    if (x == null) continue;
    r.comEstimativa += 1;
    const d = decimo(x);
    if (d === v) r.iguais += 1;
    else if ((ind.melhorQuando === "maior") === d > v) r.melhores += 1;
    else r.piores += 1;
  }
  return r;
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const s = [...valores].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const REGIAO_ODS_PT: Record<string, string> = {
  "Europe and Northern America": "Europa e América do Norte",
  "Sub-Saharan Africa": "África Subsaariana",
  "Latin America and the Caribbean": "América Latina e Caribe",
  "Northern Africa and Western Asia": "África do Norte e Ásia Ocidental",
  Oceania: "Oceania",
  "Eastern and South-Eastern Asia": "Ásia Oriental e Sudeste Asiático",
  "Central and Southern Asia": "Ásia Central e do Sul",
  "Australia and New Zealand": "Austrália e Nova Zelândia",
};

export const RENDA_PT: Record<string, string> = {
  "High income": "Alta renda",
  "Upper middle income": "Renda média alta",
  "Lower middle income": "Renda média baixa",
  "Low income": "Baixa renda",
};

export type GrupoJmp = { id: string; rotulo: string; membros: PaisJmp[] };

/** Grupos de comparação a partir das próprias classificações do JMP, sem lista política escolhida aqui. */
export function grupos(paises: PaisJmp[]): GrupoJmp[] {
  return [
    { id: "mundo", rotulo: "Todos os países e áreas", membros: paises },
    { id: "regiao", rotulo: "América Latina e Caribe", membros: paises.filter((p) => p.regiao_ods === "Latin America and the Caribbean") },
    { id: "renda", rotulo: "Renda média alta", membros: paises.filter((p) => p.renda === "Upper middle income") },
  ];
}

/** Mediana dos países do grupo com estimativa, sem ponderar pela população (o JMP não publica o agregado por grupo neste arquivo). */
export function medianaDoGrupo(g: GrupoJmp, ind: IndicadorJmp): { valor: number | null; n: number } {
  const v = g.membros.map((p) => valorJmp(p, ind)).filter((x): x is number => x != null);
  return { valor: mediana(v), n: v.length };
}

export type LinhaConciliacao = {
  id: string;
  rotulo: string;
  jmp: { rotulo: string; valor: number | null };
  censo: { rotulo: string; valor: number | null };
  sinisa: { rotulo: string; valor: number | null } | null;
  /** JMP menos Censo, em pontos percentuais. */
  diferenca: number | null;
  nota: string;
};

const pct = (n: number | null | undefined, d: number | null | undefined): number | null => (n == null || d == null || d === 0 ? null : (n / d) * 100);

/**
 * Mesmo ano (2022) e perguntas parecidas, lado a lado: o JMP de 2022 contra o Censo 2022 (moradores em domicílios particulares permanentes
 * ocupados) e, quando há equivalente, o SINISA 2024. Nenhuma linha é tratada como a mesma medida; a nota diz o que muda.
 */
export function conciliacao(br: Agregado, jmp2022: EstimativaJmp): LinhaConciliacao[] {
  const c = br.censo2022.moradores;
  if (!c) return [];
  const ag = c.agua;
  const es = c.esgoto;
  const ind = br.sinisa;
  const dif = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
  const soma = (...v: (number | null)[]) => (v.some((x) => x == null) ? null : (v as number[]).reduce((a, x) => a + x, 0));
  const aguaRede = pct(soma(ag.rede, ag.lig_outra), ag.total);
  const esgBasico = pct(soma(es.rede, es.septica), es.total);
  const esgRede = pct(es.rede, es.total);
  const ceu = pct(es.sem_banheiro, es.total);
  const jA = jmp2022.agua?.t;
  const jE = jmp2022.esgoto?.t;
  return [
    {
      id: "agua-rede",
      rotulo: "Água",
      jmp: { rotulo: "Pelo menos básica", valor: jA?.basica ?? null },
      censo: { rotulo: "Ligação à rede geral", valor: aguaRede },
      sinisa: { rotulo: "Atendimento total com rede (IAG0001, 2024)", valor: ind.agua.indicadores.IAG0001 ?? null },
      diferenca: dif(jA?.basica ?? null, aguaRede),
      nota: "O JMP separa como não melhoradas só o poço ou a nascente desprotegidos e como superficial a água de rio, represa, lago ou canal; as demais fontes contam como melhoradas, e o degrau básico exige coleta de até 30 minutos. O Censo mede a ligação à rede geral e a fonte principal, sem separar proteção nem tempo de coleta.",
    },
    {
      id: "esgoto-basico",
      rotulo: "Esgotamento",
      jmp: { rotulo: "Pelo menos básico", valor: jE?.basica ?? null },
      censo: { rotulo: "Rede ou fossa séptica", valor: esgBasico },
      sinisa: null,
      diferenca: dif(jE?.basica ?? null, esgBasico),
      nota: "O JMP considera melhoradas as instalações não compartilhadas, inclusive fossas com laje; o Censo separa apenas fossa séptica de fossa rudimentar, sem informar laje nem compartilhamento. Por isso rede ou fossa séptica no Censo não é o mesmo conjunto que pelo menos básico no JMP.",
    },
    {
      id: "esgoto-rede",
      rotulo: "Esgotamento",
      jmp: { rotulo: "Ligação à rede de esgoto", valor: jE?.rede ?? null },
      censo: { rotulo: "Rede geral, pluvial ou fossa ligada à rede", valor: esgRede },
      sinisa: { rotulo: "Atendimento total com rede (IES0001, 2024)", valor: ind.esgoto.indicadores.IES0001 ?? null },
      diferenca: dif(jE?.rede ?? null, esgRede),
      nota: "São três perguntas: a ligação que o domicílio declara no Censo, a população que o prestador diz atender no SINISA e a estimativa modelada do JMP. O JMP lista PNAD, Censo, SINISA e SISAGUA entre as fontes de 2022 do Brasil; este arquivo não separa o que cada uma pesa.",
    },
    {
      id: "ceu-aberto",
      rotulo: "Sem banheiro",
      jmp: { rotulo: "Defecação a céu aberto", valor: jE?.ruim ?? null },
      censo: { rotulo: "Moradores sem banheiro nem sanitário", valor: ceu },
      sinisa: null,
      diferenca: dif(jE?.ruim ?? null, ceu),
      nota: "Quem não tem banheiro em casa pode usar a instalação de outro domicílio, que o JMP classifica como serviço limitado ou melhorado e não como céu aberto. Como o JMP trata essa categoria no Brasil não foi verificado.",
    },
  ];
}

/** Tradução livre das definições do JMP (aba Ladders do arquivo do país); o texto oficial está em inglês. */
export const DEFINICOES_JMP: { servico: "Água" | "Esgotamento"; degrau: string; definicao: string }[] = [
  { servico: "Água", degrau: "Gerenciada com segurança", definicao: "Água de fonte melhorada, acessível no domicílio, disponível quando necessária e livre de contaminação fecal e química prioritária." },
  { servico: "Água", degrau: "Pelo menos básica", definicao: "Água de fonte melhorada, com coleta de até 30 minutos na ida e volta, incluindo fila. Inclui quem tem serviço gerenciado com segurança." },
  { servico: "Água", degrau: "Limitada", definicao: "Água de fonte melhorada com coleta acima de 30 minutos na ida e volta, incluindo fila." },
  { servico: "Água", degrau: "Não melhorada", definicao: "Água de poço escavado ou de nascente sem proteção." },
  { servico: "Água", degrau: "Superficial", definicao: "Água tirada direto de rio, represa, lago, açude, riacho, canal ou canal de irrigação." },
  { servico: "Esgotamento", degrau: "Gerenciado com segurança", definicao: "Uso de instalação melhorada, não compartilhada com outros domicílios, com os dejetos descartados com segurança no local ou retirados e tratados fora dele." },
  { servico: "Esgotamento", degrau: "Pelo menos básico", definicao: "Uso de instalação melhorada não compartilhada com outros domicílios. Inclui quem tem serviço gerenciado com segurança." },
  { servico: "Esgotamento", degrau: "Limitado", definicao: "Uso de instalação melhorada compartilhada com outros domicílios." },
  { servico: "Esgotamento", degrau: "Não melhorado", definicao: "Uso de fossa sem laje ou plataforma, latrina suspensa ou latrina de balde." },
  { servico: "Esgotamento", degrau: "Defecação a céu aberto", definicao: "Descarte de fezes em campos, matas, arbustos, corpos d'água abertos, praias ou outros lugares abertos, ou junto com o lixo." },
];

/** Siglas das fontes que o JMP lista para o Brasil na aba Data Summary. */
export const FONTE_BRASIL_ROTULO: Record<string, string> = {
  CEN: "Censo Demográfico",
  PNAD: "PNAD",
  PNDS: "Pesquisa Nacional de Demografia e Saúde",
  DHS: "Demographic and Health Survey",
  POF: "Pesquisa de Orçamentos Familiares",
  LSMS: "Living Standards Measurement Study",
  WHS: "World Health Survey",
  PNSB: "Pesquisa Nacional de Saneamento Básico",
  SNIS: "SNIS (hoje SINISA)",
  SISAGUA: "SISAGUA",
  ANA: "ANA",
};

/** Fontes do Brasil por sigla, da mais frequente à menos, com os anos em ordem. */
export function fontesDoBrasil(fontes: { codigo: string; ano: number; sigla: string }[]): { sigla: string; rotulo: string; n: number; anos: number[] }[] {
  const por = new Map<string, number[]>();
  for (const f of fontes) por.set(f.sigla, [...(por.get(f.sigla) ?? []), f.ano]);
  return [...por.entries()]
    .map(([sigla, anos]) => ({ sigla, rotulo: FONTE_BRASIL_ROTULO[sigla] ?? sigla, n: anos.length, anos: anos.sort((a, b) => a - b) }))
    .sort((a, b) => b.n - a.n || a.sigla.localeCompare(b.sigla));
}
