import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { exigirBuild, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

/**
 * Alternativa por teclado ao mapa municipal do consignado. Reescrito em 10/11/2026 para a página nova: por decisão do dono dessa data,
 * fechada a paridade (docs/familias/PARIDADE.md), /observatorio/payroll-lending-aging redireciona (308) para
 * /divida-das-familias/consignado e a vista antiga (#cg-mapa .penmapa, #cg-tabela-mapa) não é mais desenhada. As asserções presas aos
 * ids e classes da vista antiga foram aposentadas por esse motivo; a garantia é a mesma e é conferida na página nova: o mapa não cria
 * milhares de paradas de teclado, a tabela com busca abre o perfil de município fora da lista dos 25 maiores, o foco vai ao perfil, a
 * comparação cresce e "Voltar à busca" devolve o foco ao campo, com o texto digitado.
 */
let servidor: ServidorProducao;
beforeAll(async () => {
  if (!temBuild) {
    if (exigirBuild) throw Error("Build obrigatório ausente");
    return;
  }
  servidor = await subirServidor("cg-mapa-teclado");
}, 90_000);
afterAll(async () => {
  await servidor?.parar();
});

describe.skipIf(!temBuild && !exigirBuild)("Mapa municipal do consignado: alternativa completa por teclado", () => {
  it("busca abre perfis fora do ranking, compara e retorna sem milhares de paradas", async () => {
    const browser = await chromium.launch({ channel: "chromium", executablePath: process.env.I18N_CHROMIUM_EXECUTABLE });
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "scrutiniums_session", value: servidor.cookie, url: servidor.origem }]);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    try {
      await page.goto(servidor.origem + "/observatorio/payroll-lending-aging");
      expect(new URL(page.url()).pathname).toBe("/divida-das-familias/consignado");
      const abrir = page.getByRole("button", { name: "Abrir o mapa e a busca de municípios" });
      await abrir.focus();
      await page.keyboard.press("Enter");
      const raiz = page.locator('[data-explorador-municipios="pronto"]');
      await raiz.waitFor({ timeout: 60_000 });
      await raiz.locator('[data-mapa-municipios="pronto"]').waitFor({ timeout: 60_000 });
      const semMilhares = async () => expect(await raiz.locator("[data-mapa-municipios] svg [tabindex]:not(svg)").count()).toBe(0);
      await semMilhares();
      const base = JSON.parse(readFileSync("public/obs/data/gold/consignado_mun.json", "utf8")).municipios as Array<{ c: string; n: string; uf: string; sel: string; p60: number | null }>;
      const ranking = await raiz.getByRole("list", { name: /Os 25 maiores valores/ }).locator("button").allInnerTexts();
      const alvos = base.filter((m) => m.sel !== "baixa" && m.p60 != null && !ranking.some((t) => t.includes(m.n))).slice(0, 2);
      expect(alvos).toHaveLength(2);
      const resumo = page.locator("[data-tabela-municipios] summary");
      await resumo.focus();
      await page.keyboard.press("Enter");
      const busca = page.getByRole("searchbox", { name: "Buscar município ou UF" });
      for (let i = 0; i < alvos.length; i++) {
        const m = alvos[i];
        await busca.focus();
        await busca.fill(`${m.n} ${m.uf}`);
        const botao = page.locator("[data-tabela-municipios]").getByRole("button", { name: `Abrir perfil de ${m.n} (${m.uf})`, exact: true });
        await botao.waitFor();
        expect(await page.locator("[data-tabela-municipios] tbody tr").count()).toBe(1);
        expect(await page.locator("[data-tabela-municipios] tbody").innerText()).toContain(`${(m.p60 as number).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
        // do campo de busca ao nome do município só pelo Tab, sem atravessar polígonos do mapa
        let tabs = 0;
        while (!(await botao.evaluate((e) => e === document.activeElement)) && tabs++ < 8) await page.keyboard.press("Tab");
        expect(await botao.evaluate((e) => e === document.activeElement)).toBe(true);
        await page.keyboard.press(i ? "Space" : "Enter");
        // o foco vai ao título do perfil, que passa a nomear a comparação
        await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("perfil-municipal-titulo");
        await expect.poll(() => page.getByRole("button", { name: /^Remover .* da comparação$/ }).count()).toBe(i + 1);
        expect(await page.locator("section[aria-labelledby=perfil-municipal-titulo]").innerText()).toContain(m.n);
        await semMilhares();
        const voltar = page.getByRole("button", { name: "Voltar à busca de municípios" });
        await voltar.focus();
        await page.keyboard.press("Space");
        await expect.poll(() => busca.evaluate((e) => e === document.activeElement)).toBe(true);
        expect(await busca.inputValue()).toBe(`${m.n} ${m.uf}`);
      }
      expect(new URL(page.url()).searchParams.get("cgmun")?.split(",").sort()).toEqual(alvos.map((m) => m.c).sort());
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await browser.close();
    }
  }, 180_000);
});
