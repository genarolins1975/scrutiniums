import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { subirServidor, temBuild, exigirBuild, type ServidorProducao } from "./suporte/servidor-producao";

const gold=JSON.parse(readFileSync('public/obs/data/gold/pix.json','utf8')) as {epae:{setores:Array<{setor:string;v:number}>}};
let servidor:ServidorProducao;
beforeAll(async()=>{if(temBuild||exigirBuild) servidor=await subirServidor('pix-rankings');},90_000);
afterAll(async()=>{await servidor?.parar();});

describe.skipIf(!temBuild&&!exigirBuild)('Pix: identificação integral nos rankings',()=>{
  it.each([16,32])('separa nomes e medidas com fonte nativa de %ipx nas quatro larguras',async fonte=>{
    const profile=mkdtempSync(tmpdir()+'/pix-rankings-');mkdirSync(profile+'/Default');
    writeFileSync(profile+'/Default/Preferences',JSON.stringify({webkit:{webprefs:{default_font_size:fonte,default_fixed_font_size:fonte===16?13:26}}}));
    // Chromium completo lê Preferences; o headless-shell padrão não aplica a fonte nativa no CI.
    const context=await chromium.launchPersistentContext(profile,{channel:'chromium',executablePath:process.env.I18N_CHROMIUM_EXECUTABLE,headless:true,reducedMotion:'reduce'});
    await context.addCookies([{name:'scrutiniums_session',value:servidor.cookie,url:servidor.origem}]);
    const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    const medirKpis=()=>page.locator('.view.active .pan-kpi-rem').evaluateAll(groups=>groups.map(group=>({
      textos:[...group.children].map(cell=>cell.textContent!),
      falhas:[...group.children].flatMap(cell=>{
        const area=cell.getBoundingClientRect(),bad:Array<{texto:string;left:number;right:number;area:[number,number]}>=[];
        const walker=document.createTreeWalker(cell,NodeFilter.SHOW_TEXT);let node;
        while(node=walker.nextNode()){
          if(!node.textContent?.trim()||node.parentElement?.closest('.sr-only'))continue;
          const range=document.createRange();range.selectNodeContents(node);
          for(const r of Array.from(range.getClientRects()))if(r.width>0&&(r.left<area.left-1||r.right>area.right+1))bad.push({texto:node.textContent,left:r.left,right:r.right,area:[area.left,area.right]});
        }
        return bad;
      })
    })));
    let leituraReferencia:string[]|undefined;
    let notasReferencia:string[]|undefined;
    let pulsoReferencia:string[]|undefined;
    let instituicoesReferencia:string[][]|undefined;
    let kpisReferencia:string[][]|undefined;
    let referencia:Array<{nome:string;medidas:string;escala:string}>|undefined;
    try{
      for(const width of [1440,768,390,320]){
        await page.setViewportSize({width,height:900});await page.goto(servidor.origem+'/observatorio/pix');
        await page.locator('#view-pix .panbar').first().waitFor();await page.evaluate(()=>document.fonts.ready);
        expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))).toBe(fonte);
        // A normalização editorial de datas ocorre após o render; comparar o estado apresentado.
        await expect.poll(async()=>(await page.locator('#view-pix .pan-kpi-rem').allTextContents()).join(' ')).not.toMatch(/\b\d{4}-(?:\d{2}|T[1-4])\b/);
        // Grupos de medidas também refluem: síntese, setor selecionado e último mês do MED.
        const kpis=await medirKpis();
        expect(kpis).toHaveLength(3);
        expect(kpis.flatMap(g=>g.falhas)).toEqual([]);
        if(!kpisReferencia)kpisReferencia=kpis.map(g=>g.textos);else expect(kpis.map(g=>g.textos)).toEqual(kpisReferencia);
        const leitura=page.locator('#view-pix .pxstats');
        await expect.poll(async()=>(await leitura.textContent())||'').not.toMatch(/\b\d{4}-\d{2}\b/);
        const linhas=await leitura.locator(':scope > div').evaluateAll(nodes=>nodes.map(row=>{
          const area=row.getBoundingClientRect(),grupo=row.parentElement!.getBoundingClientRect(),card=row.closest('.card')!.getBoundingClientRect();
          const campos=[...row.children].map(field=>{
            const r=field.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(field);
            return {texto:field.textContent!,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
              integral:Array.from(range.getClientRects()).every(t=>t.left>=area.left-1&&t.right<=area.right+1)};
          });
          const a=campos[0],b=campos[1];
          return {texto:row.textContent!,contido:area.left>=grupo.left-1&&area.right<=grupo.right+1&&area.left>=card.left&&area.right<=card.right,
            campos,semColisao:a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top};
        }));
        expect(linhas).toHaveLength(4);
        expect(linhas.filter(l=>!l.contido||!l.semColisao||l.campos.some(c=>!c.integral))).toEqual([]);
        const textosLeitura=linhas.map(l=>l.texto);
        if(!leituraReferencia)leituraReferencia=textosLeitura;else expect(textosLeitura).toEqual(leituraReferencia);
        const bars=page.locator('#view-pix .panbar');
        const medidas=await bars.evaluateAll(nodes=>nodes.map(n=>{
          const spans=n.querySelectorAll(':scope > span'),label=spans[0],value=spans[spans.length-1],track=n.querySelector('.track')!;
          const a=label.getBoundingClientRect(),b=value.getBoundingClientRect(),t=track.getBoundingClientRect(),r=n.getBoundingClientRect();
          const l=document.createRange(),v=document.createRange();l.selectNodeContents(label);v.selectNodeContents(value);
          const lt=l.getBoundingClientRect(),vt=v.getBoundingClientRect();
          return {nome:label.textContent!,medidas:value.textContent!,escala:(track.querySelector('.fill') as HTMLElement|null)?.style.width||'',
            integral:lt.left>=r.left-1&&lt.right<=r.right+1&&vt.left>=r.left-1&&vt.right<=r.right+1,
            separado:(a.bottom<=b.top||a.right<=b.left)&&Math.max(a.bottom,b.bottom)<=t.top,compacto:a.right<=b.left&&a.top<b.bottom&&b.top<a.bottom,largura:t.width,externo:r.left<0||r.right>innerWidth+1};
        }));
        expect(medidas.length).toBeGreaterThan(30);
        if(fonte===16&&width===1440)expect(medidas.some(m=>m.compacto)).toBe(true);
        expect(medidas.filter(m=>!m.integral||!m.separado||m.externo)).toEqual([]);
        const conteudo=medidas.map(({nome,medidas,escala})=>({nome,medidas,escala}));
        if(!referencia)referencia=conteudo;else expect(conteudo).toEqual(referencia);
        const canto=page.locator('#view-pix .px-setor-matriz thead th').first();
        expect(await canto.textContent()).toBe('Pagador ↓Recebedor →');
        expect(await canto.evaluate(th=>{
          const box=th.getBoundingClientRect(),walker=document.createTreeWalker(th,NodeFilter.SHOW_TEXT);let node;
          while(node=walker.nextNode()){const range=document.createRange();range.selectNodeContents(node);if(Array.from(range.getClientRects()).some(r=>r.left<box.left-1||r.right>box.right+1))return false;}
          return true;
        })).toBe(true);
        const ranking=page.locator('#px-epae .card').filter({has:page.getByRole('heading',{name:'Setores que mais recebem via Pix',exact:true})});
        const nomes=await ranking.locator('.panbar > span:first-child').allTextContents();
        const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        expect(nomes.map(norm)).toEqual(gold.epae.setores.slice(0,14).map(s=>norm(s.setor)));
        const escalas=await ranking.locator('.panbar .fill').evaluateAll(nodes=>nodes.map(n=>parseFloat((n as HTMLElement).style.width)));
        const max=Math.max(...gold.epae.setores.map(s=>s.v));
        escalas.forEach((p,i)=>expect(p).toBeCloseTo(gold.epae.setores[i].v/max*100,3));
        const widths=await ranking.locator('.panbar .track').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
        expect(Math.max(...widths)-Math.min(...widths)).toBeLessThanOrEqual(1);
        await page.goto(servidor.origem+'/observatorio/institutions');
        await page.locator('#view-institutions .pan-kpi-rem').waitFor();await page.evaluate(()=>document.fonts.ready);
        const cabecalhos=page.locator('#view-institutions .inst-ranking thead th');
        expect(await cabecalhos.count()).toBe(7);
        const contencao=await cabecalhos.evaluateAll(ths=>ths.flatMap((th,index)=>{
          const area=th.getBoundingClientRect(),falhas:Array<{index:number;texto:string;tipo:string}>=[];
          for(const seal of Array.from(th.querySelectorAll('.seal'))){const r=seal.getBoundingClientRect();if(r.left<area.left-1||r.right>area.right+1)falhas.push({index,texto:seal.textContent!,tipo:'selo fora da célula'});}
          const walker=document.createTreeWalker(th,NodeFilter.SHOW_TEXT);let node;
          while(node=walker.nextNode()){
            if(!node.textContent?.trim()||node.parentElement?.closest('.sr-only'))continue;
            const range=document.createRange();range.selectNodeContents(node);
            for(const r of Array.from(range.getClientRects()))if(r.width>0&&(r.left<area.left-1||r.right>area.right+1||r.top<area.top-1||r.bottom>area.bottom+1))falhas.push({index,texto:node.textContent,tipo:'texto fora da célula'});
          }
          return falhas;
        }));
        expect(contencao).toEqual([]);
        const selo=cabecalhos.nth(3).locator('.seal');expect(await selo.getAttribute('data-natureza')).toBe('OBSERVADO');
        expect(await selo.evaluate(e=>{
          const texto=Array.from(e.childNodes).find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim())!;
          const range=document.createRange();range.selectNodeContents(texto);
          return Array.from(range.getClientRects()).filter(r=>r.width>0).length;
        })).toBe(1);
        const rolagem=page.locator('#view-institutions .tblwrap').filter({has:page.locator('.inst-ranking')});
        const limites=await rolagem.evaluate(e=>({max:e.scrollWidth-e.clientWidth,passo:Math.max(40,e.clientWidth-40)}));
        const vistos=new Set<number>();
        for(let x=0;x<limites.max+limites.passo;x+=limites.passo){
          await rolagem.evaluate((e,x)=>{e.scrollLeft=x;scrollTo(0,e.getBoundingClientRect().top+scrollY-300);},Math.min(x,limites.max));
          const pintura=await rolagem.evaluate(e=>{
            const area=e.getBoundingClientRect(),vistos:number[]=[],falhas:string[]=[];
            e.querySelectorAll('thead th').forEach((th,index)=>{
              const walker=document.createTreeWalker(th,NodeFilter.SHOW_TEXT);let node;
              while(node=walker.nextNode()){
                if(!node.textContent?.trim()||node.parentElement?.closest('.sr-only'))continue;
                const range=document.createRange();range.selectNodeContents(node);
                for(const r of Array.from(range.getClientRects())){
                  const left=Math.max(r.left,area.left+2),right=Math.min(r.right,area.right-2),y=(r.top+r.bottom)/2;
                  if(right-left<3||y<area.top+1||y>area.bottom-1||y<0||y>innerHeight)continue;
                  vistos.push(index);if(document.elementFromPoint((left+right)/2,y)?.closest('th')!==th)falhas.push(index+': '+node.textContent);
                }
              }
            });return{vistos,falhas};
          });
          pintura.vistos.forEach(i=>vistos.add(i));expect(pintura.falhas).toEqual([]);
        }
        expect([...vistos].sort()).toEqual([0,1,2,3,4,5,6]);
        const cooperativas=await medirKpis();expect(cooperativas).toHaveLength(1);
        expect(cooperativas[0].textos).toHaveLength(4);
        expect(cooperativas.flatMap(g=>g.falhas)).toEqual([]);
        if(!instituicoesReferencia)instituicoesReferencia=cooperativas.map(g=>g.textos);else expect(cooperativas.map(g=>g.textos)).toEqual(instituicoesReferencia);
        const notas=await page.locator('#view-institutions .note').evaluateAll(nodes=>nodes.map(e=>{
          const area=e.getBoundingClientRect(),falhas:string[]=[];const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;
          while(node=walker.nextNode()){
            if(!node.textContent?.trim()||node.parentElement?.closest('.sr-only'))continue;
            const range=document.createRange();range.selectNodeContents(node);
            if(Array.from(range.getClientRects()).some(r=>r.width>0&&(r.left<area.left-1||r.right>area.right+1)))falhas.push(node.textContent);
          }return{texto:e.textContent!,falhas};
        }));
        expect(notas.some(n=>n.texto.includes('— acompanhamento:'))).toBe(true);
        expect(notas.flatMap(n=>n.falhas)).toEqual([]);
        if(!notasReferencia)notasReferencia=notas.map(n=>n.texto);else expect(notas.map(n=>n.texto)).toEqual(notasReferencia);
        await page.goto(servidor.origem+'/observatorio/credit');
        await page.locator('#view-pulse .abertura .kpirow .big').first().waitFor();await page.evaluate(()=>document.fonts.ready);
        const pulso=await page.locator('#view-pulse .abertura .kpirow .big').evaluateAll(nodes=>nodes.map(e=>{
          const area=e.closest('.card')!.getBoundingClientRect(),falhas:string[]=[];const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let node;
          while(node=walker.nextNode()){
            const texto=node.textContent||'',range=document.createRange();range.selectNodeContents(node);
            if(Array.from(range.getClientRects()).some(r=>r.width>0&&(r.left<area.left-1||r.right>area.right+1)))falhas.push('fora: '+texto);
            const re=/[0-9][0-9.,]*/g;let match;
            while(match=re.exec(texto)){range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);if(Array.from(range.getClientRects()).filter(r=>r.width>0).length!==1)falhas.push('número dividido: '+match[0]);}
          }return{texto:e.textContent!,falhas};
        }));
        expect(pulso).toHaveLength(4);expect(pulso.flatMap(p=>p.falhas)).toEqual([]);
        if(!pulsoReferencia)pulsoReferencia=pulso.map(p=>p.texto);else expect(pulso.map(p=>p.texto)).toEqual(pulsoReferencia);

      }
      await page.goto(servidor.origem+'/observatorio/pix');
      // O ranking continua sendo um controle por teclado, além da leitura visual.
      const ranking=page.locator('#px-epae .card').filter({has:page.getByRole('heading',{name:'Setores que mais recebem via Pix',exact:true})});
      const alvo=ranking.locator('[role="button"]').nth(2);await alvo.focus();await page.keyboard.press('Enter');
      await expect.poll(()=>new URL(page.url()).searchParams.get('xsetor')).toBe(gold.epae.setores[2].setor);
      expect(await ranking.locator('[role="button"]').nth(2).evaluate(e=>e===document.activeElement)).toBe(true);
      const familias=page.locator('#px-epae .card').filter({has:page.locator('h4',{hasText:'O que as famílias pagam a cada setor'})});
      const detalhe=familias.locator('[role="button"]').nth(1);const acao=await detalhe.getAttribute('onclick');
      await detalhe.focus();await page.keyboard.press('Space');
      await expect.poll(()=>new URL(page.url()).searchParams.get('xsetorTE')).not.toBeNull();
      expect(await familias.locator('[role="button"]').nth(1).getAttribute('onclick')).toBe(acao);
      expect(await familias.locator('[role="button"]').nth(1).evaluate(e=>e===document.activeElement)).toBe(true);
      expect(errors).toEqual([]);
    }finally{await context.close();rmSync(profile,{recursive:true,force:true});}
  },120_000);
});
