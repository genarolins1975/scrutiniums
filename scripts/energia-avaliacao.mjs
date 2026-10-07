/* Coleta de evidência objetiva para a avaliação dos painéis do Observatório do Setor Elétrico
   (P071, seção 15 da especificação). Roda contra um servidor já no ar (next start) e, para cada
   rota, largura de tela e modo de profundidade, registra o que um navegador real encontra:

     - resposta HTTP, tempo de carga em laboratório, bytes de HTML, de JavaScript e de dados;
     - erros de console, exceções da página e respostas HTTP com erro;
     - axe-core (WCAG 2.0, 2.1 e 2.2 A e AA) por impacto;
     - rolagem horizontal e elementos que passam da janela;
     - anatomia do painel (pergunta, resposta curta, quatro blocos de leitura, fonte, download,
       link compartilhável, próxima pergunta), tabelas e figuras;
     - texto com data crua, NaN, undefined, objeto impresso ou marcador de obra;
     - teclado: primeiro foco, sequência de Tab, indicador de foco visível, armadilha de foco;
     - alvos de toque pequenos (menos de 24 px e menos de 44 px);
     - controles exercitados (rádios, abas, seletores, caixas), com efeito observado e erros depois;
     - links internos (status) e âncoras (existência do id na página de destino);
     - capturas de tela com hash e dimensões (as imagens não vão para o repositório).

   Uso:
     PW_CORE=/caminho/node_modules/playwright-core node scripts/energia-avaliacao.mjs \
       --base http://localhost:3100 --rotas rotas.txt --saida /tmp/avaliacao \
       [--larguras 360,390,768,1440] [--modos entender,auditar] [--paralelo 3] [--capturas 1]

   Em auditar só se medem 390 e 1440 (as duas pontas); em entender, todas as larguras. O que o
   script não mede (clareza didática, hierarquia visual, leitor de tela real) fica registrado como
   não medido no relatório; quem consome os números não deve completá-lo por inferência.

   Não é dependência do build: playwright-core vem de PW_CORE e o navegador de CHROMIUM. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createRequire } from "node:module";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const BASE = (args.base || "http://localhost:3100").replace(/\/$/, "");
const SAIDA = args.saida || "avaliacao-energia";
const LARGURAS = (args.larguras || "360,390,768,1440").split(",").map(Number);
const MODOS = (args.modos || "entender,auditar").split(",");
const PARALELO = Number(args.paralelo || 3);
const CAPTURAS = args.capturas !== "0";
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_CORE || "playwright-core");
const AXE = await readFile(join(import.meta.dirname, "..", "node_modules", "axe-core", "axe.min.js"), "utf-8");
const ROTAS = (await readFile(args.rotas, "utf-8")).split("\n").map((l) => l.trim()).filter(Boolean);

const slug = (r) => r.replace(/^\/setor-eletrico\/?/, "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "raiz";
const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/* ---------- medições dentro da página ---------- */
function medirPagina() {
  const visivel = (el) => {
    if (!(el instanceof HTMLElement)) return true;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none";
  };
  const texto = document.body.innerText || "";
  const principal = document.querySelector("main") || document.body;
  const tp = principal.innerText || "";
  const ci = (re) => (re.flags.includes("i") ? re : new RegExp(re.source, re.flags + "i"));
  const contar = (re) => (tp.match(ci(re)) || []).length;
  const amostra = (re, n = 6) => Array.from(new Set(tp.match(re) || [])).slice(0, n);
  const paineis = Array.from(document.querySelectorAll('section[aria-labelledby$="-titulo"]'))
    .filter(visivel)
    .map((s) => {
      const t = s.innerText || "";
      return {
        id: s.id,
        titulo: (s.querySelector("h2,h3")?.textContent || "").trim().slice(0, 140),
        quatro_blocos: ["Por que isso importa", "O que mudou", "Como interpretar", "O que não é possível concluir"].every((r) => t.includes(r)),
        fonte: /Fontes?: /.test(t),
        baixar: !!s.querySelector("a[download]"),
        sobre: /Sobre este dado|Comprove/i.test(t),
      };
    });
  const alvos = Array.from(principal.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=tab], [role=radio]"))
    .filter((el) => visivel(el) && !el.closest(".sr-only") && !el.classList.contains("sr-only"))
    .map((el) => {
      const r = el.getBoundingClientRect();
      const emLinha = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, li, td, dd");
      return { w: r.width, h: r.height, emLinha: !!emLinha };
    });
  const grandes = Array.from(document.querySelectorAll("body *"))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > window.innerWidth + 1 && getComputedStyle(el).position !== "fixed" && !el.closest(".tabela-scroll, [data-rolagem-contida], .overflow-x-auto, .overflow-auto");
    })
    .slice(0, 5)
    .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)}`);
  const hrefs = Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href"));
  const idsPagina = new Set(Array.from(document.querySelectorAll("[id]")).map((e) => e.id));
  return {
    lang: document.documentElement.lang,
    titulo: document.title,
    h1: Array.from(document.querySelectorAll("h1")).map((h) => (h.textContent || "").trim().slice(0, 160)),
    h2: document.querySelectorAll("main h2").length,
    h3: document.querySelectorAll("main h3").length,
    marcos: {
      main: !!document.querySelector("main"),
      nav: document.querySelectorAll("nav").length,
      banner: !!document.querySelector("header, [role=banner]"),
      rodape: !!document.querySelector("footer, [role=contentinfo]"),
    },
    texto_principal_caracteres: tp.length,
    dom_nos: document.getElementsByTagName("*").length,
    altura: document.documentElement.scrollHeight,
    scroll_width: document.documentElement.scrollWidth,
    inner_width: window.innerWidth,
    transbordo: grandes,
    anomalias: {
      datas_cruas: amostra(/\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?\b/g),
      nan_undefined: amostra(/\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/g),
      unidade_duplicada: amostra(/[^\n]{0,30}(%\s*%|R\$\s*R\$)[^\n]{0,30}/g),
      marcador_de_obra: amostra(/\b(em breve|página em construção|em desenvolvimento|lorem ipsum|a definir)\b/gi),
      travessao: contar(/[—–]/g),
      hoje: amostra(/[^.\n]{0,60}\bhoje\b[^.\n]{0,40}/gi, 6),
      hoje_com_numero: amostra(/[^.\n]{0,60}(\d[^.\n]{0,60}\bhoje\b|\bhoje\b[^.\n]{0,60}\d)[^.\n]{0,20}/gi, 6),
    },
    marcadores: {
      resposta: document.querySelectorAll("[data-resposta]").length,
      paineis: paineis.length,
      comprove: contar(/Comprove/gi),
      interpretar: contar(/Como interpretar|Como ler|O que observar/g),
      nao_concluir: contar(/não é possível concluir|O que não posso concluir|O que não se pode concluir|O que não permite concluir|Limitações declaradas|Limites de leitura|Não confundir/g),
      baixar: principal.querySelectorAll("a[download]").length,
      copiar_link: Array.from(principal.querySelectorAll("button")).filter((b) => /copiar link/i.test(b.textContent || "")).length,
      proxima: contar(/Próxima pergunta/g),
      fonte: contar(/\bFontes?: /g),
      referencia: contar(/(Data de referência|Referência até|referência até|Gold processada)/g),
      tabelas: principal.querySelectorAll("table").length,
      figuras: principal.querySelectorAll("svg[role=img], img, canvas, figure").length,
      glossario: principal.querySelectorAll('a[href*="/setor-eletrico/aprenda/"]').length,
      externo: principal.querySelectorAll('a[href^="http"]').length,
      conferido: contar(/conferid[oa]/gi),
      conferido_fonte_primaria: contar(/conferido na fonte primária em/gi),
      em_preparacao: contar(/verbete em preparação/gi),
      relacionados: contar(/Relações|Relacionados|Ver também|Continue|Próximo passo|Próximos passos|Onde aprofundar|Onde explorar/g),
      recorte: ["Período", "Universo", "Unidade"].filter((r) => new RegExp(`(^|\\n)${r}\\s*(\\n|$)`, "i").test(tp)).length,
      lead: (() => { const h = principal.querySelector("h1"); let n = h?.nextElementSibling; while (n && !(n.textContent || "").trim()) n = n.nextElementSibling; return ((n?.textContent || "").trim().length); })(),
      indisponivel: contar(/Indisponível|indisponível|sem dado|Sem dado/g),
    },
    paineis,
    titulos_pergunta: (() => {
      const t = paineis.length ? paineis.map((x) => x.titulo) : Array.from(principal.querySelectorAll("h2")).map((h) => (h.textContent || "").trim());
      return { total: t.length, com_interrogacao: t.filter((x) => /\?\s*$/.test(x)).length };
    })(),
    alvos: {
      total: alvos.length,
      menores_24: alvos.filter((a) => !a.emLinha && (a.w < 24 || a.h < 24)).length,
      menores_44: alvos.filter((a) => !a.emLinha && (a.w < 44 || a.h < 44)).length,
    },
    hrefs,
    ids: Array.from(idsPagina),
  };
}

/* sequência de Tab: primeiro foco, indicador visível, armadilha */
async function medirTeclado(p) {
  await p.evaluate(() => {
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  const passos = [];
  const vistos = new Set();
  let preso = false;
  for (let i = 0; i < 70; i++) {
    await p.keyboard.press("Tab");
    const f = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      const sombra = cs.boxShadow && cs.boxShadow !== "none";
      const texto = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 60);
      return { tag: el.tagName.toLowerCase(), texto, indicador: outline || !!sombra, dentro: r.width > 0 && r.height > 0, chave: `${el.tagName}|${el.id}|${texto}|${Math.round(r.x)}|${Math.round(r.y + window.scrollY)}` };
    });
    if (!f) continue;
    if (vistos.has(f.chave)) {
      preso = passos.length < 3;
      break;
    }
    vistos.add(f.chave);
    passos.push(f);
  }
  return {
    primeiro: passos[0]?.texto ?? null,
    alcancados: passos.length,
    sem_indicador: passos.filter((s) => !s.indicador).length,
    exemplos_sem_indicador: passos.filter((s) => !s.indicador).slice(0, 3).map((s) => `${s.tag}: ${s.texto}`),
    foco_invisivel: passos.filter((s) => !s.dentro).length,
    preso_nos_primeiros_passos: preso,
  };
}

/* exercita o que um leitor usa: seletor de profundidade, link, ficha de prova e controles do conteúdo */
const tira = (t) => (t || "").trim().replace(/\s+/g, " ").slice(0, 60);

async function testarModo(p) {
  const radios = p.locator('[role=radiogroup][aria-label="Nível de profundidade"] [role=radio]');
  const n = await radios.count();
  if (n !== 3) return { presente: n > 0, coerente: false, motivo: `${n} opções` };
  const falhas = [];
  for (const [i, id] of ["analisar", "auditar", "entender"].entries()) {
    await p.getByRole("radio", { name: new RegExp(`^${id}$`, "i") }).click({ timeout: 2500 }).catch(() => falhas.push(`clique em ${id}`));
    await p.waitForTimeout(150);
    const est = await p.evaluate(() => ({ modo: document.querySelector("[data-modo]")?.getAttribute("data-modo"), url: new URL(location.href).searchParams.get("modo"), marcado: Array.from(document.querySelectorAll('[role=radio][aria-checked=true]')).map((e) => (e.textContent || "").trim().toLowerCase()) }));
    const esperadoUrl = id === "entender" ? null : id;
    if (est.modo !== id) falhas.push(`${id}: data-modo=${est.modo}`);
    if (est.url !== esperadoUrl) falhas.push(`${id}: URL modo=${est.url}`);
    if (!est.marcado.includes(id)) falhas.push(`${id}: aria-checked`);
  }
  // seta para a direita move a seleção; recarregar com ?modo= restaura
  await p.getByRole("radio", { name: /^entender$/i }).focus();
  await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(120);
  const aposSeta = await p.evaluate(() => document.querySelector("[data-modo]")?.getAttribute("data-modo"));
  if (aposSeta !== "analisar") falhas.push(`seta: modo=${aposSeta}`);
  await p.goBack().catch(() => {});
  await p.waitForTimeout(150);
  const aposVoltar = await p.evaluate(() => document.querySelector("[data-modo]")?.getAttribute("data-modo"));
  if (aposVoltar !== "entender") falhas.push(`voltar: modo=${aposVoltar}`);
  return { presente: true, coerente: falhas.length === 0, falhas };
}

async function testarComprove(p) {
  const botoes = p.locator('main button:has-text("Comprove este número")');
  const n = await botoes.count();
  if (!n) return { botoes: 0 };
  const alvo = botoes.first();
  await alvo.scrollIntoViewIfNeeded().catch(() => {});
  await alvo.click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(700);
  const ficha = await p.evaluate(() => {
    const d = document.querySelector("dialog[open]");
    if (!d) return { aberta: false };
    const t = d.innerText || "";
    return { aberta: true, sha256: /sha256/i.test(t), formula: /fórmula|formula/i.test(t), fonte: /fonte/i.test(t), reproducao: /reprodu/i.test(t), caracteres: t.length };
  });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(250);
  const fechou = await p.evaluate(() => !document.querySelector("dialog[open]"));
  return { botoes: n, ...ficha, fecha_com_esc: fechou };
}

async function testarCopiarLink(p) {
  const b = p.locator('main button:has-text("Copiar link")').first();
  if (!(await b.count())) return { botoes: 0 };
  await b.scrollIntoViewIfNeeded().catch(() => {});
  await b.click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const st = Array.from(document.querySelectorAll('main [role=status]')).map((e) => (e.textContent || "").trim()).filter(Boolean);
    const campo = Array.from(document.querySelectorAll('main input[readonly]')).find((e) => e.value && e.getBoundingClientRect().width > 40);
    return { mensagem: st.find((t) => /copiad|copie|endereço|link/i.test(t)) ?? null, campo_manual: !!campo, url: campo?.value ?? null };
  });
  return { botoes: 1, ...r, ok: !!(r.mensagem || r.campo_manual) };
}

async function exercitarControles(p, errosRef) {
  const chave = (i) => `${i.grupo}|${i.rotulo}`;
  const feitos = [];
  const vistos = new Set();
  const seletores = [
    'main [role=radio]:not([aria-checked=true]):visible',
    'main [role=tab][aria-selected=false]:visible',
    'main button[aria-pressed=false]:visible',
    'main button[aria-expanded]:visible',
    'main summary:visible',
    'main input[type=checkbox]:visible',
    'main input[type=radio]:not(:checked):visible',
    'main select:visible',
    'main th button:visible',
  ];
  let total = 0;
  for (const sel of seletores) {
    const loc = p.locator(sel);
    const n = await loc.count();
    total += n;
    for (let i = 0; i < Math.min(n, 3) && feitos.length < 18; i++) {
      const alvo = p.locator(sel).nth(i);
      const info = await alvo.evaluate((el) => ({
        tag: el.tagName.toLowerCase(),
        rotulo: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().replace(/\s+/g, " ").slice(0, 50),
        grupo: (el.closest("[role=radiogroup],[role=tablist],details,fieldset")?.getAttribute("aria-label") || el.closest("details")?.querySelector("summary")?.textContent || "").trim().slice(0, 50),
      })).catch(() => null);
      if (!info || /Nível de profundidade|Comprove este número|Copiar link/.test(info.grupo + info.rotulo)) continue;
      if (vistos.has(chave(info))) continue;
      vistos.add(chave(info));
      const estado = () =>
        p.evaluate(() => {
          const t = document.querySelector("main")?.innerText ?? "";
          let h = 5381;
          for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
          return {
            url: location.href,
            h,
            abertos: document.querySelectorAll("details[open]").length,
            ordem: Array.from(document.querySelectorAll("main [aria-sort]")).map((e) => e.getAttribute("aria-sort")).join(","),
            pressionados: Array.from(document.querySelectorAll("main [aria-pressed=true],main [aria-checked=true],main [aria-selected=true]")).length,
            rolagem: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
      const antes = await estado();
      const errosAntes = errosRef.length;
      let acao = "clique";
      try {
        await alvo.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
        if (info.tag === "select") {
          const opcoes = await alvo.evaluate((el) => Array.from(el.options).map((o) => o.value));
          const atual = await alvo.evaluate((el) => el.value);
          const outra = opcoes.find((v) => v !== atual);
          if (outra === undefined) continue;
          await alvo.selectOption(outra, { timeout: 2000 });
          acao = "selecionar";
        } else {
          // caixas e rádios nativos ficam sob o rótulo; um clique que não chega à primeira tentativa (rolagem, carga da máquina)
          // é refeito com mais tempo antes de contar como controle que não aciona
          const tentar = (t) =>
            alvo.click({ timeout: t }).catch(async (e) => {
              if (info.tag !== "input") throw e;
              await alvo.locator("xpath=ancestor::label[1]").click({ timeout: t });
            });
          await tentar(2500).catch(async () => {
            await alvo.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
            await p.waitForTimeout(500);
            await tentar(9000);
          });
        }
      } catch (e) {
        feitos.push({ ...info, ok: false, motivo: String(e.message).split("\n")[0].slice(0, 90) });
        continue;
      }
      await p.waitForTimeout(250);
      const depois = await estado();
      feitos.push({
        ...info,
        acao,
        ok: true,
        mudou_url: antes.url !== depois.url,
        mudou_dom: antes.h !== depois.h || antes.abertos !== depois.abertos || antes.ordem !== depois.ordem || antes.pressionados !== depois.pressionados,
        erros_depois: errosRef.length - errosAntes,
        rolagem_horizontal_depois: depois.rolagem,
      });
    }
  }
  return { encontrados: total, exercitados: feitos.filter((f) => f.ok).length, falhas: feitos.filter((f) => !f.ok).length, sem_efeito: feitos.filter((f) => f.ok && !f.mudou_url && !f.mudou_dom).length, com_erro_depois: feitos.filter((f) => f.ok && f.erros_depois > 0).length, rolagem_depois: feitos.filter((f) => f.rolagem_horizontal_depois).length, detalhe: feitos };
}

/* ---------- verificação de links e âncoras ---------- */
const statusLinks = new Map();
const htmlDestinos = new Map();
async function destino(caminho) {
  if (statusLinks.has(caminho)) return statusLinks.get(caminho);
  const pend = (async () => {
    try {
      const r = await fetch(BASE + caminho, { redirect: "follow" });
      if (r.status === 200 && (r.headers.get("content-type") || "").includes("text/html")) {
        const html = await r.text();
        const ids = new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
        htmlDestinos.set(caminho, ids);
      } else {
        await r.arrayBuffer();
      }
      return r.status;
    } catch (e) {
      return `erro: ${e.message}`;
    }
  })();
  statusLinks.set(caminho, pend);
  return pend;
}

async function verificarLinks(rota, hrefs, idsPagina) {
  const quebrados = [];
  const ancorasAusentes = [];
  let internos = 0;
  for (const href of new Set(hrefs)) {
    if (!href || /^(https?:|mailto:|tel:|javascript:)/.test(href)) continue;
    const [semHash, hash = ""] = href.split("#");
    const alvo = (semHash.split("?")[0] || rota);
    if (!alvo.startsWith("/")) continue;
    internos++;
    if (!semHash && hash) {
      if (!idsPagina.has(decodeURIComponent(hash))) ancorasAusentes.push(`#${hash}`);
      continue;
    }
    const st = await destino(alvo);
    if (st !== 200) {
      quebrados.push(`${href} → ${st}`);
      continue;
    }
    if (hash && htmlDestinos.has(alvo)) {
      const h = (() => { try { return decodeURIComponent(hash); } catch { return hash; } })();
      if (!htmlDestinos.get(alvo).has(h)) ancorasAusentes.push(`${alvo}#${hash}`);
    }
  }
  return { internos, quebrados, ancoras_ausentes: ancorasAusentes };
}

