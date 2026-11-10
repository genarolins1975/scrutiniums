/**
 * Regras puras do recorte municipal do painel "Consignado e aposentados" (Observatório das Famílias), usadas pelo servidor (resumo do
 * recorte padrão no HTML) e pelo explorador no navegador (recorte escolhido pelo leitor). São as mesmas contas da vista antiga
 * (public/obs/app.js, renderConsignado): nenhuma medida é criada aqui, só filtro, ordem e contagem sobre a gold
 * public/obs/data/gold/consignado_mun.json. Sem acesso a arquivo: pode ser importado por componente de cliente.
 */
import type { Natureza } from "@/lib/painel/tipos";

export type Confiabilidade = "alta" | "media" | "baixa" | "sem_dado";

/** Linha da gold municipal; só os campos que a página mostra. Ausência é null, nunca zero. */
export type Municipio = {
  c: string;
  n: string;
  uf: string;
  reg: string;
  sel: Confiabilidade;
  incoerente?: boolean;
  sat: "baixa_penetracao" | "penetracao_elevada" | "possivel_saturacao" | null;
} & Record<
  | "pop" | "a60" | "a65" | "a80" | "p60" | "p65" | "p80" | "imed" | "env" | "ben" | "apo" | "pen" | "ass" | "prural" | "pass" | "vdez" | "v_hab"
  | "v_idoso" | "ben100_60" | "peso" | "outras" | "cons" | "cons_lo" | "cons_hi" | "cons_ben" | "servico" | "rec" | "rec_100k60"
  | "vulnerabilidade" | "exposicao" | "perfil_beneficio" | "indice",
  number | null
>;

export type IdCamada = "p60" | "env" | "ben100_60" | "v_hab" | "peso" | "prural" | "pass" | "cons_ben" | "indice";

export type Camada = {
  rotulo: string;
  /** Unidade por extenso, para legenda de tabela e arquivo. */
  unidade: string;
  /** Fria para envelhecimento e Previdência; quente para exposição estimada ao consignado. Envelhecer não é risco. */
  paleta: "fria" | "quente";
  natureza: Natureza;
  casas: number;
  prefixo?: string;
  sufixo?: string;
  /** Ressalva material que acompanha a medida na tabela e no arquivo. */
  ressalva?: string;
};

export const CAMADAS: Record<IdCamada, Camada> = {
  p60: { rotulo: "População com 60 anos ou mais", unidade: "% da população", paleta: "fria", natureza: "OBSERVADO", casas: 1, sufixo: "%" },
  env: { rotulo: "Índice de envelhecimento", unidade: "pessoas de 60 anos ou mais por 100 pessoas de 0 a 14 anos", paleta: "fria", natureza: "CALCULADO", casas: 0 },
  ben100_60: { rotulo: "Benefícios por 100 pessoas com 60 anos ou mais", unidade: "benefícios por 100 pessoas de 60 anos ou mais", paleta: "fria", natureza: "CALCULADO", casas: 0 },
  v_hab: { rotulo: "Valor líquido por habitante", unidade: "R$ por habitante no mês", paleta: "fria", natureza: "CALCULADO", casas: 0, prefixo: "R$ " },
  peso: { rotulo: "Benefícios líquidos sobre a renda domiciliar", unidade: "% da renda domiciliar", paleta: "fria", natureza: "CALCULADO", casas: 1, sufixo: "%" },
  prural: { rotulo: "Participação da clientela rural", unidade: "% dos benefícios", paleta: "fria", natureza: "OBSERVADO", casas: 1, sufixo: "%" },
  pass: { rotulo: "Participação de benefícios assistenciais", unidade: "% dos benefícios", paleta: "fria", natureza: "CALCULADO", casas: 1, sufixo: "%" },
  cons_ben: {
    rotulo: "Exposição estimada por benefício", unidade: "R$ por benefício elegível", paleta: "quente", natureza: "ESTIMADO", casas: 0, prefixo: "R$ ",
    ressalva: "Saldo estadual repartido por aposentadorias e pensões; não é carteira municipal observada.",
  },
  indice: {
    rotulo: "Índice de sensibilidade", unidade: "pontos, de 0 a 100", paleta: "quente", natureza: "ESTIMADO", casas: 0,
    ressalva: "Combina exposição municipal alocada e cenário aritmético de 84 meses. Mede sensibilidade do contexto, não conduta.",
  },
};

