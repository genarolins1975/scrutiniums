/**
 * Leitura da gold do Emprego formal (public/obs/data/gold/emprego.json, Novo Caged republicado pelo Banco Central e pelo Ipeadata)
 * para o painel /emprego-formal do Observatório das Famílias. Só servidor. Nenhum valor é calculado aqui: estoque, saldos, variação
 * em 12 meses, desvio da própria história, retenção e posições são os da gold; ausência continua null, nunca zero.
 */
import { lerPublico, mesAno } from "@/lib/perguntas/leitura";
import { provenienciaMontada } from "@/lib/painel/proveniencia-montada";
import type { Natureza, Proveniencia } from "@/lib/painel/tipos";

export const ROTA_EMPREGO = "/emprego-formal";
export const TITULO_EMPREGO = "Emprego formal";
export const PERGUNTA_EMPREGO = "Como anda o emprego formal por setor e por estado?";
export const DESCRICAO_EMPREGO =
  "Vínculos formais por seção de atividade e saldo de admissões e desligamentos por estado, do Novo Caged, cada um comparado com a própria história, com fonte, período e ressalva em cada número.";
/** Endereço da vista antiga, na aplicação do Crédito. */
export const ROTA_ANTIGA_EMPREGO = "/observatorio/formal-employment";

export type PontoMes = { ref: string; v: number | null };

export type Setor = {
  key: string;
  nome: string;
  cnae: string;
  agregado: boolean;
  mes: string;
  estoque: number | null;
  share_pct: number | null;
  saldo_mes: number | null;
  saldo_mes_sa: number | null;
  saldo_12m: number | null;
  saldo_12m_anterior: number | null;
  yoy_pct: number | null;
  z: number | null;
  faixa: string | null;
  yoy_media_janela: number | null;
  yoy_dp_janela: number | null;
  n_obs_z: number | null;
  serie_yoy: PontoMes[];
  serie_saldo: PontoMes[];
};

export type Uf = {
  uf: string;
  nome: string;
  regiao: string;
  mes: string;
  admissoes_mes: number | null;
  desligamentos_mes: number | null;
  saldo_mes: number | null;
  admissoes_12m: number | null;
  desligamentos_12m: number | null;
  saldo_12m: number | null;
  saldo_12m_anterior: number | null;
  retencao_pct: number | null;
  serie_saldo: PontoMes[];
  posicoes: Record<string, number | null>;
};

export type FonteGold = { nome: string; url: string; catalogo: string; licenca: string; nivel: string };

export type DadosEmprego = {
  mes: string;
  mesPreliminar: boolean;
  janelaZ: { inicio: string; min_obs: number };
  fontes: { sgs: FonteGold; ipea: FonteGold };
  brasil: Record<string, number | null>;
  serie: { ref: string; estoque: number | null; saldo: number | null; saldo_sa: number | null; yoy_pct: number | null }[];
  setores: Setor[];
  total: Setor;
  secoes: Setor[];
  ufs: Uf[];
  ufsMes: string;
  ufsNaoIdentificado: { mes: string; admissoes: number | null; desligamentos: number | null } | null;
  reconciliacao: { mes: string; saldo_sgs: number | null; saldo_ipea: number | null; diferenca: number | null } | null;
  sintese: string;
  metodo: string;
  limitacoes: string;
  cautelas: string[];
  catalogo: { nome: string; definicao: string; unidade: string; fonte: string; limitacoes: string }[];
};

/**
 * Texto que vem da gold, na forma da página: mês e data no padrão brasileiro, travessão trocado por vírgula, sinal de menos
 * tipográfico e as abreviações do painel antigo por extenso. Nenhum número muda.
 */
