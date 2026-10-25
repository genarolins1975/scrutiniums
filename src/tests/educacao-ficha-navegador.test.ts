import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { aguardarHidratacao, aguardarSessaoResolvida } from "../../scripts/ux-cromo-medida.mjs";
import { subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";
import { consultarMunicipio, goldEducacao } from "@/lib/educacao/dados";

/** Pedido do dono (PROMPT_CODEX_EDUCACAO.md, PR 1, 25/10/2026): cidade antes da escala,
 * ficha protegida e laboratório operável por teclado. Asserções de estrutura, valores e acesso. */
describe.skipIf(!temBuild)("Educação: resumo e ficha no navegador", () => {
  let servidor: ServidorProducao;
  let navegador: Browser;
  beforeAll(async () => {
    servidor = await subirServidor("educacao-ficha");
    navegador = await chromium.launch({ executablePath: process.env.I18N_CHROMIUM_EXECUTABLE || undefined });
  }, 120_000);
  afterAll(async () => { await navegador?.close(); await servidor?.parar(); });
  for (const largura of [390, 768, 1440]) {
    it(`${largura}: extrato antes da escala, ficha privada e controles por teclado`, async () => {
      const contexto = await navegador.newContext({ viewport: { width: largura, height: largura === 768 ? 1024 : largura === 390 ? 844 : 900 } });
      await contexto.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
      const pagina = await contexto.newPage();
      try {
        for (const id of ["2800100", "2611606"]) {
          await pagina.goto(`${servidor.origem}/educacao-municipal`, { waitUntil: "networkidle" });
          await aguardarHidratacao(pagina);
          const busca = pagina.locator(".edm-busca").getByRole("combobox");
          await busca.fill(id === "2800100" ? "Amparo do São Francisco" : "Recife");
          await pagina.getByRole("option").first().waitFor();
          await pagina.keyboard.press("Enter");
          await pagina.waitForURL(`**/educacao-municipal?ibge=${id}`);
          expect(new URL(pagina.url()).hash).toBe("");
          await aguardarSessaoResolvida(pagina, true);
          await aguardarHidratacao(pagina);
          const medida = await pagina.evaluate(() => ({
            cidade: document.querySelector('[data-fatia="seu-municipio"]')!.getBoundingClientRect().top,
            escala: document.querySelector('[data-fatia="escala"]')!.getBoundingClientRect().top,
            altura: document.documentElement.scrollHeight,
            largura: document.documentElement.scrollWidth,
          }));
          expect(medida.cidade).toBeGreaterThanOrEqual(0);
          expect(medida.cidade).toBeLessThan(largura === 768 ? 1024 : largura === 390 ? 844 : 900);
          expect(medida.cidade).toBeLessThan(medida.escala);
          if (largura !== 768) expect(medida.altura).toBeLessThanOrEqual(largura === 390 ? 11000 : 6500);
          expect(medida.largura).toBeLessThanOrEqual(largura);
          await pagina.locator(`a[href="/educacao-municipal/municipio/${id}"]`).first().focus();
          await pagina.keyboard.press("Enter");
          await pagina.waitForURL(`**/municipio/${id}`);
          await aguardarHidratacao(pagina);
          expect(await pagina.locator(".edm-lab").count()).toBe(1);
          const consulta = consultarMunicipio(id);
          if (consulta.estado !== "ok") throw new Error("Município da prova ausente");
          const k = goldEducacao().ideb.anos.length - 1;
          const n = consulta.m.ai.municipal!.n[k]!;
          const inputs = pagina.locator('.edm-lab input[type="range"]');
          const inicial = await pagina.locator(".edm-lab-conta").textContent();
          await inputs.first().focus();
          await pagina.keyboard.press("ArrowRight");
          const exibido = await pagina.locator(".edm-lab output").first().textContent();
          expect(exibido).toBe((n + 0.1).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }));
          await pagina.locator(".edm-lab-acoes button").first().focus();
          await pagina.keyboard.press("Enter");
          expect(await inputs.nth(1).inputValue()).toBe("100");
          await pagina.locator(".edm-lab-acoes button").nth(1).focus();
          await pagina.keyboard.press("Enter");
          expect(await pagina.locator(".edm-lab-conta").textContent()).toBe(inicial);
          await pagina.locator("#tabelas-componentes > summary").focus();
          await pagina.keyboard.press("Enter");
          expect(await pagina.locator("#tabelas-componentes").getAttribute("open")).not.toBeNull();
        }
        const anonimo = await navegador.newContext({ viewport: { width: largura, height: 900 } });
        try {
          const aberta = await anonimo.newPage();
          await aberta.goto(`${servidor.origem}/educacao-municipal/municipio/2800100`, { waitUntil: "networkidle" });
          expect(new URL(aberta.url()).pathname + new URL(aberta.url()).search).toBe("/educacao-municipal?ibge=2800100");
          expect(await aberta.locator(".edm-lab, table, .edm-svg").count()).toBe(0);
          for (const rota of ["/educacao/gold/educacao.json", "/educacao/gold/municipios/SE.json", "/educacao-municipal/censo-escolar-por-municipio.csv"]) {
            const resposta = await anonimo.request.get(servidor.origem + rota, { maxRedirects: 0 });
            expect(resposta.status()).toBe(307);
            expect(resposta.headers().location).toContain("/entrar?");
          }
        } finally { await anonimo.close(); }
      } finally { await contexto.close(); }
    }, 120_000);
  }
});