export const IDS_CAMADAS = Object.keys(CAMADAS) as IdCamada[];
export const REGIOES = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"] as const;
export type Recorte = { regiao: string; conf: "exclui_baixa" | "todas" };
export const RECORTE_PADRAO: Recorte = { regiao: "todas", conf: "exclui_baixa" };

export const ROTULO_SATURACAO: Record<NonNullable<Municipio["sat"]>, string> = {
  baixa_penetracao: "Baixa penetração",
  penetracao_elevada: "Penetração elevada",
  possivel_saturacao: "Possível saturação",
};
export const ROTULO_CONFIABILIDADE: Record<Confiabilidade, string> = { alta: "alta", media: "média", baixa: "baixa", sem_dado: "sem dado" };

export const FAIXAS_DEPENDENCIA: readonly (readonly [string, number, number])[] = [
  ["menos de 20%", 0, 20],
  ["de 20% a 35%", 20, 35],
  ["de 35% a 50%", 35, 50],
  ["mais de 50%", 50, Infinity],
];

export const AUSENTE = "sem dado";
export const n = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
/** R$ com a escala no texto (tri, bi, mi), como a vista antiga escrevia. */
export function moeda(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  if (v >= 1e12) return `R$ ${n(v / 1e12, 2)} tri`;
  if (v >= 1e9) return `R$ ${n(v / 1e9, 1)} bi`;
  if (v >= 1e6) return `R$ ${n(v / 1e6, 1)} mi`;
  return `R$ ${n(v, 0)}`;
}
export function valorDaCamada(m: Pick<Municipio, IdCamada>, cam: IdCamada): string {
  const v = m[cam];
  const c = CAMADAS[cam];
  return v === null || v === undefined ? AUSENTE : `${c.prefixo ?? ""}${n(v, c.casas)}${c.sufixo ?? ""}`;
}

export const noRecorte = (m: Municipio, r: Recorte) => (r.regiao === "todas" || m.reg === r.regiao) && (r.conf === "todas" || m.sel !== "baixa");

/** Os 25 maiores valores da camada no recorte, sem os municípios sem a medida. */
export function maioresDaCamada(base: readonly Municipio[], cam: IdCamada, quantos = 25): Municipio[] {
  return base.filter((m) => m[cam] !== null && m[cam] !== undefined).sort((a, b) => (b[cam] as number) - (a[cam] as number)).slice(0, quantos);
}

/** Municípios do recorte por faixa do peso dos benefícios na renda domiciliar. */
export function faixasDependencia(base: readonly Municipio[]): { rotulo: string; n: number }[] {
  return FAIXAS_DEPENDENCIA.map(([rotulo, lo, hi]) => ({ rotulo, n: base.filter((m) => m.peso !== null && m.peso !== undefined && m.peso >= lo && m.peso < hi).length }));
}

/** Os 15 maiores índices de sensibilidade entre municípios de 20 mil habitantes ou mais, sem confiabilidade baixa. */
export function maioresSensibilidade(base: readonly Municipio[]): Municipio[] {
  return base.filter((m) => m.indice !== null && m.indice !== undefined && m.sel !== "baixa" && (m.pop ?? 0) >= 20000).sort((a, b) => (b.indice as number) - (a.indice as number)).slice(0, 15);
}

export const COLUNAS_SENSIBILIDADE = ["Município", "UF", "Vulnerabilidade", "Exposição", "Perfil do benefício", "Índice"];
export const linhaSensibilidade = (m: Municipio): (string | number | null)[] => [m.n, m.uf, m.vulnerabilidade, m.exposicao, m.perfil_beneficio, m.indice];

/** Referências de fonte de cada camada, como a legenda da tabela e o arquivo as citam. */
export function fontesDaCamada(cam: IdCamada, ctx: { ano: number; scr: string }): string {
  const censo = "IBGE, Censo 2022";
  const mps = `MPS, dezembro de ${ctx.ano}`;
  const scr = `Banco Central, SCR ${ctx.scr}`;
  if (cam === "p60" || cam === "env") return censo;
  if (cam === "prural" || cam === "pass") return mps;
  if (cam === "cons_ben") return `${mps}; ${scr}`;
  return `${mps}; ${censo}${cam === "indice" ? `; ${scr}` : ""}${cam === "peso" || cam === "indice" ? "; IPCA, preços de julho de 2022" : ""}`;
}