export function textoDaGold(t: string): string {
  return t
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, a, m, d) => `${d}/${m}/${a}`)
    .replace(/\b((?:19|20)\d{2})-(0[1-9]|1[0-2])\b/g, (_, a, m) => mesAno(`${a}-${m}`))
    .replace(/\s+[—–]\s+/g, ", ")
    .replace(/(^|[\s(])-(\d)/g, "$1−$2")
    .replace(/\ba\/a\b/g, "em 12 meses")
    .replace(/\(z (−?\d)/g, "(desvio $1")
    .replace(/\bz-scores?\b/gi, "desvio da própria história")
    .replace(/^Desvio da própria história$/i, "Distância da média da própria história")
    .replace(/'([^']+)'/g, "“$1”");
}

/* eslint-disable @typescript-eslint/no-explicit-any -- leitura de gold JSON sem tipos gerados */
export function dadosEmprego(): DadosEmprego | { indisponivel: string } {
  const g = lerPublico("obs", "data", "gold", "emprego.json");
  if (!g?.disponivel) return { indisponivel: String(g?.motivo ?? g?.error ?? "A publicação do emprego formal não está disponível nesta versão.") };
  const setores: Setor[] = (g.setores as any[]).map((s) => ({ ...s, agregado: Boolean(s.agregado), serie_yoy: s.serie_yoy ?? [], serie_saldo: s.serie_saldo ?? [] }));
  const total = setores.find((s) => s.key === "total");
  if (!total) throw new Error("emprego.json sem o setor total");
  return {
    mes: String(g.mes),
    mesPreliminar: Boolean(g.mes_preliminar),
    janelaZ: g.janela_z,
    fontes: g.fontes,
    brasil: g.brasil ?? {},
    serie: g.serie ?? [],
    setores,
    total,
    secoes: setores.filter((s) => s.key !== "total"),
    ufs: (g.ufs as any[]).map((u) => ({ ...u, serie_saldo: u.serie_saldo ?? [], posicoes: u.posicoes ?? {} })),
    ufsMes: String(g.ufs_mes ?? g.mes),
    ufsNaoIdentificado: g.ufs_nao_identificado ?? null,
    reconciliacao: g.reconciliacao ?? null,
    sintese: String(g.sintese ?? ""),
    metodo: String(g.metodo ?? ""),
    limitacoes: String(g.limitacoes ?? ""),
    cautelas: g.cautelas ?? [],
    catalogo: g.catalogo ?? [],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const LIMITES = [
  "O último mês é preliminar e é revisado pelas declarações entregues fora do prazo.",
  "Emprego formal celetista: não cobre servidores estatutários, trabalhadores informais nem microempreendedores individuais.",
  "Mede quantidade de vínculos, não a massa de salários.",
];

/** Proveniência de uma figura do painel: a régua do Banco Central (estoque por seção) ou a do Ipeadata (admissões e desligamentos por UF). */
export function provEmprego(
  d: DadosEmprego,
  regua: "sgs" | "ipea",
  o: { indicador: string; natureza: Natureza; unidade: string; inicio: string; fim: string; formula?: string | null; transformacoes?: string[] },
): Proveniencia {
  const f = d.fontes[regua];
  return provenienciaMontada({
    indicador: o.indicador,
    natureza: o.natureza,
    orgao: "Ministério do Trabalho e Emprego, Novo Caged",
    dataset: regua === "sgs" ? "estoque de empregos formais por seção de atividade, republicado pelo Banco Central (SGS 28763 a 28804)" : "admissões e desligamentos por UF, republicados pelo Ipeadata (séries ADMISNC e DESLIGNC)",
    url: f.catalogo,
    urlPrimaria: f.url,
    licenca: f.licenca,
    unidade: o.unidade,
    frequencia: "mensal",
    inicio: o.inicio,
    fim: o.fim,
    capturadoEm: null,
    transformacoes: o.transformacoes ?? [],
    formula: o.formula ?? null,
    limitacoes: [...LIMITES, "A gold do emprego formal não registra a data de captura nem o hash do arquivo original."],
    versaoPipeline: "pipeline do Observatório de Crédito (emprego.json)",
    notas: textoDaGold(f.nivel),
  });
}
