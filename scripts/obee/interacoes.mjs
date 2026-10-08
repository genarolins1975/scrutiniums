// OBSOLETO desde o redesenho editorial: roteiro da interface de página única (rodadas 2 a 6). Para a interface atual, use interacoes-redesenho.mjs.
// Verificação de interações reais do painel. Uso: node interacoes.mjs <base_url> <pasta>
import { createRequire } from "node:module";
import { readFileSync, mkdirSync } from "node:fs";
// Playwright não é dependência do projeto: aponte PLAYWRIGHT_DIR para uma instalação local ou global.
const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const base = process.argv[2];
const out = process.argv[3];
mkdirSync(out, { recursive: true });
const URL0 = `${base}/eficiencia-estatal/educacao-municipal-capitais`;
const r = [];
const ok = (nome, cond, det = "") => r.push({ nome, ok: !!cond, det: String(det).slice(0, 300) });

const browser = await chromium.launch();
// VIEWPORT=390x844 repete a bateria no celular (com toque)
const [vw, vh] = (process.env.VIEWPORT ?? "1280x900").split("x").map(Number);
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: vw, height: vh }, hasTouch: vw < 768, isMobile: vw < 768 });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));
await page.goto(URL0, { waitUntil: "networkidle" });

// 1. filtro de capital muda dados e URL
const card = () => page.locator("[data-cartao=despesa]").innerText();
const antes = await card();
await page.selectOption("#f-cap", "sao-paulo");
await page.waitForTimeout(400);
const depois = await card();
ok("capital altera o número de despesa", antes !== depois, depois.split("\n").slice(0, 4).join(" | "));
ok("capital gravada na URL", page.url().includes("cap=sao-paulo"), page.url());

// 2. ano, etapa e medida
await page.selectOption("#f-ano", "2024");
await page.selectOption("#f-etapa", "creche");
await page.selectOption("#f-med", "ideb");
await page.waitForTimeout(400);
ok("URL reflete ano, etapa e medida", /ano=2024/.test(page.url()) && /etapa=creche/.test(page.url()) && /med=ideb/.test(page.url()), page.url());
const comparacao = await page.locator("#comparacao").innerText();
ok("Ideb com etapa creche: estado fora do escopo, sem número", /não existe para creche/i.test(comparacao), comparacao.slice(0, 200));
const cardIdeb = await page.locator("[data-cartao=ideb]").innerText();
ok("cartão do Ideb explica escopo da etapa", /anos iniciais e os anos finais/.test(cardIdeb), cardIdeb.slice(0, 200));

// 3. ano par com Ideb: aviso explícito, sem troca silenciosa
await page.selectOption("#f-etapa", "anos_finais");
await page.waitForTimeout(300);
const comp2 = await page.locator("#comparacao").innerText();
ok("Ideb em ano par: aviso de edição bienal com escolha explícita", /não há edição 2024/.test(comp2), comp2.slice(0, 200));
ok("ano não foi alterado sozinho", /ano=2024/.test(page.url()), page.url());
const cardIdeb2 = await page.locator("[data-cartao=ideb]").innerText();
ok("cartão do Ideb declara a edição usada", /Edição 2023 \(o Ideb é bienal; não há edição 2024\)/.test(cardIdeb2), cardIdeb2.slice(0, 160));
await page.getByRole("button", { name: "Edição 2025" }).click();
await page.waitForTimeout(300);
ok("botão de edição muda o ano (2025 é o padrão e sai da URL)", (await page.locator("#f-ano").inputValue()) === "2025" && !/ano=/.test(page.url()), page.url());

// 4. link compartilhado reabre o mesmo recorte
const link = page.url();
const p2 = await ctx.newPage();
await p2.goto(link, { waitUntil: "networkidle" });
await p2.waitForTimeout(300);
const v = await p2.evaluate(() => [document.querySelector("#f-cap").value, document.querySelector("#f-ano").value, document.querySelector("#f-etapa").value, document.querySelector("#f-med").value]);
ok("link reabre capital, ano, etapa e medida", v.join(",") === "sao-paulo,2025,anos_finais,ideb", v.join(","));
await p2.close();

// 5. passaporte abre, mantém a URL e fecha com Esc
const urlAntes = page.url();
await page.locator("#comparacao").getByRole("button", { name: /Passaporte/ }).first().click();
await page.waitForTimeout(300);
const dialogo = page.locator("dialog[open]");
ok("passaporte abre em diálogo", (await dialogo.count()) === 1);
const txt = await dialogo.innerText();
ok("passaporte tem os 16 campos", ["01", "08", "09", "16"].every((n) => txt.includes(n)) && /Validações realizadas/i.test(txt), txt.slice(0, 120));
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
ok("Esc fecha o passaporte", (await page.locator("dialog[open]").count()) === 0);
ok("abrir o passaporte não altera o recorte", page.url() === urlAntes, page.url());