/** Percentis 5 e 95 dos valores presentes: a cor satura neles; tabela e arquivo trazem o valor sem limite. */
export function limitesDaEscala(base: readonly Municipio[], cam: IdCamada): { lo: number; hi: number } | null {
  const v = base.map((m) => m[cam]).filter((x): x is number => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p: number) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
  return { lo: q(0.05), hi: q(0.95) };
}

/** Cor do município: mistura do token da paleta com a superfície, proporcional à posição entre os percentis 5 e 95. */
export function corDaEscala(v: number | null | undefined, lim: { lo: number; hi: number } | null, paleta: Camada["paleta"]): string {
  if (v === null || v === undefined || !lim) return "var(--mapa-nao-se-aplica)";
  const t = Math.max(0, Math.min(1, (v - lim.lo) / Math.max(lim.hi - lim.lo, 1e-9)));
  return `color-mix(in srgb, var(--cor-${paleta === "quente" ? "bronze" : "energia"}) ${Math.round(6 + 82 * t)}%, var(--cor-superficie))`;
}

/** Linhas do perfil municipal: indicador, valor escrito e natureza do dado. */
export function linhasDoPerfil(m: Municipio): { indicador: string; valor: string; natureza: string }[] {
  const num = (v: number | null, casas = 0, pre = "", suf = "") => (v === null || v === undefined ? AUSENTE : `${pre}${n(v, casas)}${suf}`);
  const comParte = (a: number | null, p: number | null) => (a === null || a === undefined ? AUSENTE : `${n(a)} (${num(p, 1, "", "%")})`);
  const l = (indicador: string, valor: string, natureza: string) => ({ indicador, valor, natureza });
  return [
    l("População total", num(m.pop), "observado"),
    l("60 anos ou mais", comParte(m.a60, m.p60), "observado"),
    l("65 anos ou mais", comParte(m.a65, m.p65), "observado"),
    l("80 anos ou mais", comParte(m.a80, m.p80), "observado"),
    l("Idade mediana", num(m.imed, 1, "", " anos"), "calculado"),
    l("Índice de envelhecimento", num(m.env, 1), "calculado"),
    l("Benefícios emitidos", num(m.ben), "observado"),
    l("Aposentadorias", num(m.apo), "observado"),
    l("Pensões por morte", num(m.pen), "observado"),
    l("Assistenciais e legislação específica", num(m.ass), "observado"),
    l("Clientela rural", num(m.prural, 1, "", "%"), "observado"),
    l("Valor líquido mensal", moeda(m.vdez), "observado"),
    l("Valor por habitante", num(m.v_hab, 0, "R$ "), "calculado"),
    l("Valor por pessoa com 60 anos ou mais", num(m.v_idoso, 0, "R$ "), "calculado"),
    l("Benefícios por 100 pessoas com 60 anos ou mais", num(m.ben100_60, 1), "calculado"),
    l("Peso na renda domiciliar", num(m.peso, 1, "", "%"), "calculado"),
    l("Teto do Censo para rendas que não vêm do trabalho", num(m.outras, 1, "", "%"), "observado"),
    l("Exposição estimada ao consignado", moeda(m.cons), "estimado"),
    l("Faixa da estimativa", m.cons_lo === null || m.cons_lo === undefined ? AUSENTE : `${moeda(m.cons_lo)} a ${moeda(m.cons_hi)}`, "estimado"),
    l("Exposição por benefício elegível", num(m.cons_ben, 0, "R$ "), "estimado"),
    l("Serviço da dívida", num(m.servico, 1, "", "%"), "cenário"),
    l("Saturação", m.sat ? ROTULO_SATURACAO[m.sat] : "não classificado", "estimado"),
    l("Reclamações no período", num(m.rec), "observado"),
    l("Reclamações por 100 mil pessoas com 60 anos ou mais", num(m.rec_100k60, 1), "calculado"),
  ];
}
