import { existsSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
import { aguardarHome, criarNavegadorI18n, type NavegadorI18n } from "./suporte/i18n-browser";

const temBuild = existsSync(".next/BUILD_ID");
const exigir = process.env.EXIGIR_BUILD_HTML === "1";
let ambiente: NavegadorI18n;
beforeAll(async () => {
  if (!temBuild && !exigir) return;
  expect(temBuild, "É necessário npm run build para verificar a rede real das mídias").toBe(true);
  ambiente = await criarNavegadorI18n();
}, 90_000);
afterAll(async () => { await ambiente?.fechar(); });

it.skipIf(!temBuild && !exigir).each(["/", "/en"])("%s adia imagens recolhidas e fontes estendidas sem perder conteúdo", async (caminho) => {
  const contexto = await ambiente.contexto();
  try {
    const pagina = await contexto.newPage();
    await pagina.setViewportSize({ width: 390, height: 844 });
    const imagensPedidas: string[] = [];
    pagina.on("request", r => { if (/\/home\/[^/]+\.(webp|svg)$/.test(new URL(r.url()).pathname)) imagensPedidas.push(r.url()); });
    await pagina.goto(ambiente.origem + caminho);
    await aguardarHome(pagina);
    await pagina.waitForLoadState("networkidle");
    expect(imagensPedidas, "Lâminas fechadas não devem disputar a rede inicial").toEqual([]);
    const fontes = () => pagina.evaluate(() => Array.from(document.fonts).filter(f => f.family.includes("Extended")).map(f => f.status));
    expect(await fontes()).toEqual(["unloaded", "unloaded", "unloaded"]);

    // Caracteres usuais e estendidos usam as mesmas famílias, sem cair silenciosamente em fonte de sistema.
    const cdp = await contexto.newCDPSession(pagina);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    for (const [i, classe] of ["font-serif", "font-sans", "font-label"].entries()) {
      await pagina.evaluate(({ i, classe }) => {
        const p = document.createElement("p"); p.id = `prova-fonte-${i}`; p.className = classe;
        p.textContent = "São Luís, ação, inflação — R$ 1.234,56 − 2%";
        document.body.prepend(p);
      }, { i, classe });
      await pagina.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#prova-fonte-${i}` });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every(f => f.isCustomFont), JSON.stringify(fonts)).toBe(true);
    }
    expect(await fontes(), "Português e símbolos correntes cabem no subset latino").toEqual(["unloaded", "unloaded", "unloaded"]);
    await pagina.evaluate(() => document.querySelectorAll('[id^="prova-fonte-"]').forEach(p => { p.textContent = "Łódź Ā"; }));
    await pagina.waitForFunction(() => Array.from(document.fonts).filter(f => f.family.includes("Extended")).every(f => f.status === "loaded"));
    for (let i = 0; i < 3; i++) {
      await pagina.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const { root } = await cdp.send("DOM.getDocument");
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#prova-fonte-${i}` });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      expect(fonts.every(f => f.isCustomFont), JSON.stringify(fonts)).toBe(true);
    }
    await pagina.evaluate(() => document.querySelectorAll('[id^="prova-fonte-"]').forEach(p => p.remove()));

    const indice = pagina.locator('nav details').filter({ has: pagina.locator('img[src^="/home/"]') });
    await indice.locator("summary").click();
    const imagens = indice.locator("img");
    expect(await imagens.count()).toBeGreaterThan(0);
    for (const imagem of await imagens.all()) {
      await imagem.scrollIntoViewIfNeeded();
      await expect.poll(() => imagem.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    }
    expect(imagensPedidas.length).toBeGreaterThan(0);
  } finally { await contexto.close(); }
}, 60_000);