// 6. grupo regional e ordenação numérica
await page.locator("label", { hasText: /^Região/ }).click();
await page.locator("label", { hasText: "Por valor, crescente" }).click();
await page.waitForTimeout(300);
const comp3 = await page.locator("#comparacao").innerText();
ok("grupo regional aplicado", /região Sudeste/.test(comp3) && /grupo=regiao/.test(page.url()), comp3.slice(0, 160));
ok("ordenação por valor gravada", /ord=valor/.test(page.url()));

// 7. download da tabela = linhas exibidas
const nLinhas = await page.locator("#tabela tbody tr").count();
const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("#tabela").getByRole("button", { name: /Baixar esta tabela/ }).click()]);
const caminho = await dl.path();
const conteudo = readFileSync(caminho, "utf-8").replace(/^﻿/, "");
const linhasCsv = conteudo.trim().split("\n").length - 1;
ok("CSV da tabela tem as mesmas linhas exibidas", linhasCsv === nLinhas, `${linhasCsv} × ${nLinhas}`);
ok("CSV sem zero em linha sem valor", !conteudo.split("\n").some((l) => /;0;/.test(l) && /Não divulgado|Não aplicável|Ausente/.test(l)));

// 8. download da comparação: incluídas + excluídas = universo do grupo
const [dl2] = await Promise.all([page.waitForEvent("download"), page.locator("#comparacao").getByRole("button", { name: /Baixar esta comparação/ }).click()]);
const c2 = readFileSync(await dl2.path(), "utf-8").replace(/^﻿/, "").trim().split("\n");
ok("CSV da comparação cobre o universo do grupo (4 capitais do Sudeste)", c2.length - 1 === 4, c2.length - 1);
ok("CSV da comparação traz universo, elegibilidade, motivo e versão", ["universo_do_indicador", "elegivel_comparacao", "incluida_na_comparacao", "motivo_exclusao", "versao_metodologica", "hash_dados"].every((c) => c2[0].split(";").includes(c)), c2[0]);

// 9. restaurar padrão
await page.getByRole("button", { name: "Voltar ao recorte inicial" }).click();
await page.waitForTimeout(300);
ok("restaurar volta à URL limpa", !page.url().includes("?"), page.url());

// 10. DF não aparece entre as capitais selecionáveis
const opcoes = await page.locator("#f-cap option").allInnerTexts();
ok("26 capitais selecionáveis, sem Brasília", opcoes.length === 26 && !opcoes.some((o) => /Brasília/.test(o)), opcoes.length);

