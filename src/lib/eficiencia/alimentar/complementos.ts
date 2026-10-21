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
  fontes_adicionais?: string[];
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

/** Classe da EBIA nos recortes sociais; na tabela de renda (9558) o IBGE publica moderada e grave juntas. */
export type ClasseSocial = "total" | "segura" | "insegura" | "leve" | "moderada" | "grave" | "moderada_grave";
export type ValorSocial = ValorEbia & { pct_no_grupo_calculado?: number | null };
export type LinhaSocial = { ano: number; grupo: string; situacao: "total" | "urbana" | "rural"; classes: Partial<Record<ClasseSocial, ValorSocial>> };
/**
 * Um recorte social nacional da EBIA (tabelas SIDRA 9553 a 9562). `orientacao` diz o que o percentual publicado
 * mede: "composicao", a parcela dos domicílios da classe que está no grupo (os grupos somam 100%); "distribuicao",
 * a parcela dos domicílios do grupo em cada classe (as classes somam 100%).
 */
export type RecorteSocial = {
  id: "sexo" | "cor_raca" | "instrucao" | "ocupacao" | "moradores" | "renda" | "menores_5" | "menores_18" | "idosos";
  tabela: string;
  fonte_id: string;
  dimensao: string;
  rotulo: string;
  orientacao: "composicao" | "distribuicao";
  particao: boolean;
  classes: ClasseSocial[];
  grupos: string[];
  situacao?: boolean;
  fora_da_particao?: string;
  universo_menor?: string;
  linhas: LinhaSocial[];
};
export type EbiaSocial = {
  versao: string;
  manifesto: { versao: string; capturado_em: string; origem: string; seed_sha256: string; fontes: (FonteComplementar & { territorio: string })[] };
  limiar_cv: number;
  tolerancias: { pct_por_parcela: number; mil_por_parcela: number };
  tabela_ausente: { tabela: string; motivo: string };
  recortes: RecorteSocial[];
  conferencias: { classes_mil: number; classes_pct: number; grupos_pct: number; grupos_mil: number; totais_9552: number };
  ausencias: { tabela: string; ano: number; grupo: string; situacao: string; classe: string; variavel: string }[];
  diferencas_9552: { tabela: string; ano: number; classe: string; mil_domicilios: number; mil_domicilios_9552: number }[];
};

export type Complementos = {
  versao: string;
  manifesto: { versao: string; capturado_em: string; origem: string; seed_sha256: string; fontes: FonteComplementar[] };
  fichas: FichaComplementar[];
  nao_integrados: { base: string; motivo: string }[];
  ufs: { sigla: string; codigo: string; nome: string; regiao: string }[];
  ebia: LinhaEbia[];
  ebia_social: EbiaSocial;
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

/** Todas as fontes da gold: as das bases complementares e as dos recortes sociais da EBIA, cada uma com seu manifesto. */
export function fontesComplementares(c: Complementos): FonteComplementar[] {
  return [...c.manifesto.fontes, ...c.ebia_social.manifesto.fontes];
}

export function fonte(c: Complementos, id: string): FonteComplementar {
  const f = fontesComplementares(c).find((x) => x.id === id);
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
