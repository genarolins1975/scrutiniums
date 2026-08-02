/* Observatório Brasileiro de Crédito — SPA sem dependências (v0.2).
   Consome os JSON da camada gold. Componentes transversais de transparência:
   badge() [DataStatusBadge], srcLine() [SourcePopover+LastUpdatedLabel], qBadge() [DataQualityBadge],
   confBadge() [ConfidenceIndicator], chartFooter() [rodapé metodológico obrigatório]. */
"use strict";

/* ---------- estado, filtros persistentes e roteamento ---------- */
const DEFAULT_FILTERS = { seg: "total", range: 60, growth: "nominal", instGroup: "todos", sortInst: "ativo" };
const CMP_DEFAULT_METS = ["ativo_total", "patrimonio_liquido", "carteira_credito", "carteira_pf", "carteira_pj",
  "captacoes", "lucro_liquido", "roe_periodo", "npl_pct", "ativos_problematicos_pct", "provisao_credito",
  "cobertura_pct", "indice_basileia", "indice_capital_principal", "cart_ativo_pct"];
const state = {
  data: {},
  filters: { ...DEFAULT_FILTERS, ...loadLS("obc_filters", {}) },
  scen: loadLS("obc_scen_cur", { selic_pp: 0, desemprego_pp: 0, pib_pp: 0, cambio_pct10: 0 }),
  scenSaved: loadLS("obc_scen", null),
  favorites: loadLS("obc_favs", []),
};
state.cmp = loadLS("obc_cmp", null) || { insts: [], mets: CMP_DEFAULT_METS.slice(), norm: "abs",
  ctab: "visao", metric: "carteira_credito", x: "npl_pct", y: "roe_periodo", ref: null, grupo: "auto" };
if (!state.cmp.grupo) state.cmp.grupo = "auto";
if (!state.cmp.ctab) state.cmp.ctab = "visao";
if (!state.cmp.mets || !state.cmp.mets.length) state.cmp.mets = CMP_DEFAULT_METS.slice();
state.cmpCache = {};
state.mkt = { tab: "acoes", modo: "total", emp: "todas" };
state.lead = { tab: "geral" };
state.tr = { fam: "todas" };
state.pan = { met: "saldo", uf: null, cmp: [], cli: "PF", lens: "saldo", exp: null };
state.jud = { ramo: "civel", ordem: "bruto" };
state.px = { modo: "nivel", val: "nominal", metr: "q", insts: ["Pix", "CartaoCredito", "CartaoDebito", "TED", "Boleto"],
  gmet: "q_hab", gpersp: "pag", setor: null, munq: "" };

function loadLS(k, dflt) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function setFilter(k, v) { state.filters[k] = v; saveLS("obc_filters", state.filters); syncHash(); rerenderCurrent(); }

const ROUTES = { overview: "/overview", pulse: "/credit", antecedentes: "/leading-indicators",
  sectors: "/sectors", rj: "/recoveries", institutions: "/institutions", inst: "/institutions/",
  sector: "/sectors/", openfinance: "/open-finance", scenarios: "/scenarios", alerts: "/alerts",
  research: "/research", method: "/methodology",
  products: "/products", product: "/products/", compare: "/compare", market: "/market", leading: "/leading-signals",
  trends: "/search-trends", panorama: "/credit-panorama", bets: "/bets-financial-risk", fraudes: "/financial-fraud", juros: "/interest-rates", sugestoes: "/suggestions", pix: "/pix", sobre: "/about", judicial: "/lawsuits" };
const PATH_MODE = !location.pathname.includes("/web/") && location.protocol !== "file:";
// Embutido na plataforma Scrutiniums: rotas sob /observatorio, dados estáticos sob /obs/.
const BASE = "/observatorio";
const DATA_BASE = PATH_MODE ? "/obs/data/gold/" : (location.pathname.includes("/web/") ? "../data/gold/" : "data/gold/");
// Caminho da SPA sem o prefixo da plataforma (para o roteador interno).
function appPath() {
  const p = location.pathname;
  if (p === BASE || p === BASE + "/") return "/";
  return p.startsWith(BASE + "/") ? p.slice(BASE.length) : p;
}

function currentView() {
  if (PATH_MODE) {
    const p = appPath();
    if (p.startsWith("/institutions/") && p.length > 14) return "inst";
    if (p.startsWith("/products/") && p.length > 10) return "product";
    if (p.startsWith("/sectors/") && p.length > 9) return "sector";
    const hit = Object.entries(ROUTES).find(([v, r]) => r === p);
    if (hit) return hit[0];
  }
  const h = location.hash.replace("#", "");
  return (h.split("?")[0]) || "overview";
}
function buildQuery(view) {
  const qs = new URLSearchParams();
  const f = state.filters;
  if (f.seg !== "total") qs.set("seg", f.seg);
  if (f.range !== 60) qs.set("range", f.range);
  if (f.growth !== "nominal") qs.set("growth", f.growth);
  if (f.instGroup !== "todos") qs.set("grupo", f.instGroup);
  if (!PATH_MODE) { // em modo hash, o código vai na query (#inst?cod=…)
    if (view === "inst" && f.instCod) qs.set("cod", f.instCod);
    if (view === "sector" && f.sectorCod) qs.set("cod", f.sectorCod);
    if (view === "product" && f.productSlug) qs.set("slug", f.productSlug);
  }
  if (view === "leading" && state.lead && state.lead.tab !== "geral") qs.set("ltab", state.lead.tab);
  if (view === "trends" && state.tr && state.tr.fam !== "todas") qs.set("tfam", state.tr.fam);
  if (view === "panorama" && state.pan) {
    if (state.pan.met !== "saldo") qs.set("pmet", state.pan.met);
    if (state.pan.uf) qs.set("puf", state.pan.uf);
    if (state.pan.cmp.length) qs.set("pcmp", state.pan.cmp.join("."));
    if (state.pan.cli !== "PF") qs.set("pcli", state.pan.cli);
    if (state.pan.lens !== "saldo") qs.set("plens", state.pan.lens);
  }
  if (view === "judicial" && state.jud) {
    if (state.jud.ramo !== "civel") qs.set("jramo", state.jud.ramo);
    if (state.jud.ordem !== "bruto") qs.set("jordem", state.jud.ordem);
  }
  if (view === "pix" && state.px) {
    if (state.px.modo !== "nivel") qs.set("xmodo", state.px.modo);
    if (state.px.val !== "nominal") qs.set("xval", state.px.val);
    if (state.px.metr !== "q") qs.set("xmetr", state.px.metr);
    if (state.px.gmet !== "q_hab") qs.set("xgmet", state.px.gmet);
    if (state.px.gpersp !== "pag") qs.set("xpersp", state.px.gpersp);
    if (state.px.setor) qs.set("xsetor", state.px.setor);
  }
  if (view === "market" && state.mkt) {
    if (state.mkt.tab !== "acoes") qs.set("mtab", state.mkt.tab);
    if (state.mkt.modo !== "total") qs.set("mmodo", state.mkt.modo);
    if (state.mkt.emp && state.mkt.emp !== "todas") qs.set("memp", state.mkt.emp);
  }
  if (view === "compare" && state.cmp.insts.length) {
    qs.set("insts", state.cmp.insts.join("."));
    qs.set("mets", state.cmp.mets.join("."));
    qs.set("norm", state.cmp.norm);
    qs.set("ctab", state.cmp.ctab);
    if (state.cmp.metric) qs.set("cmetric", state.cmp.metric);
    if (state.cmp.x) qs.set("cx", state.cmp.x);
    if (state.cmp.y) qs.set("cy", state.cmp.y);
    if (state.cmp.size) qs.set("csize", state.cmp.size);
    if (state.cmp.ref) qs.set("cref", state.cmp.ref);
    if (state.cmp.grupo && state.cmp.grupo !== "auto") qs.set("cgrupo", state.cmp.grupo);
  }
  const q = qs.toString();
  return q ? "?" + q : "";
}
function syncHash() {
  const v = currentView();
  if (PATH_MODE) {
    let path = ROUTES[v] || "/overview";
    if (v === "inst" && state.filters.instCod) path = "/institutions/" + state.filters.instCod;
    if (v === "product" && state.filters.productSlug) path = "/products/" + state.filters.productSlug;
    if (v === "sector" && state.filters.sectorCod) path = "/sectors/" + state.filters.sectorCod;
    history.replaceState(null, "", BASE + path + buildQuery(v));
  } else {
    history.replaceState(null, "", "#" + v + buildQuery(v));
  }
}
function parseHash() {
  const qs = new URLSearchParams(PATH_MODE ? location.search : (location.hash.split("?")[1] || ""));
  if (qs.get("seg")) state.filters.seg = qs.get("seg");
  if (qs.get("range")) state.filters.range = parseInt(qs.get("range"), 10);
  if (qs.get("growth")) state.filters.growth = qs.get("growth");
  if (qs.get("grupo")) state.filters.instGroup = qs.get("grupo");
  if (!PATH_MODE) { // deep-link local: #inst?cod=… / #sector?cod=… / #product?slug=…
    if (qs.get("cod") && currentView() === "inst") state.filters.instCod = qs.get("cod");
    if (qs.get("cod") && currentView() === "sector") state.filters.sectorCod = qs.get("cod");
    if (qs.get("slug") && currentView() === "product") state.filters.productSlug = qs.get("slug");
  }
  // estado do comparador via URL (compartilhável)
  if (qs.get("insts")) state.cmp.insts = qs.get("insts").split(".").filter(Boolean).slice(0, 10);
  if (qs.get("mets")) state.cmp.mets = qs.get("mets").split(".").filter(Boolean);
  if (qs.get("norm")) state.cmp.norm = qs.get("norm");
  if (qs.get("ctab")) state.cmp.ctab = qs.get("ctab");
  if (qs.get("cmetric")) state.cmp.metric = qs.get("cmetric");
  if (qs.get("cx")) state.cmp.x = qs.get("cx");
  if (qs.get("cy")) state.cmp.y = qs.get("cy");
  if (qs.get("csize")) state.cmp.size = qs.get("csize");
  if (qs.get("cref")) state.cmp.ref = qs.get("cref");
  if (qs.get("cgrupo")) state.cmp.grupo = qs.get("cgrupo");
  if (qs.get("ltab")) state.lead.tab = qs.get("ltab");
  if (qs.get("tfam")) state.tr.fam = qs.get("tfam");
  if (qs.get("pmet")) state.pan.met = qs.get("pmet");
  if (qs.get("puf")) state.pan.uf = qs.get("puf");
  if (qs.get("pcmp")) state.pan.cmp = qs.get("pcmp").split(".").filter(Boolean).slice(0, 3);
  if (qs.get("pcli")) state.pan.cli = qs.get("pcli");
  if (qs.get("plens")) state.pan.lens = qs.get("plens");
  if (qs.get("jramo")) state.jud.ramo = qs.get("jramo");
  if (qs.get("jordem")) state.jud.ordem = qs.get("jordem");
  if (qs.get("xmodo")) state.px.modo = qs.get("xmodo");
  if (qs.get("xval")) state.px.val = qs.get("xval");
  if (qs.get("xmetr")) state.px.metr = qs.get("xmetr");
  if (qs.get("xgmet")) state.px.gmet = qs.get("xgmet");
  if (qs.get("xpersp")) state.px.gpersp = qs.get("xpersp");
  if (qs.get("xsetor")) state.px.setor = qs.get("xsetor");
  if (qs.get("mtab")) state.mkt.tab = qs.get("mtab");
  if (qs.get("mmodo")) state.mkt.modo = qs.get("mmodo");
  if (qs.get("memp")) state.mkt.emp = qs.get("memp");
  if (PATH_MODE) {
    const p = appPath();
    if (p.startsWith("/institutions/") && p.length > 14) state.filters.instCod = p.slice(14).replace(/\/$/, "");
    if (p.startsWith("/products/") && p.length > 10) state.filters.productSlug = p.slice(10).replace(/\/$/, "");
    if (p.startsWith("/sectors/") && p.length > 9) state.filters.sectorCod = p.slice(9).replace(/\/$/, "");
  }
  return currentView();
}
window.addEventListener("popstate", () => { const v = parseHash(); if (RENDER[v]) showViewSilent(v); });

const fmt = {
  n: (v, d = 2) => v == null ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }),
  n0: v => v == null ? "–" : Math.round(v).toLocaleString("pt-BR"),
  bi: v => v == null ? "–" : (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " bi",
  triFromMi: v => v == null ? "–" : (v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " tri",
  money: v => v == null ? "–" : v >= 1e12 ? "R$ " + fmt.n(v / 1e12, 2) + " tri" : "R$ " + fmt.n(v / 1e9, 1) + " bi",
  d: iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "–",
  my: iso => iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "–",
  pp: v => v == null ? "–" : (v > 0 ? "+" : "") + fmt.n(v, 2),
};

/* escape único para valores interpolados em ATRIBUTOS HTML (aria-label, title, alt, data-*):
   remove tags (rótulos com badges/chips viram texto puro) e escapa aspas duplas.
   Mesma família da correção do mcard — nunca altera o conteúdo visível, só o atributo. */
const attr = s => String(s == null ? "" : s).replace(/<[^>]*>/g, "").replace(/"/g, "&quot;").replace(/\s+/g, " ").trim();

const APP_VERSION = "0.39.0"; // sincronizada com o cache-buster dos assets no index.html

// núcleo mínimo na abertura: só o que a Visão geral padrão e o chrome (título,
// badge de alertas, rodapé) precisam; todo o resto carrega sob demanda por
// página (VIEW_DATA) ou por bloco habilitado da Visão geral (OV_BLOCO_DATA).
const CORE_FILES = ["meta", "pulse", "ibcc", "overview", "alerts"];
const VIEW_DATA = {
  pulse: ["regimes"],
  antecedentes: ["antecedentes", "regimes"],
  sectors: ["exposures", "sectors"], sector: ["exposures", "sectors"],
  rj: ["rj"],
  institutions: ["institutions", "inst_index", "npl"], inst: ["inst_pages", "institutions", "inst_index", "npl"],
  method: ["method", "lineage", "quality"],
  compare: ["compare", "inst_index"],
  research: ["institutions", "inst_index", "antecedentes", "regimes"],
  market: ["market"],
  leading: ["leading"],
  trends: ["trends"],
  panorama: ["panorama"],
  pix: ["pix"],
  judicial: ["judicial"],
  openfinance: ["openfinance"],
  scenarios: ["scenario"],
  alerts: ["sectors", "scenario", "quality"],
  products: ["products"], product: ["products"],
  bets: ["bets"],
  fraudes: ["fraudes"],
  juros: ["juros"],
};
async function fetchGold(f) {
  try { state.data[f] = await (await fetch(`${DATA_BASE}${f}.json?v=${APP_VERSION}`)).json(); }
  catch (e) { state.data[f] = null; }
}
async function loadAll() {
  await Promise.all(CORE_FILES.map(fetchGold));
}
async function ensureData(v) {
  const need = (VIEW_DATA[v] || []).filter(f => state.data[f] === undefined);
  if (need.length) await Promise.all(need.map(fetchGold));
}

/* ---------- componentes transversais de transparência ---------- */
const BADGES = {
  observado: ["obs", "DADO OBSERVADO"], calculado: ["calc", "DADO CALCULADO"],
  estimado: ["est", "DADO ESTIMADO"], previsao: ["prev", "PREVISÃO"], cenario: ["cen", "CENÁRIO"],
  experimental: ["exp", "EXPERIMENTAL"], demo: ["demo", "DADO DEMONSTRATIVO"], descontinuada: ["desc", "SÉRIE DESCONTINUADA"],
};
function badge(kind, title) {
  const b = BADGES[kind];
  if (!b) return "";
  return `<span class="seal ${b[0]}" ${title ? `title="${attr(title)}"` : ""}>${b[1]}</span>`;
}
function sealFor(tipo) {
  if (!tipo) return "";
  const t = tipo.toUpperCase();
  if (t.includes("OBSERVADO")) return badge("observado");
  if (t.includes("PREVIS")) return badge("previsao");
  if (t.includes("CENÁRIO")) return badge("cenario");
  if (t.includes("DEMONSTRATIVO")) return badge("demo");
  if (t.includes("CALCULADO")) return badge("calculado");
  if (t.includes("ESTIMAD")) return badge("estimado");
  return `<span class="seal aprox">${tipo}</span>`;
}
function qBadge(q) {
  if (!q) return "";
  const c = q.score >= 80 ? "q-high" : q.score >= 60 ? "q-mid" : "q-low";
  return `<span class="qbadge ${c}" title="completude ${q.componentes.completude} · atualidade ${q.componentes.atualidade} · histórico ${q.componentes.historico} · estabilidade ${q.componentes.estabilidade} · transparência ${q.componentes.transparencia}">qualidade ${q.score}</span>`;
}
function confBadge(level, motivo) {
  const c = level === "alta" ? "q-high" : level === "moderada" ? "q-mid" : "q-low";
  return `<span class="qbadge ${c}" title="${attr(motivo || "")}">confiança ${level}</span>`;
}
function srcLine(meta, q) {
  if (!meta) return "";
  return `<div class="src"><b>${meta.source}</b> · série ${meta.series_code} · ${meta.unit} · ${meta.freq} · ref. ${q ? fmt.my(q.ultima_ref) : "–"} · coletado ${meta.last_collected_at ? meta.last_collected_at.slice(0, 10) : "–"} ${qBadge(q)}<br><span title="${attr(meta.methodology)}">${meta.methodology}</span></div>`;
}
function chartFooter(opts) {
  // rodapé obrigatório: fonte · período · atualização · unidade · nota metodológica
  return `<div class="chartfoot">Fonte: ${opts.fonte || "–"} · Período: ${opts.periodo || "–"} · Atualizado: ${opts.atualizado || "–"} · Unidade: ${opts.unidade || "–"}${opts.nota ? ` · <span title="${attr(opts.nota)}">nota metodológica ⓘ</span>` : ""}</div>`;
}
function favStar(type, key, label) {
  const isFav = state.favorites.some(f => f.type === type && f.key === key);
  return `<button class="star ${isFav ? "on" : ""}" title="${isFav ? "remover dos" : "salvar nos"} favoritos" onclick="toggleFav('${type}','${key}',this,'${attr(label || "").replace(/'/g, "")}')">${isFav ? "★" : "☆"}</button>`;
}
window.toggleFav = (type, key, el, label) => {
  const i = state.favorites.findIndex(f => f.type === type && f.key === key);
  if (i >= 0) state.favorites.splice(i, 1); else state.favorites.push({ type, key, label });
  saveLS("obc_favs", state.favorites);
  rerenderCurrent();
};

/* ---------- gráficos SVG ---------- */
/* cores legadas → tokens (permite dark mode sem tocar em cada chamada) */
const COLOR_VARS = {
  "#1d4e89": "var(--c-line1)", "#0e7c7b": "var(--c-line2)", "#b45309": "var(--c-line3)",
  "#6b46a3": "var(--c-forecast)", "#b91c1c": "var(--c-neg)", "#2f7d4f": "var(--c-pos)",
  "#64748b": "var(--c-gray)", "#c2540a": "var(--c-line3)", "#17879c": "var(--c-line2)",
  "#d9a514": "var(--c-line3)", "#aaa": "var(--c-gray)",
};
function ccol(c) { return COLOR_VARS[c] || c || "var(--c-line1)"; }

function lineChart(opts) {
  const W = opts.w || 720, H = opts.h || 240;
  const all = [];
  opts.series.forEach(s => s.pts.forEach(p => { if (p.y != null) all.push(p.y); }));
  if (opts.band) opts.band.pts.forEach(p => { all.push(p.lo, p.hi); });
  if (!all.length) return "<p class='src'>Sem dados para o período/filtro selecionado — a série pode ainda não ter sido coletada ou não existir nesta fonte.</p>";
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  // séries não negativas (contagens, valores) não devem ganhar eixo negativo pelo respiro
  if (opts.lo0 !== false && lo < 0 && Math.min(...all) >= 0) lo = 0;
  const dec = opts.dec != null ? opts.dec : (Math.abs(hi) > 200 ? 0 : Math.abs(hi) > 20 ? 1 : 2);
  const ticks = 4, tickVals = [], tickLbls = [];
  for (let i = 0; i <= ticks; i++) { const v = lo + (hi - lo) * i / ticks; tickVals.push(v); tickLbls.push(fmt.n(v, dec)); }
  // margem esquerda dinâmica: nunca truncar rótulos do eixo Y
  const maxLbl = Math.max(...tickLbls.map(t => t.length));
  const M = { t: 14, r: opts.endLabels ? 100 : 16, b: 26, l: Math.max(40, 12 + maxLbl * 6.3) };
  const allX = [...new Set(opts.series.flatMap(s => s.pts.map(p => p.x)).concat(opts.band ? opts.band.pts.map(p => p.x) : []))].sort();
  const xi = x => allX.indexOf(x);
  const X = x => M.l + (xi(x) / Math.max(allX.length - 1, 1)) * (W - M.l - M.r);
  const Y = y => M.t + (1 - (y - lo) / (hi - lo)) * (H - M.t - M.b);
  // payload para crosshair/tooltip
  const seriesData = opts.series.map(s => {
    const m = new Map(s.pts.map(p => [p.x, p.y]));
    return { label: s.label || "", color: ccol(s.color), vals: allX.map(x => m.has(x) ? m.get(x) : null) };
  });
  let bandData = null;
  if (opts.band) {
    const m = new Map(opts.band.pts.map(p => [p.x, p]));
    bandData = { lo: allX.map(x => m.has(x) ? m.get(x).lo : null), hi: allX.map(x => m.has(x) ? m.get(x).hi : null) };
  }
  const payload = encodeURIComponent(JSON.stringify({
    xs: allX, series: seriesData, band: bandData, dec,
    unit: opts.unit || "", fonte: opts.fonte || "", status: opts.status || "",
    ml: M.l, mr: M.r, w: W, h: H, mt: M.t, mb: M.b, lo, hi,
  }));
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" tabindex="0" data-ix="1" data-chart="${payload}" aria-label="${attr(opts.aria || "gráfico de série temporal")}${opts.unit ? `, em ${attr(opts.unit)}` : ""}. Use as setas para percorrer os valores.">`;
  for (let i = 0; i <= ticks; i++) {
    const y = Y(tickVals[i]);
    out += `<line x1="${M.l}" x2="${W - M.r}" y1="${y}" y2="${y}" style="stroke:var(--c-grid)"/>`;
    out += `<text x="${M.l - 7}" y="${y + 3}" text-anchor="end" font-size="10" style="fill:var(--c-axis-text)">${tickLbls[i]}</text>`;
  }
  const step = Math.max(1, Math.floor(allX.length / 6));
  for (let i = 0; i < allX.length; i += step) {
    out += `<text x="${X(allX[i])}" y="${H - 8}" text-anchor="middle" font-size="10" style="fill:var(--c-axis-text)">${fmt.my(allX[i])}</text>`;
  }
  if (opts.band) {
    const bp = opts.band.pts.filter(p => p.lo != null && p.hi != null);
    const up = bp.map(p => `${X(p.x)},${Y(p.hi)}`).join(" ");
    const dn = bp.slice().reverse().map(p => `${X(p.x)},${Y(p.lo)}`).join(" ");
    out += `<polygon points="${up} ${dn}" style="fill:var(--c-band)" stroke="none"/>`;
  }
  if (opts.forecastStart != null && allX.includes(opts.forecastStart)) {
    const x = X(opts.forecastStart);
    out += `<line x1="${x}" x2="${x}" y1="${M.t}" y2="${H - M.b}" style="stroke:var(--c-axis)" stroke-dasharray="2,3"/>`;
    out += `<text x="${x + 5}" y="${M.t + 9}" font-size="9" style="fill:var(--c-axis-text)">início da previsão</text>`;
  }
  (opts.annotations || []).forEach((an, ai) => {
    if (!allX.includes(an.x)) return;
    const ax = X(an.x);
    out += `<line x1="${ax}" x2="${ax}" y1="${M.t}" y2="${H - M.b}" style="stroke:${ccol(an.color || "#b45309")}" stroke-dasharray="4,3" stroke-width="1.2"/>`;
    // alturas alternadas e âncora invertida perto da borda direita: rótulos não se sobrepõem
    const aTy = M.t + 10 + (ai % 3) * 11;
    const aRight = ax > W - M.r - 90;
    out += `<text x="${aRight ? ax - 4 : ax + 4}" y="${aTy}" text-anchor="${aRight ? "end" : "start"}" font-size="9" style="fill:${ccol(an.color || "#b45309")};paint-order:stroke;stroke:var(--c-halo);stroke-width:3px">${an.label}</text>`;
  });
  (opts.hlines || []).forEach(hl => {
    out += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(hl.y)}" y2="${Y(hl.y)}" style="stroke:${ccol(hl.color)}" stroke-dasharray="3,3"/><text x="${W - M.r}" y="${Y(hl.y) - 4}" text-anchor="end" font-size="10" style="fill:${ccol(hl.color)}">${hl.label || ""}</text>`;
  });
  opts.series.forEach((s, si) => {
    const d = s.pts.filter(p => p.y != null).map((p, i) => `${i ? "L" : "M"}${X(p.x)},${Y(p.y)}`).join(" ");
    out += `<path class="serie s${si}" d="${d}" fill="none" style="stroke:${ccol(s.color)}" stroke-width="${s.w || 1.8}" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`;
  });
  // rótulos DIRETOS no fim de cada linha: nome curto na cor da série, com
  // anti-colisão vertical simples (melhor prática de identificação de séries)
  if (opts.endLabels) {
    const ends = [];
    opts.series.forEach((sx, si) => {
      const lp = [...sx.pts].reverse().find(p2 => p2.y != null);
      if (lp) ends.push({ y: Y(lp.y), x: X(lp.x), label: String(sx.short || sx.label || "").slice(0, 15), color: ccol(sx.color) });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) {
      if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
    }
    const yMax = H - M.b - 2;
    for (let i = ends.length - 1; i >= 0; i--) {
      if (ends[i].y > yMax) ends[i].y = yMax - (ends.length - 1 - i) * 12;
    }
    ends.forEach(e2 => {
      out += `<circle cx="${e2.x}" cy="${Math.min(Math.max(e2.y, M.t + 4), yMax)}" r="0" fill="none"/>`;
      out += `<text x="${e2.x + 6}" y="${Math.min(Math.max(e2.y, M.t + 8), yMax) + 3}" font-size="10" font-weight="640" style="fill:${e2.color};paint-order:stroke;stroke:var(--c-halo);stroke-width:3px">${e2.label}</text>`;
    });
  }
  // último valor da série principal sempre rotulado (a conclusão não depende do hover)
  const s0 = opts.series[0];
  if (s0 && !opts.noLast && !opts.endLabels) {
    const lastPt = [...s0.pts].reverse().find(p => p.y != null);
    if (lastPt) {
      const lx = X(lastPt.x), ly = Y(lastPt.y);
      const anchor = lx > W - M.r - 52 ? "end" : "start";
      const tx = anchor === "end" ? lx - 6 : lx + 6;
      out += `<circle cx="${lx}" cy="${ly}" r="3" style="fill:${ccol(s0.color)}"/>`;
      out += `<text x="${tx}" y="${ly - 6}" text-anchor="${anchor}" font-size="10.5" font-weight="640" style="fill:${ccol(s0.color)};paint-order:stroke;stroke:var(--c-halo);stroke-width:3px">${fmt.n(lastPt.y, dec)}</text>`;
    }
  }
  // crosshair (posicionado via JS no hover/teclado)
  out += `<g class="xhair"><line x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" style="stroke:var(--c-axis)" stroke-width="1"/>`;
  seriesData.forEach((s, si) => { out += `<circle class="c${si}" r="3.4" style="fill:${s.color};stroke:var(--c-halo);stroke-width:1.5" cx="-20" cy="-20"/>`; });
  out += `</g></svg>`;
  // alternativa tabular acessível (WCAG): mesmos dados do gráfico
  if (!opts.noTable) {
    const heads = opts.series.map((sx, i) => sx.label || "série " + (i + 1));
    out += `<details class="charttable"><summary>dados em tabela</summary><div class="tblwrap" style="max-height:260px"><table class="data compact"><thead><tr><th>Período</th>${heads.map(h2 => `<th style="text-align:right">${h2}</th>`).join("")}${opts.band ? "<th style='text-align:right'>banda p10</th><th style='text-align:right'>banda p90</th>" : ""}</tr></thead><tbody>` +
      allX.map((x, i) => `<tr><td>${fmt.my(x)}</td>${seriesData.map(sd => `<td style="text-align:right">${sd.vals[i] != null ? fmt.n(sd.vals[i], dec) : "–"}</td>`).join("")}${bandData ? `<td style="text-align:right">${bandData.lo[i] != null ? fmt.n(bandData.lo[i], dec) : "–"}</td><td style="text-align:right">${bandData.hi[i] != null ? fmt.n(bandData.hi[i], dec) : "–"}</td>` : ""}</tr>`).join("") +
      `</tbody></table></div></details>`;
  }
  return out;
}

/* ---------- tooltip + crosshair (delegação global) ---------- */
const tipEl = document.getElementById("tooltip");
function showTip(html, cx, cy) {
  tipEl.innerHTML = html;
  tipEl.style.display = "block";
  tipEl.setAttribute("aria-hidden", "false");
  const r = tipEl.getBoundingClientRect();
  let x = cx + 14, y = cy + 14;
  if (x + r.width > innerWidth - 8) x = cx - r.width - 12;
  if (y + r.height > innerHeight - 8) y = cy - r.height - 12;
  tipEl.style.left = Math.max(6, x) + "px";
  tipEl.style.top = Math.max(6, y) + "px";
}
function hideTip() { tipEl.style.display = "none"; tipEl.setAttribute("aria-hidden", "true"); }

function chartPayload(svg) {
  if (!svg._chart) { try { svg._chart = JSON.parse(decodeURIComponent(svg.dataset.chart)); } catch (e) { return null; } }
  return svg._chart;
}
function chartIndexFromEvent(svg, e) {
  const c = chartPayload(svg); if (!c) return null;
  const r = svg.getBoundingClientRect();
  const vx = (e.clientX - r.left) * c.w / r.width;
  const t = (vx - c.ml) / Math.max(c.w - c.ml - c.mr, 1);
  return Math.max(0, Math.min(c.xs.length - 1, Math.round(t * (c.xs.length - 1))));
}
function chartShowIndex(svg, i, clientAnchor) {
  const c = chartPayload(svg); if (!c || i == null) return;
  svg._ki = i;
  const X = c.ml + (i / Math.max(c.xs.length - 1, 1)) * (c.w - c.ml - c.mr);
  const Y = y => c.mt + (1 - (y - c.lo) / (c.hi - c.lo)) * (c.h - c.mt - c.mb);
  svg.classList.add("hovering");
  const g = svg.querySelector("g.xhair");
  if (g) {
    const ln = g.querySelector("line");
    ln.setAttribute("x1", X); ln.setAttribute("x2", X);
    c.series.forEach((s, si) => {
      const dot = g.querySelector(".c" + si);
      if (!dot) return;
      if (s.vals[i] == null) { dot.setAttribute("cx", -20); dot.setAttribute("cy", -20); }
      else { dot.setAttribute("cx", X); dot.setAttribute("cy", Y(s.vals[i])); }
    });
  }
  let html = `<div class="tt-date">${fmt.my(c.xs[i])}</div>`;
  c.series.forEach((s, si) => {
    const v = s.vals[i];
    if (v == null) return;
    const prev = i > 0 ? s.vals[i - 1] : null;
    const dtxt = v != null && prev != null ? ` <span class="tt-delta ${v - prev >= 0 ? "" : ""}" style="color:var(--text-3)">(${fmt.pp(v - prev)})</span>` : "";
    html += `<div class="tt-row"><span class="tt-lbl"><span class="sw" style="background:${s.color}"></span>${s.label || "valor"}</span><span class="tt-val">${v == null ? "–" : fmt.n(v, c.dec)}${c.unit ? " " + c.unit : ""}${si === 0 ? dtxt : ""}</span></div>`;
  });
  if (c.band && c.band.lo[i] != null) {
    html += `<div class="tt-row"><span class="tt-lbl"><span class="sw" style="background:var(--c-band)"></span>banda p10–p90</span><span class="tt-val">${fmt.n(c.band.lo[i], c.dec)} – ${fmt.n(c.band.hi[i], c.dec)}</span></div>`;
  }
  if (c.status || c.fonte) html += `<div class="tt-meta">${[c.status, c.fonte].filter(Boolean).join(" · ")}</div>`;
  const r = svg.getBoundingClientRect();
  const cx = clientAnchor ? clientAnchor.x : r.left + X * r.width / c.w;
  const cy = clientAnchor ? clientAnchor.y : r.top + r.height * 0.35;
  showTip(html, cx, cy);
}
function chartClear(svg) {
  svg.classList.remove("hovering");
  const g = svg.querySelector("g.xhair");
  if (g) g.querySelectorAll("circle").forEach(d => { d.setAttribute("cx", -20); d.setAttribute("cy", -20); });
  hideTip();
}
let PINNED_SVG = null;
document.addEventListener("mousemove", e => {
  const svg = e.target.closest ? e.target.closest("svg.chart[data-ix]") : null;
  if (svg) { if (svg !== PINNED_SVG) chartShowIndex(svg, chartIndexFromEvent(svg, e), { x: e.clientX, y: e.clientY }); return; }
  const tipped = e.target.closest ? e.target.closest("[data-tip]") : null;
  if (tipped) { if (!PINNED_SVG) showTip(decodeURIComponent(tipped.dataset.tip), e.clientX, e.clientY); return; }
  if (PINNED_SVG) return; // data fixada: tooltip permanece até novo clique/Esc
  hideTip();
  document.querySelectorAll("svg.chart.hovering").forEach(chartClear);
});
// clique fixa/desafixa a data (spec §14); touch usa o mesmo caminho do ponteiro
document.addEventListener("click", e => {
  const svg = e.target.closest ? e.target.closest("svg.chart[data-ix]") : null;
  if (!svg) return;
  if (PINNED_SVG === svg) { PINNED_SVG = null; chartClear(svg); return; }
  if (PINNED_SVG) chartClear(PINNED_SVG);
  PINNED_SVG = svg;
  chartShowIndex(svg, chartIndexFromEvent(svg, e), { x: e.clientX, y: e.clientY });
});
["touchstart", "touchmove"].forEach(ev => document.addEventListener(ev, e => {
  const t = e.touches && e.touches[0];
  if (!t) return;
  const svg = document.elementFromPoint(t.clientX, t.clientY);
  const chart = svg && svg.closest ? svg.closest("svg.chart[data-ix]") : null;
  if (chart) chartShowIndex(chart, chartIndexFromEvent(chart, { clientX: t.clientX }), { x: t.clientX, y: t.clientY });
}, { passive: true }));
document.addEventListener("mouseleave", () => { hideTip(); }, true);
document.addEventListener("keydown", e => {
  const svg = document.activeElement;
  if (!(svg instanceof SVGElement) || !svg.matches("svg.chart[data-ix]")) return;
  const c = chartPayload(svg); if (!c) return;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    e.preventDefault();
    const cur = svg._ki != null ? svg._ki : c.xs.length - 1;
    chartShowIndex(svg, Math.max(0, Math.min(c.xs.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1))));
  } else if (e.key === "Escape") { chartClear(svg); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && PINNED_SVG) { chartClear(PINNED_SVG); PINNED_SVG = null; } });
document.addEventListener("focusout", e => { if (e.target instanceof SVGElement && e.target.matches("svg.chart")) chartClear(e.target); });

function sparkline(vals, w = 90, h = 24) {
  if (!vals || vals.length < 2) return "";
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const X = i => 2 + i / (vals.length - 1) * (w - 4);
  const Y = v => hi - lo < 1e-9 ? h / 2 : 3 + (1 - (v - lo) / (hi - lo)) * (h - 6);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  return `<svg width="${w}" height="${h}" style="vertical-align:middle" aria-hidden="true"><path d="${d}" fill="none" style="stroke:var(--c-line1)" stroke-width="1.5"/><circle cx="${X(vals.length - 1)}" cy="${Y(vals[vals.length - 1])}" r="2.4" style="fill:var(--c-line1)"/></svg>`;
}
function contribBar(label, v, scale = 22) {
  const w = Math.min(Math.abs(v) * scale, 140);
  return `<div class="contrib"><span class="lbl">${label}</span><span class="bar ${v >= 0 ? "pos" : "neg"}" style="width:${w}px"></span><span class="num">${v >= 0 ? "+" : ""}${fmt.n(v, 2)}</span></div>`;
}
const ALERT_STATES = ["ativo", "em análise", "acompanhado", "resolvido", "descartado"];
function alertState(id) { return (loadLS("obc_alert_states", {}))[id] || "ativo"; }
window.setAlertState = (id, st) => { const m = loadLS("obc_alert_states", {}); m[id] = st; saveLS("obc_alert_states", m); renderAlerts(); };
function alertHtml(a, linkArea, comEstado) {
  const st = alertState(a.id);
  return `<div class="alert ${a.nivel}" style="${st === "descartado" || st === "resolvido" ? "opacity:.55" : ""}">
    <span class="lvl">${a.nivel}</span> <b class="clickable" onclick="nav('${linkArea || "pulse"}')">${a.titulo}</b>
    ${a.recorrente ? ` <span class="qbadge q-mid" title="já disparado em ${a.disparos_anteriores} execuções anteriores">recorrente</span>` : ""}
    ${comEstado ? ` <select onchange="setAlertState('${a.id}', this.value)" style="float:right">${ALERT_STATES.map(s => `<option ${s === st ? "selected" : ""}>${s}</option>`).join("")}</select>` : ""}
    <div class="expl">${a.explicacao}</div></div>`;
}
window.nav = (view, filters) => {
  if (filters) { Object.assign(state.filters, filters); saveLS("obc_filters", state.filters); }
  showView(view);
};
/* seletor global PF/PJ/Total — usado em todas as abas onde a fonte tem o corte */
function segTabs() {
  return `<span class="seg">${["total", "pf", "pj"].map(s =>
    `<button class="${state.filters.seg === s ? "active" : ""}" onclick="setFilter('seg','${s}')">${{ total: "Total", pf: "PF", pj: "PJ" }[s]}</button>`).join("")}</span>`;
}
function segName() { return { total: "Total", pf: "Pessoas físicas", pj: "Pessoas jurídicas" }[state.filters.seg]; }

/* ---------- VISÃO GERAL ---------- */



/* ---------- waterfall (ponte do lucro / capital) ---------- */
function waterfallChart(steps, w = 720, h = 280, unit) {
  // steps: [{label, v, tipo: 'abs'|'delta', expl}] — 'abs' ancora no zero (início/fim)
  let cum = 0;
  const pos = steps.map(st => {
    if (st.tipo === "abs") { const p = { y0: 0, y1: st.v }; cum = st.v; return p; }
    const p = { y0: cum, y1: cum + st.v }; cum += st.v; return p;
  });
  const all = pos.flatMap(p => [p.y0, p.y1]);
  let lo = Math.min(...all, 0), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const ML = 62, MR = 12, MT = 14, MB = 58;
  const X = i => ML + i * (w - ML - MR) / steps.length;
  const bw = (w - ML - MR) / steps.length * 0.62;
  const Y = v => MT + (1 - (v - lo) / (hi - lo)) * (h - MT - MB);
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="gráfico de ponte (waterfall)">`;
  for (let i = 0; i <= 4; i++) {
    const v = lo + (hi - lo) * i / 4;
    out += `<line x1="${ML}" x2="${w - MR}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--c-grid)"/><text x="${ML - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9.5" style="fill:var(--c-axis-text)">${fmt.n(v / 1e9, 0)}</text>`;
  }
  if (lo < 0) out += `<line x1="${ML}" x2="${w - MR}" y1="${Y(0)}" y2="${Y(0)}" style="stroke:var(--c-axis)"/>`;
  steps.forEach((st, i) => {
    const p = pos[i];
    const yTop = Y(Math.max(p.y0, p.y1)), hBar = Math.max(2, Math.abs(Y(p.y0) - Y(p.y1)));
    const cor = st.tipo === "abs" ? "var(--c-line1)" : (st.v >= 0 ? "var(--c-pos)" : "var(--c-neg)");
    const tip = encodeURIComponent(`<div class="tt-date">${st.label}</div><div class="tt-row"><span class="tt-lbl">impacto</span><span class="tt-val">${st.v >= 0 ? "+" : ""}R$ ${fmt.n(st.v / 1e9, 2)} bi</span></div>${st.expl ? `<div class="tt-meta">${st.expl}</div>` : ""}`);
    out += `<rect x="${X(i) + (X(1) - X(0) - bw) / 2}" y="${yTop}" width="${bw}" height="${hBar}" rx="3" data-tip="${tip}" style="fill:${cor}" opacity="${st.tipo === "abs" ? 1 : 0.85}"/>`;
    if (i < steps.length - 1) out += `<line x1="${X(i) + (X(1) - X(0) + bw) / 2}" x2="${X(i + 1) + (X(1) - X(0) - bw) / 2}" y1="${Y(p.y1)}" y2="${Y(p.y1)}" style="stroke:var(--c-axis)" stroke-dasharray="2,2"/>`;
    out += `<text x="${X(i) + (X(1) - X(0)) / 2}" y="${yTop - 5}" text-anchor="middle" font-size="9.5" font-weight="620" style="fill:var(--text-2);paint-order:stroke;stroke:var(--c-halo);stroke-width:3px">${st.v >= 0 && st.tipo !== "abs" ? "+" : ""}${fmt.n(st.v / 1e9, 1)}</text>`;
    const words = st.label.split(" ");
    words.slice(0, 2).forEach((wd, k) => {
      out += `<text x="${X(i) + (X(1) - X(0)) / 2}" y="${h - MB + 14 + k * 11}" text-anchor="middle" font-size="8.8" style="fill:var(--c-axis-text)">${wd}</text>`;
    });
  });
  out += `</svg>`;
  out += `<details class="charttable"><summary>dados em tabela</summary><div class="tblwrap" style="max-height:220px"><table class="data compact"><thead><tr><th>Componente</th><th style="text-align:right">R$ bi</th></tr></thead><tbody>${steps.map(st => `<tr><td>${st.label}</td><td style="text-align:right">${st.tipo === "abs" ? "" : (st.v >= 0 ? "+" : "")}${fmt.n(st.v / 1e9, 2)}</td></tr>`).join("")}</tbody></table></div></details>`;
  return out;
}


/* ================= SINAIS ANTECEDENTES DE ESTRESSE DE CRÉDITO (MVP) ================= */
window.leadSet = (k, v) => { state.lead[k] = v; syncHash(); renderLeading(); };
const LEAD_CLASSE_SEAL = { "coincidente": "aprox", "contexto": "aprox", "antecedente candidato": "exp", "associação exploratória": "aprox", "alvo": "obs" };

function leadSignalChart(L, sid, extra) {
  const cat = L.catalogo.find(c => c.signal_id === sid);
  const sr = L.series[sid];
  if (!cat || !sr || sr.length < 4) return "";
  const pts = sr.map(x => ({ x: `${x.p.slice(0, 4)}-${x.p.slice(4)}`, y: x.v })).filter(p => p.y != null);
  return `<div class="card">
    <h4>${cat.name} <span class="seal ${LEAD_CLASSE_SEAL[cat.classificacao_conceitual] || "aprox"}">${cat.classificacao_conceitual.toUpperCase()}</span></h4>
    <div class="src" style="margin-bottom:6px">${cat.economic_rationale}</div>
    ${lineChart({ series: [{ pts, color: "#1d4e89", label: cat.name.slice(0, 30) }], h: 170, unit: cat.original_unit, fonte: cat.source_id, status: cat.quality_status, dec: 2 })}
    ${chartFooter({ fonte: cat.source_id, periodo: `${fmt.my(pts[0].x)}–${fmt.my(pts[pts.length - 1].x)} (${cat.frequency})`, atualizado: L.gerado_em.slice(0, 10), unidade: cat.original_unit + " · " + cat.transformation, nota: cat.economic_rationale })}
    ${extra || ""}
    ${entenda(sid, [["Pergunta", `este sinal (${cat.classificacao_conceitual}) pressiona ou alivia o risco de crédito?`],
      ["Sentido econômico", `sinal esperado "${cat.expected_sign}": alta ${cat.expected_sign === "+" ? "aumenta" : "reduz"} o estresse esperado`],
      ["Conclusões permitidas", "tendência e posição vs. própria história; convergência com outros sinais"],
      ["Conclusões INDEVIDAS", "causalidade; previsão pontual; leitura isolada como veredicto"]])}
  </div>`;
}

function renderLeading() {
  const el = document.getElementById("view-leading");
  const L = state.data.leading;
  if (!L || !L.subindices) { el.innerHTML = loadingCard("sinais antecedentes"); return; }
  const t = state.lead.tab;
  const tabs = [["geral", "Visão Geral"], ["garantias", "Garantias"], ["empresarial", "Empresarial & Judicial"], ["naobancario", "Crédito Não Bancário"], ["consumidor", "Consumidor"], ["regional", "Regional"], ["buscas", "Buscas"], ["metodo", "Metodologia & Licenças"]];
  const head = pageHead({
    title: "Sinais Antecedentes de Estresse de Crédito <span class='chip' style='vertical-align:middle'>MVP</span>",
    desc: "Sinais econômicos, patrimoniais, jurídicos e de crédito não bancário que podem aparecer antes da deterioração dos indicadores convencionais — com a distinção explícita entre coincidente, antecedente candidato, contexto e associação.",
    fontes: "BCB (SGS, rdrweb), CVM (FIDC), CNJ/DataJud",
  });
  const nav2 = `<div class="controls"><span class="seg">${tabs.map(([k, l]) => `<button class="${t === k ? "active" : ""}" onclick="leadSet('tab','${k}')">${l}</button>`).join("")}</span></div>`;
  const principio = `<div class="note"><b>Princípio:</b> ${L.principio}</div>`;

  let body = "";
  if (t === "geral") {
    const subs = Object.entries(L.subindices);
    // nomes humanos dos componentes (o catálogo traz signal_id → nome/fonte)
    const sigNome = id => {
      const c = (L.catalogo || []).find(x => x.signal_id === id);
      return c ? c.name : id;
    };
    const zPlano = z => {
      const abs = Math.abs(z);
      const grau = abs < 0.5 ? "praticamente na" : abs < 1 ? `${fmt.n(abs, 1)} desvio-padrão ${z >= 0 ? "acima da" : "abaixo da"}` : `${fmt.n(abs, 1)} desvios-padrão ${z >= 0 ? "ACIMA da" : "ABAIXO da"}`;
      return `${grau} própria média histórica${abs >= 1 ? (z >= 0 ? " — estresse acima do usual" : " — folga acima do usual") : ""}`;
    };
    const TIT_COB = "cobertura: quantos componentes deste subíndice têm dado atual disponível. 2/2 = todos presentes; se um faltar, o subíndice segue com o que há e a confiança cai.";
    const TIT_CONF = "confiança: qualidade da leitura, combinando tamanho do histórico, atualidade e cobertura dos componentes. Moderada = útil para acompanhar tendência, insuficiente para decisão isolada.";
    const TIT_TEND = "tendência do subíndice na janela de 3 meses: subindo = estresse aumentando; caindo = aliviando.";
    const subCard = ([gid, s]) => {
      const pts = s.serie.map(x => ({ x: `${x.p.slice(0, 4)}-${x.p.slice(4)}`, y: x.z }));
      return `<div class="card">
        <h4>${s.nome}</h4>
        <div class="big ${s.z_atual > 1 ? "up" : ""}" style="font-size:24px">${s.z_atual >= 0 ? "+" : ""}${fmt.n(s.z_atual, 2)}σ</div>
        <div class="src" style="margin:-2px 0 4px">${zPlano(s.z_atual)}</div>
        <div class="delta ${s.tendencia === "subindo" ? "up" : s.tendencia === "caindo" ? "down good" : "neutral"}"><span title="${TIT_TEND}">${s.tendencia}</span> · <span title="variação do z-score em 3 meses">Δ3m ${fmt.pp(s.delta_3m)}σ</span> · <span title="${TIT_COB}">${s.cobertura}</span> · <span title="${TIT_CONF}">confiança ${s.confianca}</span></div>
        ${lineChart({ series: [{ pts, color: "#1d4e89", label: "z-score" }], hlines: [{ y: 0, color: "#aaa", label: "média histórica" }], h: 120, unit: "σ", fonte: "componentes abaixo", status: "calculado", dec: 1, noTable: true })}
        <div class="src">componentes (distância da própria média): ${Object.entries(s.contribuicoes).map(([c, z]) => `<span title="${attr(sigNome(c))}: ${z >= 0 ? "+" : ""}${fmt.n(z, 1)} desvio-padrão vs. a média histórica desta série">${sigNome(c)} ${z >= 0 ? "+" : ""}${fmt.n(z, 1)}σ</span>`).join(" · ")}</div>
      </div>`;
    };
    const vrow = v => {
      const cat = L.catalogo.find(c => c.signal_id === v.signal_id) || {};
      const spark = (v.corrs || []).filter(c => c.corr != null);
      return `<tr><td><b>${cat.name || v.signal_id}</b><div class="src">${cat.source_id || ""}</div></td>
        <td style="text-align:right">${v.melhor_lag != null ? v.melhor_lag + " m" : "–"}</td>
        <td style="text-align:right">${v.melhor_corr != null ? fmt.n(v.melhor_corr, 2) : "–"}</td>
        <td style="text-align:right">${v.n || "–"}</td>
        <td>${spark.length ? spark.map(c => `<span class="src" title="lag ${c.lag}m: corr ${c.corr}" style="display:inline-block;width:7px;height:${Math.abs(c.corr) * 26 + 2}px;background:${c.corr > 0 ? "var(--c-line1)" : "var(--c-neg)"};margin-right:1px;vertical-align:bottom;opacity:.75"></span>`).join("") : "–"}</td>
        <td class="src">${v.status}</td></tr>`;
    };
    body = `
    <div class="diagcard" style="margin-bottom:22px">
      <div><span class="classif ${L.sintese.n_deteriorando > L.sintese.n_melhorando ? "restr" : "neutra"}">${L.sintese.n_deteriorando} em deterioração · ${L.sintese.n_melhorando} em melhora</span></div>
      <div class="frase">${L.sintese.texto}</div>
      <div class="src">${badge("calculado", "síntese determinística: tendências dos subíndices (Δ3m do z médio) + reação da inadimplência (Δ3m > 0,1 p.p.)")} confiança ${L.sintese.confianca} · cobertura ${L.sintese.cobertura} · atualizado ${L.gerado_em.slice(0, 10)}</div>
    </div>
    ${sechead("Subíndices — decompostos, nunca um número único opaco", "como ler: 0 = a média histórica do próprio indicador; +1σ = um desvio-padrão acima dela (estresse fora do usual); valores negativos = folga. Cada componente é comparado só com a própria história.")}
    <div class="ov-2col-eq">${subs.map(subCard).join("")}</div>
    ${sechead("As defasagens sugerem antecedência?", "associação exploratória — promoção plena exige o protocolo da aba Antecedentes")}
    <div class="card">
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Sinal</th><th style="text-align:right">Melhor lag</th><th style="text-align:right">Correlação</th><th style="text-align:right">n</th><th title="correlação por defasagem (0 a 12 meses)">Perfil de lags</th><th>Classificação</th></tr></thead>
      <tbody>${L.validacao.map(vrow).join("")}</tbody></table></div>
      ${leitura([["Como interpretar", "barras = correlação do sinal com a inadimplência k meses À FRENTE; melhor lag > 0 com correlação maior que a contemporânea sugere antecedência"],
        ["Cuidado", L.validacao[0] ? L.validacao[0].ressalva : ""]])}
    </div>
    ${sechead("Alertas", "regra: z > 1,0 por ≥2 meses com alta em 3m — nunca um ponto isolado")}
    ${L.alertas.length ? L.alertas.map(a => `<div class="alert ${a.severity}"><span class="lvl">${a.severity}</span> <b>${a.explanation}</b><div class="expl">limiar: ${a.threshold} · valor: ${fmt.n(a.observed_value, 2)}σ · persistência: ${a.persistence} meses · ref. ${a.reference_date} · fontes: ${a.fonte.join(", ")}</div></div>`).join("")
      : `<div class="card"><p class="src">Nenhum subíndice acima do limiar (z > 1,0 com persistência ≥ 2 meses e alta em 3m) nesta data. A ausência de alerta não significa ausência de risco — ver subíndices acima.</p></div>`}
    ${L.iaec && !L.iaec.disponivel ? `<div class="note" style="margin-top:14px"><b>IAEC (índice composto):</b> não calculado nesta fase — ${L.iaec.motivo}</div>` : ""}`;
  } else if (t === "garantias") {
    body = sechead("O valor real das garantias imobiliárias protege o credor?", "IVG-R deflacionado pelo IPCA — cálculo próprio declarado") +
      `<div class="ov-2col-eq">${leadSignalChart(L, "ivgr_real_yoy")}${leadSignalChart(L, "inad_total")}</div>
      <div class="note">Comparação direta com a carteira imobiliária: a página do produto <a href="javascript:void(0)" onclick="openProduct('imobiliario-pf')">Crédito imobiliário (habitação)</a> traz carteira, atraso ≥15d e concentração. O IVG-R NÃO mede as garantias de cada banco — é o índice do sistema (metodologia BCB).</div>`;
  } else if (t === "empresarial") {
    body = sechead("O setor produtivo está sob estresse antes do crédito PJ refletir?", "CNJ/DataJud — 8 tribunais estaduais (cobertura declarada)") +
      `<div class="ov-2col-eq">${leadSignalChart(L, "rj_yoy")}${leadSignalChart(L, "falencias_yoy")}</div>
      <div class="note">Dívida ativa da PGFN (estresse fiscal por CNAE/UF): <b>fase 2</b> — arquivos de 1,3 GB/trimestre exigem janela dedicada de processamento (viabilidade confirmada, licença ok). A inscrição em dívida ativa é sinal de pressão fiscal ou de conformidade, não declaração de insolvência. Séries completas de RJ (funil, marcos, fichas): aba <a href="javascript:void(0)" onclick="nav('rj')">Recuperações &amp; Falências</a>.</div>`;
  } else if (t === "naobancario") {
    body = sechead("O crédito originado fora dos bancos deteriora primeiro?", "CVM — informes mensais de ~4 mil FIDCs (R$ 990 bi)") +
      `<div class="ov-2col-eq">${leadSignalChart(L, "fidc_inad_pct")}${leadSignalChart(L, "inad_total")}</div>
      <div class="note"><b>Atraso ≠ perda:</b> subordinação e garantias absorvem parte da inadimplência dos FIDCs, e as estruturas são heterogêneas — não somamos estruturas incompatíveis nem inferimos perda do atraso. Próximos passos (backlog): abertura por segmento de recebível, captação/resgate e proteção subordinada.</div>`;
  } else if (t === "consumidor") {
    body = sechead("Reclamações pressionam antes do atraso?", "BCB rdrweb — ranking trimestral") +
      `<div class="ov-2col-eq">${leadSignalChart(L, "reclamacoes_mediana", "<div class='src'>Histórico trimestral ainda curto para z-score do subíndice — série exibida sem normalização (declarado).</div>")}${leadSignalChart(L, "inad_total")}</div>
      <div class="note"><b>Consumidor.gov.br:</b> NÃO integrado — o download de dados exige autenticação (barreira técnica; a especificação veda contorná-la). <b>Judicialização nominal por instituição:</b> fase 3, condicionada a identificação pública confiável das partes. Reclamações por instituição: página de cada IF, seção Reclamações.</div>`;
  } else if (t === "regional") {
    const rrow = r => `<tr class="clickable" onclick="nav('rj')"><td><b>${r.uf}</b> <span class="src">${r.tribunal}</span></td>
      <td style="text-align:right">${fmt.n0(r.rj_mes)}</td>
      <td style="text-align:right" class="${r.rj_yoy_pct > 10 ? "up" : r.rj_yoy_pct < -10 ? "down good" : "neutral"}">${fmt.pp(r.rj_yoy_pct)}%</td>
      <td>${r.tendencia}</td></tr>`;
    body = sechead("Fragilidade regional — recuperações judiciais por UF", L.regional.nota) +
      `<div class="card"><div class="tblwrap"><table class="data compact"><thead><tr><th>UF</th><th style="text-align:right">RJ/mês (últ.)</th><th style="text-align:right">Var. 12m</th><th>Tendência</th></tr></thead>
      <tbody>${L.regional.linhas.sort((a, b) => b.rj_yoy_pct - a.rj_yoy_pct).map(rrow).join("")}</tbody></table></div>
      ${leitura([["Cobertura", "8 tribunais estaduais — não representa o Brasil inteiro (declarado)"],
        ["Cuidado", "volumes absolutos refletem o tamanho da economia de cada UF; a leitura útil é a VARIAÇÃO"],
        ["Backlog", "desemprego/renda por UF, reclamações regionais e preços de imóveis regionais — sem granularidade municipal por interpolação artificial"]])}</div>`;
  } else if (t === "buscas") {
    const B = L.buscas || {};
    body = B.disponivel
      ? sechead("Comportamento de busca — integrado via exportação manual", "Google Trends · carga manual autorizada · 29/07/2026") +
        `<div class="card"><h4>Tendências de Busca <span class="seal exp">ASSOCIAÇÃO EXPLORATÓRIA</span></h4>
        <p class="src" style="max-width:880px">${B.modo || ""}</p>
        <p style="max-width:880px">${B.resumo || ""}</p>
        <div class="chips">${(B.familias || []).map(f => `<span class="chip">${f}</span>`).join("")}</div>
        <p style="margin-top:14px"><button class="btn" onclick="nav('trends')">abrir a página Tendências de Busca →</button></p>
        <div class="src">Aviso obrigatório: os índices representam interesse relativo de busca (0–100 por consulta), e não quantidade absoluta de pessoas ou pesquisas. A coleta automatizada permanece não licenciada e não é realizada.</div></div>`
      : sechead("Comportamento de busca — status honesto", "estrutura pronta; fonte aguarda carga manual") +
        `<div class="card"><h4>IBEF — Índice de Busca por Estresse Financeiro <span class="seal aprox">INDISPONÍVEL</span></h4>
        <p class="src" style="max-width:820px">${B.motivo || ""}</p>
        <div class="chips">${(B.familias || []).map(f => `<span class="chip">${f}</span>`).join("")}</div></div>`;
  } else {
    body = sechead("Metodologia, catálogo e licenças") +
      `<div class="card"><h4>Catálogo de sinais (${L.catalogo.length})</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Sinal</th><th>Classificação</th><th>Fonte</th><th>Freq.</th><th>Transformação</th><th>Sinal esperado</th></tr></thead>
      <tbody>${L.catalogo.map(c => `<tr><td><b>${c.name}</b><div class="src">${c.description}</div></td><td><span class="seal ${LEAD_CLASSE_SEAL[c.classificacao_conceitual] || "aprox"}">${c.classificacao_conceitual}</span></td><td class="src">${c.source_id}</td><td>${c.frequency}</td><td class="src">${c.transformation}</td><td style="text-align:center">${c.expected_sign}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="card" style="margin-top:16px"><h4>Matriz de licenças e método de coleta</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Fonte</th><th>Licença/acesso</th><th>Uso</th></tr></thead>
      <tbody>${L.licencas.map(li => `<tr><td><b>${li.fonte}</b></td><td class="src">${li.status}</td><td>${li.uso.includes("NÃO") ? `<span class="up">${li.uso}</span>` : li.uso}</td></tr>`).join("")}</tbody></table></div>
      <div class="src" style="margin-top:8px">Sem scraping proibido; sem dados pessoais; ausência ≠ zero; versão metodológica ${L.versao_metodologica}. Auditoria completa: docs/AUDITORIA_SINAIS.md.</div></div>`;
  }
  el.innerHTML = head + principio + nav2 + body;
}

/* ================= TENDÊNCIAS DE BUSCA (Google Trends — exportação manual autorizada) ================= */
const TR_FAM_COLORS = { "Dificuldade financeira": "#b91c1c", "Procura por crédito": "#1d4e89",
  "Estresse empresarial": "#6b46a3", "Emprego e renda": "#0e7c7b", "Financiamentos": "#b45309" };
const TR_FAM_ORDER = ["Dificuldade financeira", "Procura por crédito", "Estresse empresarial", "Emprego e renda", "Financiamentos"];
const TR_MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
window.trSet = (k, v) => { state.tr[k] = v; syncHash(); renderTrends(); };

function trMY(p) { return p ? `${p.slice(5, 7)}/${p.slice(2, 4)}` : "–"; }
function trZ(obs, parcial) { // z-score sobre a própria história, mês parcial excluído das estatísticas
  const xs = obs.filter(o => o.p !== parcial).map(o => o.v);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length) || 1;
  return { m, sd, z: v => (v - m) / sd };
}
function trHeat(rows, cols, zmax) { // rows: [{group}|{label,cells:[{v,tip,parcial}|null]}]
  let h = `<div class="heatwrap"><div class="heatgrid" style="grid-template-columns:minmax(150px,196px) repeat(${cols.length},minmax(14px,1fr))">`;
  h += `<div class="hcell hhead hlab"></div>` + cols.map(c => `<div class="hcell hhead">${c.l || ""}</div>`).join("");
  rows.forEach(r => {
    if (r.group) { h += `<div class="hcell hgroup" style="grid-column:1/-1">${r.group}</div>`; return; }
    h += `<div class="hcell hlab" title="${attr(r.label)}">${r.label}</div>`;
    h += r.cells.map(c => {
      if (!c || c.v == null) return `<div class="hcell hnull" title="sem observação"></div>`;
      const a = Math.min(Math.abs(c.v) / zmax, 1);
      const col = c.v >= 0 ? "var(--c-neg)" : "var(--c-line1)";
      return `<div class="hcell hval${c.parcial ? " hpart" : ""}" data-tip="${c.tip}" style="background:color-mix(in srgb, ${col} ${Math.round(a * 88)}%, transparent)"></div>`;
    }).join("");
  });
  h += `</div></div>`;
  h += `<div class="heatleg"><span class="lg" style="background:color-mix(in srgb, var(--c-line1) 70%, transparent)"></span> abaixo da média histórica
    <span class="lg" style="background:var(--surface-2)"></span> na média
    <span class="lg" style="background:color-mix(in srgb, var(--c-neg) 70%, transparent)"></span> acima da média (z ≥ ${fmt.n(zmax, 1)} = saturado)
    <span class="lg hpart" style="background:var(--surface-2)"></span> mês parcial · <span class="lg hnull"></span> sem observação (ausência ≠ zero)</div>`;
  return h;
}

function renderTrends() {
  const el = document.getElementById("view-trends");
  const T = state.data.trends;
  if (T === undefined) { el.innerHTML = loadingCard("tendências de busca"); return; }
  if (!T || !T.disponivel) {
    el.innerHTML = pageHead({ title: "Tendências de Busca", desc: "Fonte manual ainda não depositada." }) +
      `<div class="card"><h4>INDISPONÍVEL</h4><p class="src">${(T && T.motivo) || "Nenhuma exportação manual do Google Trends foi depositada no pipeline; a coleta automatizada permanece não licenciada."}</p></div>`;
    return;
  }
  const M = T.meta, parcial = M.mes_parcial, painel = T.painel, byTermo = Object.fromEntries(painel.map(p => [p.termo, p]));
  const selo = `<span class="seal exp" title="${attr(T.selo)}">ASSOCIAÇÃO EXPLORATÓRIA</span>`;
  const fam = state.tr.fam;

  /* ---------- cabeçalho ---------- */
  const head = pageHead({
    title: "Tendências de Busca — temperatura do mercado de crédito",
    seals: `${badge("observado", "séries do Google Trends, exportação manual da interface oficial")} ${badge("calculado", "z-scores, sazonalidade e defasagens calculados pelo Observatório; variações e painel calculados na exportação")} ${selo}`,
    desc: "O que os brasileiros buscam no Google sobre dívida, crédito, emprego e financiamento — 21 termos em 5 famílias, jan/2011–jun/2026.",
    fontes: "Google Trends (exportação manual autorizada, 29/07/2026) · BCB/SGS 21082 (alvo das defasagens)",
    actions: `<button class="btn ghost small" onclick="trCSV()">baixar CSV</button>`,
  });
  const aviso = `<div class="note" style="margin-top:12px;max-width:1100px"><b>Leia antes de interpretar:</b> ${T.disclaimer}
    ${M.diagnostico ? "" : ""} <br><span class="src">${T.licenca} · Configuração: ${M.config} · Último mês completo: jun/2026; <b>jul/2026 é mês parcial</b> e fica fora de todas as comparações. Arquivo auditável (SHA-256 ${M.sha256_arquivo.slice(0, 12)}…), com hash por CSV de origem na aba de dados originais.</span></div>`;

  /* ---------- 1. hero: temperatura por família ---------- */
  const famCard = f => {
    const chip = f.temperatura === "AQUECIDA" ? "hot" : (f.temperatura.includes("parcial") ? "warm" : "cool");
    const dots = f.detalhe.map(p => `<i class="${p.direcao === "aquecimento" ? "hot" : p.direcao === "arrefecimento" ? "cool" : ""}" title="${attr(`${p.termo}: ${p.direcao}`)}"></i>`).join("");
    return `<div class="tr-fam">
      <h4>${f.familia} <span class="tempchip ${chip}">${f.temperatura}</span></h4>
      <div class="tr-big" style="color:${f.var12m_mediana > 5 ? "var(--c-neg)" : f.var12m_mediana < -5 ? "var(--c-line1)" : "var(--text)"}">${fmt.pp(f.var12m_mediana).replace(",00", "").replace(".00", "")}<small>% em 12m (mediana)</small></div>
      <div class="src">3 meses: ${fmt.n(f.var3m_mediana, 1)}% · ${f.aquecendo} termos em aquecimento</div>
      <div class="dotstrip">${dots}</div>
      <p class="tr-leitura">${f.leitura}</p>
    </div>`;
  };
  const hero = sechead("Temperatura por família", "sem índice agregado único — leitura separada por família (metodologia declarada)") +
    `<div class="tr-hero">${T.familias.map(famCard).join("")}</div>
    <div class="card" style="margin-top:14px"><h4 style="margin-top:0">Diagnóstico (síntese determinística, jun/2026)</h4>
    <p style="max-width:1100px;line-height:1.65;margin-bottom:0">${M.diagnostico}</p></div>`;

  /* ---------- 2. destaques ---------- */
  const nivelAlto = painel.filter(p => p.percentil >= 95).length;
  const defTop = T.defasagens.linhas[0];
  const destaques = `<div class="hero-strip" style="margin-top:16px">
    <div class="card kpi"><h4>Maior alta em 12 meses</h4><div class="tr-big" style="color:var(--c-neg)">+${fmt.n(painel[0].var12m, 1)}%</div><div class="src"><b>${painel[0].termo}</b> — z=${fmt.n(painel[0].z, 1)}, percentil ${fmt.n(painel[0].percentil, 0)} (efeito consignado CLT)</div></div>
    <div class="card kpi"><h4>Termos em nível historicamente alto</h4><div class="tr-big">${nivelAlto} <small>de 21</small></div><div class="src">no percentil ≥ 95 da própria história (jun/2026)</div></div>
    <div class="card kpi"><h4>Acomodação de curto prazo</h4><div class="tr-big" style="color:var(--c-line1)">${painel.filter(p => p.var1m < 0).length} <small>de 21</small></div><div class="src">termos recuaram frente a mai/2026 — acomodação após os picos do 1º semestre</div></div>
    <div class="card kpi"><h4>Associação defasada mais forte</h4><div class="tr-big">r=${fmt.n(defTop.corr, 2)}</div><div class="src"><b>${defTop.termo}</b> antecede a inadimplência em ${defTop.melhor_lag} meses (exploratório, n=${defTop.n})</div></div>
  </div>`;

  /* ---------- 3. mapa de calor 36 meses ---------- */
  const meses = T.series["empréstimo"].obs.map(o => o.p);
  const cols36 = meses.slice(-37);
  const colHead = cols36.map(p => ({ l: (p.slice(5, 7) === "01" || p === cols36[0]) ? p.slice(0, 4) : (p === parcial ? "jul*" : "") }));
  const heatRows = [];
  TR_FAM_ORDER.forEach(f => {
    heatRows.push({ group: f });
    painel.filter(p => p.familia === f).forEach(p => {
      const S = T.series[p.termo]; if (!S) return;
      const st = trZ(S.obs, parcial);
      const idx = Object.fromEntries(S.obs.map(o => [o.p, o.v]));
      heatRows.push({
        label: p.termo,
        cells: cols36.map(mp => {
          const v = idx[mp]; if (v == null) return null;
          const z = st.z(v);
          return { v: z, parcial: mp === parcial,
            tip: encodeURIComponent(`<div class="tt-date">${p.termo} — ${trMY(mp)}${mp === parcial ? " (mês parcial)" : ""}</div><div class="tt-row"><span class="tt-lbl">índice (escala própria)</span><span class="tt-val">${v}</span></div><div class="tt-row"><span class="tt-lbl">z vs. própria história</span><span class="tt-val">${fmt.pp(z)}</span></div>`) };
        }),
      });
    });
  });
  const heatTable = `<details class="charttable"><summary>dados em tabela (últimos 13 meses, índice 0–100 na escala própria)</summary>
    <div class="tblwrap" style="max-height:340px"><table class="data compact"><thead><tr><th>Termo</th>${meses.slice(-13).map(p => `<th style="text-align:right">${trMY(p)}${p === parcial ? "*" : ""}</th>`).join("")}</tr></thead><tbody>` +
    painel.map(p => { const idx = Object.fromEntries((T.series[p.termo] || { obs: [] }).obs.map(o => [o.p, o.v])); return `<tr><td>${p.termo}</td>${meses.slice(-13).map(mp => `<td style="text-align:right">${idx[mp] != null ? idx[mp] : "–"}</td>`).join("")}</tr>`; }).join("") +
    `</tbody></table></div><div class="src">* jul/2026: mês parcial, fora das comparações.</div></details>`;
  const heat = sechead("Mapa de calor — 36 meses", "cor = distância da média histórica de CADA termo (z-score); níveis entre termos não são comparáveis") +
    `<div class="card">${trHeat(heatRows, colHead, 2.5)}${heatTable}
    ${entenda("trheat", [["Como ler", "cada linha é um termo na PRÓPRIA escala; vermelho = interesse de busca acima da média histórica do termo, azul = abaixo. A comparação válida é ao longo do tempo, nunca entre linhas."],
      ["Por que não comparar linhas", "o Google Trends normaliza cada consulta no próprio máximo (0–100); níveis entre termos só seriam comparáveis dentro de uma mesma consulta conjunta (dados preservados na fonte, aba SERIES_COMPARAVEIS)."],
      ["Mês parcial", "jul/2026 aparece tracejado e fica fora das estatísticas."]])}</div>`;

  /* ---------- 4. termo a termo (small multiples) ---------- */
  const chips = `<div class="famchips">${["todas", ...TR_FAM_ORDER].map(f =>
    `<button class="${fam === f ? "on" : ""}" onclick="trSet('fam','${f}')">${f === "todas" ? "todas as famílias" : f}</button>`).join("")}</div>`;
  const cardTermo = p => {
    const S = T.series[p.termo]; if (!S) return "";
    const pts = S.obs.map(o => ({ x: o.p, y: o.v }));
    const dirCls = p.direcao === "aquecimento" ? "up" : p.direcao === "arrefecimento" ? "down" : "";
    return `<div class="tr-card">
      <h5><span><b>${p.termo}</b> <span class="src">· ${p.familia}</span></span><span class="now">${p.valor_atual}</span></h5>
      <div class="tr-tags"><span class="${dirCls}">${p.direcao === "aquecimento" ? "▲" : p.direcao === "arrefecimento" ? "▼" : "→"} ${p.direcao}</span><span>intensidade ${p.intensidade}</span><span>12m ${fmt.pp(p.var12m).replace(",00", "")}%</span><span>percentil ${fmt.n(p.percentil, 0)}</span>${p.ambiguidade && p.ambiguidade !== "não" ? `<span title="${attr(p.obs_qualidade || "")}">ambiguidade ${p.ambiguidade}</span>` : ""}</div>
      ${lineChart({ series: [{ pts, label: p.termo, color: TR_FAM_COLORS[p.familia] }], h: 118, unit: "índice 0–100 (escala própria)", aria: `evolução do interesse de busca por ${p.termo}` })}
    </div>`;
  };
  const grid = sechead("Termo a termo — 2011 a hoje", "cada gráfico na própria escala 0–100; valor grande = índice em jun/2026") + chips +
    `<div class="tr-grid">${painel.filter(p => fam === "todas" || p.familia === fam).map(cardTermo).join("")}</div>`;

  /* ---------- 5. ranking 12m (barras divergentes) ---------- */
  const vlo = Math.min(0, ...painel.map(p => p.var12m)) - 8, vhi = Math.max(...painel.map(p => p.var12m)) + 8;
  const zpct = (0 - vlo) / (vhi - vlo) * 100;
  const divrow = p => {
    const xpct = (p.var12m - vlo) / (vhi - vlo) * 100;
    const left = Math.min(zpct, xpct), wdt = Math.abs(xpct - zpct);
    return `<div class="divrow"><span title="${attr(p.familia)}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.termo}</span>
      <div class="divtrack"><span class="zero" style="left:${zpct}%"></span><span class="bar" style="left:${left}%;width:${wdt}%;background:${p.var12m >= 0 ? "color-mix(in srgb, var(--c-neg) 78%, transparent)" : "color-mix(in srgb, var(--c-line1) 78%, transparent)"}"></span></div>
      <span style="text-align:right;font-variant-numeric:tabular-nums"><b class="${p.var12m > 5 ? "up" : p.var12m < -5 ? "down" : ""}">${fmt.pp(p.var12m).replace(",00", "")}%</b> <span class="src">3m ${fmt.n(p.var3m, 1)}%</span></span></div>`;
  };
  const rank = sechead("Variação em 12 meses — todos os termos", "sobre a série individual de cada termo, até jun/2026") +
    `<div class="card">${painel.map(divrow).join("")}
    ${leitura([["Leitura", "quase tudo em alta — 16 de 21 termos subiram mais de 10% em 12 meses"],
      ["Cuidado", "variação sobre índice RELATIVO de busca; +135% em 'crédito consignado' não significa 135% mais pessoas — significa interesse recorde na história do termo"]])}</div>`;

  /* ---------- 6. nível × aceleração ---------- */
  const pairs = painel.map(p => ({ x: p.z, y: p.aceleracao, label: p.termo, color: TR_FAM_COLORS[p.familia], grp: p.familia }));
  const quad = sechead("Nível × aceleração", "direita = historicamente alto (z); acima = ganhando tração (aceleração 3m, p.p.)") +
    `<div class="card">${scatterPlot(pairs, "z-score (nível vs. própria história)", "aceleração 3m (p.p.)", 720, 400, { refX: 0, refXLabel: "média histórica", refY: 0, refYLabel: "sem aceleração", labels: true })}
    ${entenda("trquad", [["Quadrante superior direito", "termos historicamente altos E acelerando — hoje só 'crédito consignado' (efeito consignado CLT)."],
      ["Quadrante inferior direito", "altos mas desacelerando — a maioria dos termos de dificuldade financeira está aqui: nível recorde com acomodação recente."],
      ["Métricas", "z-score e aceleração calculados na exportação sobre a série individual de cada termo (notas do painel)."]])}</div>`;

  /* ---------- 8. sazonalidade ---------- */
  const sazRows = [];
  TR_FAM_ORDER.forEach(f => {
    const ps = painel.filter(p => p.familia === f && T.sazonalidade[p.termo]);
    if (!ps.length) return;
    sazRows.push({ group: f });
    ps.forEach(p => sazRows.push({
      label: p.termo,
      cells: T.sazonalidade[p.termo].map((z, i) => z == null ? null : ({ v: z,
        tip: encodeURIComponent(`<div class="tt-date">${p.termo} — ${TR_MESES[i]}</div><div class="tt-row"><span class="tt-lbl">z médio do mês</span><span class="tt-val">${fmt.pp(z)}</span></div><div class="tt-meta">média do z-score em todos os anos (2011–2026, mês parcial excluído)</div>`) })),
    }));
  });
  const saz = sechead("Sazonalidade — em que mês cada busca esquenta", "z-score médio por mês do calendário (2011–2026)") +
    `<div class="card">${trHeat(sazRows, TR_MESES.map(m => ({ l: m })), 1.2)}
    ${leitura([["Padrões nítidos", "“limpar nome” dispara em novembro (feirões limpa nome, z=+1,1); “renda extra” em janeiro; “seguro desemprego” não é sazonal — os picos seguem crises (2015, abr/2020)"],
      ["Uso", "antes de ler um pico como deterioração, verifique se ele não é apenas o padrão sazonal do termo"]])}</div>`;

  /* ---------- 9. defasagens vs inadimplência ---------- */
  const lagRow = d => `<div class="divrow"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.termo} <span class="src">· ${d.familia || ""}</span></span>
    <div class="divtrack"><span class="zero" style="left:50%"></span><span class="bar" style="${d.corr >= 0 ? `left:50%;width:${Math.abs(d.corr) * 50}%` : `left:${50 - Math.abs(d.corr) * 50}%;width:${Math.abs(d.corr) * 50}%`};background:${d.corr >= 0 ? "color-mix(in srgb, var(--c-neg) 72%, transparent)" : "color-mix(in srgb, var(--c-line1) 72%, transparent)"}"></span></div>
    <span style="text-align:right;font-variant-numeric:tabular-nums"><b>r=${fmt.n(d.corr, 2)}</b> <span class="src">lag ${d.melhor_lag}m · n=${d.n}</span></span></div>`;
  const lags = sechead(`Defasagens contra a inadimplência observada ${inadChip("sgs")}`, `alvo: ${T.defasagens.alvo}`) +
    `<div class="card"><p class="src" style="max-width:1050px">${T.defasagens.metodo}</p>
    <h4>Melhor defasagem por termo <span class="seal exp">ASSOCIAÇÃO EXPLORATÓRIA</span></h4>${T.defasagens.linhas.map(lagRow).join("")}
    ${entenda("trlag", [["O que isto NÃO é", "validação. Correlação defasada é o primeiro filtro; a promoção a 'antecedente' exige o protocolo formal da aba Antecedentes (Granger, ganho fora da amostra, estabilidade)."],
      ["Sinal que se destaca", "“busca e apreensão” — buscas sobre apreensão de veículos antecedem a inadimplência total em ~12 meses com r=0,73; coerente com a economia do atraso de financiamento, mas ainda exploratório."],
      ["Correlações negativas", "podem refletir tendências longas em direções opostas, não proteção — por isso o n e o perfil completo ficam visíveis."]])}</div>`;

  /* ---------- 10. catálogo, qualidade e limitações ---------- */
  const ambTag = a => !a || a === "não" ? "" : `<span class="seal ${a === "grave" ? "demo" : a === "moderada" ? "est" : "aprox"}">${a}</span>`;
  const usados = T.catalogo.filter(c => (c.status_coleta || "").startsWith("Coletado"));
  const excluidos = T.catalogo.filter(c => !(c.status_coleta || "").startsWith("Coletado"));
  const cat = sechead("Catálogo, qualidade e limitações", `${usados.length} termos usados · ${excluidos.length} testados e não usados (documentados)`) +
    `<div class="card"><div class="tblwrap"><table class="data compact"><thead><tr><th>Termo</th><th>Família</th><th>Ambiguidade</th><th style="text-align:right">% zeros</th><th>Limitações / observações</th></tr></thead>
    <tbody>${usados.map(c => `<tr><td><b>${c.termo}</b></td><td>${c.familia}</td><td>${ambTag(c.ambiguidade) || "—"}</td><td style="text-align:right">${c.pct_zeros || "0"}</td><td class="src">${c.obs || ""}</td></tr>`).join("")}</tbody></table></div>
    <details class="charttable"><summary>termos testados e NÃO usados (${excluidos.length}) — por quê</summary>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Termo</th><th>Status</th><th>Motivo</th></tr></thead>
    <tbody>${excluidos.map(c => `<tr><td><b>${c.termo}</b></td><td class="src">${c.status_coleta}</td><td class="src">${c.obs || ""}</td></tr>`).join("")}</tbody></table></div></details>
    <h4 style="margin-top:16px">Limitações declaradas pela fonte</h4>
    <ol style="max-width:1050px;line-height:1.65;font-size:12.8px;color:var(--text-2)">${(M.limitacoes || []).map(l => `<li>${l.replace(/^\d+\.\s*/, "")}</li>`).join("")}</ol>
    <div class="src" style="margin-top:8px">${M.notas_painel || ""}</div>
    <div class="src" style="margin-top:6px">${M.registro_lotes || ""}</div></div>`;

  el.innerHTML = head + aviso + hero + destaques + heat + grid + rank + quad + saz + lags + cat;
}
window.trCSV = () => {
  const T = state.data.trends; if (!T || !T.disponivel) return;
  const head = "familia;termo;valor_jun2026;var_1m_pct;var_3m_pct;var_12m_pct;media_12m;z_score;percentil;direcao;intensidade;aceleracao_3m_pp";
  const rows = T.painel.map(p => [p.familia, p.termo, p.valor_atual, p.var1m, p.var3m, p.var12m, p.media12m, p.z, p.percentil, p.direcao, p.intensidade, p.aceleracao].join(";"));
  dlFile("tendencias_busca_painel.csv", "﻿" + [head, ...rows].join("\n"), "text/csv;charset=utf-8");
};

/* ================= SOBRE ================= */
function renderSobre() {
  const el = document.getElementById("view-sobre");
  el.innerHTML = `
  <div class="pagehead">
    <div class="ph-left">
      <h2>Sobre o Observatório</h2>
    </div>
  </div>
  <div style="max-width:760px;font-size:14.5px;line-height:1.75">
    <p>O Observatório Brasileiro de Crédito é uma plataforma independente e gratuita que reúne dados públicos sobre crédito e instituições financeiras no Brasil. As informações vêm principalmente das bases públicas do Banco Central e da CVM, complementadas por outras fontes oficiais e por dados divulgados pelas próprias instituições. Cada número indica sua origem, com distinção clara entre dado observado e indicador calculado.</p>
    <h3 style="margin-top:28px">Sobre o autor</h3>
    <p>O Observatório Brasileiro de Crédito é uma iniciativa independente de Genaro Dueire Lins, profissional com mais de vinte anos de atuação no sistema financeiro brasileiro nas áreas de crédito, risco e dados.</p>
    <p>Genaro é membro do Conselho de Administração do Fundo Garantidor de Créditos, onde coordena o Comitê de Auditoria, e diretor de Monitoramento da Associação Open Finance Brasil, responsável pelo acompanhamento técnico do ecossistema. É professor de Gestão de Risco de Crédito no Mestrado Profissional em Economia e Finanças da FGV.</p>
    <p>Foi Superintendente de Controle de Riscos do Itaú Unibanco e Chief Credit Officer da Open Co, fintech de crédito resultante da fusão entre Geru e Rebel. É doutor em Economia pela FGV EPGE e foi Visiting Scholar da Faculdade de Economia da Universidade de Cambridge, com pesquisa sobre crédito e dados bancários.</p>
    <p>O Observatório é um projeto pessoal. Não representa posições das instituições às quais o autor é vinculado e reflete seu compromisso com a transparência e o uso qualificado dos dados públicos do mercado de crédito brasileiro.</p>
    <p style="margin-top:20px"><a href="HREF_LINKEDIN" target="_blank" rel="noopener">LinkedIn</a></p>
  </div>`;
}


/* ================= AÇÕES JUDICIAIS E INSTITUIÇÕES FINANCEIRAS ================= */
const JUD_CORES = { revisionais: "#1d4e89", indenizatorias: "#6b46a3", garantias_cobranca: "#8d94a3",
  jornada: "#0e7c7b", rescisao: "#b45309", fgts: "#2f7d4f", adicionais: "#c2540a" };
window.judSet = (k, v) => { state.jud[k] = v; syncHash(); renderJudicial(); };

function renderJudicial() {
  const el = document.getElementById("view-judicial");
  const J = state.data.judicial;
  if (J === undefined) { el.innerHTML = loadingCard("ações judiciais"); return; }
  if (!J || !J.disponivel) {
    el.innerHTML = pageHead({ title: "Ações judiciais por instituição financeira" }) +
      `<div class="card"><h4>INDISPONÍVEL</h4><p class="src">${(J && (J.motivo || J.error)) || ""}</p></div>`;
    return;
  }
  const N = J.camada_nacional, B = J.camada_nominal, ramo = state.jud.ramo;

  const head = pageHead({
    title: "Ações judiciais e instituições financeiras",
    vintage: (J.coletado_em || "").slice(0, 7),
    seals: `${badge("observado", "metadados processuais do CNJ/DataJud e ranking publicado pelo TST")} ${badge("calculado", "agregações, casos únicos e normalização por escala")}`,
    desc: "Litigiosidade de temas bancários no Judiciário e os maiores litigantes nominais — em duas camadas que não se misturam.",
    fontes: "CNJ/DataJud (API pública) · TST (Ranking das Partes) · BCB/IF.data (escala)",
    actions: `<button class="btn ghost small" onclick="judCSV()">baixar CSV</button>`,
  });

  /* ---------- alerta metodológico obrigatório ---------- */
  const alerta = `<div class="judalerta">
    <h4>Antes de ler estes números</h4>
    <p>${J.limitacao_central}</p>
    <div class="judcamadas">
      <div><span class="judtag nac">Camada nacional</span> ${N.n_tribunais} tribunais · ${fmt.n0(N.total_civel_casos + N.total_trabalhista_casos)} casos únicos · <b>não identifica instituição</b></div>
      <div><span class="judtag nom">Camada nominal</span> ${B.competencia || "–"} · ${B.n_ifs} instituições entre os 10 maiores litigantes · <b>somente TST</b></div>
    </div>
    <p class="src" style="margin:10px 0 0">${J.aviso_permanente}</p></div>`;

  /* ---------- camada nacional ---------- */
  const cats = N.categorias.filter(c => c.ramo === ramo);
  const totalRamo = ramo === "civel" ? N.total_civel_casos : N.total_trabalhista_casos;
  const regs = cats.reduce((s, c) => s + c.registros, 0);
  const kpis = `<div class="pan-kpi">
    <div class="card kpi"><h4>Casos únicos</h4><div class="big">${fmt.n0(totalRamo)}</div><div class="src">processos distintos pelo número CNJ · ${ramo === "civel" ? "temas bancários cíveis" : "temas trabalhistas"}</div></div>
    <div class="card kpi"><h4>Registros (tramitações)</h4><div class="big">${fmt.n0(regs)}</div><div class="src">o mesmo caso em 1º e 2º grau conta duas vezes</div></div>
    <div class="card kpi"><h4>Registros por caso</h4><div class="big">${totalRamo ? fmt.n(regs / totalRamo, 2) : "–"}</div><div class="src">razão alta indica recorribilidade — não gravidade</div></div>
    <div class="card kpi"><h4>Tribunais cobertos</h4><div class="big">${N.tribunais.filter(t => t.ramo === ramo).length}</div><div class="src">${N.tribunais.filter(t => t.ramo === ramo).map(t => t.tribunal).join(" · ")}</div></div>
  </div>`;

  const segRamo = `<span class="seg">${[["civel", "Cível"], ["trabalhista", "Trabalhista"]].map(([v, l]) =>
    `<button class="${ramo === v ? "on" : ""}" onclick="judSet('ramo','${v}')">${l}</button>`).join("")}</span>`;

  const maxCat = Math.max(...cats.map(c => c.casos_unicos), 1);
  const composicao = cats.map(c => `<div class="panbar"><span title="${c.rotulo}">${c.rotulo}</span>
    <div class="track"><span class="fill" style="width:${c.casos_unicos / maxCat * 100}%;background:color-mix(in srgb, ${JUD_CORES[c.categoria] || "var(--c-gray)"} 78%, transparent)"></span></div>
    <span style="text-align:right;font-variant-numeric:tabular-nums"><b>${fmt.n0(c.casos_unicos)}</b> <span class="src">${fmt.n(c.part, 1)}%</span></span></div>`).join("");

  const ass = N.assuntos.filter(a => a.ramo === ramo).slice(0, 12);
  const maxAss = Math.max(...ass.map(a => a.casos_unicos), 1);
  const assuntos = ass.map(a => `<div class="panbar"><span title="${a.nome}">${a.nome}</span>
    <div class="track"><span class="fill" style="width:${a.casos_unicos / maxAss * 100}%;background:color-mix(in srgb, ${JUD_CORES[a.categoria] || "var(--c-gray)"} 62%, transparent)"></span></div>
    <span style="text-align:right;font-variant-numeric:tabular-nums"><b>${fmt.n0(a.casos_unicos)}</b> <span class="src">TPU ${a.codigo}</span></span></div>`).join("");

  const tribs = N.tribunais.filter(t => t.ramo === ramo);
  const catsRamo = ramo === "civel" ? N.cats_civel : N.cats_trabalhista;
  const maxCel = Math.max(...tribs.flatMap(t => catsRamo.map(c => t.por_categoria[c] || 0)), 1);
  let heat = `<div class="heatwrap"><div class="heatgrid" style="grid-template-columns:minmax(110px,150px) repeat(${catsRamo.length},minmax(60px,1fr))">`;
  heat += `<div class="hcell hhead hlab"></div>` + catsRamo.map(c =>
    `<div class="hcell hhead" style="height:auto;white-space:normal;line-height:1.2;padding-bottom:5px">${(N.categorias.find(x => x.categoria === c) || {}).rotulo || c}</div>`).join("");
  tribs.forEach(t => {
    heat += `<div class="hcell hlab">${t.tribunal} <span class="src">${t.uf || ""}</span></div>`;
    heat += catsRamo.map(c => {
      const v = t.por_categoria[c] || 0;
      if (!v) return `<div class="hcell hnull" title="sem casos no acervo coletado"></div>`;
      const tip = encodeURIComponent(`<div class="tt-date">${t.tribunal} — ${(N.categorias.find(x => x.categoria === c) || {}).rotulo || c}</div><div class="tt-row"><span class="tt-lbl">casos únicos</span><span class="tt-val">${fmt.n0(v)}</span></div>`);
      return `<div class="hcell hval" data-tip="${tip}" style="background:color-mix(in srgb, ${JUD_CORES[c] || "var(--c-line1)"} ${Math.round(v / maxCel * 80 + 6)}%, var(--surface))"></div>`;
    }).join("");
  });
  heat += `</div></div><div class="heatleg"><span class="lg hnull"></span> sem casos · intensidade = casos únicos no acervo coletado do tribunal</div>`;

  const nacional = sechead("Quais temas bancários mais ocupam o Judiciário?",
      `acervo do DataJud · ${N.n_tribunais} tribunais · não atribuível a instituição`) +
    `<div style="margin:8px 0 12px">${segRamo}</div>${kpis}
    <div class="ov-2col-eq" style="margin-top:14px">
      <div class="card"><h4 style="margin-top:0">Composição por natureza da ação</h4>${composicao}
        ${leitura([["Polo processual", N.nota_polo], ["Casos × registros", "a comparação principal usa casos únicos, contados pelo número único do CNJ"]])}</div>
      <div class="card"><h4 style="margin-top:0">Assuntos mais frequentes (TPU)</h4>${assuntos}
        <div class="src" style="margin-top:6px">códigos das Tabelas Processuais Unificadas descobertos por agregação nos índices reais — nenhum código foi presumido.</div></div>
    </div>
    <div class="card" style="margin-top:14px"><h4 style="margin-top:0">Tribunal × natureza da ação</h4>${heat}
      ${entenda("judheat", [["O que a célula mostra", "casos únicos daquele grupo de assuntos no acervo do tribunal — não é o total de processos do tribunal."],
        ["Por que não comparar tribunais diretamente", "o acervo indexado varia por tribunal, por sistema de origem e por período de adesão ao DataJud; a leitura válida é a composição interna de cada linha."],
        ["Sem recorte temporal", N.nota_temporal]])}</div>`;

  /* ---------- camada nominal ---------- */
  const linhas = B.linhas || [];
  const maxProc = Math.max(...linhas.map(l => l.processos), 1);
  const ordem = state.jud.ordem;
  const ifs = linhas.filter(l => l.eh_if && l.por_100bi_ativo != null);
  const listaOrd = ordem === "normalizado" && ifs.length ? [...ifs].sort((a, b) => b.por_100bi_ativo - a.por_100bi_ativo) : linhas;
  const maxNorm = Math.max(...ifs.map(l => l.por_100bi_ativo), 1);
  const rank = listaOrd.map(l => {
    const norm = ordem === "normalizado";
    const v = norm ? l.por_100bi_ativo : l.processos;
    const mx = norm ? maxNorm : maxProc;
    return `<div class="panbar"><span title="${l.parte}">${l.eh_if ? "" : "<span class='src'>·</span> "}${l.parte}${l.eh_if ? ' <span class="judif">IF</span>' : ""}</span>
      <div class="track"><span class="fill" style="width:${Math.min(v / mx, 1) * 100}%;background:${l.eh_if ? "color-mix(in srgb, var(--c-line1) 72%, transparent)" : "var(--border-2)"}"></span></div>
      <span style="text-align:right;font-variant-numeric:tabular-nums"><b>${norm ? fmt.n(v, 1) : fmt.n0(l.processos)}</b> <span class="src">${norm ? "por R$ 100 bi de ativo" : "processos"}</span></span></div>`;
  }).join("");

  const nominal = sechead("Quem são os maiores litigantes nominais?", `TST · ${B.competencia || "–"} · casos novos do mês`) +
    `<div class="ov-2col">
      <div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <span class="seg">${[["bruto", "Volume"], ["normalizado", "Por escala"]].map(([v, l]) =>
          `<button class="${ordem === v ? "on" : ""}" onclick="judSet('ordem','${v}')">${l}</button>`).join("")}</span>
        <span class="src">${ordem === "normalizado" ? "somente as IFs com escala conhecida" : "os dez maiores do mês, incluindo entes públicos e outros setores"}</span></div>
        ${rank}
        <div class="src" style="margin-top:8px">${B.cobertura}</div></div>
      <div class="card"><h4 style="margin-top:0">Como ler</h4>
        <div class="src" style="line-height:1.7">
          O ranking do TST é <b>nominal</b> e por isso permite identificar instituições — mas cobre apenas o tribunal superior,
          apenas os dez maiores e apenas os casos novos do mês. Não é o total de ações trabalhistas de cada instituição.<br><br>
          A normalização por escala usa o ativo total do IF.data (data-base ${B.data_escala || "–"}). Numerador e denominador
          têm períodos e perímetros diferentes: é uma leitura de <b>ordem de grandeza</b>, não uma taxa exata.<br><br>
          Entes públicos e empresas de outros setores aparecem na lista porque o ranking é geral — ficam sem marcação
          <span class="judif">IF</span> e fora da visão normalizada.
        </div>
        <h5 style="margin:14px 0 6px">Resolução de entidades</h5>
        <div class="tblwrap" style="max-height:190px"><table class="data compact"><thead><tr><th>Parte no TST</th><th>Instituição</th><th>Confiança</th></tr></thead>
        <tbody>${linhas.filter(l => l.eh_if).map(l => `<tr><td>${l.parte}</td><td>${l.cod_if || "—"}</td><td>${l.confianca}</td></tr>`).join("")}</tbody></table></div>
      </div></div>`;

  /* ---------- transparência: o que não dá para calcular ---------- */
  const lacunas = sechead("O que esta página não calcula — e por quê", "indisponibilidade declarada, sem estimativa silenciosa") +
    `<div class="card"><div class="tblwrap"><table class="data compact"><thead><tr><th>Métrica pedida</th><th>Por que não é calculada</th></tr></thead>
    <tbody>${J.denominadores_indisponiveis.map(d => `<tr><td><b>${d.metrica}</b></td><td class="src">${d.motivo}</td></tr>`).join("")}</tbody></table></div>
    <div class="src" style="margin-top:10px">${J.privacidade}</div></div>`;

  const metodo = `<div class="card" style="margin-top:22px"><h4>Catálogo metodológico</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>id</th><th>Indicador</th><th>Definição</th><th>Fórmula</th><th>Unidade</th><th>Fonte</th><th>Cobertura</th><th>Limitações</th></tr></thead>
    <tbody>${J.catalogo.map(c => `<tr><td class="src">${c.id}</td><td><b>${c.nome}</b></td><td class="src">${c.definicao}</td><td class="src">${c.formula}</td><td>${c.unidade}</td><td class="src">${c.fonte}</td><td class="src">${c.cobertura}</td><td class="src">${c.limitacoes}</td></tr>`).join("")}</tbody></table></div>
    <div class="src" style="margin-top:8px">Auditoria completa das fontes: docs/AUDITORIA_JUDICIAL.md</div></div>`;

  el.innerHTML = head + alerta + nacional + nominal + lacunas + metodo;
}
window.judCSV = () => {
  const J = state.data.judicial; if (!J || !J.disponivel) return;
  const linhas = J.camada_nacional.assuntos.map(a => [a.ramo, a.categoria, a.codigo, `"${a.nome}"`, a.casos_unicos, a.registros].join(";"));
  dlFile("judicial_assuntos.csv", "﻿ramo;categoria;codigo_tpu;assunto;casos_unicos;registros\n" + linhas.join("\n"), "text/csv;charset=utf-8");
};

/* ================= PIX E MEIOS DE PAGAMENTO (BCB Olinda: Pix, MPV, SPI, EPAE) ================= */
const PX_COLORS = { Pix: "var(--pix)", TED: "#1d4e89", Boleto: "#b45309", Cheque: "#64748b", DOC: "#8d94a3",
  TEC: "#8d94a3", CartaoCredito: "#6b46a3", CartaoDebito: "#0e7c7b", CartaoPrePago: "#b91c1c",
  TransIntrabancaria: "#525a68", Convenios: "#d9a514", DebitoDireto: "#2f7d4f", Saques: "#c2540a" };
const PX_DEFAULT_INSTS = ["Pix", "CartaoCredito", "CartaoDebito", "TED", "Boleto"];
window.pxSet = (k, v) => { state.px[k] = v; syncHash(); renderPix(); };
window.pxToggleInst = i => {
  const s = state.px.insts;
  state.px.insts = s.includes(i) ? s.filter(x => x !== i) : [...s, i];
  if (!state.px.insts.length) state.px.insts = ["Pix"];
  syncHash(); renderPix();
};
window.pxLoadMun = async () => {
  if (state.data.pix_mun === undefined) {
    state.data.pix_mun = null; renderPix();
    try { state.data.pix_mun = await (await fetch(`${DATA_BASE}pix_mun.json?v=${APP_VERSION}`)).json(); }
    catch (e) { state.data.pix_mun = { erro: true }; }
    renderPix();
  }
};
window.pxMunFiltro = () => { state.px.munq = (document.getElementById("pxmunq") || {}).value || ""; renderPix(); };

function pxStackedArea(periods, series, opts) {
  // participação empilhada (0–100%); séries: [{label, color, vals[]}] alinhadas a periods
  const W = 720, H = opts.h || 260, M = { t: 12, r: 14, b: 26, l: 40 };
  const n = periods.length;
  const X = i => M.l + i / Math.max(n - 1, 1) * (W - M.l - M.r);
  const Y = v => M.t + (1 - v / 100) * (H - M.t - M.b);
  const totals = periods.map((_, i) => series.reduce((s, sr) => s + (sr.vals[i] || 0), 0));
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.aria || "participação empilhada"}">`;
  [0, 25, 50, 75, 100].forEach(g => { out += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(g)}" y2="${Y(g)}" style="stroke:var(--border)"/><text x="${M.l - 5}" y="${Y(g) + 3}" text-anchor="end" font-size="9" style="fill:var(--c-axis-text)">${g}</text>`; });
  let base = periods.map(() => 0);
  series.forEach(sr => {
    const top = base.map((b, i) => b + (totals[i] ? (sr.vals[i] || 0) / totals[i] * 100 : 0));
    let d = "M" + periods.map((_, i) => `${X(i)},${Y(top[i])}`).join("L");
    d += "L" + periods.map((_, i) => `${X(n - 1 - i)},${Y(base[n - 1 - i])}`).join("L") + "Z";
    const tip = encodeURIComponent(`<div class="tt-date">${sr.label}</div><div class="tt-meta">participação no período final: ${totals[n - 1] ? fmt.n((sr.vals[n - 1] || 0) / totals[n - 1] * 100, 1) : "–"}%</div>`);
    out += `<path d="${d}" fill="${ccol(sr.color)}" opacity="0.82" data-tip="${tip}"></path>`;
    base = top;
  });
  const step = Math.max(1, Math.ceil(n / 8));
  periods.forEach((p, i) => { if (i % step === 0 || i === n - 1) out += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="8.6" style="fill:var(--c-axis-text)">${p}</text>`; });
  out += "</svg>";
  out += `<div class="stacklegend">${series.map(sr => `<span><span class="sw" style="background:${ccol(sr.color)}"></span>${sr.label}</span>`).join("")}</div>`;
  out += `<details class="charttable"><summary>dados em tabela (participação %, período final)</summary><div class="tblwrap" style="max-height:220px"><table class="data compact"><thead><tr><th>Instrumento</th><th style="text-align:right">${periods[n - 1]}</th></tr></thead><tbody>${series.map(sr => `<tr><td>${sr.label}</td><td style="text-align:right">${totals[n - 1] ? fmt.n((sr.vals[n - 1] || 0) / totals[n - 1] * 100, 1) : "–"}%</td></tr>`).join("")}</tbody></table></div></details>`;
  return out;
}

function renderPix() {
  const el = document.getElementById("view-pix");
  const X = state.data.pix;
  if (X === undefined) { el.innerHTML = loadingCard("Pix e meios de pagamento"); return; }
  if (!X || !X.disponivel) { el.innerHTML = pageHead({ title: "Pix e Meios de Pagamento" }) + `<div class="card"><h4>INDISPONÍVEL</h4><p class="src">${(X && (X.motivo || X.error)) || ""}</p></div>`; return; }
  const px = state.px, k = X.kpis;
  const modo = px.modo, real = px.val === "real", metr = px.metr;

  /* ---------- 1. Pix em uma visão ---------- */
  const head = pageHead({
    title: "Pix e Meios de Pagamento", vintage: X.mes,
    seals: `${badge("observado", "BCB: Pix_DadosAbertos, MPV, SPI")} ${badge("calculado", "valores reais (IPCA), base 100, participações e médias móveis calculados")}`,
    desc: "Como o Pix evoluiu, quem usa, para quê, onde — e como se compara a cartões, TED, boletos e os demais instrumentos.",
    fontes: "BCB (Pix, Meios de Pagamento, SPI, EPAE) · IBGE (população, IPCA)",
    actions: `<button class="btn ghost small" onclick="pxCSV()">baixar CSV</button>`,
  });
  const kpis = `<div class="pan-kpi">
    <div class="card kpi"><h4>Transações no mês</h4><div class="big pixnum">${fmt.n(k.qtd.v / 1e9, 2)} bi</div><div class="src">${fmt.pp(k.qtd.yoy)}% em 12m · ${X.mes} · universo doc 1201 (MPV)</div></div>
    <div class="card kpi"><h4>Valor movimentado</h4><div class="big pixnum">${fmt.money(k.valor.v)}</div><div class="src">${fmt.pp(k.valor.yoy)}% em 12m (nominal) · ${badge("observado")}</div></div>
    <div class="card kpi"><h4>Valor médio por transação</h4><div class="big">R$ ${fmt.n(k.ticket.v, 0)}</div><div class="src">${fmt.pp(k.ticket.yoy)}% em 12m — média esconde a diferença P2P × empresas (ver Natureza)</div></div>
    <div class="card kpi"><h4>Usuários cadastrados (DICT)</h4><div class="big">${fmt.n(k.usuarios.v / 1e6, 1)} mi</div><div class="src">PF ${fmt.n(k.usuarios.pf / 1e6, 0)} mi · PJ ${fmt.n(k.usuarios.pj / 1e6, 1)} mi · estoque em ${k.usuarios.data} — não é "usuário ativo" (sem definição oficial)</div></div>
    <div class="card kpi"><h4>Participação na quantidade</h4><div class="big pixnum">${fmt.n(k.part_tri.v, 1)}%</div><div class="src">das transações entre os instrumentos comparáveis · ${k.part_tri.tri} (trimestral)</div></div>
  </div>`;
  const sintese = `<p class="pan-sintese">${X.sintese}</p><div class="src">Texto automático determinístico · composições cobrem ${X.cobertura_tx_pct}% da quantidade (base transacional/SPI; restante liquidado nos livros dos participantes)</div>`;

  /* ---------- 2. evolução ---------- */
  // o Pix só existe a partir de nov/2020: meses anteriores do MPV são zeros reais
  // (o instrumento não existia) e achatariam a série — ficam fora desta seção.
  const sp = X.series.Pix.filter(o => (o.q || 0) > 0);
  const val = o => metr === "q" ? o.q : (real ? o.vr : o.v);
  // eixo em bilhões de transações / R$ trilhões: rótulos legíveis no lugar de 8.487.719.136
  const esc = modo !== "nivel" ? 1 : (metr === "q" ? 1e9 : 1e12);
  const mkSerie = arr => {
    let pts = arr.map(o => ({ x: o.p, y: val(o) })).filter(p => p.y != null);
    if (modo === "base100") { const b = pts[0].y; pts = pts.map(p => ({ x: p.x, y: p.y / b * 100 })); }
    if (modo === "var12") pts = pts.map((p, i) => i >= 12 ? { x: p.x, y: (p.y / pts[i - 12].y - 1) * 100 } : null).filter(Boolean);
    return esc === 1 ? pts : pts.map(p => ({ x: p.x, y: p.y / esc }));
  };
  const ptsPix = mkSerie(sp);
  const mm = (pts, w) => pts.map((p, i) => i >= w - 1 ? { x: p.x, y: pts.slice(i - w + 1, i + 1).reduce((s, x) => s + x.y, 0) / w } : null).filter(Boolean);
  const unidade = modo === "var12" ? "% a/a" : modo === "base100" ? "índice (100 = nov/2020)"
    : metr === "q" ? "bilhões de transações por mês" : (real ? "R$ trilhões (constantes)" : "R$ trilhões");
  const evol = sechead("Como o Pix evoluiu desde o lançamento?", `mensal desde 2020-11 · ${metr === "q" ? "quantidade" : real ? "valor real (IPCA)" : "valor nominal"}`) + `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 10px">
      <span class="seg">${[["q", "Quantidade"], ["v", "Valor"]].map(([v2, l]) => `<button class="${metr === v2 ? "on" : ""}" onclick="pxSet('metr','${v2}')">${l}</button>`).join("")}</span>
      <span class="seg">${[["nivel", "Nível"], ["base100", "Base 100"], ["var12", "Var. 12m"]].map(([v2, l]) => `<button class="${modo === v2 ? "on" : ""}" onclick="pxSet('modo','${v2}')">${l}</button>`).join("")}</span>
      ${metr === "v" ? `<span class="seg">${[["nominal", "Nominal"], ["real", "Real (IPCA)"]].map(([v2, l]) => `<button class="${px.val === v2 ? "on" : ""}" onclick="pxSet('val','${v2}')">${l}</button>`).join("")}</span>` : ""}
    </div>
    <div class="ov-2col">
      <div class="card">${lineChart({ series: [{ pts: ptsPix, label: "Pix", color: "var(--pix)" }, { pts: mm(ptsPix, 12), label: "média móvel 12m", color: "#64748b" }], h: 250, dec: modo === "nivel" ? 2 : 1, unit: unidade, fonte: "BCB MPV", aria: "evolução do Pix" })}</div>
      <div class="card"><h4 style="margin-top:0">Como ler</h4>
        <div class="pxstats">
          <div><span class="src">transações por usuário cadastrado</span><b>${k.usuarios.v ? fmt.n(k.qtd.v / k.usuarios.v, 1) + " / mês" : "–"}</b></div>
          <div><span class="src">valor por usuário cadastrado</span><b>${k.usuarios.v ? "R$ " + fmt.n0(k.valor.v / k.usuarios.v) + " / mês" : "–"}</b></div>
          <div><span class="src">crescimento em 12 meses</span><b>${fmt.pp(metr === "q" ? k.qtd.yoy : k.valor.yoy)}%</b></div>
          <div><span class="src">primeiro mês da série</span><b>${sp.length ? sp[0].p : "–"}</b></div>
        </div>
        <div class="src" style="margin-top:12px;line-height:1.65">Razões por usuário usam um ESTOQUE no denominador (cadastros no DICT) — uma pessoa pode ter várias chaves, e cadastro não significa uso.<br><br>Valores nominais e reais são séries distintas: a deflação usa o IPCA até seu último mês publicado.<br><br>Meses anteriores a nov/2020 ficam fora: o Pix ainda não existia.</div>
      </div>
    </div>`;

  /* ---------- 3. Pix versus outros meios ---------- */
  const mensais = ["Pix", "TED", "Boleto", "Cheque"];
  const cmpMensal = lineChart({ series: mensais.map(i => { const arr = X.series[i] || []; const pts = arr.map(o => ({ x: o.p, y: metr === "q" ? o.q : o.v })).filter(p => p.y > 0); const b = pts.length ? pts.find(p => p.x >= "2021-06").y : 1; return { pts: pts.filter(p => p.x >= "2021-06").map(p => ({ x: p.x, y: p.y / b * 100 })), label: i, color: PX_COLORS[i] }; }), h: 250, unit: "base 100 = jun/2021", fonte: "BCB MPV mensal", aria: "crescimento comparado dos instrumentos mensais" });
  const tris = X.tri.periodos.filter(t => t >= "2019");
  const instSel = px.insts;
  const stack = pxStackedArea(tris.map(t => t.slice(0, 7)), Object.keys(X.tri.nomes).filter(i => instSel.includes(i)).map(i => ({ label: X.tri.nomes[i], color: PX_COLORS[i], vals: tris.map(t => ((X.tri.dados[t] || {})[i] || {})[metr === "q" ? "q" : "v"] || 0) })), { aria: "participação por instrumento (trimestral)" });
  const t0d = X.tri.dados[X.tri.tri0];
  const foto = Object.keys(X.tri.nomes).filter(i => t0d[i] && (t0d[i].q || 0) > 0).map(i => ({ i, q: t0d[i].q, v: t0d[i].v, t: t0d[i].v / t0d[i].q })).sort((a, b) => b[metr === "q" ? "q" : "v"] - a[metr === "q" ? "q" : "v"]);
  const fotoMax = Math.max(...foto.map(x => x[metr === "q" ? "q" : "v"]));
  const versus = sechead("Como o Pix se compara aos outros instrumentos?", `comparação completa é TRIMESTRAL (cartões e outros não têm série mensal); nada foi interpolado`) + `
    <div class="instpick">${Object.keys(X.tri.nomes).map(i => `<button class="${instSel.includes(i) ? "on" : ""}" onclick="pxToggleInst('${i}')">${X.tri.nomes[i]}</button>`).join("")}</div>
    <div class="ov-2col-eq">
      <div class="card"><h4>Participação na ${metr === "q" ? "quantidade" : "soma de valor"} — trimestral</h4>${stack}</div>
      <div class="card"><h4>Fotografia do trimestre ${X.kpis.part_tri.tri}</h4>
        ${foto.map(x => panBar(X.tri.nomes[x.i], x[metr === "q" ? "q" : "v"], fotoMax, v2 => metr === "q" ? fmt.n(v2 / 1e9, 1) + " bi" : fmt.money(v2), `tíquete R$ ${fmt.n(x.t, 0)}`)).join("")}
        <div class="src" style="margin-top:6px">tíquete = valor ÷ quantidade — TED concentra grandes valores; cartão de crédito embute financiamento; nenhum instrumento é substituto perfeito de outro.</div></div>
    </div>
    <div class="ov-2col-eq" style="margin-top:14px">
    <div class="card"><h4 style="margin-top:0">Crescimento comparado — instrumentos MENSAIS (base 100 em jun/2021)</h4>${cmpMensal}</div>
    <div class="card"><h4 style="margin-top:0">Como ler esta comparação</h4>
    ${entenda("pxcmp", [["Regra temporal", "Pix, TED, boleto e cheque têm série mensal; cartões e demais são trimestrais — por isso a comparação completa usa trimestres, e os mensais entram somados por trimestre."],
      ["DOC e TEC", "descontinuados em 2024 — os zeros finais são reais, não ausência de dado."],
      ["Leitura", "quantidade, valor e tíquete contam histórias diferentes: o Pix domina a quantidade; TED domina o valor médio."]])}</div></div>`;

  /* ---------- 4. quem usa ---------- */
  const us = X.usuarios_serie;
  const chv = X.chaves || {};
  const quem = sechead("Quem usa o Pix?", "estoques de fim de período — nunca somados no tempo · chave ≠ usuário") + `
    <div class="ov-2col-eq">
    <div class="card"><h4>Usuários cadastrados no DICT</h4>
      ${lineChart({ series: [{ pts: us.map(o => ({ x: o.p, y: o.pf })), label: "PF", color: "var(--pix)" }, { pts: us.map(o => ({ x: o.p, y: o.pj })), label: "PJ", color: "#6b46a3" }], h: 220, unit: "usuários (estoque)", fonte: "DICT", aria: "usuários cadastrados no DICT" })}
      ${leitura([["PJ", `${fmt.n((us[us.length - 1].pj) / 1e6, 1)} mi de empresas cadastradas`], ["Conceito", "cadastro no DICT = ter chave registrada; não mede atividade"]])}</div>
    <div class="card"><h4>Chaves Pix — estoque em ${chv.data || "–"}</h4>
      ${(chv.por_tipo || []).map(t2 => panBar(t2.k, t2.q, chv.por_tipo[0].q, v2 => fmt.n(v2 / 1e6, 1) + " mi")).join("")}
      ${leitura([["Total", chv.total ? `${fmt.n(chv.total / 1e6, 0)} mi de chaves em ${chv.n_participantes} participantes` : "–"],
        ["Chaves por usuário", chv.total && k.usuarios.v ? fmt.n(chv.total / k.usuarios.v, 2) + " (uma pessoa pode ter várias chaves)" : "–"],
        ["Nota", `snapshot completo mais recente publicado pela fonte: ${chv.data}${chv.anterior ? "" : ""}`]])}
      <details class="charttable"><summary>maiores participantes por chaves</summary><div class="tblwrap" style="max-height:220px"><table class="data compact"><tbody>${(chv.top_participantes || []).map(p2 => `<tr><td>${p2.nome}</td><td class="src">${p2.seg || ""}</td><td style="text-align:right">${fmt.n(p2.q / 1e6, 1)} mi</td></tr>`).join("")}</tbody></table></div></details></div>
    </div>`;

  /* ---------- 5. natureza ---------- */
  const NATL = { P2P: "Pessoa → Pessoa (transferência pessoal)", P2B: "Pessoa → Empresa (pagamento comercial)", B2P: "Empresa → Pessoa (salários, repasses)", B2B: "Empresa → Empresa (transferência empresarial)", P2G: "Pessoa → Governo", G2P: "Governo → Pessoa (benefícios)", B2G: "Empresa → Governo", G2B: "Governo → Empresa", G2G: "Governo → Governo" };
  const natMax = Math.max(...X.natureza.atual.map(x => x.q));
  const natureza = sechead("Para que o Pix é usado?", `natureza dos fluxos · base transacional ${X.mes_tx} (cobertura ${X.cobertura_tx_pct}%)`) + `
    <div class="ov-2col-eq">
    <div class="card"><h4>Quantidade e tíquete por natureza</h4>
      ${X.natureza.atual.map(x => panBar(NATL[x.k] || x.k, x.q, natMax, v2 => fmt.n(v2 / 1e9, 2) + " bi", `${fmt.n(x.part_q, 1)}% · tíquete R$ ${fmt.n(x.t, 0)}`)).join("")}
      ${leitura([["Leitura", "P2P domina a quantidade com tíquete baixo; B2B tem poucas transações com tíquete alto — o Pix combina papéis de transferência pessoal, maquininha e tesouraria"], ["Governo", "fluxos G2P/P2G identificados pela fonte"]])}</div>
    <div class="card"><h4>Uso comercial: participação do P2B na quantidade</h4>
      ${lineChart({ series: [{ pts: X.natureza.serie_p2b.map(o => ({ x: o.p, y: o.v })), label: "P2B", color: "var(--pix)" }, { pts: X.natureza.serie_p2p.map(o => ({ x: o.p, y: o.v })), label: "P2P", color: "#64748b" }], h: 200, unit: "% da quantidade", aria: "participação de P2B e P2P" })}
      <h4 style="margin-top:12px">Quem paga, por faixa etária</h4>
      ${X.natureza.idade_pagador.filter(x => !["Nao se aplica", "Nao informado"].includes(x.k)).map(x => panBar(x.k, x.q, natMax, v2 => fmt.n(v2 / 1e9, 2) + " bi", `${fmt.n(x.part_q, 1)}%`)).join("")}
      <div class="src" style="margin-top:4px">idade disponível apenas para pagadores PF; "não se aplica" = PJ.</div></div>
    </div>`;

  /* ---------- 6. geografia ---------- */
  const G = X.geografia;
  const gmet = px.gmet, persp = px.gpersp;
  const GMETS = { q_hab: ["Transações por habitante", v2 => fmt.n(v2, 1)], v_hab: ["R$ por habitante", v2 => "R$ " + fmt.n0(v2)], t_pag: ["Valor médio (R$)", v2 => "R$ " + fmt.n(v2, 0)], v_abs: ["Valor total", v2 => fmt.money(v2)], yoy_v: ["Crescimento 12m (%)", v2 => fmt.pp(v2) + "%"] };
  const gval = u => { if (gmet === "v_abs") return persp === "rec" ? u.v_rec : u.v_pag; if (gmet === "q_hab") return persp === "rec" ? null : u.q_hab; if (gmet === "v_hab") return persp === "rec" ? null : u.v_hab; if (gmet === "t_pag") return u.t_pag; return u.yoy_v; };
  const gvals = G.ufs.map(gval);
  const gscale = panScale(gvals, gmet === "yoy_v" ? "div0" : "seq");
  const gpaths = G.ufs.map(u => {
    const d = (G.geo.paths || {})[u.uf];
    if (!d) return "";
    const tip = encodeURIComponent(`<div class="tt-date">${u.nome} (${u.uf})</div>
      <div class="tt-row"><span class="tt-lbl">pagador: valor</span><span class="tt-val">${fmt.money(u.v_pag)}</span></div>
      <div class="tt-row"><span class="tt-lbl">recebedor: valor</span><span class="tt-val">${fmt.money(u.v_rec)}</span></div>
      <div class="tt-row"><span class="tt-lbl">transações/habitante</span><span class="tt-val">${fmt.n(u.q_hab, 1)}</span></div>
      <div class="tt-row"><span class="tt-lbl">R$/habitante</span><span class="tt-val">${fmt.n0(u.v_hab)}</span></div>
      <div class="tt-row"><span class="tt-lbl">valor médio</span><span class="tt-val">R$ ${fmt.n(u.t_pag, 0)}</span></div>
      <div class="tt-row"><span class="tt-lbl">crescimento 12m</span><span class="tt-val">${fmt.pp(u.yoy_v)}%</span></div>`);
    return `<path d="${d}" fill="${gscale(gval(u))}" data-tip="${tip}"></path>`;
  }).join("");
  const M2 = state.data.pix_mun;
  const munq = (px.munq || "").toLowerCase();
  const munRows = M2 && M2.municipios ? M2.municipios.filter(m2 => !munq || m2.mun.toLowerCase().includes(munq) || (m2.uf || "").toLowerCase() === munq).slice(0, 25) : [];
  const geog = sechead("Onde o Pix acontece?", `${G.mes} · padrão NORMALIZADO por habitante (valores absolutos favorecem estados populosos)`) + `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 10px">
      <span class="seg">${Object.entries(GMETS).map(([k2, [l]]) => `<button class="${gmet === k2 ? "on" : ""}" onclick="pxSet('gmet','${k2}')">${l.split(" (")[0]}</button>`).join("")}</span>
      <span class="seg">${[["pag", "Pagador"], ["rec", "Recebedor"]].map(([v2, l]) => `<button class="${persp === v2 ? "on" : ""}" onclick="pxSet('gpersp','${v2}')">${l}</button>`).join("")}</span>
    </div>
    <div class="ov-2col-eq">
      <div class="card"><svg class="panmap" viewBox="${G.geo.viewBox}" role="img" aria-label="mapa do Pix por UF"><g transform="${G.geo.transform}">${gpaths}</g></svg>
      <div class="src" style="margin-top:6px">${G.nota_perspectiva} Métricas por habitante existem só na perspectiva do pagador (denominador populacional).</div></div>
      <div class="card"><h4>Municípios — os maiores por valor pago</h4>
      ${M2 === undefined ? `<button class="btn" onclick="pxLoadMun()">carregar ranking municipal (5,5 mil municípios)</button>` :
        M2 === null ? `<p class="src"><span class="spin"></span> carregando…</p>` :
        `<input id="pxmunq" placeholder="filtrar por nome ou sigla da UF" value="${px.munq || ""}" oninput="pxMunFiltro()" style="width:100%;margin:4px 0 8px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
        <div class="tblwrap" style="max-height:340px"><table class="data compact"><thead><tr><th>Município</th><th>UF</th><th style="text-align:right">Valor pago</th><th style="text-align:right">Transações</th><th style="text-align:right">Pessoas pagadoras</th></tr></thead>
        <tbody>${munRows.map(m2 => `<tr><td>${m2.mun}</td><td>${m2.uf || "–"}</td><td style="text-align:right">${fmt.money(m2.v_pag)}</td><td style="text-align:right">${fmt.n0(m2.q_pag)}</td><td style="text-align:right">${fmt.n0(m2.pes_pag)}</td></tr>`).join("")}</tbody></table></div>
        <div class="src">mapa municipal coroplético: fase 2 (malha de 5.570 polígonos); rankings e busca já cobrem o nível municipal.</div>`}</div>
    </div>`;

  /* ---------- 7. EPAE ---------- */
  const E = X.epae || {};
  let epae = "";
  if (E.setores) {
    const smax = Math.max(...E.setores.map(s => s.v));
    const NATREL = { "P2B": "de pessoas", "B2B": "de empresas", "G2B": "do governo", "P2P": "entre pessoas", "B2P": "a pessoas", "Nao disponivel": "n.d." };
    const sel = E.setores.find(s => s.setor === px.setor) || E.setores[0];
    const mrow = E.matriz_naturezarel[sel.setor] || {};
    epae = sechead("Pix e atividade econômica — quem recebe, por setor", `EPAE · ${E.mes} · fluxo financeiro RECEBIDO — não é receita, consumo nem faturamento`) + `
      <div class="ov-2col-eq">
      <div class="card"><h4>Setores que mais recebem via Pix</h4>
        ${E.setores.slice(0, 14).map(s => `<div onclick="pxSet('setor','${s.setor.replace(/'/g, "")}')" style="cursor:pointer">${panBar(s.setor.length > 42 ? s.setor.slice(0, 40) + "…" : s.setor, s.v, smax, v2 => fmt.money(v2), `${fmt.n(s.part, 1)}% · ${s.yoy != null ? fmt.pp(s.yoy) + "% 12m" : ""}`)}</div>`).join("")}
        <div class="src">top 5 concentram ${E.concentracao_top5_pct}% do valor · clique num setor para o detalhe</div></div>
      <div class="card"><h4>${sel.setor}</h4>
        <div class="pan-kpi" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
          <div><div class="src">recebe/mês</div><div class="big" style="font-size:19px">${fmt.money(sel.v)}</div></div>
          <div><div class="src">participação</div><div class="big" style="font-size:19px">${fmt.n(sel.part, 1)}%</div></div>
          <div><div class="src">tíquete</div><div class="big" style="font-size:19px">R$ ${fmt.n(sel.t, 0)}</div></div>
          <div><div class="src">crescimento 12m</div><div class="big" style="font-size:19px">${sel.yoy != null ? fmt.pp(sel.yoy) + "%" : "n.d."}</div></div>
        </div>
        <h5 style="margin:10px 0 4px">De quem recebe</h5>
        ${Object.entries(mrow).sort((a, b) => b[1] - a[1]).map(([n2, v2]) => panBar(NATREL[n2] || n2, v2, Math.max(...Object.values(mrow)), vv => fmt.money(vv))).join("")}
        ${leitura([["MEI", sel.mei_pct != null ? `${fmt.n(sel.mei_pct, 1)}% do valor recebido vai a MEIs` : "n.d."], ["Compras", sel.compra_pct != null ? `${fmt.n(sel.compra_pct, 1)}% marcado como compra` : "n.d."]])}
        <div class="src" style="margin-top:6px">Limite da fonte pública: o lado PAGADOR aparece apenas como pessoa/empresa/governo — a matriz completa setor-pagador × setor-recebedor não existe na EPAE aberta; o "para quem paga" de cada setor é, portanto, indisponível (declarado).</div></div>
      </div>`;
  }

  /* ---------- 8. funcionalidades ---------- */
  const F = X.formas;
  const shareChart = (pares) => lineChart({ series: pares.map(([s, l, c]) => ({ pts: s.map(o => ({ x: o.p, y: o.v })).filter(p2 => p2.y != null && p2.x >= "2022-01"), label: l, color: c })), h: 220, unit: "% da quantidade de transações", aria: "participação das funcionalidades" });
  const func = sechead("Funcionalidades: QR Code, aproximação, Pix Automático e iniciadores", `forma de iniciação · base transacional (cobertura ${X.cobertura_tx_pct}%)`) + `
    <div class="ov-2col-eq">
    <div class="card"><h4>Como as transações são iniciadas (${X.mes_tx})</h4>
      ${F.atual.map(x => panBar(F.nomes[x.k] || x.k, x.q, F.atual[0].q, v2 => fmt.n(v2 / 1e9, 2) + " bi", `${fmt.n(x.part_q, 1)}%`)).join("")}
      ${leitura([["QR dinâmico", "gerado por transação, típico de cobrança comercial — é o proxy observável de 'Pix Cobrança' (a fonte não publica série própria da funcionalidade)"], ["Sem dados públicos", "Pix Cobrança como produto e transações agendadas não têm série oficial — nada foi estimado"]])}</div>
    <div class="card"><h4>Adoção das funcionalidades novas</h4>
      ${shareChart([[F.serie_auto, "Pix Automático", "var(--pix)"], [F.serie_inic, "Iniciador (Open Finance)", "#6b46a3"], [F.serie_apdn, "Aproximação (dinâmico)", "#b45309"], [F.serie_apes, "Aproximação (estático)", "#d9a514"]])}
      <h5 style="margin:10px 0 4px">Pix Saque e Pix Troco (finalidade)</h5>
      ${X.finalidades.atual.filter(x => x.k !== "Pix").map(x => panBar(x.k, x.q, X.finalidades.atual.find(y => y.k !== "Pix").q, v2 => fmt.n(v2 / 1e6, 1) + " mi", `tíquete R$ ${fmt.n(x.t, 0)}`)).join("")}
    </div></div>`;

  /* ---------- 9. MED ---------- */
  const md = X.med, md0 = md[md.length - 1] || {};
  const medS = sechead("Segurança: o Mecanismo Especial de Devolução (MED)", "conceitos oficiais — contestação ≠ fraude confirmada") + `
    <div class="ov-2col-eq">
    <div class="card"><h4>Contestações aceitas a cada 100 mil transações</h4>
      ${lineChart({ series: [{ pts: md.map(o => ({ x: o.p, y: o.aceitas_100mil })), label: "aceitas/100 mil", color: "#b91c1c" }], h: 200, unit: "por 100 mil transações", fonte: "BCB MED", aria: "incidência de contestações aceitas" })}
      ${lineChart({ series: [{ pts: md.map(o => ({ x: o.p, y: o.pct_devolucao })), label: "% devolvido", color: "var(--pix)" }], h: 160, unit: "% do valor contestado devolvido", aria: "taxa de devolução do MED" })}</div>
    <div class="card"><h4>Último mês (${md0.p || "–"})</h4>
      <div class="pan-kpi" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
        <div><div class="src">Pix contestados</div><div class="big" style="font-size:20px">${fmt.n0(md0.contestados_q)}</div></div>
        <div><div class="src">contestações aceitas</div><div class="big" style="font-size:20px">${fmt.n0(md0.aceitas_q)}</div></div>
        <div><div class="src">valor contestado (aceitas)</div><div class="big" style="font-size:20px">${fmt.money(md0.valor_contestado)}</div></div>
        <div><div class="src">% devolvido</div><div class="big" style="font-size:20px">${fmt.n(md0.pct_devolucao, 1)}%</div></div>
        <div><div class="src">usuários com marcação de fraude</div><div class="big" style="font-size:20px">${fmt.n0(md0.usuarios_marcados)}</div></div>
        <div><div class="src">chaves com marcação</div><div class="big" style="font-size:20px">${fmt.n0(md0.chaves_marcadas)}</div></div>
      </div>
      ${entenda("pxmed", [["Cadeia de conceitos", "transação CONTESTADA → contestação ACEITA → DEVOLUÇÃO (integral ou parcial). 'Marcação de fraude' é um registro no DICT, não sentença."],
        ["Por que a devolução parcial", "o MED só alcança o saldo remanescente na conta do recebedor — daí o % devolvido baixo."],
        ["O que NÃO afirmamos", "nenhum campo aqui é 'fraude confirmada'; a fonte pública não oferece essa classificação."]])}</div>
    </div>`;

  /* ---------- 10. infraestrutura ---------- */
  const S = X.spi;
  const infra = sechead("Infraestrutura: o SPI por dentro", S.nota) + `
    <div class="ov-3col">
    <div class="card"><h4>Liquidação diária no SPI (90 dias)</h4>${lineChart({ series: [{ pts: S.diario_ult90.map(o => ({ x: o.p, y: o.q })), label: "transações/dia", color: "var(--pix)" }], h: 180, unit: "transações/dia", aria: "liquidação diária no SPI" })}
      <div class="src">pico histórico: ${S.pico ? `${fmt.n0(S.pico.q)} transações em ${S.pico.p}` : "–"}</div></div>
    <div class="card"><h4>Distribuição intradia (média)</h4>${lineChart({ series: [{ pts: S.intradia.map(o => ({ x: o.h, y: o.q })), label: "média por horário", color: "#1d4e89" }], h: 180, unit: "transações", aria: "curva intradia média" })}
      <div class="src">horário de maior uso: ${S.intradia.length ? S.intradia.reduce((a, b) => (b.q || 0) > (a.q || 0) ? b : a).h : "–"}</div></div>
    <div class="card"><h4>Disponibilidade do SPI</h4>${lineChart({ series: [{ pts: S.disponibilidade.map(o => ({ x: String(o.p), y: o.i })), label: "índice", color: "#2f7d4f" }], h: 180, unit: "% de disponibilidade", dec: 3, aria: "índice de disponibilidade do SPI" })}
      <div class="src">mínimo normativo: ${S.disponibilidade.length ? S.disponibilidade[S.disponibilidade.length - 1].min : "–"}% · participantes com chaves: ${chv.n_participantes || "–"}</div></div>
    </div>`;

  /* ---------- metodologia ---------- */
  const metodo = `<div class="card" style="margin-top:22px"><h4>Cautelas e conceitos desta página</h4>
    <ol style="max-width:1100px;line-height:1.7;font-size:12.8px;color:var(--text-2)">${X.cautelas.map(c => `<li>${c}</li>`).join("")}</ol>
    <details class="charttable"><summary>catálogo de métricas (${X.catalogo.length})</summary><div class="tblwrap"><table class="data compact"><thead><tr><th>id</th><th>Nome</th><th>Conceito</th><th>Fórmula</th><th>Unid.</th><th>Freq.</th><th>Fonte</th><th>Início</th><th>Limitações</th></tr></thead>
    <tbody>${X.catalogo.map(c => `<tr><td class="src">${c.id}</td><td><b>${c.nome}</b></td><td class="src">${c.conceito}</td><td class="src">${c.formula}</td><td>${c.unidade}</td><td>${c.periodicidade}</td><td class="src">${c.fonte}</td><td>${c.inicio}</td><td class="src">${c.limitacoes}</td></tr>`).join("")}</tbody></table></div></details></div>`;

  el.innerHTML = head + sintese + kpis + evol + versus + quem + natureza + geog + epae + func + medS + infra + metodo;
}
window.pxCSV = () => {
  const X = state.data.pix; if (!X || !X.disponivel) return;
  const rows = X.series.Pix.map(o => [o.p, o.q, o.v, o.vr ? Math.round(o.vr) : "", o.t].join(";"));
  dlFile("pix_series_mensais.csv", "﻿mes;quantidade;valor_nominal_brl;valor_real_brl;valor_medio_brl\n" + rows.join("\n"), "text/csv;charset=utf-8");
};

/* ================= PANORAMA DO CRÉDITO (SCR.data v2 — regional e socioeconômico) ================= */
const PAN_METS = {
  saldo: { l: "Saldo", kind: "seq", desc: "carteira ativa (R$)", f: v => fmt.money(v) },
  per_capita: { l: "Per capita", kind: "seq", desc: "saldo ÷ população IBGE", f: v => "R$ " + fmt.n0(v) },
  saldo_medio_op: { l: "Saldo médio/operação", kind: "seq", desc: "apenas células com nº de operações público", f: v => "R$ " + fmt.n0(v) },
  part_br: { l: "Participação", kind: "seq", desc: "% do saldo nacional", f: v => fmt.n(v, 1) + "%" },
  cresc12: { l: "Crescimento 12m", kind: "div0", desc: "variação nominal do estoque", f: v => fmt.pp(v) + "%" },
  cresc3: { l: "Crescimento 3m", kind: "div0", desc: "variação nominal do estoque", f: v => fmt.pp(v) + "%" },
  inad: { l: "Inadimplência", kind: "divbr", desc: "arrastada >90d (≠ conceito SGS)", f: v => fmt.n(v, 1) + "%" },
  atraso15_90: { l: "Atraso 15–90d", kind: "divbr", desc: "parcelas vencidas 15–90d / carteira", f: v => fmt.n(v, 2) + "%" },
  ap: { l: "Ativo problemático", kind: "divbr", desc: "Res. 4.557 (inclui reestruturados)", f: v => fmt.n(v, 1) + "%" },
  z_inad: { l: "Z-score da inad.", kind: "div0", desc: "vs. própria história (29 meses)", f: v => fmt.pp(v) },
};
state.panoCache = {};
window.panSet = (k, v) => { state.pan[k] = v; syncHash(); renderPanorama(); };
window.panSelUF = uf => { state.pan.uf = state.pan.uf === uf ? null : uf; panEnsureUF(state.pan.uf); syncHash(); renderPanorama(); };
window.panAddCmp = uf => {
  if (!uf || state.pan.cmp.includes(uf)) return;
  if (state.pan.cmp.length >= 3) { alert("Comparação limitada a 4 unidades (Brasil + 3 UFs)."); return; }
  state.pan.cmp.push(uf); panEnsureUF(uf); syncHash(); renderPanorama();
};
window.panRmCmp = uf => { state.pan.cmp = state.pan.cmp.filter(x => x !== uf); syncHash(); renderPanorama(); };
async function panEnsureUF(uf) {
  if (!uf || state.panoCache[uf]) return;
  try {
    state.panoCache[uf] = await (await fetch(`${DATA_BASE}pano/${uf}.json?v=${APP_VERSION}`)).json();
    renderPanorama();
  } catch (e) { /* painel mostra carregando */ }
}
window.panLoadExplorer = async () => {
  if (state.data.explorer === undefined) {
    state.data.explorer = null; renderPanorama();
    try { state.data.explorer = await (await fetch(`${DATA_BASE}explorer.json?v=${APP_VERSION}`)).json(); }
    catch (e) { state.data.explorer = { erro: true }; }
    renderPanorama();
  }
};
window.panExpSet = (k, v) => { state.pan.exp[k] = v; if (k === "fato") { state.pan.exp.grupo = null; state.pan.exp.filtros = {}; } renderPanorama(); };
window.panExpFiltro = (dim, v) => { state.pan.exp.filtros[dim] = v; renderPanorama(); };

function panScale(vals, kind, brRef) {
  const valid = vals.filter(v => v != null);
  const lo = Math.min(...valid), hi = Math.max(...valid);
  return v => {
    if (v == null) return "var(--surface-2)";
    if (kind === "seq") {
      const t = (v - lo) / Math.max(hi - lo, 1e-9);
      return `color-mix(in srgb, var(--accent) ${Math.round(8 + t * 80)}%, var(--surface))`;
    }
    const center = kind === "divbr" ? (brRef || 0) : 0;
    const span = Math.max(Math.abs(hi - center), Math.abs(lo - center), 1e-9);
    const t = Math.min(Math.abs(v - center) / span, 1);
    const col = v >= center ? "var(--c-neg)" : "var(--c-line1)";
    return `color-mix(in srgb, ${col} ${Math.round(t * 78)}%, var(--surface))`;
  };
}

function panBar(label, v, vmax, fmtFn, extra, diverge) {
  if (v == null) return `<div class="panbar"><span>${label}</span><div class="track"></div><span class="src" title="taxa suprimida: carteira do grupo abaixo do limite de divulgação ou dado indisponível">n.d.†</span></div>`;
  let fill;
  if (diverge) {
    const span = Math.max(Math.abs(vmax), 1e-9);
    const w = Math.min(Math.abs(v) / span, 1) * 50;
    fill = `<span class="zero" style="left:50%"></span><span class="fill" style="left:${v >= 0 ? 50 : 50 - w}%;width:${w}%;background:${v >= 0 ? "color-mix(in srgb, var(--c-neg) 75%, transparent)" : "color-mix(in srgb, var(--c-line1) 75%, transparent)"}"></span>`;
  } else {
    fill = `<span class="fill" style="width:${Math.min(v / Math.max(vmax, 1e-9), 1) * 100}%;background:${diverge === false ? "color-mix(in srgb, var(--c-line1) 70%, transparent)" : "color-mix(in srgb, var(--c-line1) 70%, transparent)"}"></span>`;
  }
  return `<div class="panbar"><span title="${attr(label)}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</span>
    <div class="track">${fill}</div>
    <span style="text-align:right;font-variant-numeric:tabular-nums"><b>${fmtFn(v)}</b>${extra ? ` <span class="src">${extra}</span>` : ""}</span></div>`;
}

function renderPanorama() {
  const el = document.getElementById("view-panorama");
  const P = state.data.panorama;
  if (P === undefined) { el.innerHTML = loadingCard("o panorama do crédito"); return; }
  if (!P || !P.disponivel) {
    el.innerHTML = pageHead({ title: "Panorama do Crédito" }) + `<div class="card"><h4>INDISPONÍVEL</h4><p class="src">${(P && (P.motivo || P.error)) || "gold ausente"}</p></div>`;
    return;
  }
  const pan = state.pan, met = PAN_METS[pan.met] ? pan.met : "saldo", M = PAN_METS[met];
  const byUF = Object.fromEntries(P.mapa.map(m => [m.uf, m]));
  const brInad = P.kpis.inad.v;

  /* ---------- área 1: síntese + KPIs ---------- */
  const head = pageHead({
    title: "Panorama do Crédito",
    seals: `${badge("observado", "SCR.data v2 — agregados públicos do BCB")} ${badge("calculado", "taxas, crescimento, per capita, z-scores e síntese calculados com metodologia declarada")}`,
    desc: `Onde está o crédito, quem toma, em quais produtos e com qual qualidade — 27 UFs × produto × renda × ocupação, ${P.datas.length} datas-base.`,
    fontes: `BCB SCR.data v2 (data-base ${P.data_base}) · ${P.populacao_fonte} · malha IBGE`,
    actions: `<button class="btn ghost small" onclick="panCSV()">baixar CSV</button>`,
  });
  const k = P.kpis;
  const kpis = `<div class="pan-kpi">
    <div class="card kpi"><h4>Carteira ativa</h4><div class="big">${fmt.money(k.saldo.v)}</div><div class="src">${badge("observado")} SCR.data · ${P.data_base}</div></div>
    <div class="card kpi"><h4>Crescimento nominal</h4><div class="big" style="color:var(--accent-ink)">${fmt.pp(k.saldo.cresc12)}%<small> 12m</small></div><div class="src">3m ${fmt.pp(k.saldo.cresc3)}% · 6m ${fmt.pp(k.saldo.cresc6)}% — estoque entre datas-base (não é concessão)</div></div>
    <div class="card kpi"><h4>Inadimplência (arrastada) ${inadChip("scr")}</h4><div class="big" style="color:var(--c-neg)">${fmt.n(k.inad.v, 1)}%</div><div class="src">${fmt.pp(k.inad.d12m_pp)} p.p. em 12m · <span title="${attr(k.inad.conceito)}">conceito ≠ SGS†</span> · atraso 15–90d: ${fmt.n(k.atraso15_90.v, 2)}%</div></div>
    <div class="card kpi"><h4>Saldo médio por operação</h4><div class="big">R$ ${fmt.n0(k.saldo_medio_op.v)}</div><div class="src" title="${attr(k.saldo_medio_op.conceito)}">${k.saldo_medio_op.parcial ? "cálculo parcial (células suprimidas fora)†" : ""} · nº de clientes não é público</div></div>
    <div class="card kpi"><h4>Maior deterioração</h4><div class="big" style="font-size:16px;font-weight:560;line-height:1.35">${k.grupo_deterioracao.v || "–"}</div><div class="src">inadimplência arrastada · regra publicada em "O que mudou?"</div></div>
  </div>`;
  const sintese = `<p class="pan-sintese">${P.sintese}</p>
    <div class="src">Síntese determinística (regras publicadas na metodologia) · ${badge("calculado")} · data-base ${P.data_base} · ativo problemático nacional: ${fmt.n(k.ap.v, 1)}%</div>`;

  /* ---------- área 2: mapa ---------- */
  const vals = P.mapa.map(m => m[met]);
  const scale = panScale(vals, M.kind, met === "inad" ? brInad : (met === "atraso15_90" ? k.atraso15_90.v : k.ap.v));
  const ranked = [...P.mapa].filter(m => m[met] != null).sort((a, b) => b[met] - a[met]);
  const rankOf = uf => { const i = ranked.findIndex(m => m.uf === uf); return i < 0 ? null : i + 1; };
  const paths = P.mapa.map(m => {
    const d = P.geo.paths[m.cod];
    if (!d) return "";
    const tip = encodeURIComponent(`<div class="tt-date">${m.nome} (${m.uf}) — ${m.regiao}</div>
      <div class="tt-row"><span class="tt-lbl">saldo</span><span class="tt-val">${fmt.money(m.saldo)} (${fmt.n(m.part_br, 1)}% do BR)</span></div>
      <div class="tt-row"><span class="tt-lbl">crescimento 12m</span><span class="tt-val">${fmt.pp(m.cresc12)}%</span></div>
      <div class="tt-row"><span class="tt-lbl">inadimplência</span><span class="tt-val">${fmt.n(m.inad, 1)}% (BR ${fmt.n(brInad, 1)}%)</span></div>
      <div class="tt-row"><span class="tt-lbl">atraso 15–90d</span><span class="tt-val">${fmt.n(m.atraso15_90, 2)}%</span></div>
      <div class="tt-row"><span class="tt-lbl">saldo médio/op.</span><span class="tt-val">R$ ${fmt.n0(m.saldo_medio_op)}</span></div>
      <div class="tt-row"><span class="tt-lbl">per capita</span><span class="tt-val">R$ ${fmt.n0(m.per_capita)}</span></div>
      <div class="tt-meta">produto dominante: ${m.prod_dominante || "–"} · renda dominante: ${m.renda_dominante || "–"}<br>Δ inad 12m: ${fmt.pp(m.d_inad_12m)} p.p. · ${M.l}: ${m[met] != null ? M.f(m[met]) : "n.d."} (${rankOf(m.uf) ? rankOf(m.uf) + "º de " + ranked.length : "sem rank"})<br>clique para abrir o painel estadual</div>`);
    const cls = (pan.uf === m.uf ? "sel" : (pan.uf && pan.uf !== m.uf && !pan.cmp.includes(m.uf) ? "dim2" : ""));
    return `<path d="${d}" class="${cls}" fill="${scale(m[met])}" data-tip="${tip}" onclick="panSelUF('${m.uf}')" aria-label="${attr(m.nome)}"></path>`;
  }).join("");
  const legend = M.kind === "seq"
    ? `<div class="maplegend"><span>${M.f(Math.min(...vals.filter(v => v != null)))}</span><span class="grad" style="background:linear-gradient(90deg, color-mix(in srgb, var(--accent) 8%, var(--surface)), color-mix(in srgb, var(--accent) 88%, var(--surface)))"></span><span>${M.f(Math.max(...vals.filter(v => v != null)))}</span><span>· ${M.desc}</span></div>`
    : `<div class="maplegend"><span style="color:var(--c-line1)">abaixo ${M.kind === "divbr" ? "do Brasil" : "de zero"}</span><span class="grad" style="background:linear-gradient(90deg, color-mix(in srgb, var(--c-line1) 78%, var(--surface)), var(--surface), color-mix(in srgb, var(--c-neg) 78%, var(--surface)))"></span><span style="color:var(--c-neg)">acima</span><span>· ${M.desc}</span></div>`;
  const metsel = `<div class="metsel">${Object.entries(PAN_METS).map(([kk, mm]) =>
    `<button class="${kk === met ? "on" : ""}" onclick="panSet('met','${kk}')" title="${mm.desc}">${mm.l}</button>`).join("")}</div>`;
  const mapa = `<div class="card">
    ${metsel}
    <svg class="panmap" viewBox="${P.geo.viewBox}" role="img" aria-label="mapa do Brasil por UF — ${M.l}"><g transform="${P.geo.transform}">${paths}</g></svg>
    ${legend}
    <details class="charttable"><summary>dados em tabela (todas as UFs)</summary><div class="tblwrap" style="max-height:340px"><table class="data compact"><thead><tr><th>UF</th><th style="text-align:right">Saldo</th><th style="text-align:right">Part. BR</th><th style="text-align:right">Cresc. 12m</th><th style="text-align:right">Inad.</th><th style="text-align:right">15–90d</th><th style="text-align:right">Per capita</th></tr></thead><tbody>
    ${ranked.map(m => `<tr style="cursor:pointer" onclick="panSelUF('${m.uf}')"><td><b>${m.uf}</b> ${m.nome}</td><td style="text-align:right">${fmt.money(m.saldo)}</td><td style="text-align:right">${fmt.n(m.part_br, 1)}%</td><td style="text-align:right">${fmt.pp(m.cresc12)}%</td><td style="text-align:right">${fmt.n(m.inad, 1)}%</td><td style="text-align:right">${fmt.n(m.atraso15_90, 2)}%</td><td style="text-align:right">R$ ${fmt.n0(m.per_capita)}</td></tr>`).join("")}</tbody></table></div></details>
  </div>`;

  /* ---------- painel estadual (ou resumo Brasil) ---------- */
  let painel;
  if (pan.uf && byUF[pan.uf]) {
    const m = byUF[pan.uf], D = state.panoCache[pan.uf];
    const dchip = (v, inverse) => v == null ? "" : `<span class="deltachip ${v > 0 ? (inverse ? "down" : "up") : (v < 0 ? (inverse ? "up" : "down") : "")}">${fmt.pp(v)} ${String(v).includes("%") ? "" : "p.p. vs BR"}</span>`;
    painel = `<div class="card ufpanel"><h4 style="display:flex;justify-content:space-between;align-items:baseline">${m.nome} <span class="src">${m.regiao} · ${fmt.n(m.part_br, 1)}% do crédito nacional</span></h4>
      <div class="pan-kpi" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr));margin-top:8px">
        <div><div class="src">saldo</div><div class="big" style="font-size:20px">${fmt.money(m.saldo)}</div></div>
        <div><div class="src">cresc. 12m</div><div class="big" style="font-size:20px">${fmt.pp(m.cresc12)}%</div></div>
        <div><div class="src">inadimplência</div><div class="big" style="font-size:20px;color:var(--c-neg)">${fmt.n(m.inad, 1)}%</div>${dchip(m.inad != null && brInad != null ? +(m.inad - brInad).toFixed(2) : null)}</div>
        <div><div class="src">per capita</div><div class="big" style="font-size:20px">R$ ${fmt.n0(m.per_capita)}</div></div>
      </div>
      <div class="src" style="margin-top:8px">z-score da inadimplência: ${fmt.pp(m.z_inad)} · Δ 12m: ${fmt.pp(m.d_inad_12m)} p.p. · ranking de saldo: ${rankOf(m.uf) || "–"}º</div>
      ${D ? `
        ${lineChart({ series: [{ pts: D.serie_inad.map(o => ({ x: o.p, y: o.inad })), label: m.uf, color: "#b91c1c" }, { pts: P.serie_br.map(o => ({ x: o.p, y: o.inad })), label: "Brasil", color: "#64748b" }], h: 150, unit: "% inadimplência arrastada", aria: `inadimplência de ${m.nome} vs Brasil` })}
        <h5 style="margin:12px 0 4px">Maiores produtos (PF)</h5>
        ${D.produtos_pf.slice(0, 5).map(p => panBar(p.grupo, p.saldo, D.produtos_pf[0].saldo, v => fmt.money(v), p.inad != null ? `inad ${fmt.n(p.inad, 1)}%` : "")).join("")}
        <h5 style="margin:12px 0 4px">Faixas de renda (PF)</h5>
        ${D.renda_pf.filter(r => !["Indisponível"].includes(r.grupo)).slice(0, 5).map(p => panBar(p.grupo, p.saldo, Math.max(...D.renda_pf.map(x => x.saldo)), v => fmt.money(v), p.inad != null ? `inad ${fmt.n(p.inad, 1)}%` : "")).join("")}`
      : `<p class="src"><span class="spin" aria-hidden="true"></span> carregando o detalhe estadual…</p>`}
      <p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn small" onclick="panAddCmp('${m.uf}')">adicionar à comparação</button>
        <button class="btn ghost small" onclick="panSelUF('${m.uf}')">fechar</button></p>
    </div>`;
  } else {
    painel = `<div class="card ufpanel"><h4>Brasil — visão de referência</h4>
      ${lineChart({ series: [{ pts: P.serie_br.map(o => ({ x: o.p, y: o.inad })), label: "inadimplência", color: "#b91c1c" }, { pts: P.serie_br.map(o => ({ x: o.p, y: o.atraso15_90 })), label: "atraso 15–90d", color: "#b45309" }], h: 160, unit: "% da carteira", aria: "inadimplência e atraso do Brasil" })}
      ${lineChart({ series: [{ pts: P.serie_br.map(o => ({ x: o.p, y: o.saldo / 1e12 })), label: "carteira (R$ tri)", color: "#1d4e89" }], h: 130, unit: "R$ tri", dec: 2, aria: "carteira ativa do Brasil" })}
      <p class="src" style="margin-top:8px">Clique em uma UF no mapa para abrir o painel estadual — a página inteira passa a comparar a UF com o Brasil.</p></div>`;
  }

  /* ---------- área 3: comparação ---------- */
  const units = ["BR", ...pan.cmp];
  const cmpChips = `<div class="cmpchips">
    <span class="unit">Brasil <span class="src">(referência)</span></span>
    ${pan.cmp.map(u => `<span class="unit">${u}<button class="x" onclick="panRmCmp('${u}')" aria-label="remover ${u}">×</button></span>`).join("")}
    ${pan.cmp.length < 3 ? `<select onchange="panAddCmp(this.value); this.value=''" aria-label="adicionar UF à comparação"><option value="">adicionar UF…</option>${P.mapa.map(m => `<option value="${m.uf}">${m.uf} — ${m.nome}</option>`).join("")}</select>` : ""}
  </div>`;
  let cmpBody = "";
  if (pan.cmp.length) {
    const metros = [["saldo", v => fmt.money(v)], ["part_br", v => fmt.n(v, 1) + "%"], ["cresc12", v => fmt.pp(v) + "%"], ["inad", v => fmt.n(v, 1) + "%"], ["atraso15_90", v => fmt.n(v, 2) + "%"], ["ap", v => fmt.n(v, 1) + "%"], ["per_capita", v => "R$ " + fmt.n0(v)], ["saldo_medio_op", v => "R$ " + fmt.n0(v)]];
    const brRow = { saldo: k.saldo.v, part_br: 100, cresc12: k.saldo.cresc12, inad: brInad, atraso15_90: k.atraso15_90.v, ap: k.ap.v, per_capita: null, saldo_medio_op: k.saldo_medio_op.v };
    const pct = (uf, mkey) => {
      const arr = P.mapa.map(x => x[mkey]).filter(v => v != null).sort((a, b) => a - b);
      const v = byUF[uf][mkey]; if (v == null || !arr.length) return null;
      return Math.round(arr.filter(x => x <= v).length / arr.length * 100);
    };
    cmpBody = `<div class="tblwrap"><table class="data compact"><thead><tr><th>Indicador</th><th style="text-align:right">Brasil</th>${pan.cmp.map(u => `<th style="text-align:right">${u}</th>`).join("")}</tr></thead><tbody>
      ${metros.map(([mk, ff]) => `<tr><td>${PAN_METS[mk] ? PAN_METS[mk].l : mk}</td><td style="text-align:right"><b>${brRow[mk] != null ? ff(brRow[mk]) : "–"}</b></td>${pan.cmp.map(u => {
        const v = byUF[u][mk]; const ref = brRow[mk];
        const dif = v != null && ref != null && mk !== "saldo" && mk !== "part_br" && mk !== "per_capita" && mk !== "saldo_medio_op" ? ` <span class="src">(${fmt.pp(+(v - ref).toFixed(2))})</span>` : "";
        return `<td style="text-align:right">${v != null ? ff(v) : "n.d."}${dif}<div class="src">${pct(u, mk) != null ? "percentil " + pct(u, mk) : ""}</div></td>`;
      }).join("")}</tr>`).join("")}
    </tbody></table></div>
    ${lineChart({ series: [{ pts: P.serie_br.map(o => ({ x: o.p, y: o.inad })), label: "Brasil", color: "#64748b" }, ...pan.cmp.map((u, i) => state.panoCache[u] ? { pts: state.panoCache[u].serie_inad.map(o => ({ x: o.p, y: o.inad })), label: u, color: ["#1d4e89", "#b45309", "#6b46a3"][i] } : null).filter(Boolean)], h: 230, unit: "% inadimplência arrastada", aria: "comparação da inadimplência entre unidades" })}
    ${leitura([["Regras", "mesma data-base e mesmo conceito em todas as colunas; diferenças entre parênteses são vs. Brasil, em p.p."], ["Cuidado", "ranking e percentil não ponderam tamanho — RR e SP têm pesos muito diferentes; o saldo está sempre visível ao lado"]])}`;
  } else {
    cmpBody = `<p class="src">Adicione até 3 UFs para comparar diretamente com o Brasil — valores, diferenças em p.p., percentil no ranking e série histórica.</p>`;
  }
  const comparacao = sechead("Comparação direta", "Brasil como referência · até 4 unidades") + `<div class="card">${cmpChips}${cmpBody}</div>`;

  /* ---------- área 4: perfil da carteira ---------- */
  const lens = pan.lens, cli = pan.cli === "PJ" ? "PJ" : "PF";
  const conj = cli === "PF"
    ? { renda: P.perfis.renda_pf, ocup: P.perfis.ocupacao_pf, prod: P.perfis.produto_pf, rl: "Faixa de renda", ol: "Ocupação" }
    : { renda: P.perfis.porte_pj, ocup: P.perfis.setor_pj, prod: P.perfis.produto_pj, rl: "Porte", ol: "Setor (CNAE)" };
  const lensDef = {
    saldo: { t: "Onde está o saldo", get: x => x.saldo, f: v => fmt.money(v), extra: x => `${fmt.n(x.part, 1)}%` },
    taxa: { t: "Onde a inadimplência é maior", get: x => x.inad, f: v => fmt.n(v, 1) + "%", extra: x => x.atraso15_90 != null ? `15–90d ${fmt.n(x.atraso15_90, 2)}%` : "" },
    contrib: { t: "Quem contribui para o risco total", get: x => x.contrib_inad, f: v => fmt.n(v, 1) + "%", extra: x => `inad ${fmt.n(x.inad, 1)}%` },
    cresc: { t: "Onde o crédito cresce (12m)", get: x => x.cresc12, f: v => fmt.pp(v) + "%", extra: x => `3m ${fmt.pp(x.cresc3)}%`, div: true },
  };
  const L = lensDef[lens] || lensDef.saldo;
  const bloco = (titulo, linhas) => {
    const rows = linhas.filter(x => x.grupo !== "Indisponível" || lens === "saldo");
    const mx = Math.max(...rows.map(x => Math.abs(L.get(x) ?? 0)), 1e-9);
    const ordenadas = L.div ? [...rows].sort((a, b) => (L.get(b) ?? -99) - (L.get(a) ?? -99)) : (lens === "saldo" ? rows : [...rows].sort((a, b) => (L.get(b) ?? -1) - (L.get(a) ?? -1)));
    return `<div><h4>${titulo}</h4>${ordenadas.map(x => panBar(x.grupo, L.get(x), mx, L.f, L.extra(x), !!L.div)).join("")}</div>`;
  };
  const perfil = sechead("Quem concentra o crédito — e quem concentra o risco", `nacional · data-base ${P.data_base}`) + `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:8px 0 12px">
      <span class="seg">${[["PF", "Pessoa física"], ["PJ", "Pessoa jurídica"]].map(([v, l]) => `<button class="${cli === v ? "on" : ""}" onclick="panSet('cli','${v}')">${l}</button>`).join("")}</span>
      <span class="seg">${[["saldo", "Saldo"], ["taxa", "Inadimplência"], ["contrib", "Contribuição p/ risco"], ["cresc", "Crescimento"]].map(([v, l]) => `<button class="${lens === v ? "on" : ""}" onclick="panSet('lens','${v}')">${l}</button>`).join("")}</span>
      <span class="src">${L.t}</span>
    </div>
    <div class="card"><div class="ov-3col">
      ${bloco(conj.rl, conj.renda)}
      ${bloco(conj.ol, conj.ocup)}
      ${bloco("Produto", conj.prod)}
    </div>
    ${leitura([["Como ler", "volume ≠ taxa ≠ contribuição: as faixas de menor renda têm POUCO saldo e MUITA inadimplência; a contribuição para o risco pondera as duas coisas"], ["†", "n.d. = taxa suprimida (carteira do grupo abaixo do limite de divulgação) ou dado indisponível — nunca é zero"], ["Associação ≠ causalidade", "diferenças demográficas refletem composição de produtos, garantias e acesso — não causam inadimplência por si"]])}</div>
    ${cli === "PF" ? `<div class="card" style="margin-top:14px"><h4>Matriz produto × faixa de renda (PF) — inadimplência</h4>${panMatriz(P)}</div>` : ""}`;

  /* ---------- área 6: o que mudou ---------- */
  const alertas = sechead("O que mudou?", "regras: alta em 2 datas-base consecutivas + Δ3m ≥ 0,30 p.p. ou Δ12m ≥ 0,75 p.p.") + `
    <div class="alertgrid">
      ${P.alertas.slice(0, 9).map(a => `<div class="alertcard"><h5>${a.grupo}</h5>
        <div class="num" style="color:var(--c-neg)">${fmt.n(a.atual, 1)}% <span class="src" style="font-size:12px">era ${fmt.n(a.anterior, 1)}% · ${fmt.pp(a.delta_pp)} p.p.</span></div>
        <div class="src">${a.indicador} · ${a.periodo}${a.vs_brasil != null ? ` · ${fmt.pp(a.vs_brasil)} p.p. vs BR` : ""}</div>
        <div class="src" style="margin-top:4px">${a.regra}</div>
        ${a.nota ? `<div class="src" style="margin-top:4px" title="${attr(a.nota)}"><i>${a.nota}</i></div>` : ""}
        ${a.link && a.link.uf ? `<a href="javascript:void(0)" onclick="panSelUF('${a.link.uf}');window.scrollTo({top:0,behavior:'smooth'})" style="font-size:11.5px">investigar no mapa →</a>` : ""}</div>`).join("")}
      ${P.melhoras.map(m => `<div class="alertcard melhora"><h5>${m.nome} (${m.uf})</h5>
        <div class="num" style="color:var(--c-pos)">${fmt.pp(m.d_inad_12m)} p.p. <span class="src" style="font-size:12px">em 12m</span></div>
        <div class="src">menor deterioração da inadimplência entre as UFs · nível atual ${fmt.n(m.inad, 1)}%</div></div>`).join("")}
    </div>`;

  /* ---------- área 5: explorador ---------- */
  const exp = panExplorer(P);

  const metodo = `<div class="card" style="margin-top:22px"><h4>Conceitos e limites desta página</h4>
    <div class="src" style="line-height:1.8;max-width:1100px">${Object.entries(P.conceitos).map(([kk, v]) => `<b>${kk}</b>: ${v}`).join("<br>")}
    <br><b>indisponível no SCR público</b>: sexo, faixa etária, município, nº de clientes, baixas, concessões (fluxo) — não estimamos nem simulamos essas dimensões. Auditoria completa: docs/AUDITORIA_SCR.md.</div></div>`;

  el.innerHTML = head + sintese + kpis +
    sechead("Mapa do crédito", `colorido por ${M.l.toLowerCase()} · ${M.desc}`) +
    `<div class="pan-2col"><div>${mapa}</div>${painel}</div>` +
    comparacao + perfil + alertas + exp + metodo;
}

function panMatriz(P) {
  const rendas = Object.keys(P.matriz_renda_produto).filter(r => r !== "Indisponível" && r !== "Sem rendimento");
  const ordem = ["Até 1 salário mínimo", "Mais de 1 a 2 salários mínimos", "Mais de 2 a 3 salários mínimos", "Mais de 3 a 5 salários mínimos", "Mais de 5 a 10 salários mínimos", "Mais de 10 a 20 salários mínimos", "Acima de 20 salários mínimos"];
  rendas.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
  const prods = [...new Set(rendas.flatMap(r => Object.keys(P.matriz_renda_produto[r])))]
    .map(p => [p, rendas.reduce((s, r) => s + ((P.matriz_renda_produto[r][p] || {}).saldo || 0), 0)])
    .sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]);
  const allInad = rendas.flatMap(r => prods.map(p => (P.matriz_renda_produto[r][p] || {}).inad)).filter(v => v != null);
  const mx = Math.max(...allInad);
  let h = `<div class="heatwrap"><div class="heatgrid" style="grid-template-columns:minmax(150px,210px) repeat(${prods.length},minmax(30px,1fr))">`;
  h += `<div class="hcell hhead hlab"></div>` + prods.map(p => `<div class="hcell hhead" style="height:auto;line-height:1.2;padding:2px 2px 6px;white-space:normal;font-size:9.5px">${p.replace("Cartão — ", "Cartão ")}</div>`).join("");
  rendas.forEach(r => {
    h += `<div class="hcell hlab" title="${attr(r)}">${r.replace(" salários mínimos", " SM").replace(" salário mínimo", " SM")}</div>`;
    h += prods.map(p => {
      const c = P.matriz_renda_produto[r][p];
      if (!c || c.inad == null) return `<div class="hcell hnull" title="taxa suprimida ou sem carteira — não é zero"></div>`;
      const t = Math.min(c.inad / mx, 1);
      const tip = encodeURIComponent(`<div class="tt-date">${p} × ${r}</div><div class="tt-row"><span class="tt-lbl">inadimplência</span><span class="tt-val">${fmt.n(c.inad, 1)}%</span></div><div class="tt-row"><span class="tt-lbl">saldo</span><span class="tt-val">${fmt.money(c.saldo)}</span></div>`);
      return `<div class="hcell hval" data-tip="${tip}" style="background:color-mix(in srgb, var(--c-neg) ${Math.round(t * 85)}%, var(--surface))"></div>`;
    }).join("");
  });
  h += `</div></div><div class="heatleg"><span class="lg" style="background:var(--surface)"></span> baixa <span class="lg" style="background:color-mix(in srgb, var(--c-neg) 85%, var(--surface))"></span> alta (${fmt.n(mx, 1)}%) · <span class="lg hnull"></span> suprimida/ausente (≠ zero) · células = taxa de inadimplência arrastada</div>`;
  return h;
}

const PAN_FATOS = {
  uf_produto: { l: "UF × produto", dims: ["uf", "cliente", "produto"] },
  uf_renda: { l: "UF × renda/porte", dims: ["uf", "cliente", "faixa"] },
  uf_ocupacao: { l: "UF × ocupação/setor", dims: ["uf", "cliente", "grupo"] },
  renda_produto: { l: "Renda × produto (nacional)", dims: ["cliente", "faixa", "produto"] },
  ocup_produto: { l: "Ocupação × produto (nacional)", dims: ["cliente", "grupo", "produto"] },
};
function panExplorer(P) {
  const E = state.data.explorer;
  let body;
  if (E === undefined) {
    body = `<p class="src">O explorador carrega os fatos agregados do SCR.data (~2 MB) sob demanda e permite cruzar UF, produto, renda/porte e ocupação/setor com qualquer métrica — preservando as regras de supressão.</p>
      <button class="btn" onclick="panLoadExplorer()">abrir o explorador</button>`;
  } else if (E === null) {
    body = `<p class="src"><span class="spin" aria-hidden="true"></span> carregando fatos…</p>`;
  } else if (E.erro) {
    body = `<p class="src">falha ao carregar explorer.json — tente novamente.</p>`;
  } else {
    const ex = state.pan.exp || (state.pan.exp = { fato: "uf_produto", grupo: null, filtros: {}, met: "saldo" });
    const fato = PAN_FATOS[ex.fato] ? ex.fato : "uf_produto";
    const dims = PAN_FATOS[fato].dims;
    const grupo = dims.includes(ex.grupo) ? ex.grupo : dims[dims.length - 1];
    const rows = E.fatos[fato] || [];
    const d0 = E.data_base, [_, d3, d12] = E.datas_incluidas;
    const valoresDim = dim => [...new Set(rows.map(r => r[dim]))].sort();
    const filtroSel = dim => dim === grupo ? "" : `<label class="src">${dim}: <select onchange="panExpFiltro('${dim}', this.value)">${["(todas)", ...valoresDim(dim)].map(v => `<option ${ex.filtros[dim] === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
    const passa = r => dims.every(dim => dim === grupo || !ex.filtros[dim] || ex.filtros[dim] === "(todas)" || r[dim] === ex.filtros[dim]);
    const agg = {};
    for (const r of rows.filter(passa)) {
      const a = agg[r[grupo]] = agg[r[grupo]] || {};
      const t = a[r.d] = a[r.d] || { saldo: 0, n_op: 0, n_op_supr: 0, saldo_opv: 0, v1590: 0, v90: 0, inad: 0, ap: 0 };
      for (const c of ["saldo", "n_op", "n_op_supr", "saldo_opv", "v1590", "v90", "inad", "ap"]) t[c] += r[c] || 0;
    }
    const MIN = 50e6;
    const taxa = (n, d) => d >= MIN ? +(n / d * 100).toFixed(2) : null;
    const METS_EXP = {
      saldo: ["Saldo", t => t.saldo, v => fmt.money(v)],
      n_op: ["Nº de operações (piso†)", t => t.n_op || null, v => fmt.n0(v)],
      saldo_medio_op: ["Saldo médio/op.", t => t.n_op ? Math.round(t.saldo_opv / t.n_op) : null, v => "R$ " + fmt.n0(v)],
      inad: ["Inadimplência", t => taxa(t.inad, t.saldo), v => fmt.n(v, 2) + "%"],
      atraso15_90: ["Atraso 15–90d", t => taxa(t.v1590, t.saldo), v => fmt.n(v, 2) + "%"],
      ap: ["Ativo problemático", t => taxa(t.ap, t.saldo), v => fmt.n(v, 2) + "%"],
      saldo_inad: ["Saldo inadimplente", t => t.inad, v => fmt.money(v)],
      cresc3: ["Crescimento 3m", null, v => fmt.pp(v) + "%"],
      cresc12: ["Crescimento 12m", null, v => fmt.pp(v) + "%"],
    };
    const mkey = METS_EXP[ex.met] ? ex.met : "saldo";
    const linhas = Object.entries(agg).map(([g, t]) => {
      let v;
      if (mkey === "cresc3" || mkey === "cresc12") {
        const ref = t[mkey === "cresc3" ? d3 : d12];
        v = t[d0] && ref && ref.saldo ? +((t[d0].saldo / ref.saldo - 1) * 100).toFixed(2) : null;
      } else v = t[d0] ? METS_EXP[mkey][1](t[d0]) : null;
      return { g, v, saldo: t[d0] ? t[d0].saldo : 0 };
    }).filter(x => x.saldo > 0).sort((a, b) => (b.v ?? -1e18) - (a.v ?? -1e18));
    const mx = Math.max(...linhas.map(x => Math.abs(x.v ?? 0)), 1e-9);
    window.panExpCSV = () => dlFile("panorama_explorador.csv", "﻿grupo;" + mkey + ";saldo\n" + linhas.map(x => [x.g, x.v ?? "", x.saldo].join(";")).join("\n"), "text/csv;charset=utf-8");
    body = `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <label class="src">fato: <select onchange="panExpSet('fato', this.value)">${Object.entries(PAN_FATOS).map(([kk, f]) => `<option value="${kk}" ${kk === fato ? "selected" : ""}>${f.l}</option>`).join("")}</select></label>
      <label class="src">agrupar por: <select onchange="panExpSet('grupo', this.value)">${dims.map(dd => `<option ${dd === grupo ? "selected" : ""}>${dd}</option>`).join("")}</select></label>
      <label class="src">métrica: <select onchange="panExpSet('met', this.value)">${Object.entries(METS_EXP).map(([kk, mm]) => `<option value="${kk}" ${kk === mkey ? "selected" : ""}>${mm[0]}</option>`).join("")}</select></label>
      ${dims.map(filtroSel).join(" ")}
      <button class="btn ghost small" onclick="panExpCSV()">exportar CSV</button></div>
      ${linhas.length ? linhas.slice(0, 30).map(x => panBar(x.g, x.v, mx, METS_EXP[mkey][2], mkey.startsWith("cresc") || mkey === "inad" || mkey === "ap" || mkey === "atraso15_90" ? `saldo ${fmt.money(x.saldo)}` : "", mkey.startsWith("cresc"))).join("") : `<p class="src"><b>Este cruzamento não está disponível na fonte pública selecionada.</b></p>`}
      ${linhas.length > 30 ? `<p class="src">mostrando 30 de ${linhas.length} grupos — exporte o CSV para a lista completa.</p>` : ""}
      ${leitura([["Sem dupla contagem", "cada fato é agregado das linhas-base de um único mês; fatos nunca são somados entre si"], ["†", "nº de operações é PISO: células suprimidas pela fonte ficam de fora; taxas suprimidas quando a carteira do grupo < R$ 50 mi"], ["Datas", `nível em ${d0}; crescimento vs ${d3} (3m) e ${d12} (12m)`]])}`;
  }
  return sechead("Explorador multidimensional", "cruze geografia, produto, renda e ocupação — só combinações reais da fonte") + `<div class="card">${body}</div>`;
}
window.panCSV = () => {
  const P = state.data.panorama; if (!P || !P.disponivel) return;
  const cols = ["uf", "nome", "regiao", "saldo", "part_br", "per_capita", "saldo_medio_op", "cresc3", "cresc12", "inad", "atraso15_90", "ap", "d_inad_3m", "d_inad_12m", "z_inad", "prod_dominante", "renda_dominante"];
  dlFile("panorama_ufs.csv", "﻿" + cols.join(";") + "\n" + P.mapa.map(m => cols.map(c => m[c] ?? "").join(";")).join("\n"), "text/csv;charset=utf-8");
};

/* ================= MERCADO & VALOR (piloto: Itaú, BTG, ABC Brasil) ================= */
const MKT_BASE_COLORS = ["#1d4e89", "#0e7c7b", "#b45309", "#6b46a3", "#b91c1c", "#2f7d4f", "#64748b", "#c2540a", "#d9a514", "#17879c"];
let MKT_COLORS = {};
function mktColors(tks) {
  MKT_COLORS = {};
  tks.forEach((tk, i) => MKT_COLORS[tk] = MKT_BASE_COLORS[i % MKT_BASE_COLORS.length]);
}
window.mktSet = (k, v) => { state.mkt[k] = v; syncHash(); renderMarket(); };

function entenda(id, itens) {
  return `<details class="charttable"><summary>Entenda este gráfico</summary>
    <div class="note" style="margin:8px 0">${itens.map(([t, x]) => `<p style="margin:5px 0"><b>${t}:</b> ${x}</p>`).join("")}</div></details>`;
}
function leitura(itens) {
  return `<div class="src" style="margin-top:8px;line-height:1.8">${itens.filter(Boolean).map(([t, x]) => `<b>${t}:</b> ${x}`).join(" · ")}</div>`;
}
function metricCard(id, titulo, simples, tecnica, formula, fonte, cuidado) {
  const tip = encodeURIComponent(`<div class="tt-date">${titulo}</div><div class="tt-meta">${simples}<br><b>Fórmula:</b> ${formula}<br><b>Fonte:</b> ${fonte}<br><b>Cuidado:</b> ${cuidado}</div>`);
  return `data-tip="${tip}"`;
}

function renderMarket() {
  const el = document.getElementById("view-market");
  const M = state.data.market;
  if (!M || !M.series) { el.innerHTML = loadingCard("dados de mercado"); return; }
  const mkt = state.mkt;
  const tks = Object.keys(M.series).filter(t => t !== "ITUB3").sort((a, b) => ((M.valuation.find(v => v.ticker === b) || {}).mcap || 0) - ((M.valuation.find(v => v.ticker === a) || {}).mcap || 0));
  mktColors(tks);
  const emp = Object.fromEntries(M.empresas.map(e => [e.company_id, e]));
  const val = Object.fromEntries(M.valuation.map(v => [v.ticker, v]));
  const tabs = [["acoes", "Ações"], ["proventos", "Dividendos & JCP"], ["valuation", "Valuation"], ["resultados", "Resultados"], ["capital", "Capital"], ["screener", "Screener"], ["entidades", "Entidades & Metodologia"]];

  const head = pageHead({
    title: `Mercado & Valor <span class='chip' style='vertical-align:middle'>${(state.data.market.empresas || []).length} listadas na B3</span>`,
    desc: "Como o mercado precifica as instituições e como preço, proventos, lucro e capital se conectam — plataforma acadêmica que ensina a interpretar, não recomenda.",
    fontes: "B3 (COTAHIST, proventos, ações em circulação), CVM (DFP/ITR)",
  });
  const aviso = `<div class="note warn"><b>${M.aviso}</b></div>`;
  const filtravel = ["proventos", "resultados", "capital"].includes(mkt.tab);
  const empSel = `<label>instituição <select onchange="mktSet('emp', this.value)" aria-label="filtrar instituição">
      <option value="todas" ${mkt.emp === "todas" ? "selected" : ""}>todas (${M.empresas.length})</option>
      ${M.empresas.slice().sort((a, b) => a.legal_name.localeCompare(b.legal_name)).map(e => `<option value="${e.company_id}" ${mkt.emp === e.company_id ? "selected" : ""}>${e.legal_name.replace(/ S\.A\..*/i, "")} (${e.main_ticker})</option>`).join("")}
    </select></label>`;
  const nav2 = `<div class="controls"><span class="seg">${tabs.map(([k, l]) => `<button class="${mkt.tab === k ? "active" : ""}" onclick="mktSet('tab','${k}')">${l}</button>`).join("")}</span>${filtravel ? empSel : ""}${filtravel && mkt.emp !== "todas" ? `<button class="btn ghost small" onclick="mktSet('emp','todas')">limpar filtro</button>` : ""}</div>`;

  let body = "";
  if (mkt.tab === "acoes") body = mktAcoes(M, mkt, tks, val);
  else if (mkt.tab === "proventos") body = mktProventos(M, emp, val);
  else if (mkt.tab === "valuation") body = mktValuation(M, val, emp);
  else if (mkt.tab === "resultados") body = mktResultados(M, emp);
  else if (mkt.tab === "capital") body = mktCapital(M, emp);
  else if (mkt.tab === "screener") body = mktScreener(M);
  else body = mktEntidades(M);

  el.innerHTML = head + aviso + nav2 + body;
}

// nomes curtos verificados contra o cadastro do market.json (identificação humana)
const MKT_NOME_CURTO = {
  ITUB4: "Itaú Unibanco", BBAS3: "Banco do Brasil", BBDC4: "Bradesco", SANB11: "Santander",
  BPAC11: "BTG Pactual", ABCB4: "ABC Brasil", BRSR6: "Banrisul", BMGB4: "BMG", PINE4: "Pine",
  BAZA3: "Banco da Amazônia", BNBR3: "Banco do Nordeste", BEES3: "Banestes", BMEB4: "Mercantil do Brasil",
  BSLI4: "BRB", BGIP4: "Banese", BRBI11: "BR Partners", RPAD5: "Alfa Holdings", BMIN4: "Mercantil Invest.",
};
function mktNomeCurto(M, tk) {
  if (MKT_NOME_CURTO[tk]) return MKT_NOME_CURTO[tk];
  const emp = (M.empresas || []).find(e => e.main_ticker === tk || (e.tickers || []).some(t => (t.ticker || t) === tk));
  let nome = emp ? (emp.nome_curto || emp.legal_name || "") : "";
  nome = nome.replace(/\b(S\.?A\.?|Holding[s]?|Participa[çc][õo]es)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  const palavras = nome.split(" ").filter(Boolean);
  let corte = Math.min(3, palavras.length);
  while (corte > 1 && /^(do|da|de|dos|das|e)$/i.test(palavras[corte - 1])) corte--;
  const out2 = palavras.slice(0, corte).join(" ");
  return out2 || tk;
}

function mktAcoes(M, mkt, tks, val) {
  const modos = [["total", "retorno total (base 100)"], ["preco", "preço (base 100)"], ["drawdown", "drawdown"], ["vol", "volatilidade 21d"]];
  const campo = { total: "total100", preco: "base100", drawdown: "drawdown", vol: "vol21" }[mkt.modo];
  const tksChart = tks.slice(0, 8);
  const nomeDe = {};
  tks.forEach(tk => nomeDe[tk] = mktNomeCurto(M, tk));
  const series = tksChart.map(tk => {
    const sd = M.series[tk];
    return { pts: sd.dates.map((d, i) => ({ x: d, y: sd[campo][i] })).filter(p => p.y != null),
      color: MKT_COLORS[tk], label: `${nomeDe[tk]} (${tk})`, short: nomeDe[tk], w: 2 };
  });
  if (mkt.modo === "total" && M.cesta) {
    series.push({ pts: M.cesta.dates.map((d, i) => ({ x: d, y: M.cesta.total100[i] })), color: "#64748b", label: "cesta igual-ponderada", short: "cesta", dash: "4,4", w: 1.4 });
  }
  // legenda com NOME + sigla, na cor de cada série (mesma cor em toda a página)
  const legenda = `<div class="legend" style="margin:6px 0 2px">${tksChart.map(tk =>
    `<span><span class="sw" style="background:${ccol(MKT_COLORS[tk])}"></span>${nomeDe[tk]} <span class="src" style="display:inline">(${tk})</span></span>`).join("")}${mkt.modo === "total" && M.cesta ? '<span><span class="sw" style="background:#64748b;opacity:.7"></span>cesta igual-ponderada</span>' : ""}</div>`;
  // anotações: maiores proventos (ex) do ticker líder de eventos — com o NOME da companhia
  const annotations = [];
  tksChart.slice(0, 3).forEach(tk => {
    const evs = (M.eventos[tk] || []).slice().sort((a, b) => (b.div + b.jcp) - (a.div + a.jcp)).slice(0, 2);
    evs.forEach(e => annotations.push({ x: e.ex_ref, label: `${nomeDe[tk]} ex ${e.div > e.jcp ? "DIV" : "JCP"}`, color: MKT_COLORS[tk] }));
  });
  const jan = M.janelas;
  const jrow = tk => {
    const t = jan[tk], v = val[tk];
    const cell = x => x != null ? `<td style="text-align:right" class="${x >= 0 ? "down good" : "up"}">${fmt.pp(x)}%</td>` : "<td style='text-align:right'>–</td>";
    return `<tr><td><b style="color:${ccol(MKT_COLORS[tk])}">${nomeDe[tk]}</b> <span class="src">${tk} · R$ ${fmt.n(v.preco, 2)}</span></td>
      ${cell(t.total.m1)}${cell(t.total.m3)}${cell(t.total.ytd)}${cell(t.total.a12)}${cell(t.total.a36)}
      <td style="text-align:right">${fmt.pp(t.total.a12 - t.preco.a12)} p.p.</td>
      <td style="text-align:right" class="up">${fmt.n(t.drawdown.atual, 1)}%</td>
      <td style="text-align:right">${fmt.n(t.drawdown.maximo, 1)}% <span class="src">(${fmt.my(t.drawdown.data_maximo)})</span></td>
      <td style="text-align:right">${t.drawdown.vol21_atual != null ? fmt.n(t.drawdown.vol21_atual, 0) + "%" : "–"}</td></tr>`;
  };
  const contribuicaoProv = tks.map(tk => `${tk}: ${fmt.pp(jan[tk].total.a12 - jan[tk].preco.a12)} p.p.`).join(" · ");
  return `
  ${sechead("Retorno comparado — os três perfis do piloto", "preço não ajustado; proventos reinvestidos no retorno total")}
  <div class="card">
    <h4>${mkt.modo === "total" ? "Com proventos reinvestidos, as trajetórias divergem menos do que o preço sugere" : mkt.modo === "drawdown" ? "Quanto cada ação caiu em relação ao próprio pico" : mkt.modo === "vol" ? "Oscilação de curto prazo (não mede o risco econômico do banco)" : "Preço em base 100 — sem o efeito dos proventos"} ${badge("observado")} ${badge("calculado", M.metodologia.retorno_total)}</h4>
    <div class="src" style="margin-bottom:6px">${mkt.modo === "total" ? "A base 100 coloca todas as ações no mesmo ponto inicial: 125 = valorização acumulada de 25% no período. O retorno TOTAL reinveste dividendos e JCP (bruto de IR) — é a medida correta para comparar ações que distribuem proventos em ritmos diferentes." : mkt.modo === "drawdown" ? "O drawdown mede a queda em relação ao maior valor anterior: -30% significa preço 30% abaixo do pico até aquele momento. Volatilidade mede oscilação; drawdown mede perda do pico — nenhum dos dois, sozinho, mede o risco econômico da instituição." : mkt.modo === "vol" ? "Desvio-padrão dos retornos diários em janela de 21 pregões, anualizado." : "A base 100 facilita comparar ações com preços nominais diferentes. Sem proventos, subestima o retorno de quem distribui mais."}</div>
    <div class="controls"><span class="seg">${modos.map(([k, l]) => `<button class="${mkt.modo === k ? "active" : ""}" onclick="mktSet('modo','${k}')">${l}</button>`).join("")}</span></div>
    <div class="src" style="margin-bottom:4px">gráfico: 8 maiores por valor de mercado (as ${tks.length} companhias estão na tabela abaixo)</div>
    ${legenda}
    ${lineChart({ series, h: 320, endLabels: true, annotations: mkt.modo === "total" ? annotations.slice(0, 4) : [], unit: mkt.modo === "vol" ? "% a.a." : mkt.modo === "drawdown" ? "%" : "base 100", fonte: "B3 COTAHIST + proventos", status: "observado/calculado", dec: 1 })}
    ${chartFooter({ fonte: M.fontes.precos, periodo: `${fmt.my(M.series[tks[0]].dates[0])}–${fmt.my(M.series[tks[0]].dates.slice(-1)[0])} (diário)`, atualizado: M.gerado_em.slice(0, 10), unidade: "base 100 / %", nota: M.cesta ? M.cesta.nota : "" })}
    ${entenda("acoes", [["Pergunta respondida", "como se comparam os retornos dos três perfis, com e sem proventos?"],
      ["Eixos", "tempo × índice base 100 (ou % para drawdown/vol)"],
      ["Cores", "cada companhia mantém a mesma cor em toda a página; a legenda acima do gráfico traz nome e sigla, e cada linha termina com o nome da companhia"],
      ["Limitações", "retorno total bruto de IR (JCP é tributável); sem excesso vs. Ibovespa (série pública oficial descontinuada em 2019); retorno passado não indica retorno futuro"]])}
  </div>
  ${sechead("Janelas de retorno total e risco de trajetória")}
  <div class="card">
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Companhia</th><th style="text-align:right">1m</th><th style="text-align:right">3m</th><th style="text-align:right">YTD</th><th style="text-align:right">12m</th><th style="text-align:right">3a</th><th style="text-align:right" title="diferença entre retorno total e retorno de preço em 12m = contribuição dos proventos">proventos 12m</th><th style="text-align:right">DD atual</th><th style="text-align:right">DD máx.</th><th style="text-align:right">vol 21d</th></tr></thead>
    <tbody>${tks.map(jrow).join("")}</tbody></table></div>
    ${leitura([["Como interpretar", "retornos são TOTAIS (com proventos); a coluna 'proventos 12m' mostra quanto os proventos adicionaram ao retorno de preço"],
      ["O que mudou", `contribuição dos proventos em 12m — ${contribuicaoProv}`],
      ["Cuidado", "janelas curtas são dominadas por ruído; drawdown e volatilidade medem trajetória do preço, não solvência"]])}
  </div>`;
}

function mktProventos(M, emp, val) {
  const empresasSel = state.mkt.emp === "todas" ? M.empresas : M.empresas.filter(e => e.company_id === state.mkt.emp);
  const anos = [...new Set(empresasSel.flatMap(e => Object.keys(e.proventos_por_ano)))].sort().slice(-6);
  const bars = empresasSel.map(e => {
    const tk = { itau: "ITUB4", btg: "BPAC11", abc: "ABCB4" }[e.company_id];
    const maxv = Math.max(...anos.map(a => { const p = e.proventos_por_ano[a] || {}; return (p.DIV || 0) + (p.JCP || 0); }), 0.01);
    return `<div class="card"><h4>${e.legal_name.split(" S.A.")[0]} — proventos por ação (${tk}) ${badge("observado")}</h4>
      ${anos.map(a => { const p = e.proventos_por_ano[a] || {}; const d = p.DIV || 0, j = p.JCP || 0;
        const tip = encodeURIComponent(`<div class="tt-date">${a}</div><div class="tt-row"><span class="tt-lbl">Dividendos</span><span class="tt-val">R$ ${fmt.n(d, 4)}</span></div><div class="tt-row"><span class="tt-lbl">JCP (bruto)</span><span class="tt-val">R$ ${fmt.n(j, 4)}</span></div>`);
        return `<div class="atrasorow" data-tip="${tip}" style="cursor:default"><span class="aname">${a}</span>
        <span class="abarwrap"><span class="abar" style="width:${(d + j) / maxv * 100}%;background:linear-gradient(90deg, var(--c-line1) ${d / (d + j || 1) * 100}%, var(--c-line2) ${d / (d + j || 1) * 100}%)"></span></span>
        <span class="anum">R$ ${fmt.n(d + j, 2)}</span></div>`; }).join("")}
      <div class="legend"><span><span class="sw" style="background:var(--c-line1);height:8px"></span>dividendos (isentos)</span><span><span class="sw" style="background:var(--c-line2);height:8px"></span>JCP (brutos de IR)</span></div>
    </div>`;
  }).join("");
  const vrow = v => {
    const g = v.g_sustentavel;
    return `<tr><td><b>${v.ticker}</b></td>
    <td style="text-align:right" ${metricCard("dy", "Dividend yield 12m", "Proventos por ação dos últimos 12 meses divididos pelo preço atual.", "Σ proventos ex 12m ÷ preço", "Σ proventos ÷ preço", "B3", "Yield alto pode vir de provento maior OU de preço caindo — nunca interpretar isoladamente.")}><b>${v.yield_12m != null ? fmt.n(v.yield_12m, 2) + "%" : "–"}</b></td>
    <td style="text-align:right" ${metricCard("payout", "Payout", "Parcela do lucro distribuída aos acionistas no exercício.", "(dividendos + JCP com ex no exercício) ÷ lucro dos controladores", "dist ÷ lucro", "B3 + CVM", "Payout acima de 100% consome capital — sustentável só episodicamente.")}>${v.payout != null ? fmt.n(v.payout, 1) + "%" : "–"}</td>
    <td style="text-align:right">${v.retencao != null ? fmt.n(v.retencao, 1) + "%" : "–"}</td>
    <td style="text-align:right" ${metricCard("g", "Crescimento sustentável", "Quanto o banco consegue crescer financiado só pelo lucro retido.", "g = ROE × retenção", "g = ROE × (1 − payout)", "calculado", "Aproximação sob hipóteses fortes (ROE e payout constantes); g negativo = payout acima de 100%.")}>${g != null ? fmt.pp(g) + "%" : "–"}</td>
    <td class="src">${v.payout != null && v.payout > 100 ? "payout > 100%: distribuição extraordinária — parte financiada por capital, não pelo lucro do exercício" : v.payout != null ? "distribuição coberta pelo lucro do exercício" : "payout indisponível"}</td></tr>`;
  };
  return `
  ${sechead("Proventos por ação — dividendos e JCP separados", "aumento pode vir de mais lucro, mais payout ou distribuição extraordinária")}
  <div class="ov-3col">${bars}</div>
  ${sechead("Indicadores associados à capacidade histórica de distribuição", "não é previsão de dividendos")}
  <div class="card">
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Companhia</th><th style="text-align:right">Yield 12m</th><th style="text-align:right">Payout ${M.valuation[0] ? M.valuation[0].exercicio_ref || "" : ""}</th><th style="text-align:right">Retenção</th><th style="text-align:right">g sustentável</th><th>Leitura</th></tr></thead>
    <tbody>${(state.mkt.emp === "todas" ? M.valuation : M.valuation.filter(v => v.company_id === state.mkt.emp)).map(vrow).join("")}</tbody></table></div>
    ${leitura([["Como interpretar", "payout = proventos do exercício ÷ lucro dos controladores; retenção financia crescimento (g = ROE × retenção)"],
      ["Cuidado", "JCP é bruto de IR; payout calculado pela data ex dentro do exercício (aproximação declarada); capacidade histórica ≠ promessa futura"]])}
    ${entenda("prov", [["Pergunta", "a distribuição é coberta pelo lucro e o que sobra para crescer?"],
      ["Exemplo de leitura correta", "payout de 34% com ROE de 22% permite crescer ~14% a.a. sem capital novo"],
      ["Exemplo de leitura INCORRETA", "'yield de 11% é sempre melhor que 2%' — o yield alto pode refletir queda de preço ou distribuição não recorrente"]])}
  </div>`;
}

function mktValuation(M, val, emp) {
  const pts = M.valuation.filter(v => v.roe_cia != null && v.pvp != null).map(v => ({
    x: v.roe_cia, y: v.pvp, size: v.mcap, label: v.ticker, grp: v.ticker, color: MKT_COLORS[v.ticker] }));
  const vrow = v => `<tr>
    <td><b>${v.ticker}</b><div class="src">${emp[v.company_id].legal_name}</div></td>
    <td style="text-align:right">R$ ${fmt.n(v.preco, 2)}</td>
    <td style="text-align:right">${v.mcap ? "R$ " + fmt.n(v.mcap / 1e9, 1) + " bi" : "–"}</td>
    <td style="text-align:right" ${metricCard("pl", "P/L", "Quanto o mercado paga por cada R$ 1 de lucro anual.", "valor de mercado ÷ lucro dos controladores (exercício " + (v.exercicio_ref || "") + ")", "mcap ÷ lucro", "B3 + CVM", "Lucro do último exercício — não incorpora expectativas; comparar com a própria história e com pares de perfil semelhante.")}><b>${v.pl_ratio ? fmt.n(v.pl_ratio, 1) + "×" : "–"}</b></td>
    <td style="text-align:right" ${metricCard("pvp", "P/VP", "Quanto o mercado paga por cada R$ 1 de patrimônio contábil.", "valor de mercado ÷ patrimônio líquido (" + (v.pl_base || "") + ")", "mcap ÷ PL", "B3 + CVM", "P/VP baixo não significa barato: pode refletir risco percebido ou ROE fraco.")}><b>${v.pvp ? fmt.n(v.pvp, 2) + "×" : "–"}</b></td>
    <td style="text-align:right" ${metricCard("ey", "Earnings yield", "Inverso do P/L: lucro anual em relação ao preço.", "lucro ÷ valor de mercado", "1 ÷ P/L", "calculado", "Não é retorno esperado do acionista.")}>${v.pl_ratio ? fmt.n(100 / v.pl_ratio, 1) + "%" : "–"}</td>
    <td style="text-align:right" ${metricCard("roe", "ROE da companhia", "Lucro para cada R$ 100 de patrimônio dos acionistas.", "lucro controladores ÷ PL médio", "lucro ÷ PL médio", "CVM " + (v.stmt || ""), "ROE alto pode vir de eficiência OU de alavancagem/risco — analisar com Basileia, inadimplência e P/VP.")}>${v.roe_cia ? fmt.n(v.roe_cia, 1) + "%" : "–"}</td>
    <td style="text-align:right">${v.yield_12m ? fmt.n(v.yield_12m, 2) + "%" : "–"}</td></tr>`;
  const q = [];
  M.valuation.forEach(v => {
    if (v.roe_cia == null || v.pvp == null) return;
    const roeMed = 18, pvpMed = 1.5; // referências didáticas do piloto (n=3 — sem mediana robusta)
  });
  return `
  ${sechead("O mercado paga múltiplos maiores por bancos mais rentáveis?", `n = ${pts.length} listadas — linhas de referência nas medianas do universo; sem recomendação`)}
  <div class="ov-2col">
    <div class="card">
      <h4>P/VP × ROE ${badge("calculado")}</h4>
      <div class="src" style="margin-bottom:6px">Bancos com maior ROE tendem, em condições semelhantes, a negociar por P/VP mais altos — o mercado paga prêmio por retorno sobre o patrimônio percebido como sustentável. A posição no gráfico NÃO é recomendação.</div>
      ${(function(){
        if (pts.length < 3) return "<p class='src'>dados insuficientes</p>";
        const med = arr => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
        return scatterPlot(pts, "ROE da companhia (%)", "P/VP (×)", 560, 330,
          { sizeLabel: "valor de mercado", labels: pts.length <= 20,
            refX: med(pts.map(p => p.x)), refXLabel: "mediana ROE", refY: med(pts.map(p => p.y)), refYLabel: "mediana P/VP" });
      })()}
      <div class="src" style="margin-top:6px"><b>Quadrantes:</b> direita-acima = rentabilidade reconhecida (prêmio) · direita-abaixo = possível desconto, risco percebido ou dúvida sobre sustentabilidade · esquerda-abaixo = rentabilidade fraca reconhecida · esquerda-acima = expectativa de recuperação ou fatores não capturados. Referências: P/VP 1× (paridade contábil) e ROE 15%.</div>
      ${chartFooter({ fonte: "B3 + CVM (metodologias por empresa declaradas na aba Entidades)", periodo: `preços de ${fmt.d(M.valuation[0].data_preco)}`, atualizado: M.gerado_em.slice(0, 10), unidade: "% × múltiplo", nota: M.metodologia.roe_cia })}
      ${entenda("pvproe", [["Pergunta", "o prêmio/desconto de valuation é coerente com a rentabilidade?"],
        ["Eixos", "horizontal = ROE (lucro ÷ PL médio); vertical = P/VP (mercado ÷ patrimônio)"],
        ["Leitura de exemplo", `${pts[0] ? pts[0].label + " combina ROE de " + fmt.n(pts[0].x, 1) + "% com P/VP de " + fmt.n(pts[0].y, 2) + "×" : ""} — prêmio sobre o patrimônio compatível com rentabilidade acima do custo típico de capital`],
        ["Cuidado", "crescimento, risco, capital e sustentabilidade do lucro também explicam múltiplos; com n=3 não há linha de tendência estatisticamente honesta"]])}
    </div>
    <div class="card">
      <h4>Múltiplos e fundamentos — tabela comparativa</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Companhia</th><th style="text-align:right">Preço</th><th style="text-align:right">Mercado</th><th style="text-align:right">P/L</th><th style="text-align:right">P/VP</th><th style="text-align:right">E. yield</th><th style="text-align:right">ROE cia</th><th style="text-align:right">Yield 12m</th></tr></thead>
      <tbody>${M.valuation.map(vrow).join("")}</tbody></table></div>
      ${leitura([["Como interpretar", "passe o mouse em cada múltiplo para definição, fórmula, fonte e cuidados (cartão metodológico)"],
        ["Não concluir isoladamente", "P/VP baixo ≠ barato; ROE alto ≠ risco baixo; yield alto ≠ renda garantida"],
        ["Analisar conjuntamente", "Basileia, inadimplência e atraso por produto do conglomerado — nas páginas das instituições"]])}
    </div>
  </div>`;
}


function mktResultados(M, emp) {
  const nomes = {};
  M.empresas.forEach(e => {
    const f = (e.fin || []).find(x => x.kind === "anual");
    nomes[e.company_id] = e.legal_name.replace(/ S\.A\..*/i, "") + (f ? ` (${f.stmt})` : "");
  });
  const pontesSel = Object.entries(M.pontes || {}).filter(([cid]) => state.mkt.emp === "todas" || cid === state.mkt.emp);
  if (state.mkt.emp !== "todas" && !pontesSel.length) {
    const e = M.empresas.find(x => x.company_id === state.mkt.emp);
    return sechead("Ponte do lucro 2024 → 2025") + `<div class="card"><p class="src">Ponte indisponível para ${e ? e.legal_name : "esta instituição"}: as linhas da DRE necessárias não estão identificáveis no plano contábil entregue à CVM (ou falta um dos exercícios). Ausência ≠ zero — os movimentos observáveis constam das abas Valuation e Capital.</p></div>`;
  }
  const blocos = pontesSel.map(([cid, p]) => {
    const steps = [{ label: `Lucro ${"2024"}`, v: p.lucro_ini, tipo: "abs" }]
      .concat(p.passos.filter(st => Math.abs(st.v) > 1e6 || st.label.startsWith("Outros")).map(st => ({ label: st.label, v: st.v, tipo: "delta", expl: st.expl })))
      .concat([{ label: `Lucro ${"2025"}`, v: p.lucro_fim, tipo: "abs" }]);
    const qual = (function () {
      const c = p.conceitos;
      const serv = Math.abs(c.servicos["2025"]), marg = Math.abs(c.margem["2025"]);
      if (!serv || !marg) return "";
      const share = serv / (serv + marg) * 100;
      return `<div class="src" style="margin-top:6px"><b>Composição (qualidade do lucro):</b> serviços representam ${fmt.n(share, 0)}% da soma margem+serviços em 2025 — receitas de serviços e margem tendem a ser mais recorrentes que tesouraria e itens extraordinários. Volatilidade e persistência trimestral: <span class="seal aprox">INDISPONÍVEL</span> (série trimestral longa não integrada).</div>`;
    })();
    return `<div class="card">
      <h4>${p.frase ? "O que explicou a variação do lucro — " + nomes[cid] : "Ponte do lucro (decomposição parcial) — " + nomes[cid]} ${badge("observado", "linhas da DRE (CVM)")} ${badge("calculado", p.nota)}</h4>
      <div class="src" style="margin-bottom:6px">A ponte mostra quais componentes explicaram a diferença entre o lucro de 2024 e o de 2025. Barras verdes contribuíram para aumentar o resultado; vermelhas reduziram. "Outros" fecha a identidade contábil.</div>
      ${waterfallChart(steps, 720, 280)}
      ${p.frase ? `<div class="note" style="margin-top:8px"><b>Leitura automática:</b> ${p.frase} <span class="src">[Δ das linhas da DRE 2024→2025; resíduo ${fmt.n(p.residuo / 1e9, 2)} bi]</span></div>`
        : `<div class="note warn" style="margin-top:8px"><b>Leitura automática suprimida:</b> a decomposição por linhas identificáveis não fecha adequadamente (resíduo de R$ ${fmt.n(p.residuo / 1e9, 1)} bi — o plano contábil desta companhia concentra parte relevante do resultado em linhas não decompostas, como tesouraria). Mostramos apenas os movimentos observáveis.</div>`}
      ${qual}
      ${entenda("ponte" + cid, [["Pergunta", "o lucro cresceu por margem, serviços, eficiência, menor provisão ou itens não recorrentes?"],
        ["Como ler", "cada barra é a VARIAÇÃO 2024→2025 daquele componente; a soma das barras + resíduo = Δ lucro"],
        ["Cuidado", "planos contábeis variam entre companhias (correspondência textual declarada); componentes ausentes não significam zero"]])}
    </div>`;
  }).join("");
  return sechead("Ponte do lucro 2024 → 2025", "DRE oficial (CVM) · decomposição por conceito com identidade verificada") + `<div style="display:grid;gap:22px">${blocos}</div>`;
}

function mktCapital(M, emp) {
  const nomes = {};
  M.empresas.forEach(e => { nomes[e.company_id] = e.legal_name.replace(/ S\.A\..*/i, "") + (M.congl_lookup && M.congl_lookup[e.company_id] ? " — " + M.congl_lookup[e.company_id] : ""); });
  const capitalSel = Object.entries(M.capital || {}).filter(([cid]) => state.mkt.emp === "todas" || cid === state.mkt.emp);
  if (state.mkt.emp !== "todas" && !capitalSel.length) {
    const e = M.empresas.find(x => x.company_id === state.mkt.emp);
    return sechead("Geração e consumo de capital — movimentos observáveis") + `<div class="card"><p class="src">Waterfall de capital indisponível para ${e ? e.legal_name : "esta instituição"}: o conglomerado correspondente não reporta Patrimônio de Referência no IF.data integrado (ou a correspondência de entidades está pendente — ver aba Entidades).</p></div>`;
  }
  const blocos = capitalSel.map(([cid, c]) => {
    const steps = [
      { label: `PR ${fmtTri(c.de)}`, v: c.pr_inicial, tipo: "abs" },
      { label: "Lucro do período", v: c.lucro_acumulado_periodo, tipo: "delta", expl: "lucro do conglomerado (IF.data) no intervalo" },
      { label: "Proventos", v: -(c.proventos_periodo || 0), tipo: "delta", expl: "dividendos + JCP da companhia listada (último exercício) — aproximação de correspondência" },
      { label: "Outros (não decompostos)", v: c.outros, tipo: "delta", expl: "OCI, emissões/recompras, ajustes prudenciais, perímetro" },
      { label: `PR ${fmtTri(c.ate)}`, v: c.pr_final, tipo: "abs" },
    ];
    const rwaG = c.rwa_inicial && c.rwa_final ? (c.rwa_final / c.rwa_inicial - 1) * 100 : null;
    return `<div class="card">
      <h4>Movimentos observáveis do capital — ${nomes[cid]} ${badge("observado", "PR/RWA do IF.data; proventos da B3")} ${badge("calculado", c.nota)}</h4>
      <div class="src" style="margin-bottom:6px">Um banco precisa gerar capital para absorver riscos, crescer e distribuir. Crescimento forte do RWA consome capital mesmo com lucro — por isso Basileia pode cair com lucro recorde. Sem decomposição artificial: o que a fonte não separa fica em "Outros".</div>
      ${waterfallChart(steps, 720, 270)}
      ${leitura([["O que mudou", `Basileia ${fmt.n(c.basileia_inicial, 1)}% → ${fmt.n(c.basileia_final, 1)}%` + (rwaG != null ? ` · RWA ${fmt.pp(rwaG)}% no período` : "")],
        ["Por que importa", "distribuir mais do que gera (payout > 100%) reduz o colchão para crescer e absorver perdas"],
        ["Cuidado", "PR é do CONGLOMERADO; proventos são da COMPANHIA listada — correspondência declarada na aba Entidades"]])}
    </div>`;
  }).join("");
  return sechead("Geração e consumo de capital — movimentos observáveis", "IF.data (PR, RWA, Basileia) + proventos B3") + `<div style="display:grid;gap:22px">${blocos}</div>` +
    `<div class="note">Funding decomposto (depósitos à vista/poupança/prazo/letras), LCR/NSFR e exposições fora do balanço: <span class="seal aprox">INDISPONÍVEL</span> — relatórios de passivo detalhado e Pilar 3 não integrados nesta fase (registrado no backlog). A dependência de captações totais aparece no Comparador (métrica "Captações").</div>`;
}

const SCR_STATE = { modo: "listadas", froe: "", fbas: "", fnpl: "", fativo: "", sort: "ativo", dir: -1 };
window.scrSet = (k, v) => { SCR_STATE[k] = v; renderMarket(); };
window.scrSort = k => { if (SCR_STATE.sort === k) SCR_STATE.dir *= -1; else { SCR_STATE.sort = k; SCR_STATE.dir = -1; } renderMarket(); };
function mktScreener(M) {
  const S = state.data.screener;
  if (!S) { fetchGold("screener").then(() => renderMarket()); return loadingCard("screener"); }
  const st = SCR_STATE;
  const num = x => x === "" ? null : parseFloat(x);
  let rows;
  if (st.modo === "listadas") {
    rows = M.valuation.map(v => ({ cod: v.ticker, nome: state.data.market.empresas.find(e => e.company_id === v.company_id).legal_name, sr: "", nivel: "listada",
      ativo: null, roe: v.roe_cia, basileia: null, npl: null, pvp: v.pvp, pl: v.pl_ratio, yield12: v.yield_12m, payout: v.payout, ret12: M.janelas[v.ticker].total.a12, dd: M.janelas[v.ticker].drawdown.atual, mcap: v.mcap }));
  } else {
    rows = S.linhas.map(r => ({ ...r, pvp: null, pl: null, yield12: null, payout: null, ret12: null, dd: null, mcap: null }));
    if (num(st.froe) != null) rows = rows.filter(r => r.roe != null && r.roe >= num(st.froe));
    if (num(st.fbas) != null) rows = rows.filter(r => r.basileia != null && r.basileia >= num(st.fbas));
    if (num(st.fnpl) != null) rows = rows.filter(r => r.npl != null && r.npl <= num(st.fnpl));
    if (num(st.fativo) != null) rows = rows.filter(r => r.ativo != null && r.ativo >= num(st.fativo) * 1e9);
  }
  rows = rows.slice().sort((a, b) => { const x = a[st.sort], y = b[st.sort]; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : -1) * st.dir; });
  const shown = rows.slice(0, 100);
  const th = (k, l, tip2) => `<th onclick="scrSort('${k}')" style="text-align:right" title="${tip2 || "ordenar"}">${l}${st.sort === k ? (st.dir < 0 ? " ↓" : " ↑") : ""}</th>`;
  const na = "<span class='src'>n/a</span>";
  const linha = r => `<tr class="clickable" onclick="${r.nivel === "listada" ? `mktSet('tab','valuation')` : `openInstPage('${r.cod}')`}">
    <td><b>${(r.nome || r.cod).slice(0, 34)}</b><div class="src">${r.nivel === "listada" ? r.cod + " · listada" : (r.sr || "") + " · " + r.nivel}</div></td>
    <td style="text-align:right">${r.ativo != null ? fmt.money(r.ativo) : na}</td>
    <td style="text-align:right">${r.roe != null ? fmt.n(r.roe, 1) + "%" : na}</td>
    <td style="text-align:right">${r.basileia != null ? fmt.n(r.basileia, 1) + "%" : na}</td>
    <td style="text-align:right">${r.npl != null ? fmt.n(r.npl, 2) + "%" : na}</td>
    <td style="text-align:right">${r.cresc4t != null ? fmt.pp(r.cresc4t) + "%" : na}</td>
    <td style="text-align:right">${r.pvp != null ? fmt.n(r.pvp, 2) + "×" : na}</td>
    <td style="text-align:right">${r.yield12 != null ? fmt.n(r.yield12, 1) + "%" : na}</td>
    <td style="text-align:right">${r.ret12 != null ? fmt.pp(r.ret12) + "%" : na}</td></tr>`;
  return `
  ${sechead("Screener de instituições", `ferramenta de pesquisa — não constitui recomendação de investimento`)}
  <div class="card">
    <div class="controls">
      <span class="seg"><button class="${st.modo === "listadas" ? "active" : ""}" onclick="scrSet('modo','listadas')">listadas (${M.valuation.length})</button><button class="${st.modo === "reguladas" ? "active" : ""}" onclick="scrSet('modo','reguladas')">todas as reguladas (${S.n})</button></span>
      ${st.modo === "reguladas" ? `
      <label>ROE ≥ <input type="text" value="${st.froe}" style="width:52px" onchange="scrSet('froe', this.value)" aria-label="ROE mínimo">%</label>
      <label>Basileia ≥ <input type="text" value="${st.fbas}" style="width:52px" onchange="scrSet('fbas', this.value)" aria-label="Basileia mínima">%</label>
      <label>Inad. ≤ <input type="text" value="${st.fnpl}" style="width:52px" onchange="scrSet('fnpl', this.value)" aria-label="inadimplência máxima">%</label>
      <label>Ativos ≥ <input type="text" value="${st.fativo}" style="width:60px" onchange="scrSet('fativo', this.value)" aria-label="ativos mínimos">R$ bi</label>` : ""}
      <span class="src">${rows.length} resultado(s)${rows.length > 100 ? " · exibindo top-100" : ""} · data-base ${st.modo === "listadas" ? fmt.d(M.valuation[0].data_preco) : fmtTri(S.data_base)}</span>
    </div>
    <div class="tblwrap"><table class="data compact rankmini"><thead><tr><th>Instituição</th>${th("ativo", "Ativos")}${th("roe", "ROE", "listadas: ROE da companhia (CVM); reguladas: ROE do período IF.data")}${th("basileia", "Basileia")}${th("npl", "Inad. >90d")}${th("cresc4t", "Δ carteira 4T")}${th("pvp", "P/VP")}${th("yield12", "Yield 12m")}${th("ret12", "Ret. total 12m")}</tr></thead>
    <tbody>${shown.map(linha).join("")}</tbody></table></div>
    ${leitura([["Como interpretar", "métricas de mercado só existem para as listadas do piloto — 'n/a' nas demais (nunca zero)"],
      ["Filtros", "aplicam-se ao modo 'todas as reguladas' sobre fundamentos IF.data; ausência de dado exclui a instituição do filtro correspondente"],
      ["Cuidado", "um ranking não é conclusão de risco: ROE alto pode vir de alavancagem; P/VP baixo pode refletir risco percebido"]])}
  </div>`;
}

function mktEntidades(M) {
  const erow = e => `<tr>
    <td><b>${e.legal_name}</b><div class="src">CNPJ ${e.cnpj} · CVM ${e.cvm_code} · ${e.listing_segment}</div></td>
    <td>${e.tickers.map(t => `<span class="chip">${t.ticker} <span class="src" style="display:inline">${t.share_class}</span></span>`).join(" ")}</td>
    <td>${(function(){ const cc = e.congl_cod || (state.data.market.congl_lookup || {})[e.company_id]; return cc ? `<span class="clickable" onclick="openInstPage('${cc}')" style="color:var(--accent)">${cc} →</span>` : "<span class='src'>correspondência pendente</span>"; })()}</td>
    <td class="src">${e.natureza}</td>
    <td class="src">${e.perfil}</td></tr>`;
  return `
  ${sechead("Correspondência entre companhia listada, ação e conglomerado", "preço é da AÇÃO; lucro/PL são da COMPANHIA (CVM); indicadores regulatórios são do CONGLOMERADO (IF.data)")}
  <div class="card">
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Companhia listada</th><th>Ações</th><th>Conglomerado prudencial</th><th>Natureza</th><th>Perfil no piloto</th></tr></thead>
    <tbody>${M.empresas.map(erow).join("")}</tbody></table></div>
  </div>
  ${sechead("Metodologia e fontes desta área")}
  <div class="card"><div class="src" style="line-height:2">
    ${Object.entries(M.fontes).map(([k, v]) => `<b>${k}:</b> ${v}<br>`).join("")}
    ${Object.entries(M.metodologia).map(([k, v]) => `<b>${k}:</b> ${v}<br>`).join("")}
    <b>Valor de mercado por empresa:</b> ${M.valuation.map(v => `${v.ticker}: ${v.nota_mcap}`).join(" · ")}<br>
    <b>Indisponíveis (fase seguinte ou sem fonte pública):</b> excesso vs. Ibovespa e beta (série oficial gratuita descontinuada em 2019) · ponte do lucro e qualidade do lucro (exigem parse das linhas da DRE — próxima fase) · funding decomposto, LCR/NSFR e exposições fora do balanço (relatórios não integrados) · consenso de mercado.
  </div></div>`;
}

/* ---------- cabeçalho editorial padrão (padrão da Visão geral) ---------- */

/* ---------- bloco 1 da auditoria: vintage por página, filtros ativos, conceitos de inadimplência, loading ---------- */
const VIEW_VINTAGE = { overview: "sgs", pulse: "sgs", antecedentes: "sgs", leading: "sgs", scenarios: "sgs",
  alerts: "sgs", sectors: "ifdata", rj: "datajud", institutions: "ifdata", inst: "ifdata",
  products: "ifdata", product: "ifdata", compare: "ifdata", research: "ifdata",
  market: "b3", panorama: "scr", trends: "trends", sector: "ifdata" };
function pageVintage(view) {
  const vs = (state.data.meta || {}).vintages || {};
  return vs[VIEW_VINTAGE[view]] || null;
}
const INAD_DEFS = {
  sgs: "SGS >90d",
  scr: "SCR arrastada",
  atraso15: "IF.data ≥15d",
  if90: "IF >90d",
};
function inadChip(tipo) {
  const c = (state.data.meta || {}).inad_conceitos || {};
  const defs = {
    sgs: (c.sgs || {}).def || "parcelas em atraso >90 dias ÷ carteira do crédito referencial (BCB/SGS 21082).",
    scr: (c.scr || {}).def || "inadimplência arrastada: operações com parcela vencida >90d contadas por inteiro ÷ carteira ativa (SCR.data).",
    atraso15: (c.atraso15 || {}).def || "atraso ≥15 dias por operação (IF.data) — varia por produto e instituição.",
    if90: "carteira com atraso >90 dias ÷ carteira ativa da instituição (IF.data, Res. 4.966) — nível instituição, não sistema.",
  };
  const outros = ["sgs", "scr"].filter(k => k !== tipo && c[k] && c[k].v != null)
    .map(k => `${INAD_DEFS[k]}: ${fmt.n(c[k].v, 2)}% (${c[k].ref})`).join(" · ");
  const tip = encodeURIComponent(`<div class="tt-date">Qual inadimplência é esta?</div><div class="tt-meta"><b>${INAD_DEFS[tipo]}</b>: ${defs[tipo]}${outros ? `<br><b>Outros conceitos:</b> ${outros}` : ""}<br>Os números diferem porque os conceitos diferem — detalhe em Metodologia → “As três inadimplências”.</div>`);
  return `<span class="ichip" data-tip="${tip}" onclick="nav('method')" role="button" tabindex="0" aria-label="conceito de inadimplência: ${INAD_DEFS[tipo]}">${INAD_DEFS[tipo]}&nbsp;ⓘ</span>`;
}
function loadingCard(oque) {
  return `<div class="card loadcard" style="margin-top:20px"><span class="spin" aria-hidden="true"></span><p class="src">carregando ${oque}…</p></div>`;
}
function activeFilterChips(view) {
  const chips = [], f = state.filters;
  if (["overview", "pulse", "antecedentes", "scenarios"].includes(view)) {
    if (f.seg !== "total") chips.push(`segmento: ${segName ? segName() : f.seg}`);
    if (f.range !== 60) chips.push(`janela: ${f.range} meses`);
    if (f.growth !== "nominal") chips.push("variação: real (IPCA)");
  }
  if (view === "panorama" && state.pan) {
    const p = state.pan;
    if (p.met !== "saldo") chips.push(`mapa: ${(PAN_METS[p.met] || {}).l || p.met}`);
    if (p.uf) chips.push(`UF: ${p.uf}`);
    if (p.cmp.length) chips.push(`comparação: ${p.cmp.join(", ")}`);
    if (p.cli !== "PF") chips.push("cliente: PJ");
    if (p.lens !== "saldo") chips.push(`lente: ${p.lens}`);
  }
  if (view === "market" && state.mkt && state.mkt.emp !== "todas") chips.push(`instituição: ${state.mkt.emp}`);
  if (view === "trends" && state.tr && state.tr.fam !== "todas") chips.push(`família: ${state.tr.fam}`);
  if (view === "compare" && state.cmp) {
    if (state.cmp.insts.length) chips.push(`${state.cmp.insts.length} instituição(ões) selecionada(s)`);
    if (state.cmp.norm !== "abs") chips.push(`normalização: ${state.cmp.norm}`);
  }
  return chips;
}
function filterBar(view) {
  const chips = activeFilterChips(view);
  if (!chips.length) return "";
  return `<div class="filterbar" role="status" aria-label="filtros ativos">filtros ativos:
    ${chips.map(cc => `<span class="chip">${cc}</span>`).join("")}
    <button class="btn ghost small" onclick="clearPageFilters('${view}')">limpar filtros</button></div>`;
}
window.clearPageFilters = view => {
  if (["overview", "pulse", "antecedentes", "scenarios"].includes(view)) {
    state.filters = { ...state.filters, seg: "total", range: 60, growth: "nominal" };
    saveLS("obc_filters", state.filters);
  }
  if (view === "panorama") state.pan = { met: "saldo", uf: null, cmp: [], cli: "PF", lens: "saldo", exp: state.pan.exp };
  if (view === "market") state.mkt.emp = "todas";
  if (view === "trends") state.tr.fam = "todas";
  if (view === "compare") { state.cmp.insts = []; state.cmp.norm = "abs"; saveLS("obc_cmp", state.cmp); }
  syncHash(); rerenderCurrent();
};

function pageHead(o) {
  const meta = state.data.meta || {};
  const upd = meta.gerado_em ? meta.gerado_em.slice(0, 16).replace("T", " ") + " UTC" : "–";
  return `<div class="pagehead">
    <div class="ph-left">
      <h2>${o.title}${o.seals ? " " + o.seals : ""}</h2>
      ${o.desc ? `<p class="viewdesc">${o.desc}</p>` : ""}
      <div class="ph-meta">${(o.vintage || pageVintage(currentView())) ? `Dados até <b>${o.vintage || pageVintage(currentView())}</b> · processado em ${upd}` : `Última atualização: ${upd}`}${o.fontes ? " · fontes: " + o.fontes : ""} · <a href="javascript:void(0)" onclick="nav('method')">metodologia e fontes</a></div>
    </div>
    <div class="ph-actions">
      ${o.controls || ""}
      <button class="btn ghost small" onclick="navigator.clipboard.writeText(location.href).then(()=>alert('URL copiada — filtros incluídos'))">copiar URL</button>
      ${o.actions || ""}
      <button class="btn ghost small" onclick="pvSave()">salvar visão</button>
      ${(loadLS("obc_views_url", []).length ? `<select onchange="pvLoad(this.value)" aria-label="visões salvas"><option value="">visões salvas…</option>${loadLS("obc_views_url", []).map((vx, i) => `<option value="${i}">${vx.nome}</option>`).join("")}</select>` : "")}
      <button class="btn ghost small" onclick="window.print()" title="usar 'Salvar como PDF' na impressão">PDF</button>
    </div>
  </div>${filterBar(currentView())}`;
}
window.pvSave = () => {
  const nome = prompt("Nome desta visão (a URL atual, com filtros, será salva):");
  if (!nome) return;
  const vs = loadLS("obc_views_url", []);
  vs.push({ nome, url: location.href });
  saveLS("obc_views_url", vs); rerenderCurrent();
};
window.pvLoad = i => { const vx = loadLS("obc_views_url", [])[parseInt(i, 10)]; if (vx) location.href = vx.url; };
function sechead(title, right) {
  return `<div class="sechead"><h3>${title}</h3>${right ? `<span class="seesub">${right}</span>` : ""}</div>`;
}

window.ovSaveView = () => {
  const nome = prompt("Nome desta visão (filtros atuais serão salvos):");
  if (!nome) return;
  const vs = loadLS("obc_views", []);
  vs.push({ nome, filters: { ...state.filters } });
  saveLS("obc_views", vs); renderOverview();
};
window.ovLoadView = i => {
  if (i === "") return;
  const vx = loadLS("obc_views", [])[parseInt(i, 10)];
  if (!vx) return;
  state.filters = { ...state.filters, ...vx.filters };
  saveLS("obc_filters", state.filters); syncHash(); renderOverview();
};
/* ---------- Visão geral personalizável ----------
   Padrões de referência (OWID, OECD Data, FRED, NN/g): conclusão primeiro,
   poucos números acima da dobra, revelação progressiva e personalização com
   padrão simples. As seções extras existem, mas o usuário escolhe. */
const OV_BLOCOS = [
  ["diagnostico", "Diagnóstico e números centrais", true],
  ["condicoes", "Condições de crédito (IBCC e mudanças)", true],
  ["inad", "Inadimplência nas instituições", false],
  ["prodset", "Produtos, setores e ecossistema", false],
  ["proj", "Projeções, relações e sinais", false],
  ["insight", "Leitura analítica", false],
  ["saude", "Saúde dos dados", false],
  ["explore", "Acesso rápido", true],
];
// arquivos gold que cada bloco opcional exige além do núcleo: só são baixados
// quando o usuário habilita o bloco (o padrão simples não paga esse custo)
const OV_BLOCO_DATA = {
  inad: ["npl", "regimes"],
  prodset: ["products", "sectors", "openfinance"],
  proj: ["scenario", "npl"],
  insight: ["npl"],
  saude: ["quality"],
};
let ovPersonalizando = false;
function ovBlocosCfg() {
  const padrao = Object.fromEntries(OV_BLOCOS.map(([k, , d]) => [k, d]));
  return { ...padrao, ...(loadLS("obc_ov_blocos", {}) || {}) };
}
window.ovBlocoSet = (k, on) => {
  const cfg = ovBlocosCfg();
  cfg[k] = !!on;
  saveLS("obc_ov_blocos", cfg);
  renderOverview();
};
window.ovPreset = modo => {
  saveLS("obc_ov_blocos", Object.fromEntries(OV_BLOCOS.map(([k, , d]) => [k, modo === "completo" ? true : d])));
  renderOverview();
};
window.ovTogglePersonalizar = () => { ovPersonalizando = !ovPersonalizando; renderOverview(); };
window.ovDispensarBoasVindas = () => { saveLS("obc_boas_vindas_ok", true); renderOverview(); };

function renderOverview() {
  const el = document.getElementById("view-overview");
  const { pulse, alerts, sectors, overview } = state.data;
  if (!pulse || !overview) { el.innerHTML = "<p>Dados não carregados. Rode <code>python3 pipeline/run.py</code>.</p>"; return; }
  // carga sob demanda por bloco: baixa os gold dos blocos habilitados que ainda
  // faltam e re-renderiza ao chegar (fetchGold marca null em erro — sem loop)
  const cfgLazy = ovBlocosCfg();
  const faltam = [...new Set(OV_BLOCOS.filter(([k]) => cfgLazy[k]).flatMap(([k]) => OV_BLOCO_DATA[k] || []))]
    .filter(f => state.data[f] === undefined);
  if (faltam.length) Promise.all(faltam.map(fetchGold)).then(() => { if (currentView() === "overview") renderOverview(); });
  const seg = state.filters.seg;
  const ibcc = seg === "total" ? state.data.ibcc : (state.data.ibcc.segmentos || {})[seg] || state.data.ibcc;
  const pos = seg === "total" ? overview.ibcc_posicao : ibccPositionFrom(ibcc);
  const diag = overview.diagnostico;
  const chg = overview.mudancas;
  const meta = state.data.meta || {};
  const npl = state.data.npl;
  const P = state.data.products;
  const ofr = state.data.openfinance && (state.data.openfinance.demo === false ? state.data.openfinance : null);

  /* ---------- cabeçalho da página ---------- */
  const pagehead = `
  <div class="pagehead">
    <div class="ph-left">
      <h2>Visão geral</h2>
      <p class="viewdesc">Panorama do mercado de crédito no Brasil com dados públicos rastreáveis — monitoramento, diagnóstico e previsão.</p>
      <div class="ph-meta">${pageVintage("overview") ? `Dados até <b>${pageVintage("overview")}</b> · processado em ` : "Última atualização: "}${meta.gerado_em ? meta.gerado_em.slice(0, 16).replace("T", " ") + " UTC" : "–"} · fontes: BCB (SGS, IF.data, txjuros), IBGE, CNJ, Open Finance Brasil · <a href="javascript:void(0)" onclick="nav('method')">metodologia e fontes</a></div>${filterBar("overview")}
    </div>
    <div class="ph-actions">
      ${segTabs()}
      <button class="btn ghost small" onclick="ovTogglePersonalizar()" aria-expanded="${ovPersonalizando}">personalizar página</button>
      <button class="btn ghost small" onclick="navigator.clipboard.writeText(location.href).then(()=>alert('URL copiada — filtros incluídos'))">copiar URL</button>
      <button class="btn ghost small" onclick="dlFile('overview_'+(state.data.meta&&state.data.meta.gerado_em||'').slice(0,10)+'.json', JSON.stringify({extraido_em:new Date().toISOString(), seg: state.filters.seg, overview: state.data.overview, npl_sistema: state.data.npl && state.data.npl.sistema}, null, 1), 'application/json')">exportar dados</button>
      <button class="btn ghost small" onclick="window.print()" title="usar 'Salvar como PDF' na impressão">PDF</button>
      <button class="btn ghost small" onclick="ovSaveView()">salvar visão</button>
      ${(loadLS("obc_views", []).length ? `<select onchange="ovLoadView(this.value)" aria-label="visões salvas"><option value="">visões salvas…</option>${loadLS("obc_views", []).map((vx, i) => `<option value="${i}">${vx.nome}</option>`).join("")}</select>` : "")}
      <button class="btn ghost small" onclick="state.filters = { ...DEFAULT_FILTERS }; saveLS('obc_filters', state.filters); syncHash(); renderOverview()">restaurar padrão</button>
    </div>
  </div>`;

  /* ---------- classificação determinística ---------- */
  const pct = pos ? pos.percentil_historico : null;
  const classif = pct == null ? ["neutra", "Sem classificação"] :
    pct <= 25 ? ["restr", "Condições restritivas"] :
    pct >= 75 ? ["expan", "Condições expansionistas"] : ["neutra", "Condições neutras"];
  const classifRegra = "regra declarada: percentil histórico do IBCC ≤25 = restritivas · ≥75 = expansionistas · demais = neutras";

  /* ---------- fatores ± (das mudanças) ---------- */
  const fat = (r, up) => `<span class="fat"><b class="${up ? "up" : "down good"}">${up ? "▲" : "▼"}</b><span><b>${r.indicador}</b> ${fmt.pp(r.delta_1m)}${r.unidade === "%" || r.unidade === "p.p." ? " p.p." : ""} <a href="javascript:void(0)" onclick="nav('${r.area}')" class="src" style="display:inline">analisar →</a></span></span>`;
  const diagcard = diag && diag.ok ? `
  <div class="diagcard">
    <div><span class="classif ${classif[0]}" title="${classifRegra}">${classif[1]}</span></div>
    <div class="frase">${diag.frase}</div>
    <div class="src">${badge("calculado", diag.metodo)} ref. ${fmt.my(diag.ref)} · ${confBadge(diag.confianca, diag.confianca_motivo)} · diagnóstico determinístico auditável — <a href="javascript:void(0)" onclick="nav('method')">método</a></div>
    <div class="fatores">
      ${chg.top_deterioracoes.slice(0, 2).map(r => fat(r, true)).join("")}
      ${chg.top_melhoras.slice(0, 2).map(r => fat(r, false)).join("")}
    </div>
    <details class="decomp"><summary>evidências (${diag.evidencias.length})</summary>
      ${diag.evidencias.map(e => `<div class="contrib clickable" onclick="nav('${e.area}')"><span class="lbl" style="width:auto">→ ${e.texto} <i class="src">[${e.status}]</i></span></div>`).join("")}
    </details>
  </div>` : "";

  /* ---------- 6 métricas centrais com sparkline ---------- */
  const last2 = arr => arr && arr.length >= 2 ? [arr[arr.length - 2].v, arr[arr.length - 1].v] : [null, null];
  const sparkOf = (arr, n) => arr ? sparkline(arr.slice(-(n || 24)).map(o => o.v), 150, 30) : "";
  const mcard = (lbl, val, varHtml, spark, target, tip) => {
    const lblPlain = attr(lbl);
    return `
    <div class="mcard" tabindex="0" role="link" aria-label="${lblPlain} — abrir análise" data-tip="${tip || ""}"
      onclick="${target}" onkeydown="if(event.key==='Enter'){${target}}">
      <span class="lbl">${lbl}</span><span class="val">${val}</span>
      <span class="var">${varHtml}</span>${spark}
    </div>`;
  };
  const cards = [];
  if (ibcc && ibcc.ok && pos) {
    const t = encodeURIComponent(`<div class="tt-date">IBCC — Índice de Condições de Crédito</div><div class="tt-meta">100 = média histórica · índice-síntese calculado (preço, qualidade, capacidade, atividade, oferta, antecedentes) · fase: ${ibcc.fase_ciclo} · percentil ${fmt.n(pos.percentil_historico, 0)}</div>`);
    cards.push(mcard("Índice de Condições de Crédito", fmt.n(pos.atual, 1), `<span class="${pos.delta_1m < 0 ? "up" : "down good"}">${fmt.pp(pos.delta_1m)} pt vs. mês ant.</span>`,
      ibcc.serie ? sparkline(ibcc.serie.slice(-24).map(o => o.valor), 150, 30) : "", `document.getElementById('ov-icc').scrollIntoView({behavior:'smooth'})`, t));
  }
  const serieDefs = [
    [`inad_${seg}`, "Inadimplência (>90d)", v => fmt.n(v, 2) + "<small>%</small>", "p.p.", true],
    [`taxa_${seg}`, "Taxa média de juros", v => fmt.n(v, 1) + "<small>% a.a.</small>", "p.p.", true],
    [`spread_${seg}`, "Spread médio", v => fmt.n(v, 1) + "<small> p.p.</small>", "p.p.", true],
  ];
  serieDefs.forEach(([key, lbl, fmtV, unit, higherBad]) => {
    const sdata = pulse.series[key];
    if (!sdata) return;
    const [prev, cur] = last2(sdata.obs);
    const d = prev != null ? cur - prev : null;
    const t = encodeURIComponent(`<div class="tt-date">${lbl} — ${segName()}</div><div class="tt-meta">${sdata.meta.source} série ${sdata.meta.series_code} · ${sdata.meta.unit} · mensal · ref. ${fmt.my(sdata.obs[sdata.obs.length-1].ref)} · observado</div>`);
    cards.push(mcard(lbl + (key.startsWith("inad_") ? " " + inadChip("sgs") : ""), fmtV(cur), d == null ? "" : `<span class="${d > 0 ? (higherBad ? "up" : "down good") : (higherBad ? "down good" : "up")}">${fmt.pp(d)} ${unit} vs. mês ant.</span>`, sparkOf(sdata.obs), `nav('pulse')`, t));
  });
  const saldo = pulse.series[`saldo_${seg}`];
  if (saldo && saldo.yoy && saldo.yoy.length) {
    const y = saldo.yoy[saldo.yoy.length - 1].v, yPrev = saldo.yoy.length > 1 ? saldo.yoy[saldo.yoy.length - 2].v : null;
    const t = encodeURIComponent(`<div class="tt-date">Crescimento da carteira (12m) — ${segName()}</div><div class="tt-meta">${saldo.meta.source} ${saldo.meta.series_code} · var. % em 12 meses (nominal) · calculado sobre série observada</div>`);
    cards.push(mcard("Crescimento da carteira (12m)", fmt.n(y, 1) + "<small>% a/a</small>",
      yPrev == null ? "" : `<span class="${y - yPrev >= 0 ? "down good" : "up"}">${fmt.pp(y - yPrev)} p.p. vs. mês ant.</span>`, sparkOf(saldo.yoy), `nav('pulse')`, t));
  }
  const comp = pulse.series.comprometimento;
  if (comp) {
    const [prev, cur] = last2(comp.obs);
    const t = encodeURIComponent(`<div class="tt-date">Comprometimento de renda — famílias (Brasil, sem corte PF/PJ)</div><div class="tt-meta">${comp.meta.source} ${comp.meta.series_code} · % da renda com serviço da dívida · observado</div>`);
    cards.push(mcard("Comprometimento de renda", fmt.n(cur, 1) + "<small>%</small>", prev == null ? "" : `<span class="${cur - prev > 0 ? "up" : "down good"}">${fmt.pp(cur - prev)} p.p. vs. mês ant.</span>`, sparkOf(comp.obs), `nav('pulse')`, t));
  }
  const heroStrip = `<div class="hero-strip">${cards.slice(0, 6).join("")}</div>`;

  const segNote = seg !== "total"
    ? `<div class="note">Corte ativo: <b>${segName()}</b>. IBCC, métricas, fan chart e projeções referem-se ao segmento; diagnóstico, instituições e Open Finance permanecem agregados (limitação das fontes).${seg === "pj" ? " A versão PJ do IBCC não tem componente de capacidade de pagamento (sem série pública equivalente)." : ""}</div>` : "";

  /* ---------- condições de crédito (série IBCC) + principais mudanças ---------- */
  const iccChart = ibcc && ibcc.serie ? lineChart({
    series: [{ pts: ibcc.serie.map(o => ({ x: o.ref, y: o.valor })), color: "#1d4e89", label: "IBCC" }],
    hlines: [{ y: 100, color: "#aaa", label: "neutro (média histórica)" }],
    h: 250, unit: "índice", fonte: "IBCC — índice-síntese do Observatório", status: "calculado", dec: 1,
  }) : "<p class='src'>série indisponível</p>";
  const chgLine = r => `<div class="contrib clickable" onclick="nav('${r.area}')" title="abrir a análise de ${r.indicador}">
    <span class="lbl" style="width:210px">${r.indicador}</span>
    <span class="num ${r.classificacao === "deterioração" ? "up" : r.classificacao === "melhora" ? "down good" : "neutral"}">${fmt.pp(r.delta_1m)}${r.unidade === "%" || r.unidade === "p.p." ? " p.p." : ""}</span>
    <span class="src" title="relevância: a variação deste mês equivale a ${fmt.n(r.relevancia_z, 1)} vez(es) a oscilação mensal típica desta série — acima de 1 é movimento fora do padrão">relev. ${fmt.n(r.relevancia_z, 1)}× →</span></div>`;
  const secCondicoes = `
  <div class="sechead" id="ov-icc"><h3>Condições de crédito</h3><a href="javascript:void(0)" class="seeall" onclick="nav('pulse')">ver pulso do crédito →</a></div>
  <div class="ov-2col">
    <div class="card">
      <h4>IBCC — série histórica ${seg !== "total" ? "(" + segName() + ")" : ""} ${badge("calculado", ibcc.metodo)}</h4>
      <div class="src" style="margin-bottom:6px">fase: <b>${ibcc.fase_ciclo}</b> · percentil histórico <b>${pos ? fmt.n(pos.percentil_historico, 0) : "–"}</b> · vs. 3m ${pos ? fmt.pp(pos.delta_3m) : "–"} · vs. 12m ${pos ? fmt.pp(pos.delta_12m) : "–"}</div>
      ${iccChart}
      <details class="decomp"><summary>decomposição por componente (contribuições atuais)</summary>
        ${ibcc.atual ? Object.entries(ibcc.atual.contribuicoes).map(([c, v]) => contribBar(ibcc.componentes[c] ? ibcc.componentes[c].label : c, v)).join("") : ""}
      </details>
      ${chartFooter({ fonte: "Séries BCB/SGS + IBGE (insumos observados); índice calculado", periodo: ibcc.serie ? `${fmt.my(ibcc.serie[0].ref)}–${fmt.my(ibcc.serie[ibcc.serie.length - 1].ref)}` : "–", atualizado: meta.gerado_em ? meta.gerado_em.slice(0, 10) : "–", unidade: "índice (100 = média)", nota: ibcc.metodo })}
    </div>
    <div class="card">
      <h4>Principais mudanças <span class="src">(vs. mês anterior)</span> ${badge("calculado", "Δ mensal normalizado pelo desvio-padrão histórico")}</h4>
      <h5 class="up">▲ deteriorações</h5>
      ${chg.top_deterioracoes.map(chgLine).join("") || "<p class='src'>nenhuma</p>"}
      <h5 class="down good" style="margin-top:12px">▼ melhoras</h5>
      ${chg.top_melhoras.map(chgLine).join("") || "<p class='src'>nenhuma</p>"}
      <details class="decomp" style="margin-top:10px"><summary>tabela completa (${chg.tabela.length} indicadores)</summary>
        <div class="tblwrap"><table class="data compact"><thead><tr><th>Indicador</th><th>Anterior</th><th>Atual</th><th>Δ 1m</th><th>Interpretação</th></tr></thead>
        <tbody>${chg.tabela.map(r => `<tr class="clickable" onclick="nav('${r.area}')"><td>${r.indicador}</td><td>${fmt.n(r.anterior, 2)}</td><td>${fmt.n(r.atual, 2)}</td><td class="${r.classificacao === "deterioração" ? "up" : r.classificacao === "melhora" ? "down good" : "neutral"}">${fmt.pp(r.delta_1m)}</td><td>${r.interpretacao}</td></tr>`).join("")}</tbody></table></div>
      </details>
      <div class="src" style="margin-top:8px">Fontes: BCB/SGS, IBGE, Ipeadata · classificação pela direção econômica de cada indicador · cada linha abre a análise correspondente.</div>
    </div>
  </div>`;

  /* ---------- inadimplência nas instituições ---------- */
  let secNpl = "";
  if (npl && npl.ok) {
    const g = npl.grupos;
    const allVals = [].concat(...Object.values(g).map(x => x.valores || []));
    const detRow = d => `<tr class="clickable" onclick="openInstPage('${d.cod_inst}')" title="abrir a página da instituição">
      <td class="inst">${d.nome.slice(0, 28)}<div class="src">${d.grupo}${d.carteira_brl != null ? " · carteira " + fmt.money(d.carteira_brl) : ""}</div></td>
      <td style="text-align:right">${fmt.n(d.inad_pct, 2)}%</td>
      <td style="text-align:right" class="${d.d_ano_pp > 0 ? "up" : "down good"}">${fmt.pp(d.d_ano_pp)} p.p.</td>
      <td style="text-align:right" class="${(d.cresc_carteira_4t_pct || 0) > 15 ? "up" : "neutral"}">${d.cresc_carteira_4t_pct != null ? fmt.pp(d.cresc_carteira_4t_pct) + "%" : "–"}</td></tr>`;
    secNpl = `
    <div class="sechead"><h3>Inadimplência nas instituições financeiras ${badge("observado", npl.metodo)} ${inadChip("if90")}</h3>
      <span class="seesub">IF.data ${npl.data_base} · ${npl.n_instituicoes} instituições · ${npl.nivel_consolidacao} · <a href="javascript:void(0)" onclick="nav('institutions')">ver painel completo →</a></span></div>
    <div class="ov-3col">
      <div class="card"><h4>Sistema — mediana e dispersão</h4>
        <div class="big">${fmt.n(npl.sistema.mediana_inad_pct, 2)}%</div>
        <div class="delta neutral">quartis ${npl.sistema.dispersao_quartis.q1}% – ${npl.sistema.dispersao_quartis.q3}% · ${npl.sistema.subindo_no_trimestre} de ${npl.n_instituicoes} subindo no trimestre</div>
        ${histogram(allVals, npl.sistema.mediana_inad_pct, 340, 92)}
        <div class="src">distribuição entre instituições (medianas simples, nunca média ponderada) · marcador = mediana</div></div>
      <div class="card"><h4>Histórico e projeção — ${segName()} ${badge("observado")} ${badge("previsao")}</h4>${inadFanChart(seg)}</div>
      <div class="card"><h4>Medianas por grupo de pares</h4>
        ${Object.entries(g).filter(([k]) => k !== "S?").map(([k, v]) => `<div class="contrib clickable" onclick="nav('institutions')"><span class="lbl" style="width:46px">${k}</span><span class="bar pos" style="width:${(v.mediana || 0) * 13}px"></span><span class="num">${v.mediana != null ? fmt.n(v.mediana, 2) + "%" : "–"} <span class="src">(n=${v.n})</span></span></div>`).join("")}
        <h5 style="margin-top:14px">Frases automáticas ${badge("calculado", "regras determinísticas — regra e base citadas")}</h5>
        ${npl.frases.slice(0, 3).map(f => `<p class="src" style="margin:5px 0">• ${f.texto}</p>`).join("")}</div>
    </div>
    <div class="ov-2col-eq" style="margin-top:20px">
      <div class="card"><h4>Maior deterioração da carteira (4 trim.) <span class="src">— 3 critérios lado a lado</span></h4>
        <div class="tblwrap"><table class="data compact rankmini"><thead><tr><th>Instituição</th><th style="text-align:right">Inad.</th><th style="text-align:right">Δ inad 4T</th><th style="text-align:right">Δ carteira 4T</th></tr></thead>
        <tbody>${npl.top_deterioracoes.map(detRow).join("")}</tbody></table></div>
        <div class="src">deterioração ≠ solvência: depende de mix, garantias, provisões e capital.</div></div>
      <div class="card"><h4>Maiores melhoras (4 trim.)</h4>
        <div class="tblwrap"><table class="data compact rankmini"><thead><tr><th>Instituição</th><th style="text-align:right">Inad.</th><th style="text-align:right">Δ inad 4T</th><th style="text-align:right">Δ carteira 4T</th></tr></thead>
        <tbody>${npl.top_melhoras.map(detRow).join("")}</tbody></table></div>
        <div class="src">${npl.limitacoes}</div></div>
    </div>`;
  }

  /* ---------- atraso por produto · setores · open finance ---------- */
  let atrasoPanel = "";
  if (P && P.produtos) {
    const rowsA = P.produtos.filter(p => p.atraso15 && p.atraso15.agg_pct != null)
      .sort((a, b) => b.atraso15.agg_pct - a.atraso15.agg_pct);
    const maxA = rowsA.length ? rowsA[0].atraso15.agg_pct : 1;
    atrasoPanel = `<div class="card"><h4>Atraso ≥15 dias por produto ${badge("observado", P.npl_nota)}</h4>
      <div class="src" style="margin-bottom:8px">vencido ≥15d ÷ carteira da modalidade · IF.data rel. 123/128 · ${fmtTri(P.data_base)} · conceito de atraso, não NPL >90d</div>
      ${rowsA.map(p => {
        const st = p.atraso15.serie || [];
        const d = st.length >= 2 ? p.atraso15.agg_pct - st[0].agg_pct : null;
        return `<div class="atrasorow" onclick="openProduct('${p.slug}')" tabindex="0" role="link" onkeydown="if(event.key==='Enter')openProduct('${p.slug}')" aria-label="abrir produto ${attr(p.nome)}">
        <span class="aname">${p.nome} <span class="src">${p.seg.toUpperCase()}</span></span>
        <span class="abarwrap"><span class="abar" style="width:${Math.max(2, p.atraso15.agg_pct / maxA * 100)}%"></span></span>
        <span class="anum">${fmt.n(p.atraso15.agg_pct, 2)}% <span class="src">${d != null ? "(" + fmt.pp(d) + " pp/4T)" : ""}</span></span></div>`;
      }).join("")}
      <div class="src" style="margin-top:8px"><a href="javascript:void(0)" onclick="nav('products')">explorar produtos de crédito →</a></div></div>`;
  }
  let setoresPanel = "";
  if (sectors && sectors.ok) {
    const tops = sectors.setores.slice(0, 8);
    setoresPanel = `<div class="card"><h4>Setores em atenção ${badge("calculado", sectors.metodo)}</h4>
      <div class="src" style="margin-bottom:6px">estresse de atividade (produção física IBGE/PIM) — não é inadimplência setorial (indisponível nas fontes públicas)</div>
      <div class="tblwrap"><table class="data compact rankmini"><thead><tr><th>Setor</th><th style="text-align:right">Score</th><th>Nível</th><th style="text-align:right">Tendência</th></tr></thead>
      <tbody>${tops.map(sx => `<tr class="clickable" onclick="openSectorPage('${sx.codigo}')" title="abrir ficha do setor">
        <td>${sx.nome.length > 42 ? sx.nome.slice(0, 42) + "…" : sx.nome}</td>
        <td style="text-align:right"><b>${fmt.n(sx.score, 1)}</b></td>
        <td><span class="qbadge ${sx.faixa === "elevado" ? "q-low" : sx.faixa === "moderado" ? "q-mid" : "q-high"}">${sx.faixa}</span></td>
        <td style="text-align:right" class="${sx.tendencia === "piorando" ? "up" : sx.tendencia === "melhorando" ? "down good" : "neutral"}">${sx.tendencia} ${sx.tendencia_valor_pp != null ? "(" + fmt.pp(sx.tendencia_valor_pp) + ")" : ""}</td></tr>`).join("")}</tbody></table></div>
      <div class="src" style="margin-top:8px"><a href="javascript:void(0)" onclick="nav('sectors')">ver todos os setores →</a></div></div>`;
  }
  let ofPanel = "";
  if (ofr && ofr.series) {
    const cons = ofr.consentimentos_atual;
    const consSerie = ofr.series.of_consentimentos_transmitidos ? ofr.series.of_consentimentos_transmitidos.obs : [];
    const cresc = consSerie.length > 4 ? (consSerie[consSerie.length - 1].v / consSerie[consSerie.length - 5].v - 1) * 100 : null;
    const chamadas = ["of_chamadas_dados_transacionais", "of_chamadas_dados_abertos", "of_chamadas_iniciacao_pagamento"]
      .map(k => ofr.series[k] ? ofr.series[k].obs[ofr.series[k].obs.length - 1].v : 0).reduce((a, b) => a + b, 0);
    const suc = ofr.series.of_sucesso_dados_transacionais ? ofr.series.of_sucesso_dados_transacionais.obs.slice(-1)[0].v : null;
    const alertaOf = (ofr.alertas_of || [])[0];
    ofPanel = `<div class="card"><h4>Open Finance ${badge("observado")}</h4>
      <div class="big" style="font-size:25px">${fmt.n0(cons.v / 1e6)} mi <small style="font-size:13px;color:var(--text-3)">consentimentos ativos</small></div>
      <div class="delta ${cresc >= 0 ? "down good" : "up"}">${cresc != null ? fmt.pp(cresc) + "% em 4 semanas" : ""}</div>
      ${sparkline(consSerie.slice(-16).map(o => o.v), 170, 30)}
      <div class="src" style="margin-top:8px;line-height:2">chamadas de API: <b>${fmt.n(chamadas / 1e9, 1)} bi/semana</b> · sucesso transacional: <b>${suc != null ? fmt.n(suc, 1) + "%" : "–"}</b> · ${ofr.participantes ? ofr.participantes.total + " organizações" : ""}<br>
      clientes únicos e conversão: <span class="seal aprox">INDISPONÍVEL</span> — a fonte não publica; volume ≠ maturidade.</div>
      ${alertaOf ? `<div class="alert ${alertaOf.severidade || "atencao"}" style="margin-top:8px;padding:7px 11px"><span class="lvl">${alertaOf.severidade || "atenção"}</span> ${alertaOf.indicador}: <b>${fmt.n(alertaOf.valor, 2)}%</b> <span class="src">(${alertaOf.regra} · ${alertaOf.persistencia_semanas} sem.)</span></div>` : ""}
      <div class="src" style="margin-top:8px"><a href="javascript:void(0)" onclick="nav('openfinance')">abrir painel do Open Finance →</a></div></div>`;
  }
  const secProdSet = (atrasoPanel || setoresPanel || ofPanel) ? `
  <div class="sechead"><h3>Produtos, setores e ecossistema</h3></div>
  <div class="ov-3col">${atrasoPanel}${setoresPanel}${ofPanel}</div>` : "";

  /* ---------- projeções (preservado) ---------- */
  const advDelta = (function () {
    const sc = state.data.scenario; if (!sc) return null;
    const adv = sc.presets && sc.presets.adverso; if (!adv) return null;
    let d = 0;
    for (const [k, shock] of Object.entries(adv)) {
      const e = sc.elasticidades[k];
      if (e && shock && e.sinal_esperado_ok !== false) d += e.value * shock;
    }
    return d;
  })();
  const projRow = (key, label, unit, comAdverso) => {
    const f = pulse.previsoes[key];
    if (!f || !f.ok) return `<tr><td>${label}</td><td colspan="3" class="src">histórico insuficiente</td></tr>`;
    const p12 = f.pontos[f.pontos.length - 1];
    return `<tr class="clickable" onclick="nav('pulse')"><td>${label} ${badge("previsao")}</td>
      <td style="text-align:right"><b>${fmt.n(p12.p50, 2)}${unit}</b></td><td style="text-align:right">${fmt.n(p12.p10, 2)} – ${fmt.n(p12.p90, 2)}${unit}</td>
      <td style="text-align:right">${comAdverso && advDelta != null ? `${fmt.n(p12.p50 + advDelta, 2)}${unit} ${badge("cenario", "preset adverso via elasticidades — condicional às hipóteses")}` : "—"}</td></tr>`;
  };
  const projPanel = `<div class="card"><h4>O que esperar — horizonte 12 meses (${segName()})</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Variável</th><th style="text-align:right">Base (p50)</th><th style="text-align:right">Banda p10–p90</th><th style="text-align:right">Adverso</th></tr></thead><tbody>
      ${projRow(`inad_${seg}`, "Inadimplência", "%", true)}
      ${projRow(`concessoes_${seg}`, "Concessões (R$ mi)", "", false)}
      ${projRow(`spread_${seg}`, "Spread médio", " p.p.", false)}
    </tbody></table></div>
    <div class="src">Bandas por quantis de resíduos de backtest (calibração conformal) · ${overview.projecoes_resumo && overview.projecoes_resumo.rj ? "RJ: " + overview.projecoes_resumo.rj.nota + " · " : ""}<a href="javascript:void(0)" onclick="nav('scenarios')">simular cenários →</a> · <a href="javascript:void(0)" onclick="nav('method')">model cards</a></div></div>`;

  /* ---------- scatter crescimento × inadimplência ---------- */
  let scatterPanel = "";
  if (npl && npl.ok) {
    const MINC = 5e9;
    const pts = npl.instituicoes.filter(i => i.carteira_brl >= MINC && i.inad_pct != null && i.cresc_carteira_4t_pct != null)
      .sort((a, b) => b.carteira_brl - a.carteira_brl).slice(0, 80)
      .map(i => ({ x: i.inad_pct, y: i.cresc_carteira_4t_pct, size: i.carteira_brl, label: i.nome.slice(0, 24), grp: i.grupo, color: SR_COLORS[i.grupo] || "#64748b" }));
    scatterPanel = `<div class="card"><h4>Expansão acelerada convive com inadimplência mais alta?</h4>
      <div class="src" style="margin-bottom:6px">Crescimento pode diluir a inadimplência no curto prazo (denominador) e revelá-la depois — associação não implica causalidade. O spread por instituição não é publicado nas fontes integradas; o cruzamento disponível é crescimento × inadimplência.</div>
      ${(function(){
        if (pts.length < 3) return "<p class='src'>dados insuficientes</p>";
        const med = arr => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
        const mx2 = med(pts.map(p2 => p2.x)), my2 = med(pts.map(p2 => p2.y));
        return scatterPlot(pts, "inadimplência >90d (%)", "crescimento da carteira 4T (%)", 640, 330,
          { sizeLabel: "carteira", labels: false, refX: mx2, refXLabel: "mediana inad.", refY: my2, refYLabel: "mediana cresc." }) +
          `<div class="src" style="margin-top:4px"><b>Quadrantes:</b> acima-direita = expansão acelerada com inadimplência alta (acompanhar de perto) · acima-esquerda = expansão com carteira saudável · abaixo-direita = inadimplência alta sem crescimento (estoque problemático) · abaixo-esquerda = conservador.</div>`;
      })()}
      <div class="legend">${[...new Set(pts.map(p => p.grp))].sort().map(gx => `<span><span class="sw" style="background:${ccol(SR_COLORS[gx] || "#64748b")};height:8px;border-radius:4px"></span>${gx}</span>`).join("")}<span class="src">área ∝ carteira · corte de relevância: carteira ≥ R$ 5 bi (declarado) · ${pts.length} instituições</span></div>
      ${chartFooter({ fonte: "BCB IF.data " + npl.data_base, periodo: fmtTri ? "" : "", atualizado: meta.gerado_em ? meta.gerado_em.slice(0, 10) : "–", unidade: "% × %", nota: npl.metodo })}
      <div class="src"><a href="javascript:void(0)" onclick="nav('compare')">comparar instituições →</a> · <a href="javascript:void(0)" onclick="nav('institutions')">painel de instituições →</a></div></div>`;
  }

  /* ---------- alertas + insight ---------- */
  const topAlerts = alerts ? alerts.alertas.slice(0, 3) : [];
  const alertsPanel = `<div class="card"><h4>Alertas e sinais <span class="src">(${alerts ? alerts.alertas.length : 0} ativos)</span></h4>
    ${topAlerts.map(a => alertHtml(a, "alerts")).join("") || "<p class='src'>nenhum alerta ativo</p>"}
    <div class="src" style="margin-top:6px"><a href="javascript:void(0)" onclick="nav('alerts')">ver todos os alertas →</a></div></div>`;

  let insightPanel = "";
  if (diag && diag.ok && ibcc && ibcc.atual) {
    const contribs = Object.entries(ibcc.atual.contribuicoes).sort((a, b) => a[1] - b[1]);
    const pior = contribs[0], melhor = contribs[contribs.length - 1];
    const lbl = c => ibcc.componentes[c] ? ibcc.componentes[c].label.toLowerCase() : c;
    insightPanel = `<div class="insight">
      <h4>Insight ${badge("calculado", "composição determinística: frase do diagnóstico + maior contribuição negativa/positiva do IBCC + contagem NPL — bases citadas")}</h4>
      <div class="itexto">${diag.frase.split(".")[0]}. O componente que mais pressiona o índice é <b>${lbl(pior[0])}</b> (${fmt.pp(pior[1])} pt); o maior suporte vem de <b>${lbl(melhor[0])}</b> (${fmt.pp(melhor[1])} pt).${npl && npl.ok ? ` Nas instituições, ${npl.sistema.subindo_no_trimestre} de ${npl.n_instituicoes} registraram alta da inadimplência no trimestre.` : ""}</div>
      <div class="src" style="margin-top:8px">Evidências: contribuições do IBCC (calculado) · IF.data ${npl && npl.ok ? npl.data_base : ""} (observado) · associação ≠ causalidade.
      <br><a href="javascript:void(0)" onclick="nav('research')">abrir pesquisa assistida →</a> · <a href="javascript:void(0)" onclick="nav('antecedentes')">indicadores antecedentes →</a></div></div>`;
  }

  /* ---------- saúde dos dados + explorar ---------- */
  const saude = (function () {
    const q = state.data.quality || {}; const vals = Object.values(q);
    const atualizadas = vals.filter(v => v.componentes.atualidade >= 70).length;
    const fs = meta.fontes_status || {};
    const falhas = Object.entries(fs).filter(([k, v]) => v && v.falhas && v.falhas.length).map(([k, v]) => k + " (" + v.falhas.length + ")");
    return `<div class="card" style="margin-top:22px"><h4>Saúde dos dados ${badge("calculado")}</h4>
      <div class="src" style="font-size:12.5px;line-height:1.9">
      <b>${vals.length}</b> séries monitoradas · <b>${fmt.n(atualizadas / Math.max(vals.length, 1) * 100, 0)}%</b> com atualidade adequada ·
      pipelines com falha na última execução: <b>${falhas.length ? falhas.join(", ") : "nenhum"}</b> ·
      componentes demonstrativos remanescentes: <b>estresse setorial (RJ/emprego) e painel demo da aba RJ</b> ·
      <a href="javascript:void(0)" onclick="nav('method')">catálogo completo e metodologia →</a></div></div>`;
  })();
  const favs = state.favorites.length ? `<span class="src" style="align-self:center">favoritos:</span>` + state.favorites.map(f =>
    `<span class="chip clickable" onclick="nav('${f.type}')">★ ${(f.label || f.key).slice(0, 24)}</span>`).join("") : "";
  const explore = `<div class="explore-strip">
    ${[["sectors", "Risco setorial"], ["institutions", "Instituições"], ["products", "Produtos de Crédito"], ["compare", "Comparador"], ["rj", "Recuperações & Falências"], ["openfinance", "Open Finance"], ["alerts", "Central de alertas"], ["research", "Pesquisa"]].map(([v, l]) =>
      `<span class="chip clickable" onclick="nav('${v}')" tabindex="0" role="link" onkeydown="if(event.key==='Enter')nav('${v}')">${l} →</span>`).join("")}
    ${favs}</div>`;

  // primeiro uso: carta "comece por aqui" (dispensável; nunca volta depois)
  const boasVindas = !loadLS("obc_boas_vindas_ok", false) ? `
  <div class="card" style="margin-bottom:18px;border-left:3px solid var(--accent)">
    <h4 style="display:flex;justify-content:space-between;gap:10px"><span>Comece por aqui</span>
      <a href="javascript:void(0)" class="src" onclick="ovDispensarBoasVindas()">dispensar</a></h4>
    <p class="src" style="max-width:900px">Esta página resume as condições de crédito e é personalizável (botão "personalizar página"). Quatro portas de entrada respondem as perguntas mais comuns:</p>
    <div class="chips" style="margin-top:8px">
      <span class="chip clickable" onclick="nav('panorama');ovDispensarBoasVindas()" tabindex="0" role="link">Como está o crédito no meu estado? →</span>
      <span class="chip clickable" onclick="nav('juros');ovDispensarBoasVindas()" tabindex="0" role="link">Qual banco cobra menos em cada modalidade? →</span>
      <span class="chip clickable" onclick="nav('compare');ovDispensarBoasVindas()" tabindex="0" role="link">Comparar instituições lado a lado →</span>
      <span class="chip clickable" onclick="nav('leading');ovDispensarBoasVindas()" tabindex="0" role="link">Há sinais de estresse à frente? →</span>
    </div>
    <div class="src" style="margin-top:8px">Todo número tem fonte, período e limitações declaradas — <a href="javascript:void(0)" onclick="nav('method')">metodologia completa</a>. Alertas com regra publicada ficam na aba Alertas (com RSS).</div>
  </div>` : "";
  const cfgBlocos = ovBlocosCfg();
  const HTML_BLOCOS = {
    diagnostico: `<div class="ov-hero">${diagcard}${heroStrip}</div>${segNote}`,
    condicoes: secCondicoes,
    inad: secNpl,
    prodset: secProdSet,
    proj: `<div class="sechead"><h3>Projeções, relações e sinais</h3></div>
  <div class="ov-2col">${scatterPanel}<div style="display:flex;flex-direction:column;gap:22px">${projPanel}${alertsPanel}</div></div>`,
    insight: `<div style="margin-top:22px">${insightPanel}</div>`,
    saude,
    explore,
  };
  const painelPersonalizar = ovPersonalizando ? `
  <div class="card" style="margin-bottom:18px">
    <h4>Personalizar a Visão geral</h4>
    <p class="src">Escolha o que esta página mostra. A preferência fica salva neste navegador. O padrão é a leitura simples: diagnóstico, condições de crédito e acesso rápido; todo o resto continua a um clique nas abas.</p>
    <div class="chips" style="margin:10px 0">
      ${OV_BLOCOS.map(([k, l]) => `<label class="chip" style="cursor:pointer;user-select:none"><input type="checkbox" ${cfgBlocos[k] ? "checked" : ""} onchange="ovBlocoSet('${k}', this.checked)" style="margin-right:6px;vertical-align:middle">${l}</label>`).join("")}
    </div>
    <button class="btn ghost small" onclick="ovPreset('simples')">padrão simples</button>
    <button class="btn ghost small" onclick="ovPreset('completo')">tudo visível</button>
    <button class="btn ghost small" onclick="ovTogglePersonalizar()">fechar</button>
  </div>` : "";
  const ocultas = OV_BLOCOS.filter(([k]) => !cfgBlocos[k]).map(([, l]) => l);
  const rodapeOcultas = ocultas.length && !ovPersonalizando
    ? `<div class="src" style="margin-top:18px">Seções ocultas nesta página: ${ocultas.join(" · ")} · <a href="javascript:void(0)" onclick="ovTogglePersonalizar()">personalizar</a></div>`
    : "";
  el.innerHTML = pagehead + boasVindas + painelPersonalizar +
    OV_BLOCOS.filter(([k]) => cfgBlocos[k]).map(([k, l]) =>
      (OV_BLOCO_DATA[k] || []).some(f => state.data[f] === undefined) ? loadingCard(l.toLowerCase()) : HTML_BLOCOS[k]
    ).join("\n") +
    rodapeOcultas;
}

function ibccPositionFrom(ibcc) {
  if (!ibcc || !ibcc.ok) return null;
  const vals = {};
  ibcc.serie.forEach(p => { vals[p.ref] = p.valor; });
  const refs = Object.keys(vals).sort();
  const cur = vals[refs[refs.length - 1]];
  const back = n => refs.length > n ? vals[refs[refs.length - 1 - n]] : null;
  const allv = Object.values(vals);
  const pct = allv.filter(v => v < cur).length / Math.max(allv.length - 1, 1) * 100;
  const r = (a, b) => a != null && b != null ? Math.round((a - b) * 100) / 100 : null;
  return { atual: cur, ref: refs[refs.length - 1], percentil_historico: Math.round(pct * 10) / 10,
           delta_1m: r(cur, back(1)), delta_3m: r(cur, back(3)), delta_12m: r(cur, back(12)) };
}

function inadFanChart(seg) {
  const { pulse } = state.data;
  seg = seg || "total";
  const inad = pulse.series[`inad_${seg}`];
  const fInad = pulse.previsoes[`inad_${seg}`];
  if (!inad) return "<p class='src'>sem dados</p>";
  const last = inad.obs[inad.obs.length - 1];
  const hist = inad.obs.slice(-48).map(o => ({ x: o.ref, y: o.v }));
  const series = [{ pts: hist, color: "#1d4e89", label: "inadimplência" }];
  let band = null;
  if (fInad && fInad.ok) {
    series.push({ pts: [{ x: last.ref, y: last.v }, ...fInad.pontos.map(p => ({ x: p.ref_date, y: p.p50 }))], color: "#1d4e89", dash: "5,4", label: "previsão p50" });
    band = { pts: [{ x: last.ref, lo: last.v, hi: last.v }, ...fInad.pontos.map(p => ({ x: p.ref_date, lo: p.p10, hi: p.p90 }))] };
  }
  const annotations = (function () {
    const rg = state.data.regimes;
    if (!rg || !rg.series) return [];
    const rs = rg.series.find(x => x.serie === `inad_${seg}`);
    if (!rs) return [];
    const out2 = [];
    if (rs.quebra_estrutural && rs.quebra_estrutural.significativa) out2.push({ x: rs.quebra_estrutural.data_quebra, label: "quebra de regime", color: "#b45309" });
    if (rs.cusum && rs.cusum.ultimo_disparo) out2.push({ x: rs.cusum.ultimo_disparo.data, label: "CUSUM " + rs.cusum.ultimo_disparo.direcao, color: "#6b46a3" });
    return out2;
  })();
  return `<div class="legend"><span><span class="sw" style="background:var(--c-line1)"></span>observado (linha contínua)</span><span>― ― previsão p50</span><span><span class="sw" style="background:var(--c-band);height:10px"></span>banda p10–p90</span>${annotations.length ? '<span class="src">marcadores = eventos estatísticos (hipóteses, não fatos)</span>' : ""}</div>`
    + lineChart({ series, band, h: 220, forecastStart: last.ref, annotations, aria: "inadimplência com projeção", unit: "%", fonte: inad.meta.source + " " + inad.meta.series_code, status: "observado + previsão" })
    + chartFooter({ fonte: inad.meta.source + " série " + inad.meta.series_code, periodo: `${fmt.my(inad.obs[Math.max(0, inad.obs.length - 48)].ref)}–${fmt.my(last.ref)} + 12m projetados`, atualizado: inad.meta.last_collected_at ? inad.meta.last_collected_at.slice(0, 10) : "–", unidade: inad.meta.unit, nota: fInad && fInad.ok ? fInad.metodo : "" });
}

/* ---------- PULSO DO CRÉDITO ---------- */
const PULSE_SECTIONS = [
  { title: "1 · Oferta (estoque e fluxo)", cards: [
    { key: "saldo", title: "Saldo da carteira (estoque)", fmt: v => "R$ " + fmt.triFromMi(v) },
    { key: "concessoes", title: "Concessões mensais (fluxo)", fmt: v => "R$ " + fmt.bi(v) }] },
  { title: "2 · Preço", cards: [
    { key: "taxa", title: "Taxa média de juros", fmt: v => fmt.n(v, 1) + "% a.a." },
    { key: "spread", title: "Spread médio", fmt: v => fmt.n(v, 1) + " p.p." }] },
  { title: "3 · Qualidade", cards: [
    { key: "inad", title: "Inadimplência >90d", fmt: v => fmt.n(v) + "%" }] },
];
function renderPulse() {
  const el = document.getElementById("view-pulse");
  const { pulse } = state.data;
  if (!pulse) { el.innerHTML = "<p>sem dados</p>"; return; }
  const f = state.filters;
  const segLabel = segName();

  const cardHtml = c => {
    const s = pulse.series[`${c.key}_${f.seg}`];
    if (!s) return "";
    const last = s.obs[s.obs.length - 1];
    const yoySeries = f.growth === "real" && s.yoy_real ? s.yoy_real : s.yoy;
    const yoy = yoySeries && yoySeries.length ? yoySeries[yoySeries.length - 1].v : null;
    const fc = pulse.previsoes[`${c.key}_${f.seg}`];
    const series = [{ pts: s.obs.slice(-f.range).map(o => ({ x: o.ref, y: o.v })), color: "#1d4e89", label: c.title.toLowerCase() }];
    let band = null;
    if (fc && fc.ok) {
      series.push({ pts: [{ x: last.ref, y: last.v }, ...fc.pontos.map(p => ({ x: p.ref_date, y: p.p50 }))], color: "#1d4e89", dash: "5,4", label: "previsão p50" });
      band = { pts: [{ x: last.ref, lo: last.v, hi: last.v }, ...fc.pontos.map(p => ({ x: p.ref_date, lo: p.p10, hi: p.p90 }))] };
    }
    const growthLabel = f.growth === "real" && s.yoy_real ? "a/a real (defl. IPCA)" : "a/a nominal";
    const rgs = state.data.regimes && state.data.regimes.series ? state.data.regimes.series.find(x => x.serie === `${c.key}_${f.seg}`) : null;
    const annotations = [];
    if (rgs && rgs.quebra_estrutural && rgs.quebra_estrutural.significativa) annotations.push({ x: rgs.quebra_estrutural.data_quebra, label: "quebra de regime", color: "#b45309" });
    if (rgs && rgs.cusum && rgs.cusum.ultimo_disparo) annotations.push({ x: rgs.cusum.ultimo_disparo.data, label: "CUSUM " + rgs.cusum.ultimo_disparo.direcao, color: "#6b46a3" });
    return `<div class="card">
      <h4>${c.title}${c.key === "inad" ? " " + inadChip("sgs") : ""} — ${segLabel} ${badge("observado")}${fc && fc.ok ? " " + badge("previsao") : ""} ${favStar("pulse", `${c.key}_${f.seg}`, `${c.title} ${segLabel}`)}</h4>
      <div class="big">${c.fmt(last.v)}</div>
      <div class="delta ${yoy > 0 ? "up" : "down"} ${c.key === "saldo" || c.key === "concessoes" ? (yoy > 0 ? "good" : "bad") : ""}">${yoy != null ? (yoy > 0 ? "▲" : "▼") + " " + fmt.n(Math.abs(yoy), 1) + "% " + growthLabel : ""} · ref. ${fmt.my(last.ref)}</div>
      ${lineChart({ series, band, h: 160, forecastStart: fc && fc.ok ? last.ref : null, annotations, unit: s.meta.unit, fonte: s.meta.source + " " + s.meta.series_code, status: "observado" + (fc && fc.ok ? " + previsão" : "") })}
      ${annotations.length ? `<div class="src">marcadores no gráfico = eventos estatísticos detectados (aba Antecedentes) — hipóteses, não fatos.</div>` : ""}
      ${fc && fc.ok ? `<div class="src">projeção 12m ${badge("previsao")}: <b>${c.fmt(fc.pontos[fc.pontos.length - 1].p50)}</b> [${c.fmt(fc.pontos[fc.pontos.length - 1].p10)} – ${c.fmt(fc.pontos[fc.pontos.length - 1].p90)}] · ganho vs. ingênuo (h=12): ${fc.diagnostico["12"].ganho_vs_naive_pct ?? "–"}%</div>` : ""}
      ${chartFooter({ fonte: s.meta.source + " " + s.meta.series_code, periodo: `${fmt.my(s.obs[Math.max(0, s.obs.length - f.range)].ref)}–${fmt.my(last.ref)}`, atualizado: s.meta.last_collected_at ? s.meta.last_collected_at.slice(0, 10) : "–", unidade: s.meta.unit, nota: s.meta.methodology })}
      ${srcLine(s.meta, s.qualidade)}
      <button class="btn ghost small" onclick="exportSeries('${c.key}_${f.seg}')">exportar CSV</button>
    </div>`;
  };

  const sections = PULSE_SECTIONS.map(sec => `<h3>${sec.title}</h3><div class="grid g2">${sec.cards.map(cardHtml).join("")}</div>`).join("");

  // 4 · composição
  const sp = pulse.series.saldo_pf, sj = pulse.series.saldo_pj;
  let compHtml = "";
  if (sp && sj) {
    const share = sp.obs.slice(-f.range).map((o, i) => {
      const tot = o.v + (sj.obs[sj.obs.length - Math.min(f.range, sp.obs.length) + i] ? sj.obs[sj.obs.length - Math.min(f.range, sp.obs.length) + i].v : 0);
      return { x: o.ref, y: tot ? o.v / tot * 100 : null };
    });
    compHtml = `<h3>4 · Composição</h3><div class="grid g2">
      <div class="card"><h4>Participação PF no saldo total ${badge("calculado", "saldo PF ÷ (saldo PF + saldo PJ)")}</h4>
      ${lineChart({ series: [{ pts: share, color: "#0e7c7b", label: "participação PF" }], h: 140, unit: "%", fonte: "BCB/SGS (calculado)", status: "calculado" })}
      ${chartFooter({ fonte: "BCB/SGS 20540+20541 (calculado)", periodo: `${fmt.my(share[0].x)}–${fmt.my(share[share.length - 1].x)}`, atualizado: sp.meta.last_collected_at ? sp.meta.last_collected_at.slice(0, 10) : "–", unidade: "%", nota: "Razão entre séries observadas; não é série publicada pelo BCB." })}</div>
      ${["credito_pib", "endividamento", "comprometimento"].map(k => extraCard(k)).join("")}
    </div>`;
  }
  const extras = ["selic_meta", "ipca", "ibc_br", "desemprego", "papelao", "cambio"].map(k => extraCard(k)).join("");

  el.innerHTML = `
  ${pageHead({ title: "Pulso do crédito",
    desc: "Séries oficiais do BCB organizadas em oferta → preço → qualidade → composição, com projeções e bandas. Estoque (saldo) e fluxo (concessões) claramente separados.",
    fontes: "BCB/SGS (códigos validados por série)" })}
  <div class="controls">
    ${segTabs()}
    <span class="seg">${[[24, "2 anos"], [60, "5 anos"], [200, "máx."]].map(([n, l]) => `<button class="${f.range === n ? "active" : ""}" onclick="setFilter('range',${n})">${l}</button>`).join("")}</span>
    <span class="seg">${[["nominal", "nominal"], ["real", "real (IPCA)"]].map(([k, l]) => `<button class="${f.growth === k ? "active" : ""}" onclick="setFilter('growth','${k}')">${l}</button>`).join("")}</span>
    <button class="btn ghost small" onclick="window.print()">🖨 apresentação / PDF</button>
  </div>
  ${sections}
  ${compHtml}
  <h3>Contexto macro</h3>
  <div class="grid g3">${extras}</div>
  <div class="note">Renegociação, provisões, cobertura e baixas para prejuízo dependem de séries SGS adicionais — mapeadas no <a href="#method" onclick="nav('method')">catálogo</a> como pendências da Fase 1.</div>`;
}
function extraCard(k) {
  const s = state.data.pulse.series[k];
  if (!s) return "";
  const last = s.obs[s.obs.length - 1];
  return `<div class="card"><h4>${s.meta.name} ${badge("observado")} ${favStar("pulse", k, s.meta.name)}</h4>
    <div class="big" style="font-size:20px">${fmt.n(last.v, 2)} <span style="font-size:12px;color:var(--text-3)">${s.meta.unit}</span></div>
    ${lineChart({ series: [{ pts: s.obs.slice(-state.filters.range).map(o => ({ x: o.ref, y: o.v })), color: "#0e7c7b", label: s.meta.name }], h: 110, unit: s.meta.unit, fonte: s.meta.source + " " + s.meta.series_code, status: "observado" })}
    ${chartFooter({ fonte: s.meta.source + " " + s.meta.series_code, periodo: `até ${fmt.my(last.ref)}`, atualizado: s.meta.last_collected_at ? s.meta.last_collected_at.slice(0, 10) : "–", unidade: s.meta.unit, nota: s.meta.methodology })}
    <button class="btn ghost small" onclick="exportSeries('${k}')">exportar CSV</button></div>`;
}

/* ---------- INDICADORES ANTECEDENTES ---------- */
function renderAntecedentes() {
  const el = document.getElementById("view-antecedentes");
  const { antecedentes, regimes } = state.data;
  if (!antecedentes || !antecedentes.targets) { el.innerHTML = "<p>sem dados — rode o pipeline v0.3</p>"; return; }
  const seg = state.filters.seg;
  const tgtKey = `inad_${seg}`;
  const r = antecedentes.targets[tgtKey] || antecedentes.targets.inad_total;
  const statusSeal = s => s === "promovido" ? `<span class="seal obs">PROMOVIDO</span>` :
    s === "em triagem" ? `<span class="seal exp">EM TRIAGEM</span>` : `<span class="seal desc" style="text-decoration:none">REPROVADO</span>`;
  const crit = ok => ok ? "✓" : "✗";
  const rows = r.candidatos.map(c => `
    <tr>
      <td><b>${c.candidato}</b> <span class="src">(${c.transformacao})</span><div class="src" style="max-width:260px">${c.racional}</div></td>
      <td>${statusSeal(c.status)}<div class="src">${c.criterios_atendidos} critérios</div></td>
      <td>${c.melhor_defasagem_meses}m</td>
      <td>${c.correlacao_melhor_defasagem > 0 ? "+" : ""}${fmt.n(c.correlacao_melhor_defasagem, 2)}</td>
      <td class="${c.criterios.granger_5pct ? "down good" : "neutral"}">${crit(c.criterios.granger_5pct)} <span class="src">F=${c.granger_F ?? "–"}</span></td>
      <td class="${c.criterios.ganho_oos ? "down good" : "neutral"}">${crit(c.criterios.ganho_oos)} <span class="src">${c.ganho_oos_pct != null ? fmt.pp(c.ganho_oos_pct) + "%" : "–"}</span></td>
      <td class="${c.estavel ? "down good" : "neutral"}">${crit(c.estavel)} <span class="src">${fmt.n(c.estabilidade_metade1, 2)} / ${fmt.n(c.estabilidade_metade2, 2)}</span></td>
      <td><details class="decomp"><summary>CCF</summary>${c.ccf.map(p => `<div class="contrib"><span class="lbl" style="width:50px">k=${p.lag}</span><span class="bar ${(p.corr || 0) >= 0 ? "pos" : "neg"}" style="width:${Math.abs(p.corr || 0) * 120}px"></span><span class="num">${fmt.n(p.corr, 2)}</span></div>`).join("")}</details></td>
    </tr>`).join("");
  const regRows = regimes && regimes.series ? regimes.series.map(s => {
    const br = s.quebra_estrutural;
    const cs = s.cusum;
    return `<tr>
      <td>${s.label}</td>
      <td class="${s.estado_hipotese.includes("deterior") ? "up" : s.estado_hipotese.includes("melhora") ? "down good" : "neutral"}">${s.estado_hipotese}</td>
      <td>${br ? `${fmt.my(br.data_quebra)} ${br.significativa ? "(significativa)" : "(não significativa)"}<div class="src">sup-F ${br.supF} vs. ${br.critico_5pct_aprox} · média ${fmt.n(br.media_antes)} → ${fmt.n(br.media_depois)}</div>` : "–"}</td>
      <td class="src">${cs && cs.ultimo_disparo ? `${fmt.my(cs.ultimo_disparo.data)} (${cs.ultimo_disparo.direcao})` : "sem disparo"}</td>
    </tr>`;
  }).join("") : "";
  el.innerHTML = `
  ${pageHead({ title: "Indicadores antecedentes", seals: badge("calculado"),
    desc: "Protocolo de promoção com 4 critérios (defasagem, Granger, ganho fora da amostra, estabilidade) — candidatos aprovados e reprovados são declarados.",
    fontes: "BCB/SGS, Ipeadata (papelão ondulado)" })}
  <div class="controls">${segTabs()}<span class="src">alvo: Δ mensal da inadimplência ${segName()}</span></div>
  <div class="tblwrap"><table class="data"><thead><tr><th>Candidato / racional</th><th>Status</th><th>Defasagem</th><th>Correlação</th><th>Granger 5%</th><th>Ganho OOS</th><th>Estável</th><th>Correlograma</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="note"><b>Método:</b> ${r.metodo}<br><b>Limitações:</b> ${r.limitacoes}</div>
  <h3>Detecção de regimes ${badge("calculado", "hipóteses estatísticas, não fatos")}</h3>
  <p class="viewdesc">Mudança de regime é tratada como <b>hipótese estatística</b> — sujeita a revisão de dados e a erro dos detectores.</p>
  <div class="tblwrap"><table class="data"><thead><tr><th>Série (transformada)</th><th>Estado (hipótese)</th><th>Quebra estrutural (sup-F)</th><th>Último disparo CUSUM</th></tr></thead><tbody>${regRows}</tbody></table></div>
  ${regimes ? `<div class="note"><b>Método:</b> ${regimes.metodo}<br><b>Limitações:</b> ${regimes.limitacoes}</div>` : ""}`;
}

/* ---------- SETORES ---------- */
function renderSectors() {
  const el = document.getElementById("view-sectors");
  const { sectors, pulse } = state.data;
  if (!sectors || !sectors.ok) { el.innerHTML = "<p>sem dados setoriais</p>"; return; }
  const rows = sectors.setores.map(s => `
    <tr>
      <td>${s.nome} ${favStar("sectors", s.codigo, s.nome)}<br><button class="btn ghost small" onclick="openSectorPage('${s.codigo}')">ficha do setor →</button></td>
      <td><span class="scorebar"><i style="left:${s.score * 0.9}px"></i></span> <b>${s.score}</b><div class="src">${s.faixa}</div></td>
      <td class="${s.tendencia === "piorando" ? "up" : s.tendencia === "melhorando" ? "down good" : "neutral"}">${s.tendencia} <span class="src">(${fmt.pp(s.tendencia_valor_pp)} p.p./3m)</span></td>
      <td class="${s.velocidade === "momento piorando" ? "up" : s.velocidade === "momento melhorando" ? "down good" : "neutral"}">${s.velocidade} <span class="src">(${fmt.pp(s.velocidade_valor_pp)} p.p.)</span></td>
      <td>${fmt.n(s.yoy_producao_pct, 1)}% <span class="src">(${fmt.my(s.ref)})</span></td>
      <td><details class="decomp"><summary>ficha</summary>
        <h5>Contribuições para o score (waterfall)</h5>
        ${Object.entries(s.contribuicoes).map(([k, v]) => contribBar(k.replace(/_/g, " ") + (s.componentes[k].status === "demonstrativo" ? " ⚠demo" : ""), v, 6)).join("")}
        <h5>Componentes</h5>
        ${Object.entries(s.componentes).map(([k, c]) => `<div class="contrib"><span class="lbl">${k.replace(/_/g, " ")} ${c.status === "demonstrativo" ? badge("demo") : badge("observado")}</span><span class="num">z=${fmt.n(c.z, 2)} · peso ${c.peso} · ${c.fonte}</span></div>`).join("")}
        <div class="src" style="margin-top:6px">Drill-down: <a href="#institutions" onclick="nav('institutions')">instituições expostas</a> (corte por setor na Fase 3) · <a href="#rj" onclick="nav('rj')">recuperações do setor</a></div>
      </details></td>
    </tr>`).join("");
  const papel = pulse && pulse.series.papelao;
  el.innerHTML = `
  ${pageHead({ title: "Risco setorial",
    desc: "Score de estresse por atividade a partir da produção física (IBGE/PIM) — não é inadimplência setorial (indisponível nas fontes públicas). Cada setor abre uma ficha completa.",
    fontes: "IBGE/PIM-PF, BCB IF.data (exposições)" })}
  <div class="note warn"><b>Transparência:</b> ${sectors.aviso_demo}<br>Método: ${sectors.metodo}<br>Limitações: ${sectors.limitacoes}</div>
  <div class="tblwrap"><table class="data"><thead><tr><th>Atividade (CNAE/PIM)</th><th>Nível</th><th>Tendência</th><th>Velocidade</th><th>Produção a/a</th><th>Ficha</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${renderExposuresSection()}
  ${papel ? `<h3>Indicador antecedente em triagem</h3>
  <div class="grid g2"><div class="card"><h4>${papel.meta.name} ${badge("observado")} <span class="seal aprox">ANTECEDENTE EM TRIAGEM</span></h4>
  ${lineChart({ series: [{ pts: papel.obs.slice(-72).map(o => ({ x: o.ref, y: o.v })), color: "#0e7c7b" }], h: 160 })}
  ${chartFooter({ fonte: papel.meta.source + " " + papel.meta.series_code, periodo: `até ${fmt.my(papel.obs[papel.obs.length - 1].ref)}`, atualizado: papel.meta.last_collected_at ? papel.meta.last_collected_at.slice(0, 10) : "–", unidade: papel.meta.unit, nota: "Promoção a antecedente exige ganho fora da amostra e estabilidade (Fase 2)." })}
  </div></div>` : ""}`;
}

function renderExposuresSection() {
  const ex = state.data.exposures;
  if (!ex || !ex.ok) return "";
  const nice = s => s.replace(/_/g, " ").replace(/\b\w/, c => c.toUpperCase()).slice(0, 46);
  const rows = Object.entries(ex.setores).map(([slug, s]) => `
    <tr>
      <td>${nice(slug)}</td>
      <td>${fmt.money(s.total_brl)}</td>
      <td>${s.top_volume.slice(0, 3).map(i => `${i.nome.slice(0, 18)} (${fmt.money(i.volume_brl)})`).join("<br>")}</td>
      <td>${s.top_exposicao_relativa.slice(0, 3).map(i => `<span class="clickable" onclick="nav('institutions')">${i.nome.slice(0, 18)}</span> (${i.share_da_propria_carteira_pj_pct}% da própria carteira PJ)`).join("<br>")}</td>
    </tr>`).join("");
  return `
  <h3>Exposição do sistema bancário por setor (CNAE) ${badge("observado")}</h3>
  <p class="viewdesc">Carteira PJ real por atividade econômica, agregada das instituições que reportam o detalhamento (IF.data ${ex.anomes}). Participação PME no sistema: <b>${ex.pme_share_sistema_pct}%</b> (micro+pequena / carteira PJ classificada por porte).</p>
  <div class="tblwrap"><table class="data"><thead><tr><th>Setor (CNAE, 9 grupos)</th><th>Carteira do sistema</th><th>Maiores credores (volume)</th><th>Maior exposição relativa</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="note"><b>Método:</b> ${ex.metodo}<br><b>Limitações:</b> ${ex.limitacoes}</div>
  <h3>Crédito a micro e pequenas empresas — participação na carteira PJ ${badge("observado")}</h3>
  <div class="grid g2"><div class="card">${ex.ranking_pme.slice(0, 10).map(x => `<div class="contrib"><span class="lbl" style="width:210px">${x.nome.slice(0, 30)}</span><span class="bar pos" style="width:${x.pme_share_pct}px"></span><span class="num">${x.pme_share_pct}% <span class="src">(PJ ${fmt.money(x.carteira_pj_brl)})</span></span></div>`).join("")}
  <div class="src">apenas carteiras PJ ≥ R$ 1 bi · fonte IF.data ${ex.anomes}</div></div></div>`;
}


/* ---------- FICHA DO SETOR ---------- */
function renderSectorPage() {
  const el = document.getElementById("view-sector");
  const sec = state.data.sectors;
  const cod = state.filters.sectorCod;
  const s = sec && sec.ok ? (sec.setores.find(x => x.codigo === cod) || null) : null;
  if (!s) { el.innerHTML = "<p>ficha de setor indisponível — <a onclick=\"nav('sectors')\" class='clickable'>voltar</a></p>"; return; }
  const ex = state.data.exposures;
  const mapExpo = { "129316": "industrias_de_transformacao", "129315": "industrias_extrativas" };
  const expoKey = mapExpo[s.codigo];
  const expo = ex && ex.ok && expoKey ? ex.setores[expoKey] : null;
  el.innerHTML = `
  <div class="controls"><button class="btn ghost small" onclick="nav('sectors')">← setores</button>
  <span class="src">Risco setorial › <b>${s.nome}</b> · ref. ${fmt.my(s.ref)}</span></div>
  <h2>${s.nome}</h2>
  <div class="grid g3">
    <div class="card"><h4>Nível de risco ${badge("calculado")}</h4><div class="big">${s.score}</div>
      <div class="delta neutral">${s.faixa} · tendência: <b>${s.tendencia}</b> (${fmt.pp(s.tendencia_valor_pp)} p.p./3m) · velocidade: ${s.velocidade}</div>
      <span class="scorebar" style="width:150px"><i style="left:${s.score * 1.5}px"></i></span></div>
    <div class="card"><h4>Decomposição do score</h4>
      ${Object.entries(s.contribuicoes).map(([k, v]) => contribBar(k.replace(/_/g, " ") + (s.componentes[k].status === "demonstrativo" ? " ⚠demo" : ""), v, 6)).join("")}
      <div class="src">${Object.entries(s.componentes).map(([k, c]) => `${k.replace(/_/g, " ")}: ${c.fonte}`).join(" · ")}</div></div>
    <div class="card"><h4>Antecedentes e previsão</h4>
      <p class="src">Antecedentes promovidos (agregado): spread (6m) e Selic (8m) — aba Antecedentes; triagem setorial específica na Fase 2b.</p>
      <p class="src"><b>Previsão setorial:</b> informação não disponível — modelos por setor entram após Caged/RJ setoriais reais.</p></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h4>Produção física (nível) ${badge("observado")}</h4>
      ${lineChart({ series: [{ pts: s.serie_obs.map(o => ({ x: o.ref, y: o.v })), color: "#1d4e89", label: "produção física" }], h: 160, unit: "índice 2022=100", fonte: "IBGE PIM-PF", status: "observado" })}
      ${chartFooter({ fonte: "IBGE PIM-PF (8888/12606)", periodo: `${fmt.my(s.serie_obs[0].ref)}–${fmt.my(s.ref)}`, atualizado: state.data.meta ? state.data.meta.gerado_em.slice(0, 10) : "–", unidade: "índice 2022=100", nota: "sem ajuste sazonal" })}</div>
    <div class="card"><h4>Crescimento interanual ${badge("calculado")}</h4>
      ${lineChart({ series: [{ pts: s.serie_yoy.map(o => ({ x: o.ref, y: o.v })), color: "#0e7c7b", label: "crescimento a/a" }], h: 160, hlines: [{ y: 0, color: "#aaa" }], unit: "%", fonte: "IBGE PIM-PF (calculado)", status: "calculado" })}
      ${chartFooter({ fonte: "IBGE PIM-PF (calculado)", periodo: "var. % vs. mesmo mês do ano anterior", atualizado: "", unidade: "%", nota: "yoy mitiga sazonalidade" })}</div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h4>Exposição das instituições ao setor ${expo ? badge("observado") : ""}</h4>
      ${expo ? `<div class="src">Carteira do sistema no grupo CNAE correspondente: <b>${fmt.money(expo.total_brl)}</b> (IF.data ${ex.anomes})</div>
        <div class="src" style="margin-top:4px"><b>Maiores credores:</b><br>${expo.top_volume.map(i => `<span class="clickable" onclick="openInstPage('${i.cod_inst}')">${i.nome.slice(0, 26)}</span> — ${fmt.money(i.volume_brl)}`).join("<br>")}</div>`
      : `<p class="src">Este recorte do PIM não tem correspondente direto nos 9 grupos CNAE das carteiras (apenas transformação e extrativas têm) — exposição não exibida para evitar atribuição indevida.</p>`}</div>
    <div class="card"><h4>Recuperações judiciais do setor</h4>
      <p class="src">Informação não disponível nas fontes públicas integradas: o DataJud não traz CNAE dos processos. Normalização por nº de empresas/estoque de crédito entra com Receita/SCR (fase futura). O componente setorial de RJ do score permanece demonstrativo e sinalizado.</p></div>
  </div>`;
}
window.openSectorPage = cod => { state.filters.sectorCod = cod; saveLS("obc_filters", state.filters); showView("sector"); };

/* ---------- RECUPERAÇÕES & FALÊNCIAS ---------- */
function rjRealSection() {
  const rj = state.data.rj;
  const sr = rj.series_reais;
  if (!sr || !Object.keys(sr).length) return "";
  const block = (slug, titulo) => {
    const s = sr[slug];
    if (!s || !s.agregado) return "";
    const agg = s.agregado;
    const last = agg.obs[agg.obs.length - 1];
    const fc2 = s.previsao;
    const series = [{ pts: agg.obs.map(o => ({ x: o.ref, y: o.v })), color: "#1d4e89", label: "processos/mês" }];
    let band = null;
    if (fc2 && fc2.ok) {
      series.push({ pts: [{ x: last.ref, y: last.v }, ...fc2.pontos.map(p => ({ x: p.ref_date, y: p.p50 }))], color: "#1d4e89", dash: "5,4", label: "previsão p50" });
      band = { pts: [{ x: last.ref, lo: last.v, hi: last.v }, ...fc2.pontos.map(p => ({ x: p.ref_date, lo: p.p10, hi: p.p90 }))] };
    }
    const yoy = agg.yoy && agg.yoy.length ? agg.yoy[agg.yoy.length - 1].v : null;
    const tribs = Object.entries(s.por_tribunal || {});
    return `<div class="card">
      <h4>${titulo} — agregado ${s.cobertura} ${badge("observado")}${fc2 && fc2.ok ? " " + badge("previsao") : ""}</h4>
      <div class="big">${fmt.n0(last.v)} <span style="font-size:13px;color:var(--text-3)">processos em ${fmt.my(last.ref)}</span></div>
      ${yoy != null ? `<div class="delta ${yoy > 0 ? "up" : "down good"}">${yoy > 0 ? "▲" : "▼"} ${fmt.n(Math.abs(yoy), 1)}% a/a</div>` : ""}
      ${lineChart({ series, band, h: 170, forecastStart: fc2 && fc2.ok ? last.ref : null, unit: "processos", fonte: agg.meta.source, status: "observado" + (fc2 && fc2.ok ? " + previsão" : ""), dec: 0 })}
      ${fc2 && fc2.ok ? `<div class="src">projeção 12m ${badge("previsao")}: <b>${fmt.n0(fc2.pontos[fc2.pontos.length - 1].p50)}</b> [${fmt.n0(fc2.pontos[fc2.pontos.length - 1].p10)}–${fmt.n0(fc2.pontos[fc2.pontos.length - 1].p90)}] processos/mês</div>` : ""}
      ${chartFooter({ fonte: agg.meta.source + " (" + agg.meta.series_code + ")", periodo: `${fmt.my(agg.obs[0].ref)}–${fmt.my(last.ref)}`, atualizado: agg.meta.last_collected_at ? agg.meta.last_collected_at.slice(0, 10) : "–", unidade: agg.meta.unit, nota: agg.meta.methodology })}
      <details class="decomp"><summary>por tribunal (${tribs.length})</summary>
        ${tribs.map(([t, p]) => `<div style="margin-top:6px"><b>${t}</b> — último mês: ${fmt.n0(p.obs[p.obs.length - 1].v)}${sparkline(p.obs.slice(-36).map(o => o.v), 180, 26)}</div>`).join("")}
      </details>
      <button class="btn ghost small" onclick="exportRJ('${slug}')">exportar CSV</button>
    </div>`;
  };
  let casos = "";
  const cr = rj.casos_reais;
  if (cr && cr.fichas && cr.fichas.length) {
    casos = `<h3>Fichas reais — processos com publicação nos últimos ${cr.janela_dias} dias ${badge("observado", cr.metodo)}</h3>
    <div class="note"><b>Método:</b> ${cr.metodo}<br><b>Limitações:</b> ${cr.limitacoes}</div>
    ${cr.fichas.slice(0, 30).map(c => `
    <details class="decomp card" style="margin-bottom:6px">
      <summary><b>${c.empresas[0] || "—"}</b>${c.empresas.length > 1 ? ` (+${c.empresas.length - 1})` : ""} · ${c.tribunal} · ${c.classe} · últ. publicação ${c.ultima_publicacao ? c.ultima_publicacao.slice(0, 10) : "–"}</summary>
      <div class="src" style="margin-top:6px">
        <b>Processo:</b> ${c.numero_processo} · <b>Órgão:</b> ${c.orgao || "–"}<br>
        <b>Empresas identificadas:</b> ${c.empresas.join("; ")}<br>
        ${c.cnpjs.length ? `<b>CNPJ (regex do texto oficial):</b> ${c.cnpjs.join(", ")}<br>` : ""}
        ${c.valor_mencionado ? `<b>Valor mencionado no ato ${badge("estimado", "valor citado na publicação — NÃO é o passivo total")}:</b> R$ ${c.valor_mencionado}<br>` : ""}
        ${c.cadastro_receita ? `<b>Cadastro (Receita/BrasilAPI, ${c.cadastro_receita.associacao}):</b> CNAE ${c.cadastro_receita.cnae} — ${c.cadastro_receita.cnae_desc || ""} · porte ${c.cadastro_receita.porte || "–"} · ${c.cadastro_receita.municipio || ""}/${c.cadastro_receita.uf || ""}<br>` : ""}
        ${c.credores && c.credores.passivo_classes && Object.keys(c.credores.passivo_classes).length ? `<b>QGC por classe ${badge("observado", "subtotais por classe extraídos do edital")}:</b> ${Object.entries(c.credores.passivo_classes).map(([k, v]) => `${k.replace(/_/g, " ")}: R$ ${v}`).join(" · ")}<br>` : ""}
        ${c.credores && c.credores.passivo ? `<b>Passivo citado no ato ${badge("estimado", "valor citado em publicação — conferir no processo")}:</b> R$ ${c.credores.passivo}<br>` : ""}
        ${c.credores && c.credores.nivel_passivo ? `<b>Nível da cascata:</b> ${c.credores.nivel_passivo}${c.credores.passivo_estimado_intervalo ? ` (R$ ${fmt.n0(c.credores.passivo_estimado_intervalo[0])} – ${fmt.n0(c.credores.passivo_estimado_intervalo[1])})` : ""}<br>` : ""}
        ${c.credores && c.credores.bancos.length ? `<b>Credores financeiros citados:</b> ${c.credores.bancos.map(b => `${b.nome}${b.valor ? ` (R$ ${b.valor} — observada)` : " (parcialmente observada)"}`).join("; ")}<br>` : ""}
        <b>Atos na janela:</b> ${c.n_publicacoes} (${c.tipos_documento.join(", ")})
        ${c.link ? ` · <a href="${c.link}" target="_blank" rel="noopener">consulta pública</a>` : ""}
      </div>
    </details>`).join("")}`;
  }
  let expo = "";
  const ex = rj.exposicao_citada;
  if (ex && ex.bancos && ex.bancos.length) {
    expo = `<h3>Credores financeiros citados em listas de credores — janela de ${ex.janela_dias} dias ${badge("observado", ex.metodo)}</h3>
    <div class="tblwrap"><table class="data"><thead><tr><th>Instituição citada</th><th>Casos</th><th>Com valor (observada)</th><th>Valores citados</th></tr></thead><tbody>
      ${ex.bancos.map(b => `<tr><td>${b.banco}</td><td>${b.casos}</td><td>${b.com_valor}</td><td class="src">${b.valores.slice(0, 3).map(v => "R$ " + v).join("; ") || "—"}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="note warn"><b>Leitura correta:</b> ${ex.limitacoes}</div>`;
    const pj2 = rj.passivo_janela;
    if (pj2) {
      expo += `<h3>Passivo dos casos da janela — cascata de estimativa ${sealFor(pj2.tipo)}</h3>
      <div class="grid g3">
        <div class="card"><h4>Citado em atos ${badge("observado")}</h4><div class="big" style="font-size:19px">${pj2.passivo_citado_soma_brl ? fmt.money(pj2.passivo_citado_soma_brl) : "–"}</div><div class="src">${pj2.casos_com_passivo_citado} de ${pj2.casos_total} casos com valor citado</div></div>
        <div class="card"><h4>Estimado (sem valor citado) ${badge("estimado")}</h4><div class="big" style="font-size:19px">${pj2.intervalo_estimado_total_brl ? fmt.money(pj2.intervalo_estimado_total_brl[0]) + " – " + fmt.money(pj2.intervalo_estimado_total_brl[1]) : "–"}</div><div class="src">${pj2.casos_estimados} casos × intervalo interquartil por caso ${pj2.intervalo_por_caso_estimado_brl ? `(${fmt.money(pj2.intervalo_por_caso_estimado_brl[0])}–${fmt.money(pj2.intervalo_por_caso_estimado_brl[1])})` : ""}</div></div>
        <div class="card"><h4>Método e limites</h4><div class="src">${pj2.metodo}<br><b>Limitações:</b> ${pj2.limitacoes}</div></div>
      </div>`;
    }
    const ms = rj.marcos_series;
    if (ms && Object.keys(ms).length) {
      expo += `<h3>Séries por marco processual ${badge("observado")}</h3><div class="grid g2">` +
        Object.values(ms).map(m => {
          const last = m.obs[m.obs.length - 1];
          return `<div class="card"><h4>${m.titulo} ${badge("observado")}</h4>
          <div class="big" style="font-size:20px">${fmt.n0(last.v)} <span style="font-size:12px;color:var(--text-3)">em ${fmt.my(last.ref)}</span></div>
          ${lineChart({ series: [{ pts: m.obs.map(o => ({ x: o.ref, y: o.v })), color: "#6b46a3" }], h: 130 })}
          ${chartFooter({ fonte: m.meta.source + " (" + m.meta.series_code + ")", periodo: `${fmt.my(m.obs[0].ref)}–${fmt.my(last.ref)}`, atualizado: m.meta.last_collected_at ? m.meta.last_collected_at.slice(0, 10) : "–", unidade: m.meta.unit, nota: m.meta.methodology })}</div>`;
        }).join("") + `</div>`;
    }
  }
  let funil = "";
  const f = rj.funil_processual;
  if (f) {
    const tot = f.agregado.total_classe129_docs;
    funil = `<h3>Funil processual real — classe 129 (todos os períodos) ${badge("observado")}</h3>
    <div class="grid g2"><div class="card">
      ${f.agregado.marcos.map(m => `<div class="contrib"><span class="lbl" style="width:250px">${m.nome}</span><span class="bar pos" style="width:${Math.min(m.processos_docs / tot * 400, 160)}px"></span><span class="num">${fmt.n0(m.processos_docs)} <span class="src">(${fmt.n(m.processos_docs / tot * 100, 1)}% dos ${fmt.n0(tot)} docs)</span></span></div>`).join("")}
      <details class="decomp"><summary>por tribunal (${Object.keys(f.por_tribunal).length})</summary>
        ${Object.entries(f.por_tribunal).map(([t, d]) => `<div class="src" style="margin-top:4px"><b>${t}</b> (${fmt.n0(d.total_classe129_docs)} docs): ${d.marcos.filter(m => m.processos_docs > 0).map(m => `${m.nome} ${fmt.n0(m.processos_docs)}`).join(" · ")}</div>`).join("")}
      </details>
      <div class="src" style="margin-top:6px"><b>Método:</b> ${f.metodo}<br><b>Limitações:</b> ${f.limitacoes}</div>
    </div></div>`;
  }
  return `<div class="note"><b>Dados reais:</b> ${rj.series_reais_nota}</div>
  <div class="grid g2">${block("recuperacao_judicial", "Recuperações judiciais ajuizadas")}${block("falencia", "Falências ajuizadas")}</div>
  ${casos}
  ${expo}
  ${funil}`;
}
window.exportRJ = slug => {
  const s = state.data.rj.series_reais[slug].agregado;
  const head = `# ${s.meta.name}\n# fonte: ${s.meta.source} | ${s.meta.series_code} | ${s.meta.unit}\n# metodologia: ${s.meta.methodology}\n# exportado: ${new Date().toISOString()}\n# classificação: DADO OBSERVADO\n`;
  download(`obc_${slug}.csv`, head + "ref_date,value\n" + s.obs.map(o => `${o.ref},${o.v}`).join("\n"), "text/csv");
};

function renderRJ() {
  const el = document.getElementById("view-rj");
  const rj = state.data.rj;
  if (!rj) { el.innerHTML = "<p>sem dados</p>"; return; }
  const fases = {};
  rj.casos.forEach(c => { fases[c.fase] = (fases[c.fase] || 0) + 1; });
  const fichas = rj.casos.map(c => `
    <details class="decomp card" style="margin-bottom:8px">
      <summary><b>${c.razao_social}</b> · ${c.cnae_desc} · ${c.uf} · fase: ${c.fase.replace(/_/g, " ")} ${badge("demo")}</summary>
      <div class="cols2" style="margin-top:8px">
        <div>
          <div class="src"><b>CNPJ raiz:</b> ${c.cnpj_raiz} · <b>tribunal:</b> ${c.tribunal} · <b>pedido:</b> ${fmt.d(c.data_pedido)}</div>
          <div class="src"><b>dívida declarada:</b> R$ ${fmt.n0(c.divida_declarada_rmi)} mi · <b>confiança da estimativa:</b> ${c.confianca_divida}</div>
          <div class="src"><b>credores:</b> ${fmt.n0(c.n_credores)} · <b>% financeiros:</b> ${c.credores_financeiros_pct}%</div>
        </div>
        <div>
          <h5>Exposição financeira ${badge("estimado", c.exposicao_financeira.metodo)}</h5>
          <div class="src">classificação: <b>${c.exposicao_financeira.classificacao}</b></div>
          <div>entre <b>R$ ${fmt.n0(c.exposicao_financeira.intervalo_rmi[0])} mi</b> e <b>R$ ${fmt.n0(c.exposicao_financeira.intervalo_rmi[1])} mi</b></div>
          <div class="src">${c.exposicao_financeira.aviso}</div>
        </div>
      </div>
      <div class="src" style="margin-top:6px">Navegar: <a href="#sectors" onclick="nav('sectors')">setor ${c.cnae_secao}</a> · <a href="#institutions" onclick="nav('institutions')">instituições potencialmente expostas</a></div>
    </details>`).join("");
  const temReal = rj.series_reais && Object.keys(rj.series_reais).length > 0;
  el.innerHTML = `
  ${pageHead({ title: "Recuperações &amp; Falências", seals: temReal ? badge("observado") : badge("demo"),
    desc: "Ajuizamentos reais (CNJ/DataJud), fichas nominais (DJEN/Comunica PJe) e funil processual por movimentos TPU. Componentes sem fonte pública permanecem selados como demonstrativos.",
    fontes: "CNJ/DataJud, CNJ/DJEN, BrasilAPI" })}
  ${temReal ? rjRealSection() : ""}
  <h3>Painel demonstrativo (fichas e exposição) ${badge("demo")}</h3>
  <div class="grid g3">
    <div class="card"><h4>Pedidos mensais (série demo) ${badge("demo")}</h4>
      ${lineChart({ series: [{ pts: rj.serie_pedidos_mensais.map(p => ({ x: p.ref + "-01", y: p.valor })), color: "#b45309", label: "pedidos/mês" }], h: 130, dec: 0, status: "demonstrativo" })}
      ${chartFooter({ fonte: "DEMONSTRATIVO", periodo: `${rj.serie_pedidos_mensais[0].ref}–${rj.serie_pedidos_mensais[rj.serie_pedidos_mensais.length - 1].ref}`, atualizado: "—", unidade: "pedidos/mês", nota: "Valores fictícios em ordem de grandeza plausível." })}</div>
    <div class="card"><h4>Fases processuais (casos demo)</h4>
      ${Object.entries(fases).map(([f, n]) => contribBar(f.replace(/_/g, " "), n, 18)).join("")}</div>
    <div class="card"><h4>Exposição financeira agregada ${badge("estimado")}</h4>
      <div class="big" style="font-size:19px">R$ ${fmt.n0(rj.exposicao_total_rmi.intervalo[0])} – ${fmt.n0(rj.exposicao_total_rmi.intervalo[1])} mi</div>
      <div class="src">${rj.exposicao_total_rmi.aviso}</div>
      <div class="src">Classes de exposição: observada · parcialmente observada · estimada · potencial · não identificada.</div></div>
  </div>
  <h3>Fichas dos processos (demo)</h3>
  ${fichas}`;
}

/* ---------- INSTITUIÇÕES ---------- */
function renderInstitutions() {
  const el = document.getElementById("view-institutions");
  const inst = state.data.institutions;
  if (!inst || !inst.ok) { el.innerHTML = "<p>sem dados de instituições</p>"; return; }
  const f = state.filters;
  const groups = ["todos", ...Object.keys(inst.grupos).sort()];
  let list = [...inst.instituicoes];
  if (f.instGroup !== "todos") list = list.filter(i => i.grupo_pares === f.instGroup);
  const nplMap = {};
  if (state.data.npl && state.data.npl.ok) state.data.npl.instituicoes.forEach(x => { nplMap[x.cod_inst] = x; });
  const sorters = {
    ativo: (a, b) => b.ativo_total_brl - a.ativo_total_brl,
    score: (a, b) => b.score - a.score,
    nome: (a, b) => a.nome.localeCompare(b.nome),
    inad: (a, b) => ((nplMap[b.cod_inst] || {}).inad_pct || -1) - ((nplMap[a.cod_inst] || {}).inad_pct || -1),
    deterioracao: (a, b) => ((nplMap[b.cod_inst] || {}).d_ano_pp ?? -99) - ((nplMap[a.cod_inst] || {}).d_ano_pp ?? -99),
  };
  list.sort(sorters[f.sortInst] || sorters.ativo);
  const rows = list.map(i => {
    const v = i.vulnerabilidade;
    const nd = Object.keys(i.dimensoes).length;
    return `
    <tr>
      <td><b>${i.nome}</b> ${favStar("institutions", i.cod_inst, i.nome)}
        <button class="btn ghost small" onclick="openInstPage('${i.cod_inst}')">página completa →</button>
        <div class="src">${i.grupo_pares_label}${i.grupo_fallback ? " · <i>grupo pequeno: comparado ao conjunto completo</i>" : ""}</div></td>
      <td>${fmt.money(i.ativo_total_brl)}<div class="src">carteira ${fmt.money(i.carteira_brl)}</div></td>
      <td>${i.basileia_pct != null ? fmt.n(i.basileia_pct, 1) + "%" : "<span class='src'>não reportado</span>"}${i.capital_principal_pct != null ? `<div class="src">CP ${fmt.n(i.capital_principal_pct, 1)}%</div>` : ""}</td>
      <td>${(function(){
        const n = state.data.npl; const q = n && n.ok ? n.instituicoes.find(x => x.cod_inst === i.cod_inst) : null;
        return q ? `<b>${fmt.n(q.inad_pct, 2)}%</b><div class="src">Δtri ${fmt.pp(q.d_tri_pp)} · 4T ${q.d_ano_pp != null ? fmt.pp(q.d_ano_pp) : "–"} p.p.</div><div class="src ${q.tendencia.includes("piora") ? "up" : q.tendencia === "melhora" ? "down good" : ""}">${q.tendencia}</div>` : "<span class='src'>n/d</span>";
      })()}</td>
      <td>${fmt.n(i.dimensoes.rentabilidade ? i.dimensoes.rentabilidade.valor : null, 1)}% <span class="src">med. ${i.dimensoes.rentabilidade ? fmt.n(i.dimensoes.rentabilidade.mediana_pares, 1) : "–"}%</span></td>
      <td><span class="scorebar"><i style="left:${i.score * 0.9}px"></i></span> <b>${i.score}</b>
        ${i.score_delta != null ? `<span class="${i.score_delta > 0 ? "up" : "down good"}">(${fmt.pp(i.score_delta)})</span>` : ""}
        <div class="src">${i.faixa} · ${i.dimensoes_disponiveis} dim.</div></td>
      <td>${sparkline((i.historico_score || []).map(h => h.score))}<div class="src">${(i.historico_score || []).length} trim.</div></td>
      <td>${v ? `${fmt.n(v.basileia_pos_choque_pct[0], 1)}–${fmt.n(v.basileia_pos_choque_pct[1], 1)}% ${badge("cenario", v.metodo)}<div class="src">Δinad ${fmt.pp(v.delta_inad_pp[0])} a ${fmt.pp(v.delta_inad_pp[1])} p.p.</div>` : "<span class='src'>sem RWA/Basileia</span>"}</td>
      <td><details class="decomp"><summary>abrir</summary>
        <h5>Condição atual — decomposição (${nd} dimensões)</h5>
        ${Object.entries(i.dimensoes).map(([k, d]) => `<div class="contrib"><span class="lbl">${k.replace(/_/g, " ")}</span><span class="bar ${d.risco > 50 ? "neg" : "pos"}" style="width:${d.risco * 0.9}px"></span><span class="num">${d.risco} · valor ${fmt.n(d.valor, 1)} · p${d.percentil_pares} · quartis [${fmt.n(d.q1_pares, 1)}–${fmt.n(d.q3_pares, 1)}]</span></div>`).join("")}
        ${v ? `<h5>Vulnerabilidade a choques ${badge("cenario")}</h5><div class="src">Cenário ${v.cenario}: Basileia ${fmt.n(v.basileia_atual_pct, 2)}% → ${fmt.n(v.basileia_pos_choque_pct[0], 2)}–${fmt.n(v.basileia_pos_choque_pct[1], 2)}% (impacto ${fmt.pp(v.impacto_basileia_pp[0])} a ${fmt.pp(v.impacto_basileia_pp[1])} p.p.). ${v.metodo}</div>` : ""}
        ${i.carteira_perfil ? `<h5>Composição da carteira ${badge("observado")}</h5><div class="src">
          ${i.carteira_perfil.pme_share_pct != null ? `<b>PME na carteira PJ:</b> ${i.carteira_perfil.pme_share_pct}% · ` : ""}
          ${i.carteira_perfil.hhi_setorial != null ? `<b>HHI setorial:</b> ${i.carteira_perfil.hhi_setorial} (10000 = monossetorial)` : ""}
          ${i.carteira_perfil.top_cnae ? `<br><b>Setores PJ:</b> ${i.carteira_perfil.top_cnae.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 28)} ${s}%`).join(" · ")}` : ""}
          ${i.carteira_perfil.top_mod_pf ? `<br><b>Modalidades PF:</b> ${i.carteira_perfil.top_mod_pf.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 28)} ${s}%`).join(" · ")}` : ""}
          ${i.carteira_perfil.top_mod_pj ? `<br><b>Modalidades PJ:</b> ${i.carteira_perfil.top_mod_pj.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 28)} ${s}%`).join(" · ")}` : ""}
        </div>` : ""}
        <div class="src">Peso igual entre dimensões disponíveis; dimensão sem dado é omitida, nunca imputada.</div>
      </details></td>
    </tr>`;
  }).join("");
  el.innerHTML = `
  ${pageHead({ title: "Instituições financeiras",
    desc: "Conglomerados prudenciais comparados dentro do próprio grupo de pares (S1–S5), com mediana, quartis e variação trimestral. Cada linha abre a página completa da instituição.",
    fontes: "BCB IF.data (Olinda + interface)" })}
  <div class="note warn"><b>${state.data.meta ? state.data.meta.plataforma.disclaimer : ""}</b><br>Método: ${inst.metodo}<br>Limitações: ${inst.limitacoes}</div>
  <div class="controls">
    <input id="instSearch" list="instList" type="text" placeholder="🔍 buscar qualquer instituição (${(state.data.inst_index && state.data.inst_index.instituicoes || []).length} com página)" style="min-width:300px;border:1px solid var(--border);border-radius:6px;padding:7px 12px" onchange="searchInst(this.value)">
    <datalist id="instList">${(state.data.inst_index && state.data.inst_index.instituicoes || []).slice(0, 1500).map(x => `<option value="${x.nome.replace(/"/g, "")} [${x.cod}]">`).join("")}</datalist>
  </div>
  <div class="controls">
    <label>grupo de pares <select onchange="setFilter('instGroup', this.value)">${groups.map(g => `<option value="${g}" ${f.instGroup === g ? "selected" : ""}>${g === "todos" ? "todos" : (inst.grupos[g] ? inst.grupos[g].label : g)}</option>`).join("")}</select></label>
    <span class="seg">${[["ativo", "por ativo"], ["score", "por score"], ["inad", "por inadimplência"], ["deterioracao", "por deterioração 4T"], ["nome", "A–Z"]].map(([k, l]) => `<button class="${f.sortInst === k ? "active" : ""}" onclick="setFilter('sortInst','${k}')">${l}</button>`).join("")}</span>
    <button class="btn ghost small" onclick="exportInstitutions()">exportar JSON</button>
  </div>
  <div class="tblwrap"><table class="data"><thead><tr><th>Instituição / grupo</th><th>Ativo / carteira</th><th>Basileia</th><th>Inadimplência ${badge("observado","carteira >90d ÷ carteira ativa — IF.data instrumentos financeiros")}</th><th>ROE per.</th><th>Score risco</th><th>Evolução (5 trim.)</th><th>Basileia pós-choque severo</th><th>Ficha</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${chartFooter({ fonte: `BCB IF.data (Olinda), conglomerados prudenciais, ${inst.anomes}`, periodo: inst.anomes + (inst.anomes_anterior ? ` (Δ vs. ${inst.anomes_anterior})` : ""), atualizado: state.data.meta ? state.data.meta.gerado_em.slice(0, 10) : "–", unidade: "R$", nota: inst.metodo })}`;
}

/* ---------- helpers visuais do formato v0.14 ---------- */
const DONUT_COLORS = ["#1d4e89", "#0e7c7b", "#b45309", "#6b46a3", "#c2540a", "#64748b"];
function donut(items, size = 130) {
  const tot = items.reduce((s, i) => s + i.v, 0);
  if (!tot) return "";
  let a0 = -Math.PI / 2, paths = "";
  const cx = size / 2, cy = size / 2, R = size / 2 - 4, r = size / 4.2;
  items.forEach((it, i) => {
    const a1 = a0 + it.v / tot * 2 * Math.PI;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rr) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    const tip = encodeURIComponent(`<div class="tt-date">${it.label}</div><div class="tt-row"><span class="tt-lbl">participação</span><span class="tt-val">${fmt.n(it.v / tot * 100, 1)}%</span></div>${it.v > 1e8 ? `<div class="tt-row"><span class="tt-lbl">valor</span><span class="tt-val">${fmt.money(it.v)}</span></div>` : ""}`);
    paths += `<path d="M${p(a0, R)} A${R},${R} 0 ${large} 1 ${p(a1, R)} L${p(a1, r)} A${r},${r} 0 ${large} 0 ${p(a0, r)} Z" data-tip="${tip}" style="fill:${ccol(DONUT_COLORS[i % DONUT_COLORS.length])}"/>`;
    a0 = a1;
  });
  const legend = items.map((it, i) => `<div class="contrib"><span class="sw" style="background:${ccol(DONUT_COLORS[i % DONUT_COLORS.length])};width:10px;height:10px;border-radius:2px"></span><span class="lbl" style="width:auto">${it.label}</span><span class="num">${fmt.n(it.v / tot * 100, 1)}%${it.v > 1e8 ? ` · ${fmt.money(it.v)}` : ""}</span></div>`).join("");
  return `<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><svg width="${size}" height="${size}" aria-hidden="true">${paths}</svg><div>${legend}</div></div>`;
}
function histogram(vals, mine, w = 340, h = 90) {
  if (!vals || vals.length < 5 || mine == null) return "";
  const lo = Math.min(...vals, mine), hi = Math.max(...vals, mine);
  if (hi - lo < 1e-9) return "";
  const nb = 24, bins = new Array(nb).fill(0);
  vals.forEach(v => bins[Math.min(nb - 1, Math.floor((v - lo) / (hi - lo) * nb))]++);
  const mx = Math.max(...bins);
  const bw = w / nb;
  let out = `<svg width="${w}" height="${h}" aria-hidden="true">`;
  bins.forEach((b, i) => {
    const bh = b / mx * (h - 18);
    const b0 = lo + (hi - lo) * i / nb, b1 = lo + (hi - lo) * (i + 1) / nb;
    const tip = encodeURIComponent(`<div class="tt-date">faixa ${fmt.n(b0, 1)} – ${fmt.n(b1, 1)}</div><div class="tt-row"><span class="tt-lbl">instituições</span><span class="tt-val">${b}</span></div>`);
    out += `<rect x="${i * bw + 1}" y="${h - 14 - bh}" width="${bw - 2}" height="${Math.max(bh, b > 0 ? 1 : 0)}" data-tip="${tip}" style="fill:color-mix(in srgb, var(--c-line1) 32%, var(--surface-2))"/>`;
  });
  const mp = (mine - lo) / (hi - lo) * w;
  out += `<line x1="${mp}" x2="${mp}" y1="4" y2="${h - 14}" style="stroke:var(--text)" stroke-width="2.5"/>`;
  out += `<text x="4" y="${h - 2}" font-size="9" style="fill:var(--c-axis-text)">pior ${fmt.n(lo, 1)}</text><text x="${w - 4}" y="${h - 2}" font-size="9" style="fill:var(--c-axis-text)" text-anchor="end">${fmt.n(hi, 1)} melhor</text></svg>`;
  out += `<details class="charttable"><summary>dados em tabela</summary><div class="tblwrap" style="max-height:200px"><table class="data compact"><thead><tr><th>Faixa</th><th style="text-align:right">Instituições</th></tr></thead><tbody>` +
    bins.map((b, i) => `<tr><td>${fmt.n(lo + (hi - lo) * i / nb, 1)} – ${fmt.n(lo + (hi - lo) * (i + 1) / nb, 1)}</td><td style="text-align:right">${b}</td></tr>`).join("") +
    `</tbody></table></div></details>`;
  return out;
}

/* ---------- PÁGINA INDIVIDUAL DA INSTITUIÇÃO (pilotos) ---------- */
function renderInstPage() {
  const el = document.getElementById("view-inst");
  const cod = state.filters.instCod;
  if (!cod) { el.innerHTML = "<p>selecione uma instituição na aba Instituições.</p>"; return; }
  state.instCache = state.instCache || {};
  if (state.instCache[cod]) { renderInstPageData(el, state.instCache[cod]); return; }
  el.innerHTML = loadingCard("página da instituição");
  const base = DATA_BASE;
  fetch(`${base}inst/${cod}.json?v=${APP_VERSION}`).then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(p => { state.instCache[cod] = p; renderInstPageData(el, p); })
    .catch(() => { el.innerHTML = "<p>página indisponível para este código de instituição.</p>"; });
}

function renderInstPageData(el, pg) {
  const cab = pg.cabecalho;
  const sc = pg.score_ref || {};
  const kpiCard = k => `<div class="card kpi">
    <h4>${k.label}</h4>
    <div class="big" style="font-size:21px">${k.unit === "R$" ? fmt.money(k.v) : fmt.n(k.v, 2) + k.unit}</div>
    ${k.d_tri != null ? `<div class="delta ${k.d_tri >= 0 ? "down good" : "up"}">${k.d_tri >= 0 ? "▲" : "▼"} ${fmt.n(Math.abs(k.d_tri), 1)}${k.d_tri_tipo} vs. trim. anterior</div>` : ""}
    ${k.hist && k.hist.length > 2 ? sparkline(k.hist, 150, 30) : ""}
    <div class="src">${k.fonte}</div></div>`;
  const destIcon = t => t === "ok" ? "✅" : "⚠️";
  const capRow = c => `<tr><td>${c.indicador}</td><td><b>${fmt.n(c.valor, 2)}${c.unit}</b></td>
    <td>${c.d_tri != null ? fmt.pp(c.d_tri) + " p.p." : "–"}</td>
    <td class="${c.vs_pares === "abaixo" && c.indicador.includes("Basileia") ? "up" : "neutral"}">${c.vs_pares || "–"} <span class="src">(med. ${c.mediana_grupo != null ? fmt.n(c.mediana_grupo, 1) : "–"})</span></td>
    <td>${c.percentil != null ? "p" + c.percentil : "–"}</td></tr>`;
  const evolLabels = Object.keys(pg.evolucao_base100 || {});
  let evolChart = "";
  if (evolLabels.length) {
    const cores = ["#1d4e89", "#0e7c7b", "#b45309"];
    const series = evolLabels.map((l, i) => ({ pts: pg.evolucao_base100[l].map(o => ({ x: o.p, y: o.v })), color: cores[i % 3], label: l }));
    evolChart = `<div class="legend">${evolLabels.map((l, i) => `<span><span class="sw" style="background:${cores[i % 3]}"></span>${l}</span>`).join("")}</div>` +
      lineChart({ series, h: 170, unit: "base 100", fonte: "BCB/IF.data", status: "observado" }) + `<div class="src">base 100 = ${pg.evolucao_base100[evolLabels[0]][0].p} · fonte: IF.data</div>`;
  }
  const cmpKeys = Object.keys(pg.comparacao_grupo || {});
  state.filters.cmpMet = cmpKeys.includes(state.filters.cmpMet) ? state.filters.cmpMet : cmpKeys[0];
  const cmp = pg.comparacao_grupo[state.filters.cmpMet] || {};
  const cmpLbl = { roe: "ROE do período (%)", basileia: "Índice de Basileia (%)", alav: "Alavancagem (×)" };
  const re = pg.resumo_executivo;
  const gpc = pg.grupo_pares_composicao;
  const smeta = pg.score_meta;
  const subnav = `<div class="controls" style="position:sticky;top:0;background:var(--bg);z-index:5;padding:6px 0;border-bottom:1px solid var(--border)">
    ${[["#s-resumo","Visão Geral"],["#s-kpis","Indicadores"],["#s-risco","Risco e Inadimplência"],["#s-atraso-prod","Atraso por Produto"],["#s-carteira","Carteira"],["#s-capital","Capital"],["#s-pares","Comparáveis"],["#s-recl","Reclamações/OF/RJ"],["#s-limites","Limitações"]].map(([a,l])=>`<a class="btn ghost small" href="javascript:void(0)" onclick="document.querySelector('${a}').scrollIntoView({behavior:'smooth'})">${l}</a>`).join("")}
  </div>`;
  el.innerHTML = `
  <div class="controls"><button class="btn ghost small" onclick="nav('institutions')">← instituições</button>
    <span class="src">Instituições Financeiras › <b>${cab.nome_comercial}</b> · data-base ${cab.data_base} · atualizado ${cab.atualizado_em.slice(0, 16).replace("T", " ")} UTC</span></div>
  <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
    <div style="flex:2;min-width:300px">
      <h2 style="margin:4px 0">${cab.nome_comercial} <span class="seal aprox">${cab.consolidacao}</span></h2>
      <div class="src" style="margin-bottom:8px">${cab.razao_social_fonte_bcb} · ${cab.tcb || ""} · ${cab.sede} · Código BCB ${cab.codigo_bcb} · CNPJ ${cab.cnpj}</div>
      <div class="chips">
        <span class="chip">Segmento ${cab.segmento}</span>
        <span class="chip">${cab.grupo_pares} · ${cab.n_pares} pares</span>
        <span class="chip">Capital ${cab.capital}</span>
        ${cab.modelo ? `<span class="chip">${cab.modelo}</span>` : ""}
        ${cab.participante_open_finance ? `<span class="chip">Open Finance: no top-20 de chamadas</span>` : ""}
        <span class="chip">Conglomerado ${cab.conglomerado_prudencial || "–"}</span>
      </div>
      ${cab.aviso_pares ? `<div class="note warn" style="margin-top:8px"><b>Comparabilidade:</b> ${cab.aviso_pares}</div>` : ""}
    </div>
    <div class="card" style="flex:1;min-width:230px">
      <h4>Score de risco ${badge("calculado")}</h4>
      ${sc.score != null ? `<div class="big">${sc.score}<span style="font-size:13px">/100</span></div>
        <div class="delta neutral">${sc.faixa}${sc.score_delta != null ? ` · ${fmt.pp(sc.score_delta)} no trim.` : ""} · relativo aos pares</div>
        <span class="scorebar" style="width:150px"><i style="left:${sc.score * 1.5}px"></i></span>
        ${sc.historico_score ? sparkline(sc.historico_score.map(h => h.score), 150, 26) : ""}
        ${sc.vulnerabilidade ? `<div class="src">${badge("cenario")} Basileia pós-cenário severo: ${sc.vulnerabilidade.basileia_pos_choque_pct[0]}–${sc.vulnerabilidade.basileia_pos_choque_pct[1]}%</div>` : ""}
        ${smeta ? `<div class="src"><b>Cobertura dos dados:</b> ${smeta.cobertura_dados_pct}% · <b>Confiança:</b> ${smeta.confianca} <span title="${attr(smeta.confianca_motivo)}">ⓘ</span> · ${smeta.versao_metodologica}</div>` : ""}`
      : `<p class="src">${sc.indisponivel || "não calculado"}</p>`}
      <div class="src">${state.data.meta ? state.data.meta.plataforma.disclaimer : ""}</div>
    </div>
  </div>
  ${subnav}
  <div id="s-resumo" class="card" style="margin-top:12px"><h4>Resumo executivo ${badge("calculado", "frases por regras determinísticas; cada uma com base declarada")}</h4>
    ${re ? `<p style="font-size:15px"><b>${re.avaliacao_geral.texto}</b> <span class="src">[${re.avaliacao_geral.base}]</span></p>
    <div class="cols2">
      <div><h5 class="down good">Pontos fortes</h5>${re.pontos_fortes.length ? re.pontos_fortes.map(d => `<p style="margin:4px 0">✅ ${d.texto} <span class="src">[${d.base}]</span></p>`).join("") : "<p class='src'>nenhum calculável.</p>"}</div>
      <div><h5 class="up">Pontos de atenção</h5>${re.pontos_atencao.length ? re.pontos_atencao.map(d => `<p style="margin:4px 0">⚠️ ${d.texto} <span class="src">[${d.base}]</span></p>`).join("") : "<p class='src'>nenhum calculável.</p>"}</div>
    </div>
    ${re.mudancas_recentes.length ? `<h5>Mudanças recentes</h5>${re.mudancas_recentes.map(m => `<p style="margin:3px 0" class="src">• ${m.texto} [${m.base}]</p>`).join("")}` : ""}
    <h5>Limitações informacionais</h5><p class="src">${re.limitacoes_informacionais.join(" · ")}</p>` : ""}
  </div>
  <div id="s-kpis" class="kpirow">${pg.kpis.map(kpiCard).join("")}</div>
  ${(function(){
    const n = state.data.npl; const q = n && n.ok ? n.instituicoes.find(x => x.cod_inst === pg.cod_inst) : null;
    if (!q) return `<div id="s-risco" class="card" style="margin-top:12px"><h4>Risco e Inadimplência</h4>
      <p class="src">O IF.data público integrado não traz a carteira inadimplente desta instituição nesta data-base (relatório por instrumentos financeiros) — ausência não é zero.</p></div>`;
    const grp = n.grupos[q.grupo] || {};
    const serie = q.serie.map(s => ({ x: s.p, y: s.inad_pct }));
    const hl = [];
    if (q.mediana_pares != null) hl.push({ y: q.mediana_pares, color: "#0e7c7b", label: "mediana grupo (atual)" });
    if (grp.quartis && grp.quartis.q3 != null) hl.push({ y: grp.quartis.q3, color: "#b45309", label: "q3 grupo (atual)" });
    return `<div id="s-risco" class="card" style="margin-top:12px">
      <h4>Risco e Inadimplência ${badge("observado", n.metodo)} <span class="src">data-base ${n.data_base} · ${n.nivel_consolidacao}</span></h4>
      <div class="kpirow">
        <div class="card kpi"><h4>Inadimplência (>90d) ${inadChip("if90")}</h4><div class="big" style="font-size:21px">${fmt.n(q.inad_pct, 2)}%</div>
          <div class="delta ${(q.d_tri_pp||0) > 0 ? "up" : "down good"}">${q.d_tri_pp != null ? fmt.pp(q.d_tri_pp) + " p.p. no tri" : ""} · ${q.d_ano_pp != null ? fmt.pp(q.d_ano_pp) + " p.p. em 4T" : "4T: histórico insuficiente"}</div>
          <div class="src">tendência: <b>${q.tendencia}</b> (regra analítica ±0,20/0,50 p.p. — não regulatória)</div></div>
        <div class="card kpi"><h4>Posição nos pares (${q.grupo})</h4><div class="big" style="font-size:21px">p${q.percentil_pares}</div>
          <div class="src">mediana ${fmt.n(q.mediana_pares, 2)}%${grp.quartis ? ` · q1 ${grp.quartis.q1}% · q3 ${grp.quartis.q3}%` : ""} · n=${grp.n || "–"}</div></div>
        <div class="card kpi"><h4>Ativos problemáticos</h4><div class="big" style="font-size:21px">${q.ativos_problematicos_pct != null ? fmt.n(q.ativos_problematicos_pct, 2) + "%" : "n/d"}</div><div class="src">conceito Res. 4.966 (inclui reestruturados/estágio 3)</div></div>
        <div class="card kpi"><h4>Cobertura contábil aprox.</h4><div class="big" style="font-size:21px">${q.cobertura_pct != null ? fmt.n(q.cobertura_pct, 0) + "%" : "n/d"}</div>
          <div class="src">${q.d_cobertura_pp != null ? `Δ ${fmt.pp(q.d_cobertura_pp)} p.p. no tri · ` : ""}perda esperada de crédito ÷ carteira >90d — a provisão cobre também operações em dia; não é razão regulatória</div></div>
      </div>
      <div class="grid g2" style="margin-top:10px">
        <div class="card"><h4>Série (máx. disponível: ${q.serie.length} trimestres — metodologia vigente desde 2025-T1)</h4>
          <div class="legend"><span><span class="sw" style="background:var(--c-line1)"></span>instituição</span><span><span class="sw" style="background:var(--c-line2)"></span>mediana do grupo (trimestre atual)</span><span><span class="sw" style="background:var(--c-line3)"></span>q3 do grupo (atual)</span></div>
          ${lineChart({ series: [{ pts: serie, color: "#1d4e89" }], hlines: hl, h: 160 })}
          <div class="src">máx/mín de 3 anos indisponível: a estrutura por instrumentos financeiros existe desde 2025-T1 (sem quebra interna na amostra).</div></div>
        <div class="card"><h4>Comparação temporal</h4>
          <div class="tblwrap"><table class="data compact"><thead><tr><th>Data-base</th><th>Inadimplência</th><th>Carteira</th></tr></thead>
          <tbody>${q.serie.map(s => `<tr><td>${s.p}</td><td>${fmt.n(s.inad_pct, 2)}%</td><td>${fmt.money(s.carteira_brl)}</td></tr>`).join("")}</tbody></table></div>
          ${q.quadrante ? `<div class="src" style="margin-top:6px"><b>Matriz crescimento × inadimplência:</b> ${q.quadrante} (crescimento 4T: ${q.cresc_carteira_4t_pct != null ? fmt.pp(q.cresc_carteira_4t_pct) + "%" : "n/d"}) — leitura analítica, não score de solvência.</div>` : ""}
          ${q.alertas.length ? `<div style="margin-top:6px">${q.alertas.map(a => `<div class="alert ${a.severidade}" style="padding:6px 10px"><span class="lvl">${a.severidade}</span> ${a.regra}: <b>${fmt.n(a.valor, 2)}</b> <span class="src">(IF.data ${n.data_base}, grupo ${q.grupo})</span></div>`).join("")}</div>` : ""}
        </div>
      </div>
      <div class="src" style="margin-top:6px"><b>Decomposição por modalidade:</b> a inadimplência >90d desta instituição não é decomposta por modalidade na fonte pública; o ATRASO ≥15 dias por produto está na seção abaixo (conceito distinto). A inadimplência isolada não mede solvência.</div>
    </div>`;
  })()}
  ${(function(){
    const ap = pg.atraso_produtos;
    if (!ap || !ap.itens || !ap.itens.length) return "";
    const row = i => `<tr class="clickable" onclick="openProduct('${i.slug}')">
      <td><b>${i.produto}</b> <span class="chip" style="padding:0 7px;font-size:10.5px">${i.seg}</span></td>
      <td style="text-align:right">${fmt.money(i.carteira_brl)}</td>
      <td style="text-align:right"><b>${i.atraso15_pct != null ? fmt.n(i.atraso15_pct, 2) + "%" : "–"}</b></td>
      <td style="text-align:right">${i.mediana_produto_pct != null ? fmt.n(i.mediana_produto_pct, 2) + "%" : "–"}</td>
      <td style="text-align:right" class="${i.percentil_no_produto != null && i.atraso15_pct != null && i.mediana_produto_pct != null ? (i.atraso15_pct > i.mediana_produto_pct ? "up" : "down good") : "neutral"}">${i.percentil_no_produto != null ? "p" + Math.round(i.percentil_no_produto) : "–"} <span class="src">(n=${i.n_universo})</span></td>
      <td>${i.serie && i.serie.length > 2 ? sparkline(i.serie.map(x => x.pct), 110, 24) : `<span class="src">${(i.serie || []).map(x => x.pct + "%").join(" · ") || "–"}</span>`}</td></tr>`;
    return `<div id="s-atraso-prod" class="card" style="margin-top:12px">
      <h4>Atraso ≥15 dias por produto ${badge("observado", ap.nota)} <span class="src">data-base ${ap.data_base}</span></h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Produto</th><th style="text-align:right">Carteira</th><th style="text-align:right" title="vencido ≥15d ÷ carteira da modalidade — específico do produto">Atraso ≥15d</th><th style="text-align:right">Mediana do produto</th><th style="text-align:right" title="percentil alto = mais atraso que os pares do produto">Percentil</th><th>Série (5 trim.)</th></tr></thead>
      <tbody>${ap.itens.map(row).join("")}</tbody></table></div>
      <div class="src">${ap.nota}<br>Fonte: ${ap.fonte}. Clique no produto para abrir a matriz completa.</div>
    </div>`;
  })()}
  <div class="grid g2" style="margin-top:12px">
    <div class="card"><h4>Destaques ${badge("calculado", "regras determinísticas sobre dados observados")}</h4>
      ${pg.destaques.length ? pg.destaques.map(d => `<p style="margin:6px 0">${destIcon(d.tipo)} ${d.texto} <span class="src">[${d.base}]</span></p>`).join("") : "<p class='src'>sem destaques calculáveis.</p>"}
    </div>
    <div id="s-capital" class="card"><h4>Capital e comparação com pares ${badge("observado")}</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Indicador</th><th>Valor</th><th>Δ trim.</th><th>vs. pares</th><th>Percentil</th></tr></thead>
      <tbody>${pg.capital_tabela.map(capRow).join("")}</tbody></table></div>
      <div class="src">grupo = ${cab.grupo_pares} (${cab.n_pares} instituições com dados)</div></div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div id="s-carteira" class="card"><h4>Composição da carteira ${pg.carteira.donut_cliente ? badge("observado") : ""}</h4>
      ${pg.carteira.donut_cliente ? donut(pg.carteira.donut_cliente) : "<p class='src'>detalhamento de carteira não reportado por esta instituição no IF.data.</p>"}
      ${pg.carteira.perfil ? `<div class="src" style="margin-top:8px">
        ${pg.carteira.perfil.top_mod_pf ? `<b>Modalidades PF:</b> ${pg.carteira.perfil.top_mod_pf.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 24)} ${s}%`).join(" · ")}<br>` : ""}
        ${pg.carteira.perfil.top_mod_pj ? `<b>Modalidades PJ:</b> ${pg.carteira.perfil.top_mod_pj.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 24)} ${s}%`).join(" · ")}<br>` : ""}
        ${pg.carteira.perfil.top_cnae ? `<b>Setores PJ:</b> ${pg.carteira.perfil.top_cnae.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 24)} ${s}%`).join(" · ")}<br>` : ""}
        ${pg.carteira.perfil.pme_share_pct != null ? `<b>PME na carteira PJ:</b> ${pg.carteira.perfil.pme_share_pct}% · ` : ""}
        ${pg.carteira.perfil.hhi_setorial != null ? `<b>HHI setorial:</b> ${pg.carteira.perfil.hhi_setorial}` : ""}</div>` : ""}
    </div>
    <div class="card"><h4>Evolução (base 100) ${badge("observado")}</h4>${evolChart || "<p class='src'>histórico insuficiente.</p>"}</div>
  </div>
  <div class="grid g2" style="margin-top:12px">
    <div id="s-pares" class="card"><h4>Comparação com o grupo de pares ${badge("calculado")}</h4>
      <div class="controls"><span class="seg">${cmpKeys.map(k => `<button class="${state.filters.cmpMet === k ? "active" : ""}" onclick="setCmpMet('${k}')">${cmpLbl[k] || k}</button>`).join("")}</span></div>
      ${histogram(cmp.valores, cmp.meu)}
      <div class="src">sua posição (linha escura) vs. distribuição do grupo · mediana ${cmp.mediana != null ? fmt.n(cmp.mediana, 2) : "–"} · n=${(cmp.valores || []).length}</div>
      ${gpc ? `<details class="decomp"><summary>ver composição do grupo de pares (${gpc.quantidade} instituições)</summary>
        <div class="src" style="margin-top:6px"><b>Critério:</b> ${gpc.criterio}<br>
        ${gpc.quartis_basileia ? `<b>Quartis de Basileia:</b> q1 ${gpc.quartis_basileia.q1}% · mediana ${gpc.quartis_basileia.mediana}% · q3 ${gpc.quartis_basileia.q3}%<br>` : ""}
        <b>Maiores membros:</b> ${gpc.maiores_membros.map(m => `<span class="clickable" onclick="openInstPage('${m.cod}')">${m.nome}</span>`).join(" · ")}<br>
        <b>Estabilidade:</b> ${gpc.estabilidade}</div></details>` : ""}</div>
    <div id="s-recl" class="card"><h4>Reclamações e atendimento ${badge("observado", "indicador operacional/reputacional — não mede solvência")}</h4>
      ${pg.reclamacoes.length ? `<div class="big" style="font-size:22px">${pg.reclamacoes[0].indice != null ? fmt.n(pg.reclamacoes[0].indice, 1) : "n/d"}</div>
        <div class="src">índice em ${pg.reclamacoes[0].periodo} · ${fmt.n0(pg.reclamacoes[0].reclamacoes)} reclamações · ${pg.reclamacoes[0].clientes ? fmt.n0(pg.reclamacoes[0].clientes / 1e6) + " mi clientes" : ""}</div>
        ${sparkline(pg.reclamacoes.slice().reverse().map(r => r.indice).filter(v => v != null), 150, 26)}
        <div class="src">nome na fonte: ${pg.reclamacoes[0].nome_fonte} · assuntos por instituição não disponíveis no CSV público</div>`
      : "<p class='src'>sem correspondência no Ranking de Reclamações do BCB (pode não atingir o volume mínimo do ranking).</p>"}
      <div class="src" style="margin-top:6px"><b>Citações em RJs (DJEN, 60d):</b> ${pg.rj_citacoes.casos} casos · ${pg.rj_citacoes.nota}</div>
      ${pg.openfinance ? `<div class="src" style="margin-top:6px"><b>Open Finance:</b> ${pg.openfinance.share_pct}% das chamadas transacionais · maturidade estrutural ${pg.openfinance.maturidade_estrutural}</div>` : ""}
    </div>
  </div>
  <div id="instSimilares"></div>
  <div id="s-limites" class="card" style="margin-top:12px"><h4>Não disponível nas fontes públicas integradas (ausência ≠ zero)</h4>
    ${pg.indisponiveis.map(i => `<p class="src"><b>${i.indicador}:</b> ${i.motivo}</p>`).join("")}</div>`;
  fillInstSimilares(state.filters.instCod);
}
async function fillInstSimilares(cod) {
  const box = document.getElementById("instSimilares");
  if (!box || !cod) return;
  const d = await fetchCmp(cod);
  const sim = d && d.semelhantes;
  if (!sim || !sim.lista.length) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="card" style="margin-top:12px"><h4>Instituições semelhantes ${badge("calculado", sim.criterios)}</h4>
    <div class="src" style="margin-bottom:6px">Regras explícitas (sem algoritmo opaco): ${sim.criterios}</div>
    <div class="chips">${sim.lista.map(x => `<span class="chip clickable" onclick="openInstPage('${x.cod}')">${x.nome.slice(0, 26)} <span class="src" style="display:inline">${x.sr || ""} · ${fmt.money(x.ativo_brl)}</span></span>`).join("")}</div>
    <div style="margin-top:10px"><button class="btn ghost small" onclick='state.cmp.insts = ${'$'}{JSON.stringify([cod].concat(sim.lista.slice(0, 9).map(x => x.cod)))}; saveLS("obc_cmp", state.cmp); showView("compare")'>comparar com semelhantes →</button></div>
  </div>`;
}
window.setCmpMet = k => { state.filters.cmpMet = k; renderInstPage(); };
window.searchInst = val => {
  const m = val.match(/\[([A-Z0-9]+)\]\s*$/);
  const idx = state.data.inst_index && state.data.inst_index.instituicoes || [];
  let cod = m ? m[1] : null;
  if (!cod) {
    const q = val.toLowerCase();
    const hit = idx.find(x => x.nome.toLowerCase().includes(q) || x.razao.toLowerCase().includes(q));
    cod = hit && hit.cod;
  }
  if (cod) openInstPage(cod);
};

window.openInstPage = cod => { state.filters.instCod = cod; saveLS("obc_filters", state.filters); showView("inst"); };

/* ---------- OPEN FINANCE ---------- */
function renderOpenFinance() {
  const el = document.getElementById("view-openfinance");
  const of = state.data.openfinance;
  if (!of) { el.innerHTML = "<p>sem dados</p>"; return; }
  if (of.demo === false) { renderOpenFinanceReal(el, of); return; }
  const papel = i => {
    const rx = i.consentimentos_ativos_recebidos, tx = i.consentimentos_transmitidos;
    return rx > tx * 1.5 ? "receptor" : tx > rx * 1.5 ? "transmissor" : "misto";
  };
  const rows = of.ranking.map((i, idx) => `
    <tr><td>${idx + 1}</td><td><b>${i.nome}</b><div class="src">papel: ${papel(i)}${i.iniciacoes_pagamento_mes > 1000000 ? " · iniciador relevante" : ""}</div></td>
      <td>${fmt.n0(i.consentimentos_ativos_recebidos)}</td>
      <td>${fmt.n(i.chamadas_api_mes / Math.max(i.consentimentos_ativos_recebidos, 1), 1)} <span class="src">chamadas/consent.</span></td>
      <td>${fmt.n(i.iniciacoes_pagamento_mes / Math.max(i.consentimentos_ativos_recebidos, 1) * 100, 1)}% <span class="src">iniciações/consent.</span></td>
      <td>${fmt.n(i.taxa_sucesso_pct, 1)}%</td>
      <td><b>${i.maturidade}</b>
        <details class="decomp"><summary>dimensões</summary>${Object.entries(i.dimensoes).map(([k, v]) => `<div class="contrib"><span class="lbl">${k.replace(/_/g, " ")}</span><span class="bar pos" style="width:${v * 0.8}px"></span><span class="num">${v}</span></div>`).join("")}</details>
      </td></tr>`).join("");
  el.innerHTML = `
  <h2>Open Finance ${badge("demo")}</h2>
  <p class="viewdesc"><b>Todos os números desta aba são demonstrativos</b> — ${of.motivo} Indicadores normalizados (por consentimento) e papéis (transmissor/receptor/misto) evitam confundir volume com maturidade.</p>
  <div class="note warn">Método: ${of.metodo} Normalização por base de clientes/ativos entra quando houver dado real pareável.</div>
  <div class="grid g2"><div class="card"><h4>Consentimentos ativos totais (série demo) ${badge("demo")}</h4>
    ${lineChart({ series: [{ pts: of.serie_consentimentos_total.map(p => ({ x: p.ref + "-01", y: p.valor })), color: "#b45309" }], h: 150 })}
    ${chartFooter({ fonte: "DEMONSTRATIVO", periodo: `${of.serie_consentimentos_total[0].ref}–${of.serie_consentimentos_total[of.serie_consentimentos_total.length - 1].ref}`, atualizado: "—", unidade: "consentimentos", nota: "Valores fictícios." })}</div>
  <div class="card"><h4>Funil de jornada (estrutura preparada) ${badge("demo")}</h4>
    ${["início", "autenticação", "consentimento", "autorização", "compartilhamento", "uso recorrente", "contratação"].map((s, i) => contribBar(s, 7 - i, 16)).join("")}
    <div class="src">Estágios ilustrativos — dados reais de conversão por etapa dependem do dashboard oficial (Fase 5).</div></div></div>
  <h3>Ranking nominal normalizado (demo) — ${of.ref_period}</h3>
  <div class="tblwrap"><table class="data"><thead><tr><th>#</th><th>Instituição / papel</th><th>Consent. ativos</th><th>Intensidade de uso</th><th>Uso econômico</th><th>Sucesso API</th><th>Maturidade 0–100</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function scatterPlot(pairs, xl, yl, w = 340, h = 200, opts) {
  if (!pairs || pairs.length < 3) return "";
  opts = opts || {};
  const xs = pairs.map(p => p.x), ys = pairs.map(p => p.y);
  const lx = Math.min(...xs), hx = Math.max(...xs), ly = Math.min(...ys), hy = Math.max(...ys);
  const X = v => 40 + (v - lx) / Math.max(hx - lx, 1e-9) * (w - 58);
  const Y = v => h - 26 - (v - ly) / Math.max(hy - ly, 1e-9) * (h - 42);
  const sizes = pairs.map(p => p.size).filter(v => v != null && v > 0);
  const smax = sizes.length ? Math.max(...sizes) : null;
  const R = p => (p.size != null && smax) ? 5 + 13 * Math.sqrt(p.size / smax) : 4.5;
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="dispersão ${attr(xl)} × ${attr(yl)}">`;
  out += `<line x1="40" y1="${h - 26}" x2="${w - 10}" y2="${h - 26}" style="stroke:var(--border-2)"/><line x1="40" y1="10" x2="40" y2="${h - 26}" style="stroke:var(--border-2)"/>`;
  if (opts.refX != null) {
    out += `<line x1="${X(opts.refX)}" x2="${X(opts.refX)}" y1="10" y2="${h - 26}" style="stroke:var(--c-gray)" stroke-dasharray="4,3"/>`;
    out += `<text x="${X(opts.refX) + 4}" y="20" font-size="8.5" style="fill:var(--c-axis-text)">${opts.refXLabel || "mediana"}</text>`;
  }
  if (opts.refY != null) {
    out += `<line x1="40" x2="${w - 10}" y1="${Y(opts.refY)}" y2="${Y(opts.refY)}" style="stroke:var(--c-gray)" stroke-dasharray="4,3"/>`;
    out += `<text x="${w - 12}" y="${Y(opts.refY) - 4}" text-anchor="end" font-size="8.5" style="fill:var(--c-axis-text)">${opts.refYLabel || "mediana"}</text>`;
  }
  pairs.forEach(p => {
    const tip = encodeURIComponent(`<div class="tt-date">${p.label}</div><div class="tt-row"><span class="tt-lbl">${xl}</span><span class="tt-val">${fmt.n(p.x, 2)}</span></div><div class="tt-row"><span class="tt-lbl">${yl}</span><span class="tt-val">${fmt.n(p.y, 2)}</span></div>${p.size != null ? `<div class="tt-row"><span class="tt-lbl">${opts.sizeLabel || "tamanho"}</span><span class="tt-val">${fmt.money(p.size)}</span></div>` : ""}${p.grp ? `<div class="tt-meta">grupo ${p.grp}</div>` : ""}`);
    out += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${R(p)}" data-tip="${tip}" style="fill:${ccol(p.color) || "var(--c-line1)"}" opacity=".68" stroke="var(--c-halo)" stroke-width="1"></circle>`;
  });
  if (opts.labels) pairs.forEach(p => {
    out += `<text x="${X(p.x)}" y="${Y(p.y) - R(p) - 4}" text-anchor="middle" font-size="9.5" font-weight="600" style="fill:var(--text-2);paint-order:stroke;stroke:var(--c-halo);stroke-width:3px">${p.label.slice(0, 16)}</text>`;
  });
  out += `<text x="${w / 2}" y="${h - 6}" font-size="9.5" style="fill:var(--c-axis-text)" text-anchor="middle">${xl}</text>`;
  out += `<text x="10" y="${h / 2}" font-size="9.5" style="fill:var(--c-axis-text)" transform="rotate(-90 10 ${h / 2})" text-anchor="middle">${yl}</text></svg>`;
  if (!opts.noTable) {
    out += `<details class="charttable"><summary>dados em tabela</summary><div class="tblwrap" style="max-height:240px"><table class="data compact"><thead><tr><th>Item</th><th style="text-align:right">${xl}</th><th style="text-align:right">${yl}</th>${opts.sizeLabel ? `<th style="text-align:right">${opts.sizeLabel}</th>` : ""}${pairs.some(p => p.grp) ? "<th>grupo</th>" : ""}</tr></thead><tbody>` +
      pairs.map(p => `<tr><td>${p.label}</td><td style="text-align:right">${fmt.n(p.x, 2)}</td><td style="text-align:right">${fmt.n(p.y, 2)}</td>${opts.sizeLabel ? `<td style="text-align:right">${p.size != null ? fmt.money(p.size) : "–"}</td>` : ""}${pairs.some(pp => pp.grp) ? `<td>${p.grp || "–"}</td>` : ""}</tr>`).join("") +
      `</tbody></table></div></details>`;
  }
  return out;
}

function renderOpenFinanceReal(el, of) {
  const sChart = (key, color, h) => {
    const s = of.series[key];
    if (!s) return "";
    const last = s.obs[s.obs.length - 1];
    return `<div class="card"><h4>${s.meta.name} ${badge("observado")}</h4>
      <div class="big" style="font-size:20px">${last.v >= 1e6 ? fmt.n0(last.v / 1e6) + " mi" : fmt.n(last.v, last.v < 200 ? 2 : 0)}${s.meta.unit === "%" ? "%" : ""} <span style="font-size:12px;color:var(--text-3)">semana de ${fmt.d(last.ref)}</span></div>
      ${lineChart({ series: [{ pts: s.obs.map(o => ({ x: o.ref, y: o.v })), color, label: s.meta.name }], h: h || 130, unit: s.meta.unit, fonte: s.meta.source, status: "observado" })}
      ${chartFooter({ fonte: s.meta.source, periodo: `${fmt.d(s.obs[0].ref)}–${fmt.d(last.ref)} (semanal)`, atualizado: s.meta.last_collected_at ? s.meta.last_collected_at.slice(0, 10) : "–", unidade: s.meta.unit, nota: s.meta.methodology })}</div>`;
  };
  const rows = of.ranking.map((r, i) => `
    <tr><td>${i + 1}</td><td><b>${r.organisation}</b>${r.papeis ? `<div class="src">papéis: ${r.papeis.join(", ")}</div>` : ""}</td>
      <td>${fmt.n0(r.chamadas_semana / 1e6)} mi</td><td>${r.share_pct}%</td>
      <td>${r.familias_api != null ? r.familias_api : "<span class='src'>sem match no diretório</span>"}</td>
      <td><b>${r.maturidade_estrutural}</b></td></tr>`).join("");
  const cons = of.consentimentos_atual;
  const conc = of.concentracao || {};
  const idx2 = of.indices || {};
  const fasesL = { dados_transacionais: "Dados transacionais", dados_abertos: "Dados abertos", iniciacao_pagamento: "Iniciação de pagamento" };
  const subnav = `<div class="controls" style="position:sticky;top:0;background:var(--bg);z-index:5;padding:6px 0;border-bottom:1px solid var(--border)">
    ${[["#of-geral","Visão Geral"],["#of-cons","Consentimentos"],["#of-apis","APIs & Endpoints"],["#of-inic","Iniciação"],["#of-conc","Concentração"],["#of-idx","Índices"],["#of-alertas","Alertas"],["#of-qual","Qualidade"],["#of-inst","Instituições"]].map(([a,l])=>`<a class="btn ghost small" href="javascript:void(0)" onclick="document.querySelector('${a}').scrollIntoView({behavior:'smooth'})">${l}</a>`).join("")}</div>`;
  const g4tx = of.series.of_consentimentos_transmitidos.obs;
  const cresc4 = g4tx.length > 4 ? ((g4tx[g4tx.length-1].v / g4tx[g4tx.length-5].v - 1) * 100).toFixed(1) : null;
  const sintese = `Consentimentos em ${fmt.n0(cons.v/1e6)} mi (${cresc4 != null ? (cresc4>0?"+":"")+cresc4+"% em 4 semanas" : ""}); concentração transacional top-5 de ${conc.dados_transacionais ? conc.dados_transacionais.top5_pct : "–"}% (HHI parcial ${conc.dados_transacionais ? conc.dados_transacionais.hhi_parcial : "–"}); sucesso técnico ${(idx2.qualidade_tecnica && idx2.qualidade_tecnica.componentes[0].valor) || "–"}% na fase transacional; ${(of.alertas_of||[]).length} alerta(s) ativo(s). Conversão: não publicada pela fonte.`;
  const heroChamadas = ["of_chamadas_dados_transacionais", "of_chamadas_dados_abertos", "of_chamadas_iniciacao_pagamento"]
    .map(k => of.series[k] ? of.series[k].obs[of.series[k].obs.length - 1].v : 0).reduce((a, b) => a + b, 0);
  const heroSuc = of.series.of_sucesso_dados_transacionais ? of.series.of_sucesso_dados_transacionais.obs.slice(-1)[0].v : null;
  const heroConsTx = of.series.of_consentimentos_transmitidos.obs;
  const heroCresc = heroConsTx.length > 4 ? ((heroConsTx[heroConsTx.length - 1].v / heroConsTx[heroConsTx.length - 5].v - 1) * 100) : null;
  const hero = `<div class="hero-of">
    <h3 class="heroline">O ecossistema <b>Open Finance Brasil</b> em números — ao vivo</h3>
    <div class="hero-grid">
      <div><div class="hero-num">${fmt.n0(cons.v / 1e6)}<small> Mi</small></div><div class="hero-lbl">consentimentos ativos</div>
        <div class="hero-chev">⌄</div><div class="hero-sub"><b>${heroCresc != null ? (heroCresc >= 0 ? "+" : "") + fmt.n(heroCresc, 1) + "%" : "–"}</b> de crescimento<br>em 4 semanas ${badge("observado")}</div></div>
      <div><div class="hero-num">${fmt.n(heroChamadas / 1e9, 1)}<small> Bi</small></div><div class="hero-lbl">chamadas de API por semana</div>
        <div class="hero-chev">⌄</div><div class="hero-sub">soma das 3 fases<br>na última semana ${badge("observado")}</div></div>
      <div><div class="hero-num">${heroSuc != null ? fmt.n(heroSuc, 1) : "–"}<small>%</small></div><div class="hero-lbl">taxa de sucesso (transacional)</div>
        <div class="hero-chev">⌄</div><div class="hero-sub">respostas 2xx/3xx sobre o total<br>de chamadas da semana ${badge("calculado")}</div></div>
      <div><div class="hero-num">${of.participantes.total}</div><div class="hero-lbl">organizações no diretório oficial</div>
        <div class="hero-chev">⌄</div><div class="hero-sub">bancos, cooperativas, fintechs e<br>instituições de pagamento ${badge("observado")}</div></div>
    </div>
    <div class="hero-foot">Fonte: Dashboard do Cidadão (rotas públicas) e diretório oficial de participantes · data-base: semana de ${fmt.d(cons.ref)} · números atualizados a cada execução do pipeline. Clientes únicos não são publicados nas rotas públicas — nunca estimados. O nº de organizações do diretório difere da contagem de "instituições ativas" de materiais institucionais (que somam marcas/entidades dos conglomerados).</div>
  </div>`;
  el.innerHTML = `
  ${pageHead({ title: "Open Finance", seals: badge("observado"),
    desc: "Adoção, utilização, desempenho técnico e concentração do ecossistema — rotas públicas do Dashboard do Cidadão + diretório oficial de participantes.",
    fontes: "Open Finance Brasil (Dashboard do Cidadão, diretório)" })}
  ${hero}
  ${subnav}
  <div id="of-geral" class="card" style="margin-top:10px"><h4>Síntese ${badge("calculado","frase montada por regras determinísticas")}</h4><p>${sintese}</p>
  <div class="src">data-base: semana de ${fmt.d(cons.ref)} · fonte: Dashboard do Cidadão (rotas públicas) · variação anual indisponível (histórico curto — declarado)</div></div>
  <div id="of-cons"><h3>Consentimentos ${badge("observado")}</h3>
  <div class="grid g2">${sChart("of_consentimentos_transmitidos", "#1d4e89")}${sChart("of_consentimentos_recebidos", "#0e7c7b")}</div>
  <div class="src">clientes únicos e consentimentos por cliente: não publicados nas rotas — nunca estimados. Chamadas por consentimento: ver Índice de Utilização.</div></div>
  <div id="of-apis"><h3>APIs, endpoints e desempenho</h3>
  <div class="grid g3">${sChart("of_chamadas_dados_transacionais", "#1d4e89")}${sChart("of_chamadas_dados_abertos", "#0e7c7b")}${sChart("of_chamadas_iniciacao_pagamento", "#6b46a3")}</div>
  <div class="grid g3">${sChart("of_sucesso_dados_transacionais", "#1d4e89")}${sChart("of_sucesso_dados_abertos", "#0e7c7b")}${sChart("of_sucesso_iniciacao_pagamento", "#6b46a3")}</div>
  <div class="grid g3">${Object.entries(of.endpoints_top || {}).map(([s, e]) => `<div class="card"><h4>Top endpoints — ${fasesL[s]}</h4>
    ${e.endpoints.slice(0, 8).map(x => `<div class="contrib"><span class="lbl" style="width:170px">${x.nome.slice(0, 26)}</span><span class="num">${fmt.n0(x.chamadas / 1e6)} mi</span></div>`).join("")}
    <div class="src">acumulado da janela divulgada · sucesso/latência por endpoint: indisponíveis</div></div>`).join("")}</div></div>
  <div id="of-inic"><h3>Iniciação de pagamentos ${badge("observado")}</h3>
  <div class="grid g2">
    <div class="card"><h4>Ranking nominal — chamadas da fase</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>#</th><th>Organização</th><th>Chamadas</th><th>Share</th></tr></thead>
      <tbody>${(of.rankings_fase.iniciacao_pagamento || []).slice(0, 12).map((r, i) => `<tr><td>${i + 1}</td><td>${r.organisation}</td><td>${fmt.n0(r.chamadas / 1e6)} mi</td><td>${r.share_pct}%</td></tr>`).join("")}</tbody></table></div>
      <div class="src">a fonte não separa iniciadores de detentores no ranking; pagamentos CONCLUÍDOS e funil não são publicados — apenas chamadas da fase.</div></div>
    <div class="card"><h4>Concentração — iniciação</h4>
      ${conc.iniciacao_pagamento ? `<div class="src" style="font-size:13px;line-height:2">top-1: <b>${conc.iniciacao_pagamento.top1_pct}%</b> · top-5: <b>${conc.iniciacao_pagamento.top5_pct}%</b> · top-10: <b>${conc.iniciacao_pagamento.top10_pct}%</b> · fora do top-5: ${conc.iniciacao_pagamento.fora_top5_pct}% · HHI parcial: <b>${conc.iniciacao_pagamento.hhi_parcial}</b><br><i>${conc.iniciacao_pagamento.nota}</i></div>` : ""}</div>
  </div></div>
  <div id="of-conc"><h3>Concentração por fase ${badge("calculado")}</h3>
  <div class="grid g3">${Object.entries(conc).map(([s, c]) => `<div class="card"><h4>${fasesL[s]}</h4>
    ${["top1_pct","top5_pct","top10_pct","fora_top5_pct"].map(k => `<div class="contrib"><span class="lbl" style="width:90px">${k.replace("_pct","").replace("_"," ")}</span><span class="bar pos" style="width:${(c[k]||0)*1.2}px"></span><span class="num">${c[k]}%</span></div>`).join("")}
    <div class="src">HHI parcial: <b>${c.hhi_parcial}</b> · ${c.nota}</div></div>`).join("")}</div>
  <div class="src">mobilidade de ranking: histórico de snapshots iniciado nesta versão (of_ranking_hist) — comparações entre coletas aparecem conforme o histórico acumula.</div></div>
  <div id="of-idx"><h3>Índices (4 dimensões separadas — sem índice único de maturidade) ${badge("calculado")}</h3>
  <div class="grid g2">${Object.entries(idx2).map(([k, ix]) => `<div class="card"><h4>Índice de ${k.replace(/_/g, " ")}</h4>
    ${ix.indisponivel ? `<p class="src"><b>Indisponível:</b> ${ix.indisponivel}</p>` :
    `${ix.componentes.map(c => `<div class="contrib"><span class="lbl" style="width:280px">${c.nome}</span><span class="num"><b>${c.valor != null ? fmt.n(c.valor, 2) : "n/d"}</b>${c.tendencia_4s_pp != null ? ` <span class="src">(${fmt.pp(c.tendencia_4s_pp)} p.p./4s)</span>` : ""} <span class="src">peso ${c.peso}</span></span></div>`).join("")}
    <div class="src">cobertura: ${ix.cobertura} · confiança: ${ix.confianca} (${ix.confianca_motivo}) · v${ix.versao}</div>`}</div>`).join("")}</div></div>
  <div id="of-alertas"><h3>Alertas do Open Finance</h3>
  ${(of.alertas_of || []).length ? of.alertas_of.map(a => `<div class="alert ${a.severidade}"><span class="lvl">${a.severidade}</span> <b>${a.indicador}: ${fmt.n(a.valor, 2)}</b> (limiar ${a.limiar}; persistência ${a.persistencia_semanas} sem.; ${fmt.d(a.data)})<div class="expl">Regra: ${a.regra} · ${a.fonte}</div></div>`).join("") : "<p class='src'>nenhum alerta ativo.</p>"}</div>
  <div id="of-qual"><h3>Qualidade dos dados</h3><div class="card">
    <div class="src" style="line-height:1.9"><b>Semanas por série:</b> ${Object.entries(of.qualidade_dados.semanas_por_serie).map(([k, v]) => `${k.replace("of_", "")}: ${v}`).join(" · ")}<br>
    <b>Organizações do ranking sem match no diretório:</b> ${of.qualidade_dados.orgs_ranking_sem_match_diretorio}<br>
    <b>Indisponíveis na fonte (nunca estimados):</b> ${of.qualidade_dados.indisponiveis.join("; ")}<br>
    <b>${of.qualidade_dados.nota}</b></div></div>
  ${of.relacao_credito ? `<h3>Relação exploratória com o crédito ${badge("calculado")}</h3><div class="card">
    ${scatterPlot(of.relacao_credito.pares.map(p => ({ x: p.share_carteira_pct, y: p.share_chamadas_pct, label: p.organisation })), "share da carteira de crédito (%)", "share de chamadas OF (%)")}
    <div class="src">Spearman ρ = <b>${of.relacao_credito.spearman_rho}</b> (n=${of.relacao_credito.n}). ${of.relacao_credito.leitura}</div></div>` : ""}</div>
  <div id="of-inst"><h3>Instituições — ranking nominal (fase transacional) ${badge("observado")}</h3>
  <div class="tblwrap"><table class="data"><thead><tr><th>#</th><th>Organização / papéis</th><th>Chamadas/sem.</th><th>Share</th><th>Famílias de API</th><th>Maturidade estrutural</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="src">sucesso/falha, consentimentos e conversão POR ORGANIZAÇÃO não são publicados — comparações nominais limitam-se a volume, share e cobertura funcional. ${of.fonte_nota}</div></div>`;
}

/* ---------- CENÁRIOS ---------- */
function scenarioForecast() {
  const sc = state.data.scenario;
  if (!sc) return null;
  const base = (sc.base_forecasts || {})[state.filters.seg] || sc.base_forecast_inad_total;
  if (!base || !base.ok) return null;
  const el = sc.elasticidades;
  const shock = h => {
    const ramp = Math.min(h / 12, 1);
    let d = 0, dLo = 0, dHi = 0;
    for (const [k, v] of Object.entries(state.scen)) {
      const e = el[k]; if (!e || !v) continue;
      d += e.value * v * ramp; dLo += e.range[0] * v * ramp; dHi += e.range[1] * v * ramp;
    }
    return { d, dLo: Math.min(dLo, dHi), dHi: Math.max(dLo, dHi) };
  };
  return {
    base,
    pontos: base.pontos.map(p => {
      const s = shock(p.h);
      return { ...p, cen50: Math.max(p.p50 + s.d, 0), cen10: Math.max(p.p10 + s.dLo, 0), cen90: Math.max(p.p90 + s.dHi, 0) };
    }),
  };
}
function transmissionChain() {
  const el = state.data.scenario.elasticidades;
  const s = state.scen;
  const steps = [];
  if (s.selic_pp) steps.push(`Selic ${fmt.pp(s.selic_pp)} p.p. → custo do crédito e serviço da dívida (elasticidade ${el.selic_pp.value} [${el.selic_pp.range}])`);
  if (s.desemprego_pp) steps.push(`Desemprego ${fmt.pp(s.desemprego_pp)} p.p. → renda e capacidade de pagamento (${el.desemprego_pp.value} [${el.desemprego_pp.range}])`);
  if (s.pib_pp) steps.push(`PIB ${fmt.pp(s.pib_pp)} p.p. → atividade setorial e receita das empresas (${el.pib_pp.value} [${el.pib_pp.range}])`);
  if (s.cambio_pct10) steps.push(`Câmbio ${fmt.pp(s.cambio_pct10 * 10)}% → custo de insumos e dívida cambial (${el.cambio_pct10.value} [${el.cambio_pct10.range}])`);
  if (!steps.length) return "<p class='src'>nenhum choque aplicado — cenário igual à base.</p>";
  return `<div class="chain">${steps.map(t => `<div class="chainstep">→ ${t}</div>`).join("")}<div class="chainstep"><b>→ atrasos → inadimplência projetada</b> (rampa linear de 12 meses)</div></div>`;
}
function renderScenarios() {
  const el = document.getElementById("view-scenarios");
  const { scenario, pulse } = state.data;
  if (!scenario || !pulse) { el.innerHTML = "<p>sem dados</p>"; return; }
  const sf = scenarioForecast();
  const seg = state.filters.seg;
  const inad = pulse.series[`inad_${seg}`] || pulse.series.inad_total;
  const last = inad.obs[inad.obs.length - 1];
  let chart = "";
  if (sf) {
    const hist = inad.obs.slice(-36).map(o => ({ x: o.ref, y: o.v }));
    chart = lineChart({
      series: [
        { pts: hist, color: "#1d4e89", label: "inadimplência observada" },
        { pts: [{ x: last.ref, y: last.v }, ...sf.pontos.map(p => ({ x: p.ref_date, y: p.p50 }))], color: "#1d4e89", dash: "5,4", label: "base p50" },
        { pts: [{ x: last.ref, y: last.v }, ...sf.pontos.map(p => ({ x: p.ref_date, y: p.cen50 }))], color: "#6b46a3", w: 2.4, label: "cenário p50" },
      ],
      band: { pts: [{ x: last.ref, lo: last.v, hi: last.v }, ...sf.pontos.map(p => ({ x: p.ref_date, lo: p.cen10, hi: p.cen90 }))] },
      h: 240, forecastStart: last.ref, unit: "%", fonte: "BCB/SGS + elasticidades empíricas", status: "observado + cenário",
    });
  }
  const sliders = [
    ["selic_pp", "Δ Selic (p.p.)", -4, 8, 0.25],
    ["desemprego_pp", "Δ Desemprego (p.p.)", -3, 6, 0.25],
    ["pib_pp", "Δ Crescimento do PIB (p.p.)", -6, 4, 0.25],
    ["cambio_pct10", "Depreciação cambial (×10%)", -3, 6, 0.5],
  ].map(([k, lbl, mi, ma, st]) => `
    <div class="sl"><label>${lbl}<span class="val">${state.scen[k] > 0 ? "+" : ""}${state.scen[k]}</span></label>
    <input type="range" min="${mi}" max="${ma}" step="${st}" value="${state.scen[k]}" oninput="setScen('${k}', this.value)" aria-label="${lbl}"></div>`).join("");
  const tbl = sf ? `<div class="tblwrap"><table class="data"><thead><tr><th>Horizonte</th><th>Base p50 ${badge("previsao")}</th><th>Cenário p50 ${badge("cenario")}</th><th>Δ (p.p.)</th><th>Banda do cenário</th></tr></thead><tbody>
    ${sf.pontos.map(p => `<tr><td>${p.h}m (${fmt.my(p.ref_date)})</td><td>${fmt.n(p.p50)}%</td><td><b>${fmt.n(p.cen50)}%</b></td><td>${fmt.pp(p.cen50 - p.p50)}</td><td>${fmt.n(p.cen10)}% – ${fmt.n(p.cen90)}%</td></tr>`).join("")}</tbody></table></div>` : "";
  el.innerHTML = `
  ${pageHead({ title: "Cenários e testes de estresse",
    desc: "Simulação condicional sobre a projeção-base de inadimplência via elasticidades empíricas — resultado condicionado às hipóteses definidas, nunca previsão.",
    fontes: "BCB/SGS + elasticidades estimadas (documentadas)" })}
  <div class="controls">
    ${segTabs()}${seg !== "total" ? `<span class="src">elasticidades estimadas para o agregado aplicadas ao segmento — aproximação adicional</span>` : ""}
  </div>
  <div class="controls">
    ${Object.entries(scenario.presets).map(([name, p]) => `<button class="btn ghost small" onclick='applyPreset(${JSON.stringify(p)})'>${name.replace(/_/g, " ")}</button>`).join("")}
    <button class="btn small" onclick="saveScen()">salvar cenário</button>
    ${state.scenSaved ? `<span class="src">salvo: ${JSON.stringify(state.scenSaved)}</span>` : ""}
    <button class="btn ghost small" onclick="exportScenario()">exportar (JSON)</button>
    <button class="btn ghost small" onclick="buildReport()">📄 relatório (PDF)</button>
  </div>
  <div class="sliders">${sliders}</div>
  <div class="card" style="margin-top:14px">
    <h4>Inadimplência ${segName()}: base ${badge("previsao")} vs. cenário ${badge("cenario")}</h4>
    <div class="legend"><span><span class="sw" style="background:var(--c-line1)"></span>observado / base (tracejada)</span><span><span class="sw" style="background:var(--c-forecast)"></span>cenário</span><span><span class="sw" style="background:var(--c-band);height:10px"></span>banda do cenário</span></div>
    ${chart}
    ${chartFooter({ fonte: "BCB/SGS 21082 + elasticidades documentadas", periodo: "36m observados + 12m", atualizado: state.data.meta ? state.data.meta.gerado_em.slice(0, 10) : "–", unidade: "%", nota: scenario.nota })}
  </div>
  <h3>Cadeia de transmissão do choque</h3>
  ${transmissionChain()}
  ${tbl}
  <div class="note"><b>Elasticidades — origem: ${scenario.elasticidades_origem || "ilustrativa"}.</b>
  ${Object.entries(scenario.elasticidades).map(([k, e]) => `<br><b>${k}</b>: ${e.value} [${e.range[0]} – ${e.range[1]}] p.p. · ${e.lag_desc} · <i>${e.fonte || "ilustrativo"}</i>${e.erro_padrao != null ? ` (EP ${e.erro_padrao})` : ""}`).join("")}
  <br><span class="src">${scenario.elasticidades_detalhe || scenario.nota}</span></div>
  <div class="note">Impacto em provisões, instituições e setores específicos: preparado arquiteturalmente, depende dos cortes setoriais (Fases 2b/3).</div>`;
}

/* ---------- ALERTAS ---------- */
function renderAlerts() {
  const el = document.getElementById("view-alerts");
  const { alerts, pulse } = state.data;
  if (!alerts || !pulse) { el.innerHTML = "<p>sem dados</p>"; return; }
  const userRules = getUserRules();
  const userAlerts = evalUserRules();
  const hist = alerts.historico || [];
  el.innerHTML = `
  ${pageHead({ title: "Central de alertas",
    desc: "Regras determinísticas sobre séries observadas, com estado gerenciável por alerta e feed RSS para assinatura externa.",
    fontes: "regras sobre BCB/SGS, IF.data e Open Finance" })}
  <div class="controls">
    <a class="btn ghost small" href="${DATA_BASE}alerts.xml" target="_blank" rel="noopener">📡 assinar alertas (RSS)</a>
    <a class="btn ghost small" href="${DATA_BASE}report.html?v=${APP_VERSION}" target="_blank" rel="noopener">📄 relatório automático diário (HTML → imprimir = PDF)</a>
    <span class="src">para receber por e-mail: assine o RSS em qualquer serviço RSS→e-mail (ex.: Blogtrottr); periodicidade segue o pipeline diário</span>
  </div>
  <h3>Alertas (${alerts.alertas.length}) — estado gerido localmente</h3>
  <div class="src" style="margin-bottom:8px">estados: ${ALERT_STATES.join(" · ")} (salvos neste navegador)</div>
  ${alerts.alertas.map(a => alertHtml(a, a.serie && a.serie !== "*" ? "pulse" : "method", true)).join("") || "<p class='src'>nenhum</p>"}
  <h3>Minhas regras (avaliadas no navegador, salvas localmente)</h3>
  <div class="controls">
    <label>série <select id="urSeries">${Object.keys(pulse.series).map(k => `<option value="${k}">${k}</option>`).join("")}</select></label>
    <label>métrica <select id="urMetric"><option value="level">nível</option><option value="yoy">variação a/a</option></select></label>
    <label>direção <select id="urDir"><option value="up">acima de</option><option value="down">abaixo de</option></select></label>
    <label>limiar <input id="urThr" type="number" step="0.1" style="width:80px"></label>
    <button class="btn small" onclick="addUserRule()">adicionar</button>
  </div>
  ${userRules.map((r, i) => `<div class="alert ${userAlerts[i] ? "atencao" : "informativo"}"><span class="lvl">${userAlerts[i] ? "DISPARADO" : "monitorando"}</span> <b>${r.series}</b> ${r.metric} ${r.dir === "up" ? ">" : "<"} ${r.thr} ${userAlerts[i] ? `— valor atual ${fmt.n(userAlerts[i].val)}` : ""} <button class="btn ghost small" onclick="delUserRule(${i})">remover</button></div>`).join("") || "<p class='src'>nenhuma regra cadastrada. Canais no protótipo: painel e relatório; e-mail na Fase 6.</p>"}
  <h3>Regras do pipeline (${(alerts.regras_configuradas || []).length})</h3>
  <div class="tblwrap"><table class="data"><thead><tr><th>Regra</th><th>Série</th><th>Métrica</th><th>Limiar</th><th>Nível</th></tr></thead><tbody>
  ${(alerts.regras_configuradas || []).map(r => `<tr><td>${r.label}</td><td>${r.series}</td><td>${r.metric}</td><td>${r.direction === "up" ? ">" : "<"} ${r.threshold}</td><td>${r.level}</td></tr>`).join("")}</tbody></table></div>
  <h3>Histórico de disparos (${hist.length})</h3>
  <div class="tblwrap"><table class="data"><thead><tr><th>Quando</th><th>Alerta</th><th>Nível</th><th>Valor</th></tr></thead><tbody>
  ${hist.map(h => `<tr><td class="src">${h.run_at.slice(0, 16).replace("T", " ")}</td><td>${h.titulo}</td><td>${h.nivel}</td><td>${h.valor != null ? fmt.n(h.valor, 2) : "–"}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ---------- PESQUISA (assistente determinístico) ---------- */
function _norm(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function _cite(meta, q) {
  return `${meta.source} · série ${meta.series_code} · ref. ${q ? fmt.my(q.ultima_ref) : "–"} · coletado ${meta.last_collected_at ? meta.last_collected_at.slice(0, 10) : "–"}`;
}

const INTENTS = [
  {
    id: "inad_por_que", kw: ["por que", "inadimplencia"], alt: [["subiu", "aumentou", "piorou", "explica"]],
    label: "Por que a inadimplência aumentou?",
    run() {
      const { pulse, overview, antecedentes, regimes } = state.data;
      const s = pulse.series.inad_total, last = s.obs[s.obs.length - 1], prev = s.obs[s.obs.length - 2];
      const det = overview.mudancas.top_deterioracoes;
      const prom = (antecedentes.targets.inad_total.candidatos || []).filter(c => c.status === "promovido");
      const reg = (regimes.series || []).find(r => r.serie === "inad_total");
      return {
        resposta: [
          { t: "obs", x: `Inadimplência total: ${fmt.n(prev.v)}% → ${fmt.n(last.v)}% (${fmt.pp(last.v - prev.v)} p.p. no mês, ref. ${fmt.my(last.ref)}).` },
          { t: "calc", x: `Indicadores que se deterioraram junto: ${det.map(r => `${r.indicador} (${fmt.pp(r.delta_1m)})`).join("; ") || "nenhum relevante"}.` },
          { t: "calc", x: `Antecedentes promovidos que anteciparam o movimento: ${prom.map(c => `${c.candidato} (defasagem ${c.melhor_defasagem_meses}m, corr. ${c.correlacao_melhor_defasagem}, ganho preditivo ${c.ganho_oos_pct}%)`).join("; ") || "nenhum"}.` },
          { t: "interp", x: `Estado de regime (hipótese estatística): ${reg ? reg.estado_hipotese : "–"}. Associações não implicam causalidade.` },
        ],
        calculo: "Δ mensal da série observada; deteriorações rankeadas por |Δ1m|/desvio-padrão histórico; antecedentes = protocolo de 4 critérios (aba Antecedentes).",
        fontes: [_cite(s.meta, s.qualidade), "Protocolo de antecedentes e detector de regimes: aba Metodologia (model cards)"],
      };
    },
  },
  {
    id: "setores_deteriorando", kw: ["setor"], alt: [["deterior", "piora", "estresse", "risco"]],
    label: "Quais setores estão deteriorando?",
    run() {
      const sec = state.data.sectors;
      const piora = sec.setores.filter(s => s.tendencia === "piorando").slice(0, 6);
      return {
        resposta: [
          { t: "calc", x: `Setores com tendência de piora (Δ3m do crescimento a/a): ${piora.map(s => `${s.nome} (score ${s.score}, ${fmt.pp(s.tendencia_valor_pp)} p.p./3m, ${s.velocidade})`).join("; ") || "nenhum no corte atual"}.` },
          { t: "obs", x: `Componente de atividade vem da produção física do IBGE; condições de crédito das séries PJ do BCB.` },
          { t: "demo", x: `Componentes de RJ setorial e emprego são demonstrativos — o score é parcialmente demo (ver decomposição por setor).` },
        ],
        calculo: sec.metodo,
        fontes: ["IBGE PIM-PF (tabela 8888) · BCB/SGS 21083 e 20784", "Limitações: " + sec.limitacoes],
      };
    },
  },
  {
    id: "inst_exposta_setor", kw: ["instituic", "expost"], alt: [["setor", "varejo", "comercio", "industria", "agro", "construcao", "transporte"]],
    label: "Qual instituição está mais exposta a um setor?",
    run(qn) {
      const ex = state.data.exposures;
      const alvo = Object.keys(ex.setores).find(slug => qn.includes(_norm(slug).split("_")[0])) ||
        Object.keys(ex.setores).find(slug => _norm(slug).split("_").some(t => t.length > 4 && qn.includes(t)));
      const chave = alvo || Object.keys(ex.setores)[0];
      const s = ex.setores[chave];
      return {
        resposta: [
          { t: "obs", x: `Setor ${chave.replace(/_/g, " ")} (carteira do sistema: ${fmt.money(s.total_brl)}, IF.data ${ex.anomes}).` },
          { t: "obs", x: `Maiores credores por volume: ${s.top_volume.map(i => `${i.nome} (${fmt.money(i.volume_brl)})`).join("; ")}.` },
          { t: "calc", x: `Maior exposição relativa à própria carteira PJ (≥ R$ 1 bi): ${s.top_exposicao_relativa.map(i => `${i.nome} (${i.share_da_propria_carteira_pj_pct}%)`).join("; ")}.` },
          { t: "interp", x: alvo ? "Exposição ≠ risco: não considera garantias nem qualidade das operações." : "Não identifiquei o setor na pergunta; mostrei o de maior carteira. Setores disponíveis: " + Object.keys(ex.setores).map(k => k.split("_")[0]).join(", ") + "." },
        ],
        calculo: ex.metodo,
        fontes: [`BCB IF.data (interface), carteiras PJ por CNAE, ${ex.anomes}`],
      };
    },
  },
  {
    id: "choque_juros", kw: ["juros", "selic"], alt: [["afeta", "impacto", "aumento", "choque", "carteira", "subir"]],
    label: "Como um aumento de juros afetaria a inadimplência?",
    run() {
      const sc = state.data.scenario;
      const e = sc.elasticidades.selic_pp;
      const base = (sc.base_forecasts || {}).total || sc.base_forecast_inad_total;
      const p12 = base && base.ok ? base.pontos[base.pontos.length - 1] : null;
      const d2 = { lo: e.range[0] * 2, mid: e.value * 2, hi: e.range[1] * 2 };
      return {
        resposta: [
          { t: "calc", x: `Elasticidade ${sc.elasticidades_origem === "empírico" ? "estimada empiricamente" : "ilustrativa"}: ${e.value} p.p. de inadimplência por p.p. de Selic (intervalo ${e.range[0]}–${e.range[1]}, efeito pleno em 12m). ${e.fonte || ""}` },
          { t: "cen", x: `+2 p.p. de Selic → +${fmt.n(d2.mid)} p.p. de inadimplência em 12m [${fmt.n(d2.lo)}–${fmt.n(d2.hi)}]${p12 ? `, levando a projeção-base de ${fmt.n(p12.p50)}% para ≈ ${fmt.n(p12.p50 + d2.mid)}%` : ""}. Resultado condicionado às hipóteses — não é previsão.` },
          { t: "interp", x: "Associação condicional por MQO, sem identificação causal; detalhes e erros-padrão na aba Cenários." },
        ],
        calculo: sc.elasticidades_detalhe || sc.nota,
        fontes: ["Elasticidades: MQO sobre Δ12m (BCB/SGS 21082, 432; IBGE PNAD; Ipeadata câmbio)"],
      };
    },
  },
  {
    id: "rj_bancos", kw: ["recupera"], alt: [["banco", "credor", "afeta", "expost"]],
    label: "Quais recuperações judiciais podem afetar bancos?",
    run() {
      const rj = state.data.rj;
      const ex = rj.exposicao_citada;
      const casos = rj.casos_reais.fichas.filter(f => f.credores && f.credores.bancos && f.credores.bancos.length).slice(0, 5);
      return {
        resposta: [
          { t: "obs", x: `Na janela de ${ex.janela_dias} dias, ${ex.casos_com_credores} processos citam credores financeiros. Mais citados: ${ex.bancos.slice(0, 5).map(b => `${b.banco} (${b.casos} casos)`).join("; ")}.` },
          { t: "obs", x: `Exemplos com credores identificados: ${casos.map(c => `${c.empresas[0]} (${c.tribunal}: ${c.credores.bancos.slice(0, 2).map(b => b.nome).join(", ")})`).join("; ") || "ver aba Recuperações & Falências"}.` },
          { t: "interp", x: "Presença em lista de credores não mede exposição total do banco; valores citados podem ser um único crédito." },
        ],
        calculo: ex.metodo,
        fontes: ["CNJ/DJEN (Comunica PJe), publicações de 'relação de credores'"],
      };
    },
  },
  {
    id: "series_desatualizadas", kw: ["desatualizad"], alt: [["serie", "dado", "quais"]],
    label: "Quais séries estão desatualizadas?",
    run() {
      const q = state.data.quality;
      const stale = Object.entries(q).filter(([k, v]) => v.componentes.atualidade < 70)
        .sort((a, b) => b[1].dias_sem_atualizar - a[1].dias_sem_atualizar).slice(0, 10);
      return {
        resposta: [
          { t: "calc", x: stale.length ? `Séries com atualidade baixa (dias desde a referência, inclui defasagem normal de publicação): ${stale.map(([k, v]) => `${v.nome} (${v.dias_sem_atualizar}d)`).join("; ")}.` : "Nenhuma série com atualidade crítica." },
          { t: "interp", x: "Ausência de dado novo não é interpretada como zero; parte da defasagem é o calendário normal da fonte." },
        ],
        calculo: "Score de atualidade = função dos dias desde a última referência vs. frequência esperada (aba Metodologia).",
        fontes: ["Catálogo de qualidade por série (quality.json)"],
      };
    },
  },
  {
    id: "confianca_previsao", kw: ["confianca", "previs"], alt: [[""]],
    label: "Qual a confiança da previsão de inadimplência?",
    run() {
      const f = state.data.pulse.previsoes.inad_total;
      const d = f.diagnostico["12"];
      return {
        resposta: [
          { t: "prev", x: `Projeção 12m da inadimplência total: ${fmt.n(f.pontos[f.pontos.length - 1].p50)}% [${fmt.n(f.pontos[f.pontos.length - 1].p10)}–${fmt.n(f.pontos[f.pontos.length - 1].p90)}].` },
          { t: "calc", x: `Diagnóstico do backtest (h=12): MAE ${fmt.n(d.mae_ensemble_backtest, 3)} vs. ingênuo ${fmt.n(d.mae_naive_backtest, 3)} (ganho ${d.ganho_vs_naive_pct}%), ${d.n_backtests} cortes walk-forward; pesos: ${Object.entries(d.pesos).map(([m, w]) => `${m} ${w}`).join(", ")}.` },
          { t: "interp", x: `Limitações: ${f.limitacoes}` },
        ],
        calculo: f.metodo,
        fontes: [_cite(state.data.pulse.series.inad_total.meta, state.data.pulse.series.inad_total.qualidade)],
      };
    },
  },
  {
    id: "pme", kw: ["pme", "pequen"], alt: [["credito", "empresa", "micro"]],
    label: "Quem mais empresta a micro e pequenas empresas?",
    run() {
      const ex = state.data.exposures;
      return {
        resposta: [
          { t: "obs", x: `Participação PME no sistema: ${ex.pme_share_sistema_pct}% da carteira PJ classificada por porte (IF.data ${ex.anomes}).` },
          { t: "obs", x: `Maiores participações PME na própria carteira PJ (≥ R$ 1 bi): ${ex.ranking_pme.slice(0, 6).map(x => `${x.nome} (${x.pme_share_pct}%)`).join("; ")}.` },
        ],
        calculo: ex.metodo, fontes: [`BCB IF.data (interface), carteira PJ por porte, ${ex.anomes}`],
      };
    },
  },
];

function answer(question) {
  const qn = _norm(question);
  let best = null, bestScore = 0;
  for (const it of INTENTS) {
    const kwOk = it.kw.every(k => qn.includes(k));
    if (!kwOk) continue;
    const altOk = it.alt.every(group => group.some(a => a === "" || qn.includes(a)));
    const score = it.kw.length + (altOk ? 1 : 0);
    if (kwOk && altOk && score > bestScore) { best = it; bestScore = score; }
  }
  if (!best) {
    return { semResposta: true };
  }
  try { return { intent: best, ...best.run(qn) }; }
  catch (e) { return { semResposta: true, erro: true }; }
}

const TAG_CLS = { obs: "obs", calc: "calc", interp: "aprox", prev: "prev", cen: "cen", demo: "demo" };
const TAG_TXT = { obs: "OBSERVADO", calc: "CALCULADO", interp: "INTERPRETAÇÃO", prev: "PREVISÃO", cen: "CENÁRIO", demo: "DEMONSTRATIVO" };

function answerHtml(h, idx) {
  const r = h.r;
  if (r.semResposta) {
    return `<div class="card" style="margin-bottom:10px"><h4>“${h.q}”</h4>
    <p><b>Não tenho evidência suficiente nos dados da plataforma para responder a essa pergunta.</b></p>
    <p class="src">Escopo atual (determinístico): ${INTENTS.map(i => i.label).join(" · ")}.</p></div>`;
  }
  return `<div class="card" style="margin-bottom:10px"><h4>“${h.q}”</h4>
  ${r.resposta.map(p => `<p><span class="seal ${TAG_CLS[p.t]}">${TAG_TXT[p.t]}</span> ${p.x}</p>`).join("")}
  <details class="decomp"><summary>cálculo e método</summary><div class="src">${r.calculo}</div></details>
  <div class="src"><b>Fontes:</b> ${r.fontes.join(" · ")}</div>
  <button class="btn ghost small" onclick="exportAnswer(${idx})">exportar resposta (JSON)</button></div>`;
}
window.exportAnswer = idx => {
  const h = loadLS("obc_research", [])[idx];
  if (h) download("obc_resposta.json", JSON.stringify({ pergunta: h.q, ...h.r }, null, 2), "application/json");
};

function renderResearch() {
  const el = document.getElementById("view-research");
  const hist = loadLS("obc_research", []);
  el.innerHTML = `
  ${pageHead({ title: "Pesquisa — assistente de consulta estruturada",
    desc: "Consultas determinísticas sobre os dados carregados (8 intenções). Perguntas fora do escopo são recusadas com transparência — sem geração livre.",
    fontes: "camada gold local (sem chamadas externas)" })}
  <div class="controls">
    <input id="qbox" type="text" placeholder="ex.: por que a inadimplência aumentou?" style="flex:1;min-width:280px;border:1px solid var(--border);border-radius:6px;padding:8px 12px" onkeydown="if(event.key==='Enter')askQuestion()">
    <button class="btn" onclick="askQuestion()">perguntar</button>
  </div>
  <div class="controls" style="flex-wrap:wrap">${INTENTS.map(i => `<button class="btn ghost small" onclick="askPreset('${i.id}')">${i.label}</button>`).join("")}</div>
  <div id="answers">${hist.map((h, i) => answerHtml(h, i)).join("")}</div>`;
}
window.askPreset = id => {
  const it = INTENTS.find(i => i.id === id);
  document.getElementById("qbox").value = it.label;
  askQuestion();
};
window.askQuestion = () => {
  const q = document.getElementById("qbox").value.trim();
  if (!q) return;
  const r = answer(q);
  delete r.intent;
  const hist = loadLS("obc_research", []);
  hist.unshift({ q, r });
  saveLS("obc_research", hist.slice(0, 12));
  document.getElementById("answers").innerHTML = loadLS("obc_research", []).map((h, i) => answerHtml(h, i)).join("");
};

/* ---------- METODOLOGIA ---------- */
function renderMethod() {
  const el = document.getElementById("view-method");
  const { meta, quality, lineage, ibcc, pulse, method } = state.data;
  const catRows = quality && pulse ? Object.entries(quality).sort((a, b) => a[1].score - b[1].score).map(([k, q]) => {
    const m = pulse.series[k] ? pulse.series[k].meta : null;
    return `<tr><td>${q.nome}</td><td>${q.fonte}${m ? ` <span class="src">${m.series_code}</span>` : ""}</td>
      <td class="src">${m ? `<a href="${m.url}" target="_blank" rel="noopener">endpoint</a> · ${m.freq} · ${m.unit}` : "—"}</td>
      <td>${fmt.my(q.ultima_ref)}</td><td>${q.dias_sem_atualizar}d</td><td>${q.n_obs}</td><td>${q.n_revisoes}</td><td>${qBadge(q)}</td></tr>`;
  }).join("") : "";
  const dictRows = method ? method.dicionario_indicadores.map(d => `
    <details class="decomp card" style="margin-bottom:6px"><summary><b>${d.nome}</b> — ${d.definicao}</summary>
      <div class="src" style="margin-top:6px"><b>Fórmula:</b> ${d.formula}<br>${d.numerador !== "—" ? `<b>Numerador:</b> ${d.numerador} · <b>Denominador:</b> ${d.denominador}<br>` : ""}
      <b>Interpretação:</b> ${d.interpretacao}<br><b>Limitações:</b> ${d.limitacoes}<br><b>Periodicidade:</b> ${d.periodicidade}</div></details>`).join("") : "";
  const cardRows = method ? method.model_cards.map(c => `
    <details class="decomp card" style="margin-bottom:6px"><summary><b>${c.nome}</b> · v${c.versao} · ${c.objetivo}</summary>
      <div class="src" style="margin-top:6px">
      <b>Variável-alvo:</b> ${c.variavel_alvo} · <b>Algoritmo:</b> ${c.algoritmo}<br>
      <b>Validação:</b> ${c.validacao} · <b>Benchmark:</b> ${c.benchmark}<br>
      <b>Desempenho:</b> ${JSON.stringify(c.desempenho)}<br>
      <b>Incerteza:</b> ${c.incerteza}<br><b>Limitações:</b> ${c.limitacoes || "—"}<br>
      <b>Atualizado:</b> ${c.atualizado_em ? c.atualizado_em.slice(0, 16).replace("T", " ") : "—"}</div></details>`).join("") : "";
  const verRows = method ? method.changelog.map(v => `
    <div class="card" style="margin-bottom:8px"><b>v${v.versao}</b> — ${fmt.d(v.data)}<ul>${v.mudancas.map(m => `<li class="src">${m}</li>`).join("")}</ul></div>`).join("") : "";
  const lrows = lineage ? lineage.linhagem_recente.slice(0, 20).map(l => `
    <tr><td>${l.gold_object}</td><td class="src">${l.bronze_file}</td><td class="src" style="font-family:monospace">${l.sha256.slice(0, 12)}…</td><td class="src">${l.transform}</td><td class="src">${l.created_at.slice(0, 19)}</td></tr>`).join("") : "";
  const ic = (meta || {}).inad_conceitos || {};
  const inadVerbete = `<div class="card" style="margin-top:16px" id="tres-inadimplencias"><h4>As três inadimplências (por que os números diferem entre páginas)</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Conceito</th><th>Definição</th><th style="text-align:right">Valor atual</th><th>Usado em</th></tr></thead><tbody>
    <tr><td><b>SGS &gt;90d</b></td><td class="src">${(ic.sgs || {}).def || ""}</td><td style="text-align:right"><b>${ic.sgs && ic.sgs.v != null ? fmt.n(ic.sgs.v, 2) + "%" : "–"}</b> <span class="src">${(ic.sgs || {}).ref || ""}</span></td><td class="src">Visão geral, Pulso, Cenários, Sinais</td></tr>
    <tr><td><b>SCR arrastada</b></td><td class="src">${(ic.scr || {}).def || ""}</td><td style="text-align:right"><b>${ic.scr && ic.scr.v != null ? fmt.n(ic.scr.v, 2) + "%" : "–"}</b> <span class="src">${(ic.scr || {}).ref || ""}</span></td><td class="src">Panorama do Crédito</td></tr>
    <tr><td><b>IF.data ≥15d</b></td><td class="src">${(ic.atraso15 || {}).def || ""}</td><td style="text-align:right">por produto</td><td class="src">Produtos, Comparador, páginas de IF</td></tr>
    </tbody></table></div>
    <div class="src" style="margin-top:8px">Os três medem fenômenos correlatos com réguas diferentes (parcela vencida × operação inteira × atraso curto). Nenhum é “o certo”: cada página declara o seu ao lado do número (chip “ⓘ”). Variante adicional: inadimplência &gt;90d por instituição (IF.data, Res. 4.966), usada nas fichas de IF.</div></div>`;
  el.innerHTML = `
  ${pageHead({ title: "Metodologia, fontes e documentação viva",
    desc: "Catálogo de séries com qualidade e linhagem, model cards, limitações declaradas e histórico de revisões — a documentação acompanha os dados.",
    fontes: "todas as integrações listadas abaixo" })}\n  ${inadVerbete}
  <div class="grid g2">
    <div class="card"><h4>Classificação epistemológica</h4>
      <p>${badge("observado")} publicado pela fonte oficial, sem transformação além de formato.</p>
      <p>${badge("calculado")} derivado de observados por fórmula determinística (razões, índices, scores) — sempre com decomposição.</p>
      <p>${badge("estimado")} valor aproximado quando o dado não é diretamente observável — sempre com intervalo.</p>
      <p>${badge("previsao")} ensemble com backtest; bandas p10–p90 conformal.</p>
      <p>${badge("cenario")} condicional às hipóteses do usuário — não é previsão.</p>
      <p>${badge("experimental")} método em triagem, ainda não promovido.</p>
      <p>${badge("demo")} valores fictícios para demonstrar módulos sem fonte estável; nunca misturados a dados reais.</p>
      <p>${badge("descontinuada")} série encerrada pela fonte; histórico preservado.</p>
    </div>
    <div class="card"><h4>Regras metodológicas aplicadas</h4>
      <p class="src">Sem look-ahead nos backtests · ausência de dado ≠ zero · revisões registradas (${lineage ? lineage.n_revisoes_total : 0}) · estimativas sempre com intervalo · scores sempre decompostos · comparações apenas intra-grupo de pares · demo sempre selado · diagnóstico textual determinístico e auditável.</p>
      <h4>IBCC — método</h4><p class="src">${ibcc ? ibcc.metodo : ""}</p><p class="src"><b>Limitações:</b> ${ibcc ? ibcc.limitacoes : ""}</p></div>
  </div>
  <h3>1 · Catálogo de dados (${quality ? Object.keys(quality).length : 0} séries)</h3>
  <div class="tblwrap"><table class="data"><thead><tr><th>Série</th><th>Fonte / código</th><th>Acesso</th><th>Última ref.</th><th>Defasagem</th><th>Obs.</th><th>Revisões</th><th>Qualidade</th></tr></thead><tbody>${catRows}</tbody></table></div>
  <h3>2 · Dicionário de indicadores</h3>${dictRows}
  <h3>3 · Model cards</h3>${cardRows}
  <h3>3b · Score cards</h3>${method && method.score_cards ? method.score_cards.map(c => `
    <details class="decomp card" style="margin-bottom:6px"><summary><b>${c.nome}</b> · v${c.versao}</summary>
      <div class="src" style="margin-top:6px"><b>Componentes:</b> ${c.componentes.join("; ")}<br>
      <b>Pesos:</b> ${c.pesos} · <b>Normalização:</b> ${c.normalizacao}<br>
      <b>Tratamento de ausência:</b> ${c.tratamento_ausencia}<br>
      <b>Cobertura:</b> ${c.cobertura} · <b>Sensibilidade:</b> ${c.sensibilidade}<br>
      <b>Validação:</b> ${c.validacao}</div></details>`).join("") : ""}
  <h3>4 · Histórico de versões</h3>${verRows}
  <h3>Linhagem recente (bronze → gold)</h3>
  <div class="tblwrap"><table class="data"><thead><tr><th>Objeto</th><th>Arquivo bronze</th><th>SHA-256</th><th>Transformação</th><th>Quando</th></tr></thead><tbody>${lrows}</tbody></table></div>
  <h3>Referências de design e acessibilidade (não são fontes dos indicadores)</h3>
  <div class="card"><div class="src" style="line-height:2">
    <a href="https://developer.apple.com/design/human-interface-guidelines/" target="_blank" rel="noopener noreferrer">Apple Human Interface Guidelines</a> ·
    <a href="https://ig.ft.com/visual-vocabulary/" target="_blank" rel="noopener noreferrer">Financial Times — Visual Vocabulary</a> ·
    <a href="https://ig.ft.com/science-of-charts/" target="_blank" rel="noopener noreferrer">FT — The Science Behind Good Charts</a> ·
    <a href="https://observablehq.com/plot/features/interactions" target="_blank" rel="noopener noreferrer">Observable Plot — Interactions</a> ·
    <a href="https://www.w3.org/WAI/WCAG22/Understanding/" target="_blank" rel="noopener noreferrer">WCAG 2.2</a>
    <br>As fontes econômicas de cada indicador estão identificadas no catálogo acima e nos rodapés de cada gráfico.</div></div>
  `;
}

/* ---------- relatório / exportação / regras do usuário ---------- */
function buildReport() {
  const views = ["overview", "pulse", "scenarios"];
  document.querySelectorAll("section.view").forEach(s => s.classList.remove("active"));
  views.forEach(v => { document.getElementById("view-" + v).classList.add("active"); RENDER[v](); });
  const hdr = document.createElement("div");
  hdr.className = "printonly";
  hdr.id = "reportHeader";
  const m = state.data.meta;
  hdr.innerHTML = `<h1 style="font-family:var(--serif)">${m ? m.plataforma.name : ""} — Relatório</h1>
  <p>Gerado em ${new Date().toLocaleString("pt-BR")} · ${m ? m.plataforma.disclaimer : ""}</p>
  <p>Fontes reais: ${m ? m.fontes_reais.join(", ") : ""}. Módulos demonstrativos: ${m ? m.fontes_demo.join(", ") : ""}.</p><hr>`;
  const old = document.getElementById("reportHeader");
  if (old) old.remove();
  document.querySelector("main").prepend(hdr);
  setTimeout(() => { window.print(); showView("scenarios"); }, 150);
}
function download(name, content, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
}
function exportSeries(key) {
  const s = state.data.pulse.series[key];
  if (!s) return;
  const head = `# ${s.meta.name}\n# fonte: ${s.meta.source} | série: ${s.meta.series_code} | unidade: ${s.meta.unit} | freq: ${s.meta.freq}\n# metodologia: ${s.meta.methodology}\n# url: ${s.meta.url}\n# coletado em: ${s.meta.last_collected_at} | exportado em: ${new Date().toISOString()}\n# classificação: DADO OBSERVADO\n`;
  const csv = head + "ref_date,value\n" + s.obs.map(o => `${o.ref},${o.v}`).join("\n");
  download(`obc_${key}.csv`, csv, "text/csv");
}
function exportInstitutions() {
  download("obc_instituicoes.json", JSON.stringify({ ...state.data.institutions, exportado_em: new Date().toISOString() }, null, 2), "application/json");
}
function exportScenario() {
  const sf = scenarioForecast();
  download("obc_cenario.json", JSON.stringify({ tipo: "CENÁRIO", choques: state.scen, elasticidades: state.data.scenario.elasticidades, nota: state.data.scenario.nota, resultado: sf ? sf.pontos : null, exportado_em: new Date().toISOString() }, null, 2), "application/json");
}
function getUserRules() { return loadLS("obc_rules", []); }
function evalUserRules() {
  const { pulse } = state.data;
  return getUserRules().map(r => {
    const s = pulse.series[r.series]; if (!s) return null;
    let val = null;
    if (r.metric === "level") val = s.obs[s.obs.length - 1].v;
    else if (r.metric === "yoy" && s.yoy && s.yoy.length) val = s.yoy[s.yoy.length - 1].v;
    if (val == null) return null;
    return (r.dir === "up" ? val > r.thr : val < r.thr) ? { val } : null;
  });
}
window.addUserRule = () => {
  const rules = getUserRules();
  rules.push({ series: document.getElementById("urSeries").value, metric: document.getElementById("urMetric").value, dir: document.getElementById("urDir").value, thr: parseFloat(document.getElementById("urThr").value || "0") });
  saveLS("obc_rules", rules);
  renderAlerts();
};
window.delUserRule = i => { const r = getUserRules(); r.splice(i, 1); saveLS("obc_rules", r); renderAlerts(); };
window.setScen = (k, v) => { state.scen[k] = parseFloat(v); saveLS("obc_scen_cur", state.scen); renderScenarios(); };
window.applyPreset = p => { state.scen = { ...p }; saveLS("obc_scen_cur", state.scen); renderScenarios(); };
window.saveScen = () => { state.scenSaved = { ...state.scen }; saveLS("obc_scen", state.scen); renderScenarios(); };
window.exportSeries = exportSeries; window.exportInstitutions = exportInstitutions; window.exportScenario = exportScenario; window.buildReport = buildReport;
window.setFilter = setFilter;

/* ---------- roteador ---------- */
/* ================= BETS E RISCO FINANCEIRO ================= */
/* Painel investigativo: relação entre apostas de quota fixa e crédito das
   famílias. Princípio: não parte da conclusão de que "bets causam
   inadimplência"; investiga a hipótese e comunica o grau de evidência.
   Dados curados em data/gold/bets.json (ver FONTES_BETS.md). */

function betsNivel(n, B) {
  const meta = (B.niveis || {})[n];
  if (!meta) return "";
  return `<span class="nivel n${n.toLowerCase()}" title="${attr(meta.descricao)}">${n} · ${meta.rotulo}</span>`;
}
function betsStatus(st) {
  const map = {
    oficial: ["obs", "FONTE PRIMÁRIA"], calculado: ["calc", "CALCULADO"],
    estimativa: ["est", "ESTIMATIVA"], imprensa: ["aprox", "IMPRENSA · AGUARDA FONTE PRIMÁRIA"],
  };
  const m = map[st];
  return m ? `<span class="seal ${m[0]}">${m[1]}</span>` : "";
}
function betsEloChip(stKey, B) {
  const leg = ((B.cadeia || {}).legenda || {})[stKey] || stKey;
  return `<span class="elo-st ${stKey}">${leg}</span>`;
}
function betsBar(lbl, v, max, unit, warn) {
  const w = max > 0 ? Math.max((v / max) * 100, 1.5) : 0;
  return `<div class="bets-bar"><span class="lbl">${lbl}</span><span class="track"><span class="fill${warn ? " warn" : ""}" style="width:${w.toFixed(1)}%"></span></span><span class="num">${fmt.n(v, 1)}${unit ? ` <span class="src" style="display:inline">${unit}</span>` : ""}</span></div>`;
}

const betsExp = { ind: "inad_pf", norm: "nivel", eventos: true };
window.betsExpSet = (k, v) => {
  betsExp[k] = k === "eventos" ? !!v : v;
  renderBets();
};
window.betsJSON = () => {
  const B = state.data.bets;
  if (B) dlFile("bets_risco_financeiro_" + (B.corte_pesquisa || "") + ".json", JSON.stringify(B, null, 1), "application/json");
};
window.betsCSV = () => {
  const B = state.data.bets;
  if (!B) return;
  const rows = [["bloco", "referencia", "indicador", "valor", "unidade", "nivel_evidencia", "status", "fonte", "url"]];
  (B.sintese || []).forEach(k => rows.push(["sintese", k.data_ref, k.rotulo, k.valor == null ? k.exibir : k.valor, k.unidade, k.nivel, k.status, k.fonte, k.url]));
  const S = B.series || {};
  (S.ggr_regulado?.obs || []).forEach(o => rows.push(["ggr_regulado", o.ref, "GGR", o.v, "R$ bi", o.nivel, o.status, o.fonte || "SPA/MF", o.url]));
  (S.apostadores?.obs || []).forEach(o => rows.push(["apostadores", o.ref, o.conceito, o.v, "milhões", o.nivel, o.status, "SPA/MF", o.url]));
  (S.autoexclusao?.obs || []).forEach(o => rows.push(["autoexclusao", o.ref, "solicitações acumuladas", o.v, "mil", o.nivel, o.status, "SPA/MF", o.url]));
  (S.bloqueios_ilegais?.obs || []).forEach(o => rows.push(["bloqueios_ilegais", o.ref, "URLs bloqueadas (acum.)", o.v, "mil", o.nivel, o.status, "SPA/Anatel", o.url]));
  (S.arrecadacao?.obs || []).forEach(o => rows.push(["arrecadacao", o.ref, "tributos federais", o.tributos, "R$ bi", o.nivel, o.status, "RFB/SPA", o.url]));
  const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";")).join("\n");
  dlFile("bets_dados_" + (B.corte_pesquisa || "") + ".csv", "﻿" + csv, "text/csv");
};
window.betsExplorerCSV = () => {
  const pulse = state.data.pulse, B = state.data.bets;
  if (!pulse || !B) return;
  const cfg = (B.explorador.indicadores || []).find(i => i.key === betsExp.ind);
  const s = pulse.series[betsExp.ind];
  if (!s) return;
  const rows = [["referencia", cfg ? cfg.rotulo : betsExp.ind, "fonte", "serie_sgs"]];
  s.obs.forEach(o => rows.push([o.ref, o.v, s.meta.source, s.meta.series_code]));
  const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";")).join("\n");
  dlFile("bets_explorador_" + betsExp.ind + ".csv", "﻿" + csv, "text/csv");
};

function renderBets() {
  const el = document.getElementById("view-bets");
  const B = state.data.bets;
  const pulse = state.data.pulse;
  if (!B) { el.innerHTML = "<p class='src'>Dado público ainda não disponível — o arquivo curado bets.json não foi carregado.</p>"; return; }

  const nv = n => betsNivel(n, B);

  /* ---------- 0 · cabeçalho ---------- */
  const head = `
  <div class="pagehead">
    <div class="ph-left">
      <h2>${B.titulo}</h2>
      <p class="viewdesc">${B.subtitulo}</p>
      <div class="ph-meta">Última atualização: <b>${fmt.d(B.gerado_em.slice(0, 10))}</b> · Período coberto: ${B.periodo_coberto} · Corte da pesquisa: ${fmt.d(B.corte_pesquisa)} (verificação de atualizações posteriores registrada em FONTES_BETS.md) · <span class="seal aprox" title="Todo este painel investiga associações. Nenhum gráfico aqui demonstra causalidade.">${B.aviso}</span></div>
    </div>
    <div class="ph-actions">
      <button class="btn ghost small" onclick="document.getElementById('bets-metodologia').scrollIntoView({behavior:'smooth'})">entenda a metodologia</button>
      <button class="btn ghost small" onclick="betsCSV()">baixar dados (CSV)</button>
      <button class="btn ghost small" onclick="betsJSON()">baixar dados (JSON)</button>
    </div>
  </div>
  <div class="chips" style="margin:6px 0 14px">${["A", "B", "C", "D", "E"].map(nvl => nv(nvl)).join(" ")}</div>`;

  /* ---------- 1 · síntese ---------- */
  const kpis = `
  <h3>Síntese — o que os números oficiais permitem afirmar</h3>
  <div class="grid g4">${(B.sintese || []).map(k => `
    <div class="card kpi"><h4>${k.rotulo} ${nv(k.nivel)}</h4>
      <div class="tr-big">${k.exibir}</div>
      <div class="src" title="${attr(k.conceito)}">${k.data_ref} · <a href="${k.url}" target="_blank" rel="noopener">${k.fonte}</a> ${betsStatus(k.status)}${k.nota ? `<br><span title="${attr(k.nota)}">nota ⓘ</span>` : ""}</div>
    </div>`).join("")}</div>
  <div class="src" style="margin-top:6px">Cada número declara conceito, período e nível de evidência. Números do briefing original que ficaram desatualizados (ex.: 603 mil autoexclusões) estão registrados na seção de metodologia, item "descartados".</div>`;

  /* ---------- 2 · cadeia ---------- */
  const C = B.cadeia || { elos: [] };
  const nodes = [C.elos[0]?.de, ...C.elos.map(e => e.para)];
  const nodeStatus = ["comprovado_brasil", ...C.elos.map(e => e.status)];
  const chain = `
  <div class="card">
    <h3>Como as apostas podem chegar ao crédito</h3>
    <p class="src">${C.descricao}</p>
    <div class="bets-chain">${nodes.map((nname, i) => `
      <div class="node ${nodeStatus[i]}">${nname}<span class="st">${((C.legenda || {})[nodeStatus[i]] || "").split(" (")[0]}</span></div>${i < nodes.length - 1 ? '<span class="arrow" aria-hidden="true">→</span>' : ""}`).join("")}</div>
    <details class="decomp"><summary>evidência de cada elo</summary>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Elo</th><th>Grau de evidência</th><th>O que sustenta</th></tr></thead><tbody>
      ${C.elos.map(e => `<tr><td style="white-space:nowrap">${e.de} → ${e.para}</td><td>${betsEloChip(e.status, B)}</td><td>${e.evidencia}</td></tr>`).join("")}
      </tbody></table></div>
    </details>
  </div>`;

  /* ---------- 3 · dimensão e evolução ---------- */
  const S = B.series || {};
  const ggr = S.ggr_regulado || { obs: [] };
  const ggrMax = Math.max(...ggr.obs.map(o => o.v));
  const ap = S.apostadores || { obs: [] };
  const arr = (S.arrecadacao || { obs: [] }).obs.find(o => o.ref === "2025");
  const arr26 = (S.arrecadacao || { obs: [] }).obs.find(o => o.ref !== "2025");
  const pix = (S.pix_pre_regulacao || { obs: [] });
  const blo = S.bloqueios_ilegais || { obs: [] };
  const dim = `
  <h3>Dimensão e evolução do mercado regulado</h3>
  <div class="grid g2">
    <div class="card"><h4>GGR por período oficial ${nv("A")}</h4>
      ${ggr.obs.map(o => betsBar(`${o.periodo}${o.status === "calculado" ? " (calculado)" : o.status === "imprensa" ? " (imprensa)" : ""}`, o.v, ggrMax, "R$ bi", o.status === "imprensa")).join("")}
      <div class="src" style="margin-top:6px">${ggr.conceito}</div>
      <div class="note warn" style="margin-top:8px">Sem série mensal: a SPA publica por semestre e este painel <b>não interpola</b>. O 2S2025 é derivado por subtração (ano menos 1S) da mesma fonte; o 1T2026 é imprensa a partir do SIGAP e aguarda o Panorama oficial.</div>
      ${chartFooter({ fonte: "SPA/MF (SIGAP)", periodo: "jan/2025 a mar/2026", atualizado: fmt.d(B.corte_pesquisa), unidade: "R$ bilhões", nota: ggr.nota })}</div>
    <div class="card"><h4>Quantos apostam — conceitos que não se misturam ${nv("A")}</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Período</th><th style="text-align:right">Valor</th><th>Conceito medido</th><th>Status</th></tr></thead><tbody>
      ${ap.obs.map(o => `<tr><td>${o.ref}</td><td style="text-align:right"><b>${fmt.n(o.v, 1)} mi</b></td><td class="src">${o.conceito}</td><td>${betsStatus(o.status)}</td></tr>`).join("")}
      </tbody></table></div>
      <div class="src">${ap.conceito}</div></div>
    <div class="card"><h4>Arrecadação e destinações (2025) ${nv("A")}</h4>
      ${arr ? [
        betsBar("Tributos federais", arr.tributos, 10, "R$ bi"),
        betsBar("Destinações legais (12% GGR)", arr.destinacoes, 10, "R$ bi"),
        betsBar("Outorgas", arr.outorgas, 10, "R$ bi"),
        betsBar("Taxa de fiscalização", arr.taxa_fiscalizacao, 10, "R$ bi"),
      ].join("") : "<p class='src'>dado público ainda não disponível</p>"}
      <div class="src">${(S.arrecadacao || {}).conceito || ""}${arr26 ? `<br>2026 (jan a mai): R$ ${fmt.n(arr26.tributos, 2)} bi em tributos ${betsStatus(arr26.status)}` : ""}</div>
      <div class="src"><a href="${arr ? arr.url : "#"}" target="_blank" rel="noopener">SPA/MF · gov.br</a></div></div>
    <div class="card"><h4>Fluxo Pix pré-regulação (2024) — quebra metodológica ${nv("A")}</h4>
      <div class="tr-big">R$ 18–21 bi<span style="font-size:14px">/mês</span></div>
      <div class="src">jan a ago/2024 · pico R$ ${fmt.n(pix.obs[0] ? pix.obs[0].v : null, 1)} bi em ago/2024 · <a href="${pix.obs[0] ? pix.obs[0].url : "#"}" target="_blank" rel="noopener">BCB, EE 119/2024</a> ${badge("descontinuada")}</div>
      <div class="note warn" style="margin-top:8px"><b>Não comparável ao GGR.</b> ${pix.conceito}</div></div>
  </div>
  <div class="card" style="margin-top:14px"><h4>Fiscalização e bloqueio de sites ilegais</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Data</th><th style="text-align:right">URLs bloqueadas (acum.)</th><th>Status</th><th>Fonte</th></tr></thead><tbody>
    ${blo.obs.map(o => `<tr><td>${fmt.d(o.ref)}</td><td style="text-align:right"><b>${fmt.n(o.v, 0)} mil</b></td><td>${betsStatus(o.status)}</td><td class="src"><a href="${o.url}" target="_blank" rel="noopener">link</a></td></tr>`).join("")}
    </tbody></table></div>
    <div class="src">${blo.conceito} No ano de 2025: 132 processos de fiscalização, ~550 contas bancárias de operadores ilegais encerradas (2º Panorama).</div></div>`;

  /* ---------- 4 · quem aposta ---------- */
  const P = B.perfil || {};
  const ds = P.datasenado_2024 || {};
  const quem = `
  <h3>Quem aposta — populações e métodos separados</h3>
  <div class="note warn">${P.aviso_populacoes}</div>
  <div class="grid g2" style="margin-top:10px">
    <div class="card"><h4>Registro administrativo (SIGAP, ano 2025) ${nv("A")}</h4>
      ${(P.sigap?.itens || []).map(i => betsBar(i.rotulo, i.v, 100, "%")).join("")}
      <div class="src">${P.sigap?.nota || ""} · <a href="${P.sigap?.url}" target="_blank" rel="noopener">${P.sigap?.fonte}</a></div></div>
    <div class="card"><h4>Pesquisa oficial representativa (DataSenado 2024) ${nv("B")}</h4>
      <div class="src" style="margin-bottom:6px"><b>${ds.prevalencia?.texto || ""}</b> · ${ds.fonte}</div>
      ${(ds.itens || []).map(i => betsBar(i.rotulo, i.v, 100, "%")).join("")}
      <div class="src" style="margin:8px 0 2px"><b>Gasto declarado em 30 dias</b> (${ds.gasto_30d?.nota}):</div>
      ${(ds.gasto_30d?.faixas || []).map(f => betsBar(f.rotulo, f.v, 13, "% da pop.")).join("")}
      <div class="src" style="margin-top:8px"><b>Endividamento:</b> ${ds.endividamento?.texto}. <i>${ds.endividamento?.nota}.</i></div>
      <div class="src" style="margin-top:6px"><b>Regiões</b> (${ds.regioes?.nota}): ${(ds.regioes?.itens || []).map(r => `${r.rotulo}: ${r.v}%`).join(" · ")}</div>
      <div class="src"><a href="${ds.url}" target="_blank" rel="noopener">relatório interativo</a></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h4>Pesquisas privadas — intervalos, não consenso ${nv("D")}</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Fonte</th><th>Método declarado</th><th>Achado central</th><th>Ressalva</th></tr></thead><tbody>
    ${(P.outras_pesquisas || []).map(o => `<tr><td style="white-space:nowrap"><a href="${o.url}" target="_blank" rel="noopener">${o.fonte}</a></td><td class="src">${o.metodo}</td><td>${o.achado}</td><td class="src">${o.status}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="src">Prevalências de 7% a 17% refletem conceitos e janelas de recall diferentes: são um intervalo entre definições, não uma contradição. Sem mapa estadual: nenhuma amostra publica UF com precisão adequada.</div></div>`;

  /* ---------- 5 · vulnerabilidade ---------- */
  const V = B.vulnerabilidade || {};
  const vuln = `
  <h3>Vulnerabilidade financeira</h3>
  <div class="grid g2">
    <div class="card"><h4>Beneficiários de programas sociais ${nv("A")}</h4>
      <p style="font-size:13px">${V.bolsa_familia?.dado_central?.texto} · <a href="${V.bolsa_familia?.dado_central?.url}" target="_blank" rel="noopener">${V.bolsa_familia?.dado_central?.fonte}</a></p>
      <div class="note warn"><b>Dado contestado.</b> ${V.bolsa_familia?.contestacao}</div>
      <p class="src" style="margin-top:8px">${V.bolsa_familia?.restricao?.texto}</p></div>
    <div class="card"><h4>Grupos com sinal de exposição</h4>
      <div class="tblwrap"><table class="data compact"><tbody>
      ${(V.grupos || []).map(g => `<tr><td style="white-space:nowrap"><b>${g.rotulo}</b></td><td class="src">${g.evidencia}</td></tr>`).join("")}
      </tbody></table></div></div>
  </div>
  <div class="card" style="margin-top:14px"><h4>Evolução das proteções regulatórias</h4>
    <ul class="bets-tl">${(V.protecoes || []).map(pr => `<li><span class="tld">${pr.data}</span><br>${pr.texto}</li>`).join("")}</ul>
    <div class="note" style="margin-top:6px">${V.leitura_institucional}</div></div>`;

  /* ---------- 6 · explorador bets × crédito ---------- */
  const EX = B.explorador || { indicadores: [] };
  let expChart = "<p class='src'>Séries de crédito não carregadas.</p>";
  let expFoot = "";
  const cfgInd = (EX.indicadores || []).find(i => i.key === betsExp.ind) || EX.indicadores[0];
  if (pulse && cfgInd && pulse.series[cfgInd.key]) {
    const sr = pulse.series[cfgInd.key];
    let pts = sr.obs.filter(o => o.ref >= "2023-01-01").map(o => ({ x: o.ref, y: o.v }));
    if (betsExp.norm === "base100" && pts.length) {
      const b = pts[0].y;
      pts = pts.map(pp => ({ x: pp.x, y: b ? pp.y / b * 100 : null }));
    } else if (betsExp.norm === "z" && pts.length > 2) {
      const vs = pts.map(pp => pp.y);
      const mu = vs.reduce((a, b2) => a + b2, 0) / vs.length;
      const sd = Math.sqrt(vs.reduce((a, b2) => a + (b2 - mu) ** 2, 0) / vs.length) || 1;
      pts = pts.map(pp => ({ x: pp.x, y: (pp.y - mu) / sd }));
    }
    const unit = betsExp.norm === "nivel" ? (sr.meta.unit || "") : betsExp.norm === "base100" ? "base 100 = jan/2023" : "desvios-padrão (janela)";
    expChart = lineChart({
      series: [{ pts, label: cfgInd.rotulo, color: "#1d4e89" }],
      annotations: betsExp.eventos ? (EX.eventos || []) : [],
      unit, fonte: `${sr.meta.source} ${sr.meta.series_code}`,
      aria: `série mensal de ${cfgInd.rotulo} com marcos regulatórios do mercado de apostas`,
      h: 260,
    });
    expFoot = chartFooter({ fonte: `${sr.meta.source} · série ${sr.meta.series_code}`, periodo: `jan/2023 a ${fmt.my(sr.qualidade?.ultima_ref)}`, atualizado: sr.meta.last_collected_at ? sr.meta.last_collected_at.slice(0, 10) : "–", unidade: sr.meta.unit, nota: sr.meta.methodology });
  }
  const nGGR = (S.ggr_regulado?.obs || []).length;
  const explorer = `
  <div class="card">
    <h3>Bets × indicadores de crédito — explorador</h3>
    <p class="src">${EX.descricao}</p>
    <div class="filterbar" style="margin:8px 0">
      <label class="src">indicador
        <select onchange="betsExpSet('ind', this.value)" aria-label="indicador de crédito">
          ${(EX.indicadores || []).map(i => `<option value="${i.key}" ${i.key === betsExp.ind ? "selected" : ""}>${i.rotulo}</option>`).join("")}
        </select></label>
      <label class="src">escala
        <select onchange="betsExpSet('norm', this.value)" aria-label="normalização">
          <option value="nivel" ${betsExp.norm === "nivel" ? "selected" : ""}>nível</option>
          <option value="base100" ${betsExp.norm === "base100" ? "selected" : ""}>base 100 (jan/2023)</option>
          <option value="z" ${betsExp.norm === "z" ? "selected" : ""}>z-score</option>
        </select></label>
      <label class="src"><input type="checkbox" ${betsExp.eventos ? "checked" : ""} onchange="betsExpSet('eventos', this.checked)"> marcos regulatórios</label>
      <button class="btn ghost small" onclick="betsExplorerCSV()">baixar base (CSV)</button>
    </div>
    ${expChart}${expFoot}
    <div class="chips" style="margin-top:8px">
      <span class="chip">rótulo desta leitura: <b>sem evidência suficiente</b></span>
      <span class="chip">não implica causalidade</span>
    </div>
    <div class="note warn" style="margin-top:8px"><b>Por que não mostramos correlação nem defasagens:</b> a exposição regulada a bets tem n=${nGGR} observações públicas (2 semestres oficiais + 1 trimestre não confirmado), abaixo do mínimo de ${EX.min_obs_correlacao} definido na metodologia. Um único gráfico com dois eixos sobrepondo GGR e inadimplência produziria relação visual artificial; por isso as séries de crédito aparecem sozinhas, com os marcos do mercado de apostas anotados. Quando a série regulada acumular histórico, este explorador passará a exibir correlações contemporâneas e defasadas com intervalo de confiança.</div>
    <div class="src" style="margin-top:6px">Indicadores ainda não integrados (entram na próxima coleta do pipeline): ${(EX.indicadores_ausentes || []).map(i => i.rotulo).join("; ")}.</div>
  </div>`;

  /* ---------- 7 · autoexclusão ---------- */
  const ax = S.autoexclusao || { obs: [] };
  const axMax = Math.max(...ax.obs.map(o => o.v));
  const auto = `
  <div class="card">
    <h3>Autoexclusão e perda de controle</h3>
    <div class="grid g2">
      <div>
        <h4>Solicitações acumuladas ${nv("A")}</h4>
        ${ax.obs.map(o => betsBar(`${fmt.d(o.ref)}${o.nota ? ` (${o.nota.split(";")[0]})` : ""}`, o.v, axMax, "mil", o.status === "imprensa")).join("")}
        <div class="src">${ax.conceito}</div>
      </div>
      <div>
        <h4>Motivos declarados</h4>
        ${(ax.motivos?.itens || []).map(m => betsBar(m.rotulo, m.v, 100, "%")).join("")}
        <div class="src">${ax.motivos?.nota} · ${ax.motivos?.fonte}</div>
      </div>
    </div>
    <div class="note warn" style="margin-top:8px"><b>O que este número NÃO é:</b> o total de autoexclusões não é prevalência de dependência. É demanda voluntária, condicionada a conhecer a ferramenta, ter acesso e se autosselecionar. Compare: 574,6 mil solicitações vs 25,2 milhões de CPFs apostadores (≈2,3%), e 10.553 atendimentos por transtorno do jogo no SUS em 7 anos (forte subnotificação).</div>
    <div class="src" style="margin-top:8px">${B.links_apoio?.nota} · <a href="${B.links_apoio?.autoexclusao?.url}" target="_blank" rel="noopener">${B.links_apoio?.autoexclusao?.rotulo}</a> · <a href="${B.links_apoio?.saude?.url}" target="_blank" rel="noopener">${B.links_apoio?.saude?.rotulo}</a></div>
  </div>`;

  /* ---------- 8 · mercado ilegal ---------- */
  const MI = B.mercado_ilegal || {};
  const ilegal = `
  <div class="card">
    <h3>Mercado ilegal — estimativas, não medições</h3>
    <div class="note warn">${MI.aviso}</div>
    <div class="tblwrap" style="margin-top:8px"><table class="data compact"><thead><tr><th>Fonte</th><th>Estimativa</th><th>Método</th><th>Nível</th></tr></thead><tbody>
    ${(MI.estimativas || []).map(e2 => `<tr><td style="white-space:nowrap"><a href="${e2.url}" target="_blank" rel="noopener">${e2.fonte}</a></td><td><b>${e2.valor}</b></td><td class="src">${e2.metodo}</td><td>${nv(e2.nivel)}</td></tr>`).join("")}
    </tbody></table></div>
    <h4 style="margin-top:10px">Ações de contenção</h4>
    <ul style="font-size:13px;margin:4px 0 8px 18px">${(MI.acoes || []).map(a => `<li>${a.texto}</li>`).join("")}</ul>
    <div class="src">${MI.riscos}</div>
  </div>`;

  /* ---------- 9 · evidências científicas ---------- */
  const estudos = `
  <h3>Evidências científicas — biblioteca resumida</h3>
  <div class="note warn">Evidência causal estrangeira demonstra <b>mecanismos plausíveis</b>; não é estimativa do efeito brasileiro. Working papers estão marcados: os números podem mudar entre versões.</div>
  <div class="grid g2" style="margin-top:10px">${(B.estudos || []).map(e2 => `
    <div class="card"><h4><a href="${e2.url}" target="_blank" rel="noopener">${e2.titulo}</a> ${nv(e2.nivel)}</h4>
      <div class="src">${e2.autores} (${e2.ano}) · ${e2.veiculo} · <b>${e2.tipo}</b> · ${e2.pais} · ${e2.periodo}</div>
      <div class="src" style="margin-top:4px"><b>Base:</b> ${e2.base} · <b>Desenho:</b> ${e2.desenho}</div>
      <p style="font-size:13px;margin:6px 0">${e2.resultado}</p>
      <div class="src"><b>Limitações:</b> ${e2.limitacoes}</div>
      <div class="src"><b>Aplicabilidade ao Brasil:</b> ${e2.aplicabilidade}</div>
    </div>`).join("")}</div>`;

  /* ---------- 10 · linha do tempo ---------- */
  const tl = `
  <div class="card">
    <h3>Linha do tempo regulatória (2018 a 2026)</h3>
    <ul class="bets-tl">${(B.timeline || []).map(t => `
      <li class="${t.status === "parcial" ? "parcial" : ""}"><span class="tld">${fmt.d(t.data)}</span> ${t.status === "parcial" ? '<span class="seal aprox">PARCIALMENTE CONFIRMADO</span>' : ""}<br>
      <b><a href="${t.url}" target="_blank" rel="noopener">${t.ato}</a></b><br><span class="src">${t.resumo}</span></li>`).join("")}</ul>
  </div>`;

  /* ---------- 11 · metodologia ---------- */
  const M = B.metodologia || {};
  const met = `
  <div class="card" id="bets-metodologia">
    <h3>Metodologia desta aba</h3>
    <p style="font-size:13px"><b>Princípio.</b> ${M.principio}</p>
    <p class="src">Tipos de dado distinguidos em todo o painel: ${(M.tipos_de_dado || []).join(" · ")}.</p>
    <h4>Conceitos que não podem ser confundidos</h4>
    <div class="tblwrap"><table class="data compact"><tbody>
    ${(M.conceitos || []).map(c => `<tr><td style="white-space:nowrap"><b>${c.termo}</b></td><td class="src">${c.def}</td></tr>`).join("")}
    </tbody></table></div>
    <h4 style="margin-top:12px">Roteiro econométrico</h4>
    <p class="src"><b>Fase atual:</b> ${M.roadmap?.fase_atual}</p>
    <p class="src"><b>Próximas fases:</b> ${(M.roadmap?.proximas_fases || []).join("; ")}.</p>
    <p class="src"><b>Um modelo causal só será publicado quando houver:</b> ${(M.roadmap?.requisitos_causais || []).join("; ")}.</p>
    <p class="src">${M.roadmap?.aviso_regulacao} ${M.roadmap?.previsao}</p>
    <h4 style="margin-top:12px">Open Finance e pesquisa futura</h4>
    <p class="src">${M.open_finance?.potencial}</p>
    <p class="src"><b>Salvaguardas obrigatórias:</b> ${(M.open_finance?.salvaguardas || []).join("; ")}.</p>
    <div class="note warn">${M.open_finance?.vedacoes}</div>
    <h4 style="margin-top:12px">Indicadores avaliados e descartados</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Item</th><th>Motivo do descarte</th></tr></thead><tbody>
    ${(M.descartados || []).map(dd => `<tr><td>${dd.item}</td><td class="src">${dd.motivo}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src" style="margin-top:8px">Rastreabilidade completa (instituição, URL, período, população, limitações e confiabilidade de cada fonte): <b>FONTES_BETS.md</b>, <b>METODOLOGIA_BETS.md</b> e <b>DICIONARIO_DADOS_BETS.md</b> no repositório. Processo de atualização: ${B.atualizacao?.processo}. Próxima atualização esperada: ${B.atualizacao?.proxima_esperada}.</p>
  </div>`;

  el.innerHTML = head + kpis + "<hr class='sep'>" + chain + "<hr class='sep'>" + dim + "<hr class='sep'>" + quem + "<hr class='sep'>" + vuln + "<hr class='sep'>" + explorer + "<hr class='sep'>" + auto + ilegal + "<hr class='sep'>" + estudos + "<hr class='sep'>" + tl + met;
}

/* ================= FRAUDES FINANCEIRAS E RISCO DE CRÉDITO ================= */
/* Painel investigativo: fraudes/golpes digitais e crédito das famílias.
   Mesmo contrato epistemológico da aba de bets: hierarquia A-E visível,
   conceitos não misturados (tentativa vs perda; reportado vs estimado),
   nenhuma soma entre fontes sobrepostas. Dados: data/gold/fraudes.json
   (curadoria documentada em FONTES_FRAUDES.md). */

const frdExp = { ind: "inad_pf", norm: "nivel", eventos: true };
window.frdExpSet = (k, v) => {
  frdExp[k] = k === "eventos" ? !!v : v;
  renderFraudes();
};
window.frdJSON = () => {
  const F = state.data.fraudes;
  if (F) dlFile("fraudes_risco_credito_" + (F.corte_pesquisa || "") + ".json", JSON.stringify(F, null, 1), "application/json");
};
window.frdCSV = () => {
  const F = state.data.fraudes;
  if (!F) return;
  const rows = [["bloco", "referencia", "indicador", "valor", "unidade", "nivel_evidencia", "status", "fonte", "url"]];
  (F.sintese || []).forEach(k => rows.push(["sintese", k.data_ref, k.rotulo, k.valor == null ? k.exibir : k.valor, k.unidade, k.nivel, k.status, k.fonte, k.url]));
  const S = F.series || {};
  (S.estelionato?.obs || []).forEach(o => rows.push(["estelionato", o.ref, "ocorrências registradas", o.v, "ocorrências", o.nivel, o.status, "FBSP/SINESP", o.url]));
  (S.perdas_febraban?.obs || []).forEach(o => rows.push(["perdas_febraban", o.ref, "perdas consumadas reportadas", o.v, "R$ bi", o.nivel, o.status, "Febraban", o.url]));
  (S.serasa_tentativas?.obs || []).forEach(o => rows.push(["serasa_tentativas", o.ref, "tentativas detectadas", o.v, "milhões", o.nivel, o.status, "Serasa Experian", o.url]));
  (S.incidentes_ciberneticos?.obs || []).forEach(o => rows.push(["incidentes_ciberneticos", o.ref, "incidentes relevantes no SFN", o.v, "incidentes", o.nivel, o.status, "BCB/REF", o.url]));
  (S.med?.obs || []).forEach(o => rows.push(["med", o.ref, o.metrica, o.v, o.unidade, o.nivel, o.status, o.fonte || "BCB", o.url]));
  const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";")).join("\n");
  dlFile("fraudes_dados_" + (F.corte_pesquisa || "") + ".csv", "﻿" + csv, "text/csv");
};
window.frdExplorerCSV = () => {
  const pulse = state.data.pulse, F = state.data.fraudes;
  if (!pulse || !F) return;
  const cfg = (F.explorador.indicadores || []).find(i => i.key === frdExp.ind);
  const s = pulse.series[frdExp.ind];
  if (!s) return;
  const rows = [["referencia", cfg ? cfg.rotulo : frdExp.ind, "fonte", "serie_sgs"]];
  s.obs.forEach(o => rows.push([o.ref, o.v, s.meta.source, s.meta.series_code]));
  const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";")).join("\n");
  dlFile("fraudes_explorador_" + frdExp.ind + ".csv", "﻿" + csv, "text/csv");
};

function renderFraudes() {
  const el = document.getElementById("view-fraudes");
  const F = state.data.fraudes;
  const pulse = state.data.pulse;
  if (!F) { el.innerHTML = "<p class='src'>Dado público ainda não disponível — o arquivo curado fraudes.json não foi carregado.</p>"; return; }

  const nv = n => betsNivel(n, F);

  /* ---------- 0 · cabeçalho ---------- */
  const head = `
  <div class="pagehead">
    <div class="ph-left">
      <h2>${F.titulo}</h2>
      <p class="viewdesc">${F.subtitulo}</p>
      <div class="ph-meta">Última atualização: <b>${fmt.d(F.gerado_em.slice(0, 10))}</b> · Período coberto: ${F.periodo_coberto} · Corte da pesquisa: ${fmt.d(F.corte_pesquisa)} (registro em FONTES_FRAUDES.md) · <span class="seal aprox" title="Todo este painel investiga associações. Nenhum gráfico aqui demonstra causalidade.">${F.aviso}</span></div>
    </div>
    <div class="ph-actions">
      <button class="btn ghost small" onclick="document.getElementById('frd-metodologia').scrollIntoView({behavior:'smooth'})">entenda a metodologia</button>
      <button class="btn ghost small" onclick="frdCSV()">baixar dados (CSV)</button>
      <button class="btn ghost small" onclick="frdJSON()">baixar dados (JSON)</button>
    </div>
  </div>
  <div class="chips" style="margin:6px 0 14px">${["A", "B", "C", "D", "E"].map(nvl => nv(nvl)).join(" ")}</div>`;

  /* ---------- 1 · síntese ---------- */
  const kpis = `
  <h3>Síntese — fraude confirmada, tentativa bloqueada e estimativa são coisas diferentes</h3>
  <div class="grid g4">${(F.sintese || []).map(k => `
    <div class="card kpi"><h4>${k.rotulo} ${nv(k.nivel)}</h4>
      <div class="tr-big">${k.exibir}</div>
      <div class="src" title="${attr(k.conceito)}">${k.data_ref} · <a href="${k.url}" target="_blank" rel="noopener">${k.fonte}</a> ${betsStatus(k.status)}${k.nota ? `<br><span title="${attr(k.nota)}">nota ⓘ</span>` : ""}</div>
    </div>`).join("")}</div>
  <div class="src" style="margin-top:6px">Cada número declara conceito, período e nível de evidência. Nenhum cartão soma fontes distintas: perdas (Febraban), tentativas (Serasa), ocorrências (FBSP) e vitimização (DataSenado) cobrem recortes sobrepostos do mesmo fenômeno.</div>`;

  /* ---------- 2 · cadeia ---------- */
  const C = F.cadeia || { elos: [] };
  const nodes = [C.elos[0]?.de, ...C.elos.map(e => e.para)];
  const nodeStatus = ["comprovado_brasil", ...C.elos.map(e => e.status)];
  const chain = `
  <div class="card">
    <h3>Como fraudes podem chegar ao crédito</h3>
    <p class="src">${C.descricao}</p>
    <div class="bets-chain">${nodes.map((nname, i) => `
      <div class="node ${nodeStatus[i]}">${nname}<span class="st">${((C.legenda || {})[nodeStatus[i]] || "").split(" (")[0]}</span></div>${i < nodes.length - 1 ? '<span class="arrow" aria-hidden="true">→</span>' : ""}`).join("")}</div>
    <details class="decomp"><summary>evidência de cada elo</summary>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Elo</th><th>Grau de evidência</th><th>O que sustenta</th></tr></thead><tbody>
      ${C.elos.map(e => `<tr><td style="white-space:nowrap">${e.de} → ${e.para}</td><td>${betsEloChip(e.status, F)}</td><td>${e.evidencia}</td></tr>`).join("")}
      </tbody></table></div>
    </details>
  </div>`;

  /* ---------- 3 · dimensão e evolução ---------- */
  const S = F.series || {};
  const est = S.estelionato || { obs: [] };
  const estMax = Math.max(...est.obs.map(o => o.v));
  const feb = S.perdas_febraban || { obs: [] };
  const ser = S.serasa_tentativas || { obs: [] };
  const inc = S.incidentes_ciberneticos || { obs: [] };
  const med = S.med || { obs: [] };
  const medOficial = med.obs.find(o => o.metrica === "taxa_recuperacao");
  const medImprensa = med.obs.find(o => o.metrica === "valor_contestado");
  const dim = `
  <h3>Dimensão e evolução — cada série com seu conceito</h3>
  <div class="grid g2">
    <div class="card"><h4>Estelionato registrado por ano ${nv("A")}</h4>
      ${est.obs.map(o => betsBar(o.ref, o.v / 1e6, estMax / 1e6, "mi")).join("")}
      <div class="src" style="margin-top:6px">${est.conceito}</div>
      <div class="note warn" style="margin-top:8px">${est.nota}</div>
      ${chartFooter({ fonte: "FBSP/SINESP (Anuários 2019 a 2026)", periodo: "2018 a 2025", atualizado: fmt.d(F.corte_pesquisa), unidade: "milhões de ocorrências", nota: est.conceito })}</div>
    <div class="card"><h4>Devolução no MED (Pix) ${nv("A")}</h4>
      <div class="tr-big">${medOficial ? fmt.n(medOficial.v, 1) : "–"}%<span style="font-size:14px"> recuperados (2025)</span></div>
      <div class="src">do valor contestado pelas vítimas · <a href="${medOficial ? medOficial.url : "#"}" target="_blank" rel="noopener">BCB, MED 2.0 (oficial)</a></div>
      ${medImprensa ? `<div class="src" style="margin-top:6px">Acumulado jan/2022 a abr/2026: R$ ${fmt.n(medImprensa.v, 1)} bi contestados, R$ 2,2 bi devolvidos (8,9%) ${betsStatus("imprensa")}</div>` : ""}
      <div class="note warn" style="margin-top:8px"><b>Quebra metodológica:</b> ${med.nota}</div></div>
    <div class="card"><h4>Perdas reportadas pelos bancos ${nv("D")}</h4>
      ${feb.obs.map(o => betsBar(o.ref, o.v, 11, "R$ bi")).join("")}
      <div class="src" style="margin-top:6px">${feb.conceito}</div>
      <div class="src">${feb.nota}</div></div>
    <div class="card"><h4>Tentativas detectadas (Serasa) ${nv("D")} e incidentes no SFN ${nv("A")}</h4>
      ${ser.obs.map(o => betsBar(o.ref + (o.status === "imprensa" ? " (imprensa)" : ""), o.v, 11, "mi", o.status === "imprensa")).join("")}
      <div class="src" style="margin:4px 0 8px">${ser.conceito}</div>
      ${inc.obs.map(o => betsBar(o.ref, o.v, 60, "incidentes")).join("")}
      <div class="src">${inc.conceito}</div></div>
  </div>`;

  /* ---------- 4 · tipos de fraude ---------- */
  const T = F.tipos || { itens: [] };
  const tipos = `
  <div class="card">
    <h3>Tipos de fraude — o melhor dado disponível para cada um</h3>
    <p class="src">${T.descricao}</p>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Tipo</th><th>Frequência</th><th>Perda média</th><th>Recuperação</th><th>Nível</th></tr></thead><tbody>
    ${T.itens.map(t => `<tr><td style="white-space:nowrap"><b>${t.tipo}</b>${t.nota ? `<div class="src">${t.nota}</div>` : ""}</td><td class="src">${t.frequencia}</td><td class="src">${t.perda_media}</td><td class="src">${t.recuperacao}</td><td>${nv(t.nivel)}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="src">"Dado público ainda não disponível" aparece onde não existe medição publicada — nada aqui é preenchido com estimativa improvisada.</div>
  </div>`;

  /* ---------- 5 · quem é mais afetado ---------- */
  const P = F.perfil || {};
  const quem = `
  <h3>Quem é mais afetado — associações declaradas, lacunas visíveis</h3>
  <div class="note warn">${P.aviso_populacoes}</div>
  <div class="card" style="margin-top:10px">
    <div class="tblwrap"><table class="data compact"><tbody>
    ${(P.grupos || []).map(g => `<tr><td style="white-space:nowrap"><b>${g.rotulo}</b></td><td class="src">${g.evidencia}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="note" style="margin-top:8px">${P.lacunas}</div>
  </div>`;

  /* ---------- 6 · subnotificação ---------- */
  const SUB = F.subnotificacao || { camadas: [] };
  const sub = `
  <div class="card">
    <h3>Fraude reportada vs estimada — o tamanho da subnotificação</h3>
    <div class="note warn">${SUB.aviso}</div>
    <div class="tblwrap" style="margin-top:8px"><table class="data compact"><thead><tr><th>Camada de medição</th><th>Valor</th><th>Nível</th><th>O que captura</th></tr></thead><tbody>
    ${SUB.camadas.map(c => `<tr><td style="white-space:nowrap"><b>${c.rotulo}</b></td><td>${c.valor}</td><td>${nv(c.nivel)}</td><td class="src">${c.conceito}</td></tr>`).join("")}
    </tbody></table></div>
    <div class="src" style="margin-top:8px">${SUB.gap}</div>
  </div>`;

  /* ---------- 7 · explorador ---------- */
  const EX = F.explorador || { indicadores: [] };
  let expChart = "<p class='src'>Séries de crédito não carregadas.</p>";
  let expFoot = "";
  const cfgInd = (EX.indicadores || []).find(i => i.key === frdExp.ind) || EX.indicadores[0];
  if (pulse && cfgInd && pulse.series[cfgInd.key]) {
    const sr = pulse.series[cfgInd.key];
    let pts = sr.obs.filter(o => o.ref >= "2019-01-01").map(o => ({ x: o.ref, y: o.v }));
    if (frdExp.norm === "base100" && pts.length) {
      const b = pts[0].y;
      pts = pts.map(pp => ({ x: pp.x, y: b ? pp.y / b * 100 : null }));
    } else if (frdExp.norm === "z" && pts.length > 2) {
      const vs = pts.map(pp => pp.y);
      const mu = vs.reduce((a, b2) => a + b2, 0) / vs.length;
      const sd = Math.sqrt(vs.reduce((a, b2) => a + (b2 - mu) ** 2, 0) / vs.length) || 1;
      pts = pts.map(pp => ({ x: pp.x, y: (pp.y - mu) / sd }));
    }
    const unit = frdExp.norm === "nivel" ? (sr.meta.unit || "") : frdExp.norm === "base100" ? "base 100 = jan/2019" : "desvios-padrão (janela)";
    expChart = lineChart({
      series: [{ pts, label: cfgInd.rotulo, color: "#1d4e89" }],
      annotations: frdExp.eventos ? (EX.eventos || []) : [],
      unit, fonte: `${sr.meta.source} ${sr.meta.series_code}`,
      aria: `série mensal de ${cfgInd.rotulo} com marcos de fraude e segurança de pagamentos`,
      h: 260,
    });
    expFoot = chartFooter({ fonte: `${sr.meta.source} · série ${sr.meta.series_code}`, periodo: `jan/2019 a ${fmt.my(sr.qualidade?.ultima_ref)}`, atualizado: sr.meta.last_collected_at ? sr.meta.last_collected_at.slice(0, 10) : "–", unidade: sr.meta.unit, nota: sr.meta.methodology });
  }
  const explorer = `
  <div class="card">
    <h3>Fraudes × indicadores de crédito — explorador</h3>
    <p class="src">${EX.descricao}</p>
    <div class="filterbar" style="margin:8px 0">
      <label class="src">indicador
        <select onchange="frdExpSet('ind', this.value)" aria-label="indicador de crédito">
          ${(EX.indicadores || []).map(i => `<option value="${i.key}" ${i.key === frdExp.ind ? "selected" : ""}>${i.rotulo}</option>`).join("")}
        </select></label>
      <label class="src">escala
        <select onchange="frdExpSet('norm', this.value)" aria-label="normalização">
          <option value="nivel" ${frdExp.norm === "nivel" ? "selected" : ""}>nível</option>
          <option value="base100" ${frdExp.norm === "base100" ? "selected" : ""}>base 100 (jan/2019)</option>
          <option value="z" ${frdExp.norm === "z" ? "selected" : ""}>z-score</option>
        </select></label>
      <label class="src"><input type="checkbox" ${frdExp.eventos ? "checked" : ""} onchange="frdExpSet('eventos', this.checked)"> marcos de fraude e segurança</label>
      <button class="btn ghost small" onclick="frdExplorerCSV()">baixar base (CSV)</button>
    </div>
    ${expChart}${expFoot}
    <div class="chips" style="margin-top:8px">
      <span class="chip">rótulo desta leitura: <b>sem evidência suficiente</b></span>
      <span class="chip">não implica causalidade</span>
    </div>
    <div class="note warn" style="margin-top:8px"><b>Por que não mostramos correlação nem defasagens:</b> ${EX.justificativa_min_obs} Um gráfico de dois eixos sobrepondo estelionato e inadimplência produziria relação visual artificial; por isso as séries de crédito aparecem sozinhas, com os marcos anotados.</div>
    <div class="src" style="margin-top:6px">Séries identificadas e ainda não integradas: ${(EX.indicadores_ausentes || []).map(i => i.rotulo).join("; ")}.</div>
  </div>`;

  /* ---------- 8 · recuperação e mitigação ---------- */
  const MIT = F.mitigacao || { itens: [] };
  const mit = `
  <div class="card">
    <h3>Recuperação e mitigação — o elo institucional</h3>
    <p class="src">${MIT.descricao}</p>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Camada</th><th>Eficácia conhecida</th></tr></thead><tbody>
    ${MIT.itens.map(m => `<tr><td style="white-space:nowrap"><b>${m.rotulo}</b></td><td class="src">${m.eficacia}${m.nota ? `<br><i>${m.nota}</i>` : ""}</td></tr>`).join("")}
    </tbody></table></div>
  </div>`;

  /* ---------- 9 · evidências científicas ---------- */
  const estudos = `
  <h3>Evidências científicas e benchmarks — biblioteca resumida</h3>
  <div class="note warn">Evidência estrangeira demonstra <b>mecanismos plausíveis</b> e desenhos institucionais; não é estimativa do efeito brasileiro. O achado mais contraintuitivo (EUA): com remediação eficaz, o dano de crédito do roubo de identidade é pequeno e transitório — a variável decisiva é a capacidade de recuperação, não o golpe em si.</div>
  <div class="grid g2" style="margin-top:10px">${(F.estudos || []).map(e2 => `
    <div class="card"><h4><a href="${e2.url}" target="_blank" rel="noopener">${e2.titulo}</a> ${nv(e2.nivel)}</h4>
      <div class="src">${e2.autores} (${e2.ano}) · ${e2.veiculo} · <b>${e2.tipo}</b> · ${e2.pais} · ${e2.periodo}</div>
      <div class="src" style="margin-top:4px"><b>Base:</b> ${e2.base} · <b>Desenho:</b> ${e2.desenho}</div>
      <p style="font-size:13px;margin:6px 0">${e2.resultado}</p>
      <div class="src"><b>Limitações:</b> ${e2.limitacoes}</div>
      <div class="src"><b>Aplicabilidade ao Brasil:</b> ${e2.aplicabilidade}</div>
    </div>`).join("")}</div>`;

  /* ---------- 10 · linha do tempo ---------- */
  const tl = `
  <div class="card">
    <h3>Linha do tempo — segurança contra fraudes digitais (2020 a 2026)</h3>
    <ul class="bets-tl">${(F.timeline || []).map(t => `
      <li class="${t.status === "parcial" ? "parcial" : ""}"><span class="tld">${fmt.d(t.data)}</span> ${t.status === "parcial" ? '<span class="seal aprox">PARCIALMENTE CONFIRMADO</span>' : ""}<br>
      <b><a href="${t.url}" target="_blank" rel="noopener">${t.ato}</a></b><br><span class="src">${t.resumo}</span></li>`).join("")}</ul>
  </div>`;

  /* ---------- 11 · metodologia ---------- */
  const M = F.metodologia || {};
  const met = `
  <div class="card" id="frd-metodologia">
    <h3>Metodologia desta aba</h3>
    <p style="font-size:13px"><b>Princípio.</b> ${M.principio}</p>
    <p class="src">Tipos de dado distinguidos em todo o painel: ${(M.tipos_de_dado || []).join(" · ")}.</p>
    <h4>Conceitos que não podem ser confundidos</h4>
    <div class="tblwrap"><table class="data compact"><tbody>
    ${(M.conceitos || []).map(c => `<tr><td style="white-space:nowrap"><b>${c.termo}</b></td><td class="src">${c.def}</td></tr>`).join("")}
    </tbody></table></div>
    <h4 style="margin-top:12px">Roteiro econométrico</h4>
    <p class="src"><b>Fase atual:</b> ${M.roadmap?.fase_atual}</p>
    <p class="src"><b>Próximas fases:</b> ${(M.roadmap?.proximas_fases || []).join("; ")}.</p>
    <p class="src"><b>Uma leitura causal só será publicada quando houver:</b> ${(M.roadmap?.requisitos_causais || []).join("; ")}.</p>
    <p class="src">${M.roadmap?.aviso} ${M.roadmap?.previsao}</p>
    <h4 style="margin-top:12px">Open Finance e pesquisa futura</h4>
    <p class="src">${M.open_finance?.potencial}</p>
    <p class="src"><b>Salvaguardas obrigatórias:</b> ${(M.open_finance?.salvaguardas || []).join("; ")}.</p>
    <div class="note warn">${M.open_finance?.vedacoes}</div>
    <h4 style="margin-top:12px">Indicadores avaliados e descartados</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Item</th><th>Motivo do descarte</th></tr></thead><tbody>
    ${(M.descartados || []).map(dd => `<tr><td>${dd.item}</td><td class="src">${dd.motivo}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src" style="margin-top:8px">Rastreabilidade completa: <b>FONTES_FRAUDES.md</b>, <b>METODOLOGIA_FRAUDES.md</b> e <b>DICIONARIO_DADOS_FRAUDES.md</b> no repositório. Processo de atualização: ${F.atualizacao?.processo}. Próximas atualizações esperadas: ${F.atualizacao?.proxima_esperada}.</p>
    <div class="src" style="margin-top:8px">${F.links_apoio?.nota} · <a href="${F.links_apoio?.med?.url}" target="_blank" rel="noopener">${F.links_apoio?.med?.rotulo}</a> · <a href="${F.links_apoio?.celular_seguro?.url}" target="_blank" rel="noopener">${F.links_apoio?.celular_seguro?.rotulo}</a> · <a href="${F.links_apoio?.consumidor?.url}" target="_blank" rel="noopener">${F.links_apoio?.consumidor?.rotulo}</a></div>
  </div>`;

  el.innerHTML = head + kpis + "<hr class='sep'>" + chain + "<hr class='sep'>" + dim + "<hr class='sep'>" + tipos + "<hr class='sep'>" + quem + sub + "<hr class='sep'>" + explorer + "<hr class='sep'>" + mit + "<hr class='sep'>" + estudos + "<hr class='sep'>" + tl + met;
}

/* ================= TAXAS DE JUROS POR MODALIDADE × IF ================= */
/* Fonte: BCB txjuros (taxas médias das operações contratadas por IF em
   janelas de ~5 dias úteis). Três leituras: visão geral das 20 modalidades,
   painel profundo da modalidade (distribuição, série, ranking, persistência,
   carteira SCR associada) e perfil transversal por instituição. */

const jurosSel = { mod: null, cnpj: null };
window.jurosSetMod = id => { jurosSel.mod = id; renderJuros(); };
window.jurosSetIf = c => { jurosSel.cnpj = c || null; renderJuros(); };
window.jurosCSV = () => {
  const J = state.data.juros;
  if (!J) return;
  const rows = [["segmento", "modalidade", "janela_inicio", "posicao", "instituicao", "cnpj8", "taxa_aa_pct", "taxa_am_pct", "mediana_modalidade_aa"]];
  J.modalidades.forEach(m => m.ranking.forEach(r =>
    rows.push([m.segmento, m.modalidade, m.janela.inicio, r.posicao, r.nome, r.cnpj8, r.taxa_aa, r.taxa_am, m.stats.mediana])));
  const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";")).join("\n");
  dlFile("taxas_juros_por_if_" + (J.gerado_em || "").slice(0, 10) + ".csv", "﻿" + csv, "text/csv");
};

function jurosModCurta(m) {
  return m.replace(" - Prefixado", " · pré").replace(" - Pós-fixado referenciado em juros flutuantes", " · pós")
    .replace(" - Pós-fixado referenciado em moeda estrangeira", " · cambial").replace("Crédito pessoal consignado", "Consignado")
    .replace("Cartão de crédito - ", "Cartão ").replace("Capital de giro com prazo", "Capital de giro").replace("Antecipação de faturas de cartão de crédito", "Antecipação de faturas");
}

function renderJuros() {
  const el = document.getElementById("view-juros");
  const J = state.data.juros;
  if (!J) { el.innerHTML = loadingCard("taxas de juros por instituição"); return; }
  if (!jurosSel.mod || !J.modalidades.some(m => m.id === jurosSel.mod)) {
    jurosSel.mod = "pf:Crédito pessoal consignado INSS - Prefixado";
    if (!J.modalidades.some(m => m.id === jurosSel.mod)) jurosSel.mod = J.modalidades[0].id;
  }
  const M = J.modalidades.find(m => m.id === jurosSel.mod);

  const head = `
  <div class="pagehead">
    <div class="ph-left">
      <h2>Taxas de Juros por IF</h2>
      <p class="viewdesc">Quanto cada instituição cobra em cada modalidade de crédito: distribuição completa, evolução, quem é persistentemente mais barato e a carteira associada — nas 20 modalidades divulgadas pelo BC.</p>
      <div class="ph-meta">Fonte: BCB txjuros (operações contratadas, janelas de ~5 dias úteis) · Selic meta vigente: <b>${fmt.n(J.selic_meta, 2)}% a.a.</b> · atualizado ${fmt.d((J.gerado_em || "").slice(0, 10))} · <span title="${attr(J.conceitos.taxa)}">o que é esta taxa ⓘ</span></div>
    </div>
    <div class="ph-actions">
      <button class="btn ghost small" onclick="jurosCSV()">baixar rankings (CSV)</button>
    </div>
  </div>
  <div class="note"><b>Como ler:</b> ${J.conceitos.taxa} A mediana entre IFs dá o mesmo peso a cada instituição (${J.conceitos.mediana_vs_media_bc.split(";")[0].replace("a mediana ENTRE IFs dá o mesmo peso a cada instituição", "difere da média do SGS, ponderada pelo valor")}).</div>`;

  /* ---------- 1 · visão geral das modalidades ---------- */
  const linha = m => {
    const ativo = m.id === jurosSel.mod;
    const disp = m.stats.p75 != null && m.stats.p25 != null ? m.stats.p75 - m.stats.p25 : null;
    return `<tr class="clickable ${ativo ? "sel" : ""}" onclick="jurosSetMod('${m.id.replace(/'/g, "\\'")}')" ${ativo ? 'style="background:var(--accent-soft)"' : ""}>
      <td><b>${jurosModCurta(m.modalidade)}</b></td>
      <td style="text-align:right"><b>${fmt.n(m.stats.mediana, 1)}%</b></td>
      <td style="text-align:right" class="src">${fmt.n(m.stats.min, 1)} a ${fmt.n(m.stats.max, 1)}%</td>
      <td style="text-align:right" title="distância entre o 1º e o 3º quartil: metade das IFs cobra dentro desta faixa">${disp != null ? fmt.n(disp, 1) : "–"} p.p.</td>
      <td style="text-align:right">${m.stats.n}</td>
      <td style="text-align:right" class="${m.delta_3m > 0 ? "up" : m.delta_3m < 0 ? "down good" : "neutral"}">${m.delta_3m != null ? fmt.pp(m.delta_3m) : "–"}</td>
      <td style="text-align:right" title="${attr(J.conceitos.spread_selic)}">${m.spread_selic != null ? fmt.pp(m.spread_selic) : "–"}</td>
    </tr>`;
  };
  const tabelaSeg = seg => `
    <div class="card"><h4>${seg === "PF" ? "Pessoa física" : "Pessoa jurídica"}</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>Modalidade</th><th style="text-align:right">Mediana a.a.</th><th style="text-align:right">Faixa</th><th style="text-align:right" title="dispersão interquartil">IQR</th><th style="text-align:right">IFs</th><th style="text-align:right">Δ3m</th><th style="text-align:right">vs Selic</th></tr></thead>
    <tbody>${J.modalidades.filter(m => m.segmento === seg).map(linha).join("")}</tbody></table></div></div>`;
  const geral = `
  ${sechead("Mapa das modalidades", "mediana entre IFs na última janela consolidada · clique para abrir o painel da modalidade")}
  <div class="ov-2col-eq">${tabelaSeg("PF")}${tabelaSeg("PJ")}</div>`;

  /* ---------- 2 · painel da modalidade selecionada ---------- */
  const serie = M.serie_mensal;
  const chart = serie.length >= 3 ? lineChart({
    series: [
      { pts: serie.map(o => ({ x: o.ref, y: o.mediana })), label: "mediana entre IFs", color: "#1d4e89", w: 2.2 },
      { pts: serie.map(o => ({ x: o.ref, y: o.min })), label: "IF mais barata", color: "#2f7d4f", dash: "4,3", w: 1.4 },
    ],
    band: { pts: serie.map(o => ({ x: o.ref, lo: o.p25, hi: o.p75 })) },
    h: 260, unit: "% a.a.", fonte: "BCB txjuros", dec: 1,
    aria: `evolução mensal da taxa da modalidade ${M.modalidade}`,
  }) : "<p class='src'>histórico mensal ainda curto para gráfico</p>";
  const maxAbs = Math.max(...M.ranking.map(r => r.taxa_aa));
  const rankRow = r => `<tr class="${jurosSel.cnpj === r.cnpj8 ? "sel" : ""}">
    <td style="text-align:right">${r.posicao}º</td>
    <td><b>${r.nome}</b></td>
    <td style="text-align:right"><b>${fmt.n(r.taxa_aa, 2)}%</b> <span class="src">a.a.</span></td>
    <td style="text-align:right" class="src">${fmt.n(r.taxa_am, 2)}% a.m.</td>
    <td style="text-align:right" class="${r.vs_mediana > 0 ? "up" : "down good"}">${fmt.pp(r.vs_mediana)} p.p.</td>
    <td style="width:120px"><span style="display:inline-block;height:7px;background:${r.vs_mediana > 0 ? "var(--c-neg)" : "var(--c-pos)"};opacity:.65;width:${Math.max(r.taxa_aa / maxAbs * 100, 2).toFixed(1)}%"></span></td>
  </tr>`;
  const cart = M.carteira_scr;
  const painel = `
  ${sechead(`${jurosModCurta(M.modalidade)} — ${M.segmento}`, `janela consolidada iniciada em ${fmt.d(M.janela.inicio)} · ${M.stats.n} instituições divulgadas`)}
  <div class="grid g4">
    <div class="card kpi"><h4>Mediana entre IFs</h4><div class="tr-big">${fmt.n(M.stats.mediana, 1)}%<small> a.a.</small></div><div class="src">metade das IFs cobra menos, metade mais</div></div>
    <div class="card kpi"><h4>Faixa completa</h4><div class="tr-big" style="font-size:22px">${fmt.n(M.stats.min, 1)} a ${fmt.n(M.stats.max, 1)}%</div><div class="src">da IF mais barata à mais cara (razão ${M.stats.min > 0 ? fmt.n(M.stats.max / M.stats.min, 1) : "–"}×)</div></div>
    <div class="card kpi"><h4>Sobre a Selic</h4><div class="tr-big">${M.spread_selic != null ? fmt.pp(M.spread_selic) : "–"}<small> p.p.</small></div><div class="src" title="${attr(J.conceitos.spread_selic)}">mediana menos a meta Selic (aproximação ⓘ)</div></div>
    <div class="card kpi"><h4>Movimento 3 meses</h4><div class="tr-big ${M.delta_3m > 0 ? "up" : "down good"}">${M.delta_3m != null ? fmt.pp(M.delta_3m) : "–"}<small> p.p.</small></div><div class="src">variação da mediana entre IFs</div></div>
  </div>
  <div class="ov-2col" style="margin-top:14px">
    <div class="card"><h4>Evolução mensal ${badge("observado")} <span class="src">banda = 1º a 3º quartil entre IFs</span></h4>
      ${chart}
      ${chartFooter({ fonte: "BCB txjuros (Olinda)", periodo: serie.length ? `${fmt.my(serie[0].ref)}–${fmt.my(serie[serie.length - 1].ref)}` : "–", atualizado: fmt.d((J.gerado_em || "").slice(0, 10)), unidade: "% a.a.", nota: J.conceitos.janela })}</div>
    <div style="display:flex;flex-direction:column;gap:22px">
      <div class="card"><h4>Persistentemente mais baratas <span class="src" title="${attr(J.conceitos.persistencia)}">ⓘ</span></h4>
        ${M.persistentes.map(p => `<div class="contrib"><span class="lbl" style="width:auto;flex:1">${p.nome}</span><span class="num">${p.vezes}/${p.de} janelas</span></div>`).join("") || "<p class='src'>sem dado</p>"}
        <div class="src" style="margin-top:6px">liderança recorrente importa mais que o retrato de uma janela: taxas por IF oscilam com o mix de clientes de cada semana</div></div>
      ${cart ? `<div class="card"><h4>Carteira associada (estoque SCR) ${badge("observado")}</h4>
        <div class="contrib"><span class="lbl">produto</span><span class="num">${cart.produto} · ${cart.cliente}</span></div>
        <div class="contrib"><span class="lbl">carteira ativa</span><span class="num">${fmt.money(cart.saldo)}</span></div>
        <div class="contrib"><span class="lbl">inadimplência arrastada</span><span class="num">${fmt.n(cart.inad, 2)}%</span></div>
        <div class="contrib"><span class="lbl">atraso 15–90 dias</span><span class="num">${fmt.n(cart.atraso15_90, 2)}%</span></div>
        <div class="src" style="margin-top:6px">${J.conceitos.carteira} Data-base ${cart.data_base}.</div></div>` : ""}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h4>Ranking completo da janela — ${M.stats.n} instituições</h4>
    <div class="tblwrap" style="max-height:520px"><table class="data compact"><thead><tr><th style="text-align:right">#</th><th>Instituição</th><th style="text-align:right">Taxa a.a.</th><th style="text-align:right">a.m.</th><th style="text-align:right">vs mediana</th><th>escala</th></tr></thead>
    <tbody>${M.ranking.map(rankRow).join("")}</tbody></table></div>
    <div class="src" style="margin-top:6px">Taxas médias das operações contratadas: uma IF pode ser barata para um perfil de cliente e cara para outro; a divulgação do BC não abre o mix. Comparações finas exigem simulação individual.</div>
  </div>`;

  /* ---------- 3 · perfil por instituição ---------- */
  const perfil = jurosSel.cnpj ? J.perfis_if.find(p => p.cnpj8 === jurosSel.cnpj) : null;
  const perfilRows = perfil ? perfil.modalidades.map(pm => {
    const mm = J.modalidades.find(x => x.id === pm.id);
    return `<tr class="clickable" onclick="jurosSetMod('${pm.id.replace(/'/g, "\\'")}')">
      <td>${mm ? mm.segmento : ""} · ${jurosModCurta(pm.id.split(":")[1])}</td>
      <td style="text-align:right"><b>${fmt.n(pm.taxa_aa, 2)}%</b></td>
      <td style="text-align:right" class="src">${fmt.n(pm.mediana, 2)}%</td>
      <td style="text-align:right" class="${pm.taxa_aa > pm.mediana ? "up" : "down good"}">${fmt.pp(pm.taxa_aa - pm.mediana)} p.p.</td>
      <td style="text-align:right">${pm.posicao}º de ${pm.n}</td>
    </tr>`;
  }).join("") : "";
  const ifSec = `
  ${sechead("Perfil por instituição", "onde cada IF é cara ou barata — posição em todas as modalidades que divulga")}
  <div class="card">
    <div class="filterbar" style="margin-bottom:10px">
      <label class="src">instituição
        <select onchange="jurosSetIf(this.value)" aria-label="instituição">
          <option value="">selecione…</option>
          ${J.perfis_if.slice(0, 120).map(p => `<option value="${p.cnpj8}" ${jurosSel.cnpj === p.cnpj8 ? "selected" : ""}>${p.nome} (${p.modalidades.length})</option>`).join("")}
        </select></label>
    </div>
    ${perfil ? `<div class="tblwrap"><table class="data compact"><thead><tr><th>Modalidade</th><th style="text-align:right">Taxa da IF</th><th style="text-align:right">Mediana do mercado</th><th style="text-align:right">Diferença</th><th style="text-align:right">Posição</th></tr></thead><tbody>${perfilRows}</tbody></table></div>
      <div class="src" style="margin-top:6px">Clique em uma linha para abrir o painel da modalidade. Posição 1º = mais barata da janela.</div>`
      : `<p class="src">Escolha uma instituição para ver o retrato transversal (as ${J.perfis_if.length} IFs do seletor estão ordenadas por abrangência de modalidades).</p>`}
  </div>`;

  el.innerHTML = head + geral + "<hr class='sep'>" + painel + "<hr class='sep'>" + ifSec;
}

/* ---------- Sugestões (feedback dos usuários → painel de administração) ---------- */
const SG_CATEGORIAS = [
  ["analise", "Nova análise ou indicador"],
  ["dado", "Correção ou dúvida sobre um dado"],
  ["usabilidade", "Usabilidade e navegação"],
  ["outra", "Outra sugestão"],
];
window.sgEnviar = async () => {
  const cat = document.getElementById("sgCat");
  const txt = document.getElementById("sgTexto");
  const msg = document.getElementById("sgMsg");
  const btn = document.getElementById("sgBtn");
  if (!cat || !txt || !msg || !btn) return;
  const texto = txt.value.trim();
  if (texto.length < 10) { msg.className = "note"; msg.textContent = "Escreva um pouco mais (mínimo de 10 caracteres) para a sugestão ser útil."; return; }
  btn.disabled = true; btn.textContent = "enviando…";
  try {
    const r = await fetch("/api/sugestoes", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoria: cat.value, texto }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      txt.value = "";
      msg.className = "note"; msg.textContent = "Sugestão registrada — obrigado. Ela vai direto para a administração da plataforma.";
    } else {
      msg.className = "note"; msg.textContent = d.error || "Não foi possível enviar agora. Tente novamente em instantes.";
    }
  } catch (e) {
    msg.className = "note"; msg.textContent = "Falha de conexão. Tente novamente em instantes.";
  }
  btn.disabled = false; btn.textContent = "Enviar sugestão";
};
function renderSugestoes() {
  const el = document.getElementById("view-sugestoes");
  el.innerHTML = `
  <div class="pagehead"><div class="ph-left">
    <h2>Sugestões</h2>
    <p class="viewdesc">Diga o que falta, o que está confuso ou o que merece correção. Cada sugestão vai direto para a administração da plataforma, identificada pela sua conta.</p>
  </div></div>
  <div class="card" style="max-width:760px">
    <h4>Enviar uma sugestão</h4>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
      <label class="src" for="sgCat">Tipo
        <select id="sgCat" style="display:block;margin-top:4px">${SG_CATEGORIAS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
      </label>
      <label class="src" for="sgTexto">Sua sugestão (até 2.000 caracteres)
        <textarea id="sgTexto" maxlength="2000" style="display:block;margin-top:4px" aria-describedby="sgMsg"></textarea>
      </label>
      <div><button class="btn" id="sgBtn" onclick="sgEnviar()">Enviar sugestão</button></div>
      <p id="sgMsg" class="src" role="status" aria-live="polite"></p>
    </div>
    <div class="src" style="margin-top:10px">O texto é lido apenas pela administração. Para correção de dado, cite a aba, o indicador e a referência (mês/trimestre) — acelera a verificação.</div>
  </div>`;
}

const RENDER = { overview: renderOverview, pulse: renderPulse, antecedentes: renderAntecedentes, sectors: renderSectors, rj: renderRJ, institutions: renderInstitutions, inst: renderInstPage, sector: renderSectorPage, openfinance: renderOpenFinance, scenarios: renderScenarios, alerts: renderAlerts, research: renderResearch, method: renderMethod, products: renderProducts, product: renderProductPage, compare: renderCompare, market: renderMarket, leading: renderLeading, trends: renderTrends, panorama: renderPanorama, bets: renderBets, fraudes: renderFraudes, juros: renderJuros, sugestoes: renderSugestoes, pix: renderPix, sobre: renderSobre, judicial: renderJudicial };
function rerenderCurrent() { const v = currentView(); if (RENDER[v]) RENDER[v](); }
const VIEW_TITLES = { overview: "Visão geral", pulse: "Pulso do crédito", antecedentes: "Antecedentes", sectors: "Risco setorial", rj: "Recuperações & Falências", institutions: "Instituições", inst: "Instituição", sector: "Setor", openfinance: "Open Finance", scenarios: "Cenários", alerts: "Alertas", research: "Pesquisa", method: "Metodologia & Fontes", products: "Produtos de Crédito", product: "Produto", compare: "Comparador", market: "Mercado & Valor", leading: "Sinais Antecedentes", panorama: "Panorama do Crédito", bets: "Bets e risco financeiro", fraudes: "Fraudes financeiras e risco de crédito", juros: "Taxas de Juros por IF", sugestoes: "Sugestões", pix: "Pix e Meios de Pagamento", sobre: "Sobre o Observatório", judicial: "Ações judiciais e instituições financeiras" };
/* ---------- telemetria de navegação (sem PII): registra a aba aberta ---------- */
let lastPingedView = null;
function pingView(v) {
  if (v === lastPingedView) return;
  lastPingedView = v;
  try {
    const body = JSON.stringify({ secao: "obs:" + v });
    const blob = new Blob([body], { type: "application/json" });
    if (!(navigator.sendBeacon && navigator.sendBeacon("/api/telemetria", blob))) {
      fetch("/api/telemetria", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch (e) { /* telemetria nunca interfere na navegação */ }
}

function showViewSilent(v) {
  pingView(v);
  document.querySelectorAll("nav.tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === v || (v === "inst" && b.dataset.view === "institutions") || (v === "sector" && b.dataset.view === "sectors") || (v === "product" && b.dataset.view === "products")));
  document.querySelectorAll("section.view").forEach(s => s.classList.toggle("active", s.id === "view-" + v));
  const pend = (VIEW_DATA[v] || []).some(f => state.data[f] === undefined);
  if (pend) {
    const sec = document.getElementById("view-" + v);
    if (sec && !sec.innerHTML) sec.innerHTML = loadingCard("dados desta página");
    ensureData(v).then(() => { if (currentView() === v && RENDER[v]) RENDER[v](); });
  } else if (RENDER[v]) RENDER[v]();
  const plat = state.data.meta ? state.data.meta.plataforma.name : "Observatório Brasileiro de Crédito";
  document.title = (VIEW_TITLES[v] ? VIEW_TITLES[v] + " · " : "") + plat;
  closeSidebar();
  hideTip();
  window.scrollTo(0, 0);
}

/* ---------- shell: tema, menu móvel, badge de alertas ---------- */
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
(function initTheme() {
  const saved = loadLS("obc_theme", null);
  if (saved) applyTheme(saved);
  else if (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");
})();
/* Atalho de administração: só aparece se a sessão atual é de admin
   (checagem no servidor via /api/admin/eu; para os demais, nada muda). */
(function initAdminShortcut() {
  const btn = document.getElementById("adminBtn");
  if (!btn) return;
  fetch("/api/admin/eu", { credentials: "same-origin" })
    .then(r => { if (r.ok) btn.hidden = false; })
    .catch(() => {});
})();
document.getElementById("themeToggle").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  saveLS("obc_theme", next);
  applyTheme(next);
});
const sidebarEl = document.getElementById("sidebar"), scrimEl = document.getElementById("scrim"), menuBtnEl = document.getElementById("menuBtn");
/* sidebar recolhível (desktop): iniciais + tooltip nativo; persistida */
(function initCollapse() {
  document.querySelectorAll("nav.tabs button").forEach(b => {
    const label = b.textContent.trim();
    b.title = label;
    b.dataset.initial = label.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  });
  if (loadLS("obc_sb_collapsed", false)) document.body.classList.add("sb-collapsed");
  const t = document.getElementById("sbToggle");
  if (t) t.addEventListener("click", () => {
    const on = document.body.classList.toggle("sb-collapsed");
    saveLS("obc_sb_collapsed", on);
  });
})();
function closeSidebar() { sidebarEl.classList.remove("open"); scrimEl.hidden = true; menuBtnEl.setAttribute("aria-expanded", "false"); }
menuBtnEl.addEventListener("click", () => {
  const open = !sidebarEl.classList.contains("open");
  sidebarEl.classList.toggle("open", open);
  scrimEl.hidden = !open;
  menuBtnEl.setAttribute("aria-expanded", String(open));
});
scrimEl.addEventListener("click", closeSidebar);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSidebar(); });
function updateAlertBadge() {
  const el = document.getElementById("alertCount");
  const a = state.data.alerts;
  if (!el || !a || !a.alertas) { return; }
  const estados = loadLS("obc_alert_states", {});
  const n = a.alertas.filter(x => !["resolvido", "descartado"].includes(estados[x.id] || "ativo")).length;
  el.textContent = n;
  el.hidden = n === 0;
}
window.showView = v => {
  if (PATH_MODE) {
    let path = ROUTES[v] || "/overview";
    if (v === "inst" && state.filters.instCod) path = "/institutions/" + state.filters.instCod;
    if (v === "product" && state.filters.productSlug) path = "/products/" + state.filters.productSlug;
    if (v === "sector" && state.filters.sectorCod) path = "/sectors/" + state.filters.sectorCod;
    history.pushState(null, "", BASE + path + buildQuery(v));
  } else {
    history.pushState(null, "", "#" + v + buildQuery(v));
  }
  showViewSilent(v);
};
document.getElementById("tabs").addEventListener("click", e => { if (e.target.dataset.view) showView(e.target.dataset.view); });

/* ---------- acessibilidade: teclado para clicáveis não nativos (padrão tabindex+keydown da SPA) ---------- */
const A11Y_NATIVE = ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "SUMMARY", "OPTION", "LABEL"];
function a11yEnhance(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll("[onclick]").forEach(el => {
    const tag = el.tagName.toUpperCase();
    if (A11Y_NATIVE.includes(tag) || el.hasAttribute("tabindex")) return;
    if (!(el.getAttribute("onclick") || "").trim()) return;
    el.setAttribute("tabindex", "0");
    // tr/td mantêm a semântica de tabela; os demais anunciam-se como link (mesmo padrão do mcard)
    if (!el.hasAttribute("role") && !["TR", "TD", "TH"].includes(tag)) el.setAttribute("role", "link");
  });
}
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const el = e.target;
  if (!(el instanceof Element)) return;
  const tag = el.tagName.toUpperCase();
  if (A11Y_NATIVE.includes(tag) || el.hasAttribute("onkeydown") || !el.hasAttribute("onclick")) return;
  e.preventDefault();
  if (typeof el.click === "function") el.click(); // SVG não tem click(): dispara o evento
  else el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
});
new MutationObserver(muts => {
  muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) a11yEnhance(n); }));
}).observe(document.getElementById("main"), { childList: true, subtree: true });


/* ================= CAMADA DE PESQUISA: PRODUTOS, MATRIZ E COMPARADOR ================= */
const SR_COLORS = { S1: "#1d4e89", S2: "#0e7c7b", S3: "#b45309", S4: "#6b46a3", S5: "#64748b" };
const CMP_PALETTE = ["#1d4e89", "#0e7c7b", "#b45309", "#6b46a3", "#b91c1c", "#2f7d4f", "#64748b", "#c2540a", "#d9a514", "#17879c"];
function fmtTri(anomes) { const a = String(anomes); return `${a.slice(0, 4)}-T${Math.ceil(parseInt(a.slice(4), 10) / 3)}`; }
function anomesISO(anomes) { const a = String(anomes); return `${a.slice(0, 4)}-${a.slice(4)}`; }
function dlFile(filename, text, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/csv;charset=utf-8" }));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}
function csvEsc(v) { v = v == null ? "" : String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }


/* ---------- XLSX nativo (ZIP store + SpreadsheetML, sem bibliotecas) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zipStore(files) { // files: [{name, text}] → Blob (método 0 = sem compressão)
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  const u16 = v => new Uint8Array([v & 255, (v >> 8) & 255]);
  const u32 = v => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);
  files.forEach(f => {
    const name = enc.encode(f.name), data = enc.encode(f.text);
    const crc = crc32(data);
    const head = [u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)];
    parts.push(...head, name, data);
    central.push([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
    offset += head.reduce((a, b) => a + b.length, 0) + name.length + data.length;
  });
  let cdSize = 0;
  central.forEach(e => { e.forEach(b => cdSize += b.length); parts.push(...e); });
  parts.push(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0));
  return new Blob(parts, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
function xmlEsc(v) { return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function colLetter(i) { let n = i + 1, sfx = ""; while (n > 0) { const m = (n - 1) % 26; sfx = String.fromCharCode(65 + m) + sfx; n = Math.floor((n - 1) / 26); } return sfx; }
function xlsxBlob(rows, sheetName) { // rows: array de arrays (number → célula numérica; resto → texto)
  const rowsXml = rows.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
    if (v == null || v === "") return "";
    const ref = colLetter(ci) + (ri + 1);
    return typeof v === "number" && isFinite(v)
      ? `<c r="${ref}"><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }).join("") + "</row>").join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName || "Dados")}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  return zipStore([
    { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>` },
    { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>` },
    { name: "xl/workbook.xml", text: workbook },
    { name: "xl/worksheets/sheet1.xml", text: sheet },
  ]);
}
function dlXlsx(filename, rows, sheetName) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(xlsxBlob(rows, sheetName));
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- Produtos de Crédito ---------- */
window.openProduct = slug => { state.filters.productSlug = slug; saveLS("obc_filters", state.filters); showView("product"); };

function renderProducts() {
  const el = document.getElementById("view-products");
  const P = state.data.products;
  if (!P || !P.produtos) { el.innerHTML = "<p class='src'>Catálogo de produtos indisponível — rode o pipeline (gold products.json ausente).</p>"; return; }
  const seg = state.filters.seg;
  const list = P.produtos.filter(p => seg === "total" || p.seg === seg);
  const card = p => {
    const spark = sparkline(p.serie.map(x => x.total_brl), 130, 26);
    const lider = p.lider;
    return `<div class="card clickable" onclick="openProduct('${p.slug}')">
      <h4>${p.nome} <span class="chip" style="padding:1px 8px">${p.seg.toUpperCase()}</span> ${badge("observado")}</h4>
      <div class="big" style="font-size:24px">${fmt.money(p.mercado_total_brl)}</div>
      <div class="delta ${p.crescimento_4t_pct >= 0 ? "down good" : "up"}">${p.crescimento_4t_pct != null ? (p.crescimento_4t_pct >= 0 ? "▲" : "▼") + " " + fmt.n(Math.abs(p.crescimento_4t_pct), 1) + "% em 4 trim. (pareado)" : "Δ4T indisponível"}</div>
      ${spark}
      <div class="src">${p.n_instituicoes} instituições${p.atraso15 && p.atraso15.agg_pct != null ? ` · atraso ≥15d ${fmt.n(p.atraso15.agg_pct, 1)}%` : ""} · ${p.share_segmento_pct != null ? fmt.n(p.share_segmento_pct, 1) + "% da carteira " + p.seg.toUpperCase() : ""} · líder: ${lider ? lider.nome.slice(0, 24) + " (" + fmt.n(lider.share_pct, 1) + "%)" : "–"} · top-5 ${fmt.n(p.concentracao.top5_pct, 0)}%</div>
    </div>`;
  };
  el.innerHTML = `
  ${pageHead({ title: "Produtos de Crédito", seals: badge("observado"),
    desc: `Mercado de cada modalidade a partir da carteira por instituição (trimestral, ${fmtTri(P.data_base)}) — tamanho, crescimento pareado, concentração, atraso e taxas.`,
    fontes: "BCB IF.data rel. 123/128, BCB txjuros" })}
  <div class="controls">${segTabs()}<span class="src">corte PF/PJ da própria fonte · ${P.produtos.length} produtos validados · universo IF.data</span></div>
  <div class="grid g3">${list.map(card).join("")}</div>
  <div class="note">Taxa média, inadimplência específica, clientes e ticket por produto <b>não são exibidos por instituição</b>: as fontes públicas integradas não trazem esses cruzamentos (ver página do produto → indisponíveis). Ausência nunca vira zero.</div>
  ${chartFooter({ fonte: P.fonte, periodo: P.anomes_list.map(fmtTri).join(" – "), atualizado: P.gerado_em.slice(0, 10), unidade: "R$", nota: P.consolidacao_nota })}`;
}

const PMX_STATE = { sort: "carteira_brl", dir: -1, all: false, q: "", sel: {} };
window.pmxSort = k => { if (PMX_STATE.sort === k) PMX_STATE.dir *= -1; else { PMX_STATE.sort = k; PMX_STATE.dir = -1; } renderProductPage(); };
window.pmxAll = () => { PMX_STATE.all = !PMX_STATE.all; renderProductPage(); };
window.pmxQ = v => { PMX_STATE.q = v.toLowerCase(); renderProductPage(); };
window.pmxSel = (cod, on) => { if (on) PMX_STATE.sel[cod] = 1; else delete PMX_STATE.sel[cod]; document.getElementById("pmxCmpBtn").textContent = `comparar selecionadas (${Object.keys(PMX_STATE.sel).length})`; };
window.pmxCompare = () => {
  const cods = Object.keys(PMX_STATE.sel);
  if (cods.length < 2) { alert("Selecione pelo menos 2 instituições (checkbox na matriz)."); return; }
  if (cods.length > 10) { alert("Máximo de 10 instituições no comparador."); return; }
  const mix = new Set(cods.map(c => c.startsWith("C") ? "congl" : "ind"));
  if (mix.size > 1) { alert("Níveis de consolidação diferentes (conglomerado × individual) não podem ser comparados."); return; }
  state.cmp.insts = cods; saveLS("obc_cmp", state.cmp); showView("compare");
};
window.exportProductXLSX = slug => {
  const full = state.prodCache && state.prodCache[slug];
  const p = full && full.produto;
  if (!p) return;
  const rows = [["Observatório Brasileiro de Crédito — matriz produto × instituição"],
    [`produto: ${p.nome} (${p.seg.toUpperCase()}) · data-base: ${fmtTri(p.data_base)}`],
    [`fonte: ${full.fonte}`], [full.npl_nota],
    [`extraído em: ${new Date().toISOString().slice(0, 10)}`], [],
    ["cod", "instituição", "nível", "grupo", "carteira R$", "participação %", "Δ4T %", "Δ1T %", "% carteira da IF", "atraso ≥15d do produto %", "inad. >90d TOTAL da IF %", "Basileia %"]];
  p.matriz.forEach(r => rows.push([r.cod, r.nome, r.nivel, r.sr || "", r.carteira_brl, r.share_pct, r.d4t_pct, r.d1t_pct, r.pct_carteira_inst, r.atraso15_pct, r.npl_inst_pct, r.basileia_pct]));
  dlXlsx(`produto_${slug}_${p.data_base}.xlsx`, rows, p.nome.slice(0, 30));
};
window.exportProductCSV = slug => {
  const full = state.prodCache && state.prodCache[slug];
  const p = full && full.produto;
  if (!p) return;
  const head = ["# Observatório Brasileiro de Crédito — matriz produto × instituição",
    `# produto: ${p.nome} (${p.seg.toUpperCase()}) · modalidade original: ${p.modalidade_original}`,
    `# fonte: ${full.fonte} · data-base: ${fmtTri(p.data_base)} · extraído em: ${new Date().toISOString().slice(0, 10)}`,
    `# nota: ${full.npl_nota}`,
    "cod;instituicao;nivel;grupo;carteira_brl;share_pct;d4t_pct;d1t_pct;pct_carteira_inst;atraso15_produto_pct;npl90_inst_pct;basileia_pct"];
  const rows = p.matriz.map(r => [r.cod, csvEsc(r.nome), r.nivel, r.sr || "", r.carteira_brl, r.share_pct, r.d4t_pct ?? "", r.d1t_pct ?? "", r.pct_carteira_inst ?? "", r.atraso15_pct ?? "", r.npl_inst_pct ?? "", r.basileia_pct ?? ""].join(";"));
  dlFile(`produto_${slug}_${p.data_base}.csv`, head.concat(rows).join("\n"));
};

function renderProductPage() {
  const el = document.getElementById("view-product");
  const slug = state.filters.productSlug;
  if (!slug) { el.innerHTML = "<p class='src'>Escolha um produto na página <a href='javascript:void(0)' onclick=\"nav('products')\">Produtos de Crédito</a>.</p>"; return; }
  state.prodCache = state.prodCache || {};
  if (state.prodCache[slug]) { renderProductPageData(el, state.prodCache[slug]); return; }
  el.innerHTML = loadingCard("matriz completa do produto");
  fetch(`${DATA_BASE}prod/${slug}.json?v=${APP_VERSION}`).then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(d => { state.prodCache[slug] = d; if (currentView() === "product" && state.filters.productSlug === slug) renderProductPageData(el, d); })
    .catch(() => { el.innerHTML = "<div class='card'><p class='src'>Produto não encontrado ou dados indisponíveis — <a href='javascript:void(0)' onclick=\"nav('products')\">voltar aos produtos</a>.</p></div>"; });
}
function renderProductPageData(el, P) {
  const p = P.produto;
  const c = p.concentracao;
  const serie = p.serie.map(x => ({ x: anomesISO(x.anomes), y: x.total_brl / 1e9 }));
  const kpi = (lbl, val, sub, seal) => `<div class="card kpi"><h4>${lbl} ${seal || ""}</h4><div class="big" style="font-size:21px">${val}</div><div class="src">${sub || ""}</div></div>`;
  let rows = p.matriz.filter(r => !PMX_STATE.q || r.nome.toLowerCase().includes(PMX_STATE.q));
  rows = rows.slice().sort((a, b) => {
    const va = a[PMX_STATE.sort], vb = b[PMX_STATE.sort];
    if (va == null) return 1; if (vb == null) return -1;
    return (va > vb ? 1 : va < vb ? -1 : 0) * PMX_STATE.dir;
  });
  const shown = PMX_STATE.all ? rows : rows.slice(0, 60);
  const th = (k, lbl, title) => `<th onclick="pmxSort('${k}')" title="${title || "ordenar"}">${lbl}${PMX_STATE.sort === k ? (PMX_STATE.dir < 0 ? " ↓" : " ↑") : ""}</th>`;
  const trow = r => `<tr>
    <td><input type="checkbox" ${PMX_STATE.sel[r.cod] ? "checked" : ""} onchange="pmxSel('${r.cod}', this.checked)" aria-label="selecionar ${attr(r.nome)}"></td>
    <td><span class="clickable" onclick="${r.cod.startsWith("C") || r.cod.length === 8 ? `openInstPage('${r.cod}')` : ""}"><b>${r.nome.slice(0, 34)}</b></span><div class="src">${r.sr || ""} · ${r.nivel}</div></td>
    <td style="text-align:right">${fmt.money(r.carteira_brl)}</td>
    <td style="text-align:right">${fmt.n(r.share_pct, 2)}%</td>
    <td style="text-align:right" class="${r.d4t_pct > 0 ? "down good" : r.d4t_pct < 0 ? "up" : "neutral"}">${r.d4t_pct != null ? fmt.pp(r.d4t_pct) + "%" : "–"}</td>
    <td style="text-align:right">${r.d1t_pct != null ? fmt.pp(r.d1t_pct) + "%" : "–"}</td>
    <td style="text-align:right">${r.pct_carteira_inst != null ? fmt.n(r.pct_carteira_inst, 1) + "%" : "–"}</td>
    <td style="text-align:right"><b>${r.atraso15_pct != null ? fmt.n(r.atraso15_pct, 2) + "%" : "–"}</b></td>
    <td style="text-align:right">${r.npl_inst_pct != null ? fmt.n(r.npl_inst_pct, 2) + "%" : "–"}</td>
    <td style="text-align:right">${r.basileia_pct != null ? fmt.n(r.basileia_pct, 1) + "%" : "–"}</td></tr>`;
  el.innerHTML = `
  <div class="src" style="margin-bottom:6px"><button class="btn ghost small" onclick="nav('products')">← produtos</button> Produtos de Crédito › ${p.nome} · data-base ${fmtTri(p.data_base)} ${badge("observado")}</div>
  <h2>${p.nome}</h2>
  <div class="chips" style="margin:6px 0">
    <span class="chip">${p.seg.toUpperCase()}</span><span class="chip">crédito ${p.natureza}</span>
    <span class="chip" title="nomenclatura da fonte">IF.data: ${p.modalidade_original.replace(/_/g, " ")}</span>
    <span class="chip">${p.n_instituicoes} instituições</span>
  </div>
  <p class="viewdesc">${p.definicao}${p.nota_taxonomia ? " " + p.nota_taxonomia : ""}</p>
  ${p.sintese ? `<div class="diag" style="margin-top:2px"><div class="diag-frase" style="font-size:19px">${p.sintese}</div><div class="diag-meta">${badge("calculado", p.sintese_regras)} regras: ${p.sintese_regras}</div></div>` : ""}
  <div class="kpirow">
    ${kpi("Mercado (universo IF.data)", fmt.money(p.mercado_total_brl), fmtTri(p.data_base), badge("observado"))}
    ${kpi("Crescimento 4 trim.", p.crescimento_4t_pct != null ? fmt.pp(p.crescimento_4t_pct) + "%" : "–", `amostra pareada n=${p.crescimento_4t_n_pareado}`, badge("calculado"))}
    ${kpi("Crescimento 1 trim.", p.crescimento_1t_pct != null ? fmt.pp(p.crescimento_1t_pct) + "%" : "–", "pareado", badge("calculado"))}
    ${kpi("Participação no segmento", p.share_segmento_pct != null ? fmt.n(p.share_segmento_pct, 1) + "%" : "–", `da carteira ${p.seg.toUpperCase()} IF.data`, badge("calculado"))}
    ${kpi("Concentração", `top-5 ${fmt.n(c.top5_pct, 0)}%`, `top-1 ${fmt.n(c.top1_pct, 1)}% · top-10 ${fmt.n(c.top10_pct, 0)}% · HHI ${c.hhi}`, badge("calculado"))}
    ${p.atraso15 && p.atraso15.agg_pct != null ? kpi("Atraso ≥15d do produto", fmt.n(p.atraso15.agg_pct, 2) + "%", `agregado (n=${p.atraso15.n}) · mediana entre IFs ${fmt.n(p.atraso15.mediana_pct, 2)}% · quartis ${fmt.n(p.atraso15.p25_pct, 1)}–${fmt.n(p.atraso15.p75_pct, 1)}%`, badge("observado", p.atraso15.nota)) : ""}
  </div>
  <h3>Evolução do mercado e do atraso</h3>
  <div class="grid g2">
  <div class="card"><h4>Carteira total ${badge("observado")}</h4>${lineChart({ series: [{ pts: serie, color: "#1d4e89", label: "carteira total (R$ bi)" }], h: 180, unit: "R$ bi", fonte: "BCB IF.data", status: "observado", dec: 0 })}
  ${chartFooter({ fonte: P.fonte, periodo: p.serie.map(x => fmtTri(x.anomes)).join(" – "), atualizado: P.gerado_em.slice(0, 10), unidade: "R$ bi", nota: "soma das carteiras reportadas; nº de reportantes varia por trimestre (série não pareada — o crescimento dos cartões usa amostra pareada)." })}</div>
  ${p.atraso15 && p.atraso15.serie && p.atraso15.serie.length >= 2 ? `<div class="card"><h4>Atraso ≥15d no produto ${badge("observado", p.atraso15.nota)}</h4>
  ${lineChart({ series: [{ pts: p.atraso15.serie.map(x => ({ x: anomesISO(x.anomes), y: x.agg_pct })), color: "#b45309", label: "atraso ≥15d agregado" }], h: 180, unit: "%", fonte: "BCB IF.data rel. 123/128", status: "observado", dec: 2 })}
  ${chartFooter({ fonte: p.atraso15.fonte, periodo: p.atraso15.serie.map(x => fmtTri(x.anomes)).join(" – "), atualizado: P.gerado_em.slice(0, 10), unidade: "% da carteira da modalidade", nota: p.atraso15.nota })}</div>` : ""}
  </div>
  <h3>Matriz produto × instituição <span class="src">(${p.matriz.length} instituições)</span></h3>
  <div class="controls">
    <input type="search" placeholder="filtrar instituição…" value="${PMX_STATE.q}" oninput="pmxQ(this.value)" aria-label="filtrar instituição">
    <button class="btn small" id="pmxCmpBtn" onclick="pmxCompare()">comparar selecionadas (${Object.keys(PMX_STATE.sel).length})</button>
    <button class="btn ghost small" onclick="exportProductCSV('${p.slug}')">CSV</button>
    <button class="btn ghost small" onclick="exportProductXLSX('${p.slug}')">XLSX</button>
    <button class="btn ghost small" onclick="navigator.clipboard.writeText(location.href).then(()=>alert('URL copiada'))">copiar URL</button>
    ${!PMX_STATE.all && rows.length > 60 ? `<button class="btn ghost small" onclick="pmxAll()">mostrar todas (${rows.length})</button>` : rows.length > 60 ? `<button class="btn ghost small" onclick="pmxAll()">mostrar top-60</button>` : ""}
  </div>
  <div class="tblwrap"><table class="data"><thead><tr><th></th>${th("nome", "Instituição")}${th("carteira_brl", "Carteira no produto")}${th("share_pct", "Participação")}${th("d4t_pct", "Δ 4 trim.")}${th("d1t_pct", "Δ 1 trim.")}${th("pct_carteira_inst", "% da carteira da IF", "peso do produto na carteira total da instituição")}${th("atraso15_pct", "Atraso ≥15d NO PRODUTO", "vencido ≥15 dias ÷ carteira da modalidade (IF.data rel. 123/128) — conceito de atraso, específico do produto; não é NPL >90d")}${th("npl_inst_pct", "Inad. >90d TOTAL da IF", "Inadimplência >90d total da instituição (Res. 4.966) — NÃO específica do produto")}${th("basileia_pct", "Basileia")}</tr></thead>
  <tbody>${shown.map(trow).join("")}</tbody></table></div>
  <div class="note warn"><b>Leitura correta:</b> ${P.npl_nota} Basileia é da instituição inteira.</div>
  ${(function(){
    const a = p.atraso15;
    if (!a || a.agg_pct == null) return "";
    const comAtraso = p.matriz.filter(r => r.atraso15_pct != null);
    const vals = comAtraso.map(r => r.atraso15_pct);
    const RELEV = 100e6; // corte de relevância declarado: carteira ≥ R$ 100 mi no produto
    const top = comAtraso.filter(r => r.carteira_brl >= RELEV).sort((x, y) => y.atraso15_pct - x.atraso15_pct).slice(0, 10);
    const melhores = comAtraso.filter(r => r.carteira_brl >= RELEV).sort((x, y) => x.atraso15_pct - y.atraso15_pct).slice(0, 5);
    const linha = r => `<tr class="clickable" onclick="openInstPage('${r.cod}')">
      <td><b>${r.nome.slice(0, 30)}</b><div class="src">${r.sr || ""} · carteira ${fmt.money(r.carteira_brl)} no produto</div></td>
      <td style="text-align:right"><b>${fmt.n(r.atraso15_pct, 2)}%</b></td>
      <td style="text-align:right" class="src">${r.d4t_pct != null ? fmt.pp(r.d4t_pct) + "% carteira 4T" : "–"}</td></tr>`;
    return `<h3>Risco do produto — atraso ≥15 dias ${badge("observado", a.nota)}</h3>
    <div class="grid g2">
      <div class="card"><h4>Distribuição entre instituições</h4>
        ${histogram(vals, a.agg_pct, 420, 110)}
        <div class="src">marcador = atraso agregado do produto (${fmt.n(a.agg_pct, 2)}%) · mediana ${fmt.n(a.mediana_pct, 2)}% · quartis ${fmt.n(a.p25_pct, 1)}–${fmt.n(a.p75_pct, 1)}% · ${vals.length} instituições com atraso reportado</div>
        <h5 style="margin-top:12px">Menores atrasos (carteira ≥ R$ 100 mi)</h5>
        <div class="chips">${melhores.map(r => `<span class="chip clickable" onclick="openInstPage('${r.cod}')">${r.nome.slice(0, 20)} · ${fmt.n(r.atraso15_pct, 2)}%</span>`).join("")}</div>
      </div>
      <div class="card"><h4>Maiores atrasos no produto <span class="src">(entre carteiras ≥ R$ 100 mi — corte de relevância declarado)</span></h4>
        <div class="tblwrap"><table class="data compact"><thead><tr><th>Instituição</th><th style="text-align:right">Atraso ≥15d</th><th style="text-align:right">Δ carteira 4T</th></tr></thead>
        <tbody>${top.map(linha).join("")}</tbody></table></div>
        <div class="src">Atraso alto ≠ insolvência: depende de mix, garantias, provisões e capital — ver página da instituição. Fonte: ${a.fonte}.</div>
      </div>
    </div>`;
  })()}
  ${taxasSection(p)}
  <h3>Indisponíveis nesta página (e por quê)</h3>
  <div class="card">${p.indisponiveis.map(i => `<div class="contrib"><span class="lbl" style="width:auto"><b>${i.metrica}</b> — <span class="src" style="display:inline">${i.razao}</span> <span class="seal aprox">INDISPONÍVEL</span></span></div>`).join("")}</div>
  ${chartFooter({ fonte: P.fonte, periodo: fmtTri(p.data_base), atualizado: P.gerado_em.slice(0, 10), unidade: "R$", nota: P.consolidacao_nota })}`;
}


/* ---------- Taxas de juros por instituição (txjuros) ---------- */
const TX_STATE = { idx: 0 };
window.txSetIdx = i => { TX_STATE.idx = i; renderProductPage(); };
function taxasSection(p) {
  const t = p.taxas;
  if (!t) return "";
  if (!t.disponivel) {
    return `<h3>Taxas de juros por instituição</h3>
    <div class="card"><span class="seal aprox">INDISPONÍVEL</span> <span class="src">${t.razao}</span></div>`;
  }
  const idx = Math.min(TX_STATE.idx, t.itens.length - 1);
  const it = t.itens[idx];
  const rows = it.ranking.map(r => `<tr>
    <td>${r.posicao ?? "–"}</td>
    <td>${r.cod_congl ? `<span class="clickable" onclick="openInstPage('${r.cod_congl}')"><b>${r.nome}</b></span>` : `<b>${r.nome}</b>`}<div class="src">cnpj8 ${r.cnpj8}${r.cod_congl ? ` · conglomerado ${r.cod_congl}` : ""}</div></td>
    <td style="text-align:right"><b>${fmt.n(r.taxa_aa, 2)}%</b></td>
    <td style="text-align:right">${r.taxa_am != null ? fmt.n(r.taxa_am, 2) + "%" : "–"}</td></tr>`).join("");
  const serieChart = (it.serie && it.serie.length >= 4) ? lineChart({
    series: [{ pts: it.serie.map(x => ({ x: x.inicio, y: x.mediana_aa })), color: "#1d4e89", label: "mediana do universo" }],
    band: { pts: it.serie.map(x => ({ x: x.inicio, lo: x.p25_aa, hi: x.p75_aa })) },
    h: 170, unit: "% a.a.", fonte: "BCB txjuros", status: "observado", dec: 1,
  }) + `<div class="src">banda = quartis (p25–p75) entre instituições da janela · ${it.serie.length} janelas desde ${fmt.d(it.serie[0].inicio)}</div>` : "";
  return `<h3>Taxas de juros por instituição ${badge("observado")}</h3>
  <div class="controls"><span class="seg">${t.itens.map((x, i) => `<button class="${i === idx ? "active" : ""}" onclick="txSetIdx(${i})" title="${attr(x.modalidade)}">${x.modalidade.replace(/ - Prefixado$/, "").replace(/ - Pós-fixado.*$/, " (pós)").slice(0, 42)}</button>`).join("")}</span></div>
  <div class="card">
    <div class="src" style="margin-bottom:8px">janela ${fmt.d(it.inicio)}–${fmt.d(it.fim)} · ${it.n_inst} instituições · mediana <b>${fmt.n(it.mediana_aa, 1)}% a.a.</b> · quartis ${fmt.n(it.p25_aa, 1)}–${fmt.n(it.p75_aa, 1)}% · amplitude ${fmt.n(it.min_aa, 1)}–${fmt.n(it.max_aa, 1)}%
    ${it.moeda_estrangeira ? ` · <span class="seal aprox">TAXA REFERENCIADA EM MOEDA ESTRANGEIRA — não comparável a taxas em reais</span>` : ""}</div>
    ${serieChart}
    <div class="tblwrap"><table class="data compact"><thead><tr><th title="posição no ranking BCB (menor taxa primeiro)">#</th><th>Instituição (individual, cnpj8)</th><th style="text-align:right">Taxa a.a.</th><th style="text-align:right">Taxa a.m.</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${chartFooter({ fonte: t.fonte, periodo: `${fmt.d(it.inicio)}–${fmt.d(it.fim)}`, atualizado: (state.prodCache[state.filters.productSlug] || state.data.products).gerado_em.slice(0, 10), unidade: "% a.a.", nota: t.nota })}
  </div>`;
}

/* ---------- Comparador de Instituições ---------- */

/* ---------- bump chart: posição no ranking ao longo dos trimestres ---------- */
function bumpChart(items, periods, w = 720, h0 = null) {
  const n = items.length;
  if (n < 2 || periods.length < 2) return "<p class='src'>São necessárias pelo menos 2 instituições e 2 períodos com dados.</p>";
  const h = h0 || Math.max(120, n * 34 + 50);
  const ML = 30, MR = 170, MT = 18, MB = 26;
  const X = i => ML + i / (periods.length - 1) * (w - ML - MR);
  const Y = r => MT + (r - 1) / Math.max(n - 1, 1) * (h - MT - MB);
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="mudança de posição no ranking">`;
  periods.forEach((p, i) => { out += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" font-size="10" style="fill:var(--c-axis-text)">${p}</text>`; });
  for (let r = 1; r <= n; r++) out += `<text x="${ML - 8}" y="${Y(r) + 3}" text-anchor="end" font-size="10" style="fill:var(--c-axis-text)">#${r}</text>`;
  const bumpItems = items, bumpPeriods = periods;
  items.forEach(it => {
    const pts = it.ranks.map((r, i) => r == null ? null : [X(i), Y(r)]);
    const d = pts.map((p, i) => p ? `${pts[i - 1] ? "L" : "M"}${p[0]},${p[1]}` : "").join(" ");
    out += `<path d="${d}" fill="none" style="stroke:${ccol(it.color)}" stroke-width="2.2" stroke-linejoin="round"/>`;
    pts.forEach((p, i) => {
      if (!p) return;
      const tip = encodeURIComponent(`<div class="tt-date">${periods[i]}</div><div class="tt-row"><span class="tt-lbl">${it.label}</span><span class="tt-val">#${it.ranks[i]}</span></div><div class="tt-row"><span class="tt-lbl">valor</span><span class="tt-val">${it.vals[i]}</span></div>`);
      out += `<circle cx="${p[0]}" cy="${p[1]}" r="4" data-tip="${tip}" style="fill:${ccol(it.color)};stroke:var(--c-halo);stroke-width:1.5"/>`;
    });
    const lastIdx = it.ranks.map((r, i) => r != null ? i : null).filter(x => x != null).pop();
    if (lastIdx != null) out += `<text x="${X(lastIdx) + 10}" y="${Y(it.ranks[lastIdx]) + 3.5}" font-size="11" font-weight="600" style="fill:${ccol(it.color)};paint-order:stroke;stroke:var(--c-halo);stroke-width:3px">${it.label.slice(0, 24)}</text>`;
  });
  out += `</svg>`;
  out += `<details class="charttable"><summary>dados em tabela</summary><div class="tblwrap" style="max-height:220px"><table class="data compact"><thead><tr><th>Instituição</th>${bumpPeriods.map(p2 => `<th style="text-align:right">${p2}</th>`).join("")}</tr></thead><tbody>` +
    bumpItems.map(it => `<tr><td>${it.label}</td>${it.ranks.map((r, i) => `<td style="text-align:right">${r != null ? "#" + r + " (" + it.vals[i] + ")" : "–"}</td>`).join("")}</tr>`).join("") +
    `</tbody></table></div></details>`;
  return out;
}

/* ---------- Watchlist: comparações salvas + regras de monitoramento (localStorage) ---------- */
function watchRules() { return loadLS("obc_watch_rules", []); }
function savedCmps() { return loadLS("obc_saved_cmps", []); }
window.wlSaveCmp = () => {
  const nome = prompt("Nome desta comparação:");
  if (!nome) return;
  const list = savedCmps();
  list.push({ nome, cmp: JSON.parse(JSON.stringify(state.cmp)), criada_em: new Date().toISOString().slice(0, 10) });
  saveLS("obc_saved_cmps", list); renderCompare();
};
window.wlLoadCmp = i => { const c = savedCmps()[i]; if (!c) return; state.cmp = JSON.parse(JSON.stringify(c.cmp)); cmpSave(); renderCompare(); };
window.wlDelCmp = i => { const l = savedCmps(); l.splice(i, 1); saveLS("obc_saved_cmps", l); renderCompare(); };
window.wlAddRule = () => {
  const cod = document.getElementById("wlInst").value;
  const mid = document.getElementById("wlMet").value;
  const tipo = document.getElementById("wlTipo").value;
  const op = document.getElementById("wlOp").value;
  const lim = parseFloat(document.getElementById("wlLim").value);
  if (!cod || !mid || isNaN(lim)) { alert("Preencha instituição, métrica e limiar."); return; }
  const rules = watchRules();
  rules.push({ cod, mid, tipo, op, lim });
  saveLS("obc_watch_rules", rules); renderCompare();
};
window.wlDelRule = i => { const r = watchRules(); r.splice(i, 1); saveLS("obc_watch_rules", r); renderCompare(); };
async function wlEval(rule, C) {
  const d = await fetchCmp(rule.cod);
  if (!d) return { status: "sem dado", detalhe: "instituição sem arquivo de métricas" };
  const cat = cmpCatalogById()[rule.mid];
  const serie = d.metrics[rule.mid];
  const latest = C.anomes_list[C.anomes_list.length - 1];
  const prevAno = C.anomes_list.length >= 5 ? C.anomes_list[C.anomes_list.length - 5] : null;
  if (!serie || serie[latest] == null) return { status: "sem dado", nome: d.nome, detalhe: `${cat ? cat.name : rule.mid} não reportada em ${fmtTri(latest)} (ausência ≠ zero)` };
  let v = serie[latest], desc = cmpFmtVal(cat, v);
  if (rule.tipo === "d4t") {
    if (!prevAno || serie[prevAno] == null) return { status: "sem dado", nome: d.nome, detalhe: "sem base 4 trimestres atrás" };
    v = cat.unit === "%" ? v - serie[prevAno] : (v / serie[prevAno] - 1) * 100;
    desc = fmt.pp(v) + (cat.unit === "%" ? " p.p." : "%") + " em 4T";
  }
  const hit = rule.op === ">" ? v > rule.lim : v < rule.lim;
  return { status: hit ? "DISPARADA" : "ok", nome: d.nome, valor: desc, detalhe: `${cat.name} ${rule.tipo === "d4t" ? "Δ4T " : ""}${rule.op} ${rule.lim} → atual ${desc} (${fmtTri(latest)})` };
}
async function wlRender(C, cat) {
  const box = document.getElementById("wlStatus");
  if (!box) return;
  const rules = watchRules();
  if (!rules.length) { box.innerHTML = "<p class='src'>nenhuma regra configurada.</p>"; return; }
  box.innerHTML = "<p class='src'>avaliando regras…</p>";
  const evals = await Promise.all(rules.map(r => wlEval(r, C)));
  box.innerHTML = evals.map((e, i) => `<div class="alert ${e.status === "DISPARADA" ? "relevante" : "informativo"}">
    <span class="lvl">${e.status}</span> <b>${e.nome || rules[i].cod}</b>
    <button class="btn ghost small" style="float:right" onclick="wlDelRule(${i})">remover</button>
    <div class="expl">${e.detalhe}</div></div>`).join("");
}

function cmpSave() { saveLS("obc_cmp", state.cmp); syncHash(); }
async function fetchCmp(cod) {
  if (state.cmpCache[cod]) return state.cmpCache[cod];
  try {
    const r = await fetch(`${DATA_BASE}cmp/${cod}.json?v=${APP_VERSION}`);
    if (!r.ok) throw 0;
    const j = await r.json();
    state.cmpCache[cod] = j;
    return j;
  } catch (e) { return null; }
}
window.cmpSearch = v => {
  const box = document.getElementById("cmpResults");
  const q = v.trim().toLowerCase();
  if (!q || q.length < 2) { box.innerHTML = ""; return; }
  const ix = state.data.inst_index;
  if (!ix) return;
  const hits = ix.instituicoes.filter(i => (i.nome || "").toLowerCase().includes(q) || (i.razao || "").toLowerCase().includes(q) || i.cod.toLowerCase().includes(q)).slice(0, 12);
  box.innerHTML = hits.map(i => `<div class="shortcut clickable" onclick="cmpAdd('${i.cod}')"><b>${i.nome}</b> <span class="src">${i.razao || ""} · ${i.cod} · ${i.sr || "–"} · ${i.cod.startsWith("C") ? "conglomerado prudencial" : "instituição individual"} · ativos ${fmt.money(i.ativo_brl)}</span></div>`).join("") || "<p class='src'>nenhuma instituição encontrada</p>";
};
window.cmpAdd = cod => {
  const cmp = state.cmp;
  if (cmp.insts.includes(cod)) return;
  if (cmp.insts.length >= 10) { alert("Máximo de 10 instituições."); return; }
  const lvl = cod.startsWith("C") ? "congl" : "ind";
  if (cmp.insts.length && (cmp.insts[0].startsWith("C") ? "congl" : "ind") !== lvl) {
    document.getElementById("cmpWarn").innerHTML = `<div class="note warn"><b>Comparação bloqueada:</b> não é possível misturar conglomerado prudencial com instituição individual — os balanços não são comparáveis (dupla contagem/consolidação distinta). Remova as instituições de um dos níveis.</div>`;
    return;
  }
  cmp.insts.push(cod); cmpSave(); renderCompare();
};
window.cmpDel = cod => { state.cmp.insts = state.cmp.insts.filter(c => c !== cod); cmpSave(); renderCompare(); };

window.cmpAddSimilares = async () => {
  const first = state.cmp.insts[0];
  if (!first) return;
  const d = await fetchCmp(first);
  const sim = d && d.semelhantes;
  if (!sim || !sim.lista.length) { alert("Sem semelhantes pelas regras explícitas (mesmo nível, porte 1/3–3×, especialização ±15 p.p., mix PF ±20 p.p.)."); return; }
  sim.lista.forEach(x => { if (state.cmp.insts.length < 10 && !state.cmp.insts.includes(x.cod)) state.cmp.insts.push(x.cod); });
  cmpSave(); renderCompare();
};
window.cmpQuick = () => { state.cmp.insts = ["C0010069", "C0049906", "C0051626", "C0010045", "C0030379"].slice(0, 10); cmpSave(); renderCompare(); };
window.cmpSet = (k, v) => { state.cmp[k] = v; cmpSave(); renderCompare(); };
window.cmpToggleMet = (mid, on) => {
  const m = state.cmp.mets;
  if (on && !m.includes(mid)) m.push(mid);
  if (!on) state.cmp.mets = m.filter(x => x !== mid);
  cmpSave(); renderCompare();
};
function cmpCatalogById() { const C = state.data.compare; const map = {}; (C && C.metric_catalog || []).forEach(m => map[m.metric_id] = m); return map; }
function cmpFmtVal(m, v) {
  if (v == null) return "–";
  if (m.unit === "R$") return fmt.money(v);
  return fmt.n(v, 2) + (m.unit === "%" ? "%" : "");
}
function cmpNorm(mid, cod, datas, norm, latest, prevAno) {
  // retorna {v, txt, title} — null quando normalização não se aplica (nunca zero)
  const C = state.data.compare;
  const cat = cmpCatalogById()[mid];
  const d = datas[cod];
  const raw = d && d.metrics[mid] ? d.metrics[mid][latest] : null;
  if (!cat) return { v: null, txt: "–" };
  const sup = cat.supported_normalizations || [];
  if (norm !== "abs" && !sup.includes(norm)) return { v: null, txt: "n/a", title: "normalização não aplicável a esta métrica" };
  if (raw == null) return { v: null, txt: "–", title: "sem dado reportado (ausência ≠ zero)" };
  const st = (C.stats[mid] || {})[latest];
  if (norm === "abs") return { v: raw, txt: cmpFmtVal(cat, raw) };
  if (norm === "d4t") {
    const prev = d.metrics[mid] ? d.metrics[mid][prevAno] : null;
    if (prev == null) return { v: null, txt: "–", title: "sem base 4 trimestres atrás" };
    if (cat.unit === "%") { const dv = raw - prev; return { v: dv, txt: fmt.pp(dv) + " p.p." }; }
    const g = (raw / prev - 1) * 100; return { v: g, txt: fmt.pp(g) + "%" };
  }
  if (norm === "vs_mediana") { if (!st) return { v: null, txt: "–" }; const dv = raw - st.mediana; return { v: dv, txt: (cat.unit === "R$" ? (dv >= 0 ? "+" : "−") + fmt.money(Math.abs(dv)) : fmt.pp(dv) + (cat.unit === "%" ? " p.p." : "")), title: `mediana do universo (${st.n} IFs): ${cmpFmtVal(cat, st.mediana)}` }; }
  if (norm === "zscore") { if (!st || !st.dp || st.n < 30) return { v: null, txt: "n/a", title: "amostra insuficiente para z-score (n<30)" }; const z = (raw - st.media) / st.dp; return { v: z, txt: "z=" + fmt.n(z, 2), title: `média ${cmpFmtVal(cat, st.media)} · dp ${cmpFmtVal(cat, st.dp)} · n=${st.n}` }; }
  if (norm === "pct_ativo") { const at = d.metrics.ativo_total ? d.metrics.ativo_total[latest] : null; if (!at) return { v: null, txt: "–" }; const p = raw / at * 100; return { v: p, txt: fmt.n(p, 1) + "%" }; }
  if (norm === "pct_carteira") { const ct = d.metrics.carteira_credito ? d.metrics.carteira_credito[latest] : null; if (!ct) return { v: null, txt: "–" }; const p = raw / ct * 100; return { v: p, txt: fmt.n(p, 1) + "%" }; }
  if (norm === "rank") return { v: raw, txt: cmpFmtVal(cat, raw) }; // rank calculado na linha
  return { v: raw, txt: cmpFmtVal(cat, raw) };
}
window.exportCmp = fmtType => {
  const C = state.data.compare;
  const cmp = state.cmp;
  const datas = cmp.insts.map(c => state.cmpCache[c]).filter(Boolean);
  const latest = C.anomes_list[C.anomes_list.length - 1];
  const cat = cmpCatalogById();
  if (fmtType === "xlsx") {
    const rows = [["Observatório Brasileiro de Crédito — comparação de instituições"],
      [`fonte: ${C.fonte}`], [`consolidação: ${datas[0] ? datas[0].nivel : "-"}`],
      [`extraído em: ${new Date().toISOString().slice(0, 10)} · frequência: trimestral`], [],
      ["métrica", "unidade", "status", "instituição", "cod", "trimestre", "valor"]];
    cmp.mets.forEach(mid => { const m = cat[mid]; if (!m) return;
      datas.forEach(d => { Object.entries(d.metrics[mid] || {}).forEach(([anomes, v]) => {
        rows.push([m.name, m.unit, m.quality_status, d.nome, d.cod, fmtTri(anomes), v]); }); }); });
    dlXlsx(`comparacao_${latest}.xlsx`, rows, "Comparação");
    return;
  }
  if (fmtType === "json") {
    dlFile(`comparacao_${latest}.json`, JSON.stringify({ extraido_em: new Date().toISOString(), fonte: C.fonte,
      consolidacao: datas[0] ? datas[0].nivel : null, normalizacao: cmp.norm, instituicoes: datas.map(d => ({ cod: d.cod, nome: d.nome, nivel: d.nivel, metrics: d.metrics })), catalogo: cmp.mets.map(m => cat[m]).filter(Boolean) }, null, 1), "application/json");
    return;
  }
  const head = ["# Observatório Brasileiro de Crédito — comparação de instituições",
    `# fonte: ${C.fonte} · frequência: trimestral · extraído em: ${new Date().toISOString().slice(0, 10)}`,
    `# consolidação: ${datas[0] ? datas[0].nivel : "-"} · ${C.consolidacao_nota}`,
    "metrica;unidade;status;instituicao;cod;anomes;valor"];
  const rows = [];
  cmp.mets.forEach(mid => { const m = cat[mid]; if (!m) return;
    datas.forEach(d => { Object.entries(d.metrics[mid] || {}).forEach(([anomes, v]) => {
      rows.push([csvEsc(m.name), m.unit, m.quality_status, csvEsc(d.nome), d.cod, anomes, v].join(";")); }); }); });
  dlFile(`comparacao_${latest}.csv`, head.concat(rows).join("\n"));
};


/* ---------- comparador: grupo comparável e sentido econômico ---------- */
function cmpGrupoDef(C, cmp, datas, latest) {
  // devolve { key, label, n, stats(mid) -> {mediana,q1,q3,n} } conforme cmp.grupo
  if (cmp.grupo === "auto" || !cmp.grupo) {
    // padrão comparável: o segmento prudencial da instituição de referência
    const refCod2 = cmp.insts.includes(cmp.ref) ? cmp.ref : cmp.insts[0];
    const sr = refCod2 && datas[refCod2] ? datas[refCod2].sr : null;
    if (sr && C.grupos && C.grupos["sr:" + sr]) {
      const g = C.grupos["sr:" + sr];
      return { key: "auto", label: `pares do segmento ${sr} (automático)`, n: g.n_insts, stats: mid => g.stats[mid] || null };
    }
    return { key: "auto", label: "universo IF.data (sem segmento identificado)", n: (C.universo || {}).n_total,
      stats: mid => ((C.stats[mid] || {})[latest] || null) };
  }
  if (cmp.grupo === "sel") {
    const stats = mid => {
      const arr = cmp.insts.map(c => (datas[c].metrics[mid] || {})[latest]).filter(v => v != null).sort((a, b) => a - b);
      if (arr.length < 2) return null;
      const q = pp => arr[Math.min(arr.length - 1, Math.max(0, Math.round(pp * (arr.length - 1))))];
      return { mediana: q(0.5), q1: q(0.25), q3: q(0.75), n: arr.length };
    };
    return { key: "sel", label: "instituições selecionadas", n: cmp.insts.length, stats };
  }
  if (cmp.grupo && cmp.grupo.startsWith("sr:") && C.grupos && C.grupos[cmp.grupo]) {
    const g = C.grupos[cmp.grupo];
    return { key: cmp.grupo, label: g.label, n: g.n_insts, stats: mid => g.stats[mid] || null };
  }
  return { key: "universo", label: "universo IF.data (mesmo nível não garantido)", n: (C.universo || {}).n_total,
    stats: mid => ((C.stats[mid] || {})[latest] || null) };
}
function cmpSentidoChip(m) {
  if (!m.economic_direction || m.economic_direction === "neutro") return "";
  const rot = { maior_melhor: "maior ≈ melhor", menor_melhor: "menor ≈ melhor", ambiguo: "sentido ambíguo" }[m.economic_direction] || "";
  return `<span class="src" title="${attr(m.direction_note || "")}" style="white-space:nowrap">${rot} ⓘ</span>`;
}
function cmpPercentil(C, mid, latest, v) {
  // percentil aproximado no universo (declarado): posição entre p10/q1/mediana/q3/p90
  const st = (C.stats[mid] || {})[latest];
  if (!st || v == null) return null;
  if (v <= st.p10) return "≤p10";
  if (v <= st.q1) return "p10–25";
  if (v <= st.mediana) return "p25–50";
  if (v <= st.q3) return "p50–75";
  if (v <= st.p90) return "p75–90";
  return ">p90";
}

function renderCompare() {
  const el = document.getElementById("view-compare");
  const C = state.data.compare;
  if (!C || !C.metric_catalog) { el.innerHTML = "<p class='src'>Catálogo de métricas indisponível — rode o pipeline.</p>"; return; }
  const cmp = state.cmp;
  const cat = cmpCatalogById();
  const latest = C.anomes_list[C.anomes_list.length - 1];
  const refCod = cmp.insts.includes(cmp.ref) ? cmp.ref : cmp.insts[0];
  const prevAno = C.anomes_list.length >= 5 ? C.anomes_list[C.anomes_list.length - 5] : null;
  const nivel = cmp.insts.length ? (cmp.insts[0].startsWith("C") ? "conglomerado prudencial" : "instituição individual") : null;

  const selHtml = `
    <div class="card" style="position:relative">
      <h4>Selecionar instituições (2–10) · pesquise por nome, razão ou código</h4>
      <div class="controls" style="margin:8px 0">
        <input type="search" id="cmpQ" placeholder="ex.: Itaú, Nubank, Sicoob…" oninput="cmpSearch(this.value)" style="min-width:280px" aria-label="pesquisar instituição">
        <button class="btn ghost small" onclick="cmpQuick()">5 grandes bancos</button>
        ${cmp.insts.length ? `<button class="btn ghost small" onclick="cmpAddSimilares()" title="regras explícitas: mesmo nível, porte 1/3–3×, especialização ±15 p.p., mix PF ±20 p.p.">+ semelhantes à primeira</button>` : ""}
      </div>
      <div id="cmpResults"></div>
      <div id="cmpWarn"></div>
      <div class="chips" style="margin-top:8px">${cmp.insts.map(c => {
        const d = state.cmpCache[c]; const ix = state.data.inst_index && state.data.inst_index.instituicoes.find(i => i.cod === c);
        const nome = (d && d.nome) || (ix && ix.nome) || c;
        return `<span class="chip">${nome.slice(0, 26)} <span class="src" style="display:inline">${c.startsWith("C") ? "congl." : "indiv."}</span> <a href="javascript:void(0)" onclick="cmpDel('${c}')" aria-label="remover ${attr(nome)}">×</a></span>`;
      }).join("") || "<span class='src'>nenhuma instituição selecionada</span>"}</div>
      ${nivel ? `<div class="src">nível de consolidação: <b>${nivel}</b> · data-base ${fmtTri(latest)} · fonte ${C.fonte}</div>` : ""}
    </div>`;

  if (cmp.insts.length < 2) {
    el.innerHTML = `${pageHead({ title: "Comparador de Instituições", fontes: "BCB IF.data" })}
    <p class="viewdesc">Compare de 2 a 10 instituições em ${C.metric_catalog.length} métricas trimestrais (5 períodos), com normalizações, série histórica, dispersão e exportação. Nível de consolidação sempre explícito; comparações incompatíveis são bloqueadas.</p>
    ${selHtml}
    <div class="note">Sugestões: <a href="javascript:void(0)" onclick="cmpQuick()">5 grandes bancos</a> · ou monte a partir da <a href="javascript:void(0)" onclick="nav('products')">matriz de um produto</a> (checkbox → comparar selecionadas).</div>`;
    return;
  }

  // carrega dados sob demanda e re-renderiza quando tudo chegar
  const missing = cmp.insts.filter(c => !state.cmpCache[c]);
  if (missing.length) {
    el.innerHTML = `${pageHead({ title: "Comparador de Instituições", fontes: "BCB IF.data" })}${selHtml}<p class="src"><span class="spin" aria-hidden="true"></span> carregando ${missing.length} instituição(ões)…</p>`;
    Promise.all(missing.map(fetchCmp)).then(res => {
      state.cmp.insts = state.cmp.insts.filter(c => state.cmpCache[c]); // remove sem dados
      if (res.some(r => !r)) console.warn("instituições sem arquivo cmp removidas");
      renderCompare();
    });
    return;
  }
  const datas = {}; cmp.insts.forEach(c => datas[c] = state.cmpCache[c]);

  const NORMS = [["abs", "valor absoluto"], ["d4t", "Δ 4 trimestres"], ["vs_mediana", "diferença vs. mediana"],
    ["zscore", "z-score (n≥30)"], ["pct_ativo", "% dos ativos"], ["pct_carteira", "% da carteira"], ["rank", "ranking"]];
  const tabs = [["visao", "Visão geral"], ["resumo", "Métricas-chave"], ["serie", "Série histórica"], ["dispersao", "Dispersão"], ["tabela", "Dados completos"], ["custos", "Custos & produtividade"], ["posicoes", "Posições"], ["catalogo", `Catálogo (${C.metric_catalog.length})`], ["watchlist", `Watchlist (${watchRules().length})`]];
  const gdef = cmpGrupoDef(C, cmp, datas, latest);
  const grupoOpts = [["auto", "automático (segmento da referência)"], ["universo", "universo IF.data"], ["sel", "as selecionadas"]]
    .concat(Object.keys(C.grupos || {}).map(k => [k, (C.grupos[k].label || k) + ` (${C.grupos[k].n_insts})`]));
  const ctx = `
  <div class="controls" style="position:sticky;top:0;background:var(--bg);z-index:5;padding:8px 0;border-bottom:1px solid var(--border)">
    <span class="seg">${tabs.map(([k, l]) => `<button class="${cmp.ctab === k ? "active" : ""}" onclick="cmpSet('ctab','${k}')">${l}</button>`).join("")}</span>
    <label>normalização <select onchange="cmpSet('norm', this.value)" aria-label="normalização">${NORMS.map(([k, l]) => `<option value="${k}" ${cmp.norm === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label>grupo de referência <select onchange="cmpSet('grupo', this.value)" aria-label="grupo comparável" title="${attr(C.grupos_nota || "")}">${grupoOpts.map(([k, l]) => `<option value="${k}" ${gdef.key === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <button class="btn ghost small" onclick="navigator.clipboard.writeText(location.href).then(()=>alert('URL copiada — a comparação é reproduzível por link'))">compartilhar</button>
    <details style="position:relative"><summary class="btn ghost small" style="list-style:none;cursor:pointer">exportar ▾</summary>
      <div style="position:absolute;right:0;top:110%;background:var(--surface);border:1px solid var(--border);padding:8px;display:flex;flex-direction:column;gap:6px;z-index:9">
        <button class="btn ghost small" onclick="exportCmp('csv')">CSV (valores + fontes + fórmulas)</button>
        <button class="btn ghost small" onclick="exportCmp('xlsx')">XLSX</button>
        <button class="btn ghost small" onclick="exportCmp('json')">JSON completo</button>
        <button class="btn ghost small" onclick="window.print()" title="usar 'Salvar como PDF'">PDF (imprimir)</button>
      </div></details>
  </div>`;

  const metRow = (mid, comRank) => {
    const m = cat[mid]; if (!m) return "";
    const cells = cmp.insts.map(c => cmpNorm(mid, c, datas, cmp.norm, latest, prevAno));
    let ranks = null;
    if (cmp.norm === "rank") {
      const vals = cells.map(x => x.v);
      const sorted = vals.filter(v => v != null).sort((a, b) => b - a);
      ranks = vals.map(v => v == null ? null : sorted.indexOf(v) + 1);
    }
    const gst = gdef.stats(mid);
    const tip = encodeURIComponent(`<div class="tt-date">${m.name}</div><div class="tt-row"><span class="tt-lbl">fórmula</span><span class="tt-val">${m.formula}</span></div><div class="tt-row"><span class="tt-lbl">campo</span><span class="tt-val">${m.original_field}</span></div><div class="tt-row"><span class="tt-lbl">cobertura</span><span class="tt-val">${m.coverage_count} IFs</span></div><div class="tt-row"><span class="tt-lbl">sentido</span><span class="tt-val">${m.economic_direction || "neutro"}${m.direction_note ? " — " + m.direction_note : ""}</span></div><div class="tt-meta">${m.quality_status} · ${m.source.slice(0, 60)} · ${m.comparability_notes.slice(0, 140)}</div>`);
    // barra sutil na célula: proporção do maior valor absoluto entre as selecionadas (apenas norm=abs)
    const absVals = cells.map(x => x.v).filter(v => v != null && isFinite(v));
    const maxAbs2 = absVals.length ? Math.max(...absVals.map(Math.abs)) : null;
    const refIdx = cmp.insts.indexOf(refCod);
    return `<tr><td data-tip="${tip}" style="position:sticky;left:0;background:var(--surface);z-index:1"><b>${m.name}</b> <span class="seal ${m.quality_status.includes("calculado") ? "calc" : "obs"}" style="font-size:8.5px">${m.quality_status.replace("observado ", "obs. ")}</span> ${cmpSentidoChip(m)}<div class="src">${m.unit} · trimestral</div></td>
    ${cells.map((x, i) => {
      const pctl = cmp.norm === "abs" ? cmpPercentil(C, mid, latest, x.v) : null;
      const vsRef = (cmp.norm === "abs" && i !== refIdx && x.v != null && cells[refIdx] && cells[refIdx].v != null && cells[refIdx].v !== 0)
        ? `<div class="src" title="diferença vs. ${attr(datas[refCod].nome)} (referência)">${m.unit === "%" ? fmt.pp(x.v - cells[refIdx].v) + " p.p." : fmt.pp((x.v / cells[refIdx].v - 1) * 100) + "%"} vs ref</div>` : "";
      const bar = (cmp.norm === "abs" && maxAbs2 && x.v != null) ? `<div style="height:3px;background:${ccol(CMP_PALETTE[i % CMP_PALETTE.length])};opacity:.5;width:${Math.max(Math.abs(x.v) / maxAbs2 * 100, 2).toFixed(0)}%;margin-left:auto"></div>` : "";
      return `<td style="text-align:right" ${x.title ? `title="${x.title}"` : (pctl ? `title="percentil no universo: ${pctl}"` : "")}>${x.v == null && !x.txt.replace("–", "") ? "<span class='src'>não disponível</span>" : (cmp.norm === "rank" && ranks ? (ranks[i] ? `<b>#${ranks[i]}</b> <span class="src">${x.txt}</span>` : "<span class='src'>não disponível</span>") : x.txt)}${vsRef}${bar}</td>`;
    }).join("")}
    <td style="text-align:right" class="src" title="mediana do grupo: ${attr(gdef.label)}${gst ? ` (${gst.n} com a métrica)` : ""}${gst && gst.q1 != null ? ` · quartis ${cmpFmtVal(m, gst.q1)} a ${cmpFmtVal(m, gst.q3)}` : ""}">${gst ? cmpFmtVal(m, gst.mediana) : "–"}</td></tr>`;
  };
  const header = `<tr><th style="position:sticky;left:0;background:var(--surface);z-index:3">Métrica</th>${cmp.insts.map((c, i) => `<th style="text-align:right;border-bottom:2px solid ${ccol(CMP_PALETTE[i % CMP_PALETTE.length])}">${datas[c].nome.slice(0, 18)}${c === refCod ? ' <span class="src" title="instituição de referência">◈</span>' : ""}</th>`).join("")}<th style="text-align:right" title="${attr((C.grupos_nota || "") + " Mediana calculada só com quem reporta a métrica.")}">mediana · ${gdef.label.slice(0, 22)}</th></tr>`;

  let body = "";
  if (cmp.ctab === "visao") {
    const val = (c, mid) => (datas[c].metrics[mid] || {})[latest];
    const d4t = (c, mid) => {
      const sv = datas[c].metrics[mid] || {};
      const prev = C.anomes_list.length >= 5 ? sv[C.anomes_list[C.anomes_list.length - 5]] : null;
      const cur = sv[latest];
      return cur != null && prev != null && prev !== 0 ? (cur / prev - 1) * 100 : null;
    };
    const spark = (c, mid) => {
      const sv = datas[c].metrics[mid] || {};
      const arr = C.anomes_list.map(a => sv[a]).filter(v => v != null);
      return arr.length >= 3 ? sparkline(arr, 120, 24) : "";
    };
    const linhaKpi = (rot, valorHtml, selo) => valorHtml == null
      ? `<div class="contrib"><span class="lbl">${rot}</span><span class="src">não disponível</span></div>`
      : `<div class="contrib"><span class="lbl">${rot}</span><span class="num">${valorHtml}</span>${selo || ""}</div>`;
    const cards = cmp.insts.map((c, i) => {
      const d = datas[c];
      const at = val(c, "ativo_total"), ct = val(c, "carteira_credito"), cap = val(c, "captacoes");
      const ll = val(c, "lucro_liquido"), roe = val(c, "roe_periodo"), bas = val(c, "indice_basileia"), npl = val(c, "npl_pct");
      return `<div class="card" style="border-top:3px solid ${ccol(CMP_PALETTE[i % CMP_PALETTE.length])}">
        <h4 style="display:flex;justify-content:space-between;gap:8px"><span>${d.nome.slice(0, 30)}</span>
          ${c === refCod ? '<span class="chip" title="as diferenças da página são medidas contra esta instituição">referência</span>' : `<a href="javascript:void(0)" class="src" onclick="cmpSet('ref','${c}')" title="usar como referência">usar como ref.</a>`}</h4>
        <div class="src" style="margin-bottom:8px">${d.nivel}${d.sr ? " · segmento " + d.sr : ""}${d.porte_quartil ? ` · porte ${d.porte_quartil} <span title="quartil de ativos dentro do mesmo nível de consolidação (P4 = maior)">ⓘ</span>` : ""} · data-base ${fmtTri(latest)}</div>
        ${linhaKpi("ativos totais", at != null ? fmt.money(at) : null)}
        ${linhaKpi("carteira de crédito", ct != null ? fmt.money(ct) : null)}
        ${linhaKpi("captações", cap != null ? fmt.money(cap) : null)}
        ${linhaKpi("lucro (acum. ano)", ll != null ? fmt.money(ll) : null, ' <span class="seal calc" style="font-size:8px" title="acumulado no ano-calendário IF.data — NÃO anualizado; T1 reinicia a base">acum. ano</span>')}
        ${linhaKpi("ROE do período", roe != null ? fmt.n(roe, 1) + "%" : null, ' <span class="seal calc" style="font-size:8px" title="lucro acumulado no ano ÷ PL do trimestre — não anualizado">não anualiz.</span>')}
        ${linhaKpi("Basileia", bas != null ? fmt.n(bas, 1) + "%" : null)}
        ${linhaKpi("inadimplência (>90d)", npl != null ? fmt.n(npl, 2) + "%" : null)}
        <div style="margin-top:6px">${spark(c, "carteira_credito")} <span class="src">carteira · 5 trim.</span></div>
      </div>`;
    }).join("");

    // ---- principais diferenças: geradas dos dados, respeitando o sentido econômico ----
    const nomeCurto = c => datas[c].nome.split(" ").slice(0, 2).join(" ");
    const extremos = mid => {
      const arr = cmp.insts.map(c => ({ c, v: val(c, mid) })).filter(x => x.v != null);
      if (arr.length < 2) return null;
      arr.sort((a, b) => b.v - a.v);
      return { max: arr[0], min: arr[arr.length - 1], n: arr.length };
    };
    const difs = [];
    let e = extremos("ativo_total");
    if (e) difs.push(`<b>Maior escala:</b> ${nomeCurto(e.max.c)} (${fmt.money(e.max.v)}${e.min.v ? `, ${fmt.n(e.max.v / e.min.v, 1)}× a menor` : ""}). Escala é tamanho, não qualidade.`);
    e = extremos("cart_ativo_pct");
    if (e) difs.push(`<b>Especialização em crédito:</b> ${nomeCurto(e.max.c)} tem a maior participação de crédito no ativo (${fmt.n(e.max.v, 0)}%) e ${nomeCurto(e.min.c)} a menor (${fmt.n(e.min.v, 0)}%). Sentido ambíguo: reflete modelo de negócio.`);
    e = extremos("npl_pct");
    if (e) difs.push(`<b>Qualidade corrente da carteira:</b> menor inadimplência em ${nomeCurto(e.min.c)} (${fmt.n(e.min.v, 2)}%); maior em ${nomeCurto(e.max.c)} (${fmt.n(e.max.v, 2)}%). Compare com o mix de produtos antes de concluir.`);
    e = extremos("indice_basileia");
    if (e) difs.push(`<b>Folga de capital:</b> ${nomeCurto(e.max.c)} opera com a Basileia mais alta (${fmt.n(e.max.v, 1)}%) e ${nomeCurto(e.min.c)} com a mais baixa (${fmt.n(e.min.v, 1)}%). Mais capital protege, mas capital ocioso reduz retorno.`);
    const cresc = cmp.insts.map(c => ({ c, v: d4t(c, "carteira_credito") })).filter(x => x.v != null).sort((a, b) => b.v - a.v);
    if (cresc.length >= 2) difs.push(`<b>Crescimento da carteira (4 trim., nominal):</b> ${nomeCurto(cresc[0].c)} ${fmt.pp(cresc[0].v)}% vs ${nomeCurto(cresc[cresc.length - 1].c)} ${fmt.pp(cresc[cresc.length - 1].v)}%. Crescimento acelerado dilui a inadimplência corrente.`);
    e = extremos("cobertura_pct");
    if (e) difs.push(`<b>Cobertura de provisões:</b> ${nomeCurto(e.max.c)} (${fmt.n(e.max.v, 0)}%) vs ${nomeCurto(e.min.c)} (${fmt.n(e.min.v, 0)}%). Ambíguo: mais colchão, mas também mais perda esperada reconhecida.`);

    // ---- barras vs. referência (3 métricas de escala) ----
    const barsMid = ["ativo_total", "carteira_credito", "captacoes"];
    const barras = barsMid.map(mid => {
      const arr = cmp.insts.map((c, i) => ({ c, i, v: val(c, mid) })).filter(x => x.v != null);
      if (!arr.length) return "";
      const mx = Math.max(...arr.map(x => x.v));
      return `<div style="margin-bottom:12px"><div class="src" style="margin-bottom:3px"><b>${cat[mid].name}</b></div>
        ${arr.map(x => `<div class="bets-bar"><span class="lbl" style="flex-basis:150px">${nomeCurto(x.c)}${x.c === refCod ? " ◈" : ""}</span><span class="track"><span class="fill" style="width:${Math.max(x.v / mx * 100, 1.5).toFixed(1)}%;background:${ccol(CMP_PALETTE[x.i % CMP_PALETTE.length])}"></span></span><span class="num">${fmt.money(x.v)}</span></div>`).join("")}</div>`;
    }).join("");

    body = `
    <div class="ov-2col-eq" style="margin-top:6px">${cards}</div>
    <div class="ov-2col" style="margin-top:18px">
      <div class="card"><h4>Principais diferenças <span class="seal calc" style="font-size:8.5px">DADO CALCULADO</span></h4>
        <ul style="font-size:13px;margin:6px 0 4px 16px;display:flex;flex-direction:column;gap:7px">${difs.map(d2 => `<li>${d2}</li>`).join("")}</ul>
        <div class="src">Frases geradas apenas dos dados de ${fmtTri(latest)}, sem julgamento de mérito: "maior" não significa "melhor" — o sentido econômico de cada métrica está declarado nos tooltips.</div></div>
      <div class="card"><h4>Escala comparada</h4>${barras}<div class="src">Barras proporcionais ao maior valor entre as selecionadas · ◈ = referência</div></div>
    </div>
    <div class="src" style="margin-top:10px">Aprofunde nas abas: Métricas-chave, Série histórica, Dispersão e Dados completos. Custos, tecnologia e produtividade têm aba própria com o estado das fontes.</div>`;
  } else if (cmp.ctab === "custos") {
    body = `
    <div class="note"><b>Por que esta aba ainda não tem números:</b> os indicadores de custos, tecnologia e produtividade dependem de fontes que o pipeline ainda não coleta. Nada aqui será estimado ou simulado — cada bloco abaixo declara a fonte prevista e o motivo da ausência (ausência ≠ zero).</div>
    <div class="grid g2" style="margin-top:12px">
      ${(C.pendentes || []).map(pdt => `<div class="card"><h4>${pdt.grupo} <span class="seal aprox">NÃO COLETADO</span></h4>
        <div class="chips" style="margin:6px 0">${pdt.metricas.map(mm => `<span class="chip">${mm}</span>`).join("")}</div>
        <div class="src"><b>Fonte prevista:</b> ${pdt.fonte_prevista}</div>
        <div class="src" style="margin-top:4px"><b>Estado:</b> ${pdt.motivo}</div></div>`).join("")}
    </div>
    <div class="card" style="margin-top:14px"><h4>O que já é possível hoje</h4>
      <p class="src" style="max-width:900px">Com os dados coletados (IF.data Resumo, Capital e Carteiras), o comparador cobre escala, funding, capital, mix e qualidade de carteira. Quando a DRE detalhada do IF.data e os balancetes COSIF entrarem no pipeline, esta aba passa a calcular: despesas de pessoal e administrativas agrupadas, índice de eficiência, TI restrita vs TI ampliada (sempre separadas), e produtividade por funcionário e por agência — cada valor com selo reportado/contábil/derivado e nunca um "gasto total com TI" exato a partir de componentes parciais.</p></div>`;
  } else if (cmp.ctab === "resumo") {
    body = `<div class="tblwrap"><table class="data">${header}<tbody>${cmp.mets.map(m => metRow(m)).join("")}</tbody></table></div>
    <div class="src">Até 15 métricas essenciais (edite no Catálogo). Normalização ativa: <b>${NORMS.find(n => n[0] === cmp.norm)[1]}</b>. Passe o mouse no nome da métrica para fórmula, campo original e cobertura.</div>`;
  } else if (cmp.ctab === "serie") {
    const mid = cat[cmp.metric] ? cmp.metric : "carteira_credito";
    const m = cat[mid];
    const series = cmp.insts.map((c, i) => {
      const sv = datas[c].metrics[mid] || {};
      let pts = C.anomes_list.filter(a => sv[a] != null).map(a => ({ x: anomesISO(a), y: sv[a] }));
      if (cmp.norm === "base100" || (m.unit === "R$" && cmp.norm !== "abs")) {
        const b = pts[0] ? pts[0].y : null;
        if (b) pts = pts.map(p => ({ x: p.x, y: p.y / b * 100 }));
      }
      return { pts, color: CMP_PALETTE[i % CMP_PALETTE.length], label: datas[c].nome.slice(0, 20) };
    }).filter(s => s.pts.length >= 2);
    const b100 = cmp.norm === "base100" || (m.unit === "R$" && cmp.norm !== "abs");
    body = `<div class="controls"><label>métrica <select onchange="cmpSet('metric', this.value)">${cmp.mets.map(x => cat[x] ? `<option value="${x}" ${x === mid ? "selected" : ""}>${cat[x].name}</option>` : "").join("")}</select></label>
      <span class="src">${b100 ? "índice base 100 = primeiro trimestre disponível de cada IF" : m.unit}</span></div>
      <div class="legend">${series.map(s => `<span><span class="sw" style="background:${ccol(s.color)}"></span>${s.label}</span>`).join("")}</div>
      <div class="card">${series.length ? lineChart({ series, h: 260, unit: b100 ? "base 100" : m.unit, fonte: "BCB IF.data", status: m.quality_status, dec: b100 ? 1 : (m.unit === "%" ? 2 : 0) }) : "<p class='src'>menos de 2 períodos disponíveis para as instituições selecionadas</p>"}
      ${chartFooter({ fonte: C.fonte, periodo: C.anomes_list.map(fmtTri).join(" – "), atualizado: C.gerado_em.slice(0, 10), unidade: b100 ? "base 100" : m.unit, nota: m.comparability_notes })}</div>`;
  } else if (cmp.ctab === "dispersao") {
    const mx = cat[cmp.x] ? cmp.x : "npl_pct", my = cat[cmp.y] ? cmp.y : "roe_periodo";
    const msz = cmp.size && cat[cmp.size] ? cmp.size : (cmp.size === "nenhuma" ? null : "carteira_credito");
    const rMetrics = C.metric_catalog.filter(m => m.unit === "R$");
    const pairs = cmp.insts.map(c => {
      const vx = (datas[c].metrics[mx] || {})[latest], vy = (datas[c].metrics[my] || {})[latest];
      const vs = msz ? (datas[c].metrics[msz] || {})[latest] : null;
      const sr = datas[c].sr;
      return vx != null && vy != null ? { x: vx, y: vy, size: vs, label: datas[c].nome.slice(0, 22), grp: sr, color: SR_COLORS[sr] || "#64748b" } : null;
    }).filter(Boolean);
    const srsUsados = [...new Set(pairs.map(p => p.grp).filter(Boolean))].sort();
    body = `<div class="controls">
      <label>eixo X <select onchange="cmpSet('x', this.value)">${C.metric_catalog.map(m => `<option value="${m.metric_id}" ${m.metric_id === mx ? "selected" : ""}>${m.name}</option>`).join("")}</select></label>
      <label>eixo Y <select onchange="cmpSet('y', this.value)">${C.metric_catalog.map(m => `<option value="${m.metric_id}" ${m.metric_id === my ? "selected" : ""}>${m.name}</option>`).join("")}</select></label>
      <label>bolha <select onchange="cmpSet('size', this.value)"><option value="nenhuma" ${!msz ? "selected" : ""}>nenhuma</option>${rMetrics.map(m => `<option value="${m.metric_id}" ${m.metric_id === msz ? "selected" : ""}>${m.name}</option>`).join("")}</select></label></div>
      <div class="legend">${srsUsados.map(g => `<span><span class="sw" style="background:${ccol(SR_COLORS[g])};height:8px;border-radius:4px"></span>grupo ${g}</span>`).join("")}${msz ? `<span class="src">área da bolha ∝ ${cat[msz].name}</span>` : ""}</div>
      <div class="card">${(function(){
        if (pairs.length < 3) return "<p class='src'>São necessárias pelo menos 3 instituições com as duas métricas disponíveis no trimestre (ausência ≠ zero).</p>";
        const stx = (C.stats[mx] || {})[latest], sty = (C.stats[my] || {})[latest];
        return scatterPlot(pairs, cat[mx].name, cat[my].name, 640, 330,
          { sizeLabel: msz ? cat[msz].name : null, labels: pairs.length <= 10,
            refX: stx ? stx.mediana : null, refXLabel: "mediana universo", refY: sty ? sty.mediana : null, refYLabel: "mediana universo" }) +
          `<div class="src" style="margin-top:4px"><b>Quadrantes:</b> linhas tracejadas = mediana do UNIVERSO IF.data (${stx ? stx.n : "–"} / ${sty ? sty.n : "–"} instituições) — posição relativa ao mercado, não só às selecionadas.</div>`;
      })()}
      <div class="src">Cada bolha é uma instituição em ${fmtTri(latest)} · cor = grupo de pares (Sr) · passe o mouse para valores. Sugestões: crescimento × inadimplência, ROE × Basileia.</div>
      ${chartFooter({ fonte: C.fonte, periodo: fmtTri(latest), atualizado: C.gerado_em.slice(0, 10), unidade: `${cat[mx].unit} × ${cat[my].unit}`, nota: `${cat[mx].comparability_notes} | ${cat[my].comparability_notes}` })}</div>`;
  } else if (cmp.ctab === "tabela") {
    const cats = [...new Set(C.metric_catalog.map(m => m.category))];
    body = `<div class="controls" style="margin-bottom:6px">
      <input type="search" placeholder="buscar métrica… (filtra as linhas)" aria-label="buscar métrica"
        oninput="const q=this.value.toLowerCase();document.querySelectorAll('[data-cmprow]').forEach(r=>r.style.display=r.dataset.cmprow.includes(q)?'':'none')" style="min-width:260px">
      <span class="src">${C.metric_catalog.length} métricas · grupos recolhíveis · ◈ = referência · células com "vs ref" e percentil no tooltip</span>
    </div>` + cats.map(cg => `<details open><summary style="cursor:pointer"><h3 style="display:inline;text-transform:capitalize">${cg}</h3> <span class="src">(${C.metric_catalog.filter(m => m.category === cg).length})</span></summary>
      <div class="tblwrap"><table class="data">${header}<tbody>${C.metric_catalog.filter(m => m.category === cg).map(m => `<tr style="display:contents"></tr>`.slice(0,0) + metRow(m.metric_id).replace("<tr>", `<tr data-cmprow="${attr((m.name + " " + m.metric_id).toLowerCase())}">`)).join("")}</tbody></table></div></details>`).join("");
    body += `<div class="src">Primeira coluna e cabeçalhos fixos ao rolar; "não disponível" nunca é zero; mediana da última coluna segue o grupo de referência selecionado (${gdef.label}).</div>`;
  } else if (cmp.ctab === "posicoes") {
    const mid = cat[cmp.metric] ? cmp.metric : "carteira_credito";
    const m = cat[mid];
    const periods = C.anomes_list;
    const ranksByPeriod = periods.map(a => {
      const vals = cmp.insts.map(c => ({ c, v: (datas[c].metrics[mid] || {})[a] }));
      const sorted = vals.filter(x => x.v != null).sort((x, y) => y.v - x.v);
      const rk = {}; sorted.forEach((x, i) => rk[x.c] = i + 1);
      return { rk, vals: Object.fromEntries(vals.map(x => [x.c, x.v])) };
    });
    const items = cmp.insts.map((c, i) => ({
      label: datas[c].nome.slice(0, 24), color: CMP_PALETTE[i % CMP_PALETTE.length],
      ranks: periods.map((a, j) => ranksByPeriod[j].rk[c] ?? null),
      vals: periods.map((a, j) => { const v = ranksByPeriod[j].vals[c]; return v == null ? "–" : cmpFmtVal(m, v); }),
    }));
    body = `<div class="controls"><label>métrica <select onchange="cmpSet('metric', this.value)">${C.metric_catalog.map(x => `<option value="${x.metric_id}" ${x.metric_id === mid ? "selected" : ""}>${x.name}</option>`).join("")}</select></label>
      <span class="src">posição por VALOR da métrica entre as ${cmp.insts.length} selecionadas (#1 = maior) — não é julgamento de risco</span></div>
      <div class="card">${bumpChart(items, periods.map(fmtTri))}
      ${chartFooter({ fonte: C.fonte, periodo: periods.map(fmtTri).join(" – "), atualizado: C.gerado_em.slice(0, 10), unidade: m.unit, nota: m.comparability_notes })}</div>`;
  } else if (cmp.ctab === "watchlist") {
    const wlInstOpts = [...new Set(cmp.insts.concat(watchRules().map(r => r.cod)))];
    body = `
    <div class="grid g2">
      <div class="card"><h4>Comparações salvas</h4>
        <button class="btn small" onclick="wlSaveCmp()">salvar comparação atual</button>
        <div style="margin-top:10px">${savedCmps().map((c, i) => `<div class="shortcut"><b class="clickable" onclick="wlLoadCmp(${i})">${c.nome}</b> <span class="src">${c.cmp.insts.length} IFs · ${c.criada_em}</span> <button class="btn ghost small" style="float:right" onclick="wlDelCmp(${i})">excluir</button></div>`).join("") || "<p class='src'>nenhuma comparação salva.</p>"}</div></div>
      <div class="card"><h4>Nova regra de monitoramento</h4>
        <div class="controls" style="flex-direction:column;align-items:stretch;gap:8px">
          <select id="wlInst" aria-label="instituição">${wlInstOpts.map(c => `<option value="${c}">${(state.cmpCache[c] && state.cmpCache[c].nome) || c}</option>`).join("")}</select>
          <select id="wlMet" aria-label="métrica">${C.metric_catalog.map(m => `<option value="${m.metric_id}">${m.name}</option>`).join("")}</select>
          <div style="display:flex;gap:8px"><select id="wlTipo"><option value="valor">valor atual</option><option value="d4t">variação 4 trim.</option></select>
          <select id="wlOp"><option value=">">maior que</option><option value="<">menor que</option></select>
          <input type="text" id="wlLim" placeholder="limiar (ex.: 0,5 → use ponto: 0.5)" style="width:150px"></div>
          <button class="btn small" onclick="wlAddRule()">adicionar regra</button>
        </div>
        <p class="src">Exemplos: inadimplência Δ4T &gt; 0.5 p.p.; Basileia valor &lt; 11; carteira Δ4T &gt; 20%.</p></div>
    </div>
    <h3>Estado das regras</h3>
    <div id="wlStatus"></div>
    <div class="note">Avaliação <b>local, ao abrir este painel</b>, sobre a última data-base disponível (${fmtTri(latest)}). Não há envio de e-mail/notificações — o feed RSS de alertas macro continua disponível na aba Alertas. Regras e comparações ficam salvas apenas neste navegador (localStorage).</div>`;
    setTimeout(() => wlRender(C, cat), 0);
  } else { // catálogo
    body = `<p class="viewdesc">Catálogo pesquisável de métricas — marque para incluir no Resumo/Série/exportação. Cada métrica traz fonte, campo original, fórmula, cobertura, período e restrições de comparação.</p>
      <div class="controls"><input type="search" placeholder="pesquisar métrica… (ex.: inadimplência, ROE, Basileia)" oninput="document.querySelectorAll('[data-mrow]').forEach(r=>r.style.display = r.dataset.mrow.includes(this.value.toLowerCase())?'':'none')" aria-label="pesquisar métrica"></div>
      ${[...new Set(C.metric_catalog.map(m => m.category))].map(cg => `<h3 style="text-transform:capitalize">${cg}</h3>` +
        C.metric_catalog.filter(m => m.category === cg).map(m => `
        <div class="shortcut" data-mrow="${attr((m.name + " " + m.metric_id + " " + m.comparability_notes).toLowerCase())}">
          <label style="display:flex;gap:10px;align-items:baseline"><input type="checkbox" ${cmp.mets.includes(m.metric_id) ? "checked" : ""} onchange="cmpToggleMet('${m.metric_id}', this.checked)">
          <span><b>${m.name}</b> <span class="qbadge ${m.coverage_count > 700 ? "q-high" : m.coverage_count > 300 ? "q-mid" : "q-low"}">${m.coverage_count} IFs</span> <span class="seal ${m.quality_status.includes("calculado") ? "calc" : "obs"}">${m.quality_status}</span>
          <div class="src">${m.comparability_notes} · fórmula: ${m.formula} · campo: ${m.original_field} · ${fmtTri(m.first_reference)}–${fmtTri(m.last_reference)} · normalizações: ${m.supported_normalizations.join(", ")}</div></span></label>
        </div>`).join("")).join("")}`;
  }

  el.innerHTML = `
  <div class="pagehead"><div class="ph-left">
    <h2>Comparador de Instituições</h2>
    <div class="ph-meta">data-base <b>${fmtTri(latest)}</b> · nível: <b>${nivel}</b> · <b>${cmp.insts.length}</b> instituições · grupo de referência: <b>${gdef.label}</b>${gdef.n ? ` (${gdef.n})` : ""} · referência: <b>${datas[refCod] ? datas[refCod].nome.slice(0, 24) : "–"}</b> · <a href="javascript:void(0)" onclick="nav('method')">metodologia e fontes</a></div>
  </div></div>
  <details ${cmp.insts.length < 2 ? "open" : ""} style="margin-bottom:10px"><summary class="src" style="cursor:pointer">alterar seleção de instituições (${cmp.insts.length})</summary>${selHtml}</details>
  ${ctx}${body}`;
}

(async function init() {
  await loadAll();
  const m = state.data.meta;
  if (m) {
    document.getElementById("brandName").textContent = m.plataforma.name;
    document.title = m.plataforma.name;
    document.getElementById("updatedAt").textContent = "pipeline: " + (m.gerado_em || "").slice(0, 16).replace("T", " ") + " UTC";
    document.getElementById("footDisclaimer").textContent = m.plataforma.disclaimer;
  }
  updateAlertBadge();
  const v = parseHash();
  showView(RENDER[v] ? v : "overview");
})();
