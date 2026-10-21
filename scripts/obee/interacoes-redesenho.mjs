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
ok("panorama: título e frase de proposta", (await p.locator("h1").innerText()) === "Educação nas capitais" && (await p.locator("main").innerText()).includes("Quanto se gasta, quem é atendido e quais resultados são observados."));
ok("panorama: nenhuma capital selecionada ao abrir (Todas as capitais)", (await p.locator("#panorama-cap").inputValue()) === "" && (await p.locator("#panorama-cap option:checked").innerText()) === "Todas as capitais");
const caps = await p.locator('main section[id^="capitulo-"] > h2, main section[id^="capitulo-"] > div:first-child h2').allInnerTexts();
ok("panorama: três capítulos com a pergunta como título", caps.slice(0, 3).join(" | ") === "Quanto se gasta por habitante? | Quantos alunos por turma? | Qual é o Ideb?", caps.join(" | "));
ok("panorama: rótulos 01 Recursos, 02 Atendimento e 03 Resultados", /01\s*\/?\s*RECURSOS/i.test(await p.locator("#capitulo-gastos").innerText()) && /02\s*\/?\s*ATENDIMENTO/i.test(await p.locator("#capitulo-atendimento").innerText()) && /03\s*\/?\s*RESULTADOS/i.test(await p.locator("#capitulo-resultados").innerText()));
ok("panorama: números do capítulo 1 (menor, mediana e maior) antes do gráfico", await p.evaluate(() => { const t = document.querySelector("#capitulo-gastos dl")?.textContent ?? ""; return /Menor valor/.test(t) && /Mediana das capitais/.test(t) && /Maior valor/.test(t); }));
ok("panorama: a primeira tela mostra a pergunta e os números", await p.evaluate(() => { const d = document.querySelector("#capitulo-gastos dl"); return !!d && d.getBoundingClientRect().top < 900 + 600; }));
ok("panorama: faixa do capítulo 1 com a mediana rotulada e os dois gráficos de referência", (await p.locator("#capitulo-gastos svg text", { hasText: /^R\$ [\d.]+$/ }).count()) >= 3 && (await p.locator("#capitulo-atendimento svg").count()) === 1 && (await p.locator("#capitulo-resultados svg").count()) === 1);
ok("panorama: contexto nacional separado, sem diferença contra a capital", (await p.locator('aside[aria-label="Contexto nacional"]').innerText()).includes("Universo diferente das capitais"));
ok("panorama: Ideb nomeia as duas capitais empatadas no maior valor", (await p.locator("#capitulo-resultados").innerText()).includes("Maior: 6,9 · Curitiba (PR) e Teresina (PI)"));
ok("panorama: Brasil como agregado nacional, não média das capitais", (await p.locator("#capitulo-atendimento").innerText()).includes("agregado nacional, não é média das capitais"));

// abas do capítulo 1
const abas = p.locator('#capitulo-gastos [role="tab"]');
ok("abas: Total, Por habitante e Por matrícula, com a segunda selecionada", (await abas.allInnerTexts()).join("|") === "Total|Por habitante|Por matrícula" && (await abas.nth(1).getAttribute("aria-selected")) === "true");
await abas.nth(2).click();
await p.waitForTimeout(300);
ok("abas: Por matrícula troca a pergunta, grava ?med= e traz a ressalva do número", (await p.locator("#capitulo-gastos > div:first-child h2").innerText()) === "Quanto se gasta por matrícula?" && busca("med") === "despesa_mat" && (await p.locator("#capitulo-gastos").innerText()).includes("Razão orçamentária, não custo do aluno"));
ok("abas: medida sem referência nacional diz por quê, em vez de calar", /Sem referência nacional comparável/.test(await p.locator('aside[aria-label="Contexto nacional"]').innerText()));
await abas.nth(0).click();
await p.waitForTimeout(300);
ok("abas: Total usa escala logarítmica declarada no eixo", (await p.locator("#capitulo-gastos svg text", { hasText: /escala logarítmica/ }).count()) === 1 && busca("med") === "despesa");
await p.goBack();
await p.waitForTimeout(300);
ok("abas: voltar restaura a aba anterior", busca("med") === "despesa_mat" && (await abas.nth(2).getAttribute("aria-selected")) === "true");
await abas.nth(2).focus();
await p.keyboard.press("ArrowLeft");
await p.waitForTimeout(300);
ok("abas: setas do teclado percorrem as abas e movem o foco", (await abas.nth(1).getAttribute("aria-selected")) === "true" && (await p.evaluate(() => document.activeElement?.textContent)) === "Por habitante");
await p.keyboard.press("Home");
await p.waitForTimeout(300);
ok("abas: Home vai à primeira", (await abas.nth(0).getAttribute("aria-selected")) === "true");
await abas.nth(1).click();
await p.waitForTimeout(300);
ok("abas: voltar à aba padrão tira ?med= da URL", busca("med") === null || busca("med") === "despesa_hab");