/* ---------- laço principal ---------- */
await mkdir(join(SAIDA, "capturas"), { recursive: true });
const resultados = new Map();

async function medirRota(rota, navegador) {
  const reg = { rota, medicoes: [] };
  for (const modo of MODOS) {
    const larguras = modo === "entender" ? LARGURAS : LARGURAS.filter((w) => w === 390 || w === 1440);
    for (const w of larguras) {
      const movel = w < 800;
      const ctx = await navegador.newContext({ viewport: { width: w, height: movel ? 780 : 900 }, deviceScaleFactor: 1, isMobile: movel, hasTouch: movel, locale: "pt-BR" });
      const p = await ctx.newPage();
      const erros = [];
      const falhas = [];
      const bytes = { html: 0, js: 0, css: 0, dados: 0, outros: 0 };
      p.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && erros.push(m.text().slice(0, 300)));
      p.on("requestfailed", (r) => !/ERR_ABORTED/.test(r.failure()?.errorText ?? "") && falhas.push(`falhou ${r.url().replace(BASE, "")}: ${r.failure()?.errorText ?? ""}`));
      p.on("pageerror", (e) => erros.push(`pageerror: ${String(e.message).slice(0, 300)}`));
      p.on("response", async (r) => {
        if (r.status() >= 400) falhas.push(`${r.status()} ${r.url().replace(BASE, "")}`);
        try {
          const corpo = await r.body();
          const u = r.url().replace(BASE, "");
          const tipo = r.request().resourceType();
          if (tipo === "document" && !u.includes("?_rsc")) bytes.html += corpo.length;
          else if (tipo === "script") bytes.js += corpo.length;
          else if (tipo === "stylesheet") bytes.css += corpo.length;
          else if (/^\/energia\//.test(u)) bytes.dados += corpo.length;
          else bytes.outros += corpo.length;
        } catch {
          /* corpo indisponível (redirecionamento, preflight) */
        }
      });
      const url = BASE + rota + (modo === "auditar" ? "?modo=auditar" : "");
      const t0 = Date.now();
      const resp = await p.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => ({ status: () => `erro: ${String(e.message).slice(0, 80)}` }));
      const carga_ms = Date.now() - t0;
      await p.waitForTimeout(modo === "auditar" ? 900 : 450);
      const m = { rota, largura: w, modo, status: resp?.status?.() ?? null, carga_ms, erros_console: erros.slice(), falhas_rede: falhas.slice(), bytes: { ...bytes } };
      if (m.status === 200) {
        const pg = await p.evaluate(medirPagina);
        await p.addScriptTag({ content: AXE });
        const axe = await p.evaluate(async () => {
          // eslint-disable-next-line no-undef
          const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
          return r.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, exemplo: v.nodes[0]?.target?.join(" ") }));
        });
        Object.assign(m, {
          lang: pg.lang, titulo: pg.titulo, h1: pg.h1, h2: pg.h2, h3: pg.h3, marcos: pg.marcos,
          texto_principal_caracteres: pg.texto_principal_caracteres, dom_nos: pg.dom_nos, altura: pg.altura,
          rolagem_horizontal: pg.scroll_width > pg.inner_width + 1, transbordo: pg.transbordo,
          anomalias: pg.anomalias, marcadores: pg.marcadores, paineis: pg.paineis, alvos: pg.alvos, axe,
        });
        if (w === 1440 || w === 390) {
          const teclado = await medirTeclado(p);
          m.teclado = teclado;
        }
        if (modo === "entender" && (w === 1440 || w === 390)) {
          m.links = await verificarLinks(rota, pg.hrefs, new Set(pg.ids));
          await p.evaluate(() => window.scrollTo(0, 0));
        }
        if (CAPTURAS && modo === "entender" && (w === 1440 || w === 390)) {
          const base = join(SAIDA, "capturas", `${slug(rota)}__${w}`);
          const dobra = await p.screenshot({ path: `${base}_dobra.png` });
          const inteira = await p.screenshot({ path: `${base}_inteira.png`, fullPage: true });
          m.capturas = { dobra: { sha256: sha(dobra), bytes: dobra.length }, inteira: { sha256: sha(inteira), bytes: inteira.length } };
          if (w === 1440) {
            await writeFile(join(SAIDA, "capturas", `${slug(rota)}__texto.txt`), await p.evaluate(() => document.body.innerText));
          }
        }
        if (modo === "entender" && (w === 1440 || w === 390)) {
          m.copiar_link = await testarCopiarLink(p);
          m.comprove = await testarComprove(p);
          m.controles = await exercitarControles(p, erros);
          m.modo_profundidade = await testarModo(p);
          m.erros_apos_interacao = erros.length - m.erros_console.length;
        }
      }
      reg.medicoes.push(m);
      await ctx.close();
    }
  }
  resultados.set(rota, reg);
  const e = reg.medicoes.filter((x) => x.modo === "entender");
  const axeN = reg.medicoes.reduce((s, x) => s + (x.axe?.length ?? 0), 0);
  const rol = reg.medicoes.some((x) => x.rolagem_horizontal);
  const err = reg.medicoes.reduce((s, x) => s + x.erros_console.length + x.falhas_rede.length, 0);
  console.log(`${rota} · ${e[0]?.status} · axe ${axeN} · rolagem ${rol ? "SIM" : "não"} · erros ${err}`);
}

