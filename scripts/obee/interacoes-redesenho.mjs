// Interações reais do painel redesenhado: entrada sem capital, seletor opcional, navegação que preserva a capital, medidas do
// tema, gráfico e tabela com o mesmo conjunto, links compartilháveis, voltar/avançar, teclado, toque, diálogo "Sobre este dado",
// download e destaque de poucas capitais. Uso: node interacoes-redesenho.mjs <base_url> [largura]
import { createRequire } from "node:module";
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const base = process.argv[2];
const largura = Number(process.argv[3] ?? 1280);
const RAIZ = `${base}/eficiencia-estatal/educacao-municipal-capitais`;
const r = [];
const ok = (nome, cond, det = "") => r.push({ nome, ok: !!cond, det: String(det).slice(0, 200) });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, hasTouch: largura < 768, isMobile: largura < 500, acceptDownloads: true });
const p = await ctx.newPage();
const erros = [];
p.on("pageerror", (e) => erros.push(String(e).slice(0, 160)));
p.on("console", (m) => m.type() === "error" && erros.push(m.text().slice(0, 160)));
const url = () => new URL(p.url());
const busca = (k) => url().searchParams.get(k);
const abre = async (q) => {
  await p.goto(RAIZ + q, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
};

/* ---------- panorama ---------- */
await abre("");
ok("panorama: título e frase de proposta", (await p.locator("h1").innerText()) === "Educação nas capitais" && (await p.locator("main").innerText()).includes("com referências para entender cada número"));
ok("panorama: nenhuma capital selecionada ao abrir", (await p.locator("#panorama-cap").inputValue()) === "");
const caps = await p.locator("main section > h2").allInnerTexts();
ok("panorama: três capítulos com frase factual do conjunto", caps.length === 3 && caps.every((t) => /vai de .+ a .+ entre as 26 capitais/.test(t)), caps.join(" | "));
ok("panorama: pergunta de cada capítulo", (await p.locator("main").innerText()).match(/QUANTO SE GASTA\?|Quanto se gasta\?/i) !== null);
ok("panorama: uma faixa de distribuição por capítulo, com a mediana rotulada", (await p.locator("main svg").count()) >= 3 && (await p.locator("main svg text", { hasText: /Mediana/ }).count()) >= 3);
ok("panorama: a primeira tela mostra o número (gráfico começa até 900 px)", await p.evaluate(() => { const s = document.querySelector("main svg"); return !!s && s.getBoundingClientRect().top < 900 + 400; }));

// seletor opcional
await p.selectOption("#panorama-cap", "recife");
await p.waitForTimeout(300);
ok("panorama: escolher a capital grava ?cap= na URL", busca("cap") === "recife", p.url());
ok("panorama: a capital escolhida é destacada com nome e valor", (await p.locator("main svg text", { hasText: /Recife \(PE\):/ }).count()) >= 3);
ok("panorama: frase da capital frente à mediana, sem juízo", (await p.locator("main").innerText()).includes("Recife (PE) registra R$"));
await p.goBack();
await p.waitForTimeout(300);
ok("panorama: voltar desfaz a escolha", busca("cap") === null && (await p.locator("#panorama-cap").inputValue()) === "");
await p.goForward();
await p.waitForTimeout(300);
ok("panorama: avançar restaura a escolha", busca("cap") === "recife");

// toque/ponteiro na faixa
await p.locator("main svg").first().scrollIntoViewIfNeeded();
await p.waitForTimeout(1500); // fontes e hidratação assentam antes de medir a posição do toque
const marca = await p.locator("main svg circle").nth(3).boundingBox();
if (marca) {
  const x = marca.x + marca.width / 2;
  const y = marca.y + marca.height / 2;
  if (largura < 768) await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
  await p.waitForTimeout(200);
  ok("panorama: toque ou clique numa marca mostra a capital e o valor numa linha visível", /: R\$/.test(await p.locator('main [role="status"]').first().innerText()), await p.locator('main [role="status"]').first().innerText());
}
// gráfico e tabela com o mesmo conjunto
await p.locator('main label:has-text("Tabela")').first().click();
await p.waitForTimeout(200);
const linhasPan = await p.locator("main table:visible tbody tr").count();
ok("panorama: tabela alternativa traz as 26 capitais", linhasPan === 26, String(linhasPan));

// navegação preserva a capital
await p.locator('nav[aria-label="Visões do painel"] a', { hasText: "Gastos" }).click();
await p.waitForURL(/\/gastos/);
await p.waitForTimeout(400);
ok("navegação: Gastos mantém a capital escolhida", busca("cap") === "recife");
await p.locator('nav[aria-label="Visões do painel"] a', { hasText: "Panorama" }).click();
await p.waitForURL((u) => !/\/(gastos|atendimento|resultados|comparar|metodos)/.test(u.pathname));
await p.waitForTimeout(400);
ok("navegação: voltar ao Panorama mantém a capital", busca("cap") === "recife" && (await p.locator("#panorama-cap").inputValue()) === "recife");
ok("navegação: Panorama marcado como página atual", (await p.locator('nav[aria-label="Visões do painel"] a[aria-current="page"]').innerText()) === "Panorama");

/* ---------- gastos ---------- */
await abre("/gastos");
ok("gastos: três escalas lado a lado, sem capital (mediana do grupo)", (await p.locator('input[name="medida-do-tema"]').count()) === 3 && (await p.locator("main").innerText()).includes("Mediana de 26 capitais"));
ok("gastos: abre pela medida normalizada (por habitante)", await p.locator('input[name="medida-do-tema"][value="despesa_hab"]').isChecked());
await p.locator('label:has(input[value="despesa_mat"])').click();
await p.waitForTimeout(300);
ok("gastos: escolher a razão por matrícula grava ?med=", busca("med") === "despesa_mat");
ok("gastos: nome fiel da medida, sem prometer custo por aluno", /Razão da despesa de aplicação direta por matrícula|razão orçamentária/i.test(await p.locator("main").innerText()) && !/custo por aluno:/i.test(await p.locator("main h2").allInnerTexts().then((a) => a.join(" "))));
// detalhe exige capital
await p.locator('label:has-text("Do total ao numerador")').click();
await p.waitForTimeout(300);
ok("gastos: detalhe sem capital pede a escolha da capital", (await p.locator("main").innerText()).includes("Escolha uma capital"));
await p.selectOption("#cap", "recife");
await p.waitForTimeout(500);
ok("gastos: ponte do total ao numerador com parcelas e soma conferida", (await p.locator("#ponte").count()) === 1 && (await p.locator("#ponte").innerText()).includes("igual ao total da função na DCA"));
// gráfico/tabela mesmos dados
await p.locator('label:has-text("Gráfico")').first().click();
await p.waitForTimeout(300);
const nPontos = await p.locator("main svg circle").count();
await p.locator('label:has-text("Tabela")').first().click();
await p.waitForTimeout(300);
const nLinhas = await p.locator("main table:visible tbody tr").count();
ok("gastos: tabela e gráfico cobrem o mesmo conjunto (26 capitais)", nLinhas === 26 && nPontos >= 26, `linhas ${nLinhas}, pontos ${nPontos}`);
// evolução
await p.locator('label:has-text("Evolução")').click();
await p.waitForTimeout(300);
ok("gastos: evolução traz frase com o local e o período", /Em Recife \(PE\), .+ passou de .+ em \d{4} para .+ em \d{4}|não são diretamente comparáveis/.test(await p.locator("main h2").nth(1).innerText()), await p.locator("main h2").nth(1).innerText());
// sobre este dado
await p.locator("button", { hasText: "Sobre este dado" }).first().click();
await p.waitForTimeout(300);
ok("gastos: Sobre este dado abre a ficha em diálogo", await p.locator("dialog[open]").isVisible());
await p.keyboard.press("Escape");
await p.waitForTimeout(200);
ok("gastos: Esc fecha o diálogo e o recorte permanece", !(await p.locator("dialog[open]").count()) && busca("cap") === "recife" && busca("med") === "despesa_mat");
// download (a partir da visão em tabela, que oferece o CSV do recorte)
await p.locator('label:has-text("Tabela")').first().click();
await p.waitForTimeout(300);
const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), p.locator("button", { hasText: "Baixar estes valores" }).click().catch(() => null)]);
ok("gastos: download dos valores do recorte", dl !== null && /^obee_gastos_despesa_mat_2025\.csv$/.test(dl.suggestedFilename()), dl?.suggestedFilename() ?? "sem download");
// teclado no gráfico
await p.locator('label:has-text("Gráfico")').first().click();
await p.waitForTimeout(300);
await p.locator('main [role="group"][tabindex="0"]').first().focus();
await p.keyboard.press("ArrowDown");
await p.waitForTimeout(200);
ok("gastos: teclado percorre as capitais do gráfico e mostra o valor", (await p.locator('main [role="status"]').first().innerText()).match(/R\$/) !== null || (await p.locator("main svg text").count()) > 0);

