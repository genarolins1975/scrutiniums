import { abre, BASE } from "./pw.mjs";
import fs from "node:fs";
const urls = [];
const anosF=[2021,2022,2023,2024,2025];
for (const med of ["despesa","despesa_hab","despesa_mat"]) for (const a of anosF) for (const m of ["nominal","real"]) urls.push(`/gastos?med=${med}&ano=${a}&moeda=${m}&vis=tabela`);
const et8=["total","creche","pre_escola","anos_iniciais","anos_finais","ensino_medio","eja","profissional"];
for (const a of anosF) for (const e of et8) urls.push(`/atendimento?med=matriculas&ano=${a}&etapa=${e}&vis=tabela`);
for (const a of anosF) for (const e of et8) urls.push(`/atendimento?med=conveniadas&ano=${a}&etapa=${e}&vis=tabela`);
for (const a of anosF) for (const e of ["creche","pre_escola","anos_iniciais","anos_finais","ensino_medio"]) urls.push(`/atendimento?med=atu&ano=${a}&etapa=${e}&vis=tabela`);
for (const a of anosF) for (const e of ["anos_iniciais","anos_finais","ensino_medio"]) urls.push(`/resultados?med=aprovacao&ano=${a}&etapa=${e}&vis=tabela`);
for (const a of [2019,2021,2022,2023,2024,2025]) for (const e of ["anos_iniciais","anos_finais","ensino_medio"]) urls.push(`/resultados?med=ideb&ano=${a}&etapa=${e}&vis=tabela`);
for (const a of [2019,2021,2023,2025]) for (const e of ["anos_iniciais","anos_finais"]) for (const d of ["matematica","portugues"]) urls.push(`/resultados?med=saeb&ano=${a}&etapa=${e}&disc=${d}&vis=tabela`);
const { b, ctx } = await abre();
const out = [];
const conc = 4; let i = 0;
async function worker() {
  const p = await ctx.newPage();
  const errs = [];
  p.on("console", m => { if (["error","warning"].includes(m.type())) errs.push(m.type()+": "+m.text()); });
  p.on("pageerror", e => errs.push("pageerror "+e.message));
  while (i < urls.length) {
    const u = urls[i++];
    try {
      errs.length = 0;
      await p.goto(BASE+u, { waitUntil: "networkidle" });
      const txt = await p.innerText("main");
      const rows = await p.$$eval("table", ts => ts.map(t => Array.from(t.querySelectorAll("tr")).map(r => Array.from(r.children).map(c => c.innerText.trim()))));
      out.push({ url: u, texto: txt, tabelas: rows, erros: [...errs] });
    } catch (e) { out.push({ url: u, falha: String(e).slice(0,200) }); }
  }
  await p.close();
}
await Promise.all(Array.from({length: conc}, worker));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log("páginas:", out.length, "com erros de console:", out.filter(o=>o.erros&&o.erros.length).length, "falhas:", out.filter(o=>o.falha).length);
await b.close();
