import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

let servidor: ServidorProducao;
let navegador: Browser;
let contexto: BrowserContext;
beforeAll(async () => {
  if (!temBuild) { if (exigirBuild) throw new Error("Build obrigatório ausente"); return; }
  servidor = await subirServidor("credito-residual");
  navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
  contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
}, 90_000);
afterAll(async () => { await navegador?.close(); await servidor?.parar(); });

describe.skipIf(!temBuild && !exigirBuild)("Crédito: regressões da auditoria independente", () => {
  it("disclosures têm alvo real suficiente, separação e acionamento nativo por teclado", async () => {
    const page = await contexto.newPage();
    const ids = ['saldo', 'concessoes', 'taxa', 'spread', 'inad'];
    try {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({width, height: 900});
        await page.goto(servidor.origem + '/observatorio/credit?seg=total');
        await page.locator('#pu-saldo > details.charttable > summary').first().waitFor();
        const minimo = width <= 768 ? 44 : 24;
        const medidos = await page.locator('#view-pulse :is(.charttable,.decomp) > summary').evaluateAll(nodes => nodes.map(e => {
          const r = e.getBoundingClientRect(), css = getComputedStyle(e);
          return {texto:e.textContent, altura:r.height, largura:r.width, display:css.display, marcador:css.listStyleType};
        }).filter(r => r.largura > 0 && r.altura > 0));
        expect(medidos.length).toBeGreaterThan(ids.length);
        expect(medidos.filter(r => r.altura < minimo - .1 || r.largura < 24 || r.display !== 'list-item' || r.marcador === 'none')).toEqual([]);
        for (const id of ids) {
          const card = page.locator('#pu-' + id);
          const alvo = card.locator(':scope > details.charttable').filter({has: page.locator('summary', {hasText: 'Base observada completa'})});
          const summary = alvo.locator('summary');
          const espacamento = await summary.evaluate(e => {
            const anterior = e.parentElement!.previousElementSibling!;
            return e.getBoundingClientRect().top - anterior.getBoundingClientRect().bottom;
          });
          expect(espacamento).toBeGreaterThanOrEqual(7.9);
          await summary.focus(); await page.keyboard.press('Enter');
          expect(await alvo.getAttribute('open')).not.toBeNull();
          expect(await summary.evaluate(e => e === document.activeElement)).toBe(true);
          expect(await summary.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
          await page.keyboard.press('Space');
          expect(await alvo.getAttribute('open')).toBeNull();
          const box = await summary.boundingBox();
          // A área de padding deve ser acionável, não apenas o texto.
          await summary.click({position: {x: Math.min(30, box!.width / 2), y: box!.height - 3}});
          expect(await alvo.getAttribute('open')).not.toBeNull();
          await summary.click();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
    } finally { await page.close(); }
  }, 90_000);

  it("a base observada completa também abre e fecha com toque na área ampliada", async () => {
    const touch = await navegador.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await touch.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    const page = await touch.newPage();
    try {
      await page.goto(servidor.origem + '/observatorio/credit?seg=total');
      const detalhe = page.locator('#pu-saldo > details.charttable').filter({has:page.locator('summary',{hasText:'Base observada completa'})});
      const summary = detalhe.locator('summary');
      await summary.scrollIntoViewIfNeeded();
      const r = await summary.boundingBox();
      expect(r!.height).toBeGreaterThanOrEqual(44);
      await page.touchscreen.tap(r!.x + 30, r!.y + r!.height - 3);
      expect(await detalhe.getAttribute('open')).not.toBeNull();
      await summary.tap();
      expect(await detalhe.getAttribute('open')).toBeNull();
    } finally { await touch.close(); }
  }, 60_000);

  it("favoritos e links adjacentes têm alvos reais sem colisão nas tabelas", async () => {
    const page = await contexto.newPage();
    try {
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({width,height:900});
        for (const rota of ['sectors','institutions']) {
          await page.goto(servidor.origem + '/observatorio/' + rota);
          const root = '#view-' + rota;
          await page.locator(root + ' table.data .star').first().waitFor();
          const minimo = width <= 768 ? 44 : 24;
          const pares = await page.locator(root + ' table.data .star').evaluateAll(nodes => nodes.map(e => {
            const link=e.previousElementSibling!, a=link.getBoundingClientRect(), b=e.getBoundingClientRect();
            return {estrela:[b.width,b.height],link:[a.width,a.height],sobrepoe:a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top};
          }));
          expect(pares.length).toBeGreaterThan(0);
          expect(pares.filter(p => [...p.estrela,...p.link].some(n=>n<minimo-.1)||p.sobrepoe)).toEqual([]);
          const estrela = page.locator(root + ' table.data .star').first();
          await estrela.scrollIntoViewIfNeeded();
          await estrela.focus();
          expect(await estrela.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
          const classe = await estrela.getAttribute('class');
          const pressionado = await estrela.getAttribute('aria-pressed');
          expect(await estrela.getAttribute('aria-label')).toMatch(/favoritos$/);
          await page.keyboard.press('Enter');
          expect(await estrela.evaluate(e => e === document.activeElement)).toBe(true);
          await expect.poll(()=>estrela.getAttribute('class')).not.toBe(classe);
          expect(await estrela.getAttribute('aria-pressed')).toBe(pressionado === 'true' ? 'false' : 'true');
          // Clique na área ampliada devolve o estado; não se depende do glifo.
          const r = await estrela.boundingBox();
          await estrela.click({position:{x:r!.width-3,y:r!.height-3}});
          await expect.poll(()=>estrela.getAttribute('class')).toBe(classe);
          const link = page.locator(root + ' table.data td > a:has(+ .star)').first();
          const href = await link.getAttribute('href');
          await link.focus(); await page.keyboard.press('Enter');
          await page.waitForURL(url=>url.pathname===href);
          await page.goBack();
          await page.locator(root + ' table.data .star').first().waitFor();
          await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), {message:`overflow em ${rota}, ${width}px`}).toBe(true);
        }
      }
    } finally { await page.close(); }
  }, 120_000);
  it("Escape fecha ações e devolve foco ao acionador nas seis rotas", async () => {
    const page=await contexto.newPage();
    try {
      for(const width of [390,1440]) for(const rota of ['credit','pix','payroll-lending-aging','sectors','institutions','subnational-credit']) {
        await page.setViewportSize({width,height:900});
        await page.goto(servidor.origem+'/observatorio/'+rota);
        const menu=page.locator('.view.active .ph-menu'), summary=menu.locator('summary');
        await summary.focus(); await page.keyboard.press('Enter');
        await page.keyboard.press('Tab'); await page.keyboard.press('Escape');
        expect(await menu.getAttribute('open')).toBeNull();
        expect(await summary.evaluate(e=>e===document.activeElement)).toBe(true);
      }
    } finally {await page.close();}
  },90_000);

  it("URL copiada de Instituições reproduz filtros e ordem em contexto limpo", async () => {
    const page=await contexto.newPage(), limpo=await navegador.newContext();
    await limpo.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    try {
      await page.goto(servidor.origem+'/observatorio/institutions');
      await page.locator('[onclick="setFilter(\'instTipo\',\'coop\')"]').click();
      await page.locator('[onchange="setFilter(\'instGroup\', this.value)"]').selectOption('S5');
      await page.locator('[onclick="setFilter(\'sortInst\',\'nome\')"]').click();
      const antes=await page.locator('#view-institutions .inst-nome').allTextContents();
      expect(antes.length).toBeGreaterThan(0);
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:(v:string)=>{(window as unknown as Window & { __copiado: string }).__copiado=v;return Promise.resolve();}}}));
      await page.locator('#view-institutions .ph-menu summary').click();
      await page.locator('#view-institutions .ph-menu').getByRole('button',{name:'copiar URL',exact:true}).click();
      const url=await page.evaluate(()=>(window as unknown as Window & { __copiado: string }).__copiado);
      expect(new URL(url).searchParams.get('tipo')).toBe('coop');
      expect(new URL(url).searchParams.get('ordem')).toBe('nome');
      expect(new URL(url).searchParams.get('grupo')).toBe('S5');
      const nova=await limpo.newPage();await nova.goto(url);
      await nova.locator('#view-institutions .inst-nome').first().waitFor();
      expect(await nova.locator('#view-institutions .inst-nome').allTextContents()).toEqual(antes);
      expect(await nova.locator('[onchange="setFilter(\'instGroup\', this.value)"]').inputValue()).toBe('S5');
      // Uma ida e volta pelo roteador cliente: não se contam as entradas criadas pelo boot de cada documento.
      await nova.evaluate(()=>(window as unknown as Window & { nav: (vista: string) => void }).nav('pulse'));
      await nova.waitForURL('**/observatorio/credit*');
      await nova.locator('#view-pulse.active .pagehead').waitFor();
      await nova.goBack();
      await nova.waitForURL(url);
      await expect.poll(()=>nova.locator('#view-institutions .inst-nome').allTextContents()).toEqual(antes);
      await nova.goForward();await nova.waitForURL('**/observatorio/credit*');
      await nova.goBack();await nova.waitForURL(url);
      await expect.poll(()=>nova.locator('#view-institutions .inst-nome').allTextContents()).toEqual(antes);
      for(const query of ['', '?tipo=invalido&ordem=errada&grupo=desconhecido']) {
        await nova.goto(servidor.origem+'/observatorio/institutions'+query);
        await nova.locator('#view-institutions .inst-nome').first().waitFor();
        expect(await nova.locator('[onchange="setFilter(\'instGroup\', this.value)"]').inputValue()).toBe('todos');
        expect(await nova.locator('[onclick="setFilter(\'instTipo\',\'todos\')"]').getAttribute('class')).toContain('active');
        expect(await nova.locator('[onclick="setFilter(\'sortInst\',\'ativo\')"]').getAttribute('class')).toContain('active');
      }
    } finally {await page.close();await limpo.close();}
  },90_000);

  it("selos completos permanecem contidos com fonte duplicada", async () => {
    const page=await contexto.newPage();
    try {
      for(const width of [320,390,768,1440]) for(const rota of ['credit','payroll-lending-aging','pix','sectors','institutions','subnational-credit']) {
        await page.setViewportSize({width,height:900});
        await page.goto(servidor.origem+'/observatorio/'+rota);
        await page.locator('.view.active .seal').first().waitFor();
        await page.evaluate(()=>{
          const root=document.querySelector('main')!;
          const medidas=[root,...root.querySelectorAll('*')].filter(e=>{
            if(!e.getClientRects().length||!e.checkVisibility({visibilityProperty:true}))return false;
            for(let d=e.closest('details:not([open])');d;d=d.parentElement?.closest('details:not([open])')||null)if(!d.querySelector(':scope > summary')?.contains(e))return false;
            return true;
          }).map(e=>({e,font:parseFloat(getComputedStyle(e).fontSize),line:parseFloat(getComputedStyle(e).lineHeight)}));
          for(const {e,font,line} of medidas){(e as HTMLElement).style.setProperty('font-size',font*2+'px','important');if(Number.isFinite(line))(e as HTMLElement).style.setProperty('line-height',line*2+'px','important');}
        });
        // O selo pode ocupar uma linha intrínseca no TH; validar conteúdo, não a propriedade white-space.
        const problemas=await page.locator('.view.active .seal').evaluateAll(nodes=>nodes.filter(e=>e.getBoundingClientRect().width>0&&e.checkVisibility({visibilityProperty:true})).map(e=>{
          const box=e.getBoundingClientRect(),cell=e.closest('th,td')?.getBoundingClientRect(),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node:Node|null;const fora:string[]=[];
          if(cell&&(box.left<cell.left-1||box.right>cell.right+1||box.top<cell.top-1||box.bottom>cell.bottom+1))fora.push('selo fora da célula');
          while((node=walker.nextNode())){if(!node.textContent?.trim()||node.parentElement?.closest('.sr-only'))continue;const range=document.createRange();range.selectNodeContents(node);for(const r of Array.from(range.getClientRects()))if(r.width>0&&(r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1))fora.push(node.textContent);}
          return{texto:e.textContent,scroll:e.scrollWidth,client:e.clientWidth,fora};
        }).filter(e=>e.scroll>e.client+1||e.fora.length>0));
        expect(problemas,`selos em ${rota}, ${width}px`).toEqual([]);
        await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), {message:`overflow em ${rota}, ${width}px`}).toBe(true);
        if(rota==='payroll-lending-aging'&&width===768){
          const scroll=page.locator('#cg-circ .tblwrap:has(> table.cgespec)');
          await expect.poll(()=>scroll.getAttribute('tabindex')).toBe('0');
          await scroll.focus();expect(await scroll.evaluate(e=>e===document.activeElement)).toBe(true);
          await page.keyboard.press('ArrowDown');
          await expect.poll(()=>scroll.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
          const tabelas=page.locator('#cg-circ .tblwrap:has(> table.data)');
          const indice=await tabelas.evaluateAll(ns=>ns.findIndex(e=>e.scrollWidth>e.clientWidth+2));
          expect(indice).toBeGreaterThanOrEqual(0);
          const horizontal=tabelas.nth(indice);await horizontal.focus();
          expect(await horizontal.evaluate(e=>e===document.activeElement)).toBe(true);
          await page.keyboard.press('ArrowRight');
          await expect.poll(()=>horizontal.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
        }
        if(rota==='subnational-credit'&&width===768){
          const rotulo=page.locator('#view-subnacional svg text').filter({hasText:/^DCL ÷ RCL$/});
          expect(await rotulo.count()).toBe(1);
          expect(await rotulo.evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('svg')!.getBoundingClientRect();return r.right<=s.right+1&&r.left>=s.left-1;})).toBe(true);
        }
      }
    } finally {await page.close();}
  },90_000);

  it("Sobre carrega o chunk em entrada fria e preserva navegação cliente", async () => {
    const cold=await navegador.newContext();await cold.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    let pedidos=0; await cold.route('**/obs/app-emergentes.min.js*',async rota=>{pedidos++;await rota.continue();});
    const page=await cold.newPage(), erros:string[]=[];let documentos=0;
    page.on('pageerror',e=>erros.push(e.message));page.on('request',r=>{if(r.resourceType()==='document')documentos++;});
    try {
      const r=await page.goto(servidor.origem+'/observatorio/about');expect(r?.status()).toBe(200);
      await page.locator('#view-sobre.active').getByRole('heading',{name:'Sobre o Observatório',exact:true}).waitFor();
      expect(pedidos).toBe(1);
      await page.locator('#view-sobre').getByRole('link',{name:'Metodologia & Fontes',exact:true}).click();
      await page.waitForURL('**/observatorio/methodology');
      await page.goBack();
      await page.locator('#view-sobre.active').getByRole('heading',{name:'Sobre o Observatório',exact:true}).waitFor();
      expect(pedidos).toBe(1);expect(documentos).toBe(1);expect(erros).toEqual([]);
    } finally {await cold.close();}
  },60_000);

  it.each(['institutions','institutions/C0010069'])("%s oferece a fórmula inteira por teclado e toque, igual à gold", async rota => {
    const guidance = JSON.parse(readFileSync('public/obs/data/gold/guidance.json','utf8')) as {ciclos:Array<{id:string;cnpj8:string;metricas:Array<{nome:string;formula?:string}>}>};
    const ciclos = rota === 'institutions' ? guidance.ciclos : guidance.ciclos.filter(c=>c.cnpj8==='60872504');
    const formulas = new Map(ciclos.flatMap(c=>c.metricas.filter(m=>m.formula).map(m=>[c.id+'|'+m.nome,m.formula!] as const)));
    expect(formulas.size).toBeGreaterThan(0);
    const touch = await navegador.newContext({viewport:{width:320,height:900},hasTouch:true});
    await touch.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    const page=await touch.newPage();
    try {
      for(const width of [320,390,1440]) {
        await page.setViewportSize({width,height:900});
        await page.goto(servidor.origem+'/observatorio/'+rota);
        const detalhes=page.locator('.view.active details.guid-formula');
        await expect.poll(()=>detalhes.count()).toBe(formulas.size);
        for(const detalhe of await detalhes.all()) {
          const metrica=await detalhe.getAttribute('data-guid-metrica');
          const esperado=formulas.get((await detalhe.getAttribute('data-guid-ciclo'))+'|'+metrica);
          const summary=detalhe.locator('summary'), texto=detalhe.locator('p');
          expect(await summary.getAttribute('aria-label')).toBe('Como foi calculado: '+metrica);
          expect(await summary.evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
          expect(await detalhe.locator('[title], [tabindex="-1"]').count()).toBe(0);
          const valores=await detalhe.locator('xpath=ancestor::tr').locator('td').allTextContents();
          await summary.focus();await page.keyboard.press('Enter');
          expect(await detalhe.getAttribute('open')).not.toBeNull();
          expect(await summary.evaluate(e=>e===document.activeElement)).toBe(true);
          expect(await texto.isVisible()).toBe(true);expect(await texto.textContent()).toBe(esperado);
          await page.keyboard.press('Space');expect(await detalhe.getAttribute('open')).toBeNull();
          await summary.tap();expect(await detalhe.getAttribute('open')).not.toBeNull();
          expect(await texto.textContent()).toBe(esperado);
          await summary.tap();expect(await detalhe.getAttribute('open')).toBeNull();
          expect(await detalhe.locator('xpath=ancestor::tr').locator('td').allTextContents()).toEqual(valores);
        }
        if(rota.includes('/')) {
          const histograma=page.locator('#s-pares .histograma');
          if(await histograma.evaluate(e=>e.scrollWidth>e.clientWidth+2)) {
            await expect.poll(()=>histograma.getAttribute('tabindex')).toBe('0');
            await histograma.focus();await page.keyboard.press('ArrowRight');
            await expect.poll(()=>histograma.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
            expect(await histograma.evaluate(e=>e===document.activeElement)).toBe(true);
          }
        }
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      }
      // Caracteres de comparação e markup continuam texto literal, sem perda de operandos.
      const ciclo=guidance.ciclos.find(c=>c.metricas.some(m=>m.formula))!;
      const literal='(a < b) & (c > d) <em>não é HTML</em>';
      const preservado=await page.evaluate(({ciclo,literal})=>{
        const c={...ciclo,metricas:[{...ciclo.metricas.find(m=>m.formula)!,formula:literal}]};
        const html=(window as unknown as {guidCicloBloco:(c:unknown)=>string}).guidCicloBloco(c);
        const dom=new DOMParser().parseFromString(html,'text/html');
        return {texto:dom.querySelector('.guid-formula p')!.textContent,tags:dom.querySelectorAll('.guid-formula p em').length};
      },{ciclo,literal});
      expect(preservado).toEqual({texto:literal,tags:0});
    } finally {await touch.close();}
  },120_000);

});
