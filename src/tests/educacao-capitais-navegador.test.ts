import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { aguardarHidratacao } from "../../scripts/ux-cromo-medida.mjs";
import { subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
import { dadosPainel, goldEducacao } from "@/lib/eficiencia/dados";

/** Pedido do dono, PR 3: capitais à vista e seleção sincronizada com os laboratórios. */
describe.skipIf(!temBuild)("Educação nas capitais: panorama no navegador",()=>{
  let servidor:ServidorProducao;
  let navegador:Browser;
  const rota="/eficiencia-estatal/educacao-municipal-capitais";
  beforeAll(async()=>{servidor=await subirServidor("educacao-capitais");navegador=await chromium.launch({executablePath:process.env.I18N_CHROMIUM_EXECUTABLE||undefined});},120_000);
  afterAll(async()=>{await navegador?.close();await servidor?.parar();});
  for(const largura of [390,768,1440]) it(`${largura}: todas as capitais, seleção e método`,async()=>{
    const ctx=await navegador.newContext({viewport:{width:largura,height:900}});
    await ctx.addCookies([{name:"scrutiniums_session",value:servidor.cookie,url:servidor.origem}]);
    const p=await ctx.newPage();
    try {
      await p.goto(servidor.origem+rota,{waitUntil:"networkidle"});await aguardarHidratacao(p);
      const graficos=p.locator('[data-grafico="pontos"][data-rotulos]');
      expect(await graficos.count()).toBe(3);
      const n=dadosPainel(goldEducacao()!).capitais.length;
      for(const grafico of await graficos.all()) {
        expect(await grafico.locator('svg[role="group"] [data-id]').count()).toBe(n);
        expect(await grafico.locator('[data-rolagem]').getAttribute('data-rolagem')).toBe('nao');
      }
      const capital=p.locator('#panorama-cap');
      await capital.focus();await p.keyboard.press('Home');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
      const id=await capital.inputValue();
      expect(id).not.toBe('');
      await p.locator('#laboratorio-ponte').waitFor();
      expect(await p.locator('#recurso-educacao ol > li').count()).toBe(5);
      const exercicio=p.getByLabel('Exercício financeiro',{exact:true});
      await exercicio.focus(); await p.keyboard.press('Home'); await p.keyboard.press('Enter');
      const ano=await exercicio.inputValue();
      await p.waitForURL(u=>u.searchParams.get('ponte_ano')===ano);
      const etapa=p.getByLabel('Etapa para atendimento e resultados',{exact:true});
      await etapa.focus(); await p.keyboard.press('End'); await p.keyboard.press('Enter');
      expect(await etapa.inputValue()).toBe('anos_finais');
      await p.waitForURL(u=>u.searchParams.get('ponte_etapa')==='anos_finais');
      for(const grafico of await graficos.all()) expect(await grafico.locator(`svg [data-id="${id}"]`).getAttribute('aria-pressed')).toBe('true');
      await p.reload({waitUntil:'networkidle'});await aguardarHidratacao(p);
      await expect.poll(()=>capital.inputValue()).toBe(id);
      await expect.poll(()=>exercicio.inputValue()).toBe(ano);
      await expect.poll(()=>etapa.inputValue()).toBe('anos_finais');
      expect(await p.locator('#escores-servicos').count()).toBe(0);
      expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      await p.goto(servidor.origem+rota+'/metodos',{waitUntil:'networkidle'});
      expect(await p.locator('#escores-servicos').count()).toBe(1);
      expect(await p.locator('#escores-servicos a').count()).toBe(0);
    } finally {await ctx.close();}
  },120_000);
});
