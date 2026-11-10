import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

const goldPix = JSON.parse(readFileSync("public/obs/data/gold/pix.json", "utf8"));
const goldInst = JSON.parse(readFileSync("public/obs/data/gold/institutions.json", "utf8"));
const fichaInst = JSON.parse(readFileSync("public/obs/data/gold/inst/C0010069.json", "utf8"));
const basileia = ["S1","S2","S3","S4","S5","S?"].flatMap(g => (goldInst.instituicoes as Array<{grupo_pares:string;basileia_pct:number|null}>).filter(i=>i.grupo_pares===g&&i.basileia_pct!=null).map(i=>i.basileia_pct!));
// "payroll-lending-aging" saiu da lista em 10/11/2026: decisão do dono de 10/11/2026: fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada.
const rotas = ["credit","pix","sectors","subnational-credit","institutions"];
const n = (v:number,dec=1) => v.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
let servidor: ServidorProducao;
beforeAll(async()=>{if(!temBuild){if(exigirBuild)throw Error("Build obrigatório ausente");return;}servidor=await subirServidor("graficos-identificacao");},90_000);
afterAll(async()=>{await servidor?.parar();});
async function nativo(font:number,width=390) {
 const profile=mkdtempSync(join(tmpdir(),"scrutiniums-graficos-native-"));mkdirSync(join(profile,"Default"));
 writeFileSync(join(profile,"Default","Preferences"),JSON.stringify({webkit:{webprefs:{default_font_size:font,default_fixed_font_size:font===32?26:13}}}));
 let context:BrowserContext|undefined;
 try {context=await chromium.launchPersistentContext(profile,{channel:"chromium",executablePath:process.env.I18N_CHROMIUM_EXECUTABLE,viewport:{width,height:900},reducedMotion:"reduce"});await context.addCookies([{name:"scrutiniums_session",value:servidor.cookie,url:servidor.origem}]);return {context,close:async()=>{await context!.close();rmSync(profile,{recursive:true,force:true});}};}
 catch(e){await context?.close();rmSync(profile,{recursive:true,force:true});throw e;}
}
async function ir(page:Page,rota:string){
 await page.goto(servidor.origem+"/observatorio/"+rota);
 await page.locator(rota.startsWith("institutions/") ? "#view-inst h2" : "section.view.active h1").first().waitFor();
 await page.evaluate(()=>document.fonts.ready);
 // A rotina da aplicação adapta tabelas depois do primeiro HTML. Aguardar sua condição final,
 // inclusive em larguras sem o fallback CSS móvel, antes de julgar overflow da página.
 if(rotas.includes(rota))await expect.poll(()=>page.locator("section.view.active").evaluate(raiz=>raiz.querySelectorAll(".card > table.data, .view > table.data, details > table.data").length)).toBe(0);
}
async function dadosSeries(page:Page) {
 return page.locator("section.view.active .line-chart:has(svg[data-chart])").evaluateAll(blocos=>blocos.filter(b=>b.getBoundingClientRect().width>0).map(b=>{
  const svg=b.querySelector<SVGSVGElement>("svg.chart[data-chart]")!;
  const d=JSON.parse(decodeURIComponent(svg.dataset.chart!));
  const legenda=b.querySelector(".chart-series"), unidade=b.querySelector(".chart-unit");
  const marcas=[...b.querySelectorAll(".chart-series svg")];
  return {unit:d.unit,label:d.series.map((s:{label:string})=>s.label),legenda:legenda?.textContent||"",unidade:unidade?.textContent||"",pathCount:svg.querySelectorAll("path.serie").length,
   values:JSON.stringify({xs:d.xs,series:d.series,band:d.band}),decorativos:marcas.every(m=>m.getAttribute("aria-hidden")==="true"&&m.getAttribute("focusable")==="false"&&!m.hasAttribute("tabindex")),
   bounded:[legenda,unidade].filter(Boolean).every(el=>{const r=el!.getBoundingClientRect(),parent=b.getBoundingClientRect();return r.left>=parent.left-1&&r.right<=parent.right+1;}),
   dash:[...svg.querySelectorAll("path.serie")].map(p=>p.getAttribute("stroke-dasharray")||""),legendDash:marcas.map(m=>m.querySelector("path")?.getAttribute("stroke-dasharray")||"")};
 }));
}

