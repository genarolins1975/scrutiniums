/* eslint-disable @typescript-eslint/no-explicit-any -- leitura do CSS da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOKENS } from "../lib/tokens.gerado";

/**
 * Contraste WCAG 2.1 AA, calculado sobre os tokens do design system.
 *
 * A auditoria completa (axe-core num navegador real, 23 páginas × 2 temas) está
 * em docs/AUDITORIA_WCAG.md. Ela encontrou 161 nós reprovados em contraste, e
 * todos vinham de SEIS tokens — não de casos isolados. Este teste fecha essa
 * porta: recalcula a razão de contraste de cada par (cor de texto × fundo) que
 * o CSS de fato usa e reprova antes do deploy. Desde 23/10/2026 a aplicação tem um tema só, o da plataforma (Iniciativa 2 do
 * parecer de UX: o tema escuro próprio saiu, porque a barra, a navegação e o fim de página da plataforma não o têm).
 *
 * Por que aqui e não no navegador: o que regride é o token. Quem mexer numa cor
 * do :root descobre no `npm test`, sem precisar subir servidor nem baixar
 * Chromium. O que este teste NÃO cobre — ordem de foco, leitor de tela, rótulos
 * dinâmicos — está declarado no documento da auditoria.
 */
const css = readFileSync(join(process.cwd(), "public/obs/styles.css"), "utf-8");

