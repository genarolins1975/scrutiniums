// Inventário de datas ISO e literais no HTML pré-renderizado (.next/server/app), pelo mesmo
// contrato do teste (src/tests/support/html-contrato.ts): árvore DOM do parse5, sem regex sobre HTML.
// Uso: node --no-warnings scripts/inventario-datas.mjs [--json saida.json] [--md saida.md] [prefixo-de-rota ...]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { analisaHtml } from "../src/tests/support/html-contrato.ts";

const APP = join(process.cwd(), ".next", "server", "app");
const args = process.argv.slice(2);
const pega = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : null; };
const saidaJson = pega("--json");
const saidaMd = pega("--md");
const prefixos = args;

const html = (d, acc = []) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) html(p, acc);
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
};

const rel = (p) => relative(APP, p);
const todas = html(APP).filter((p) => rel(p).startsWith("setor-eletrico") || rel(p).startsWith("eficiencia-estatal"));
const rotas = todas.filter((p) => !prefixos.length || prefixos.some((x) => ("/" + rel(p)).startsWith(x)));

const porRota = new Map();
const todasOc = [];
const todosLit = [];
const todasViol = [];
for (const p of rotas) {
  const rota = "/" + rel(p).replace(/\.html$/, "");
  const a = analisaHtml(readFileSync(p, "utf-8"), rota);
  todasOc.push(...a.ocorrenciasProsa);
  todosLit.push(...a.literais);
  todasViol.push(...a.violacoes);
  porRota.set(rota, { ocorrencias: a.ocorrenciasProsa.length, literais: a.literais.length, violacoes: a.violacoes.length });
}

const conta = (xs, f) => xs.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
const resumo = {
  paginasVarridas: rotas.length,
  paginasComViolacao: [...porRota.values()].filter((v) => v.violacoes).length,
  ocorrenciasEmProsa: todasOc.length,
  ocorrenciasPorTipo: conta(todasOc, (o) => `${o.tipo}${o.valida ? "" : "-invalida"}`),
  violacoesPorRegra: conta(todasViol, (v) => v.regra),
  literaisPorClasse: conta(todosLit, (l) => l.classe),
  paginasComLiteral: new Set(todosLit.map((l) => l.rota)).size,
};
if (saidaJson) writeFileSync(saidaJson, JSON.stringify({ resumo, ocorrencias: todasOc, literais: todosLit, violacoes: todasViol, porRota: Object.fromEntries(porRota) }, null, 1));
if (saidaMd) {
  const linhas = ["| Rota | Violações | Ocorrências em prosa | Literais |", "| --- | --- | --- | --- |"];
  for (const [r, v] of [...porRota].filter(([, v]) => v.violacoes || v.literais || v.ocorrencias).sort((a, b) => b[1].violacoes - a[1].violacoes || a[0].localeCompare(b[0])))
    linhas.push(`| \`${r}\` | ${v.violacoes} | ${v.ocorrencias} | ${v.literais} |`);
  writeFileSync(saidaMd, linhas.join("\n") + "\n");
}
console.log(JSON.stringify(resumo, null, 1));
if (!saidaJson && !saidaMd) for (const [r, v] of [...porRota].filter(([, v]) => v.violacoes).sort((a, b) => b[1].violacoes - a[1].violacoes)) console.log(String(v.violacoes).padStart(4), r);
