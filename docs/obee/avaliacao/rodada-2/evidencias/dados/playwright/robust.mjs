import { abre, BASE } from "./pw.mjs";
const { b, ctx } = await abre();
const casos = ["/gastos?med=foo&ano=1999&cap=xxx&etapa=bar&vis=nada&moeda=euro", "/gastos?ano=abc", "/resultados?med=despesa", "/comparar?med=ideb&ano=2030&reg=ZZ&vis=x", "/comparar?cap=recife&destaque=recife,natal", "/atendimento?med=atu&etapa=eja&ano=2021", "/nao-existe", "/gastos?med=despesa_hab&ano=2021&cap=campo-grande&vis=evolucao"];
for (const c of casos) {
  const p = await ctx.newPage(); const errs=[]; p.on("console",m=>{if(m.type()==="error") errs.push(m.text().slice(0,120))}); p.on("pageerror",e=>errs.push("pageerror "+e.message));
  const r = await p.goto(BASE+c,{waitUntil:"networkidle"}); const t = await p.innerText("body").catch(()=>"");
  const h1 = await p.$eval("h1",e=>e.innerText).catch(()=>null);
  console.log(c, "->", r.status(), "| h1:", h1, "| frase:", (t.match(/(vai de|é .* nas|Nenhuma capital)[^\n]{0,150}/)||[""])[0].slice(0,170), "| erros:", errs.length, errs[0]||"");
  await p.close();
}
// sem JavaScript
const c2 = await b.newContext({ javaScriptEnabled:false }); const p2 = await c2.newPage(); await p2.goto(BASE+"/gastos?med=despesa_hab&ano=2023",{waitUntil:"load"});
const t2 = await p2.innerText("main"); console.log("SEM JS: frase presente?", /vai de R\$ 574 em Belém/.test(t2), "| tabela?", (await p2.$$("table")).length);
await b.close();