describe.skipIf(!temBuild&&!exigirBuild)("Gráficos: identificação, dados equivalentes e escala íntegra",()=>{
 it.each([16,32])("fonte nativa %ipx: cinco rotas nas quatro larguras",async(font)=>{
  const browser=await nativo(font);const page=await browser.context.newPage();const erros:string[]=[];page.on("pageerror",e=>erros.push(e.message));
  try{for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});for(const rota of rotas){
   await ir(page,rota);expect(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize)).toBe(font+"px");
   await page.locator("section.view.active details.decomp").evaluateAll(ds=>ds.forEach(d=>(d as HTMLDetailsElement).open=true));
   await expect.poll(async()=>page.locator("section.view.active .line-chart").evaluateAll(bs=>bs.every(b=>!b.getBoundingClientRect().width||Math.abs(b.getBoundingClientRect().width-Number((b as HTMLElement).dataset.lineWidth))<2))).toBe(true);
   for(const d of await dadosSeries(page)){
    expect(d.unit,`${rota}: unidade ausente`).not.toBe("");expect(d.unidade).toContain(d.unit);expect(d.pathCount).toBe(d.label.length);expect(d.bounded).toBe(true);expect(d.decorativos).toBe(true);expect(d.legendDash).toEqual(d.dash);
    for(const nome of d.label){expect(nome,`${rota}: nome ausente`).not.toBe("");expect(d.legenda).toContain(nome);}
   }
   if(rota==="institutions"){
    const svg=page.locator("#inst-regua-basileia svg");await expect.poll(()=>svg.evaluate(e=>Math.abs(e.getBoundingClientRect().width-Number((e as SVGSVGElement).dataset.reguaWidth)))).toBeLessThan(2);
    const prova=await svg.evaluate(e=>{const r=e.getBoundingClientRect(),a=[...e.querySelectorAll("text")];const zero=a.find(t=>t.textContent==="0%")!,max=a.find(t=>t.textContent==="60%")!;return {domain:[zero?.textContent,max?.textContent],x0:Number(zero.getAttribute("x")),x1:Number(max.getAttribute("x")),points:[...e.querySelectorAll("circle")].map(c=>Number(c.getAttribute("cx"))),inside:[...e.querySelectorAll("circle,text")].every(c=>{const b=c.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1;}),scroll:e.parentElement!.scrollWidth-e.parentElement!.clientWidth};});
    expect(prova.domain).toEqual(["0%","60%"]);expect(prova.points).toHaveLength(basileia.length);expect(prova.inside).toBe(true);expect(prova.scroll).toBeLessThanOrEqual(2);
    prova.points.forEach((x,i)=>expect((x-prova.x0)/(prova.x1-prova.x0)).toBeCloseTo(basileia[i]/60,6));
   }
   // Asserções aposentadas em 10/11/2026: a pirâmide (.cgpirl) e os ticks da dispersão (#cg-circ .cgdisp) da vista antiga do consignado.
   // Motivo: decisão do dono de 10/11/2026: fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada.
   // A pirâmide com o realce de 60 anos ou mais e a dispersão com o tamanho do círculo da página nova estão em src/tests/familias-paridade-browser.test.ts.
   expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${rota}/${width}/${font}`).toBe(true);
  }}expect(erros).toEqual([]);}finally{await browser.close();}
 },240_000);

 it("resize mantém foco na figura, dados e traços editoriais de previsão",async()=>{
  const browser=await nativo(16,1440);const page=await browser.context.newPage();try{
   await ir(page,"credit");
   // A moldura responsiva nasce após o HTML inicial; uma amostra vazia não é linha de base.
   await expect.poll(()=>page.locator("#view-pulse svg.chart[data-chart]").evaluateAll(svgs=>svgs.length>0&&svgs.every(svg=>svg.closest(".line-chart")))).toBe(true);
   const grafico=page.locator("#view-pulse svg.chart[data-ix]").first();await grafico.focus();await page.keyboard.press("ArrowRight");
   const antes=await dadosSeries(page);expect(antes.length).toBeGreaterThan(0);await page.setViewportSize({width:390,height:900});
   await expect.poll(()=>page.evaluate(()=>document.activeElement?.matches("svg.chart[data-ix]")||false)).toBe(true);
   await expect.poll(()=>page.locator("#view-pulse .line-chart").evaluateAll(bs=>bs.every(b=>!b.getBoundingClientRect().width||Math.abs(b.getBoundingClientRect().width-Number((b as HTMLElement).dataset.lineWidth))<2))).toBe(true);
   const depois=await dadosSeries(page);expect(depois.map(d=>d.values)).toEqual(antes.map(d=>d.values));
   for(const g of depois)g.label.forEach((nome:string,i:number)=>{if(nome==="previsão p50")expect(g.dash[i]).toBe("5,4");});
   await page.keyboard.press("ArrowRight");expect(await page.evaluate(()=>document.activeElement?.matches("svg.chart[data-ix]"))).toBe(true);
  }finally{await browser.close();}
 },60_000);

 it("MED distingue a devolução; tabela27UF segue medida e perspectiva",async()=>{
  const browser=await nativo(16);const page=await browser.context.newPage();try{
   await ir(page,"pix");expect(await page.locator("#px-med h5").allTextContents()).toContain("Parcela do valor contestado que foi devolvida");
   const geo=page.locator("#px-geo");
   for(const modo of ["q_hab","v_hab","t_pag","yoy_v"]){
    await geo.locator(`button[onclick="pxSet('gmet','${modo}')"]`).click();
    const tabela=geo.locator("details").filter({has:page.getByText("Dados do mapa por UF",{exact:true})});await tabela.locator("summary").click();
    const rows=await tabela.locator("tbody tr").allTextContents();expect(rows).toHaveLength(goldPix.geografia.ufs.length);
    goldPix.geografia.ufs.forEach((u:{nome:string;uf:string;q_hab:number;v_hab:number;t_pag:number;yoy_v:number},i:number)=>{const values={q_hab:n(u.q_hab,1),v_hab:"R$ "+n(u.v_hab,0),t_pag:"R$ "+n(u.t_pag,0),yoy_v:(u.yoy_v>0?"+":"")+n(u.yoy_v,2)+"%"};expect(rows[i]).toContain(u.nome);expect(rows[i]).toContain(values[modo as keyof typeof values]);});
   }
   await geo.locator('button[onclick="pxSet(\'gmet\',\'q_hab\')"]').click();await geo.locator('button[onclick="pxSet(\'gpersp\',\'rec\')"]').click();
   const tabela=geo.locator("details").filter({has:page.getByText("Dados do mapa por UF",{exact:true})});await tabela.locator("summary").click();const rows=await tabela.locator("tbody tr").allTextContents();
   goldPix.geografia.ufs.forEach((u:{q_hab:number;q_pag:number;q_rec:number},i:number)=>expect(rows[i]).toContain(u.q_hab>0?n(u.q_rec/(u.q_pag/u.q_hab),1):"Não publicado"));
  }finally{await browser.close();}
 },90_000);

 // Teste aposentado em 10/11/2026: "tabela municipal percorre o recorte inteiro e CSV equivale à busca/camada" (#cg-tabela-mapa da vista
 // antiga do consignado). Motivo: decisão do dono de 10/11/2026: fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada.
 // A tabela paginada, a busca e o CSV da página nova são conferidos em src/tests/familias-paridade-browser.test.ts.

 it("ausência declarada não se transforma em zero nas alternativas tabulares",async()=>{
  const browser=await nativo(16);const page=await browser.context.newPage();try{
   // Fixture explícita de indisponibilidade: altera apenas a resposta desta sessão de teste.
   const pix=structuredClone(goldPix);pix.geografia.ufs[0].q_hab=null;
   await browser.context.route("**/obs/data/gold/pix.json*",r=>r.fulfill({json:pix}));
   await ir(page,"pix");await page.locator("#px-geo button[onclick=\"pxSet('gmet','q_hab')\"]").click();
   const tabela=page.locator("#px-geo details").filter({has:page.getByText("Dados do mapa por UF",{exact:true})});await tabela.locator("summary").click();
   expect(await tabela.locator("tbody tr").first().innerText()).toContain("Não publicado");
   // Asserções aposentadas em 10/11/2026: a metade do consignado (município sem a medida sai "n.d." na tabela e vazio no CSV, #cg-tabela-mapa).
   // Motivo: decisão do dono de 10/11/2026: fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada.
   // Na página nova, a ausência sai "sem dado" na tabela, vazia no CSV e em hachura no mapa: src/tests/familias-paridade-browser.test.ts.
  }finally{await browser.close();}
 },90_000);

 // Teste aposentado em 10/11/2026: "metadados das nove camadas distinguem observado, calculado e estimado" (legenda de #cg-tabela-mapa da
 // vista antiga). Motivo: decisão do dono de 10/11/2026: fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para /divida-das-familias/consignado e a vista antiga não é mais desenhada.
 // As nove medidas da página nova, cada uma com natureza, unidade e fonte na legenda do mapa, são conferidas em src/tests/familias-paridade-browser.test.ts.

 it("helper da ficha carrega no acesso frio e na navegação cliente",async()=>{
  const browser=await nativo(16);const page=await browser.context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));try{
   await ir(page,"institutions/C0010069");await expect.poll(()=>page.locator("#view-inst h2").first().innerText()).toContain(fichaInst.cabecalho.nome_comercial);
   expect(await page.evaluate(()=>["instListadaSecao","instRegimeAviso","instGuidanceIF","instTiIF","instRemuneracaoIF","instFolhaIF"].map(k=>typeof (window as unknown as Record<string,unknown>)[k]))).toEqual(Array(6).fill("function"));
   await ir(page,"institutions");await page.evaluate(()=>document.documentElement.dataset.clientProof="same-document");
   await page.locator('#view-institutions a[href="/observatorio/institutions/C0010069"]').first().click();await expect.poll(()=>page.locator("#view-inst h2").first().innerText()).toContain(fichaInst.cabecalho.nome_comercial);
   expect(await page.evaluate(()=>document.documentElement.dataset.clientProof)).toBe("same-document");expect(errors).toEqual([]);
  }finally{await browser.close();}
 },90_000);
});
