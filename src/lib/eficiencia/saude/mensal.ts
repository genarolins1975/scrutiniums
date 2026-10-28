/** Medidas mensais da resposta do Relatório APS; não são produção de atendimentos. */
export const MEDIDAS_MENSAIS = {
  cobertura_pct: { nome: "Cobertura potencial estimada", unidade: "% da população de referência", casas: 2 },
  capacidade_pessoas: { nome: "Capacidade potencial das equipes", unidade: "pessoas", casas: 0 },
  populacao_referencia: { nome: "População de referência do Ministério", unidade: "habitantes", casas: 0 },
  esf: { nome: "Equipes de Saúde da Família (eSF)", unidade: "equipes", casas: 0 },
  eap20: { nome: "Equipes de Atenção Primária, 20h (eAP)", unidade: "equipes", casas: 0 },
  eap30: { nome: "Equipes de Atenção Primária, 30h (eAP)", unidade: "equipes", casas: 0 },
  esfr: { nome: "Equipes de Saúde da Família ribeirinha (eSFR)", unidade: "equipes", casas: 0 },
  ecr: { nome: "Equipes de Consultório na Rua (eCR)", unidade: "equipes", casas: 0 },
  eapp20: { nome: "Equipes de Atenção Primária Prisional, 20h (eAPP)", unidade: "equipes", casas: 0 },
  eapp30: { nome: "Equipes de Atenção Primária Prisional, 30h (eAPP)", unidade: "equipes", casas: 0 },
  cadastros_equipes_especiais: { nome: "Cadastros vinculados a eCR, eSFR e eAPP", unidade: "pessoas cadastradas", casas: 0 },
} as const;
export type MedidaMensal = keyof typeof MEDIDAS_MENSAIS;
export type LinhaApsMensal = Record<MedidaMensal, number | null> & {
  codigo_ibge: number; competencia: string; origem_populacao: string | null;
  status: "OBSERVADO" | "INCOMPLETO" | "PROVISORIO"; metodo: "regra_anterior_2021" | "formula_atual";
};
export type ApsMensal = {
  versao: string; hash_dados: string; competencias: string[]; linhas: LinhaApsMensal[];
  fontes: Record<string, { capital: string; uf: string; url: string; capturado_em: string; sha256: string }>;
  cobertura: { competencia: string; capitais_com_registro: number; capitais_com_valor: number }[];
};
export const competenciaBr = (c: string) => `${c.slice(5, 7)}/${c.slice(0, 4)}`;

/** Preenche o calendário com ausência explícita; um mês faltante nunca desaparece entre dois observados. */
export function mesesDoAno(dados: ApsMensal, codigo: number, ano: string) {
  const porMes = new Map(dados.linhas.filter((r) => r.codigo_ibge === codigo).map((r) => [r.competencia, r]));
  const fim = dados.competencias.at(-1) ?? "";
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`)
    .filter((c) => c >= dados.competencias[0] && c <= fim)
    .map((competencia) => ({ competencia, linha: porMes.get(competencia) ?? null }));
}

/** O cliente recebe tuplas: evita repetir onze nomes de campo em cada um dos 1.742 registros. */
const CHAVES = Object.keys(MEDIDAS_MENSAIS) as MedidaMensal[];
export type ApsMensalCompacta = Omit<ApsMensal, "linhas" | "cobertura"> & {
  registros: [number, string, (number | null)[], string | null, LinhaApsMensal["status"], LinhaApsMensal["metodo"]][];
};
export function compactarApsMensal(d: ApsMensal): ApsMensalCompacta {
  return { versao: d.versao, hash_dados: d.hash_dados, competencias: d.competencias, fontes: d.fontes,
    registros: d.linhas.map((r) => [r.codigo_ibge, r.competencia, CHAVES.map((k) => r[k]), r.origem_populacao, r.status, r.metodo]) };
}
export function expandirApsMensal(d: ApsMensalCompacta): ApsMensal {
  return { ...d, cobertura: [], linhas: d.registros.map(([codigo_ibge, competencia, valores, origem_populacao, status, metodo]) => ({
    ...Object.fromEntries(CHAVES.map((k, i) => [k, valores[i]])) as Record<MedidaMensal, number | null>,
    codigo_ibge, competencia, origem_populacao, status, metodo,
  })) };
}
