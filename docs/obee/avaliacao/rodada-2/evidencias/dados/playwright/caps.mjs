import { chromium, abre, BASE } from "./pw.mjs";
const CAP = "/home/user/scrutiniums/docs/obee/avaliacao/rodada-2/evidencias/dados/capturas/";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox"] });
// 1 tabela creche
let ctx = await b.newContext({viewport:{width:1440,height:900}}); let p = await ctx.newPage();
await p.goto(BASE+"/comparar?med=despesa_hab&ano=2024&etapa=creche&vis=tabela",{waitUntil:"networkidle"});
const alvo = p.locator("tr").filter({hasText:"Mediana do grupo"}).first(); await alvo.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
await p.screenshot({path:CAP+"comparar_tabela_creche_resumo_ausente.png"});
// 2 frase da capital x tabela (Fortaleza 2025)
await p.goto(BASE+"/gastos?med=despesa_hab&ano=2025&cap=fortaleza",{waitUntil:"networkidle"});
await p.locator("text=Fortaleza (CE) registra").first().scrollIntoViewIfNeeded(); await p.screenshot({path:CAP+"gastos_frase_fortaleza_R29.png"});
await p.goto(BASE+"/comparar?med=despesa_hab&ano=2025&vis=tabela",{waitUntil:"networkidle"});
const lf = p.locator("tr").filter({hasText:"Fortaleza (CE)"}).first(); await lf.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({path:CAP+"comparar_tabela_fortaleza_R28.png"});
await ctx.close();
// 3 deep link em estado padrão antes da hidratação (móvel, rede lenta, CPU 4x)
ctx = await b.newContext({viewport:{width:390,height:844}}); p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable"); await cdp.send("Network.setCacheDisabled",{cacheDisabled:true}); await cdp.send("Emulation.setCPUThrottlingRate",{rate:4}); await cdp.send("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
p.goto(BASE+"/gastos?med=despesa_mat&ano=2022",{waitUntil:"commit"});
await p.waitForFunction(()=>/entre as 26 capitais com dado comparável em 2025/.test(document.body?.innerText||""),{timeout:30000});
await p.waitForTimeout(900);
await p.screenshot({path:CAP+"deep_link_estado_padrao_antes_da_hidratacao_movel.png"});
console.log("URL pedida: ?med=despesa_mat&ano=2022 ; texto visível no momento da captura:", (await p.innerText("main")).split("\n").find(l=>/vai de/.test(l)));
await p.waitForFunction(()=>/em 2022\./.test(document.body.innerText)&&/matrícula vai de/.test(document.body.innerText),{timeout:30000});
await p.screenshot({path:CAP+"deep_link_estado_correto_apos_hidratacao_movel.png"});
await b.close();