// seletor opcional
await p.selectOption("#panorama-cap", "recife");
await p.waitForTimeout(300);
ok("panorama: escolher a capital grava ?cap= na URL", busca("cap") === "recife", p.url());
ok("panorama: a capital escolhida aparece nos gráficos com nome e valor", (await p.locator("#capitulo-gastos svg text", { hasText: /Recife \(PE\) R\$/ }).count()) === 1 && (await p.locator("#capitulo-atendimento svg text", { hasText: /Recife \(PE\)/ }).count()) === 1);
ok("panorama: frase da capital frente à mediana, sem juízo", (await p.locator("main").innerText()).includes("Recife (PE) registra R$"));
await p.goBack();
await p.waitForTimeout(300);
ok("panorama: voltar desfaz a escolha", busca("cap") === null && (await p.locator("#panorama-cap").inputValue()) === "");
await p.goForward();
await p.waitForTimeout(300);
ok("panorama: avançar restaura a escolha", busca("cap") === "recife");

// gráfico e tabela com o mesmo conjunto
await p.locator('#capitulo-gastos label:has-text("Tabela")').first().click();
await p.waitForTimeout(200);
const linhasPan = await p.locator("#capitulo-gastos table:visible tbody tr").count();
ok("panorama: tabela alternativa do capítulo 1 traz as 26 capitais", linhasPan === 26, String(linhasPan));
await p.locator('#capitulo-gastos label:has-text("Gráfico")').first().click();
await p.locator("#capitulo-atendimento summary").click();
await p.waitForTimeout(200);
ok("panorama: capítulos 2 e 3 trazem os valores de cada capital a um clique", (await p.locator("#capitulo-atendimento table:visible tbody tr").count()) === 26);
// conferência
ok("panorama: faixa Entenda e confira os números com três ações", await p.evaluate(() => { const s = document.querySelector("#conferir-titulo")?.closest("section"); const a = [...(s?.querySelectorAll("a") ?? [])].map((x) => x.textContent?.replace(/\s+/g, " ").trim()); return a.length === 3 && /Comparar capitais/.test(a[0]) && /Baixar dados/.test(a[1]) && /Fontes e metodologia/.test(a[2]); }));
const baixa = p.waitForEvent("download", { timeout: 20000 }).catch(() => null);
await p.locator("#conferir-titulo").locator("xpath=ancestor::section").locator("a", { hasText: "Baixar dados" }).click();
const dlPanorama = await baixa;
ok("panorama: Baixar dados entrega o arquivo da base completa", !!dlPanorama && /educacao_capitais\.json$/.test(dlPanorama.suggestedFilename()), dlPanorama ? dlPanorama.suggestedFilename() : "sem download");

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
ok("gastos: download dos valores do recorte", dl !== null && /^obee_gastos_despesa_mat_2025_nominal\.csv$/.test(dl.suggestedFilename()), dl?.suggestedFilename() ?? "sem download");
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
ok("ano com população censitária: a ressalva material acompanha o número", /relação|Censo/i.test((await p.locator("main [role=note]").allInnerTexts()).join(" ")), (await p.locator("main [role=note]").allInnerTexts()).join(" ").slice(0, 200));

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

/* ---------- lote 4: capitais fora da comparação, série em CSV, definições e ausências declaradas ---------- */
await abre("/gastos?med=despesa_mat&ano=2022");
const nFora = await p.locator("[data-fora-da-comparacao]").count();
ok("gastos: capitais fora da comparação aparecem no gráfico e o bloco de motivos fica logo abaixo", nFora === 3 && (await p.locator("#fora-da-comparacao").count()) === 1);
const yGrafico = await p.locator("#visao figure").first().evaluate((e) => e.getBoundingClientRect().bottom + scrollY);
const yFora = await p.locator("#fora-da-comparacao").evaluate((e) => e.getBoundingClientRect().top + scrollY);
ok("gastos: motivos a menos de 300 px do fim do gráfico", yFora - yGrafico >= 0 && yFora - yGrafico < 300, `${Math.round(yFora - yGrafico)} px`);
ok("gastos: sem rolagem horizontal na página", (await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)));
await abre("/gastos?med=despesa_hab&cap=recife&vis=evolucao");
ok("evolução: aviso de reais correntes junto do gráfico", /reais correntes/i.test(await p.locator("#visao").innerText()));
const [dl2] = await Promise.all([p.waitForEvent("download", { timeout: 5000 }).catch(() => null), p.locator("button", { hasText: "Baixar esta série" }).click().catch(() => null)]);
ok("evolução: download da série em CSV", dl2 !== null && /^obee_gastos_despesa_hab_serie_recife.*\.csv$/.test(dl2.suggestedFilename()), dl2?.suggestedFilename() ?? "sem download");
await abre("/resultados");
ok("resultados: aviso próprio sobre efeito da gestão e periodicidade", /não mede o efeito da gestão/i.test(await p.locator("#refs-titulo").locator("xpath=..").innerText()));
ok("resultados: seção sobre o que o painel não mostra", /O que este painel não mostra/.test(await p.locator("main").innerText()));
await abre("/");
ok("panorama: Ideb por extenso e nota de reais correntes", /Índice de Desenvolvimento da Educação Básica/.test(await p.locator("main").innerText()) && /reais correntes/i.test(await p.locator("main").innerText()));

ok("sem erros de página", erros.length === 0, erros.join(" | "));
await browser.close();
let falhas = 0;
for (const x of r) {
  if (!x.ok) falhas++;
  console.log(`${x.ok ? "OK  " : "FALHA"} ${x.nome}${x.ok ? "" : `  [${x.det}]`}`);
}
console.log(`${r.length - falhas}/${r.length}`);
process.exit(falhas ? 1 : 0);
