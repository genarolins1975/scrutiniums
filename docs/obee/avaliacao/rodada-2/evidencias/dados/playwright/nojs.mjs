import { abre, BASE } from "./pw.mjs";
const { b } = await abre();
const c2 = await b.newContext({ javaScriptEnabled:false }); const p2 = await c2.newPage();
for (const u of ["/gastos?med=despesa_mat&ano=2022", "/gastos", "/comparar?med=ideb&ano=2023"]) {
await p2.goto(BASE+u,{waitUntil:"load"});
const t2 = await p2.innerText("main"); console.log(u,"\n SEM JS:", (t2.match(/(vai de|é R\$|Carregando|carregando)[^\n]{0,160}/)||[t2.slice(0,200)])[0], "| tabelas:", (await p2.$$("table")).length, "| len", t2.length);
}
await b.close();
