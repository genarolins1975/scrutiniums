import { abre, BASE } from "./pw.mjs";
import fs from "node:fs";
const caps = JSON.parse(fs.readFileSync("caps.json","utf-8"));
const combos = [["gastos","despesa","nominal",""],["gastos","despesa","real",""],["gastos","despesa_hab","nominal",""],["gastos","despesa_hab","real",""],["gastos","despesa_mat","nominal",""],["gastos","despesa_mat","real",""],["atendimento","atu","nominal","&etapa=anos_iniciais"],["atendimento","matriculas","nominal","&etapa=total"],["resultados","aprovacao","nominal","&etapa=anos_iniciais"],["resultados","ideb","nominal","&etapa=anos_finais"],["resultados","saeb","nominal","&etapa=anos_iniciais&disc=portugues"]];
const urls=[]; for (const c of caps) for (const [t,m,mo,ex] of combos) urls.push({u:`/${t}?med=${m}&cap=${c}&moeda=${mo}${ex}&vis=evolucao`, cap:c, med:m, moeda:mo, ex});
const { b, ctx } = await abre(); const out=[]; let i=0;
async function w(){ const p=await ctx.newPage(); while(i<urls.length){ const x=urls[i++]; await p.goto(BASE+x.u,{waitUntil:"networkidle"}); const t=await p.innerText("main"); const linhas=t.split("\n"); const frase=linhas.filter(l=>/passou de|não são diretamente comparáveis|um só período|Não há dado comparável|Sem valor comparável/.test(l)); const mud=linhas.filter(l=>/Mudança de base entre|ruptura|Em 20\d\d:/.test(l)); out.push({...x, frase, mud, pontos: linhas.filter(l=>/^R\$ [\d\.]+$|^[\d,]+%?$/.test(l)).slice(0,12)}); } await p.close(); }
await Promise.all([w(),w(),w(),w()]);
fs.writeFileSync(process.argv[2], JSON.stringify(out)); console.log(out.length); await b.close();
