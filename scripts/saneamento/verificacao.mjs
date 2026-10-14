/* Verificação visual e funcional do Observatório do Saneamento contra um servidor local.
   Uso:
     COOKIE_SECRET=... SANEAMENTO_PLAYWRIGHT=/caminho/node_modules/playwright \
     node scripts/saneamento/verificacao.mjs [base] [saida] [rotas separadas por vírgula] [larguras]
   Para cada rota e largura: HTTP, um H1, erros de JavaScript, transbordamento horizontal da página e captura completa.
   Não comprova conformidade WCAG; registra o que foi verificado. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { autenticarAuditoria } from "../sessao-auditoria.mjs";

const pw = await import(process.env.SANEAMENTO_PLAYWRIGHT || "playwright");
const { chromium } = pw.chromium ? pw : pw.default;
const base = process.argv[2] || "http://localhost:3100";
const saida = process.argv[3] || "verificacao-saneamento";
const rotas = (process.argv[4] || "/saneamento").split(",");
const larguras = (process.argv[5] || "390,1440").split(",").map(Number);
mkdirSync(saida, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
autenticarAuditoria(browser, base);
const resultados = [];
for (const rota of rotas) {
  for (const largura of larguras) {
    const pagina = await browser.newPage({ viewport: { width: largura, height: 900 } });
    const erros = [];
    pagina.on("pageerror", (e) => erros.push(String(e)));
    pagina.on("console", (m) => m.type() === "error" && erros.push(m.text()));
    const r = await pagina.goto(base + rota, { waitUntil: "networkidle", timeout: 120000 });
    await pagina.waitForTimeout(1500);
    const info = await pagina.evaluate(() => ({
      h1: document.querySelectorAll("h1").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      titulo: document.title,
    }));
    const nome = `${rota.replace(/[^a-z0-9]+/gi, "_")}_${largura}.png`;
    await pagina.screenshot({ path: join(saida, nome), fullPage: true });
    resultados.push({ rota, largura, status: r?.status(), ...info, erros });
    await pagina.close();
  }
}
await browser.close();
writeFileSync(join(saida, "resultado.json"), JSON.stringify(resultados, null, 2));
for (const x of resultados) console.log(`${x.status} ${x.rota} ${x.largura}px h1=${x.h1} overflow=${x.overflow} erros=${x.erros.length}${x.erros.length ? " " + x.erros.slice(0, 2).join(" | ") : ""}`);
