import { createRequire } from "node:module";
const require = createRequire("/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const url of ["/comparar?vis=tabela&ano=2025&etapa=anos_finais", "/comparar?vis=tabela&ano=2025&etapa=anos_finais&med=saeb&disc=portugues"]) {
  await p.goto("http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais" + url, { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => !document.documentElement.hasAttribute("data-recorte"), null, { timeout: 15000 });
  const r = await p.evaluate(() => {
    const ths = [...document.querySelectorAll("main table thead th")];
    const th = ths.find((t) => /Saeb/.test(t.textContent) && !/Diferença/.test(t.textContent));
    const td = [...document.querySelectorAll("main table tbody tr")][0]?.querySelectorAll("td")[10];
    return { th: th?.outerHTML.slice(0, 600), aria: th?.getAttribute("aria-label"), title: th?.getAttribute("title"), td: td?.outerHTML.slice(0, 300), mencionaDisciplina: /Matem|Portugu/.test(document.querySelector("main table")?.outerHTML ?? ""), textoPagina: /Matem[aá]tica|Língua Portuguesa/.test(document.querySelector("main")?.innerText ?? "") };
  });
  console.log(url, JSON.stringify(r, null, 1));
}
await b.close();
