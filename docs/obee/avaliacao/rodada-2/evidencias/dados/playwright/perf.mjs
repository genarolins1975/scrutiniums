import { chromium, BASE } from "./pw.mjs";
import fs from "node:fs";
const rotas = [["Panorama",""],["Gastos","/gastos"],["Atendimento","/atendimento"],["Resultados","/resultados"],["Comparar","/comparar"],["Comparar (tabela completa)","/comparar?vis=tabela"],["Métodos","/metodos"],["Gastos (por matrícula 2022)","/gastos?med=despesa_mat&ano=2022"]];
const perfis = [
  {nome:"desktop 1440x900, sem estrangulamento", vp:{width:1440,height:900}, cpu:1, rede:null},
  {nome:"móvel 390x844, CPU 4x, rede 4G lenta (1,6 Mbps, 150 ms)", vp:{width:390,height:844}, cpu:4, rede:{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8}},
];
const REPS = 5;
const mediana = a => { const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox"] });
const res=[];
for (const pf of perfis) for (const [nome,rota] of rotas) {
  const runs=[];
  for (let r=0;r<REPS;r++) {
    const ctx = await b.newContext({viewport:pf.vp}); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled",{cacheDisabled:true});
    if (pf.cpu>1) await cdp.send("Emulation.setCPUThrottlingRate",{rate:pf.cpu});
    if (pf.rede) await cdp.send("Network.emulateNetworkConditions",pf.rede);
    const errs=[]; p.on("console",m=>{ if(["error","warning"].includes(m.type())) errs.push(m.text().slice(0,160)); }); p.on("pageerror",e=>errs.push("pageerror "+e.message));
    await p.addInitScript(()=>{ window.__m={cls:0,lcp:0,lt:[],fcp:0}; new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__m.cls+=e.value;}).observe({type:"layout-shift",buffered:true}); new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__m.lcp=e.startTime;}).observe({type:"largest-contentful-paint",buffered:true}); new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__m.lt.push([e.startTime,e.duration]);}).observe({type:"longtask",buffered:true}); new PerformanceObserver(l=>{for(const e of l.getEntries()) if(e.name==="first-contentful-paint") window.__m.fcp=e.startTime;}).observe({type:"paint",buffered:true}); });
    const t0=Date.now();
    await p.goto(BASE+rota,{waitUntil:"load"});
    await p.waitForSelector("main h1, main h2",{timeout:30000});
    const tConteudo = Date.now()-t0;
    await p.waitForLoadState("networkidle"); await p.waitForTimeout(1200);
    const m = await p.evaluate(()=>{ const nav=performance.getEntriesByType("navigation")[0]; const rs=performance.getEntriesByType("resource"); const soma=(f)=>rs.filter(f).reduce((a,e)=>a+(e.transferSize||0),0); const dec=(f)=>rs.filter(f).reduce((a,e)=>a+(e.decodedBodySize||0),0);
      const js=e=>/\.js(\?|$)/.test(e.name)||e.initiatorType==="script"; const tbt=window.__m.lt.filter(l=>l[0]>=window.__m.fcp).reduce((a,l)=>a+Math.max(0,l[1]-50),0);
      return { htmlTransfer:nav.transferSize, htmlDecoded:nav.decodedBodySize, jsTransfer:soma(js), jsDecoded:dec(js), jsN:rs.filter(js).length, totalTransfer:nav.transferSize+soma(()=>true), totalN:rs.length+1, fcp:window.__m.fcp, lcp:window.__m.lcp, cls:window.__m.cls, tbt, dcl:nav.domContentLoadedEventEnd, load:nav.loadEventEnd, dados: rs.filter(e=>/\.(json|csv)(\?|$)/.test(e.name)).map(e=>[e.name.split("/").pop(),e.transferSize]) }; });
    runs.push({...m,tConteudo,erros:errs.length,errsTxt:errs.slice(0,2)});
    await ctx.close();
  }
  const med = k => mediana(runs.map(r=>r[k]));
  const linha = {perfil:pf.nome,rota:nome,url:rota||"/",reps:REPS,htmlKB:+(med("htmlTransfer")/1024).toFixed(1),htmlDecKB:+(med("htmlDecoded")/1024).toFixed(1),jsKB:+(med("jsTransfer")/1024).toFixed(1),jsDecKB:+(med("jsDecoded")/1024).toFixed(1),jsN:med("jsN"),totalKB:+(med("totalTransfer")/1024).toFixed(1),fcp:Math.round(med("fcp")),lcp:Math.round(med("lcp")),cls:+med("cls").toFixed(4),tbt:Math.round(med("tbt")),dcl:Math.round(med("dcl")),load:Math.round(med("load")),conteudoMs:Math.round(med("tConteudo")),lcpMax:Math.round(Math.max(...runs.map(r=>r.lcp))),clsMax:+Math.max(...runs.map(r=>r.cls)).toFixed(4),errosTotal:runs.reduce((a,r)=>a+r.erros,0),dados:runs[0].dados,errsTxt:runs.flatMap(r=>r.errsTxt).slice(0,2)};
  res.push(linha); console.log(JSON.stringify(linha));
}
fs.writeFileSync(process.argv[2],JSON.stringify(res,null,1)); await b.close();
