// Linha de base das respostas de abertura (uso próprio, fora do rubric): em Entender, 1440 px, mede para cada página o
// texto visível de cada resposta curta (elementos com atributo data-resposta*), com palavras e números, e o parágrafo do
// cabeçalho. Serve para comparar antes e depois do trabalho de conteúdo; não mede se a resposta é compreensível.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE);
const BASE = process.env.BASE || "http://localhost:3100";
const SAIDA = process.argv[2];
if (!SAIDA || !process.env.PW_CORE) { console.error("uso: PW_CORE=<playwright-core> BASE=http://localhost:3100 node scripts/energia-aberturas.mjs <saida.json>"); process.exit(2); }
const rotas = readFileSync("docs/observatorios/energia/avaliacao/rotas.txt", "utf-8").split("\n").map((s) => s.trim()).filter(Boolean);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
const saida = [];
for (const rota of rotas) {
  const p = await ctx.newPage();
  try {
    await p.goto(`${BASE}${rota}${rota.includes("?") ? "&" : "?"}modo=entender`, { waitUntil: "networkidle", timeout: 60000 });
    await p.waitForFunction(() => { const e = document.querySelector(".modo-profundidade"); return !e || e.getAttribute("data-modo") !== "todos"; }, null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const main = document.querySelector("main");
      const visivel = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
      const tem = (e) => [...e.attributes].some((a) => a.name.startsWith("data-resposta"));
      const nums = (t) => (t.match(/\d[\d.,]*\d|\d/g) ?? []).length;
      const pal = (t) => t.trim().split(/\s+/).filter(Boolean).length;
      const respostas = [...main.querySelectorAll("*")].filter((e) => tem(e) && visivel(e)).map((e) => {
        const t = e.innerText.replace(/\s+/g, " ").trim();
        return { id: [...e.attributes].find((a) => a.name.startsWith("data-resposta"))?.value || "", palavras: pal(t), numeros: nums(t), texto: t };
      });
      const lead = main.querySelector(".cab-lead, header p");
      const lt = lead ? lead.innerText.replace(/\s+/g, " ").trim() : "";
      return { respostas, lead: { palavras: pal(lt), numeros: nums(lt), texto: lt } };
    });
    saida.push({ rota, ...r });
  } catch (e) {
    saida.push({ rota, erro: String(e).slice(0, 200) });
  }
  await p.close();
}
await b.close();
writeFileSync(SAIDA, JSON.stringify(saida, null, 1));
const com = saida.filter((s) => s.respostas?.length);
const pal = com.map((s) => s.respostas[0].palavras).sort((a, c) => a - c);
const num = com.map((s) => s.respostas[0].numeros).sort((a, c) => a - c);
const med = (v) => v[Math.floor(v.length / 2)];
console.log(`${saida.length} rotas; ${com.length} com resposta curta visível`);
console.log(`primeira resposta: palavras mediana ${med(pal)}, acima de 60 palavras ${pal.filter((x) => x > 60).length}; números mediana ${med(num)}, com mais de 8 números ${num.filter((x) => x > 8).length}`);
