// Coleta do que o navegador exibe, para uma lista de URLs (avaliador de dados, rodada 3).
// Uso: node coleta_navegador.mjs entrada.json saida.jsonl [concorrencia]
// entrada: [{id, url, csv:true|false, csvBotao:"texto do botão"}]
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const [,, entrada, saida, conc = "4"] = process.argv;
const itens = JSON.parse(fs.readFileSync(entrada, "utf-8"));
const BASE = "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const out = fs.createWriteStream(saida, { flags: "w" });
let i = 0;
async function worker() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) erros.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => erros.push("pageerror " + e.message));
  while (i < itens.length) {
    const it = itens[i++];
    const t0 = Date.now();
    erros.length = 0;
    let reg = { id: it.id, url: it.url };
    try {
      await p.goto(BASE + it.url, { waitUntil: "domcontentloaded" });
      await p.waitForFunction(() => !document.documentElement.hasAttribute("data-recorte"), null, { timeout: 20000 });
      await p.waitForSelector("main h2, main h1", { timeout: 10000 });
      await p.waitForTimeout(Number(process.env.REPOUSO ?? 150));
      reg.texto = await p.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText);
      reg.tabelas = await p.evaluate(() => [...document.querySelectorAll("main table")].map((t) => ({
        legenda: t.querySelector("caption")?.innerText ?? "",
        cab: [...t.querySelectorAll("thead th")].map((x) => (x.innerText || x.textContent).trim()),
        linhas: [...t.querySelectorAll("tbody tr")].map((r) => [...r.querySelectorAll("th,td")].map((c) => (c.innerText || c.textContent).trim())),
        rodape: [...t.querySelectorAll("tfoot tr")].map((r) => [...r.querySelectorAll("th,td")].map((c) => c.innerText.trim())),
      })));
      reg.h = await p.evaluate(() => [...document.querySelectorAll("main h1, main h2, main h3")].map((h) => ({ n: h.tagName, id: h.id, t: h.innerText })));
      reg.url_final = p.url().replace(BASE, "");
      if (it.csv) {
        const botoes = it.csvBotoes ?? ["Baixar estes valores \\(CSV\\)"];
        reg.csvs = {};
        for (const nome of botoes) {
          const loc = p.getByRole("button", { name: new RegExp(nome, "i") }).first();
          if (await loc.count()) {
            const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 8000 }), loc.click()]);
            const path = await dl.path();
            reg.csvs[nome] = { arquivo: dl.suggestedFilename(), conteudo: fs.readFileSync(path, "utf-8") };
          } else reg.csvs[nome] = null;
        }
      }
    } catch (e) {
      reg.erro = String(e.message ?? e).slice(0, 300);
    }
    reg.console = [...erros];
    reg.ms = Date.now() - t0;
    out.write(JSON.stringify(reg) + "\n");
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: Number(conc) }, worker));
out.end();
await b.close();