const fila = ROTAS.slice();
await Promise.all(
  Array.from({ length: PARALELO }, async () => {
    // um navegador por trabalhador: se um deles cair, só a rota em curso é refeita num navegador novo
    let navegador = await chromium.launch({ executablePath: CHROMIUM });
    while (fila.length) {
      const rota = fila.shift();
      let ultimoErro = null;
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        try {
          await medirRota(rota, navegador);
          ultimoErro = null;
          break;
        } catch (e) {
          ultimoErro = e;
          console.log(`${rota} · tentativa ${tentativa} falhou: ${String(e.message).split("\n")[0].slice(0, 100)}`);
          await navegador.close().catch(() => {});
          navegador = await chromium.launch({ executablePath: CHROMIUM });
        }
      }
      if (ultimoErro) {
        resultados.set(rota, { rota, erro: String(ultimoErro.message).slice(0, 300), medicoes: [] });
        console.log(`${rota} · ERRO ${String(ultimoErro.message).split("\n")[0].slice(0, 120)}`);
      }
    }
    await navegador.close().catch(() => {});
  }),
);
const rel = {
  base: BASE,
  gerado_em: new Date().toISOString(),
  navegador: "Chromium headless (Playwright), emulação de tela e toque; sem leitor de tela, sem limitação de rede ou CPU",
  larguras: LARGURAS,
  modos: MODOS,
  nao_medido: [
    "clareza didática, hierarquia e densidade visual (exigem leitura e inspeção das capturas)",
    "leitor de tela real (NVDA, JAWS, VoiceOver) e navegação por voz",
    "desempenho de campo (LCP, INP, CLS de usuários reais) e rede lenta",
    "reconciliação dos números com a fonte primária (feita por testes e validações dos módulos)",
  ],
  rotas: ROTAS.map((r) => resultados.get(r)).filter(Boolean),
};
await writeFile(join(SAIDA, "relatorio.json"), JSON.stringify(rel, null, 1));
console.log(`${rel.rotas.length} rotas medidas; relatório em ${join(SAIDA, "relatorio.json")}`);
