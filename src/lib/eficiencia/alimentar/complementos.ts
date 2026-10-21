/**
 * Bases complementares de Segurança alimentar (integração de 21/10/2026): EBIA por estado,
 * CadINSAN, PAA, PNAE, IPCA dos alimentos e acompanhamento nutricional do SISVAN.
 *
 * A gold `complementos.json` é escrita por `python3 -m pipeline.eficiencia_alimentar.complementos`
 * a partir do seed com hash fixado. A interface só lê, filtra e formata: nenhuma taxa, soma ou
 * média é calculada aqui. Ausência chega como `null` e é mostrada como ausência, nunca como zero.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type FonteComplementar = {
  id: string;
  nome: string;
  url: string;
  pagina: string;
  periodo: string;
  sha256?: string;
  sha256_bytes?: string;
  conteudo?: string;
};

export type FichaComplementar = {
  id: string;
  nome: string;
  grupo: string;
  capitulo: "necessidades" | "acesso" | "qualidade" | "recursos";
  fonte_id: string;
  definicao: string;
  universo: string;
  periodo: string;
  unidade: string;
  territorio: string;
  frequencia: string;
  formula: string;
  estado_do_dado: string;
  ausencias: string;
  limitacoes: string;
};

export type ClasseEbia = "segura" | "insegura" | "leve" | "moderada" | "grave" | "total";
export type ValorEbia = { pct: number | null; cv_pct: number | null; mil_domicilios: number | null; cv_domicilios: number | null };
export type LinhaEbia = {
  nivel: "brasil" | "regiao" | "uf";
  codigo: string;
  territorio: string;
  ano: number;
  situacao: "total" | "urbana" | "rural";
  classes: Record<ClasseEbia, ValorEbia>;
};

export type SomaCadinsan = { municipios: number; com_pbf: number; sem_pbf: number; cadastros: number; pct_com_pbf: number; pct_sem_pbf: number };
export type SomaPaa = {
  municipios_universo: number;
  fornecedores: { soma: number | null; municipios_com_dado: number };
  pagamentos: { soma: number | null; municipios_com_dado: number };
};
export type LinhaPnae = {
  ano: number;
  territorio: string;
  rede: "municipal" | "estadual" | "todas";
  entidades: number;
  entidades_com_repasse: number;
  alunos: number;
  escolas: number;
  repasse: number | null;
};
export type PontoIpca = { medida: "mensal" | "doze_meses"; categoria: CategoriaIpca; periodo: string; valor: number | null };
export type CategoriaIpca = "geral" | "alimentacao_bebidas" | "alimentacao_domicilio" | "alimentacao_fora";

export type Complementos = {
  versao: string;
  manifesto: { versao: string; capturado_em: string; origem: string; seed_sha256: string; fontes: FonteComplementar[] };
  fichas: FichaComplementar[];
  nao_integrados: { base: string; motivo: string }[];
  ufs: { sigla: string; codigo: string; nome: string; regiao: string }[];
  ebia: LinhaEbia[];
  cadinsan: { brasil: SomaCadinsan; ufs: Record<string, SomaCadinsan>; divergencias_cenario: number };
  paa: Record<string, { brasil: SomaPaa; ufs: Record<string, SomaPaa> }>;
  pnae: {
    registros: number;
    repasses_ausentes: number;
    municipios_conciliados_2025: number;
    nao_conciliados_2025: { uf: string; municipio: string; cnpj: string }[];
    linhas: LinhaPnae[];
  };
  ipca: PontoIpca[];
  sisvan: { fase: string; avaliados: number; cobertura: number }[];
};

/** Linha municipal do arquivo por UF, buscado no navegador (caminho com conta). */
export type MunicipioComplementar = {
  codigo: string;
  nome: string;
  /** [famílias em risco com PBF, sem PBF, famílias analisadas, % com PBF, % sem PBF] */
  cadinsan: [number, number, number, number, number] | null;
  /** por ano: [fornecedores, pagamentos em R$]; null no campo = sem dado no extrato */
  paa: Record<string, [number | null, number | null] | null>;
  /** rede municipal, 2025: [alunos, escolas, repasse em R$ ou null] */
  pnae2025: [number, number, number | null] | null;
};

let cache: Complementos | null = null;

export function dadosComplementares(): Complementos {
  if (!cache) cache = JSON.parse(readFileSync(join(process.cwd(), "public/eficiencia/seguranca-alimentar/complementos.json"), "utf8")) as Complementos;
  return cache;
}

export const BASE_COMPLEMENTOS = "/eficiencia/seguranca-alimentar";

export function fonte(c: Complementos, id: string): FonteComplementar {
  const f = c.manifesto.fontes.find((x) => x.id === id);
  if (!f) throw new Error(`Fonte não registrada: ${id}`);
  return f;
}

export function ficha(c: Complementos, id: string): FichaComplementar {
  const f = c.fichas.find((x) => x.id === id);
  if (!f) throw new Error(`Ficha não registrada: ${id}`);
  return f;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Competência AAAAMM da fonte em texto de leitor: "set/2026" ou "setembro de 2026". */
export function competencia(periodo: string, longo = false): string {
  const ano = periodo.slice(0, 4);
  const mes = Number(periodo.slice(4, 6)) - 1;
  return longo ? `${MESES_LONGOS[mes]} de ${ano}` : `${MESES[mes]}/${ano}`;
}

const nf = (casas: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const pct1 = (v: number) => `${nf(1).format(v)}%`;
export const int = (v: number) => nf(0).format(v);
export const dec = (v: number, casas = 1) => nf(casas).format(v);
export const reais = (v: number) => `R$ ${nf(2).format(v)}`;

/** Milhões com uma casa, para os números de escala: "2,4 milhões". */
export function milhoes(v: number): string {
  return `${nf(1).format(v / 1e6)} ${v >= 2e6 ? "milhões" : "milhão"}`;
}
