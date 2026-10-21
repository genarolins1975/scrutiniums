/**
 * Arquivos para baixar do painel Previdência e INSS (rotas com conta em src/app/contas-publicas/previdencia/*.csv).
 * CSV com ponto e vírgula, UTF-8 com BOM, ponto decimal; ausência fica vazia, nunca zero. Cada linha leva a fonte e o
 * período, para o arquivo se explicar fora do painel. Tudo sai da gold, sem cálculo novo além do valor médio.
 */
import { UF_DO_PREFIXO, arquivoUf, goldPrevidencia } from "./dados";
import { CAMPOS_Q, CAMPOS_V } from "./tipos";

type Celula = string | number | null | undefined;

const campo = (v: Celula) => (v === null || v === undefined ? "" : typeof v === "number" ? String(v) : /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function respostaCsv(nome: string, colunas: readonly string[], linhas: Celula[][]): Response {
  const corpo = [colunas.join(";"), ...linhas.map((l) => l.map(campo).join(";"))].join("\n") + "\n";
  return new Response("﻿" + corpo, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"`, "Cache-Control": "private, max-age=3600" },
  });
}

const medio = (v: number | null | undefined, q: number | null | undefined) => (typeof v === "number" && typeof q === "number" && q > 0 ? Math.round((100 * v) / q) / 100 : null);

export function csvMunicipios(): Response {
  const g = goldPrevidencia();
  const f = g.fontes.municipios;
  const fonte = `${f.orgao}, ${f.nome}`;
  const linhas: Celula[][] = [];
  for (const uf of [...new Set(Object.values(UF_DO_PREFIXO))].sort()) {
    const a = arquivoUf(uf);
    if (!a) continue;
    for (const m of a.municipios) {
      a.anos.forEach((ano, i) => {
        const q = m.q[i];
        const v = m.v[i];
        if (!q || !v) return; // município fora do arquivo naquele ano: sem linha, não zero
        linhas.push([ano, `${ano}-12`, m.id, m.nome, uf, ...q, ...v, medio(v[0], q[0]), "município do órgão pagador; quantidade de créditos emitidos; valor líquido nominal em reais", fonte]);
      });
    }
  }
  return respostaCsv(
    "previdencia-beneficios-por-municipio.csv",
    ["ano", "competencia", "codigo_ibge", "municipio", "uf", ...CAMPOS_Q.map((c) => `beneficios_${c}`), ...CAMPOS_V.map((c) => `valor_liquido_${c}_reais`), "valor_medio_total_reais", "observacao", "fonte"],
    linhas,
  );
}

export function csvEstados(): Response {
  const g = goldPrevidencia();
  const linhas: Celula[][] = [];
  const fm = `${g.fontes.municipios.orgao}, ${g.fontes.municipios.nome} (soma dos municípios pelo código IBGE)`;
  const fb = `${g.fontes.beps.orgao}, BEPS ${g.fontes.beps.edicao ?? ""}, tabela 19`.trim();
  for (const u of g.ufs_mes.ufs) {
    for (const ano of g.anual.anos) {
      const d = g.anual.ufs[u.uf]?.[String(ano)];
      if (!d) continue;
      linhas.push([u.uf, u.nome, `${ano}-12`, "todos os benefícios do INSS", d.q[0], d.v[0], medio(d.v[0], d.q[0]), null, null, null, null, d.q[2], d.q[6], d.q[7], d.q[8], d.q[9], fm]);
    }
    linhas.push([u.uf, u.nome, g.ufs_mes.referencia, "Regime Geral (RGPS)", u.q, u.v, u.medio, u.q_urbana, u.q_rural, u.medio_urbana, u.medio_rural, null, null, null, null, null, fb]);
  }
  return respostaCsv(
    "previdencia-beneficios-por-estado.csv",
    ["uf", "estado", "competencia", "universo", "beneficios", "valor_liquido_reais", "valor_medio_reais", "beneficios_clientela_urbana", "beneficios_clientela_rural", "valor_medio_urbana_reais", "valor_medio_rural_reais", "aposentadorias", "pensoes_por_morte", "auxilios", "outros_previdenciarios", "assistenciais_e_legislacao_especifica", "fonte"],
    linhas,
  );
}

export function csvBrasilMensal(): Response {
  const g = goldPrevidencia();
  const s = g.serie;
  const fonte = `${g.fontes.beps.orgao}, BEPS ${g.fontes.beps.edicao ?? ""}, tabela 14`.trim();
  // até o primeiro janeiro da série, a tabela 14 traz só um dezembro por ano
  const inicioMensal = s.meses.find((m) => m.endsWith("-01")) ?? "";
  const linhas = s.meses.map((m, i) => [
    m,
    s.q.total[i], s.q.rgps[i], s.q.assist[i], s.q.ble[i],
    s.v.total[i], s.v.rgps[i], s.v.assist[i], s.v.ble[i],
    s.abono[i] ? "sim" : "não",
    m < inicioMensal ? "série anual: só dezembro" : "",
    fonte,
  ]);
  return respostaCsv(
    "previdencia-beneficios-brasil-mensal.csv",
    ["competencia", "beneficios_total", "beneficios_rgps", "beneficios_assistenciais", "beneficios_legislacao_especifica", "valor_liquido_total_reais", "valor_liquido_rgps_reais", "valor_liquido_assistenciais_reais", "valor_liquido_legislacao_especifica_reais", "valor_inclui_abono_anual", "observacao", "fonte"],
    linhas,
  );
}

