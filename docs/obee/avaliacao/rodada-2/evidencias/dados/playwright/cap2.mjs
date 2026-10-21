import { abre, BASE } from "./pw.mjs";
const CAP = "/home/user/scrutiniums/docs/obee/avaliacao/rodada-2/evidencias/dados/capturas/";
const { b, ctx } = await abre({w:1440,h:1000}); const p = await ctx.newPage();
await p.goto(BASE+"/comparar?med=despesa_hab&ano=2024&etapa=creche&vis=tabela",{waitUntil:"networkidle"});
await p.evaluate(()=>{ const th=[...document.querySelectorAll("th")].find(x=>x.textContent.trim()==="Mediana do grupo"); th.scrollIntoView({block:"center",inline:"center"}); let el=th.closest("table").parentElement; while(el&&el.scrollWidth<=el.clientWidth) el=el.parentElement; if(el){ el.scrollLeft=el.scrollWidth; el.scrollTop=el.scrollHeight; } th.scrollIntoView({block:"center"}); });
await p.waitForTimeout(400); await p.screenshot({path:CAP+"comparar_tabela_creche_resumo_ausente.png"});
await b.close();
