import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {chromium} from "playwright";
import {readFileSync} from "node:fs";
import {exigirBuild,subirServidor,temBuild,type ServidorProducao} from "./suporte/servidor-producao";
let servidor:ServidorProducao;
beforeAll(async()=>{if(!temBuild){if(exigirBuild)throw Error("Build obrigatório ausente");return;}servidor=await subirServidor("cg-mapa-teclado");},90_000);
afterAll(async()=>{await servidor?.parar();});
describe.skipIf(!temBuild&&!exigirBuild)("Mapa municipal: alternativa completa por teclado",()=>{
 it("busca abre perfis fora do ranking, compara e retorna sem milhares de paradas",async()=>{
  const browser=await chromium.launch({channel:"chromium",executablePath:process.env.I18N_CHROMIUM_EXECUTABLE});const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:"reduce"});await context.addCookies([{name:"scrutiniums_session",value:servidor.cookie,url:servidor.origem}]);const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  try{
   await page.goto(servidor.origem+"/observatorio/payroll-lending-aging");await page.locator("#cg-mapa .penmapa path[onclick]").first().waitFor();
   const base=JSON.parse(readFileSync("public/obs/data/gold/consignado_mun.json","utf8")).municipios as Array<{c:string;n:string;uf:string;sel:string;p60:number|null}>;
   const ranking=await page.locator("#cg-mapa .penrank button").evaluateAll(bs=>bs.map(b=>b.getAttribute("onclick")));
   const alvos=base.filter(m=>m.sel!=="baixa"&&!ranking.includes(`cgSel('${m.c}')`)).slice(0,2);expect(alvos).toHaveLength(2);
   const focados=()=>page.evaluate(()=>document.activeElement?.id||document.activeElement?.getAttribute("aria-label")||document.activeElement?.tagName);
   const conferirSemMilhares=async()=>expect(await page.locator("#cg-mapa .penmapa [tabindex='0']").count()).toBe(0);
   await conferirSemMilhares();
   await page.locator("#cg-mapa button[onclick=\"cgFiltra('conf','todas')\"]").click();await conferirSemMilhares();
   await page.locator("#cg-mapa button[onclick=\"cgFiltra('conf','todas')\"]").focus();await page.keyboard.press("Tab");expect(await page.evaluate(()=>document.activeElement?.matches("#cg-tabela-mapa summary"))).toBe(true);
   await page.keyboard.press("Enter");await page.keyboard.press("Tab");expect(await focados()).toBe("cg-tabela-busca");
   for(let i=0;i<alvos.length;i++){
    const m=alvos[i];await page.locator("#cg-tabela-busca").fill(m.n+" "+m.uf);
    const button=page.getByRole("button",{name:`Abrir perfil de ${m.n} (${m.uf})`,exact:true});await button.waitFor();
    expect(await page.locator("#cg-tabela-linhas tr").count()).toBe(1);
    expect(await page.locator("#cg-tabela-linhas").innerText()).toContain(m.p60==null?"n.d.":m.p60.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%");
    // CSV e eventual região rolável antecedem a ação; não atravessa polígonos.
    let tabs=0;while(!await button.evaluate(e=>e===document.activeElement)&&tabs++<4)await page.keyboard.press("Tab");expect(await button.evaluate(e=>e===document.activeElement)).toBe(true);
    await page.keyboard.press(i?"Space":"Enter");await expect.poll(()=>page.locator("#cg-perfil .cgchip").count()).toBe(i+1);
    expect(await page.evaluate(()=>document.activeElement?.matches("#cg-perfil h3"))).toBe(true);
    expect(await page.locator("#cg-perfil").innerText()).toContain(m.n);await conferirSemMilhares();
    await page.keyboard.press("Tab");expect(await page.evaluate(()=>document.activeElement?.textContent)).toBe("Voltar à busca de municípios");
    await page.keyboard.press("Space");expect(await focados()).toBe("cg-tabela-busca");await expect.poll(()=>page.locator("#cg-tabela-busca").evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;})).toBe(true);expect(await page.locator("#cg-tabela-busca").inputValue()).toBe(m.n+" "+m.uf);
    await page.keyboard.press("Shift+Tab");expect(await page.evaluate(()=>document.activeElement?.matches("#cg-tabela-mapa summary"))).toBe(true);await page.keyboard.press("Tab");
   }
   await page.locator("#cg-tabela-busca").fill("alto");await expect.poll(()=>page.locator("#cg-tabela-linhas button").count()).toBe(50);
   await page.keyboard.press("Tab");expect(await focados()).toBe("cg-tabela-proxima");await page.keyboard.press("Enter");expect(await focados()).toBe("cg-tabela-anterior");await page.keyboard.press("Space");expect(await focados()).toBe("cg-tabela-proxima");
   const [download]=await Promise.all([page.waitForEvent("download"),(async()=>{await page.keyboard.press("Tab");await page.keyboard.press("Enter");})()]);const csv=readFileSync((await download.path())!,"utf8");
   const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();const filtrados=base.filter(m=>norm(m.n+" "+m.uf).includes("alto"));
   const linhas=csv.replace(/^\uFEFF/,"").trimEnd().split("\n").filter(l=>!l.startsWith("#")).slice(1);expect(linhas).toHaveLength(filtrados.length);filtrados.forEach((m,i)=>{expect(linhas[i]).toContain(m.n);expect(linhas[i]).toContain(m.p60==null?"":m.p60.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%");});
   expect(errors).toEqual([]);
  }finally{await context.close();await browser.close();}
 },120_000);
});
