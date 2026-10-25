import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { aguardarHidratacao } from "../../scripts/ux-cromo-medida.mjs";
import { subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
import { consultarMunicipio, mapaEducacao } from "@/lib/educacao/dados";

/** Pedido do dono, PR 2: mapa e decomposição com dados reais, teclado e arquivos fechados. */
describe.skipIf(!temBuild)("Educação: análises e mapa no navegador", () => {
  let servidor: ServidorProducao;
  let navegador: Browser;
  beforeAll(async () => {
    servidor = await subirServidor("educacao-artefatos");
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
  }, 120_000);
  afterAll(async () => { await navegador?.close(); await servidor?.parar(); });
  for (const largura of [390,768,1440]) it(`${largura}: filtros por teclado, equivalência e acesso`, async () => {
    const contexto = await navegador.newContext({viewport:{width:largura,height:900}});
    await contexto.addCookies([{name:"scrutiniums_session",value:servidor.cookie,url:servidor.origem}]);
    const p = await contexto.newPage();
    try {
      await p.goto(`${servidor.origem}/educacao-municipal`,{waitUntil:"networkidle"});
      await aguardarHidratacao(p);
      const decada=p.locator('#recolhido-decada');
      const interno=decada.locator('details').first();
      const sinal=interno.locator(':scope > summary > span[aria-hidden="true"]');
      const transformacao=()=>sinal.evaluate(e=>{const m=new DOMMatrix(getComputedStyle(e,'::after').transform);return [m.a,m.b,m.c,m.d];});
      const fechado=await transformacao();
      await decada.locator(':scope > summary').click();
      expect(await interno.getAttribute('open')).toBeNull();
      expect(await transformacao()).toEqual(fechado);
      await interno.locator(':scope > summary').click();
      await expect.poll(transformacao).toEqual([0,1,-1,0]);
      await p.goto(`${servidor.origem}/educacao-municipal/municipio/2800100`,{waitUntil:"networkidle"});
      await aguardarHidratacao(p);
      const consulta = consultarMunicipio("2800100");
      if(consulta.estado!=="ok") throw new Error("Cidade de prova ausente");
      const inicio=p.locator('#variacao-ideb select').nth(1);
      const antes=await inicio.inputValue();
      await inicio.focus(); await p.keyboard.press("Home"); await p.keyboard.press("Enter");
      const escolhido=Number(await inicio.inputValue());
      expect(escolhido).toBeLessThanOrEqual(Number(antes));
      const fim=Number(await p.locator('#variacao-ideb select').nth(2).inputValue());
      const par=consulta.m.analises.ai.variacoes.find(v=>v[0]===escolhido&&v[1]===fim)!;
      expect(par).toBeDefined();
      if(par[6]!==null) expect(await p.locator('[data-decomposicao]').textContent()).toContain(Math.abs(par[6]).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}));
      await p.goto(`${servidor.origem}/educacao-municipal/mapa?uf=SE`,{waitUntil:"networkidle"});
      await aguardarHidratacao(p);
      const mapa=p.locator('[data-mapa-educacao]');
      await mapa.locator('svg').first().waitFor();
      const linhas=mapa.locator('tbody tr');
      expect(await linhas.count()).toBe(mapaEducacao().cobertura.SE.total);
      await mapa.getByRole('button',{name:'Amparo do São Francisco (SE)',exact:true}).focus();
      await p.keyboard.press("Enter");
      await p.waitForURL('**m=2800100*');
      expect(await mapa.locator('a[href="/educacao-municipal/municipio/2800100"]').count()).toBe(1);
      const etapa=mapa.getByLabel('Etapa',{exact:true});
      await etapa.focus(); await p.keyboard.press('End'); await p.keyboard.press('Enter');
      expect(await etapa.inputValue()).toBe('af');
      await p.reload({waitUntil:'networkidle'}); await aguardarHidratacao(p);
      expect(await mapa.getByLabel('Etapa',{exact:true}).inputValue()).toBe('af');
      expect(await p.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(largura);
      const anonimo=await navegador.newContext();
      try {
        for(const rota of ['/educacao-municipal/mapa','/educacao/gold/mapa.json']) {
          const resposta=await anonimo.request.get(servidor.origem+rota,{maxRedirects:0});
          expect(resposta.status()).toBe(307);
          expect(resposta.headers().location).toContain('/entrar?');
        }
      } finally {await anonimo.close();}
    } finally {await contexto.close();}
  },120_000);
});