/**
 * As sete tabelas do Anuário usadas no painel, valor a valor (formato longo): uma linha por célula da fonte, com a
 * tabela, o grupo ou território, o ano ou mês, a clientela ou o tipo de unidade, a unidade e o endereço da página. O
 * atendimento (43.2) e a rede (43.1) entram em série, um ano por edição, cada linha com a fonte e o endereço da sua
 * edição. O traço da fonte fica vazio, com a observação; nada é somado aqui.
 */
export function csvAnuario(): Response {
  const g = goldPrevidencia();
  const a = g.aeps;
  const f = g.fontes.aeps;
  const fonte = (tid: keyof typeof f.tabelas, edicao = f.edicao) => `${f.orgao}, ${f.nome}, edição ${edicao}, tabela ${tid.toUpperCase()}`;
  const clientelas = ["total", "urbana", "rural"] as const;
  const linhas: Celula[][] = [];
  // a tabela de cada edição: a principal, ou uma anterior (só atendimento e rede)
  const tabela = (tid: keyof typeof f.tabelas, edicao: number) =>
    edicao === f.edicao ? f.tabelas[tid] : (f.anteriores.find((x) => x.edicao === edicao)?.tabelas[tid as "43.1" | "43.2"] ?? f.tabelas[tid]);
  const celula = (tid: keyof typeof f.tabelas, rotulo: string, id: string, periodo: string, recorte: string, v: number | null, edicao = f.edicao) => {
    const tb = tabela(tid, edicao);
    linhas.push([tid.toUpperCase(), tb.titulo, id, rotulo, periodo, recorte, v, tb.unidade, v === null ? "traço na fonte" : "", tb.url, fonte(tid, edicao)]);
  };
  const medidas = [
    ["a.1", "concedidos"],
    ["b.1", "emitidos"],
    ["b.2", "valor_dez"],
    ["b.3", "valor_ano"],
  ] as const;
  for (const [tid, medida] of medidas) {
    for (const e of a.especies) {
      clientelas.forEach((c, j) => a.anos.forEach((ano, k) => celula(tid, e.rotulo_fonte, e.id, tid === "a.1" || tid === "b.3" ? String(ano) : `${ano}-12`, `clientela ${c}`, e[medida][3 * j + k])));
    }
  }
  const ufs = [{ uf: "BR", nome: "Brasil", v: a.concessoes_uf.brasil }, ...a.concessoes_uf.ufs];
  for (const u of ufs) clientelas.forEach((c, j) => a.anos.forEach((ano, k) => celula("a.14", u.nome, u.uf, String(ano), `clientela ${c}`, u.v[3 * j + k])));
  for (const r of a.rede.serie) {
    for (const u of [{ uf: "BR", nome: "Brasil", v: r.brasil }, ...r.ufs]) a.rede.colunas.forEach((c, j) => celula("43.1", u.nome, u.uf, r.referencia, c, u.v[j], r.edicao));
  }
  for (const x of a.atendimento.serie) {
    const meses = [{ uf: "BR", nome: "Brasil", v: x.brasil as (number | null)[] }, ...x.ufs];
    for (const u of meses) u.v.forEach((v, j) => celula("43.2", u.nome, u.uf, `${x.ano}-${String(j + 1).padStart(2, "0")}`, "atendimentos no mês", v, x.ano));
  }
  return respostaCsv(
    "previdencia-anuario-inss.csv",
    ["tabela", "titulo_tabela", "id", "rotulo_fonte", "periodo", "recorte", "valor", "unidade", "observacao", "url_tabela", "fonte"],
    linhas,
  );
}

export function csvResultadoRgps(): Response {
  const g = goldPrevidencia();
  const r = g.rgps;
  const fonte = `${g.fontes.rtn.orgao}, ${g.fontes.rtn.nome}, edição ${g.fontes.rtn.edicao}, tabelas 2.2 e 2.1-A`;
  const linhas = r.anos.map((a, i) => [
    a, r.arrecadacao[i], r.arrecadacao_urbana[i], r.arrecadacao_rural[i], r.beneficios[i], r.beneficios_urbano[i], r.beneficios_rural[i],
    r.sentencas_urbano[i], r.sentencas_rural[i], r.compensacao[i], r.resultado[i], r.resultado_urbano[i], r.resultado_rural[i], r.bpc_rmv[i], r.pib[i],
    r.pct_pib.arrecadacao[i], r.pct_pib.beneficios[i], r.pct_pib.resultado[i], "R$ milhões correntes", fonte,
  ]);
  return respostaCsv(
    "previdencia-resultado-rgps.csv",
    ["ano", "arrecadacao_liquida", "arrecadacao_urbana", "arrecadacao_rural", "beneficios_previdenciarios", "beneficios_urbano", "beneficios_rural", "sentencas_judiciais_urbano", "sentencas_judiciais_rural", "compensacao_desoneracao_folha", "resultado", "resultado_urbano", "resultado_rural", "bpc_loas_e_rmv", "pib_nominal", "arrecadacao_pct_pib", "beneficios_pct_pib", "resultado_pct_pib", "unidade", "fonte"],
    linhas,
  );
}
