import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

const goldPix = JSON.parse(readFileSync("public/obs/data/gold/pix.json", "utf8"));
const goldCg = JSON.parse(readFileSync("public/obs/data/gold/consignado.json", "utf8"));
const goldMun = JSON.parse(readFileSync("public/obs/data/gold/consignado_mun.json", "utf8")).municipios as Array<{n:string;uf:string;reg:string;sel:string;p60:number|null;cons_ben:number|null}>;
const goldInst = JSON.parse(readFileSync("public/obs/data/gold/institutions.json", "utf8"));
const basileia = ["S1","S2","S3","S4","S5","S?"].flatMap(g => (goldInst.instituicoes as Array<{grupo_pares:string;basileia_pct:number|null}>).filter(i=>i.grupo_pares===g&&i.basileia_pct!=null).map(i=>i.basileia_pct!));
const rotas = ["credit","pix","payroll-lending-aging","sectors","subnational-credit","institutions"];
const n = (v:number,dec=1) => v.toLocaleString("pt-BR",{minimumFractionDigits:dec,maximumFractionDigits:dec});
const normaliza = (v:string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
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
async function ir(page:Page,rota:string){await page.goto(servidor.origem+"/observatorio/"+rota);await page.locator("section.view.active h1").waitFor();await page.evaluate(()=>document.fonts.ready);}
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
 it.each([16,32])("fonte nativa %ipx: seis rotas nas quatro larguras",async(font)=>{
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
   if(rota==="payroll-lending-aging"){
    const p=await page.locator(".cgpirl").evaluateAll(rows=>rows.map(row=>{const track=row.querySelector(".b")!.getBoundingClientRect(),bar=row.querySelector(".b > span")!.getBoundingClientRect();return {width:track.width,ratio:bar.width/track.width,label:row.querySelector(".g")!.textContent,value:row.querySelector(".v")!.textContent};}));
    expect(p).toHaveLength(goldCg.brasil.piramide.length);const fonte=[...goldCg.brasil.piramide].reverse(),max=Math.max(...fonte.map(x=>x.pop));p.forEach((r,i)=>{expect(r.width).toBeGreaterThan(40);expect(r.ratio).toBeCloseTo(fonte[i].pop/max,2);expect(r.label).toBe(fonte[i].g);expect(r.value).toBe(n(fonte[i].pop/1e6,2));});
    const ticks=await page.locator("#cg-circ .cgdisp > text").allTextContents();const est=goldCg.estados.filter((e:{outras_censo:number|null;cons_por_60:number|null})=>e.outras_censo!=null&&e.cons_por_60!=null);
    const xs=est.map((e:{outras_censo:number})=>e.outras_censo),ys=est.map((e:{cons_por_60:number})=>e.cons_por_60);
    for(const t of [0,.5,1]){expect(ticks).toContain(n(Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*t,1));expect(ticks).toContain(n(Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*t,0));}
    expect(await page.locator(".cgdisp-uf").count()).toBe(est.length);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${rota}/${width}/${font}`).toBe(true);
  }}expect(erros).toEqual([]);}finally{await browser.close();}
 },240_000);

 it("resize mantém foco na figura, dados e traços editoriais de previsão",async()=>{
  const browser=await nativo(16,1440);const page=await browser.context.newPage();try{
   await ir(page,"credit");const grafico=page.locator("#view-pulse svg.chart[data-ix]").first();await grafico.focus();await page.keyboard.press("ArrowRight");
   const antes=await dadosSeries(page);await page.setViewportSize({width:390,height:900});
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

 it("tabela municipal percorre o recorte inteiro e CSV equivale à busca/camada",async()=>{
  const browser=await nativo(16);const page=await browser.context.newPage();try{
   await ir(page,"payroll-lending-aging");await page.locator("#cg-mapa button[onclick=\"cgFiltra('conf','todas')\"]").click();await page.locator("#cg-tabela-mapa summary").click();
   const base=goldMun;const vistos:string[]=[];
   for(let i=0;i<Math.ceil(base.length/50);i++){
    const rows=await page.locator("#cg-tabela-linhas tr").allTextContents();const trecho=base.slice(i*50,i*50+50);expect(rows).toHaveLength(trecho.length);
    trecho.forEach((m,j)=>{expect(rows[j]).toContain(m.n);expect(rows[j]).toContain(m.uf);expect(rows[j]).toContain(m.p60==null?"n.d.":n(m.p60,1)+"%");vistos.push(m.n+"/"+m.uf);});
    if(i<Math.ceil(base.length/50)-1)await page.locator("#cg-tabela-proxima").click();
   }
   expect(vistos).toEqual(base.map(m=>m.n+"/"+m.uf));
   expect(await page.locator("#cg-tabela-anterior").evaluate(e=>e===document.activeElement)).toBe(true);
   await page.locator("#cg-tabela-busca").fill("alto");expect(base.filter(m=>normaliza(m.n+" "+m.uf).includes("alto")).length).toBeGreaterThan(50);
   await page.locator("#cg-tabela-proxima").focus();await page.keyboard.press("Enter");
   expect(await page.locator("#cg-tabela-anterior").evaluate(e=>e===document.activeElement)).toBe(true);
   await page.keyboard.press("Space");expect(await page.locator("#cg-tabela-proxima").evaluate(e=>e===document.activeElement)).toBe(true);
   await page.keyboard.press("Tab");expect(await page.getByRole("button",{name:"Baixar CSV deste recorte",exact:true}).evaluate(e=>e===document.activeElement)).toBe(true);
   await page.locator("#cg-tabela-busca").fill(base[0].n+" "+base[0].uf);await page.keyboard.press("Tab");
   expect(await page.getByRole("button",{name:"Baixar CSV deste recorte",exact:true}).evaluate(e=>e===document.activeElement)).toBe(true);
   await page.locator("#cg-tabela-busca").fill("zzzzz-sem-municipio");expect(await page.locator("#cg-tabela-status").innerText()).toBe("Nenhum município encontrado.");expect(await page.locator("#cg-tabela-linhas").innerText()).toContain("Altere a busca");await page.keyboard.press("Tab");expect(await page.getByRole("button",{name:"Baixar CSV deste recorte",exact:true}).evaluate(e=>e===document.activeElement)).toBe(true);
   await page.locator("#cg-mapa button[onclick=\"cgFiltra('cam','cons_ben')\"]").click();expect(await page.locator("#cg-tabela-mapa").getAttribute("open")).not.toBeNull();
   await page.locator("#cg-tabela-busca").fill("RS");const filtrados=base.filter(m=>normaliza(m.n+" "+m.uf).includes("rs"));
   const download=page.waitForEvent("download");await page.getByRole("button",{name:"Baixar CSV deste recorte",exact:true}).click();const file=await(await download).path();const csv=readFileSync(file!,"utf8");
   expect(csv).toContain("# Natureza: estimado");expect(csv).toContain("# Fonte e referência:");expect(csv).toContain("# Unidade: R$");
   const linhas=csv.replace(/^\uFEFF/,"").trimEnd().split("\n").filter(l=>!l.startsWith("#")).slice(1).map(l=>l.split(";").map(c=>c.replace(/^"|"$/g,"").replace(/""/g,'"')));
   expect(linhas).toHaveLength(filtrados.length);filtrados.forEach((m,i)=>expect(linhas[i].slice(0,4)).toEqual([m.n,m.uf,m.cons_ben==null?"":"R$ "+n(m.cons_ben,0),"R$"]));
   await page.locator("#cg-tabela-busca").fill("");await page.locator("#cg-mapa select").selectOption("Sul");
   const baixados=page.waitForEvent("download");await page.getByRole("button",{name:"Baixar CSV deste recorte",exact:true}).click();const sul=readFileSync((await(await baixados).path())!,"utf8");
   expect(sul).toContain("# Região: Sul");expect(sul.replace(/^\uFEFF/,"").trimEnd().split("\n").filter(l=>!l.startsWith("#")).length-1).toBe(base.filter(m=>m.reg==="Sul").length);
   await page.locator("#cg-mapa button[onclick=\"cgFiltra('cam','indice')\"]").click();
   const indiceDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Baixar CSV deste recorte",exact:true}).click();const indiceCsv=readFileSync((await(await indiceDownload).path())!,"utf8");
   for(const metadado of ["# Natureza: estimado","# Unidade: pontos (0 a 100)","IPCA, preços de julho/2022","cenário aritmético de 84 meses","não conduta"])expect(indiceCsv).toContain(metadado);
   await page.locator("#cg-mapa button[onclick=\"cgFiltra('cam','pass')\"]").click();expect(await page.locator("#cg-tabela-mapa caption").innerText()).toContain("calculado");
  }finally{await browser.close();}
 },120_000);

 it("ausência declarada não se transforma em zero nas alternativas tabulares",async()=>{
  const browser=await nativo(16);const page=await browser.context.newPage();try{
   // Fixture explícita de indisponibilidade: altera apenas a resposta desta sessão de teste.
   const pix=structuredClone(goldPix);pix.geografia.ufs[0].q_hab=null;
   const mun={municipios:structuredClone(goldMun)};const semDado=mun.municipios.find(m=>m.sel!=="baixa")!;semDado.cons_ben=null;
   await browser.context.route("**/obs/data/gold/pix.json*",r=>r.fulfill({json:pix}));
   await browser.context.route("**/obs/data/gold/consignado_mun.json*",r=>r.fulfill({json:mun}));
   await ir(page,"pix");await page.locator("#px-geo button[onclick=\"pxSet('gmet','q_hab')\"]").click();
   const tabela=page.locator("#px-geo details").filter({has:page.getByText("Dados do mapa por UF",{exact:true})});await tabela.locator("summary").click();
   expect(await tabela.locator("tbody tr").first().innerText()).toContain("Não publicado");
   await ir(page,"payroll-lending-aging");await page.locator("#cg-mapa button[onclick=\"cgFiltra('cam','cons_ben')\"]").click();await page.locator("#cg-tabela-mapa summary").click();
   await page.locator("#cg-tabela-busca").fill(semDado.n+" "+semDado.uf);expect(await page.locator("#cg-tabela-linhas").innerText()).toContain("n.d.");
   const download=page.waitForEvent("download");await page.getByRole("button",{name:"Baixar CSV deste recorte",exact:true}).click();const csv=readFileSync((await(await download).path())!,"utf8");
   const data=csv.replace(/^\uFEFF/,"").trimEnd().split("\n").filter(l=>!l.startsWith("#")).slice(1);expect(data).toHaveLength(1);expect(data[0].split(";")[2].replace(/^"|"$/g,"")).toBe("");
  }finally{await browser.close();}
 },90_000);

 it("helper da ficha carrega no acesso frio e na navegação cliente",async()=>{
  const browser=await nativo(16);const page=await browser.context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));try{
   await ir(page,"institutions/C0010069");await page.locator("#view-inst h1").waitFor();
   expect(await page.evaluate(()=>["instListadaSecao","instRegimeAviso","instGuidanceIF","instTiIF","instRemuneracaoIF","instFolhaIF"].map(k=>typeof (window as unknown as Record<string,unknown>)[k]))).toEqual(Array(6).fill("function"));
   await ir(page,"institutions");await page.evaluate(()=>document.documentElement.dataset.clientProof="same-document");
   await page.locator('#view-institutions a[href="/observatorio/institutions/C0010069"]').first().click();await page.locator("#view-inst h1").waitFor();
   expect(await page.evaluate(()=>document.documentElement.dataset.clientProof)).toBe("same-document");expect(errors).toEqual([]);
  }finally{await browser.close();}
 },90_000);
});
