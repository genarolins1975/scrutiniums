import { abre, BASE } from "./pw.mjs";
import fs from "node:fs";
const urls=[];
for (const a of [2021,2022,2023,2024,2025]) for (const e of ["anos_iniciais","anos_finais","creche","pre_escola","ensino_medio"]) for (const m of ["nominal","real"]) urls.push(`/comparar?med=despesa_hab&ano=${a}&etapa=${e}&moeda=${m}&vis=tabela`);
for (const a of [2023,2025]) for (const e of ["anos_iniciais","anos_finais"]) urls.push(`/comparar?med=saeb&ano=${a}&etapa=${e}&disc=portugues&vis=tabela`);
const { b, ctx } = await abre(); const out=[]; let i=0;
async function w(){ const p=await ctx.newPage(); while(i<urls.length){ const u=urls[i++]; await p.goto(BASE+u,{waitUntil:"networkidle"}); const t=await p.$$eval("table", ts=>ts.map(t=>Array.from(t.querySelectorAll("tr")).map(r=>Array.from(r.children).map(c=>c.innerText.trim().replace(/\n/g," | "))))); out.push({url:u,tabelas:t, legenda:(await p.innerText("main")).slice(0,0)}); } await p.close(); }
await Promise.all([w(),w(),w(),w()]);
fs.writeFileSync(process.argv[2], JSON.stringify(out)); console.log(out.length); await b.close();
