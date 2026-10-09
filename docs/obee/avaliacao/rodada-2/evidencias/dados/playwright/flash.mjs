import { chromium, BASE } from "./pw.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox"] });
const perfis=[["desktop sem estrangulamento",{width:1440,height:900},1,null],["móvel CPU 4x + 4G lenta",{width:390,height:844},4,{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8}]];
for (const [nome,vp,cpu,rede] of perfis) {
  const res=[];
  for (let r=0;r<5;r++) {
    const ctx = await b.newContext({viewport:vp}); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled",{cacheDisabled:true}); if(cpu>1) await cdp.send("Emulation.setCPUThrottlingRate",{rate:cpu}); if(rede) await cdp.send("Network.emulateNetworkConditions",rede);
    await p.addInitScript(()=>{ window.__t={}; const f=()=>{ const el=document.body&&document.body.innerText||""; const agora=performance.now(); if(!window.__t.padrao && /entre as 26 capitais com dado comparável em 2025/.test(el)) window.__t.padrao=agora; if(!window.__t.certo && /em 2022\./.test(el)&&/aplicação direta por matrícula vai de/.test(el)) window.__t.certo=agora; }; new MutationObserver(f).observe(document,{childList:true,subtree:true,characterData:true}); document.addEventListener("DOMContentLoaded",f); setInterval(f,20); });
    await p.goto(BASE+"/gastos?med=despesa_mat&ano=2022",{waitUntil:"load"}); await p.waitForFunction(()=>window.__t.certo,{timeout:30000}); await p.waitForTimeout(300);
    res.push(await p.evaluate(()=>window.__t)); await ctx.close();
  }
  console.log(nome, JSON.stringify(res.map(x=>[Math.round(x.padrao||0),Math.round(x.certo)])), "→ janela com conteúdo do recorte errado (ms):", res.map(x=>Math.round((x.certo||0)-(x.padrao||0))));
}
await b.close();
