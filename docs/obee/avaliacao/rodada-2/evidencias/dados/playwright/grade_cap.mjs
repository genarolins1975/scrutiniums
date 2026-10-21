import { abre, BASE } from "./pw.mjs";
import fs from "node:fs";
const caps = JSON.parse(fs.readFileSync("caps.json","utf-8"));
const combos = [["gastos","despesa_hab","&ano=2023"],["gastos","despesa_hab","&ano=2025"],["gastos","despesa","&ano=2025"],["gastos","despesa_mat","&ano=2022"],["resultados","ideb","&ano=2023&etapa=anos_iniciais"],["resultados","saeb","&ano=2023&etapa=anos_finais&disc=portugues"],["atendimento","atu","&ano=2024&etapa=creche"],["atendimento","matriculas","&ano=2025&etapa=total"],["resultados","aprovacao","&ano=2022&etapa=anos_finais"],["atendimento","conveniadas","&ano=2025&etapa=total"]];
const urls=[]; for (const c of caps) for (const [t,m,ex] of combos) urls.push({u:`/${t}?med=${m}&cap=${c}${ex}`,cap:c,med:m,ex});
const { b, ctx } = await abre(); const out=[]; let i=0;
async function w(){ const p=await ctx.newPage(); while(i<urls.length){ const x=urls[i++]; await p.goto(BASE+x.u,{waitUntil:"networkidle"}); const t=await p.innerText("main"); out.push({...x, frase:t.split("\n").filter(l=>/ registra |não tem valor observado/.test(l)), ressalvas:(t.match(/RESSALVA/g)||[]).length}); } await p.close(); }
await Promise.all([w(),w(),w(),w()]);
fs.writeFileSync(process.argv[2], JSON.stringify(out)); console.log(out.length); await b.close();