// 11. capital com etapa ausente (Rio Branco, anos finais)
await page.goto(`${URL0}?cap=rio-branco&etapa=anos_finais&med=aprovacao`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const comp4 = await page.locator("#comparacao").innerText();
ok("Rio Branco sem anos finais: listada como não aplicável, sem zero", /Rio Branco \(AC\)\s*: não aplicável/.test(comp4), comp4.match(/Rio Branco \(AC\)\s*:[^\n]*/)?.[0]);
const cardAprov = await page.locator("[data-cartao=aprovacao]").innerText();
ok("cartão mostra estado não aplicável", /não aplicável/i.test(cardAprov), cardAprov.slice(0, 200));
await page.screenshot({ path: `${out}/rio-branco-anos-finais.png`, fullPage: false });

// 12. Campo Grande 2021: fora da comparação por perímetro
await page.goto(`${URL0}?cap=campo-grande&ano=2021`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const comp5 = await page.locator("#comparacao").innerText();
ok("Campo Grande 2021 fora da comparação, com valor oficial e motivo", /Campo Grande \(MS\)\s*: valor oficial .*fora da comparação\. Perímetro distinto/.test(comp5), comp5.match(/Campo Grande \(MS\)\s*:[^\n]*/)?.[0]);
ok("contagens: 26 no grupo, 26 com valor, 25 na comparação", /Capitais no grupo\s*26/.test(comp5) && /Com valor oficial\s*26/.test(comp5) && /Na comparação\s*25/.test(comp5), comp5.slice(0, 400).replace(/\n/g, " / "));
const cardCg = await page.locator("[data-cartao=despesa]").innerText();
ok("cartão de Campo Grande 2021 mostra a ressalva", /Ressalva: fora das comparações/.test(cardCg), cardCg.slice(0, 300));
await page.locator("[data-cartao=despesa] summary").first().focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
ok("ressalva abre pelo teclado", /intraorçamentárias/.test(await page.locator("[data-cartao=despesa] details[open]").first().innerText().catch(() => "")));
await page.screenshot({ path: `${out}/campo-grande-2021.png`, fullPage: false });
await page.goto(`${URL0}?cap=campo-grande&ano=2022`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const cardCg22 = await page.locator("[data-cartao=despesa]").innerText();
ok("Campo Grande 2022: variação com 2021 bloqueada", /Variação em relação a 2021 não calculada/.test(cardCg22), cardCg22.slice(0, 400));

// 12b. Boa Vista 2024: reconciliada pela MSC, incluída com nota
await page.goto(`${URL0}?cap=boa-vista&ano=2024`, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
const comp6 = await page.locator("#comparacao").innerText();
const aposNota = comp6.split(/Incluídas com nota/i)[1] ?? "";
ok("Boa Vista 2024 incluída e marcada com nota", /Boa Vista \(RR\)\s*: O RREO/.test(aposNota), aposNota.slice(0, 200));
const cardBv = await page.locator("[data-cartao=despesa]").innerText();
ok("cartão de Boa Vista 2024 com ressalva e variação calculada", /Ressalva/.test(cardBv) && /em relação a 2023/.test(cardBv) && !/não calculada/.test(cardBv), cardBv.slice(0, 400));
const [dl3] = await Promise.all([page.waitForEvent("download"), page.locator("#comparacao").getByRole("button", { name: /Baixar esta comparação/ }).click()]);
const c3 = readFileSync(await dl3.path(), "utf-8").replace(/^\uFEFF/, "").trim().split("\n");
const cab3 = c3[0].split(";");
const bvl = c3.find((l) => l.includes(";Boa Vista;")) ?? "";
ok("CSV: Boa Vista incluída com a nota da MSC", /;sim;sim;/.test(bvl) && /Matriz de Saldos Contábeis/.test(bvl), bvl.slice(0, 200));
ok("CSV: 26 linhas no grupo de todas as capitais", c3.length - 1 === 26 && cab3.length > 20, c3.length - 1);
await page.screenshot({ path: `${out}/boa-vista-2024.png`, fullPage: false });

// 13. parâmetro inválido volta ao padrão sem quebrar
await page.goto(`${URL0}?cap=brasilia&ano=2030&etapa=xyz`, { waitUntil: "networkidle" });
const v2 = await page.evaluate(() => [document.querySelector("#f-cap").value, document.querySelector("#f-ano").value, document.querySelector("#f-etapa").value]);
ok("parâmetros inválidos voltam ao padrão", v2.join(",") === "aracaju,2025,anos_iniciais", v2.join(","));

// 14. teclado: foco visível e dica no gráfico de série
await page.goto(URL0, { waitUntil: "networkidle" });
await page.locator("#serie [role=group]").first().focus();
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(150);
const dica = await page.locator("#serie [role=status]").first().innerText().catch(() => "");
ok("teclado mostra a dica no gráfico", /2021/.test(dica), dica);
await page.screenshot({ path: `${out}/dica-teclado.png`, clip: { x: 0, y: 0, width: 1280, height: 900 } });

// 15. gráfico monetário: valor exato por toque ou ponteiro e atalho para a tabela da comparação
await page.goto(`${URL0}?med=despesa&cap=sao-paulo`, { waitUntil: "networkidle" });
const grupo = page.locator("#comparacao [role=group]").first();
await grupo.scrollIntoViewIfNeeded();
const caixa = await grupo.boundingBox();
const alvoX = caixa.x + Math.min(200, caixa.width / 2);
const alvoY = caixa.y + 30 + 20 * 26 + 13; // 21ª capital (Rio de Janeiro), margem 30 e linha de 26 px
if (vw < 768) await page.touchscreen.tap(alvoX, alvoY);
else await page.mouse.move(alvoX, alvoY);
await page.waitForTimeout(250);
const dicaLinha = (await page.locator("#comparacao [role=status]").allInnerTexts()).join(" ");
ok("valor exato da linha tocada ou apontada", /rio de janeiro/i.test(dicaLinha) && /R\$/.test(dicaLinha), dicaLinha.replace(/\s+/g, " "));
await page.getByRole("button", { name: "Ver todos os valores na tabela" }).click();
await page.waitForTimeout(250);
ok("atalho abre a tabela da comparação com todas as capitais", (await page.locator("#tabela-comparacao[open] table tbody tr").count()) === 26);
const focoResumo = await page.evaluate(() => document.activeElement?.textContent?.trim());
ok("foco vai para o resumo da tabela", /Ver tabela da comparação/.test(focoResumo ?? ""), focoResumo);

ok("sem erros de página", erros.length === 0, erros.join(" | "));
await browser.close();
for (const x of r) console.log(`${x.ok ? "OK  " : "FALHA"} ${x.nome}${x.det ? `  [${x.det}]` : ""}`);
console.log(`${r.filter((x) => x.ok).length}/${r.length}`);