/* ---------- luminância relativa e razão de contraste (WCAG 2.x) ---------- */
function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}
function luminancia(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(a: string, b: string) {
  const [l1, l2] = [luminancia(a), luminancia(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** color-mix(in srgb, X p%, Y) — a SPA usa a forma simples, em sRGB. */
function mistura(x: string, y: string, p: number) {
  const [a, b] = [rgb(x), rgb(y)];
  return "#" + a.map((v, i) => Math.round(v * p + b[i] * (1 - p)).toString(16).padStart(2, "0")).join("");
}

/* ---------- tokens ----------
   Desde a Iniciativa 5 a SPA lê os valores dos tokens da plataforma (src/app/globals.css, servidos em public/obs/tokens.css):
   var(--x) é resolvido primeiro no próprio bloco e depois em TOKENS; color-mix(in srgb, A p%, B) é calculado. */
function brutos(bloco: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of bloco.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].replace(/\/\*[\s\S]*?\*\//g, "").trim();
  return out;
}
function resolver(mapa: Record<string, string>): Record<string, string> {
  const plataforma = TOKENS as Record<string, string>;
  const valor = (expr: string, visto: Set<string>): string | null => {
    expr = expr.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(expr)) return expr.slice(0, 7);
    const ref = expr.match(/^var\((--[\w-]+)\)$/);
    if (ref) {
      const nome = ref[1];
      if (visto.has(nome)) return null;
      visto.add(nome);
      if (mapa[nome]) return valor(mapa[nome], visto);
      return plataforma[nome.slice(2)] ?? null;
    }
    const mix = expr.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$/);
    if (mix) {
      const [x, y] = [valor(mix[1], new Set(visto)), valor(mix[3], new Set(visto))];
      return x && y ? mistura(x, y, parseFloat(mix[2]) / 100) : null;
    }
    return null;
  };
  const out: Record<string, string> = {};
  for (const nome of Object.keys(mapa)) {
    const v = valor(mapa[nome], new Set([nome]));
    if (v) out[nome] = v;
  }
  return out;
}
const brutoClaro = brutos(css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {"))));
const claro = resolver(brutoClaro);

/**
 * Pares realmente usados na interface. Vêm da auditoria com axe: cada linha
 * corresponde a um seletor concreto do CSS, não a uma combinação hipotética.
 * `tinta` reproduz o color-mix quando o fundo é uma tintura do próprio token.
 */
const PARES: Array<{ onde: string; texto: string; fundo: string; tinta?: number }> = [
  { onde: ".src / .filterbar (texto auxiliar sobre cartão)", texto: "--text-3", fundo: "--surface-2" },
  { onde: ".seal.desc / .seal.ctx (selo descontinuado e de contexto, sobre a superfície)", texto: "--text-3", fundo: "--surface" },
  { onde: ".sel .src (auxiliar sobre tinta do acento)", texto: "--text-3", fundo: "--accent-soft" },
  { onde: ".src sobre a superfície do cartão", texto: "--text-3", fundo: "--surface" },
  { onde: ".guiamais (entenda esta página)", texto: "--accent", fundo: "--surface" },
  { onde: ".qbadge.q-mid / .nivel.nd", texto: "--warning", fundo: "--warning-soft" },
  { onde: ".alert.atencao .lvl", texto: "--warning", fundo: "--surface" },
  { onde: ".alert.informativo .lvl", texto: "--unavail", fundo: "--surface" },
  { onde: ".qbadge.q-high", texto: "--positive", fundo: "--positive-soft" },
  { onde: ".alert.critico .lvl / .qbadge.q-low", texto: "--negative", fundo: "--negative-soft" },
  { onde: "nav.tabs button.active", texto: "--accent-ink", fundo: "--accent-soft" },
  { onde: ".nivel.nb (tinta 12% do próprio tom)", texto: "--teal", fundo: "--surface", tinta: 0.12 },
  // selos na forma do SeloNatureza: tom da natureza sobre a superfície, borda na mesma cor (Iniciativa 2, 23/10/2026)
  { onde: ".seal.obs (observado)", texto: "--cor-natureza-observado", fundo: "--surface" },
  { onde: ".seal.calc (calculado)", texto: "--cor-natureza-calculado", fundo: "--surface" },
  { onde: ".seal.est / .seal.demo (estimado, demonstrativo)", texto: "--cor-natureza-estimado", fundo: "--surface" },
  { onde: ".seal.prev / .seal.exp (previsto, experimental)", texto: "--cor-natureza-previsto", fundo: "--surface" },
  { onde: ".seal.cen (cenário)", texto: "--cor-natureza-cenario", fundo: "--surface" },
  { onde: ".seal.aprox (aproximação)", texto: "--text-2", fundo: "--surface" },
  { onde: "texto principal sobre o cartão", texto: "--text", fundo: "--surface" },
  { onde: "texto secundário sobre o cartão", texto: "--text-2", fundo: "--surface" },
];

const AA = 4.5; // texto normal; selos e rótulos têm 12 a 13 px, então nenhum se qualifica como "grande"

describe("contraste AA", () => {
  const T = claro;
  const tema = "da aplicação";
  it.each(PARES)("$onde", ({ texto, fundo, tinta }) => {
    // o que a folha não redefine é lido direto dos tokens da plataforma (os selos usam --cor-natureza-*)
    const plataforma = TOKENS as Record<string, string>;
    const fg = T[texto] ?? plataforma[texto.slice(2)], base = T[fundo] ?? plataforma[fundo.slice(2)];
    expect(fg, `token ${texto} não encontrado no tema ${tema}`).toBeTruthy();
    expect(base, `token ${fundo} não encontrado no tema ${tema}`).toBeTruthy();
    const bg = tinta ? mistura(fg, base, tinta) : base;
    const r = contraste(fg, bg);
    expect(
      Number(r.toFixed(2)),
      `${texto} (${fg}) sobre ${fundo}${tinta ? ` tinta ${tinta * 100}%` : ""} (${bg}) = ${r.toFixed(2)}:1, mínimo AA ${AA}:1`,
    ).toBeGreaterThanOrEqual(AA);
  });
});

describe("contraste: os tokens de gráfico usados como texto seguem os semânticos", () => {
  it.each([["claro", claro]])(
    "linha 2 e 3 e cinza acompanham teal, warning e unavail — tema %s",
    (_tema, T: any) => {
      // .comp (Mercado) pinta texto com as cores das séries: se divergirem dos
      // tokens semânticos, o texto reprova sem que ninguém perceba. Foi assim
      // que o cinza do tema escuro sobreviveu à primeira rodada de correções.
      expect(T["--c-line2"]).toBe(T["--teal"]);
      expect(T["--c-line3"]).toBe(T["--warning"]);
      expect(T["--c-gray"]).toBe(T["--unavail"]);
    });

  it.each([["claro", claro]])(
    "as cores de série passam em AA como texto sobre o cartão — tema %s",
    (_tema, T: any) => {
      for (const t of ["--c-line1", "--c-line2", "--c-line3", "--c-gray", "--c-pos", "--c-neg", "--c-forecast"]) {
        if (!T[t]) continue;
        const r = contraste(T[t], T["--surface"]);
        expect(Number(r.toFixed(2)), `${t} (${T[t]}) sobre --surface = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
      }
    });

  it("o tom do Pix passa em AA sobre a própria tinta", () => {
    // valor de --pix lido do token da plataforma (--cor-conect, src/app/globals.css; antes --cor-credito-pix)
    const iPix = css.indexOf(":root { --pix:");
    const pix = resolver(brutos(css.slice(iPix, css.indexOf("}", iPix))))["--pix"];
    expect(pix).toBeTruthy();
    expect(contraste(pix, mistura(pix, claro["--surface"], 0.12))).toBeGreaterThanOrEqual(AA);
  });
});

describe("estrutura: correções da auditoria que não podem voltar", () => {
  const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
  const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");

  it("região rolável recebe foco de teclado (WCAG 2.1.1)", () => {
    expect(app).toContain("function acessibilizaRolagem(");
    const i = app.indexOf("function acessibilizaRolagem(");
    const corpo = app.slice(i, app.indexOf("\n}", i));
    expect(corpo).toContain("scrollWidth");           // só onde rola de fato
    expect(corpo).toContain('setAttribute("tabindex", "0")');
    expect(corpo).toContain("aria-label");
  });

  it("re-render interno também reavalia — não só a troca de página", () => {
    expect(app).toContain("MutationObserver");
    expect(app).toContain("agendaAcessibilidade");
  });

  it("o mapa não se declara imagem única tendo 27 UFs focáveis", () => {
    // role="img" com filhos interativos é interativo aninhado (axe: nested-interactive)
    expect(app).not.toMatch(/class="panmap"[^`]*role="img"/);
    expect((app.match(/class="panmap"[^`]*role="group"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("clicáveis não nativos continuam alcançáveis por teclado", () => {
    expect(app).toContain("function a11yEnhance(");
    expect(app).toMatch(/e\.key !== "Enter" && e\.key !== " "/);
  });

  it("o documento declara idioma e título", () => {
    expect(html).toMatch(/<html[^>]+lang="pt-BR"/);
    expect(html).toMatch(/<title>/);
  });
});
