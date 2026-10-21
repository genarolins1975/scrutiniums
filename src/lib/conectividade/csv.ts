/**
 * Arquivos CSV do painel Conectividade, servidos por rotas com conta (src/app/conectividade/*.csv). Separador ';',
 * ponto decimal, ausência como campo vazio (nunca zero), BOM para o Excel abrir com acentos.
 */
import { arquivoUf, goldConectividade, UF_DO_PREFIXO } from "./dados";
import type { Fixa, Movel, MunicipioGold } from "./tipos";

const celula = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const linha = (campos: unknown[]) => campos.map(celula).join(";");

function colunasFixa(f: Fixa | null) {
  return f
    ? [f.acessos, f.densidade, f.fibra_pct, f.coaxial_pct, f.metalico_pct, f.radio_pct, f.satelite_pct, f.vel_100_mais_pct, f.vel_25_100_pct, f.vel_10_25_pct, f.vel_ate_10_pct, f.pessoa_fisica_pct, f.prestadoras, f.maior_grupo, f.maior_grupo_pct]
    : Array(15).fill(null);
}
const CAB_FIXA = ["fixa_acessos", "fixa_acessos_por_100_hab", "fixa_fibra_pct", "fixa_coaxial_pct", "fixa_metalico_pct", "fixa_radio_pct", "fixa_satelite_pct", "fixa_100mbps_ou_mais_pct", "fixa_25_a_100mbps_pct", "fixa_10_a_25mbps_pct", "fixa_menos_de_10mbps_pct", "fixa_pessoa_fisica_pct", "fixa_prestadoras", "fixa_maior_grupo", "fixa_maior_grupo_pct"];

function colunasMovel(m: Movel | null) {
  return m ? [m.acessos, m.linhas, m.densidade, m.g5_pct, m.g4_pct, m.g3_pct, m.g2_pct, m.pre_pct, m.m2m_pct, m.ponto_servico_pct, m.maior_grupo, m.maior_grupo_pct] : Array(12).fill(null);
}
const CAB_MOVEL = ["movel_acessos", "movel_linhas_total", "movel_acessos_por_100_hab", "movel_5g_pct", "movel_4g_pct", "movel_3g_pct", "movel_2g_pct", "movel_pre_pago_pct", "movel_m2m_pct", "movel_ponto_servico_pct", "movel_maior_grupo", "movel_maior_grupo_pct"];

export function csvPorMunicipio(): string {
  const g = goldConectividade();
  const ops = g.operadoras;
  const cab = ["codigo_ibge", "municipio", "uf", "referencia_fixa", "referencia_movel", "referencia_cobertura", ...CAB_FIXA, ...CAB_MOVEL,
    "moradores_censo_2022", "domicilios_censo_2022", "cobertura_todas_moradores_pct", "cobertura_4g_moradores_pct", "cobertura_5g_moradores_pct", "cobertura_4g_domicilios_pct", "cobertura_5g_domicilios_pct", "cobertura_4g_area_pct", "cobertura_5g_area_pct",
    ...ops.map((o) => `cobertura_${o.toLowerCase()}_4g5g_moradores_pct`)];
  const linhas = [linha(cab)];
  for (const uf of Object.values(UF_DO_PREFIXO).sort()) {
    const arq = arquivoUf(uf);
    if (!arq) continue;
    for (const m of arq.municipios) linhas.push(linha(linhaMunicipio(m, g.referencia, ops)));
  }
  return "﻿" + linhas.join("\n") + "\n";
}

function linhaMunicipio(m: MunicipioGold, ref: { fixa: string; movel: string; cobertura: string }, ops: string[]) {
  const c = m.cobertura;
  const t = (tec: "todas" | "g4" | "g5", i: 0 | 1 | 2) => c?.tecnologias[tec]?.[i] ?? null;
  return [m.id, m.nome, m.uf, m.fixa ? ref.fixa : null, m.movel ? ref.movel : null, c ? ref.cobertura : null, ...colunasFixa(m.fixa), ...colunasMovel(m.movel),
    c?.moradores ?? null, c?.domicilios ?? null, t("todas", 0), t("g4", 0), t("g5", 0), t("g4", 1), t("g5", 1), t("g4", 2), t("g5", 2),
    ...ops.map((o) => c?.operadoras[o]?.g4g5_moradores ?? null)];
}

export function csvPorEstado(): string {
  const g = goldConectividade();
  const cab = ["uf", "nome", "municipios", "municipios_com_fixa", "municipios_com_movel", "municipios_com_cobertura", "referencia_fixa", "referencia_movel", "referencia_cobertura", ...CAB_FIXA, ...CAB_MOVEL,
    "moradores_censo_2022", "cobertura_todas_moradores_pct", "cobertura_4g_moradores_pct", "cobertura_5g_moradores_pct", "municipios_sem_fibra", "municipios_uma_prestadora",
    // universo próprio de cada contagem de cobertura: só os municípios com o valor daquela tecnologia publicado
    "municipios_com_5g_publicado", "municipios_sem_5g", "municipios_com_4g_publicado", "municipios_4g_abaixo_de_50pct"];
  const r = g.referencia;
  const linhas = [linha(cab)];
  for (const u of g.ufs) {
    linhas.push(linha([u.uf, u.nome, u.municipios, u.municipios_por_fonte.fixa, u.municipios_por_fonte.movel, u.municipios_por_fonte.cobertura, r.fixa, r.movel, r.cobertura, ...colunasFixa(u.fixa), ...colunasMovel(u.movel),
      u.cobertura.moradores, u.cobertura.todas_moradores, u.cobertura.g4_moradores, u.cobertura.g5_moradores, u.sem_fibra, u.uma_prestadora,
      u.cobertura.municipios_com_5g_publicado, u.cobertura.municipios_sem_5g, u.cobertura.municipios_com_4g_publicado, u.cobertura.municipios_4g_abaixo_50]));
  }
  const b = g.brasil;
  const bc = b.cobertura.tecnologias;
  const bf = g.destaques.municipios_por_fonte;
  linhas.push(linha(["BR", "Brasil", g.destaques.municipios, bf.fixa, bf.movel, bf.cobertura, r.fixa, r.movel, r.cobertura, ...colunasFixa(b.fixa), ...colunasMovel(b.movel),
    b.cobertura.populacao?.moradores ?? null, bc.todas?.[0] ?? null, bc.g4?.[0] ?? null, bc.g5?.[0] ?? null, g.destaques.sem_fibra, g.destaques.uma_prestadora,
    g.destaques.municipios_com_5g_publicado, g.destaques.sem_5g, g.destaques.municipios_com_4g_publicado, g.destaques.g4_abaixo_50]));
  return "﻿" + linhas.join("\n") + "\n";
}

export function csvBrasilMensal(): string {
  const g = goldConectividade();
  const f = g.brasil.fixa.acessos_mensal;
  const m = g.brasil.movel.acessos_mensal;
  const meses = [...new Set([...f.meses, ...m.meses])].sort();
  const mf = new Map(f.meses.map((x, i) => [x, f.acessos[i]]));
  const mm = new Map(m.meses.map((x, i) => [x, m.acessos[i]]));
  const linhas = [linha(["mes", "banda_larga_fixa_acessos", "telefonia_movel_acessos"])];
  for (const mes of meses) linhas.push(linha([mes, mf.get(mes) ?? null, mm.get(mes) ?? null]));
  return "﻿" + linhas.join("\n") + "\n";
}
