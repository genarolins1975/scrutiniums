import { abre, BASE } from "./pw.mjs";
const rotas = process.argv.slice(2);
const { b, ctx } = await abre();
for (const r of rotas) {
  const p = await ctx.newPage(); const errs=[];
  p.on("console",m=>{if(["error","warning"].includes(m.type())) errs.push(m.type()+": "+m.text())}); p.on("pageerror",e=>errs.push("pageerror "+e.message));
  await p.goto(BASE+r,{waitUntil:"networkidle"});
  const t = await p.innerText("main");
  console.log("=====",r,"\n"+t.slice(0, Number(process.env.N||6000)),"\nERROS:",errs);
  await p.close();
}
await b.close();
