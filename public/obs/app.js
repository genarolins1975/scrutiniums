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

const ROUTES = { overview: "/overview", pulse: "/credit",
  sectors: "/sectors", rj: "/recoveries", institutions: "/institutions", inst: "/institutions/",
  sector: "/sectors/", openfinance: "/open-finance", scenarios: "/scenarios", alerts: "/alerts",
  research: "/research", method: "/methodology", regulacao: "/regulacao",
  products: "/products", product: "/products/", compare: "/compare", market: "/market", leading: "/leading-signals",
  trends: "/search-trends", panorama: "/credit-panorama", bets: "/bets-financial-risk", fraudes: "/financial-fraud", juros: "/interest-rates", sugestoes: "/suggestions", pix: "/pix", sobre: "/about", judicial: "/lawsuits", pgfn: "/federal-tax-debt", desenrola: "/desenrola", penetracao: "/credit-penetration", moradia: "/housing-credit", consignado: "/payroll-lending-aging", operacional: "/operational-indicators", presmun: "/presenca/" };
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

// Rotas aposentadas que continuam válidas: /leading-indicators era a página
// "Ciclo & Antecedentes", hoje a aba "Protocolo & regimes" do radar.
const ROTAS_APOSENTADAS = { "/leading-indicators": { view: "leading", tab: "protocolo" } };
function currentView() {
  if (PATH_MODE) {
    const p = appPath();
    if (ROTAS_APOSENTADAS[p]) return ROTAS_APOSENTADAS[p].view;
    if (p.startsWith("/institutions/") && p.length > 14) return "inst";
    if (p.startsWith("/products/") && p.length > 10) return "product";
    if (p.startsWith("/sectors/") && p.length > 9) return "sector";
    if (p.startsWith("/presenca/") && p.length > 10) return "presmun";
    const hit = Object.entries(ROUTES).find(([v, r]) => r === p);
    if (hit) return hit[0];
  }
  const h = location.hash.replace("#", "");
  const nome = h.split("?")[0];
  if (ROTAS_APOSENTADAS["/" + nome]) return ROTAS_APOSENTADAS["/" + nome].view;
  return nome || "overview";
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
    if (view === "presmun" && f.presCod) qs.set("cod", f.presCod);
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
    if (v === "presmun" && state.filters.presCod) path = "/presenca/" + state.filters.presCod;
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
    if (qs.get("cod") && currentView() === "presmun") state.filters.presCod = qs.get("cod");
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
  // a rota aposentada pode chegar pelo caminho (produção) ou pelo hash (uso local)
  const nomeHash = location.hash.replace("#", "").split("?")[0];
  const aposentada = ROTAS_APOSENTADAS[appPath()] || (nomeHash ? ROTAS_APOSENTADAS["/" + nomeHash] : null);
  if (aposentada) state.lead.tab = aposentada.tab;
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
    if (p.startsWith("/presenca/") && p.length > 10) state.filters.presCod = p.slice(10).replace(/\/$/, "");
  }
  return currentView();
}
window.addEventListener("popstate", () => { const v = parseHash(); if (RENDER[v]) showViewSilent(v); });

const fmt = {
  n: (v, d = 2) => v == null ? "–" : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }),
  n0: v => v == null ? "–" : Math.round(v).toLocaleString("pt-BR"),
  bi: v => v == null ? "–" : (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " bi",
  triFromMi: v => v == null ? "–" : (v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " tri",
  money: v => v == null ? "–" : v >= 1e12 ? "R$ " + fmt.n(v / 1e12, 2) + " tri"
    : v >= 1e9 ? "R$ " + fmt.n(v / 1e9, 1) + " bi"
    : v >= 1e6 ? "R$ " + fmt.n(v / 1e6, 1) + " mi"
    : "R$ " + fmt.n0(v),
  d: iso => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "–",
  my: iso => iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "–",
  pp: v => v == null ? "–" : (v > 0 ? "+" : "") + fmt.n(v, 2),
};

/* escape único para valores interpolados em ATRIBUTOS HTML (aria-label, title, alt, data-*):
   remove tags (rótulos com badges/chips viram texto puro) e escapa aspas duplas.
   Mesma família da correção do mcard — nunca altera o conteúdo visível, só o atributo. */
const attr = s => String(s == null ? "" : s).replace(/<[^>]*>/g, "").replace(/"/g, "&quot;").replace(/\s+/g, " ").trim();

const APP_VERSION = "0.69.0"; // sincronizada com o cache-buster dos assets no index.html

// núcleo mínimo na abertura: só o que a Visão geral padrão e o chrome (título,
// badge de alertas, rodapé) precisam; todo o resto carrega sob demanda por
// página (VIEW_DATA) ou por bloco habilitado da Visão geral (OV_BLOCO_DATA).
const CORE_FILES = ["meta", "pulse", "ibcc", "overview", "alerts", "alertas_central"];
const VIEW_DATA = {
  pulse: ["regimes"],
  sectors: ["exposures", "sectors"], sector: ["exposures", "sectors"],
  rj: ["rj"],
  institutions: ["institutions", "inst_index", "npl", "guidance", "regimes"], inst: ["inst_pages", "institutions", "inst_index", "npl", "operacional", "pilar3", "guidance", "regimes", "folha_bancos"],
  method: ["method", "lineage", "quality"],
  compare: ["compare", "inst_index", "operacional"],
  research: ["institutions", "inst_index", "antecedentes", "regimes"],
  market: ["market"],
  leading: ["leading", "antecedentes", "regimes"],
  trends: ["trends"],
  panorama: ["panorama"],
  pix: ["pix", "regulacao"],
  judicial: ["judicial"],
  pgfn: ["pgfn"],
  desenrola: ["desenrola", "pulse", "regulacao"],
  penetracao: ["penetracao", "penetracao_mun", "penetracao_malha"],
  moradia: ["moradia", "moradia_mun", "penetracao_malha"],
  consignado: ["consignado", "consignado_mun", "penetracao_malha", "regulacao"],
  openfinance: ["openfinance"],
  scenarios: ["scenario"],
  alerts: ["sectors", "scenario", "quality"],
  products: ["products"], product: ["products"],
  bets: ["bets", "epae"],
  fraudes: ["fraudes"],
  juros: ["juros"],
  operacional: ["operacional", "presenca_mun", "penetracao_malha", "folha_bancos"],
  presmun: ["presenca_mun"],
  regulacao: ["regulacao"],
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

/* Marcos regulatórios transversais (gold regulacao.json) como marcadores
   verticais nos gráficos de um painel. O lineChart ignora marcos fora do
   alcance da série (guarda allX) — passar sempre é seguro. Coincidência no
   tempo não é efeito: o marcador existe para permitir a inspeção, nunca
   para atribuir variação à norma. */
function marcosRegulatorios(painel) {
  const R = state.data.regulacao;
  if (!R || !R.disponivel) return [];
  return (R.marcos || [])
    .filter(m => m.serie_x && (m.paineis || []).includes(painel))
    .map(m => ({ x: m.serie_x, label: m.ato.replace(/\s*\(.*?\)/, "").replace(/^(Resolução|Resoluções)/, "Res.").slice(0, 24) }));
}

/* ================= CONCEITOS DIDÁTICOS =================
   Todo conceito importante do painel vira um termo CLICÁVEL que abre uma
   explicação em camadas: a intuição primeiro, o cálculo depois, um pouco de
   história, a regulação sem juridiquês e as armadilhas de leitura — com
   infográfico quando um desenho explica melhor que um parágrafo.
   termo(slug, rotulo) é o ponto de entrada; abrirConceito(slug) o modal. */

/* infográficos: SVGs mínimos, tematizados pelas mesmas variáveis dos gráficos */
const IG = {
  basileia: () => `<svg viewBox="0 0 340 150" class="cdlg-ig" role="img" aria-label="capital como colchão sobre os ativos ponderados pelo risco">
    <rect x="20" y="90" width="190" height="40" fill="var(--c-line1,#1d4e89)" opacity=".25" rx="4"/>
    <text x="115" y="114" text-anchor="middle" font-size="11" fill="var(--ink,#333)">ativos ponderados pelo risco (RWA)</text>
    <rect x="20" y="58" width="190" height="26" fill="var(--c-line2,#0e7c7b)" opacity=".8" rx="4"/>
    <text x="115" y="75" text-anchor="middle" font-size="11" fill="#fff">capital próprio (PR)</text>
    <path d="M225 71 h30" stroke="var(--ink,#333)" stroke-dasharray="3,3"/>
    <text x="262" y="66" font-size="11" fill="var(--ink,#333)">Basileia =</text>
    <text x="262" y="80" font-size="11" fill="var(--ink,#333)">capital ÷ RWA</text>
    <text x="20" y="24" font-size="12" font-weight="bold" fill="var(--ink,#333)">quanto do risco é bancado com dinheiro próprio?</text>
    <text x="20" y="40" font-size="10.5" fill="var(--ink-soft,#666)">mínimo regulatório: 8% + colchões (ACP) por cima</text></svg>`,
  lcr: () => `<svg viewBox="0 0 340 150" class="cdlg-ig" role="img" aria-label="caixa de alta qualidade contra trinta dias de saídas em estresse">
    <rect x="20" y="45" width="120" height="80" fill="var(--c-line2,#0e7c7b)" opacity=".8" rx="6"/>
    <text x="80" y="80" text-anchor="middle" font-size="11" fill="#fff">ativos líquidos</text>
    <text x="80" y="95" text-anchor="middle" font-size="11" fill="#fff">de alta qualidade</text>
    <rect x="200" y="70" width="120" height="55" fill="var(--c-line3,#b45309)" opacity=".55" rx="6"/>
    <text x="260" y="94" text-anchor="middle" font-size="11" fill="var(--ink,#333)">saídas líquidas em</text>
    <text x="260" y="108" text-anchor="middle" font-size="11" fill="var(--ink,#333)">30 dias de estresse</text>
    <path d="M148 85 h44" stroke="var(--ink,#333)" marker-end="url(#seta)"/>
    <text x="170" y="78" text-anchor="middle" font-size="12" fill="var(--ink,#333)">≥</text>
    <text x="20" y="24" font-size="12" font-weight="bold" fill="var(--ink,#333)">o caixa aguenta um mês de pânico?</text>
    <text x="20" y="139" font-size="10.5" fill="var(--ink-soft,#666)">LCR 100% = aguenta exatamente; 200% = aguenta dois meses</text></svg>`,
  aging: () => `<svg viewBox="0 0 340 130" class="cdlg-ig" role="img" aria-label="linha do tempo do atraso de uma parcela">
    <line x1="25" y1="70" x2="320" y2="70" stroke="var(--c-grid,#ccc)" stroke-width="2"/>
    ${[[25, "dia 0", "vencimento"], [115, "15 dias", "vira ATRASO"], [230, "90 dias", "vira INADIMPLÊNCIA"]].map(([x, t, s]) => `
      <circle cx="${x}" cy="70" r="5" fill="var(--c-line1,#1d4e89)"/>
      <text x="${x}" y="55" text-anchor="middle" font-size="11" font-weight="bold" fill="var(--ink,#333)">${t}</text>
      <text x="${x}" y="92" text-anchor="middle" font-size="10" fill="var(--ink-soft,#666)">${s}</text>`).join("")}
    <text x="20" y="24" font-size="12" font-weight="bold" fill="var(--ink,#333)">os dois relógios do não-pagamento</text>
    <text x="20" y="118" font-size="10.5" fill="var(--ink-soft,#666)">atraso ≥15d = sinal cedo e sensível · ≥90d = padrão internacional de inadimplência</text></svg>`,
  acp: () => `<svg viewBox="0 0 340 160" class="cdlg-ig" role="img" aria-label="pilha de colchões de capital sobre o mínimo">
    ${[[118, 26, "var(--c-line1,#1d4e89)", "mínimo de capital (8%)"], [88, 26, "var(--c-line2,#0e7c7b)", "colchão de conservação"],
       [66, 18, "#6b46a3", "colchão contracíclico"], [44, 18, "#b45309", "colchão sistêmico (só os grandes)"]].map(([y, h, c, t]) => `
      <rect x="30" y="${y}" width="130" height="${h}" fill="${c}" opacity=".8" rx="3"/>
      <text x="172" y="${Number(y) + Number(h) / 2 + 4}" font-size="10.5" fill="var(--ink,#333)">${t}</text>`).join("")}
    <path d="M30 150 h130" stroke="var(--ink,#333)"/>
    <text x="95" y="158" text-anchor="middle" font-size="9.5" fill="var(--ink-soft,#666)">quanto mais alto, mais protegido</text>
    <text x="20" y="18" font-size="12" font-weight="bold" fill="var(--ink,#333)">capital mínimo + colchões (ACP)</text></svg>`,
  eficiencia: () => `<svg viewBox="0 0 340 140" class="cdlg-ig" role="img" aria-label="despesas comparadas às receitas">
    <rect x="30" y="40" width="200" height="30" fill="var(--c-line2,#0e7c7b)" opacity=".8" rx="4"/>
    <text x="130" y="59" text-anchor="middle" font-size="11" fill="#fff">receitas (intermediação + serviços)</text>
    <rect x="30" y="85" width="110" height="30" fill="var(--c-line3,#b45309)" opacity=".7" rx="4"/>
    <text x="85" y="104" text-anchor="middle" font-size="11" fill="#fff">despesas</text>
    <text x="250" y="104" font-size="11" fill="var(--ink,#333)">eficiência = 55%</text>
    <text x="20" y="24" font-size="12" font-weight="bold" fill="var(--ink,#333)">de cada R$ 1 de receita, quanto vai embora em despesa?</text>
    <text x="30" y="132" font-size="10.5" fill="var(--ink-soft,#666)">QUANTO MENOR, MELHOR — 55% é sólido; acima de 100% a operação não se paga</text></svg>`,
  spread: () => `<svg viewBox="0 0 340 150" class="cdlg-ig" role="img" aria-label="do custo de captar à taxa cobrada">
    <rect x="30" y="95" width="280" height="24" fill="var(--c-line1,#1d4e89)" opacity=".35" rx="4"/>
    <text x="170" y="111" text-anchor="middle" font-size="11" fill="var(--ink,#333)">custo de captar o dinheiro</text>
    <rect x="30" y="62" width="280" height="28" fill="var(--c-line3,#b45309)" opacity=".55" rx="4"/>
    <text x="170" y="80" text-anchor="middle" font-size="11" fill="var(--ink,#333)">SPREAD: inadimplência esperada + impostos + custos + margem</text>
    <path d="M30 50 h280" stroke="var(--ink,#333)" stroke-dasharray="4,3"/>
    <text x="170" y="42" text-anchor="middle" font-size="11" font-weight="bold" fill="var(--ink,#333)">taxa cobrada do cliente</text>
    <text x="20" y="20" font-size="12" font-weight="bold" fill="var(--ink,#333)">a taxa é o custo do dinheiro + o spread</text>
    <text x="30" y="140" font-size="10.5" fill="var(--ink-soft,#666)">no Brasil, a inadimplência esperada é o maior pedaço do spread</text></svg>`,
};

const CONCEITOS = {
  "roe": {
    nome: "ROE — retorno sobre o patrimônio",
    resumo: "Quanto o banco lucra por ano para cada real que os donos deixaram dentro dele.",
    intuicao: "Pense numa padaria que os sócios montaram com R$ 100 mil do próprio bolso. Se ela lucra R$ 15 mil no ano, o ROE é 15%: é a 'taxa de juros' que o negócio paga aos donos. Para bancos a conta é igual — lucro líquido dividido pelo patrimônio líquido. É o número que responde 'valeu mais a pena ser dono do banco ou ter deixado o dinheiro aplicado?'.",
    calculo: "ROE = lucro líquido ÷ patrimônio líquido. No painel, o ROE vem do IF.data e é o ACUMULADO do período reportado (não anualizado) — por isso um ROE de 1º trimestre parece 'baixo' comparado a um anual: são réguas diferentes, e a ficha diz qual está em uso.",
    historia: "A obsessão dos bancos brasileiros com ROE alto vem dos anos de inflação alta, quando o ganho vinha do float (dinheiro parado se desvalorizando na mão do cliente). Com o Plano Real (1994), o float sumiu e o lucro passou a vir de crédito e serviço — e o ROE virou A régua de comparação entre bancos, com os grandes brasileiros historicamente entre os mais rentáveis do mundo.",
    regulacao: "O ROE em si não é regulado — nenhuma norma manda lucrar. Mas ele conversa com a regulação de capital: quanto mais capital o regulador exige (denominador maior), mais difícil sustentar o mesmo ROE. É o cabo de guerra permanente entre segurança (mais capital) e rentabilidade (menos).",
    armadilhas: "ROE alto pode significar eficiência — ou pouco capital e muito risco. Dois bancos com o mesmo lucro têm ROEs muito diferentes se um opera mais alavancado. Por isso o painel mostra ROE JUNTO de Basileia e alavancagem, nunca sozinho. E cuidado com períodos: acumulado de trimestre não se compara com ano fechado.",
    veja: ["indice-de-basileia", "alavancagem", "indice-de-eficiencia"],
  },
  "indice-de-basileia": {
    nome: "Índice de Basileia",
    resumo: "O colchão de capital próprio do banco, medido contra o risco que ele carrega.",
    intuicao: "Um banco empresta dinheiro que, na maior parte, não é dele — é dos depositantes. O Índice de Basileia pergunta: se uma fatia dos empréstimos der errado, quanto de perda o banco aguenta com dinheiro PRÓPRIO antes de encostar no dinheiro dos clientes? É o airbag do sistema. 15% significa: para cada R$ 100 de exposição ponderada pelo risco, há R$ 15 de capital próprio na frente.",
    infografico: "basileia",
    calculo: "Basileia = Patrimônio de Referência ÷ RWA (ativos ponderados pelo risco). O RWA pesa cada ativo pelo risco: título do Tesouro pondera perto de zero; crédito sem garantia pondera cheio. O mínimo é 8%, mas com os colchões adicionais (ACP) a exigência real dos grandes passa de 11,5% — e o mercado espera folga acima disso.",
    historia: "Em 1974, a quebra do banco alemão Herstatt pegou o mundo sem regra comum e criou o Comitê de Basileia (na cidade suíça). O primeiro acordo (Basileia I, 1988) fixou os 8% — um número negociado, não uma lei da física. Basileia II (2004) sofisticou a medição de risco; a crise de 2008 mostrou que capital de má qualidade não segura crise, e Basileia III (2010) endureceu a definição de capital e criou os colchões. O Brasil adota o arcabouço integralmente — e costuma ser mais conservador que o mínimo internacional.",
    regulacao: "No Brasil: mínimo de 8% de Basileia total, com pelo menos 4,5% em Capital Principal (o capital 'de verdade': ações e lucros retidos), mais os colchões ACP por cima (conservação 2,5%, contracíclico e sistêmico para os grandes). Quem fura os colchões não quebra — mas fica proibido de distribuir dividendos e bônus até recompor. Quem fura o mínimo entra no radar duro do BCB. Os marcos estão na aba Regulação.",
    armadilhas: "Basileia alta não é atestado de saúde completo: mede solvência, não liquidez (um banco pode ter capital de sobra e quebrar por corrida — por isso existem LCR e NSFR). E comparar Basileia entre bancos de portes muito diferentes ignora que a exigência TAMBÉM difere (colchão sistêmico só para os grandes).",
    veja: ["capital-principal", "rwa", "acp", "lcr", "alavancagem"],
  },
  "capital-principal": {
    nome: "Capital Principal (CET1) e os níveis de capital",
    resumo: "A parte mais dura do capital do banco: ações e lucros retidos — o que absorve perda sem drama.",
    intuicao: "Nem todo 'capital' é igual. O Capital Principal é o dinheiro que os acionistas colocaram e os lucros que ficaram no banco — se houver perda, ele a absorve automaticamente, sem tribunal e sem pânico. Acima dele vêm camadas mais 'moles' (dívidas que viram capital em crise). É a diferença entre ter poupança própria e contar com um empréstimo do primo em emergência.",
    calculo: "Três camadas: Capital Principal (CET1: ações + lucros retidos, mínimo 4,5% do RWA), Nível 1 (CET1 + instrumentos perpétuos que absorvem perda, mínimo 6%) e Patrimônio de Referência total (tudo + dívidas subordinadas, mínimo 8%). O painel mostra as três na ficha de cada IF (Pilar 3).",
    historia: "Antes de 2008, bancos contavam como 'capital' instrumentos que, na hora H, não absorveram perda nenhuma — e os contribuintes pagaram os resgates. Basileia III nasceu dessa lição: a régua passou a ser o CET1, e os instrumentos híbridos só contam se tiverem cláusula de virar ação (ou pó) quando o banco afunda.",
    regulacao: "No Brasil, as definições vêm das resoluções de capital do CMN/BCB (hoje Res. CMN 4.955 e BCB 199). O detalhe que importa: dividendos e bônus são bloqueados progressivamente quando o CET1 invade os colchões — a regulação prefere segurar o dinheiro dentro do banco a deixar a base de capital sangrar.",
    armadilhas: "Olhar só a Basileia total esconde a qualidade: dois bancos com 15% podem ter 13% × 9% de CET1 — o primeiro é muito mais sólido. A margem sobre o requerido com colchões (mostrada no painel) é a folga que realmente importa.",
    veja: ["indice-de-basileia", "acp", "rwa"],
  },
  "rwa": {
    nome: "RWA — ativos ponderados pelo risco",
    resumo: "O tamanho do risco do banco: cada ativo conta proporcionalmente ao perigo que oferece.",
    intuicao: "Somar tudo que o banco tem trata um título do Tesouro e um empréstimo sem garantia como iguais — e não são. O RWA corrige isso: multiplica cada ativo por um peso de risco. R$ 100 em Tesouro ≈ R$ 0 de RWA; R$ 100 em cartão rotativo ≈ R$ 100 ou mais. É o denominador da Basileia: o capital é medido contra o risco, não contra o tamanho.",
    calculo: "RWA = Σ (exposição × fator de ponderação). Os fatores vêm de tabela regulatória (abordagem padronizada) ou de modelos internos aprovados pelo BCB nos maiores bancos. Inclui risco de crédito, de mercado e operacional.",
    historia: "A ponderação por risco é a grande ideia de Basileia I (1988). Basileia II deixou os grandes usarem modelos próprios — e 2008 mostrou o risco disso: modelos otimistas geravam RWA magro e capital insuficiente. Basileia III trouxe pisos (output floors) para limitar o quanto o modelo interno pode 'emagrecer' o risco.",
    regulacao: "No Brasil o RWA segue a Res. BCB 229 e correlatas. A razão de alavancagem existe como trava de segurança justamente porque o RWA depende de modelo: ela mede capital contra exposição TOTAL, sem ponderação — se o modelo estiver errado, a alavancagem denuncia.",
    armadilhas: "RWA baixo pode significar carteira conservadora — ou modelo agressivo. Comparar RWA÷ativos entre bancos dá uma pista do apetite de risco, mas a mistura de abordagens (padronizada × modelo interno) contamina a comparação.",
    veja: ["indice-de-basileia", "alavancagem", "capital-principal"],
  },
  "acp": {
    nome: "ACP — os colchões de capital",
    resumo: "Camadas extras de capital ACIMA do mínimo, para gastar na crise sem quebrar a regra.",
    intuicao: "Se o mínimo fosse a única regra, todo banco operaria colado nele — e a primeira turbulência jogaria todos abaixo da linha ao mesmo tempo, com o sistema inteiro cortando crédito junto. Os colchões resolvem isso: são capital que o banco DEVE ter em tempos bons e PODE consumir em tempos ruins, pagando o preço de não distribuir dividendos enquanto estiver dentro deles.",
    infografico: "acp",
    calculo: "Três adicionais sobre o Capital Principal: conservação (2,5% do RWA, todos), contracíclico (0 a 2,5%, ligado pelo BCB quando o crédito esquenta) e sistêmico (1 a 2%, só para os bancos cuja queda arrastaria o sistema). O painel mostra o ACP requerido e a MARGEM que cada banco tem sobre ele.",
    historia: "É a resposta direta de Basileia III à pró-ciclicidade exposta em 2008: os bancos tinham capital 'suficiente' no papel, mas nenhum espaço para absorver perda sem violar mínimos — então todos encolheram o crédito simultaneamente e aprofundaram a recessão. O colchão contracíclico institucionaliza o 'guardar na fartura para gastar na seca'.",
    regulacao: "Res. BCB 199 e decisões periódicas do Comef (Comitê de Estabilidade Financeira do BCB) para o contracíclico brasileiro. Furar colchão não é ilegal — é caro: trava dividendos, recompras e bônus em escala progressiva.",
    armadilhas: "A margem sobre o requerido é o número operacional: um banco com Basileia de 12% e exigência total de 11,5% tem folga de 0,5 p.p. — bem mais apertado do que os '12%' sugerem sozinhos.",
    veja: ["indice-de-basileia", "capital-principal"],
  },
  "alavancagem": {
    nome: "Razão de Alavancagem",
    resumo: "Capital contra exposição TOTAL, sem ponderação — a trava de segurança dos modelos.",
    intuicao: "A Basileia confia nos pesos de risco; a alavancagem desconfia deles. Ela pergunta o mais bruto possível: capital de Nível 1 dividido por TUDO a que o banco está exposto, sem nenhum desconto por 'ser seguro'. Se os modelos de risco estiverem errados (já estiveram), essa régua simples ainda segura.",
    calculo: "RA = Nível 1 ÷ exposição total (ativos + derivativos + compromissos fora do balanço). Mínimo brasileiro: 3%. Um RA de 6,8% quer dizer que o banco pode operar com exposição ~15× o capital.",
    historia: "Bancos europeus chegaram a 2008 com Basileia confortável e alavancagem real de 40-50× — os pesos de risco escondiam a montanha. Basileia III trouxe a razão de alavancagem como 'backstop': deliberadamente burra, para ser difícil de driblar.",
    regulacao: "No Brasil, Res. BCB 200 e correlatas; divulgação trimestral no Pilar 3 (é de lá que o painel lê).",
    armadilhas: "Alavancagem alta ≠ imprudência automática: bancos concentrados em ativos de baixo risco (tesourarias) vivem bem com RA menor. Ela funciona como PAR da Basileia — as duas juntas contam a história.",
    veja: ["indice-de-basileia", "rwa", "pilar-3"],
  },
  "lcr": {
    nome: "LCR — liquidez de curto prazo",
    resumo: "O caixa de alta qualidade dá para aguentar 30 dias de estresse de saques?",
    intuicao: "Solvência e liquidez quebram bancos por portas diferentes. Um banco pode ter capital de sobra e morrer em uma semana se todo mundo sacar ao mesmo tempo — foi assim com bancos saudáveis-no-papel em 2008. O LCR simula exatamente isso: um mês de pânico calibrado (depósitos fugindo, linhas secando) e pergunta se os ativos que viram dinheiro RÁPIDO e SEM DESÁGIO cobrem a sangria.",
    infografico: "lcr",
    calculo: "LCR = ativos líquidos de alta qualidade (HQLA: caixa, reservas no BC, títulos públicos) ÷ saídas líquidas estimadas em 30 dias de estresse padronizado. Mínimo: 100%. Os grandes brasileiros rodam entre 150% e 220% — aguentariam de um mês e meio a dois meses do cenário.",
    historia: "Northern Rock (2007) teve a primeira corrida bancária clássica do Reino Unido em 140 anos — era solvente pela régua da época e evaporou por liquidez. Basileia III criou as duas métricas de liquidez que faltavam: LCR (curto prazo) e NSFR (estrutural). Antes de 2008, NENHUMA regra internacional media liquidez.",
    regulacao: "No Brasil desde 2015 (Res. CMN 4.401), obrigatório para os maiores (S1/S2) — por isso instituição sem LCR publicado no painel não está 'descumprindo': pode simplesmente não ser obrigada a divulgar. Publicação trimestral no Pilar 3.",
    armadilhas: "O cenário de estresse é PADRONIZADO — uma crise real pode ser pior (ou diferente). E LCR altíssimo também tem custo: caixa parado rende pouco; o equilíbrio é a arte.",
    veja: ["nsfr", "indice-de-basileia", "pilar-3"],
  },
  "nsfr": {
    nome: "NSFR — liquidez estrutural",
    resumo: "O funding do banco tem o prazo do que ele financia — ou está tudo apoiado em dinheiro que pode sumir?",
    intuicao: "Financiar um crédito imobiliário de 30 anos com depósito que sai amanhã é andar de bicicleta na corda bamba: funciona até o vento mudar. O NSFR mede esse descasamento estrutural: quanto do balanço de longo prazo está sustentado por funding ESTÁVEL (capital, depósitos de varejo pegajosos, dívida longa).",
    calculo: "NSFR = funding estável disponível ÷ funding estável requerido pelos ativos, num horizonte de 1 ano. Cada fonte de dinheiro ganha um fator de estabilidade (capital = 100%; depósito de varejo ≈ 90-95%; dinheiro de atacado overnight ≈ 0%) e cada ativo, uma exigência. Mínimo: 100%.",
    historia: "É o irmão de 1 ano do LCR, do mesmo pacote pós-2008. O caso-símbolo é o Lehman: rolava centenas de bilhões TODA NOITE no mercado de repo — quando o mercado desconfiou, o funding sumiu em dias. O NSFR existe para punir esse modelo antes da crise, não depois.",
    regulacao: "No Brasil desde 2018 (Res. CMN 4.616), para os maiores (S1/S2), com divulgação trimestral no Pilar 3 — que é de onde o painel lê.",
    armadilhas: "NSFR compara mal entre modelos de negócio muito diferentes (banco de varejo × tesouraria). E os fatores de estabilidade são convenções regulatórias — 'depósito estável' é uma aposta estatística, como os saques via Pix em minutos vieram lembrar.",
    veja: ["lcr", "custo-de-captacao", "pilar-3"],
  },
  "inadimplencia-90": {
    nome: "Inadimplência (>90 dias)",
    resumo: "A fatia da carteira com parcelas atrasadas há mais de 90 dias — a régua clássica do calote.",
    intuicao: "Nem todo atraso é calote: gente esquece boleto, escorrega um mês e paga. A convenção mundial diz que 90 dias é o ponto em que o atraso deixa de ser acidente e vira problema — estatisticamente, a maior parte do que passa dessa linha não volta. Inadimplência de 3,2% = de cada R$ 100 emprestados, R$ 3,20 estão nessa zona.",
    infografico: "aging",
    calculo: "Carteira com atraso superior a 90 dias ÷ carteira ativa total. O painel usa o IF.data (relatório por instrumentos financeiros, estrutura vigente desde 2025) por instituição, e as séries do SGS para o agregado do sistema.",
    historia: "Os '90 dias' são convenção do Comitê de Basileia adotada mundo afora — permitem comparar Brasil com qualquer país. No Brasil, a régua conviveu por 25 anos com a classificação por níveis de risco (AA a H) da Res. 2.682/1999; desde 2025, a Res. 4.966 mudou o regime para PERDA ESPERADA, mas os 90 dias seguem como o marco de inadimplência.",
    regulacao: "A régua aciona consequências práticas: crédito >90 dias exige mais provisão, para de acumular receita 'no papel' e pesa no capital. A partir da Res. 4.966, o banco provisiona ANTES do atraso, pela perda esperada — o 90 dias virou o gatilho do 'estágio 3' (problema materializado).",
    armadilhas: "Inadimplência é RAZÃO: cresce quando o calote sobe, mas também quando a carteira encolhe (denominador) — banco que para de emprestar 'piora' no índice. Baixas para prejuízo (write-offs) LIMPAM o índice sem ninguém ter pago. E carteira crescendo rápido dilui atraso — o quadrante crescimento × inadimplência do painel existe para pegar isso.",
    veja: ["atraso-15-90", "ativos-problematicos", "provisao-perda-esperada", "carteira-de-credito"],
  },
  "atraso-15-90": {
    nome: "Atraso de 15 a 90 dias",
    resumo: "O sinal antecedente: parcelas que acabaram de escorregar — parte volta, parte vira inadimplência.",
    intuicao: "Se a inadimplência >90d é a febre confirmada, o atraso de 15-90 dias é o termômetro subindo. Ele reage MESES antes: quando o orçamento das famílias aperta, primeiro os atrasos curtos incham; depois uma fração deles atravessa os 90 dias. Por isso o painel trata os dois como relógios diferentes, de propósito.",
    calculo: "Parcelas vencidas entre 15 e 90 dias ÷ carteira da modalidade. O painel usa esse recorte por PRODUTO (matriz atraso × taxa × carteira): é onde o sinal aparece primeiro e onde os produtos se diferenciam.",
    historia: "A régua de 15 dias vem das estatísticas de crédito do BCB, publicadas nesse recorte desde os anos 2000. A dupla 15-90/90+ virou o padrão de leitura de ciclo: analistas chamam o 15-90 de 'inadimplência jovem' — o estoque de problema em formação.",
    regulacao: "Entre 15 e 90 dias o crédito já exige provisão crescente (e, na perda esperada da 4.966, tende ao 'estágio 2': risco aumentou significativamente). O banco já está pagando pelo risco antes de o calote se confirmar.",
    armadilhas: "É volátil: um feriado bancário ou um 5º dia útil atípico mexem no número. Tendência importa mais que nível — e comparar atraso ≥15d de um produto com inadimplência ≥90d de outro é somar relógios diferentes (o painel nunca faz).",
    veja: ["inadimplencia-90", "provisao-perda-esperada"],
  },
  "ativos-problematicos": {
    nome: "Ativos problemáticos",
    resumo: "Conceito mais largo que inadimplência: inclui o crédito reestruturado e o risco já deteriorado.",
    intuicao: "Um banco pode 'resolver' a inadimplência renegociando: a dívida atrasada vira contrato novo em dia — e some do índice de 90 dias sem que o risco tenha sumido. Os ativos problemáticos fecham essa porta: contam o que está atrasado E o que foi reestruturado por dificuldade E o que o próprio banco já classifica como deteriorado (estágio 3).",
    calculo: "Definição da Res. 4.966: exposições em estágio 3 (perda incorrida ou muito provável) + reestruturações por dificuldade financeira. Sempre ≥ inadimplência 90d. A distância entre os dois números é informativa: muita reestruturação aparece aqui.",
    historia: "O conceito ganhou força internacional na crise do euro (2010-2014), quando 'NPL' virou assunto de política pública e os reguladores perceberam que renegociação escondia problema (evergreening: rolar para não reconhecer). O Brasil incorporou a categoria no arcabouço da 4.966.",
    regulacao: "Divulgação obrigatória no IF.data desde a estrutura 2025. Estágio 3 exige provisão pela perda esperada de toda a vida do contrato.",
    armadilhas: "Reestruturar NÃO é errado — muitas renegociações salvam empresas e famílias viáveis. O número alto pede investigação, não condenação: a pergunta é se as reestruturações performam ou apenas adiam.",
    veja: ["inadimplencia-90", "provisao-perda-esperada"],
  },
  "provisao-perda-esperada": {
    nome: "Provisão e perda esperada (Res. 4.966)",
    resumo: "O dinheiro que o banco separa HOJE para calotes prováveis de amanhã — desde 2025, antes mesmo do atraso.",
    intuicao: "Emprestar é aceitar que uma fração não volta. A provisão é reconhecer esse custo no dia em que se empresta, não no dia em que o cliente some. É a diferença entre um restaurante que já conta com 3% de desperdício no preço e um que 'se surpreende' todo mês.",
    calculo: "Sob perda esperada: estágio 1 (crédito normal) provisiona a perda esperada de 12 meses; estágio 2 (risco aumentou muito) e estágio 3 (problema materializado) provisionam a perda esperada da VIDA INTEIRA do contrato. O 'custo do crédito' da DRE é o fluxo dessas provisões, líquido de recuperações.",
    historia: "Por 25 anos o Brasil usou a Res. 2.682/1999 (níveis AA-H, provisão por tabela conforme o atraso) — um sistema reativo: a perda só aparecia quando o atraso já existia. A crise de 2008 expôs o defeito no mundo todo ('too little, too late'), o IFRS 9 (2018) trouxe a perda esperada, e a Res. 4.966 (editada em 2021, vigente em 2025) alinhou o Brasil — a maior mudança contábil bancária em uma geração, e a fronteira que atravessa várias séries deste painel (declarada onde importa).",
    regulacao: "Res. CMN 4.966/2021: modelos de perda esperada com backtesting, estágios, e a régua de 90 dias como gatilho do estágio 3. O marco está na aba Regulação.",
    armadilhas: "Perda esperada depende de MODELO — dois bancos com a mesma carteira podem provisionar diferente. O índice de cobertura (provisão ÷ carteira >90d) do painel não é razão regulatória: a provisão cobre também o crédito em dia.",
    veja: ["inadimplencia-90", "ativos-problematicos", "custo-do-credito"],
  },
  "carteira-de-credito": {
    nome: "Carteira de crédito",
    resumo: "O estoque de tudo que o banco emprestou e ainda não recebeu de volta.",
    intuicao: "É a 'fotografia' do dinheiro na rua: cada financiamento, cartão, consignado e capital de giro vivo naquele momento. Diferente das CONCESSÕES (o fluxo de crédito novo do mês), a carteira é o acumulado — pode crescer mesmo com concessões caindo, se os contratos antigos forem longos.",
    calculo: "Soma dos saldos devedores ativos. Atenção às variantes que o painel sempre nomeia: carteira classificada (régua antiga), carteira por instrumentos (régua 4.966, desde 2025), carteira ampliada (inclui garantias e títulos privados — a régua dos guidances).",
    historia: "A relação crédito/PIB brasileira saiu de ~25% nos anos 2000 para a faixa de 50-55% — expansão puxada por consignado (2003), imobiliário (2009-2014) e crédito digital (2019+). Cada onda deixou uma marca na composição que a ficha de cada banco mostra.",
    regulacao: "Todo o edifício prudencial gira em torno dela: é a base do RWA, da provisão e dos limites de exposição por cliente.",
    armadilhas: "Carteiras NOMINAIS crescem com a inflação — crescimento real é outra série (o painel deflaciona onde declara). E comparar carteira 'ampliada' de um banco com 'classificada' de outro é erro clássico — os conceitos vêm nomeados nas fichas justamente por isso.",
    veja: ["inadimplencia-90", "rwa", "spread"],
  },
  "spread": {
    nome: "Spread bancário",
    resumo: "A distância entre o que o banco paga para captar e o que cobra para emprestar.",
    intuicao: "O banco compra dinheiro (paga juros ao poupador) e vende dinheiro (cobra juros do tomador). O spread é a margem bruta dessa revenda — mas não é lucro: dele saem a inadimplência esperada, impostos, custo operacional e, por último, a margem. No Brasil, o maior pedaço historicamente é a inadimplência.",
    infografico: "spread",
    calculo: "Spread = taxa média de empréstimo − custo médio de captação, em pontos percentuais. O painel acompanha o spread médio do sistema (séries do BCB) e permite cruzar com o custo de captação por banco.",
    historia: "O spread brasileiro é tema de política econômica há décadas — entre os mais altos do mundo mesmo depois do Real (1994). A agenda de baixar spread produziu boa parte da regulação recente: cadastro positivo, portabilidade, duplicata eletrônica, Pix, Open Finance e o teto do rotativo — vários desses marcos estão na aba Regulação.",
    regulacao: "O spread em si é livre (fora nichos como o rotativo pós-Lei 14.690 e o consignado INSS com teto do CNPS). A estratégia regulatória tem sido atacar os INSUMOS: informação (menos assimetria), competição (mais entrantes) e recuperação de garantias (menos perda dado o calote).",
    armadilhas: "Spread médio mistura produtos radicalmente diferentes: cheque especial e imobiliário no mesmo caldeirão. Movimentos de MIX (mais consignado, menos rotativo) mexem no spread médio sem nenhum preço ter mudado.",
    veja: ["custo-de-captacao", "inadimplencia-90", "rotativo-do-cartao"],
  },
  "custo-do-credito": {
    nome: "Custo do crédito",
    resumo: "Quanto a inadimplência custou ao banco no período: provisões novas menos recuperações.",
    intuicao: "É a conta do risco chegando: o que o banco teve de separar para perdas prováveis (perda esperada), mais descontos concedidos em renegociação, menos o que conseguiu recuperar de créditos já baixados. Se a margem financeira é o motor, o custo do crédito é o atrito.",
    calculo: "Despesa de perda esperada + descontos concedidos − recuperações. É a definição usada nos guidances (BB e Itaú publicam nesses termos) e no painel. Compare-o com a margem financeira: a razão entre os dois diz quanto do ganho de intermediação o risco consome.",
    historia: "O conceito substituiu o antigo 'PDD' (provisão para devedores duvidosos) na linguagem gerencial conforme o IFRS 9 (2018) e a Res. 4.966 (vigente em 2025) mudaram a mecânica de provisionar — de reativa para preditiva.",
    regulacao: "Segue a contabilidade da Res. 4.966 (ver perda esperada). Nos guidances, cada banco define o perímetro exato — por isso o painel nunca compara custo do crédito ENTRE bancos sem nomear o conceito de cada um.",
    armadilhas: "Custo do crédito baixo demais num ciclo de piora pode significar provisão atrasada, não carteira boa. E recuperações grandes (vendas de carteira podre) derrubam o número num trimestre sem melhorar o risco novo.",
    veja: ["provisao-perda-esperada", "spread", "guidance"],
  },
  "custo-de-captacao": {
    nome: "Custo de captação",
    resumo: "Os juros que o banco paga pelo dinheiro que usa para emprestar.",
    intuicao: "Antes de vender dinheiro, o banco compra: de correntistas (barato, às vezes de graça), poupadores, investidores de CDB, outros bancos e o mercado. O custo médio dessa 'matéria-prima' define metade do negócio — um banco que capta a 8% e outro a 12% partem de mundos diferentes na mesma corrida.",
    calculo: "No painel: |despesa de juros de captações| anualizada (declarando os meses da DRE — mar/set=3, jun/dez=6) ÷ média das captações totais nas pontas. É estimativa com fórmula declarada em cada ficha; o MIX de depósitos (à vista, poupança, prazo, interfinanceiro) acompanha, porque a composição explica o custo.",
    historia: "A vantagem estrutural dos grandes varejistas sempre foi o depósito à vista — dinheiro a custo ~zero que paga a rede de agências. A era digital comprimiu isso a partir de 2019: fintechs pagando 100% do CDI ensinaram o depositante a cobrar pelo dinheiro, e o funding barato ficou mais raro e mais disputado.",
    regulacao: "Depósitos têm regras próprias (compulsórios, direcionamentos de poupança) que mexem no custo EFETIVO além da taxa paga.",
    armadilhas: "É uma estimativa sobre estoques de ponta — não o saldo médio diário que o banco enxerga internamente. E custo baixo via interfinanceiro pode ser dependência de atacado disfarçada: o mix importa tanto quanto o número.",
    veja: ["nsfr", "spread", "indice-de-eficiencia"],
  },
  "indice-de-eficiencia": {
    nome: "Índice de eficiência",
    resumo: "De cada real de receita, quantos centavos a operação consome em pessoal e despesas.",
    intuicao: "Dois bancos podem gerar a mesma receita com estruturas muito diferentes — um com 2 mil agências e 80 mil pessoas, outro com um aplicativo. O índice de eficiência mede isso: despesas operacionais ÷ receitas. É contraintuitivo de propósito: QUANTO MENOR, MELHOR (menos despesa por real de receita).",
    infografico: "eficiencia",
    calculo: "No painel: (despesas de pessoal + administrativas) ÷ (resultado de intermediação + rendas de serviços), do MESMO período da DRE — a razão dispensa anualização. Não inclui tributárias nem outras operacionais; o conceito acompanha o número.",
    historia: "A régua clássica de mercado dizia 'abaixo de 50% é excelente'. A onda digital dos anos 2010 reabriu a disputa: bancos sem rede física operam com índices muito baixos, e a resposta dos incumbentes — fechar agências, digitalizar — aparece nas séries de rede física deste painel.",
    regulacao: "Não é métrica regulatória — é gerencial. Cada banco publica a sua versão com perímetros próprios; a do painel usa uma fórmula única e declarada para todas as IFs, comparável entre elas.",
    armadilhas: "Bancos de atacado parecem 'eficientíssimos' (pouca gente, receita alta por cabeça) sem serem comparáveis a varejistas. E cortar despesa demais pode corroer a receita de amanhã — eficiência é razão, não virtude absoluta.",
    veja: ["roe", "custo-de-captacao"],
  },
  "hhi": {
    nome: "HHI — índice de concentração",
    resumo: "Um número que resume se um mercado (ou uma carteira) está espalhado ou concentrado.",
    intuicao: "Some o QUADRADO da participação de cada player: elevar ao quadrado faz os grandes pesarem desproporcionalmente. Quatro bancos com 25% cada dão HHI 2.500; um com 97% dá ~9.400. O quadrado é o truque: captura que um gigante concentra mais risco que muitos médios somados.",
    calculo: "HHI = Σ (participação de cada componente em %)². Vai de ~0 (atomizado) a 10.000 (monopólio). Réguas usuais: abaixo de 1.500 desconcentrado; 1.500-2.500 moderado; acima de 2.500 concentrado. O painel usa HHI para concentração SETORIAL da carteira PJ de cada banco — e o balde residual 'outros' da fonte NUNCA entra ao quadrado: ele é a soma de muitos setores não individualizados, não um setor. Por isso o número publicado é um PISO, calculado só sobre os setores identificados, com a cobertura declarada ao lado.",
    historia: "Criado pelos economistas Hirschman (1945) e Herfindahl (1950), virou a régua oficial de defesa da concorrência nos EUA nos anos 1980 e depois no mundo — o Cade e o BCB o usam em atos de concentração bancária.",
    regulacao: "Em fusões bancárias, BCB e Cade analisam o HHI dos mercados relevantes; no uso do painel (carteira de um banco), a leitura é de DIVERSIFICAÇÃO: carteira concentrada num setor amarra o banco ao destino daquele setor.",
    armadilhas: "O HHI depende de como se recorta o mercado (o quê? onde?). Tratar um balde residual ('outros', 'demais') como se fosse UM setor fabrica concentração onde há justamente o contrário — uma carteira 100% em 'outros' NÃO é monossetorial, é não classificada. E concentração setorial real pode ser especialização deliberada e lucrativa — o número pede contexto, não pânico.",
    veja: ["carteira-de-credito", "score-relativo"],
  },
  "percentil-quartis": {
    nome: "Percentil e quartis — como ler 'comparado aos pares'",
    resumo: "A posição de um banco na fila dos semelhantes: p80 = está acima de 80% deles.",
    intuicao: "Dizer que um ROE de 12% é 'bom' depende da vizinhança: entre bancos de varejo pode ser mediano; entre montadoras financeiras, alto. O percentil resolve: ordena os pares e diz onde o banco está na fila. Os quartis (q1, mediana, q3) marcam os cortes de 25%, 50% e 75% da fila — a régua inteira, não só a posição.",
    calculo: "O painel calcula percentis DENTRO do grupo de pares (mesmo segmento prudencial S1-S5). Grupo com menos de 5 membros cai para o conjunto completo — sinalizado, nunca silencioso.",
    historia: "É a estatística de ordem clássica — a mesma das curvas de crescimento infantil da OMS (2006). A graça é ser imune a aberrações: um banco com ROE de 80% não distorce o percentil dos outros (distorceria a média).",
    regulacao: "Não há — é método do painel, documentado na Metodologia.",
    armadilhas: "Percentil é posição RELATIVA: p90 num grupo inteiro ruim ainda é ruim. E percentil de grupo pequeno é grosseiro: com 6 bancos, cada posição salta ~17 pontos.",
    veja: ["score-relativo", "segmentacao-prudencial"],
  },
  "score-relativo": {
    nome: "O score de risco do painel",
    resumo: "Um resumo de 0 a 100 da posição do banco FRENTE AOS PARES — não uma nota de quebra.",
    intuicao: "O score responde uma pergunta modesta e útil: 'comparado aos semelhantes, este banco está mais frágil ou mais sólido nas dimensões que dá para medir com dado público?'. É a média dos percentis de risco em até 6 dimensões (capital, rentabilidade, alavancagem, concentrações, dependência de captações). 50 = típico do grupo; 80 = mais frágil que a maioria; 20 = mais sólido.",
    calculo: "Cada dimensão vira um percentil dentro do grupo de pares; o score é a média das dimensões DISPONÍVEIS (sem dado = dimensão omitida, nunca imputada — e o número de dimensões usadas é exibido). Histórico trimestral desde 2015.",
    historia: "A inspiração são os sistemas de vigilância dos supervisores (como o CAMELS americano, dos anos 1980), adaptados ao que é público: sem dados confidenciais de liquidez diária ou qualidade de gestão, o painel mede menos dimensões — e diz exatamente quais.",
    regulacao: "Não é rating nem recomendação — o disclaimer acompanha cada uso. Ratings privados usam informação não pública e julgamento; isto aqui é aritmética declarada sobre dado aberto.",
    armadilhas: "Score relativo NUNCA é probabilidade de quebra: um grupo inteiro pode estar saudável (ou doente) e os percentis não veem. Use-o como triagem — as dimensões abertas em cada ficha são o conteúdo real.",
    veja: ["percentil-quartis", "indice-de-basileia", "roe"],
  },
  "segmentacao-prudencial": {
    nome: "Conglomerado prudencial e segmentos S1-S5",
    resumo: "A régua do BCB para 'quem é do tamanho de quem' — e por que o painel compara dentro dela.",
    intuicao: "Comparar o Itaú com uma financeira regional é comparar um transatlântico com uma lancha. O BCB resolve isso duas vezes: consolida cada grupo financeiro num CONGLOMERADO PRUDENCIAL (o barco inteiro, não cada cabine) e o classifica em segmentos: S1 (gigantes, ≥10% do PIB ou ativos internacionais), S2, S3, S4 e S5 (mínimos). O painel herda as duas réguas.",
    calculo: "A segmentação vem da Res. CMN 4.553/2017 (o marco está na aba Regulação). Exigências regulatórias CRESCEM com o segmento: só S1 divulga tudo de Basileia III; S5 tem regime simplificado — proporcionalidade.",
    historia: "Antes de 2017 a régua era quase única para todos — caro para os pequenos, frouxo para os sistêmicos. A proporcionalidade alinhou o Brasil à prática internacional pós-crise: quem pode derrubar o sistema paga mais compliance.",
    regulacao: "A consequência prática para leitura de dados: instituição sem LCR/NSFR publicado provavelmente NÃO é obrigada (S3-S5), e o score do painel compara cada banco DENTRO do seu segmento — comparar percentis entre segmentos mistura réguas.",
    armadilhas: "O conglomerado prudencial pode diferir do grupo societário e do 'banco' da marca: a ficha de cada IF declara qual consolidação está em uso — e códigos de conglomerado mudam no tempo (o painel casa por CNPJ).",
    veja: ["percentil-quartis", "score-relativo", "pilar-3"],
  },
  "guidance": {
    nome: "Guidance — as promessas ao mercado",
    resumo: "Os intervalos que o banco projeta publicamente para o próprio ano — e contra os quais pode ser cobrado.",
    intuicao: "Guidance é o banco dizendo, por escrito e com números, 'esperamos crescer a carteira entre X% e Y%'. Não é promessa jurídica — é projeção condicionada. O valor jornalístico está no CONFRONTO: comparar o prometido com o entregue, ano após ano, pela régua que o próprio banco escolheu.",
    calculo: "O painel registra cada ciclo (intervalos por métrica), o realizado quando o ciclo fecha e a posição aritmética (dentro/acima/abaixo). Cada banco SÓ contra o próprio guidance: os conceitos são gerenciais e diferem entre bancos — nunca ranking de cumprimento.",
    historia: "A prática veio do mercado americano. No Brasil consolidou-se nos anos 2000 com a ida dos grandes à bolsa; o BB a pratica como 'Projeções Corporativas' com acompanhamento trimestral desde cedo. Revisões no meio do ano — como a que o painel registrou em 2026 — são eventos informativos por si.",
    regulacao: "Projeções divulgadas viram documento regulado (Resolução CVM 44/80): precisam de premissas, atualização quando mudam e registro formal — por isso o painel só usa os documentos protocolados na CVM, nunca declarações soltas.",
    armadilhas: "'Dentro do intervalo' não é mérito automático (para despesa, acima é pior; para receita, melhor) — o painel não converte posição em nota. E bases mudam entre ciclos (DREs ajustadas): ciclo contra ciclo pode não ser comparável, e isso vem declarado.",
    veja: ["custo-do-credito", "carteira-de-credito"],
  },
  "pilar-3": {
    nome: "Pilar 3 — a transparência obrigatória",
    resumo: "O relatório padronizado em que cada banco abre seus números de capital, liquidez e risco.",
    intuicao: "O acordo de Basileia tem três pilares: 1) exigências mínimas, 2) supervisão, e 3) DISCIPLINA DE MERCADO — a ideia de que investidores e depositantes bem informados punem imprudência antes do regulador. O Pilar 3 é a matéria-prima do terceiro: tabelas padronizadas (a KM1 é o resumo executivo) publicadas trimestralmente por cada banco.",
    calculo: "O painel lê a tabela KM1 — capital (ICP, Nível 1, Basileia), colchões, alavancagem, LCR e NSFR — do arranjo de dados abertos do BCB (DASFN), em que cada instituição serve os próprios números em formato padronizado.",
    historia: "O Pilar 3 nasceu em Basileia II (2004) e foi padronizado com força após 2008, quando ficou claro que relatórios livres viravam marketing. As tabelas fixas (mesmo layout para todos) são a resposta: comparabilidade acima de narrativa.",
    regulacao: "No Brasil, Res. BCB 54/2020 define tabelas, prazos e escopo (integral para S1, decrescente até S4). A publicação em dados abertos via DASFN é o degrau mais recente — e é o que permite a este painel ler máquina-a-máquina.",
    armadilhas: "Cobertura segue a obrigação: banco fora do arranjo ou sem LCR publicado pode simplesmente não ser obrigado. E divulgação trimestral é retrato — a liquidez de ontem não garante a de amanhã.",
    veja: ["indice-de-basileia", "lcr", "nsfr", "alavancagem"],
  },
  "regime-de-resolucao": {
    nome: "Regimes de resolução (intervenção, RAET, liquidação)",
    resumo: "As três formas de o BCB assumir o volante de uma instituição em crise.",
    intuicao: "Banco não 'fale' como padaria: a quebra desordenada contamina o sistema. Por isso existe um corredor especial: INTERVENÇÃO (o BCB afasta a administração e congela para avaliar), RAET (administração especial temporária — o banco segue operando sob gestão nomeada) e LIQUIDAÇÃO EXTRAJUDICIAL (o fim: vender ativos, pagar credores na ordem legal, fechar).",
    calculo: "O painel acompanha a lista oficial vigente do BCB (atualização diária) e acumula memória própria: quem sai da lista permanece no histórico.",
    historia: "O arcabouço é dos anos 1970 (Lei 6.024/1974 e, para o RAET, o Decreto-Lei 2.321/1987) e foi testado em escala no pós-Real, quando a inflação que escondia ineficiência sumiu — o Proer (1995) reestruturou grandes bancos privados e o Proes, os estaduais. As liquidações de hoje são majoritariamente instituições pequenas e de pagamento.",
    regulacao: "A decretação é ato do BCB publicado oficialmente, com nomeação de interventor/liquidante. Um projeto de nova Lei de Resolução Bancária (alinhando o Brasil ao padrão pós-2008 de 'bail-in') tramita há anos — quando sair, será um marco para a aba Regulação.",
    armadilhas: "Regime em instituição pequena NÃO é sinal sistêmico — e a maioria dos casos recentes é exatamente isso. O valor da série está na exceção e na tendência, não no susto de cada linha.",
    veja: ["indice-de-basileia", "lcr", "segmentacao-prudencial"],
  },
  "consignado": {
    nome: "Crédito consignado",
    resumo: "Empréstimo descontado direto do salário ou benefício — o risco cai, o juro também (deveria).",
    intuicao: "Se a parcela sai na folha antes de o dinheiro chegar à conta, o banco quase não tem risco de calote — por isso consegue cobrar muito menos que num empréstimo comum. É o produto que transformou aposentado em cliente disputado: o INSS é a maior folha do país.",
    calculo: "O painel acompanha saldo, concessões, taxas e inadimplência por vínculo (INSS, público, privado) e o custo total do crédito INSS (ICC), além do desenho institucional: quem PAGA a folha (leilões) não é quem empresta contra ela.",
    historia: "Nasceu da Lei 10.820/2003 — um dos maiores sucessos de desenho de crédito do Brasil: taxas caíram à metade do crédito pessoal comum. Em 2025, o 'Crédito do Trabalhador' (MP 1.292 → Lei 15.179) reformou o consignado privado via eSocial, com portabilidade — o marcador está nas séries do painel.",
    regulacao: "Margem consignável limita quanto do salário pode ser comprometido (as mudanças de margem estão marcadas nos gráficos); o consignado INSS tem teto de juros fixado pelo CNPS; a Lei 14.181/2021 (superendividamento) cerca o conjunto.",
    armadilhas: "Risco baixo para o BANCO não é risco baixo para a PESSOA: margem comprometida por anos reduz a renda disponível — o painel cruza consignado com comprometimento de renda por isso. E a inadimplência 'impossível' existe: morte, fim de vínculo, fraude.",
    veja: ["spread", "inadimplencia-90"],
  },
  "rotativo-do-cartao": {
    nome: "Rotativo do cartão",
    resumo: "O crédito que nasce quando a fatura não é paga inteira — o juro mais alto do mercado.",
    intuicao: "Pagar o mínimo da fatura é contratar, sem assinar nada, o crédito mais caro do país. O rotativo existe para ser ponte de DIAS; virou armadilha quando famílias o usaram por meses. Um dos jeitos de enxergar: é o único crédito que o cliente toma sem decidir tomar.",
    calculo: "O painel acompanha as taxas do rotativo nas séries de juros por modalidade e o atraso do cartão na matriz de produtos (lembrando: atraso ≥15d de cartão NÃO é inadimplência ≥90d — os dois relógios).",
    historia: "As taxas passaram de 400% a.a. em vários momentos. Duas intervenções marcaram época: a Res. 4.549/2017 (rotativo só até a fatura seguinte, depois obrigatoriamente parcelado) e a Lei 14.690/2023, que limitou juros e encargos a 100% do principal para quem entra no rotativo — o marcador de jan/2024 está nas séries.",
    regulacao: "Teto de 100% do principal (Lei 14.690/2023) + rotativo máximo de ~30 dias (Res. 4.549). O debate sobre o fim do parcelado sem juros — o subsídio cruzado que sustenta o modelo brasileiro do cartão — segue aberto.",
    armadilhas: "Taxa média do rotativo mistura perfis muito diferentes de emissor. E o teto de 100% vale por CONTRATO que entra no rotativo — não zera a taxa, limita o acúmulo.",
    veja: ["spread", "atraso-15-90"],
  },
};

/* motor do modal */
function termo(slug, rotulo) {
  const c = CONCEITOS[slug];
  if (!c) return rotulo || slug;
  return `<a class="termo" href="javascript:void(0)" onclick="abrirConceito('${slug}')" title="clique para entender: ${attr(c.resumo)}">${rotulo || c.nome}</a>`;
}
window.abrirConceito = (slug) => {
  const c = CONCEITOS[slug];
  if (!c) return;
  let dlg = document.getElementById("conceitoDlg");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "conceitoDlg";
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
  }
  const sec = (icone, titulo, texto) => texto ? `<h5>${icone} ${titulo}</h5><p>${texto}</p>` : "";
  dlg.innerHTML = `
    <div class="cdlg">
      <div class="cdlg-head"><h3>${c.nome}</h3>
        <button class="btn ghost small" onclick="document.getElementById('conceitoDlg').close()" aria-label="fechar">✕ fechar</button></div>
      <p class="cdlg-resumo">${c.resumo}</p>
      ${c.infografico && IG[c.infografico] ? IG[c.infografico]() : ""}
      ${sec("💡", "A intuição", c.intuicao)}
      ${sec("🧮", "Como se calcula (e como o painel usa)", c.calculo)}
      ${sec("📜", "Um pouco de história", c.historia)}
      ${sec("⚖️", "A regulação, sem juridiquês", c.regulacao)}
      ${sec("⚠️", "Armadilhas de leitura", c.armadilhas)}
      ${(c.veja || []).length ? `<h5>🔗 Veja também</h5><div class="chips">${c.veja.map(v => CONCEITOS[v] ? `<span class="chip clickable" onclick="abrirConceito('${v}')">${CONCEITOS[v].nome.split("—")[0].trim()}</span>` : "").join("")}</div>` : ""}
      <p class="src" style="margin-top:10px">Explicação editorial do Observatório — as definições formais e fórmulas exatas estão na <a href="javascript:void(0)" onclick="document.getElementById('conceitoDlg').close();nav('method')">Metodologia</a>.</p>
    </div>`;
  dlg.showModal();
  try { const body = JSON.stringify({ secao: "obs:conceito:" + slug }); navigator.sendBeacon && navigator.sendBeacon("/api/telemetria", new Blob([body], { type: "application/json" })); } catch (e) { /* nunca interfere */ }
};
function conceitosLista() {
  const slugs = Object.keys(CONCEITOS);
  return `<div class="card" style="margin-top:12px"><h4>Conceitos, do zero — ${slugs.length} explicações didáticas</h4>
    <p class="src">Cada conceito importante do painel é clicável onde aparece (sublinhado pontilhado) e abre a explicação completa: intuição, cálculo, história, regulação sem juridiquês e armadilhas de leitura.</p>
    <div class="chips" style="margin-top:8px">${slugs.map(s => `<span class="chip clickable" onclick="abrirConceito('${s}')">${CONCEITOS[s].nome.split("—")[0].trim()}</span>`).join("")}</div></div>`;
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
/* Renderização única do chip de selo metodológico. Cada página mantém seu vocabulário
   — "reportado" no Desenrola é deliberado, "hipótese" existe só no consignado — mas a
   renderização era reimplementada seis vezes, com divergências acidentais de classe
   (o "contextual" herdava o riscado de série descontinuada). Agora divergência de
   vocabulário é decisão; divergência de renderização não existe mais. */
/* Os golds municipais chegam em dois arquivos — o corpo (agregados, séries, modelos) e
   o array de 5.570 municípios, que muda em ritmo mensal e ganha cache próprio. A costura
   acontece aqui, uma vez, e o resto da página não sabe da divisão. Golds antigos, com o
   array embutido, continuam funcionando. */
function costuraMunicipios(base, mun) {
  if (base && !base.municipios && mun && mun.municipios) base.municipios = mun.municipios;
  return base;
}

function seloChip(dic, s) {
  const b = dic[s];
  return b ? `<span class="seal ${b[0]}">${b[1]}</span>` : "";
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
function alertState(id) {
  const m = loadLS("obc_alert_states", {});
  // ids ganharam prefixo de família na unificação; honra o que já estava salvo
  return m[id] || m[String(id).split(":").slice(1).join(":")] || "ativo";
}
window.setAlertState = (id, st) => {
  const m = loadLS("obc_alert_states", {}); m[id] = st; saveLS("obc_alert_states", m);
  renderAlerts();
  updateAlertBadge();  // o contador do cabeçalho é a manchete da central: acompanha na hora
};
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
  const tabs = [["geral", "Visão Geral"], ["garantias", "Garantias"], ["empresarial", "Empresarial & Judicial"], ["naobancario", "Crédito Não Bancário"], ["consumidor", "Consumidor"], ["regional", "Regional"], ["buscas", "Buscas"], ["protocolo", "Protocolo & regimes"], ["metodo", "Metodologia & Licenças"]];
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
    ${sechead("As defasagens sugerem antecedência?", "associação exploratória — promoção plena exige o protocolo da aba Protocolo e regimes")}
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
  } else if (t === "protocolo") {
    body = blocoProtocolo();
  } else if (t === "buscas") {
    const B = L.buscas || {};
    body = B.disponivel
      ? sechead("Comportamento de busca — integrado via exportação manual", "Google Trends · carga manual autorizada · 29/07/2026") +
        `<div class="card"><h4>Tendências de Busca <span class="seal exp">ASSOCIAÇÃO EXPLORATÓRIA</span></h4>
        <p class="src" >${B.modo || ""}</p>
        <p >${B.resumo || ""}</p>
        <div class="chips">${(B.familias || []).map(f => `<span class="chip">${f}</span>`).join("")}</div>
        <p style="margin-top:14px"><button class="btn" onclick="nav('trends')">abrir a página Tendências de Busca →</button></p>
        <div class="src">Aviso obrigatório: os índices representam interesse relativo de busca (0–100 por consulta), e não quantidade absoluta de pessoas ou pesquisas. A coleta automatizada permanece não licenciada e não é realizada.</div></div>`
      : sechead("Comportamento de busca — status honesto", "estrutura pronta; fonte aguarda carga manual") +
        `<div class="card"><h4>IBEF — Índice de Busca por Estresse Financeiro <span class="seal aprox">INDISPONÍVEL</span></h4>
        <p class="src" >${B.motivo || ""}</p>
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
  const aviso = `<div class="note" style="margin-top:12px"><b>Leia antes de interpretar:</b> ${T.disclaimer}
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
    <p style="margin-bottom:0">${M.diagnostico}</p></div>`;

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
    `<div class="card"><p class="src" >${T.defasagens.metodo}</p>
    <h4>Melhor defasagem por termo <span class="seal exp">ASSOCIAÇÃO EXPLORATÓRIA</span></h4>${T.defasagens.linhas.map(lagRow).join("")}
    ${entenda("trlag", [["O que isto NÃO é", "validação. Correlação defasada é o primeiro filtro; a promoção a 'antecedente' exige o protocolo formal da aba Protocolo e regimes (Granger, ganho fora da amostra, estabilidade)."],
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
    <ol style="color:var(--text-2)">${(M.limitacoes || []).map(l => `<li>${l.replace(/^\d+\.\s*/, "")}</li>`).join("")}</ol>
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
  <div >
    <p>O Observatório Brasileiro de Crédito é uma plataforma independente e gratuita que reúne dados públicos sobre crédito e instituições financeiras no Brasil. As informações vêm principalmente das bases públicas do Banco Central e da CVM, complementadas por outras fontes oficiais e por dados divulgados pelas próprias instituições. Cada número indica sua origem, com distinção clara entre dado observado e indicador calculado.</p>
    <h3 style="margin-top:28px">Sobre o autor</h3>
    <p>O Observatório Brasileiro de Crédito é uma iniciativa independente de Genaro Dueire Lins, profissional com mais de vinte anos de atuação no sistema financeiro brasileiro nas áreas de crédito, risco e dados.</p>
    <p>Genaro é membro do Conselho de Administração do Fundo Garantidor de Créditos, onde coordena o Comitê de Auditoria, e diretor de Monitoramento da Associação Open Finance Brasil, responsável pelo acompanhamento técnico do ecossistema. É professor de Gestão de Risco de Crédito no Mestrado Profissional em Economia e Finanças da FGV.</p>
    <p>Foi Superintendente de Controle de Riscos do Itaú Unibanco e Chief Credit Officer da Open Co, fintech de crédito resultante da fusão entre Geru e Rebel. É doutor em Economia pela FGV EPGE e foi Visiting Scholar da Faculdade de Economia da Universidade de Cambridge, com pesquisa sobre crédito e dados bancários.</p>
    <p>O Observatório é um projeto pessoal. Não representa posições das instituições às quais o autor é vinculado e reflete seu compromisso com a transparência e o uso qualificado dos dados públicos do mercado de crédito brasileiro.</p>
    <h3 style="margin-top:28px">Para a imprensa</h3>
    <p><b>Como citar:</b> "Observatório Brasileiro de Crédito (scrutiniums.com/observatorio), sobre dados oficiais do Banco Central/CVM" — de preferência com link. Todo número do painel carrega fonte primária, período e limitações; a página de <a href="javascript:void(0)" onclick="nav('method')">Metodologia &amp; Fontes</a> documenta cada indicador.</p>
    <p><b>Pauta pronta:</b> a Visão geral traz os <a href="javascript:void(0)" onclick="nav('overview')">recordes automáticos das séries</a> (com régua declarada) e a aba <a href="javascript:void(0)" onclick="nav('alerts')">Alertas</a> tem feed RSS assinável. Os dados brutos de cada página são exportáveis em JSON.</p>
    <p class="src">Pedido editorial: ao citar um recorde ou alerta, preserve a cautela que o acompanha — recorde é posição aritmética na série, nunca juízo de mérito.</p>
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
/* Re-renderiza a view preservando foco e cursor do campo ativo. As buscas que filtram
   a cada tecla re-renderizam a página inteira, o que recria o <input> e mataria o foco —
   o usuário digitaria uma letra por clique. Capturar id + posição do cursor antes e
   restaurar depois resolve sem refatorar os renderizadores. */
function comFocoPreservado(rerender) {
  const el = document.activeElement;
  const id = el && el.id;
  const pos = el && el.selectionStart;
  rerender();
  if (id) {
    const novo = document.getElementById(id);
    if (novo) {
      novo.focus();
      if (pos != null && novo.setSelectionRange) {
        try { novo.setSelectionRange(pos, pos); } catch (e) { /* type=search em alguns UAs */ }
      }
    }
  }
}
window.pxMunFiltro = () => {
  state.px.munq = (document.getElementById("pxmunq") || {}).value || "";
  comFocoPreservado(renderPix);
};

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
  // ausência declarada: sem série trimestral (fonte do BCB em pane e sem
  // publicação anterior para carregar), o capítulo diz isso em vez de quebrar
  const t0d = X.tri.dados[X.tri.tri0] || {};
  const foto = Object.keys(X.tri.nomes).filter(i => t0d[i] && (t0d[i].q || 0) > 0).map(i => ({ i, q: t0d[i].q, v: t0d[i].v, t: t0d[i].v / t0d[i].q })).sort((a, b) => b[metr === "q" ? "q" : "v"] - a[metr === "q" ? "q" : "v"]);
  const fotoMax = Math.max(...foto.map(x => x[metr === "q" ? "q" : "v"]));
  const versus = !tris.length
    ? sechead("Como o Pix se compara aos outros instrumentos?", "comparação completa é TRIMESTRAL") + `
    <div class="card"><p class="src">A série trimestral do MPV (a única que traz cartões e os demais instrumentos)
    está indisponível na fonte do BCB e não há publicação anterior para manter no ar. O capítulo volta
    automaticamente quando a fonte voltar.</p></div>`
    : sechead("Como o Pix se compara aos outros instrumentos?", `comparação completa é TRIMESTRAL (cartões e outros não têm série mensal); nada foi interpolado`) + `
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

  /* ---------- 8. geografia (exibida após os setores: 'para onde vai') ---------- */
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
  const munRows = M2 && M2.municipios ? M2.municipios.filter(m2 => !munq || _norm(m2.mun).includes(_norm(munq)) || (m2.uf || "").toLowerCase() === munq).slice(0, 25) : [];
  const geog = sechead("Onde o Pix acontece?", `${G.mes} · padrão NORMALIZADO por habitante (valores absolutos favorecem estados populosos)`) + `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0 10px">
      <span class="seg">${Object.entries(GMETS).map(([k2, [l]]) => `<button class="${gmet === k2 ? "on" : ""}" onclick="pxSet('gmet','${k2}')">${l.split(" (")[0]}</button>`).join("")}</span>
      <span class="seg">${[["pag", "Pagador"], ["rec", "Recebedor"]].map(([v2, l]) => `<button class="${persp === v2 ? "on" : ""}" onclick="pxSet('gpersp','${v2}')">${l}</button>`).join("")}</span>
    </div>
    <div class="ov-2col-eq">
      <div class="card"><svg class="panmap" viewBox="${G.geo.viewBox}" role="group" aria-label="mapa do Pix por UF"><g transform="${G.geo.transform}">${gpaths}</g></svg>
      <div class="src" style="margin-top:6px">${G.nota_perspectiva} Métricas por habitante existem só na perspectiva do pagador (denominador populacional).</div></div>
      <div class="card"><h4>Municípios — os maiores por valor pago</h4>
      ${M2 === undefined ? `<button class="btn" onclick="pxLoadMun()">carregar ranking municipal (5,5 mil municípios)</button>` :
        M2 === null ? `<p class="src"><span class="spin"></span> carregando…</p>` :
        `<input id="pxmunq" placeholder="filtrar por nome ou sigla da UF" value="${px.munq || ""}" oninput="pxMunFiltro()" style="width:100%;margin:4px 0 8px;padding:6px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
        <div class="tblwrap" style="max-height:340px"><table class="data compact"><thead><tr><th>Município</th><th>UF</th><th style="text-align:right">Valor pago</th><th style="text-align:right">Transações</th><th style="text-align:right">Pessoas pagadoras</th></tr></thead>
        <tbody>${munRows.map(m2 => `<tr><td>${m2.mun}</td><td>${m2.uf || "–"}</td><td style="text-align:right">${fmt.money(m2.v_pag)}</td><td style="text-align:right">${fmt.n0(m2.q_pag)}</td><td style="text-align:right">${fmt.n0(m2.pes_pag)}</td></tr>`).join("")}</tbody></table></div>
        <div class="src">mapa municipal coroplético: fase 2 (malha de 5.570 polígonos); rankings e busca já cobrem o nível municipal.</div>`}</div>
    </div>`;

  /* ---------- 7. setores — EPAE aberta e matriz da tabela especial ---------- */
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
        <div class="src" style="margin-top:6px">Nesta fonte (EPAE aberta), o lado PAGADOR aparece apenas como pessoa/empresa/governo. A matriz completa setor-pagador × setor-recebedor vem da tabela especial do BCB, logo abaixo — universo distinto (SPI), nunca somado a este.</div></div>
      </div>`;
  }

  /* A tabela especial preenche a lacuna que este painel declarava: o SETOR do
     pagador. Universo distinto do bloco acima (SPI apenas) — os dois cartões
     convivem, nunca se somam, e cada um declara o próprio universo. */
  const EM = X.epae_matriz || {};
  let epaeMatriz = "";
  if (EM.recebedores_pf && EM.recebedores_pf.length) {
    const topPF = EM.recebedores_pf.slice(0, 12);
    const maxPF = Math.max(...topPF.map(r => r.v));
    const selTE = EM.recebedores_pf.find(r => r.setor === px.setorTE) || EM.recebedores_pf[0];
    const pagadores = Object.entries(EM.matriz)
      .map(([pag, linha]) => [pag, linha[selTE.setor]])
      .filter(([pag, v]) => v != null && pag !== selTE.setor)
      .sort((a, b) => b[1] - a[1]).slice(0, 9);
    const maxPag = Math.max(...pagadores.map(([, v]) => v));
    epaeMatriz = `
    <div class="ov-2col-eq" style="margin-top:10px">
      <div class="card"><h4>O que as famílias pagam a cada setor ${badge("observado")}</h4>
        <div class="src" style="margin-bottom:6px">Pix de pessoas físicas a cada seção da CNAE · ${fmt.my(EM.mes)} · % sobre o Pix PF→PJ (mesmo conceito do painel de bets)</div>
        ${topPF.map(r => `<div onclick="pxSet('setorTE','${r.setor.replace(/'/g, "")}')" style="cursor:pointer">${panBar(r.setor.length > 42 ? r.setor.slice(0, 40) + "…" : r.setor, r.v, maxPF, v2 => "R$ " + fmt.n(v2, 1) + " bi", `${fmt.n(r.part, 1)}% · ${r.yoy != null ? fmt.pp(r.yoy) + "% 12m" : ""}${r.ano != null ? ` · ${EM.ano_fechado}: R$ ${fmt.n(r.ano, 0)} bi` : ""}`)}</div>`).join("")}
        <div class="src">clique num setor para ver de quem ele recebe</div></div>
      <div class="card"><h4>${selTE.setor} — de quais setores vem o dinheiro ${badge("observado")}</h4>
        <div class="src" style="margin-bottom:6px">matriz setor-pagador × setor-recebedor · ${fmt.my(EM.mes)} · R$ bilhões</div>
        ${pagadores.map(([pag, v]) => panBar(pag.length > 42 ? pag.slice(0, 40) + "…" : pag, v, maxPag, v2 => "R$ " + fmt.n(v2, 1) + " bi")).join("")}
        ${selTE.setor.startsWith("Artes") ? `<div class="note warn" style="margin-top:8px">${EM.nota_bets}</div>` : ""}
        <div class="src" style="margin-top:6px"><b>Universo próprio, nunca somado ao cartão de natureza acima:</b> ${EM.universo} ${EM.revisao}.</div></div>
    </div>`;
  }

  /* ---------- 6. funcionalidades (exibida após natureza: 'como se paga') ---------- */
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
      ${lineChart({ series: [{ pts: md.map(o => ({ x: o.p, y: o.aceitas_100mil })), label: "aceitas/100 mil", color: "#b91c1c" }], h: 200, unit: "por 100 mil transações", fonte: "BCB MED", aria: "incidência de contestações aceitas", annotations: marcosRegulatorios("pix") })}
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
    <ol style="color:var(--text-2)">${X.cautelas.map(c => `<li>${c}</li>`).join("")}</ol>
    <details class="charttable"><summary>catálogo de métricas (${X.catalogo.length})</summary><div class="tblwrap"><table class="data compact"><thead><tr><th>id</th><th>Nome</th><th>Conceito</th><th>Fórmula</th><th>Unid.</th><th>Freq.</th><th>Fonte</th><th>Início</th><th>Limitações</th></tr></thead>
    <tbody>${X.catalogo.map(c => `<tr><td class="src">${c.id}</td><td><b>${c.nome}</b></td><td class="src">${c.conceito}</td><td class="src">${c.formula}</td><td>${c.unidade}</td><td>${c.periodicidade}</td><td class="src">${c.fonte}</td><td>${c.inicio}</td><td class="src">${c.limitacoes}</td></tr>`).join("")}</tbody></table></div></details></div>`;

  /* Arco narrativo dos capítulos, reorganizado em 08/2026:
     I.   o que é e quanto move  → visão · evolução · versus outros meios
     II.  quem usa e como paga   → quem usa · natureza · funcionalidades
     III. para onde o dinheiro vai → setores (EPAE + matriz) · geografia
     IV.  confiança e infraestrutura → MED · SPI
     A mudança: funcionalidades subiu para junto de natureza (ambos são "como
     se paga"), e a geografia desceu para junto dos setores (ambos são "para
     onde vai"). MED e infraestrutura fecham, antes da metodologia. */
  el.innerHTML = head + sintese + kpis + evol + versus + quem + natureza + func + epae + epaeMatriz + geog + medS + infra + metodo;
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
    <svg class="panmap" viewBox="${P.geo.viewBox}" role="group" aria-label="mapa do Brasil por UF — ${M.l}"><g transform="${P.geo.transform}">${paths}</g></svg>
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
    <div class="src" >${Object.entries(P.conceitos).map(([kk, v]) => `<b>${kk}</b>: ${v}`).join("<br>")}
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
const VIEW_VINTAGE = { overview: "sgs", pulse: "sgs", leading: "sgs", scenarios: "sgs",
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


/* ---------- guia didático por página: divulgação progressiva ----------
   Toda página do Observatório responde a UMA pergunta central. Este catálogo
   torna essa pergunta explícita e acrescenta as três camadas que separam um
   painel de números de um instrumento de análise: por que importa, como ler e —
   a mais importante — o que os dados NÃO permitem concluir. Renderizado pelo
   pageHead, colapsado por padrão para não competir com o conteúdo. */
const GUIA = {
  overview: { q: "Como está o mercado de crédito brasileiro agora?",
    importa: "Reúne num só lugar o estoque de crédito, a inadimplência, o custo e os sinais de alerta — os quatro eixos que resumem a saúde do sistema.",
    ler: "Comece pela classificação determinística no topo: ela posiciona o momento atual contra a própria história da série, não contra uma opinião. Depois desça para os painéis temáticos.",
    nao: "Um mês isolado não caracteriza mudança de ciclo. Variações de um único indicador podem refletir sazonalidade ou revisão da fonte." },
  panorama: { q: "Onde está o crédito no Brasil e quem são os tomadores?",
    importa: "O crédito não é uniforme no território nem entre grupos sociais: a mesma carteira nacional esconde realidades muito diferentes por estado, renda, ocupação e produto.",
    ler: "O mapa vem normalizado por habitante justamente porque valores absolutos apenas reproduzem o tamanho da população. Use as lentes (saldo, inadimplência, contribuição para o risco) para distinguir volume de risco.",
    nao: "Volume não é risco, e taxa alta num grupo pequeno não move o sistema. Diferenças demográficas refletem composição de produtos e acesso ao crédito — não causalidade." },
  pulse: { q: "Como evoluem estoque, concessões, juros e inadimplência?",
    importa: "São as séries mensais que o Banco Central publica há décadas: a espinha dorsal de qualquer diagnóstico do ciclo de crédito.",
    ler: "Separe estoque (saldo acumulado) de fluxo (concessões do mês) — são conceitos distintos que respondem a perguntas diferentes. Use o seletor de segmento para isolar PF e PJ.",
    nao: "Não compare o nível do saldo com o das concessões: um é acervo, o outro é vazão. Séries nominais crescem com a inflação; use a opção real quando o interesse for o poder de compra." },
  leading: { q: "Há estresse de crédito se formando — e quais sinais realmente antecedem?",
    importa: "Duas perguntas que só fazem sentido juntas: o radar combina fontes independentes (endividamento das famílias, garantias imobiliárias, crédito não bancário, judicialização) para detectar pressão antes da inadimplência; a aba Protocolo testa quais candidatos sobrevivem a quatro critérios estatísticos e podem, de fato, ser chamados de antecedentes.",
    ler: "Os subíndices são z-scores: medem a distância da própria história, não um nível absoluto. Alertas exigem persistência de pelo menos duas leituras — um pico isolado não dispara nada. No Protocolo, só é promovido quem passa em defasagem, Granger, ganho fora da amostra e estabilidade; reprovados ficam visíveis.",
    nao: "Nenhum sinal isolado determina conclusão, e nada aqui é previsão. Correlação defasada não é causa, e um indicador que antecipou o último ciclo pode falhar no próximo — relações macro mudam de regime." },
  trends: { q: "O que os brasileiros procuram no Google sobre dívida e crédito?",
    importa: "A busca é um sinal de intenção que antecede o contrato: quem pesquisa 'renegociar dívida' ainda não renegociou.",
    ler: "O índice é relativo (0–100 dentro de cada consulta) e cada termo tem escala própria — compare a trajetória de um termo ao longo do tempo, nunca o nível entre termos.",
    nao: "Não mede quantidade de pessoas nem de pesquisas, e não mede inadimplência efetiva. Todo o módulo é associação exploratória, nunca evidência validada." },
  sectors: { q: "Quais setores da economia concentram risco de crédito?",
    importa: "A carteira PJ se distribui de forma muito desigual entre setores, e choques setoriais chegam ao balanço dos bancos por esse canal.",
    ler: "Compare a exposição (quanto o setor pesa na carteira) com os indicadores de atividade do setor — é o cruzamento que revela vulnerabilidade.",
    nao: "Exposição elevada não significa perda: depende de garantias, prazos e da situação financeira de cada empresa." },
  rj: { q: "Como evoluem recuperações judiciais e falências?",
    importa: "São a materialização extrema do risco de crédito PJ e antecedem perdas nas carteiras dos credores.",
    ler: "As séries vêm dos tribunais integrados ao DataJud, com cobertura declarada. Leia a variação, não o nível absoluto: cada tribunal aderiu ao sistema em momento diferente.",
    nao: "A cobertura não é nacional nem homogênea no tempo. Aumento de registros pode refletir melhora da base, não do fenômeno." },
  institutions: { q: "Qual a situação de cada instituição financeira?",
    importa: "Capital, inadimplência, rentabilidade e escala determinam a capacidade de uma instituição absorver perdas e continuar emprestando.",
    ler: "Compare sempre dentro do mesmo nível de consolidação e do mesmo segmento prudencial. Um banco de varejo e uma financeira de nicho não são comparáveis diretamente.",
    nao: "Indicadores contábeis são fotografias trimestrais e não capturam risco fora do balanço nem eventos posteriores à data-base." },
  compare: { q: "Como duas ou mais instituições se comparam entre si?",
    importa: "Comparação é o método básico de análise institucional — desde que universo, período e conceito sejam idênticos nos dois lados.",
    ler: "As medianas do universo aparecem como linhas de referência. Métricas derivadas só são exibidas quando todos os insumos existem na mesma data-base.",
    nao: "Não compare instituições de portes muito distintos sem normalizar, e não misture níveis de consolidação — o comparador bloqueia essa mistura por construção." },
  products: { q: "Como funciona cada produto de crédito e quem o oferece?",
    importa: "Consignado, cartão, veículos e imobiliário têm dinâmicas de risco e preço completamente diferentes — tratá-los como 'crédito' esconde o essencial.",
    ler: "O atraso ≥15 dias é específico do produto na instituição; a inadimplência >90d é da instituição inteira. São réguas diferentes e estão rotuladas como tal.",
    nao: "Participação de mercado não indica qualidade, e produtos com garantia real têm atraso naturalmente menor — a comparação válida é dentro do mesmo produto." },
  juros: { q: "Quanto cada instituição cobra em cada modalidade?",
    importa: "A dispersão de taxas entre instituições para o mesmo produto é uma das maiores do mundo no Brasil, e é informação acionável.",
    ler: "São taxas de novas operações no período, não o custo efetivo total nem a taxa da carteira existente. Compare dentro da modalidade.",
    nao: "A taxa não é comparável ao CET, que inclui tarifas e seguros. Taxas baixas podem refletir perfil de cliente, não eficiência." },
  market: { q: "Quanto valem os bancos listados e de onde vem o resultado?",
    importa: "O mercado precifica expectativas sobre lucro, risco e capital — uma leitura independente da contabilidade.",
    ler: "O ROE da companhia listada difere do ROE do conglomerado prudencial: perímetros distintos, declarados em cada número. Retorno total reinveste proventos, bruto de imposto.",
    nao: "Nada aqui é recomendação de investimento. Múltiplos baixos podem indicar risco percebido, não oportunidade." },
  pix: { q: "Como o Pix evoluiu e como se compara aos outros meios de pagamento?",
    importa: "Em cinco anos o Pix reorganizou o sistema de pagamentos brasileiro e mudou a relação das pessoas com conta bancária e dinheiro físico.",
    ler: "Os totais usam o universo completo do BCB; as composições usam a base transacional, que cobre parte dele — a cobertura vem declarada ao lado. A comparação entre instrumentos é trimestral porque cartões não têm série mensal.",
    nao: "O Pix não é categoria homogênea: mistura transferência pessoal, pagamento comercial e tesouraria empresarial. Não é substituto direto de nenhum instrumento isolado." },
  openfinance: { q: "O que o Dashboard do Cidadão publica sobre o Open Finance Brasil?",
    importa: "É a divulgação oficial da estrutura: consentimentos ativos e chamadas de API, em periodicidade semanal, com aberturas por fase, instituição, família de API e endpoint.",
    ler: "Consentimentos ativos são apresentados nas visões das instituições transmissoras e receptoras de dados; as chamadas de API são publicadas por fase e nas aberturas divulgadas pela fonte.",
    nao: "Esta página reproduz exclusivamente as métricas publicadas pelo Dashboard do Cidadão. Métricas não divulgadas pela fonte — como consentimentos por instituição ou clientes únicos — não são apresentadas nem estimadas." },
  judicial: { q: "Quanto e por que o Judiciário é acionado em temas bancários?",
    importa: "A litigiosidade é custo, sinal de atrito com o cliente e passivo contingente — e no Brasil é excepcionalmente alta.",
    ler: "Há duas camadas que nunca se cruzam: a nacional (DataJud) não identifica instituições porque a fonte não publica as partes; a nominal (TST) identifica, mas cobre só um tribunal e os dez maiores.",
    nao: "Volume de processos não é evidência de irregularidade: depende de escala, perfil de cliente, presença geográfica e prática local de litigância." },
  scenarios: { q: "O que acontece com o crédito sob choques macroeconômicos?",
    importa: "Testar sensibilidade a juros, desemprego e atividade é o método padrão de supervisão para avaliar resiliência.",
    ler: "As elasticidades são estimadas nas séries históricas e estão declaradas. Cenário é exercício condicional, não previsão.",
    nao: "Relações estimadas no passado podem não valer em rupturas estruturais. Nenhum cenário aqui tem probabilidade atribuída." },
  alerts: { q: "O que mudou e merece atenção agora?",
    importa: "Monitorar continuamente evita descobrir deterioração só quando ela já está consolidada.",
    ler: "Os alertas vêm em cinco famílias, cada uma com o seu universo e a sua periodicidade. Leia dentro da família: a ordem de uma seção não vale como prioridade sobre outra.",
    nao: "Alerta não é diagnóstico nem previsão, e a contagem de famílias diferentes não se soma. Ausência de alerta é ausência de regra disparada, não ausência de risco." },
  pgfn: { q: "Quanto o país deve ao fisco federal, e onde essa dívida está?",
    importa: "Dívida ativa é passivo que a empresa e a família já não conseguiram pagar ao Estado — costuma aparecer no mesmo terreno em que o crédito privado se deteriora.",
    ler: "Compare UFs pela participação no total e pela dívida de PF por mil habitantes. A concentração por faixa de valor explica mais do que a contagem de inscrições.",
    nao: "Não é crédito do sistema financeiro e não se soma ao SCR.data. A série por safra mostra o que sobrou de cada ano, não quantas inscrições houve nele." },
  desenrola: { q: "O que o Desenrola fez, e o que os dados públicos permitem afirmar?",
    importa: "Foi a maior política de renegociação de dívidas de pessoas físicas já feita no país, e boa parte do que se diz sobre ela não é verificável nos dados abertos.",
    ler: "Separe sempre o que a base do BCB mede — operações de crédito no SCR — do que o programa fez no total. Os números oficiais e os do SCR não se contradizem: medem coisas diferentes.",
    nao: "Operação não é pessoa, valor após desconto não é dívida original, e baixa de registro negativo não é pagamento. Nada aqui sustenta afirmação de efeito causal do programa." },
  operacional: { q: "Como os bancos operam por trás do balanço — gente, rede física e auditoria?",
    importa: "Emprego, presença territorial e quem audita quem são a dimensão operacional do sistema financeiro — e ninguém a reúne em série comparável, embora cada número exista em fonte oficial.",
    ler: "Compare cada instituição com a própria história. Empregados vêm do FRE, no escopo que a companhia declara; a rede vem do ESTBAN, do banco operacional. São universos diferentes: não os some.",
    nao: "Queda de agências num CNPJ pode ser migração societária, não fechamento real — as verificações automáticas sinalizam esses casos. Troca de auditor inclui o rodízio obrigatório e não é, por si, sinal de problema." },
  penetracao: { q: "Onde há menos crédito do que o tamanho do município sugeriria?",
    importa: "Mostra em que lugares o sistema financeiro chega menos do que a renda e a população locais indicariam — o primeiro passo para discutir acesso a crédito no território.",
    ler: "Compare a penetração de um município com a de seus pares, não com a média nacional. O gap é a distância para municípios parecidos, e vem com faixa de referência.",
    nao: "O saldo é o contabilizado nas dependências, não o crédito dos moradores. Baixa penetração não prova restrição de oferta, e o gap não é demanda comprovada nem dinheiro que falta." },
  consignado: { q: "Onde envelhecimento e dependência de benefícios tornam o consignado socialmente sensível?",
    importa: "Aposentadorias e pensões sustentam a economia de centenas de municípios, e o consignado é o crédito que se apoia nessa renda. Ver as duas coisas no território mostra onde decisões de crédito têm mais consequência.",
    ler: "Separe o que é observado do que é alocado: demografia e benefícios são municipais e medidos; consignado é estadual e medido; a versão municipal do consignado é estimativa. A relação entre dependência e crédito só é lida no nível estadual.",
    nao: "O município do benefício é o do órgão pagador, o valor já vem líquido do consignado, e a contagem é de créditos e não de pessoas. Reclamação mede propensão a reclamar, não incidência. Nada aqui é evidência causal." },
  moradia: { q: "Como o Brasil mora, e onde o crédito imobiliário chega?",
    importa: "Moradia é o maior ativo das famílias e o crédito imobiliário é a maior carteira de pessoa física do país. Ver as duas coisas juntas mostra a distância entre morar e financiar.",
    ler: "Trate as três bases como medidas distintas: o Censo conta domicílios, o ESTBAN registra saldo contabilizado por município e o Mercado Imobiliário detalha o crédito residencial por estado. Nenhuma se converte na outra.",
    nao: "Domicílio ainda sendo pago não é contrato bancário, o verbete 169 não é crédito habitacional residencial, e a lacuna estimada não é demanda comprovada. Nenhum comprometimento de renda observado é publicado aqui." },
  research: { q: "Como levar estes dados para um relatório ou uma aula?",
    importa: "Dado público só vira conhecimento quando é reproduzível por terceiros.",
    ler: "Cada exportação carrega fonte, data-base e metodologia. As URLs preservam filtros e podem ser citadas.",
    nao: "Os arquivos refletem a data-base da coleta; fontes oficiais revisam séries retroativamente." },
  method: { q: "De onde vem cada número e como foi calculado?",
    importa: "Sem metodologia aberta, um painel é apenas uma opinião com gráficos.",
    ler: "O dicionário traz definição, fórmula, fonte, periodicidade e limitação de cada indicador; a linhagem liga cada arquivo publicado ao dado bruto que o originou.",
    nao: "Nenhuma metodologia elimina as limitações das fontes — elas estão declaradas, não resolvidas." },
};
function guiaPagina(view) {
  const g = GUIA[view];
  if (!g) return "";
  return `<details class="guia"><summary><span class="guiaq">${g.q}</span><span class="guiamais">entenda esta página</span></summary>
    <div class="guiabody">
      <div><h5>Por que importa</h5><p>${g.importa}</p></div>
      <div><h5>Como ler</h5><p>${g.ler}</p></div>
      <div><h5>O que os dados não permitem concluir</h5><p>${g.nao}</p></div>
    </div></details>`;
}


/* ---------- navegação: acordeão + busca ----------
   Com 24 páginas, a lista inteira aberta vira ruído. Cada grupo agora colapsa e
   só o grupo da página atual fica aberto; um campo de busca filtra por nome.
   Nenhuma página foi removida e nenhuma rota mudou. */
function navGrupoAtivo() {
  const b = document.querySelector(`#tabs button[data-view="${currentView()}"]`);
  return b ? b.closest(".navgroup") : null;
}
function navSincroniza() {
  const ativo = navGrupoAtivo();
  document.querySelectorAll("#tabs .navgroup").forEach(g => {
    g.classList.toggle("aberto", g === ativo);
  });
}
window.navToggleGrupo = ev => {
  const g = ev.currentTarget.closest(".navgroup");
  g.classList.toggle("aberto");
  ev.stopPropagation();
};
window.navFiltra = termo => {
  const t = (termo || "").trim().toLowerCase();
  const tabs = document.getElementById("tabs");
  tabs.classList.toggle("buscando", !!t);
  let achou = 0;
  tabs.querySelectorAll(".navgroup").forEach(g => {
    let visiveis = 0;
    g.querySelectorAll("button[data-view]").forEach(b => {
      const ok = !t || b.textContent.toLowerCase().includes(t);
      b.style.display = ok ? "" : "none";
      if (ok) visiveis++;
    });
    g.style.display = visiveis ? "" : "none";
    achou += visiveis;
  });
  if (!t) navSincroniza();
  const vazio = document.getElementById("navVazio");
  if (vazio) vazio.hidden = achou > 0;
};
function navPrepara() {
  const tabs = document.getElementById("tabs");
  if (!tabs || tabs.dataset.pronto) return;
  tabs.dataset.pronto = "1";
  tabs.querySelectorAll(".navgroup .navlabel").forEach(lb => {
    lb.setAttribute("role", "button");
    lb.setAttribute("tabindex", "0");
    lb.addEventListener("click", window.navToggleGrupo);
    lb.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); window.navToggleGrupo(e); } });
  });
  navSincroniza();
}


/* ---------- exportação universal ----------
   Toda página exporta o que está na tela, sem que cada uma precise implementar
   o seu próprio botão. Funciona porque cada gráfico já publica a alternativa
   tabular no DOM (details.charttable): a planilha sai com uma aba por tabela
   visível, mais uma aba "Sobre" com a procedência — página, pergunta que ela
   responde, data-base, momento do processamento, fontes e a URL exata da
   consulta, para que o arquivo continue auditável depois de baixado. */
let ULTIMO_HEAD = {};

function xlsxMulti(planilhas) {
  // generaliza xlsxBlob para várias abas (mesmo ZIP store + SpreadsheetML)
  const partes = [], sheetsXml = [], relsXml = [], overrides = [];
  planilhas.forEach((pl, i) => {
    const n = i + 1;
    const rowsXml = pl.linhas.map((r, ri) => `<row r="${ri + 1}">` + r.map((v, ci) => {
      if (v == null || v === "") return "";
      const ref = colLetter(ci) + (ri + 1);
      return typeof v === "number" && isFinite(v)
        ? `<c r="${ref}"><v>${v}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(String(v))}</t></is></c>`;
    }).join("") + "</row>").join("");
    partes.push({ name: `xl/worksheets/sheet${n}.xml`, text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>` });
    sheetsXml.push(`<sheet name="${xmlEsc(pl.nome)}" sheetId="${n}" r:id="rId${n}"/>`);
    relsXml.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`);
    overrides.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  });
  return zipStore([
    { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides.join("")}</Types>` },
    { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsXml.join("")}</Relationships>` },
    { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml.join("")}</sheets></workbook>` },
    ...partes,
  ]);
}

/** Número em pt-BR vira número de verdade na planilha. Valores com unidade
    embutida (%, R$) ficam como texto: converter apagaria a unidade em silêncio. */
function numeroPtBr(txt) {
  const t = String(txt).trim();
  if (!t || /[%R$]/.test(t)) return null;
  if (!/^[-+]?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(t)) return null;
  const n = parseFloat(t.replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}

function nomeAba(usados, bruto) {
  let nome = (bruto || "Tabela").replace(/[\\/?*\[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "Tabela";
  let final = nome, i = 2;
  while (usados.has(final)) final = `${nome.slice(0, 25)} ${i++}`;
  usados.add(final);
  return final;
}

/** Lê as tabelas renderizadas na view ativa, inclusive as alternativas tabulares
    dos gráficos (que ficam dentro de <details>, fechadas). */
function tabelasDaPagina(view) {
  const raiz = document.getElementById(`view-${view}`);
  if (!raiz) return [];
  const out = [], usados = new Set();
  // percorre títulos e tabelas na ORDEM do documento: cada tabela herda o
  // último título que apareceu antes dela — é como o leitor entende a página.
  let titulo = "";
  raiz.querySelectorAll("h2, h3, h4, h5, summary, table").forEach(no => {
    if (no.closest(".guia")) return;  // o guia didático não titula seção nem exporta
    if (no.tagName !== "TABLE") {
      const t = (no.textContent || "").replace(/\s+/g, " ").trim();
      // "dados em tabela" e afins não nomeiam nada: mantêm o título anterior
      if (t && !/^(dados em tabela|ver dados|tabela)\b/i.test(t)) titulo = t;
      return;
    }
    const linhas = [];
    no.querySelectorAll("tr").forEach(tr => {
      const cels = [...tr.querySelectorAll("th,td")].map(c => {
        const txt = (c.innerText || c.textContent || "").replace(/\s+/g, " ").trim();
        const n = numeroPtBr(txt);
        return n == null ? txt : n;
      });
      if (cels.some(c => c !== "")) linhas.push(cels);
    });
    if (linhas.length < 2) return;  // tabela de layout, não de dados
    out.push({ nome: nomeAba(usados, titulo || "Tabela"), linhas });
  });
  return out;
}

window.exportarPagina = () => {
  const view = currentView();
  const tabelas = tabelasDaPagina(view);
  const meta = state.data.meta || {};
  const g = GUIA[view] || {};
  const vintage = ULTIMO_HEAD.vintage || pageVintage(view) || "";
  const sobre = [
    ["Observatório Brasileiro de Crédito"],
    [],
    ["Página", VIEW_TITLES[view] || view],
    ["Pergunta que responde", g.q || ""],
    ["Dados até", vintage],
    ["Processado em", meta.gerado_em || ""],
    ["Exportado em", new Date().toISOString().slice(0, 19).replace("T", " ")],
    ["Fontes", ULTIMO_HEAD.fontes || ""],
    ["URL da consulta", location.href],
    [],
    ["Como ler", g.ler || ""],
    ["O que os dados não permitem concluir", g.nao || ""],
    [],
    ["Aviso", "Valores com unidade embutida (%, R$) foram mantidos como texto para não perder a unidade. Células vazias significam dado ausente na fonte — nunca zero."],
    ["Metodologia", "scrutiniums.com/metodologia"],
  ];
  if (!tabelas.length) {
    alert("Esta página é textual e não tem tabelas de dados para exportar. As páginas com números — Panorama, Pix, Instituições, Taxas, entre outras — exportam normalmente.");
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(xlsxMulti([{ nome: "Sobre", linhas: sobre }, ...tabelas]));
  a.download = `observatorio-${view}${vintage ? "-" + vintage : ""}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
};

function pageHead(o) {
  ULTIMO_HEAD = o || {};
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
      <button class="btn ghost small" onclick="exportarPagina()" title="planilha com as tabelas desta página e a procedência dos dados">exportar planilha</button>
      <button class="btn ghost small" onclick="pvSave()">salvar visão</button>
      ${(loadLS("obc_views_url", []).length ? `<select onchange="pvLoad(this.value)" aria-label="visões salvas"><option value="">visões salvas…</option>${loadLS("obc_views_url", []).map((vx, i) => `<option value="${i}">${vx.nome}</option>`).join("")}</select>` : "")}
      <button class="btn ghost small" onclick="window.print()" title="usar 'Salvar como PDF' na impressão">PDF</button>
    </div>
  </div>${filterBar(currentView())}${guiaPagina(currentView())}`;
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
  ["recordes", "Recordes nas séries", true],
  ["explore", "Acesso rápido", true],
];
// arquivos gold que cada bloco opcional exige além do núcleo: só são baixados
// quando o usuário habilita o bloco (o padrão simples não paga esse custo)
const OV_BLOCO_DATA = {
  recordes: ["recordes"],
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
  // fetchGold marca null quando o gold falha; com filtro de segmento salvo no
  // localStorage, o acesso encadeado sem guarda derrubava a Visão geral inteira.
  const ibccBase = state.data.ibcc || {};
  const ibcc = seg === "total" ? ibccBase : (ibccBase.segmentos || {})[seg] || ibccBase;
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
      <div class="ph-meta">${pageVintage("overview") ? `Dados até <b>${pageVintage("overview")}</b> · processado em ` : "Última atualização: "}${meta.gerado_em ? meta.gerado_em.slice(0, 16).replace("T", " ") + " UTC" : "–"} · fontes: BCB (SGS, IF.data, txjuros), IBGE, CNJ, Open Finance Brasil · <a href="javascript:void(0)" onclick="nav('method')">metodologia e fontes</a></div>${filterBar("overview")}${guiaPagina("overview")}
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
      <br><a href="javascript:void(0)" onclick="nav('research')">abrir pesquisa assistida →</a> · <a href="javascript:void(0)" onclick="leadSet('tab','protocolo');nav('leading')">indicadores antecedentes →</a></div></div>`;
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
    <p class="src" >Esta página resume as condições de crédito e é personalizável (botão "personalizar página"). Quatro portas de entrada respondem as perguntas mais comuns:</p>
    <div class="chips" style="margin-top:8px">
      <span class="chip clickable" onclick="nav('panorama');ovDispensarBoasVindas()" tabindex="0" role="link">Como está o crédito no meu estado? →</span>
      <span class="chip clickable" onclick="nav('juros');ovDispensarBoasVindas()" tabindex="0" role="link">Qual banco cobra menos em cada modalidade? →</span>
      <span class="chip clickable" onclick="nav('compare');ovDispensarBoasVindas()" tabindex="0" role="link">Comparar instituições lado a lado →</span>
      <span class="chip clickable" onclick="nav('leading');ovDispensarBoasVindas()" tabindex="0" role="link">Há sinais de estresse à frente? →</span>
    </div>
    <div class="src" style="margin-top:8px">Todo número tem fonte, período e limitações declaradas — <a href="javascript:void(0)" onclick="nav('method')">metodologia completa</a>. Alertas com regra publicada ficam na aba Alertas (com RSS).</div>
  </div>` : "";
  /* Recordes automáticos: pauta pronta com régua declarada — posição
     aritmética na própria série, nunca juízo de mérito. */
  const REC = state.data.recordes;
  const secRecordes = !REC || !REC.disponivel || !(REC.recordes || []).length ? "" : `
  <div class="sechead"><h3>Recordes nas séries</h3><span class="src">detecção automática · janela mínima ${REC.janela_minima_meses} meses · ${badge("calculado", REC.metodo)}</span></div>
  <div class="card">
    <div class="tblwrap"><table class="data compact">
      <thead><tr><th>Série</th><th>Recorde</th><th class="num">Valor</th><th>Referência</th></tr></thead>
      <tbody>${REC.recordes.slice(0, 10).map(r => `<tr>
        <td>${r.nome}</td>
        <td>${r.tipo.includes("historico") ? `<b>${r.rotulo}</b>` : r.rotulo} <span class="src">(${r.anos} anos)</span></td>
        <td class="num"><b>${fmt.n(r.valor, 2)}</b> <span class="src">${r.unidade}</span></td>
        <td>${String(r.ref).slice(0, 7)}</td></tr>`).join("")}</tbody></table></div>
    <p class="src">${(REC.cautelas || [])[0] || ""}</p>
  </div>`;

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
    recordes: secRecordes,
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
      ${annotations.length ? `<div class="src">marcadores no gráfico = eventos estatísticos detectados (aba Protocolo e regimes) — hipóteses, não fatos.</div>` : ""}
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
/* Protocolo formal de antecedência — antes uma página própria (/leading-indicators),
   hoje uma aba desta mesma página: o radar levanta candidatos, o protocolo decide
   quais sobrevivem aos quatro critérios. Retorna HTML para o host renderizar. */
function blocoProtocolo() {
  const { antecedentes, regimes } = state.data;
  if (!antecedentes || !antecedentes.targets) return `<p class="src">carregando o protocolo de antecedentes…</p>`;
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
  return `
  ${sechead("Quais indicadores realmente antecedem a inadimplência?", "protocolo de 4 critérios — aprovados e reprovados declarados")}
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
      <p class="src">Antecedentes promovidos (agregado): spread (6m) e Selic (8m) — aba Protocolo e regimes; triagem setorial específica na Fase 2b.</p>
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
        ${c.credores && c.credores.bancos && c.credores.bancos.length ? `<b>Credores financeiros citados:</b> ${c.credores.bancos.map(b => `${b.nome}${b.valor ? ` (R$ ${b.valor} — observada)` : " (parcialmente observada)"}`).join("; ")}<br>` : ""}
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
  /* tipo pela classificação TCB do próprio BCB: B3C/B3S = cooperativas;
     B1/B2/B4 = bancos; N* = não bancárias. Nunca por heurística de nome. */
  const tipoDe = (i) => /^B3/.test(i.tcb || "") ? "coop" : /^B/.test(i.tcb || "") ? "banco" : "naobanco";
  if ((f.instTipo || "todos") !== "todos") list = list.filter(i => tipoDe(i) === f.instTipo);
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
          ${i.carteira_perfil.hhi_setorial != null ? `<b>${termo("hhi","HHI setorial")} (piso):</b> ${i.carteira_perfil.hhi_setorial}${i.carteira_perfil.hhi_cobertura_pct != null ? ` <span class="src">sobre os ${i.carteira_perfil.hhi_cobertura_pct}% setorialmente identificados — "outros" é agregado, nunca entra ao quadrado</span>` : ""}` : ""}
          ${i.carteira_perfil.top_cnae ? `<br><b>Setores PJ:</b> ${i.carteira_perfil.top_cnae.map(([n, s]) => `${setorLabel(n).slice(0, 32)} ${s}%`).join(" · ")}` : ""}
          ${i.carteira_perfil.top_mod_pf ? `<br><b>Modalidades PF:</b> ${i.carteira_perfil.top_mod_pf.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 28)} ${s}%`).join(" · ")}` : ""}
          ${i.carteira_perfil.top_mod_pj ? `<br><b>Modalidades PJ:</b> ${i.carteira_perfil.top_mod_pj.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 28)} ${s}%`).join(" · ")}` : ""}
        </div>` : ""}
        ${i.captacao ? `<h5>Custo de captação ${badge("calculado", i.captacao.formula)}</h5><div class="src">
          <b>${fmt.n(i.captacao.custo_aa_pct, 2)}% a.a.</b> (estimado; DRE de ${i.captacao.meses_dre} meses anualizada${i.captacao.media_pontas ? ", média das pontas" : ", ponta única"})
          ${i.captacao.dep_captacoes_pct != null ? ` · depósitos = ${i.captacao.dep_captacoes_pct}% das captações` : ""}
          ${i.captacao.mix_depositos_pct ? `<br><b>Mix de depósitos:</b> ${Object.entries(i.captacao.mix_depositos_pct).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([n, s]) => `${n} ${s}%`).join(" · ")}` : ""}
          <br>${i.captacao.limitacoes}</div>` : ""}
        ${i.modelo_negocio ? `<h5>Modelo de negócio ${badge("calculado")}</h5><div class="src">
          ${i.modelo_negocio.receita_servicos_pct != null ? `<b>Serviços na receita operacional:</b> ${i.modelo_negocio.receita_servicos_pct}% <span title="${i.modelo_negocio.receita_servicos_conceito}">ⓘ</span> · ` : ""}
          ${i.modelo_negocio.eficiencia_pct != null ? `<b>eficiência:</b> ${i.modelo_negocio.eficiencia_pct}% <span title="${i.modelo_negocio.eficiencia_conceito}">ⓘ</span> · ` : ""}
          ${i.modelo_negocio.credito_ativo_pct != null ? `<b>crédito/ativo:</b> ${i.modelo_negocio.credito_ativo_pct}% · ` : ""}
          ${i.modelo_negocio.captacoes_ativo_pct != null ? `<b>captações/ativo:</b> ${i.modelo_negocio.captacoes_ativo_pct}%` : ""}
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
    <span class="seg">${[["todos", "todas"], ["banco", "bancos"], ["coop", "cooperativas"], ["naobanco", "não bancárias"]].map(([k, l]) => `<button class="${(f.instTipo || "todos") === k ? "active" : ""}" onclick="setFilter('instTipo','${k}')">${l}</button>`).join("")}</span>
    <span class="seg">${[["ativo", "por ativo"], ["score", "por score"], ["inad", "por inadimplência"], ["deterioracao", "por deterioração 4T"], ["nome", "A–Z"]].map(([k, l]) => `<button class="${f.sortInst === k ? "active" : ""}" onclick="setFilter('sortInst','${k}')">${l}</button>`).join("")}</span>
    <button class="btn ghost small" onclick="exportInstitutions()">exportar JSON</button>
  </div>
  <div class="tblwrap"><table class="data"><thead><tr><th>Instituição / grupo</th><th>Ativo / ${termo("carteira-de-credito","carteira")}</th><th>${termo("indice-de-basileia","Basileia")}</th><th>${termo("inadimplencia-90","Inadimplência")} ${badge("observado","carteira >90d ÷ carteira ativa — IF.data instrumentos financeiros")}</th><th>${termo("roe","ROE")} per.</th><th>${termo("score-relativo","Score risco")}</th><th>Evolução (5 trim.)</th><th>Basileia pós-choque severo</th><th>Ficha</th></tr></thead><tbody>${rows}</tbody></table></div>
  ${guidanceSecao()}
  ${regimesSecao()}
  ${coopSecao(inst)}
  ${interconexaoSecao(inst)}
  ${chartFooter({ fonte: `BCB IF.data (Olinda), conglomerados prudenciais, ${inst.anomes}`, periodo: inst.anomes + (inst.anomes_anterior ? ` (Δ vs. ${inst.anomes_anterior})` : ""), atualizado: state.data.meta ? state.data.meta.gerado_em.slice(0, 10) : "–", unidade: "R$", nota: inst.metodo })}`;
}

/* Promessas × entrega (Fase 2 — publica só aprovado): guidance dos grandes
   listados, cada banco SÓ contra o próprio guidance. 'dentro/acima/abaixo'
   é posição aritmética no intervalo declarado, não juízo de mérito — nunca
   ranking nem média de cumprimento entre bancos. */
/* Rótulo de setor CNAE: o balde "outros" da fonte é um agregado residual —
   nunca aparece como se fosse um setor. */
const setorLabel = (k) => k === "outros" ? "outros (não classificados)" : k.replace(/_/g, " ");

/* Bloco de um ciclo de guidance — compartilhado entre a seção da aba
   Instituições e a ficha individual da IF, para as duas superfícies nunca
   divergirem em régua ou evidência. */
function guidSitChip(m) {
  return m.situacao === "dentro" ? `<span class="chip" style="background:var(--ok-bg,#e8f2ea)">dentro</span>`
    : m.situacao === "em_curso" ? `<span class="chip">em curso</span>`
    : `<span class="chip" style="background:var(--warn-bg,#f6ead8)">${m.situacao}</span>`;
}
function guidFaixa(m) {
  if (m.realizado == null) return `${fmt.n(m.min, 1)} a ${fmt.n(m.max, 1)} ${m.unidade}`;
  return `${fmt.n(m.min, 1)}–${fmt.n(m.max, 1)} → <b>${fmt.n(m.realizado, 1)}</b> ${m.unidade}`;
}
function guidCicloBloco(c) {
  return `
    <h5 style="margin:12px 0 4px">${c.banco} · ${c.ano}${c.tipo === "guidance_vigente" ? " (em curso)" : c.tipo === "ausencia_declarada" ? "" : " — fechado"}
      <span class="src">· aferido por: ${c.aferido_por === "companhia" ? "própria companhia" : "Observatório (fórmula declarada por métrica)"}</span></h5>
    ${c.tipo === "ausencia_declarada" ? `<p class="src">${c.conceito}</p>` : `
    <div class="tblwrap"><table class="data compact">
      <thead><tr><th>Métrica (conceito do próprio banco)</th><th>Intervalo → realizado</th><th>Situação</th></tr></thead>
      <tbody>${(c.metricas || []).map(m => `<tr>
        <td>${m.nome}${m.formula ? ` <span title="${attr(m.formula)}">ⓘ</span>` : ""}${m.nota ? ` <span class="src">(${m.nota})</span>` : ""}</td>
        <td>${guidFaixa(m)}</td><td>${guidSitChip(m)}</td></tr>`).join("")}</tbody></table></div>`}
    ${(c.acompanhamentos || []).map(a => `<div class="note ${a.tipo === "revisao" ? "warn" : ""}" style="margin:6px 0">
      <b>${a.periodo} — ${a.tipo === "revisao" ? "guidance REVISADO" : "acompanhamento"}:</b> ${a.resumo}
      ${a.realizado_parcial ? `<br><span class="src">${a.realizado_parcial.map(r => `${r.metrica}: ${fmt.n(r.valor, 1)} (${r.unidade})`).join(" · ")}</span>` : ""}
      <br><span class="src">Evidência: ${a.pagina} — <a href="${attr(a.documento.url)}" target="_blank" rel="noopener">${(a.documento.titulo || "documento").slice(0, 52)}</a></span></div>`).join("")}
    ${c.acompanhamento_pendente ? `<p class="src">⏳ ${c.acompanhamento_pendente}</p>` : ""}
    <p class="src">${c.conceito} · Evidência: ${c.pagina} — ${Object.values(c.documentos || {}).map(d =>
      `<a href="${attr(d.url)}" target="_blank" rel="noopener">${(d.titulo || "documento").slice(0, 52)}</a>`).join(" · ")}</p>`;
}

function guidanceSecao() {
  const G = state.data.guidance;
  if (!G || !G.disponivel) return "";
  if (!(G.ciclos || []).length) {
    return G.em_revisao ? `<div class="card" style="margin-top:12px"><h4>Promessas × entrega — guidance dos grandes listados</h4>
      <p class="src">${fmt.n0(G.em_revisao)} ciclo(s) de guidance extraídos dos documentos oficiais (CVM/IPE) aguardando revisão
      editorial — nada é publicado sem aprovação humana e evidência (documento, página e trecho).</p></div>` : "";
  }
  const cards = G.ciclos.map(guidCicloBloco).join("");
  return `<div class="card" style="margin-top:12px"><h4>Promessas × entrega — ${termo("guidance","guidance")} dos grandes listados ${badge("observado", G.fonte.nota)}</h4>
    <p style="margin:6px 0">${G.leitura}</p>
    ${cards}
    ${(G.cautelas || []).map(c => `<p class="src">${c}</p>`).join("")}
    <p class="src">${G.fonte.nome} · nível ${G.fonte.nivel}${G.em_revisao ? ` · ${fmt.n0(G.em_revisao)} ciclo(s) ainda em revisão` : ""}${G.acompanhamentos_em_revisao ? ` · ${fmt.n0(G.acompanhamentos_em_revisao)} acompanhamento(s) trimestral(is) aguardando revisão editorial` : ""}.</p></div>`;
}

/* O risco realizado, ao vivo: instituições sob regime de resolução do BCB
   (lista oficial vigente, diária) + memória acumulada pelo Observatório.
   Regime em instituição pequena NÃO é sinal sistêmico — dito na cautela. */
function regimesSecao() {
  const R = state.data.regimes;
  if (!R || !R.disponivel) return "";
  const linhas = (R.vigentes || []).map(v => `<tr>
    <td><b>${v.nome}</b><div class="src">CNPJ ${v.cnpj8} · ${v.municipio || "–"}/${v.uf || "–"}</div></td>
    <td>${v.tipo}</td><td>${v.inicio}</td>
    <td class="src">${v.responsavel || "–"}</td></tr>`).join("");
  const enc = R.encerrados_ou_saidos || [];
  return `<div class="card" style="margin-top:12px"><h4>Sob ${termo("regime-de-resolucao","regime de resolução")} do BCB ${badge("observado", "lista oficial vigente do BCB (Olinda regimes_especiais), atualização diária")}</h4>
    <p style="margin:6px 0">${R.leitura}</p>
    <div class="tblwrap"><table class="data compact">
      <thead><tr><th>Instituição</th><th>Regime</th><th>Decretado em</th><th>Responsável nomeado</th></tr></thead>
      <tbody>${linhas}</tbody></table></div>
    ${enc.length ? `<details class="decomp"><summary>saíram da lista vigente desde o início do acompanhamento (${enc.length})</summary>
      <div class="src" style="margin-top:6px">${enc.map(e => `${e.nome} — ${e.tipo}, decretado ${e.inicio}; fora da lista após ${e.saiu_da_lista_apos}`).join("<br>")}</div></details>` : ""}
    ${(R.cautelas || []).map(c => `<p class="src">${c}</p>`).join("")}
    <p class="src">${badge("observado")} <a href="${attr(R.fonte.url)}" target="_blank" rel="noopener">${R.fonte.nome}</a> · nível ${R.fonte.nivel}.</p></div>`;
}

/* Cooperativas no corte: visibilidade do segmento que mais cresce, pela
   classificação TCB do próprio BCB (B3C centrais, B3S singulares) — nunca
   heurística de nome. Somar ativos aqui é legítimo: mesma métrica contábil
   do mesmo relatório; o denominador é o CORTE (top-N), não o sistema. */
function coopSecao(inst) {
  const insts = inst.instituicoes || [];
  const coops = insts.filter(i => /^B3/.test(i.tcb || ""));
  if (!coops.length) return "";
  const atCoop = coops.reduce((s, i) => s + i.ativo_total_brl, 0);
  const atTodos = insts.reduce((s, i) => s + i.ativo_total_brl, 0);
  const centrais = coops.filter(i => i.tcb === "B3C").length;
  return `<div class="card" style="margin-top:12px"><h4>Cooperativas de crédito no corte ${badge("observado", "classificação TCB do IF.data: B3C = centrais/confederações, B3S = singulares; os bancos cooperativos (Sicredi, Sicoob) são B1 e entram como bancos")}</h4>
    <div class="pan-kpi" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">
      <div><div class="src">no corte das ${insts.length} maiores</div><div class="big" style="font-size:20px">${coops.length} cooperativas</div></div>
      <div><div class="src">centrais/confederações</div><div class="big" style="font-size:20px">${centrais}</div></div>
      <div><div class="src">ativo somado (corte)</div><div class="big" style="font-size:20px">${fmt.money(atCoop)}</div></div>
      <div><div class="src">share do ativo do corte</div><div class="big" style="font-size:20px">${fmt.n(atCoop / atTodos * 100, 1)}%</div></div>
    </div>
    <p class="src">Os bancos cooperativos (Banco Sicredi, Banco Sicoob) são TCB B1 e aparecem no filtro "bancos" — o braço bancário dos sistemas, não as cooperativas em si. O share é do CORTE dos ${insts.length} maiores, não do sistema inteiro. Use o filtro "cooperativas" acima para isolar o segmento na tabela.</p></div>`;
}

/* Interconexão via funding: quanto das captações de cada IF vem de DEPÓSITOS
   INTERFINANCEIROS — dinheiro de outras instituições. É um PROXY do lado
   passivo: a matriz bilateral (quem deve a quem) NÃO é pública, e isso é
   dito. Calculado dos blocos de captação já publicados por IF. */
function interconexaoSecao(inst) {
  const linhas = (inst.instituicoes || [])
    .filter(i => i.captacao && i.captacao.mix_depositos_pct &&
                 i.captacao.mix_depositos_pct.interfinanceiro != null && i.captacao.dep_captacoes_pct != null)
    .map(i => {
      const cap = i.captacao;
      const interfDasCaptacoes = cap.mix_depositos_pct.interfinanceiro * cap.dep_captacoes_pct / 100;
      return { nome: i.nome, cod: i.cod_inst, pct: interfDasCaptacoes,
               vol: cap.captacoes_brl * interfDasCaptacoes / 100, mixDep: cap.mix_depositos_pct.interfinanceiro };
    })
    .filter(x => x.pct >= 1)
    .sort((a, b) => b.pct - a.pct);
  if (!linhas.length) return "";
  return `<div class="card" style="margin-top:12px"><h4>Interconexão — funding interfinanceiro ${badge("calculado", "depósitos interfinanceiros ÷ captações totais, dos blocos de captação por IF (IF.data UI)")}</h4>
    <p style="margin:6px 0">Quanto das captações de cada instituição vem de depósitos de OUTRAS instituições — a dependência de funding bancário de atacado, um canal clássico de contágio. Proxy do lado passivo: a matriz bilateral (quem deve a quem) não é pública.</p>
    <div class="tblwrap"><table class="data compact">
      <thead><tr><th>Instituição</th><th class="num" title="depósitos interfinanceiros ÷ captações totais">Interfinanceiro / captações</th><th class="num">Volume estimado</th><th class="num">% dos depósitos</th></tr></thead>
      <tbody>${linhas.slice(0, 15).map(x => `<tr>
        <td><b>${x.nome}</b> <button class="btn ghost small" onclick="openInstPage('${x.cod}')">ficha →</button></td>
        <td class="num"><b>${fmt.n(x.pct, 1)}%</b></td>
        <td class="num">${fmt.money(x.vol)}</td>
        <td class="num src">${fmt.n(x.mixDep, 1)}%</td></tr>`).join("")}</tbody></table></div>
    <p class="src">Corte de exibição: dependência ≥ 1% das captações. Nas centrais cooperativas o interfinanceiro alto é DESENHO do sistema (as singulares depositam na central), não fragilidade — mais um motivo para nunca ler esta tabela como ranking de risco.</p></div>`;
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
  // A promessa em voo também entra no cache: dois renders em sequência rápida — o
  // segundo vinha do fluxo de navegação antes de o primeiro fetch resolver — disparavam
  // a mesma requisição duas vezes. Cachear só o dado resolvido não impede isso.
  state.instFetch = state.instFetch || {};
  if (!state.instFetch[cod]) {
    state.instFetch[cod] = fetch(`${DATA_BASE}inst/${cod}.json?v=${APP_VERSION}`)
      .then(r => { if (!r.ok) throw 0; return r.json(); });
  }
  state.instFetch[cod]
    .then(p => { state.instCache[cod] = p; if (state.filters.instCod === cod) renderInstPageData(el, p); })
    .catch(() => { delete state.instFetch[cod]; el.innerHTML = "<p>página indisponível para este código de instituição.</p>"; });
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
  const operSec = operBlocoInst(cab);
  const listadaSec = instListadaSecao(pg, cab);
  const temCaptacao = !!(sc.captacao || sc.modelo_negocio);
  const subnavItens = [["#s-resumo","Visão Geral"],["#s-kpis","Indicadores"],["#s-risco","Risco e Inadimplência"],["#s-atraso-prod","Atraso por Produto"],["#s-carteira","Carteira"]]
    .concat(temCaptacao ? [["#s-captacao","Captação/Modelo"]] : [])
    .concat([["#s-capital","Capital"],["#s-pares","Comparáveis"],["#s-recl","Reclamações/OF/RJ"]])
    .concat(operSec ? [["#s-oper","Operacional"]] : [])
    .concat(listadaSec.includes('id="s-guidance"') ? [["#s-guidance","Guidance"]] : [])
    .concat(listadaSec.includes('id="s-rem"') ? [["#s-rem","Remuneração"]] : [])
    .concat([["#s-limites","Limitações"]]);
  const subnav = `<div class="controls" style="position:sticky;top:0;background:var(--bg);z-index:5;padding:6px 0;border-bottom:1px solid var(--border)">
    ${subnavItens.map(([a,l])=>`<a class="btn ghost small" href="javascript:void(0)" onclick="document.querySelector('${a}').scrollIntoView({behavior:'smooth'})">${l}</a>`).join("")}
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
      <h4>${termo("score-relativo","Score de risco")} ${badge("calculado")}</h4>
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
        <div class="card kpi"><h4>${termo("inadimplencia-90","Inadimplência (>90d)")} ${inadChip("if90")}</h4><div class="big" style="font-size:21px">${fmt.n(q.inad_pct, 2)}%</div>
          <div class="delta ${(q.d_tri_pp||0) > 0 ? "up" : "down good"}">${q.d_tri_pp != null ? fmt.pp(q.d_tri_pp) + " p.p. no tri" : ""} · ${q.d_ano_pp != null ? fmt.pp(q.d_ano_pp) + " p.p. em 4T" : "4T: histórico insuficiente"}</div>
          <div class="src">tendência: <b>${q.tendencia}</b> (regra analítica ±0,20/0,50 p.p. — não regulatória)</div></div>
        <div class="card kpi"><h4>Posição nos pares (${q.grupo})</h4><div class="big" style="font-size:21px">p${q.percentil_pares}</div>
          <div class="src">mediana ${fmt.n(q.mediana_pares, 2)}%${grp.quartis ? ` · q1 ${grp.quartis.q1}% · q3 ${grp.quartis.q3}%` : ""} · n=${grp.n || "–"}</div></div>
        <div class="card kpi"><h4>${termo("ativos-problematicos","Ativos problemáticos")}</h4><div class="big" style="font-size:21px">${q.ativos_problematicos_pct != null ? fmt.n(q.ativos_problematicos_pct, 2) + "%" : "n/d"}</div><div class="src">conceito Res. 4.966 (inclui reestruturados/estágio 3)</div></div>
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
      <h4>${termo("atraso-15-90","Atraso ≥15 dias")} por produto ${badge("observado", ap.nota)} <span class="src">data-base ${ap.data_base}</span></h4>
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
  ${(function(){
    /* Liquidez e capital regulatórios (Pilar 3/KM1): join pelo CNPJ do líder
       do conglomerado — códigos de conglomerado mudam entre períodos, o
       CNPJ-raiz não. Fórmula regulatória única: mínimos anotados por métrica. */
    const P3G = state.data.pilar3;
    if (!P3G || !P3G.disponivel) return "";
    const cnpj8pg = String(cab.cnpj || "").replace(/\D/g, "").slice(0, 8);
    const p3 = (P3G.instituicoes || []).find(x => x.cod_inst === pg.cod_inst || (cnpj8pg && x.cnpj8 === cnpj8pg));
    if (!p3) return "";
    const M = P3G.metricas || {};
    const linha = (met) => {
      const u = p3.ultimo[met];
      if (u == null) return "";
      const serie = (p3.series[met] || []).map(x => x.v);
      const min = M[met] && M[met].minimo;
      return `<tr><td>${termo(({lcr_pct:"lcr",nsfr_pct:"nsfr",icp_pct:"capital-principal",nivel1_pct:"capital-principal",basileia_pct:"indice-de-basileia",acp_total_pct:"acp",margem_capital_principal_pct:"acp",alavancagem_pct:"alavancagem"})[met], (M[met] || {}).nome || met)}</td>
        <td class="num"><b>${fmt.n(u, 2)}%</b></td>
        <td class="num src">${min != null ? `mínimo ${fmt.n(min, 1)}%` : "–"}</td>
        <td>${serie.length > 2 ? sparkline(serie, 110, 24) : ""} <span class="src">${serie.length} trim.</span></td></tr>`;
    };
    const ordem = ["lcr_pct", "nsfr_pct", "icp_pct", "nivel1_pct", "basileia_pct", "acp_total_pct", "margem_capital_principal_pct", "alavancagem_pct"];
    return `<div class="card" style="margin-top:12px"><h4>Liquidez e capital — ${termo("pilar-3","Pilar 3")} (KM1) ${badge("observado", "métricas-chave prudenciais no padrão da Res. BCB 54/2020, servidas pela própria instituição no arranjo DASFN do BCB")}</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Métrica</th><th class="num">Último (${p3.periodo_ultimo})</th><th class="num">Mínimo regulatório</th><th>Série</th></tr></thead>
      <tbody>${ordem.map(linha).join("")}</tbody></table></div>
      <p class="src">Registrante no DASFN: ${p3.nome}. ${termo("lcr","LCR")} mede 30 dias de estresse de liquidez; ${termo("nsfr","NSFR")} a liquidez estrutural — mínimos de 100%. A margem excedente é o capital acima do requerido com colchões (ACP).</p>
    </div>`;
  })()}
  <div class="grid g2" style="margin-top:12px">
    <div id="s-carteira" class="card"><h4>Composição da carteira ${pg.carteira.donut_cliente ? badge("observado") : ""}</h4>
      ${pg.carteira.donut_cliente ? donut(pg.carteira.donut_cliente) : "<p class='src'>detalhamento de carteira não reportado por esta instituição no IF.data.</p>"}
      ${pg.carteira.perfil ? `<div class="src" style="margin-top:8px">
        ${pg.carteira.perfil.top_mod_pf ? `<b>Modalidades PF:</b> ${pg.carteira.perfil.top_mod_pf.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 24)} ${s}%`).join(" · ")}<br>` : ""}
        ${pg.carteira.perfil.top_mod_pj ? `<b>Modalidades PJ:</b> ${pg.carteira.perfil.top_mod_pj.map(([n, s]) => `${n.replace(/_/g, " ").slice(0, 24)} ${s}%`).join(" · ")}<br>` : ""}
        ${pg.carteira.perfil.top_cnae ? `<b>Setores PJ:</b> ${pg.carteira.perfil.top_cnae.map(([n, s]) => `${setorLabel(n).slice(0, 32)} ${s}%`).join(" · ")}<br>` : ""}
        ${pg.carteira.perfil.pme_share_pct != null ? `<b>PME na carteira PJ:</b> ${pg.carteira.perfil.pme_share_pct}% · ` : ""}
        ${pg.carteira.perfil.hhi_setorial != null ? `<b>${termo("hhi","HHI setorial")} (piso):</b> ${pg.carteira.perfil.hhi_setorial}${pg.carteira.perfil.hhi_cobertura_pct != null ? ` <span class="src">sobre os ${pg.carteira.perfil.hhi_cobertura_pct}% setorialmente identificados</span>` : ""}` : ""}</div>` : ""}
    </div>
    <div class="card"><h4>Evolução (base 100) ${badge("observado")}</h4>${evolChart || "<p class='src'>histórico insuficiente.</p>"}</div>
  </div>
  ${temCaptacao ? `<div id="s-captacao" class="grid g2" style="margin-top:12px">
    <div class="card"><h4>${termo("custo-de-captacao","Custo de captação")} ${badge("calculado", sc.captacao ? sc.captacao.formula : "")}</h4>
      ${sc.captacao ? `<div class="big" style="font-size:22px">${fmt.n(sc.captacao.custo_aa_pct, 2)}% <span style="font-size:13px">a.a. (estimado)</span></div>
        <div class="src">Fórmula: ${sc.captacao.formula}.</div>
        <div class="src">Captações totais ${fmt.money(sc.captacao.captacoes_brl)}${sc.captacao.dep_captacoes_pct != null ? ` · depósitos = ${sc.captacao.dep_captacoes_pct}% das captações` : ""}</div>
        ${sc.captacao.mix_depositos_pct ? `<div style="margin-top:8px"><b>Mix de depósitos</b>
          ${Object.entries(sc.captacao.mix_depositos_pct).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([n, s]) => `<div class="contrib"><span class="lbl">${n}</span><span class="bar pos" style="width:${Math.min(s, 100) * 1.6}px"></span><span class="num">${s}%</span></div>`).join("")}</div>` : ""}
        <div class="src" style="margin-top:6px">${sc.captacao.limitacoes}</div>`
      : "<p class='src'>funding/DRE desta instituição ainda não coletados na data-base atual — ausência declarada, nunca zero.</p>"}
    </div>
    <div class="card"><h4>Modelo de negócio ${badge("calculado")}</h4>
      ${sc.modelo_negocio ? `
        ${sc.modelo_negocio.receita_servicos_pct != null ? `<div class="big" style="font-size:22px">${fmt.n(sc.modelo_negocio.receita_servicos_pct, 1)}% <span style="font-size:13px">da receita operacional vem de serviços</span></div>
          <div class="src">${sc.modelo_negocio.receita_servicos_conceito}</div>` : "<p class='src'>peso de serviços não calculável nesta data-base (DRE ausente ou intermediação negativa — omitido, nunca imputado).</p>"}
        ${sc.modelo_negocio.eficiencia_pct != null ? `<div style="margin-top:8px"><b>${termo("indice-de-eficiencia","Índice de eficiência")}:</b> ${fmt.n(sc.modelo_negocio.eficiencia_pct, 1)}% <span title="${attr(sc.modelo_negocio.eficiencia_conceito)}">ⓘ</span>
          <div class="src">pessoal ${fmt.money(Math.abs(sc.modelo_negocio.despesas_pessoal_brl))} · administrativas ${fmt.money(Math.abs(sc.modelo_negocio.despesas_admin_brl))} no período — quanto menor o índice, mais eficiente</div></div>` : ""}
        <div class="src" style="margin-top:6px">
          ${sc.modelo_negocio.credito_ativo_pct != null ? `<b>Crédito/ativo:</b> ${sc.modelo_negocio.credito_ativo_pct}% · ` : ""}
          ${sc.modelo_negocio.captacoes_ativo_pct != null ? `<b>captações/ativo:</b> ${sc.modelo_negocio.captacoes_ativo_pct}%` : ""}</div>
        <div class="src">O perfil da carteira (modalidades PF/PJ dominantes, PME, setores) está na seção Carteira acima — juntos, eles descrevem como a instituição capta, empresta e cobra por serviços.</div>`
      : "<p class='src'>DRE desta instituição ainda não coletada na data-base atual.</p>"}
    </div>
  </div>` : ""}
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
      ${pg.openfinance ? `<div class="src" style="margin-top:6px"><b>Open Finance:</b> ${pg.openfinance.share_pct}% das chamadas transacionais</div>` : ""}
    </div>
  </div>
  <div id="instSimilares"></div>
  ${operSec}
  ${listadaSec}
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
    const qn = _norm(q);
    const hit = idx.find(x => _norm(x.nome).includes(qn) || _norm(x.razao).includes(qn));
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
      <td>${fmt.n(i.taxa_sucesso_pct, 1)}%</td></tr>`).join("");
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
  <div class="tblwrap"><table class="data"><thead><tr><th>#</th><th>Instituição / papel</th><th>Consent. ativos</th><th>Intensidade de uso</th><th>Uso econômico</th><th>Sucesso API</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
      ${lineChart({ series: [{ pts: s.obs.map(o => ({ x: o.ref, y: o.v })), color, label: s.meta.name }], h: h || 130, unit: s.meta.unit, fonte: "Dashboard do Cidadão — Open Finance Brasil", status: "observado" })}
      ${chartFooter({ fonte: "Dashboard do Cidadão — Open Finance Brasil", periodo: `${fmt.d(s.obs[0].ref)}–${fmt.d(last.ref)} (semanal)`, atualizado: s.meta.last_collected_at ? s.meta.last_collected_at.slice(0, 10) : "–", unidade: s.meta.unit, nota: "Reprodução integral da métrica publicada pela fonte." })}</div>`;
  };
  const cons = of.consentimentos_atual;
  const fasesL = { dados_transacionais: "Dados transacionais", dados_abertos: "Dados abertos", iniciacao_pagamento: "Iniciação de pagamento" };
  const ultimaFase = k => { const s = of.series[k]; return s ? s.obs[s.obs.length - 1] : null; };
  const consTx = ultimaFase("of_consentimentos_transmitidos");
  const consRx = ultimaFase("of_consentimentos_recebidos");
  const kpis = `<div class="pan-kpi">
    ${[["Consentimentos ativos — transmissores", consTx, "mi"], ["Consentimentos ativos — receptores", consRx, "mi"],
       ["Chamadas na semana — dados transacionais", ultimaFase("of_chamadas_dados_transacionais"), "bi"],
       ["Chamadas na semana — dados abertos", ultimaFase("of_chamadas_dados_abertos"), "bi"],
       ["Chamadas na semana — iniciação de pagamento", ultimaFase("of_chamadas_iniciacao_pagamento"), "bi"]]
      .filter(([, o]) => o).map(([titulo, o, u]) => `<div class="card kpi"><h4>${titulo}</h4>
      <div class="big" style="font-size:21px">${u === "mi" ? fmt.n0(o.v / 1e6) + " mi" : fmt.n(o.v / 1e9, 1) + " bi"}</div>
      <div class="src">${badge("observado")} semana de ${fmt.d(o.ref)}</div></div>`).join("")}
  </div>`;
  const subnav = `<div class="controls" style="position:sticky;top:0;background:var(--bg);z-index:5;padding:6px 0;border-bottom:1px solid var(--border)">
    ${[["#of-cons","Consentimentos"],["#of-chamadas","Chamadas por fase"],["#of-inst","Por instituição"],["#of-detalhe","Famílias e endpoints"],["#of-escopo","Escopo e fonte"]].map(([a,l])=>`<a class="btn ghost small" href="javascript:void(0)" onclick="document.querySelector('${a}').scrollIntoView({behavior:'smooth'})">${l}</a>`).join("")}</div>`;
  const tabelaFase = (slug) => `<div class="card"><h4>${fasesL[slug]}</h4>
    <div class="tblwrap"><table class="data compact"><thead><tr><th>#</th><th>Organização</th><th class="num">Chamadas</th></tr></thead>
    <tbody>${(of.rankings_fase[slug] || []).map((r, i) => `<tr><td>${i + 1}</td><td>${r.organisation}</td><td class="num">${fmt.n0(r.chamadas / 1e6)} mi</td></tr>`).join("")}</tbody></table></div>
    <div class="src">Relação divulgada pela fonte (vinte maiores organizações da fase), em número de chamadas.</div></div>`;
  el.innerHTML = `
  ${pageHead({ title: "Open Finance", seals: badge("observado"),
    desc: "Métricas públicas do Dashboard do Cidadão do Open Finance Brasil: consentimentos ativos e chamadas de API por fase, por instituição, por família de API e por endpoint. Reprodução integral, sem indicadores derivados.",
    vintage: cons ? fmt.my(cons.ref) : null,
    fontes: "Open Finance Brasil — Dashboard do Cidadão" })}
  ${kpis}
  ${subnav}
  <div id="of-cons" style="margin-top:10px"><h3>Consentimentos ativos ${badge("observado")}</h3>
  <p class="src" style="max-width:80ch">Consentimentos ativos registrados na estrutura do Open Finance, nas visões das instituições
  transmissoras e receptoras de dados, conforme divulgação semanal do Dashboard do Cidadão.</p>
  <div class="grid g2">${sChart("of_consentimentos_transmitidos", "#1d4e89")}${sChart("of_consentimentos_recebidos", "#0e7c7b")}</div></div>
  <div id="of-chamadas"><h3>Chamadas de API por fase ${badge("observado")}</h3>
  <div class="grid g3">${sChart("of_chamadas_dados_transacionais", "#1d4e89")}${sChart("of_chamadas_dados_abertos", "#0e7c7b")}${sChart("of_chamadas_iniciacao_pagamento", "#6b46a3")}</div></div>
  <div id="of-inst"><h3>Chamadas por instituição ${badge("observado")}</h3>
  <div class="grid g3">${Object.keys(fasesL).map(tabelaFase).join("")}</div></div>
  <div id="of-detalhe"><h3>Chamadas por família de API e por endpoint ${badge("observado")}</h3>
  <div class="grid g3">${Object.entries(of.endpoints_top || {}).map(([s, e]) => `<div class="card"><h4>${fasesL[s]}</h4>
    ${(e.familias || []).slice(0, 5).map(x => `<div class="contrib"><span class="lbl" style="width:170px">${x.nome.slice(0, 26)}</span><span class="num">${fmt.n0(x.chamadas / 1e6)} mi</span></div>`).join("")}
    <div class="src" style="margin:6px 0 2px"><b>Endpoints:</b></div>
    ${(e.endpoints || []).slice(0, 6).map(x => `<div class="contrib"><span class="lbl" style="width:170px">${x.nome.slice(0, 26)}</span><span class="num">${fmt.n0(x.chamadas / 1e6)} mi</span></div>`).join("")}
    <div class="src">Acumulado da janela divulgada pela fonte.</div></div>`).join("")}</div></div>
  <div id="of-escopo"><h3>Escopo e fonte</h3><div class="card">
    <p class="src" style="font-size:13px;line-height:1.8;max-width:88ch">Esta página reproduz exclusivamente as métricas publicadas
    pelas rotas públicas do <b>Dashboard do Cidadão do Open Finance Brasil</b>, na periodicidade semanal da própria fonte:
    consentimentos ativos (transmissores e receptores) e chamadas de API por fase, por instituição, por família de API e por
    endpoint. Nenhum indicador é calculado, estimado ou combinado a outras fontes nesta página. Métricas não divulgadas pelo
    Dashboard não são apresentadas. Data-base: semana de ${cons ? fmt.d(cons.ref) : "–"} · cobertura das séries:
    ${Object.entries(of.qualidade_dados.semanas_por_serie).map(([k, v]) => `${k.replace("of_", "").replace(/_/g, " ")}: ${v} semanas`).join(" · ")}.</p>
  </div></div>`;
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


/* ---------- DÍVIDA ATIVA DA UNIÃO (PGFN) ----------
   Universo separado do crédito do SFN, e a página diz isso antes do primeiro
   número. Duas armadilhas da fonte aparecem como conteúdo, não como nota de
   rodapé: somar todas as linhas dobraria o total (corresponsáveis repetem o
   valor integral), e a série por safra é sobrevivência, não fluxo. */
const PGFN_METRICAS = {
  valor: { l: "Valor consolidado", esc: "seq", fmt: m => fmt.money(m.valor) },
  inscricoes: { l: "Inscrições", esc: "seq", fmt: m => fmt.n0(m.inscricoes) },
  insc_pf_por_mil_hab: { l: "Inscrições de PF por mil hab.", esc: "seq", fmt: m => m.insc_pf_por_mil_hab != null ? fmt.n(m.insc_pf_por_mil_hab, 1) : "n.d." },
  valor_medio: { l: "Valor médio por inscrição", esc: "seq", fmt: m => m.valor_medio != null ? "R$ " + fmt.n0(m.valor_medio) : "n.d." },
};
window.pgfnMetrica = m => { state.pgfnMet = m; renderPgfn(); };

/** Sombreado logarítmico. São Paulo concentra 40% do valor: numa escala linear
    todos os outros 26 estados ficariam brancos e o mapa não informaria nada. O log
    torna as diferenças visíveis e a legenda diz que a escala é logarítmica —
    sombreado comparável em ordem de grandeza, não em proporção direta. */
function pgfnEscala(vals) {
  const validos = vals.filter(v => v != null && v > 0).map(Math.log10);
  const lo = Math.min(...validos), hi = Math.max(...validos);
  return v => {
    if (v == null || v <= 0) return "var(--surface-2)";
    const t = (Math.log10(v) - lo) / Math.max(hi - lo, 1e-9);
    return `color-mix(in srgb, var(--accent) ${Math.round(8 + t * 80)}%, var(--surface))`;
  };
}

function renderPgfn() {
  const el = document.getElementById("view-pgfn");
  const D = state.data.pgfn;
  if (!D) { el.innerHTML = loadingCard("dívida ativa da União"); return; }
  if (!D.disponivel) {
    el.innerHTML = pageHead({ title: "Dívida Ativa da União", desc: "Painel indisponível nesta execução." }) +
      `<div class="card"><p class="src">${D.motivo || D.error || "sem dados"}</p></div>`;
    return;
  }
  const met = state.pgfnMet || "valor";
  const M = PGFN_METRICAS[met];
  const comGeo = D.mapa.filter(m => m.cod && D.geo && D.geo.paths && D.geo.paths[m.cod]);
  const escala = pgfnEscala(comGeo.map(m => m[met]));
  const paths = comGeo.map(m => {
    const tip = encodeURIComponent(`<div class="tt-date">${m.nome} (${m.uf})</div>
      <div class="tt-row"><span class="tt-lbl">valor</span><span class="tt-val">${fmt.money(m.valor)} (${fmt.n(m.part_br, 1)}% do BR)</span></div>
      <div class="tt-row"><span class="tt-lbl">inscrições</span><span class="tt-val">${fmt.n0(m.inscricoes)}</span></div>
      <div class="tt-row"><span class="tt-lbl">pessoa física</span><span class="tt-val">${fmt.n0(m.pf.n)} · ${fmt.money(m.pf.valor)}</span></div>
      <div class="tt-row"><span class="tt-lbl">pessoa jurídica</span><span class="tt-val">${fmt.n0(m.pj.n)} · ${fmt.money(m.pj.valor)}</span></div>`);
    return `<path d="${D.geo.paths[m.cod]}" fill="${escala(m[met])}" data-tip="${tip}" role="img" aria-label="${attr(m.nome)}: ${attr(M.fmt(m))}"></path>`;
  }).join("");

  const indef = D.mapa.find(m => m.uf === "indefinida");
  const topUF = D.mapa.filter(m => m.uf !== "indefinida").slice(0, 12);
  const vmaxUF = Math.max(...topUF.map(m => m[met] || 0));

  const gr = D.faixas.filter(f => ["R$ 10 mi a 100 mi", "acima de R$ 100 mi"].includes(f.categoria));
  const kpis = `<div class="pan-kpi">
    <div class="card kpi"><h4>Dívida ativa da União</h4><div class="big">${fmt.money(D.totais.valor)}</div>
      <div class="src">${badge("observado")} PGFN · data-base ${D.data_base}<br>${fmt.n0(D.totais.inscricoes)} inscrições de devedor principal</div></div>
    <div class="card kpi"><h4>Já ajuizado</h4><div class="big">${fmt.n((D.ajuizado.find(a => a.categoria === "SIM") || {}).part_valor, 1)}%</div>
      <div class="src">${badge("calculado")} do valor · cobrança já levada ao Judiciário</div></div>
    <div class="card kpi"><h4>Nas inscrições acima de R$ 10 mi</h4><div class="big">${fmt.n(gr.reduce((a, f) => a + f.part_valor, 0), 1)}%</div>
      <div class="src">${badge("calculado")} do valor concentrado em ${fmt.n0(gr.reduce((a, f) => a + f.inscricoes, 0))} inscrições</div></div>
    <div class="card kpi"><h4>Se somasse todas as linhas</h4><div class="big">${fmt.money(D.totais.valor_se_somasse_todas_as_linhas)}</div>
      <div class="src">${badge("calculado")} = ${fmt.n(D.totais.fator_de_inflacao, 1)}× o correto · corresponsáveis repetem o valor integral</div></div>
  </div>`;

  const armadilha = `<div class="judalerta">
    <b>Este painel não é crédito do sistema financeiro.</b>
    <div style="margin-top:5px">${D.aviso_universo}</div>
    <div style="margin-top:5px"><b>Como o número foi contado:</b> o arquivo traz ${fmt.n0(D.totais.linhas_no_arquivo)} linhas,
    mas ${fmt.n0(D.totais.linhas_de_corresponsavel)} delas são corresponsáveis e devedores solidários que repetem o
    <i>mesmo</i> valor da inscrição. Somando tudo daria ${fmt.money(D.totais.valor_se_somasse_todas_as_linhas)} —
    ${fmt.n(D.totais.fator_de_inflacao, 1)}× a dívida real. Aqui cada inscrição conta uma vez.</div>
  </div>`;

  const mapa = `${sechead("Onde está a dívida", `${D.mapa.length - (indef ? 1 : 0)} UFs · data-base ${D.data_base}`)}
  <div class="controls">${Object.entries(PGFN_METRICAS).map(([k, v]) =>
    `<button class="btn ${met === k ? "" : "ghost"} small" onclick="pgfnMetrica('${k}')">${v.l}</button>`).join("")}</div>
  <div class="pan2col">
    <div class="card"><h4>${M.l} por UF</h4>
      <svg class="panmap" viewBox="${D.geo.viewBox}" role="group" aria-label="mapa da dívida ativa por UF — ${attr(M.l)}"><g transform="${D.geo.transform}">${paths}</g></svg>
      <p class="src">Sombreado em escala logarítmica: ${M.l.toLowerCase()} varia em três ordens de grandeza entre as UFs,
      e numa escala linear só São Paulo apareceria. Compare ordens de grandeza, não proporções diretas — os valores exatos estão no ranking ao lado.<br>
      UF do devedor, não a unidade da PGFN que administra a cobrança.
      ${indef ? `${fmt.n0(indef.inscricoes)} inscrições vêm sem UF válida na fonte e ficam fora do mapa — não são redistribuídas.` : ""}</p>
    </div>
    <div class="card"><h4>Ranking</h4>
      ${topUF.map(m => panBar(`${m.uf} ${m.nome}`, m[met], vmaxUF, () => M.fmt(m), `${fmt.n(m.part_br, 1)}% do BR`)).join("")}
      <details class="charttable"><summary>dados em tabela (todas as UFs)</summary>
      <div class="tblwrap"><table class="data"><thead><tr><th>UF</th><th>Inscrições</th><th>Valor</th><th>% BR</th><th>PF</th><th>PJ</th><th>Insc. PF/mil hab.</th></tr></thead><tbody>
      ${D.mapa.map(m => `<tr><td><b>${m.uf}</b> ${m.nome}</td><td style="text-align:right">${fmt.n0(m.inscricoes)}</td>
        <td style="text-align:right">${fmt.money(m.valor)}</td><td style="text-align:right">${m.part_br != null ? fmt.n(m.part_br, 2) + "%" : "–"}</td>
        <td style="text-align:right">${fmt.n0(m.pf.n)}</td><td style="text-align:right">${fmt.n0(m.pj.n)}</td>
        <td style="text-align:right">${m.insc_pf_por_mil_hab != null ? fmt.n(m.insc_pf_por_mil_hab, 1) : "n.d."}</td></tr>`).join("")}
      </tbody></table></div></details>
    </div>
  </div>`;

  const vmaxSafra = Math.max(...D.safras.map(a => a.inscricoes));
  const safras = `${sechead("Safras: o que sobrou de cada ano", "estoque remanescente, não fluxo de inscrições")}
  <div class="card">
    <div class="judalerta" style="margin:0 0 12px"><b>Leia com cuidado.</b> ${D.aviso_safra}</div>
    ${D.safras.filter(a => a.ano >= "2005").map(a =>
      panBar(a.ano, a.inscricoes, vmaxSafra, () => fmt.n0(a.inscricoes), fmt.money(a.valor))).join("")}
    <details class="charttable"><summary>dados em tabela (por ano de inscrição)</summary>
    <div class="tblwrap"><table class="data"><thead><tr><th>Ano de inscrição</th><th>Inscrições remanescentes</th><th>PF</th><th>PJ</th><th>Valor</th></tr></thead><tbody>
    ${D.safras.map(a => `<tr><td>${a.ano}</td><td style="text-align:right">${fmt.n0(a.inscricoes)}</td><td style="text-align:right">${fmt.n0(a.pf)}</td><td style="text-align:right">${fmt.n0(a.pj)}</td><td style="text-align:right">${fmt.money(a.valor)}</td></tr>`).join("")}
    </tbody></table></div></details>
  </div>`;

  const barrasDe = (titulo, itens, nota) => {
    const vmax = Math.max(...itens.map(i => i.valor));
    return `<div class="card"><h4>${titulo}</h4>
      ${itens.map(i => panBar(i.categoria, i.valor, vmax, () => fmt.money(i.valor), `${fmt.n(i.part_valor, 1)}% · ${fmt.n0(i.inscricoes)} insc.`)).join("")}
      ${nota ? `<p class="src">${nota}</p>` : ""}
      <details class="charttable"><summary>dados em tabela</summary>
      <div class="tblwrap"><table class="data"><thead><tr><th>Categoria</th><th>Inscrições</th><th>Valor</th><th>% do valor</th></tr></thead><tbody>
      ${itens.map(i => `<tr><td>${i.categoria}</td><td style="text-align:right">${fmt.n0(i.inscricoes)}</td><td style="text-align:right">${fmt.money(i.valor)}</td><td style="text-align:right">${fmt.n(i.part_valor, 2)}%</td></tr>`).join("")}
      </tbody></table></div></details></div>`;
  };

  const perfil = `${sechead("Perfil da dívida", "todos os cortes são do mesmo universo — não se somam entre si")}
  <div class="pan2col">
    ${barrasDe("Por faixa de valor", D.faixas, "Concentração: poucas inscrições respondem pela maior parte do valor.")}
    ${barrasDe("Por situação", D.situacao)}
  </div>
  <div class="pan2col">
    ${barrasDe("Ajuizado", D.ajuizado, "Ajuizado significa cobrança já levada ao Judiciário — não indica recuperação.")}
    ${barrasDe("Por natureza do crédito", D.conjuntos.filter(c => c.disponivel).map(c =>
      ({ categoria: c.nome, valor: c.valor, inscricoes: c.inscricoes, part_valor: round2(100 * c.valor / D.totais.valor) })))}
  </div>
  <div class="card"><h4>Principais receitas inscritas</h4>
    ${D.receitas.slice(0, 10).map(r => panBar(r.categoria, r.valor, D.receitas[0].valor, () => fmt.money(r.valor), `${fmt.n(r.part_valor, 1)}%`)).join("")}
    <p class="src">O conjunto previdenciário classifica por tipo de crédito e o não previdenciário por receita: os rótulos convivem sem serem equivalentes.</p>
  </div>`;

  const metodo = `${sechead("Como este painel foi feito")}
  <div class="card">
    <p class="src" style="line-height:1.9"><b>Privacidade:</b> ${D.privacidade}</p>
    <div class="tblwrap"><table class="data"><thead><tr><th>Indicador</th><th>Definição</th><th>Fórmula</th><th>Fonte</th><th>Limitações</th></tr></thead><tbody>
    ${D.catalogo.map(c => `<tr><td><b>${c.nome}</b></td><td>${c.definicao}</td><td class="src">${c.formula}</td><td class="src">${c.fonte}</td><td class="src">${c.limitacoes}</td></tr>`).join("")}
    </tbody></table></div>
    <h5 style="margin-top:14px">O que estes dados não permitem concluir</h5>
    <ul class="src" style="line-height:1.8">${D.limitacoes.map(l => `<li>${l}</li>`).join("")}</ul>
    <p class="src">Trimestres absorvidos: ${D.trimestres_absorvidos.join(", ")} · fonte: ${D.fonte} · ${D.licenca}.
    Auditoria completa da fonte em docs/AUDITORIA_PGFN.md.</p>
  </div>`;

  el.innerHTML = pageHead({
    title: "Dívida Ativa da União",
    desc: "Crédito tributário federal inscrito em dívida ativa — onde está, de que tamanho, há quanto tempo e quanto já foi ao Judiciário.",
    vintage: D.data_base,
    fontes: "PGFN dados abertos (dadosabertos.pgfn.gov.br) · população IBGE SIDRA 6579",
  }) + armadilha + `<p class="lead">${D.sintese}</p>` + kpis + mapa + safras + perfil + metodo;
}

function round2(x) { return Math.round(x * 100) / 100; }


/* ---------- DESENROLA BRASIL ----------
   A base do BCB tem sete colunas. Um painel honesto do Desenrola precisa dizer, o
   tempo todo, o que elas permitem e o que não permitem concluir — e por isso esta
   página carrega tantos blocos de lacuna quanto de gráfico. Três separações que ela
   nunca deixa o leitor confundir: SCR não é o programa inteiro; faixas de pessoa
   física não somam com Pequenos Negócios; e baixa de registro negativo não é
   pagamento. */

const DES_SELO_DIC = { reportado: ["obs", "REPORTADO"], calculado: ["calc", "CALCULADO"],
  estimado: ["est", "ESTIMADO"], causal: ["cen", "RESULTADO CAUSAL"], associacao: ["ctx", "ASSOCIAÇÃO"] };
function desSelo(s) { return seloChip(DES_SELO_DIC, s); }

window.desFiltra = (campo, valor) => { state.des = { ...(state.des || {}), [campo]: valor }; renderDesenrola(); };
window.desInst = cod => {
  const s = new Set((state.des && state.des.comparar) || []);
  if (s.has(cod)) s.delete(cod); else if (s.size < 5) s.add(cod);
  state.des = { ...(state.des || {}), comparar: [...s] };
  renderDesenrola();
};

/** Bloco de lacuna: o que falta, por que falta e o que seria preciso para ter. */
function desLacuna(titulo, itens) {
  return `<div class="deslacuna">
    <h5>${titulo}</h5>
    <ul>${itens.map(i => `<li><b>${i.falta}</b> — ${i.porque}${i.precisaria ? ` <span class="src">Seria preciso: ${i.precisaria}.</span>` : ""}</li>`).join("")}</ul>
  </div>`;
}

function renderDesenrola() {
  const el = document.getElementById("view-desenrola");
  const D = state.data.desenrola;
  if (!D) { el.innerHTML = loadingCard("Desenrola Brasil"); return; }
  if (!D.disponivel) {
    el.innerHTML = pageHead({ title: "Desenrola Brasil", desc: "Painel indisponível nesta execução." }) +
      `<div class="card"><p class="src">${D.motivo || D.error || "sem dados"}</p></div>`;
    return;
  }
  const F = state.des || {};
  const faixa = F.faixa || "ambas";
  const metrica = F.metrica || "operacoes";
  const comparar = F.comparar || [];
  const tipos = faixa === "ambas" ? ["faixa1", "faixa2"] : [faixa];
  const somaSerie = (m, campo) => tipos.reduce((s, t) => s + ((m[t] || {})[campo] || 0), 0);

  /* ---------- 1. Visão geral ---------- */
  const ofi = id => D.oficiais.find(o => o.id === id) || {};
  const fonteCurta = x => x.replace("Considerações da SRE/Ministério da Fazenda no Relatório de Avaliação", "SRE/Ministério da Fazenda")
                           .replace("Relatório de Avaliação MPO/BID/BCB, introdução", "Relatório de Avaliação MPO/BID/BCB");
  // a nota de cada número oficial é longa: dentro do cartão competia com o próprio
  // número e desalinhava as alturas da fileira. Vira tooltip.
  const cardOfi = o => `<div class="card kpi" data-tip="${encodeURIComponent(`<div class="tt-date">${o.rotulo}</div><div class="tt-meta">${o.nota}<br><b>Fonte:</b> ${o.fonte}</div>`)}">
    <h4>${o.rotulo}</h4>
    <div class="big">${o.unidade.startsWith("R$") ? fmt.money(o.valor) : fmt.n0(o.valor)}</div>
    <div class="src">${desSelo(o.selo)} ${o.unidade}<br><i>${fonteCurta(o.fonte)}</i></div></div>`;

  const abertura = `<div class="desprosa">
    <p class="lead">O Desenrola Brasil foi criado em 2023 para tirar do vermelho quem tinha dívidas
    pequenas e atrasadas — gente que, por causa da negativação, ficava fora do crédito, do aluguel e às
    vezes do emprego. O Estado entrou com garantia e com um leilão em que os credores disputavam oferecer
    o maior desconto. Quem tinha dívida de até R$ 5 mil e renda baixa entrou pela Faixa 1; quem tinha
    renda até R$ 20 mil e nome negativado até o fim de 2022 entrou pela Faixa 2.</p>
  </div>
  <div class="judalerta" style="max-width:78ch">
    <b>Antes do primeiro número: esta base não cobre o programa inteiro.</b>
    <div style="margin-top:5px">${D.aviso_cobertura}</div>
    <div style="margin-top:6px"><b>Por isso os dois números convivem.</b> ${D.reconciliacao.explicacao}</div>
  </div>
  <nav class="desindex" aria-label="seções desta página">
    ${[["prog", "O programa"], ["arq", "Arquitetura"], ["alcance", "Alcance"], ["valores", "Valores"],
       ["regional", "Onde"], ["credores", "Credores"], ["depois", "Depois"], ["efeitos", "Efeitos"],
       ["fiscal", "Fiscal"], ["metodo", "Metodologia"]].map(([id, l]) =>
      `<a href="javascript:void(0)" onclick="document.getElementById('des-${id}').scrollIntoView({behavior:'smooth',block:'start'})">${l}</a>`).join("")}
  </nav>`;

  const kpis = `<div id="des-prog" class="desgrupo">
    <span class="rot">O que o programa fez — números oficiais</span>
    <div class="pan-kpi">${[ofi("elegiveis"), ofi("renegociaram"), ofi("regularizado"), ofi("beneficiados")].map(cardOfi).join("")}</div>
  </div>
  <div class="desgrupo">
    <span class="rot">O que aparece na base do Banco Central — faixas 1 e 2</span>
    <div class="pan-kpi">
      <div class="card kpi"><h4>Operações no SCR</h4><div class="big">${fmt.n0(D.totais_scr.operacoes)}</div>
        <div class="src">${desSelo("reportado")} operações, não pessoas<br>${D.totais_scr.periodo}</div></div>
      <div class="card kpi"><h4>Volume, após desconto</h4><div class="big">${fmt.money(D.totais_scr.volume)}</div>
        <div class="src">${desSelo("reportado")} ${fmt.n(D.reconciliacao.razao, 1)}× menor que o total oficial<br>pelo motivo explicado acima</div></div>
      <div class="card kpi"><h4>Valor médio por operação</h4><div class="big">R$ ${fmt.n0(D.totais_scr.ticket_medio)}</div>
        <div class="src">${desSelo("calculado")} volume ÷ operações<br>a fonte não publica mediana</div></div>
      <div class="card kpi"><h4>Conglomerados credores</h4><div class="big">${D.totais_scr.conglomerados}</div>
        <div class="src">${desSelo("reportado")} só quem reporta ao SCR<br>o leilão da Faixa 1 teve 654 credores</div></div>
    </div>
  </div>`;

  const tl = `${sechead("Linha do tempo", "cada marco com a fonte que o sustenta")}
  <div class="card"><ol class="destl">
    ${D.linha_do_tempo.map(e => `<li class="tl-${e.tipo}">
      <span class="tldata">${fmt.d(e.data)}</span>
      <div><b>${e.rotulo}</b><div class="src">${e.detalhe}<br><i>fonte: ${e.fonte}</i></div></div></li>`).join("")}
  </ol></div>`;

  const comoLer = `<div class="card"><h4>Como ler estes números</h4>
    <dl class="descomoler">${D.como_ler.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join("")}</dl></div>`;

  /* ---------- 2. Arquitetura do programa ---------- */
  // três cartões de alturas desiguais escondem justamente o que interessa: a
  // diferença entre os componentes. A tabela põe cada atributo lado a lado.
  const compPF = D.componentes.filter(c => !c.contexto);
  const LINHAS_ARQ = [["Quem podia", "publico"], ["Que dívida", "divida"], ["Quando", "periodo"],
                      ["Por onde", "canal"], ["Garantia pública", "garantia"], ["Dado disponível", "dados"]];
  const arq = `<section id="des-arq">${sechead("Arquitetura do programa", "componentes com coberturas diferentes — nunca somados")}
  <div class="card">
    <div class="tblwrap"><table class="desarq">
      <thead><tr><th></th>${compPF.map(c => `<th>${c.nome}
        ${c.no_scr ? `<span class="n">${fmt.n0(c.operacoes)}</span><span class="u">operações no SCR · ${fmt.money(c.volume)} · ticket R$ ${fmt.n0(c.ticket_medio)}</span>`
                   : `<span class="u" style="display:block;margin-top:5px">sem dado desagregado público</span>`}</th>`).join("")}</tr></thead>
      <tbody>${LINHAS_ARQ.map(([rot, campo]) => `<tr><th>${rot}</th>${compPF.map(c =>
        `<td${/INDISPON/i.test(c[campo]) ? ' class="vazio"' : ""}>${c[campo]}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div>
    ${compPF.filter(c => c.alerta).map(c => `<div class="desnota"><b>${c.nome}:</b> ${c.alerta}</div>`).join("")}
  </div>
  ${D.pequenos_negocios ? `<div class="card semdado">
    <h4>Quadro de contexto — ${D.pequenos_negocios.nome}</h4>
    <div class="desnota"><b>Programa diferente.</b> ${D.aviso_tipo3}</div>
    <p class="src">${fmt.n0(D.pequenos_negocios.operacoes)} operações · ${fmt.money(D.pequenos_negocios.volume)} ·
    ticket médio R$ ${fmt.n0(D.pequenos_negocios.ticket_medio)} — cerca de ${Math.round(D.pequenos_negocios.ticket_medio / D.totais_scr.ticket_medio)}× o das faixas de pessoa física, o que mostra que são universos distintos.</p>
  </div>` : ""}</section>`;

  /* ---------- 3. Alcance e adesão ---------- */
  const filtros = `<div class="controls">
    <span class="seg">${[["ambas", "Faixas 1 e 2"], ["faixa1", "Só Faixa 1"], ["faixa2", "Só Faixa 2"]].map(([v, l]) =>
      `<button class="${faixa === v ? "active" : ""}" onclick="desFiltra('faixa','${v}')">${l}</button>`).join("")}</span>
    <span class="seg">${[["operacoes", "Operações"], ["volume", "Volume (R$)"]].map(([v, l]) =>
      `<button class="${metrica === v ? "active" : ""}" onclick="desFiltra('metrica','${v}')">${l}</button>`).join("")}</span>
  </div>`;

  const serieFiltrada = D.serie.filter(m => tipos.some(t => m[t]));
  const grafSerie = lineChart({
    w: 720, h: 260, lo0: true,
    series: [{ nome: metrica === "operacoes" ? "operações renegociadas" : "volume após desconto",
               pts: serieFiltrada.map(m => ({ x: m.mes, y: somaSerie(m, metrica) || null })) }],
    annotations: [{ x: "2023-10", label: "abre a Faixa 1" }, { x: "2024-05", label: "encerramento" }]
      .concat(marcosRegulatorios("desenrola").map(m => ({ ...m, color: "#6b46a3" }))),
    unidade: metrica === "operacoes" ? "operações" : "R$",
    aria: "operações do Desenrola informadas ao SCR por mês",
    fonte: D.fonte, periodo: D.totais_scr.periodo, atualizado: (D.gerado_em || "").slice(0, 10),
    nota: D.aviso_setembro,
  });

  const noPrograma = serieFiltrada.filter(m => m.mes >= "2023-09" && m.mes <= "2024-05");
  const depois = serieFiltrada.filter(m => m.mes > "2024-05");
  const opPrograma = noPrograma.reduce((s, m) => s + somaSerie(m, "operacoes"), 0);
  const opDepois = depois.reduce((s, m) => s + somaSerie(m, "operacoes"), 0);
  const totOp = opPrograma + opDepois;

  const alcance = `<section id="des-alcance">${sechead("Alcance e adesão", "o que a base mede, e o que ela não mede")}
  ${filtros}
  <div class="card"><h4>Renegociações informadas ao SCR, por mês</h4>${grafSerie}</div>
  <div class="pan2col">
    <div class="card"><h4>Concentração no tempo</h4>
      ${panBar("Durante o programa (set/23 a mai/24)", opPrograma, totOp, () => fmt.n0(opPrograma), `${fmt.n(100 * opPrograma / totOp, 1)}% das operações`)}
      ${panBar("Depois do encerramento", opDepois, totOp, () => fmt.n0(opDepois), `${fmt.n(100 * opDepois / totOp, 1)}% das operações`)}
      <p class="src">Continuam entrando registros depois de maio de 2024. A fonte não explica o motivo;
      retificações de informações já prestadas e operações contratadas no prazo mas informadas depois são
      as hipóteses compatíveis com o que o BCB documenta. Não é adesão nova ao programa encerrado.</p>
    </div>
    <div class="card"><h4>Participação de cada faixa</h4>
      ${D.componentes.filter(c => c.no_scr && !c.contexto).map(c =>
        panBar(c.nome, c.operacoes, Math.max(...D.componentes.filter(x => x.no_scr && !x.contexto).map(x => x.operacoes)),
               () => fmt.n0(c.operacoes), `${fmt.n(100 * c.operacoes / D.totais_scr.operacoes, 1)}% · ticket R$ ${fmt.n0(c.ticket_medio)}`)).join("")}
      <p class="src">A Faixa 1 responde pela maior parte das operações e a Faixa 2 por valor por operação
      maior — coerente com os tetos de dívida de cada uma.</p>
    </div>
  </div>
  ${desLacuna("O funil do programa não pode ser construído com dado público", [
    { falta: "Público elegível por período e região", porque: "só existe o número agregado de 30 milhões, citado para a Faixa 1 inteira", precisaria: "tabulação de elegíveis por UF publicada pelo BCB ou pelo Ministério da Fazenda" },
    { falta: "Ofertas realizadas na plataforma", porque: "a plataforma do programa não publicou base aberta de ofertas", precisaria: "dados do operador da plataforma" },
    { falta: "Acordos pagos e acordos em curso", porque: "a base informa a contratação, não o cumprimento", precisaria: "acompanhamento longitudinal das operações" },
    { falta: "Número médio de dívidas por beneficiário", porque: "a base conta operações e não permite deduplicar pessoas", precisaria: "contagem de CPFs distintos, que é sigilosa" },
  ])}
  <div class="card">
    <h4>Uma razão citada, e por que ela não é uma taxa de adesão</h4>
    <p>${desSelo("estimado")} Menos de 5 milhões de pessoas renegociaram, num público estimado em 30 milhões
    de elegíveis — cerca de <b>${fmt.n(100 * 5 / 30, 0)}%</b>. Os dois números vêm do mesmo relatório oficial, mas de
    conceitos e momentos diferentes: um é a procura observada pelo programa, o outro é uma estimativa de
    elegibilidade da Faixa 1. A divisão dá ordem de grandeza, não taxa medida sobre um cadastro.</p>
  </div></section>`;

  /* ---------- 4. Valores e condições ---------- */
  const tickets = D.serie.filter(m => tipos.some(t => m[t] && m[t].operacoes));
  const grafTicket = lineChart({
    w: 720, h: 220, lo0: true,
    series: [{ nome: "valor médio por operação", pts: tickets.map(m => {
      const o = somaSerie(m, "operacoes"), v = somaSerie(m, "volume");
      return { x: m.mes, y: o ? Math.round(v / o) : null }; }) }],
    unidade: "R$", aria: "valor médio por operação renegociada, por mês",
    fonte: D.fonte, periodo: D.totais_scr.periodo, atualizado: (D.gerado_em || "").slice(0, 10),
    nota: "Valor após o desconto. Média de agregados mensais — a fonte não publica distribuição.",
  });
  const valores = `<section id="des-valores">${sechead("Valores e condições", "o que a fonte publica sobre o contrato renegociado")}
  <div class="card"><h4>Valor médio por operação, ao longo do tempo</h4>${grafTicket}</div>
  ${desLacuna("Quase tudo o que se esperaria desta seção não existe na fonte", [
    { falta: "Valor original da dívida", porque: "a base publica somente o valor DEPOIS do desconto", precisaria: "coluna de valor pré-desconto na divulgação do BCB" },
    { falta: "Desconto médio e mediano por operação", porque: "sem valor original, o desconto é indeterminável; o que existe é o desconto médio de 83% ofertado no leilão da Faixa 1, que é agregado e de outra fonte" },
    { falta: "Entrada, parcelas, valor da parcela, taxa de juros e prazo", porque: "não há essas colunas" },
    { falta: "Histogramas, percentis e faixas de valor", porque: "a divulgação é agregada por célula, sem microdado nem distribuição publicada" },
  ])}
  <div class="card"><h4>Os conceitos que não se confundem</h4>
    <dl class="descomoler">
      <dt>Valor original</dt><dd>Quanto a pessoa devia antes de qualquer abatimento. <b>Não está nesta base.</b></dd>
      <dt>Valor após desconto</dt><dd>O que virou a nova operação de crédito. <b>É o que esta base publica.</b></dd>
      <dt>Valor efetivamente pago</dt><dd>Quanto entrou no caixa do credor ao longo do acordo. <b>Não está nesta base.</b></dd>
      <dt>Desconto nominal</dt><dd>A diferença entre original e renegociado — abatimento concedido pelo credor.</dd>
      <dt>Perda econômica do credor</dt><dd>Quanto o credor deixou de receber em relação ao que esperava receber, que
      normalmente é menor que o desconto nominal, porque dívida negativada antiga vale pouco.</dd>
      <dt>Custo fiscal</dt><dd>Dinheiro público efetivamente gasto. <b>Desconto de credor privado não é gasto
      público</b> e não deve ser somado a ele.</dd>
    </dl>
  </div></section>`;

  /* ---------- 5. Beneficiários e distribuição regional ---------- */
  const metMapa = F.metMapa || "operacoes";
  const MAPAS = { operacoes: ["Operações", m => fmt.n0(m.operacoes)],
                  op_por_mil_hab: ["Operações por mil habitantes", m => m.op_por_mil_hab != null ? fmt.n(m.op_por_mil_hab, 1) : "n.d."],
                  ticket_medio: ["Valor médio por operação", m => "R$ " + fmt.n0(m.ticket_medio)],
                  volume: ["Volume após desconto", m => fmt.money(m.volume)] };
  const comGeo = D.mapa.filter(m => m.cod && D.geo && D.geo.paths && D.geo.paths[m.cod]);
  const escMapa = pgfnEscala(comGeo.map(m => m[metMapa]));
  const pathsMapa = comGeo.map(m => {
    const tip = encodeURIComponent(`<div class="tt-date">${m.nome} (${m.uf})</div>
      <div class="tt-row"><span class="tt-lbl">operações</span><span class="tt-val">${fmt.n0(m.operacoes)} (${fmt.n(m.part_op, 1)}% do BR)</span></div>
      <div class="tt-row"><span class="tt-lbl">volume</span><span class="tt-val">${fmt.money(m.volume)}</span></div>
      <div class="tt-row"><span class="tt-lbl">por mil hab.</span><span class="tt-val">${m.op_por_mil_hab != null ? fmt.n(m.op_por_mil_hab, 1) : "n.d."}</span></div>
      <div class="tt-row"><span class="tt-lbl">valor médio</span><span class="tt-val">R$ ${fmt.n0(m.ticket_medio)}</span></div>`);
    return `<path d="${D.geo.paths[m.cod]}" fill="${escMapa(m[metMapa])}" data-tip="${tip}" role="img" aria-label="${attr(m.nome)}: ${attr(MAPAS[metMapa][1](m))}"></path>`;
  }).join("");
  const vmaxMapa = Math.max(...D.mapa.map(m => m[metMapa] || 0));
  const regional = `<section id="des-regional">${sechead("Onde as renegociações aconteceram", "UF do tomador · faixas 1 e 2")}
  <div class="controls">${Object.entries(MAPAS).map(([k, v]) =>
    `<button class="btn ${metMapa === k ? "" : "ghost"} small" onclick="desFiltra('metMapa','${k}')">${v[0]}</button>`).join("")}</div>
  <div class="pan2col">
    <div class="card"><h4>${MAPAS[metMapa][0]}</h4>
      <svg class="panmap" viewBox="${D.geo.viewBox}" role="group" aria-label="mapa das renegociações do Desenrola por UF"><g transform="${D.geo.transform}">${pathsMapa}</g></svg>
      <p class="src">Sombreado em escala logarítmica — a concentração em São Paulo apagaria os demais numa escala linear.
      O denominador de "por mil habitantes" é a população total, não o público elegível, que não é publicado por UF.</p>
    </div>
    <div class="card"><h4>Ranking</h4>
      ${D.mapa.slice(0, 12).map(m => panBar(`${m.uf} ${m.nome}`, m[metMapa], vmaxMapa, () => MAPAS[metMapa][1](m), `${fmt.n(m.part_op, 1)}% das operações`)).join("")}
      <details class="charttable"><summary>dados em tabela (todas as UFs)</summary>
      <div class="tblwrap"><table class="data"><thead><tr><th>UF</th><th>Operações</th><th>% BR</th><th>Volume</th><th>Valor médio</th><th>Por mil hab.</th></tr></thead><tbody>
      ${D.mapa.map(m => `<tr><td><b>${m.uf}</b> ${m.nome}</td><td style="text-align:right">${fmt.n0(m.operacoes)}</td>
        <td style="text-align:right">${fmt.n(m.part_op, 2)}%</td><td style="text-align:right">${fmt.money(m.volume)}</td>
        <td style="text-align:right">R$ ${fmt.n0(m.ticket_medio)}</td>
        <td style="text-align:right">${m.op_por_mil_hab != null ? fmt.n(m.op_por_mil_hab, 1) : "n.d."}</td></tr>`).join("")}
      </tbody></table></div></details>
    </div>
  </div>
  ${desLacuna("Perfil dos beneficiários: a fonte não traz nenhuma variável demográfica", [
    { falta: "Sexo, idade, faixa de renda e inscrição no CadÚnico", porque: "a base tem sete colunas e nenhuma é demográfica", precisaria: "tabulação demográfica agregada publicada pelo BCB, com supressão de células pequenas" },
    { falta: "Município", porque: "UF é a menor granularidade geográfica publicada" },
    { falta: "Produto de crédito da dívida renegociada", porque: "não há coluna de modalidade" },
    { falta: "Antiguidade da dívida e quantidade anterior de dívidas", porque: "a base descreve a operação nova, não o histórico do devedor" },
  ])}</section>`;

  /* ---------- 6. Instituições e credores ---------- */
  const insts = D.instituicoes;
  const sel = comparar.length ? insts.filter(i => comparar.includes(i.cod)) : insts.slice(0, 5);
  const maxOp = insts[0].operacoes;
  const credores = `<section id="des-credores">${sechead("Credores que reportam ao SCR", `${D.concentracao.n_conglomerados} conglomerados financeiros`)}
  <div class="judalerta"><b>Isto não é um ranking de melhores e piores.</b> Conglomerados têm carteiras,
  públicos e composições de produto diferentes: quem tinha muitos clientes de baixa renda com dívida pequena
  aparece com muitas operações e ticket baixo, e isso descreve a carteira, não a qualidade da atuação. Além
  disso, os credores não financeiros do programa — varejo, serviços, telecomunicações — não reportam ao SCR e
  não estão em nenhuma linha desta tabela: o leilão da Faixa 1 teve 654 credores, e aqui aparecem ${D.concentracao.n_conglomerados}.</div>
  <div class="pan2col">
    <div class="card"><h4>Participação nas operações</h4>
      ${insts.slice(0, 12).map(i => panBar(i.nome, i.operacoes, maxOp, () => fmt.n0(i.operacoes), `${fmt.n(i.part_op, 1)}% · ticket R$ ${fmt.n0(i.ticket_medio)}`)).join("")}
    </div>
    <div class="card"><h4>Concentração</h4>
      <div class="big">${fmt.n(D.concentracao.top5_operacoes, 1)}%</div>
      <p class="src">das operações estão nos cinco maiores conglomerados. HHI de ${fmt.n(D.concentracao.hhi_operacoes, 0)}
      sobre ${D.concentracao.n_conglomerados} conglomerados (índice de 0 a 10.000; acima de 1.800 costuma ser lido como
      concentração alta em análise antitruste, referência que aqui serve só de régua).</p>
      <p class="src">A concentração mede o peso entre <b>os credores que reportam ao SCR</b>. Como os não
      financeiros ficam fora do denominador, ela não descreve a concentração do programa como um todo.</p>
    </div>
  </div>
  <div class="card">
    <h4>Comparar até cinco conglomerados</h4>
    <div class="controls" style="flex-wrap:wrap;gap:5px">
      ${insts.slice(0, 20).map(i => `<button class="btn ${comparar.includes(i.cod) ? "" : "ghost"} small" onclick="desInst('${i.cod}')">${i.nome}</button>`).join("")}
      ${comparar.length ? `<button class="btn ghost small" onclick="desFiltra('comparar',[])">limpar</button>` : ""}
    </div>
    <div class="tblwrap"><table class="data"><thead><tr><th>Conglomerado</th><th>Operações</th><th>% das operações</th>
      <th>Volume</th><th>% do volume</th><th>Valor médio</th><th>Faixa 1</th><th>Faixa 2</th><th>UFs</th></tr></thead><tbody>
    ${sel.map(i => `<tr><td><b>${i.nome}</b></td><td style="text-align:right">${fmt.n0(i.operacoes)}</td>
      <td style="text-align:right">${fmt.n(i.part_op, 2)}%</td><td style="text-align:right">${fmt.money(i.volume)}</td>
      <td style="text-align:right">${fmt.n(i.part_vol, 2)}%</td><td style="text-align:right">R$ ${fmt.n0(i.ticket_medio)}</td>
      <td style="text-align:right">${i.por_faixa.faixa1 ? fmt.n0(i.por_faixa.faixa1.operacoes) : "–"}</td>
      <td style="text-align:right">${i.por_faixa.faixa2 ? fmt.n0(i.por_faixa.faixa2.operacoes) : "–"}</td>
      <td style="text-align:right">${i.ufs}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src">Sem seleção, aparecem os cinco maiores por número de operações.</p>
  </div>
  ${desLacuna("O que não dá para comparar entre instituições", [
    { falta: "Desconto médio concedido por cada credor", porque: "exigiria o valor original, que a base não publica" },
    { falta: "Regularidade e inadimplência posteriores dos acordos", porque: "a base registra a contratação e não acompanha a operação depois" },
    { falta: "Renegociação como proporção da carteira", porque: "o conglomerado do Desenrola é o financeiro e a carteira do IF.data é do prudencial — os perímetros não coincidem", precisaria: "chave de correspondência entre os dois perímetros publicada pelo BCB" },
  ])}</section>`;

  /* ---------- 7. Depois da renegociação ---------- */
  const depoisSec = `<section id="des-depois">${sechead("O que aconteceu depois da renegociação", "a pergunta mais importante, e a que a base pública não responde")}
  <div class="card">
    <div class="desprosa">
    <p>Esta seria a seção central de um painel de avaliação: quantos acordos continuaram regulares, quantos
    voltaram a atrasar, quanto foi liquidado, quem voltou a tomar crédito. A base do BCB informa a
    <b>renegociação no mês em que ela ocorreu</b> e não acompanha a operação depois. Não há coorte, não há
    curva de sobrevivência e não há reincidência — não porque o cálculo seja difícil, mas porque o dado
    longitudinal por operação é sigiloso.</p>
    <p class="src">Construir esta seção com o que existe exigiria comparar coortes por proxy agregada, o que
    produziria uma curva plausível e sem sustentação. O Observatório não faz isso: a ausência fica declarada.</p>
    </div>
  </div>
  ${desLacuna("O que seria preciso para responder", [
    { falta: "Permanência do acordo em situação regular após 3, 6, 12, 18 e 24 meses", porque: "não há painel por operação", precisaria: "série de estoque e situação das operações do programa por safra de contratação" },
    { falta: "Atraso acima de 15, 30 e 90 dias e entrada em prejuízo", porque: "a base não traz situação da operação", precisaria: "as mesmas variáveis que o SCR.data já publica por modalidade, recortadas para o programa" },
    { falta: "Novo crédito obtido, exposição total e número de relacionamentos", porque: "exigiria ligar o beneficiário a operações posteriores", precisaria: "microdado individual, que é sigiloso por lei" },
  ])}
  <div class="note"><b>Uma advertência de leitura, para quando o dado existir.</b> Nova concessão de crédito
  a quem renegociou não significa, por si, melhora de bem-estar — pode ser recomposição de dívida. E aumento
  do endividamento não é automaticamente deterioração: pode ser retorno ao crédito formal, mais barato que a
  alternativa informal. Qualquer leitura desses números precisa dizer qual das duas histórias está contando e
  por quê.</div></section>`;

  /* ---------- 8. Efeitos sobre o mercado de crédito ---------- */
  const P = state.data.pulse;
  const serieCtx = F.ctx || "inad_pf";
  const sc = P && P.series && P.series[serieCtx];
  const ctxMeta = (D.series_contexto || []).find(s => s.chave === serieCtx) || {};
  const grafCtx = sc ? lineChart({
    w: 720, h: 250,
    series: [{ nome: ctxMeta.rotulo || serieCtx, pts: sc.obs.filter(o => o.ref >= "2019-01").map(o => ({ x: o.ref.slice(0, 7), y: o.v })) }],
    annotations: [{ x: "2023-07", label: "anúncio" }, { x: "2023-10", label: "Faixa 1" }, { x: "2024-05", label: "fim" }],
    unidade: ctxMeta.unidade, aria: `série de ${attr(ctxMeta.rotulo || serieCtx)} com marcos do Desenrola`,
    fonte: "BCB/SGS", periodo: "2019 em diante", atualizado: (D.gerado_em || "").slice(0, 10),
    nota: "Os marcos indicam quando o programa aconteceu. Coincidência temporal não é efeito.",
  }) : "<p class='src'>Série do pulso ainda carregando.</p>";

  const efeitos = `<section id="des-efeitos">${sechead("O Desenrola no contexto do mercado de crédito", "três níveis de evidência, nunca misturados")}
  <div class="controls">${(D.series_contexto || []).map(s =>
    `<button class="btn ${serieCtx === s.chave ? "" : "ghost"} small" onclick="desFiltra('ctx','${s.chave}')">${s.rotulo}</button>`).join("")}</div>
  <div class="card"><h4>${ctxMeta.rotulo || serieCtx}, com os marcos do programa</h4>${grafCtx}</div>
  <div class="pan2col">
    <div class="card"><h4>${desSelo("reportado")} Evidências descritivas</h4>
      <p class="src">O que se observa nas séries: o programa ocorreu entre julho de 2023 e maio de 2024, e as
      séries de inadimplência, endividamento e comprometimento de renda seguem seus próprios caminhos nesse
      intervalo. O painel mostra as séries e marca as datas — nada além disso é afirmado aqui.</p>
    </div>
    <div class="card"><h4>${desSelo("associacao")} Associações</h4>
      <p class="src">Movimentos simultâneos ao programa têm muitas causas concorrentes no mesmo período: ciclo
      da Selic, massa salarial, safra de crédito consignado e mudanças regulatórias do cartão. Nenhuma variação
      agregada observada nessa janela pode ser atribuída ao Desenrola sem um grupo de comparação.</p>
    </div>
  </div>
  <div class="card">
    <h4>${desSelo("causal")} Evidência causal disponível</h4>
    <p><b>${D.avaliacao.titulo}</b> — ${D.avaliacao.autores}, publicado em ${fmt.d(D.avaliacao.publicado)}.</p>
    <div class="judalerta" style="margin:8px 0"><b>Atenção ao objeto.</b> ${D.avaliacao.objeto}</div>
    <p class="src"><b>Desenho:</b> ${D.avaliacao.desenho}</p>
    <div class="tblwrap"><table class="data"><thead><tr><th>Achado</th><th>Selo</th><th>Força da inferência</th></tr></thead><tbody>
    ${D.avaliacao.resultados.map(r => `<tr><td>${r.achado}</td><td>${desSelo(r.selo)}</td><td class="src">${r.forca}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src" style="margin-top:8px"><b>Conclusão dos autores:</b> ${D.avaliacao.conclusao_dos_autores}</p>
    <div class="judalerta" style="margin-top:8px"><b>O que continua sem resposta.</b> ${D.avaliacao.limite}</div>
    <p class="src"><a href="${D.avaliacao.url}" target="_blank" rel="noopener">relatório completo (PDF, Ministério do Planejamento e Orçamento)</a></p>
  </div></section>`;

  /* ---------- 9. Garantias e dimensão fiscal ---------- */
  const fiscal = `<section id="des-fiscal">${sechead("Garantias e dimensão fiscal")}
  <div class="card">
    <p class="desprosa">A Faixa 1 teve garantia do Fundo Garantidor de Operações (FGO): o Estado assumiu
    parte do risco para que os credores aceitassem descontos grandes em dívidas antigas. Quanto disso virou
    desembolso efetivo é uma pergunta legítima e sem resposta em base pública desagregada.</p>
    <div class="judalerta"><b>Não há número aqui porque não há dado — e estimar seria pior.</b>
    Preencher esta seção com aproximações a partir do volume renegociado produziria um "custo fiscal" que
    ninguém mediu.</div>
  </div>
  ${desLacuna("Lacunas fiscais", [
    { falta: "Valor garantido e operações cobertas pelo FGO no âmbito do programa", porque: "não publicado de forma desagregada", precisaria: "relatórios do fundo garantidor com identificação do Desenrola" },
    { falta: "Garantias acionadas, recuperações e perdas realizadas", porque: "não publicado", precisaria: "demonstrações do FGO segregadas por programa" },
    { falta: "Custo fiscal bruto, líquido e por beneficiário", porque: "depende dos itens acima", precisaria: "execução orçamentária do subsídio com identificação do programa" },
    { falta: "Alavancagem entre recurso público e dívida renegociada", porque: "o numerador é justamente o que falta" },
  ])}
  <div class="note"><b>Desconto de credor não é gasto público.</b> Os R$ 137 bilhões que caíram para cerca de
  R$ 25 bilhões no leilão da Faixa 1 são abatimento concedido por credores privados sobre dívidas em boa parte
  já provisionadas. Chamar essa diferença de custo do programa confundiria renúncia privada com desembolso do
  Tesouro.</div></section>`;

  /* ---------- 10. Metodologia e limitações ---------- */
  const st = { viavel: ["obs", "VIÁVEL"], parcial: ["est", "PARCIAL"], indisponivel: ["desc", "INDISPONÍVEL"] };
  const metodo = `<section id="des-metodo">${sechead("Metodologia e limitações")}
  <div class="card"><h4>Matriz de viabilidade</h4>
    <p class="src desprosa">Cada indicador que se esperaria de um painel do Desenrola, e o que a fonte
    pública permite. ${D.matriz_viabilidade.filter(m => m.status === "viavel").length} viáveis,
    ${D.matriz_viabilidade.filter(m => m.status === "parcial").length} parciais e
    ${D.matriz_viabilidade.filter(m => m.status === "indisponivel").length} indisponíveis.</p>
    <div class="desmatriz">
      ${[...new Set(D.matriz_viabilidade.map(m => m.area))].map(area => {
        const itens = D.matriz_viabilidade.filter(m => m.area === area);
        const c = x => itens.filter(m => m.status === x).length;
        const pct = n => (100 * n / itens.length).toFixed(1);
        return `<div class="desmz"><h6>${area}</h6>
          <div class="barra" role="img" aria-label="${attr(`${c("viavel")} viáveis, ${c("parcial")} parciais, ${c("indisponivel")} indisponíveis`)}">
            ${c("viavel") ? `<i class="v" style="width:${pct(c("viavel"))}%"></i>` : ""}
            ${c("parcial") ? `<i class="p" style="width:${pct(c("parcial"))}%"></i>` : ""}
            ${c("indisponivel") ? `<i class="i" style="width:${pct(c("indisponivel"))}%"></i>` : ""}
          </div>
          <div class="leg">${c("viavel")} viáveis · ${c("parcial")} parciais · <b>${c("indisponivel")} indisponíveis</b></div>
        </div>`;
      }).join("")}
    </div>
    <details class="charttable"><summary>ver os ${D.matriz_viabilidade.length} indicadores, um a um</summary>
    <div class="tblwrap"><table class="data"><thead><tr><th>Área</th><th>Indicador</th><th>Situação</th><th>Base ou motivo</th></tr></thead><tbody>
    ${D.matriz_viabilidade.map(m => `<tr><td class="src">${m.area}</td><td>${m.indicador}</td>
      <td><span class="seal ${st[m.status][0]}">${st[m.status][1]}</span></td>
      <td class="src">${m.base || ""}${m.falta ? `<br>${m.falta}` : ""}</td></tr>`).join("")}
    </tbody></table></div></details>
  </div>
  <details class="charttable"><summary>Dicionário dos indicadores</summary>
  <div class="card"><h4>Dicionário dos indicadores</h4>
    <div class="desdic">
    ${D.catalogo.map(c => `<article>
      <h5>${c.nome} ${desSelo(c.selo)}</h5>
      <p>${c.definicao}</p>
      <p class="meta"><b>Fórmula</b> <code>${c.formula}</code> · <b>unidade</b> ${c.unidade} ·
      <b>análise por</b> ${c.unidade_analise} · <b>periodicidade</b> ${c.periodicidade} ·
      <b>cobertura</b> ${c.cobertura} · <b>fonte</b> ${c.fonte}</p>
      <p class="lim"><b>Limitações.</b> ${c.limitacoes}</p>
    </article>`).join("")}
    </div>
  </div>
  </details>
  <details class="charttable"><summary>Selos e procedência dos dados</summary>
  <div class="card"><h4>O que os selos significam</h4>
    <dl class="descomoler">${Object.entries(D.selos).map(([k, v]) => `<dt>${desSelo(k)}</dt><dd>${v}</dd>`).join("")}</dl>
  </div>
  <div class="card"><h4>Procedência e tratamento</h4>
    <ul class="src" style="line-height:1.9">
      <li><b>Fonte:</b> ${D.fonte} · <a href="${D.url_dataset}" target="_blank" rel="noopener">página do conjunto</a> · licença ${D.licenca}.</li>
      <li><b>Coleta:</b> ${(D.coletado_em || "").slice(0, 16).replace("T", " ")} UTC · sha256 do arquivo bruto <code>${(D.bronze_sha || "").slice(0, 16)}…</code>, preservado em bronze com URL e data.</li>
      <li><b>Cobertura:</b> ${D.meses} data-bases de ${D.data_base_min} a ${D.data_base}, sem meses ausentes · ${fmt.n0(D.linhas_base)} células na base.</li>
      <li><b>Chave:</b> data-base × faixa × UF × conglomerado, verificada como única na origem.</li>
      <li><b>Revisões:</b> a fonte republica a série inteira a cada mês e o BCB reflete retificações das entidades
      remetentes. Por isso a absorção substitui a série completa em vez de acumular, e o hash do arquivo
      identifica cada vintage.</li>
      <li><b>Quebra declarada:</b> ${D.aviso_setembro}</li>
      <li><b>Valores nominais</b>, sem deflação — meses distantes não são diretamente comparáveis em poder de compra.</li>
      <li><b>Sigilo:</b> a divulgação já vem agregada pelo BCB; o Observatório não recebe nem produz dado individual.</li>
    </ul>
  </div></details>
  </section>`;

  el.innerHTML = pageHead({
    title: "Desenrola Brasil",
    desc: "O que o programa fez, quanto dele aparece nos dados públicos e até onde eles permitem avaliar seus efeitos.",
    vintage: D.data_base,
    fontes: `${D.fonte} · Relatório de Avaliação MPO/BID/BCB · IBGE SIDRA 6579`,
  }) + abertura + kpis + comoLer + tl + arq + alcance + valores + regional + credores + depoisSec + efeitos + fiscal + metodo;
}


/* ---------- PENETRAÇÃO E GAP DE CRÉDITO ----------
   Numerador do ESTBAN (município da dependência), denominador do Censo 2022. O gap é
   contrafactual — "quanto haveria se este município se parecesse com seus pares" —, e
   o vocabulário da página inteira respeita isso: potencial não atendido, indício de
   baixa penetração, diferença em relação a comparáveis. Nunca "falta crédito". */
const PEN_METRICAS = {
  penetracao: { l: "Crédito sobre renda anual", u: "%", fmt: m => m.penetracao != null ? fmt.n(m.penetracao, 1) + "%" : "n.d.", esc: "pct" },
  cred_adulto: { l: "Crédito por adulto", u: "R$", fmt: m => m.cred_adulto != null ? "R$ " + fmt.n0(m.cred_adulto) : "n.d.", esc: "pct" },
  gap_abs_modelo: { l: "Gap absoluto estimado", u: "R$", fmt: m => m.gap_abs_modelo != null ? fmt.money(m.gap_abs_modelo) : "n.d.", esc: "pct" },
  gap_rel_modelo: { l: "Gap relativo estimado", u: "%", fmt: m => m.gap_rel_modelo != null ? fmt.n(m.gap_rel_modelo, 0) + "%" : "n.d.", esc: "lin" },
  confianca: { l: "Confiabilidade do dado", u: "", fmt: m => ({ alta: "alta", media: "média", baixa: "baixa" }[m.confianca] || "–"), esc: "cat" },
};
const PEN_CONF = { alta: "var(--positive)", media: "var(--warning)", baixa: "var(--unavail)" };

window.penFiltra = (campo, valor) => {
  state.pen = { ...(state.pen || {}), [campo]: valor };
  if (campo !== "sel") state.pen.sel = null;
  renderPenetracao();
};
window.penSel = cod => {
  state.pen = { ...(state.pen || {}), sel: cod };
  renderPenetracao();
  // o perfil fica logo abaixo do mapa; quem clica numa linha do ranking ou numa bolha
  // da dispersão está longe dele e não veria a mudança
  requestAnimationFrame(() => document.getElementById("pen-perfil")
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
};
window.penBusca = (v, confirmado) => {
  /* A primeira versão selecionava (e re-renderizava a página inteira, destruindo o
     próprio input) ao primeiro prefixo de três letras — digitar "Pau D'Arco" era
     impossível, porque "pau" já casava outro município e a caixa zerava. A seleção
     agora só acontece no Enter ou na escolha do datalist; o oninput apenas alimenta
     as sugestões, sem tocar no DOM do input. */
  const P = state.data.penetracao;
  const q = _norm(v);
  const dl = document.getElementById("penbusca-dl");
  if (dl && !confirmado) {
    const ops = q.length >= 2
      ? P.municipios.filter(m => _norm(m.nome).startsWith(q)).slice(0, 12)
      : [];
    dl.innerHTML = ops.map(m => `<option value="${attr(m.nome + " – " + m.uf)}"></option>`).join("");
    return;
  }
  const alvoQ = _norm(String(v).replace(/\s+–\s+\w{2}$/, ""));
  const achou = P.municipios.find(m => _norm(m.nome) === alvoQ)
    || (alvoQ.length >= 3 ? P.municipios.find(m => _norm(m.nome).startsWith(alvoQ)) : null);
  if (achou) penSel(achou.cod);
};

/** Escala por percentis: com distribuição tão assimétrica, escala linear deixaria
    tudo branco menos São Paulo. Winsorização é só visual — o dado exportado é o bruto. */
function penEscala(vals, tipo, corBase) {
  /* Escala sequencial por percentis (winsorização p5–p95, só visual — o dado exportado
     é o bruto). Era duplicada em cgEscala com rampa ligeiramente diferente por acidente;
     agora a cor é parâmetro e a rampa é uma. */
  const v = vals.filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return () => "var(--surface-2)";
  const q = p => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
  const lo = q(0.05), hi = q(0.95);
  const base = corBase || "var(--accent)";  /* bronze: a cor dos mapas de penetração e moradia */
  return x => {
    if (x == null) return "var(--surface-2)";
    const t = Math.max(0, Math.min(1, (x - lo) / Math.max(hi - lo, 1e-9)));
    return `color-mix(in srgb, ${base} ${Math.round(6 + 82 * t)}%, var(--surface))`;
  };
}

function renderPenetracao() {
  const el = document.getElementById("view-penetracao");
  const P = costuraMunicipios(state.data.penetracao, state.data.penetracao_mun);
  if (!P || !P.municipios) { el.innerHTML = loadingCard("penetração de crédito municipal"); return; }
  if (!P.disponivel) {
    el.innerHTML = pageHead({ title: "Penetração e Gap de Crédito", desc: "Painel indisponível nesta execução." }) +
      `<div class="card"><p class="src">${P.motivo || P.error || "sem dados"}</p></div>`;
    return;
  }
  const F = state.pen || {};
  const met = F.met || "penetracao";
  const M = PEN_METRICAS[met];
  const regiao = F.regiao || "todas";
  const conf = F.conf || "exclui_baixa";
  const metodo = F.metodo || "modelo";
  const cortes = F.cortes !== "sem";
  const malha = state.data.penetracao_malha;

  const passa = m => (regiao === "todas" || m.regiao === regiao)
    && (conf === "todas" || m.confianca !== "baixa")
    && (!cortes || (m.adultos >= P.cobertura.min_adultos && m.renda_anual >= P.cobertura.min_renda_anual));
  const base = P.municipios.filter(passa);
  const comSaldo = base.filter(m => m.credito != null);

  /* ---------- cards ---------- */
  const credFiltro = comSaldo.reduce((s, m) => s + m.credito, 0);
  const rendaFiltro = base.reduce((s, m) => s + m.renda_anual, 0);
  const adultosFiltro = base.reduce((s, m) => s + m.adultos, 0);
  const campoGap = metodo === "modelo" ? "gap_abs_modelo" : "gap_abs_pares";
  const abaixo = comSaldo.filter(m => (m[campoGap] || 0) > 0);
  const gapFiltro = abaixo.reduce((s, m) => s + m[campoGap], 0);

  const cards = `<div class="pgkpi">
    <div class="mk"><span class="r">Crédito municipal analisado</span>
      <span class="v">${fmt.money(credFiltro)}</span>
      <span class="n">ESTBAN ${P.data_base_credito} · ${fmt.n0(comSaldo.length)} municípios com saldo ${penSelo("observado")}</span></div>
    <div class="mk"><span class="r">Crédito por adulto</span>
      <span class="v">R$ ${fmt.n0(credFiltro / adultosFiltro)}</span>
      <span class="n">saldo ÷ população de 18 anos ou mais ${penSelo("calculado")}</span></div>
    <div class="mk"><span class="r">Crédito sobre renda anual</span>
      <span class="v">${fmt.n(100 * credFiltro / rendaFiltro, 0)}<small>%</small></span>
      <span class="n">${fmt.n(12 * credFiltro / rendaFiltro, 1)} meses de renda ${penSelo("calculado")}</span></div>
    <div class="mk destaque"><span class="r">Gap absoluto estimado</span>
      <span class="v">${fmt.money(gapFiltro)}</span>
      <span class="n">soma dos ${fmt.n0(abaixo.length)} municípios abaixo do ${metodo === "modelo" ? "modelo" : "benchmark"} ${penSelo("estimado")}</span></div>
    <div class="mk"><span class="r">Sem dependência bancária</span>
      <span class="v">${fmt.n0(P.cobertura.sem_saldo_estban)}</span>
      <span class="n">dos ${fmt.n0(P.cobertura.municipios_brasil)} municípios · ausência não é crédito zero ${penSelo("observado")}</span></div>
  </div>`;

  const cobertura = `<div class="desgrupo">
    <span class="rot">Cobertura da fonte — não responde aos filtros</span>
    <div class="pan-kpi">
      <div class="card kpi"><h4>Adultos nesses municípios</h4><div class="big">${fmt.n0(P.cobertura.adultos_sem_estban)}</div>
        <div class="src">${penSelo("observado")} ficam fora de qualquer conta de penetração</div></div>
      <div class="card kpi"><h4>Municípios com saldo</h4><div class="big">${fmt.n0(P.cobertura.com_saldo_estban)}</div>
        <div class="src">${penSelo("observado")} base do mapa e dos indicadores</div></div>
      <div class="card kpi"><h4>Elegíveis aos rankings</h4><div class="big">${fmt.n0(P.cobertura.elegiveis_ranking)}</div>
        <div class="src">${penSelo("calculado")} passam nos cortes mínimos e não têm confiabilidade baixa</div></div>
    </div>
  </div>`;

  const avisoPen = `<div class="judalerta" style="max-width:78ch"><b>Antes de ler qualquer ranking.</b> O ESTBAN registra onde o saldo
  foi <i>contabilizado</i>, não onde mora quem tomou o crédito. Sede de banco e centro regional inflam; município
  vizinho esvazia. Por isso cada município carrega um selo de confiabilidade, e os de selo baixo ficam fora dos
  rankings por padrão.</div>
  <nav class="desindex" aria-label="seções desta página">
    ${[["mapa", "Mapa"], ["dispersao", "Dispersão"], ["rankings", "Rankings"], ["achados", "Achados"], ["metodo", "Metodologia"]]
      .map(([id, l]) => `<a href="javascript:void(0)" onclick="document.getElementById('pen-${id}').scrollIntoView({behavior:'smooth',block:'start'})">${l}</a>`).join("")}
  </nav>`;

  /* ---------- filtros ---------- */
  const filtros = `<div class="controls">
    <label>região <select onchange="penFiltra('regiao', this.value)">
      ${["todas", "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"].map(r =>
        `<option ${regiao === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
    <label>método do gap <select onchange="penFiltra('metodo', this.value)">
      <option value="modelo" ${metodo === "modelo" ? "selected" : ""}>modelo estatístico</option>
      <option value="pares" ${metodo === "pares" ? "selected" : ""}>benchmark de pares</option></select></label>
    <span class="seg">${[["exclui_baixa", "sem confiabilidade baixa"], ["todas", "incluir todas"]].map(([v, l]) =>
      `<button class="${conf === v ? "active" : ""}" onclick="penFiltra('conf','${v}')">${l}</button>`).join("")}</span>
    <span class="seg">${[["com", `cortes mínimos`], ["sem", "sem cortes"]].map(([v, l]) =>
      `<button class="${(cortes ? "com" : "sem") === v ? "active" : ""}" onclick="penFiltra('cortes','${v}')">${l}</button>`).join("")}</span>
    <input type="search" placeholder="buscar município" list="penbusca-dl" oninput="penBusca(this.value)"
      onchange="penBusca(this.value, true)"
      onkeydown="if(event.key==='Enter'){penBusca(this.value, true)}" style="min-width:180px"
      aria-label="buscar município"><datalist id="penbusca-dl"></datalist>
    <span class="src">${fmt.n0(base.length)} municípios no recorte${cortes ? ` · mínimo de ${fmt.n0(P.cobertura.min_adultos)} adultos e ${fmt.money(P.cobertura.min_renda_anual)} de renda anual` : ""}</span>
  </div>`;

  /* ---------- mapa ---------- */
  const porCod = Object.fromEntries(base.map(m => [m.cod, m]));
  const escala = met === "confianca" ? null : penEscala(base.map(m => m[met]), M.esc);
  const paths = malha ? Object.entries(malha.paths).map(([cod, d]) => {
    const m = porCod[cod];
    const cor = !m ? "var(--surface-2)"
      : met === "confianca" ? `color-mix(in srgb, ${PEN_CONF[m.confianca]} 55%, var(--surface))`
      : escala(m[met]);
    if (!m) return `<path d="${d}" fill="var(--surface-2)" class="penmun fora"></path>`;
    const tip = encodeURIComponent(`<div class="tt-date">${m.nome} (${m.uf}) — ${m.regiao}</div>
      <div class="tt-row"><span class="tt-lbl">crédito</span><span class="tt-val">${m.credito != null ? fmt.money(m.credito) : "sem saldo"}</span></div>
      <div class="tt-row"><span class="tt-lbl">por adulto</span><span class="tt-val">${m.cred_adulto != null ? "R$ " + fmt.n0(m.cred_adulto) : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">sobre renda anual</span><span class="tt-val">${m.penetracao != null ? fmt.n(m.penetracao, 1) + "%" : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">gap estimado</span><span class="tt-val">${m[campoGap] != null ? fmt.money(m[campoGap]) : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">confiabilidade</span><span class="tt-val">${m.confianca}</span></div>`);
    return `<path d="${d}" fill="${cor}" class="penmun${F.sel === cod ? " sel" : ""}" data-tip="${tip}" onclick="penSel('${cod}')" aria-label="${attr(m.nome + " " + m.uf + ": " + M.fmt(m))}"></path>`;
  }).join("") : "";

  const mapa = `<section id="pen-mapa">${sechead("Onde o crédito está, e onde ele é raro", `${M.l} · ${P.data_base_credito}`)}
  <div class="controls">${Object.entries(PEN_METRICAS).map(([k, v]) =>
    `<button class="btn ${met === k ? "" : "ghost"} small" onclick="penFiltra('met','${k}')">${v.l}</button>`).join("")}</div>
  <div class="penlayout">
    <div class="card">
      ${malha ? `<svg class="penmapa" viewBox="${malha.viewBox}" role="group" aria-label="mapa municipal de ${attr(M.l)}"><g transform="${malha.transform}">${paths}</g></svg>`
              : `<p class="src">malha municipal ainda carregando…</p>`}
      <p class="src">Sombreado entre o percentil 5 e o 95 do recorte — winsorização apenas visual, o dado exportado é o bruto.
      Municípios em cinza estão fora do recorte ou sem saldo no ESTBAN. Clique para abrir o perfil.</p>
    </div>
    <div class="card penrank">
      <h4>${F.rank === "maior" ? "Maior penetração" : "Menor penetração"} <span class="src">no recorte</span></h4>
      <div class="controls" style="margin:0 0 8px">
        <span class="seg">${[["menor", "menor"], ["maior", "maior"]].map(([v, l]) =>
          `<button class="${(F.rank || "menor") === v ? "active" : ""}" onclick="penFiltra('rank','${v}')">${l}</button>`).join("")}</span>
      </div>
      <ol class="penlista">
        ${comSaldo.filter(m => m.penetracao != null)
          .sort((a, b) => (F.rank === "maior" ? b.penetracao - a.penetracao : a.penetracao - b.penetracao))
          .slice(0, 30).map(m => `<li class="${F.sel === m.cod ? "sel" : ""}">
            <button type="button" onclick="penSel('${m.cod}')" aria-label="${attr(`${m.nome} ${m.uf}: ${fmt.n(m.penetracao, 1)}% da renda anual`)}">
              <span class="n">${m.nome}<small>${m.uf}</small></span>
              <span class="v">${fmt.n(m.penetracao, 1)}%</span></button></li>`).join("")}
      </ol>
    </div>
  </div></section>`;

  /* ---------- perfil municipal ---------- */
  const sel = F.sel ? P.municipios.find(m => m.cod === F.sel) : null;
  const perfil = !sel ? "" : `<div class="card penperfil" id="pen-perfil">
    <div class="pp-cab"><div><h4>${sel.nome} <span class="src">${sel.uf} · ${sel.regiao}</span></h4>
      <span class="src">confiabilidade <b>${sel.confianca}</b> — ${sel.confianca_motivo || ""}</span></div>
      <button class="btn ghost small" onclick="penFiltra('sel', null)">fechar</button></div>
    <dl class="ppgrid">
      ${[["Saldo de crédito", sel.credito != null ? fmt.money(sel.credito) : "sem saldo no ESTBAN"],
         ["Renda domiciliar anual", fmt.money(sel.renda_anual)],
         ["População 18 anos ou mais", fmt.n0(sel.adultos)],
         ["Crédito por adulto", sel.cred_adulto != null ? "R$ " + fmt.n0(sel.cred_adulto) : "–"],
         ["Crédito sobre renda anual", sel.penetracao != null ? fmt.n(sel.penetracao, 1) + "%" : "–"],
         ["Equivale a", sel.meses_renda != null ? fmt.n(sel.meses_renda, 1) + " meses de renda" : "–"],
         ["Benchmark dos pares", sel.pares_penetracao != null ? fmt.n(sel.pares_penetracao, 1) + "% (" + sel.pares_n + " pares)" : "grupo pequeno demais"],
         ["Esperado pelo modelo", sel.modelo_esperado != null ? fmt.money(sel.modelo_esperado) : "–"],
         ["Faixa de referência", sel.modelo_faixa ? fmt.money(sel.modelo_faixa[0]) + " a " + fmt.money(sel.modelo_faixa[1]) : "–"],
         ["Gap absoluto (modelo)", sel.gap_abs_modelo != null ? fmt.money(sel.gap_abs_modelo) : "–"],
         ["Gap relativo (modelo)", sel.gap_rel_modelo != null ? fmt.n(sel.gap_rel_modelo, 1) + "%" : "–"],
         ["Gap absoluto (pares)", sel.gap_abs_pares != null ? fmt.money(sel.gap_abs_pares) : "–"],
         ["Resíduo padronizado", sel.residuo_padronizado != null ? fmt.n(sel.residuo_padronizado, 2) + " σ" : "–"],
         ["Participação no crédito da UF", sel.part_cred_uf != null ? fmt.n(sel.part_cred_uf, 2) + "%" : "–"],
         ["Participação na renda da UF", sel.part_renda_uf != null ? fmt.n(sel.part_renda_uf, 2) + "%" : "–"],
         ["Participação nos adultos da UF", sel.part_adultos_uf != null ? fmt.n(sel.part_adultos_uf, 2) + "%" : "–"],
         ["Instituições reportando", sel.instituicoes || 0],
         ["Urbanização", sel.urbanizacao != null ? fmt.n(sel.urbanizacao, 1) + "%" : "–"]]
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
    </dl>
    ${sel.serie && sel.serie.filter(Boolean).length > 1 ? `<div class="ppserie">
      <h5>Saldo mês a mês <span class="src">${P.eixo_serie[0]} a ${P.eixo_serie[P.eixo_serie.length - 1]}${sel.var_serie != null ? ` · ${fmt.pp(sel.var_serie)}% no período` : ""}</span></h5>
      ${lineChart({ w: 660, h: 190, lo0: true,
        series: [{ nome: "saldo de crédito", pts: P.eixo_serie.map((d, i) => ({ x: d, y: sel.serie[i] })) }],
        unidade: "R$", aria: `saldo de crédito de ${attr(sel.nome)} mês a mês`,
        fonte: "BCB/ESTBAN", periodo: `${P.eixo_serie[0]} a ${P.eixo_serie[P.eixo_serie.length - 1]}`,
        atualizado: (P.gerado_em || "").slice(0, 10),
        nota: [sel.serie_completa ? "Série completa no período." :
                "Há meses sem linha no ESTBAN — aparecem como interrupção, não como zero: o município pode ter ficado sem dependência reportando.",
               `A data-base ${P.data_base_excluida.data} fica fora da série: ${P.data_base_excluida.motivo}`].join(" ") })}
      ${sel.serie_instavel ? `<div class="desnota"><b>Série instável.</b> O maior salto de um mês para o outro é de
      ${fmt.n(sel.maior_salto_mensal, 0)}%. Variação dessa ordem em saldo contábil municipal é assinatura de
      reclassificação de carteira entre dependências, não de crédito novo — por isso este município recebe
      confiabilidade baixa e fica fora dos rankings.</div>` : ""}
    </div>` : ""}
    ${sel.instituicoes_top && sel.instituicoes_top.length ? `<div class="ppinst">
      <h5>Quem contabiliza o saldo <span class="src">maiores instituições em ${P.data_base_credito}</span></h5>
      ${sel.instituicoes_top.map(i => panBar(i.nome, i.credito, sel.instituicoes_top[0].credito,
          () => fmt.money(i.credito), `${fmt.n(i.part, 1)}%`)).join("")}
      <p class="src">Concentração num único nome costuma indicar contabilização centralizada — é um dos critérios do selo de confiabilidade.</p>
    </div>` : ""}
    <div class="desnota">O saldo é o contabilizado nas dependências deste município, não o crédito tomado por
    seus moradores. Em centro regional o número sobe por atender vizinhos; onde há sede de instituição, sobe por
    contabilização centralizada.</div>
  </div>`;

  /* ---------- dispersão ---------- */
  const disp = comSaldo.filter(m => m.credito > 0 && m.renda_anual > 0);
  const lx = disp.map(m => Math.log10(m.renda_anual)), ly = disp.map(m => Math.log10(m.credito));
  const xlo = Math.min(...lx), xhi = Math.max(...lx), ylo = Math.min(...ly), yhi = Math.max(...ly);
  const W = 720, H = 380, Mg = { t: 16, r: 16, b: 40, l: 58 };
  const px = v => Mg.l + (v - xlo) / (xhi - xlo) * (W - Mg.l - Mg.r);
  const py = v => H - Mg.b - (v - ylo) / (yhi - ylo) * (H - Mg.t - Mg.b);
  const rmax = Math.max(...disp.map(m => m.adultos));
  const bolhas = disp.map(m => {
    const r = 1.4 + 7 * Math.sqrt(m.adultos / rmax);
    const g = m.gap_rel_modelo;
    const cor = g == null ? "var(--c-gray)" : g > 50 ? "var(--c-neg)" : g > 0 ? "var(--warning)" : "var(--positive)";
    return `<circle cx="${px(Math.log10(m.renda_anual)).toFixed(1)}" cy="${py(Math.log10(m.credito)).toFixed(1)}" r="${r.toFixed(1)}"
      fill="${cor}" fill-opacity="${F.sel === m.cod ? 1 : 0.42}" ${F.sel === m.cod ? 'stroke="var(--text)" stroke-width="1.5"' : ""}
      onclick="penSel('${m.cod}')" style="cursor:pointer" role="button" tabindex="-1"
      aria-label="${attr(`${m.nome} ${m.uf}: crédito ${fmt.money(m.credito)}, renda anual ${fmt.money(m.renda_anual)}`)}"><title>${attr(m.nome + "/" + m.uf)}</title></circle>`;
  }).join("");
  // linha do modelo: mediana do esperado dentro de faixas de renda
  const faixas = 14, linha = [];
  for (let i = 0; i < faixas; i++) {
    const a = xlo + (xhi - xlo) * i / faixas, b = xlo + (xhi - xlo) * (i + 1) / faixas;
    const dentro = disp.filter(m => { const v = Math.log10(m.renda_anual); return v >= a && v < b && m.modelo_esperado; });
    if (dentro.length >= 3) {
      const ord = dentro.map(m => Math.log10(m.modelo_esperado)).sort((x, y) => x - y);
      linha.push([(a + b) / 2, ord[Math.floor(ord.length / 2)]]);
    }
  }
  const dispersao = `<section id="pen-dispersao">${sechead("Renda e crédito, município a município", "escala logarítmica nos dois eixos")}
  <div class="card">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="dispersão entre renda domiciliar anual e saldo de crédito por município">
      <line x1="${Mg.l}" y1="${H - Mg.b}" x2="${W - Mg.r}" y2="${H - Mg.b}" stroke="var(--c-axis)"/>
      <line x1="${Mg.l}" y1="${Mg.t}" x2="${Mg.l}" y2="${H - Mg.b}" stroke="var(--c-axis)"/>
      ${bolhas}
      ${linha.length > 1 ? `<path d="M${linha.map(([x, y]) => px(x).toFixed(1) + "," + py(y).toFixed(1)).join("L")}"
        fill="none" stroke="var(--text)" stroke-width="1.8" stroke-dasharray="5,3"/>` : ""}
      ${[0, 0.5, 1].map(t => { const v = xlo + (xhi - xlo) * t;
        return `<text x="${px(v)}" y="${H - 14}" font-size="9.5" text-anchor="middle" style="fill:var(--c-axis-text)">R$ ${fmt.n0(Math.pow(10, v) / 1e6)} mi</text>`; }).join("")}
      ${[0, 0.5, 1].map(t => { const v = ylo + (yhi - ylo) * t;
        return `<text x="${Mg.l - 6}" y="${py(v) + 3}" font-size="9.5" text-anchor="end" style="fill:var(--c-axis-text)">R$ ${fmt.n0(Math.pow(10, v) / 1e6)} mi</text>`; }).join("")}
    </svg>
    <div class="legend"><span><span class="sw" style="background:var(--c-neg)"></span>gap acima de 50%</span>
      <span><span class="sw" style="background:var(--warning)"></span>gap positivo</span>
      <span><span class="sw" style="background:var(--positive)"></span>acima do esperado</span>
      <span><span class="sw" style="background:var(--text);height:2px"></span>mediana do esperado pelo modelo</span></div>
    <p class="src">Eixo horizontal: renda domiciliar anual. Vertical: saldo de crédito. Tamanho da bolha: população adulta.
    Municípios muito abaixo da linha tracejada são os candidatos a subatendimento — com a ressalva de que a dispersão
    residual do modelo é alta (σ = ${P.modelo ? fmt.n(P.modelo.sigma_residual, 2) : "–"} em logaritmo).</p>
  </div></section>`;

  /* ---------- rankings ---------- */
  const RANK_DEF = [
    ["oportunidade_escala", "Oportunidade com escala", "combina gap absoluto, gap relativo e porte, em postos normalizados", m => fmt.n(m.escore_oportunidade, 1), "Escore"],
    ["gap_absoluto", "Maior gap absoluto", "potencial adicional estimado, em reais", m => fmt.money(m.gap_abs_modelo), "Gap"],
    ["gap_relativo", "Maior gap relativo", "distância percentual em relação ao esperado", m => fmt.n(m.gap_rel_modelo, 0) + "%", "Gap %"],
    ["menor_credito_adulto", "Menor crédito por adulto", "saldo dividido pela população de 18+", m => "R$ " + fmt.n0(m.cred_adulto), "Por adulto"],
    ["menor_penetracao", "Menor crédito sobre renda", "estoque sobre renda domiciliar anual", m => fmt.n(m.penetracao, 1) + "%", "Sobre renda"],
    ["maior_penetracao", "Maior penetração", "o outro extremo da mesma distribuição", m => fmt.n(m.penetracao, 1) + "%", "Sobre renda"],
    ["mais_atipicos", "Resultados mais atípicos", "maior resíduo padronizado do modelo, nos dois sentidos", m => fmt.n(m.residuo_padronizado, 2) + " σ", "Resíduo"],
  ];
  const rankAtivo = F.tabela || "oportunidade_escala";
  const def = RANK_DEF.find(r => r[0] === rankAtivo);
  const rankings = `<section id="pen-rankings">${sechead("Rankings", "separados de propósito — cada um responde a uma pergunta diferente")}
  <div class="controls">${RANK_DEF.map(([k, l]) =>
    `<button class="btn ${rankAtivo === k ? "" : "ghost"} small" onclick="penFiltra('tabela','${k}')">${l}</button>`).join("")}</div>
  <div class="card">
    <h4>${def[1]}</h4><p class="src">${def[2]}. Universo: ${fmt.n0(P.cobertura.elegiveis_ranking)} municípios que passam nos cortes mínimos e não têm confiabilidade baixa.</p>
    <div class="tblwrap"><table class="data penrankt"><thead><tr><th>#</th><th>Município</th><th>${def[4] || "Valor"}</th>
      <th>Crédito</th><th>Por adulto</th><th>Sobre renda</th><th>Adultos</th></tr></thead><tbody>
    ${P.rankings[rankAtivo].map((m, i) => `<tr onclick="penSel('${m.cod}')" style="cursor:pointer" class="${F.sel === m.cod ? "selrow" : ""}">
      <td class="src">${i + 1}</td>
      <td><b>${m.nome}</b> <span class="src">${m.uf}</span> <span class="pconf ${m.confianca}">${m.confianca}</span></td>
      <td style="text-align:right"><b>${def[3](m)}</b></td>
      <td style="text-align:right">${m.credito != null ? fmt.money(m.credito) : "–"}</td>
      <td style="text-align:right">${m.cred_adulto != null ? "R$ " + fmt.n0(m.cred_adulto) : "–"}</td>
      <td style="text-align:right">${m.penetracao != null ? fmt.n(m.penetracao, 1) + "%" : "–"}</td>
      <td style="text-align:right">${fmt.n0(m.adultos)}</td></tr>`).join("")}
    </tbody></table></div>
    <details class="charttable"><summary>os mesmos rankings sem os cortes mínimos de porte</summary>
      <p class="src">Sem corte, municípios pequenos ocupam o topo por terem denominador reduzido — é por isso que
      o painel usa cortes por padrão, e mostra as duas versões.</p>
      <div class="tblwrap"><table class="data"><thead><tr><th>Município</th><th>UF</th><th>Gap absoluto</th><th>Por adulto</th><th>Adultos</th></tr></thead><tbody>
      ${(P.rankings.gap_absoluto_sem_corte || []).map(m => `<tr><td>${m.nome}</td><td class="src">${m.uf}</td>
        <td style="text-align:right">${fmt.money(m.gap_abs_modelo)}</td>
        <td style="text-align:right">${m.cred_adulto != null ? "R$ " + fmt.n0(m.cred_adulto) : "–"}</td>
        <td style="text-align:right">${fmt.n0(m.adultos)}</td></tr>`).join("")}
      </tbody></table></div></details>
  </div></section>`;

  /* ---------- achados ---------- */
  const achados = `<section id="pen-achados">${sechead("Principais achados", "gerados dos dados, com filtro, período e ressalva")}
  <div class="penachados">
    ${P.achados.map(a => `<article>
      <p>${a.texto}</p>
      <p class="meta">${penSelo(a.selo)} <b>filtro</b> ${a.filtro} · <b>período</b> ${a.periodo} · <b>universo</b> ${a.universo}</p>
      <p class="lim"><b>Ressalva.</b> ${a.ressalva}</p>
    </article>`).join("")}
  </div></section>`;

  /* ---------- metodologia ---------- */
  const metodo_sec = `<section id="pen-metodo">${sechead("Metodologia e limitações")}
  <div class="card"><h4>De onde vem cada número</h4>
    <div class="tblwrap"><table class="data"><thead><tr><th>Fonte</th><th>Geografia</th><th>O que mede</th><th>Cobertura</th><th>Principal limitação</th></tr></thead><tbody>
      <tr><td><b>ESTBAN</b></td><td>Município</td><td>Saldos contabilizados nas dependências bancárias</td>
        <td>${fmt.n0(P.cobertura.com_saldo_estban)} municípios · ${P.data_base_credito}</td>
        <td>O município de contabilização pode não ser o do tomador</td></tr>
      <tr><td><b>SCR.data</b></td><td>UF</td><td>Exposição de crédito dos clientes</td><td>Operações reportadas ao SCR</td>
        <td>Não permite observação municipal na base pública</td></tr>
      <tr><td><b>Censo 2022</b></td><td>Município</td><td>População e renda dos residentes</td><td>5.570 municípios</td>
        <td>Renda referente a 2022</td></tr>
    </tbody></table></div>
    <div class="desnota"><b>O SCR não é desagregado aqui.</b> Nenhum saldo municipal desta página vem do SCR, e
    nenhum número do ESTBAN é rebatizado de SCR. São medidas diferentes de coisas diferentes.</div>
  </div>
  <div class="card"><h4>Os dois métodos de gap</h4>
    <div class="pen2col">
      <div><h5>Benchmark de pares ${penSelo("estimado")}</h5>
        <p class="src">${P.benchmark_pares.criterio}. A penetração esperada é a ${P.benchmark_pares.estatistica},
        exigindo pelo menos ${P.benchmark_pares.minimo_grupo} municípios no grupo — ${P.benchmark_pares.grupos} grupos formados,
        cobrindo ${fmt.n0(P.benchmark_pares.cobertos)} municípios.</p></div>
      <div><h5>Modelo estatístico ${penSelo("estimado")}</h5>
        ${P.modelo ? `<p class="src"><code>${P.modelo.especificacao}</code></p>
        <p class="src">n = ${fmt.n0(P.modelo.n)} · R² = ${fmt.n(P.modelo.r2, 3)} · R² ajustado = ${fmt.n(P.modelo.r2_ajustado, 3)} ·
        desvio residual σ = ${fmt.n(P.modelo.sigma_residual, 3)} em logaritmo.</p>
        <p class="src"><b>Coeficientes:</b> ${Object.entries(P.modelo.coeficientes).map(([k, v]) => `${k} ${fmt.n(v, 3)}`).join(" · ")}</p>
        <p class="src">${P.modelo.por_que_assim || ""}</p>
        <p class="src">${P.modelo.nota}</p>` : "<p class='src'>modelo indisponível nesta execução</p>"}</div>
    </div>
    <div class="desnota"><b>A precisão individual é baixa.</b> Com σ de ${P.modelo ? fmt.n(P.modelo.sigma_residual, 2) : "–"} em
    logaritmo, a faixa de referência de um município vai de cerca de um terço a três vezes o valor central. O gap de um
    município isolado é indicativo; a soma de muitos municípios é mais informativa que qualquer linha do ranking.</div>
  </div>
  <div class="card"><h4>Fórmulas</h4>
    <div class="desdic">
      ${[["Penetração", "observado ÷ observado", "Saldo de crédito ÷ renda domiciliar anual, em %", "calculado",
          "Numerador é estoque, denominador é fluxo anual. Por isso aparece também em meses equivalentes de renda."],
         ["Crédito por adulto", "observado ÷ observado", "Saldo de crédito ÷ população de 18 anos ou mais", "calculado",
          "População do Censo 2022; o saldo é da data-base corrente."],
         ["Renda domiciliar anual", "observado × observado × 12", "Moradores em domicílios particulares permanentes × rendimento per capita médio × 12", "calculado",
          "Produto da média pelo seu próprio denominador, ambos publicados pelo IBGE. Não é estimativa."],
         ["Gap absoluto", "máx(0, esperado − observado)", "Diferença entre o crédito esperado e o observado, quando positiva", "estimado",
          "Contrafactual. Não é demanda comprovada nem dinheiro que falta."],
         ["Gap relativo", "(esperado − observado) ÷ esperado", "Distância percentual em relação ao esperado", "estimado",
          "Sensível quando o esperado é pequeno; leia junto com o gap absoluto."],
         ["Escore de oportunidade", "posto médio invertido", "Combina gap absoluto, gap relativo e população adulta em postos normalizados", "estimado",
          "Postos evitam que uma escala domine as outras. Não é previsão de negócio."]]
        .map(([n, f, d, selo, lim]) => `<article><h5>${n} ${penSelo(selo)}</h5><p>${d}</p>
          <p class="meta"><b>Fórmula</b> <code>${f}</code></p><p class="lim"><b>Limitações.</b> ${lim}</p></article>`).join("")}
    </div>
  </div>
  <div class="card"><h4>O que estes dados não autorizam concluir</h4>
    <ul class="src" style="line-height:1.85">
      <li>O ESTBAN mostra o município onde o saldo foi <b>contabilizado</b>, que pode não ser o domicílio do tomador.</li>
      <li>Bancos digitais e instituições com contabilização centralizada distorcem a distribuição municipal — ${P.municipios.filter(m => m.confianca === "baixa" && m.no_estban).length} municípios têm selo de confiabilidade baixa por esse motivo.</li>
      <li>Municípios que funcionam como centros regionais concentram operações de moradores de cidades vizinhas.</li>
      <li>O SCR público não oferece detalhamento municipal, e nada aqui o desagrega.</li>
      <li><b>Baixa penetração não prova restrição de oferta.</b> Pode refletir demanda, informalidade, composição econômica, cooperativismo, crédito não bancário ou deslocamento para municípios vizinhos.</li>
      <li>O gap é uma estimativa contrafactual, não um valor observado.</li>
      <li>Não é possível inferir quantas pessoas estão sem acesso a crédito a partir de saldos agregados — por isso o painel não publica esse número.</li>
      <li>A renda é de 2022 e a população também; o saldo é da data-base corrente. A comparação supõe que a distribuição municipal da renda mudou pouco desde o Censo.</li>
      <li>A data-base <b>${P.data_base_excluida.data}</b> foi excluída da série histórica. ${P.data_base_excluida.motivo}</li>
      <li>${P.municipios.filter(m => m.serie_instavel).length} municípios apresentam salto superior a 50% em um único mês — assinatura de reclassificação contábil entre dependências. Todos recebem confiabilidade baixa e ficam fora dos rankings.</li>
    </ul>
  </div>
  ${P.reconciliacao_scr && P.reconciliacao_scr.disponivel ? (() => {
    const R = P.reconciliacao_scr;
    const maxr = Math.max(...R.linhas.map(l => l.razao));
    return `<div class="card"><h4>Reconciliação estadual com o SCR</h4>
    <p class="src">${R.nota}</p>
    ${R.aviso_data ? `<div class="desnota">${R.aviso_data}</div>` : ""}
    <div class="pen2col" style="align-items:start">
      <div>
        <div class="big" style="font-size:26px">${fmt.n(R.razao_br, 2)}×</div>
        <p class="src">é a razão nacional entre o total do ESTBAN (${fmt.money(R.total_estban)}) e o do SCR
        (${fmt.money(R.total_scr)}), ambos em ${R.data_base_estban}${R.mesmo_mes ? " — mesma data-base" : ""}.
        Próxima de 1 no agregado, ela se desfaz por estado: é aí que a contabilização aparece.</p>
        <p class="src">O ${R.linhas[0].uf} contabiliza <b>${fmt.n(R.linhas[0].razao, 1)}×</b> a exposição de crédito
        dos seus residentes; ${R.linhas[R.linhas.length - 1].uf}, apenas ${fmt.n(R.linhas[R.linhas.length - 1].razao, 2)}×.
        É o mesmo fenômeno que, no nível municipal, gera o selo de confiabilidade.</p>
      </div>
      <div>${R.linhas.map(l => panBar(l.uf, l.razao, maxr, () => fmt.n(l.razao, 2) + "×",
          `${fmt.money(l.estban)} vs ${fmt.money(l.scr)}`)).join("")}</div>
    </div>
    <details class="charttable"><summary>dados em tabela</summary>
    <div class="tblwrap"><table class="data"><thead><tr><th>UF</th><th>ESTBAN (contabilizado)</th><th>SCR (exposição dos clientes)</th><th>Razão</th></tr></thead><tbody>
    ${R.linhas.map(l => `<tr><td><b>${l.uf}</b></td><td style="text-align:right">${fmt.money(l.estban)}</td>
      <td style="text-align:right">${fmt.money(l.scr)}</td><td style="text-align:right">${fmt.n(l.razao, 2)}×</td></tr>`).join("")}
    </tbody></table></div></details></div>`; })()
    : `<div class="card"><h4>Reconciliação estadual com o SCR</h4>
    <p class="src">${(P.reconciliacao_scr || {}).motivo || "indisponível"} — a comparação entra assim que a série estadual do SCR estiver no armazém desta execução.</p></div>`}
  <div class="card"><h4>Procedência</h4>
    <ul class="src" style="line-height:1.85">
      <li><b>Crédito:</b> ${P.fontes.credito} · data-base ${P.data_base_credito} · ${P.datas_credito.length} data-bases absorvidas.</li>
      <li><b>Demografia e renda:</b> ${P.fontes.demografia} · ano-base ${P.ano_base_censo}.</li>
      <li><b>Malha:</b> ${P.fontes.malha}.</li>
      <li><b>Conciliação:</b> o ESTBAN usa código próprio do BCB, não o do IBGE. O casamento é por UF e nome normalizado, com lista explícita de grafias divergentes e agregação das regiões administrativas do Distrito Federal em Brasília. Município que não casa fica de fora e é contado.</li>
      <li><b>Processado em</b> ${(P.gerado_em || "").slice(0, 16).replace("T", " ")} UTC.</li>
    </ul>
  </div></section>`;

  el.innerHTML = pageHead({
    title: "Penetração e Gap de Crédito",
    desc: "Quanto crédito existe em cada município, quanto isso representa para quem mora lá e onde a diferença em relação a municípios comparáveis é maior.",
    vintage: P.data_base_credito,
    fontes: `ESTBAN ${P.data_base_credito} · Censo IBGE ${P.ano_base_censo} · malha municipal IBGE`,
  }) + `<div class="desprosa"><p class="lead">O numerador vem do ESTBAN — o saldo de crédito contabilizado nas
  dependências bancárias de cada município. O denominador vem do Censo 2022: população adulta e renda domiciliar.
  A razão entre os dois diz quanto crédito existe por ali em relação ao tamanho econômico do lugar. O gap compara
  esse número ao de municípios parecidos.</p></div>
`
  + cards + filtros + mapa + avisoPen + cobertura + perfil + dispersao + rankings + achados + metodo_sec;
}

const PEN_SELO_DIC = { observado: ["obs", "OBSERVADO"], calculado: ["calc", "CALCULADO"],
  estimado: ["est", "ESTIMADO"], contextual: ["ctx", "CONTEXTUAL"] };
function penSelo(s) { return seloChip(PEN_SELO_DIC, s); }

/* ---------- ALERTAS ----------
   Central unificada: as cinco famílias de alerta do Observatório num só lugar.
   O que a página NÃO faz é tão importante quanto o que ela faz — não soma
   famílias, não cria escala comum de gravidade e não ordena uma família contra
   a outra. Universos e periodicidades são diferentes; a consolidação é de
   endereço, não de escala. Cada seção declara o seu universo e a sua regra. */
const ALERTA_FILTRO = { familia: "todas", estado: "abertos", q: "" };

window.alertaFiltra = (campo, valor) => { ALERTA_FILTRO[campo] = valor; renderAlerts(); };
window.alertaBusca = (v) => {
  ALERTA_FILTRO.q = v;
  const el = document.getElementById("alListas");
  if (el) el.innerHTML = listasAlertas();
};

function alertasAbertos(itens) {
  const est = loadLS("obc_alert_states", {});
  return itens.filter(a => !["resolvido", "descartado"].includes(est[a.id] || est[a.id.split(":").slice(1).join(":")] || "ativo"));
}

/* o dado guarda o nível sem acento (chave); a tela mostra a palavra */
const NIVEL_LABEL = { informativo: "informativo", atencao: "atenção", relevante: "relevante", critico: "crítico" };

/** Cartão de um alerta já normalizado pela central. */
function alertaCard(a) {
  const st = alertState(a.id);
  const apagado = st === "descartado" || st === "resolvido";
  const nivel = a.nivel || "informativo";
  const linha = [
    a.valor != null ? `valor <b>${fmt.n(a.valor, 2)}</b>` : null,
    a.limiar != null ? `limiar ${fmt.n(a.limiar, 2)}` : null,
    a.referencia ? `ref. ${a.referencia}` : null,
    a.fonte ? `fonte ${a.fonte}` : null,
    a.evidencia_persistencia ? `persistência: ${a.evidencia_persistencia}` : null,
  ].filter(Boolean).join(" · ");
  return `<div class="alert ${nivel}" style="${apagado ? "opacity:.5" : ""}">
    <div class="alcab">
      <div>
        <span class="lvl">${a.nivel ? NIVEL_LABEL[a.nivel] || a.nivel : "sem nível declarado"}</span>
        <b>${a.titulo}</b>
        ${a.recorrente ? ` <span class="qbadge q-mid" title="${attr(a.evidencia_persistencia || "")}">recorrente</span>` : ""}
      </div>
      <select onchange="setAlertState('${a.id}', this.value)" aria-label="estado deste alerta">
        ${ALERT_STATES.map(x => `<option ${x === st ? "selected" : ""}>${x}</option>`).join("")}</select>
    </div>
    <div class="expl">${a.detalhe || ""}</div>
    <div class="src" style="margin-top:5px">${linha}
      ${a.link && a.link.view ? ` · <a href="javascript:void(0)" onclick="nav('${a.link.view}')">ver em ${VIEW_TITLES[a.link.view] || a.link.view} →</a>` : ""}</div>
  </div>`;
}

function listasAlertas() {
  const C = state.data.alertas_central;
  const q = _norm(ALERTA_FILTRO.q);
  const est = loadLS("obc_alert_states", {});
  return C.familias.map(fam => {
    if (ALERTA_FILTRO.familia !== "todas" && ALERTA_FILTRO.familia !== fam.id) return "";
    let itens = C.alertas.filter(a => a.familia === fam.id);
    if (ALERTA_FILTRO.estado === "abertos") itens = alertasAbertos(itens);
    if (q) itens = itens.filter(a => _norm(`${a.titulo} ${a.detalhe} ${a.fonte}`).includes(q));
    const total = C.alertas.filter(a => a.familia === fam.id).length;
    return `<section style="margin-top:22px">
      ${sechead(fam.nome, `${itens.length} de ${total} · ${fam.periodicidade}`)}
      <div class="src" style="margin:-4px 0 10px">
        <b>Universo:</b> ${fam.universo} · <b>fonte:</b> ${fam.fonte}<br>
        <b>Regra:</b> ${fam.regra_geral}<br>
        <b>Ordem desta lista:</b> ${fam.ordenacao} — válida só dentro desta família.<br>
        <b>Limite:</b> ${fam.limitacao}
      </div>
      ${itens.length ? itens.map(a => alertaCard(a)).join("")
        : `<div class="card"><p class="src">${total ? "Nenhum alerta desta família no filtro atual."
            : `Nenhuma regra desta família foi disparada nesta data-base. ${C.ausencia}`}</p></div>`}
    </section>`;
  }).join("");
}

function renderAlerts() {
  const el = document.getElementById("view-alerts");
  const { alerts, pulse } = state.data;
  const C = state.data.alertas_central;
  if (!C) { el.innerHTML = "<p>sem dados</p>"; return; }
  const abertos = alertasAbertos(C.alertas);
  const porFam = f => C.alertas.filter(a => a.familia === f).length;
  const comNivel = C.alertas.filter(a => a.nivel).length;
  const userRules = alerts && pulse ? getUserRules() : [];
  const userAlerts = alerts && pulse ? evalUserRules() : [];
  const hist = (alerts && alerts.historico) || [];

  const chips = `<div class="controls" style="gap:6px;flex-wrap:wrap">
    <button class="btn ${ALERTA_FILTRO.familia === "todas" ? "" : "ghost"} small" onclick="alertaFiltra('familia','todas')">todas (${C.total})</button>
    ${C.familias.map(f => `<button class="btn ${ALERTA_FILTRO.familia === f.id ? "" : "ghost"} small" onclick="alertaFiltra('familia','${f.id}')">${f.nome} (${porFam(f.id)})</button>`).join("")}
  </div>
  <div class="controls" style="gap:6px;flex-wrap:wrap;margin-top:-4px">
    <span class="seg">${[["abertos", "em aberto"], ["todos", "incluir resolvidos"]].map(([v, l]) =>
      `<button class="${ALERTA_FILTRO.estado === v ? "active" : ""}" onclick="alertaFiltra('estado','${v}')">${l}</button>`).join("")}</span>
    <input type="search" placeholder="buscar no texto dos alertas" value="${attr(ALERTA_FILTRO.q)}"
      oninput="alertaBusca(this.value)" style="min-width:220px" aria-label="buscar alertas">
  </div>`;

  el.innerHTML = `
  ${pageHead({ title: "Central de alertas",
    desc: "Todos os alertas do Observatório num só lugar, separados por família porque observam universos diferentes. Estado gerenciável por alerta e feed RSS para assinatura externa.",
    fontes: C.familias.map(f => f.fonte).join(" · ") })}
  <div class="judalerta" style="margin-bottom:14px">
    <b>Quatro famílias, quatro universos — não some as contagens.</b>
    <div style="margin-top:5px">${C.nao_comparavel}</div>
    <div style="margin-top:5px">${C.sem_nivel}</div>
  </div>
  <div class="controls">
    <a class="btn ghost small" href="${DATA_BASE}alerts.xml" target="_blank" rel="noopener">📡 assinar alertas (RSS)</a>
    <a class="btn ghost small" href="${DATA_BASE}report.html?v=${APP_VERSION}" target="_blank" rel="noopener">📄 relatório automático diário (HTML → imprimir = PDF)</a>
    <span class="src">para receber por e-mail: assine o RSS em qualquer serviço RSS→e-mail (ex.: Blogtrottr); periodicidade segue o pipeline diário</span>
  </div>
  <div class="card" style="margin-top:12px">
    <h4>Situação nesta execução</h4>
    <p style="margin:6px 0">${C.total} alertas disparados por regras publicadas, ${abertos.length} em aberto no seu navegador.
    ${comNivel} trazem nível declarado pela fonte; ${C.total - comNivel} vêm de fontes que não graduam severidade.</p>
    <div class="src">${C.estado_local}<br>Processado em ${C.gerado_em ? C.gerado_em.slice(0, 16).replace("T", " ") : "–"} UTC.
    ${(C.fontes_ausentes || []).length ? `<br><b>Famílias sem dado nesta execução:</b> ${C.fontes_ausentes.map(x => `${x.familia} (${x.motivo})`).join("; ")}` : ""}</div>
  </div>
  ${chips}
  <div id="alListas">${listasAlertas()}</div>
  ${entenda("al-fam", [
    ["Por que separado por família", "Um alerta macro descreve o sistema inteiro numa série mensal do BCB. Um alerta de carteira descreve uma submodalidade do SCR.data numa data-base trimestral. Empilhá-los numa lista única sugeriria uma comparação que o dado não sustenta."],
    ["Por que alguns não têm nível", "Nível é informação da fonte. Onde a fonte não gradua — a carteira do SCR.data —, atribuir um aqui seria inventar."],
    ["O que significa ausência", C.ausencia],
    ["Onde fica o meu estado", C.estado_local],
  ])}
  <h3 style="margin-top:26px">Minhas regras (avaliadas no navegador, salvas localmente)</h3>
  ${alerts && pulse ? `<div class="controls">
    <label>série <select id="urSeries">${Object.keys(pulse.series).map(k => `<option value="${k}">${k}</option>`).join("")}</select></label>
    <label>métrica <select id="urMetric"><option value="level">nível</option><option value="yoy">variação a/a</option></select></label>
    <label>direção <select id="urDir"><option value="up">acima de</option><option value="down">abaixo de</option></select></label>
    <label>limiar <input id="urThr" type="number" step="0.1" style="width:80px"></label>
    <button class="btn small" onclick="addUserRule()">adicionar</button>
  </div>
  ${userRules.map((r, i) => `<div class="alert ${userAlerts[i] ? "atencao" : "informativo"}"><span class="lvl">${userAlerts[i] ? "DISPARADO" : "monitorando"}</span> <b>${r.series}</b> ${r.metric} ${r.dir === "up" ? ">" : "<"} ${r.thr} ${userAlerts[i] ? `— valor atual ${fmt.n(userAlerts[i].val)}` : ""} <button class="btn ghost small" onclick="delUserRule(${i})">remover</button></div>`).join("") || "<p class='src'>nenhuma regra cadastrada. Regras suas valem só neste navegador e não entram no RSS.</p>"}`
    : "<p class='src'>séries do pulso ainda carregando.</p>"}
  <h3>Regras do pipeline — família macro (${(alerts && alerts.regras_configuradas || []).length})</h3>
  <div class="src" style="margin-bottom:6px">As regras das outras famílias estão declaradas no cabeçalho de cada seção acima.</div>
  <div class="tblwrap"><table class="data"><thead><tr><th>Regra</th><th>Série</th><th>Métrica</th><th>Limiar</th><th>Nível</th></tr></thead><tbody>
  ${(alerts && alerts.regras_configuradas || []).map(r => `<tr><td>${r.label}</td><td>${r.series}</td><td>${r.metric}</td><td>${r.direction === "up" ? ">" : "<"} ${r.threshold}</td><td>${r.level}</td></tr>`).join("")}</tbody></table></div>
  <h3>Histórico de disparos — família macro (${hist.length})</h3>
  <div class="src" style="margin-bottom:6px">O histórico persistido cobre a família macro; as demais declaram persistência no próprio alerta.</div>
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
        calculo: "Δ mensal da série observada; deteriorações rankeadas por |Δ1m|/desvio-padrão histórico; antecedentes = protocolo de 4 critérios (aba Protocolo e regimes).",
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
  ${conceitosLista()}
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
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  a.href = url;
  a.download = name;
  a.click();
  // sem o revoke, cada exportação deixava um object URL vivo até fechar a aba
  setTimeout(() => URL.revokeObjectURL(url), 4000);
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
window.epaeCSV = () => {
  const E = state.data.epae;
  if (!E || !E.serie) return;
  const rows = [["mes", "pf_para_secao_rs_bi", "secao_para_pf_rs_bi", "liquido_rs_bi",
    "transacoes_pf_para_secao_mi", "transacoes_secao_para_pf_mi", "pf_para_pj_total_rs_bi",
    "participacao_pct", "secao_cnae", "fonte"]];
  E.serie.obs.forEach(o => rows.push([o.ref, o.pf_para_secao, o.secao_para_pf, o.liquido,
    o.tx_pf_para_secao, o.tx_secao_para_pf, o.pf_para_pj_total, o.participacao, E.secao.rotulo, E.fonte.nome]));
  const csv = rows.map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(";")).join("\n");
  dlFile("epae_artes_cultura_esporte_recreacao.csv", "﻿" + csv, "text/csv");
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

  /* ---------- 8b · EPAE: o insumo público dos estudos de fluxo ---------- */
  /* Republicamos a série que o BC mede — a seção INTEIRA da CNAE — em vez de
     repetir a parcela que estudos de terceiros atribuem às apostas. Assim o
     leitor vê onde termina a medição e onde começa o modelo. */
  const E = state.data.epae;
  const epaeCard = !E || !E.serie ? "" : (() => {
    const o = E.serie.obs;
    const ult = o[o.length - 1];
    const chart = lineChart({
      h: 260, endLabels: true, unit: "R$ bilhões", fonte: "BCB/EPAE",
      aria: "pagamentos Pix mensais entre pessoas físicas e a seção de artes, cultura, esporte e recreação",
      series: [
        { label: "Pessoas → seção", short: "PF → seção", color: "#1d4e89", pts: o.map(p => ({ x: p.ref, y: p.pf_para_secao })) },
        { label: "Seção → pessoas", short: "seção → PF", color: "#0e7c7b", pts: o.map(p => ({ x: p.ref, y: p.secao_para_pf })) },
        { label: "Líquido", short: "líquido", color: "#b45309", w: 2.2, pts: o.map(p => ({ x: p.ref, y: p.liquido })) },
      ],
    });
    const comp = E.comparacao;
    const compBloco = !comp ? "" : `
      <h4 style="margin-top:12px">O observado e o atribuído não são a mesma grandeza (${comp.ano})</h4>
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Grandeza</th><th style="text-align:right">Valor</th><th>Como se obtém</th><th>Nível</th></tr></thead><tbody>
        <tr><td>${comp.observado.rotulo}</td><td style="text-align:right"><b>R$ ${fmt.n(comp.observado.valor, 1)} bi</b></td><td class="src">${comp.observado.derivacao} ${badge("calculado")}</td><td>${nv(comp.observado.nivel)}</td></tr>
        <tr><td><a href="${comp.atribuido_estudo.url}" target="_blank" rel="noopener">${comp.atribuido_estudo.rotulo}</a></td><td style="text-align:right"><b>R$ ${fmt.n(comp.atribuido_estudo.valor, 1)} bi</b></td><td class="src">${comp.atribuido_estudo.derivacao} ${badge("estimado")}</td><td>${nv(comp.atribuido_estudo.nivel)}</td></tr>
      </tbody></table></div>
      <div class="note warn" style="margin-top:8px">${comp.leitura}</div>`;
    const anuais = `
      <div class="tblwrap"><table class="data compact"><thead><tr><th>Ano</th><th style="text-align:right">Pessoas → seção</th><th style="text-align:right">Seção → pessoas</th><th style="text-align:right">Líquido</th><th style="text-align:right">% do Pix PF→PJ</th><th>Meses publicados</th></tr></thead><tbody>
      ${(E.anuais || []).map(a => `<tr><td><b>${a.ano}</b></td><td style="text-align:right">${fmt.n(a.pf_para_secao, 1)}</td><td style="text-align:right">${fmt.n(a.secao_para_pf, 1)}</td><td style="text-align:right"><b>${fmt.n(a.liquido, 1)}</b></td><td style="text-align:right">${a.participacao == null ? "–" : fmt.n(a.participacao, 1) + "%"}</td><td class="src">${a.meses}${a.completo ? "" : " (ano incompleto — sem anualização)"}</td></tr>`).join("")}
      </tbody></table></div>`;
    /* Sem esta tabela o leitor não fecha o raciocínio: a série está no painel
       de bets porque a divisão 92 da seção é, literalmente, jogos e apostas. */
    const T = E.taxonomia;
    const taxo = !T ? "" : `
      <details class="decomp" style="margin-top:10px" open><summary>por que uma série desta seção está num painel de bets</summary>
        <p class="src" style="margin-top:6px">${T.explicacao}</p>
        <div class="tblwrap" style="margin-top:6px"><table class="data compact"><thead><tr><th>Divisão</th><th>O que reúne</th></tr></thead><tbody>
        ${T.divisoes.map(d => `<tr${d.jogos ? ' style="font-weight:600"' : ""}><td>${d.codigo}</td><td>${d.nome}${d.jogos ? " ← as bets se registram aqui" : ""}</td></tr>`).join("")}
        </tbody></table></div>
        <p class="src" style="margin-top:6px">${T.granularidade} <a href="${T.url}" target="_blank" rel="noopener">${T.fonte}</a>.</p>
      </details>`;
    const L = E.leitura;
    const leitura = !L ? "" : `
      <div class="grid g2" style="margin-top:12px">
        <div><h4>O que esta série permite dizer</h4>
          <ul style="font-size:13px;margin:4px 0 0 18px">${L.permite.map(i => `<li>${i}</li>`).join("")}</ul></div>
        <div><h4>O que ela não permite dizer</h4>
          <ul style="font-size:13px;margin:4px 0 0 18px">${L.nao_permite.map(i => `<li>${i}</li>`).join("")}</ul></div>
      </div>`;
    return `
    <div class="card">
      <h3>Pagamentos Pix da seção de artes, cultura, esporte e recreação ${nv("A")} ${badge("observado")}</h3>
      <div class="note warn"><b>Esta não é uma série de apostas.</b> ${E.aviso}</div>
      <p class="src" style="margin-top:8px">A seção R da CNAE abrange ${E.secao.abrange} — e é nela que as casas de apostas são classificadas. Publicamos aqui o dado do Banco Central sem atribuir parcela alguma a bets: a atribuição é sempre de quem a faz, e aparece separada abaixo.</p>
      ${taxo}
      ${chart}
      ${chartFooter({ fonte: `<a href="${E.fonte.pagina}" target="_blank" rel="noopener">${E.fonte.nome}</a>`, periodo: `${fmt.my(E.cobertura.inicio)} a ${fmt.my(E.cobertura.fim)}`, atualizado: fmt.my(ult.ref), unidade: "R$ bilhões por mês", nota: E.revisao })}
      <h4 style="margin-top:12px">Por ano civil (soma dos meses publicados, em R$ bi)</h4>
      ${anuais}
      <div class="src">Duas mudanças de patamar acontecem em 2025. O <b>sinal do líquido se inverte</b>: até 2024 a seção devolvia às pessoas mais do que recebia; a partir de janeiro de 2025 passa a absorver saldo. E o <b>peso da seção salta</b> de cerca de 2% para cerca de 12% de tudo o que pessoas físicas pagam a empresas via Pix ${badge("calculado")} — as demais divisões da seção (espetáculos, patrimônio, esporte e lazer) não crescem nesse ritmo. A coincidência com o início do mercado regulado de apostas é factual e está na linha do tempo desta aba, mas a EPAE não permite atribuir a inversão às bets: a seção inteira se move junto, e nenhuma transação vem carimbada.</div>
      ${leitura}
      ${compBloco}
      <details class="decomp" style="margin-top:10px"><summary>conceitos e limites desta série</summary>
        <div class="tblwrap"><table class="data compact"><tbody>
        ${(E.conceitos || []).map(c => `<tr><td style="white-space:nowrap"><b>${c.termo}</b></td><td class="src">${c.def}</td></tr>`).join("")}
        </tbody></table></div>
        <ul style="font-size:13px;margin:8px 0 0 18px">${(E.limitacoes || []).map(l => `<li>${l}</li>`).join("")}</ul>
      </details>
      <div class="src" style="margin-top:8px">Último mês publicado: <b>${fmt.my(ult.ref)}</b> · pessoas → seção R$ ${fmt.n(ult.pf_para_secao, 1)} bi em ${fmt.n(ult.tx_pf_para_secao, 0)} milhões de transações · <button class="btn ghost small" onclick="epaeCSV()">baixar série (CSV)</button></div>
    </div>`;
  })();

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

  el.innerHTML = head + kpis + "<hr class='sep'>" + chain + "<hr class='sep'>" + dim + "<hr class='sep'>" + quem + "<hr class='sep'>" + vuln + "<hr class='sep'>" + explorer + "<hr class='sep'>" + auto + ilegal + epaeCard + "<hr class='sep'>" + estudos + "<hr class='sep'>" + tl + met;
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
  <div class="card" >
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

/* ---------- MORADIA E CRÉDITO HABITACIONAL ----------
   Combina três bases que medem coisas diferentes e nunca são somadas: a condição de
   ocupação do Censo 2022 (municipal), o verbete 169 do ESTBAN (municipal, contábil) e as
   Informações do Mercado Imobiliário do BCB (estadual, com o corte residencial/PF que
   falta ao 169). A auditoria está em docs/AUDITORIA_MORADIA.md.

   Regras de nomenclatura obedecidas em todo o arquivo, porque cada uma delas impede uma
   leitura errada que o dado permitiria fazer:
   · o verbete 169 é "saldo contabilizado no município", jamais "crédito habitacional";
   · domicílio ainda sendo pago não é contrato bancário;
   · saldo por operação é "saldo médio por operação em aberto", não ticket médio;
   · participação de instituição é participação no saldo contabilizado, não de clientes;
   · lacuna estimada não é demanda comprovada. */

const MOR_SELO_DIC = { observado: ["obs", "OBSERVADO"], calculado: ["calc", "CALCULADO"],
  estimado: ["est", "ESTIMADO"], cenario: ["cen", "CENÁRIO"], indisponivel: ["aprox", "INDISPONÍVEL"] };
function morSelo(s) { return seloChip(MOR_SELO_DIC, s); }

const MOR_METRICAS = {
  pgp: { l: "Domicílios ainda sendo pagos", u: "%", fmt: m => m.pgp != null ? fmt.n(m.pgp, 1) + "%" : "n.d.", esc: "pct" },
  alp: { l: "Domicílios alugados", u: "%", fmt: m => m.alp != null ? fmt.n(m.alp, 1) + "%" : "n.d.", esc: "pct" },
  sdom: { l: "Saldo do verbete 169 por domicílio", u: "R$", fmt: m => m.sdom != null ? "R$ " + fmt.n0(m.sdom) : "sem saldo", esc: "money" },
  gd: { l: "Lacuna de penetração", u: "domicílios", fmt: m => m.gd != null ? fmt.n0(m.gd) : "–", esc: "money" },
};

const MOR_SELCOR = {
  alta: "var(--positive)", media: "var(--warning)",
  baixa: "var(--negative)", sem_dependencia: "var(--text-3)",
};

/* Price e SAC. Aritmética pura sobre parâmetros que o usuário escolhe — nenhum valor
   aqui é observado, e por isso o bloco inteiro carrega o selo Cenário. */
function morPrice(pv, iAno, n) {
  const i = Math.pow(1 + iAno / 100, 1 / 12) - 1;
  if (i <= 0) return { i: 0, primeira: pv / n, ultima: pv / n, total: pv };
  const p = pv * i / (1 - Math.pow(1 + i, -n));
  return { i, primeira: p, ultima: p, total: p * n };
}
function morSac(pv, iAno, n) {
  const i = Math.pow(1 + iAno / 100, 1 / 12) - 1;
  const amort = pv / n;
  const primeira = amort + pv * i;
  const ultima = amort + amort * i;
  return { i, amort, primeira, ultima, total: (primeira + ultima) / 2 * n };
}

function renderMoradia() {
  const el = document.getElementById("view-moradia");
  const D = costuraMunicipios(state.data.moradia, state.data.moradia_mun);
  if (!D || (D.ok && !D.municipios)) { el.innerHTML = loadingCard("moradia e crédito habitacional"); return; }
  if (!D.ok) {
    el.innerHTML = pageHead({ title: "Moradia e Crédito Habitacional", desc: "Painel indisponível nesta execução." }) +
      `<div class="card"><p class="src">${D.error || D.motivo || "sem dados"}</p></div>`;
    return;
  }
  const F = state.mor || {};
  const met = F.met || "pgp";
  const M = MOR_METRICAS[met];
  const regiao = F.regiao || "todas";
  const metodo = F.metodo || "saldo";
  const malha = state.data.penetracao_malha;
  const B = D.brasil, C = D.censo;

  const passa = m => regiao === "todas" || m.reg === regiao;
  const base = D.municipios.filter(passa);
  const sel = F.sel ? D.municipios.find(m => m.c === F.sel) : null;

  /* ================= sumário ================= */
  const secoes = [
    ["mor-mora", "Como o Brasil mora"],
    ["mor-onde", "Onde está o crédito imobiliário"],
    ["mor-quem", "Quem financia"],
    ["mor-peso", "Quanto a moradia pesa no orçamento"],
    ["mor-pot", "Onde existe potencial de expansão"],
    ["mor-metodo", "Fontes, definições e limites"],
  ];
  const indice = `<nav class="desindex" aria-label="Seções desta página">
    ${secoes.map(([id, t], i) => `<a href="#${id}">${i + 1}. ${t}</a>`).join("")}</nav>`;

  /* ================= 1. como o Brasil mora ================= */
  const maxCat = Math.max(...C.categorias.map(c => c.pct));
  const barras = `<div class="morbarras">
    ${C.categorias.map(c => `<div class="morbar">
      <span class="rot">${c.rot}</span>
      <span class="tr"><span class="fill${c.k === "proprio_pagando" ? " destaque" : ""}" style="width:${100 * c.pct / maxCat}%"></span></span>
      <span class="v"><b>${fmt.n(c.pct, 1)}%</b><small>${fmt.n0(c.n)}</small></span>
    </div>`).join("")}
  </div>`;

  const blocoMora = `<section id="mor-mora">${sechead("1. Como o Brasil mora", `Censo Demográfico ${C.ano} · ${fmt.n0(C.total)} domicílios`)}
  <p class="desprosa">O Censo pergunta a cada domicílio se ele é próprio, alugado ou cedido — e, quando
  próprio, se ainda está sendo pago. É a única medida de moradia que existe para os 5.570 municípios do
  país. O que ela mostra é um Brasil de casa própria já quitada: ${fmt.n(C.categorias[0].pct, 1)}% dos
  domicílios não devem mais nada, e só ${fmt.n(C.categorias[1].pct, 1)}% seguem pagando.</p>
  <div class="card">${barras}
    <p class="src">${morSelo("observado")} ${C.tabela} A soma das categorias
    (${fmt.n0(C.categorias.reduce((a, c) => a + c.n, 0))}) difere do total em
    ${fmt.n0(Math.abs(C.total - C.categorias.reduce((a, c) => a + c.n, 0)))} domicílios.
    ${C.arredondamento}</p></div>

  <div class="judalerta" role="note">
    <b>Domicílio ainda sendo pago não é contrato bancário.</b> A pergunta do Censo é sobre a situação do
    morador, não sobre o credor. A resposta abrange consórcio, financiamento feito direto com construtora
    ou incorporadora, programas habitacionais, compra parcelada entre particulares e qualquer outra forma
    de pagamento em curso. O Censo não pergunta quem financiou, quanto falta nem quanto se paga por mês.
  </div>

  <div class="card morfalta">
    <h4>O que o Censo 2022 não coletou ${morSelo("indisponivel")}</h4>
    <ul>${C.nao_coletado.map(x => `<li>${x}</li>`).join("")}</ul>
    <p class="src">${C.verificacao_ausencia}</p>
    <p class="src">Por isso esta página <b>não publica comprometimento de renda observado com moradia</b>.
    A prestação que aparece no bloco 4 é média de estoque por unidade da federação, vinda do Banco Central,
    e a do simulador é um cenário construído por quem usa a página.</p>
  </div>

  </section>`;

  /* ================= 2. onde está o crédito ================= */
  const somaMi = D.estados.reduce((s, e) => s + (e.mi_carteira_pf || 0), 0);
  const somaScr = D.estados.reduce((s, e) => s + (e.scr_imob_pf || 0), 0);
  const reconc = [
    ["Verbete 169 do ESTBAN", D.totais.estban169, "município", D.datas.estban,
     "Saldo contabilizado na dependência bancária. Inclui imóvel não residencial, pessoa jurídica e infraestrutura."],
    ["Carteira imobiliária de pessoa física", somaMi, "unidade da federação", D.datas.mi_credito,
     "Residencial e comercial de pessoa física, por origem dos recursos. Não existe em nível municipal."],
    ["Exposição imobiliária de pessoa física", somaScr, "unidade da federação", D.datas.scr,
     "Exposição de crédito dos clientes reportada ao SCR, em " + fmt.n0(D.estados.reduce((s, e) => s + (e.scr_operacoes || 0), 0)) + " operações."],
  ];

  const blocoOnde = `<section id="mor-onde">${sechead("2. Onde está o crédito imobiliário", "três medidas do mesmo fenômeno")}
  <p class="desprosa">Não existe uma medida única de crédito imobiliário no Brasil. Existem três, com
  geografias e conceitos diferentes, e forçá-las à igualdade produziria um número falso. A tabela abaixo
  mostra as três lado a lado, com o que cada uma abrange.</p>

  <div class="card"><table class="data morrec">
    <caption class="src">Comparação de conceito, não de qualidade — a diferença entre elas é informação.</caption>
    <thead><tr><th>Medida</th><th style="text-align:right">Saldo</th><th>Geografia</th><th>Data-base</th><th>O que abrange</th></tr></thead>
    <tbody>${reconc.map(([n, v, g, d, o]) => `<tr>
      <td><b>${n}</b></td><td style="text-align:right">${fmt.money(v)}</td>
      <td>${g}</td><td>${d}</td><td class="src">${o}</td></tr>`).join("")}</tbody></table>
    <p class="src">${morSelo("observado")} As duas medidas estaduais ficam a
    ${fmt.n(Math.abs(100 * (somaMi - somaScr) / somaScr), 1)}% uma da outra, o que valida a ordem de grandeza.
    O ESTBAN é maior porque abrange mais coisa — e é isso que a composição do verbete explica.</p>
  </div>

  <details class="charttable" open>
    <summary>O que exatamente está dentro do verbete 169</summary>
    <div class="morverb">
      <p class="desprosa">O ESTBAN é a única fonte pública do Banco Central com crédito imobiliário por
      município. Mas o verbete 169 soma quatro rubricas contábeis distintas, e uma delas não é crédito
      imobiliário.</p>
      <table class="data"><thead><tr><th>Conta COSIF</th><th>Título</th><th>Função contábil oficial</th></tr></thead>
      <tbody>${D.verbete169.contas.map(c => `<tr class="${c.habitacional === false ? "morfora" : ""}">
        <td><code>${c.conta}</code></td><td>${c.titulo}</td><td class="src">${c.funcao}</td></tr>`).join("")}</tbody></table>
      <p class="src"><b>Não distingue:</b> ${D.verbete169.nao_distingue.join(" · ")}.</p>
      <div class="judalerta" role="note">${D.verbete169.alerta}</div>
      <p class="src">${D.verbete169.fonte} ${D.verbete169.invercao_cosif}</p>
    </div>
  </details>

  <div class="judalerta" role="note">
    <b>${fmt.n(D.concentracao_contabil.part_dessas, 1)}% do saldo está escriturado em um ou dois municípios.</b>
    ${D.concentracao_contabil.instituicoes_ate_2_municipios} das ${D.concentracao_contabil.instituicoes_total}
    instituições com saldo no verbete 169 contabilizam em no máximo dois municípios, somando
    ${fmt.money(D.concentracao_contabil.saldo_dessas)}. ${D.concentracao_contabil.leitura}
  </div>

  <div class="card">
    <h4>Carteira de pessoa física por origem dos recursos</h4>
    ${lineChart({
      series: [
        { name: "SFH (poupança)", pts: B.series.carteira.map(p => ({ x: p.d, y: p.sfh })) },
        { name: "FGTS", pts: B.series.carteira.map(p => ({ x: p.d, y: p.fgts })) },
        { name: "Taxas de mercado", pts: B.series.carteira.map(p => ({ x: p.d, y: p.livre })) },
        { name: "Home equity", pts: B.series.carteira.map(p => ({ x: p.d, y: p.home_equity })) },
      ], unit: " bi", dec: 0, h: 250,
      aria: "carteira imobiliária de pessoa física por segmento, em bilhões de reais",
      fonte: `BCB, Informações do Mercado Imobiliário · ${D.datas.mi_credito}`,
    })}
    ${leitura([
      ["SFH e FGTS", "recursos direcionados, com taxa limitada por norma — juntos, a maior parte da carteira"],
      ["Home equity", "usa o imóvel como garantia mas não financia a compra dele"],
    ])}
  </div>

  <div class="pan-kpi">
    <div class="card kpi"><h4>Aquisição</h4><div class="big">${fmt.money(B.direcionamento.aquisicao)}</div>
      <div class="src">${morSelo("observado")} recursos da poupança aplicados em habitação residencial</div></div>
    <div class="card kpi"><h4>Construção</h4><div class="big">${fmt.money(B.direcionamento.construcao)}</div>
      <div class="src">${morSelo("observado")} um nono do que vai para aquisição</div></div>
    <div class="card kpi"><h4>Reforma e ampliação</h4><div class="big">${fmt.money(B.direcionamento.reforma_ampliacao)}</div>
      <div class="src">${morSelo("observado")} praticamente inexistente no direcionamento</div></div>
  </div>
  <p class="desprosa">O crédito habitacional brasileiro financia a compra de imóvel pronto. Construir e
  reformar, no direcionamento da poupança, são resíduo. Isso não é uma falha do dado: é o desenho do
  sistema, e ajuda a entender por que a lacuna estimada no bloco 5 não se traduz automaticamente em
  demanda que um banco atenderia.</p>
  </section>`;

  /* ================= 3. quem financia ================= */
  const blocoQuem = `<section id="mor-quem">${sechead("3. Quem financia", `${D.totais.instituicoes_no_169} instituições com saldo no verbete 169 · ${D.datas.estban}`)}
  <p class="desprosa">Onde uma instituição escritura o saldo e onde ela atende pessoas são coisas
  diferentes. A tabela mostra as duas informações juntas justamente para que a distância entre elas fique
  visível: um banco pode responder por um quinto do saldo nacional e aparecer em dois municípios.</p>
  <div class="card"><table class="data morinst">
    <thead><tr><th>Instituição</th><th style="text-align:right">Saldo</th><th style="text-align:right">Participação</th>
      <th style="text-align:right">Municípios</th><th style="text-align:right">Quociente locacional</th></tr></thead>
    <tbody>${D.instituicoes.slice(0, 15).map(i => `<tr>
      <td>${i.nome}</td>
      <td style="text-align:right">${fmt.money(i.saldo)}</td>
      <td style="text-align:right">${fmt.n(i.part_nacional, 2)}%</td>
      <td style="text-align:right" class="${i.municipios <= 2 ? "morfora" : ""}">${fmt.n0(i.municipios)}</td>
      <td style="text-align:right">${i.ql_mediano != null ? fmt.n(i.ql_mediano, 2) : `<span class="src">não aplicável</span>`}</td>
    </tr>`).join("")}</tbody></table>
    <p class="src">${morSelo("calculado")} Participação é do <b>saldo contabilizado</b>, não de clientes — o
    ESTBAN não publica clientes. O quociente locacional compara a presença da instituição no município com
    a presença dela no país: 1 significa proporcional. Publicado apenas para instituições em ao menos 25
    municípios, porque abaixo disso o quociente é alto por aritmética, não por concentração real.</p>
  </div>
  ${sel ? morPerfil(sel, D) : `<p class="src">Selecione um município no mapa do bloco 1 para ver a composição
    por instituição e os indicadores locais.</p>`}
  </section>`;

  /* ================= 4. quanto pesa ================= */
  const sim = D.simulador;
  const pv = F.pv != null ? F.pv : Math.round(sim.partida.valor_imovel * sim.partida.ltv_pct / 100);
  const taxa = F.taxa != null ? F.taxa : sim.partida.taxa_aa_pct;
  const prazo = F.prazo != null ? F.prazo : sim.partida.prazo_meses;
  const renda = F.renda != null ? F.renda : 6000;
  const pr = morPrice(pv, taxa, prazo), sa = morSac(pv, taxa, prazo);
  const ufSim = F.ufSim || "SP";
  const eSim = D.estados.find(e => e.uf === ufSim) || D.estados[0];

  const blocoPeso = `<section id="mor-peso">${sechead("4. Quanto a moradia pesa no orçamento", `observado por unidade da federação · ${D.datas.mi_credito}`)}
  <p class="desprosa">Esta é a parte em que a fonte muda de geografia. Taxa, LTV, prestação média e valor
  do imóvel existem por unidade da federação, não por município, e são publicados aqui exatamente nessa
  granularidade. Nenhum desses números é desagregado para o nível municipal.</p>

  <div class="card"><table class="data morseg">
    <thead><tr><th>Segmento</th><th style="text-align:right">Carteira</th><th style="text-align:right">Taxa a.a.</th>
      <th style="text-align:right">LTV</th><th style="text-align:right">Prestação média</th><th style="text-align:right">Inadimplência</th></tr></thead>
    <tbody>${MOR_SEGMENTOS.map(([k, rot]) => `<tr>
      <td>${rot}</td>
      <td style="text-align:right">${B.carteira_pf[k] != null ? fmt.money(B.carteira_pf[k]) : "–"}</td>
      <td style="text-align:right">${B.taxa[k] != null ? fmt.n(B.taxa[k], 2) + "%" : "–"}</td>
      <td style="text-align:right">${B.ltv[k] != null ? fmt.n(B.ltv[k], 1) + "%" : "–"}</td>
      <td style="text-align:right">${B.parcela[k] != null ? "R$ " + fmt.n0(B.parcela[k]) : "–"}</td>
      <td style="text-align:right">${B.inad[k] != null ? fmt.n(B.inad[k], 2) + "%" : "–"}</td>
    </tr>`).join("")}</tbody></table>
    <p class="src">${morSelo("observado")} Prestação média é do <b>estoque</b> de contratos ativos, com prazos e
    datas de contratação distintos — não é a prestação de um contrato novo, e não se aplica aos domicílios
    que o Censo registra como ainda sendo pagos. LTV e taxa referem-se às contratações do mês.</p>
  </div>

  <div class="card">
    <h4>Simulador de prestação ${morSelo("cenario")}</h4>
    <p class="desprosa">Os valores de partida vêm de médias observadas do Banco Central; tudo o mais é
    escolha de quem usa a página. O resultado é aritmética de tabela Price e de sistema SAC, não uma
    proposta de crédito.</p>
    <div class="controls morsim">
      <label>valor financiado <input type="number" value="${pv}" min="10000" step="10000"
        onchange="morSim('pv', this.value)" aria-label="valor financiado em reais"></label>
      <label>taxa % a.a. <input type="number" value="${taxa}" min="0.1" max="60" step="0.01"
        onchange="morSim('taxa', this.value)" aria-label="taxa de juros anual"></label>
      <label>prazo (meses) <input type="number" value="${prazo}" min="12" max="480" step="12"
        onchange="morSim('prazo', this.value)" aria-label="prazo em meses"></label>
      <label>renda mensal <input type="number" value="${renda}" min="500" step="500"
        onchange="morSim('renda', this.value)" aria-label="renda mensal para o cálculo de comprometimento"></label>
    </div>
    <table class="data morsimtab">
      <thead><tr><th>Sistema</th><th style="text-align:right">Primeira prestação</th>
        <th style="text-align:right">Última prestação</th><th style="text-align:right">Sobre a renda informada</th></tr></thead>
      <tbody>
        <tr><td>Price (prestação constante)</td>
          <td style="text-align:right">R$ ${fmt.n0(pr.primeira)}</td>
          <td style="text-align:right">R$ ${fmt.n0(pr.ultima)}</td>
          <td style="text-align:right">${fmt.n(100 * pr.primeira / renda, 1)}%</td></tr>
        <tr><td>SAC (amortização constante)</td>
          <td style="text-align:right">R$ ${fmt.n0(sa.primeira)}</td>
          <td style="text-align:right">R$ ${fmt.n0(sa.ultima)}</td>
          <td style="text-align:right">${fmt.n(100 * sa.primeira / renda, 1)}%</td></tr>
      </tbody>
    </table>
    <p class="src">Taxa mensal equivalente: ${fmt.n(100 * pr.i, 4)}% — obtida por
    <code>(1 + taxa anual)^(1/12) − 1</code>, não por divisão por doze.</p>
    <div class="judalerta" role="note">
      <b>O que não está nesta conta.</b> ${sim.avisos.join(" ")}
    </div>
    <p class="src">Para referência, a prestação média do estoque SFH em ${eSim.nome} é de
    <b>R$ ${fmt.n0(eSim.parcela_sfh)}</b> ${morSelo("observado")} — número de universo diferente do
    simulado, útil como ordem de grandeza e não como comparação direta.</p>
  </div>

  <details class="charttable"><summary>Taxa, prestação e valor do imóvel por unidade da federação</summary>
    <table class="data moruf">
      <thead><tr><th>UF</th><th style="text-align:right">Domicílios pagando</th><th style="text-align:right">Taxa SFH</th>
        <th style="text-align:right">LTV</th><th style="text-align:right">Prestação média</th>
        <th style="text-align:right">Valor de compra</th><th style="text-align:right">Área</th>
        <th style="text-align:right">Inadimplência</th></tr></thead>
      <tbody>${D.estados.map(e => `<tr>
        <td>${e.nome}</td>
        <td style="text-align:right">${fmt.n(e.pgp, 1)}%</td>
        <td style="text-align:right">${e.taxa_sfh != null ? fmt.n(e.taxa_sfh, 2) + "%" : "–"}</td>
        <td style="text-align:right">${e.ltv_sfh != null ? fmt.n(e.ltv_sfh, 1) + "%" : "–"}</td>
        <td style="text-align:right">${e.parcela_sfh != null ? "R$ " + fmt.n0(e.parcela_sfh) : "–"}</td>
        <td style="text-align:right">${e.valor_compra != null ? "R$ " + fmt.n0(e.valor_compra) : "–"}</td>
        <td style="text-align:right">${e.area_privativa != null ? fmt.n(e.area_privativa, 1) + " m²" : "–"}</td>
        <td style="text-align:right">${e.inad_sfh != null ? fmt.n(e.inad_sfh, 2) + "%" : "–"}</td>
      </tr>`).join("")}</tbody></table>
      <p class="src">${morSelo("observado")} Valor de compra e área são da seção Imóveis, com data-base
      ${D.datas.mi_imoveis} — defasagem maior que a da seção de crédito (${D.datas.mi_credito}). As duas
      nunca são apresentadas como se fossem do mesmo mês.</p>
  </details>
  </section>`;

  /* ================= 5. potencial ================= */
  const mp = D.modelos.penetracao, ms = D.modelos.saldo;
  const rk = metodo === "saldo" ? D.rankings.maior_lacuna_saldo : D.rankings.maior_lacuna_domicilios;

  const blocoPot = `<section id="mor-pot">${sechead("5. Onde existe potencial de expansão", "duas lacunas, dois métodos")}
  <div class="judalerta" role="note">
    <b>Lacuna não é demanda comprovada.</b> Os dois modelos comparam um município com municípios parecidos
    e mostram a diferença. Essa diferença pode refletir preferência por aluguel, herança, autoconstrução,
    informalidade fundiária, um parque domiciliar mais antigo ou crédito tomado fora do município — nada
    disso é observável nas bases usadas aqui.
  </div>

  <div class="mor2col">
    <div class="card">
      <h4>Lacuna de penetração habitacional ${morSelo("estimado")}</h4>
      <div class="big">${fmt.n0(mp.lacuna_domicilios)} domicílios</div>
      <p class="src">Diferença entre a proporção de domicílios ainda sendo pagos e a mediana dessa proporção
      em municípios comparáveis, somada sobre os ${fmt.n0(mp.municipios_abaixo)} municípios abaixo da mediana
      do seu grupo.</p>
      ${leitura([["Agrupamento", mp.criterio], ["Grupos", fmt.n0(mp.grupos) + " cobrindo " + fmt.n0(mp.municipios_cobertos) + " municípios"],
                 ["Referência", mp.referencia]])}
    </div>
    <div class="card">
      <h4>Lacuna de saldo ${morSelo("estimado")}</h4>
      <div class="big">${fmt.money(ms.lacuna_total)}</div>
      <p class="src">Diferença entre a mediana condicional estimada e o saldo do verbete 169 efetivamente
      contabilizado, somada sobre os ${fmt.n0(ms.municipios_abaixo)} municípios abaixo da referência.</p>
      ${leitura([["Especificação", ms.especificacao], ["Ajuste", `n = ${fmt.n0(ms.n)} · R² = ${fmt.n(ms.r2, 3)} · σ = ${fmt.n(ms.sigma, 3)}`],
                 ["Referência", ms.referencia]])}
    </div>
  </div>

  <div class="card">
    <h4>Por que a amostra do modelo de saldo é restrita</h4>
    <p class="desprosa">O modelo só considera municípios com <b>duas ou mais instituições contabilizando</b>.
    A restrição foi medida, não arbitrada. Sem ela, o desvio residual sobe de ${fmt.n(ms.sigma, 2)} para 1,45
    e a lacuna somada chega a R$ 2,5 trilhões — mais que o saldo nacional inteiro, um resultado sem sentido.
    A razão é substantiva: município com uma única instituição no verbete 169 é, quase sempre, o ponto onde
    um banco centraliza a escrituração de uma carteira nacional, e o saldo ali não descreve mercado local
    nenhum.</p>
    <p class="src">${ms.faixa}</p>
  </div>

  <div class="card">
    <div class="controls">
      <span class="seg">${[["saldo", "lacuna de saldo"], ["domicilios", "lacuna de domicílios"]].map(([v, l]) =>
        `<button class="${metodo === v ? "active" : ""}" onclick="morFiltra('metodo','${v}')">${l}</button>`).join("")}</span>
    </div>
    <table class="data"><thead><tr><th>#</th><th>Município</th><th>UF</th>
      <th style="text-align:right">${metodo === "saldo" ? "Lacuna estimada" : "Domicílios"}</th><th>Confiabilidade</th></tr></thead>
      <tbody>${rk.map((m, i) => `<tr>
        <td>${i + 1}</td>
        <td><button type="button" class="linkish" onclick="morSel('${m.c}')">${m.n}</button></td>
        <td>${m.uf}</td>
        <td style="text-align:right">${metodo === "saldo" ? fmt.money(m.v) : fmt.n0(m.v)}</td>
        <td><span class="morselo" style="--c:${MOR_SELCOR[m.sel]}">${m.sel.replace("_", " ")}</span></td>
      </tr>`).join("")}</tbody></table>
    <p class="src">${morSelo("estimado")} ${metodo === "saldo" ? ms.aviso : mp.aviso}</p>
  </div>
  </section>`;

  /* ================= 6. metodologia ================= */
  const stRot = { viavel: "viável", parcial: "parcial", indisponivel: "indisponível" };
  const blocoMet = `<section id="mor-metodo">${sechead("6. Fontes, definições e limites", "auditoria de viabilidade")}
  <p class="desprosa">Antes de publicar qualquer número, cada pergunta que a página poderia responder foi
  testada contra as fontes. A matriz abaixo é o resultado desse teste, e as linhas marcadas como
  indisponíveis não foram preenchidas por aproximação.</p>
  <div class="card"><table class="data mormatriz">
    <thead><tr><th>Pergunta</th><th>Situação</th><th>Fonte</th><th>Observação</th></tr></thead>
    <tbody>${D.matriz_viabilidade.map(m => `<tr class="mst-${m.status}">
      <td>${m.pergunta}</td><td><span class="morst ${m.status}">${stRot[m.status]}</span></td>
      <td class="src">${m.fonte}</td><td class="src">${m.obs}</td></tr>`).join("")}</tbody></table></div>

  <details class="charttable"><summary>Dicionário de indicadores (${D.dicionario.length})</summary>
    <div class="desdic">${D.dicionario.map(d => `<div class="desdicit">
      <h5>${d.t} ${morSelo(d.selo)}</h5>
      <p><b>Definição:</b> ${d.d}</p>
      <p class="src"><b>Fonte:</b> ${d.f}</p>
      <p class="src"><b>Limite:</b> ${d.l}</p></div>`).join("")}</div>
  </details>

  <div class="card">
    <h4>O que esta página não autoriza concluir</h4>
    <ul class="desnota">${D.limitacoes.map(l => `<li>${l}</li>`).join("")}</ul>
  </div>
  </section>`;

  const achados = `<div class="desgrupo"><span class="rot">O que os dados mostram</span>
    <div class="pan-kpi">${D.achados.map(a => `<div class="card kpi morach">
      <h4>${a.t}</h4><p class="src">${a.d}</p>
      <div class="src">${morSelo(a.selo)}</div></div>`).join("")}</div></div>`;

  /* ================= abertura: cinco indicadores e o mapa ================= */
  const cat = k => C.categorias.find(c => c.k === k) || {};
  const abertura = `<section id="mor-abertura">
    <div class="pgkpi">
      <div class="mk"><span class="r">Domicílios ocupados</span>
        <span class="v">${fmt.n(C.total / 1e6, 2)} <small>mi</small></span>
        <span class="n">Censo ${C.ano} ${morSelo("observado")}</span></div>
      <div class="mk destaque"><span class="r">Ainda sendo pagos</span>
        <span class="v">${fmt.n(cat("proprio_pagando").pct, 1)}<small>%</small></span>
        <span class="n">${fmt.n(cat("proprio_pagando").n / 1e6, 2)} milhões de domicílios</span></div>
      <div class="mk"><span class="r">Alugados</span>
        <span class="v">${fmt.n(cat("alugado").pct, 1)}<small>%</small></span>
        <span class="n">${fmt.n(cat("alugado").n / 1e6, 1)} milhões de domicílios</span></div>
      <div class="mk"><span class="r">Saldo imobiliário contabilizado</span>
        <span class="v">${fmt.money(D.totais.estban169)}</span>
        <span class="n">verbete 169 · ESTBAN ${D.datas.estban} ${morSelo("observado")}</span></div>
      <div class="mk"><span class="r">Taxa de contratação, SFH</span>
        <span class="v">${fmt.n(B.taxa.sfh, 2)}<small>% a.a.</small></span>
        <span class="n">LTV de ${fmt.n(B.ltv.sfh, 1)}% · ${D.datas.mi_credito}</span></div>
    </div>
    ${morMapa(base, malha, met, M, F, D)}
  </section>`;

  el.innerHTML = pageHead({
    title: "Moradia e Crédito Habitacional",
    desc: "Como o país mora, quanto crédito imobiliário existe e onde ele não chega — com as três bases públicas mantidas separadas.",
    fontes: `IBGE Censo ${C.ano} · BCB ESTBAN ${D.datas.estban} · BCB Mercado Imobiliário ${D.datas.mi_credito} · BCB SCR ${D.datas.scr}`,
  }) + indice + abertura + achados
    + blocoMora + blocoOnde + blocoQuem + blocoPeso + blocoPot + blocoMet;

  agendaAcessibilidade();
}

const MOR_SEGMENTOS = [
  ["sfh", "SFH — poupança direcionada"],
  ["fgts", "FGTS"],
  ["livre", "Taxas de mercado"],
  ["home_equity", "Home equity (imóvel em garantia)"],
  ["comercial", "Imóvel comercial de pessoa física"],
];

function morMapa(base, malha, met, M, F, D) {
  const porCod = Object.fromEntries(base.map(m => [m.c, m]));
  const escala = penEscala(base.map(m => m[met]), M.esc);
  const paths = malha ? Object.entries(malha.paths).map(([cod, d]) => {
    const m = porCod[cod];
    if (!m) return `<path d="${d}" fill="var(--surface-2)" class="penmun fora"></path>`;
    const tip = encodeURIComponent(`<div class="tt-date">${m.n} (${m.uf})</div>
      <div class="tt-row"><span class="tt-lbl">domicílios</span><span class="tt-val">${fmt.n0(m.dt)}</span></div>
      <div class="tt-row"><span class="tt-lbl">ainda pagando</span><span class="tt-val">${m.pgp != null ? fmt.n(m.pgp, 1) + "%" : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">alugados</span><span class="tt-val">${m.alp != null ? fmt.n(m.alp, 1) + "%" : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">saldo do verbete 169</span><span class="tt-val">${m.s != null ? fmt.money(m.s) : "sem dependência"}</span></div>`);
    return `<path d="${d}" fill="${escala(m[met])}" class="penmun${F.sel === cod ? " sel" : ""}" data-tip="${tip}"
      onclick="morSel('${cod}')" aria-label="${attr(m.n + " " + m.uf + ": " + M.fmt(m))}"></path>`;
  }).join("") : "";

  const lista = base.filter(m => m[met] != null).sort((a, b) => b[met] - a[met]).slice(0, 25);
  return `<div class="controls">${Object.entries(MOR_METRICAS).map(([k, v]) =>
    `<button class="btn ${met === k ? "" : "ghost"} small" onclick="morFiltra('met','${k}')">${v.l}</button>`).join("")}
    <label>região <select onchange="morFiltra('regiao', this.value)">
      ${["todas", "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"].map(r =>
        `<option ${(F.regiao || "todas") === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
    <span class="src">${fmt.n0(base.length)} municípios no recorte</span>
  </div>
  <div class="penlayout">
    <div class="card">
      ${malha ? `<svg class="penmapa" viewBox="${malha.viewBox}" role="group" aria-label="mapa municipal de ${attr(M.l)}"><g transform="${malha.transform}">${paths}</g></svg>`
              : `<p class="src">malha municipal ainda carregando…</p>`}
      <p class="src">Sombreado entre o percentil 5 e o 95 do recorte — winsorização apenas visual. Clique
      num município para abrir o perfil no bloco 3.</p>
    </div>
    <div class="card penrank">
      <h4>Maiores <span class="src">${M.l.toLowerCase()}</span></h4>
      <ol class="penlista">${lista.map(m => `<li class="${F.sel === m.c ? "sel" : ""}">
        <button type="button" onclick="morSel('${m.c}')" aria-label="${attr(m.n + " " + m.uf + ": " + M.fmt(m))}">
          <span class="n">${m.n}<small>${m.uf}</small></span>
          <span class="v">${M.fmt(m)}</span></button></li>`).join("")}</ol>
    </div>
  </div>`;
}

function morPerfil(m, D) {
  const linhas = [
    ["Domicílios particulares permanentes ocupados", fmt.n0(m.dt), "observado"],
    ["Próprios já pagos, herdados ou ganhos", m.dpg != null ? `${fmt.n0(m.dpg)} (${fmt.n(100 * m.dpg / m.dt, 1)}%)` : "–", "observado"],
    ["Próprios ainda sendo pagos", m.dpp != null ? `${fmt.n0(m.dpp)} (${fmt.n(m.pgp, 1)}%)` : "–", "observado"],
    ["Alugados", m.da != null ? `${fmt.n0(m.da)} (${fmt.n(m.alp, 1)}%)` : "–", "observado"],
    ["Cedidos ou emprestados", m.dc != null ? fmt.n0(m.dc) : "–", "observado"],
    ["Renda domiciliar per capita", m.rpc != null ? "R$ " + fmt.n0(m.rpc) : "–", "observado"],
    ["Urbanização", m.urb != null ? fmt.n(m.urb, 1) + "%" : "–", "observado"],
    ["Saldo do verbete 169 contabilizado", m.s != null ? fmt.money(m.s) : "sem dependência bancária", "observado"],
    ["Depósitos de poupança contabilizados", m.pp != null ? fmt.money(m.pp) : "–", "observado"],
    ["Saldo por domicílio", m.sdom != null ? "R$ " + fmt.n0(m.sdom) : "–", "calculado"],
    ["Instituições contabilizando", m.ni != null ? fmt.n0(m.ni) : "nenhuma", "observado"],
    ["Concentração (HHI)", m.hhi != null ? fmt.n0(m.hhi) : "–", "calculado"],
    ["Proporção esperada de domicílios pagando", m.pesp != null ? fmt.n(m.pesp, 1) + "%" : "grupo pequeno demais", "estimado"],
    ["Lacuna de penetração", m.gd != null ? fmt.n0(m.gd) + " domicílios" : "acima ou na mediana do grupo", "estimado"],
    ["Saldo esperado pelo modelo", m.sesp != null ? fmt.money(m.sesp) : "fora da amostra do modelo", "estimado"],
    ["Faixa de um desvio", m.sfx ? `${fmt.money(m.sfx[0])} a ${fmt.money(m.sfx[1])}` : "–", "estimado"],
    ["Lacuna de saldo", m.gs != null ? fmt.money(m.gs) : "acima ou na referência", "estimado"],
  ];
  const top = m.i1 != null ? D.nomes_instituicoes[m.i1] : null;
  return `<div class="card morperfil">
    <div class="sechead"><h3>${m.n} <small>${m.uf} · ${m.reg}</small></h3>
      <span class="morselo" style="--c:${MOR_SELCOR[m.sel]}">confiabilidade ${m.sel.replace("_", " ")}</span></div>
    <table class="data"><tbody>${linhas.map(([k, v, s]) => `<tr>
      <th scope="row">${k}</th><td style="text-align:right">${v}</td><td>${morSelo(s)}</td></tr>`).join("")}</tbody></table>
    ${top ? `<p class="src"><b>Maior participação no saldo contabilizado:</b> ${top}, com
      ${fmt.n(m.i1p, 1)}% do saldo do verbete 169 no município. Isso mede escrituração contábil, não
      clientes atendidos.</p>` : ""}
    <p class="src">${m.sel === "sem_dependencia"
      ? "Nenhuma dependência bancária reporta saldo imobiliário neste município. Ausência de saldo não é ausência de crédito: é ausência de agência que o contabilize."
      : m.sel === "baixa" ? "Confiabilidade baixa: o saldo por domicílio é muito superior à mediana nacional ou a série mensal apresenta salto de reclassificação. Fora dos rankings e da amostra do modelo."
      : m.sel === "media" ? "Confiabilidade média: uma única instituição contabiliza aqui, ou o saldo por domicílio está acima do triplo da mediana nacional."
      : "Confiabilidade alta: saldo por domicílio dentro da faixa esperada, série estável e mais de uma instituição contabilizando."}</p>
  </div>`;
}

window.morFiltra = (k, v) => { state.mor = { ...(state.mor || {}), [k]: v }; renderMoradia(); };
window.morSel = cod => {
  state.mor = { ...(state.mor || {}), sel: cod };
  renderMoradia();
  const alvo = document.getElementById("mor-quem");
  if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
};
window.morSim = (k, v) => {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return;
  state.mor = { ...(state.mor || {}), [k]: n };
  renderMoradia();
};

/* ---------- CONSIGNADO, PREVIDÊNCIA E ENVELHECIMENTO ----------
   Três geografias que não se convertem umas nas outras: o Censo e a Previdência são
   municipais, o consignado é estadual, e a taxa por instituição é nacional.

   Três definições da fonte previdenciária determinam como cada número é nomeado, e estão
   repetidas na interface porque cada uma impede uma leitura errada:
   · o município é o do ÓRGÃO PAGADOR, não o de residência;
   · o valor é LÍQUIDO — o consignado já foi descontado dele;
   · é benefício EMITIDO, e a contagem é de créditos, não de pessoas.

   E a restrição de primeira ordem: o consignado municipal é alocação do estadual. A
   relação entre dependência previdenciária e consignado só é afirmada a partir do dado
   estadual observado. Ver docs/AUDITORIA_CONSIGNADO.md. */

const CG_SELO_DIC = { observado: ["obs", "OBSERVADO"], calculado: ["calc", "CALCULADO"],
  estimado: ["est", "ESTIMADO"], cenario: ["cen", "CENÁRIO"], hipotese: ["exp", "HIPÓTESE"],
  indisponivel: ["aprox", "INDISPONÍVEL"] };
function cgSelo(s) { return seloChip(CG_SELO_DIC, s); }

/* Duas paletas deliberadamente distintas: sequencial fria para envelhecimento e
   previdência, sequencial quente para exposição ao consignado. Envelhecer não é risco, e
   pintar município idoso de vermelho diria o contrário. */
const CG_CAMADAS = {
  p60: { l: "População com 60 anos ou mais", u: "%", pal: "fria", fmt: m => m.p60 != null ? fmt.n(m.p60, 1) + "%" : "n.d." },
  env: { l: "Índice de envelhecimento", u: "", pal: "fria", fmt: m => m.env != null ? fmt.n(m.env, 0) : "n.d." },
  ben100_60: { l: "Benefícios por 100 pessoas com 60+", u: "", pal: "fria", fmt: m => m.ben100_60 != null ? fmt.n(m.ben100_60, 0) : "n.d." },
  v_hab: { l: "Valor líquido por habitante", u: "R$", pal: "fria", fmt: m => m.v_hab != null ? "R$ " + fmt.n0(m.v_hab) : "n.d." },
  peso: { l: "Benefícios líquidos sobre a renda domiciliar", u: "%", pal: "fria", fmt: m => m.peso != null ? fmt.n(m.peso, 1) + "%" : "n.d." },
  prural: { l: "Participação da clientela rural", u: "%", pal: "fria", fmt: m => m.prural != null ? fmt.n(m.prural, 1) + "%" : "n.d." },
  pass: { l: "Participação de benefícios assistenciais", u: "%", pal: "fria", fmt: m => m.pass != null ? fmt.n(m.pass, 1) + "%" : "n.d." },
  cons_ben: { l: "Exposição estimada por benefício", u: "R$", pal: "quente", fmt: m => m.cons_ben != null ? "R$ " + fmt.n0(m.cons_ben) : "n.d." },
  indice: { l: "Índice de sensibilidade", u: "", pal: "quente", fmt: m => m.indice != null ? fmt.n(m.indice, 0) : "n.d." },
};

const CG_FAIXAS = [
  ["menos de 20%", 0, 20], ["de 20% a 35%", 20, 35],
  ["de 35% a 50%", 35, 50], ["mais de 50%", 50, Infinity],
];
const CG_SATROT = {
  baixa_penetracao: "Baixa penetração",
  penetracao_elevada: "Penetração elevada",
  possivel_saturacao: "Possível saturação",
};
const CG_SELCOR = { alta: "var(--positive)", media: "var(--warning)", baixa: "var(--negative)", sem_dado: "var(--text-3)" };

function cgEscala(vals, pal) {
  return penEscala(vals, null, pal === "quente" ? "var(--warning)" : "var(--teal)");
}

function renderConsignado() {
  const el = document.getElementById("view-consignado");
  const D = costuraMunicipios(state.data.consignado, state.data.consignado_mun);
  if (!D || (D.ok && !D.municipios)) { el.innerHTML = loadingCard("consignado, previdência e envelhecimento"); return; }
  if (!D.ok) {
    el.innerHTML = pageHead({ title: "Consignado, Previdência e Envelhecimento", desc: "Painel indisponível nesta execução." }) +
      `<div class="card"><p class="src">${D.motivo || D.error || "sem dados"}</p></div>`;
    return;
  }
  const F = state.cg || {};
  const cam = F.cam || "p60";
  const C = CG_CAMADAS[cam];
  const regiao = F.regiao || "todas";
  const conf = F.conf || "exclui_baixa";
  const malha = state.data.penetracao_malha;
  const B = D.brasil, S = D.scr;

  const passa = m => (regiao === "todas" || m.reg === regiao)
    && (conf === "todas" || m.sel !== "baixa");
  const base = D.municipios.filter(passa);
  const sel = F.sel ? D.municipios.find(m => m.c === F.sel) : null;
  const comparar = (F.comp || []).map(c => D.municipios.find(m => m.c === c)).filter(Boolean);

  const secoes = [
    ["cg-geral", "Visão geral"],
    ["cg-idade", "Envelhecimento municipal"],
    ["cg-prev", "A Previdência na economia local"],
    ["cg-mapa", "Mapa de dependência"],
    ["cg-expo", "Exposição ao consignado"],
    ["cg-circ", "O que é observado e o que é mecânico"],
    ["cg-sat", "Saturação"],
    ["cg-risco", "Sensibilidade social e regulatória"],
    ["cg-if", "Instituições"],
    ["cg-perfil", "Perfil municipal"],
    ["cg-metodo", "Fontes e limites"],
  ];
  const indice = `<nav class="desindex" aria-label="Seções desta página">
    ${secoes.map(([id, t], i) => `<a href="#${id}">${i + 1}. ${t}</a>`).join("")}</nav>`;

  /* ============ 1. visão geral ============ */
  const geral = `<section id="cg-geral">
  <p class="desprosa">O painel combina informações demográficas do Censo 2022, pagamentos da
  Previdência Social e dados de crédito do Banco Central. A carteira municipal de consignado
  somente seria apresentada como observada se existisse uma fonte pública nessa granularidade
  — e não existe. O que há de municipal aqui é demografia e benefício pago; o consignado é
  observado por unidade da federação.</p>

  <div class="pgkpi">
    <div class="mk"><span class="r">População com 60 anos ou mais</span>
      <span class="v">${fmt.n(B.a60 / 1e6, 2)} <small>mi</small></span>
      <span class="n">${fmt.n(B.p60, 1)}% do país · Censo 2022 ${cgSelo("observado")}</span></div>
    <div class="mk"><span class="r">Benefícios emitidos</span>
      <span class="v">${fmt.n(B.beneficios / 1e6, 2)} <small>mi</small></span>
      <span class="n">dezembro de ${D.ano} ${cgSelo("observado")}</span></div>
    <div class="mk"><span class="r">Valor líquido mensal</span>
      <span class="v">${fmt.money(B.valor_dez)}</span>
      <span class="n">já descontado o consignado · média de R$ ${fmt.n0(B.valor_medio)}</span></div>
    <div class="mk destaque"><span class="r">Consignado de aposentados</span>
      <span class="v">${fmt.money(S.aposentados_nacional)}</span>
      <span class="n">${fmt.n(S.part_aposentados, 1)}% do consignado de pessoa física · ${S.data_base}</span></div>
    <div class="mk"><span class="r">Municípios de alta dependência</span>
      <span class="v">${fmt.n0(D.totais.dependencia_acima_50)}</span>
      <span class="n">benefícios acima de 50% da renda domiciliar ${cgSelo("calculado")}</span></div>
  </div>

  </section>`;

  const avisoFonte = `<div class="judalerta" role="note">
    <b>Três coisas que este dado não é.</b> O município registrado é o do <b>órgão pagador</b>,
    não o de residência do beneficiário — a agência de um polo regional paga quem mora nas
    cidades vizinhas. O valor é <b>líquido de descontos</b>, e o empréstimo consignado já foi
    subtraído dele. E a contagem é de <b>créditos emitidos</b>, não de pessoas: um benefício
    pode gerar mais de um crédito, e 11,1% dos beneficiários acumulam mais de um benefício,
    segundo o Anuário Estatístico da Previdência. Não existe contagem de beneficiários por
    município em nenhuma fonte pública.
  </div>`;

  /* ============ 2. envelhecimento ============ */
  const maxP = Math.max(...B.piramide.map(p => p.pop));
  const idade = `<section id="cg-idade">${sechead("2. Envelhecimento municipal", `Censo Demográfico 2022 · idade mediana ${fmt.n(B.idade_mediana, 1)} anos`)}
  <div class="cg2col">
    <div class="card">
      <h4>Pirâmide etária ${cgSelo("observado")}</h4>
      <div class="cgpir">${B.piramide.slice().reverse().map(p => `<div class="cgpirl">
        <span class="g">${p.g}</span>
        <span class="b"><span style="width:${100 * p.pop / maxP}%${p.g >= "60" && /^(6|7|8|9|1)/.test(p.g) && parseInt(p.g) >= 60 ? ";background:var(--teal)" : ""}"></span></span>
        <span class="v">${fmt.n(p.pop / 1e6, 2)}</span></div>`).join("")}</div>
      <p class="src">Em milhões de pessoas, por grupo quinquenal. Os 21 grupos somam
      ${fmt.n0(B.populacao)} habitantes, idêntico ao total do Censo.</p>
    </div>
    <div class="card">
      <h4>Indicadores nacionais</h4>
      <table class="data cgdef"><tbody>
        <tr><th scope="row">Participação de 60 anos ou mais</th><td>${fmt.n(B.p60, 2)}%</td></tr>
        <tr><th scope="row">Participação de 65 anos ou mais</th><td>${fmt.n(B.p65, 2)}%</td></tr>
        <tr><th scope="row">Participação de 80 anos ou mais</th><td>${fmt.n(B.p80, 2)}%</td></tr>
        <tr><th scope="row">Índice de envelhecimento</th><td>${fmt.n(B.envelhecimento, 1)}</td></tr>
        <tr><th scope="row">Razão de dependência idosa</th><td>${fmt.n(B.dep_idosa, 1)}</td></tr>
        <tr><th scope="row">Idade mediana</th><td>${fmt.n(B.idade_mediana, 1)} anos</td></tr>
      </tbody></table>
      ${leitura([
        ["Índice de envelhecimento", "pessoas de 60 anos ou mais para cada 100 de 0 a 14"],
        ["Razão de dependência idosa", "pessoas de 65 anos ou mais para cada 100 de 15 a 64"],
        ["Idade mediana", "interpolada dentro do grupo quinquenal — não é a mediana do microdado"],
      ])}
    </div>
  </div>
  </section>`;

  /* ============ 3. previdência ============ */
  const prev = `<section id="cg-prev">${sechead("3. A Previdência na economia local", `dezembro de ${D.ano} · valores líquidos`)}
  <p class="desprosa">A massa de benefícios é comparada com a renda domiciliar do Censo, que é
  de julho de 2022. Para que a razão faça sentido, o valor de dezembro de ${D.ano} é trazido a
  preços de 2022 pelo IPCA — fator de ${fmt.n(D.fator_ipca, 4)}. Sem essa correção o peso dos
  benefícios apareceria inflado em toda a base.</p>

  <div class="pan-kpi">
    <div class="card kpi"><h4>Benefícios por 100 pessoas com 60+</h4><div class="big">${fmt.n(B.ben100_60, 1)}</div>
      <div class="src">${cgSelo("calculado")} acima de 100 porque há benefício pago antes dos 60 e pensão a menores</div></div>
    <div class="card kpi"><h4>Peso na renda domiciliar</h4><div class="big">${fmt.n(B.peso, 1)}%</div>
      <div class="src">${cgSelo("calculado")} valor líquido deflacionado sobre a renda domiciliar do Censo</div></div>
    <div class="card kpi"><h4>Benefício médio</h4><div class="big">R$ ${fmt.n0(B.valor_medio)}</div>
      <div class="src">${cgSelo("calculado")} valor líquido dividido pela quantidade de créditos</div></div>
  </div>

  <div class="judalerta" role="note">
    <b>Este indicador é uma razão entre bases agregadas, não uma decomposição de orçamento
    doméstico.</b> O numerador vem do registro da Previdência e cobre quem é pago por aquela
    agência; o denominador vem do Censo e cobre quem mora no município. Onde os dois universos
    não coincidem, a razão se distorce — e é isso que o teste de coerência da seção seguinte mede.
  </div>

  <div class="card">
    <h4>Teste de coerência contra um teto independente</h4>
    <p class="desprosa">O Censo mede, separadamente, quanto da renda domiciliar <b>não</b> vem do
    trabalho. Benefícios previdenciários são parte disso, junto com aluguel, aplicações e
    transferências — então o peso calculado não pode ultrapassar essa participação. Quando
    ultrapassa, a causa conhecida é o município do órgão pagador.</p>
    <div class="pan-kpi">
      <div class="card kpi"><h4>Municípios testados</h4><div class="big">${fmt.n0(D.totais.municipios)}</div>
        <div class="src">${cgSelo("calculado")} todos têm o teto do Censo disponível</div></div>
      <div class="card kpi"><h4>Reprovados no teste</h4><div class="big">${fmt.n0(D.totais.incoerentes)}</div>
        <div class="src">${cgSelo("calculado")} ${fmt.n(100 * D.totais.incoerentes / D.totais.municipios, 1)}% — peso acima do teto, rebaixados a confiabilidade baixa</div></div>
      <div class="card kpi"><h4>Confiabilidade alta</h4><div class="big">${fmt.n0(D.totais.selos.alta)}</div>
        <div class="src">${cgSelo("calculado")} passam no teste e têm benefícios por idoso próximos da mediana</div></div>
    </div>
  </div>
  </section>`;

  /* ============ 4. mapa ============ */
  const porCod = Object.fromEntries(base.map(m => [m.c, m]));
  const escala = cgEscala(base.map(m => m[cam]), C.pal);
  const paths = malha ? Object.entries(malha.paths).map(([cod, d]) => {
    const m = porCod[cod];
    if (!m) return `<path d="${d}" fill="var(--surface-2)" class="penmun fora"></path>`;
    const tip = encodeURIComponent(`<div class="tt-date">${m.n} (${m.uf})</div>
      <div class="tt-row"><span class="tt-lbl">60 anos ou mais</span><span class="tt-val">${m.p60 != null ? fmt.n(m.p60, 1) + "%" : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">benefícios</span><span class="tt-val">${m.ben != null ? fmt.n0(m.ben) : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">peso na renda</span><span class="tt-val">${m.peso != null ? fmt.n(m.peso, 1) + "%" : "–"}</span></div>
      <div class="tt-row"><span class="tt-lbl">confiabilidade</span><span class="tt-val">${m.sel.replace("_", " ")}</span></div>`);
    return `<path d="${d}" fill="${escala(m[cam])}" class="penmun${F.sel === cod ? " sel" : ""}" data-tip="${tip}"
      onclick="cgSel('${cod}')" aria-label="${attr(m.n + " " + m.uf + ": " + C.fmt(m))}"></path>`;
  }).join("") : "";

  const lista = base.filter(m => m[cam] != null).sort((a, b) => b[cam] - a[cam]).slice(0, 25);
  const faixas = CG_FAIXAS.map(([rot, lo, hi]) => ({
    rot, n: base.filter(m => m.peso != null && m.peso >= lo && m.peso < hi).length,
  }));

  const mapa = `<section id="cg-mapa">${sechead("4. Mapa de dependência previdenciária", C.l)}
  <div class="controls">
    ${Object.entries(CG_CAMADAS).map(([k, v]) =>
      `<button class="btn ${cam === k ? "" : "ghost"} small" onclick="cgFiltra('cam','${k}')">${v.l}</button>`).join("")}
  </div>
  <div class="controls">
    <label>região <select onchange="cgFiltra('regiao', this.value)">
      ${["todas", "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"].map(r =>
        `<option ${regiao === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
    <span class="seg">${[["exclui_baixa", "sem confiabilidade baixa"], ["todas", "incluir todas"]].map(([v, l]) =>
      `<button class="${conf === v ? "active" : ""}" onclick="cgFiltra('conf','${v}')">${l}</button>`).join("")}</span>
    <span class="src">${fmt.n0(base.length)} municípios no recorte</span>
  </div>
  <div class="penlayout">
    <div class="card">
      ${malha ? `<svg class="penmapa" viewBox="${malha.viewBox}" role="group" aria-label="mapa municipal de ${attr(C.l)}"><g transform="${malha.transform}">${paths}</g></svg>`
              : `<p class="src">malha municipal ainda carregando…</p>`}
      <p class="src">Paleta fria para envelhecimento e previdência, quente para exposição ao
      consignado — envelhecer não é risco, e a cor não deve sugerir que seja. Sombreado entre o
      percentil 5 e o 95 do recorte.</p>
    </div>
    <div class="card penrank">
      <h4>Maiores <span class="src">${C.l.toLowerCase()}</span></h4>
      <ol class="penlista">${lista.map(m => `<li class="${F.sel === m.c ? "sel" : ""}">
        <button type="button" onclick="cgSel('${m.c}')" aria-label="${attr(m.n + " " + m.uf + ": " + C.fmt(m))}">
          <span class="n">${m.n}<small>${m.uf}</small></span>
          <span class="v">${C.fmt(m)}</span></button></li>`).join("")}</ol>
    </div>
  </div>
  <div class="card">
    <h4>Distribuição por faixa de dependência ${cgSelo("calculado")}</h4>
    <div class="cgfaixas">${faixas.map(f => `<div class="cgfx">
      <span class="n">${fmt.n0(f.n)}</span><span class="r">${f.rot}</span></div>`).join("")}</div>
    <p class="src">Razão entre o valor líquido de benefícios emitidos e a renda domiciliar do
    Censo, ambos a preços de 2022. É uma razão entre bases agregadas, não uma decomposição
    contábil observada de cada domicílio.</p>
  </div>
  </section>`;

  el.innerHTML = pageHead({
    title: "Consignado, Previdência e Envelhecimento",
    desc: "Onde o envelhecimento e a dependência de benefícios tornam o consignado economicamente relevante — separando o que é observado do que é estimado.",
    fontes: `IBGE Censo 2022 · MPS Estatísticas Municipais ${D.ano} · BCB SCR ${S.data_base} · BCB taxas por instituição`,
  }) + indice + geral + mapa + avisoFonte + idade + prev
    + cgExposicao(D) + cgCircularidade(D) + cgSaturacao(D, base)
    + cgRisco(D, base) + cgInstituicoes(D)
    + cgPerfil(D, sel, comparar) + cgMetodo(D);

  agendaAcessibilidade();
}

/* ============ 5. exposição ============ */
function cgExposicao(D) {
  const G = D.sgs, S = D.scr;
  if (!G) return "";
  const a = G.atual;
  const bi = v => v == null ? "–" : "R$ " + fmt.n(v / 1000, 1) + " bi";
  return `<section id="cg-expo">${sechead("5. Exposição ao consignado", `Banco Central · ${G.data_base.slice(0, 7)}`)}
  <p class="desprosa">O consignado do INSS tem medida nacional direta e observada. O que não
  existe é carteira municipal — nem no Banco Central, nem no INSS, nem na Dataprev. O que a
  página faz adiante é uma estimativa declarada, e o teste da seção 6 mostra por que ela não
  pode ser usada para afirmar relação entre dependência previdenciária e crédito.</p>

  <div class="card"><table class="data cgseg">
    <thead><tr><th>Vínculo do tomador</th><th style="text-align:right">Saldo</th>
      <th style="text-align:right">Inadimplência</th><th style="text-align:right">Taxa a.a.</th>
      <th style="text-align:right">Prazo da concessão</th></tr></thead>
    <tbody>
      <tr class="cgdestaque"><td><b>Beneficiários do INSS</b></td>
        <td style="text-align:right">${bi(a.inss.saldo)}</td>
        <td style="text-align:right">${fmt.n(a.inss.inad, 2)}%</td>
        <td style="text-align:right">${fmt.n(a.inss.taxa, 2)}%</td>
        <td style="text-align:right">${fmt.n(a.inss.prazo_conc, 1)} meses</td></tr>
      <tr><td>Servidores públicos</td><td style="text-align:right">${bi(a.publico.saldo)}</td>
        <td style="text-align:right">${fmt.n(a.publico.inad, 2)}%</td>
        <td style="text-align:right">–</td><td style="text-align:right">–</td></tr>
      <tr><td>Trabalhadores do setor privado</td><td style="text-align:right">${bi(a.privado.saldo)}</td>
        <td style="text-align:right">${fmt.n(a.privado.inad, 2)}%</td>
        <td style="text-align:right">–</td><td style="text-align:right">–</td></tr>
      <tr class="cgtot"><td>Total</td><td style="text-align:right">${bi(a.total.saldo)}</td>
        <td style="text-align:right">${fmt.n(a.total.inad, 2)}%</td>
        <td style="text-align:right">${fmt.n(a.total.taxa, 2)}%</td><td style="text-align:right">–</td></tr>
    </tbody></table>
    <p class="src">${cgSelo("observado")} A inadimplência do consignado do INSS é de
    ${fmt.n(a.inss.inad, 2)}%, contra ${fmt.n(a.privado.inad, 2)}% no consignado privado. O custo
    do crédito é de ${fmt.n(a.inss.icc, 2)}% ao ano e o prazo médio de concessão chegou a
    ${fmt.n(a.inss.prazo_conc, 1)} meses.</p>
  </div>

  <div class="card">
    <h4>Saldo por vínculo do tomador</h4>
    ${lineChart({
      series: [
        { name: "INSS", pts: G.series.saldo.map(p => ({ x: p.d, y: p.inss / 1000 })) },
        { name: "Servidores públicos", pts: G.series.saldo.map(p => ({ x: p.d, y: p.publico / 1000 })) },
        { name: "Setor privado", pts: G.series.saldo.map(p => ({ x: p.d, y: p.privado / 1000 })) },
      ], unit: " bi", dec: 0, h: 240,
      annotations: D.linha_do_tempo.filter(e => e.d >= G.series.saldo[0].d && e.tipo === "margem")
        .map(e => ({ x: e.d.slice(0, 7), label: e.t.slice(0, 22) }))
        .concat(marcosRegulatorios("consignado").map(m => ({ ...m, color: "#6b46a3" }))),
      aria: "saldo de consignado por vínculo do tomador, em bilhões de reais",
      fonte: "BCB, Sistema Gerenciador de Séries Temporais",
    })}
    <p class="src">As marcas indicam mudanças de margem consignável. ${cgSelo("observado")}
    <b>Coincidência no tempo não é efeito.</b> A página marca as normas para que a inspeção
    seja possível, e não atribui variação da série a nenhuma delas.</p>
  </div>

  <div class="judalerta" role="note">
    <b>Duas medidas distintas do mesmo público, e o motivo de não se somarem.</b> A série do
    Banco Central acima registra ${bi(a.inss.saldo)} de consignado averbado em benefício do
    INSS. O grupo “Aposentado/pensionista” do SCR, usado adiante para o único recorte por
    unidade da federação que existe, soma ${fmt.money(S.aposentados_nacional)} —
    ${fmt.n(100 * S.aposentados_nacional / (a.inss.saldo * 1e6), 0)}% daquele valor. Classificar
    pela ocupação declarada do tomador não é o mesmo que identificar a averbação em benefício.
  </div>
  </section>`;
}

/* ============ 6. circularidade ============ */
function cgCircularidade(D) {
  const C = D.circularidade;
  const est = D.estados.filter(e => e.outras_censo != null && e.cons_por_60 != null);
  const xs = est.map(e => e.outras_censo), ys = est.map(e => e.cons_por_60);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const px = v => 60 + 640 * (v - x0) / Math.max(x1 - x0, 1e-9);
  const py = v => 250 - 210 * (v - y0) / Math.max(y1 - y0, 1e-9);
  const ref = C.especificacoes.find(e => e.referencia);

  return `<section id="cg-circ">${sechead("6. O que é observado e o que é mecânico", "quatro especificações da mesma pergunta")}
  <p class="desprosa">A pergunta natural do painel é se municípios mais dependentes de
  benefícios têm mais consignado. Ela não pode ser respondida com o indicador municipal: como
  o consignado municipal é o estadual repartido por uma chave previdenciária, a correlação
  entre os dois foi construída pela fórmula. A resposta só pode vir do nível estadual — e,
  mesmo lá, depende de como cada lado é montado.</p>

  <div class="judalerta" role="note">
    <b>Uma correção desta página.</b> A primeira versão publicava uma correlação só, de −0,72,
    entre o peso dos benefícios na renda e o consignado por benefício elegível. Essa
    especificação compartilha um termo entre os dois lados: a <b>quantidade de benefícios</b>
    aparece no numerador da dependência (valor = quantidade × benefício médio) e no denominador
    do consignado por benefício. Isso produz correlação negativa por aritmética,
    independentemente do mundo. A tabela abaixo mostra as quatro montagens possíveis, e a
    referência passou a ser a que não compartilha termo nenhum.
  </div>

  <div class="card">
    <table class="data cgespec">
      <thead><tr><th>Especificação</th><th style="text-align:right">Correlação</th><th>Por que difere</th></tr></thead>
      <tbody>${C.especificacoes.map(e => `<tr class="${e.referencia ? "cgdestaque" : ""}">
        <td>${e.rotulo}${e.referencia ? " <b>(referência)</b>" : ""}</td>
        <td style="text-align:right"><b>${fmt.n(e.r, 3)}</b></td>
        <td class="src">${e.obs}</td></tr>`).join("")}
      <tr class="cgtot"><td>A mesma correlação no nível municipal ${cgSelo("hipotese")}</td>
        <td style="text-align:right">${fmt.n(C.correlacao_mecanica, 3)}</td>
        <td class="src">Mede a fórmula de alocação, não o mundo. Nenhuma afirmação da página se apoia nela.</td></tr>
      </tbody></table>
    <p class="src">${cgSelo("observado")} Correlação de Pearson entre ${C.n_uf} unidades da federação.</p>
  </div>

  <div class="card">
    <h4>Correlação parcial, controlando por terceiras variáveis</h4>
    <table class="data"><thead><tr><th>Controlando por</th>
      <th style="text-align:right">Especificação de referência</th>
      <th style="text-align:right">Especificação compartilhada</th></tr></thead>
      <tbody>${C.controles.map(x => `<tr><td>${x.variavel}</td>
        <td style="text-align:right">${x.parcial_referencia != null ? fmt.n(x.parcial_referencia, 3) : "–"}</td>
        <td style="text-align:right" class="src">${x.parcial_compartilhada != null ? fmt.n(x.parcial_compartilhada, 3) : "–"}</td></tr>`).join("")}
      </tbody></table>
    <p class="src">${cgSelo("calculado")} ${C.leitura}</p>
  </div>

  <div class="card">
    <h4>Dependência previdenciária e consignado, por unidade da federação</h4>
    <svg viewBox="0 0 720 290" class="cgdisp" role="group" aria-label="dispersão entre participação do rendimento de outras fontes e consignado por pessoa de 60 anos ou mais, por unidade da federação">
      <line x1="60" y1="250" x2="700" y2="250" stroke="var(--border)"></line>
      <line x1="60" y1="40" x2="60" y2="250" stroke="var(--border)"></line>
      ${est.map(e => `<g role="group" aria-label="${attr(`${e.nome}: outras fontes ${fmt.n(e.outras_censo, 1)}%, consignado por pessoa de 60 anos ou mais R$ ${fmt.n0(e.cons_por_60)}`)}">
        <circle cx="${px(e.outras_censo).toFixed(1)}" cy="${py(e.cons_por_60).toFixed(1)}"
          r="${(4 + 9 * Math.sqrt(e.a60 / 4e6)).toFixed(1)}" fill="var(--teal)" fill-opacity=".45"
          stroke="var(--teal)"></circle>
        <text x="${(px(e.outras_censo) + 8).toFixed(1)}" y="${(py(e.cons_por_60) + 4).toFixed(1)}"
          font-size="10" fill="var(--text-2)">${e.uf}</text></g>`).join("")}
      <text x="380" y="282" text-anchor="middle" font-size="11" fill="var(--text-3)">participação do rendimento que não vem do trabalho, no Censo (%)</text>
      <text x="16" y="145" font-size="11" fill="var(--text-3)" transform="rotate(-90 16 145)" text-anchor="middle">consignado por pessoa de 60+ (R$)</text>
    </svg>
    <p class="src">${cgSelo("observado")} Especificação de referência, r = ${fmt.n(ref ? ref.r : C.referencia, 3)}.
    Tamanho do círculo proporcional à população de 60 anos ou mais. Os dois eixos vêm de fontes
    distintas e nenhum termo é compartilhado entre eles.</p>
  </div>

  <div class="card">
    <h4>O mecanismo não está estabelecido</h4>
    <p class="desprosa">A direção da associação é robusta, mas nenhuma explicação testada a
    sustenta. Quatro candidatos foram medidos, e os quatro falham — um deles com o sinal
    contrário ao que a hipótese previa.</p>
    <table class="data"><thead><tr><th>Candidato a mecanismo</th>
      <th style="text-align:right">Com consignado por 60+</th>
      <th style="text-align:right">Com dependência</th><th>Leitura</th></tr></thead>
      <tbody>${C.mecanismo.testados.map(m => `<tr>
        <td>${m.variavel}</td>
        <td style="text-align:right">${m.com_consignado_por_60 != null ? fmt.n(m.com_consignado_por_60, 3) : "–"}</td>
        <td style="text-align:right">${m.com_peso != null ? fmt.n(m.com_peso, 3) : "–"}</td>
        <td class="src">${m.leitura}</td></tr>`).join("")}</tbody></table>
    <div class="judalerta" role="note">${C.mecanismo.conclusao}</div>
  </div>

  <div class="judalerta" role="note">
    <b>${C.conclusao_regra}</b> A página distingue quatro coisas que costumam ser confundidas:
    associação observada, resultado mecanicamente produzido pela metodologia, hipótese e
    estimativa. Nenhuma delas é evidência causal, e nenhuma é apresentada como tal.
  </div>
  </section>`;
}

/* ============ 7. saturação ============ */
function cgSaturacao(D, base) {
  const t = D.totais.saturacao, cr = D.saturacao_criterios;
  const cls = ["baixa_penetracao", "penetracao_elevada", "possivel_saturacao"];
  return `<section id="cg-sat">${sechead("7. Saturação", "critérios explícitos, aplicados só onde há base")}
  <p class="desprosa">Saturação não é tamanho de carteira. A classificação usa saldo estimado por
  benefício elegível e serviço da dívida, e tem uma trava: município cujo indicador é apenas
  alocação proporcional, sem nenhum sinal de intensidade, ou cuja confiabilidade é baixa, <b>não
  recebe classificação</b>. Rotular de saturado quem só recebeu uma fatia da fórmula seria
  transformar aritmética em diagnóstico.</p>
  <div class="pan-kpi">
    ${cls.map(k => `<div class="card kpi"><h4>${CG_SATROT[k]}</h4>
      <div class="big">${fmt.n0(t[k])}</div>
      <div class="src">${cgSelo("estimado")} municípios classificados</div></div>`).join("")}
    <div class="card kpi"><h4>Sem classificação</h4>
      <div class="big">${fmt.n0(D.totais.municipios - cls.reduce((s, k) => s + t[k], 0))}</div>
      <div class="src">${cgSelo("indisponivel")} confiabilidade baixa ou sem sinal de intensidade</div></div>
  </div>
  <div class="card">
    <h4>Critérios, para quem quiser recalcular</h4>
    <table class="data"><tbody>
      <tr><th scope="row">Possível saturação</th><td>saldo por benefício acima de R$ ${fmt.n0(cr.cons_ben_alto)}
        ou serviço da dívida acima de ${fmt.n(cr.servico_alto, 0)}%</td></tr>
      <tr><th scope="row">Penetração elevada</th><td>saldo por benefício acima de R$ ${fmt.n0(cr.cons_ben_medio)}
        ou serviço da dívida acima de ${fmt.n(cr.servico_medio, 0)}%</td></tr>
      <tr><th scope="row">Baixa penetração</th><td>abaixo dos dois limiares</td></tr>
    </tbody></table>
    <p class="src">O serviço da dívida é a parcela implícita de um contrato de 84 meses sobre o
    valor líquido dos benefícios elegíveis. É cenário aritmético, não parcela observada — a
    parcela real do consignado não é publicada por município.</p>
  </div>
  </section>`;
}

/* ============ 8. risco ============ */
function cgRisco(D, base) {
  const v = base.filter(m => m.indice != null && m.sel !== "baixa" && (m.pop || 0) >= 20000)
    .sort((a, b) => b.indice - a.indice).slice(0, 15);
  return `<section id="cg-risco">${sechead("8. Sensibilidade social e regulatória", "três dimensões separadas, e depois combinadas")}
  <div class="judalerta" role="note">
    <b>Este índice mede a sensibilidade do contexto, não a conduta de ninguém.</b> Ele não
    classifica moradores nem instituições. Um município no topo da lista é um lugar onde
    envelhecimento, peso dos benefícios na renda e exposição estimada coincidem — o que torna
    decisões de crédito ali mais consequentes, e não onde há irregularidade demonstrada.
  </div>
  <div class="card"><table class="data cgrisco">
    <thead><tr><th>#</th><th>Município</th><th>UF</th>
      <th style="text-align:right">Vulnerabilidade</th><th style="text-align:right">Exposição</th>
      <th style="text-align:right">Perfil do benefício</th><th style="text-align:right">Índice</th></tr></thead>
    <tbody>${v.map((m, i) => `<tr>
      <td>${i + 1}</td>
      <td><button type="button" class="linkish" onclick="cgSel('${m.c}')">${m.n}</button></td>
      <td>${m.uf}</td>
      <td style="text-align:right">${m.vulnerabilidade != null ? fmt.n(m.vulnerabilidade, 0) : "–"}</td>
      <td style="text-align:right">${m.exposicao != null ? fmt.n(m.exposicao, 0) : "–"}</td>
      <td style="text-align:right">${m.perfil_beneficio != null ? fmt.n(m.perfil_beneficio, 0) : "–"}</td>
      <td style="text-align:right"><b>${fmt.n(m.indice, 0)}</b></td></tr>`).join("")}</tbody></table>
    <p class="src">${cgSelo("estimado")} Cada dimensão é a posição do município na distribuição
    nacional, de 0 a 100, entre os percentis 5 e 95. <b>Vulnerabilidade</b> combina participação
    de 60 anos ou mais, peso dos benefícios na renda e renda domiciliar por habitante invertida.
    <b>Exposição</b> combina saldo estimado por benefício e serviço da dívida. <b>Perfil do
    benefício</b> combina participação de assistenciais e de clientela rural. A soma é simples e
    sem pesos escondidos: as três parcelas estão publicadas para quem quiser outro arranjo.</p>
  </div>
  </section>`;
}

/* ============ 9. instituições ============ */
function cgInstituicoes(D) {
  const I = D.instituicoes, R = D.reclamacoes;
  if (!I && !R) return "";
  return `<section id="cg-if">${sechead("9. Instituições", "geografia nacional, e assim permanece")}
  <p class="desprosa">Nem a taxa cobrada nem a reclamação existem por município para cada
  instituição. Estimar participação municipal por instituição exigiria uma metodologia que
  nenhuma fonte sustenta, e a página não a inventa: as duas tabelas ficam na geografia em que
  foram medidas.</p>

  ${I ? `<div class="card">
    <h4>Taxa de contratação do consignado do INSS ${cgSelo("observado")}</h4>
    <p class="src">${I.modalidade} · janela iniciada em ${(I.janela && I.janela.inicio) || "–"} ·
    ${I.ranking.length} instituições · mediana ${fmt.n(I.stats.mediana, 2)}% ao ano ·
    spread de ${fmt.n(I.spread_selic, 2)} pontos sobre a Selic</p>
    <table class="data cgtaxa">
      <thead><tr><th>#</th><th>Instituição</th><th style="text-align:right">Taxa a.a.</th>
        <th style="text-align:right">Contra a mediana</th></tr></thead>
      <tbody>${I.ranking.slice(0, 12).map(r => `<tr>
        <td>${r.posicao}</td><td>${r.nome}</td>
        <td style="text-align:right">${fmt.n(r.taxa_aa, 2)}%</td>
        <td style="text-align:right" class="${r.vs_mediana > 0 ? "cgpior" : "cgmelhor"}">${r.vs_mediana > 0 ? "+" : ""}${fmt.n(r.vs_mediana, 2)}</td>
      </tr>`).join("")}</tbody></table>
    <p class="src">A mais cara cobra ${fmt.n(100 * (I.stats.max / I.stats.min - 1), 0)}% a mais que
    a mais barata pelo mesmo produto e o mesmo mecanismo de garantia. Taxa de contratação é preço
    de operação nova, não carteira — nenhuma participação de mercado é derivada daqui.</p>
  </div>` : ""}

  ${R ? `<div class="card">
    <h4>Reclamações sobre consignado de beneficiários do INSS ${cgSelo("observado")}</h4>
    <p class="src">${fmt.n0(R.total)} reclamações entre ${R.de} e ${R.ate}, em ${fmt.n0(R.municipios)}
    municípios. Fonte: consumidor.gov.br, categoria dedicada a beneficiários do INSS.</p>
    <table class="data cgrec">
      <thead><tr><th>Instituição</th><th style="text-align:right">Reclamações</th>
        <th style="text-align:right">Com 61 anos ou mais</th>
        <th style="text-align:right">Resolvidas</th><th style="text-align:right">Nota</th></tr></thead>
      <tbody>${R.instituicoes.slice(0, 12).map(x => `<tr>
        <td>${x.nome}</td>
        <td style="text-align:right">${fmt.n0(x.total)}</td>
        <td style="text-align:right">${x.part_idosos != null ? fmt.n(x.part_idosos, 1) + "%" : "–"}</td>
        <td style="text-align:right">${x.taxa_resolucao != null ? fmt.n(x.taxa_resolucao, 1) + "%" : "–"}</td>
        <td style="text-align:right">${x.nota != null ? fmt.n(x.nota, 1) : "–"}</td>
      </tr>`).join("")}</tbody></table>
    <div class="judalerta" role="note">${R.aviso}</div>
  </div>` : ""}
  </section>`;
}

/* ============ 10. perfil ============ */
function cgPerfil(D, sel, comparar) {
  const linhas = m => [
    ["População total", fmt.n0(m.pop), "observado"],
    ["60 anos ou mais", `${fmt.n0(m.a60)} (${fmt.n(m.p60, 1)}%)`, "observado"],
    ["65 anos ou mais", `${fmt.n0(m.a65)} (${fmt.n(m.p65, 1)}%)`, "observado"],
    ["80 anos ou mais", `${fmt.n0(m.a80)} (${fmt.n(m.p80, 1)}%)`, "observado"],
    ["Idade mediana", `${fmt.n(m.imed, 1)} anos`, "calculado"],
    ["Índice de envelhecimento", fmt.n(m.env, 1), "calculado"],
    ["Benefícios emitidos", m.ben != null ? fmt.n0(m.ben) : "–", "observado"],
    ["Aposentadorias", m.apo != null ? fmt.n0(m.apo) : "–", "observado"],
    ["Pensões por morte", m.pen != null ? fmt.n0(m.pen) : "–", "observado"],
    ["Assistenciais e legislação específica", m.ass != null ? fmt.n0(m.ass) : "–", "observado"],
    ["Clientela rural", m.prural != null ? fmt.n(m.prural, 1) + "%" : "–", "observado"],
    ["Valor líquido mensal", m.vdez != null ? fmt.money(m.vdez) : "–", "observado"],
    ["Valor por habitante", m.v_hab != null ? "R$ " + fmt.n0(m.v_hab) : "–", "calculado"],
    ["Valor por pessoa com 60+", m.v_idoso != null ? "R$ " + fmt.n0(m.v_idoso) : "–", "calculado"],
    ["Benefícios por 100 pessoas com 60+", m.ben100_60 != null ? fmt.n(m.ben100_60, 1) : "–", "calculado"],
    ["Peso na renda domiciliar", m.peso != null ? fmt.n(m.peso, 1) + "%" : "–", "calculado"],
    ["Teto do Censo para rendas não-trabalho", m.outras != null ? fmt.n(m.outras, 1) + "%" : "–", "observado"],
    ["Exposição estimada ao consignado", m.cons != null ? fmt.money(m.cons) : "–", "estimado"],
    ["Faixa da estimativa", m.cons_lo != null ? `${fmt.money(m.cons_lo)} a ${fmt.money(m.cons_hi)}` : "–", "estimado"],
    ["Exposição por benefício elegível", m.cons_ben != null ? "R$ " + fmt.n0(m.cons_ben) : "–", "estimado"],
    ["Serviço da dívida", m.servico != null ? fmt.n(m.servico, 1) + "%" : "–", "cenario"],
    ["Saturação", m.sat ? CG_SATROT[m.sat] : "não classificado", "estimado"],
    ["Reclamações no período", m.rec != null ? fmt.n0(m.rec) : "–", "observado"],
    ["Reclamações por 100 mil pessoas com 60+", m.rec_100k60 != null ? fmt.n(m.rec_100k60, 1) : "–", "calculado"],
  ];
  const alvos = sel ? [sel, ...comparar.filter(m => m.c !== sel.c)] : comparar;
  if (!alvos.length) {
    return `<section id="cg-perfil">${sechead("10. Perfil municipal", "selecione no mapa")}
      <p class="src">Clique num município no mapa da seção 4 para abrir o perfil. É possível
      comparar até cinco municípios lado a lado.</p></section>`;
  }
  const cols = alvos.slice(0, 5);
  return `<section id="cg-perfil">${sechead("10. Perfil municipal", `${cols.length} município${cols.length > 1 ? "s" : ""} em comparação`)}
  <div class="controls">
    ${cols.map(m => `<span class="cgchip">${m.n}<small>${m.uf}</small>
      <button type="button" onclick="cgTira('${m.c}')" aria-label="${attr("remover " + m.n)}">×</button></span>`).join("")}
    ${cols.length > 1 ? `<button class="btn ghost small" onclick="cgLimpa()">limpar comparação</button>` : ""}
  </div>
  <div class="card cgperfil">
    <table class="data">
      <thead><tr><th>Indicador</th>${cols.map(m => `<th style="text-align:right">${m.n}<small>${m.uf}</small></th>`).join("")}<th></th></tr></thead>
      <tbody>${linhas(cols[0]).map((_, i) => `<tr>
        <th scope="row">${linhas(cols[0])[i][0]}</th>
        ${cols.map(m => `<td style="text-align:right">${linhas(m)[i][1]}</td>`).join("")}
        <td>${cgSelo(linhas(cols[0])[i][2])}</td></tr>`).join("")}</tbody>
    </table>
    <p class="src">Confiabilidade: ${cols.map(m => `<span class="morselo" style="--c:${CG_SELCOR[m.sel]}">${m.n}: ${m.sel.replace("_", " ")}</span>`).join(" ")}</p>
    ${cols.some(m => m.incoerente) ? `<div class="judalerta" role="note">Ao menos um dos municípios
      selecionados reprova no teste de coerência: o peso calculado supera o teto que o Censo dá
      para rendas que não vêm do trabalho. A causa conhecida é o município do órgão pagador, e
      por isso ele fica fora dos rankings e das classificações de saturação.</div>` : ""}
  </div>
  </section>`;
}

/* ============ 11. metodologia ============ */
function cgMetodo(D) {
  const tl = D.linha_do_tempo.slice().reverse();
  const TIPOROT = { margem: "margem", teto: "teto de juros", prazo: "prazo", fraude: "antifraude", sancao: "sanção" };
  return `<section id="cg-metodo">${sechead("11. Fontes, definições e limites", "auditoria de viabilidade")}
  <details class="charttable"><summary>Evolução regulatória — ${tl.length} eventos com norma e data</summary>
  <div class="card">
    <ol class="cgtl">${tl.map(e => `<li>
      <span class="d">${e.d.split("-").reverse().join("/")}</span>
      <span class="c"><b>${e.t}</b> <span class="tp tp-${e.tipo}">${TIPOROT[e.tipo]}</span>
        <span class="src">${e.norma}</span><span class="o">${e.o}</span></span></li>`).join("")}</ol>
    <p class="src">${cgSelo("observado")} Cada evento traz a norma que o produziu. As mudanças
    aparecem marcadas nas séries da seção 5 para permitir inspeção — <b>não</b> para atribuir a
    elas a variação observada.</p>
  </div>
  </details>

  ${D.dicionario ? `<details class="charttable"><summary>Dicionário de indicadores (${D.dicionario.length})</summary>
    <div class="desdic">${D.dicionario.map(x => `<div class="desdicit">
      <h5>${x.t} ${cgSelo(x.selo)}</h5>
      <p><b>Definição:</b> ${x.d}</p>
      <p class="src"><b>Fonte:</b> ${x.f}</p>
      <p class="src"><b>Limite:</b> ${x.l}</p></div>`).join("")}</div>
  </details>` : ""}

  <div class="card">
    <h4>O que esta página não autoriza concluir</h4>
    <ul class="desnota">
      <li>O município dos benefícios é o do <b>órgão pagador</b>, não o de residência. Onde os dois
        universos divergem, o indicador se distorce — e o teste de coerência mede exatamente isso,
        reprovando ${fmt.n0(D.totais.incoerentes)} municípios.</li>
      <li>O valor dos benefícios é <b>líquido de descontos</b>. O consignado já saiu dele, então
        esse número nunca serve de medida de exposição ao crédito.</li>
      <li>A contagem é de <b>créditos emitidos</b>, não de pessoas. Não existe contagem de
        beneficiários por município em nenhuma fonte pública.</li>
      <li>O Censo <b>não separa</b> aposentadoria e pensão das demais rendas. A participação de
        outras fontes é publicada como teto, jamais como renda previdenciária.</li>
      <li>Não existe carteira municipal pública de consignado. Toda exposição municipal aqui é
        <b>estimativa</b> por alocação do total estadual.</li>
      <li>A relação entre dependência previdenciária e consignado só é afirmada a partir do dado
        estadual observado. A versão municipal dessa relação é mecânica.</li>
      <li>Reclamação mede propensão a reclamar, não incidência de problema, e contagem bruta não
        é ranking de conduta.</li>
      <li>Nenhum município é classificado como saturado a partir de alocação proporcional pura.</li>
    </ul>
  </div>
  </section>`;
}

window.cgFiltra = (k, v) => { state.cg = { ...(state.cg || {}), [k]: v }; renderConsignado(); };
window.cgSel = cod => {
  const s = state.cg || {};
  const comp = s.comp || [];
  if (s.sel && s.sel !== cod && comp.length < 4 && !comp.includes(s.sel)) comp.push(s.sel);
  state.cg = { ...s, sel: cod, comp: comp.filter(c => c !== cod) };
  renderConsignado();
  const alvo = document.getElementById("cg-perfil");
  if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" });
};
window.cgTira = cod => {
  const s = state.cg || {};
  state.cg = { ...s, sel: s.sel === cod ? null : s.sel, comp: (s.comp || []).filter(c => c !== cod) };
  renderConsignado();
};
window.cgLimpa = () => { state.cg = { ...(state.cg || {}), comp: [] }; renderConsignado(); };

/* ---------- Indicadores operacionais (Fase 0: só fonte estruturada) ---------- */
/* Resolve a instituição operacional a partir da identidade da página de IF:
   código IF.data (conglomerado C… ou individual = CNPJ-raiz) ou CNPJ do
   cabeçalho. Universos distintos por desenho: a rede é do banco operacional
   no ESTBAN, não do conglomerado prudencial — o bloco declara isso. */
function operResolve(codIfdata, cnpj) {
  const O = state.data.operacional;
  if (!O || !O.disponivel) return null;
  // Nas instituições individuais do IF.data o próprio código É o CNPJ-raiz;
  // o CNPJ do cabeçalho cobre os demais casos (quando a fonte o publica).
  const soDigitos = String(cnpj || "").replace(/\D/g, "").slice(0, 8);
  const cnpj8 = (soDigitos.length === 8 ? soDigitos : "") ||
    (/^\d{8}$/.test(codIfdata || "") ? codIfdata : "");
  const piloto = O.instituicoes.find(i =>
    (codIfdata && i.cod_ifdata === codIfdata) || (cnpj8 && i.cnpj8_rede === cnpj8)) || null;
  const rede = (piloto && piloto.rede) ? {
    mes: piloto.rede.atual.mes, agencias: piloto.rede.atual.agencias,
    municipios: piloto.rede.atual.municipios, var_12m: piloto.rede.var_12m,
    var_12m_pct: piloto.rede.var_12m_pct, serie: piloto.rede.serie,
  } : ((O.rede_por_cnpj8 || {})[cnpj8] || ((piloto && piloto.cnpj8_rede) ? (O.rede_por_cnpj8 || {})[piloto.cnpj8_rede] : null) || null);
  // O cadastro de dependências cobre mais de mil instituições — muito além das
  // do painel —, então a página de QUALQUER IF com CNPJ-raiz conhecido ganha a
  // rede de atendimento, mesmo sem FRE, sem auditor e sem ESTBAN.
  const pontos = ((O.dependencias || {}).por_cnpj8 || {})[cnpj8]
    || ((piloto && piloto.cnpj8_rede) ? ((O.dependencias || {}).por_cnpj8 || {})[piloto.cnpj8_rede] : null) || null;
  const corresp = ((O.correspondentes || {}).por_cnpj8 || {})[cnpj8]
    || ((piloto && piloto.cnpj8_rede) ? ((O.correspondentes || {}).por_cnpj8 || {})[piloto.cnpj8_rede] : null) || null;
  if (!piloto && !rede && !pontos && !corresp) return null;
  return { piloto, rede, pontos, corresp, posicao: (O.dependencias || {}).posicao,
           posicaoCorresp: (O.correspondentes || {}).posicao };
}

function operBlocoInst(cab) {
  const r = operResolve(state.filters.instCod, cab && cab.cnpj);
  if (!r) return "";
  const { piloto, rede, pontos, corresp } = r;
  const emp = piloto && piloto.empregados ? piloto.empregados.serie[piloto.empregados.serie.length - 1] : null;
  const aud = piloto && piloto.auditor && piloto.auditor.vigente;
  const dvar = v => v == null ? "" : `<div class="delta ${v < 0 ? "up" : "down good"}">${v > 0 ? "▲ +" : v < 0 ? "▼ " : ""}${fmt.n0(v)} em 12 meses</div>`;
  const cards = [];
  if (rede) cards.push(`<div class="card kpi"><h4>Agências (banco operacional)</h4>
    <div class="big" style="font-size:21px">${fmt.n0(rede.agencias)}</div>${dvar(rede.var_12m)}
    ${rede.serie ? sparkline(rede.serie.map(p => p.agencias), 150, 30) : ""}
    <div class="src">${badge("observado")} ${fmt.n0(rede.municipios)} municípios · ESTBAN ${fmt.my(rede.mes)}</div></div>`);
  if (emp) cards.push(`<div class="card kpi"><h4>Empregados (declarado no FRE)</h4>
    <div class="big" style="font-size:21px">${fmt.n0(emp.total)}</div>
    ${emp.var_aa_pct != null ? `<div class="delta ${emp.var_aa_pct < 0 ? "up" : "down good"}">${emp.var_aa_pct > 0 ? "▲ +" : "▼ "}${fmt.n(Math.abs(emp.var_aa_pct), 1)}% a/a</div>` : ""}
    ${piloto.empregados.serie.length > 2 ? sparkline(piloto.empregados.serie.map(p => p.total), 150, 30) : ""}
    <div class="src">${badge("observado")} escopo declarado pela companhia · ref. ${fmt.d(emp.ref)}</div></div>`);
  if (pontos) cards.push(`<div class="card kpi"><h4>Rede de atendimento (cadastro do BC)</h4>
    <div class="big" style="font-size:21px">${fmt.n0(pontos.total)}</div>
    <div class="src" style="margin-top:2px">${fmt.n0(pontos.agencia)} agências · ${fmt.n0(pontos.posto)} postos · ${fmt.n0(pontos.pae)} PAE</div>
    <div class="src">${badge("observado")} ${fmt.n0(pontos.municipios)} municípios · posição ${r.posicao || "–"}</div></div>`);
  if (corresp) cards.push(`<div class="card kpi"><h4>Correspondentes contratados</h4>
    <div class="big" style="font-size:21px">${fmt.n0(corresp.pontos)}</div>
    <div class="src" style="margin-top:2px">${fmt.n0(corresp.correspondentes)} correspondentes distintos</div>
    <div class="src">${badge("observado")} ${fmt.n0(corresp.municipios)} municípios · posição ${r.posicaoCorresp || "–"} · contratante, não grupo</div></div>`);
  if (aud) cards.push(`<div class="card kpi"><h4>Auditor independente</h4>
    <div class="big" style="font-size:15px;line-height:1.25">${aud.nome}</div>
    <div class="src">${badge("observado")} desde ${fmt.d(aud.desde)} · ${piloto.auditor.historico.filter(h => h.fim).length} troca(s) registrada(s) no FCA</div></div>`);
  if (!cards.length) return "";
  return `<div id="s-oper" style="margin-top:12px">${sechead("Indicadores operacionais (Fase 0)", "gente, rede e auditoria — fontes estruturadas oficiais")}
    <div class="pan-kpi">${cards.join("")}</div>
    <p class="src">Universos distintos, nunca somados: as agências do cadastro do BC são as CADASTRADAS, as do ESTBAN
    são as PROCESSADAS no mês; a rede é do banco operacional no ESTBAN (pode diferir deste
    ${state.filters.instCod && state.filters.instCod.startsWith("C") ? "conglomerado prudencial" : "nível de consolidação"});
    empregados são o declarado pela companhia listada no FRE.
    <a href="javascript:void(0)" onclick="nav('operacional')">ver o painel completo →</a></p></div>`;
}

/* Bloco "companhia listada" da ficha da IF: guidance × realizado, custos de
   TI, remuneração da administração e folha — tudo junto pela RAIZ do CNPJ da
   holding listada (cadastro CVM, via perfil operacional), nunca por nome.
   Cada sub-bloco só aparece quando a IF tem o dado; ausência não vira zero. */
function instListadaSecao(pg, cab) {
  const r = operResolve(pg.cod_inst, cab && cab.cnpj);
  const c8 = (r && r.piloto && r.piloto.cnpj8) || null;
  const partes = [instRegimeAviso(pg, r), instGuidanceIF(c8), instTiIF(c8), instRemuneracaoIF(c8), instFolhaIF(c8)]
    .filter(Boolean);
  return partes.join("");
}

function instRegimeAviso(pg, r) {
  /* quase sempre vazio — mas quando a IF da página está na lista vigente de
     regimes do BCB, isso é a PRIMEIRA coisa que a ficha deve dizer */
  const R = state.data.regimes;
  if (!R || !R.disponivel) return "";
  const cands = new Set([pg.cod_inst,
    (r && r.piloto && r.piloto.cnpj8) || "", (r && r.piloto && r.piloto.cnpj8_rede) || ""]);
  const hit = (R.vigentes || []).find(v => cands.has(v.cnpj8));
  if (!hit) return "";
  return `<div class="note warn" style="margin-top:12px"><b>Sob ${termo("regime-de-resolucao","regime de resolução")} do BCB:</b>
    ${hit.tipo}, decretado em ${hit.inicio}${hit.responsavel ? ` · responsável nomeado: ${hit.responsavel}` : ""}.
    <span class="src">Lista oficial vigente (BCB/Olinda), atualização diária — detalhes na aba Pulso do crédito.</span></div>`;
}

function instGuidanceIF(c8) {
  const G = state.data.guidance;
  if (!c8 || !G || !G.disponivel) return "";
  const ciclos = (G.ciclos || []).filter(c => c.cnpj8 === c8);
  if (!ciclos.length) return "";
  const ordenados = ciclos.slice().sort((a, b) => b.ano - a.ano);
  return `<div id="s-guidance" class="card" style="margin-top:12px"><h4>${termo("guidance","Guidance")} × entregue — promessas da própria companhia ${badge("observado", G.fonte.nota)}</h4>
    ${ordenados.map(guidCicloBloco).join("")}
    <p class="src">${(G.cautelas || [])[0] || ""}</p>
    <p class="src">${G.fonte.nome} · nível ${G.fonte.nivel} · <a href="javascript:void(0)" onclick="nav('institutions')">todos os bancos com guidance →</a></p></div>`;
}

function instTiIF(c8) {
  const O = state.data.operacional;
  const TI = O && O.custos_ti;
  if (!c8 || !TI) return "";
  const obs = (TI.observacoes || []).filter(o => o.cnpj8 === c8)
    .sort((a, b) => (b.data_ref || "").localeCompare(a.data_ref || ""));
  if (!obs.length) return "";
  return `<div id="s-ti" class="card" style="margin-top:12px"><h4>Quanto custa a TI ${badge("observado", TI.fonte && TI.fonte.nota)}</h4>
    <div class="tblwrap"><table class="data compact">
      <thead><tr><th>Rubrica (conceito do próprio banco)</th><th class="num">Valor</th><th>Referência</th></tr></thead>
      <tbody>${obs.map(o => `<tr>
        <td>${o.metrica}${o.conceito_nota ? ` <span title="${attr(o.conceito_nota)}">ⓘ</span>` : ""}<div class="src">${o.regime || ""}</div></td>
        <td class="num"><b>${fmt.n0(o.valor)}</b> ${o.unidade}${o.comparativos ? `<div class="src">${Object.entries(o.comparativos).map(([a, v]) => `${a}: ${fmt.n0(v)}`).join(" · ")}</div>` : ""}</td>
        <td class="src">${fmt.d(o.data_ref)}<br><a href="${attr(o.documento.url)}" target="_blank" rel="noopener">${(o.documento.titulo || "documento").slice(0, 40)}</a> · ${o.pagina}</td></tr>`).join("")}</tbody></table></div>
    <p class="src">Conceitos contábeis DIFEREM entre bancos (a nota de cada rubrica declara o alcance) — nunca compare os valores entre instituições. Extração aprovada por revisor.</p></div>`;
}

function instRemuneracaoIF(c8) {
  const O = state.data.operacional;
  const RM = O && O.remuneracao;
  if (!c8 || !RM) return "";
  const emp = (RM.empresas || []).find(e => e.cnpj8 === c8);
  if (!emp) return "";
  const linha = (orgao, d) => {
    if (!d || !d.realizado) return "";
    const rz = d.realizado, pv = d.previsto;
    return `<tr><td>${orgao}</td>
      <td class="num"><b>${fmt.money(rz.total_brl)}</b><div class="src">exercício ${rz.exercicio}</div></td>
      <td class="num">${rz.membros != null ? fmt.n(rz.membros, 1) : "–"}</td>
      <td class="num">${rz.media_por_membro_brl != null ? fmt.money(rz.media_por_membro_brl) : "–"}</td>
      <td class="num">${rz.maior != null ? fmt.money(rz.maior) : "–"}<div class="src">(8.3)</div></td>
      <td class="num">${pv ? `${fmt.money(pv.total_brl)}<div class="src">${pv.exercicio}</div>` : "–"}</td></tr>`;
  };
  return `<div id="s-rem" class="card" style="margin-top:12px"><h4>Quanto ganha a administração ${badge("observado", RM.fonte && RM.fonte.nota)}</h4>
    <div class="tblwrap"><table class="data compact">
      <thead><tr><th>Órgão</th><th class="num">Total realizado</th><th class="num">Membros (média)</th><th class="num">Média/membro</th><th class="num">Maior individual</th><th class="num">Previsto</th></tr></thead>
      <tbody>${linha("Diretoria Estatutária", emp.orgaos["Diretoria Estatutária"])}${linha("Conselho de Administração", emp.orgaos["Conselho de Administração"])}</tbody></table></div>
    ${(RM.cautelas || []).slice(0, 2).map(x => `<p class="src">${x}</p>`).join("")}
    <p class="src">CVM/FRE ${emp.fre_ano} — dados estruturados declarados pela própria companhia · <a href="javascript:void(0)" onclick="nav('operacional')">ver todos os bancos →</a></p></div>`;
}

function instFolhaIF(c8) {
  const FB = state.data.folha_bancos;
  const bal = FB && FB.balanco;
  if (!c8 || !bal) return "";
  const obs = (bal.observacoes || []).filter(o => o.cnpj8 === c8)
    .sort((a, b) => (b.data_ref || "").localeCompare(a.data_ref || ""));
  if (!obs.length) return "";
  return `<div id="s-folha" class="card" style="margin-top:12px"><h4>Folhas de pagamento no balanço ${badge("observado", bal.fonte && bal.fonte.nota)}</h4>
    ${obs.map(o => `<p style="margin:6px 0">${o.metrica}: <b>${fmt.n0(o.valor)} ${o.unidade}</b>
      <span class="src">· ref. ${fmt.d(o.data_ref)} · <a href="${attr(o.documento.url)}" target="_blank" rel="noopener">${(o.documento.titulo || "documento").slice(0, 44)}</a> · ${o.pagina}</span></p>`).join("")}
    <p class="src">O que o banco pagou (e amortiza) pelo direito de operar folhas — competição por captação estável. Extração aprovada por revisor · <a href="javascript:void(0)" onclick="nav('operacional')">contexto completo →</a></p></div>`;
}

function cmpRedeFase0(insts, datas) {
  const O = state.data.operacional;
  if (!O || !O.disponivel || !insts.length) return "";
  const linhas = insts.map(c => {
    const nome = (datas[c] && datas[c].nome) || c;
    const r = operResolve(c, c.startsWith("C") ? null : c);
    if (!r || !r.rede) {
      const motivo = c.startsWith("C")
        ? (r && r.piloto ? "sem rede reportada no ESTBAN no mês corrente" : "conglomerado sem mapeamento na Fase 0")
        : "sem agências no ESTBAN no mês corrente";
      return `<tr><td>${nome.slice(0, 30)}</td><td class="num" colspan="4"><span class="src">${motivo}</span></td></tr>`;
    }
    const pt = r.pontos;
    return `<tr><td>${nome.slice(0, 30)}</td>
      <td class="num">${fmt.n0(r.rede.agencias)}</td>
      <td class="num">${r.rede.var_12m == null ? "–" : `${r.rede.var_12m > 0 ? "+" : ""}${fmt.n0(r.rede.var_12m)}${r.rede.var_12m_pct != null ? ` (${r.rede.var_12m_pct > 0 ? "+" : ""}${fmt.n(r.rede.var_12m_pct, 1)}%)` : ""}`}</td>
      <td class="num">${fmt.n0(r.rede.municipios)}</td>
      <td class="num">${pt ? fmt.n0(pt.posto + pt.pae) : "<span class='src'>sem cadastro</span>"}</td></tr>`;
  }).join("");
  const mes = Object.values(O.rede_por_cnpj8 || {})[0];
  return `<div style="margin-top:12px">${sechead("Rede física (Fase 0 · ESTBAN)", `agências do banco operacional · ${mes ? fmt.my(mes.mes) : ""}`)}
  <div class="card"><div class="tblwrap"><table>
    <thead><tr><th>Instituição</th><th class="num">Agências</th><th class="num">Δ 12 meses</th><th class="num">Municípios</th><th class="num">Postos + PAE</th></tr></thead>
    <tbody>${linhas}</tbody></table></div>
    <p class="src">${badge("observado")} Universo diferente das métricas do IF.data acima: a rede vem do ESTBAN, do CNPJ do
    banco operacional — informativo ao lado da comparação, não uma métrica do catálogo. Queda abrupta pode ser migração
    societária entre CNPJs do grupo. A coluna de postos e PAE vem do cadastro do BC, com data-base própria: não se soma
    às agências processadas ao lado. <a href="javascript:void(0)" onclick="nav('operacional')">painel completo →</a></p></div></div>`;
}

function renderOperacional() {
  const el = document.getElementById("view-operacional");
  const D = state.data.operacional;
  if (D === undefined) { el.innerHTML = loadingCard("Indicadores operacionais"); return; }
  if (!D || !D.disponivel) {
    el.innerHTML = pageHead({ title: "Indicadores operacionais", desc: "Painel indisponível nesta execução." }) +
      `<div class="card"><p class="src">${(D && (D.motivo || D.error)) || "sem dados"}</p></div>`;
    return;
  }
  const sfn = (D.sfn && D.sfn.rede && D.sfn.rede.serie) || [];
  const atual = sfn[sfn.length - 1] || {};
  const idx12 = atual.mes ? sfn.find(p => p.mes === `${parseInt(atual.mes.slice(0, 4), 10) - 1}-${atual.mes.slice(5, 7)}`) : null;
  const dSfn12 = idx12 ? atual.agencias - idx12.agencias : null;
  const flagDe = (nome, ind) => (D.flags || []).some(f => f.instituicao === nome && f.indicador === ind)
    ? ` <span class="warn" title="${attr(((D.flags.find(f => f.instituicao === nome && f.indicador === ind) || {}).detalhe))}" tabindex="0" role="img" aria-label="verificação automática pendente">⚑</span>` : "";

  const kpis = `<div class="pan-kpi">
    <div class="card kpi"><h4>Agências no SFN</h4><div class="big">${fmt.n0(atual.agencias)}</div>
      <div class="src">${badge("observado")} todos os bancos do ESTBAN · ${fmt.my(atual.mes)}${dSfn12 != null ? `<br>${dSfn12 > 0 ? "+" : ""}${fmt.n0(dSfn12)} em 12 meses` : ""}</div></div>
    <div class="card kpi"><h4>Municípios com agência</h4><div class="big">${fmt.n0(atual.municipios)}</div>
      <div class="src">${badge("observado")} de 5.570 municípios<br>os demais dependem de postos e canais digitais</div></div>
    <div class="card kpi"><h4>Bancos com rede física</h4><div class="big">${fmt.n0(atual.bancos)}</div>
      <div class="src">${badge("observado")} com ao menos 1 agência processada</div></div>
    <div class="card kpi"><h4>Série disponível</h4><div class="big">${sfn.length} <span style="font-size:.55em">meses</span></div>
      <div class="src">${sfn.length ? `${fmt.my(sfn[0].mes)} a ${fmt.my(atual.mes)}` : "–"} · atualização mensal</div></div>
  </div>`;

  const aviso = `<div class="judalerta" style="max-width:78ch"><b>Dois universos, nunca somados.</b>
    <div style="margin-top:5px">${D.aviso}</div></div>`;

  // Todos os bancos do ESTBAN (não só o piloto); flags do piloto casadas por CNPJ-raiz.
  const flagRedePorCnpj8 = {};
  D.instituicoes.forEach(i => {
    if (i.cnpj8_rede && (D.flags || []).some(f => f.instituicao === i.nome && f.indicador === "rede")) {
      flagRedePorCnpj8[i.cnpj8_rede] = (D.flags.find(f => f.instituicao === i.nome && f.indicador === "rede") || {}).detalhe;
    }
  });
  const todosBancos = Object.entries(D.rede_por_cnpj8 || {})
    .map(([cnpj8, r]) => ({ cnpj8, ...r }))
    .sort((a, b) => b.agencias - a.agencias);
  const tRede = `${sechead("Rede física por banco", `todos os ${todosBancos.length} bancos com agência no ESTBAN · CNPJ do banco operacional`)}
  <div class="card"><div class="tblwrap"><table>
    <thead><tr><th>#</th><th>Banco</th><th class="num">Agências</th><th class="num">Δ 12 meses</th><th class="num">Municípios</th><th>Tendência (${sfn.length ? `${fmt.my(sfn[0].mes)}–${fmt.my(atual.mes)}` : ""})</th></tr></thead>
    <tbody>${todosBancos.map((r, ix) => `<tr>
      <td class="num">${ix + 1}</td>
      <td>${r.nome}${flagRedePorCnpj8[r.cnpj8] ? ` <span class="warn" title="${attr(flagRedePorCnpj8[r.cnpj8])}" tabindex="0" role="img" aria-label="verificação automática pendente">⚑</span>` : ""}</td>
      <td class="num">${fmt.n0(r.agencias)}</td>
      <td class="num">${r.var_12m == null ? "–" : `${r.var_12m > 0 ? "+" : ""}${fmt.n0(r.var_12m)}${r.var_12m_pct != null ? ` (${r.var_12m_pct > 0 ? "+" : ""}${fmt.n(r.var_12m_pct, 1)}%)` : ""}`}</td>
      <td class="num">${fmt.n0(r.municipios)}</td>
      <td>${r.serie && r.serie.length > 2 ? sparkline(r.serie.map(p => p.agencias)) : ""}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src">${badge("observado")} Agência processada ≠ posto de atendimento ≠ correspondente. A posição (#) ordena por
    número de agências — é contagem de rede física, não ranking de qualidade. Queda abrupta pode ser migração de agências
    entre CNPJs do mesmo grupo — os casos sinalizados (⚑) estão nas verificações automáticas abaixo. Bancos sem agência
    processada no mês corrente não aparecem (ausência ≠ zero encerrado).</p></div>`;

  /* Rede de atendimento além da agência. O ESTBAN só enxerga agência; o
     cadastro do BC alcança posto e PAE, e é o que permite dizer em quantos
     municípios existe algum ponto de atendimento — número que a aba prometia
     e não tinha. Os dois conceitos de agência ficam lado a lado, sem soma. */
  const DP = D.dependencias;
  const comPontos = DP ? D.instituicoes.filter(i => i.pontos).map(i => ({ i, p: i.pontos }))
    .sort((a, b) => (b.p.agencia + b.p.posto + b.p.pae) - (a.p.agencia + a.p.posto + a.p.pae)) : [];
  const tPontos = !DP ? "" : `${sechead("Rede de atendimento além das agências", `cadastro do BC · posição ${DP.posicao}`)}
  <div class="pan-kpi">
    <div class="card kpi"><h4>Agências cadastradas</h4><div class="big">${fmt.n0(DP.totais.agencia)}</div>
      <div class="src">${badge("observado")} conceito distinto do ESTBAN<br>lá são as processadas no mês</div></div>
    <div class="card kpi"><h4>Postos de atendimento</h4><div class="big">${fmt.n0(DP.totais.posto)}</div>
      <div class="src">${badge("observado")} PAB, PAC, PAA, câmbio, microcrédito</div></div>
    <div class="card kpi"><h4>Postos eletrônicos (PAE)</h4><div class="big">${fmt.n0(DP.totais.pae)}</div>
      <div class="src">${badge("observado")} terminal fora de agência, sem atendente</div></div>
    <div class="card kpi"><h4>Municípios sem dependência</h4><div class="big">${fmt.n0(DP.municipios.sem_dependencia)}</div>
      <div class="src">${badge("observado")} de ${fmt.n0(DP.municipios.total_municipios)}<br>sem agência, posto ou PAE — mas com correspondente</div></div>
  </div>
  <div class="card">
    <p class="src">Somando os três tipos, existe dependência própria de instituição financeira em
    <b>${fmt.n0(DP.municipios.com_qualquer_ponto)}</b> dos ${fmt.n0(DP.municipios.total_municipios)} municípios. Só
    <b>${fmt.n0(DP.municipios.com_agencia)}</b> têm agência: outros <b>${fmt.n0(DP.municipios.so_posto_sem_agencia)}</b>
    são atendidos apenas por posto ou terminal eletrônico, e <b>${fmt.n0(DP.municipios.sem_dependencia)}</b> não têm
    nenhum dos três${DP.municipios.sem_dependencia_com_correspondente != null ? ` — mas <b>${fmt.n0(DP.municipios.sem_dependencia_com_correspondente)}</b> desses têm correspondente contratado (ver a seção seguinte), e o país fica com <b>${fmt.n0(DP.municipios.sem_nenhum_ponto)}</b> municípios sem nenhum ponto físico` : ""}.</p>
    <div class="tblwrap" style="margin-top:10px"><table>
      <thead><tr><th>Instituição</th><th class="num">Agências</th><th class="num">Postos</th><th class="num">PAE</th><th class="num">Total</th><th class="num">Municípios</th></tr></thead>
      <tbody>${comPontos.map(({ i, p }) => `<tr>
        <td>${i.nome}</td><td class="num">${fmt.n0(p.agencia)}</td><td class="num">${fmt.n0(p.posto)}</td>
        <td class="num">${fmt.n0(p.pae)}</td><td class="num"><b>${fmt.n0(p.total)}</b></td>
        <td class="num">${fmt.n0(p.municipios)}</td></tr>`).join("")}
      </tbody></table></div>
    <div class="note warn" style="margin-top:8px"><b>Dois conceitos de agência, nunca somados.</b> ${DP.escopo}</div>
    <dl class="descomoler" style="margin-top:10px">${(DP.conceitos || []).map(c => `<dt>${c.termo}</dt><dd>${c.def}</dd>`).join("")}</dl>
    <p class="src">${badge("observado")} <a href="${attr(DP.fonte.url)}" target="_blank" rel="noopener">${DP.fonte.nome}</a> ·
    nível ${DP.fonte.nivel}. O cadastro é uma posição, não série: o BC republica o arquivo e não divulga histórico —
    o painel passa a acumular a série a partir da primeira coleta. Instituição sem ponto cadastrado não aparece na
    tabela: ausência de dependência é informação, não zero de rede encerrada.</p></div>`;

  /* Mapa municipal: a pergunta que os agregados nacionais não respondem é
     "no meu município existe o quê?". As classes são ordenadas por
     profundidade do atendimento e o mapa é categórico de propósito — não há
     escala contínua honesta entre "tem agência" e "tem lotérica". */
  const PR = state.data.presenca_mun;
  const malhaPR = state.data.penetracao_malha;
  const PR_COR = { agencia: "#1d4e89", posto: "#0e7c7b", correspondente: "#b45309", nenhum: "#b91c1c" };
  const tPresenca = !PR ? "" : (() => {
    const porCod = Object.fromEntries(PR.municipios.map(m => [m.cod, m]));
    const paths = !malhaPR ? "" : Object.entries(malhaPR.paths).map(([cod, d]) => {
      const m = porCod[cod];
      if (!m) return `<path d="${d}" fill="var(--surface-2)" class="penmun fora"></path>`;
      const tip = encodeURIComponent(`<div class="tt-date">${m.nome} (${m.uf})</div>
        <div class="tt-row"><span class="tt-lbl">agências</span><span class="tt-val">${fmt.n0(m.agencia)}</span></div>
        <div class="tt-row"><span class="tt-lbl">postos</span><span class="tt-val">${fmt.n0(m.posto)}</span></div>
        <div class="tt-row"><span class="tt-lbl">postos eletrônicos</span><span class="tt-val">${fmt.n0(m.pae)}</span></div>
        <div class="tt-row"><span class="tt-lbl">correspondentes</span><span class="tt-val">${fmt.n0(m.corresp)}</span></div>
        <div class="tt-row"><span class="tt-lbl">instituições com dependência</span><span class="tt-val">${fmt.n0(m.ifs_dep)}</span></div>`);
      return `<path d="${d}" fill="${PR_COR[m.classe]}" class="penmun" style="cursor:pointer" data-tip="${tip}" onclick="presNav('${m.cod}')" aria-label="${attr(`${m.nome} ${m.uf}: ${m.classe} — abrir página do município`)}"></path>`;
    }).join("");
    const tot = PR.totais;
    const pct = v => fmt.n(100 * v / tot.municipios, 1) + "%";
    const legenda = PR.classes.map(c => `<span class="chip" title="${attr(c.def)}">
      <span style="display:inline-block;width:10px;height:10px;background:${PR_COR[c.id]};border-radius:2px;margin-right:5px"></span>
      ${c.rotulo}: <b>${fmt.n0(tot[c.id])}</b> (${pct(tot[c.id])})</span>`).join(" ");
    const ufs = [...PR.por_uf].sort((a, b) =>
      (b.correspondente / b.municipios) - (a.correspondente / a.municipios));
    return `${sechead("Presença bancária física por município", `dependências e correspondentes · posição ${PR.posicao.dependencias}`)}
    <div class="card">
      <div class="note warn">${PR.aviso}</div>
      <div class="chips" style="margin:10px 0">${legenda}</div>
      ${malhaPR ? `<svg class="penmapa" viewBox="${malhaPR.viewBox}" role="img" aria-label="mapa municipal do tipo de presença bancária"><g transform="${malhaPR.transform}">${paths}</g></svg>`
                : `<p class="src">malha municipal ainda carregando…</p>`}
      <p class="src">Mapa categórico: a cor é o ponto de MAIOR profundidade existente no município, não a quantidade.
      Um município com agência e mil correspondentes tem a mesma cor de um com uma agência só.
      Clique em um município para abrir a página dele, com as contagens completas.
      ${malhaPR && PR.totais.municipios > Object.keys(malhaPR.paths).length
        ? `A malha desenha ${fmt.n0(Object.keys(malhaPR.paths).length)} polígonos e as contagens usam ${fmt.n0(PR.totais.municipios)} municípios: os instalados depois do Censo 2022 entram na tabela e ainda não no desenho.` : ""}</p>
      <h4 style="margin-top:12px">Por unidade da federação</h4>
      <div class="tblwrap"><table class="data compact">
        <thead><tr><th>UF</th><th class="num">Municípios</th><th class="num">Com agência</th><th class="num">Só posto ou terminal</th><th class="num">Só correspondente</th><th class="num">Sem nenhum</th></tr></thead>
        <tbody>${ufs.map(u => `<tr><td>${u.uf}</td><td class="num">${fmt.n0(u.municipios)}</td>
          <td class="num">${fmt.n0(u.agencia)}</td><td class="num">${fmt.n0(u.posto)}</td>
          <td class="num"><b>${fmt.n0(u.correspondente)}</b></td><td class="num">${fmt.n0(u.nenhum)}</td></tr>`).join("")}
        </tbody></table></div>
      <p class="src" style="margin-top:6px">Ordenado pela fatia de municípios em que o correspondente é a única presença.</p>
      <details class="decomp" style="margin-top:10px"><summary>o que este mapa não diz</summary>
        <ul style="font-size:13px;margin:6px 0 0 18px">${PR.limitacoes.map(l => `<li>${l}</li>`).join("")}</ul>
        <div class="tblwrap" style="margin-top:8px"><table class="data compact"><tbody>
        ${PR.classes.map(c => `<tr><td style="white-space:nowrap"><b>${c.rotulo}</b></td><td class="src">${c.def}</td></tr>`).join("")}
        </tbody></table></div>
      </details>
      <p class="src" style="margin-top:8px">${badge("observado")} ${(PR.fontes || []).map(f =>
        `<a href="${attr(f.url)}" target="_blank" rel="noopener">${f.nome}</a>`).join(" · ")}</p>
    </div>`;
  })();

  /* Correspondentes: é aqui que a presença bancária deixa de ser rede própria.
     Contagem por CNPJ-raiz CONTRATANTE, como o BC publica — sem consolidar
     grupo econômico, o que a fonte não permite. */
  const CO = D.correspondentes;
  const comCorr = CO ? D.instituicoes.filter(i => i.correspondentes)
    .sort((a, b) => b.correspondentes.pontos - a.correspondentes.pontos) : [];
  const tCorr = !CO ? "" : `${sechead("Correspondentes no País", `pontos contratados por instituição · posição ${CO.posicao}`)}
  <div class="pan-kpi">
    <div class="card kpi"><h4>Pontos de correspondente</h4><div class="big">${fmt.n0(CO.totais.pontos)}</div>
      <div class="src">${badge("observado")} contratados por ${fmt.n0(CO.totais.contratantes)} instituições</div></div>
    <div class="card kpi"><h4>Municípios alcançados</h4><div class="big">${fmt.n0(CO.totais.municipios)}</div>
      <div class="src">${badge("observado")} de ${fmt.n0((D.dependencias || {}).municipios ? D.dependencias.municipios.total_municipios : 0)} — cobertura praticamente universal</div></div>
    <div class="card kpi"><h4>Onde o correspondente é a única presença</h4>
      <div class="big">${fmt.n0(((D.dependencias || {}).municipios || {}).sem_dependencia_com_correspondente || 0)}</div>
      <div class="src">${badge("observado")} municípios sem agência, posto ou PAE</div></div>
  </div>
  <div class="card">
    <div class="tblwrap"><table>
      <thead><tr><th>Instituição contratante</th><th class="num">Pontos</th><th class="num">Correspondentes distintos</th><th class="num">Municípios</th></tr></thead>
      <tbody>${comCorr.map(i => `<tr><td>${i.nome}</td>
        <td class="num">${fmt.n0(i.correspondentes.pontos)}</td>
        <td class="num">${fmt.n0(i.correspondentes.correspondentes)}</td>
        <td class="num">${fmt.n0(i.correspondentes.municipios)}</td></tr>`).join("")}
      </tbody></table></div>
    <div class="note warn" style="margin-top:8px"><b>Contratante não é grupo.</b> ${CO.escopo}</div>
    <ul style="font-size:13px;margin:8px 0 0 18px">${(CO.limitacoes || []).map(l => `<li>${l}</li>`).join("")}</ul>
    <p class="src" style="margin-top:8px">${badge("observado")} <a href="${attr(CO.fonte.url)}" target="_blank" rel="noopener">${CO.fonte.nome}</a> ·
    nível ${CO.fonte.nivel}. Instituição sem correspondente contratado não aparece na tabela: ausência de contrato é
    informação, não zero de rede.</p></div>`;

  /* Quem banca a folha: a cessão da folha de servidores é o leilão em que o
     banco PAGA ao ente pelo direito de ser o banco dos salários — a porta do
     consignado. Três camadas com procedência distinta, nunca somadas: os
     grandes leilões (curados, fonte por nível), o INSS por lote (ordem de
     preferência) e o fluxo vivo do PNCP (vencedor por CNPJ, contagem — os
     valores têm semântica mista e não se somam). */
  const FB = state.data.folha_bancos;
  const tFolha = !FB || !FB.disponivel ? "" : (() => {
    const nivelChip = f => `<a href="${attr(f.url)}" target="_blank" rel="noopener" title="${attr(f.nome)}">nível ${f.nivel}</a>`;
    const tLei = `<div class="card"><h4>Grandes leilões de cessão da folha ${badge("observado")}</h4>
      <div class="tblwrap"><table>
        <thead><tr><th>Ente</th><th>Resultado</th><th>Vencedor</th><th class="num">Valor ao ente</th><th>Vigência</th><th>Fonte</th></tr></thead>
        <tbody>${FB.leiloes.map(l => `<tr>
          <td>${l.ente}<span class="src"> · ${l.uf}</span></td>
          <td>${l.data_resultado || "–"}</td>
          <td><b>${l.vencedor}</b></td>
          <td class="num" title="${attr(l.valor_nota || "")}">${l.valor != null ? fmt.money(l.valor) : "não homologado em valor único ⓘ"}</td>
          <td>${l.vigencia || "–"}</td>
          <td class="src">${(l.fontes || []).map(nivelChip).join(" · ")}</td></tr>`).join("")}
        </tbody></table></div>
      <p class="src">Cada leilão tem escopo, prazo e desenho próprios: os valores <b>nunca são somados nem
      comparados diretamente</b> entre linhas. A nota de cada valor (ⓘ) traz o contexto — em Fortaleza, a mesma
      folha caiu de R$ 290 mi (2019) para R$ 160 mi (2024) entre ciclos.</p></div>`;
    const inss = FB.inss;
    const tInss = `<div class="card"><h4>Folha de benefícios do INSS — pregão ${inss.pregao} ${badge("observado")}</h4>
      <p style="margin:6px 0">${inss.total_lotes} lotes regionais em ordem de preferência para pagar os benefícios
      concedidos em ${inss.vigencia}: ${inss.vencedores.map(v => `<b>${v.instituicao}</b> (${v.lotes} ${v.lotes === 1 ? "lote" : "lotes"} — ${v.detalhe})`).join(" e ")}.</p>
      <p class="src">${inss.leitura}</p>
      <p class="src">${inss.pendencia}</p></div>`;
    const P = FB.pncp || {};
    const tPncp = !P.disponivel ? `<div class="card"><h4>Fluxo do PNCP</h4>
      <p class="src">${P.motivo || "coleta ainda não disponível"} — a camada volta sozinha na próxima execução do pipeline.</p></div>`
      : `<div class="card"><h4>O fluxo corrente no PNCP ${badge("observado")}</h4>
      <p style="margin:6px 0"><b>${fmt.n0(P.total_contratos_if)}</b> contratos de folha com instituição financeira
      registrados desde a obrigatoriedade da Lei 14.133${P.backfill_completo ? "" : " (backfill em andamento — cobertura ainda parcial, declarada aqui até completar)"} e
      <b>${fmt.n0(P.total_editais)}</b> editais captados.</p>
      <div class="ov-2col-eq">
        <div><h4 style="margin:4px 0">Quem mais vence <span class="src">(contagem de contratos, nunca soma de valores)</span></h4>
        <div class="tblwrap"><table class="data compact">
          <thead><tr><th>Instituição</th><th class="num">Contratos</th><th class="num">UFs</th><th class="num">Como receita do ente</th></tr></thead>
          <tbody>${(P.ranking || []).slice(0, 10).map(r => `<tr><td>${r.banco}</td>
            <td class="num"><b>${fmt.n0(r.contratos)}</b></td><td class="num">${fmt.n0(r.ufs)}</td>
            <td class="num">${fmt.n0(r.como_receita)}</td></tr>`).join("")}</tbody></table></div></div>
        <div><h4 style="margin:4px 0">Contratos recentes</h4>
        <div class="tblwrap"><table class="data compact">
          <thead><tr><th>Ente</th><th>Banco</th><th>Assinatura</th><th class="num">Valor</th></tr></thead>
          <tbody>${(P.recentes || []).slice(0, 8).map(c => `<tr>
            <td>${c.url ? `<a href="${attr(c.url)}" target="_blank" rel="noopener">${c.municipio || c.ente}</a>` : (c.municipio || c.ente)}<span class="src"> · ${c.uf || "–"}</span></td>
            <td>${c.banco}</td><td>${c.assinatura || "–"}</td>
            <td class="num" title="${c.receita ? "cessão onerosa: o banco paga ao ente (receita)" : "valor do contrato como registrado pelo ente"}">${c.valor != null ? fmt.money(c.valor) : "–"}${c.receita ? " ↩" : ""}</td></tr>`).join("")}</tbody></table></div>
        <p class="src">↩ = registrado como receita do ente (cessão onerosa). Valores com semântica mista — nunca somados.</p></div>
      </div>
      <p class="src" style="margin-top:8px">${P.criterio_if}</p>
      <p class="src">${badge("observado")} <a href="${attr(P.fonte.url)}" target="_blank" rel="noopener">${P.fonte.nome}</a> · nível ${P.fonte.nivel}.</p></div>`;
    /* Rodada 2 — o lado do balanço (Fase 2): só observações APROVADAS são
       exibidas, com evidência (documento, página, trecho). Em revisão vira
       contagem, nunca número. Conceitos não comparáveis entre bancos. */
    const B = FB.balanco;
    const tBal = !B ? "" : (B.observacoes || []).length === 0
      ? `<div class="card"><h4>O lado do balanço — intangível de folha nas DFP</h4>
        <p class="src">${fmt.n0(B.em_revisao)} extração(ões) das notas explicativas das DFP aguardando revisão
        editorial — nada é publicado sem aprovação humana e evidência (documento, página e trecho).</p></div>`
      : `<div class="card"><h4>O lado do balanço — intangível de folha nas DFP ${badge("observado")}</h4>
        <p style="margin:6px 0">${B.leitura}</p>
        <div class="tblwrap"><table>
          <thead><tr><th>Banco</th><th>Métrica</th><th class="num">Valor</th><th>Ref.</th><th>Evidência</th></tr></thead>
          <tbody>${B.observacoes.map(o => `<tr>
            <td>${o.banco}${o.exclusivo_folha ? "" : ` <span class="seal aprox" title="a categoria contábil é mais ampla que folha — declarado na métrica">não exclusivo</span>`}</td>
            <td><span title="${attr(o.trecho)}">${o.metrica}</span></td>
            <td class="num"><b>${o.valor != null ? fmt.n0(o.valor) : "–"}</b> <span class="src">${o.unidade || ""}</span></td>
            <td>${o.data_ref || "–"}</td>
            <td class="src"><a href="${attr(o.documento.url)}" target="_blank" rel="noopener" title="${attr(o.documento.titulo)}">${o.pagina}</a></td></tr>`).join("")}
          </tbody></table></div>
        ${(B.cautelas || []).map(c => `<p class="src">${c}</p>`).join("")}
        <p class="src">${badge("observado")} ${B.fonte.nome} · nível ${B.fonte.nivel}${B.em_revisao ? ` · ${fmt.n0(B.em_revisao)} extração(ões) ainda em revisão` : ""}.</p></div>`;
    return `${sechead("Quem banca a folha dos servidores", "cessão da folha · INSS por lote · contratos no PNCP · balanço")}
      ${tLei}${tInss}${tPncp}${tBal}`;
  })();

  /* Quadro de pessoal divulgado pela própria instituição (Fase 2). Existe para
     quem não tem registro de companhia aberta e por isso não entrega o item
     10.1 do FRE. Fica em tabela separada porque conceito, escopo e data-base
     são os da divulgação — juntar com a série do FRE criaria comparação falsa. */
  const f2p = D.fase2 || {};
  const metricaP = m => ((f2p.metricas || {})[m] || {}).nome || m;
  const conceitoP = m => ((f2p.metricas || {})[m] || {}).conceito || "";
  const comPessoal = D.instituicoes.filter(i => i.pessoal_reportado && i.pessoal_reportado.length);
  const tPessoal = !comPessoal.length ? "" : `
  <div class="card"><h4>Quadro de pessoal divulgado pela própria instituição ${badge("observado")}</h4>
    <div class="tblwrap"><table>
      <thead><tr><th>Instituição</th><th>Métrica</th><th class="num">Pessoas</th><th>Período</th><th>Evidência (documento · página)</th></tr></thead>
      <tbody>${comPessoal.flatMap(i => i.pessoal_reportado.map(c => `<tr>
        <td>${i.nome}</td>
        <td><span title="${attr(conceitoP(c.metric_id))}">${metricaP(c.metric_id)}</span></td>
        <td class="num">${c.exibir}</td>
        <td>${c.periodo_rotulo}</td>
        <td><a href="${attr(c.documento.url)}" target="_blank" rel="noopener"
          title="${attr(`p.${c.pagina}: “${c.evidencia}” — ${c.documento.assunto} (${c.documento.fonte})`)}">${c.documento.assunto.slice(0, 38)} · p.${c.pagina}</a></td></tr>`)).join("")}
      </tbody></table></div>
    <dl class="descomoler" style="margin-top:10px">${Array.from(new Set(comPessoal.flatMap(i => i.pessoal_reportado.map(c => c.metric_id)))).map(m => `<dt>${metricaP(m)}</dt><dd>${conceitoP(m)}</dd>`).join("")}</dl>
    <p class="src"><b>Comparabilidade C:</b> estes números NÃO entram na série do FRE nem em ranking com ela. Escopo,
    conceito e data-base são os da divulgação de cada instituição.${f2p.em_revisao ? ` · ${f2p.em_revisao} extração(ões) aguardando revisão editorial.` : ""}</p></div>`;

  const comEmp = D.instituicoes.filter(i => i.empregados).map(i => ({ i, u: i.empregados.serie[i.empregados.serie.length - 1] }))
    .sort((a, b) => b.u.total - a.u.total);
  const tEmp = `${sechead("Gente — empregados declarados no FRE", "item 10.1 · escopo declarado pela companhia")}
  <div class="card"><div class="tblwrap"><table>
    <thead><tr><th>Companhia</th><th class="num">Empregados</th><th class="num">Δ a/a</th><th class="num">% liderança</th><th>Referência</th></tr></thead>
    <tbody>${comEmp.map(({ i, u }) => `<tr>
      <td>${i.nome}${flagDe(i.nome, "empregados")}</td>
      <td class="num">${fmt.n0(u.total)}</td>
      <td class="num">${u.var_aa_pct == null ? "–" : `${u.var_aa_pct > 0 ? "+" : ""}${fmt.n(u.var_aa_pct, 1)}%`}</td>
      <td class="num">${u.total ? fmt.n(u.lideranca / u.total * 100, 1) + "%" : "–"}</td>
      <td>${fmt.d(u.ref)} · FRE/${u.fre_ano} v${u.versao}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src">${badge("observado")} Número DECLARADO pela companhia listada, no escopo que ela declara — pode diferir do
    conglomerado prudencial do IF.data. Instituições sem registro de companhia aberta não têm FRE: quando divulgam o
    quadro no próprio relatório, o número aparece na tabela seguinte, separado — nunca somado a esta série.</p></div>` +
    (comPessoal.length ? tPessoal : (f2p.em_revisao ? `
    <div class="card"><p class="src">${f2p.em_revisao} extração(ões) de quadro de pessoal ou de clientes aguardando revisão
    editorial — nada é publicado sem aprovação humana e evidência (documento, página e trecho).</p></div>` : ""));

  const comAud = D.instituicoes.filter(i => i.auditor);
  const tAud = `${sechead("Auditoria", "auditor independente vigente e trocas registradas no FCA")}
  <div class="card"><div class="tblwrap"><table>
    <thead><tr><th>Companhia</th><th>Auditor vigente</th><th>Desde</th><th class="num">Trocas registradas</th></tr></thead>
    <tbody>${comAud.map(i => `<tr>
      <td>${i.nome}${flagDe(i.nome, "auditoria")}</td>
      <td>${i.auditor.vigente ? i.auditor.vigente.nome : "<i>não identificado no FCA vigente</i>"}</td>
      <td>${i.auditor.vigente ? fmt.d(i.auditor.vigente.desde) : "–"}</td>
      <td class="num">${i.auditor.historico.filter(h => h.fim).length}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="src">${badge("observado")} Troca de auditor inclui o rodízio obrigatório e não é, por si, sinal de problema.</p></div>`;

  const comCli = D.instituicoes.filter(i => i.clientes && i.clientes.length);
  const f2 = D.fase2 || {};
  const metrica = m => ((f2.metricas || {})[m] || {}).nome || m;
  let tCli = "";
  if (comCli.length) {
    const conceito = m => ((f2.metricas || {})[m] || {}).conceito || "";
    const linhas = comCli.flatMap(i => i.clientes.map(c => `<tr>
      <td>${i.nome}</td>
      <td><span title="${attr(conceito(c.metric_id))}">${metrica(c.metric_id)}</span></td>
      <td class="num">${c.exibir}</td>
      <td>${c.periodo_rotulo}</td>
      <td><a href="${attr(c.documento.url)}" target="_blank" rel="noopener"
        title="${attr(`p.${c.pagina}: “${c.evidencia}” — ${c.documento.assunto} (${c.documento.fonte})`)}">${c.documento.assunto.slice(0, 38)} · p.${c.pagina}</a></td></tr>`));
    const metricasUsadas = Array.from(new Set(comCli.flatMap(i => i.clientes.map(c => c.metric_id))));
    tCli = `${sechead("Clientes — divulgação das companhias (Fase 2)", "releases de resultados via CVM/IPE · extração revisada, evidência obrigatória")}
    <div class="card"><div class="tblwrap"><table>
      <thead><tr><th>Companhia</th><th>Métrica</th><th class="num">Valor</th><th>Período</th><th>Evidência (documento · página)</th></tr></thead>
      <tbody>${linhas.join("")}</tbody></table></div>
      <h4 style="margin:14px 0 4px">O que cada métrica significa</h4>
      <dl class="descomoler">${metricasUsadas.map(m => `<dt>${metrica(m)}</dt><dd>${conceito(m)}</dd>`).join("")}</dl>
      <p class="src">${badge("observado")} <b>Comparabilidade C:</b> cada companhia define o próprio conceito de cliente —
      estes números NÃO são comparáveis entre bancos e nunca entram em ranking. A ausência de um banco significa que ele
      não divulga o número no release, não que tenha zero clientes.${f2.em_revisao ? ` · ${f2.em_revisao} extração(ões) aguardando revisão editorial.` : ""}</p></div>`;
  } else if (f2.em_revisao) {
    tCli = `${sechead("Clientes — divulgação das companhias (Fase 2)", "releases de resultados via CVM/IPE")}
    <div class="card"><p class="src">${f2.em_revisao} extração(ões) de releases aguardando revisão editorial —
    nada é publicado sem aprovação humana e evidência (documento, página e trecho). ${f2.nota || ""}</p></div>`;
  }

  /* Custos de TI (Fase 2): despesa contábil das notas das DFP — publica só
     APROVADO com evidência; em revisão vira contagem. Conceitos e regimes não
     comparáveis entre bancos (BRGAAP × IFRS; com/sem telecom): nunca somar,
     nunca ranquear. A camada Febraban (orçamento capex+opex do sistema) é
     agregado à parte e nunca se compara às linhas das DFP. */
  const TI = D.custos_ti;
  let tTi = "";
  if (TI) {
    const ag = TI.agregado_sistema;
    const cardAg = !ag ? "" : `<div class="card"><h4>${ag.nome} ${badge("observado")}</h4>
      <div class="big" style="font-size:21px">${fmt.money(ag.orcamento_2025_brl)} <span style="font-size:13px">previstos para 2025</span></div>
      <div class="delta neutral">${fmt.money(ag.orcamento_2024_brl)} em 2024 · +${ag.variacao_pct}%</div>
      <p class="src">${ag.amostra}. <b>${ag.conceito}</b></p>
      <p class="src"><a href="${attr(ag.fonte.url)}" target="_blank" rel="noopener">${ag.fonte.nome}</a> · nível ${ag.fonte.nivel}.</p></div>`;
    const cardObs = (TI.observacoes || []).length === 0
      ? `<div class="card"><h4>Despesa de TI banco a banco — notas das DFP</h4>
        <p class="src">${fmt.n0(TI.em_revisao)} extração(ões) das notas explicativas das DFP aguardando revisão
        editorial — nada é publicado sem aprovação humana e evidência (documento, página e trecho).</p></div>`
      : `<div class="card"><h4>Despesa de TI banco a banco — notas das DFP ${badge("observado")}</h4>
        <p style="margin:6px 0">${TI.leitura}</p>
        <div class="tblwrap"><table>
          <thead><tr><th>Banco</th><th>Métrica (regime)</th><th class="num">2025</th><th class="num">Comparativos</th><th>Evidência</th></tr></thead>
          <tbody>${TI.observacoes.map(o => `<tr>
            <td>${o.banco}${o.exclusivo_ti ? "" : ` <span class="seal aprox" title="${attr(o.conceito_nota || "a rubrica é mais ampla que TI — declarado na métrica")}">não exclusivo</span>`}</td>
            <td><span title="${attr(o.trecho)}">${o.metrica}</span> <span class="src">· ${o.regime}</span></td>
            <td class="num"><b>${o.valor != null ? fmt.n0(o.valor) : "–"}</b> <span class="src">${o.unidade || ""}</span></td>
            <td class="num src">${o.comparativos ? Object.entries(o.comparativos).map(([a, v]) => `${a}: ${fmt.n0(v)}`).join(" · ") : "–"}</td>
            <td class="src"><a href="${attr(o.documento.url)}" target="_blank" rel="noopener" title="${attr(o.documento.titulo)}">${o.pagina}</a></td></tr>`).join("")}
          </tbody></table></div>
        ${(TI.cautelas || []).map(c => `<p class="src">${c}</p>`).join("")}
        <p class="src">${badge("observado")} ${TI.fonte.nome} · nível ${TI.fonte.nivel}${TI.em_revisao ? ` · ${fmt.n0(TI.em_revisao)} extração(ões) ainda em revisão` : ""}.</p></div>`;
    tTi = `${sechead("Quanto custa a TI dos bancos", "despesa contábil nas DFP · orçamento do sistema (Febraban)")}
      ${cardAg}${cardObs}`;
  }

  /* Remuneração da administração (FRE item 8, dataset estruturado da CVM):
     conceito padronizado, mas o ESCOPO da diretoria varia por governança —
     o nº de membros viaja junto, sempre. Realizado ≠ previsto, nunca
     misturados. */
  const REM = D.remuneracao;
  let tRem = "";
  if (REM && (REM.empresas || []).length) {
    const linha = (e) => {
      const de = (e.orgaos["Diretoria Estatutária"] || {});
      const ca = (e.orgaos["Conselho de Administração"] || {}).realizado;
      const r = de.realizado, p = de.previsto;
      if (!r) return "";
      return `<tr>
        <td><b>${e.nome}</b></td>
        <td class="num">${fmt.money(r.total_brl)}<div class="src">${fmt.n(r.membros, 1)} membros (média anual)</div></td>
        <td class="num"><b>${fmt.money(r.media_por_membro_brl)}</b></td>
        <td class="num">${r.maior != null ? fmt.money(r.maior) : "<span class='src'>não divulgada</span>"}</td>
        <td class="num src">${ca ? `${fmt.money(ca.total_brl)} (${fmt.n(ca.membros, 1)}m)` : "–"}</td>
        <td class="num src">${p ? `${fmt.money(p.total_brl)} <span title="proposta aprovada em assembleia para ${p.exercicio} — não é pagamento realizado">(proposta ${p.exercicio})</span>` : "–"}</td></tr>`;
    };
    tRem = `${sechead("Quanto ganha a administração", "FRE item 8 · exercício realizado × proposta · conceito CVM padronizado")}
    <div class="card"><p style="margin:6px 0">${REM.leitura}</p>
      <div class="tblwrap"><table class="data compact">
        <thead><tr><th>Companhia</th><th class="num">Diretoria estatutária (realizado ${(REM.empresas[0].orgaos["Diretoria Estatutária"].realizado || {}).exercicio || ""})</th><th class="num" title="total ÷ nº médio de membros — média aritmética, não mediana">Média/membro</th><th class="num" title="quadro 8.3 do FRE — base própria da CVM (em regra exclui encargos e desligamentos); não reconcilia com total ÷ membros">Maior individual (8.3)</th><th class="num">Conselho de Adm.</th><th class="num">Proposta ano corrente</th></tr></thead>
        <tbody>${REM.empresas.map(linha).join("")}</tbody></table></div>
      ${(REM.cautelas || []).map(c => `<p class="src">${c}</p>`).join("")}
      <p class="src">${badge("observado")} <a href="${attr(REM.fonte.url)}" target="_blank" rel="noopener">${REM.fonte.nome}</a> · nível ${REM.fonte.nivel}.</p></div>`;
  }

  const tFlags = `${sechead("Verificações automáticas", "publicadas junto do dado — nunca correção silenciosa")}
  <div class="card">${(D.flags || []).length === 0 ? `<p class="src">Nenhuma verificação pendente nesta execução.</p>` : `<div class="tblwrap"><table>
    <thead><tr><th>Instituição</th><th>Indicador</th><th>O que verificar</th></tr></thead>
    <tbody>${D.flags.map(f => `<tr><td>${f.instituicao}</td><td>${f.indicador}</td><td>${f.detalhe}</td></tr>`).join("")}</tbody></table></div>`}
    <p class="src">Regras: variação de empregados &gt;30% a/a · queda de rede &gt;15% em 12 meses · troca de auditor nos
    últimos dois anos. A flag acompanha o dado publicado; nada é ajustado por trás.</p></div>`;

  /* Fronteira da cobertura: o painel não escolhe instituições a dedo. O
     critério é o setor de atividade do cadastro da CVM, e quem fica de fora
     aparece com nome e CNPJ — lacuna declarada, nunca silenciosa. */
  const C = D.cobertura || {};
  const cob = C.bancos_cvm == null ? "" : `${sechead("Fronteira da cobertura", "quem entra, quem fica de fora e por quê")}
  <div class="card">
    <p class="src">O painel cobre <b>${fmt.n0(C.bancos_cvm_cobertos)} dos ${fmt.n0(C.bancos_cvm)}</b> bancos com registro
    ativo no Formulário Cadastral da CVM, mais Caixa, Safra e Nubank, que não são companhias abertas e entram por fontes
    próprias — <b>${fmt.n0(C.instituicoes)}</b> instituições ao todo. Critério: ${C.criterio}</p>
    ${(C.bancos_cvm_fora || []).length ? `<div class="tblwrap" style="margin-top:8px"><table class="data compact">
      <thead><tr><th>Banco registrado ainda fora do painel</th><th>CNPJ</th><th class="num">Último FCA entregue</th></tr></thead>
      <tbody>${C.bancos_cvm_fora.map(b => `<tr><td>${b.nome}</td><td class="src">${b.cnpj}</td><td class="num">${b.ultimo_fca}</td></tr>`).join("")}</tbody>
      </table></div>` : ""}
    <p class="src">${badge("observado")} Registro ativo com entrega antiga costuma ser caso encerrado que nunca foi
    baixado na CVM. Nenhuma destas instituições publica a tabela de empregados do FRE: entrariam como linha vazia, e
    ausência não vira zero.</p></div>`;

  const fontes = `<div class="card"><h4>Fontes desta página</h4>
    <ul class="src" style="margin:6px 0 0;padding-left:18px">${(D.fontes || []).map(f =>
      `<li><a href="${attr(f.url)}" target="_blank" rel="noopener">${f.nome}</a> · nível ${f.nivel}</li>`).join("")}</ul></div>`;

  el.innerHTML = pageHead({
    title: "Indicadores operacionais",
    desc: D.subtitulo,
    vintage: atual.mes ? fmt.my(atual.mes) : null,
    fontes: "CVM/FRE · CVM/FCA · BCB/ESTBAN",
  }) + aviso + kpis + tRede + tPontos + tCorr + tPresenca + tFolha + tEmp + tCli + tTi + tRem + tAud + tFlags + cob + fontes;
}

/* Página por município: a resposta à pergunta local — "que atendimento
   bancário existe em [município]?" — com o mesmo gold do mapa nacional.
   Cada uma das 5.571 páginas é indexável por rota própria (/presenca/<cod>),
   e o conteúdo obedece as mesmas regras do painel: contagens observadas dos
   cadastros do BC, classe pela profundidade do ponto, ausência declarada em
   texto (nunca zero silencioso), limitações e fontes sempre juntas. */
window.presNav = cod => { state.filters.presCod = cod; showView("presmun"); };
function renderPresencaMun() {
  const el = document.getElementById("view-presmun");
  const PR = state.data.presenca_mun;
  const cod = state.filters.presCod;
  if (!PR) { el.innerHTML = loadingCard("presença bancária municipal"); return; }
  const m = (PR.municipios || []).find(x => x.cod === cod);
  if (!m) {
    el.innerHTML = `<div class="card" style="margin-top:20px"><p>Código de município desconhecido.
    A lista completa está no mapa de presença bancária dos
    <a href="javascript:void(0)" onclick="nav('operacional')">Indicadores operacionais</a>.</p></div>`;
    return;
  }
  const PRM_COR = { agencia: "#1d4e89", posto: "#0e7c7b", correspondente: "#b45309", nenhum: "#b91c1c" };
  const classe = (PR.classes || []).find(c => c.id === m.classe) || { rotulo: m.classe, def: "" };
  const pl = (n, um, muitos) => `<b>${fmt.n0(n)}</b> ${n === 1 ? um : muitos}`;
  // a frase-síntese segue a classe: o que NÃO existe é dito com todas as letras
  const frase = m.classe === "agencia"
    ? `${m.nome} (${m.uf}) tem ${pl(m.agencia, "agência bancária", "agências bancárias")}, ${pl(m.posto, "posto de atendimento", "postos de atendimento")}, ${pl(m.pae, "posto eletrônico", "postos eletrônicos")} e ${pl(m.corresp, "ponto de correspondente", "pontos de correspondente")}, segundo os cadastros do Banco Central.`
    : m.classe === "posto"
      ? `${m.nome} (${m.uf}) não tem agência bancária: o atendimento presencial é feito por ${pl(m.posto, "posto de atendimento", "postos de atendimento")}, ${pl(m.pae, "posto eletrônico", "postos eletrônicos")} e ${pl(m.corresp, "ponto de correspondente", "pontos de correspondente")}, segundo os cadastros do Banco Central.`
      : m.classe === "correspondente"
        ? `${m.nome} (${m.uf}) não tem agência nem posto bancário: o atendimento presencial existe apenas pelos ${pl(m.corresp, "ponto de correspondente", "pontos de correspondente")} cadastrados no Banco Central.`
        : `${m.nome} (${m.uf}) não tem nenhum ponto físico de atendimento bancário cadastrado no Banco Central — nem agência, nem posto, nem correspondente.`;
  const kpi = (rot, v, nota) => `<div class="card kpi"><h4>${rot}</h4><div class="big">${fmt.n0(v)}</div>
    <div class="src">${badge("observado")} ${nota}</div></div>`;
  const uf = (PR.por_uf || []).find(u => u.uf === m.uf);
  const tot = PR.totais;
  const pct = (v, d) => d ? fmt.n(100 * v / d, 1) + "%" : "–";
  const ctxLinha = (rot, t) => `<tr><td>${rot}</td><td class="num">${fmt.n0(t.municipios)}</td>
    <td class="num">${fmt.n0(t.agencia)} (${pct(t.agencia, t.municipios)})</td>
    <td class="num">${fmt.n0(t.posto)} (${pct(t.posto, t.municipios)})</td>
    <td class="num">${fmt.n0(t.correspondente)} (${pct(t.correspondente, t.municipios)})</td>
    <td class="num">${fmt.n0(t.nenhum)}</td></tr>`;
  // vizinhança editorial: janela alfabética da mesma UF — navegação real entre as páginas municipais
  const daUf = PR.municipios.filter(x => x.uf === m.uf).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const pos = daUf.findIndex(x => x.cod === m.cod);
  const ini = Math.max(0, Math.min(pos - 6, daUf.length - 13));
  const vizinhos = daUf.slice(ini, ini + 13).filter(x => x.cod !== m.cod);
  el.innerHTML = pageHead({
    title: `Presença bancária em ${m.nome} (${m.uf})`,
    desc: "Agências, postos, postos eletrônicos e correspondentes cadastrados no Banco Central para este município.",
    fontes: "BCB/Unicad · BCB/Correspondentes · IBGE",
  }) + `
  <div class="card"><p style="margin:0">${frase}</p>
    <div class="chips" style="margin-top:10px"><span class="chip" title="${attr(classe.def)}">
      <span style="display:inline-block;width:10px;height:10px;background:${PRM_COR[m.classe]};border-radius:2px;margin-right:5px"></span>
      Classe no mapa nacional: <b>${classe.rotulo}</b></span></div>
    <p class="src" style="margin-top:8px">A classe é o ponto de <b>maior profundidade</b> de atendimento existente no
    município — não mede quantidade nem qualidade do serviço. Definições e limitações no fim da página.</p></div>
  <div class="pan-kpi">
    ${kpi("Agências bancárias", m.agencia, `posição ${PR.posicao.dependencias}`)}
    ${kpi("Postos de atendimento", m.posto, "PAB, PAC, PAA e afins")}
    ${kpi("Postos eletrônicos (PAE)", m.pae, "terminais de autoatendimento cadastrados")}
    ${kpi("Pontos de correspondente", m.corresp, `posição ${PR.posicao.correspondentes}`)}
    ${kpi("IFs com dependência própria", m.ifs_dep, "agência, posto ou PAE no município")}
    ${kpi("IFs com correspondente", m.ifs_corresp, "contratantes com ponto ativo aqui")}
  </div>
  ${sechead("O município no contexto", `comparação com ${m.uf} e com o Brasil`)}
  <div class="card"><div class="tblwrap"><table class="data compact">
    <thead><tr><th></th><th class="num">Municípios</th><th class="num">Com agência</th><th class="num">Só posto ou terminal</th><th class="num">Só correspondente</th><th class="num">Sem nenhum</th></tr></thead>
    <tbody>${uf ? ctxLinha(m.uf, uf) : ""}${ctxLinha("Brasil", tot)}</tbody></table></div>
    <p class="src" style="margin-top:6px">Contagens de municípios por classe. O mapa nacional completo está nos
    <a href="javascript:void(0)" onclick="nav('operacional')">Indicadores operacionais</a>.</p></div>
  ${vizinhos.length ? `${sechead(`Outros municípios de ${m.uf}`, "ordem alfabética")}
  <div class="card"><div class="chips">${vizinhos.map(v => `<a class="chip" href="${BASE}/presenca/${v.cod}"
    onclick="event.preventDefault();presNav('${v.cod}')">${v.nome}</a>`).join(" ")}</div></div>` : ""}
  <div class="card"><div class="note warn">${PR.aviso}</div>
    <dl class="descomoler" style="margin-top:10px">${(PR.classes || []).map(c => `<dt>${c.rotulo}</dt><dd>${c.def}</dd>`).join("")}</dl>
    <details class="decomp" style="margin-top:8px"><summary>o que estes números não dizem</summary>
      <ul style="font-size:13px;margin:6px 0 0 18px">${(PR.limitacoes || []).map(l => `<li>${l}</li>`).join("")}</ul>
    </details>
    <p class="src" style="margin-top:8px">${badge("observado")} ${(PR.fontes || []).map(f =>
      `<a href="${attr(f.url)}" target="_blank" rel="noopener">${f.nome}</a>`).join(" · ")} ·
    posição dependências ${PR.posicao.dependencias} · correspondentes ${PR.posicao.correspondentes}.
    Ausência de ponto é informação do cadastro, nunca vira zero silencioso.</p></div>`;
}

const RENDER = { overview: renderOverview, pulse: renderPulse, sectors: renderSectors, rj: renderRJ, institutions: renderInstitutions, inst: renderInstPage, sector: renderSectorPage, openfinance: renderOpenFinance, scenarios: renderScenarios, alerts: renderAlerts, research: renderResearch, method: renderMethod, products: renderProducts, product: renderProductPage, compare: renderCompare, market: renderMarket, leading: renderLeading, trends: renderTrends, panorama: renderPanorama, regulacao: renderRegulacao, bets: renderBets, fraudes: renderFraudes, juros: renderJuros, sugestoes: renderSugestoes, pix: renderPix, sobre: renderSobre, judicial: renderJudicial, pgfn: renderPgfn, desenrola: renderDesenrola, penetracao: renderPenetracao, moradia: renderMoradia, consignado: renderConsignado, operacional: renderOperacional, presmun: renderPresencaMun };
/* ---------- REGULAÇÃO: timeline transversal do mercado de crédito ---------- */
const REG_LABELS = {
  institutions: "Instituições", pix: "Pix & Pagamentos", openfinance: "Open Finance",
  consignado: "Consignado", desenrola: "Desenrola", products: "Produtos de Crédito",
  juros: "Taxas de Juros", bets: "Bets", fraudes: "Fraudes", operacional: "Operacional",
};
let regFiltro = "todos";
window.regFiltroSet = p => { regFiltro = p; renderRegulacao(); };
function renderRegulacao() {
  const el = document.getElementById("view-regulacao");
  const R = state.data.regulacao;
  if (!R || !R.disponivel) { el.innerHTML = "<p class='src'>Timeline regulatória ainda não disponível — o gold regulacao.json não foi carregado.</p>"; return; }
  const marcos = (R.marcos || []).filter(m => regFiltro === "todos" || (m.paineis || []).includes(regFiltro));
  const chips = ["todos", ...(R.paineis || [])];
  const lista = marcos.map(m => `
    <li><span class="tld">${fmt.d(m.data)}</span> <span class="src">${m.orgao}</span><br>
      <b><a href="${attr(m.url)}" target="_blank" rel="noopener">${m.ato}</a></b><br>
      <span class="src">${m.resumo}</span><br>
      ${(m.paineis || []).map(p => `<button class="btn ghost small" onclick="nav('${p}')">${REG_LABELS[p] || p} →</button>`).join(" ")}
      ${m.serie_x ? `<span class="src" style="margin-left:6px">· marcador nas séries em ${fmt.my(m.serie_x)}</span>` : ""}
    </li>`).join("");
  el.innerHTML = `
  ${pageHead({ title: "Regulação do mercado de crédito",
    desc: "A linha do tempo transversal: os marcos regulatórios que explicam quebras visíveis nas séries do Observatório, cada um com o texto oficial e os painéis que afeta.",
    fontes: "Planalto · BCB/CMN (textos oficiais)" })}
  <div class="note warn"><b>Coincidência no tempo não é efeito.</b> ${R.leitura}</div>
  <div class="controls"><span class="seg">${chips.map(p => `<button class="${regFiltro === p ? "active" : ""}" onclick="regFiltroSet('${p}')">${p === "todos" ? `todos (${(R.marcos || []).length})` : REG_LABELS[p] || p}</button>`).join("")}</span></div>
  <div class="card">
    <h3>Linha do tempo (${marcos.length} marco${marcos.length === 1 ? "" : "s"})</h3>
    <ul class="bets-tl">${lista || "<li><span class='src'>nenhum marco para este painel — a régua é editorial, não um censo.</span></li>"}</ul>
  </div>
  <div class="card"><h4>Linhas do tempo temáticas</h4>
    <p class="src">Dois temas têm timelines próprias, mais detalhadas, dentro das suas abas:</p>
    ${(R.timelines_tematicas || []).map(t => `<p><button class="btn ghost small" onclick="nav('${t.painel}')">${t.nome} →</button></p>`).join("")}
    <p class="src">E a aba Consignado marca as mudanças de margem consignável diretamente nos gráficos de saldo.</p>
  </div>
  <div class="card"><p class="src">${badge("observado")} ${R.fonte.nome} · nível ${R.fonte.nivel} — ${R.fonte.nota}. Atualizado ${(R.gerado_em || "").slice(0, 10)}.</p></div>`;
}

function rerenderCurrent() { const v = currentView(); if (RENDER[v]) RENDER[v](); }
const VIEW_TITLES = { overview: "Visão geral", pulse: "Pulso do crédito", sectors: "Risco setorial", rj: "Recuperações & Falências", institutions: "Instituições", inst: "Instituição", sector: "Setor", openfinance: "Open Finance", scenarios: "Cenários", alerts: "Alertas", research: "Pesquisa", regulacao: "Regulação do Crédito", method: "Metodologia & Fontes", products: "Produtos de Crédito", product: "Produto", compare: "Comparador", market: "Mercado & Valor", leading: "Sinais Antecedentes", trends: "Tendências de Busca", panorama: "Panorama do Crédito", bets: "Bets e risco financeiro", fraudes: "Fraudes financeiras e risco de crédito", juros: "Taxas de Juros por IF", sugestoes: "Sugestões", pix: "Pix e Meios de Pagamento", sobre: "Sobre o Observatório", judicial: "Ações judiciais e instituições financeiras", pgfn: "Dívida Ativa da União", desenrola: "Desenrola Brasil", penetracao: "Penetração e Gap de Crédito", moradia: "Moradia e Crédito Habitacional", consignado: "Consignado, Previdência e Envelhecimento", operacional: "Indicadores operacionais", presmun: "Presença bancária municipal" };
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


/* ---------- acessibilidade: regiões roláveis (WCAG 2.1.1 e 2.4.7) ----------
   Tabelas largas e mapas de calor rolam na horizontal dentro de um contêiner.
   Quem navega com mouse arrasta; quem navega por teclado não tinha como chegar
   às colunas da direita, porque o contêiner não recebia foco. O tabindex só
   entra onde há rolagem de fato — pôr foco em contêiner que não rola criaria
   paradas de tabulação vazias, que é o defeito oposto. */
function acessibilizaRolagem(raiz) {
  (raiz || document).querySelectorAll(".tblwrap, .heatwrap, .cmpwrap, .tblwrap-x").forEach(el => {
    const rola = el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
    if (rola && !el.hasAttribute("tabindex")) {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "region");
      el.dataset.rolavel = "1";
      if (!el.getAttribute("aria-label")) {
        const t = el.querySelector("table caption, th");
        el.setAttribute("aria-label", `área rolável${t ? ": " + attr(t.textContent).slice(0, 60) : ""} — use as setas para percorrer`);
      }
    } else if (!rola && el.dataset.rolavel === "1") {
      el.removeAttribute("tabindex"); el.removeAttribute("role"); delete el.dataset.rolavel;
    }
  });
}

/* Reavalia depois de cada render e a cada mudança de largura: o que rola em
   375 px pode não rolar em 1440 px, e vice-versa. */
let _rolagemAgendada = 0;
/* Tabelas largas em celular: em vez de comprimir a tabela desktop, cada linha vira um
   bloco com rótulo:valor por célula. O rótulo vem do cabeçalho e é anotado aqui, uma vez
   por tabela — o CSS só ativa a apresentação empilhada abaixo de 700px, e apenas para
   tabelas com cinco ou mais colunas (as estreitas, como rankings de três colunas,
   continuam tabelas, que é o formato certo para elas). */
function adaptaTabelasMoveis(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll("table.data:not([data-movel])").forEach(t => {
    t.setAttribute("data-movel", "1");
    // Só cabeçalho simples: uma linha de th, mesma contagem de colunas do corpo.
    // Cabeçalho mesclado em dois níveis (como os grupos Total/Urbano/Rural) produziria
    // rótulos desalinhados — essas tabelas continuam roláveis, que é o correto para elas.
    const linhasThead = t.querySelectorAll("thead tr");
    if (linhasThead.length !== 1) return;
    // textContent, não innerText: dentro de um <details> fechado o innerText é vazio
    // (depende de renderização), e a tabela empilharia com todos os rótulos em branco.
    const ths = [...linhasThead[0].querySelectorAll("th")].map(th => th.textContent.replace(/[↑↓]/g, "").trim());
    const corpo = t.querySelector("tbody tr");
    if (ths.length < 5 || !corpo || corpo.children.length !== ths.length) return;
    if (ths.filter(Boolean).length < ths.length - 1) return;  // cabeçalho sem texto útil
    t.classList.add("t-stack");
    t.querySelectorAll("tbody tr").forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (ths[i] && !td.hasAttribute("data-rotulo")) td.setAttribute("data-rotulo", ths[i]);
      });
    });
  });
}

function agendaAcessibilidade() {
  clearTimeout(_rolagemAgendada);
  _rolagemAgendada = setTimeout(() => {
    const ativa = document.querySelector("section.view.active");
    acessibilizaRolagem(ativa);
    adaptaTabelasMoveis(ativa);
  }, 120);
}
window.addEventListener("resize", agendaAcessibilidade);
// re-renders internos (filtro, aba, busca) não passam por showViewSilent:
// o observador cobre todos sem que cada render precise se lembrar disso
document.addEventListener("DOMContentLoaded", () => {
  const alvo = document.getElementById("main");
  if (alvo && window.MutationObserver) new MutationObserver(agendaAcessibilidade).observe(alvo, { childList: true, subtree: true });
});

function showViewSilent(v) {
  try { navPrepara(); navSincroniza(); } catch (e) {}
  pingView(v);
  document.querySelectorAll("nav.tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === v || (v === "inst" && b.dataset.view === "institutions") || (v === "sector" && b.dataset.view === "sectors") || (v === "product" && b.dataset.view === "products") || (v === "presmun" && b.dataset.view === "operacional")));
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
  agendaAcessibilidade();
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
/* Observatório público: o padrão do rodapé é o visitante (botão "Entrar").
   Se a sessão existir (/api/auth/eu → 204), troca para "Minha conta"/"Sair". */
(function initSessionFoot() {
  const login = document.getElementById("loginBtn");
  const account = document.getElementById("accountBtn");
  const logout = document.getElementById("logoutBtn");
  if (!login || !account || !logout) return;
  fetch("/api/auth/eu", { credentials: "same-origin" })
    .then(r => {
      if (r.status === 204) { login.hidden = true; account.hidden = false; logout.hidden = false; }
    })
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
  const a = state.data.alertas_central;
  if (!el || !a || !a.alertas) { return; }
  const n = alertasAbertos(a.alertas).length;  // todas as famílias, não só a macro
  el.textContent = n;
  el.hidden = n === 0;
}
window.showView = v => {
  if (PATH_MODE) {
    let path = ROUTES[v] || "/overview";
    if (v === "inst" && state.filters.instCod) path = "/institutions/" + state.filters.instCod;
    if (v === "product" && state.filters.productSlug) path = "/products/" + state.filters.productSlug;
    if (v === "sector" && state.filters.sectorCod) path = "/sectors/" + state.filters.sectorCod;
    if (v === "presmun" && state.filters.presCod) path = "/presenca/" + state.filters.presCod;
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
window.pmxQ = v => { PMX_STATE.q = v.toLowerCase(); comFocoPreservado(renderProductPage); };
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
  let rows = p.matriz.filter(r => !PMX_STATE.q || _norm(r.nome).includes(_norm(PMX_STATE.q)));
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
  ${(function(){
    /* Risco × preço × tamanho, por IF: x = atraso ≥15d NO PRODUTO (estoque),
       y = taxa média a.a. das NOVAS operações (txjuros, janela mais recente),
       bolha = carteira no produto. Dois conceitos de tempo convivem de
       propósito e são declarados: estoque de atraso × fluxo de preço novo —
       leitura exploratória, nunca "curva de risco-preço". Só entra IF com
       casamento carteira↔taxa inequívoco (cnpj8 ou nome único). */
    const pts = p.matriz.filter(r => r.taxa_aa != null && r.atraso15_pct != null && r.carteira_brl > 0);
    if (pts.length < 3) return "";
    const pares = pts.map(r => ({ x: r.atraso15_pct, y: r.taxa_aa, size: r.carteira_brl, label: r.nome.slice(0, 22), grp: r.taxa_casamento === "nome" ? "casado por nome" : undefined }));
    const med = a => { const s = [...a].sort((m, n) => m - n); return s[Math.floor(s.length / 2)]; };
    const semTaxa = p.matriz.filter(r => r.atraso15_pct != null && r.carteira_brl > 0).length - pts.length;
    return `<h3>Atraso × taxa × carteira, por instituição <span class="src">(${pts.length} IFs com os três dados)</span></h3>
    <div class="card">${scatterPlot(pares, "atraso ≥15d no produto (%)", "taxa média a.a. das novas operações (%)", 680, 320,
      { sizeLabel: "carteira no produto", labels: pts.length <= 25,
        refX: med(pares.map(q => q.x)), refXLabel: "mediana do atraso",
        refY: med(pares.map(q => q.y)), refYLabel: "mediana da taxa" })}
    <div class="note warn" style="margin-top:8px"><b>Dois relógios diferentes, de propósito:</b> o eixo x é o ESTOQUE em
    atraso ≥15d da carteira do produto (IF.data, trimestral); o eixo y é o preço das operações NOVAS da janela mais
    recente do txjuros (semanal) — não é a taxa da carteira. A bolha é a carteira no produto. Leitura exploratória:
    posição acima-e-à-direita sugere preço acompanhando risco; fora da diagonal convida investigação, não conclusão.</div>
    <p class="src">Casamento carteira↔taxa por CNPJ-raiz (IFs individuais) ou nome normalizado único (conglomerados) —
    ${semTaxa > 0 ? `${semTaxa} instituição(ões) com carteira e atraso, mas sem taxa casada, ficam fora do gráfico (ausência declarada).` : "todas as IFs com atraso têm taxa casada."}</p></div>`;
  })()}
  <h3>Matriz produto × instituição <span class="src">(${p.matriz.length} instituições)</span></h3>
  <div class="controls">
    <input type="search" id="pmxq-input" placeholder="filtrar instituição…" value="${PMX_STATE.q}" oninput="pmxQ(this.value)" aria-label="filtrar instituição">
    <button class="btn small" id="pmxCmpBtn" onclick="pmxCompare()">comparar selecionadas (${Object.keys(PMX_STATE.sel).length})</button>
    <button class="btn ghost small" onclick="exportProductCSV('${p.slug}')">CSV</button>
    <button class="btn ghost small" onclick="exportProductXLSX('${p.slug}')">XLSX</button>
    <button class="btn ghost small" onclick="navigator.clipboard.writeText(location.href).then(()=>alert('URL copiada'))">copiar URL</button>
    ${!PMX_STATE.all && rows.length > 60 ? `<button class="btn ghost small" onclick="pmxAll()">mostrar todas (${rows.length})</button>` : rows.length > 60 ? `<button class="btn ghost small" onclick="pmxAll()">mostrar top-60</button>` : ""}
  </div>
  <div class="tblwrap"><table class="data"><thead><tr><th></th>${th("nome", "Instituição")}${th("carteira_brl", "Carteira no produto")}${th("share_pct", "Participação")}${th("d4t_pct", "Δ 4 trim.")}${th("d1t_pct", "Δ 1 trim.")}${th("pct_carteira_inst", "% da carteira da IF", "carteira no produto ÷ total PF+PJ da MESMA IF nos relatórios de modalidade (123/128) — numerador e denominador do mesmo universo; a Carteira de Crédito do Resumo é outro conceito e não é usada aqui")}${th("atraso15_pct", "Atraso ≥15d NO PRODUTO", "vencido ≥15 dias ÷ carteira da modalidade (IF.data rel. 123/128) — conceito de atraso, específico do produto; não é NPL >90d")}${th("npl_inst_pct", "Inad. >90d TOTAL da IF", "Inadimplência >90d total da instituição (Res. 4.966) — NÃO específica do produto")}${th("basileia_pct", "Basileia")}</tr></thead>
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
  const qn = _norm(q);
  const hits = ix.instituicoes.filter(i => _norm(i.nome || "").includes(qn) || _norm(i.razao || "").includes(qn) || i.cod.toLowerCase().includes(q)).slice(0, 12);
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
      <p class="src" >Com os dados coletados (IF.data Resumo, Capital e Carteiras), o comparador cobre escala, funding, capital, mix e qualidade de carteira. Quando a DRE detalhada do IF.data e os balancetes COSIF entrarem no pipeline, esta aba passa a calcular: despesas de pessoal e administrativas agrupadas, índice de eficiência, TI restrita vs TI ampliada (sempre separadas), e produtividade por funcionário e por agência — cada valor com selo reportado/contábil/derivado e nunca um "gasto total com TI" exato a partir de componentes parciais.</p></div>`;
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
  ${ctx}${body}${cmpRedeFase0(cmp.insts, datas)}`;
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
