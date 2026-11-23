/**
 * Arquivos CSV da coleção Varejo, servidos por rotas com conta (src/app/varejo/*.csv). Separador ';', ponto decimal, ausência
 * como campo vazio (nunca zero), BOM para o Excel abrir com acentos. Cada linha leva a fonte e a data de captura.
 */
import { goldSetor } from "./dados";
import { UFS } from "./paginas";
import type { BlocoPmc, GoldSetor, Indicador, Universo, VariavelPmc } from "./tipos";

const celula = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const linha = (campos: unknown[]) => campos.map(celula).join(";");
const arquivo = (linhas: string[]) => "﻿" + linhas.join("\n") + "\n";

const VARS: VariavelPmc[] = ["indice", "indice_sa", "mm", "aa", "ano", "m12"];
const INDS: Indicador[] = ["volume", "receita"];
const CAB_VARS = INDS.flatMap((i) => [`${i}_indice_2022_100`, `${i}_indice_ajuste_sazonal`, `${i}_var_mes_anterior_ajuste_sazonal_pct`, `${i}_var_mesmo_mes_ano_anterior_pct`, `${i}_var_acumulada_no_ano_pct`, `${i}_var_acumulada_12_meses_pct`]);
const colunas = (b: BlocoPmc | undefined, i: number) => INDS.flatMap((ind) => VARS.map((k) => b?.[ind]?.[k]?.[i] ?? null));

export function csvSerieBrasil(g: GoldSetor = goldSetor()): string {
  const linhas = [linha(["mes", "universo", ...CAB_VARS, "fonte", "capturado_em"])];
  for (const universo of ["restrito", "ampliado"] as Universo[]) {
    const f = g.fontes[universo === "restrito" ? "pmc_restrito" : "pmc_ampliado"];
    g.pmc.meses.forEach((mes, i) => linhas.push(linha([mes, universo, ...colunas(g.pmc.brasil[universo], i), `${f.orgao}, ${f.tabela}`, f.capturado_em])));
  }
  return arquivo(linhas);
}

export function csvAtividades(g: GoldSetor = goldSetor()): string {
  const f = g.fontes.pmc_atividades;
  const linhas = [linha(["mes", "atividade", "nome", "universo", "parte_de", ...CAB_VARS, "peso_ou_contribuicao", "fonte", "capturado_em"])];
  for (const [slug, a] of Object.entries(g.pmc.atividades)) {
    g.pmc.meses.forEach((mes, i) => linhas.push(linha([mes, slug, a.nome, a.universo, a.parte_de, ...colunas(a, i), "não publicado no SIDRA", `${f.orgao}, ${f.tabela}`, f.capturado_em])));
  }
  return arquivo(linhas);
}

export function csvUfs(g: GoldSetor = goldSetor()): string {
  const pac = ["empresas", "unidades_locais", "receita_bruta_revenda", "margem_comercializacao", "pessoal_ocupado", "salarios"] as const;
  const linhas = [linha(["mes", "uf", "nome", "universo", ...CAB_VARS, ...pac.map((c) => `pac_${g.pac.ano}_${c}${c === "empresas" || c === "unidades_locais" || c === "pessoal_ocupado" ? "" : "_mil_reais"}`), "fonte", "capturado_em"])];
  const ult = g.pmc.meses.length - 1;
  for (const [uf, b] of Object.entries(g.pmc.ufs)) {
    for (const universo of ["restrito", "ampliado"] as Universo[]) {
      const f = g.fontes[universo === "restrito" ? "pmc_restrito" : "pmc_ampliado"];
      g.pmc.meses.forEach((mes, i) =>
        // a PAC é anual: vai só na linha do último mês de cada estado, para não parecer série mensal
        linhas.push(linha([mes, uf, UFS[uf]?.nome ?? uf, universo, ...colunas(b[universo], i), ...pac.map((c) => (i === ult && universo === "restrito" ? g.pac.ufs_varejo[uf]?.[c] ?? null : null)), `${f.orgao}, ${f.tabela}${i === ult && universo === "restrito" ? `; ${g.fontes.pac_uf.tabela}` : ""}`, f.capturado_em])),
      );
    }
  }
  return arquivo(linhas);
}