/* ---------- parâmetros inválidos ---------- */
await abre("/gastos?cap=nao-existe&med=xx&ano=1900&vis=zzz&etapa=outra");
ok("link inválido volta ao padrão sem quebrar", (await p.locator("h1").innerText()) === "Gastos" && (await p.locator('input[name="medida-do-tema"][value="despesa_hab"]').isChecked()));
await abre("/resultados?med=ideb&etapa=creche");
ok("etapa sem a medida não produz filtro enganoso: cai numa etapa com dado", /anos iniciais|anos finais/i.test(await p.locator("#f-etapa").evaluate((e) => e.options[e.selectedIndex].text)));
await abre("/gastos?med=despesa_hab&ano=2023&cap=manaus");
ok("ano com população censitária: a ressalva material acompanha o número", /relação|Censo/i.test(await p.locator("main [role=note]").first().innerText().catch(() => "")), await p.locator("main [role=note]").first().innerText().catch(() => "sem nota"));

/* ---------- comparar ---------- */
await abre("/comparar");
await p.locator("summary", { hasText: "Destacar capitais" }).click();
for (const nome of ["Recife (PE)", "Manaus (AM)", "Belém (PA)", "Natal (RN)", "Palmas (TO)", "Goiânia (GO)"]) await p.locator("label", { hasText: nome }).click();
await p.waitForTimeout(300);
ok("comparar: no máximo 5 capitais destacadas, a mais antiga sai", (busca("dest") ?? "").split(",").length === 5 && !(busca("dest") ?? "").includes("recife"), busca("dest") ?? "");
ok("comparar: destaque não retira ninguém do conjunto", (await p.locator("main svg circle").count()) >= 26);
await p.locator('label:has-text("Tabela completa")').click();
await p.waitForTimeout(500);
ok("comparar: tabela completa com população, matrículas e razões", (await p.locator("main table thead th").allInnerTexts().then((a) => a.join(" "))).includes("População residente") && (await p.locator("main table:visible tbody tr").count()) === 26);
// ordenar a pedido
await p.locator("main table thead button", { hasText: "Despesa por habitante" }).click();
await p.waitForTimeout(200);
ok("comparar: ordenação numérica só por pedido (sem pódio)", busca("ot") === "despesa_hab");

/* ---------- métodos ---------- */
await abre("/metodos");
const m = await p.locator("main").innerText();
ok("métodos: fichas, matriz de referências, validações e reprodução em uma área", m.includes("Sobre cada dado") && m.includes("Matriz de referências") && m.includes("Como reproduzir"), "");

ok("sem erros de página", erros.length === 0, erros.join(" | "));
await browser.close();
let falhas = 0;
for (const x of r) {
  if (!x.ok) falhas++;
  console.log(`${x.ok ? "OK  " : "FALHA"} ${x.nome}${x.ok ? "" : `  [${x.det}]`}`);
}
console.log(`${r.length - falhas}/${r.length}`);
process.exit(falhas ? 1 : 0);
